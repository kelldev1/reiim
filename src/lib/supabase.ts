import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud and early rather than crashing deep inside a component.
  console.error(
    '[reiim] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. Voir SETUP.md.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Full URL of a deployed Edge Function. */
export const functionUrl = (name: string) => `${url}/functions/v1/${name}`;
