// Lightweight localStorage-backed store with pub/sub.
// Swap this out for a real API layer later — pages consume it via useStore().
import { useSyncExternalStore } from 'react';
import { buildSeed, STAGES } from './seed.js';

const KEY = 'inmedi-crm-v12';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  const seed = buildSeed();
  try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (e) {}
  return seed;
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
function emit() { listeners.forEach((l) => l()); }

let mutationHandler = null;
function notifyMutation(coll, event, rec) { if (mutationHandler) { try { mutationHandler(coll, event, rec); } catch (e) {} } }

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  set(updater) {
    state = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
    persist(); emit();
  },
  // ---- generic collection helpers ----
  add(coll, item) {
    const id = item.id || (coll[0].toUpperCase() + Date.now().toString().slice(-7));
    const rec = { ...item, id };
    state = { ...state, [coll]: [rec, ...state[coll]] };
    persist(); emit();
    notifyMutation(coll, 'create', rec);
    return rec;
  },
  update(coll, id, patch) {
    state = { ...state, [coll]: state[coll].map((r) => (r.id === id ? { ...r, ...patch } : r)) };
    persist(); emit();
    notifyMutation(coll, 'update', state[coll].find((r) => r.id === id));
  },
  setMutationHandler(fn) { mutationHandler = fn; },
  remove(coll, id) {
    state = { ...state, [coll]: state[coll].filter((r) => r.id !== id) };
    persist(); emit();
  },
  reset(opts) {
    state = buildSeed(opts); persist(); emit();
  },
};

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

export { STAGES };
