import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Mail, Phone, Building2, Star, Target, LifeBuoy, CalendarCheck, FileSignature, Presentation, Copy, MessageSquare, Trash2 } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Avatar, Badge, Card, Empty, Field, Modal, ScoreMeter, Select } from '../components/ui.jsx';
import { statusTone } from '../lib/status.js';
import { vorgangLink, updateVorgang, requestDelete, duplicateVorgang } from '../lib/vorgang.js';
import { Comments, EditForm, HistoryList, toDraft, diffDraft } from '../components/Vorgang.jsx';
import { FIELDS } from '../lib/vorgangFields.js';
import { CustomFieldsEditor, CustomFieldsDisplay } from '../components/CustomFields.jsx';
import { openLink } from '../lib/nav.js';
import { useToast } from '../components/Toast.jsx';
import { ACT_LABEL } from '../lib/labels.js';
import { fmtMoney, fmtDate, relDate } from '../lib/format.js';

const TICKET_TONE = { Neu: 'blue', 'In Bearbeitung': 'amber', 'Wartet auf Kunde': 'purple', Gelöst: 'green' };

const TABS = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'activities', label: 'Aktivitäten' },
  { key: 'deals', label: 'Deals' },
  { key: 'tickets', label: 'Kundendienst' },
  { key: 'events', label: 'Messen' },
  { key: 'custom', label: 'Zusatzfelder' },
  { key: 'comments', label: 'Kommentare' },
  { key: 'history', label: 'Verlauf' },
];

export default function ContactDetail() {
  const { id } = useParams();
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState(null); // Bearbeitungsmodus

  const c = db.contacts.find((x) => x.id === id);
  if (!c) {
    const t = (db.trash || []).find((x) => (x.kind === 'contacts' && x.record.id === id) || (x.cascade || []).some((k) => k.record.id === id));
    return <div className="page"><Card><Empty label={t ? 'Ansprechpartner liegt im Papierkorb' : 'Ansprechpartner nicht gefunden'} action={t ? { label: 'Zum Papierkorb', onClick: () => nav('/settings?tab=data') } : undefined} /></Card></div>;
  }
  const fields = FIELDS.contacts;
  const startEdit = () => { setDraft(toDraft(c, fields)); setTab('overview'); };
  const save = () => {
    const { patch, changed, error } = diffDraft('contacts', c, fields, draft);
    if (error) { toast(error); return; }
    if (changed.length) { updateVorgang('contacts', c.id, patch, 'Geändert: ' + changed.join(', ')); toast('Ansprechpartner gespeichert'); }
    setDraft(null);
  };
  const remove = () => { if (requestDelete('contacts', c.id) === 'trashed') { toast('Ansprechpartner in den Papierkorb verschoben'); nav('/contacts'); } };
  const duplicate = () => { const d = duplicateVorgang('contacts', c.id); if (d) { toast('Ansprechpartner dupliziert'); nav('/contacts/' + d.id); } };

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
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setTab('comments')}><MessageSquare size={15} /> Kommentieren</button>
            <button className="btn" onClick={duplicate}><Copy size={15} /> Duplizieren</button>
            <button className="btn danger" onClick={remove}><Trash2 size={15} /> Löschen</button>
            <button className="btn primary" onClick={startEdit}><Pencil size={15} /> Bearbeiten</button>
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
            {t.key === 'comments' && ` (${c.comments?.length || 0})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && draft && (
        <Card title="Ansprechpartner bearbeiten" sub="Kontaktdaten inkl. Zusatzfelder — Änderungen werden im Verlauf protokolliert.">
          <EditForm db={db} kind="contacts" fields={fields} draft={draft} setDraft={setDraft} selfId={c.id} />
          <div className="vp-form-foot">
            <button className="btn" onClick={() => setDraft(null)}>Abbrechen</button>
            <button className="btn primary" onClick={save}>Speichern</button>
          </div>
        </Card>
      )}

      {tab === 'overview' && !draft && (
        <div className="grid cols-2">
          <Card title="Kontaktdaten" action={<button className="btn ghost sm" onClick={startEdit}><Pencil size={13} /> Bearbeiten</button>}>
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
                  <tr key={v.id} onClick={() => nav(vorgangLink('contracts', v.id))}>
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
            <div key={a.id} className="list-row clickable" onClick={() => nav(vorgangLink('activities', a.id))}>
              <span className="badge gray" style={{ width: 8, height: 8, padding: 0, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.subject}</div>
                <div className="muted tiny">{ACT_LABEL[a.type]} · {relDate(a.dueDate)}</div>
              </div>
              <Badge tone={statusTone(db, 'activities', a.status)}>{a.status}</Badge>
            </div>
          ))}
        </div></Card>
      )}

      {tab === 'deals' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Deal</th><th>Phase</th><th>Score</th><th className="right">Wert</th></tr></thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} onClick={() => nav(vorgangLink('deals', d.id))}>
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
              <tr key={t.id} onClick={() => nav(vorgangLink('tickets', t.id))}>
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
                <tr key={e.id} onClick={() => nav(vorgangLink('events', e.id))}>
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
        <Card title="Zusatzfelder" action={<button className="btn ghost sm" onClick={startEdit}><Pencil size={13} /> Bearbeiten</button>}>
          <CustomFieldsDisplay db={db} entity="Ansprechpartner" record={c} />
        </Card>
      )}

      {tab === 'comments' && <Card title="Kommentare" sub="Sichtbar für Außendienst, Innendienst & Kundendienst"><Comments db={db} kind="contacts" r={c} toast={toast} /></Card>}

      {tab === 'history' && <Card title="Verlauf"><HistoryList db={db} kind="contacts" r={c} /></Card>}

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

