// InMedi CRM — Startdatensatz.
// Transaktionsdaten sind leer (Test „von 0"). Enthalten ist nur die
// Konfiguration: Benutzer (für Login), Gebiete, Pipeline-Phasen, Sätze,
// Automatisierungsregeln und die Zusatzfeld-Definitionen (an Emnis angelehnt).

const BASE = '2026-10-06T09:00:00';
const daysFromNow = (d) => { const t = new Date(BASE); t.setDate(t.getDate() + d); return t.toISOString(); };

// ---- Gebiete ----
export const TERRITORIES = [
  { id: 'T1', name: 'Nord', region: 'Region Nord', color: '#a81e22' },
  { id: 'T2', name: 'Süd', region: 'Region Süd', color: '#0f8f86' },
  { id: 'T3', name: 'Ost', region: 'Region Ost', color: '#7a5cf0' },
  { id: 'T4', name: 'West', region: 'Region West', color: '#e0930b' },
];

// ---- Benutzer (Login) ----
const U = (o) => ({ avatar: null, twoFactor: false, locked: false, failedLogins: 0, status: 'Aktiv', lastLogin: daysFromNow(-1), ...o });
export const USERS = [
  U({ id: 'U1', name: 'Karim Emira', title: 'Vertriebsleiter', role: 'Administrator', territoryId: null, email: 'karim@inmedi.de', color: '#a81e22', quota: 0, twoFactor: true }),
];

// ---- Pipeline-Phasen ----
export const STAGES = [
  { id: 'lead', name: 'Qualifizierung', color: '#8b93a7' },
  { id: 'proposal', name: 'Angebot gesendet', color: '#2f7ce0' },
  { id: 'negotiation', name: 'Verhandlung', color: '#e0930b' },
  { id: 'won', name: 'Gewonnen', color: '#10a760' },
  { id: 'lost', name: 'Verloren', color: '#e0483b' },
];

// ---- Kostensätze ----
export const COST_RATES = { visit: 85, call: 12, travelPerKm: 0.42, hourly: 65, demo: 150 };

// ---- Automatisierungsregeln (strukturiert: WENN Objekt+Ereignis+Bedingungen DANN Aktionen) ----
export const AUTOMATIONS = [
  {
    id: 'R1', name: 'Warnung bei Großauftrag', active: true,
    trigger: { object: 'Deal', event: 'any' }, match: 'all',
    conditions: [{ field: 'value', op: 'gt', value: '100000' }],
    actions: [
      { type: 'notify', params: { message: 'Großauftrag – Vertriebsleiter informieren' } },
      { type: 'task', params: { subject: 'Großauftrag prüfen und begleiten', priority: 'Hoch' } },
    ],
  },
  {
    id: 'R2', name: 'At-Risk-Kunde betreuen', active: true,
    trigger: { object: 'Firma', event: 'update' }, match: 'all',
    conditions: [{ field: 'status', op: 'eq', value: 'Gefährdet' }],
    actions: [
      { type: 'task', params: { subject: 'Gefährdeten Kunden kontaktieren', priority: 'Hoch' } },
      { type: 'note', params: { text: 'Konto wurde als „Gefährdet" eingestuft – bitte Betreuung intensivieren.' } },
    ],
  },
  {
    id: 'R3', name: 'Heißer Lead melden', active: true,
    trigger: { object: 'Interessent', event: 'create' }, match: 'all',
    conditions: [{ field: 'score', op: 'gte', value: '70' }],
    actions: [{ type: 'notify', params: { message: 'Heißer Lead eingegangen (Score ≥ 70)' } }],
  },
  {
    id: 'R4', name: 'Schwerwiegendes Vorkommnis', active: true,
    trigger: { object: 'Vorkommnis', event: 'any' }, match: 'all',
    conditions: [{ field: 'severity', op: 'eq', value: 'Schwerwiegend' }],
    actions: [
      { type: 'notify', params: { message: 'Meldefrist BfArM/Hersteller beachten (MDR/MPDG)' } },
      { type: 'task', params: { subject: 'Vorkommnis an BfArM melden', priority: 'Hoch' } },
    ],
  },
];

// ---- Zusatzfelder (an Emnis angelehnt) ----
// type: Text | Zahl | Datum | Auswahl | Kontrollkästchen ; options nur bei Auswahl.
// entity: Konto | Kontakt | Deal | Gerät | Vorgang | Lead
const F = (id, entity, label, type, options, active = true) => ({ id, entity, label, type, options: options || [], active });
export const CUSTOM_FIELDS = [
  // Konto (Emnis: Kontakte)
  F('F1', 'Firma', 'ABCD-Klassifizierung', 'Auswahl', ['A (Fokuskunde)', 'B (hochwertig)', 'C (wertig)', 'D (Standard)']),
  F('F2', 'Firma', 'Kontakt ist', 'Auswahl', ['Kunde', 'Interessent', 'Passiv', 'Lieferant', 'Vertriebspartner', 'Wettbewerber', 'Kaltkontakt', 'Ex-Kunde', 'Multiplikator']),
  F('F3', 'Firma', 'Service Level', 'Auswahl', ['Kein Service', 'Bronze', 'Silber', 'Gold']),
  F('F4', 'Firma', 'Branche', 'Auswahl', ['Gastroenterologie', 'Onkologie', 'Proktologie', 'Intensivmedizin', 'Allgemeinmedizin', 'Pflege', 'Sonstige']),
  F('F5', 'Firma', 'Verband', 'Auswahl', ['Kein Verband', 'AGKAMED', 'Asklepios', 'HELIOS', 'Sana', 'Vivantes', 'Prospitalia', 'Sonstiger']),
  F('F6', 'Firma', 'Innovationsaffinität', 'Auswahl', ['abgeneigt', 'selten offen', 'mittel', 'interessiert', 'sehr interessiert']),
  F('F7', 'Firma', 'Zugang/Erreichbarkeit', 'Auswahl', ['sehr schwierig', 'schwierig', 'mittel', 'gut', 'sehr gut']),
  F('F8', 'Firma', 'Anzahl Untersuchungen p.a.', 'Zahl', []),
  F('F9', 'Firma', 'Vertragsverlängerung', 'Datum', []),
  // Kontakt (Emnis: Ansprechpartner)
  F('F10', 'Ansprechpartner', 'Anwender-Gruppe', 'Auswahl', ['Arzt/Ärztin', 'Pflege', 'Einkauf', 'Controlling', 'Technik', 'Sonstige']),
  F('F11', 'Ansprechpartner', 'Fachbereich', 'Auswahl', ['Gastro KH', 'Gastro Niedergelassen', 'Onkologie KH', 'Proktologie', 'Intensivmedizin', 'Sonstige']),
  F('F12', 'Ansprechpartner', 'Entscheider', 'Kontrollkästchen', []),
  F('F13', 'Ansprechpartner', 'Abteilung', 'Text', []),
  F('F14', 'Ansprechpartner', 'Geburtstag', 'Datum', []),
  // Deal (Emnis: Potentiale)
  F('F15', 'Deal', 'Potential-Klasse', 'Auswahl', ['A: hoch (min. 10.000 €/J.)', 'B: mittel (1.000–10.000 €/J.)', 'C: gering (max. 1.000 €/J.)', 'D: kein Umsatz']),
  F('F16', 'Deal', 'Abschlusswahrscheinlichkeit %', 'Zahl', []),
  // Gerät
  F('F17', 'Gerät', 'Standort im Haus', 'Text', []),
  F('F18', 'Gerät', 'Gerätehersteller', 'Auswahl', ['Olympus', 'Fuji', 'Pentax', 'Storz', 'InMedi', 'Andere']),
];

// ---- Produktkategorien (für Dropdowns beim Anlegen) ----
export const PRODUCT_CATEGORIES = [
  'Infusion & IV', 'Patientenüberwachung', 'Bildgebung', 'Diagnostik', 'Notfall',
  'Beatmung', 'Mobiliar', 'Chirurgie', 'Sterilisation', 'Verbrauchsmaterial', 'Mobilität', 'Sonstige',
];

export const INTEGRATIONS = {
  microsoft365: {
    tenantId: '', clientId: '', clientSecretSet: false,
    ssoEnabled: false,
    emailEnabled: false, senderMailbox: '', sampleReleaseTo: '',
    sharepointEnabled: false, sharepointSite: '', sharepointFolder: '',
    teamsEnabled: false, teamsWebhookSet: false,
  },
};

export function buildSeed() {
  return {
    users: USERS, territories: TERRITORIES, products: [],
    accounts: [], contacts: [], deals: [], orders: [],
    invoices: [], activities: [], leads: [], tickets: [],
    devices: [], costEntries: [], campaigns: [],
    serviceOrders: [], incidents: [], capas: [], contracts: [], incomingInvoices: [], ideas: [],
    documents: [], automations: AUTOMATIONS, customFields: CUSTOM_FIELDS,
    kbArticles: [], auditLog: [], stages: STAGES,
    meta: { currentUserId: 'U1', seededAt: '2026-10-06', costRates: COST_RATES, logo: null, productCategories: PRODUCT_CATEGORIES, integrations: INTEGRATIONS },
  };
}
