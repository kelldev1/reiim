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

// Prompts spécifiques à certaines méthodes.
const SYSTEM_MINDMAP = `Tu construis une CARTE MENTALE de révision pour un élève (collège / lycée, France) sur le sujet donné.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises \`\`\`. Forme :
{"text":"<sujet, 1-4 mots>","children":[{"text":"<branche>","children":[{"text":"<sous-idée>","children":[]}]}]}

Règles :
- 4 à 6 branches principales couvrant l'essentiel du chapitre.
- 2 à 4 sous-idées par branche ; un 3e niveau seulement si vraiment utile (max profondeur 4).
- Texte de chaque nœud : 5 mots MAXIMUM, style prise de notes (mots-clés, dates, noms, formules). Jamais de phrase, pas de ponctuation de fin.

EXACTITUDE (impératif) :
- Chaque date, nom propre, chiffre, définition doit être EXACT et vérifiable dans un manuel scolaire.
- En cas de doute sur une précision (une date exacte, un nom), reste général plutôt que d'inventer.
- Pas d'approximation ni d'anachronisme. Relis mentalement chaque fait avant de le mettre.
- Français, niveau et programme de l'élève.`;

const SYSTEM_FLASHCARDS = `Tu crées un jeu de FLASHCARDS de révision pour un élève (collège / lycée, France) sur le sujet donné.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, sans balises \`\`\`. Forme :
[{"q":"<question courte>","a":"<réponse courte et exacte>"}]

Règles :
- 12 à 16 cartes couvrant les notions clés du chapitre (définitions, dates, formules, vocabulaire, causes / conséquences, exemples types).
- Question : précise, une seule chose demandée. Réponse : la plus courte possible tout en restant complète (un mot, une date, une phrase, une formule).
- La réponse ne répète jamais la question.

EXACTITUDE (impératif) :
- Chaque date, nom propre, chiffre, définition, formule doit être EXACT et vérifiable dans un manuel scolaire.
- En cas de doute sur une précision, reste général ou omets la carte plutôt que d'inventer.
- Pas d'anachronisme, pas d'approximation. Relis mentalement chaque fait.
- Français, niveau et programme de l'élève.`;

const SYSTEMS: Record<
  string,
  { system: string; maxTokens: number; effort: string; free?: boolean; model?: string }
> = {
  // Contenus de révision générés = gratuits. Sonnet 5 + effort medium : assez fiable
  // pour du scolaire, moins cher qu'Opus pour une fonctionnalité offerte.
  mindmap: {
    system: SYSTEM_MINDMAP,
    model: 'claude-sonnet-5',
    maxTokens: 1600,
    effort: 'medium',
    free: true,
  },
  flashcards: {
    system: SYSTEM_FLASHCARDS,
    model: 'claude-sonnet-5',
    maxTokens: 2200,
    effort: 'medium',
    free: true,
  },
};

// Origines autorisées : secret ALLOWED_ORIGINS (liste séparée par des virgules).
// Vide ⇒ '*' (dev / avant de fixer le domaine de prod).
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsFor = (req: Request): Record<string, string> => {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED.length === 0 ? '*' : ALLOWED.includes(origin) ? origin : ALLOWED[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

const json = (body: unknown, status = 200, cors: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405, cors);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const LLM_API_KEY = Deno.env.get('LLM_API_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !LLM_API_KEY) {
    return json({ error: 'server-misconfigured' }, 500, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'auth' }, 401, cors);

  // 1. verify the caller
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await asUser.auth.getUser();
  if (userErr || !user) return json({ error: 'auth' }, 401, cors);

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
  const mode = SYSTEMS[feature];
  if (!prompt && !pdf && !mode) return json({ error: 'empty-prompt' }, 400, cors);
  if (prompt.length > 8000) return json({ error: 'prompt-too-long' }, 400, cors);
  if (pdf.length > 9_000_000) return json({ error: 'pdf-too-large' }, 400, cors);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 2. soft rate limit
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);
  if ((count ?? 0) > 0) return json({ error: 'rate-limit' }, 429, cors);

  // 3. dépense 1 crédit — sauf pour les modes gratuits (ex. carte mentale).
  let remaining = -1;
  if (!mode?.free) {
    const { data, error: deductErr } = await admin.rpc('deduct_ai_credit', {
      p_user: user.id,
    });
    if (deductErr) return json({ error: 'server' }, 500, cors);
    if (data === -1) return json({ error: 'no-credits' }, 402, cors);
    remaining = data as number;
  }
  const refund = () => (mode?.free ? Promise.resolve() : admin.rpc('refund_ai_credit', { p_user: user.id }));

  const intro = subject ? `Matière : ${subject}\n\n` : '';
  const text = mode
    ? `${intro}Sujet / chapitre : ${prompt || subject || 'le chapitre en cours'}`
    : pdf
      ? `${intro}${prompt || "Fais le devoir de l'énoncé joint (PDF), en entier."}`
      : `${intro}Énoncé / devoir :\n${prompt}`;

  const userContent: any[] = [];
  if (pdf && !mode) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdf },
    });
  }
  userContent.push({ type: 'text', text });

  const anthropic = new Anthropic({ apiKey: LLM_API_KEY });

  try {
    const msg: any = await anthropic.messages.create({
      model: mode?.model ?? MODEL,
      max_tokens: mode?.maxTokens ?? MAX_TOKENS,
      system: mode?.system ?? SYSTEM,
      output_config: { effort: mode?.effort ?? EFFORT },
      messages: [{ role: 'user', content: userContent }],
    } as any);

    if (msg.stop_reason === 'refusal') {
      await refund();
      const cat = msg.stop_details?.category ?? 'refusal';
      return json({ error: 'refused', detail: String(cat) }, 422, cors);
    }

    const answer = ((msg.content ?? []) as any[])
      .filter((b) => b?.type === 'text')
      .map((b) => b.text as string)
      .join('\n')
      .trim();

    if (!answer) {
      await refund();
      return json({ error: 'refused', detail: msg.stop_reason ?? 'empty-response' }, 422, cors);
    }

    await admin.from('ai_usage').insert({
      user_id: user.id,
      feature,
      model: mode?.model ?? MODEL,
      input_tokens: msg.usage?.input_tokens ?? null,
      output_tokens: msg.usage?.output_tokens ?? null,
      cached_input_tokens: msg.usage?.cache_read_input_tokens ?? 0,
    });

    return json({ answer, creditsLeft: remaining }, 200, cors);
  } catch (err) {
    await refund();

    if (err instanceof Anthropic.APIError) {
      const status = err.status ?? null;
      const detail = String(err.message ?? 'api-error').slice(0, 400);
      console.error('llm-error', status, detail);
      // 429 → on le relaie tel quel pour que le front dise "doucement".
      if (status === 429) return json({ error: 'rate-limit' }, 429, cors);
      return json({ error: 'ai-failed', status, detail }, 502, cors);
    }

    const detail = String((err as Error)?.message ?? err).slice(0, 400);
    console.error('ai-failed', detail);
    return json({ error: 'ai-failed', status: null, detail }, 502, cors);
  }
});
