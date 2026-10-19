// Start: HTTP-Schnittstelle, Microsoft-Sofort-Benachrichtigung (Webhook) und Sicherheitsnetz-Abgleich.
import { loadConfig, validateConfig } from './config.js';
import { openStore } from './store.js';
import { createGraph } from './graph.js';
import { createIntake } from './intake.js';
import { createApi } from './api.js';

const MAINTAIN_MS = 30 * 60_000; // Abo alle 30 min prüfen/verlängern

export function start(env = process.env, { log = console } = {}) {
  const cfg = loadConfig(env);
  const problems = validateConfig(cfg);
  problems.forEach((p) => log.warn?.('[config]', p));
  if (!cfg.apiToken || cfg.apiToken.length < 24) throw new Error('Start abgebrochen: ' + problems[0]);

  const store = openStore(cfg.dataDir);
  const graph = cfg.mailConfigured ? createGraph(cfg) : null;
  const intake = graph ? createIntake({ cfg, graph, store, log }) : null;
  const state = { nextSweepAt: null, timers: [] };

  const server = createApi({ cfg, store, intake, state });
  const ready = new Promise((resolve) => server.listen(cfg.port, cfg.host, resolve)).then(async () => {
    log.info?.(`[intake] API auf http://${cfg.host}:${server.address().port} · Postfach: ${cfg.mailbox || '(nicht konfiguriert)'} · ${cfg.webhook ? 'Sofort-Benachrichtigung über ' + cfg.publicUrl : 'ohne Sofort-Benachrichtigung'} · Sicherheitsnetz alle ${cfg.sweepMinutes} min`);
    if (!intake) return;
    // Erst wenn der Server lauscht: Microsoft prüft die Adresse beim Anlegen des Abos sofort.
    // Schlägt das fehl (z. B. HTTPS-Proxy startet nach diesem Dienst), bald erneut versuchen.
    const retryBase = (Number(env.SUBSCRIPTION_RETRY_SECONDS) || 60) * 1000;
    let retry = retryBase;
    const subscribe = async () => {
      const ok = await intake.ensureSubscription();
      if (cfg.webhook && !ok) {
        state.timers[2] = setTimeout(subscribe, retry);
        retry = Math.min(retry * 2, MAINTAIN_MS);
      } else retry = retryBase;
    };
    await subscribe();
    const wasActive = () => !!(store.data.webhook?.id && !store.data.webhook?.error);
    let active = wasActive();
    await intake.sweep('Start'); // alles nachholen, was während einer Pause ankam
    // Sofort-Benachrichtigung aktiv → seltener Kontroll-Abgleich; gestört → alle 5 min als Ersatz
    const sweepEvery = () => {
      const w = store.data.webhook || {};
      return cfg.webhook && w.id && !w.error ? cfg.sweepMinutes : Math.min(cfg.sweepMinutes, 5);
    };
    const sweepLoop = () => {
      state.sweepMinutes = sweepEvery();
      state.nextSweepAt = new Date(Date.now() + state.sweepMinutes * 60_000).toISOString();
      state.timers[0] = setTimeout(async () => { await intake.sweep(); sweepLoop(); }, state.sweepMinutes * 60_000);
    };
    sweepLoop();
    if (cfg.webhook) state.timers[1] = setInterval(subscribe, MAINTAIN_MS);
    // Wechselt der Zustand (gestört ↔ aktiv), Abgleich-Takt sofort anpassen
    state.timers[3] = setInterval(() => {
      if (wasActive() !== active) { active = wasActive(); clearTimeout(state.timers[0]); sweepLoop(); }
    }, 30_000);
  });

  return {
    cfg, store, server, intake, ready,
    async close() {
      state.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
      server.closeLive();
      if (intake) await intake.idle();
      await new Promise((r) => server.close(r));
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = start();
  const stop = async () => { await app.close(); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
