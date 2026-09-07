import { useState } from 'react';

// Per-devoir "workspace" data, keyed by the same day-key the calendar uses
// (`${year}-${month+1}-${day}`), then by method slot.
const KEY = 'reiim-devoir-work';

type WorkStore = Record<string, Record<string, unknown>>;

const readAll = (): WorkStore => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WorkStore) : {};
  } catch {
    return {};
  }
};

const writeAll = (store: WorkStore) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / privacy-mode failures */
  }
};

export const getWork = <T>(workKey: string, slot: string): T | undefined =>
  readAll()[workKey]?.[slot] as T | undefined;

export const setWork = (workKey: string, slot: string, value: unknown) => {
  const all = readAll();
  all[workKey] = { ...(all[workKey] ?? {}), [slot]: value };
  writeAll(all);
};

/**
 * Local state that also persists to localStorage on every change.
 * The consuming card is keyed by day, so `workKey` never changes for a mounted
 * instance — no re-sync effect needed.
 */
export function useWork<T>(workKey: string, slot: string, initial: T) {
  const [data, setData] = useState<T>(() => getWork<T>(workKey, slot) ?? initial);

  const update = (next: T | ((prev: T) => T)) => {
    setData((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      setWork(workKey, slot, value);
      return value;
    });
  };

  return [data, update] as const;
}
