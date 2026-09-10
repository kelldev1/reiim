import { supabase, functionUrl } from '@/lib/supabase';

export interface Invite {
  code: string;
  credits: number;
  max_uses: number;
  used_count: number;
  note: string | null;
  expires_at: string;
  created_at: string;
}

/** Lien complet à partager pour un code d'invitation. */
export const inviteLink = (code: string): string =>
  `${window.location.origin}/invite/${code}`;

/** Génère un lien d'invitation (compte autorisé uniquement). */
export async function createInvite(
  credits: number,
  maxUses: number,
  note?: string,
): Promise<Invite> {
  const { data, error } = await supabase.rpc('create_invite', {
    p_credits: Math.max(0, Math.min(Math.round(credits), 100000)),
    p_max_uses: Math.max(1, Math.min(Math.round(maxUses), 1000)),
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as Invite;
}

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase.rpc('list_invites');
  if (error) throw new Error(error.message);
  return (data ?? []) as Invite[];
}

export async function revokeInvite(code: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invite', { p_code: code });
  if (error) throw new Error(error.message);
}

export type RedeemErrorKind =
  | 'invalid-code'
  | 'expired'
  | 'used-up'
  | 'email-taken'
  | 'invalid-input'
  | 'weak-password'
  | 'network'
  | 'server';

export class RedeemError extends Error {
  kind: RedeemErrorKind;
  constructor(kind: RedeemErrorKind, message: string) {
    super(message);
    this.name = 'RedeemError';
    this.kind = kind;
  }
}

const REDEEM_ERRORS: Record<string, [RedeemErrorKind, string]> = {
  'invalid-code': ['invalid-code', "Ce lien d'invitation n'est pas valide ou a été révoqué."],
  'invalid-email': ['invalid-input', 'E-mail invalide.'],
  'weak-password': ['weak-password', 'Mot de passe trop court (8 caractères minimum).'],
  'email-taken': ['email-taken', 'Un compte existe déjà avec cet e-mail.'],
};

/**
 * Crée un compte à partir d'un lien d'invitation (Edge Function `redeem-invite`).
 * Ne connecte PAS : l'appelant enchaîne avec `supabase.auth.signInWithPassword`.
 */
export async function redeemInvite(
  code: string,
  email: string,
  password: string,
  name: string,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(functionUrl('redeem-invite'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ code, email, password, name }),
    });
  } catch {
    throw new RedeemError('network', 'Impossible de joindre le service. Réessaie.');
  }

  if (res.ok) return;

  const kind = await res
    .json()
    .then((b) => (b as { error?: string }).error)
    .catch(() => undefined);
  const [k, m] =
    REDEEM_ERRORS[kind ?? ''] ?? (['server', 'La création du compte a échoué. Réessaie.'] as [
      RedeemErrorKind,
      string,
    ]);
  throw new RedeemError(k, m);
}
