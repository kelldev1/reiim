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

const MODEL = 'claude-sonnet-5';
// Marge pour la réflexion "adaptive" + la réponse rédigée.
const MAX_TOKENS = 4000;
// low | medium | high | xhigh | max — compromis coût / qualité pour un devoir.
const EFFORT = 'medium';
const RATE_WINDOW_MS = 5000;

const SYSTEM = `Tu es un tuteur qui aide des élèves (collège / lycée, France) à faire leurs devoirs EN AVANCE.
Ton rôle : traiter l'exercice ou le devoir demandé et MONTRER toute la démarche, étape par étape, comme le ferait un bon professeur.
Règles :
- Explique le raisonnement, pas seulement le résultat final.
- Français clair, notation adaptée au niveau scolaire.
- Si l'énoncé est incomplet ou ambigu, dis d'abord ce qui manque, puis propose l'hypothèse la plus probable et continue.
- Structure : compréhension de l'énoncé → étapes de résolution → résultat → court "À retenir".
- Tu aides l'élève à comprendre et à rédiger son travail ; ne promets jamais de note.`;

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
  };
  const prompt = String(body.prompt ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const feature = String(body.feature ?? 'exercices').slice(0, 40);
  if (!prompt) return json({ error: 'empty-prompt' }, 400);
  if (prompt.length > 8000) return json({ error: 'prompt-too-long' }, 400);

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

  const userContent = subject
    ? `Matière : ${subject}\n\nÉnoncé / devoir :\n${prompt}`
    : prompt;

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
