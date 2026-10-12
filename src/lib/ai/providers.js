// Anbindung der KI-Anbieter. Jeder Anbieter führt dieselbe Schleife aus:
// Frage → Modell ruft Datenwerkzeuge auf → lokale Ausführung → Ergebnis zurück → Antwort.
// Der Gesprächsverlauf wird im jeweiligen Anbieterformat unverändert fortgeschrieben.
import Anthropic from '@anthropic-ai/sdk';

const MAX_STEPS = 12; // Sicherheitsgrenze für Werkzeugaufrufe je Frage

// Eingaben des Modells gegen das Werkzeug-Schema prüfen (Pflichtfelder, Typen, Enums).
export function validateInput(schema, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Eingabe ist kein Objekt';
  for (const req of schema.required || []) if (input[req] === undefined || input[req] === null || input[req] === '') return `Pflichtfeld fehlt: ${req}`;
  for (const [k, v] of Object.entries(input)) {
    const p = schema.properties?.[k];
    if (!p) continue;
    if (p.type === 'string' && typeof v !== 'string') return `${k} muss Text sein`;
    if (p.type === 'integer' && !Number.isInteger(typeof v === 'string' ? Number(v) : v)) return `${k} muss eine ganze Zahl sein`;
    if (p.enum && !p.enum.includes(v)) return `${k} muss einer von ${p.enum.join(', ')} sein`;
  }
  return null;
}
const normalize = (schema, input) => Object.fromEntries(Object.entries(input || {}).map(([k, v]) => [k, schema.properties?.[k]?.type === 'integer' && typeof v === 'string' ? Number(v) : v]));

export class ProviderError extends Error {
  constructor(message, hint) { super(message); this.hint = hint; }
}

// ---------------- Claude (offizielles Anthropic SDK) ----------------
export async function runAnthropic({ cfg, proxyUrl, system, history, tools, exec, cb, signal }) {
  const client = new Anthropic({ apiKey: cfg.apiKey || 'proxy', baseURL: proxyUrl || undefined, dangerouslyAllowBrowser: true, maxRetries: 2 });
  const toolDefs = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.schema, eager_input_streaming: true }));
  // Ablehnungs-Fallback: bei einer Sicherheitsablehnung übernimmt serverseitig das empfohlene Modell.
  // Claude Haiku 5.5 hat keinen serverseitigen Fallback – dort Parameter weglassen.
  const fallback = cfg.model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
  const usage = { input: 0, output: 0, cached: 0 };
  let jsonRetries = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.beta.messages.stream({
      model: cfg.model,
      max_tokens: 16000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      ...(toolDefs.length ? { tools: toolDefs } : {}),
      messages: history,
      thinking: { type: 'adaptive' },
      output_config: { effort: cfg.effort || 'high' },
      ...fallback,
    }, { signal });
    stream.on('text', (delta) => cb.text(delta));
    let message;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (signal?.aborted) throw err;
      if (err instanceof Anthropic.AuthenticationError) throw new ProviderError('API-Schlüssel ungültig (401).', 'Bitte den Schlüssel unter Einstellungen → KI-Assistent prüfen.');
      if (err instanceof Anthropic.PermissionDeniedError) throw new ProviderError('Zugriff verweigert (403).', 'Hat der Schlüssel Zugriff auf dieses Modell?');
      if (err instanceof Anthropic.RateLimitError) throw new ProviderError('Anfragelimit erreicht (429).', 'Bitte kurz warten und erneut versuchen.');
      if (err instanceof Anthropic.BadRequestError) throw new ProviderError('Anfrage abgelehnt (400): ' + err.message);
      if (err instanceof Anthropic.APIConnectionError) throw new ProviderError('Keine Verbindung zur Anthropic-API.', 'Internetverbindung oder Firewall/Proxy prüfen.');
      if (err instanceof Anthropic.APIError) throw new ProviderError(`Anthropic-API-Fehler ${err.status ?? ''}: ${err.message}`);
      if (jsonRetries++ >= 2) throw err; // Werkzeug-Eingabe war kein gültiges JSON – Runde neu anfordern
      continue;
    }
    usage.input += message.usage?.input_tokens || 0;
    usage.output += message.usage?.output_tokens || 0;
    usage.cached += message.usage?.cache_read_input_tokens || 0;
    cb.usage?.(usage);

    if (message.stop_reason === 'refusal') {
      history.push({ role: 'assistant', content: message.content });
      cb.text('\n\n_Die Anfrage wurde vom Modell aus Sicherheitsgründen abgelehnt. Bitte anders formulieren._');
      return;
    }
    if (message.stop_reason === 'pause_turn') { history.push({ role: 'assistant', content: message.content }); continue; }
    const uses = message.content.filter((b) => b.type === 'tool_use');
    history.push({ role: 'assistant', content: message.content }); // unverändert anhängen (Denkblöcke bleiben gültig)
    if (message.stop_reason === 'max_tokens') { cb.text('\n\n_Antwort wurde wegen Längenbegrenzung gekürzt._'); return; }
    if (!uses.length) return;
    cb.text('\n\n');
    const results = uses.map((u) => {
      const def = tools.find((t) => t.name === u.name);
      const problem = def ? validateInput(def.schema, u.input) : 'Unbekanntes Werkzeug';
      if (problem) return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: problem };
      return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(exec(u.name, normalize(def.schema, u.input))) };
    });
    history.push({ role: 'user', content: results }); // alle Ergebnisse in EINER Nachricht
  }
  cb.text('\n\n_Maximale Anzahl an Analyse-Schritten erreicht._');
}

// ---------------- Google Gemini (REST, Function Calling) ----------------
const geminiSchema = (s) => {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (!s || typeof s !== 'object') return s;
  const { additionalProperties, ...rest } = s; // von Gemini nicht unterstützt
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, geminiSchema(v)]));
};
export async function runGemini({ cfg, proxyUrl, system, history, tools, exec, cb, signal }) {
  const usage = { input: 0, output: 0, cached: 0 };
  const base = (proxyUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const url = `${base}/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  const body = (contents) => ({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    ...(tools.length ? { tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.schema) })) }] } : {}),
  });
  for (let step = 0; step < MAX_STEPS; step++) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { 'x-goog-api-key': cfg.apiKey } : {}) }, body: JSON.stringify(body(history)) });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new ProviderError('Keine Verbindung zur Gemini-API.', 'Internetverbindung prüfen.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ProviderError(`Gemini-API-Fehler ${res.status}: ${data?.error?.message || res.statusText}`, res.status === 400 || res.status === 403 ? 'Schlüssel und Modellname prüfen.' : undefined);
    const cand = data.candidates?.[0];
    if (!cand?.content) {
      cb.text(`_Keine Antwort von Gemini (${cand?.finishReason || data.promptFeedback?.blockReason || 'unbekannt'})._`);
      return;
    }
    const parts = cand.content.parts || [];
    history.push({ role: 'model', parts }); // unverändert (enthält ggf. Denk-Signaturen)
    const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
    if (text) cb.text(text);
    const calls = parts.filter((p) => p.functionCall);
    const u = data.usageMetadata;
    if (u) { usage.input += u.promptTokenCount || 0; usage.output += u.candidatesTokenCount || 0; usage.cached += u.cachedContentTokenCount || 0; cb.usage?.(usage); }
    if (!calls.length) return;
    cb.text('\n\n');
    history.push({
      role: 'user',
      parts: calls.map(({ functionCall: fc }) => {
        const def = tools.find((t) => t.name === fc.name);
        const problem = def ? validateInput(def.schema, fc.args || {}) : 'Unbekanntes Werkzeug';
        return { functionResponse: { name: fc.name, response: problem ? { error: problem } : { result: exec(fc.name, normalize(def.schema, fc.args || {})) } } };
      }),
    });
  }
  cb.text('\n\n_Maximale Anzahl an Analyse-Schritten erreicht._');
}

// ---------------- OpenAI-kompatibel (Chat Completions + Tools) ----------------
export async function runOpenAI({ cfg, proxyUrl, system, history, tools, exec, cb, signal }) {
  const usage = { input: 0, output: 0, cached: 0 };
  const base = (proxyUrl || cfg.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new ProviderError('Basis-URL fehlt.', 'Einstellungen → KI-Assistent.');
  for (let step = 0; step < MAX_STEPS; step++) {
    let res;
    try {
      res = await fetch(base + '/chat/completions', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', ...(cfg.apiKey ? { Authorization: 'Bearer ' + cfg.apiKey } : {}) },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: 'system', content: system }, ...history],
          ...(tools.length ? { tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.schema } })) } : {}),
        }),
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new ProviderError('Keine Verbindung zu ' + base + '.', 'Basis-URL prüfen. Lokales Ollama: Browser-Zugriff mit OLLAMA_ORIGINS erlauben.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ProviderError(`API-Fehler ${res.status}: ${data?.error?.message || res.statusText}`, res.status === 401 ? 'API-Schlüssel prüfen.' : undefined);
    const msg = data.choices?.[0]?.message;
    if (!msg) { cb.text('_Keine Antwort erhalten._'); return; }
    history.push(msg);
    if (msg.content) cb.text(msg.content);
    if (data.usage) { usage.input += data.usage.prompt_tokens || 0; usage.output += data.usage.completion_tokens || 0; cb.usage?.(usage); }
    const calls = msg.tool_calls || [];
    if (!calls.length) return;
    cb.text('\n\n');
    for (const c of calls) {
      const def = tools.find((t) => t.name === c.function?.name);
      let args = {};
      try { args = JSON.parse(c.function?.arguments || '{}'); } catch (e) { args = null; }
      const problem = !def ? 'Unbekanntes Werkzeug' : args === null ? 'Argumente sind kein gültiges JSON' : validateInput(def.schema, args);
      history.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(problem ? { error: problem } : exec(def.name, normalize(def.schema, args))) });
    }
  }
  cb.text('\n\n_Maximale Anzahl an Analyse-Schritten erreicht._');
}

export const RUNNERS = { anthropic: runAnthropic, gemini: runGemini, openai: runOpenAI };

// Verbindungstest aus den Einstellungen (ohne Werkzeuge, minimale Anfrage)
export async function testConnection(settings) {
  const runner = RUNNERS[settings.provider];
  const history = settings.provider === 'gemini' ? [{ role: 'user', parts: [{ text: 'Verbindungstest' }] }] : [{ role: 'user', content: 'Verbindungstest' }];
  let text = '';
  const cfg = settings.provider === 'anthropic' ? { ...settings.anthropic, effort: 'low' } : settings[settings.provider];
  await runner({ cfg, proxyUrl: settings.proxyUrl, system: 'Antworte ausschließlich mit: OK', history, tools: [], exec: () => ({}), cb: { text: (d) => { text += d; } } });
  return text.trim();
}
