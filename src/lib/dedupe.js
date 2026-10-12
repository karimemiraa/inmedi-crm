// Dublettenprüfung & Zusammenführung.
// Erkennt wahrscheinliche Doppelerfassungen von Firmen und Ansprechpartnern und
// führt sie zusammen, indem ALLE abhängigen Datensätze auf den Gewinner umgehängt werden.
import { store } from '../data/store.js';

// ---- Normalisierung & Ähnlichkeit ----
const LEGAL = /\b(gmbh|mbh|ag|kg|ohg|kgaa|se|ug|co|und|u|e\s?v)\b/g;
export function normName(s) {
  return String(s || '').toLowerCase()
    .replace(/[&.,/-]/g, ' ')
    .replace(LEGAL, ' ')
    .replace(/[^a-z0-9äöüß ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}
function ratio(a, b) { const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; }
function jaccard(a, b) {
  const A = new Set(a.split(' ').filter(Boolean)), B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}
export function nameScore(a, b) { const x = normName(a), y = normName(b); if (!x || !y) return 0; return Math.max(ratio(x, y), jaccard(x, y)); }
const digits = (s) => String(s || '').replace(/\D/g, '');
const eq = (a, b) => a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

const THRESHOLD = 0.62;

export function findAccountDuplicates(accounts) {
  const out = [];
  for (let i = 0; i < accounts.length; i++) for (let j = i + 1; j < accounts.length; j++) {
    const a = accounts[i], b = accounts[j];
    const ns = nameScore(a.name, b.name);
    const reasons = [];
    let score = ns;
    if (ns >= 0.5) reasons.push(`Name ${Math.round(ns * 100)} %`);
    if (eq(a.email, b.email)) { reasons.push('gleiche E-Mail'); score = Math.max(score, 0.9); }
    if (digits(a.phone) && digits(a.phone) === digits(b.phone)) { reasons.push('gleiche Telefonnr.'); score = Math.max(score, 0.85); }
    if (a.zip && a.zip === b.zip && ns >= 0.4) { reasons.push('gleiche PLZ'); score = Math.max(score, ns + 0.1); }
    if (score >= THRESHOLD && reasons.length) out.push({ a, b, score: Math.min(score, 1), reasons });
  }
  return out.sort((x, y) => y.score - x.score);
}

export function findContactDuplicates(contacts) {
  const out = [];
  for (let i = 0; i < contacts.length; i++) for (let j = i + 1; j < contacts.length; j++) {
    const a = contacts[i], b = contacts[j];
    const ns = nameScore(a.name, b.name);
    const reasons = [];
    let score = ns;
    if (ns >= 0.5) reasons.push(`Name ${Math.round(ns * 100)} %`);
    if (eq(a.email, b.email)) { reasons.push('gleiche E-Mail'); score = Math.max(score, 0.95); }
    if (digits(a.phone) && digits(a.phone) === digits(b.phone)) { reasons.push('gleiche Telefonnr.'); score = Math.max(score, 0.8); }
    if (a.accountId === b.accountId && ns >= 0.5) { reasons.push('selbe Firma'); score = Math.max(score, ns + 0.1); }
    if (score >= THRESHOLD && reasons.length) out.push({ a, b, score: Math.min(score, 1), reasons });
  }
  return out.sort((x, y) => y.score - x.score);
}

// ---- Fremdschlüssel-Karte für die Zusammenführung ----
const ACCOUNT_REFS = [
  ['contacts', 'accountId'], ['deals', 'accountId'], ['orders', 'accountId'], ['invoices', 'accountId'],
  ['contracts', 'accountId'], ['activities', 'accountId'], ['tickets', 'accountId'],
  ['incidents', 'accountId'], ['costEntries', 'accountId'],
  ['documents', 'accountId'], ['recurringOrders', 'accountId'], ['leads', 'accountId'],
];
const CONTACT_REFS = [
  ['deals', 'contactId'], ['activities', 'contactId'], ['contracts', 'contactId'], ['tickets', 'contactId'],
];

function mergePriceList(a = [], b = []) {
  const seen = new Set(a.map((e) => e.productId));
  return [...a, ...b.filter((e) => !seen.has(e.productId))];
}

function dedupeAttendees(atts) {
  const seen = new Set();
  return atts.filter((at) => { const k = at.refType + ':' + at.refId; if (seen.has(k)) return false; seen.add(k); return true; });
}

// Gibt die Anzahl umgehängter Datensätze zurück.
export function mergeAccounts(survivorId, dupId) {
  const s = store.get();
  const survivor = s.accounts.find((a) => a.id === survivorId);
  const dup = s.accounts.find((a) => a.id === dupId);
  if (!survivor || !dup || survivorId === dupId) return 0;
  let repointed = 0;
  const next = { ...s };
  ACCOUNT_REFS.forEach(([coll, field]) => {
    next[coll] = (next[coll] || []).map((r) => { if (r[field] === dupId) { repointed++; return { ...r, [field]: survivorId }; } return r; });
  });
  next.events = (next.events || []).map((e) => {
    let changed = false;
    const atts = (e.attendees || []).map((at) => { if (at.refType === 'account' && at.refId === dupId) { changed = true; repointed++; return { ...at, refId: survivorId }; } return at; });
    return changed ? { ...e, attendees: dedupeAttendees(atts) } : e;
  });
  next.campaigns = (next.campaigns || []).map((c) => {
    if (c.memberType === 'account' && (c.memberIds || []).includes(dupId)) { repointed++; return { ...c, memberIds: [...new Set(c.memberIds.map((id) => (id === dupId ? survivorId : id)))] }; }
    return c;
  });
  const merged = {
    ...survivor,
    revenueYTD: (survivor.revenueYTD || 0) + (dup.revenueYTD || 0),
    beds: Math.max(survivor.beds || 0, dup.beds || 0),
    comments: [...(survivor.comments || []), ...(dup.comments || [])],
    priceList: mergePriceList(survivor.priceList, dup.priceList),
    customValues: { ...(dup.customValues || {}), ...(survivor.customValues || {}) },
    phone: survivor.phone || dup.phone, email: survivor.email || dup.email, website: survivor.website || dup.website,
    street: survivor.street || dup.street, zip: survivor.zip || dup.zip, city: survivor.city || dup.city, vatId: survivor.vatId || dup.vatId,
    leadId: survivor.leadId || dup.leadId,
  };
  next.accounts = next.accounts.filter((a) => a.id !== dupId).map((a) => (a.id === survivorId ? merged : a));
  next.auditLog = [{ id: 'AL' + Date.now(), at: new Date().toISOString(), userId: s.meta.currentUserId, action: 'Firmen zusammengeführt', entity: survivor.name, detail: `„${dup.name}" (${dup.kundennummer}) in „${survivor.name}" zusammengeführt – ${repointed} Datensätze umgehängt.` }, ...(next.auditLog || [])];
  store.set(() => next);
  return repointed;
}

export function mergeContacts(survivorId, dupId) {
  const s = store.get();
  const survivor = s.contacts.find((c) => c.id === survivorId);
  const dup = s.contacts.find((c) => c.id === dupId);
  if (!survivor || !dup || survivorId === dupId) return 0;
  let repointed = 0;
  const next = { ...s };
  CONTACT_REFS.forEach(([coll, field]) => {
    next[coll] = (next[coll] || []).map((r) => { if (r[field] === dupId) { repointed++; return { ...r, [field]: survivorId }; } return r; });
  });
  next.events = (next.events || []).map((e) => {
    let changed = false;
    const atts = (e.attendees || []).map((at) => { if (at.refType === 'contact' && at.refId === dupId) { changed = true; repointed++; return { ...at, refId: survivorId }; } return at; });
    return changed ? { ...e, attendees: dedupeAttendees(atts) } : e;
  });
  next.campaigns = (next.campaigns || []).map((c) => {
    if (c.memberType === 'contact' && (c.memberIds || []).includes(dupId)) { repointed++; return { ...c, memberIds: [...new Set(c.memberIds.map((id) => (id === dupId ? survivorId : id)))] }; }
    return c;
  });
  const merged = {
    ...survivor,
    email: survivor.email || dup.email, phone: survivor.phone || dup.phone, title: survivor.title || dup.title,
    isPrimary: survivor.isPrimary || dup.isPrimary, comments: [...(survivor.comments || []), ...(dup.comments || [])],
    customValues: { ...(dup.customValues || {}), ...(survivor.customValues || {}) },
  };
  next.contacts = next.contacts.filter((c) => c.id !== dupId).map((c) => (c.id === survivorId ? merged : c));
  next.auditLog = [{ id: 'AL' + Date.now(), at: new Date().toISOString(), userId: s.meta.currentUserId, action: 'Ansprechpartner zusammengeführt', entity: survivor.name, detail: `„${dup.name}" in „${survivor.name}" zusammengeführt – ${repointed} Datensätze umgehängt.` }, ...(next.auditLog || [])];
  store.set(() => next);
  return repointed;
}
