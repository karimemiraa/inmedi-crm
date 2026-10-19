// Ende-zu-Ende-Test des Rechnungseingangs gegen ein nachgebildetes Microsoft 365
// (Login, Graph-Endpunkte, Sofort-Benachrichtigungen inkl. Validierung und Lebenszyklus).
// Start: cd server && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMockGraph } from './mockGraph.js';
import { invoicePdf } from './makePdf.js';
import { freePort, waitFor, quiet } from './helpers.js';
import { start } from '../src/index.js';

const TOKEN = 'test-token-0123456789abcdefghij';
let mock, app, api, dataDir;
const env = (port, extra = {}) => ({
  MS_TENANT_ID: 'tenant', MS_CLIENT_ID: 'client', MS_CLIENT_SECRET: 'secret', MAILBOX: 'rechnungen@inmedi.de',
  API_TOKEN: TOKEN, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, ALLOWED_ORIGINS: 'https://karimemiraa.github.io',
  PUBLIC_URL: `http://127.0.0.1:${port}`, ALLOW_HTTP_WEBHOOK: '1', SWEEP_MINUTES: '600',
  GRAPH_BASE: mock.graphBase, LOGIN_BASE: mock.loginBase, ...extra,
});
const invoices = () => app.store.data.invoices;
const last = () => invoices().at(-1);
const get = (p, headers = {}) => fetch(api + p, { headers: { Authorization: 'Bearer ' + TOKEN, ...headers } });

before(async () => {
  mock = await startMockGraph();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));
  const port = await freePort();
  app = start(env(port), { log: quiet });
  await app.ready;
  api = `http://127.0.0.1:${port}`;
});
after(async () => { await app.close(); await mock.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('beim Start: Benachrichtigungs-Abo bei Microsoft angelegt (Adresse per Validierung bestätigt)', async () => {
  assert.equal(mock.state.creates, 1);
  const w = app.store.data.webhook;
  assert.ok(w.id && w.clientState && w.clientState.length >= 32);
  assert.ok(new Date(w.expiresAt) > new Date(Date.now() + 2 * 864e5), 'läuft ~3 Tage');
  const sub = mock.state.subscriptions.get(w.id);
  assert.equal(sub.changeType, 'created');
  assert.match(sub.resource, /mailFolders\('inbox'\)\/messages/);
  assert.equal(sub.notificationUrl, api + '/graph/notify');
});

test('neue Mail → SOFORT verarbeitet (ohne Abgleich), Mail nach „Rechnungen verarbeitet“', async () => {
  const t0 = Date.now();
  mock.deliver('Rechnung 9104711', [{ name: 'RE_9104711.pdf', bytes: invoicePdf({ nr: '9104711', kdnr: '10001', items: [['OTSC Clip 12/6t', 2, 395], ['EasyScope Set', 1, 1240.5]] }) }]);
  await waitFor(() => invoices().length === 1 && mock.folder('Rechnungen verarbeitet')?.messages.length === 1, 5000, 'Sofortverarbeitung');
  assert.ok(Date.now() - t0 < 3000, 'innerhalb von Sekunden');
  assert.equal(mock.state.notifyLog[0], 202, 'Microsoft bekommt sofort 202');
  const inv = last();
  assert.equal(inv.status, 'ok');
  assert.equal(inv.rechnungsnummer, '9104711');
  assert.equal(inv.gesamt, 2416.3);
  assert.equal(inv.items.length, 2);
  assert.equal(app.store.data.events[0].trigger, 'sofort');
  assert.equal(app.store.data.runs.filter((r) => r.trigger !== 'Start').length, 0, 'kein Abgleich nötig');
});

test('doppelte Benachrichtigung für dieselbe Mail → nur einmal verarbeitet', async () => {
  mock.state.duplicateNotifications = true;
  const n = invoices().length;
  mock.deliver('Rechnung 9104720', [{ name: 'RE_9104720.pdf', bytes: invoicePdf({ nr: '9104720', kdnr: '10002' }) }]);
  await waitFor(() => invoices().length === n + 1, 5000);
  await new Promise((r) => setTimeout(r, 300));
  await app.intake.idle();
  assert.equal(invoices().length, n + 1);
  mock.state.duplicateNotifications = false;
});

test('gefälschte Benachrichtigung (falsches clientState) wird ignoriert', async () => {
  const id = (mock.state.dropNotifications = true, mock.deliver('Fremd', [{ name: 'x.pdf', bytes: invoicePdf({ nr: '9999001', kdnr: '10001' }) }]));
  mock.state.dropNotifications = false;
  const n = invoices().length;
  const r = await mock.sendRaw(api + '/graph/notify', { value: [{ subscriptionId: app.store.data.webhook.id, clientState: 'falsch', resourceData: { id } }] });
  assert.equal(r.status, 202);
  await new Promise((r2) => setTimeout(r2, 300));
  assert.equal(invoices().length, n, 'nichts verarbeitet');
  // aufräumen: Mail per Abgleich verarbeiten
  await app.intake.sweep('test');
});

test('verpasste Benachrichtigung → Sicherheitsnetz-Abgleich holt die Mail nach', async () => {
  mock.state.dropNotifications = true;
  mock.deliver('Rechnung 9104730', [{ name: 'RE_9104730.pdf', bytes: invoicePdf({ nr: '9104730', kdnr: '10003' }) }]);
  mock.state.dropNotifications = false;
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!invoices().some((i) => i.rechnungsnummer === '9104730'));
  const run = await app.intake.sweep();
  assert.equal(run.imported, 1);
  assert.ok(invoices().some((i) => i.rechnungsnummer === '9104730'));
});

test('Microsoft meldet „missed“ → sofortiger Nachhol-Abgleich', async () => {
  mock.state.dropNotifications = true;
  mock.deliver('Rechnung 9104731', [{ name: 'RE_9104731.pdf', bytes: invoicePdf({ nr: '9104731', kdnr: '10003' }) }]);
  mock.state.dropNotifications = false;
  assert.deepEqual(await mock.lifecycle('missed'), [202]);
  await waitFor(() => invoices().some((i) => i.rechnungsnummer === '9104731'), 5000, 'nachholen');
  assert.equal(app.store.data.runs[0].trigger, 'nachholen');
});

test('Abo-Pflege: Verlängerung kurz vor Ablauf, „reauthorizationRequired“, „subscriptionRemoved“', async () => {
  const before = mock.state.renewals;
  await app.intake.ensureSubscription();
  assert.equal(mock.state.renewals, before, 'noch lange gültig → keine Verlängerung');
  app.store.setWebhook({ expiresAt: new Date(Date.now() + 3600e3).toISOString() });
  await app.intake.ensureSubscription();
  assert.equal(mock.state.renewals, before + 1, 'verlängert');
  assert.ok(new Date(app.store.data.webhook.expiresAt) > new Date(Date.now() + 2 * 864e5));

  await mock.lifecycle('reauthorizationRequired');
  await waitFor(() => mock.state.renewals === before + 2, 3000, 'reauthorize');

  const oldId = app.store.data.webhook.id;
  await mock.lifecycle('subscriptionRemoved');
  await waitFor(() => app.store.data.webhook.id && app.store.data.webhook.id !== oldId, 3000, 'neu anlegen');
  assert.equal(mock.state.subscriptions.size, 1);
  // neues Abo funktioniert
  const n = invoices().length;
  mock.deliver('Rechnung 9104740', [{ name: 'RE_9104740.pdf', bytes: invoicePdf({ nr: '9104740', kdnr: '10004' }) }]);
  await waitFor(() => invoices().length === n + 1, 5000, 'nach Neuanlage');

  // Abo bei Microsoft verschwunden (404 beim Verlängern) → wird neu angelegt
  mock.state.subscriptions.clear();
  app.store.setWebhook({ expiresAt: new Date(Date.now() + 60e3).toISOString() });
  await app.intake.ensureSubscription();
  assert.equal(mock.state.subscriptions.size, 1);
  assert.equal(app.store.data.webhook.error, null);
});

test('gleiche Datei / gleiche Rechnungsnr. erneut → Duplikat', async () => {
  const n = invoices().length;
  mock.deliver('Nochmal', [{ name: 'RE_9104711.pdf', bytes: invoicePdf({ nr: '9104711', kdnr: '10001', items: [['OTSC Clip 12/6t', 2, 395], ['EasyScope Set', 1, 1240.5]] }) }]);
  mock.deliver('Korrigierte Kopie', [{ name: 'RE_9104711_kopie.pdf', bytes: invoicePdf({ nr: '9104711', kdnr: '10001', datum: '06.10.2026' }) }]);
  await waitFor(() => mock.state.folders[0].messages.length === 0, 5000);
  await app.intake.idle();
  assert.equal(invoices().length, n + 1);
  assert.equal(last().status, 'duplikat');
});

test('unklare Rechnung → „pruefen“; defekte PDF → „fehler“; Mail ohne PDF/ohne Anhang → „Rechnungen prüfen“', async () => {
  mock.deliver('Ohne Kdnr', [{ name: 'RE_9200001.pdf', bytes: invoicePdf({ nr: '9200001', kdnr: '' }) }]);
  mock.deliver('Kaputt', [{ name: 'kaputt.pdf', bytes: Buffer.from('%PDF-1.4 keine echte pdf') }]);
  mock.deliver('Nur Logo', [{ name: 'logo.png', contentType: 'image/png', bytes: Buffer.from('png'), isInline: true }]);
  mock.deliver('Frage zur Lieferung', []);
  await waitFor(() => mock.state.folders[0].messages.length === 0, 8000, 'alle verarbeitet');
  await app.intake.idle();
  assert.ok(invoices().some((i) => i.rechnungsnummer === '9200001' && i.status === 'pruefen' && i.problems.some((p) => /Kundennummer/.test(p))));
  assert.ok(invoices().some((i) => i.subject === 'Kaputt' && i.status === 'fehler'));
  const check = mock.folder('Rechnungen prüfen').messages.map((m) => m.subject).sort();
  assert.deepEqual(check, ['Frage zur Lieferung', 'Kaputt', 'Nur Logo', 'Ohne Kdnr']);
});

test('mehrere PDFs in einer Mail; Drosselung (429) wird abgewartet; Token zwischengespeichert', async () => {
  mock.state.failNext429 = 1;
  mock.deliver('Sammelrechnung', [{ name: 'a.pdf', bytes: invoicePdf({ nr: '9300001', kdnr: '10002' }) }, { name: 'b.pdf', bytes: invoicePdf({ nr: '9300002', kdnr: '10003' }) }]);
  await waitFor(() => invoices().some((i) => i.rechnungsnummer === '9300002'), 8000);
  assert.ok(invoices().some((i) => i.rechnungsnummer === '9300001'));
  assert.equal(mock.state.tokenCalls, 1);
});

test('Live-Kanal: CRM erfährt sofort von neuen Rechnungen (nur mit Token)', async () => {
  assert.equal((await fetch(api + '/api/events')).status, 401);
  const ctrl = new AbortController();
  const res = await fetch(api + '/api/events', { headers: { Authorization: 'Bearer ' + TOKEN, Origin: 'https://karimemiraa.github.io' }, signal: ctrl.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://karimemiraa.github.io');
  const reader = res.body.getReader();
  let text = '';
  const readUntil = async (re) => { while (!re.test(text)) { const { value } = await reader.read(); text += new TextDecoder().decode(value); } };
  await readUntil(/event: hello/);
  mock.deliver('Rechnung 9104750', [{ name: 'RE_9104750.pdf', bytes: invoicePdf({ nr: '9104750', kdnr: '10001' }) }]);
  await readUntil(/event: invoice/);
  const seq = JSON.parse(text.split('event: invoice\ndata: ')[1].split('\n')[0]).seq;
  assert.equal(seq, app.store.data.seq);
  ctrl.abort();
});

test('API: Token Pflicht, CORS nur für das CRM, inkrementeller Abruf, Status', async () => {
  assert.equal((await fetch(api + '/api/invoices')).status, 401);
  assert.equal((await fetch(api + '/api/invoices', { headers: { Authorization: 'Bearer falsch' } })).status, 401);
  const health = await (await fetch(api + '/health')).json();
  assert.equal(health.service, 'inmedi-intake');
  assert.ok(!JSON.stringify(health).includes('rechnungen@'));
  const ok = await get('/api/invoices?since=0&limit=500', { Origin: 'https://karimemiraa.github.io' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://karimemiraa.github.io');
  const all = await ok.json();
  assert.equal(all.invoices.length, invoices().length);
  assert.equal((await get('/api/invoices', { Origin: 'https://evil.example' })).headers.get('access-control-allow-origin'), null);
  const page = await (await get('/api/invoices?since=0&limit=2')).json();
  assert.equal(page.invoices.length, 2);
  assert.equal(page.more, true);
  assert.equal((await (await get('/api/invoices?since=' + all.seq)).json()).invoices.length, 0);
  const st = await (await get('/api/status')).json();
  assert.equal(st.mode, 'sofort');
  assert.equal(st.webhook.active, true);
  assert.ok(st.webhook.lastNotificationAt);
  assert.ok(st.events.length > 5);
  assert.ok(!JSON.stringify(st).includes(app.store.data.webhook.clientState), 'clientState bleibt geheim');
  // Microsoft-Endpunkte: Validierung nur als Text-Echo, keine anderen Methoden
  const v = await fetch(api + '/graph/notify?validationToken=' + encodeURIComponent('<script>x</script>'), { method: 'POST' });
  assert.equal(v.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal((await fetch(api + '/graph/notify')).status, 405);
});

test('Daten und Abo bleiben nach Neustart erhalten (kein zweites Abo), Datei nur für den Dienst lesbar', async () => {
  const subId = app.store.data.webhook.id;
  const creates = mock.state.creates;
  const n = invoices().length;
  await app.close();
  const port = await freePort();
  app = start(env(port), { log: quiet });
  await app.ready;
  api = `http://127.0.0.1:${port}`;
  assert.equal(invoices().length, n);
  // neue Adresse (anderer Port) → altes Abo gelöscht, neues angelegt
  assert.equal(mock.state.creates, creates + 1);
  assert.ok(!mock.state.subscriptions.has(subId));
  assert.equal(fs.statSync(path.join(dataDir, 'intake.json')).mode & 0o077, 0);
});

test('ohne PUBLIC_URL: kein Abo, Abgleich alle 5 min als Ersatz', async () => {
  const { loadConfig } = await import('../src/config.js');
  const cfg = loadConfig({ ...env(1), PUBLIC_URL: '', SWEEP_MINUTES: '' });
  assert.equal(cfg.webhook, false);
  assert.equal(cfg.sweepMinutes, 5);
  assert.equal(loadConfig(env(1)).sweepMinutes, 600);
  assert.equal(loadConfig({ ...env(1), SWEEP_MINUTES: '' , PUBLIC_URL: 'https://crm.example.de', ALLOW_HTTP_WEBHOOK: '' }).sweepMinutes, 60);
});

test('falsches Client-Secret → sauberer Fehler, Abo-Fehler sichtbar', async () => {
  const { createGraph } = await import('../src/graph.js');
  const { createIntake } = await import('../src/intake.js');
  const cfg = { ...app.cfg, clientSecret: 'falsch' };
  const intake = createIntake({ cfg, graph: createGraph(cfg), store: app.store, log: quiet });
  const run = await intake.sweep('test');
  assert.equal(run.ok, false);
  assert.match(run.problems[0], /Anmeldung bei Microsoft fehlgeschlagen/);
});

test('Microsoft erreicht den Server nicht → Abo gestört, Ersatz-Abgleich alle 5 min, im Status sichtbar', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-down-'));
  const port = await freePort();
  const dead = await freePort(); // hier lauscht niemand → Validierung schlägt fehl
  const app2 = start({ ...env(port), DATA_DIR: dir, PUBLIC_URL: `http://127.0.0.1:${dead}`, SWEEP_MINUTES: '60', SUBSCRIPTION_RETRY_SECONDS: '3600' }, { log: quiet });
  await app2.ready;
  const st = await (await fetch(`http://127.0.0.1:${port}/api/status`, { headers: { Authorization: 'Bearer ' + TOKEN } })).json();
  assert.equal(st.webhook.active, false);
  assert.match(st.webhook.error, /validation/i);
  assert.equal(st.sweepMinutes, 5);
  await app2.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
