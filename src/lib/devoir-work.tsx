import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadWork, saveWork } from '@/lib/devoirs';
import { supabase } from '@/lib/supabase';

// Contenu des espaces de travail d'un devoir : chargé depuis Supabase quand la
// carte s'ouvre, sauvegardé (débounce) à chaque modification. Une entrée par
// "slot" (méthode). Le hook useWork lit/écrit via ce contexte.

/** État de synchronisation du contenu avec le serveur. */
export type WorkSyncState = 'idle' | 'saving' | 'saved' | 'error';

type WorkCtx = {
  ready: boolean;
  /** true si le contenu n'a pas pu être chargé (⇒ ne pas écraser en base). */
  loadFailed: boolean;
  sync: WorkSyncState;
  get: (slot: string) => unknown;
  set: (slot: string, data: unknown) => void;
};

const Ctx = createContext<WorkCtx | null>(null);

const SAVE_DEBOUNCE_MS = 600;

export const DevoirWorkProvider: React.FC<{
  devoirId: string;
  children: React.ReactNode;
}> = ({ devoirId, children }) => {
  const [work, setWork] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sync, setSync] = useState<WorkSyncState>('idle');
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, unknown>>({});

  useEffect(() => {
    let alive = true;
    // Reset de l'état synchronisé quand on change de devoir (la clé vient d'une
    // prop) — cas légitime que la règle react-hooks sur-signale.
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setWork({});
    latest.current = {};
    setLoadFailed(false);
    setSync('idle');
    if (!devoirId) {
      setReady(true); // devoir pas encore créé — rien à charger
      return;
    }
    setReady(false);
    void loadWork(devoirId)
      .then((w) => {
        if (!alive) return;
        setWork(w);
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        // On débloque l'UI mais on interdit l'écrasement en base : le contenu
        // affiché est vide alors qu'il ne l'est peut-être pas.
        setLoadFailed(true);
        setReady(true);
        setSync('error');
      });
    return () => {
      alive = false;
    };
  }, [devoirId]);

  // flush pending saves when the devoir changes / the card closes
  useEffect(() => {
    const t = timers.current;
    const l = latest.current;
    const id = devoirId;
    const failed = loadFailed;
    return () => {
      if (failed) return; // chargement KO → ne pas écraser en base
      for (const slot of Object.keys(t)) {
        clearTimeout(t[slot]);
        if (slot in l) void saveWork(id, slot, l[slot]);
      }
    };
  }, [devoirId, loadFailed]);

  // temps réel : reflète les modifications faites par un autre membre du devoir
  useEffect(() => {
    if (!devoirId) return;
    const channel = supabase
      .channel(`devoir_work:${devoirId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devoir_work',
          filter: `devoir_id=eq.${devoirId}`,
        },
        (payload) => {
          const row = payload.new as { slot?: string; data?: unknown };
          if (!row?.slot) return;
          // ignore l'écho de nos propres écritures
          if (JSON.stringify(row.data) === JSON.stringify(latest.current[row.slot])) return;
          latest.current[row.slot] = row.data;
          setWork((prev) => ({ ...prev, [row.slot as string]: row.data }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [devoirId]);

  const set = (slot: string, data: unknown) => {
    latest.current[slot] = data;
    setWork((prev) => ({ ...prev, [slot]: data }));
    if (loadFailed) {
      setSync('error');
      return; // contenu non chargé → on n'écrit pas par-dessus
    }
    if (!devoirId) return; // sera repris quand le devoir aura un id (remontage)
    setSync('saving');
    clearTimeout(timers.current[slot]);
    timers.current[slot] = setTimeout(() => {
      void saveWork(devoirId, slot, latest.current[slot]).then((ok) => {
        setSync(ok ? 'saved' : 'error');
      });
    }, SAVE_DEBOUNCE_MS);
  };

  return (
    <Ctx.Provider value={{ ready, loadFailed, sync, get: (s) => work[s], set }}>
      {children}
    </Ctx.Provider>
  );
};

/**
 * État local d'un slot, synchronisé avec Supabase via le DevoirWorkProvider.
 * `workKey` est conservé pour compat mais le scope vient du contexte.
 */
export function useWork<T>(_workKey: string, slot: string, initial: T) {
  const ctx = useContext(Ctx);
  const [data, setData] = useState<T>(initial);
  const dataRef = useRef<T>(initial);
  const touched = useRef(false);
  const initialRef = useRef(initial);

  // Valeur serveur courante (change de référence quand le temps réel la met à jour).
  const serverVal = ctx?.ready ? ctx.get(slot) : undefined;

  // Adopte la valeur serveur tant que l'utilisateur n'a pas édité ce slot.
  // (Une fois « touché », l'utilisateur possède ce champ pour la session.)
  useEffect(() => {
    if (ctx?.ready && !touched.current) {
      const v = serverVal === undefined ? initialRef.current : (serverVal as T);
      dataRef.current = v;
      setData(v);
    }
  }, [ctx?.ready, serverVal]);

  const update = (next: T | ((prev: T) => T)) => {
    touched.current = true;
    const value =
      typeof next === 'function' ? (next as (p: T) => T)(dataRef.current) : next;
    dataRef.current = value;
    setData(value);
    // Hors du updater de setData : sinon on déclenche un setState du provider
    // pendant le rendu d'un autre composant (« Cannot update a component… »).
    ctx?.set(slot, value);
  };

  return [data, update] as const;
}

/** true tant que le contenu du devoir n'est pas encore chargé. */
export function useWorkLoading(): boolean {
  const ctx = useContext(Ctx);
  return ctx ? !ctx.ready : false;
}

/** État de synchronisation ('idle' | 'saving' | 'saved' | 'error') + échec de chargement. */
export function useWorkSync(): { state: WorkSyncState; loadFailed: boolean } {
  const ctx = useContext(Ctx);
  return { state: ctx?.sync ?? 'idle', loadFailed: ctx?.loadFailed ?? false };
}
