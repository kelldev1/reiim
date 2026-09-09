import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Config absente = rien ne peut marcher. On coupe court avec un message
  // clair (attrapé par l'ErrorBoundary) plutôt qu'une app à moitié cassée.
  throw new Error(
    'Configuration manquante : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Voir SETUP.md.',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Full URL of a deployed Edge Function. */
export const functionUrl = (name: string) => `${url}/functions/v1/${name}`;
