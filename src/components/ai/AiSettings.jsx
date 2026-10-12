import { useState } from 'react';
import { Eye, EyeOff, Trash2, PlugZap, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, Field, Select } from '../ui.jsx';
import { useAiSettings, saveAiSettings, PROVIDERS, CLAUDE_MODELS, EFFORTS } from '../../lib/ai/settings.js';
import { testConnection } from '../../lib/ai/providers.js';
import { reset } from '../../lib/ai/chatStore.js';

// Einstellungen → KI-Assistent
export default function AiSettings({ toast }) {
  const s = useAiSettings();
  const [show, setShow] = useState(false);
  const [test, setTest] = useState(null); // { state, msg }
  const p = s.provider;
  const cfg = s[p] || {};
  const setCfg = (patch) => saveAiSettings({ [p]: { ...cfg, ...patch } });
  const run = async () => {
    setTest({ state: 'running', msg: 'Teste Verbindung …' });
    try { const r = await testConnection(s); setTest({ state: 'ok', msg: 'Verbindung erfolgreich' + (r ? ` – Antwort: „${r.slice(0, 40)}“` : '') }); }
    catch (e) { setTest({ state: 'error', msg: (e?.message || String(e)) + (e?.hint ? ' ' + e.hint : '') }); }
  };
  const keyField = (
    <Field label="API-Schlüssel">
      <div className="ai-key">
        <input className="input" type={show ? 'text' : 'password'} value={cfg.apiKey || ''} autoComplete="off" spellCheck={false}
          placeholder={p === 'anthropic' ? 'sk-ant-…' : p === 'gemini' ? 'AIza…' : 'sk-… (bei lokalem Ollama leer lassen)'}
          onChange={(e) => setCfg({ apiKey: e.target.value.trim() })} aria-label="API-Schlüssel" />
        <button className="icon-btn sm" type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Verbergen' : 'Anzeigen'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        {cfg.apiKey && <button className="icon-btn sm" type="button" title="Schlüssel löschen" aria-label="Schlüssel löschen" onClick={() => { setCfg({ apiKey: '' }); toast('Schlüssel gelöscht'); }}><Trash2 size={14} /></button>}
      </div>
    </Field>
  );
  return (
    <Card title="KI-Assistent" sub="Anbieter wählen und verbinden. Der Assistent liest Ihre CRM-Daten über gezielte Abfragen – nie die komplette Datenbank.">
      <div className="ai-prov-grid">
        {Object.entries(PROVIDERS).map(([k, v]) => (
          <button key={k} className={'status-kind' + (p === k ? ' active' : '')} onClick={() => { saveAiSettings({ provider: k }); setTest(null); reset(); }}>
            <b>{v.label}</b><span>{v.hint}</span>
          </button>
        ))}
      </div>

      {p !== 'local' && (
        <div className="form-grid" style={{ marginTop: 16 }}>
          <div className="full">{keyField}</div>
          {p === 'anthropic' && <>
            <Field label="Modell"><Select value={cfg.model} onChange={(e) => setCfg({ model: e.target.value })}>{CLAUDE_MODELS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select></Field>
            <Field label="Analysetiefe"><Select value={cfg.effort} onChange={(e) => setCfg({ effort: e.target.value })}>{EFFORTS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</Select></Field>
          </>}
          {p === 'gemini' && <div className="full"><Field label="Modell (z. B. gemini-2.5-pro, gemini-2.5-flash oder neuer)"><input className="input" value={cfg.model} onChange={(e) => setCfg({ model: e.target.value.trim() })} /></Field></div>}
          {p === 'openai' && <>
            <Field label="Basis-URL"><input className="input" value={cfg.baseUrl} onChange={(e) => setCfg({ baseUrl: e.target.value.trim() })} placeholder="https://api.openai.com/v1" /></Field>
            <Field label="Modell"><input className="input" value={cfg.model} onChange={(e) => setCfg({ model: e.target.value.trim() })} placeholder="z. B. gpt-4.1, mistral-large-latest, llama3.1" /></Field>
            <div className="full muted tiny">Beispiele: OpenAI <code>https://api.openai.com/v1</code> · Mistral <code>https://api.mistral.ai/v1</code> · OpenRouter <code>https://openrouter.ai/api/v1</code> · lokales Ollama <code>http://localhost:11434/v1</code> (Daten verlassen das Haus nicht; Browser-Zugriff per <code>OLLAMA_ORIGINS</code> erlauben).</div>
          </>}
          <div className="full">
            <label className="check"><input type="checkbox" checked={!!s.pseudonymize} onChange={(e) => { saveAiSettings({ pseudonymize: e.target.checked }); reset(); }} /> Personennamen pseudonymisieren (Ansprechpartner/Interessenten werden als „Ansprechpartner 1“ usw. übermittelt und in der Anzeige wieder aufgelöst; Namen eigener Mitarbeiter bleiben sichtbar, damit Zuständigkeiten benannt werden können)</label>
          </div>
          <div className="full ai-test">
            <button className="btn" onClick={run} disabled={test?.state === 'running' || (!cfg.apiKey && p !== 'openai' && !s.proxyUrl)}><PlugZap size={14} /> Verbindung testen</button>
            {test && <span className={'tiny ' + (test.state === 'ok' ? 'ai-ok' : test.state === 'error' ? 'ai-bad' : 'muted')}>{test.state === 'ok' ? <CheckCircle2 size={13} /> : test.state === 'error' ? <AlertTriangle size={13} /> : null} {test.msg}</span>}
          </div>
          <details className="full">
            <summary className="muted tiny" style={{ cursor: 'pointer' }}>Erweitert: eigener Proxy</summary>
            <div style={{ marginTop: 8 }}><Field label="Proxy-URL (optional – hält Schlüssel serverseitig, z. B. Cloudflare Worker)"><input className="input" value={s.proxyUrl} onChange={(e) => saveAiSettings({ proxyUrl: e.target.value.trim() })} placeholder="https://ki-proxy.ihre-firma.de" /></Field></div>
          </details>
        </div>
      )}

      <div className="ai-privacy">
        <div><ShieldCheck size={15} /> <b>Datenschutz & Sicherheit</b></div>
        <ul>
          <li>Übermittelt werden nur Ergebnisse gezielter Abfragen (Firmen, Umsätze, Aufträge, Produkte, Vorgänge). <b>E-Mail-Adressen und Telefonnummern werden nie übermittelt</b> und auch aus Freitexten entfernt.</li>
          <li>Der API-Schlüssel liegt nur in diesem Browser (nicht im Datenexport, nicht im CRM-Datenbestand). Jeder mit Zugriff auf diesen Browser kann ihn nutzen – für den Produktivbetrieb einen Proxy verwenden.</li>
          <li>Für Kundendaten bei externen KI-Anbietern ist ein Auftragsverarbeitungsvertrag (AVV/DPA) mit dem Anbieter erforderlich. Modus „Ohne KI“ und lokales Ollama übertragen keine Daten nach außen.</li>
          <li>Der Assistent ändert keine Daten selbstständig – Aufgaben/Kommentare werden nur vorgeschlagen und erst nach Ihrem Klick angelegt.</li>
        </ul>
      </div>
    </Card>
  );
}
