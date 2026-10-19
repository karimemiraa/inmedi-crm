// Herzstück des Eingangs: Warteschlange je Nachricht, Sofort-Benachrichtigungen von Microsoft
// (Webhook-Abo inkl. automatischer Verlängerung) und Sicherheitsnetz-Abgleich.
//
//   Microsoft ──(neue Mail)──▶ /graph/notify ──▶ Warteschlange ──▶ processMessage ──▶ CRM (live)
//   Sicherheitsnetz: sweep() prüft den Ordner regelmäßig auf liegengebliebene Mails.
import crypto from 'node:crypto';
import { processMessage } from './processor.js';

const SUB_DAYS = 3;                      // Abo-Laufzeit (Microsoft erlaubt bei Mails max. ~7 Tage)
const RENEW_BEFORE = 24 * 3600 * 1000;   // verlängern, sobald weniger als 1 Tag übrig ist

const sameSecret = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const summary = (r) => (r.error ? 'Fehler: ' + r.error
  : [r.imported && `${r.imported} importiert`, r.review && `${r.review} zu prüfen`, r.duplicates && `${r.duplicates} Duplikat(e)`, r.errors && `${r.errors} unlesbar`, r.noPdf && 'keine PDF → „prüfen“'].filter(Boolean).join(', ') || 'nichts Neues');

export function createIntake({ cfg, graph, store, log = console, now = () => Date.now() }) {
  const listeners = new Set();
  const publish = (ev) => listeners.forEach((fn) => { try { fn(ev); } catch (e) { /* Client weg */ } });
  const state = { sweeping: null, working: null };

  // ---- Warteschlange: eine Nachricht nach der anderen, jede Nachricht nur einmal gleichzeitig ----
  const queue = [];
  const pending = new Map();
  async function handle(id, trigger) {
    const m = await graph.getMessage(id);
    if (!m) return null; // schon verschoben/gelöscht
    if (m.parentFolderId && m.parentFolderId !== await graph.sourceFolderId()) return null;
    const r = await processMessage({ cfg, graph, store }, m);
    store.addEvent({ at: new Date(now()).toISOString(), trigger, subject: m.subject || '', from: m.from?.emailAddress?.address || '', result: summary(r) });
    if (r.added.length) publish({ type: 'invoice', seq: store.data.seq, count: r.added.length });
    log.info?.(`[intake] ${trigger}: „${m.subject || ''}“ → ${summary(r)}`);
    return r;
  }
  function kick() {
    if (state.working || !queue.length) return;
    state.working = (async () => {
      while (queue.length) {
        const { id, trigger, resolve } = queue.shift();
        try { resolve({ result: await handle(id, trigger) }); }
        catch (e) {
          const error = e?.message || String(e);
          store.addEvent({ at: new Date(now()).toISOString(), trigger, subject: '', from: '', result: 'Fehler: ' + error });
          log.error?.('[intake] Fehler bei Nachricht:', error);
          resolve({ error });
        } finally { pending.delete(id); }
      }
    })().finally(() => { state.working = null; kick(); });
  }
  function enqueue(id, trigger) {
    if (pending.has(id)) return pending.get(id);
    let resolve;
    const p = new Promise((r) => { resolve = r; });
    pending.set(id, p);
    queue.push({ id, trigger, resolve });
    kick();
    return p;
  }

  // ---- Sicherheitsnetz / manueller Abgleich: alles, was noch im Quellordner liegt ----
  function sweep(trigger = 'Sicherheitsnetz') {
    if (state.sweeping) return state.sweeping;
    state.sweeping = (async () => {
      const run = { at: new Date(now()).toISOString(), trigger, messages: 0, imported: 0, review: 0, duplicates: 0, errors: 0, noPdf: 0, problems: [] };
      const started = now();
      try {
        const msgs = await graph.listMessages(cfg.maxPerRun);
        run.messages = msgs.length;
        const results = await Promise.all(msgs.map((m) => enqueue(m.id, trigger)));
        for (const x of results) {
          if (x.error) { run.errors++; run.problems.push(x.error); continue; }
          if (!x.result) continue;
          for (const k of ['imported', 'review', 'duplicates', 'errors', 'noPdf']) run[k] += x.result[k];
        }
        run.ok = true;
      } catch (e) {
        run.ok = false;
        run.problems.push(e?.message || String(e));
        log.error?.('[intake] Abgleich fehlgeschlagen:', e?.message || e);
      }
      run.ms = now() - started;
      store.addRun(run);
      return run;
    })().finally(() => { state.sweeping = null; });
    return state.sweeping;
  }

  // ---- Webhook-Abo bei Microsoft anlegen / verlängern / neu anlegen ----
  const urls = () => ({ notificationUrl: cfg.publicUrl + '/graph/notify', lifecycleNotificationUrl: cfg.publicUrl + '/graph/lifecycle' });
  async function ensureSubscription(force = false) {
    if (!cfg.webhook) return null;
    if (!store.data.webhook.clientState) store.setWebhook({ clientState: crypto.randomBytes(24).toString('hex') });
    const w = store.data.webhook;
    const { notificationUrl, lifecycleNotificationUrl } = urls();
    const resource = graph.resourceFor();
    const expirationDateTime = new Date(now() + SUB_DAYS * 864e5).toISOString();
    try {
      if (w.id && w.notificationUrl === notificationUrl && w.resource === resource) {
        if (!force && new Date(w.expiresAt).getTime() - now() > RENEW_BEFORE) return w;
        try {
          const r = await graph.renewSubscription(w.id, expirationDateTime);
          store.setWebhook({ expiresAt: r?.expirationDateTime || expirationDateTime, renewedAt: new Date(now()).toISOString(), error: null });
          log.info?.('[intake] Benachrichtigungs-Abo verlängert bis', store.data.webhook.expiresAt);
          return store.data.webhook;
        } catch (e) {
          if (e.status !== 404) throw e; // 404 → Abo existiert nicht mehr → neu anlegen
        }
      }
      if (w.id) await graph.deleteSubscription(w.id).catch(() => {});
      const sub = await graph.createSubscription({ changeType: 'created', notificationUrl, lifecycleNotificationUrl, resource, expirationDateTime, clientState: store.data.webhook.clientState });
      store.setWebhook({ id: sub.id, expiresAt: sub.expirationDateTime || expirationDateTime, notificationUrl, resource, createdAt: new Date(now()).toISOString(), error: null });
      log.info?.('[intake] Sofort-Benachrichtigung aktiv bis', store.data.webhook.expiresAt);
      return store.data.webhook;
    } catch (e) {
      store.setWebhook({ error: e?.message || String(e), errorAt: new Date(now()).toISOString() });
      log.error?.('[intake] Benachrichtigungs-Abo fehlgeschlagen:', e?.message || e);
      return null;
    }
  }

  // ---- Eingehende Microsoft-Aufrufe (Inhalt wird nie vertraut: nur die ID, Daten holt der Server selbst) ----
  const valid = (n) => sameSecret(n?.clientState, store.data.webhook.clientState) && (!store.data.webhook.id || n.subscriptionId === store.data.webhook.id);
  function onNotification(body) {
    const items = Array.isArray(body?.value) ? body.value : [];
    let accepted = 0;
    for (const n of items) {
      if (!valid(n)) continue;
      const id = n.resourceData?.id;
      if (!id) continue;
      accepted++;
      enqueue(id, 'sofort');
    }
    if (accepted) store.setWebhook({ lastNotificationAt: new Date(now()).toISOString() });
    return accepted;
  }
  function onLifecycle(body) {
    const items = Array.isArray(body?.value) ? body.value : [];
    let accepted = 0;
    for (const n of items) {
      if (!valid(n)) continue;
      accepted++;
      log.info?.('[intake] Microsoft meldet:', n.lifecycleEvent);
      if (n.lifecycleEvent === 'reauthorizationRequired') ensureSubscription(true);
      else if (n.lifecycleEvent === 'subscriptionRemoved') { store.setWebhook({ id: null }); ensureSubscription(true); }
      else if (n.lifecycleEvent === 'missed') sweep('nachholen');
    }
    return accepted;
  }

  return {
    sweep, enqueue, ensureSubscription, onNotification, onLifecycle,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get clients() { return listeners.size; },
    get busy() { return !!(state.working || state.sweeping); },
    idle: async () => { while (state.working || state.sweeping) await (state.sweeping || state.working); },
  };
}
