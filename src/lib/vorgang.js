// Zentrales Register aller Vorgänge und Stammdaten-Objekte mit eigener Seite
// (/vorgang/:slug/:id): Status, Verlauf, Kommentare, Verknüpfungen, Duplizieren,
// Papierkorb. Neue Objektarten werden nur hier und in vorgangFields.js ergänzt.
import { store } from '../data/store.js';
import { statusList, setStatus as setConfigStatus } from './status.js';

const sumItems = (items = []) => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
const tones = (map) => (list) => list.map((v) => ({ value: v, label: v, tone: map[v] || 'gray' }));

const ORDER_STATUS = tones({ Entwurf: 'gray', 'Angebot gesendet': 'amber', Bestätigt: 'blue', Versendet: 'purple', Geliefert: 'green', Abgelehnt: 'red' })(['Entwurf', 'Angebot gesendet', 'Bestätigt', 'Versendet', 'Geliefert', 'Abgelehnt']);
const INVOICE_STATUS = tones({ Entwurf: 'gray', Versendet: 'blue', Teilbezahlt: 'amber', Bezahlt: 'green', Überfällig: 'red', Storniert: 'gray' })(['Entwurf', 'Versendet', 'Teilbezahlt', 'Bezahlt', 'Überfällig', 'Storniert']);
const CONTRACT_STATUS = tones({ Entwurf: 'gray', Aktiv: 'green', Gekündigt: 'red', Ausgelaufen: 'amber' })(['Entwurf', 'Aktiv', 'Gekündigt', 'Ausgelaufen']);
const EVENT_STATUS = tones({ Geplant: 'blue', Läuft: 'amber', Abgeschlossen: 'green', Abgesagt: 'gray' })(['Geplant', 'Läuft', 'Abgeschlossen', 'Abgesagt']);
const CAMPAIGN_STATUS = tones({ Entwurf: 'gray', Geplant: 'blue', Aktiv: 'green', Abgeschlossen: 'purple' })(['Entwurf', 'Geplant', 'Aktiv', 'Abgeschlossen']);
const PRODUCT_STATUS = tones({ Aktiv: 'green', Auslaufend: 'amber', Inaktiv: 'gray' })(['Aktiv', 'Auslaufend', 'Inaktiv']);
const STAGE_TONE = { lead: 'gray', proposal: 'blue', negotiation: 'amber', won: 'green', lost: 'red' };

export const VORGANG = {
  tickets: { label: 'Ticket', slug: 'ticket', list: '/service', listLabel: 'Kundendienst', title: (r) => r.subject, number: (r) => r.number, configurable: true },
  activities: { label: 'Aufgabe', slug: 'aufgabe', list: '/activities', listLabel: 'Aufgaben & Termine', title: (r) => r.subject, number: () => '', configurable: true },
  ideas: { label: 'Idee', slug: 'idee', list: '/ideas', listLabel: 'Ideen', title: (r) => r.title, number: () => '', configurable: true },
  incidents: { label: 'Vorkommnis', slug: 'vorkommnis', list: '/quality', listLabel: 'QM & Vigilanz', title: (r) => r.title, number: (r) => r.number, configurable: true },
  capas: { label: 'CAPA', slug: 'capa', list: '/quality', listLabel: 'QM & Vigilanz', title: (r) => r.title, number: (r) => r.number, configurable: true },
  deals: { label: 'Deal', slug: 'deal', list: '/pipeline', listLabel: 'Pipeline', title: (r) => r.name, number: () => '', statusKey: 'stage', customEntity: 'Deal' },
  orders: { label: 'Auftrag', labelOf: (r) => r.kind || 'Auftrag', slug: 'auftrag', list: '/orders', listLabel: 'Angebote & Aufträge', title: (r) => r.number, number: () => '', items: true, statuses: ORDER_STATUS, customEntity: 'Vorgang' },
  invoices: { label: 'Rechnung', slug: 'rechnung', list: '/invoices', listLabel: 'Rechnungen', title: (r) => r.number, number: () => '', items: true, statuses: INVOICE_STATUS },
  contracts: { label: 'Vertrag', slug: 'vertrag', list: '/contracts', listLabel: 'Verträge', title: (r) => r.title, number: (r) => r.number, items: true, billing: true, statuses: CONTRACT_STATUS, customEntity: 'Vertrag' },
  recurringOrders: { label: 'Dauerauftrag', slug: 'dauerauftrag', list: '/recurring-orders', listLabel: 'Daueraufträge', title: (r) => 'Dauerauftrag ' + (store.get().accounts.find((a) => a.id === r.accountId)?.name || ''), number: () => '', items: true, statusKey: 'active' },
  events: { label: 'Messe', labelOf: (r) => r.type || 'Messe', slug: 'messe', list: '/events', listLabel: 'Messen', title: (r) => r.name, number: () => '', statuses: EVENT_STATUS },
  campaigns: { label: 'Kampagne', slug: 'kampagne', list: '/campaigns', listLabel: 'Kampagnen', title: (r) => r.name, number: () => '', statuses: CAMPAIGN_STATUS },
  products: { label: 'Produkt', slug: 'produkt', list: '/products', listLabel: 'Produkte', title: (r) => r.name, number: (r) => r.sku, statuses: PRODUCT_STATUS },
};
export const VORGANG_KINDS = Object.keys(VORGANG);
export const kindBySlug = (slug) => VORGANG_KINDS.find((k) => VORGANG[k].slug === slug);
export const kindLabel = (kind, r) => (r && VORGANG[kind].labelOf ? VORGANG[kind].labelOf(r) : VORGANG[kind].label);

export const vorgangLink = (kind, id) => `/vorgang/${VORGANG[kind].slug}/${encodeURIComponent(id)}`;
export const vorgangName = (kind, r) => [VORGANG[kind].number(r), VORGANG[kind].title(r)].filter(Boolean).join(' · ');

// ---- Status (konfigurierbar, Deal-Phasen, aktiv/pausiert oder feste Liste) ----
export function statusOptions(db, kind) {
  const v = VORGANG[kind];
  if (v.configurable) return statusList(db, kind).map((s) => ({ value: s.name, label: s.name, tone: s.tone }));
  if (kind === 'deals') return db.stages.map((s) => ({ value: s.id, label: s.name, tone: STAGE_TONE[s.id] || 'gray' }));
  if (kind === 'recurringOrders') return [{ value: 'true', label: 'Aktiv', tone: 'green' }, { value: 'false', label: 'Pausiert', tone: 'gray' }];
  return v.statuses || [];
}
export const statusValue = (kind, r) => (kind === 'recurringOrders' ? String(!!r.active) : r[VORGANG[kind].statusKey || 'status']);
export function statusInfo(db, kind, r) {
  const val = statusValue(kind, r);
  return statusOptions(db, kind).find((o) => o.value === val) || { value: val, label: val || '—', tone: 'gray' };
}
// extra: zusätzliche Felder (z. B. Kündigungsgrund)
export function setVorgangStatus(kind, id, value, extra = {}) {
  const db = store.get();
  const r = db[kind]?.find((x) => x.id === id);
  if (!r) return;
  if (VORGANG[kind].configurable && !Object.keys(extra).length) { setConfigStatus(kind, id, value); return; }
  const key = VORGANG[kind].statusKey || 'status';
  const from = statusInfo(db, kind, r).label;
  const patch = { ...extra, [key]: kind === 'recurringOrders' ? value === 'true' : value };
  if (kind === 'invoices' && value === 'Bezahlt') patch.paid = r.total;
  const to = statusOptions(db, kind).find((o) => o.value === value)?.label || value;
  updateVorgang(kind, id, patch, `Status: ${from} → ${to}`);
}

// ---- Positionen ----
export function setItems(kind, id, items) {
  const r = store.get()[kind]?.find((x) => x.id === id);
  if (!r) return;
  const patch = { items };
  if (kind === 'orders' || kind === 'invoices') patch.total = sumItems(items);
  updateVorgang(kind, id, patch, `Positionen geändert (${items.length})`);
}
export { sumItems };

// ---- Verlauf & Bearbeiten ----
const me = () => store.get().meta.currentUserId;
const now = () => new Date().toISOString();
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const find = (kind, id) => store.get()[kind]?.find((r) => r.id === id);
export const historyEntry = (text) => ({ id: uid('H'), at: now(), userId: me(), text });

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

// ---- Verknüpfungen ----
export function parentOf(db, kind, r) {
  const p = r.parent || (kind === 'capas' && r.incidentId ? { kind: 'incidents', id: r.incidentId } : null);
  if (!p) return null;
  return { kind: p.kind, id: p.id, rec: db[p.kind]?.find((x) => x.id === p.id) };
}
export function childrenOf(db, kind, id) {
  const out = [];
  VORGANG_KINDS.forEach((k) => (db[k] || []).forEach((r) => {
    if ((r.parent?.kind === kind && r.parent?.id === id) || (kind === 'incidents' && k === 'capas' && r.incidentId === id && !r.parent)) out.push({ kind: k, id: r.id, rec: r });
  }));
  return out;
}
const one = (db, kind, id) => (id ? [{ kind, id, rec: db[kind]?.find((x) => x.id === id) }] : []);
const many = (kind, list) => list.map((rec) => ({ kind, id: rec.id, rec }));

// Fachliche Beziehungen (Deal → Angebot/Auftrag → Rechnung/Vertrag …), gruppiert.
export function relationsOf(db, kind, r) {
  const groups = [];
  const add = (label, items) => { if (items.length) groups.push({ label, items }); };
  const p = parentOf(db, kind, r);
  if (p) add('Übergeordnet', [p]);
  switch (kind) {
    case 'deals':
      add('Angebote & Aufträge', many('orders', db.orders.filter((o) => o.dealId === r.id)));
      add('Aufgaben & Termine', many('activities', db.activities.filter((a) => a.dealId === r.id && !a.parent)));
      break;
    case 'orders':
      add('Deal', one(db, 'deals', r.dealId));
      add('Dauerauftrag', one(db, 'recurringOrders', r.recurringId));
      add('Rechnungen', many('invoices', db.invoices.filter((i) => i.orderId === r.id)));
      add('Verträge', many('contracts', db.contracts.filter((c) => c.fromOrderId === r.id)));
      break;
    case 'invoices': add('Auftrag', one(db, 'orders', r.orderId)); break;
    case 'contracts': add('Ursprungsauftrag', one(db, 'orders', r.fromOrderId)); break;
    case 'recurringOrders': add('Erzeugte Aufträge', (r.generatedOrderIds || []).map((oid) => ({ kind: 'orders', id: oid, rec: db.orders.find((o) => o.id === oid) }))); break;
    case 'activities': add('Deal', one(db, 'deals', r.dealId)); break;
    case 'products':
      add('In Angeboten & Aufträgen', many('orders', db.orders.filter((o) => (o.items || []).some((it) => it.productId === r.id))));
      add('In Deals', many('deals', db.deals.filter((d) => (d.products || []).includes(r.id))));
      add('Tickets', many('tickets', db.tickets.filter((t) => t.productId === r.id)));
      add('QM-Vorkommnisse', many('incidents', db.incidents.filter((i) => i.productId === r.id)));
      break;
    default: break;
  }
  add('Daraus entstanden', childrenOf(db, kind, r.id));
  return groups;
}

// Neuen Vorgang aus einem anderen heraus anlegen (Folgeaufgabe, Vorkommnis aus Ticket, CAPA …).
export function createLinked(kind, data, parentKind, parentId) {
  const rec = store.add(kind, { ...data, parent: { kind: parentKind, id: parentId }, comments: [], history: [historyEntry('Angelegt aus ' + VORGANG[parentKind].label)] });
  const p = find(parentKind, parentId);
  if (p) store.update(parentKind, parentId, { history: [historyEntry(`${kindLabel(kind, rec)} verknüpft: ${vorgangName(kind, rec)}`), ...(p.history || [])] }, { silent: true });
  return rec;
}

// Nächste freie Nummer im gleichen Schema (AUF-24532 → AUF-24533, VK-2026-015 → VK-2026-016)
export function nextNumber(list, sample, field = 'number') {
  const m = String(sample || '').match(/^(.*?)(\d+)$/);
  if (!m) return sample ? sample + '-2' : '';
  const [, prefix, digits] = m;
  const max = list.reduce((mx, r) => {
    const x = String(r[field] || '').match(/^(.*?)(\d+)$/);
    return x && x[1] === prefix ? Math.max(mx, Number(x[2])) : mx;
  }, Number(digits));
  return prefix + String(max + 1).padStart(digits.length, '0');
}

export function duplicateVorgang(kind, id) {
  const db = store.get();
  const r = find(kind, id);
  if (!r) return null;
  const { id: _id, comments, history, parent, generatedOrderIds, resolvedAt, ...rest } = r;
  const copy = { ...rest, comments: [], history: [historyEntry('Dupliziert aus ' + vorgangName(kind, r))] };
  if (r.number) copy.number = nextNumber(db[kind], r.number);
  if (kind === 'products') copy.sku = nextNumber(db.products, r.sku, 'sku');
  ['name', 'title', 'subject'].forEach((f) => { if (r[f]) copy[f] = r[f] + ' (Kopie)'; });
  if (kind === 'orders' || kind === 'invoices') { copy.date = now(); if (kind === 'invoices') { copy.issueDate = now(); copy.paid = 0; copy.status = 'Entwurf'; } else copy.status = 'Entwurf'; }
  if (kind === 'recurringOrders') copy.generatedOrderIds = [];
  if (VORGANG[kind].configurable) copy.status = '';
  return store.add(kind, copy);
}

// ---- Papierkorb ----
export function trashVorgang(kind, id) {
  const r = find(kind, id);
  if (!r) return;
  store.set((s) => ({
    ...s,
    [kind]: s[kind].filter((x) => x.id !== id),
    trash: [{ id: uid('T'), kind, record: r, deletedAt: now(), deletedBy: me() }, ...(s.trash || [])],
    auditLog: [{ id: uid('L'), at: now(), userId: me(), action: 'In Papierkorb verschoben', entity: kindLabel(kind, r) + ' ' + vorgangName(kind, r) }, ...(s.auditLog || [])],
  }));
}
export function restoreVorgang(trashId) {
  const t = (store.get().trash || []).find((x) => x.id === trashId);
  if (!t) return null;
  store.set((s) => ({
    ...s,
    [t.kind]: [t.record, ...s[t.kind].filter((x) => x.id !== t.record.id)],
    trash: s.trash.filter((x) => x.id !== trashId),
    auditLog: [{ id: uid('L'), at: now(), userId: me(), action: 'Wiederhergestellt', entity: kindLabel(t.kind, t.record) + ' ' + vorgangName(t.kind, t.record) }, ...(s.auditLog || [])],
  }));
  return t;
}

// Verweisfelder, die beim endgültigen Löschen geleert werden
const REF_FIELDS = { deals: ['dealId'], orders: ['orderId', 'fromOrderId'], incidents: ['incidentId'], products: ['productId'], recurringOrders: ['recurringId'] };
const REF_COLLS = [...VORGANG_KINDS, 'accounts', 'contacts', 'leads'];

export function purgeVorgang(trashId) {
  const t = (store.get().trash || []).find((x) => x.id === trashId);
  if (!t) return;
  const gid = t.record.id;
  const fields = REF_FIELDS[t.kind] || [];
  store.set((s) => {
    const next = { ...s, trash: s.trash.filter((x) => x.id !== trashId) };
    REF_COLLS.forEach((k) => {
      if (!Array.isArray(s[k])) return;
      next[k] = s[k].map((r) => {
        let x = r;
        if (r.parent && r.parent.kind === t.kind && r.parent.id === gid) x = { ...x, parent: null };
        fields.forEach((f) => { if (x[f] === gid) x = { ...x, [f]: null }; });
        if (t.kind === 'orders' && Array.isArray(x.generatedOrderIds) && x.generatedOrderIds.includes(gid)) x = { ...x, generatedOrderIds: x.generatedOrderIds.filter((o) => o !== gid) };
        if (t.kind === 'products' && Array.isArray(x.products) && x.products.includes(gid)) x = { ...x, products: x.products.filter((o) => o !== gid) };
        return x;
      });
    });
    next.auditLog = [{ id: uid('L'), at: now(), userId: me(), action: 'Endgültig gelöscht', entity: kindLabel(t.kind, t.record) + ' ' + vorgangName(t.kind, t.record) }, ...(s.auditLog || [])];
    return next;
  });
}
export const purgeAll = () => (store.get().trash || []).forEach((t) => purgeVorgang(t.id));
