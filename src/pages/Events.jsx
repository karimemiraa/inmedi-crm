import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Presentation, CalendarClock, Users, Euro, Trash2, MapPin } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Empty, KpiCard, Drawer, Field, Modal, AccountLink, ContactLink, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useOpenParam } from '../lib/nav.js';
import { useToast } from '../components/Toast.jsx';
import { exportCsv } from '../lib/csv.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

export const EVENT_TYPES = ['Messe', 'Kongress', 'Hausmesse', 'Webinar', 'Workshop'];
export const EVENT_STATUS = ['Geplant', 'Läuft', 'Abgeschlossen', 'Abgesagt'];
export const ATTENDEE_STATUS = ['Eingeladen', 'Zugesagt', 'Teilgenommen', 'Abgesagt'];
const STATUS_TONE = { Geplant: 'amber', 'Läuft': 'blue', Abgeschlossen: 'green', Abgesagt: 'red' };
const TYPE_TONE = { Messe: 'brand', Kongress: 'purple', Hausmesse: 'teal', Webinar: 'blue', Workshop: 'amber' };
const AT_TONE = { Eingeladen: 'gray', Zugesagt: 'blue', Teilgenommen: 'green', Abgesagt: 'red' };
const REF_LABEL = { account: 'Firma', contact: 'Ansprechpartner', lead: 'Interessent' };
const NOW = new Date();

export default function Events() {
  const db = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Alle');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  useOpenParam(db.events, setSel);
  const { sort, toggle, apply } = useSort('start', 'desc');

  const rows = useMemo(() => {
    const filtered = db.events.filter((e) =>
      (status === 'Alle' || e.status === status) &&
      (!q || e.name.toLowerCase().includes(q.toLowerCase()) || (e.location || '').toLowerCase().includes(q.toLowerCase())));
    return apply(filtered, {
      name: (e) => e.name, type: (e) => e.type, location: (e) => e.location, start: (e) => new Date(e.startDate).getTime(),
      status: (e) => e.status, attendees: (e) => e.attendees?.length || 0, cost: (e) => e.cost || 0,
    });
  }, [db.events, q, status, sort]);

  const upcoming = db.events.filter((e) => e.status === 'Geplant' || new Date(e.startDate) > NOW).length;
  const totalCost = db.events.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalAttendees = db.events.reduce((s, e) => s + (e.attendees?.length || 0), 0);

  const doExport = () => {
    exportCsv('messen.csv', [
      { label: 'Veranstaltung', get: (e) => e.name }, { label: 'Typ', get: (e) => e.type },
      { label: 'Ort', get: (e) => e.location }, { label: 'Start', get: (e) => fmtDate(e.startDate) },
      { label: 'Ende', get: (e) => fmtDate(e.endDate) }, { label: 'Status', get: (e) => e.status },
      { label: 'Teilnehmer', get: (e) => e.attendees?.length || 0 },
      { label: 'Budget', get: (e) => e.budget || 0 }, { label: 'Kosten', get: (e) => e.cost || 0 },
    ], rows);
    toast('Messen exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Messen & Veranstaltungen</h1><div className="sub">Messen, Kongresse, Hausmessen & Webinare — mit Teilnehmerlisten und Budget</div></div>
        <div className="page-actions">
          <button className="btn" onClick={doExport}>Exportieren</button>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neue Veranstaltung</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Presentation} tone="brand" label="Veranstaltungen" value={db.events.length} />
        <KpiCard icon={CalendarClock} tone="amber" label="Anstehend" value={upcoming} />
        <KpiCard icon={Users} tone="teal" label="Teilnehmer gesamt" value={totalAttendees} />
        <KpiCard icon={Euro} tone="purple" label="Kosten gesamt" value={fmtMoneyShort(totalCost)} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Name oder Ort…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {['Alle', ...EVENT_STATUS].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr>
            <SortTh label="Veranstaltung" sortKey="name" sort={sort} onSort={toggle} />
            <SortTh label="Typ" sortKey="type" sort={sort} onSort={toggle} />
            <SortTh label="Ort" sortKey="location" sort={sort} onSort={toggle} />
            <SortTh label="Zeitraum" sortKey="start" sort={sort} onSort={toggle} />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
            <SortTh label="Teilnehmer" sortKey="attendees" sort={sort} onSort={toggle} align="right" />
            <SortTh label="Kosten" sortKey="cost" sort={sort} onSort={toggle} align="right" />
          </tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} onClick={() => setSel(e)}>
                <td className="cell-main">{e.name}</td>
                <td><Badge tone={TYPE_TONE[e.type]}>{e.type}</Badge></td>
                <td className="muted">{e.location}</td>
                <td className="nowrap">{fmtDate(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ' – ' + fmtDate(e.endDate) : ''}</td>
                <td><Badge tone={STATUS_TONE[e.status]} dot>{e.status}</Badge></td>
                <td className="right">{e.attendees?.length || 0}</td>
                <td className="right"><b>{fmtMoney(e.cost || 0)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine Veranstaltungen" hint="Messen, Kongresse, Hausmessen & Webinare." action={{ label: 'Neue Veranstaltung', onClick: () => setAdding(true) }} />}</div>
      </div>

      {sel && <EventDrawer db={db} event={db.events.find((e) => e.id === sel.id) || sel} onClose={() => setSel(null)} toast={toast} />}
      {adding && <NewEvent db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function AttendeeName({ db, at }) {
  if (at.refType === 'account') return <AccountLink account={db.accounts.find((a) => a.id === at.refId)} />;
  if (at.refType === 'contact') return <ContactLink contact={db.contacts.find((c) => c.id === at.refId)} />;
  const l = db.leads.find((x) => x.id === at.refId);
  return l ? <span className="rec-link" onClick={() => (window.location.hash = '#/leads/' + l.id)}>{l.name}</span> : <span className="muted">—</span>;
}

function EventDrawer({ db, event: e, onClose, toast }) {
  const nav = useNavigate();
  const owner = db.users.find((u) => u.id === e.ownerId);
  const attendees = e.attendees || [];
  const [refType, setRefType] = useState('account');
  const [refId, setRefId] = useState('');
  const [role, setRole] = useState('');
  const [atStatus, setAtStatus] = useState('Eingeladen');

  const pool = refType === 'account' ? db.accounts : refType === 'contact' ? db.contacts : db.leads;
  const takenIds = attendees.filter((a) => a.refType === refType).map((a) => a.refId);
  const options = pool.filter((p) => !takenIds.includes(p.id));

  const addAttendee = () => {
    const id = refId || options[0]?.id;
    if (!id) { toast('Keine Auswahl möglich'); return; }
    store.update('events', e.id, { attendees: [...attendees, { refType, refId: id, role: role || '', status: atStatus }] });
    setRefId(''); setRole('');
    toast('Teilnehmer hinzugefügt');
  };
  const removeAttendee = (idx) => store.update('events', e.id, { attendees: attendees.filter((_, i) => i !== idx) });
  const setAttendeeStatus = (idx, s) => store.update('events', e.id, { attendees: attendees.map((a, i) => (i === idx ? { ...a, status: s } : a)) });
  const setStatus = (s) => { store.update('events', e.id, { status: s }); toast('Status aktualisiert'); };

  const nameOf = (p) => p.name + (refType === 'contact' ? ` (${db.accounts.find((a) => a.id === p.accountId)?.name || ''})` : refType === 'lead' ? ` (${p.company})` : '');

  return (
    <Drawer title={e.name} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Schließen</button>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge tone={TYPE_TONE[e.type]}>{e.type}</Badge>
        <Badge tone={STATUS_TONE[e.status]} dot>{e.status}</Badge>
      </div>
      <Field label="Status">
        <select className="select" value={e.status} onChange={(ev) => setStatus(ev.target.value)}>{EVENT_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
      </Field>
      <div style={{ height: 14 }} />
      <dl className="kv">
        <dt>Ort</dt><dd>{e.location || '—'}</dd>
        <dt>Zeitraum</dt><dd>{fmtDate(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ' – ' + fmtDate(e.endDate) : ''}</dd>
        <dt>Verantwortlich</dt><dd>{owner?.name || '—'}</dd>
        <dt>Budget</dt><dd>{fmtMoney(e.budget || 0)}</dd>
        <dt>Kosten</dt><dd><b>{fmtMoney(e.cost || 0)}</b>{e.budget ? <span className="muted tiny"> ({e.cost <= e.budget ? 'im Budget' : 'über Budget'})</span> : null}</dd>
      </dl>
      {e.notes && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{e.notes}</p>}

      <h3 style={{ fontSize: 14, margin: '20px 0 10px' }}>Teilnehmer ({attendees.length})</h3>
      <div className="card" style={{ overflow: 'hidden', marginBottom: 14 }}><table className="tbl">
        <thead><tr><th>Teilnehmer</th><th>Typ</th><th>Rolle</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {attendees.map((at, i) => (
            <tr key={i} style={{ cursor: 'default' }}>
              <td className="cell-main"><AttendeeName db={db} at={at} /></td>
              <td><Badge tone="gray">{REF_LABEL[at.refType]}</Badge></td>
              <td className="muted">{at.role || '—'}</td>
              <td>
                <select className="select" style={{ height: 30, padding: '2px 8px' }} value={at.status} onChange={(ev) => setAttendeeStatus(i, ev.target.value)}>
                  {ATTENDEE_STATUS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              <td className="right"><button className="btn ghost sm" onClick={() => removeAttendee(i)}><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>{attendees.length === 0 && <Empty label="Noch keine Teilnehmer" />}</div>

      <div className="card card-pad">
        <div className="muted tiny" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Teilnehmer hinzufügen</div>
        <div className="form-grid">
          <Field label="Art"><select className="select" value={refType} onChange={(ev) => { setRefType(ev.target.value); setRefId(''); }}>{Object.entries(REF_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label={REF_LABEL[refType]}><select className="select" value={refId} onChange={(ev) => setRefId(ev.target.value)}><option value="">{options[0] ? '— Bitte wählen —' : '— Keine verfügbar —'}</option>{options.map((p) => <option key={p.id} value={p.id}>{nameOf(p)}</option>)}</select></Field>
          <Field label="Rolle"><input className="input" value={role} onChange={(ev) => setRole(ev.target.value)} placeholder="z. B. Entscheider, Einkauf" /></Field>
          <Field label="Status"><select className="select" value={atStatus} onChange={(ev) => setAtStatus(ev.target.value)}>{ATTENDEE_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div style={{ marginTop: 10 }}><button className="btn primary sm" onClick={addAttendee}><Plus size={14} /> Hinzufügen</button></div>
      </div>
    </Drawer>
  );
}

function NewEvent({ db, onClose, toast }) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ name: '', type: 'Messe', location: '', startDate: today, endDate: today, status: 'Geplant', budget: 0, cost: 0, ownerId: db.meta.currentUserId, notes: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name) { toast('Bitte einen Namen angeben'); return; }
    store.add('events', {
      name: f.name, type: f.type, location: f.location, startDate: new Date(f.startDate).toISOString(),
      endDate: new Date(f.endDate || f.startDate).toISOString(), status: f.status,
      budget: Number(f.budget) || 0, cost: Number(f.cost) || 0, ownerId: f.ownerId, notes: f.notes, attendees: [],
    });
    toast('Veranstaltung angelegt'); onClose();
  };
  return (
    <Modal title="Neue Veranstaltung" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Anlegen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. MEDICA 2026" autoFocus /></Field></div>
        <Field label="Typ"><select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Ort"><input className="input" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="z. B. Düsseldorf" /></Field>
        <Field label="Start"><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Ende"><input className="input" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{EVENT_STATUS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Verantwortlich"><select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Budget (€)"><input className="input" type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} /></Field>
        <Field label="Kosten (€)"><input className="input" type="number" value={f.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
        <div className="full"><Field label="Notizen"><textarea className="input" rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field></div>
      </div>
    </Modal>
  );
}
