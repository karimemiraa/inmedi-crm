import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, Square, RotateCcw, Copy, Printer, Check, X, Settings2, Database, AlertTriangle, ListPlus, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import Markdown from './Markdown.jsx';
import { useChat, send, stop, reset, runAction, dismissAction } from '../../lib/ai/chatStore.js';
import { useAiSettings, providerReady, providerLabel, PROVIDERS } from '../../lib/ai/settings.js';
import { useStore } from '../../data/store.js';
import { vorgangLink } from '../../lib/vorgang.js';
import { useToast } from '../Toast.jsx';

const TOOL_LABEL = {
  search_records: 'Datensätze gesucht', get_account_overview: 'Firmenprofil', get_account_orders: 'Aufträge & Rechnungen',
  get_product_insights: 'Produktanalyse', get_account_timeline: 'Chronologie', get_revenue: 'Umsatzauswertung',
  get_care_costs: 'Betreuungskosten', get_attention_list: 'Risiken & Überfälliges', get_followups: 'Follow-ups',
  get_pipeline: 'Pipeline', list_accounts: 'Firmenliste', get_team: 'Team & Ziele', get_kpis: 'Kennzahlen',
  propose_task: 'Aufgabe vorgeschlagen', propose_comment: 'Kommentar vorgeschlagen',
};

export function suggestionsFor(db, context) {
  const acc = context?.kind === 'accounts' ? db.accounts.find((a) => a.id === context.id) : null;
  if (acc) return [
    `Bereite mein nächstes Kundengespräch mit ${acc.name} vor`,
    `Was hat ${acc.name} zuletzt bestellt und was steht zur Nachbestellung an?`,
    `Welche Produkte könnte ${acc.name} zusätzlich brauchen?`,
    `Wie wirtschaftlich ist ${acc.name} (Betreuungskosten vs. Umsatz)?`,
  ];
  return [
    'Wo ist gerade Aufmerksamkeit nötig?',
    'Wer braucht diese Woche ein Follow-up?',
    'Betreuungskosten-Analyse: welche Kunden sind unwirtschaftlich?',
    'Umsatz nach Betreuer im Vergleich zum Vorjahr',
    'Lagebild für die Vertriebsrunde',
    'Welche Kunden bestellen weniger als im Vorjahr?',
  ];
}

export default function AssistantChat({ context, compact, autoPrompt, onAutoPromptUsed }) {
  const db = useStore();
  const settings = useAiSettings();
  const chat = useChat();
  const toast = useToast();
  const [input, setInput] = useState('');
  const endRef = useRef();
  const ready = providerReady(settings);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.items]);
  useEffect(() => {
    if (autoPrompt && !chat.busy) { if (ready) send(autoPrompt, context); else toast('Bitte zuerst den KI-Anbieter einrichten'); onAutoPromptUsed?.(); }
  }, [autoPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (q = input) => {
    if (!q.trim() || chat.busy) return;
    if (!ready) { toast('Bitte zuerst den KI-Anbieter einrichten'); return; }
    send(q, context);
    setInput('');
  };

  const printAnswer = (id) => {
    const el = document.getElementById('ai-answer-' + id);
    if (!el) return;
    el.classList.add('print-target');
    document.body.classList.add('printing-answer');
    const done = () => { el.classList.remove('print-target'); document.body.classList.remove('printing-answer'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1500);
  };

  return (
    <div className={'ai-chat' + (compact ? ' compact' : '')}>
      <div className="ai-bar">
        <span className="ai-provider" title={PROVIDERS[settings.provider]?.hint}>
          {settings.provider === 'local' ? <Database size={13} /> : <Sparkles size={13} />} {providerLabel(settings)}
          {settings.provider !== 'local' && <span className="muted"> · <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> ohne Kontaktdaten{settings.pseudonymize ? ', pseudonymisiert' : ''}</span>}
        </span>
        <span style={{ flex: 1 }} />
        {chat.usage && settings.provider !== 'local' && <span className="muted tiny" title="Verbrauchte Tokens in dieser Sitzung">{Math.round((chat.usage.input + chat.usage.output) / 100) / 10}k Tokens</span>}
        <Link to="/settings?tab=ai" className="icon-btn sm" title="KI-Einstellungen" aria-label="KI-Einstellungen"><Settings2 size={14} /></Link>
        <button className="icon-btn sm" title="Neues Gespräch" aria-label="Neues Gespräch" onClick={reset} disabled={!chat.items.length}><RotateCcw size={14} /></button>
      </div>

      <div className="ai-stream">
        {chat.items.length === 0 && (
          <div className="ai-welcome">
            <div className="ai-welcome-ico"><Sparkles size={22} /></div>
            <h3>Wie kann ich helfen?</h3>
            <p className="muted">Ich analysiere Ihre CRM-Daten: Gesprächsvorbereitung, Umsätze, Betreuungskosten, Risiken und Follow-ups.{settings.provider === 'local' ? ' Modus „Ohne KI“: strukturierte Auswertungen ohne externe Verbindung.' : ''}</p>
            {!ready && <div className="ai-warn"><AlertTriangle size={14} /> {PROVIDERS[settings.provider].label}: API-Schlüssel fehlt. <Link className="rec-link" to="/settings?tab=ai">Jetzt einrichten</Link></div>}
            <div className="ai-suggest">
              {suggestionsFor(db, context).map((s) => <button key={s} className="ai-chip" onClick={() => submit(s)}>{s}</button>)}
            </div>
          </div>
        )}

        {chat.items.map((it) => it.role === 'user' ? (
          <div key={it.id} className="ai-msg user"><div className="ai-bubble">{it.text}</div></div>
        ) : (
          <div key={it.id} className="ai-msg bot">
            {it.note && <div className="muted tiny" style={{ marginBottom: 6 }}>{it.note}</div>}
            {it.tools.length > 0 && (
              <div className="ai-tools">
                <Database size={12} /> {[...new Set(it.tools.map((t) => TOOL_LABEL[t.name] || t.name))].join(' · ')}
              </div>
            )}
            <div className="ai-answer" id={'ai-answer-' + it.id}>
              {it.text ? <Markdown text={it.reveal ? it.reveal(it.text) : it.text} /> : it.status === 'running' && <div className="ai-typing"><span /><span /><span /> Analysiere Daten …</div>}
            </div>
            {it.actions.map((a) => <ActionCard key={a.id} db={db} item={it} action={a} toast={toast} />)}
            {it.status === 'error' && <div className="ai-error"><AlertTriangle size={14} /> {it.error}{it.hint && <div className="tiny">{it.hint}</div>}</div>}
            {it.status === 'stopped' && <div className="muted tiny">Abgebrochen.</div>}
            {it.status === 'done' && it.text && (
              <div className="ai-msg-actions">
                <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(it.reveal ? it.reveal(it.text) : it.text); toast('In Zwischenablage kopiert'); }}><Copy size={13} /> Kopieren</button>
                <button className="btn ghost sm" onClick={() => printAnswer(it.id)}><Printer size={13} /> Drucken / PDF</button>
                <span className="muted tiny" style={{ marginLeft: 'auto' }}>{it.provider}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="ai-input">
        <textarea className="input" rows={compact ? 2 : 3} value={input} placeholder="Frage stellen … z. B. „Bereite meinen Termin mit Klinikum Ostsee vor“" aria-label="Frage an den KI-Assistenten"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        {chat.busy
          ? <button className="btn" onClick={stop} title="Stoppen"><Square size={14} /> Stopp</button>
          : <button className="btn primary" onClick={() => submit()} disabled={!input.trim()} aria-label="Senden"><Send size={14} /></button>}
      </div>
    </div>
  );
}

function ActionCard({ db, item, action: a, toast }) {
  const isTask = a.name === 'propose_task';
  const acc = a.input.account_id ? db.accounts.find((x) => x.id === a.input.account_id || x.name === a.input.account_id) : null;
  return (
    <div className={'ai-action ' + a.state}>
      <div className="ai-action-head">{isTask ? <ListPlus size={14} /> : <MessageSquarePlus size={14} />} <b>{isTask ? 'Aufgabe anlegen?' : 'Kommentar speichern?'}</b>{acc && <span className="muted"> · {acc.name}</span>}</div>
      {isTask
        ? <div className="tiny">{a.input.subject} · fällig {a.input.due_date}{a.input.priority ? ' · ' + a.input.priority : ''}{a.input.notes ? <div className="muted">{a.input.notes}</div> : null}</div>
        : <div className="tiny ai-action-text">{item.reveal ? item.reveal(a.input.text) : a.input.text}</div>}
      {a.state === 'pending' && (
        <div className="ai-action-btns">
          <button className="btn sm" onClick={() => dismissAction(item.id, a.id)}><X size={13} /> Verwerfen</button>
          <button className="btn sm primary" onClick={() => { const r = runAction(item.id, a.id); if (r) toast(r.label); }}><Check size={13} /> Ausführen</button>
        </div>
      )}
      {a.state === 'done' && <div className="tiny" style={{ color: 'var(--green)' }}><Check size={12} /> {a.result.label} – <a className="rec-link" href={'#' + vorgangLink(a.result.kind, a.result.id)}>öffnen</a></div>}
      {a.state === 'dismissed' && <div className="muted tiny">Verworfen.</div>}
      {a.state === 'failed' && <div className="tiny" style={{ color: 'var(--red)' }}>Konnte nicht ausgeführt werden.</div>}
    </div>
  );
}
