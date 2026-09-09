import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { loadWork, saveWork } from '@/lib/devoirs';

// Contenu des espaces de travail d'un devoir : chargé depuis Supabase quand la
// carte s'ouvre, sauvegardé (débounce) à chaque modification. Une entrée par
// "slot" (méthode). Le hook useWork lit/écrit via ce contexte.

type WorkCtx = {
  ready: boolean;
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
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const latest = useRef<Record<string, unknown>>({});

  useEffect(() => {
    let alive = true;
    setWork({});
    latest.current = {};
    if (!devoirId) {
      setReady(true); // devoir pas encore créé — rien à charger
      return;
    }
    setReady(false);
    void loadWork(devoirId).then((w) => {
      if (!alive) return;
      setWork(w);
      setReady(true);
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
    return () => {
      for (const slot of Object.keys(t)) {
        clearTimeout(t[slot]);
        if (slot in l) void saveWork(id, slot, l[slot]);
      }
    };
  }, [devoirId]);

  const set = (slot: string, data: unknown) => {
    latest.current[slot] = data;
    setWork((prev) => ({ ...prev, [slot]: data }));
    if (!devoirId) return; // sera repris quand le devoir aura un id (remontage)
    clearTimeout(timers.current[slot]);
    timers.current[slot] = setTimeout(() => {
      void saveWork(devoirId, slot, latest.current[slot]);
    }, SAVE_DEBOUNCE_MS);
  };

  return (
    <Ctx.Provider value={{ ready, get: (s) => work[s], set }}>{children}</Ctx.Provider>
  );
};

/**
 * État local d'un slot, synchronisé avec Supabase via le DevoirWorkProvider.
 * `workKey` est conservé pour compat mais le scope vient du contexte.
 */
export function useWork<T>(_workKey: string, slot: string, initial: T) {
  const ctx = useContext(Ctx);
  const [data, setData] = useState<T>(initial);
  const touched = useRef(false);
  const initialRef = useRef(initial);

  // Adopte la valeur serveur une fois prête, tant que l'utilisateur n'a pas édité.
  useEffect(() => {
    if (ctx?.ready && !touched.current) {
      const v = ctx.get(slot);
      setData(v === undefined ? initialRef.current : (v as T));
    }
  }, [ctx?.ready, ctx, slot]);

  const update = (next: T | ((prev: T) => T)) => {
    touched.current = true;
    setData((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      ctx?.set(slot, value);
      return value;
    });
  };

  return [data, update] as const;
}

/** true tant que le contenu du devoir n'est pas encore chargé. */
export function useWorkLoading(): boolean {
  const ctx = useContext(Ctx);
  return ctx ? !ctx.ready : false;
}
