import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, Copy, LogOut, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { listDevoirs } from '@/lib/devoirs';
import { CREDIT_PACKS, billingEnabled, checkoutUrl } from '@/lib/billing';
import { Loader } from '@/components/ui/loader';
import InviteManager from '@/components/ui/invite-manager';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

/** Read an image file, downscale it, return a compact JPEG data-URL. */
const resizeImage = (file: File, max = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const fieldStyle: React.CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-fg))',
  borderColor: 'rgb(var(--color-fg) / 0.15)',
};

const Stat: React.FC<{ value: React.ReactNode; label: string }> = ({ value, label }) => (
  <div className="rounded-2xl ui-card p-4">
    <div className="text-lg font-semibold text-primary capitalize">{value}</div>
    <div className="mt-0.5 text-xs text-muted">{label}</div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div
    className="flex items-center justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0"
    style={{ borderColor: 'rgb(var(--color-fg) / 0.08)' }}
  >
    <span className="text-sm text-muted">{label}</span>
    <div className="text-right">{children}</div>
  </div>
);

const Profile: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { user, logout, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tagCopied, setTagCopied] = useState(false);

  const [activityCount, setActivityCount] = useState(0);
  useEffect(() => {
    void listDevoirs()
      .then((d) => setActivityCount(d.length))
      .catch(() => {});
  }, []);

  if (!user) return null;

  const memberSince = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(user.createdAt));

  const startEdit = () => {
    setName(user.name);
    setEmail(user.email);
    setBio(user.bio ?? '');
    setErr(null);
    setEditing(true);
  };

  const save = () => {
    if (!name.trim() || !email.trim()) {
      setErr('Le nom et l’e-mail sont requis.');
      return;
    }
    updateProfile({ name: name.trim(), email: email.trim(), bio: bio.trim() });
    setErr(null);
    setEditing(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Choisis un fichier image.');
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUrl = await resizeImage(file);
      updateProfile({ avatar: dataUrl });
      setErr(null);
    } catch {
      setErr('Impossible de charger cette image.');
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className={`w-full h-full overflow-y-auto ${className}`}>
      <div className="mx-auto w-full max-w-2xl px-4 pb-12">
        {/* header band */}
        <div
          className="relative mt-4 h-28 overflow-hidden rounded-2xl md:h-36"
          style={{
            background:
              'linear-gradient(120deg, rgb(var(--color-fg) / 0.12), rgb(var(--color-fg) / 0.02))',
          }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(circle at 18% 130%, rgb(var(--color-fg) / 0.14), transparent 45%)',
            }}
          />
        </div>

        {/* avatar + edit toggle */}
        <div className="-mt-12 flex items-end justify-between px-1 md:-mt-14">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Changer la photo de profil"
              className="group relative block h-24 w-24 overflow-hidden rounded-full md:h-28 md:w-28"
              style={{
                boxShadow:
                  '0 0 0 4px rgb(var(--color-bg)), 0 10px 30px -10px rgb(var(--color-fg) / 0.3)',
              }}
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center text-2xl font-semibold"
                  style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
                >
                  {initials(user.name)}
                </span>
              )}
              <span
                className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
                  avatarBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {avatarBusy ? (
                  <Loader variant="spinner" size={22} className="text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </span>
            </button>

            {user.avatar && !avatarBusy && (
              <button
                type="button"
                onClick={() => updateProfile({ avatar: undefined })}
                aria-label="Retirer la photo"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: 'rgb(var(--color-surface))',
                  borderColor: 'rgb(var(--color-fg) / 0.15)',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" style={{ color: 'rgb(239 68 68)' }} />
              </button>
            )}

            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          </div>

          {!editing ? (
            <button
              onClick={startEdit}
              className="mb-1 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:opacity-80"
              style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
            >
              <Pencil className="h-3.5 w-3.5" /> Modifier le profil
            </button>
          ) : (
            <div className="mb-1 flex items-center gap-2">
              <button
                onClick={save}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
              >
                <Check className="h-3.5 w-3.5" /> Enregistrer
              </button>
              <button
                onClick={() => {
                  setErr(null);
                  setEditing(false);
                }}
                aria-label="Annuler"
                className="flex h-8 w-8 items-center justify-center rounded-xl border text-muted transition-colors hover:text-primary"
                style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* identity */}
        <div className="mt-4">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom"
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                style={fieldStyle}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="E-mail"
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                style={fieldStyle}
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio (optionnel)"
                rows={2}
                maxLength={160}
                className="w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                style={fieldStyle}
              />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight text-primary md:text-2xl">
                {user.name}
              </h1>
              {user.tag && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${user.name}#${user.tag}`);
                    setTagCopied(true);
                    setTimeout(() => setTagCopied(false), 1500);
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-primary"
                  style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
                  title="Copier ton identifiant"
                >
                  <span className="font-semibold text-primary">
                    {user.name}
                    <span className="text-muted">#{user.tag}</span>
                  </span>
                  {tagCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              )}
              <p className="mt-1 text-sm text-muted">{user.email}</p>
              {user.bio && (
                <p className="mt-2 whitespace-pre-line text-sm text-primary/75">{user.bio}</p>
              )}
            </>
          )}
          {err && (
            <p className="mt-2 text-xs" style={{ color: 'rgb(239 68 68)' }}>
              {err}
            </p>
          )}
        </div>

        {/* stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat value={user.credits} label="Crédits IA" />
          <Stat value={activityCount} label="Activités planifiées" />
          <Stat value={memberSince} label="Membre depuis" />
        </div>

        {billingEnabled && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl ui-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-primary">Recharger des crédits</h2>
            </div>
            <p className="text-xs text-muted">
              1 crédit = 1 devoir résolu par l'assistant. Vidéos, cartes mentales et flashcards
              restent gratuites.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <a
                  key={pack.credits}
                  href={checkoutUrl(pack, user.id, user.email)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center rounded-xl border py-3 text-center transition-colors hover:opacity-90"
                  style={{ borderColor: 'rgb(var(--color-fg) / 0.15)' }}
                >
                  <span className="text-lg font-bold text-primary">{pack.credits}</span>
                  <span className="text-[11px] text-muted">crédits</span>
                </a>
              ))}
            </div>
            <p className="text-[11px] text-muted-soft">
              Paiement sécurisé via Lemon Squeezy. Les crédits arrivent en quelques secondes.
            </p>
          </div>
        )}

        {user.canInvite && <InviteManager />}

        {/* preferences */}
        <div className="mt-6 flex flex-col gap-4 rounded-2xl ui-card p-5">
          <h2 className="text-lg font-semibold text-primary">Préférences</h2>
          <Field label="Thème">
            <div
              className="grid grid-cols-2 gap-1 rounded-xl p-1"
              style={{ backgroundColor: 'rgb(var(--color-fg) / 0.06)' }}
            >
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="relative rounded-lg px-4 py-1.5 text-sm font-medium"
                >
                  {theme === t && (
                    <motion.span
                      layoutId="theme-pill"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        boxShadow: '0 1px 3px rgb(var(--color-fg) / 0.15)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className={`relative z-[1] ${theme === t ? 'text-primary' : 'text-muted'}`}>
                    {t === 'light' ? 'Clair' : 'Sombre'}
                  </span>
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* logout */}
        <button
          onClick={logout}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-medium transition-colors"
          style={{ borderColor: 'rgb(239 68 68 / 0.3)', color: 'rgb(239 68 68)' }}
        >
          <LogOut className="h-4 w-4" /> Se déconnecter
        </button>

        <nav className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-soft">
          <a href="/mentions-legales.html" target="_blank" rel="noreferrer" className="hover:text-primary">
            Mentions légales
          </a>
          <a href="/confidentialite.html" target="_blank" rel="noreferrer" className="hover:text-primary">
            Confidentialité
          </a>
          <a href="/cgv.html" target="_blank" rel="noreferrer" className="hover:text-primary">
            CGU / CGV
          </a>
        </nav>
      </div>
    </div>
  );
};

export default Profile;
