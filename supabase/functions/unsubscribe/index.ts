// reiim — désinscription des rappels de devoirs (lien dans les e-mails).
//
// GET  /unsubscribe?token=<uuid>        → coupe les rappels + page de confirmation
// POST /unsubscribe?token=<uuid>        → idem (List-Unsubscribe-Post one-click)
// GET  /unsubscribe?token=<uuid>&on=1   → ré-active les rappels
//
// verify_jwt = false : pas de session (on vient d'un e-mail).

import { createClient } from 'npm:@supabase/supabase-js@2';

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — reiim</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#0b0a1e;color:#e9e7ff;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .card{max-width:420px;margin:24px;padding:32px 28px;background:#151233;border:1px solid #2a2550;border-radius:16px;text-align:center}
  h1{font-size:18px;margin:0 0 10px;color:#fff}
  p{font-size:14px;line-height:1.6;color:#b9b4dd;margin:0 0 16px}
  a.btn{display:inline-block;background:#5b2cff;color:#fff;text-decoration:none;font-weight:600;
    font-size:14px;padding:10px 18px;border-radius:10px}
  a.link{color:#9d97c9;font-size:13px}
  .brand{color:#b8a8ff;font-weight:700;letter-spacing:.28em;font-size:13px;display:block;margin-bottom:16px}
</style></head><body><div class="card"><span class="brand">reiim</span>${body}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://reiim.vercel.app';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const resubscribe = url.searchParams.get('on') === '1';

  if (!UUID_RE.test(token)) {
    return page('Lien invalide', `<h1>Lien invalide</h1><p>Ce lien de désinscription n'est pas reconnu.</p>`, 400);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return page('Erreur', `<h1>Service indisponible</h1><p>Réessaie plus tard.</p>`, 500);
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc(
    resubscribe ? 'resubscribe_reminders' : 'unsubscribe_reminders',
    { p_token: token },
  );
  if (error) {
    console.error('unsub rpc KO', error.message);
    return page('Erreur', `<h1>Une erreur est survenue</h1><p>Réessaie dans un instant.</p>`, 500);
  }
  if (data !== true) {
    return page('Lien invalide', `<h1>Lien invalide</h1><p>Ce lien de désinscription n'est plus valide.</p>`, 404);
  }

  if (resubscribe) {
    return page(
      'Rappels réactivés',
      `<h1>Rappels réactivés ✅</h1><p>Tu recevras à nouveau les rappels de devoirs.</p>
       <a class="btn" href="${APP_URL}">Ouvrir reiim</a>`,
    );
  }

  const reactivateUrl = `${url.origin}${url.pathname}?token=${token}&on=1`;
  return page(
    'Désinscription',
    `<h1>C'est fait 👋</h1>
     <p>Tu ne recevras plus de rappels de devoirs par e-mail. Tu peux aussi gérer ça
        dans ton profil sur l'application.</p>
     <p><a class="link" href="${reactivateUrl}">Me réabonner</a></p>
     <a class="btn" href="${APP_URL}">Ouvrir reiim</a>`,
  );
});
