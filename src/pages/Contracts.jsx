import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileSignature, Repeat, CalendarClock, XCircle } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Badge, ContactLink, Drawer, Empty, Field, KpiCard, Modal, Select, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useOpenParam, openLink } from '../lib/nav.js';
import LineItems, { BILLING_FACTOR } from '../components/LineItems.jsx';
import { CustomFieldsEditor, CustomFieldsDisplay } from '../components/CustomFields.jsx';
import { useToast } from '../components/Toast.jsx';
import { CommentCount, RowActions, StatusBadge } from '../components/Vorgang.jsx';
import { vorgangLink } from '../lib/vorgang.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

const STATUS = ['Entwurf', 'Aktiv', 'Gekündigt', 'Ausgelaufen'];
const STATUS_TONE = { Entwurf: 'gray', Aktiv: 'green', Gekündigt: 'red', Ausgelaufen: 'amber' };
const todayISO = () => new Date().toISOString().slice(0, 10);

// Jahreswert (wiederkehrend) + Einmalwert eines Vertrags
export function contractValues(items = []) {
  let annual = 0, once = 0;
  items.forEach((it) => {
    const line = it.qty * it.price;
    const f = BILLING_FACTOR[it.billing || 'einmalig'];
    if (f === 0) once += line; else annual += line * f;
  });
  return { annual, once };
}
const endDate = (start, months) => { const d = new Date(start); d.setMonth(d.getMonth() + (Number(months) || 0)); return d.toISOString(); };

export default function Contracts() {
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Alle');
  const [adding, setAdding] = useState(false);

  useOpenParam(db.contracts, (r) => nav(vorgangLink('contracts', r.id), { replace: true }));
  const { sort, toggle, apply } = useSort('start', 'desc');
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const rows = useMemo(() => {
    const filtered = db.contracts.filter((c) =>
      (status === 'Alle' || c.status === status) &&
      (!q || c.number.toLowerCase().includes(q.toLowerCase()) || c.title.toLowerCase().includes(q.toLowerCase()) || acct(c.accountId)?.name.toLowerCase().includes(q.toLowerCase())));
    return apply(filtered, {
      number: (c) => c.number, title: (c) => c.title, account: (c) => acct(c.accountId)?.name, status: (c) => c.status,
      start: (c) => new Date(c.startDate).getTime(), term: (c) => c.termMonths, annual: (c) => contractValues(c.items).annual,
    });
  }, [db.contracts, q, status, sort]);

  const active = db.contracts.filter((c) => c.status === 'Aktiv');
  const mrr = active.reduce((s, c) => s + contractValues(c.items).annual, 0) / 12;
  const annualTotal = active.reduce((s, c) => s + contractValues(c.items).annual, 0);
  const cancelled = db.contracts.filter((c) => c.status === 'Gekündigt').length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Verträge</h1><div className="sub">Laufzeitverträge mit wiederkehrender Abrechnung (Zahlungsweise & Laufzeit)</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neuer Vertrag</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={FileSignature} tone="brand" label="Aktive Verträge" value={active.length} />
        <KpiCard icon={Repeat} tone="teal" label="Monatl. wiederkehrend (MRR)" value={fmtMoneyShort(mrr)} />
        <KpiCard icon={CalendarClock} tone="purple" label="Jährl. Vertragswert" value={fmtMoneyShort(annualTotal)} />
        <KpiCard icon={XCircle} tone="red" label="Gekündigt" value={cancelled} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Nr., Betreff oder Kunde…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {['Alle', 'Aktiv', 'Entwurf', 'Gekündigt', 'Ausgelaufen'].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr>
            <SortTh label="Nr." sortKey="number" sort={sort} onSort={toggle} />
            <SortTh label="Betreff" sortKey="title" sort={sort} onSort={toggle} />
            <SortTh label="Kunde" sortKey="account" sort={sort} onSort={toggle} />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
            <SortTh label="Start" sortKey="start" sort={sort} onSort={toggle} />
            <SortTh label="Laufzeit" sortKey="term" sort={sort} onSort={toggle} />
            <SortTh label="Jahreswert" sortKey="annual" sort={sort} onSort={toggle} align="right" />
          <th className="right">Aktionen</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const v = contractValues(c.items);
              return (
                <tr key={c.id} onClick={() => nav(vorgangLink('contracts', c.id))}>
                  <td className="cell-main nowrap">{c.number}</td>
                  <td>{c.title}</td>
                  <td><AccountLink account={acct(c.accountId)} /></td>
                  <td><StatusBadge db={db} kind="contracts" rec={c} /></td>
                  <td className="nowrap">{fmtDate(c.startDate)}</td>
                  <td className="nowrap">{c.termMonths} Mon.</td>
                  <td className="right"><b>{fmtMoney(v.annual)}</b>{v.once > 0 && <div className="cell-sub">+ {fmtMoney(v.once)} einm.</div>}</td>
                  <td className="right nowrap"><RowActions kind="contracts" rec={c} toast={toast} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Noch keine Verträge" hint="Laufzeitverträge mit wiederkehrender Abrechnung." action={{ label: 'Neuer Vertrag', onClick: () => setAdding(true) }} />}</div>
      </div>

      {adding && <NewContract db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}


function NewContract({ db, onClose, toast }) {
  const [f, setF] = useState({ accountId: db.accounts[0]?.id, contactId: '', fromOrderId: '', ownerId: db.meta.currentUserId, startDate: todayISO(), termMonths: 12, status: 'Aktiv', description: '' });
  const [items, setItems] = useState([]);
  const [cv, setCv] = useState({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const accContacts = db.contacts.filter((c) => c.accountId === f.accountId);
  const accOrders = db.orders.filter((o) => o.accountId === f.accountId);
  const v = contractValues(items);
  const save = () => {
    if (!f.title) { toast('Bitte einen Betreff angeben'); return; }
    if (!f.accountId) { toast('Bitte zuerst ein Konto anlegen'); return; }
    const n = 'V-' + (1001 + db.contracts.length);
    store.add('contracts', {
      number: n, title: f.title, accountId: f.accountId, contactId: f.contactId || null, ownerId: f.ownerId,
      status: f.status, startDate: new Date(f.startDate).toISOString(), termMonths: Number(f.termMonths) || 12,
      items, cancellationReason: '', fromOrderId: f.fromOrderId || null, description: f.description,
      createdAt: new Date().toISOString(), customValues: cv,
    });
    toast('Vertrag erstellt'); onClose();
  };
  return (
    <Modal title="Neuer Vertrag" wide onClose={onClose}
      footer={<><div style={{ marginRight: 'auto', fontWeight: 700 }}>Jahreswert: {fmtMoney(v.annual)}{v.once > 0 ? ` (+ ${fmtMoney(v.once)} einm.)` : ''}</div><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <div className="full"><Field label="Betreff"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="z. B. Liefervertrag Endoskopie 2026" autoFocus /></Field></div>
        <Field label="Kunde"><Select className="select" value={f.accountId} onChange={(e) => { set('accountId', e.target.value); set('contactId', ''); set('fromOrderId', ''); }}>{db.accounts.length === 0 && <option value="">— kein Konto —</option>}{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Ansprechpartner"><Select className="select" value={f.contactId} onChange={(e) => set('contactId', e.target.value)}><option value="">— Keiner —</option>{accContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Verantwortlich"><Select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Aus Auftrag (optional)"><Select className="select" value={f.fromOrderId} onChange={(e) => set('fromOrderId', e.target.value)}><option value="">— Ohne —</option>{accOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}</Select></Field>
        <Field label="Startdatum"><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Laufzeit (Monate)"><input className="input" type="number" value={f.termMonths} onChange={(e) => set('termMonths', e.target.value)} /></Field>
        <Field label="Status"><Select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{['Aktiv', 'Entwurf'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="full"><Field label="Beschreibung"><input className="input" onChange={(e) => set('description', e.target.value)} /></Field></div>
        <CustomFieldsEditor db={db} entity="Vertrag" values={cv} onChange={setCv} />
      </div>
      <h4 style={{ marginBottom: 10 }}>Vertragspositionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} withBilling />
    </Modal>
  );
}
