// KI-Einstellungen – bewusst NICHT im CRM-Datenbestand (store), damit API-Schlüssel
// weder im JSON-Export noch in geteilten Daten landen. Nur in diesem Browser gespeichert.
import { useSyncExternalStore } from 'react';

const KEY = 'inmedi-ai-settings';

export const PROVIDERS = {
  local: { label: 'Ohne KI (lokale Auswertung)', hint: 'Kein API-Schlüssel nötig. Strukturierte Auswertungen direkt aus den CRM-Daten – keine Daten verlassen den Browser.' },
  anthropic: { label: 'Claude (Anthropic)', hint: 'Empfohlen für tiefe Analysen. Schlüssel unter console.anthropic.com.' },
  gemini: { label: 'Google Gemini', hint: 'Schlüssel unter aistudio.google.com.' },
  openai: { label: 'OpenAI-kompatibel', hint: 'OpenAI, Mistral, OpenRouter, Azure, lokales Ollama … – Basis-URL + Modell angeben.' },
};

export const CLAUDE_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 – stärkste Analyse (Standard)'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 – schnell, günstiger'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 – sehr günstig, einfache Fragen'],
];
export const EFFORTS = [['low', 'Schnell'], ['medium', 'Ausgewogen'], ['high', 'Gründlich (Standard)'], ['xhigh', 'Sehr gründlich']];

export const DEFAULTS = {
  provider: 'local',
  anthropic: { apiKey: '', model: 'claude-opus-5-5', effort: 'high' },
  gemini: { apiKey: '', model: 'gemini-2.5-pro' },
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1' },
  pseudonymize: false,
  proxyUrl: '', // später: eigener Proxy, der die Schlüssel serverseitig hält
};

const listeners = new Set();
let cache = null;
function read() {
  if (cache) return cache;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  cache = {
    ...DEFAULTS, ...saved,
    anthropic: { ...DEFAULTS.anthropic, ...(saved.anthropic || {}) },
    gemini: { ...DEFAULTS.gemini, ...(saved.gemini || {}) },
    openai: { ...DEFAULTS.openai, ...(saved.openai || {}) },
  };
  return cache;
}
export const getAiSettings = () => read();
export function saveAiSettings(patch) {
  cache = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) {}
  listeners.forEach((l) => l());
}
export function useAiSettings() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, read);
}
export function providerReady(s = read()) {
  if (s.provider === 'local') return true;
  if (s.provider === 'openai') return !!s.openai.baseUrl && !!s.openai.model;
  return !!s[s.provider]?.apiKey || !!s.proxyUrl;
}
export const providerLabel = (s = read()) => {
  if (s.provider === 'anthropic') return CLAUDE_MODELS.find(([id]) => id === s.anthropic.model)?.[1].split(' – ')[0] || s.anthropic.model;
  if (s.provider === 'gemini') return 'Gemini · ' + s.gemini.model;
  if (s.provider === 'openai') return s.openai.model;
  return 'Ohne KI';
};
