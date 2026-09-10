// reiim — petit client Resend + gabarits d'e-mails, partagé par les fonctions.
// Ne fait rien si RESEND_API_KEY n'est pas défini (fonctionnalité désactivée).

const KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('RESEND_FROM') ?? 'reiim <onboarding@resend.dev>';
const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://reiim.vercel.app';

export const emailEnabled = KEY.length > 0;

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** URL de désinscription (ajoute l'en-tête List-Unsubscribe). */
  unsubUrl?: string;
}

/** Envoie un e-mail via Resend. Renvoie true si accepté. */
export async function sendEmail({ to, subject, html, unsubUrl }: SendArgs): Promise<boolean> {
  if (!emailEnabled) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject,
        html,
        ...(unsubUrl
          ? { headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
          : {}),
      }),
    });
    if (!res.ok) {
      console.error('resend-error', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (err) {
    console.error('resend-failed', String((err as Error)?.message ?? err).slice(0, 300));
    return false;
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

const shell = (inner: string) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#0b0a1e;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px" cellpadding="0" cellspacing="0">
      <tr><td style="padding:8px 4px 20px">
        <span style="color:#b8a8ff;font-weight:700;letter-spacing:.28em;font-size:15px">reiim</span>
      </td></tr>
      <tr><td style="background:#151233;border:1px solid #2a2550;border-radius:16px;padding:28px 26px;color:#e9e7ff">
        ${inner}
      </td></tr>
      <tr><td style="padding:16px 4px;color:#6f6a97;font-size:12px;line-height:1.6">
        reiim — planifie et fais tes devoirs en avance.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#5b2cff;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">${esc(label)}</a>`;

/** Mail de bienvenue (transactionnel, envoyé à la création du compte). */
export function welcomeEmail(name: string): { subject: string; html: string } {
  const hi = name ? `Salut ${esc(name)},` : 'Salut,';
  return {
    subject: 'Bienvenue sur reiim',
    html: shell(`
      <h1 style="margin:0 0 12px;font-size:19px;color:#fff">Ton compte est créé 🎉</h1>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65">${hi}</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.65">
        reiim t'aide à <strong>planifier tes devoirs à l'avance</strong> : tu poses un devoir sur un
        jour du calendrier, tu choisis une matière et des méthodes de travail (vidéos, exercices,
        flashcards, cartes mentales…), et tu t'y mets quand tu veux.
      </p>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65">
        Tu recevras aussi un rappel par mail 1 semaine, 3 jours et la veille de chaque devoir
        (désactivable dans ton profil).
      </p>
      <p style="margin:0">${btn(APP_URL, 'Ouvrir reiim')}</p>
    `),
  };
}

type ReminderItem = { d: string; subject: string; methods: string[]; kind: string; owner_name?: string; isOwn: boolean };

const KIND_LABEL: Record<string, string> = { '7d': 'dans 1 semaine', '3d': 'dans 3 jours', '1d': 'demain' };

const frDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** Mail de rappel : liste les devoirs à échéance proche pour un destinataire. */
export function reminderEmail(name: string, items: ReminderItem[], unsubUrl: string): { subject: string; html: string } {
  const hi = name ? `Salut ${esc(name)},` : 'Salut,';
  const soonest = items.some((i) => i.kind === '1d')
    ? 'demain'
    : items.some((i) => i.kind === '3d')
      ? 'dans 3 jours'
      : 'dans 1 semaine';

  const rows = items
    .map((i) => {
      const who = i.isOwn ? '' : ` · partagé par ${esc(i.owner_name ?? '')}`;
      const meth = i.methods.length ? esc(i.methods.join(' · ')) : 'aucune méthode';
      return `<tr><td style="padding:10px 0;border-top:1px solid #2a2550">
        <div style="font-size:14px;font-weight:600;color:#fff">${esc(i.subject)} <span style="color:#b8a8ff;font-weight:500">— ${esc(KIND_LABEL[i.kind] ?? i.kind)}</span></div>
        <div style="font-size:12px;color:#9d97c9;margin-top:2px">${esc(frDate(i.d))}${who}</div>
        <div style="font-size:12px;color:#6f6a97;margin-top:2px">${meth}</div>
      </td></tr>`;
    })
    .join('');

  return {
    subject:
      items.length === 1
        ? `Rappel : ${items[0].subject} ${KIND_LABEL[items[0].kind] ?? ''}`.trim()
        : `${items.length} devoirs à préparer (le plus proche : ${soonest})`,
    html: shell(`
      <h1 style="margin:0 0 12px;font-size:19px;color:#fff">Rappel de devoir${items.length > 1 ? 's' : ''}</h1>
      <p style="margin:0 0 8px;font-size:14px;line-height:1.65">${hi}</p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.65">Ce qui arrive :</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${rows}</table>
      <p style="margin:0 0 18px">${btn(APP_URL, 'Ouvrir le calendrier')}</p>
      <p style="margin:0;font-size:11px;color:#6f6a97;line-height:1.6">
        Tu reçois ces rappels parce que tu as un compte reiim.
        <a href="${unsubUrl}" style="color:#9d97c9">Ne plus recevoir de rappels</a>.
      </p>
    `),
  };
}
