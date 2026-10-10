import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Wrench, CalendarClock, PlayCircle, CheckCircle2, Cpu } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Empty, KpiCard, Drawer, Field, Modal, AccountLink } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtMoney, fmtDate, relDate } from '../lib/format.js';

const TYPES = ['Wartung', 'Reparatur', 'Installation', 'MTK', 'STK', 'Einweisung'];
const STATUSES = ['Offen', 'Geplant', 'In Arbeit', 'Erledigt'];
const STATUS_TONE = { Offen: 'gray', Geplant: 'blue', 'In Arbeit': 'amber', Erledigt: 'green' };
const PRIO_TONE = { Hoch: 'red', Mittel: 'amber', Niedrig: 'gray' };
const TYPE_TONE = { Wartung: 'teal', Reparatur: 'red', Installation: 'blue', MTK: 'purple', STK: 'purple', Einweisung: 'amber' };
const NOW = new Date();

export default function ServiceOrders() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Offen (alle)');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);

  const acct = (id) => db.accounts.find((a) => a.id === id);
  const dev = (id) => db.devices.find((d) => d.id === id);
  const tech = (id) => db.users.find((u) => u.id === id);
  const hourly = db.meta.costRates.hourly;

  const rows = useMemo(() => {
    let r = [...db.serviceOrders];
    if (status === 'Offen (alle)') r = r.filter((s) => s.status !== 'Erledigt');
    else if (status !== 'Alle') r = r.filter((s) => s.status === status);
    if (q) r = r.filter((s) => s.number.toLowerCase().includes(q.toLowerCase()) || s.description.toLowerCase().includes(q.toLowerCase()) || acct(s.accountId)?.name.toLowerCase().includes(q.toLowerCase()));
    return r.sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
  }, [db.serviceOrders, q, status]);

  const open = db.serviceOrders.filter((s) => s.status !== 'Erledigt').length;
  const planned = db.serviceOrders.filter((s) => s.status === 'Geplant').length;
  const inWork = db.serviceOrders.filter((s) => s.status === 'In Arbeit').length;
  const thisWeek = db.serviceOrders.filter((s) => s.status !== 'Erledigt' && (new Date(s.scheduledDate) - NOW) / 86400000 <= 7).length;

  const setStatusOf = (id, s) => { store.update('serviceOrders', id, { status: s }); toast('Serviceauftrag aktualisiert'); };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Serviceaufträge</h1><div className="sub">Wartung, Reparatur, Installation & MTK/STK — geplant und zugewiesen</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neuer Serviceauftrag</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Wrench} tone="brand" label="Offene Aufträge" value={open} />
        <KpiCard icon={CalendarClock} tone="blue" label="Geplant" value={planned} />
        <KpiCard icon={PlayCircle} tone="amber" label="In Arbeit" value={inWork} />
        <KpiCard icon={CalendarClock} tone="red" label="Fällig diese Woche" value={thisWeek} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ maxWidth: 280 }}>
          <Search size={16} /><input placeholder="Nr., Kunde oder Beschreibung…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {['Offen (alle)', 'Geplant', 'In Arbeit', 'Erledigt', 'Alle'].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Nr.</th><th>Typ</th><th>Gerät</th><th>Kunde</th><th>Techniker</th><th>Geplant</th><th>Priorität</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((s) => {
              const overdue = s.status !== 'Erledigt' && new Date(s.scheduledDate) < NOW;
              return (
                <tr key={s.id} onClick={() => setSel(s)}>
                  <td className="cell-main nowrap">{s.number}</td>
                  <td><Badge tone={TYPE_TONE[s.type]}>{s.type}</Badge></td>
                  <td className="nowrap">{dev(s.deviceId)?.name.replace(/\s*\(.*\)/, '') || '—'}</td>
                  <td><AccountLink account={acct(s.accountId)} /></td>
                  <td>{tech(s.technicianId) && <div className="avatar-row"><Avatar size="sm" name={tech(s.technicianId).name} color={tech(s.technicianId).color} src={tech(s.technicianId).avatar} /><span className="tiny">{tech(s.technicianId).name.split(' ')[0]}</span></div>}</td>
                  <td className="nowrap"><Badge tone={overdue ? 'red' : 'gray'} dot={overdue}>{relDate(s.scheduledDate)}</Badge></td>
                  <td><Badge tone={PRIO_TONE[s.priority]}>{s.priority}</Badge></td>
                  <td><Badge tone={STATUS_TONE[s.status]} dot>{s.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine Serviceaufträge" />}</div>
      </div>

      {sel && (
        <Drawer title={sel.number} onClose={() => setSel(null)}
          footer={<>
            {sel.status !== 'Erledigt' && <button className="btn primary" onClick={() => { setStatusOf(sel.id, 'Erledigt'); setSel(null); }}><CheckCircle2 size={14} /> Als erledigt melden</button>}
            <button className="btn" onClick={() => setSel(null)}>Schließen</button>
          </>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Badge tone={TYPE_TONE[sel.type]}>{sel.type}</Badge>
            <Badge tone={PRIO_TONE[sel.priority]}>Priorität: {sel.priority}</Badge>
          </div>
          <p style={{ fontSize: 13.5, marginBottom: 16 }}>{sel.description}</p>
          <Field label="Status">
            <select className="select" value={sel.status} onChange={(e) => { setStatusOf(sel.id, e.target.value); setSel({ ...sel, status: e.target.value }); }}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div style={{ height: 14 }} />
          <dl className="kv">
            <dt>Gerät</dt><dd>{dev(sel.deviceId)?.name || '—'}</dd>
            <dt>Seriennr.</dt><dd>{dev(sel.deviceId)?.serial || '—'}</dd>
            <dt>Kunde</dt><dd><AccountLink account={acct(sel.accountId)} /></dd>
            <dt>Techniker</dt><dd>{tech(sel.technicianId)?.name}</dd>
            <dt>Geplant</dt><dd>{fmtDate(sel.scheduledDate)}</dd>
            <dt>Aufwand</dt><dd>{sel.hours} Std. · Material {fmtMoney(sel.partsCost)}</dd>
            <dt>Kostenschätzung</dt><dd><b>{fmtMoney(sel.hours * hourly + sel.partsCost)}</b></dd>
            {sel.ticketId && <><dt>Ticket</dt><dd><span className="rec-link" onClick={() => nav('/service')}>{db.tickets.find((t) => t.id === sel.ticketId)?.number}</span></dd></>}
          </dl>
        </Drawer>
      )}
      {adding && <AddOrder db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function AddOrder({ db, onClose, toast }) {
  const [f, setF] = useState({ type: 'Wartung', accountId: db.accounts[0]?.id, technicianId: db.users.find((u) => u.title?.includes('Service'))?.id || db.users[0].id, priority: 'Mittel', scheduledDate: new Date().toISOString().slice(0,10), hours: 1, partsCost: 0, description: '', ticketId: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const devicesOfAccount = db.devices.filter((d) => d.accountId === f.accountId);
  const ticketsOfAccount = db.tickets.filter((t) => t.accountId === f.accountId && t.status !== 'Gelöst');
  const save = () => {
    const n = 'SV-' + (7000 + db.serviceOrders.length + 1);
    store.add('serviceOrders', {
      number: n, type: f.type, deviceId: f.deviceId || devicesOfAccount[0]?.id || null, accountId: f.accountId,
      technicianId: f.technicianId, status: 'Geplant', priority: f.priority, scheduledDate: new Date(f.scheduledDate).toISOString(),
      createdAt: new Date().toISOString(), hours: Number(f.hours) || 0, partsCost: Number(f.partsCost) || 0, description: f.description, ticketId: f.ticketId || null,
    });
    toast('Serviceauftrag erstellt'); onClose();
  };
  return (
    <Modal title="Neuer Serviceauftrag" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid">
        <Field label="Typ"><select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Priorität"><select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['Mittel', 'Hoch', 'Niedrig'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Kunde"><select className="select" value={f.accountId} onChange={(e) => { set('accountId', e.target.value); set('deviceId', ''); set('ticketId', ''); }}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Gerät"><select className="select" value={f.deviceId || ''} onChange={(e) => set('deviceId', e.target.value)}><option value="">— Ohne Gerät —</option>{devicesOfAccount.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Aus Ticket (optional)"><select className="select" value={f.ticketId} onChange={(e) => set('ticketId', e.target.value)}><option value="">— Ohne Ticket —</option>{ticketsOfAccount.map((t) => <option key={t.id} value={t.id}>{t.number} · {t.subject}</option>)}</select></Field>
        <Field label="Techniker"><select className="select" value={f.technicianId} onChange={(e) => set('technicianId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Geplant am"><input className="input" type="date" value={f.scheduledDate} onChange={(e) => set('scheduledDate', e.target.value)} /></Field>
        <Field label="Aufwand (Std.)"><input className="input" type="number" value={f.hours} onChange={(e) => set('hours', e.target.value)} /></Field>
        <Field label="Materialkosten (€)"><input className="input" type="number" value={f.partsCost} onChange={(e) => set('partsCost', e.target.value)} /></Field>
        <div className="full"><Field label="Beschreibung"><input className="input" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Was ist zu tun?" /></Field></div>
      </div>
    </Modal>
  );
}
