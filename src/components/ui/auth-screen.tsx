import { useState, type CSSProperties, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';

const fieldStyle: CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-fg))',
  borderColor: 'rgb(var(--color-fg) / 0.15)',
};

const inputCls =
  'w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/30';

// reiim est en accès privé : pas d'inscription publique. Les comptes de test sont
// créés à la main dans Supabase (Authentication → Users → Add user). Voir SETUP.md.
export default function AuthScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Renseigne ton e-mail et ton mot de passe.');
      return;
    }

    setBusy(true);
    try {
      await login(email, password);
      // success → <Root> swaps this screen for the loader/app
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="flex flex-1 w-full items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ y: 16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="w-full max-w-sm rounded-2xl border p-7 shadow-xl backdrop-blur-xl"
        style={{
          backgroundColor: 'rgb(var(--color-surface) / 0.85)',
          borderColor: 'rgb(var(--color-fg) / 0.12)',
        }}
      >
        <div className="mb-6 flex flex-col items-center gap-1">
          <span className="text-lg font-semibold tracking-[0.3em] text-primary select-none">reiim</span>
          <p className="text-sm text-muted">Content de te revoir</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            style={fieldStyle}
            autoComplete="email"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            style={fieldStyle}
            autoComplete="current-password"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs"
              style={{ color: 'rgb(239 68 68)' }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'rgb(var(--color-fg))', color: 'rgb(var(--color-bg))' }}
          >
            {busy ? 'Un instant…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-soft">
          reiim est en accès privé. Demande un accès à la personne qui t'a partagé le lien.
        </p>
      </motion.div>
    </motion.div>
  );
}
