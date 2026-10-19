// HTTP-Schnittstelle. Läuft hinter Caddy (HTTPS), das auch das CRM selbst ausliefert.
//   /graph/notify, /graph/lifecycle – Aufrufe von Microsoft (abgesichert über clientState)
//   /api/*                          – für das CRM (Bearer-Token, CORS nur für das CRM)
//   /health                         – Erreichbarkeit, ohne Daten
import http from 'node:http';
import crypto from 'node:crypto';

export const VERSION = '2.0.0';
const MAX_BODY = 1024 * 1024;

const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('zu groß')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

export function createApi({ cfg, store, intake, state }) {
  const tokenBuf = Buffer.from(cfg.apiToken);
  const authorized = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return false;
    const given = Buffer.from(m[1]);
    return given.length === tokenBuf.length && crypto.timingSafeEqual(given, tokenBuf);
  };
  const cors = (origin) => (origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' } : {});
  const send = (res, status, body, origin) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin', ...cors(origin) });
    res.end(body === null ? '' : JSON.stringify(body));
  };
  const counts = () => store.data.invoices.reduce((c, i) => { c[i.status] = (c[i.status] || 0) + 1; return c; }, {});
  const sseClients = new Set();

  const server = http.createServer(async (req, res) => {
    const origin = cfg.allowedOrigins.includes(req.headers.origin) ? req.headers.origin : null;
    const url = new URL(req.url, 'http://localhost');
    try {
      // ---- Microsoft: Validierung (Echo des Tokens) und Benachrichtigungen ----
      if (url.pathname === '/graph/notify' || url.pathname === '/graph/lifecycle') {
        if (req.method !== 'POST') return send(res, 405, { error: 'Nur POST' });
        const token = url.searchParams.get('validationToken');
        if (token !== null) {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
          return res.end(token);
        }
        let body = {};
        try { body = JSON.parse(await readBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'Ungültig' }); }
        res.writeHead(202); res.end(); // Microsoft erwartet die Antwort innerhalb von 3 s – Verarbeitung danach
        if (!intake) return;
        if (url.pathname === '/graph/notify') intake.onNotification(body); else intake.onLifecycle(body);
        return;
      }

      if (req.method === 'OPTIONS') return send(res, 204, null, origin);
      if (url.pathname === '/health' && req.method === 'GET') {
        const last = store.data.runs[0];
        return send(res, 200, { ok: true, service: 'inmedi-intake', version: VERSION, lastRun: last ? { at: last.at, ok: last.ok } : null }, origin);
      }
      if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Nicht gefunden' }, origin);
      if (!authorized(req)) return send(res, 401, { error: 'Nicht autorisiert' }, origin);

      if (url.pathname === '/api/invoices' && req.method === 'GET') {
        const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));
        return send(res, 200, store.since(since, limit), origin);
      }
      if (url.pathname === '/api/status' && req.method === 'GET') {
        const w = store.data.webhook || {};
        return send(res, 200, {
          version: VERSION, mailbox: cfg.mailbox || null, mailConfigured: cfg.mailConfigured,
          mode: !cfg.mailConfigured ? 'aus' : cfg.webhook ? 'sofort' : 'abgleich',
          webhook: cfg.webhook ? { active: !!w.id && !w.error, expiresAt: w.expiresAt || null, renewedAt: w.renewedAt || w.createdAt || null, lastNotificationAt: w.lastNotificationAt || null, error: w.error || null, url: cfg.publicUrl } : null,
          sweepMinutes: state.sweepMinutes || cfg.sweepMinutes, nextSweepAt: state.nextSweepAt, liveClients: sseClients.size,
          runs: store.data.runs.slice(0, 20), events: store.data.events.slice(0, 30), counts: counts(), total: store.data.invoices.length, seq: store.data.seq,
        }, origin);
      }
      if (url.pathname === '/api/run' && req.method === 'POST') {
        if (!intake) return send(res, 409, { error: 'Microsoft-Zugang ist auf dem Server nicht konfiguriert' }, origin);
        return send(res, 200, { run: await intake.sweep('manuell') }, origin);
      }
      // Live-Kanal (Server-Sent Events): das CRM erfährt sofort von neuen Rechnungen
      if (url.pathname === '/api/events' && req.method === 'GET') {
        if (sseClients.size >= 200) return send(res, 503, { error: 'Zu viele Verbindungen' }, origin);
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no', Vary: 'Origin', ...cors(origin) });
        res.write(`event: hello\ndata: ${JSON.stringify({ seq: store.data.seq })}\n\n`);
        const unsub = intake ? intake.subscribe((ev) => res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`)) : () => {};
        const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
        const client = { res, close: () => { clearInterval(ping); unsub(); sseClients.delete(client); } };
        sseClients.add(client);
        req.on('close', client.close);
        return;
      }
      return send(res, 404, { error: 'Nicht gefunden' }, origin);
    } catch (e) {
      console.error('[api]', e);
      if (!res.headersSent) send(res, 500, { error: 'Interner Fehler' }, origin);
    }
  });
  server.closeLive = () => { for (const c of sseClients) { c.close(); c.res.end(); } };
  return server;
}
