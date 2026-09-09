import { supabase } from '@/lib/supabase';

export interface Devoir {
  id: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  subject: string;
  methods: string[];
}

type Row = { id: string; d: string; subject: string; methods: string[] | null };
const toDevoir = (r: Row): Devoir => ({
  id: r.id,
  date: r.d,
  subject: r.subject,
  methods: r.methods ?? [],
});

/** Tous les devoirs de l'utilisateur (le volume reste petit). */
export async function listDevoirs(): Promise<Devoir[]> {
  const { data, error } = await supabase
    .from('devoirs')
    .select('id, d, subject, methods')
    .order('d');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toDevoir(r as Row));
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

export async function loadWork(devoirId: string): Promise<Record<string, unknown>> {
  const { data } = await supabase
    .from('devoir_work')
    .select('slot, data')
    .eq('devoir_id', devoirId);
  const out: Record<string, unknown> = {};
  for (const r of data ?? []) out[(r as { slot: string }).slot] = (r as { data: unknown }).data;
  return out;
}

export async function saveWork(
  devoirId: string,
  slot: string,
  data: unknown,
): Promise<void> {
  await supabase
    .from('devoir_work')
    .upsert(
      { devoir_id: devoirId, slot, data, updated_at: new Date().toISOString() },
      { onConflict: 'devoir_id,slot' },
    );
}
