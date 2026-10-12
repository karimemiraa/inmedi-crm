// Konfigurierbare Vorgangs-Status. Alle Seiten lesen Status, Farbe und
// „abgeschlossen" hierüber — niemals über fest codierte Statusnamen.
import { store } from '../data/store.js';
import { DEFAULT_STATUS } from '../data/statusDefaults.js';

export { STATUS_KINDS, STATUS_TONES } from '../data/statusDefaults.js';

export const statusList = (db, kind) => (db.statusConfig?.[kind]?.length ? db.statusConfig[kind] : DEFAULT_STATUS[kind]);
const find = (db, kind, name) => statusList(db, kind).find((s) => s.name === name);
export const statusTone = (db, kind, name) => find(db, kind, name)?.tone || 'gray';
export const isClosed = (db, kind, name) => !!find(db, kind, name)?.closed;
export const isOpen = (db, kind, name) => !isClosed(db, kind, name);
export const firstOpen = (db, kind) => (statusList(db, kind).find((s) => !s.closed) || statusList(db, kind)[0]).name;
export const firstClosed = (db, kind) => (statusList(db, kind).find((s) => s.closed) || statusList(db, kind).at(-1)).name;

// Felder, die vom Status abhängen (Aufgaben: done, Tickets: resolvedAt).
function derived(list, kind, rec, status) {
  const closed = !!list.find((s) => s.name === status)?.closed;
  if (kind === 'activities') return { done: closed };
  if (kind === 'tickets') return { resolvedAt: closed ? rec.resolvedAt || new Date().toISOString() : null };
  return {};
}

export function setStatus(kind, id, status) {
  const db = store.get();
  const rec = db[kind].find((r) => r.id === id);
  if (!rec) return;
  store.update(kind, id, { status, ...derived(statusList(db, kind), kind, rec, status) });
}

export function toggleDone(db, act) {
  setStatus('activities', act.id, act.done ? firstOpen(db, 'activities') : firstClosed(db, 'activities'));
}

// Speichert die Statusliste einer Vorgangsart und zieht alle Datensätze nach:
// renames { alt: neu } benennt um, reassign { gelöscht: Ziel } verschiebt.
export function saveStatusConfig(kind, list, renames = {}, reassign = {}) {
  store.set((s) => {
    const valid = new Set(list.map((x) => x.name));
    const fallback = (list.find((x) => !x.closed) || list[0]).name;
    // Gelöschte Status zuerst (Schlüssel = alter Name), dann Umbenennungen.
    const map = (name) => {
      const n = name in reassign ? reassign[name] : (renames[name] ?? name);
      return valid.has(n) ? n : fallback;
    };
    const records = (s[kind] || []).map((r) => {
      const status = map(r.status);
      return { ...r, status, ...derived(list, kind, r, status) };
    });
    return { ...s, statusConfig: { ...(s.statusConfig || {}), [kind]: list }, [kind]: records };
  });
}

export const statusUsage = (db, kind) => {
  const c = {};
  (db[kind] || []).forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
  return c;
};
