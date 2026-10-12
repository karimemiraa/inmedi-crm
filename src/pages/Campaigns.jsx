import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Plus, Megaphone, Mail, MousePointerClick, Eye } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Card, Empty, Field, KpiCard, Modal, Select } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { CommentCount, RowActions, StatusBadge } from '../components/Vorgang.jsx';
import { vorgangLink } from '../lib/vorgang.js';
import { fmtNum, fmtDate } from '../lib/format.js';

const STATUS_TONE = { Aktiv: 'green', Abgeschlossen: 'blue', Geplant: 'amber', Entwurf: 'gray' };

export default function Campaigns() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const totalSent = db.campaigns.reduce((s, c) => s + c.sent, 0);
  const totalOpen = db.campaigns.reduce((s, c) => s + c.opened, 0);
  const totalClick = db.campaigns.reduce((s, c) => s + c.clicked, 0);
  const openRate = totalSent ? Math.round((totalOpen / totalSent) * 100) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Kampagnen</h1><div className="sub">E-Mail-Marketing, Newsletter & Segmentierung</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neue Kampagne</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Mail} tone="brand" label="Gesendete E-Mails" value={fmtNum(totalSent)} />
        <KpiCard icon={Eye} tone="teal" label="Ø Öffnungsrate" value={openRate + ' %'} />
        <KpiCard icon={MousePointerClick} tone="purple" label="Klicks gesamt" value={fmtNum(totalClick)} />
        <KpiCard icon={Megaphone} tone="green" label="Aktive Kampagnen" value={db.campaigns.filter((c) => c.status === 'Aktiv').length} />
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {db.campaigns.filter((c) => c.status === 'Aktiv' || c.status === 'Geplant').map((c) => {
          const openR = c.sent ? Math.round((c.opened / c.sent) * 100) : 0;
          const clickR = c.sent ? Math.round((c.clicked / c.sent) * 100) : 0;
          return (
            <div key={c.id} className="card card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 10 }}>
                <Badge tone={c.type === 'Newsletter' ? 'purple' : 'teal'}>{c.type}</Badge>
                <StatusBadge db={db} kind="campaigns" rec={c} />
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
              <div className="muted tiny" style={{ marginBottom: 14 }}>{c.segment}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <div><div className="muted tiny">Gesendet</div><b>{fmtNum(c.sent)}</b></div>
                <div><div className="muted tiny">Geöffnet</div><b>{openR} %</b></div>
                <div><div className="muted tiny">Geklickt</div><b>{clickR} %</b></div>
              </div>
              <div className="progress" style={{ marginTop: 12 }}><i style={{ width: openR + '%' }} /></div>
            </div>
          );
        })}
      </div>

      <Card title="Alle Kampagnen" pad={false}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr><th>Kampagne</th><th>Typ</th><th>Segment</th><th>Status</th><th className="right">Gesendet</th><th className="right">Öffnung %</th><th className="right">Klick %</th><th>Datum</th><th className="right">Aktionen</th></tr></thead>
          <tbody>
            {db.campaigns.map((c) => (
              <tr key={c.id} onClick={() => nav(vorgangLink('campaigns', c.id))}>
                <td className="cell-main">{c.name}</td>
                <td><Badge tone={c.type === 'Newsletter' ? 'purple' : 'teal'}>{c.type}</Badge></td>
                <td className="muted">{c.segment}</td>
                <td><StatusBadge db={db} kind="campaigns" rec={c} /></td>
                <td className="right">{fmtNum(c.sent)}</td>
                <td className="right">{c.sent ? Math.round((c.opened / c.sent) * 100) + '%' : '—'}</td>
                <td className="right">{c.sent ? Math.round((c.clicked / c.sent) * 100) + '%' : '—'}</td>
                <td className="nowrap">{fmtDate(c.date)}</td>
                <td className="right nowrap"><RowActions kind="campaigns" rec={c} toast={toast} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      {adding && <NewCampaign db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewCampaign({ db, onClose, toast }) {
  const [f, setF] = useState({ type: 'E-Mail', status: 'Entwurf', segment: 'Alle Kontakte', date: '2026-09-20' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name) return;
    store.add('campaigns', {
      name: f.name, type: f.type, segment: f.segment, status: f.status,
      sent: 0, opened: 0, clicked: 0, date: new Date(f.date).toISOString(),
    });
    toast('Kampagne erstellt'); onClose();
  };
  return (
    <Modal title="Neue Kampagne" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Name"><input className="input" onChange={(e) => set('name', e.target.value)} placeholder="z. B. Herbst-Aktion Monitoring" autoFocus /></Field></div>
        <Field label="Typ"><Select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{['E-Mail', 'Newsletter'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Status"><Select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{['Entwurf', 'Geplant', 'Aktiv'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="full"><Field label="Segment"><Select className="select" value={f.segment} onChange={(e) => set('segment', e.target.value)}>{['Alle Kontakte', 'Krankenhäuser — Schlüsselkunden', 'Praxen', 'Pflegeeinrichtungen', 'Großhändler', 'Interessenten'].map((s) => <option key={s}>{s}</option>)}</Select></Field></div>
        <Field label="Datum"><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
