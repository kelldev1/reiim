// Achat de crédits IA via Lemon Squeezy.
// Les URLs de checkout viennent de Lemon Squeezy (une par pack). On y accroche
// l'id de l'utilisateur : le webhook `lemon-webhook` s'en sert pour créditer.

export interface CreditPack {
  credits: number;
  checkoutUrl: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { credits: 20, checkoutUrl: import.meta.env.VITE_LEMON_CHECKOUT_20 as string },
  { credits: 60, checkoutUrl: import.meta.env.VITE_LEMON_CHECKOUT_60 as string },
  { credits: 150, checkoutUrl: import.meta.env.VITE_LEMON_CHECKOUT_150 as string },
].filter((p) => typeof p.checkoutUrl === 'string' && p.checkoutUrl.length > 0);

/** true si au moins un pack est configuré (⇒ on affiche le bloc d'achat). */
export const billingEnabled = CREDIT_PACKS.length > 0;

/** URL de checkout Lemon Squeezy pré-remplie pour cet utilisateur. */
export function checkoutUrl(pack: CreditPack, userId: string, email: string): string {
  const u = new URL(pack.checkoutUrl);
  u.searchParams.set('checkout[custom][user_id]', userId);
  if (email) u.searchParams.set('checkout[email]', email);
  return u.toString();
}
