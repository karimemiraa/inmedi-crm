import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, MailCheck, Zap, ShieldCheck, RefreshCw, ExternalLink, CircleDashed } from 'lucide-react';
import { Card } from './ui.jsx';
import { useIntakeSettings, intakeConfigured, fetchServerStatus } from '../lib/intake.js';

const GUIDE = 'https://github.com/karimemiraa/inmedi-crm/blob/main/server/README.md';
const when = (iso) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Tile({ ok, warn, icon: Icon, title, children }) {
  const color = ok ? 'var(--green)' : warn ? 'var(--amber)' : 'var(--text-3)';
  return <div className="ms-tile"><b style={{ color }}>{Icon ? <Icon size={14} /> : null} {title}</b><div className="muted">{children}</div></div>;
}

// Einstellungen → Integrationen: echter Zustand der Microsoft-365-Anbindung (liegt auf dem Eingangs-Server).
// Zugangsdaten werden bewusst NICHT im Browser eingegeben – sie gehören auf den Server.
export default function Microsoft365Status() {
  const s = useIntakeSettings();
  const ready = intakeConfigured(s);
  const [st, setSt] = useState({ state: ready ? 'loading' : 'off' });
  const load = async () => {
    if (!ready) { setSt({ state: 'off' }); return; }
    setSt((x) => ({ ...x, state: 'loading' }));
    try { setSt({ state: 'ok', data: await fetchServerStatus(s) }); } catch (e) { setSt({ state: 'error', msg: e.message }); }
  };
  useEffect(() => { load(); }, [s.serverUrl, s.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const d = st.data;
  const w = d?.webhook;
  return (
    <Card title="Microsoft 365" sub="Anbindung des Rechnungspostfachs über den Eingangs-Server. Zugangsdaten (Tenant, App, Geheimnis) liegen ausschließlich auf dem Server – nie im Browser."
      action={ready && <button className="btn sm" onClick={load} disabled={st.state === 'loading'}><RefreshCw size={13} className={st.state === 'loading' ? 'spin' : ''} /> Aktualisieren</button>}>
      {st.state === 'off' && (
        <div className="ai-warn" style={{ margin: 0 }}><AlertTriangle size={14} /> Noch nicht verbunden. Server-Adresse und Token unter <Link className="rec-link" to="/settings?tab=intake">Rechnungseingang</Link> eintragen.</div>
      )}
      {st.state === 'error' && <div className="ai-bad"><AlertTriangle size={14} /> Server nicht erreichbar: {st.msg}</div>}
      {st.state === 'loading' && !d && <div className="muted">Lade Status …</div>}
      {d && (<>
        <div className="ms-grid">
          <Tile ok={d.mailConfigured} warn={!d.mailConfigured} icon={d.mailConfigured ? CheckCircle2 : AlertTriangle} title="Postfach">
            {d.mailConfigured ? d.mailbox : 'Microsoft-Zugang auf dem Server nicht eingerichtet'}
          </Tile>
          <Tile ok={w?.active} warn={d.mailConfigured && !w?.active} icon={w?.active ? Zap : CircleDashed} title="Sofort-Verarbeitung">
            {!w ? 'aus (PUBLIC_URL auf dem Server setzen)' : w.active ? <>aktiv · verlängert sich automatisch (gültig bis {when(w.expiresAt)})</> : <>gestört: {w.error || 'kein Abo'}</>}
          </Tile>
          <Tile ok={d.mailConfigured} icon={ShieldCheck} title="Kontroll-Abgleich">alle {d.sweepMinutes} min{d.nextSweepAt ? ` · nächster ${when(d.nextSweepAt)}` : ''}</Tile>
          <Tile ok={d.liveClients > 0} icon={MailCheck} title="Letzte Benachrichtigung">{w?.lastNotificationAt ? when(w.lastNotificationAt) : 'noch keine'} · {d.liveClients} CRM live verbunden</Tile>
        </div>
        <h4 style={{ margin: '4px 0 8px' }}>Letzte Mails im Rechnungspostfach</h4>
        {d.events?.length ? (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Zeitpunkt</th><th>Auslöser</th><th>Betreff</th><th>Ergebnis</th></tr></thead>
            <tbody>{d.events.slice(0, 15).map((e, i) => (
              <tr key={e.at + i} style={{ cursor: 'default' }}>
                <td className="nowrap">{when(e.at)}</td>
                <td>{e.trigger === 'sofort' ? 'Sofort' : e.trigger}</td>
                <td>{e.subject || '—'}<div className="tiny muted">{e.from}</div></td>
                <td style={{ color: /^Fehler/.test(e.result) ? 'var(--red)' : undefined }}>{e.result}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <div className="muted">Noch keine Mails verarbeitet.</div>}
      </>)}
      <a className="rec-link" href={GUIDE} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 12 }}>Einrichtung auf dem Server <ExternalLink size={12} /></a>
    </Card>
  );
}
