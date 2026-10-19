// Rechnungseingang per E-Mail: Abgleich mit dem Eingangs-Server (server/ im Repository).
// Der Server liest das Microsoft-365-Postfach rund um die Uhr; das CRM holt neue Rechnungen ab,
// ordnet sie per Kundennummer Firma + Betreuer zu und markiert Unklares mit „Zu prüfen“.
// Verbindungsdaten (Server-URL, Token) liegen nur in diesem Browser – nicht im Datenexport.
import { useSyncExternalStore } from 'react';
import { store } from '../data/store.js';

const KEY = 'inmedi-intake-settings';
const STATE_KEY = 'inmedi-intake-state';
const LOCK_KEY = 'inmedi-intake-lock';
// intervalMin: Ersatz-Abgleich – normal kommen neue Rechnungen live über den Server-Kanal
export const INTAKE_DEFAULTS = { serverUrl: '', token: '', autoSync: true, intervalMin: 15, autoDetected: false };

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
export const matchAccount = (db, kdnr) => {
  const d = onlyDigits(kdnr);
  if (!d) return null;
  return db.accounts.find((a) => onlyDigits(a.kundennummer) === d) || null;
};

// ---- Einstellungen + letzter Abgleich (pro Browser) ----
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const readJson = (k, def) => { try { return { ...def, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (e) { return { ...def }; } };
let settings = null, syncState = null;
const getSettings = () => (settings ||= readJson(KEY, INTAKE_DEFAULTS));
const getState = () => (syncState ||= { ...readJson(STATE_KEY, { running: false, last: null, log: [] }), running: false, live: 'off' });
export const getIntakeSettings = getSettings;
export function saveIntakeSettings(patch) {
  const prev = getSettings();
  settings = { ...prev, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
  emit();
  if (prev.serverUrl !== settings.serverUrl || prev.token !== settings.token || prev.autoSync !== settings.autoSync) restartLive();
}
function setState(patch) {
  syncState = { ...getState(), ...patch };
  try { const { running, live, ...keep } = syncState; localStorage.setItem(STATE_KEY, JSON.stringify(keep)); } catch (e) {}
  emit();
}
const sub = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useIntakeSettings = () => useSyncExternalStore(sub, getSettings);
export const useIntakeState = () => useSyncExternalStore(sub, getState);
export const intakeConfigured = (s = getSettings()) => !!(s.serverUrl && s.token);

// ---- Server-Aufrufe ----
const base = (s) => s.serverUrl.trim().replace(/\/+$/, '');
async function api(s, path, opts = {}) {
  let res;
  try {
    res = await fetch(base(s) + path, { ...opts, headers: { Authorization: 'Bearer ' + s.token.trim(), ...(opts.headers || {}) } });
  } catch (e) {
    throw new Error('Server nicht erreichbar – Adresse, HTTPS-Zertifikat und Firewall prüfen.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Zugriff verweigert – Token prüfen.');
  if (!res.ok) throw new Error(data.error || `Serverfehler ${res.status}`);
  return data;
}
export const fetchServerStatus = (s = getSettings()) => api(s, '/api/status');
export const triggerServerRun = (s = getSettings()) => api(s, '/api/run', { method: 'POST' });

// ---- Server-Datensatz → CRM-Rechnung ----
export function toCrmInvoice(db, r) {
  const acc = r.kundennummer ? matchAccount(db, r.kundennummer) : null;
  const reasons = [...(r.problems || [])];
  if (r.status !== 'fehler' && !acc) reasons.push(r.kundennummer ? `Kundennummer ${r.kundennummer} keiner Firma zugeordnet` : 'Keine Firma zugeordnet');
  return {
    id: 'EI' + String(r.fileHash || r.seq).slice(0, 12),
    intakeId: r.fileHash || null,
    source: 'email',
    rechnungsnummer: r.rechnungsnummer || null, datum: r.datum || null, kundennummer: r.kundennummer || null,
    kundeName: r.kundeName || null, kundeBlock: r.kundeBlock || [], leistungsempfaenger: r.leistungsempfaenger || null,
    referenz: r.referenz || null, ansprechpartner: r.ansprechpartner || null, lieferant: r.lieferant || null,
    items: r.items || [], netto: r.netto ?? null, gesamt: r.gesamt ?? null, itemsTotal: r.itemsTotal ?? null,
    zahlbarBis: r.zahlbarBis || null, zahlungskonditionen: r.zahlungskonditionen || null, pageCount: r.pageCount || null,
    fileName: r.fileName || null, emailFrom: r.from || null, emailSubject: r.subject || null, receivedAt: r.receivedAt || null,
    accountId: acc?.id || null, ownerId: acc?.ownerId || null,
    importedAt: new Date().toISOString(), importedBy: null,
    readError: r.status === 'fehler',
    needsReview: reasons.length > 0, reviewReasons: reasons,
  };
}

// Läuft in mehreren Tabs gleichzeitig? Nur einer gleicht ab.
function takeLock() {
  try {
    const t = Number(localStorage.getItem(LOCK_KEY)) || 0;
    if (Date.now() - t < 60_000) return false;
    localStorage.setItem(LOCK_KEY, String(Date.now()));
    return true;
  } catch (e) { return true; }
}
const releaseLock = () => { try { localStorage.removeItem(LOCK_KEY); } catch (e) {} };

// Neue Rechnungen abholen und speichern. Gibt eine Zusammenfassung zurück.
let again = false;
export async function syncIntake({ manual = false } = {}) {
  const s = getSettings();
  if (!intakeConfigured(s)) return null;
  if (getState().running) { again = true; return null; } // läuft schon → danach direkt noch einmal
  if (!takeLock()) return null;
  setState({ running: true });
  const sum = { at: new Date().toISOString(), manual, ok: true, added: 0, review: 0, duplicates: 0, errors: 0, error: null };
  try {
    for (let page = 0; page < 50; page++) {
      const db = store.get();
      const since = db.meta?.intakeSeq || 0;
      const { invoices = [], seq, more } = await api(s, `/api/invoices?since=${since}&limit=200`);
      const existing = new Set(db.incomingInvoices.map((i) => i.intakeId).filter(Boolean));
      const keyOf = (i) => (i.rechnungsnummer ? `${i.lieferant || ''}|${i.rechnungsnummer}` : null);
      const known = new Set(db.incomingInvoices.map(keyOf).filter(Boolean));
      const fresh = [], audit = [];
      for (const r of invoices) {
        if (r.status === 'duplikat' || existing.has(r.fileHash)) { sum.duplicates++; continue; }
        const inv = toCrmInvoice(db, r);
        const k = keyOf(inv);
        if (k && known.has(k)) { sum.duplicates++; continue; }
        if (k) known.add(k);
        existing.add(r.fileHash);
        fresh.push(inv);
        if (inv.readError) sum.errors++;
        if (inv.needsReview) sum.review++;
        audit.push({
          id: 'AL' + inv.id, at: sum.at, userId: null, action: 'Rechnung per E-Mail eingegangen',
          entity: 'RE ' + (inv.rechnungsnummer || inv.fileName || ''),
          detail: `${inv.lieferant || inv.emailFrom || ''} · Kundennr. ${inv.kundennummer || '—'}${inv.accountId ? ' → ' + (db.accounts.find((a) => a.id === inv.accountId)?.name || '') : ''}${inv.needsReview ? ' · zu prüfen' : ''}`,
        });
      }
      // Ein Schreibvorgang je Seite: Rechnungen + Protokoll + Abrufposition.
      // Doppelt-Prüfung erneut gegen den AKTUELLEN Stand – ein anderer Tab kann dieselbe
      // Rechnung gerade eben gespeichert haben (gleichzeitige Live-Benachrichtigung).
      let added = [];
      store.reloadFromStorage();
      store.set((st) => {
        const ids = new Set(st.incomingInvoices.map((i) => i.intakeId).filter(Boolean));
        const keys = new Set(st.incomingInvoices.map(keyOf).filter(Boolean));
        added = fresh.filter((i) => !ids.has(i.intakeId) && !(keyOf(i) && keys.has(keyOf(i))));
        const addedIds = new Set(added.map((i) => 'AL' + i.id));
        const auditIds = new Set(st.auditLog.map((a) => a.id));
        return {
          ...st,
          incomingInvoices: [...added.slice().reverse(), ...st.incomingInvoices],
          auditLog: [...audit.filter((a) => addedIds.has(a.id) && !auditIds.has(a.id)), ...st.auditLog],
          meta: { ...st.meta, intakeSeq: Math.max(seq || 0, st.meta?.intakeSeq || 0) },
        };
      });
      const skipped = fresh.length - added.length;
      sum.added += added.length;
      sum.duplicates += skipped;
      sum.review -= fresh.filter((i) => i.needsReview && !added.includes(i)).length;
      sum.errors -= fresh.filter((i) => i.readError && !added.includes(i)).length;
      if (!more) break;
    }
  } catch (e) {
    sum.ok = false;
    sum.error = e?.message || String(e);
  } finally {
    releaseLock();
    const log = [sum, ...(getState().log || [])].slice(0, 30);
    setState({ running: false, last: sum, log });
  }
  if (again) { again = false; setTimeout(() => syncIntake(), 0); }
  return sum;
}

// ---- Live-Kanal zum Server: neue Rechnungen erscheinen sofort ----
// fetch-Streaming statt EventSource, damit das Token im Header (nicht in der URL) übertragen wird.
let liveCtrl = null, liveTimer = null, backoff = 5000, liveWanted = false, liveGen = 0;
const setLive = (live) => { if (getState().live !== live) { syncState = { ...getState(), live }; emit(); } };
async function connectLive() {
  clearTimeout(liveTimer);
  const s = getSettings();
  if (!liveWanted || !intakeConfigured(s) || !s.autoSync) { setLive('off'); return; }
  const gen = ++liveGen; // ältere Verbindungsversuche erkennen und still beenden
  liveCtrl = new AbortController();
  setLive('connecting');
  try {
    const res = await fetch(base(s) + '/api/events', { headers: { Authorization: 'Bearer ' + s.token.trim() }, signal: liveCtrl.signal, cache: 'no-store' });
    if (res.status === 401) backoff = 60_000; // falsches Token: selten erneut versuchen
    if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
    setLive('connected');
    backoff = 5000;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const ev = (block.match(/^event: (.+)$/m) || [])[1];
        if (ev === 'hello' || ev === 'invoice') syncIntake(); // hello: nach (Wieder-)Verbindung nachholen
      }
    }
    throw new Error('Verbindung beendet');
  } catch (e) {
    if (gen !== liveGen || !liveWanted) return;
    setLive('error');
    liveTimer = setTimeout(connectLive, backoff);
    backoff = Math.min(backoff * 2, 60_000);
  }
}
function restartLive() {
  if (!liveWanted) return;
  liveGen++;
  liveCtrl?.abort();
  backoff = 5000;
  setTimeout(connectLive, 0);
}

// Läuft das CRM auf demselben Server wie der Eingang? Dann Adresse automatisch übernehmen.
async function detectSameOriginServer() {
  if (getSettings().serverUrl || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
  try {
    const res = await fetch(location.origin + '/health', { cache: 'no-store' });
    const data = await res.json();
    if (data?.service === 'inmedi-intake') saveIntakeSettings({ serverUrl: location.origin, autoDetected: true });
  } catch (e) { /* kein Eingangs-Server unter dieser Adresse */ }
}

// Start beim Öffnen des CRM: Server erkennen, live verbinden, Ersatz-Abgleich alle n Minuten.
let timer = null;
export function startIntakeAutoSync() {
  liveWanted = true;
  const tick = async () => {
    const s = getSettings();
    if (s.autoSync && intakeConfigured(s)) await syncIntake();
    timer = setTimeout(tick, Math.max(1, Number(getSettings().intervalMin) || 15) * 60_000);
  };
  clearTimeout(timer);
  detectSameOriginServer().finally(() => { connectLive(); timer = setTimeout(tick, 60_000); });
  return () => { liveWanted = false; clearTimeout(timer); clearTimeout(liveTimer); liveCtrl?.abort(); setLive('off'); };
}

// ---- Export ----
export const INVOICE_COLUMNS = (db) => {
  const acc = (id) => db.accounts.find((a) => a.id === id);
  const usr = (id) => db.users.find((u) => u.id === id);
  return [
    { label: 'Rechnungsnr.', get: (i) => i.rechnungsnummer },
    { label: 'Datum', get: (i) => i.datum },
    { label: 'Lieferant', get: (i) => i.lieferant },
    { label: 'Kundennr.', get: (i) => i.kundennummer },
    { label: 'Kunde (laut Rechnung)', get: (i) => i.kundeName },
    { label: 'Firma (CRM)', get: (i) => acc(i.accountId)?.name },
    { label: 'Betreuer', get: (i) => usr(i.ownerId)?.name },
    { label: 'Referenz', get: (i) => i.referenz },
    { label: 'Positionen', get: (i) => (i.items || []).length },
    { label: 'Netto', get: (i) => num(i.netto) },
    { label: 'Gesamt', get: (i) => num(i.gesamt) },
    { label: 'Zahlbar bis', get: (i) => i.zahlbarBis },
    { label: 'Zahlungskonditionen', get: (i) => i.zahlungskonditionen },
    { label: 'Quelle', get: (i) => (i.source === 'email' ? 'E-Mail' : 'Upload') },
    { label: 'E-Mail von', get: (i) => i.emailFrom },
    { label: 'E-Mail-Betreff', get: (i) => i.emailSubject },
    { label: 'Eingegangen', get: (i) => i.receivedAt || i.importedAt },
    { label: 'Datei', get: (i) => i.fileName },
    { label: 'Status', get: (i) => (i.needsReview ? 'Zu prüfen' : 'OK') },
    { label: 'Prüfhinweise', get: (i) => (i.reviewReasons || []).join(' | ') },
  ];
};
export const POSITION_COLUMNS = (db) => {
  const acc = (id) => db.accounts.find((a) => a.id === id);
  return [
    { label: 'Rechnungsnr.', get: (r) => r.inv.rechnungsnummer },
    { label: 'Rechnungsdatum', get: (r) => r.inv.datum },
    { label: 'Lieferant', get: (r) => r.inv.lieferant },
    { label: 'Kundennr.', get: (r) => r.inv.kundennummer },
    { label: 'Firma (CRM)', get: (r) => acc(r.inv.accountId)?.name },
    { label: 'Pos', get: (r) => r.it.pos },
    { label: 'Artikelnr.', get: (r) => r.it.artikelnr },
    { label: 'Bezeichnung', get: (r) => r.it.name },
    { label: 'Menge', get: (r) => num(r.it.menge) },
    { label: 'Einheit', get: (r) => r.it.einheit },
    { label: 'Einzelpreis', get: (r) => num(r.it.preis) },
    { label: 'USt %', get: (r) => r.it.ust },
    { label: 'Betrag', get: (r) => num(r.it.betrag) },
    { label: 'LOT', get: (r) => r.it.lot },
    { label: 'Ablaufdatum', get: (r) => r.it.ablauf },
  ];
};
export const positionRows = (invoices) => invoices.flatMap((inv) => (inv.items || []).map((it) => ({ inv, it })));
// Deutsche Excel-Schreibweise (Komma als Dezimaltrenner)
function num(v) { return v == null || v === '' ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ','); }
