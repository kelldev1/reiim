// reiim — webhook Lemon Squeezy : crédite le compte après un paiement.
//
// Config (secrets de fonction) :
//   supabase secrets set LEMON_WEBHOOK_SECRET=...       (Lemon Squeezy → Settings → Webhooks)
//   supabase secrets set LEMON_STORE_ID=123456          (facultatif mais recommandé)
//   supabase secrets set LEMON_VARIANT_CREDITS='{"111111":20,"222222":60,"333333":150}'
//        -> map "id de variante Lemon Squeezy" -> nombre de crédits du pack.
//
// Pointer le webhook Lemon Squeezy vers :
//   https://<ref>.supabase.co/functions/v1/lemon-webhook   (évènement : order_created)
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';

const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Comparaison à temps constant (évite les attaques par mesure de temps).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return safeEqual(toHex(mac), signature.trim().toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method-not-allowed', { status: 405 });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const SECRET = Deno.env.get('LEMON_WEBHOOK_SECRET');
  const STORE_ID = Deno.env.get('LEMON_STORE_ID') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY || !SECRET) {
    return new Response('server-misconfigured', { status: 500 });
  }

  let variantMap: Record<string, number> = {};
  try {
    variantMap = JSON.parse(Deno.env.get('LEMON_VARIANT_CREDITS') ?? '{}');
  } catch {
    return new Response('server-misconfigured (LEMON_VARIANT_CREDITS)', { status: 500 });
  }

  const raw = await req.text();
  const sig = req.headers.get('X-Signature') ?? '';
  if (!sig || !(await verifySignature(SECRET, raw, sig))) {
    return new Response('bad-signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('bad-json', { status: 400 });
  }

  const event = payload?.meta?.event_name ?? req.headers.get('X-Event-Name') ?? '';
  // On ne traite que les commandes payées.
  if (event !== 'order_created') {
    return new Response(JSON.stringify({ ignored: event }), { status: 200 });
  }

  const attrs = payload?.data?.attributes ?? {};
  if (attrs.status && attrs.status !== 'paid') {
    return new Response(JSON.stringify({ ignored: 'unpaid' }), { status: 200 });
  }
  if (STORE_ID && String(attrs.store_id ?? '') !== STORE_ID) {
    return new Response('wrong-store', { status: 403 });
  }

  const orderId = String(payload?.data?.id ?? '');
  const userId = String(payload?.meta?.custom_data?.user_id ?? '');
  const variantId = String(attrs?.first_order_item?.variant_id ?? '');
  const credits = variantMap[variantId];

  if (!orderId || !userId) return new Response('missing-order-or-user', { status: 400 });
  if (!credits) {
    console.error('lemon-webhook: variante inconnue', variantId);
    return new Response('unknown-variant', { status: 422 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data, error } = await admin.rpc('add_ai_credits', {
    p_user: userId,
    p_credits: credits,
    p_source: 'lemonsqueezy',
    p_external_id: orderId,
    p_amount_cents: typeof attrs.total === 'number' ? attrs.total : null,
    p_currency: attrs.currency ?? null,
  });

  if (error) {
    console.error('lemon-webhook: add_ai_credits KO', error.message);
    return new Response('credit-failed', { status: 500 });
  }

  // data === -1 : commande déjà traitée (rejeu du webhook) — on renvoie 200 quand même.
  return new Response(JSON.stringify({ ok: true, balance: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
