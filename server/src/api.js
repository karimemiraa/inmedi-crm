// HTTP-Schnittstelle für das CRM. Läuft hinter einem HTTPS-Reverse-Proxy (Caddy) und ist
// per Bearer-Token geschützt; CORS nur für die CRM-Adresse.
import http from 'node:http';
import crypto from 'node:crypto';

const VERSION = '1.0.0';

export function createApi({ cfg, store, trigger, state }) {
  const tokenBuf = Buffer.from(cfg.apiToken);
  const authorized = (req) => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return false;
    const given = Buffer.from(m[1]);
    return given.length === tokenBuf.length && crypto.timingSafeEqual(given, tokenBuf);
  };
  const send = (res, status, body, origin) => {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
    if (origin) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '600' });
    res.writeHead(status, headers);
    res.end(body === null ? '' : JSON.stringify(body));
  };
  const counts = () => store.data.invoices.reduce((c, i) => { c[i.status] = (c[i.status] || 0) + 1; return c; }, {});

  return http.createServer(async (req, res) => {
    const origin = cfg.allowedOrigins.includes(req.headers.origin) ? req.headers.origin : null;
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'OPTIONS') return send(res, 204, null, origin);
      if (url.pathname === '/health' && req.method === 'GET') {
        const last = store.data.runs[0];
        return send(res, 200, { ok: true, version: VERSION, lastRun: last ? { at: last.at, ok: last.ok } : null }, origin);
      }
      if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Nicht gefunden' }, origin);
      if (!authorized(req)) return send(res, 401, { error: 'Nicht autorisiert' }, origin);

      if (url.pathname === '/api/invoices' && req.method === 'GET') {
        const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));
        return send(res, 200, store.since(since, limit), origin);
      }
      if (url.pathname === '/api/status' && req.method === 'GET') {
        return send(res, 200, {
          version: VERSION, mailbox: cfg.mailbox || null, mailConfigured: cfg.mailConfigured, pollMinutes: cfg.pollMinutes,
          running: state.running, nextRunAt: state.nextRunAt, runs: store.data.runs.slice(0, 20), counts: counts(), total: store.data.invoices.length, seq: store.data.seq,
        }, origin);
      }
      if (url.pathname === '/api/run' && req.method === 'POST') {
        if (!cfg.mailConfigured) return send(res, 409, { error: 'Microsoft-Zugang ist auf dem Server nicht konfiguriert' }, origin);
        const run = await trigger();
        return send(res, 200, { run }, origin);
      }
      return send(res, 404, { error: 'Nicht gefunden' }, origin);
    } catch (e) {
      console.error('[api]', e);
      return send(res, 500, { error: 'Interner Fehler' }, origin);
    }
  });
}
