// reiim — AI proxy Edge Function.
//
// The model API key lives ONLY here (set with `supabase secrets set ANTHROPIC_API_KEY=...`).
// The browser never sees it. Before every model call this function:
//   1. verifies the caller's Supabase JWT
//   2. soft rate-limits (1 request / 5 s per user)
//   3. atomically spends one AI credit (refunds it if the model call fails)
//   4. logs token usage
//
// Deploy:  supabase functions deploy ai
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

// Cost / quality knob. Sonnet 5 with medium effort ≈ 1.5–2.5 centimes / requête.
const MODEL = 'claude-sonnet-5';
const EFFORT: 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'medium';
const MAX_TOKENS = 6000;
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
  'Access-Control-Allow-Headers': 'authorization, content-type',
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
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !ANTHROPIC_API_KEY) {
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

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const message: any = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: subject
            ? `Matière : ${subject}\n\nÉnoncé / devoir :\n${prompt}`
            : prompt,
        },
      ],
    });

    if (message.stop_reason === 'refusal') {
      await admin.rpc('refund_ai_credit', { p_user: user.id });
      return json({ error: 'refused' }, 422);
    }

    const answer = (message.content as any[])
      .filter((b) => b.type === 'text')
      .map((b) => b.text as string)
      .join('\n')
      .trim();

    await admin.from('ai_usage').insert({
      user_id: user.id,
      feature,
      model: MODEL,
      input_tokens: message.usage?.input_tokens ?? null,
      output_tokens: message.usage?.output_tokens ?? null,
      cached_input_tokens: message.usage?.cache_read_input_tokens ?? 0,
    });

    return json({ answer, creditsLeft: remaining });
  } catch (err) {
    await admin.rpc('refund_ai_credit', { p_user: user.id });
    const status = (err as { status?: number })?.status ?? null;
    return json({ error: 'ai-failed', status }, 502);
  }
});
