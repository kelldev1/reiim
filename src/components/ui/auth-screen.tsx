import { useState, type CSSProperties, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';

type Mode = 'login' | 'signup';

const fieldStyle: CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-fg))',
  borderColor: 'rgb(var(--color-fg) / 0.15)',
};

const inputCls =
  'w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/30';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Renseigne ton e-mail et ton mot de passe.');
      return;
    }
    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Indique ton nom.');
        return;
      }
      if (password.length < 6) {
        setError('Le mot de passe doit faire au moins 6 caractères.');
        return;
      }
      if (password !== confirm) {
        setError('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        // success → <Root> swaps this screen for the loader/app
      } else {
        const { needsConfirmation } = await signup(name, email, password);
        if (needsConfirmation) {
          setNotice('Compte créé ! Confirme ton e-mail, puis connecte-toi.');
          setMode('login');
          setPassword('');
          setConfirm('');
          setBusy(false);
        }
        // otherwise → session is live, <Root> takes over
      }
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
          <p className="text-sm text-muted">
            {mode === 'login' ? 'Content de te revoir' : 'Crée ton compte'}
          </p>
        </div>

        <div
          className="mb-5 grid grid-cols-2 gap-1 rounded-xl p-1"
          style={{ backgroundColor: 'rgb(var(--color-fg) / 0.06)' }}
        >
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className="relative rounded-lg py-1.5 text-sm font-medium"
            >
              {mode === m && (
                <motion.span
                  layoutId="auth-tab"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    backgroundColor: 'rgb(var(--color-surface))',
                    boxShadow: '0 1px 3px rgb(var(--color-fg) / 0.15)',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className={`relative z-[1] ${mode === m ? 'text-primary' : 'text-muted'}`}>
                {m === 'login' ? 'Se connecter' : 'Créer un compte'}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {mode === 'signup' && (
              <motion.div
                key="name"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="text"
                  placeholder="Nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  style={fieldStyle}
                  autoComplete="name"
                />
              </motion.div>
            )}
          </AnimatePresence>

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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          <AnimatePresence initial={false}>
            {mode === 'signup' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <input
                  type="password"
                  placeholder="Confirme le mot de passe"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputCls}
                  style={fieldStyle}
                  autoComplete="new-password"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {notice && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-muted"
            >
              {notice}
            </motion.p>
          )}
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
            {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
