// Lightweight localStorage-backed store with pub/sub.
// Swap this out for a real API layer later — pages consume it via useStore().
import { useSyncExternalStore } from 'react';
import { buildSeed, STAGES } from './seed.js';
import { cloneDefaultStatus } from './statusDefaults.js';

const KEY = 'inmedi-crm-v12';

// Bringt gespeicherte Daten auf den aktuellen Stand, ohne Nutzerdaten zu verlieren:
// Serviceaufträge & Geräteverwaltung entfernt (kein Serviceangebot), Status konfigurierbar.
function migrate(s) {
  const out = { ...s };
  delete out.serviceOrders;
  delete out.devices;
  if (!out.statusConfig) out.statusConfig = cloneDefaultStatus();
  if (!Array.isArray(out.trash)) out.trash = [];
  const strip = ({ deviceId, ...r }) => r;
  out.tickets = (out.tickets || []).map((t) => ({ ...strip(t), category: t.category === 'Wartung' ? 'Produktfrage' : t.category }));
  out.incidents = (out.incidents || []).map(strip);
  out.activities = (out.activities || []).map((a) => (a.status ? a : { ...a, status: a.done ? 'Erledigt' : 'Offen' }));
  out.kbArticles = (out.kbArticles || []).filter((k) => !/MTK|STK/.test(k.title));
  if (Array.isArray(out.customFields)) out.customFields = out.customFields.filter((f) => f.label !== 'Service Level' && f.entity !== 'Gerät');
  // Notizen (Firmen, Ansprechpartner, Interessenten) → einheitliche Kommentare
  const byName = Object.fromEntries((out.users || []).map((u) => [u.name, u.id]));
  const toComments = (list) => (list || []).map((r) => {
    if (!Array.isArray(r.notes)) return r;
    const { notes, ...rest } = r;
    const migrated = [...notes].reverse().map((n) => ({ id: n.id, userId: byName[n.author] || null, author: n.author, at: n.at, text: n.text, editedAt: null }));
    return { ...rest, comments: [...(r.comments || []), ...migrated] };
  });
  out.accounts = toComments(out.accounts);
  out.contacts = toComments(out.contacts);
  out.leads = toComments(out.leads);
  if (Array.isArray(out.automations)) out.automations = out.automations.filter((r) => r.trigger?.object !== 'Gerät');
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = migrate(JSON.parse(raw));
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
      return s;
    }
  } catch (e) { /* ignore */ }
  const seed = migrate(buildSeed());
  try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (e) {}
  return seed;
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
function emit() { listeners.forEach((l) => l()); }

// Mehrere Tabs: Änderungen aus einem anderen Tab sofort übernehmen, damit kein Tab mit
// veraltetem Stand speichert und dabei die Änderungen des anderen überschreibt.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = migrate(JSON.parse(e.newValue)); emit(); } catch (err) { /* ignore */ }
  });
}

// Neue Vorgänge bekommen immer einen gültigen Status aus der Konfiguration
// (z. B. wenn ein Status umbenannt wurde) — Aufgaben zusätzlich passendes `done`.
function withStatus(coll, rec) {
  const list = state.statusConfig?.[coll];
  if (!list?.length) return rec;
  let r = rec;
  if (!list.some((s) => s.name === r.status)) {
    const target = coll === 'activities' && r.done ? (list.find((s) => s.closed) || list.at(-1)) : (list.find((s) => !s.closed) || list[0]);
    r = { ...r, status: target.name };
  }
  if (coll === 'activities') r = { ...r, done: !!list.find((s) => s.name === r.status)?.closed };
  return r;
}

let mutationHandler = null;
function notifyMutation(coll, event, rec, prev) { if (mutationHandler) { try { mutationHandler(coll, event, rec, prev); } catch (e) {} } }

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
    const rec = withStatus(coll, { ...item, id });
    state = { ...state, [coll]: [rec, ...state[coll]] };
    persist(); emit();
    notifyMutation(coll, 'create', rec);
    return rec;
  },
  // opts.silent: reine Kommentar-/Verlaufs-Änderungen lösen keine Automatisierung aus.
  update(coll, id, patch, opts = {}) {
    const prev = state[coll].find((r) => r.id === id);
    state = { ...state, [coll]: state[coll].map((r) => (r.id === id ? { ...r, ...patch } : r)) };
    persist(); emit();
    if (!opts.silent) notifyMutation(coll, 'update', state[coll].find((r) => r.id === id), prev);
  },
  setMutationHandler(fn) { mutationHandler = fn; },
  // Neuesten gespeicherten Stand übernehmen (ein anderer Tab hat evtl. gerade gespeichert)
  reloadFromStorage() {
    try { const raw = localStorage.getItem(KEY); if (raw) { state = migrate(JSON.parse(raw)); emit(); } } catch (e) { /* ignore */ }
  },
  remove(coll, id) {
    state = { ...state, [coll]: state[coll].filter((r) => r.id !== id) };
    persist(); emit();
  },
  reset(opts) {
    state = migrate(buildSeed(opts)); persist(); emit();
  },
};

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

export { STAGES };
