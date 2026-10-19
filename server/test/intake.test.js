// Ende-zu-Ende-Test des Rechnungseingangs gegen ein nachgebildetes Microsoft-365-Postfach.
// Start: cd server && npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMockGraph } from './mockGraph.js';
import { invoicePdf } from './makePdf.js';
import { start } from '../src/index.js';

const TOKEN = 'test-token-0123456789abcdefghij';
let mock, app, api, dataDir;

before(async () => {
  mock = await startMockGraph();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));
  app = start({
    MS_TENANT_ID: 'tenant', MS_CLIENT_ID: 'client', MS_CLIENT_SECRET: 'secret', MAILBOX: 'rechnungen@inmedi.de',
    API_TOKEN: TOKEN, PORT: '0', DATA_DIR: dataDir, POLL_MINUTES: '60', ALLOWED_ORIGINS: 'https://karimemiraa.github.io',
    GRAPH_BASE: mock.graphBase, LOGIN_BASE: mock.loginBase,
  });
  await new Promise((r) => (app.server.listening ? r() : app.server.once('listening', r)));
  api = `http://127.0.0.1:${app.server.address().port}`;
  await app.trigger(); // erster Lauf beim Start (leeres Postfach)
});
after(async () => { await app.close(); await mock.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const get = (p, headers = {}) => fetch(api + p, { headers: { Authorization: 'Bearer ' + TOKEN, ...headers } });

test('saubere Rechnung wird importiert und die Mail nach „Rechnungen verarbeitet“ verschoben', async () => {
  mock.deliver('Rechnung 9104711', [{ name: 'RE_9104711.pdf', bytes: invoicePdf({ nr: '9104711', kdnr: '10001', items: [['OTSC Clip 12/6t', 2, 395], ['EasyScope Set', 1, 1240.5]] }) }]);
  const run = await app.trigger();
  assert.equal(run.ok, true);
  assert.equal(run.imported, 1);
  const inv = app.store.data.invoices.at(-1);
  assert.equal(inv.status, 'ok');
  assert.equal(inv.rechnungsnummer, '9104711');
  assert.equal(inv.kundennummer, '10001');
  assert.equal(inv.items.length, 2);
  assert.equal(inv.netto, 2030.5);
  assert.equal(inv.gesamt, 2416.3);
  assert.equal(inv.from, 'buchhaltung@ovesco.com');
  assert.equal(mock.folder('Rechnungen verarbeitet').messages.length, 1);
  assert.equal(mock.state.folders[0].messages.length, 0);
});

test('gleiche Datei erneut → kein zweiter Eintrag; gleiche Rechnungsnr. → als Duplikat markiert', async () => {
  const before = app.store.data.invoices.length;
  mock.deliver('Nochmal', [{ name: 'RE_9104711.pdf', bytes: invoicePdf({ nr: '9104711', kdnr: '10001', items: [['OTSC Clip 12/6t', 2, 395], ['EasyScope Set', 1, 1240.5]] }) }]);
  mock.deliver('Korrigierte Kopie', [{ name: 'RE_9104711_kopie.pdf', bytes: invoicePdf({ nr: '9104711', kdnr: '10001', datum: '06.10.2026' }) }]);
  const run = await app.trigger();
  assert.equal(run.duplicates, 2);
  assert.equal(app.store.data.invoices.length, before + 1); // nur der Duplikat-Hinweis
  assert.equal(app.store.data.invoices.at(-1).status, 'duplikat');
});

test('unklare Rechnung (Kundennummer fehlt) → „pruefen“, Mail nach „Rechnungen prüfen“', async () => {
  mock.deliver('Rechnung ohne Kdnr', [{ name: 'RE_9200001.pdf', bytes: invoicePdf({ nr: '9200001', kdnr: '' }) }]);
  const run = await app.trigger();
  assert.equal(run.review, 1);
  const inv = app.store.data.invoices.at(-1);
  assert.equal(inv.status, 'pruefen');
  assert.ok(inv.problems.some((p) => /Kundennummer/.test(p)));
  assert.equal(mock.folder('Rechnungen prüfen').messages.length, 1);
});

test('defekte PDF → Eintrag „fehler“ (nichts geht verloren); Mail ohne PDF → „Rechnungen prüfen“', async () => {
  mock.deliver('Kaputt', [{ name: 'kaputt.pdf', bytes: Buffer.from('%PDF-1.4 das ist keine echte pdf') }]);
  mock.deliver('Nur Logo', [{ name: 'logo.png', contentType: 'image/png', bytes: Buffer.from('png'), isInline: true }]);
  const run = await app.trigger();
  assert.equal(run.errors, 1);
  assert.equal(run.noPdf, 1);
  const inv = app.store.data.invoices.at(-1);
  assert.equal(inv.status, 'fehler');
  assert.equal(inv.subject, 'Kaputt');
  assert.equal(mock.folder('Rechnungen prüfen').messages.length, 3);
});

test('mehrere PDFs in einer Mail werden alle verarbeitet; Drosselung (429) wird abgewartet', async () => {
  mock.deliver('Sammelrechnung', [
    { name: 'a.pdf', bytes: invoicePdf({ nr: '9300001', kdnr: '10002' }) },
    { name: 'b.pdf', bytes: invoicePdf({ nr: '9300002', kdnr: '10003' }) },
  ]);
  mock.state.failNext429 = 1;
  const run = await app.trigger();
  assert.equal(run.imported, 2);
  assert.equal(mock.state.tokenCalls, 1, 'Token wird zwischengespeichert');
});

test('API: Token Pflicht, CORS nur für das CRM, inkrementeller Abruf', async () => {
  assert.equal((await fetch(api + '/api/invoices')).status, 401);
  assert.equal((await fetch(api + '/api/invoices', { headers: { Authorization: 'Bearer falsch' } })).status, 401);
  const health = await (await fetch(api + '/health')).json();
  assert.equal(health.ok, true);
  assert.ok(!JSON.stringify(health).includes('rechnungen@'), 'health verrät nichts');

  const ok = await get('/api/invoices?since=0', { Origin: 'https://karimemiraa.github.io' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://karimemiraa.github.io');
  const all = await ok.json();
  assert.equal(all.invoices.length, app.store.data.invoices.length);
  const other = await get('/api/invoices?since=0', { Origin: 'https://evil.example' });
  assert.equal(other.headers.get('access-control-allow-origin'), null);

  const page = await (await get('/api/invoices?since=0&limit=2')).json();
  assert.equal(page.invoices.length, 2);
  assert.equal(page.more, true);
  const rest = await (await get('/api/invoices?since=' + page.seq)).json();
  assert.equal(rest.invoices[0].seq, page.seq + 1);
  const none = await (await get('/api/invoices?since=' + all.seq)).json();
  assert.equal(none.invoices.length, 0);

  const pre = await fetch(api + '/api/invoices', { method: 'OPTIONS', headers: { Origin: 'https://karimemiraa.github.io' } });
  assert.equal(pre.status, 204);

  const st = await (await get('/api/status')).json();
  assert.equal(st.mailConfigured, true);
  assert.ok(st.runs.length >= 5);
  assert.equal(st.counts.ok, 3);
});

test('Daten bleiben nach Neustart erhalten, Datei nur für den Dienst lesbar', async () => {
  const file = path.join(dataDir, 'intake.json');
  const { openStore } = await import('../src/store.js');
  const reopened = openStore(dataDir);
  assert.equal(reopened.data.invoices.length, app.store.data.invoices.length);
  assert.equal(reopened.data.seq, app.store.data.seq);
  assert.equal(reopened.since(0, 500).invoices.at(-1).rechnungsnummer, app.store.data.invoices.at(-1).rechnungsnummer);
  assert.equal(fs.statSync(file).mode & 0o077, 0);
});

test('falsches Client-Secret → Lauf schlägt sauber fehl', async () => {
  const { runOnce } = await import('../src/processor.js');
  const { createGraph } = await import('../src/graph.js');
  const cfg = { ...app.cfg, clientSecret: 'falsch' };
  const run = await runOnce({ cfg, graph: createGraph(cfg), store: app.store, log: {} });
  assert.equal(run.ok, false);
  assert.match(run.problems[0], /Anmeldung bei Microsoft fehlgeschlagen/);
});
