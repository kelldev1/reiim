// reiim — échange d'un lien d'invitation contre un compte.
//
// L'inscription publique Supabase est fermée. Cette fonction (rôle service) est
// le SEUL moyen de créer un compte : il faut un lien d'invitation valide, généré
// depuis un compte autorisé (RPC create_invite).
//
// verify_jwt = false : la personne invitée n'a pas encore de session.
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';

// Origines autorisées : secret ALLOWED_ORIGINS (liste séparée par des virgules).
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

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405, cors);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server-misconfigured' }, 500, cors);

  const body = (await req.json().catch(() => ({}))) as {
    code?: unknown;
    email?: unknown;
    password?: unknown;
    name?: unknown;
  };
  const code = String(body.code ?? '').trim().slice(0, 80);
  const email = String(body.email ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim().slice(0, 40);

  if (!code || !EMAIL_RE.test(email)) return json({ error: 'invalid-email' }, 400, cors);
  if (password.length < 8 || password.length > 200) {
    return json({ error: 'weak-password' }, 400, cors);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1. consomme une place sur le lien (atomique : expiré / épuisé → -1)
  const { data: credits, error: claimErr } = await admin.rpc('claim_invite', { p_code: code });
  if (claimErr) {
    console.error('redeem-invite: claim_invite KO', claimErr.message);
    return json({ error: 'server' }, 500, cors);
  }
  if (typeof credits !== 'number' || credits < 0) {
    return json({ error: 'invalid-code' }, 410, cors);
  }

  // 2. crée le compte (déjà confirmé — pas besoin de SMTP)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : {},
  });

  if (cErr || !created?.user) {
    // le compte n'a pas été créé → on rend la place consommée
    await admin.rpc('release_invite', { p_code: code }).then(
      () => {},
      () => {},
    );
    const msg = (cErr?.message ?? '').toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exist')) {
      return json({ error: 'email-taken' }, 409, cors);
    }
    if (msg.includes('password')) return json({ error: 'weak-password' }, 400, cors);
    console.error('redeem-invite: createUser KO', cErr?.message);
    return json({ error: 'server' }, 500, cors);
  }

  const uid = created.user.id;

  // 3. pose le solde de crédits du lien (le trigger handle_new_user a créé la
  //    ligne profile ; petite boucle au cas où il n'a pas encore committé).
  //    Rôle service → auth.uid() NULL → le trigger profiles_guard_billing passe.
  let credited = false;
  for (let i = 0; i < 6 && !credited; i++) {
    const { data: rows, error: uErr } = await admin
      .from('profiles')
      .update({ credits })
      .eq('id', uid)
      .select('id');
    if (!uErr && rows && rows.length > 0) {
      credited = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!credited) {
    await admin
      .from('profiles')
      .upsert({ id: uid, email, name: name || email.split('@')[0], credits })
      .then(
        () => {},
        () => {},
      );
  }

  return json({ ok: true, email }, 200, cors);
});
