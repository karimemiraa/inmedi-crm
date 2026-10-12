// InMedi CRM — Startdatensatz.
// Konfiguration (Benutzer, Gebiete, Phasen, Sätze, Automatisierungen, Zusatzfelder)
// PLUS ein realistischer, vollständig verknüpfter Demodatensatz, damit alle
// Auswertungen (Provision, Betreuungskosten, Pivot …) sofort sichtbar sind.
// buildSeed({ empty: true }) liefert denselben Konfigurationsrahmen ohne Demodaten.

const BASE = '2026-10-06T09:00:00';
const daysFromNow = (d) => { const t = new Date(BASE); t.setDate(t.getDate() + d); return t.toISOString(); };
// Datum im Demojahr 2026
const D = (m, day, h = 8) => new Date(Date.UTC(2026, m - 1, day, h, 0, 0)).toISOString();
const addDays = (iso, n) => { const t = new Date(iso); t.setDate(t.getDate() + n); return t.toISOString(); };

// ---- Gebiete ----
export const TERRITORIES = [
  { id: 'T1', name: 'Nord', region: 'Region Nord', color: '#a81e22' },
  { id: 'T2', name: 'Süd', region: 'Region Süd', color: '#0f8f86' },
  { id: 'T3', name: 'Ost', region: 'Region Ost', color: '#7a5cf0' },
  { id: 'T4', name: 'West', region: 'Region West', color: '#e0930b' },
];

// ---- Benutzer (Login) ----
// Login-Passwort für alle: inmedi2026. Karim zusätzlich 2FA-Code: 123456.
const U = (o) => ({ avatar: null, twoFactor: false, locked: false, failedLogins: 0, status: 'Aktiv', lastLogin: daysFromNow(-1), quota: 0, commissionRate: 0, ...o });
export const USERS = [
  U({ id: 'U1', name: 'Karim Emira', title: 'Vertriebsleiter', role: 'Administrator', territoryId: null, email: 'karim@inmedi.de', color: '#a81e22', twoFactor: true }),
  U({ id: 'U2', name: 'Stefan Vogel', title: 'Außendienst Nord', role: 'Außendienst', territoryId: 'T1', email: 'vogel@inmedi.de', color: '#0f8f86', quota: 400000, commissionRate: 0.05 }),
  U({ id: 'U3', name: 'Maria König', title: 'Außendienst Süd', role: 'Außendienst', territoryId: 'T2', email: 'koenig@inmedi.de', color: '#7a5cf0', quota: 350000, commissionRate: 0.06 }),
  U({ id: 'U4', name: 'Jens Albrecht', title: 'Außendienst Ost', role: 'Außendienst', territoryId: 'T3', email: 'albrecht@inmedi.de', color: '#e0930b', quota: 300000, commissionRate: 0.05 }),
  U({ id: 'U5', name: 'Petra Sommer', title: 'Innendienst', role: 'Innendienst', territoryId: null, email: 'sommer@inmedi.de', color: '#2f7ce0' }),
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
// Betreuungskosten-Berechnung (identisch zur Kostenkalkulation)
const CC = (type, min, km) => {
  const r = COST_RATES, h = (min || 0) / 60, k = km || 0;
  if (type === 'Besuch') return Math.round(r.visit + h * r.hourly + k * r.travelPerKm);
  if (type === 'Anruf') return Math.round(r.call + h * r.hourly);
  if (type === 'Fahrt') return Math.round(k * r.travelPerKm);
  if (type === 'Demo') return Math.round(r.demo + h * r.hourly + k * r.travelPerKm);
  if (type === 'Schulung') return Math.round(h * r.hourly + k * r.travelPerKm);
  return 0;
};

// ---- Automatisierungsregeln ----
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
const F = (id, entity, label, type, options, active = true) => ({ id, entity, label, type, options: options || [], active });
export const CUSTOM_FIELDS = [
  F('F1', 'Firma', 'ABCD-Klassifizierung', 'Auswahl', ['A (Fokuskunde)', 'B (hochwertig)', 'C (wertig)', 'D (Standard)']),
  F('F2', 'Firma', 'Kontakt ist', 'Auswahl', ['Kunde', 'Interessent', 'Passiv', 'Lieferant', 'Vertriebspartner', 'Wettbewerber', 'Kaltkontakt', 'Ex-Kunde', 'Multiplikator']),
  F('F4', 'Firma', 'Branche', 'Auswahl', ['Gastroenterologie', 'Onkologie', 'Proktologie', 'Intensivmedizin', 'Allgemeinmedizin', 'Pflege', 'Sonstige']),
  F('F5', 'Firma', 'Verband', 'Auswahl', ['Kein Verband', 'AGKAMED', 'Asklepios', 'HELIOS', 'Sana', 'Vivantes', 'Prospitalia', 'Sonstiger']),
  F('F6', 'Firma', 'Innovationsaffinität', 'Auswahl', ['abgeneigt', 'selten offen', 'mittel', 'interessiert', 'sehr interessiert']),
  F('F7', 'Firma', 'Zugang/Erreichbarkeit', 'Auswahl', ['sehr schwierig', 'schwierig', 'mittel', 'gut', 'sehr gut']),
  F('F8', 'Firma', 'Anzahl Untersuchungen p.a.', 'Zahl', []),
  F('F9', 'Firma', 'Vertragsverlängerung', 'Datum', []),
  F('F10', 'Ansprechpartner', 'Anwender-Gruppe', 'Auswahl', ['Arzt/Ärztin', 'Pflege', 'Einkauf', 'Controlling', 'Technik', 'Sonstige']),
  F('F11', 'Ansprechpartner', 'Fachbereich', 'Auswahl', ['Gastro KH', 'Gastro Niedergelassen', 'Onkologie KH', 'Proktologie', 'Intensivmedizin', 'Sonstige']),
  F('F12', 'Ansprechpartner', 'Entscheider', 'Kontrollkästchen', []),
  F('F13', 'Ansprechpartner', 'Abteilung', 'Text', []),
  F('F14', 'Ansprechpartner', 'Geburtstag', 'Datum', []),
  F('F15', 'Deal', 'Potential-Klasse', 'Auswahl', ['A: hoch (min. 10.000 €/J.)', 'B: mittel (1.000–10.000 €/J.)', 'C: gering (max. 1.000 €/J.)', 'D: kein Umsatz']),
  F('F16', 'Deal', 'Abschlusswahrscheinlichkeit %', 'Zahl', []),
];

// ---- Produktkategorien ----
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

// ---- Provisionskonfiguration ----
export const COMMISSION = { defaultRate: 0.05, basis: 'orders' }; // basis: 'orders' = abgerechnete Aufträge

// ==========================================================================
//  DEMODATEN
// ==========================================================================
const PRODUCTS = [
  { id: 'P1', sku: 'IM-1001', name: 'Infusionspumpe X300', category: 'Infusion & IV', price: 2450, unit: 'Stück', stock: 34, status: 'Aktiv' },
  { id: 'P2', sku: 'IM-1002', name: 'Vitalzeichenmonitor VS7', category: 'Patientenüberwachung', price: 3890, unit: 'Stück', stock: 12, status: 'Aktiv' },
  { id: 'P3', sku: 'IM-1003', name: 'Endoskopie-Set EasyScope', category: 'Diagnostik', price: 15900, unit: 'Set', stock: 6, status: 'Aktiv' },
  { id: 'P4', sku: 'IM-1004', name: 'Beatmungsgerät RespiCare 200', category: 'Beatmung', price: 18750, unit: 'Stück', stock: 4, status: 'Aktiv' },
  { id: 'P5', sku: 'IM-1005', name: 'EKG-Gerät CardioLine 12', category: 'Diagnostik', price: 4200, unit: 'Stück', stock: 9, status: 'Aktiv' },
  { id: 'P6', sku: 'IM-1006', name: 'Einmalhandschuhe Nitril (Box)', category: 'Verbrauchsmaterial', price: 12, unit: 'Box', stock: 540, status: 'Aktiv' },
  { id: 'P7', sku: 'IM-1007', name: 'Sterilcontainer-Set', category: 'Sterilisation', price: 320, unit: 'Set', stock: 48, status: 'Aktiv' },
  { id: 'P8', sku: 'IM-1008', name: 'Defibrillator LifePro AED', category: 'Notfall', price: 1890, unit: 'Stück', stock: 15, status: 'Aktiv' },
  { id: 'P9', sku: 'IM-1009', name: 'Infusionsbesteck Standard', category: 'Verbrauchsmaterial', price: 4, unit: 'Pack.', stock: 1200, status: 'Aktiv' },
];
const PMAP = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const li = (pid, qty, billing) => { const p = PMAP[pid]; const it = { productId: pid, name: p.name, qty, price: p.price }; if (billing) it.billing = billing; return it; };
const sum = (items) => items.reduce((s, i) => s + i.qty * i.price, 0);

function demo() {
  const acc = (o) => ({ country: 'Deutschland', website: '', vatId: '', paymentTerms: '30 Tage netto', discount: 0, beds: 0, notes: [], priceList: [], leadId: null, ...o });
  const accounts = [
    acc({ id: 'A1', kundennummer: 'K-10001', name: 'Universitätsklinikum Nord', type: 'Krankenhaus', tier: 'Schlüsselkunde', status: 'Aktiv', territoryId: 'T1', ownerId: 'U2', innendienstId: 'U5', street: 'Martinistraße 52', zip: '20246', city: 'Hamburg', phone: '040 7410-0', email: 'einkauf@uk-nord.de', website: 'www.uk-nord.de', vatId: 'DE118502851', paymentTerms: '30 Tage 2% Skonto', discount: 8, revenueYTD: 185000, beds: 1100, createdAt: D(1, 8), color: '#a81e22', customValues: { F1: 'A (Fokuskunde)', F2: 'Kunde', F3: 'Gold', F4: 'Gastroenterologie', F6: 'sehr interessiert', F8: 4200 }, priceList: [{ id: 'PA1', productId: 'P6', price: 9 }, { id: 'PA2', productId: 'P9', price: 3.2 }] }),
    acc({ id: 'A2', kundennummer: 'K-10002', name: 'St. Marien Krankenhaus', type: 'Krankenhaus', tier: 'Strategisch', status: 'Aktiv', territoryId: 'T2', ownerId: 'U3', innendienstId: 'U5', street: 'Mariahilfplatz 9', zip: '81541', city: 'München', phone: '089 4140-0', email: 'beschaffung@marien-kh.de', revenueYTD: 98000, beds: 620, createdAt: D(1, 20), color: '#0f8f86', customValues: { F1: 'B (hochwertig)', F2: 'Kunde', F3: 'Silber', F4: 'Onkologie', F6: 'interessiert' } }),
    acc({ id: 'A3', kundennummer: 'K-10003', name: 'Praxis Dr. Hoffmann', type: 'Praxis', tier: 'Standard', status: 'Aktiv', territoryId: 'T1', ownerId: 'U2', innendienstId: 'U5', street: 'Sögestraße 14', zip: '28195', city: 'Bremen', phone: '0421 320011', email: 'praxis@dr-hoffmann.de', revenueYTD: 24000, createdAt: D(2, 14), color: '#7a5cf0', customValues: { F1: 'C (wertig)', F2: 'Kunde', F3: 'Bronze', F4: 'Gastroenterologie', F6: 'mittel' } }),
    acc({ id: 'A4', kundennummer: 'K-10004', name: 'Klinikum Ostsee', type: 'Krankenhaus', tier: 'Schlüsselkunde', status: 'Gefährdet', territoryId: 'T3', ownerId: 'U4', innendienstId: 'U5', street: 'Südring 81', zip: '18059', city: 'Rostock', phone: '0381 4401-0', email: 'einkauf@klinikum-ostsee.de', revenueYTD: 142000, beds: 480, createdAt: D(1, 12), color: '#e0930b', customValues: { F1: 'A (Fokuskunde)', F2: 'Kunde', F3: 'Gold', F4: 'Intensivmedizin', F6: 'interessiert', F8: 1800 } }),
    acc({ id: 'A5', kundennummer: 'K-10005', name: 'MVZ Gesundheitszentrum Süd', type: 'Praxis', tier: 'Strategisch', status: 'Aktiv', territoryId: 'T2', ownerId: 'U3', innendienstId: 'U5', street: 'Königstraße 27', zip: '70173', city: 'Stuttgart', phone: '0711 2060-0', email: 'verwaltung@mvz-sued.de', revenueYTD: 56000, createdAt: D(3, 3), color: '#2f7ce0', customValues: { F1: 'B (hochwertig)', F2: 'Kunde', F3: 'Silber', F4: 'Allgemeinmedizin' } }),
    acc({ id: 'A6', kundennummer: 'K-10006', name: 'Seniorenresidenz Waldblick', type: 'Pflegeeinrichtung', tier: 'Standard', status: 'Aktiv', territoryId: 'T3', ownerId: 'U4', innendienstId: 'U5', street: 'Am Waldrand 3', zip: '04277', city: 'Leipzig', phone: '0341 8800-0', email: 'leitung@waldblick-leipzig.de', revenueYTD: 18000, createdAt: D(2, 25), color: '#10a760', customValues: { F1: 'C (wertig)', F2: 'Kunde', F3: 'Bronze', F4: 'Pflege', F7: 'gut' } }),
    acc({ id: 'A7', kundennummer: 'K-10007', name: 'MediDistribution GmbH', type: 'Großhändler', tier: 'Strategisch', status: 'Aktiv', territoryId: 'T1', ownerId: 'U2', innendienstId: 'U5', street: 'Logistikpark 1', zip: '30521', city: 'Hannover', phone: '0511 9000-0', email: 'order@medidistribution.de', revenueYTD: 210000, createdAt: D(1, 5), color: '#d6459b', customValues: { F1: 'A (Fokuskunde)', F2: 'Vertriebspartner', F3: 'Gold', F4: 'Sonstige' }, priceList: [{ id: 'PA3', productId: 'P1', price: 2100 }] }),
    acc({ id: 'A8', kundennummer: 'K-10008', name: 'Facharztzentrum Rheintal', type: 'Praxis', tier: 'Interessent', status: 'Interessent', territoryId: 'T2', ownerId: 'U3', innendienstId: 'U5', street: 'Rheinuferstraße 5', zip: '50668', city: 'Köln', phone: '0221 7700-0', email: 'kontakt@fz-rheintal.de', revenueYTD: 0, createdAt: D(8, 1), color: '#8b93a7', customValues: { F1: 'D (Standard)', F2: 'Interessent', F3: 'Kein Service', F4: 'Proktologie' } }),
    // Beabsichtigte Dublette von A1 (zur Demonstration der Dublettenprüfung)
    acc({ id: 'A9', kundennummer: 'K-10009', name: 'Universitätsklinikum Nord GmbH', type: 'Krankenhaus', tier: 'Interessent', status: 'Interessent', territoryId: 'T1', ownerId: 'U2', innendienstId: 'U5', street: 'Martinistr. 52', zip: '20246', city: 'Hamburg', phone: '040 7410-0', email: 'info@uk-nord.de', revenueYTD: 0, createdAt: D(9, 1), color: '#a81e22', customValues: { F2: 'Interessent' } }),
  ];

  const ct = (o) => ({ email: '', phone: '', isPrimary: false, color: '#0f8f86', customValues: {}, ...o });
  const contacts = [
    ct({ id: 'C1', accountId: 'A1', name: 'Dr. Anja Weber', title: 'Chefärztin Gastroenterologie', email: 'a.weber@uk-nord.de', phone: '040 7410-201', isPrimary: true, lastContact: D(9, 28), color: '#a81e22', customValues: { F10: 'Arzt/Ärztin', F11: 'Gastro KH', F12: true } }),
    ct({ id: 'C2', accountId: 'A1', name: 'Thomas Reinhardt', title: 'Einkaufsleiter', email: 't.reinhardt@uk-nord.de', phone: '040 7410-540', lastContact: D(9, 15), customValues: { F10: 'Einkauf', F12: true } }),
    ct({ id: 'C3', accountId: 'A2', name: 'Dr. Klaus Berger', title: 'Oberarzt Onkologie', email: 'k.berger@marien-kh.de', phone: '089 4140-310', isPrimary: true, color: '#0f8f86', customValues: { F10: 'Arzt/Ärztin', F11: 'Onkologie KH' } }),
    ct({ id: 'C4', accountId: 'A2', name: 'Sabine Lang', title: 'Einkauf', email: 's.lang@marien-kh.de', phone: '089 4140-120', lastContact: D(8, 30) }),
    ct({ id: 'C5', accountId: 'A3', name: 'Dr. Martin Hoffmann', title: 'Praxisinhaber', email: 'm.hoffmann@dr-hoffmann.de', phone: '0421 320011', isPrimary: true, color: '#7a5cf0', customValues: { F10: 'Arzt/Ärztin', F12: true } }),
    ct({ id: 'C6', accountId: 'A4', name: 'Dr. Ute Schneider', title: 'Leiterin Intensivmedizin', email: 'u.schneider@klinikum-ostsee.de', phone: '0381 4401-220', isPrimary: true, color: '#e0930b', customValues: { F10: 'Arzt/Ärztin', F11: 'Intensivmedizin', F12: true } }),
    ct({ id: 'C7', accountId: 'A4', name: 'Frank Möller', title: 'Medizintechnik', email: 'f.moeller@klinikum-ostsee.de', phone: '0381 4401-660', customValues: { F10: 'Technik' } }),
    ct({ id: 'C8', accountId: 'A5', name: 'Dr. Lena Fischer', title: 'Ärztliche Leitung', email: 'l.fischer@mvz-sued.de', phone: '0711 2060-15', isPrimary: true, color: '#2f7ce0' }),
    ct({ id: 'C9', accountId: 'A6', name: 'Brigitte Hauser', title: 'Pflegedienstleitung', email: 'b.hauser@waldblick-leipzig.de', phone: '0341 8800-12', isPrimary: true, color: '#10a760', customValues: { F10: 'Pflege' } }),
    ct({ id: 'C10', accountId: 'A7', name: 'Michael Groß', title: 'Einkaufsleiter', email: 'm.gross@medidistribution.de', phone: '0511 9000-10', isPrimary: true, color: '#d6459b', customValues: { F10: 'Einkauf', F12: true } }),
    ct({ id: 'C11', accountId: 'A7', name: 'Julia Neumann', title: 'Produktmanagement', email: 'j.neumann@medidistribution.de', phone: '0511 9000-24' }),
    ct({ id: 'C12', accountId: 'A8', name: 'Dr. Ralf Zimmermann', title: 'Facharzt Proktologie', email: 'r.zimmermann@fz-rheintal.de', phone: '0221 7700-3', isPrimary: true, color: '#8b93a7' }),
    // Beabsichtigte Dublette von C1 (gleiche E-Mail) auf der Dubletten-Firma A9
    ct({ id: 'C13', accountId: 'A9', name: 'Dr. Anja Weber', title: 'Chefärztin', email: 'a.weber@uk-nord.de', phone: '040 7410-201', isPrimary: true, color: '#a81e22' }),
  ];

  const deals = [
    { id: 'D1', name: 'Monitoring-Ausstattung Station 3', accountId: 'A1', contactId: 'C1', ownerId: 'U2', stage: 'won', value: 48000, score: 90, products: ['P2', 'P1'], expectedClose: D(3, 1), createdAt: D(2, 10), customValues: { F15: 'A: hoch (min. 10.000 €/J.)', F16: 100 } },
    { id: 'D2', name: 'Beatmungsgeräte Intensiv-Erweiterung', accountId: 'A4', contactId: 'C6', ownerId: 'U4', stage: 'negotiation', value: 62000, score: 75, products: ['P4', 'P2'], expectedClose: D(11, 15), createdAt: D(8, 15), customValues: { F15: 'A: hoch (min. 10.000 €/J.)', F16: 70 } },
    { id: 'D3', name: 'Endoskopie-Erneuerung', accountId: 'A2', contactId: 'C3', ownerId: 'U3', stage: 'proposal', value: 31000, score: 60, products: ['P3'], expectedClose: D(11, 30), createdAt: D(9, 2), customValues: { F16: 50 } },
    { id: 'D4', name: 'Rahmenvertrag Infusionstechnik', accountId: 'A7', contactId: 'C10', ownerId: 'U2', stage: 'won', value: 85000, score: 95, products: ['P1', 'P9'], expectedClose: D(5, 1), createdAt: D(4, 5), customValues: { F15: 'A: hoch (min. 10.000 €/J.)', F16: 100 } },
    { id: 'D5', name: 'EKG-Erstausstattung MVZ', accountId: 'A5', contactId: 'C8', ownerId: 'U3', stage: 'lead', value: 12000, score: 45, products: ['P5'], expectedClose: D(12, 15), createdAt: D(9, 20), customValues: { F16: 30 } },
    { id: 'D6', name: 'Diagnostik-Paket Praxis', accountId: 'A3', contactId: 'C5', ownerId: 'U2', stage: 'won', value: 9500, score: 80, products: ['P5', 'P6'], expectedClose: D(6, 20), createdAt: D(6, 12), customValues: { F15: 'B: mittel (1.000–10.000 €/J.)', F16: 100 } },
    { id: 'D7', name: 'AED-Beschaffung', accountId: 'A8', contactId: 'C12', ownerId: 'U3', stage: 'lost', value: 15000, score: 20, products: ['P8'], expectedClose: D(8, 1), createdAt: D(7, 1), customValues: { F16: 0 } },
  ];

  // Positions-Arrays (von Auftrag & Rechnung gemeinsam genutzt → nachvollziehbare Verknüpfung)
  const o1i = [li('P2', 6), li('P1', 4)];
  const o2i = [li('P1', 20)];
  const o3i = [li('P5', 2), li('P6', 50)];
  const o4i = [li('P3', 1)];
  const o5i = [li('P4', 2)];
  const o6i = [li('P6', 200), li('P9', 300)];
  const o7i = [li('P5', 1), li('P8', 2)];
  const o8i = [li('P9', 150)];
  const o9i = [li('P4', 3), li('P2', 2)];
  const o10i = [li('P3', 1), li('P5', 1)];
  const o11i = [li('P1', 2)];
  const o12i = [li('P8', 1)];
  const o13i = [li('P2', 1)];
  const ord = (o) => ({ ownerId: 'U2', dealId: null, ...o, total: sum(o.items) });
  const orders = [
    ord({ id: 'O1', number: 'AUF-24516', kind: 'Auftrag', accountId: 'A1', ownerId: 'U2', dealId: 'D1', status: 'Geliefert', items: o1i, date: D(3, 2) }),
    ord({ id: 'O2', number: 'AUF-24517', kind: 'Auftrag', accountId: 'A7', ownerId: 'U2', dealId: 'D4', status: 'Geliefert', items: o2i, date: D(5, 3) }),
    ord({ id: 'O3', number: 'AUF-24518', kind: 'Auftrag', accountId: 'A3', ownerId: 'U2', dealId: 'D6', status: 'Geliefert', items: o3i, date: D(6, 21) }),
    ord({ id: 'O4', number: 'AUF-24519', kind: 'Auftrag', accountId: 'A2', ownerId: 'U3', status: 'Geliefert', items: o4i, date: D(4, 18) }),
    ord({ id: 'O5', number: 'AUF-24520', kind: 'Auftrag', accountId: 'A4', ownerId: 'U4', status: 'Versendet', items: o5i, date: D(7, 22) }),
    ord({ id: 'O6', number: 'AUF-24521', kind: 'Auftrag', accountId: 'A1', ownerId: 'U2', status: 'Bestätigt', items: o6i, date: D(8, 9) }),
    ord({ id: 'O7', number: 'AUF-24522', kind: 'Auftrag', accountId: 'A5', ownerId: 'U3', status: 'Geliefert', items: o7i, date: D(9, 14) }),
    ord({ id: 'O8', number: 'AUF-24523', kind: 'Auftrag', accountId: 'A6', ownerId: 'U4', status: 'Geliefert', items: o8i, date: D(9, 28) }),
    ord({ id: 'O9', number: 'ANG-24524', kind: 'Angebot', accountId: 'A4', ownerId: 'U4', dealId: 'D2', status: 'Angebot gesendet', items: o9i, date: D(9, 16) }),
    ord({ id: 'O10', number: 'ANG-24525', kind: 'Angebot', accountId: 'A2', ownerId: 'U3', dealId: 'D3', status: 'Angebot gesendet', items: o10i, date: D(9, 5) }),
    ord({ id: 'O11', number: 'ANG-24526', kind: 'Angebot', accountId: 'A5', ownerId: 'U3', status: 'Entwurf', items: o11i, date: D(10, 2) }),
    ord({ id: 'O12', number: 'ANG-24527', kind: 'Angebot', accountId: 'A8', ownerId: 'U3', status: 'Angebot gesendet', items: o12i, date: D(8, 2) }),
    ord({ id: 'O13', number: 'AUF-24590', kind: 'Auftrag', accountId: 'A9', ownerId: 'U2', status: 'Bestätigt', items: o13i, date: D(9, 5) }),
  ];

  const inv = (o) => { const total = sum(o.items); const issueDate = o.issueDate; return { ownerId: 'U2', orderId: null, paid: 0, ...o, total, dueDate: addDays(issueDate, 30) }; };
  const invoices = [
    inv({ id: 'INV1', number: 'RE-25011', accountId: 'A1', ownerId: 'U2', orderId: 'O1', status: 'Bezahlt', issueDate: D(3, 5), items: o1i, paid: sum(o1i) }),
    inv({ id: 'INV2', number: 'RE-25012', accountId: 'A7', ownerId: 'U2', orderId: 'O2', status: 'Bezahlt', issueDate: D(5, 6), items: o2i, paid: sum(o2i) }),
    inv({ id: 'INV3', number: 'RE-25013', accountId: 'A3', ownerId: 'U2', orderId: 'O3', status: 'Bezahlt', issueDate: D(6, 25), items: o3i, paid: sum(o3i) }),
    inv({ id: 'INV4', number: 'RE-25014', accountId: 'A2', ownerId: 'U3', orderId: 'O4', status: 'Teilbezahlt', issueDate: D(4, 22), items: o4i, paid: 8000 }),
    inv({ id: 'INV5', number: 'RE-25015', accountId: 'A4', ownerId: 'U4', orderId: 'O5', status: 'Versendet', issueDate: D(7, 28), items: o5i, paid: 0 }),
    inv({ id: 'INV6', number: 'RE-25016', accountId: 'A1', ownerId: 'U2', orderId: 'O6', status: 'Überfällig', issueDate: D(8, 12), items: o6i, paid: 0 }),
    inv({ id: 'INV7', number: 'RE-25017', accountId: 'A5', ownerId: 'U3', orderId: 'O7', status: 'Versendet', issueDate: D(9, 18), items: o7i, paid: 0 }),
    inv({ id: 'INV8', number: 'RE-25018', accountId: 'A6', ownerId: 'U4', orderId: 'O8', status: 'Bezahlt', issueDate: D(9, 30), items: o8i, paid: sum(o8i) }),
  ];

  const contracts = [
    { id: 'V1', number: 'V-1001', title: 'Liefervertrag Monitoring 2026', accountId: 'A1', contactId: 'C2', ownerId: 'U2', status: 'Aktiv', startDate: D(1, 15), termMonths: 24, items: [li('P2', 1, 'jährlich'), li('P1', 1, 'quartalsweise')], cancellationReason: '', fromOrderId: 'O1', description: 'Rahmenliefervertrag Monitoring-Systeme inkl. Zubehör.', createdAt: D(1, 15), customValues: {} },
    { id: 'V2', number: 'V-1002', title: 'Rahmenvertrag Intensivmedizin', accountId: 'A4', contactId: 'C6', ownerId: 'U4', status: 'Aktiv', startDate: D(3, 1), termMonths: 36, items: [li('P4', 2, 'jährlich')], cancellationReason: '', fromOrderId: null, description: 'Liefervertrag Beatmungstechnik.', createdAt: D(3, 1), customValues: {} },
    { id: 'V3', number: 'V-1003', title: 'Endoskopie-Liefervertrag', accountId: 'A2', contactId: 'C3', ownerId: 'U3', status: 'Gekündigt', startDate: D(2, 1), termMonths: 12, items: [li('P3', 1, 'jährlich')], cancellationReason: 'Budgetkürzung 2026', fromOrderId: null, description: '', createdAt: D(2, 1), customValues: {} },
  ];

  const act = (o) => ({ priority: 'Mittel', notes: '', contactId: null, dealId: null, done: false, ...o });
  const activities = [
    act({ id: 'ACT1', type: 'meeting', subject: 'Produktdemo Monitoring vor Ort', accountId: 'A1', contactId: 'C1', dealId: 'D1', ownerId: 'U2', dueDate: D(2, 18), done: true }),
    act({ id: 'ACT2', type: 'call', subject: 'Angebot Beatmungsgeräte nachfassen', accountId: 'A4', contactId: 'C6', dealId: 'D2', ownerId: 'U4', dueDate: D(10, 14), done: false, priority: 'Hoch' }),
    act({ id: 'ACT3', type: 'task', subject: 'Endoskopie-Angebot erstellen', accountId: 'A2', contactId: 'C3', dealId: 'D3', ownerId: 'U3', dueDate: D(9, 1), done: true }),
    act({ id: 'ACT4', type: 'followup', subject: 'Rahmenvertrag Jahresgespräch', accountId: 'A7', contactId: 'C10', dealId: 'D4', ownerId: 'U2', dueDate: D(11, 5), done: false }),
    act({ id: 'ACT5', type: 'meeting', subject: 'Erstberatung EKG-Ausstattung', accountId: 'A5', contactId: 'C8', dealId: 'D5', ownerId: 'U3', dueDate: D(10, 20), done: false }),
    act({ id: 'ACT6', type: 'call', subject: 'Zahlungserinnerung offene Rechnung', accountId: 'A1', contactId: 'C2', ownerId: 'U5', dueDate: D(10, 8), done: false, priority: 'Hoch' }),
    act({ id: 'ACT7', type: 'meeting', subject: 'Schulung Infusionspumpen', accountId: 'A3', contactId: 'C5', ownerId: 'U2', dueDate: D(6, 28), done: true }),
    act({ id: 'ACT8', type: 'task', subject: 'Pflegeheim Bedarfsanalyse', accountId: 'A6', contactId: 'C9', ownerId: 'U4', dueDate: D(9, 25), done: true }),
    act({ id: 'ACT9', type: 'email', subject: 'Produktunterlagen AED versendet', accountId: 'A8', contactId: 'C12', dealId: 'D7', ownerId: 'U3', dueDate: D(7, 10), done: true }),
    act({ id: 'ACT10', type: 'call', subject: 'Gefährdeten Kunden kontaktieren', accountId: 'A4', contactId: 'C6', ownerId: 'U4', dueDate: D(10, 12), done: false, priority: 'Hoch', notes: 'Kunde als „Gefährdet" eingestuft – Betreuung intensivieren.' }),
    act({ id: 'ACT11', type: 'meeting', subject: 'Quartalsgespräch Großhandel', accountId: 'A7', contactId: 'C11', ownerId: 'U2', dueDate: D(10, 30), done: false }),
    act({ id: 'ACT12', type: 'followup', subject: 'MVZ Angebot nachfassen', accountId: 'A5', contactId: 'C8', dealId: 'D5', ownerId: 'U3', dueDate: D(10, 18), done: false }),
  ];

  const ce = (type, accountId, userId, m, day, min, km, note) => ({ id: `CE${ceId++}`, type, accountId, userId, date: D(m, day), durationMin: min, distanceKm: km, cost: CC(type, min, km), note: note || '' });
  let ceId = 1;
  const costEntries = [
    ce('Besuch', 'A1', 'U2', 2, 18, 120, 45, 'Demo & Beratung Monitoring'),
    ce('Demo', 'A1', 'U2', 2, 18, 90, 45, 'Gerätedemonstration'),
    ce('Besuch', 'A1', 'U2', 8, 9, 90, 45, 'Nachbestellung Verbrauch'),
    ce('Anruf', 'A1', 'U5', 10, 8, 20, 0, 'Zahlungserinnerung'),
    ce('Besuch', 'A4', 'U4', 7, 22, 150, 120, 'Lieferung & Übergabe Beatmung'),
    ce('Besuch', 'A4', 'U4', 9, 16, 120, 120, 'Angebotspräsentation'),
    ce('Schulung', 'A4', 'U4', 10, 12, 180, 120, 'Anwenderschulung Intensiv'),
    ce('Besuch', 'A2', 'U3', 4, 18, 90, 60, 'Endoskopie-Lieferung'),
    ce('Besuch', 'A2', 'U3', 9, 5, 100, 60, 'Angebotsgespräch'),
    ce('Besuch', 'A3', 'U2', 6, 28, 90, 85, 'Schulung Infusionspumpen'),
    ce('Anruf', 'A3', 'U2', 9, 10, 15, 0, 'Nachbestellung'),
    ce('Besuch', 'A5', 'U3', 9, 14, 80, 30, 'EKG Produktvorstellung'),
    ce('Besuch', 'A5', 'U3', 10, 18, 90, 30, 'Beratung Erweiterung'),
    // A6 Pflegeheim: viele Besuche, geringer Umsatz → ungünstiges Verhältnis
    ce('Besuch', 'A6', 'U4', 3, 10, 120, 95, 'Bedarfsaufnahme'),
    ce('Besuch', 'A6', 'U4', 6, 15, 120, 95, 'Betreuungsbesuch'),
    ce('Besuch', 'A6', 'U4', 9, 25, 120, 95, 'Betreuungsbesuch'),
    ce('Fahrt', 'A6', 'U4', 9, 25, 0, 95, 'Anfahrt'),
    // A8 Interessent: Aufwand, noch kein Umsatz
    ce('Besuch', 'A8', 'U3', 7, 8, 90, 50, 'Erstbesuch Interessent'),
    ce('Demo', 'A8', 'U3', 7, 10, 90, 50, 'AED-Demo'),
    ce('Besuch', 'A7', 'U2', 4, 5, 60, 40, 'Rahmenvertrag Verhandlung'),
  ];

  const tickets = [
    { id: 'TK1', number: 'TK-4805', subject: 'Rückmeldung: Monitor-Anzeige schwer ablesbar', accountId: 'A1', contactId: 'C2', ownerId: 'U5', productId: 'P2', channel: 'Telefon', category: 'Feedback', priority: 'Hoch', status: 'In Bearbeitung', description: 'Anzeige bei Tageslicht schwer ablesbar; Kunde wünscht Info zu Displayoptionen.', comments: [{ id: 'CTK1', userId: 'U2', at: D(10, 4), text: 'Kunde wünscht Rückruf bis Freitag.', editedAt: null }], createdAt: D(10, 3), resolvedAt: null },
    { id: 'TK2', number: 'TK-4806', subject: 'Beatmungsgerät Alarm unklar', accountId: 'A4', contactId: 'C7', ownerId: 'U5', productId: 'P4', channel: 'E-Mail', category: 'Produktfrage', priority: 'Hoch', status: 'Neu', createdAt: D(10, 7), resolvedAt: null },
    { id: 'TK3', number: 'TK-4807', subject: 'Rückfrage zu Rechnung RE-25014', accountId: 'A2', contactId: 'C4', ownerId: 'U5', productId: null, channel: 'E-Mail', category: 'Rechnungsfrage', priority: 'Mittel', status: 'Gelöst', createdAt: D(9, 10), resolvedAt: D(9, 12) },
    { id: 'TK4', number: 'TK-4808', subject: 'Lieferverzug Infusionsbesteck', accountId: 'A6', contactId: 'C9', ownerId: 'U5', productId: null, channel: 'Telefon', category: 'Reklamation', priority: 'Mittel', status: 'Wartet auf Kunde', createdAt: D(9, 29), resolvedAt: null },
  ];

  const events = [
    { id: 'EV1', name: 'MEDICA 2026', type: 'Messe', location: 'Düsseldorf', startDate: D(11, 16), endDate: D(11, 19), status: 'Geplant', budget: 45000, cost: 38000, ownerId: 'U1', notes: 'Weltleitmesse Medizin. Standfläche Halle 11.', attendees: [
      { refType: 'account', refId: 'A1', role: 'Bestandskunde', status: 'Zugesagt' },
      { refType: 'account', refId: 'A4', role: 'Bestandskunde', status: 'Eingeladen' },
      { refType: 'account', refId: 'A7', role: 'Partner', status: 'Zugesagt' },
      { refType: 'contact', refId: 'C1', role: 'Entscheiderin', status: 'Zugesagt' },
      { refType: 'contact', refId: 'C10', role: 'Einkauf', status: 'Zugesagt' },
      { refType: 'lead', refId: 'L1', role: 'Interessent', status: 'Eingeladen' },
      { refType: 'lead', refId: 'L2', role: 'Interessent', status: 'Eingeladen' },
    ] },
    { id: 'EV2', name: 'InMedi Hausmesse Frühjahr', type: 'Hausmesse', location: 'Hamburg', startDate: D(4, 20), endDate: D(4, 21), status: 'Abgeschlossen', budget: 12000, cost: 11200, ownerId: 'U2', notes: 'Eigene Hausmesse mit Produktvorführungen.', attendees: [
      { refType: 'account', refId: 'A1', role: 'Bestandskunde', status: 'Teilgenommen' },
      { refType: 'account', refId: 'A3', role: 'Bestandskunde', status: 'Teilgenommen' },
      { refType: 'contact', refId: 'C1', role: 'Ärztin', status: 'Teilgenommen' },
      { refType: 'contact', refId: 'C5', role: 'Praxisinhaber', status: 'Teilgenommen' },
    ] },
  ];

  const recurringOrders = [
    { id: 'RO1', accountId: 'A1', ownerId: 'U2', interval: 'monatlich', items: [li('P6', 50), li('P9', 100)], startDate: D(1, 10), nextDue: D(10, 10), active: true, lastGenerated: D(9, 10), generatedOrderIds: [] },
    { id: 'RO2', accountId: 'A6', ownerId: 'U4', interval: 'quartalsweise', items: [li('P9', 120)], startDate: D(2, 1), nextDue: D(11, 1), active: true, lastGenerated: D(8, 1), generatedOrderIds: [] },
  ];

  const leads = [
    { id: 'L1', name: 'Dr. Sophie Berg', company: 'Klinik am Stadtpark', title: 'Oberärztin', source: 'Messe', status: 'Neu', score: 72, ownerId: 'U2', email: 's.berg@klinik-stadtpark.de', phone: '0431 5500-0', city: 'Kiel', potential: 40000, createdAt: D(9, 25), color: '#a81e22', notes: [], accountId: null },
    { id: 'L2', name: 'Markus Lindner', company: 'Reha-Zentrum Alpenblick', title: 'Verwaltungsleiter', source: 'Messe', status: 'In Bearbeitung', score: 58, ownerId: 'U3', email: 'm.lindner@reha-alpenblick.de', phone: '08031 2200', city: 'Rosenheim', potential: 25000, createdAt: D(9, 18), color: '#0f8f86', notes: [], accountId: null },
    { id: 'L3', name: 'Dr. Eva Richter', company: 'Praxis Richter & Partner', title: 'Praxisinhaberin', source: 'Website', status: 'Neu', score: 45, ownerId: 'U3', email: 'info@praxis-richter.de', phone: '0221 4400', city: 'Köln', potential: 8000, createdAt: D(10, 1), color: '#7a5cf0', notes: [], accountId: null },
    { id: 'L4', name: 'Tobias Krause', company: 'Pflegedienst Krause', title: 'Inhaber', source: 'Empfehlung', status: 'In Bearbeitung', score: 66, ownerId: 'U4', email: 't.krause@pd-krause.de', phone: '0341 9900', city: 'Leipzig', potential: 15000, createdAt: D(9, 12), color: '#e0930b', notes: [], accountId: null },
  ];

  const campaigns = [
    { id: 'CMP1', name: 'Herbst-Aktion Monitoring', type: 'E-Mail', segment: 'Krankenhäuser — Schlüsselkunden', status: 'Aktiv', sent: 420, opened: 198, clicked: 44, date: D(9, 20), memberType: 'account', memberIds: ['A1', 'A2', 'A4'] },
    { id: 'CMP2', name: 'Newsletter Q3 2026', type: 'Newsletter', segment: 'Alle Kontakte', status: 'Abgeschlossen', sent: 1250, opened: 500, clicked: 120, date: D(7, 1), memberType: 'contact', memberIds: ['C1', 'C3', 'C5', 'C8', 'C10'] },
    { id: 'CMP3', name: 'Produktlaunch AED', type: 'E-Mail', segment: 'Praxen & Pflege', status: 'Geplant', sent: 0, opened: 0, clicked: 0, date: D(10, 20), memberType: 'account', memberIds: ['A5', 'A6'] },
  ];

  const kbArticles = [
    { id: 'KB1', title: 'Kundenfeedback richtig erfassen & weiterleiten', category: 'Prozesse', views: 142 },
    { id: 'KB2', title: 'Infusionspumpe X300 – häufige Kundenfragen', category: 'Produkte', views: 98 },
    { id: 'KB3', title: 'Retouren & Reklamationen – Ablauf', category: 'Prozesse', views: 61 },
  ];

  const documents = [
    { id: 'DOC1', name: 'Rahmenvertrag MediDistribution 2026.pdf', type: 'Vertrag', size: '248 KB', date: D(5, 1), accountId: 'A7', ownerId: 'U2' },
    { id: 'DOC2', name: 'Angebot Beatmungsgeräte Klinikum Ostsee.pdf', type: 'Angebot', size: '192 KB', date: D(9, 16), accountId: 'A4', ownerId: 'U4' },
    { id: 'DOC3', name: 'Lieferschein AUF-24516.pdf', type: 'Lieferschein', size: '88 KB', date: D(3, 3), accountId: 'A1', ownerId: 'U5' },
  ];

  return {
    products: PRODUCTS, accounts, contacts, deals, orders, invoices, activities,
    leads, tickets, costEntries, campaigns, contracts, events, recurringOrders,
    kbArticles, documents,
    incidents: [
      { id: 'VK1', number: 'VK-2026-015', title: 'Beatmungsgerät: Alarm ohne erkennbare Ursache', type: 'Vorkommnis', severity: 'Hoch', productId: 'P4', lot: 'LOT 26-0412', serial: 'RC200-0456', accountId: 'A4', status: 'In Prüfung', reportedBy: 'U5', reportedAt: D(10, 8), meldepflichtig: true, description: 'Gerät meldet wiederholt Druckalarm ohne Befund. Kein Patientenschaden. Gerät außer Betrieb genommen.', capaId: null, parent: { kind: 'tickets', id: 'TK2' },
        comments: [{ id: 'CVK1', userId: 'U1', at: D(10, 8, 14), text: 'Hersteller ist informiert, Rückmeldung erwartet bis Mittwoch.', editedAt: null }], history: [] },
    ],
    capas: [
      { id: 'CAPA1', number: 'CAPA-2026-009', type: 'Korrektur', title: 'Kundeninformation & Abstimmung mit Hersteller', incidentId: 'VK1', ownerId: 'U1', status: 'In Umsetzung', dueDate: D(10, 30), createdAt: D(10, 9), description: 'Betroffene Kunden mit gleicher Charge informieren.', comments: [], history: [] },
    ],
    incomingInvoices: [],
    ideas: [
      { id: 'I1', title: 'Musterkoffer für Außendienst-Demos', description: 'Einheitlicher Demokoffer mit Verbrauchsmaterial-Mustern.', status: 'In Prüfung', priority: 'Mittel', ownerId: 'U2', createdAt: D(9, 28), comments: [{ id: 'CI1', userId: 'U3', at: D(9, 29), text: 'Gute Idee — für Süd bitte 2 Koffer.', editedAt: null }], history: [] },
      { id: 'I2', title: 'Nachbestell-Erinnerung für Verbrauchsmaterial', description: 'Kunden automatisch an Nachbestellung erinnern.', status: 'Neu', priority: 'Hoch', ownerId: 'U5', createdAt: D(10, 2), comments: [], history: [] },
    ],
    auditLog: [],
  };
}

function emptyTransactions() {
  return {
    products: [], accounts: [], contacts: [], deals: [], orders: [],
    invoices: [], activities: [], leads: [], tickets: [],
    costEntries: [], campaigns: [], contracts: [], events: [], recurringOrders: [],
    kbArticles: [], documents: [],
    incidents: [], capas: [], incomingInvoices: [], ideas: [], auditLog: [],
  };
}

export function buildSeed(opts = {}) {
  const tx = opts.empty ? emptyTransactions() : demo();
  return {
    users: USERS, territories: TERRITORIES,
    automations: AUTOMATIONS, customFields: CUSTOM_FIELDS, stages: STAGES,
    ...tx,
    meta: {
      currentUserId: 'U1', seededAt: '2026-10-10', costRates: COST_RATES,
      commission: { ...COMMISSION }, logo: null, productCategories: PRODUCT_CATEGORIES,
      integrations: INTEGRATIONS,
    },
  };
}
