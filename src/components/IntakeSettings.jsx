import { useState } from 'react';
import { Eye, EyeOff, PlugZap, RefreshCw, MailCheck, ShieldCheck, CheckCircle2, AlertTriangle, ExternalLink, Radio } from 'lucide-react';
import { Card, Field, Select } from './ui.jsx';
import { useIntakeSettings, useIntakeState, saveIntakeSettings, intakeConfigured, fetchServerStatus, triggerServerRun, syncIntake } from '../lib/intake.js';

const GUIDE = 'https://github.com/karimemiraa/inmedi-crm/blob/main/server/README.md';
const when = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const LIVE_LABEL = { connected: 'Live verbunden', connecting: 'Verbinde …', error: 'Live-Verbindung unterbrochen – neuer Versuch läuft', off: 'Live aus' };
export function LiveBadge({ live }) {
  const tone = live === 'connected' ? 'var(--green)' : live === 'error' ? 'var(--amber)' : 'var(--text-3)';
  return <span className="live-badge" style={{ color: tone }} title={LIVE_LABEL[live]}><Radio size={13} /> {LIVE_LABEL[live] || live}</span>;
}
export const syncSummary = (l) => (l.ok
  ? `${l.added} neu${l.review ? `, ${l.review} zu prüfen` : ''}${l.duplicates ? `, ${l.duplicates} Duplikat(e) übersprungen` : ''}`
  : 'Fehler: ' + l.error);

// Einstellungen → Rechnungseingang
export default function IntakeSettings({ toast }) {
  const s = useIntakeSettings();
  const st = useIntakeState();
  const [show, setShow] = useState(false);
  const [server, setServer] = useState(null); // { state, data|msg }
  const [busy, setBusy] = useState(false);
  const ready = intakeConfigured(s);

  const test = async () => {
    setServer({ state: 'running' });
    try { setServer({ state: 'ok', data: await fetchServerStatus(s) }); }
    catch (e) { setServer({ state: 'error', msg: e.message }); }
  };
  const syncNow = async () => {
    const r = await syncIntake({ manual: true });
    if (!r) toast('Abgleich läuft bereits');
    else toast(r.ok ? 'Abgeglichen: ' + syncSummary(r) : r.error);
  };
  const checkMailbox = async () => {
    setBusy(true);
    try {
      await triggerServerRun(s);
      await syncNow();
      await test();
    } catch (e) { toast(e.message); }
    setBusy(false);
  };

  const last = st.last;
  const d = server?.data;
  const lastRun = d?.runs?.[0];
  return (
    <>
      <Card title="Rechnungseingang per E-Mail" sub="PDF-Rechnungen aus dem Microsoft-365-Postfach werden rund um die Uhr vom Eingangs-Server gelesen und hier automatisch als Rechnung angelegt.">
        <div className="form-grid">
          <div className="full">
            <Field label={<>Server-Adresse (HTTPS){s.autoDetected && <span className="muted tiny"> · automatisch erkannt (CRM läuft auf dem Server)</span>}</>}>
              <input className="input" value={s.serverUrl} placeholder="https://rechnungen.ihre-domain.de" spellCheck={false} autoComplete="off"
                onChange={(e) => saveIntakeSettings({ serverUrl: e.target.value.trim(), autoDetected: false })} aria-label="Server-Adresse" />
            </Field>
          </div>
          <div className="full">
            <Field label="Zugangs-Token">
              <div className="ai-key">
                <input className="input" type={show ? 'text' : 'password'} value={s.token} autoComplete="off" spellCheck={false} placeholder="API_TOKEN aus der Server-Konfiguration"
                  onChange={(e) => saveIntakeSettings({ token: e.target.value.trim() })} aria-label="Zugangs-Token" />
                <button className="icon-btn sm" type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Verbergen' : 'Anzeigen'}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </Field>
          </div>
          <Field label="Automatischer Abgleich">
            <label className="check"><input type="checkbox" checked={!!s.autoSync} onChange={(e) => saveIntakeSettings({ autoSync: e.target.checked })} /> Neue Rechnungen sofort übernehmen (Live-Verbindung)</label>
          </Field>
          <Field label="Ersatz-Abgleich (falls die Live-Verbindung abreißt)">
            <Select value={String(s.intervalMin)} onChange={(e) => saveIntakeSettings({ intervalMin: Number(e.target.value) })}>
              {[5, 15, 30, 60].map((m) => <option key={m} value={String(m)}>alle {m} Minuten</option>)}
            </Select>
          </Field>
        </div>

        <div className="ai-test" style={{ marginTop: 16 }}>
          <button className="btn" onClick={test} disabled={!ready || server?.state === 'running'}><PlugZap size={14} /> Verbindung testen</button>
          <button className="btn" onClick={syncNow} disabled={!ready || st.running}><RefreshCw size={14} className={st.running ? 'spin' : ''} /> Jetzt abgleichen</button>
          <button className="btn primary" onClick={checkMailbox} disabled={!ready || busy}><MailCheck size={14} /> Postfach jetzt prüfen</button>
          {ready && <LiveBadge live={st.live} />}
          {server?.state === 'running' && <span className="muted">Verbinde …</span>}
          {server?.state === 'error' && <span className="ai-bad"><AlertTriangle size={14} /> {server.msg}</span>}
          {server?.state === 'ok' && (d.mailConfigured
            ? <span className="ai-ok"><CheckCircle2 size={14} /> Verbunden · Postfach {d.mailbox} · {d.mode === 'sofort' ? (d.webhook?.active ? 'Sofort-Verarbeitung aktiv' : 'Sofort-Verarbeitung gestört – Abgleich alle ' + d.sweepMinutes + ' min') : 'Abgleich alle ' + d.sweepMinutes + ' min'}</span>
            : <span className="ai-bad"><AlertTriangle size={14} /> Server erreichbar, aber Microsoft-Zugang dort noch nicht eingerichtet</span>)}
        </div>

        {d && (
          <dl className="kv" style={{ marginTop: 14 }}>
            <dt>Letzter Server-Lauf</dt><dd>{lastRun ? <>{when(lastRun.at)} · {lastRun.ok ? `${lastRun.messages} Mail(s), ${lastRun.imported} importiert, ${lastRun.review} zu prüfen, ${lastRun.errors} Fehler` : <span style={{ color: 'var(--red)' }}>fehlgeschlagen: {lastRun.problems?.[0]}</span>}</> : 'noch keiner'}</dd>
            <dt>Letzte Mail</dt><dd>{d.events?.[0] ? <>{when(d.events[0].at)} · „{d.events[0].subject}“ → {d.events[0].result}</> : '—'}</dd>
            <dt>Auf dem Server</dt><dd>{d.total} Rechnung(en) · {Object.entries(d.counts || {}).map(([k, v]) => `${v} ${k}`).join(', ') || '—'}</dd>
          </dl>
        )}

        <div className="ai-privacy">
          <div><ShieldCheck size={15} /> <b>So funktioniert es</b></div>
          <ul>
            <li>Sobald eine Mail im Rechnungspostfach ankommt, meldet Microsoft das dem Eingangs-Server (Ordner <code>server/</code>) – er verarbeitet sie sofort, rund um die Uhr, auch wenn niemand das CRM geöffnet hat. Ein stündlicher Kontroll-Abgleich holt zur Sicherheit alles nach, was liegen geblieben ist.</li>
            <li>Jede PDF wird ausgelesen (Rechnungsnr., Kundennr., Positionen, Summen). Die Mail wandert danach in den Ordner „Rechnungen verarbeitet“ – bei unlesbaren oder unvollständigen PDFs bzw. Mails ohne PDF nach „Rechnungen prüfen“. Das Postfach bleibt das Original-Archiv.</li>
            <li>Geöffnete CRMs sind live verbunden: neue Rechnungen erscheinen innerhalb von Sekunden, werden per Kundennummer Firma und Betreuer zugeordnet und bei Unklarheiten mit „Zu prüfen“ markiert. Duplikate werden übersprungen.</li>
            <li>Server-Adresse und Token liegen nur in diesem Browser (nicht im Datenexport).</li>
          </ul>
          <a className="rec-link" href={GUIDE} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 8 }}>Einrichtungsanleitung <ExternalLink size={12} /></a>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}><Card title="Abgleich-Protokoll" sub={last ? `Zuletzt: ${when(last.at)} – ${syncSummary(last)}` : 'Noch kein Abgleich in diesem Browser'}>
        {st.log?.length ? (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Zeitpunkt</th><th>Auslöser</th><th>Ergebnis</th></tr></thead>
            <tbody>{st.log.map((l) => (
              <tr key={l.at} style={{ cursor: 'default' }}>
                <td className="nowrap">{when(l.at)}</td>
                <td>{l.manual ? 'manuell' : 'automatisch'}</td>
                <td style={{ color: l.ok ? undefined : 'var(--red)' }}>{syncSummary(l)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="muted">Noch keine Einträge.</div>}
      </Card></div>
    </>
  );
}
