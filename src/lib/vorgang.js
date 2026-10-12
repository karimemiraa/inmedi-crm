// Gemeinsame Logik für alle Vorgänge (Tickets, Aufgaben, Ideen, QM-Vorkommnisse, CAPA):
// Bearbeiten mit Verlauf, Kommentare, Verknüpfungen und Papierkorb.
import { store } from '../data/store.js';
import { openLink } from './nav.js';

export const VORGANG = {
  tickets: { label: 'Ticket', page: '/service', title: (r) => r.subject, number: (r) => r.number },
  activities: { label: 'Aufgabe', page: '/activities', title: (r) => r.subject, number: () => '' },
  ideas: { label: 'Idee', page: '/ideas', title: (r) => r.title, number: () => '' },
  incidents: { label: 'Vorkommnis', page: '/quality', title: (r) => r.title, number: (r) => r.number },
  capas: { label: 'CAPA', page: '/quality', title: (r) => r.title, number: (r) => r.number },
};
export const VORGANG_KINDS = Object.keys(VORGANG);

export const vorgangLink = (kind, id) => openLink(VORGANG[kind].page, id);
export const vorgangName = (kind, r) => [VORGANG[kind].number(r), VORGANG[kind].title(r)].filter(Boolean).join(' · ');

const me = () => store.get().meta.currentUserId;
const now = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const find = (kind, id) => store.get()[kind]?.find((r) => r.id === id);
export const historyEntry = (text) => ({ id: uid('H'), at: now(), userId: me(), text });

// Felder ändern + Verlaufseintrag in einem Schritt.
export function updateVorgang(kind, id, patch, text) {
  const r = find(kind, id);
  if (!r) return;
  store.update(kind, id, { ...patch, history: [historyEntry(text), ...(r.history || [])] });
}

// ---- Kommentare (Autor bearbeitet/löscht eigene, Administrator darf alle löschen) ----
export const isAdmin = (db) => db.users.find((u) => u.id === db.meta.currentUserId)?.role === 'Administrator';
export const canEditComment = (db, c) => c.userId === db.meta.currentUserId;
export const canDeleteComment = (db, c) => canEditComment(db, c) || isAdmin(db);

export function addComment(kind, id, text) {
  const r = find(kind, id);
  if (!r || !text.trim()) return;
  store.update(kind, id, { comments: [...(r.comments || []), { id: uid('C'), userId: me(), at: now(), text: text.trim(), editedAt: null }] }, { silent: true });
}
export function editComment(kind, id, cid, text) {
  const r = find(kind, id);
  if (!r || !text.trim()) return;
  store.update(kind, id, { comments: (r.comments || []).map((c) => (c.id === cid ? { ...c, text: text.trim(), editedAt: now() } : c)) }, { silent: true });
}
export function deleteComment(kind, id, cid) {
  const r = find(kind, id);
  if (!r) return;
  store.update(kind, id, { comments: (r.comments || []).filter((c) => c.id !== cid) }, { silent: true });
}

// ---- Verknüpfungen: parent = { kind, id }; CAPA → Vorkommnis zusätzlich über incidentId ----
export function parentOf(db, kind, r) {
  const p = r.parent || (kind === 'capas' && r.incidentId ? { kind: 'incidents', id: r.incidentId } : null);
  if (!p) return null;
  const rec = db[p.kind]?.find((x) => x.id === p.id);
  return { kind: p.kind, id: p.id, rec };
}
export function childrenOf(db, kind, id) {
  const out = [];
  VORGANG_KINDS.forEach((k) => (db[k] || []).forEach((r) => {
    if ((r.parent?.kind === kind && r.parent?.id === id) || (kind === 'incidents' && k === 'capas' && r.incidentId === id && !r.parent)) out.push({ kind: k, rec: r });
  }));
  return out;
}

// Neuen Vorgang aus einem anderen heraus anlegen (Folgeaufgabe, Vorkommnis aus Ticket, CAPA …).
export function createLinked(kind, data, parentKind, parentId) {
  const rec = store.add(kind, { ...data, parent: { kind: parentKind, id: parentId }, comments: [], history: [historyEntry('Angelegt aus ' + VORGANG[parentKind].label)] });
  const p = find(parentKind, parentId);
  if (p) store.update(parentKind, parentId, { history: [historyEntry(`${VORGANG[kind].label} verknüpft: ${vorgangName(kind, rec)}`), ...(p.history || [])] }, { silent: true });
  return rec;
}

// ---- Papierkorb ----
export function trashVorgang(kind, id) {
  const r = find(kind, id);
  if (!r) return;
  store.set((s) => ({
    ...s,
    [kind]: s[kind].filter((x) => x.id !== id),
    trash: [{ id: uid('T'), kind, record: r, deletedAt: now(), deletedBy: me() }, ...(s.trash || [])],
    auditLog: [{ id: uid('L'), at: now(), userId: me(), action: 'In Papierkorb verschoben', entity: VORGANG[kind].label + ' ' + vorgangName(kind, r) }, ...(s.auditLog || [])],
  }));
}
export function restoreVorgang(trashId) {
  const t = (store.get().trash || []).find((x) => x.id === trashId);
  if (!t) return null;
  store.set((s) => ({
    ...s,
    [t.kind]: [t.record, ...s[t.kind].filter((x) => x.id !== t.record.id)],
    trash: s.trash.filter((x) => x.id !== trashId),
    auditLog: [{ id: uid('L'), at: now(), userId: me(), action: 'Wiederhergestellt', entity: VORGANG[t.kind].label + ' ' + vorgangName(t.kind, t.record) }, ...(s.auditLog || [])],
  }));
  return t;
}
// Endgültig löschen: Verweise anderer Vorgänge werden gelöst.
export function purgeVorgang(trashId) {
  const t = (store.get().trash || []).find((x) => x.id === trashId);
  if (!t) return;
  const gone = (p) => p && p.kind === t.kind && p.id === t.record.id;
  store.set((s) => {
    const next = { ...s, trash: s.trash.filter((x) => x.id !== trashId) };
    VORGANG_KINDS.forEach((k) => {
      next[k] = (s[k] || []).map((r) => {
        let x = r;
        if (gone(r.parent)) x = { ...x, parent: null };
        if (t.kind === 'incidents' && k === 'capas' && r.incidentId === t.record.id) x = { ...x, incidentId: null };
        return x;
      });
    });
    next.auditLog = [{ id: uid('L'), at: now(), userId: me(), action: 'Endgültig gelöscht', entity: VORGANG[t.kind].label + ' ' + vorgangName(t.kind, t.record) }, ...(s.auditLog || [])];
    return next;
  });
}
export const purgeAll = () => (store.get().trash || []).forEach((t) => purgeVorgang(t.id));
