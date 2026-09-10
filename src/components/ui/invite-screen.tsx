import { useState, type CSSProperties, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { redeemInvite } from '@/lib/invites';

const fieldStyle: CSSProperties = {
  backgroundColor: 'rgb(var(--color-surface))',
  color: 'rgb(var(--color-fg))',
  borderColor: 'rgb(var(--color-fg) / 0.15)',
};

const inputCls =
  'w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/30';

/**
 * Écran ouvert via un lien `/invite/<code>` : la personne choisit un e-mail +
 * mot de passe, l'Edge Function crée le compte (déjà confirmé), puis on connecte.
 */
export default function InviteScreen({ code }: { code: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Renseigne ton e-mail et un mot de passe.');
      return;
    }
    if (password.length < 8) {
      setError('Mot de passe trop court (8 caractères minimum).');
      return;
    }

    setBusy(true);
    try {
      await redeemInvite(code, email.trim(), password, name.trim());
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) {
        throw new Error(
          'Compte créé, mais la connexion automatique a échoué. Va sur la page de connexion.',
        );
      }
      // onAuthStateChange fait basculer <Root> sur l'app ; on nettoie l'URL.
      window.history.replaceState({}, '', '/');
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
          <span className="text-lg font-semibold tracking-[0.3em] text-primary select-none">
            reiim
          </span>
          <p className="text-sm text-muted">Tu as été invité·e — crée ton compte</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Prénom ou pseudo (optionnel)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            style={fieldStyle}
            autoComplete="nickname"
            maxLength={40}
          />

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
            placeholder="Mot de passe (8 caractères min.)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            style={fieldStyle}
            autoComplete="new-password"
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
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-soft">
          Déjà un compte ?{' '}
          <a href="/" className="underline hover:text-primary">
            Se connecter
          </a>
        </p>

        <nav className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-muted-soft">
          <a href="/mentions-legales.html" className="hover:text-primary">
            Mentions légales
          </a>
          <a href="/confidentialite.html" className="hover:text-primary">
            Confidentialité
          </a>
          <a href="/cgv.html" className="hover:text-primary">
            CGU / CGV
          </a>
        </nav>
      </motion.div>
    </motion.div>
  );
}
