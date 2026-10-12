// Gemeinsamer Gesprächszustand für Seitenleiste und Assistent-Seite (bleibt bei Navigation erhalten).
import { useSyncExternalStore } from 'react';
import { ask, newConversation } from './agent.js';
import { applyAction } from './tools.js';
import { getAiSettings, providerLabel } from './settings.js';

let state = { items: [], busy: false, usage: null };
let conversation = null;
let controller = null;
let seq = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const set = (patch) => { state = { ...state, ...patch }; emit(); };
const updateItem = (id, fn) => set({ items: state.items.map((it) => (it.id === id ? fn(it) : it)) });

export function useChat() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

export async function send(question, context) {
  const q = question.trim();
  if (!q || state.busy) return;
  const settings = getAiSettings();
  const switched = conversation && conversation.provider !== settings.provider;
  if (!conversation || switched) conversation = newConversation(settings);
  const conv = conversation;
  const user = { id: ++seq, role: 'user', text: q, context };
  const bot = { id: ++seq, role: 'assistant', text: '', tools: [], actions: [], status: 'running', provider: providerLabel(settings), reveal: (t) => conv.privacy.reveal(t), note: switched ? 'Anbieter gewechselt – neues Gespräch begonnen.' : null };
  set({ items: [...state.items, user, bot], busy: true });
  controller = new AbortController();
  try {
    await ask({
      conversation: conv, settings, question: q, context, signal: controller.signal,
      cb: {
        text: (d) => updateItem(bot.id, (it) => ({ ...it, text: it.text + d })),
        tool: (name, input) => updateItem(bot.id, (it) => ({ ...it, tools: [...it.tools, { name, input }] })),
        action: (name, input) => updateItem(bot.id, (it) => ({ ...it, actions: [...it.actions, { id: ++seq, name, input, state: 'pending' }] })),
        usage: (u) => set({ usage: { ...u } }),
      },
    });
    updateItem(bot.id, (it) => ({ ...it, status: 'done', text: it.text.trim() || '_Keine Antwort erhalten._' }));
  } catch (e) {
    const aborted = controller.signal.aborted;
    updateItem(bot.id, (it) => ({ ...it, status: aborted ? 'stopped' : 'error', error: aborted ? null : (e?.message || String(e)), hint: e?.hint }));
  } finally {
    controller = null;
    set({ busy: false });
  }
}

export const stop = () => controller?.abort();
export function reset() { stop(); conversation = null; set({ items: [], busy: false, usage: null }); }

export function runAction(itemId, actionId) {
  const it = state.items.find((x) => x.id === itemId);
  const a = it?.actions.find((x) => x.id === actionId);
  if (!a || a.state !== 'pending') return null;
  const res = applyAction(a.name, a.input);
  updateItem(itemId, (x) => ({ ...x, actions: x.actions.map((y) => (y.id === actionId ? { ...y, state: res ? 'done' : 'failed', result: res } : y)) }));
  return res;
}
export function dismissAction(itemId, actionId) {
  updateItem(itemId, (x) => ({ ...x, actions: x.actions.map((y) => (y.id === actionId ? { ...y, state: 'dismissed' } : y)) }));
}

// Von überall öffnen, z. B. Button „Gesprächsvorbereitung“ auf der Firmenseite
export function openAssistant(prompt, context) {
  window.dispatchEvent(new CustomEvent('inmedi-ai-open', { detail: { prompt, context } }));
}
