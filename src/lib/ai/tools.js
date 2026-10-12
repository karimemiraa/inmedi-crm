// Datenwerkzeuge des KI-Assistenten. Die KI erhält NIE die ganze Datenbank,
// sondern ruft gezielt diese Funktionen auf; sie laufen lokal im Browser.
// Datenschutz: E-Mail-Adressen und Telefonnummern werden nie herausgegeben,
// Personennamen (Ansprechpartner/Interessenten) optional pseudonymisiert.
import { store } from '../../data/store.js';
import { isOpen } from '../status.js';
import { vorgangLink } from '../vorgang.js';
import { ACT_LABEL } from '../labels.js';

const DAY = 86400000;
// Freitext kann Kontaktdaten enthalten – E-Mail-Adressen und Telefonnummern werden entfernt.
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:\+|\b0)\d[\d \/-]{5,}\d/g;
export const scrub = (t) => (t ? String(t).replace(EMAIL, '[E-Mail entfernt]').replace(PHONE, '[Telefon entfernt]') : t);
const r0 = (n) => Math.round(Number(n) || 0);
const day = (iso) => (iso ? String(iso).slice(0, 10) : null);
const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);
const sumItems = (items = []) => items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);
const inRange = (iso, from, to) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return (!from || t >= new Date(from + 'T00:00:00').getTime()) && (!to || t <= new Date(to + 'T23:59:59').getTime());
};
const yearRange = (y) => [`${y}-01-01`, `${y}-12-31`];

// ---------- Datenschutz-Kontext (Pseudonyme bleiben je Gespräch stabil) ----------
export function createPrivacy(pseudonymize) {
  const map = new Map(); // echter Name → Platzhalter
  return {
    pseudonymize,
    person(name, prefix = 'Ansprechpartner') {
      if (!pseudonymize || !name) return name;
      if (!map.has(name)) map.set(name, `${prefix} ${map.size + 1}`);
      return map.get(name);
    },
    // Platzhalter in Antworten für die Anzeige zurückübersetzen (nur lokal)
    reveal(text) {
      if (!pseudonymize || !text) return text;
      let out = text;
      [...map.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([real, ph]) => { out = out.split(ph).join(real); });
      return out;
    },
  };
}

const userName = (db, id) => db.users.find((u) => u.id === id)?.name || null;
const acctName = (db, id) => db.accounts.find((a) => a.id === id)?.name || null;
const link = (kind, id) => '#' + vorgangLink(kind, id);
const ownerRef = (db, id) => (id ? { id, name: userName(db, id), link: '#/team/' + id } : null);
const isOrder = (o) => o.kind === 'Auftrag';
const openAmount = (i) => Math.max(0, (i.total || 0) - (i.paid || 0));

function findAccount(db, idOrName) {
  if (!idOrName) return null;
  const q = String(idOrName).toLowerCase().trim();
  return db.accounts.find((a) => a.id === idOrName)
    || db.accounts.find((a) => (a.kundennummer || '').toLowerCase() === q)
    || db.accounts.find((a) => a.name.toLowerCase() === q)
    || db.accounts.find((a) => a.name.toLowerCase().includes(q));
}
const notFound = (what) => ({ error: `${what} nicht gefunden. Nutze search_records, um die ID zu ermitteln.` });

function lastContact(db, accountId) {
  const dates = [
    ...db.activities.filter((a) => a.accountId === accountId && a.done).map((a) => a.dueDate),
    ...db.contacts.filter((c) => c.accountId === accountId).map((c) => c.lastContact),
    ...db.costEntries.filter((e) => e.accountId === accountId).map((e) => e.date),
  ].filter(Boolean).filter((d) => new Date(d) <= new Date());
  return dates.sort().at(-1) || null;
}
function revenueOf(db, accountId, from, to) {
  return db.orders.filter((o) => isOrder(o) && o.accountId === accountId && inRange(o.date, from, to)).reduce((s, o) => s + (o.total || 0), 0);
}

// ---------- Werkzeug-Definitionen (JSON-Schema, providerneutral) ----------
const S = (props, required = []) => ({ type: 'object', properties: props, required, additionalProperties: false });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const int = (description) => ({ type: 'integer', description });

export const TOOL_DEFS = [
  { name: 'search_records', description: 'Volltextsuche über Firmen, Ansprechpartner, Interessenten, Deals, Angebote/Aufträge, Rechnungen, Verträge, Produkte und Tickets. Liefert IDs und Links. Immer zuerst nutzen, wenn eine Firma/ein Datensatz nur mit Namen genannt wird.',
    schema: S({ query: str('Suchbegriff, z. B. Firmenname, Kundennummer, Auftragsnummer, Produkt'), limit: int('Max. Treffer (Standard 10)') }, ['query']) },
  { name: 'get_account_overview', description: 'Kompletter Überblick einer Firma: Stammdaten, Status, Kategorie, Gebiet, Betreuer, Ansprechpartner (Name/Rolle), Umsatz lfd. Jahr & Vorjahr, offene Pipeline, offene Posten, letzter Kontakt, offene Vorgänge, Zusatzfelder, letzte Kommentare.',
    schema: S({ account_id: str('ID, Kundennummer oder Name der Firma') }, ['account_id']) },
  { name: 'get_account_orders', description: 'Angebote, Aufträge und Rechnungen einer Firma mit Positionen (Produkt, Menge, Preis), Status, Datum und offenen Beträgen.',
    schema: S({ account_id: str('ID, Kundennummer oder Name der Firma'), since: str('Nur ab Datum JJJJ-MM-TT (optional)'), limit: int('Max. Belege (Standard 15)') }, ['account_id']) },
  { name: 'get_product_insights', description: 'Produktanalyse für eine Firma: was wurde wie oft/wie viel gekauft, letzter Kauf, typischer Bestellrhythmus, fällige Nachbestellungen, Daueraufträge, und Cross-Selling-Empfehlungen (Produkte, die vergleichbare Kunden kaufen, diese Firma aber nicht).',
    schema: S({ account_id: str('ID, Kundennummer oder Name der Firma') }, ['account_id']) },
  { name: 'get_account_timeline', description: 'Chronologie einer Firma: Aktivitäten/Termine, Kommentare, Tickets, QM-Vorkommnisse, Betreuungseinsätze und Änderungen – neueste zuerst.',
    schema: S({ account_id: str('ID, Kundennummer oder Name der Firma'), limit: int('Max. Einträge (Standard 25)') }, ['account_id']) },
  { name: 'get_revenue', description: 'Umsatzauswertung aus Aufträgen (Angebote zählen nicht), gruppiert nach Firma, Betreuer, Gebiet, Produkt, Monat oder Firmentyp, inkl. Vergleich zum Vorjahreszeitraum.',
    schema: S({ group_by: str('Gruppierung', { enum: ['account', 'owner', 'territory', 'product', 'month', 'type'] }), from: str('Von JJJJ-MM-TT (Standard: Jahresanfang)'), to: str('Bis JJJJ-MM-TT (Standard: heute)'), top: int('Nur die Top N (optional)') }, ['group_by']) },
  { name: 'get_care_costs', description: 'Betreuungskosten-Analyse: Betreuungsaufwand (Besuche, Demos, Telefonate, Fahrten) vs. Auftragsumsatz, Netto-Ergebnis, Kostenquote und defizitäre Kunden. Gruppiert nach Firma, Betreuer oder Gebiet; optional für eine Firma.',
    schema: S({ group_by: str('Gruppierung', { enum: ['account', 'rep', 'territory'] }), from: str('Von JJJJ-MM-TT (Standard: Jahresanfang)'), to: str('Bis JJJJ-MM-TT (Standard: heute)'), account_id: str('Nur diese Firma (optional)') }, ['group_by']) },
  { name: 'get_attention_list', description: 'Wo ist Aufmerksamkeit nötig? Gefährdete Kunden, Umsatzrückgang ggü. Vorjahr, überfällige Rechnungen, überfällige Aufgaben, festgefahrene Deals, Kunden ohne Kontakt seit X Tagen, offene meldepflichtige QM-Vorkommnisse, offene Tickets mit hoher Priorität, unwirtschaftliche Kunden.',
    schema: S({ owner_id: str('Nur Vorgänge/Kunden dieses Betreuers (User-ID, optional)'), days_without_contact: int('Schwelle für "kein Kontakt" in Tagen (Standard 60)') }) },
  { name: 'get_followups', description: 'Wer braucht ein Follow-up? Fällige/überfällige Aufgaben, Deals mit nahem oder überschrittenem Abschlussdatum, versendete Angebote ohne Rückmeldung, Tickets die auf Kunden warten, fällige Daueraufträge – je Betreuer.',
    schema: S({ owner_id: str('Nur dieser Betreuer (User-ID, optional)'), days_ahead: int('Zeithorizont in Tagen (Standard 14)') }) },
  { name: 'get_pipeline', description: 'Vertriebspipeline: offene Deals je Phase mit Wert, Score, Abschlussdatum und Betreuer; gewonnene/verlorene Deals; Gewinnquote.',
    schema: S({ owner_id: str('Nur dieser Betreuer (optional)') }) },
  { name: 'list_accounts', description: 'Firmenliste mit Filtern und Sortierung (Umsatz, Name, letzter Kontakt, offene Posten).',
    schema: S({ status: str('Aktiv, Gefährdet, Interessent oder Inaktiv (optional)'), type: str('Firmentyp, z. B. Krankenhaus, Praxis (optional)'), territory: str('Gebietsname (optional)'), owner_id: str('Außendienst-User-ID (optional)'), sort_by: str('Sortierung', { enum: ['revenue', 'name', 'last_contact', 'open_items'] }), limit: int('Max. Firmen (Standard 20)') }) },
  { name: 'get_team', description: 'Team und Vertriebsleistung: Mitarbeiter mit Rolle, Gebiet, Ziel (Quote), Auftragsumsatz lfd. Jahr, Zielerreichung, offene Pipeline, Anzahl betreuter Firmen, offene Aufgaben.',
    schema: S({}) },
  { name: 'get_kpis', description: 'Gesamtkennzahlen: Auftragsumsatz, Angebotsvolumen, offene Pipeline, Gewinnquote, offene Posten, Anzahl Kunden/Interessenten, offene Tickets/Vorkommnisse, Betreuungskosten – optional für einen Zeitraum.',
    schema: S({ from: str('Von JJJJ-MM-TT (Standard: Jahresanfang)'), to: str('Bis JJJJ-MM-TT (Standard: heute)') }) },
  { name: 'propose_task', description: 'SCHLÄGT eine Aufgabe/Folgeaufgabe vor. Wird NICHT sofort angelegt – der Benutzer muss im Chat auf „Ausführen“ klicken. Nur nutzen, wenn eine konkrete Folgeaktion sinnvoll ist.',
    schema: S({ subject: str('Betreff der Aufgabe'), account_id: str('Firma (ID, optional)'), due_date: str('Fällig am JJJJ-MM-TT'), owner_id: str('Verantwortlicher (User-ID, optional – Standard: Betreuer der Firma)'), priority: str('Priorität', { enum: ['Hoch', 'Mittel', 'Niedrig'] }), notes: str('Beschreibung (optional)') }, ['subject', 'due_date']) },
  { name: 'propose_comment', description: 'SCHLÄGT vor, einen Kommentar (z. B. Gesprächsvorbereitung, Zusammenfassung) an einer Firma zu speichern. Wird erst nach Klick auf „Ausführen“ gespeichert.',
    schema: S({ account_id: str('Firma (ID)'), text: str('Kommentartext') }, ['account_id', 'text']) },
];

export const ACTION_TOOLS = new Set(['propose_task', 'propose_comment']);

// ---------- Ausführung ----------
export function runTool(name, input, ctx) {
  const db = store.get();
  const fn = IMPL[name];
  if (!fn) return { error: `Unbekanntes Werkzeug: ${name}` };
  try { return fn(db, input || {}, ctx); } catch (e) { return { error: 'Fehler bei der Auswertung: ' + (e?.message || e) }; }
}

const IMPL = {
  search_records(db, { query, limit = 10 }, ctx) {
    const q = String(query || '').toLowerCase().trim();
    if (!q) return { results: [] };
    const has = (...vals) => vals.some((v) => v && String(v).toLowerCase().includes(q));
    const out = [];
    db.accounts.filter((a) => has(a.name, a.kundennummer, a.city)).forEach((a) => out.push({ kind: 'Firma', id: a.id, name: a.name, info: `${a.kundennummer || ''} · ${a.type} · ${a.city} · ${a.status}`, link: link('accounts', a.id) }));
    db.contacts.filter((c) => has(c.name, c.title)).forEach((c) => out.push({ kind: 'Ansprechpartner', id: c.id, name: ctx.privacy.person(c.name), info: `${c.title || ''} · ${acctName(db, c.accountId) || ''}`, account_id: c.accountId, link: link('contacts', c.id) }));
    db.leads.filter((l) => has(l.name, l.company)).forEach((l) => out.push({ kind: 'Interessent', id: l.id, name: ctx.privacy.person(l.name, 'Interessent'), info: `${l.company} · ${l.status}`, link: '#/leads/' + l.id }));
    db.deals.filter((d) => has(d.name)).forEach((d) => out.push({ kind: 'Deal', id: d.id, name: d.name, info: `${acctName(db, d.accountId)} · ${r0(d.value)} €`, link: link('deals', d.id) }));
    db.orders.filter((o) => has(o.number)).forEach((o) => out.push({ kind: o.kind, id: o.id, name: o.number, info: `${acctName(db, o.accountId)} · ${r0(o.total)} € · ${o.status}`, link: link('orders', o.id) }));
    db.invoices.filter((i) => has(i.number)).forEach((i) => out.push({ kind: 'Rechnung', id: i.id, name: i.number, info: `${acctName(db, i.accountId)} · ${r0(i.total)} € · ${i.status}`, link: link('invoices', i.id) }));
    db.contracts.filter((c) => has(c.title, c.number)).forEach((c) => out.push({ kind: 'Vertrag', id: c.id, name: c.title, info: `${acctName(db, c.accountId)} · ${c.status}`, link: link('contracts', c.id) }));
    db.products.filter((p) => has(p.name, p.sku, p.category)).forEach((p) => out.push({ kind: 'Produkt', id: p.id, name: p.name, info: `${p.sku} · ${p.category} · ${r0(p.price)} €`, link: link('products', p.id) }));
    db.tickets.filter((t) => has(t.subject, t.number)).forEach((t) => out.push({ kind: 'Ticket', id: t.id, name: t.subject, info: `${t.number} · ${acctName(db, t.accountId)} · ${t.status}`, link: link('tickets', t.id) }));
    return { count: out.length, results: out.slice(0, limit) };
  },

  get_account_overview(db, { account_id }, ctx) {
    const a = findAccount(db, account_id);
    if (!a) return notFound('Firma');
    const y = new Date().getFullYear();
    const [f, t] = yearRange(y);
    const [pf, pt] = yearRange(y - 1);
    const sameDayLastYear = `${y - 1}-${new Date().toISOString().slice(5, 10)}`;
    const deals = db.deals.filter((d) => d.accountId === a.id);
    const invoices = db.invoices.filter((i) => i.accountId === a.id);
    const lc = lastContact(db, a.id);
    const cf = (db.customFields || []).filter((x) => x.entity === 'Firma' && x.active && a.customValues?.[x.id] != null && a.customValues?.[x.id] !== '');
    return {
      id: a.id, link: link('accounts', a.id), name: a.name, kundennummer: a.kundennummer, typ: a.type, kategorie: a.tier, status: a.status,
      ort: `${a.zip} ${a.city}`, betten: a.beds || undefined,
      gebiet: db.territories.find((x) => x.id === a.territoryId)?.name || null,
      aussendienst: ownerRef(db, a.ownerId), innendienst: ownerRef(db, a.innendienstId),
      kunde_seit: day(a.createdAt), zahlungsziel: a.paymentTerms, standardrabatt_prozent: a.discount || 0,
      umsatz: {
        laufendes_jahr: r0(revenueOf(db, a.id, f, t)),
        vorjahr_gesamt: r0(revenueOf(db, a.id, pf, pt)),
        vorjahr_bis_heute: r0(revenueOf(db, a.id, pf, sameDayLastYear)),
        umsatz_feld_crm: r0(a.revenueYTD),
      },
      offene_pipeline: r0(deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0)),
      offene_posten: r0(invoices.reduce((s, i) => s + openAmount(i), 0)),
      ueberfaellige_rechnungen: invoices.filter((i) => i.status === 'Überfällig').map((i) => ({ nummer: i.number, offen: r0(openAmount(i)), link: link('invoices', i.id) })),
      letzter_kontakt: day(lc), tage_seit_kontakt: daysSince(lc),
      ansprechpartner: db.contacts.filter((c) => c.accountId === a.id).map((c) => ({ id: c.id, name: ctx.privacy.person(c.name), rolle: c.title, haupt: !!c.isPrimary, letzter_kontakt: day(c.lastContact), link: link('contacts', c.id) })),
      offene_deals: deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').map((d) => ({ name: d.name, phase: db.stages.find((s) => s.id === d.stage)?.name, wert: r0(d.value), abschluss: day(d.expectedClose), link: link('deals', d.id) })),
      offene_angebote: db.orders.filter((o) => o.accountId === a.id && o.kind === 'Angebot' && !['Abgelehnt'].includes(o.status)).map((o) => ({ nummer: o.number, wert: r0(o.total), status: o.status, datum: day(o.date), link: link('orders', o.id) })),
      offene_aufgaben: db.activities.filter((x) => x.accountId === a.id && !x.done).map((x) => ({ betreff: x.subject, art: ACT_LABEL[x.type] || x.type, faellig: day(x.dueDate), verantwortlich: userName(db, x.ownerId), link: link('activities', x.id) })),
      offene_tickets: db.tickets.filter((x) => x.accountId === a.id && isOpen(db, 'tickets', x.status)).map((x) => ({ betreff: x.subject, status: x.status, prioritaet: x.priority, link: link('tickets', x.id) })),
      offene_qm_vorkommnisse: db.incidents.filter((x) => x.accountId === a.id && isOpen(db, 'incidents', x.status)).map((x) => ({ titel: x.title, schweregrad: x.severity, meldepflichtig: !!x.meldepflichtig, link: link('incidents', x.id) })),
      vertraege: db.contracts.filter((c) => c.accountId === a.id).map((c) => ({ titel: c.title, status: c.status, beginn: day(c.startDate), laufzeit_monate: c.termMonths, link: link('contracts', c.id) })),
      zusatzfelder: Object.fromEntries(cf.map((x) => [x.label, a.customValues[x.id]])),
      letzte_kommentare: (a.comments || []).slice(-5).map((c) => ({ datum: day(c.at), von: userName(db, c.userId) || c.author || '—', text: scrub(c.text) })),
    };
  },

  get_account_orders(db, { account_id, since, limit = 15 }) {
    const a = findAccount(db, account_id);
    if (!a) return notFound('Firma');
    const docs = db.orders.filter((o) => o.accountId === a.id && (!since || inRange(o.date, since, null)))
      .sort((x, y) => new Date(y.date) - new Date(x.date)).slice(0, limit)
      .map((o) => ({
        art: o.kind, nummer: o.number, datum: day(o.date), status: o.status, summe: r0(o.total), link: link('orders', o.id),
        positionen: (o.items || []).map((it) => ({ produkt: it.name, menge: it.qty, preis: it.price, summe: r0(it.qty * it.price) })),
        rechnungen: db.invoices.filter((i) => i.orderId === o.id).map((i) => ({ nummer: i.number, status: i.status, offen: r0(openAmount(i)) })),
      }));
    const inv = db.invoices.filter((i) => i.accountId === a.id).sort((x, y) => new Date(y.issueDate) - new Date(x.issueDate)).slice(0, limit)
      .map((i) => ({ nummer: i.number, datum: day(i.issueDate), faellig: day(i.dueDate), status: i.status, summe: r0(i.total), offen: r0(openAmount(i)), link: link('invoices', i.id) }));
    return { firma: a.name, link: link('accounts', a.id), angebote_und_auftraege: docs, rechnungen: inv };
  },

  get_product_insights(db, { account_id }) {
    const a = findAccount(db, account_id);
    if (!a) return notFound('Firma');
    const orders = db.orders.filter((o) => isOrder(o) && o.accountId === a.id).sort((x, y) => new Date(x.date) - new Date(y.date));
    const per = new Map();
    orders.forEach((o) => (o.items || []).forEach((it) => {
      if (!per.has(it.productId)) per.set(it.productId, { produkt: it.name, product_id: it.productId, menge: 0, umsatz: 0, bestellungen: 0, dates: [] });
      const p = per.get(it.productId);
      p.menge += it.qty; p.umsatz += it.qty * it.price; p.bestellungen += 1; p.dates.push(o.date);
    }));
    const today = Date.now();
    const bought = [...per.values()].map((p) => {
      const ds = p.dates.map((d) => new Date(d).getTime()).sort();
      const gaps = ds.slice(1).map((d, i) => (d - ds[i]) / DAY);
      const rhythm = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
      const last = ds.at(-1);
      const prod = db.products.find((x) => x.id === p.product_id);
      return {
        produkt: p.produkt, kategorie: prod?.category, menge_gesamt: p.menge, umsatz: r0(p.umsatz), bestellungen: p.bestellungen,
        letzter_kauf: day(new Date(last).toISOString()), tage_seit_kauf: Math.floor((today - last) / DAY),
        bestellrhythmus_tage: rhythm, nachbestellung_faellig: rhythm ? today - last > rhythm * DAY : null,
        aktueller_listenpreis: prod?.price, link: prod ? link('products', prod.id) : undefined,
      };
    }).sort((x, y) => y.umsatz - x.umsatz);
    // Cross-Selling: Produkte, die Firmen gleichen Typs kaufen, diese Firma aber nicht
    const peers = db.accounts.filter((x) => x.id !== a.id && x.type === a.type).map((x) => x.id);
    const peerCount = new Map();
    db.orders.filter((o) => isOrder(o) && peers.includes(o.accountId)).forEach((o) => (o.items || []).forEach((it) => {
      if (per.has(it.productId)) return;
      if (!peerCount.has(it.productId)) peerCount.set(it.productId, new Set());
      peerCount.get(it.productId).add(o.accountId);
    }));
    const empfehlungen = [...peerCount.entries()].map(([pid, set]) => {
      const p = db.products.find((x) => x.id === pid);
      return p && { produkt: p.name, kategorie: p.category, preis: p.price, gekauft_von_vergleichbaren_kunden: set.size, vergleichsgruppe: `${peers.length} weitere ${a.type}-Kunden`, link: link('products', p.id) };
    }).filter(Boolean).sort((x, y) => y.gekauft_von_vergleichbaren_kunden - x.gekauft_von_vergleichbaren_kunden).slice(0, 5);
    const deals = db.deals.filter((d) => d.accountId === a.id && d.stage !== 'won' && d.stage !== 'lost');
    return {
      firma: a.name, typ: a.type, link: link('accounts', a.id),
      gekaufte_produkte: bought,
      dauerauftraege: db.recurringOrders.filter((r) => r.accountId === a.id).map((r) => ({ intervall: r.interval, aktiv: r.active, naechste_faelligkeit: day(r.nextDue), wert_je_lauf: r0(sumItems(r.items)), positionen: r.items.map((it) => `${it.qty}× ${it.name}`), link: link('recurringOrders', r.id) })),
      produkte_in_offenen_deals: deals.flatMap((d) => (d.products || []).map((pid) => ({ produkt: db.products.find((p) => p.id === pid)?.name, deal: d.name }))),
      cross_selling_empfehlungen: empfehlungen,
    };
  },

  get_account_timeline(db, { account_id, limit = 25 }, ctx) {
    const a = findAccount(db, account_id);
    if (!a) return notFound('Firma');
    const ev = [];
    db.activities.filter((x) => x.accountId === a.id).forEach((x) => ev.push({ datum: day(x.dueDate), typ: ACT_LABEL[x.type] || 'Aufgabe', text: x.subject, status: x.status, von: userName(db, x.ownerId), link: link('activities', x.id) }));
    (a.comments || []).forEach((c) => ev.push({ datum: day(c.at), typ: 'Kommentar', text: scrub(c.text), von: userName(db, c.userId) || c.author }));
    (a.history || []).forEach((h) => ev.push({ datum: day(h.at), typ: 'Änderung', text: h.text, von: userName(db, h.userId) }));
    db.tickets.filter((x) => x.accountId === a.id).forEach((x) => ev.push({ datum: day(x.createdAt), typ: 'Ticket', text: `${x.subject} (${x.category})`, status: x.status, link: link('tickets', x.id) }));
    db.incidents.filter((x) => x.accountId === a.id).forEach((x) => ev.push({ datum: day(x.reportedAt), typ: 'QM-Vorkommnis', text: x.title, status: x.status, link: link('incidents', x.id) }));
    db.costEntries.filter((x) => x.accountId === a.id).forEach((x) => ev.push({ datum: day(x.date), typ: 'Betreuung: ' + x.type, text: scrub(x.note), kosten: r0(x.cost), von: userName(db, x.userId) }));
    db.orders.filter((x) => x.accountId === a.id).forEach((x) => ev.push({ datum: day(x.date), typ: x.kind, text: `${x.number} · ${r0(x.total)} €`, status: x.status, link: link('orders', x.id) }));
    db.contacts.filter((c) => c.accountId === a.id).forEach((c) => (c.comments || []).forEach((k) => ev.push({ datum: day(k.at), typ: 'Kommentar zu ' + ctx.privacy.person(c.name), text: scrub(k.text) })));
    ev.sort((x, y) => String(y.datum).localeCompare(String(x.datum)));
    return { firma: a.name, link: link('accounts', a.id), eintraege: ev.slice(0, limit), gesamt: ev.length };
  },

  get_revenue(db, { group_by = 'account', from, to, top }) {
    const y = new Date().getFullYear();
    from = from || `${y}-01-01`; to = to || new Date().toISOString().slice(0, 10);
    const shift = (d) => { const x = new Date(d); x.setFullYear(x.getFullYear() - 1); return x.toISOString().slice(0, 10); };
    const keyLabel = (o, it) => {
      const a = db.accounts.find((x) => x.id === o.accountId);
      switch (group_by) {
        case 'owner': return [o.ownerId, userName(db, o.ownerId) || '—', '#/team/' + o.ownerId];
        case 'territory': { const t = db.territories.find((x) => x.id === a?.territoryId); return [t?.id || '—', t?.name || '—']; }
        case 'product': return [it.productId, it.name, db.products.some((p) => p.id === it.productId) ? link('products', it.productId) : undefined];
        case 'month': return [day(o.date).slice(0, 7), day(o.date).slice(0, 7)];
        case 'type': return [a?.type || '—', a?.type || '—'];
        default: return [o.accountId, a?.name || '—', a ? link('accounts', a.id) : undefined];
      }
    };
    const agg = (f, t) => {
      const m = new Map();
      db.orders.filter((o) => isOrder(o) && inRange(o.date, f, t)).forEach((o) => {
        const parts = group_by === 'product' ? (o.items || []).map((it) => [it, it.qty * it.price]) : [[null, o.total || 0]];
        parts.forEach(([it, val]) => {
          const [k, label, l] = keyLabel(o, it);
          if (!m.has(k)) m.set(k, { gruppe: label, umsatz: 0, auftraege: 0, link: l });
          const e = m.get(k); e.umsatz += val; e.auftraege += 1;
        });
      });
      return m;
    };
    const cur = agg(from, to);
    const prev = agg(shift(from), shift(to));
    let rows = [...cur.entries()].map(([k, v]) => ({ ...v, umsatz: r0(v.umsatz), vorjahreszeitraum: r0(prev.get(k)?.umsatz || 0) }))
      .map((r) => ({ ...r, veraenderung_prozent: r.vorjahreszeitraum ? Math.round(((r.umsatz - r.vorjahreszeitraum) / r.vorjahreszeitraum) * 100) : null }));
    rows = group_by === 'month' ? rows.sort((x, y) => x.gruppe.localeCompare(y.gruppe)) : rows.sort((x, y) => y.umsatz - x.umsatz);
    const total = rows.reduce((s, r) => s + r.umsatz, 0);
    const totalPrev = [...prev.values()].reduce((s, r) => s + r.umsatz, 0);
    return { zeitraum: { von: from, bis: to }, basis: 'Aufträge (ohne Angebote), Netto-Positionssummen', gesamt: r0(total), gesamt_vorjahreszeitraum: r0(totalPrev), zeilen: top ? rows.slice(0, top) : rows };
  },

  get_care_costs(db, { group_by = 'account', from, to, account_id }) {
    const y = new Date().getFullYear();
    from = from || `${y}-01-01`; to = to || new Date().toISOString().slice(0, 10);
    const only = account_id ? findAccount(db, account_id) : null;
    if (account_id && !only) return notFound('Firma');
    const acc = (id) => db.accounts.find((a) => a.id === id);
    const keyOf = (accountId, userId) => (group_by === 'rep' ? userId : group_by === 'territory' ? acc(accountId)?.territoryId || '—' : accountId);
    const m = new Map();
    const bump = (k, f, v) => { if (!m.has(k)) m.set(k, { kosten: 0, umsatz: 0, einsaetze: 0, minuten: 0, km: 0, arten: {} }); m.get(k)[f] += v; };
    db.costEntries.filter((e) => inRange(e.date, from, to) && (!only || e.accountId === only.id)).forEach((e) => {
      const k = keyOf(e.accountId, e.userId);
      bump(k, 'kosten', e.cost || 0); bump(k, 'einsaetze', 1); bump(k, 'minuten', e.durationMin || 0); bump(k, 'km', e.distanceKm || 0);
      m.get(k).arten[e.type] = (m.get(k).arten[e.type] || 0) + 1;
    });
    db.orders.filter((o) => isOrder(o) && inRange(o.date, from, to) && (!only || o.accountId === only.id)).forEach((o) => bump(keyOf(o.accountId, o.ownerId), 'umsatz', o.total || 0));
    const label = (k) => (group_by === 'rep' ? userName(db, k) : group_by === 'territory' ? db.territories.find((t) => t.id === k)?.name : acc(k)?.name) || '—';
    const rows = [...m.entries()].map(([k, v]) => ({
      gruppe: label(k), link: group_by === 'account' && acc(k) ? link('accounts', k) : group_by === 'rep' ? '#/team/' + k : undefined,
      betreuungskosten: r0(v.kosten), auftragsumsatz: r0(v.umsatz), netto: r0(v.umsatz - v.kosten),
      kostenquote_prozent: v.umsatz > 0 ? Math.round((v.kosten / v.umsatz) * 1000) / 10 : null,
      defizitaer: v.kosten > v.umsatz, einsaetze: v.einsaetze, stunden: Math.round((v.minuten / 60) * 10) / 10, km: r0(v.km), einsatzarten: v.arten,
    })).sort((x, y) => y.betreuungskosten - x.betreuungskosten);
    const tk = rows.reduce((s, r) => s + r.betreuungskosten, 0);
    const tu = rows.reduce((s, r) => s + r.auftragsumsatz, 0);
    return { zeitraum: { von: from, bis: to }, gesamt: { betreuungskosten: r0(tk), auftragsumsatz: r0(tu), netto: r0(tu - tk), kostenquote_prozent: tu ? Math.round((tk / tu) * 1000) / 10 : null }, defizitaere: rows.filter((r) => r.defizitaer).map((r) => r.gruppe), zeilen: rows };
  },

  get_attention_list(db, { owner_id, days_without_contact = 60 }) {
    const y = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);
    const lyToday = `${y - 1}-${today.slice(5)}`;
    const mine = (a) => !owner_id || a.ownerId === owner_id || a.innendienstId === owner_id;
    const accounts = db.accounts.filter((a) => a.status !== 'Inaktiv' && mine(a));
    const careLoss = IMPL.get_care_costs(db, { group_by: 'account' }).zeilen.filter((r) => r.defizitaer);
    return {
      gefaehrdete_kunden: accounts.filter((a) => a.status === 'Gefährdet').map((a) => ({ firma: a.name, betreuer: userName(db, a.ownerId), link: link('accounts', a.id) })),
      umsatzrueckgang_ggue_vorjahr: accounts.map((a) => ({ a, cur: revenueOf(db, a.id, `${y}-01-01`, today), prev: revenueOf(db, a.id, `${y - 1}-01-01`, lyToday) }))
        .filter((x) => x.prev > 0 && x.cur < x.prev * 0.8)
        .map((x) => ({ firma: x.a.name, umsatz_lfd: r0(x.cur), vorjahr_gleicher_zeitraum: r0(x.prev), veraenderung_prozent: Math.round(((x.cur - x.prev) / x.prev) * 100), link: link('accounts', x.a.id) })),
      ueberfaellige_rechnungen: db.invoices.filter((i) => (i.status === 'Überfällig' || (openAmount(i) > 0 && i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'Storniert')) && mine(db.accounts.find((a) => a.id === i.accountId) || {}))
        .map((i) => ({ rechnung: i.number, firma: acctName(db, i.accountId), offen: r0(openAmount(i)), faellig_seit: day(i.dueDate), link: link('invoices', i.id) })),
      ueberfaellige_aufgaben: db.activities.filter((a) => !a.done && new Date(a.dueDate) < new Date() && (!owner_id || a.ownerId === owner_id))
        .map((a) => ({ betreff: a.subject, firma: acctName(db, a.accountId), faellig: day(a.dueDate), verantwortlich: userName(db, a.ownerId), link: link('activities', a.id) })),
      festgefahrene_deals: db.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost' && (!owner_id || d.ownerId === owner_id) && (new Date(d.expectedClose) < new Date() || (d.score ?? 100) < 40))
        .map((d) => ({ deal: d.name, firma: acctName(db, d.accountId), wert: r0(d.value), abschluss: day(d.expectedClose), score: d.score, grund: new Date(d.expectedClose) < new Date() ? 'Abschlussdatum überschritten' : 'niedriger Score', link: link('deals', d.id) })),
      kein_kontakt_seit: accounts.map((a) => ({ a, lc: lastContact(db, a.id) })).filter((x) => !x.lc || daysSince(x.lc) > days_without_contact)
        .map((x) => ({ firma: x.a.name, letzter_kontakt: day(x.lc), tage: daysSince(x.lc), betreuer: userName(db, x.a.ownerId), link: link('accounts', x.a.id) })),
      meldepflichtige_qm_vorkommnisse: db.incidents.filter((i) => i.meldepflichtig && isOpen(db, 'incidents', i.status))
        .map((i) => ({ nummer: i.number, titel: i.title, firma: acctName(db, i.accountId), gemeldet: day(i.reportedAt), meldefrist: day(new Date(new Date(i.reportedAt).getTime() + 15 * DAY).toISOString()), link: link('incidents', i.id) })),
      tickets_hohe_prioritaet: db.tickets.filter((t) => t.priority === 'Hoch' && isOpen(db, 'tickets', t.status) && (!owner_id || t.ownerId === owner_id))
        .map((t) => ({ ticket: t.subject, firma: acctName(db, t.accountId), status: t.status, link: link('tickets', t.id) })),
      unwirtschaftliche_kunden_lfd_jahr: careLoss.map((r) => ({ firma: r.gruppe, betreuungskosten: r.betreuungskosten, umsatz: r.auftragsumsatz, link: r.link })),
    };
  },

  get_followups(db, { owner_id, days_ahead = 14 }) {
    const horizon = Date.now() + days_ahead * DAY;
    const byOwner = (id) => !owner_id || id === owner_id;
    const items = [];
    db.activities.filter((a) => !a.done && byOwner(a.ownerId) && new Date(a.dueDate).getTime() <= horizon)
      .forEach((a) => items.push({ typ: 'Aufgabe', was: a.subject, firma: acctName(db, a.accountId), faellig: day(a.dueDate), ueberfaellig: new Date(a.dueDate) < new Date(), betreuer: userName(db, a.ownerId), link: link('activities', a.id) }));
    db.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost' && byOwner(d.ownerId) && new Date(d.expectedClose).getTime() <= horizon)
      .forEach((d) => items.push({ typ: 'Deal-Abschluss', was: d.name, firma: acctName(db, d.accountId), faellig: day(d.expectedClose), ueberfaellig: new Date(d.expectedClose) < new Date(), wert: r0(d.value), betreuer: userName(db, d.ownerId), link: link('deals', d.id) }));
    db.orders.filter((o) => o.kind === 'Angebot' && o.status === 'Angebot gesendet' && byOwner(o.ownerId) && daysSince(o.date) > 14)
      .forEach((o) => items.push({ typ: 'Angebot ohne Rückmeldung', was: `${o.number} (${r0(o.total)} €)`, firma: acctName(db, o.accountId), gesendet_vor_tagen: daysSince(o.date), betreuer: userName(db, o.ownerId), link: link('orders', o.id) }));
    db.tickets.filter((t) => /wartet/i.test(t.status) && byOwner(t.ownerId))
      .forEach((t) => items.push({ typ: 'Ticket wartet auf Kunden', was: t.subject, firma: acctName(db, t.accountId), seit_tagen: daysSince(t.createdAt), betreuer: userName(db, t.ownerId), link: link('tickets', t.id) }));
    db.recurringOrders.filter((r) => r.active && byOwner(r.ownerId) && new Date(r.nextDue).getTime() <= horizon)
      .forEach((r) => items.push({ typ: 'Dauerauftrag fällig', was: `${r.interval}, ${r0(sumItems(r.items))} €`, firma: acctName(db, r.accountId), faellig: day(r.nextDue), betreuer: userName(db, r.ownerId), link: link('recurringOrders', r.id) }));
    db.leads.filter((l) => l.status === 'Neu' && byOwner(l.ownerId) && daysSince(l.createdAt) > 7)
      .forEach((l) => items.push({ typ: 'Interessent unbearbeitet', was: l.company, seit_tagen: daysSince(l.createdAt), betreuer: userName(db, l.ownerId), link: '#/leads/' + l.id }));
    items.sort((x, y) => String(x.faellig || '').localeCompare(String(y.faellig || '')));
    const proBetreuer = {};
    items.forEach((i) => { const k = i.betreuer || '—'; proBetreuer[k] = (proBetreuer[k] || 0) + 1; });
    return { horizont_tage: days_ahead, anzahl: items.length, pro_betreuer: proBetreuer, follow_ups: items };
  },

  get_pipeline(db, { owner_id }) {
    const deals = db.deals.filter((d) => !owner_id || d.ownerId === owner_id);
    const won = deals.filter((d) => d.stage === 'won');
    const lost = deals.filter((d) => d.stage === 'lost');
    return {
      phasen: db.stages.filter((s) => s.id !== 'won' && s.id !== 'lost').map((s) => {
        const ds = deals.filter((d) => d.stage === s.id);
        return { phase: s.name, anzahl: ds.length, wert: r0(ds.reduce((x, d) => x + d.value, 0)), deals: ds.map((d) => ({ name: d.name, firma: acctName(db, d.accountId), wert: r0(d.value), score: d.score, abschluss: day(d.expectedClose), betreuer: userName(db, d.ownerId), link: link('deals', d.id) })) };
      }),
      gewonnen: { anzahl: won.length, wert: r0(won.reduce((x, d) => x + d.value, 0)) },
      verloren: { anzahl: lost.length, wert: r0(lost.reduce((x, d) => x + d.value, 0)) },
      gewinnquote_prozent: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : null,
    };
  },

  list_accounts(db, { status, type, territory, owner_id, sort_by = 'revenue', limit = 20 }) {
    const y = new Date().getFullYear();
    let rows = db.accounts.filter((a) => (!status || a.status === status) && (!type || a.type === type) && (!owner_id || a.ownerId === owner_id)
      && (!territory || (db.territories.find((t) => t.id === a.territoryId)?.name || '').toLowerCase() === String(territory).toLowerCase()))
      .map((a) => {
        const lc = lastContact(db, a.id);
        return { id: a.id, firma: a.name, typ: a.type, kategorie: a.tier, status: a.status, gebiet: db.territories.find((t) => t.id === a.territoryId)?.name, betreuer: userName(db, a.ownerId),
          umsatz_lfd_jahr: r0(revenueOf(db, a.id, `${y}-01-01`, `${y}-12-31`)), offene_posten: r0(db.invoices.filter((i) => i.accountId === a.id).reduce((s, i) => s + openAmount(i), 0)),
          letzter_kontakt: day(lc), link: link('accounts', a.id) };
      });
    const sorters = { revenue: (x, y2) => y2.umsatz_lfd_jahr - x.umsatz_lfd_jahr, name: (x, y2) => x.firma.localeCompare(y2.firma), last_contact: (x, y2) => String(x.letzter_kontakt || '').localeCompare(String(y2.letzter_kontakt || '')), open_items: (x, y2) => y2.offene_posten - x.offene_posten };
    rows.sort(sorters[sort_by] || sorters.revenue);
    return { anzahl: rows.length, firmen: rows.slice(0, limit) };
  },

  get_team(db) {
    const y = new Date().getFullYear();
    return {
      team: db.users.map((u) => {
        const rev = db.orders.filter((o) => isOrder(o) && o.ownerId === u.id && new Date(o.date).getFullYear() === y).reduce((s, o) => s + (o.total || 0), 0);
        return { id: u.id, name: u.name, rolle: u.role, titel: u.title, gebiet: db.territories.find((t) => t.id === u.territoryId)?.name || null, link: '#/team/' + u.id,
          ziel: u.quota || null, auftragsumsatz_lfd_jahr: r0(rev), zielerreichung_prozent: u.quota ? Math.round((rev / u.quota) * 100) : null,
          offene_pipeline: r0(db.deals.filter((d) => d.ownerId === u.id && d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0)),
          betreute_firmen: db.accounts.filter((a) => a.ownerId === u.id || a.innendienstId === u.id).length,
          offene_aufgaben: db.activities.filter((a) => a.ownerId === u.id && !a.done).length };
      }),
    };
  },

  get_kpis(db, { from, to }) {
    const y = new Date().getFullYear();
    from = from || `${y}-01-01`; to = to || new Date().toISOString().slice(0, 10);
    const orders = db.orders.filter((o) => inRange(o.date, from, to));
    const won = db.deals.filter((d) => d.stage === 'won').length;
    const lost = db.deals.filter((d) => d.stage === 'lost').length;
    return {
      zeitraum: { von: from, bis: to },
      auftragsumsatz: r0(orders.filter(isOrder).reduce((s, o) => s + o.total, 0)),
      angebotsvolumen: r0(orders.filter((o) => o.kind === 'Angebot').reduce((s, o) => s + o.total, 0)),
      offene_pipeline: r0(db.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0)),
      gewinnquote_prozent: won + lost ? Math.round((won / (won + lost)) * 100) : null,
      offene_posten: r0(db.invoices.reduce((s, i) => s + openAmount(i), 0)),
      ueberfaellige_rechnungen: db.invoices.filter((i) => i.status === 'Überfällig').length,
      kunden_aktiv: db.accounts.filter((a) => a.status === 'Aktiv').length, kunden_gefaehrdet: db.accounts.filter((a) => a.status === 'Gefährdet').length,
      interessenten: db.leads.length, offene_tickets: db.tickets.filter((t) => isOpen(db, 'tickets', t.status)).length,
      offene_qm_vorkommnisse: db.incidents.filter((i) => isOpen(db, 'incidents', i.status)).length,
      betreuungskosten: r0(db.costEntries.filter((e) => inRange(e.date, from, to)).reduce((s, e) => s + (e.cost || 0), 0)),
    };
  },

  // Vorschläge – werden NICHT ausgeführt, nur zur Bestätigung angezeigt
  propose_task(db, input) {
    const a = input.account_id ? findAccount(db, input.account_id) : null;
    return { status: 'Vorschlag – wartet auf Bestätigung durch den Benutzer', aufgabe: { betreff: input.subject, firma: a?.name || null, faellig: input.due_date, prioritaet: input.priority || 'Mittel', verantwortlich: userName(db, input.owner_id || a?.ownerId) } };
  },
  propose_comment(db, input) {
    const a = findAccount(db, input.account_id);
    if (!a) return notFound('Firma');
    return { status: 'Vorschlag – wartet auf Bestätigung durch den Benutzer', kommentar_an: a.name };
  },
};

// Ausführen eines bestätigten Vorschlags (nur nach Klick des Benutzers)
export function applyAction(name, input) {
  const db = store.get();
  const a = input.account_id ? findAccount(db, input.account_id) : null;
  if (name === 'propose_task') {
    const rec = store.add('activities', {
      type: 'task', subject: input.subject, accountId: a?.id || null, contactId: null, dealId: null,
      ownerId: input.owner_id && db.users.some((u) => u.id === input.owner_id) ? input.owner_id : a?.ownerId || db.meta.currentUserId,
      dueDate: new Date((input.due_date || new Date().toISOString().slice(0, 10)) + 'T09:00:00').toISOString(),
      priority: ['Hoch', 'Mittel', 'Niedrig'].includes(input.priority) ? input.priority : 'Mittel',
      notes: (input.notes ? input.notes + '\n\n' : '') + 'Angelegt über den KI-Assistenten.', status: '', comments: [], history: [],
    });
    return { kind: 'activities', id: rec.id, label: 'Aufgabe angelegt' };
  }
  if (name === 'propose_comment' && a) {
    const c = { id: 'C' + Date.now().toString(36), userId: db.meta.currentUserId, at: new Date().toISOString(), text: input.text + '\n\n— über KI-Assistent', editedAt: null };
    store.update('accounts', a.id, { comments: [...(a.comments || []), c] }, { silent: true });
    return { kind: 'accounts', id: a.id, label: 'Kommentar gespeichert' };
  }
  return null;
}

export const today = () => new Date().toISOString().slice(0, 10);
export { findAccount };
