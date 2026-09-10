import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Search, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/avatar';
import { Loader } from '@/components/ui/loader';
import {
  findUser,
  getPublicProfile,
  handleOf,
  listFriends,
  listRequests,
  removeFriend,
  respondRequest,
  sendRequest,
  type Friend,
  type FriendRequest,
  type FriendUser,
  type PublicProfile,
} from '@/lib/friends';

const line = 'rgb(var(--color-fg) / 0.1)';

const Section: React.FC<{ title: string; count?: number; children: React.ReactNode }> = ({
  title,
  count,
  children,
}) => (
  <section className="mt-6">
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
      {title}
      {count ? <span className="text-muted-soft"> · {count}</span> : null}
    </h2>
    {children}
  </section>
);

const Row: React.FC<{ user: FriendUser; right: React.ReactNode; onView?: () => void }> = ({
  user,
  right,
  onView,
}) => (
  <div
    className="flex items-center gap-3 rounded-xl border px-3 py-2"
    style={{ borderColor: line }}
  >
    <button
      type="button"
      onClick={onView}
      disabled={!onView}
      className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-80 disabled:cursor-default disabled:hover:opacity-100"
    >
      <Avatar name={user.name} src={user.avatar} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-primary">{user.name}</p>
        <p className="truncate text-xs text-muted">#{user.tag}</p>
      </div>
    </button>
    <div className="flex shrink-0 items-center gap-1.5">{right}</div>
  </div>
);

const fmtSince = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(iso));

/** Aperçu du profil d'un ami (champs publics uniquement). */
const PeekProfile: React.FC<{
  userId: string;
  onClose: () => void;
  onRemove: () => void;
}> = ({ userId, onClose, onRemove }) => {
  const [profile, setProfile] = useState<PublicProfile | null | 'loading'>('loading');

  useEffect(() => {
    let alive = true;
    void getPublicProfile(userId)
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-2xl"
      style={{ backgroundColor: 'rgb(var(--color-bg) / 0.9)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-xl"
        style={{
          backgroundColor: 'rgb(var(--color-surface))',
          borderColor: 'rgb(var(--color-fg) / 0.12)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-2 top-1.5 z-[1] text-2xl leading-none text-white/80 transition-colors hover:text-white"
        >
          ×
        </button>

        {profile === 'loading' ? (
          <div className="flex h-40 items-center justify-center">
            <Loader variant="dots" size={22} />
          </div>
        ) : !profile ? (
          <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted">
            Ce profil n'est pas consultable.
          </div>
        ) : (
          <>
            <div className="relative h-24 md:h-28">
              {profile.banner ? (
                <img src={profile.banner} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="block h-full w-full"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 18% 130%, rgb(var(--color-fg) / 0.14), transparent 45%), linear-gradient(120deg, rgb(var(--color-fg) / 0.12), rgb(var(--color-fg) / 0.02))',
                  }}
                />
              )}
            </div>

            <div className="px-5 pb-5">
              <span
                className="-mt-8 inline-block rounded-full"
                style={{ boxShadow: '0 0 0 4px rgb(var(--color-surface))' }}
              >
                <Avatar name={profile.name} src={profile.avatar} size={64} />
              </span>

              <h3 className="mt-2 text-lg font-bold text-primary">
                {profile.name}
                <span className="text-muted">#{profile.tag}</span>
              </h3>
              {profile.bio && (
                <p className="mt-1 whitespace-pre-line text-sm text-primary/75">{profile.bio}</p>
              )}
              <p className="mt-2 text-xs text-muted">Membre depuis {fmtSince(profile.createdAt)}</p>

              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors"
                style={{ borderColor: 'rgb(239 68 68 / 0.3)', color: 'rgb(239 68 68)' }}
              >
                <X className="h-3.5 w-3.5" /> Retirer de mes amis
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

const Btn: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'solid' | 'ghost' | 'danger';
  disabled?: boolean;
}> = ({ onClick, children, variant = 'ghost', disabled }) => {
  const base =
    'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40';
  const style: React.CSSProperties =
    variant === 'solid'
      ? { backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }
      : variant === 'danger'
        ? { color: 'rgb(239 68 68)' }
        : { color: 'rgb(var(--color-fg) / 0.6)' };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={base} style={style}>
      {children}
    </button>
  );
};

const Friends: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { user } = useAuth();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<FriendUser | null | 'none'>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [f, r] = await Promise.all([listFriends(), listRequests()]);
    setFriends(f);
    setRequests(r);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const search = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setNote(null);
    setFound(null);
    try {
      const u = await findUser(query);
      setFound(u ?? 'none');
    } finally {
      setSearching(false);
    }
  };

  const add = async (target: FriendUser) => {
    setNote(null);
    try {
      const res = await sendRequest(target.id);
      const msg: Record<string, string> = {
        sent: `Demande envoyée à ${handleOf(target.name, target.tag)}.`,
        accepted: `Vous êtes maintenant amis avec ${target.name} !`,
        'already-friends': 'Vous êtes déjà amis.',
        self: "C'est toi, ça.",
        auth: 'Reconnecte-toi.',
      };
      setNote(msg[res] ?? 'Fait.');
      setFound(null);
      setQuery('');
      await reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Échec de la demande.');
    }
  };

  const respond = async (reqId: string, accept: boolean) => {
    await respondRequest(reqId, accept);
    await reload();
  };
  const unfriend = async (id: string) => {
    await removeFriend(id);
    await reload();
  };

  const incoming = requests.filter((r) => r.direction === 'in');
  const outgoing = requests.filter((r) => r.direction === 'out');
  const myHandle = user ? handleOf(user.name, user.tag) : '';

  return (
    <div className={`w-full h-full overflow-y-auto ${className}`}>
      <div className="mx-auto w-full max-w-2xl px-4 pb-12">
        <h1 className="mt-6 text-xl font-bold tracking-tight text-primary md:text-2xl">Amis</h1>

        {/* ton identité */}
        <div
          className="mt-4 flex items-center gap-3 rounded-2xl border p-4"
          style={{ borderColor: line, backgroundColor: 'rgb(var(--color-fg) / 0.02)' }}
        >
          <Avatar name={user?.name} src={user?.avatar} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-primary">
              {user?.name}
              <span className="text-muted">#{user?.tag}</span>
            </p>
            <p className="text-xs text-muted">Partage cet identifiant pour qu'on t'ajoute.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(myHandle);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-primary"
            style={{ borderColor: line }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>

        {/* ajouter un ami */}
        <Section title="Ajouter un ami">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search();
              }}
              placeholder="Pseudo#TAG"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                color: 'rgb(var(--color-fg))',
                borderColor: 'rgb(var(--color-fg) / 0.15)',
              }}
            />
            <button
              type="button"
              onClick={search}
              disabled={searching || !query.trim()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
            >
              {searching ? <Loader variant="dots" size={16} /> : <Search className="h-4 w-4" />}
            </button>
          </div>

          {found && found !== 'none' && (
            <div className="mt-2">
              <Row
                user={found}
                right={
                  <Btn onClick={() => void add(found)} variant="solid">
                    <UserPlus className="h-3.5 w-3.5" /> Ajouter
                  </Btn>
                }
              />
            </div>
          )}
          {found === 'none' && (
            <p className="mt-2 text-xs text-muted">
              Personne trouvé pour « {query} ». Vérifie le tag (4 caractères après le #).
            </p>
          )}
          {note && <p className="mt-2 text-xs text-primary">{note}</p>}
        </Section>

        {loading ? (
          <div className="mt-8 flex justify-center">
            <Loader variant="dots" size={22} />
          </div>
        ) : (
          <>
            {incoming.length > 0 && (
              <Section title="Demandes reçues" count={incoming.length}>
                <div className="flex flex-col gap-2">
                  {incoming.map((r) => (
                    <Row
                      key={r.reqId}
                      user={r}
                      right={
                        <>
                          <Btn onClick={() => void respond(r.reqId, true)} variant="solid">
                            <Check className="h-3.5 w-3.5" /> Accepter
                          </Btn>
                          <Btn onClick={() => void respond(r.reqId, false)}>
                            <X className="h-3.5 w-3.5" />
                          </Btn>
                        </>
                      }
                    />
                  ))}
                </div>
              </Section>
            )}

            {outgoing.length > 0 && (
              <Section title="Demandes envoyées" count={outgoing.length}>
                <div className="flex flex-col gap-2">
                  {outgoing.map((r) => (
                    <Row
                      key={r.reqId}
                      user={r}
                      right={
                        <>
                          <span className="text-xs text-muted">en attente</span>
                          <Btn onClick={() => void respond(r.reqId, false)}>
                            <X className="h-3.5 w-3.5" />
                          </Btn>
                        </>
                      }
                    />
                  ))}
                </div>
              </Section>
            )}

            <Section title="Mes amis" count={friends.length}>
              {friends.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted"
                  style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}>
                  Pas encore d'amis. Ajoute quelqu'un avec son Pseudo#TAG.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {friends.map((f) => (
                    <Row
                      key={f.id}
                      user={f}
                      onView={() => setPeek(f.id)}
                      right={
                        <Btn onClick={() => void unfriend(f.id)} variant="danger">
                          <X className="h-3.5 w-3.5" /> Retirer
                        </Btn>
                      }
                    />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>

      {peek && (
        <PeekProfile
          key={peek}
          userId={peek}
          onClose={() => setPeek(null)}
          onRemove={() => void unfriend(peek)}
        />
      )}
    </div>
  );
};

export default Friends;
