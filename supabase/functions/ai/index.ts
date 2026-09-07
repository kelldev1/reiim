// reiim — AI proxy Edge Function.
//
// Fournisseur : Anthropic (Claude). Le navigateur ne parle jamais au modèle :
// il passe par cette fonction qui détient la clé API et, avant chaque appel :
//   1. vérifie le JWT Supabase de l'appelant
//   2. rate-limit doux (1 requête / 5 s par utilisateur)
//   3. dépense 1 crédit (atomique ; remboursé si l'appel échoue)
//   4. logue la consommation de tokens
//
// La clé vit UNIQUEMENT ici : `supabase secrets set LLM_API_KEY=sk-ant-...`
// (crédits sur https://console.anthropic.com/settings/billing).
//
// Changer de modèle : la constante MODEL ci-dessous
// (claude-sonnet-5 ≈ 2 $/1M entrée, 10 $/1M sortie ; claude-opus-5 plus puissant, plus cher).
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';

// claude-opus-5 = le plus fort en maths/raisonnement (≈ 5 $/1M entrée, 25 $/1M sortie).
// claude-sonnet-5 = 2,5× moins cher, bon mais plus faillible sur les exos difficiles.
const MODEL = 'claude-opus-5';
// Marge pour la réflexion + un devoir entier avec vérifications.
const MAX_TOKENS = 8000;
// low | medium | high | xhigh | max — la justesse des calculs dépend beaucoup de ça.
const EFFORT = 'high';
const RATE_WINDOW_MS = 5000;

const SYSTEM = `Tu FAIS le devoir d'un élève (collège / lycée, France), en entier, prêt à être rendu.

EXIGENCE N°1 — LA JUSTESSE :
- Traite chaque question de l'énoncé, aucune oubliée.
- Pose chaque calcul étape par étape ; ne saute pas d'étape "de tête".
- VÉRIFIE chaque résultat clé (substitution, ordre de grandeur, cas limite) avant de le donner. Si la vérification échoue, reprends le calcul.
- Si tu n'es pas certain d'un point (énoncé peu clair, donnée manquante, résultat douteux), dis-le explicitement au lieu d'inventer.

PRÉSENTATION :
- La réponse EST le devoir terminé : un travail rédigé et complet, pas des conseils, pas de "je vais t'aider".
- Pas de méta-commentaire ("comprenons l'énoncé", "analysons", "à retenir", "pense à réviser").
- Intitulés courts en **gras** (n'utilise PAS de titres Markdown avec #). Étapes numérotées pour une démarche. Résultat final sur sa propre ligne, en évidence.
- Maths / physique / chimie : notation LaTeX — $ ... $ en ligne, $$ ... $$ pour un calcul isolé.
- Français clair au niveau de l'élève. Longueur juste : ni bâclé, ni délayé.
- Rédaction (dissertation, commentaire, essai) : rends le texte fini et structuré (introduction, développement, conclusion), pas un plan.
- Énoncé ambigu ou incomplet : prends l'hypothèse la plus raisonnable, signale-la en une ligne au début, puis fais le devoir.`;

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const LLM_API_KEY = Deno.env.get('LLM_API_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !LLM_API_KEY) {
    return json({ error: 'server-misconfigured' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'auth' }, 401);

  // 1. verify the caller
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'auth' }, 401);

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: unknown;
    subject?: unknown;
    feature?: unknown;
    pdf?: unknown;
  };
  const prompt = String(body.prompt ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const feature = String(body.feature ?? 'exercices').slice(0, 40);
  // PDF de l'énoncé, encodé base64 (sans le préfixe data:).
  const pdf = typeof body.pdf === 'string' ? body.pdf : '';
  if (!prompt && !pdf) return json({ error: 'empty-prompt' }, 400);
  if (prompt.length > 8000) return json({ error: 'prompt-too-long' }, 400);
  if (pdf.length > 9_000_000) return json({ error: 'pdf-too-large' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 2. soft rate limit
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((count ?? 0) > 0) return json({ error: 'rate-limit' }, 429);

  // 3. spend a credit (atomic; -1 means the user has none)
  const { data: remaining, error: deductErr } = await admin.rpc('deduct_ai_credit', {
    p_user: user.id,
  });
  if (deductErr) return json({ error: 'server' }, 500);
  if (remaining === -1) return json({ error: 'no-credits' }, 402);

  const intro = subject ? `Matière : ${subject}\n\n` : '';
  const text = pdf
    ? `${intro}${prompt || "Fais le devoir de l'énoncé joint (PDF), en entier."}`
    : `${intro}Énoncé / devoir :\n${prompt}`;

  const userContent: any[] = [];
  if (pdf) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf },
    });
  }
  userContent.push({ type: 'text', text });

  const anthropic = new Anthropic({ apiKey: LLM_API_KEY });

  try {
    const msg: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      output_config: { effort: EFFORT },
      messages: [{ role: 'user', content: userContent }],
    } as any);

    if (msg.stop_reason === 'refusal') {
      await admin.rpc('refund_ai_credit', { p_user: user.id });
      const cat = msg.stop_details?.category ?? 'refusal';
      return json({ error: 'refused', detail: String(cat) }, 422);
    }

    const answer = ((msg.content ?? []) as any[])
      .filter((b) => b?.type === 'text')
      .map((b) => b.text as string)
      .join('\n')
      .trim();

    if (!answer) {
      await admin.rpc('refund_ai_credit', { p_user: user.id });
      return json({ error: 'refused', detail: msg.stop_reason ?? 'empty-response' }, 422);
    }

    await admin.from('ai_usage').insert({
      user_id: user.id,
      feature,
      model: MODEL,
      input_tokens: msg.usage?.input_tokens ?? null,
      output_tokens: msg.usage?.output_tokens ?? null,
      cached_input_tokens: msg.usage?.cache_read_input_tokens ?? 0,
    });

    return json({ answer, creditsLeft: remaining });
  } catch (err) {
    await admin.rpc('refund_ai_credit', { p_user: user.id });

    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? null;
      const detail = String(err.message ?? 'api-error').slice(0, 400);
      console.error('llm-error', status, detail);
      // 429 → on le relaie tel quel pour que le front dise "doucement".
      if (status === 429) return json({ error: 'rate-limit' }, 429);
      return json({ error: 'ai-failed', status, detail }, 502);
    }

    const detail = String((err as Error)?.message ?? err).slice(0, 400);
    console.error('ai-failed', detail);
    return json({ error: 'ai-failed', status: null, detail }, 502);
  }
});
