import { supabase } from '@/lib/supabase';

export interface Devoir {
  id: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  subject: string;
  methods: string[];
  /** true si le devoir appartient à un ami qui m'a invité. */
  shared?: boolean;
  /** `Pseudo#TAG` du propriétaire (uniquement pour un devoir partagé). */
  ownerHandle?: string;
}

type Row = { id: string; d: string; subject: string; methods: string[] | null };
const toDevoir = (r: Row): Devoir => ({
  id: r.id,
  date: r.d,
  subject: r.subject,
  methods: r.methods ?? [],
});

/** Mes devoirs + ceux partagés avec moi (le volume reste petit). */
export async function listDevoirs(): Promise<Devoir[]> {
  const [own, shared] = await Promise.all([
    supabase.from('devoirs').select('id, d, subject, methods').order('d'),
    supabase.rpc('list_shared_devoirs'),
  ]);
  if (own.error) throw new Error(own.error.message);
  const owned = (own.data ?? []).map((r) => toDevoir(r as Row));
  const ownedDates = new Set(owned.map((d) => d.date));
  const sharedDevoirs: Devoir[] = (
    (shared.data ?? []) as {
      id: string;
      d: string;
      subject: string;
      methods: string[] | null;
      owner_name: string;
      owner_tag: string;
    }[]
  )
    .map((r) => ({
      id: r.id,
      date: r.d,
      subject: r.subject,
      methods: r.methods ?? [],
      shared: true,
      ownerHandle: `${r.owner_name}#${r.owner_tag}`,
    }))
    // pas de collision : si j'ai déjà un devoir ce jour-là, le mien passe d'abord
    .filter((d) => !ownedDates.has(d.date));
  return [...owned, ...sharedDevoirs];
}

/** Crée ou met à jour le devoir du jour (`date` = `YYYY-MM-DD`). */
export async function upsertDevoir(
  date: string,
  subject: string,
  methods: string[],
): Promise<Devoir> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('auth');
  const { data, error } = await supabase
    .from('devoirs')
    .upsert(
      { owner_id: user.id, d: date, subject, methods },
      { onConflict: 'owner_id,d' },
    )
    .select('id, d, subject, methods')
    .single();
  if (error) throw new Error(error.message);
  return toDevoir(data as Row);
}

export async function deleteDevoir(id: string): Promise<void> {
  const { error } = await supabase.from('devoirs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Déplace un devoir sur un autre jour. Lève si le jour cible est déjà pris. */
export async function moveDevoir(id: string, date: string): Promise<void> {
  const { error } = await supabase.from('devoirs').update({ d: date }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ---------- contenu des espaces de travail ---------- */

/** Lève en cas d'échec réseau/RLS, pour que l'appelant ne confonde pas
 *  « le devoir est vide » avec « le chargement a échoué ». */
export async function loadWork(devoirId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('devoir_work')
    .select('slot, data')
    .eq('devoir_id', devoirId);
  if (error) throw new Error(error.message);
  const out: Record<string, unknown> = {};
  for (const r of data ?? []) out[(r as { slot: string }).slot] = (r as { data: unknown }).data;
  return out;
}

/** `true` si la sauvegarde a réussi, `false` sinon (l'appelant affiche « non enregistré »). */
export async function saveWork(
  devoirId: string,
  slot: string,
  data: unknown,
): Promise<boolean> {
  const { error } = await supabase
    .from('devoir_work')
    .upsert(
      { devoir_id: devoirId, slot, data, updated_at: new Date().toISOString() },
      { onConflict: 'devoir_id,slot' },
    );
  if (error) {
    console.error('[reiim] saveWork a échoué', error.message);
    return false;
  }
  return true;
}

/* ---------- partage ---------- */

export interface DevoirMember {
  id: string;
  name: string;
  tag: string;
  avatar?: string;
  role: 'owner' | 'member';
}

export type InviteResult = 'ok' | 'not-owner' | 'not-friend' | 'already-member';

export async function inviteToDevoir(
  devoirId: string,
  friendId: string,
): Promise<InviteResult> {
  const { data, error } = await supabase.rpc('invite_to_devoir', {
    p_devoir: devoirId,
    p_friend: friendId,
  });
  if (error) throw new Error(error.message);
  return data as InviteResult;
}

export async function removeDevoirMember(
  devoirId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('remove_devoir_member', {
    p_devoir: devoirId,
    p_user: userId,
  });
  if (error) throw new Error(error.message);
}

export async function listDevoirMembers(devoirId: string): Promise<DevoirMember[]> {
  const { data } = await supabase.rpc('list_devoir_members', { p_devoir: devoirId });
  return (
    (data ?? []) as {
      user_id: string;
      name: string;
      tag: string;
      avatar: string | null;
      role: 'owner' | 'member';
    }[]
  ).map((r) => ({
    id: r.user_id,
    name: r.name,
    tag: r.tag,
    avatar: r.avatar ?? undefined,
    role: r.role,
  }));
}
