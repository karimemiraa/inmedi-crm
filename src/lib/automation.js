// Echte Automatisierungs-Engine: WENN (Objekt + Ereignis + Bedingungen) DANN (Aktionen).
// Regeln liegen in db.automations als strukturierte Objekte.
import { store } from '../data/store.js';
import { fieldsFor } from '../components/CustomFields.jsx';
import { statusList } from './status.js';

// --- Objekte mit auswählbaren Feldern ---
export const OBJECTS = {
  Firma: { coll: 'accounts', fields: [
    { key: 'status', label: 'Status', type: 'enum', options: ['Aktiv', 'Gefährdet', 'Interessent'] },
    { key: 'type', label: 'Typ', type: 'enum', options: ['Krankenhaus', 'Praxis', 'Pflegeeinrichtung', 'Apotheke', 'Großhändler'] },
    { key: 'tier', label: 'Kategorie', type: 'enum', options: ['Schlüsselkunde', 'Strategisch', 'Standard', 'Interessent'] },
    { key: 'revenueYTD', label: 'Umsatz lfd. Jahr (€)', type: 'number' },
    { key: 'discount', label: 'Rabatt (%)', type: 'number' },
  ] },
  Deal: { coll: 'deals', fields: [
    { key: 'stage', label: 'Phase', type: 'enum', options: ['lead', 'proposal', 'negotiation', 'won', 'lost'], optionLabels: { lead: 'Qualifizierung', proposal: 'Angebot gesendet', negotiation: 'Verhandlung', won: 'Gewonnen', lost: 'Verloren' } },
    { key: 'value', label: 'Wert (€)', type: 'number' },
    { key: 'score', label: 'Score', type: 'number' },
  ] },
  Interessent: { coll: 'leads', fields: [
    { key: 'status', label: 'Status', type: 'enum', options: ['Neu', 'In Bearbeitung', 'Qualifiziert', 'Nicht qualifiziert'] },
    { key: 'score', label: 'Score', type: 'number' },
    { key: 'source', label: 'Quelle', type: 'enum', options: ['Website', 'Messe', 'Empfehlung', 'Kaltakquise', 'E-Mail-Kampagne', 'LinkedIn'] },
  ] },
  Rechnung: { coll: 'invoices', fields: [
    { key: 'status', label: 'Status', type: 'enum', options: ['Entwurf', 'Versendet', 'Teilbezahlt', 'Bezahlt', 'Überfällig'] },
    { key: 'total', label: 'Betrag (€)', type: 'number' },
  ] },
  Auftrag: { coll: 'orders', fields: [
    { key: 'kind', label: 'Art', type: 'enum', options: ['Angebot', 'Auftrag'] },
    { key: 'status', label: 'Status', type: 'enum', options: ['Entwurf', 'Angebot gesendet', 'Bestätigt', 'Versendet', 'Geliefert'] },
    { key: 'total', label: 'Betrag (€)', type: 'number' },
  ] },
  Vorkommnis: { coll: 'incidents', fields: [
    { key: 'severity', label: 'Schweregrad', type: 'enum', options: ['Niedrig', 'Mittel', 'Hoch', 'Schwerwiegend'] },
    { key: 'status', label: 'Status', type: 'enum', get options() { return statusList(store.get(), 'incidents').map((s) => s.name); } },
    { key: 'meldepflichtig', label: 'Meldepflichtig', type: 'bool' },
  ] },
};
export const COLL_TO_OBJECT = Object.fromEntries(Object.entries(OBJECTS).map(([o, c]) => [c.coll, o]));
export const EVENTS = [['create', 'erstellt wird'], ['update', 'geändert wird'], ['any', 'erstellt oder geändert wird']];

export const OPERATORS = [
  ['eq', 'ist'], ['ne', 'ist nicht'], ['gt', 'größer als'], ['lt', 'kleiner als'],
  ['gte', 'größer/gleich'], ['lte', 'kleiner/gleich'], ['contains', 'enthält'],
];

export const ACTIONS = {
  notify: { label: 'Benachrichtigen', params: [{ key: 'message', label: 'Nachricht', type: 'text', placeholder: 'z. B. Vertriebsleiter informieren' }] },
  task: { label: 'Aufgabe erstellen', params: [{ key: 'subject', label: 'Betreff', type: 'text', placeholder: 'z. B. Kunde kontaktieren' }, { key: 'priority', label: 'Priorität', type: 'enum', options: ['Hoch', 'Mittel', 'Niedrig'] }] },
  note: { label: 'Notiz hinzufügen', params: [{ key: 'text', label: 'Text', type: 'text' }] },
  setField: { label: 'Feld setzen', params: [{ key: 'field', label: 'Feld', type: 'objectField' }, { key: 'value', label: 'Wert', type: 'text' }] },
};

// --- Feldwerte lesen (inkl. Zusatzfelder) ---
const fieldVal = (rec, key) => (key && key.startsWith('cf:')) ? (rec.customValues || {})[key.slice(3)] : rec[key];

export function fieldsForObject(db, object) {
  const base = OBJECTS[object]?.fields || [];
  const custom = fieldsFor(db, object).map((f) => ({ key: 'cf:' + f.id, label: f.label + ' (Zusatzfeld)', type: f.type === 'Auswahl' ? 'enum' : f.type === 'Zahl' ? 'number' : f.type === 'Kontrollkästchen' ? 'bool' : 'text', options: f.options }));
  return [...base, ...custom];
}

function matchCond(c, rec) {
  const v = fieldVal(rec, c.field);
  const t = c.value;
  switch (c.op) {
    case 'eq': return String(v) === String(t) || (c.op === 'eq' && (v === true) && (t === 'true' || t === 'Ja'));
    case 'ne': return String(v) !== String(t);
    case 'gt': return Number(v) > Number(t);
    case 'lt': return Number(v) < Number(t);
    case 'gte': return Number(v) >= Number(t);
    case 'lte': return Number(v) <= Number(t);
    case 'contains': return String(v ?? '').toLowerCase().includes(String(t).toLowerCase());
    default: return false;
  }
}

export function ruleMatches(rule, object, event, rec) {
  if (!rule.active) return false;
  if (rule.trigger?.object !== object) return false;
  const ev = rule.trigger?.event || 'any';
  if (ev !== 'any' && ev !== event) return false;
  const conds = rule.conditions || [];
  if (conds.length === 0) return true;
  return (rule.match === 'any') ? conds.some((c) => matchCond(c, rec)) : conds.every((c) => matchCond(c, rec));
}

// Lesbare Zusammenfassung für die Liste
export function ruleSummary(rule) {
  const obj = rule.trigger?.object || '—';
  const ev = (EVENTS.find((e) => e[0] === (rule.trigger?.event || 'any')) || ['', ''])[1];
  const fieldLabel = (key) => {
    const f = (OBJECTS[obj]?.fields || []).find((x) => x.key === key);
    return f ? f.label : (key?.startsWith('cf:') ? 'Zusatzfeld' : key);
  };
  const opLabel = (op) => (OPERATORS.find((o) => o[0] === op) || ['', op])[1];
  const conds = (rule.conditions || []).map((c) => `${fieldLabel(c.field)} ${opLabel(c.op)} „${c.value}"`).join(rule.match === 'any' ? ' ODER ' : ' UND ');
  const acts = (rule.actions || []).map((a) => ACTIONS[a.type]?.label || a.type).join(', ');
  return { wenn: `${obj} ${ev}${conds ? ' und ' + conds : ''}`, dann: acts || '—' };
}

// --- Ausführung ---
let suppress = false;
let toaster = null;
export function setAutomationToaster(fn) { toaster = fn; }

function resolveAccountId(object, rec) {
  if (object === 'Konto') return rec.id;
  return rec.accountId || null;
}
function resolveOwnerId(object, rec, db) {
  if (rec.ownerId) return rec.ownerId;
  const accId = resolveAccountId(object, rec);
  const acc = accId && db.accounts.find((a) => a.id === accId);
  return acc?.ownerId || db.meta.currentUserId;
}

function runActions(rule, object, rec) {
  const db = store.get();
  const coll = OBJECTS[object].coll;
  const name = rec.name || rec.title || rec.number || rec.subject || rec.id;
  for (const a of (rule.actions || [])) {
    if (a.type === 'notify') {
      store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Automatisierung', entity: `${object} ${name}`, detail: `Regel „${rule.name}": ${a.params?.message || 'Benachrichtigung'}` });
      if (toaster) toaster(`Automatisierung: ${a.params?.message || rule.name}`);
    } else if (a.type === 'task') {
      store.add('activities', {
        type: 'task', subject: a.params?.subject || `Automatik: ${rule.name}`,
        accountId: resolveAccountId(object, rec), contactId: null,
        ownerId: resolveOwnerId(object, rec, db), dueDate: new Date().toISOString(),
        done: false, priority: a.params?.priority || 'Mittel', notes: `Automatisch erstellt durch Regel „${rule.name}"`,
      });
    } else if (a.type === 'note') {
      const cur = store.get()[coll].find((r) => r.id === rec.id);
      if (cur) {
        const note = { id: 'AN' + Date.now(), userId: null, author: 'Automatik', at: new Date().toISOString(), text: a.params?.text || `Regel „${rule.name}"`, editedAt: null };
        store.update(coll, rec.id, { comments: [...(cur.comments || []), note] }, { silent: true });
      }
    } else if (a.type === 'setField') {
      const key = a.params?.field; let val = a.params?.value;
      if (!key) continue;
      const fdef = (OBJECTS[object].fields || []).find((f) => f.key === key);
      if (fdef?.type === 'number') val = Number(val);
      if (key.startsWith('cf:')) {
        const cur = store.get()[coll].find((r) => r.id === rec.id);
        store.update(coll, rec.id, { customValues: { ...(cur?.customValues || {}), [key.slice(3)]: val } });
      } else {
        store.update(coll, rec.id, { [key]: val });
      }
    }
  }
}

function onMutation(coll, event, rec, prev) {
  if (suppress) return;
  const object = COLL_TO_OBJECT[coll];
  if (!object) return;
  // Regeln mit Bedingungen greifen bei Änderungen nur, wenn die Bedingung NEU erfüllt wird —
  // sonst würde z. B. jede Bearbeitung eines schwerwiegenden Vorkommnisses erneut eine Aufgabe anlegen.
  const fresh = (r) => !(event === 'update' && prev && (r.conditions || []).length && ruleMatches(r, object, event, prev));
  const rules = (store.get().automations || []).filter((r) => r.trigger && ruleMatches(r, object, event, rec) && fresh(r));
  if (rules.length === 0) return;
  suppress = true;
  try { for (const r of rules) runActions(r, object, store.get()[coll].find((x) => x.id === rec.id) || rec); }
  finally { suppress = false; }
}

let registered = false;
export function registerAutomations() {
  if (registered) return;
  registered = true;
  store.setMutationHandler(onMutation);
}
