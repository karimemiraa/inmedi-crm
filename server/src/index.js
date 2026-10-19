// Start: HTTP-Schnittstelle + Abruf des Postfachs alle POLL_MINUTES Minuten.
import { loadConfig, validateConfig } from './config.js';
import { openStore } from './store.js';
import { createGraph } from './graph.js';
import { runOnce } from './processor.js';
import { createApi } from './api.js';

export function start(env = process.env) {
  const cfg = loadConfig(env);
  const problems = validateConfig(cfg);
  problems.forEach((p) => console.warn('[config]', p));
  if (!cfg.apiToken || cfg.apiToken.length < 24) throw new Error('Start abgebrochen: ' + problems[0]);

  const store = openStore(cfg.dataDir);
  const graph = cfg.mailConfigured ? createGraph(cfg) : null;
  const state = { running: null, nextRunAt: null, timer: null };

  // Nie zwei Durchläufe gleichzeitig; ein manueller Start wartet auf den laufenden.
  const trigger = () => {
    if (!graph) return Promise.resolve(null);
    if (!state.running) state.running = runOnce({ cfg, graph, store }).finally(() => { state.running = null; });
    return state.running;
  };
  const schedule = () => {
    state.nextRunAt = new Date(Date.now() + cfg.pollMinutes * 60_000).toISOString();
    state.timer = setTimeout(async () => { await trigger(); schedule(); }, cfg.pollMinutes * 60_000);
  };

  const server = createApi({ cfg, store, trigger, state });
  server.listen(cfg.port, cfg.host, () => {
    console.log(`[intake] API auf http://${cfg.host}:${server.address().port} · Postfach: ${cfg.mailbox || '(nicht konfiguriert)'} · alle ${cfg.pollMinutes} min`);
  });
  if (graph) { trigger(); schedule(); }

  return {
    cfg, store, server, trigger,
    async close() { clearTimeout(state.timer); await state.running; await new Promise((r) => server.close(r)); },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = start();
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
