// Bearbeitbare Felder je Objektart für die Vorgang-Seite.
// Typen: text, textarea, number, money, date, bool, enum, account, contact, deal, order, product, user, incident
import { ACT_LABEL } from './labels.js';

export const PRIORITIES = ['Hoch', 'Mittel', 'Niedrig'];
export const PRIO_TONE = { Hoch: 'red', Mittel: 'amber', Niedrig: 'gray' };
export const TICKET_CATEGORIES = ['Feedback', 'Produktfrage', 'Reklamation', 'Retoure', 'Lieferung', 'Rechnungsfrage'];
export const INC_TYPES = ['Vorkommnis', 'Beinahe-Vorkommnis', 'Produktmangel', 'Rückruf (FSCA)'];
export const SEVERITIES = ['Niedrig', 'Mittel', 'Hoch', 'Schwerwiegend'];
export const SEV_TONE = { Niedrig: 'gray', Mittel: 'blue', Hoch: 'amber', Schwerwiegend: 'red' };
export const EVENT_TYPES = ['Messe', 'Kongress', 'Hausmesse', 'Webinar', 'Workshop'];
export const INTERVALS = ['monatlich', 'quartalsweise', 'halbjährlich', 'jährlich'];
export const CAMPAIGN_TYPES = ['E-Mail', 'Newsletter', 'Social Media', 'Print', 'Event'];

const F = (key, label, type, extra = {}) => ({ key, label, type, ...extra });
const title = (label = 'Titel', key = 'title') => F(key, label, 'text', { required: true, full: true });
const desc = (key = 'description', label = 'Beschreibung') => F(key, label, 'textarea', { full: true });

export const FIELDS = {
  tickets: [
    title('Betreff', 'subject'), desc(),
    F('category', 'Kategorie', 'enum', { options: TICKET_CATEGORIES }),
    F('priority', 'Priorität', 'enum', { options: PRIORITIES }),
    F('channel', 'Kanal', 'enum', { options: ['Telefon', 'E-Mail', 'Web'] }),
    F('ownerId', 'Bearbeiter', 'user'),
    F('accountId', 'Firma', 'account'), F('contactId', 'Ansprechpartner', 'contact'), F('productId', 'Produkt', 'product'),
  ],
  activities: [
    title('Betreff', 'subject'), desc('notes'),
    F('type', 'Art', 'enum', { options: Object.keys(ACT_LABEL), labels: ACT_LABEL }),
    F('priority', 'Priorität', 'enum', { options: PRIORITIES }),
    F('dueDate', 'Fällig am', 'date'), F('ownerId', 'Verantwortlich', 'user'),
    F('accountId', 'Firma', 'account'), F('contactId', 'Ansprechpartner', 'contact'), F('dealId', 'Deal', 'deal'),
  ],
  ideas: [
    title(), desc(),
    F('priority', 'Priorität', 'enum', { options: PRIORITIES }), F('ownerId', 'Eingereicht von', 'user'),
  ],
  incidents: [
    title(), desc(),
    F('type', 'Typ', 'enum', { options: INC_TYPES }), F('severity', 'Schweregrad', 'enum', { options: SEVERITIES }),
    F('accountId', 'Firma', 'account'), F('productId', 'Produkt', 'product'),
    F('lot', 'Charge / LOT', 'text'), F('serial', 'Seriennummer', 'text'),
    F('meldepflichtig', 'Meldepflichtig (BfArM & Hersteller)', 'bool', { full: true }),
  ],
  capas: [
    title(), desc(),
    F('type', 'Typ', 'enum', { options: ['Korrektur', 'Vorbeugung'] }), F('ownerId', 'Verantwortlich', 'user'),
    F('dueDate', 'Fällig am', 'date'), F('incidentId', 'Bezug Vorkommnis', 'incident'),
  ],
  deals: [
    title('Bezeichnung', 'name'),
    F('value', 'Wert', 'money'), F('expectedClose', 'Erwarteter Abschluss', 'date'),
    F('score', 'Score (0–100)', 'number'), F('ownerId', 'Betreuer', 'user'),
    F('accountId', 'Firma', 'account'), F('contactId', 'Ansprechpartner', 'contact'),
    desc('notes', 'Notiz'),
  ],
  orders: [
    F('number', 'Nummer', 'text', { required: true }), F('kind', 'Art', 'enum', { options: ['Angebot', 'Auftrag'] }),
    F('date', 'Datum', 'date'), F('ownerId', 'Betreuer', 'user'),
    F('accountId', 'Firma', 'account'), F('contactId', 'Ansprechpartner', 'contact'), F('dealId', 'Deal', 'deal'),
    desc('notes', 'Notiz / Hinweise'),
  ],
  invoices: [
    F('number', 'Rechnungsnummer', 'text', { required: true }), F('issueDate', 'Rechnungsdatum', 'date'),
    F('dueDate', 'Fällig am', 'date'), F('paid', 'Bezahlt', 'money'),
    F('accountId', 'Firma', 'account'), F('orderId', 'Auftrag', 'order'), F('ownerId', 'Betreuer', 'user'),
    desc('notes', 'Notiz / Hinweise'),
  ],
  contracts: [
    title(), F('number', 'Vertragsnummer', 'text'),
    F('startDate', 'Beginn', 'date'), F('termMonths', 'Laufzeit (Monate)', 'number'),
    F('accountId', 'Firma', 'account'), F('contactId', 'Ansprechpartner', 'contact'),
    F('ownerId', 'Betreuer', 'user'), F('fromOrderId', 'Ursprungsauftrag', 'order'),
    F('cancellationReason', 'Kündigungsgrund', 'text', { full: true }), desc(),
  ],
  recurringOrders: [
    F('accountId', 'Firma', 'account', { required: true }), F('interval', 'Intervall', 'enum', { options: INTERVALS }),
    F('startDate', 'Beginn', 'date'), F('nextDue', 'Nächste Fälligkeit', 'date'),
    F('ownerId', 'Betreuer', 'user'), desc('notes', 'Notiz'),
  ],
  events: [
    title('Name', 'name'), F('type', 'Typ', 'enum', { options: EVENT_TYPES }), F('location', 'Ort', 'text'),
    F('startDate', 'Beginn', 'date'), F('endDate', 'Ende', 'date'),
    F('budget', 'Budget', 'money'), F('cost', 'Kosten', 'money'), F('ownerId', 'Verantwortlich', 'user'),
    desc('notes', 'Notizen'),
  ],
  campaigns: [
    title('Name', 'name'), F('type', 'Typ', 'enum', { options: CAMPAIGN_TYPES }), F('segment', 'Zielgruppe / Segment', 'text'),
    F('date', 'Datum', 'date'), F('sent', 'Versendet', 'number'), F('opened', 'Geöffnet', 'number'), F('clicked', 'Geklickt', 'number'),
    desc(),
  ],
  products: [
    title('Name', 'name'), F('sku', 'Artikelnummer', 'text'), F('category', 'Kategorie', 'text'),
    F('price', 'Preis', 'money'), F('unit', 'Einheit', 'text'), F('stock', 'Bestand', 'number'),
    desc(),
  ],
};

// Stammdaten
FIELDS.accounts = [
  title('Firmenname', 'name'), F('kundennummer', 'Kundennummer', 'text'),
  F('type', 'Typ', 'enum', { options: ['Krankenhaus', 'Praxis', 'Pflegeeinrichtung', 'Apotheke', 'Großhändler'] }),
  F('tier', 'Kategorie', 'enum', { options: ['Schlüsselkunde', 'Strategisch', 'Standard', 'Interessent'] }),
  F('territoryId', 'Gebiet', 'territory'), F('beds', 'Betten', 'number'),
  F('ownerId', 'Außendienst', 'user'), F('innendienstId', 'Innendienst', 'user'),
  F('street', 'Straße', 'text', { full: true }), F('zip', 'PLZ', 'text'), F('city', 'Stadt', 'text'),
  F('phone', 'Telefon', 'text'), F('email', 'E-Mail', 'text'), F('website', 'Website', 'text'), F('vatId', 'USt-IdNr.', 'text'),
  F('paymentTerms', 'Zahlungsziel', 'enum', { options: ['14 Tage netto', '30 Tage netto', '30 Tage 2% Skonto', 'Vorkasse'] }),
  F('discount', 'Standardrabatt %', 'number'), F('revenueYTD', 'Umsatz lfd. Jahr', 'money'),
];
FIELDS.contacts = [
  title('Name', 'name'), F('title', 'Position', 'text'),
  F('accountId', 'Firma', 'account', { required: true }), F('isPrimary', 'Hauptansprechpartner', 'bool'),
  F('email', 'E-Mail', 'text'), F('phone', 'Telefon', 'text'),
];

export const REF_TYPES = ['account', 'contact', 'deal', 'order', 'product', 'user', 'incident', 'territory'];
