// reiim — envoi quotidien des rappels de devoirs (J-7, J-3, J-1).
//
// Déclenchée par pg_cron chaque matin (voir migration 20260910170000).
// Ne fait rien tant que RESEND_API_KEY n'est pas posé.
//
// verify_jwt = false : appelée en interne. Protégée par l'en-tête X-Cron-Secret
// si CRON_SECRET est défini.
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from 'npm:@supabase/supabase-js@2';
import { emailEnabled, sendEmail, reminderEmail } from '../_shared/email.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Row {
  devoir_id: string;
  recipient_id: string;
  email: string;
  name: string | null;
  d: string;
  subject: string;
  methods: string[] | null;
  kind: string;
  is_own: boolean;
  owner_name: string | null;
  unsub_token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'method-not-allowed' }, 405);
  }

  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
  if (CRON_SECRET && req.headers.get('X-Cron-Secret') !== CRON_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'server-misconfigured' }, 500);

  if (!emailEnabled) return json({ ok: true, skipped: 'email-disabled', sent: 0 });

  const FN_BASE = `${SUPABASE_URL}/functions/v1`;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc('pending_reminders');
  if (error) {
    console.error('pending_reminders KO', error.message);
    return json({ error: 'query-failed' }, 500);
  }
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return json({ ok: true, sent: 0, recipients: 0 });

  // Un e-mail par destinataire, listant tous ses rappels du jour.
  const byRecipient = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byRecipient.get(r.recipient_id) ?? [];
    arr.push(r);
    byRecipient.set(r.recipient_id, arr);
  }

  let sent = 0;
  for (const [, items] of byRecipient) {
    const first = items[0];
    const unsubUrl = `${FN_BASE}/unsubscribe?token=${first.unsub_token}`;
    const { subject, html } = reminderEmail(
      first.name ?? '',
      items.map((i) => ({
        d: i.d,
        subject: i.subject,
        methods: i.methods ?? [],
        kind: i.kind,
        owner_name: i.owner_name ?? undefined,
        isOwn: i.is_own,
      })),
      unsubUrl,
    );

    const ok = await sendEmail({ to: first.email, subject, html, unsubUrl });
    if (!ok) continue;
    sent++;

    // Marque chaque (devoir, destinataire, seuil) comme envoyé.
    for (const i of items) {
      await admin
        .rpc('mark_reminder_sent', { p_devoir: i.devoir_id, p_user: i.recipient_id, p_kind: i.kind })
        .then(
          () => {},
          () => {},
        );
    }
  }

  return json({ ok: true, sent, recipients: byRecipient.size });
});
