import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, Trash2, UserPlus } from 'lucide-react';
import {
  createInvite,
  inviteLink,
  listInvites,
  revokeInvite,
  type Invite,
} from '@/lib/invites';

const fieldStyle: React.CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-fg))',
  borderColor: 'rgb(var(--color-fg) / 0.15)',
};

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );

const isExpired = (iso: string): boolean => new Date(iso).getTime() < Date.now();

const InviteRow: React.FC<{ invite: Invite; onRevoke: (code: string) => void }> = ({
  invite,
  onRevoke,
}) => {
  const [copied, setCopied] = useState(false);
  const expired = isExpired(invite.expires_at);
  const usedUp = invite.used_count >= invite.max_uses;
  const dead = expired || usedUp;

  const copy = () => {
    void navigator.clipboard?.writeText(inviteLink(invite.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0"
      style={{ borderColor: 'rgb(var(--color-fg) / 0.08)' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-primary">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate font-mono text-xs">…{invite.code.slice(-10)}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {invite.credits.toLocaleString('fr-FR')} crédits · {invite.used_count}/{invite.max_uses}{' '}
          utilisé{invite.max_uses > 1 ? 's' : ''} ·{' '}
          {expired ? 'expiré' : usedUp ? 'épuisé' : `expire le ${fmtDate(invite.expires_at)}`}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!dead && (
          <button
            type="button"
            onClick={copy}
            aria-label="Copier le lien"
            className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted transition-colors hover:text-primary"
            style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRevoke(invite.code)}
          aria-label="Révoquer le lien"
          className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
          style={{ borderColor: 'rgb(239 68 68 / 0.3)' }}
        >
          <Trash2 className="h-3.5 w-3.5" style={{ color: 'rgb(239 68 68)' }} />
        </button>
      </div>
    </div>
  );
};

const InviteManager: React.FC = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [credits, setCredits] = useState(100);
  const [unlimited, setUnlimited] = useState(false);
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listInvites()
      .then((rows) => {
        if (alive) setInvites(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const generate = async () => {
    setErr(null);
    setBusy(true);
    try {
      const row = await createInvite(unlimited ? 100000 : credits, maxUses);
      setInvites((prev) => [row, ...prev]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'La génération du lien a échoué.');
    } finally {
      setBusy(false);
    }
  };

  const onRevoke = (code: string) => {
    setInvites((prev) => prev.filter((i) => i.code !== code));
    void revokeInvite(code).catch(() => {
      // remet la ligne si l'appel échoue
      void listInvites().then(setInvites).catch(() => {});
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl ui-card p-5">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h2 className="text-lg font-semibold text-primary">Inviter quelqu'un</h2>
      </div>
      <p className="text-xs text-muted">
        Génère un lien à envoyer. La personne l'ouvre, choisit un mot de passe, et son compte est
        créé automatiquement avec les crédits choisis. Lien valable 30 jours.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-muted">
          Crédits
          <input
            type="number"
            min={0}
            max={100000}
            value={unlimited ? '' : credits}
            disabled={unlimited}
            onChange={(e) => setCredits(Math.max(0, Math.min(100000, Number(e.target.value) || 0)))}
            className="w-24 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-40"
            style={fieldStyle}
          />
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-muted">
          Utilisations
          <input
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            className="w-24 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            style={fieldStyle}
          />
        </label>

        <label className="flex items-center gap-1.5 pb-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
          />
          Crédits illimités
        </label>

        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="ml-auto rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
        >
          {busy ? 'Génération…' : 'Générer un lien'}
        </button>
      </div>

      {err && (
        <p className="text-xs" style={{ color: 'rgb(239 68 68)' }}>
          {err}
        </p>
      )}

      {loaded && invites.length > 0 && (
        <div className="mt-1">
          {invites.map((invite) => (
            <InviteRow key={invite.code} invite={invite} onRevoke={onRevoke} />
          ))}
        </div>
      )}
    </div>
  );
};

export default InviteManager;
