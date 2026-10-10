import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Mail, Phone, Building2, Star, Target, LifeBuoy, CalendarCheck, FileSignature, Presentation } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Card, Empty, Modal, Field, AccountLink, ScoreMeter } from '../components/ui.jsx';
import Notes from '../components/Notes.jsx';
import { CustomFieldsEditor, CustomFieldsDisplay } from '../components/CustomFields.jsx';
import { useToast } from '../components/Toast.jsx';
import { ACT_LABEL } from '../lib/labels.js';
import { fmtMoney, fmtDate, relDate } from '../lib/format.js';

const TICKET_TONE = { Neu: 'blue', 'In Bearbeitung': 'amber', 'Wartet auf Kunde': 'purple', Gelöst: 'green' };

const TABS = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'activities', label: 'Aktivitäten' },
  { key: 'deals', label: 'Deals' },
  { key: 'tickets', label: 'Service' },
  { key: 'events', label: 'Messen' },
  { key: 'custom', label: 'Zusatzfelder' },
  { key: 'notes', label: 'Notizen' },
];

export default function ContactDetail() {
  const { id } = useParams();
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);

  const c = db.contacts.find((x) => x.id === id);
  if (!c) return <div className="page"><Empty label="Ansprechpartner nicht gefunden" /></div>;

  const account = db.accounts.find((a) => a.id === c.accountId);
  const activities = db.activities.filter((a) => a.contactId === id).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  const deals = db.deals.filter((d) => d.contactId === id);
  const tickets = db.tickets.filter((t) => t.contactId === id);
  const contracts = db.contracts.filter((v) => v.contactId === id);
  const events = db.events.filter((e) => (e.attendees || []).some((at) => at.refType === 'contact' && at.refId === id));
  const stage = (s) => db.stages.find((x) => x.id === s);

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => nav('/contacts')} style={{ marginBottom: 14 }}><ArrowLeft size={15} /> Ansprechpartner</button>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div className="detail-hero">
            <Avatar name={c.name} color={c.color} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 21 }}>{c.name}</h1>
                {c.isPrimary && <Badge tone="brand">Hauptkontakt</Badge>}
              </div>
              <div className="stat-line muted tiny" style={{ marginTop: 6, gap: 16, flexWrap: 'wrap' }}>
                {c.title && <span><Star size={13} style={{ verticalAlign: -2 }} /> {c.title}</span>}
                <span><Building2 size={13} style={{ verticalAlign: -2 }} /> <AccountLink account={account} /></span>
                {c.email && <span><Mail size={13} style={{ verticalAlign: -2 }} /> {c.email}</span>}
                {c.phone && <span><Phone size={13} style={{ verticalAlign: -2 }} /> {c.phone}</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <button className="btn primary" onClick={() => setEditing(true)}><Pencil size={15} /> Bearbeiten</button>
          </div>
        </div>

        <div className="grid cols-4" style={{ marginTop: 20 }}>
          <MiniStat icon={Target} label="Deals" value={deals.length} tone="purple" />
          <MiniStat icon={CalendarCheck} label="Aktivitäten" value={activities.length} tone="brand" />
          <MiniStat icon={LifeBuoy} label="Tickets" value={tickets.length} tone="amber" />
          <MiniStat icon={Presentation} label="Messen" value={events.length} tone="teal" />
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'activities' && ` (${activities.length})`}
            {t.key === 'deals' && ` (${deals.length})`}
            {t.key === 'tickets' && ` (${tickets.length})`}
            {t.key === 'events' && ` (${events.length})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid cols-2">
          <Card title="Kontaktdaten" action={<button className="btn ghost sm" onClick={() => setEditing(true)}><Pencil size={13} /> Bearbeiten</button>}>
            <dl className="kv">
              <dt>Name</dt><dd>{c.name}</dd>
              <dt>Position</dt><dd>{c.title || '—'}</dd>
              <dt>Firma</dt><dd><AccountLink account={account} /></dd>
              <dt>E-Mail</dt><dd>{c.email || '—'}</dd>
              <dt>Telefon</dt><dd>{c.phone || '—'}</dd>
              <dt>Letzter Kontakt</dt><dd>{relDate(c.lastContact)}</dd>
            </dl>
          </Card>
          <Card title="Verträge" sub="Verträge mit diesem Ansprechpartner" pad={false}>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Nr.</th><th>Betreff</th><th>Status</th></tr></thead>
              <tbody>
                {contracts.map((v) => (
                  <tr key={v.id} onClick={() => nav('/contracts')}>
                    <td className="cell-main nowrap">{v.number}</td><td>{v.title}</td><td><Badge tone={v.status === 'Aktiv' ? 'green' : 'gray'} dot>{v.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>{contracts.length === 0 && <Empty label="Keine Verträge" />}</div>
          </Card>
        </div>
      )}

      {tab === 'activities' && (
        <Card pad={false}><div style={{ padding: '10px 18px' }}>
          {activities.length === 0 && <Empty label="Keine Aktivitäten" />}
          {activities.map((a) => (
            <div key={a.id} className="list-row">
              <span className="badge gray" style={{ width: 8, height: 8, padding: 0, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.subject}</div>
                <div className="muted tiny">{ACT_LABEL[a.type]} · {relDate(a.dueDate)}</div>
              </div>
              <Badge tone={a.done ? 'green' : 'amber'}>{a.done ? 'Erledigt' : 'Offen'}</Badge>
            </div>
          ))}
        </div></Card>
      )}

      {tab === 'deals' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Deal</th><th>Phase</th><th>Score</th><th className="right">Wert</th></tr></thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} onClick={() => nav('/pipeline')}>
                <td className="cell-main">{d.name}</td>
                <td><Badge tone="blue" dot>{stage(d.stage)?.name}</Badge></td>
                <td><ScoreMeter value={d.score} /></td>
                <td className="right"><b>{fmtMoney(d.value)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>{deals.length === 0 && <Empty label="Keine Deals" />}</div></Card>
      )}

      {tab === 'tickets' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Ticket</th><th>Kategorie</th><th>Priorität</th><th>Status</th><th>Erstellt</th></tr></thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} onClick={() => nav('/service')}>
                <td><div className="cell-main">{t.subject}</div><div className="cell-sub">{t.number}</div></td>
                <td>{t.category}</td>
                <td><Badge tone={t.priority === 'Hoch' ? 'red' : t.priority === 'Niedrig' ? 'gray' : 'amber'}>{t.priority}</Badge></td>
                <td><Badge tone={TICKET_TONE[t.status]} dot>{t.status}</Badge></td>
                <td className="muted tiny nowrap">{relDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>{tickets.length === 0 && <Empty label="Keine Tickets" />}</div></Card>
      )}

      {tab === 'events' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Veranstaltung</th><th>Typ</th><th>Datum</th><th>Rolle</th><th>Status</th></tr></thead>
          <tbody>
            {events.map((e) => {
              const at = e.attendees.find((x) => x.refType === 'contact' && x.refId === id);
              return (
                <tr key={e.id} onClick={() => nav('/events')}>
                  <td className="cell-main">{e.name}</td><td><Badge tone="teal">{e.type}</Badge></td>
                  <td className="nowrap">{fmtDate(e.startDate)}</td><td>{at?.role || '—'}</td>
                  <td><Badge tone="gray" dot>{at?.status || '—'}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>{events.length === 0 && <Empty label="Keine Messe-Teilnahmen" />}</div></Card>
      )}

      {tab === 'custom' && (
        <Card title="Zusatzfelder" action={<button className="btn ghost sm" onClick={() => setEditing(true)}><Pencil size={13} /> Bearbeiten</button>}>
          <CustomFieldsDisplay db={db} entity="Ansprechpartner" record={c} />
        </Card>
      )}

      {tab === 'notes' && <Card title="Notizen & Kommentare" sub="Sichtbar für Außendienst, Innendienst & Kundendienst"><Notes coll="contacts" record={c} /></Card>}

      {editing && <ContactEdit contact={c} db={db} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast('Ansprechpartner gespeichert'); }} />}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }) {
  const map = { brand: 'var(--brand)', green: 'var(--green)', teal: 'var(--brand-2)', purple: 'var(--purple)', amber: 'var(--amber)' };
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div className="stat-line" style={{ gap: 7 }}>
        {Icon && <Icon size={14} style={{ color: map[tone] }} />}
        <span className="muted tiny" style={{ fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function ContactEdit({ contact, db, onClose, onSaved }) {
  const [f, setF] = useState({ ...contact, customValues: contact.customValues || {} });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    store.update('contacts', contact.id, {
      name: f.name, title: f.title, accountId: f.accountId, email: f.email, phone: f.phone,
      isPrimary: !!f.isPrimary, customValues: f.customValues || {},
    });
    onSaved();
  };
  return (
    <Modal title="Ansprechpartner bearbeiten" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Speichern</button></>}>
      <div className="form-grid">
        <Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Position"><input className="input" value={f.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
        <div className="full"><Field label="Firma"><select className="select" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field></div>
        <Field label="E-Mail"><input className="input" value={f.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Telefon"><input className="input" value={f.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <div className="full"><label className="check"><input type="checkbox" checked={!!f.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} /> Hauptkontakt dieser Firma</label></div>
        <CustomFieldsEditor db={db} entity="Ansprechpartner" values={f.customValues || {}} onChange={(cv) => set('customValues', cv)} />
      </div>
    </Modal>
  );
}
