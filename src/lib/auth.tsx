import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setUserContext } from '@/lib/monitoring';

export interface User {
  id: string;
  name: string;
  /** Identifiant court aléatoire — l'identité publique est `name#tag`. */
  tag: string;
  email: string;
  createdAt: string;
  avatar?: string;
  /** Image de couverture du profil (data-URL, redimensionnée côté client). */
  banner?: string;
  bio?: string;
  /** Remaining AI credits (managed server-side). */
  credits: number;
  plan: string;
  /** Autorisé à générer des liens d'invitation (géré côté serveur). */
  canInvite: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ needsConfirmation: boolean }>;
  logout: () => void;
  updateProfile: (
    patch: Partial<Pick<User, 'name' | 'email' | 'avatar' | 'banner' | 'bio'>>,
  ) => Promise<void>;
  /** Re-read the profile row (e.g. after an AI call spends a credit). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type ProfileRow = {
  id: string;
  email: string | null;
  name: string | null;
  tag: string | null;
  avatar: string | null;
  banner: string | null;
  bio: string | null;
  credits: number;
  plan: string;
  can_invite: boolean | null;
  created_at: string;
};

const toUser = (row: ProfileRow, session: Session): User => ({
  id: row.id,
  name: row.name ?? (row.email ?? session.user.email ?? 'moi').split('@')[0],
  tag: row.tag ?? '',
  email: row.email ?? session.user.email ?? '',
  createdAt: row.created_at ?? session.user.created_at,
  avatar: row.avatar ?? undefined,
  banner: row.banner ?? undefined,
  bio: row.bio ?? undefined,
  credits: row.credits ?? 0,
  plan: row.plan ?? 'free',
  canInvite: row.can_invite ?? false,
});

const mapAuthError = (msg: string): string => {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'E-mail ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Un compte existe déjà avec cet e-mail.';
  if (m.includes('password')) return 'Mot de passe trop court (6 caractères minimum).';
  if (m.includes('email')) return 'E-mail invalide.';
  if (m.includes('rate limit')) return 'Trop de tentatives — réessaie dans un instant.';
  return msg;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (session: Session | null) => {
    setUserContext(session?.user?.id ?? null);
    if (!session?.user) {
      setUser(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) {
      setUser(toUser(data as ProfileRow, session));
    } else {
      // Profile row not created yet (trigger lag / confirmation pending).
      setUser({
        id: session.user.id,
        name: (session.user.email ?? 'moi').split('@')[0],
        tag: '',
        email: session.user.email ?? '',
        createdAt: session.user.created_at,
        credits: 0,
        plan: 'free',
        canInvite: false,
      });
    }
  };

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setLoading(false);
    };
    // Filet : si Supabase ne répond pas, on n'reste pas bloqué sur l'écran de
    // démarrage — on bascule sur l'écran de connexion.
    const t = window.setTimeout(finish, 8000);
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        await loadProfile(data.session);
      })
      .catch((e) => console.error('[reiim] getSession a échoué', e))
      .finally(() => {
        window.clearTimeout(t);
        finish();
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session);
    });
    return () => {
      window.clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));
  };

  const signup = async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) throw new Error(mapAuthError(error.message));
    return { needsConfirmation: !data.session };
  };

  const logout = () => {
    void supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session);
  };

  const updateProfile = async (
    patch: Partial<Pick<User, 'name' | 'email' | 'avatar' | 'banner' | 'bio'>>,
  ) => {
    if (!user) return;
    setUser({ ...user, ...patch });

    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.avatar !== undefined) row.avatar = patch.avatar || null;
    if (patch.banner !== undefined) row.banner = patch.banner || null;
    if (patch.bio !== undefined) row.bio = patch.bio || null;
    await supabase.from('profiles').update(row).eq('id', user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, updateProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
