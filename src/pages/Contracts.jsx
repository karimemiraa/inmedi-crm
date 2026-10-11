import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileSignature, Repeat, CalendarClock, XCircle } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Empty, KpiCard, Drawer, Field, Modal, AccountLink, ContactLink, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useOpenParam, openLink } from '../lib/nav.js';
import LineItems, { BILLING_FACTOR } from '../components/LineItems.jsx';
import { CustomFieldsEditor, CustomFieldsDisplay } from '../components/CustomFields.jsx';
import { useToast } from '../components/Toast.jsx';
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
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Alle');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);

  useOpenParam(db.contracts, setSel);
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
        <div className="table-wrap"><table className="tbl">
          <thead><tr>
            <SortTh label="Nr." sortKey="number" sort={sort} onSort={toggle} />
            <SortTh label="Betreff" sortKey="title" sort={sort} onSort={toggle} />
            <SortTh label="Kunde" sortKey="account" sort={sort} onSort={toggle} />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
            <SortTh label="Start" sortKey="start" sort={sort} onSort={toggle} />
            <SortTh label="Laufzeit" sortKey="term" sort={sort} onSort={toggle} />
            <SortTh label="Jahreswert" sortKey="annual" sort={sort} onSort={toggle} align="right" />
          </tr></thead>
          <tbody>
            {rows.map((c) => {
              const v = contractValues(c.items);
              return (
                <tr key={c.id} onClick={() => setSel(c)}>
                  <td className="cell-main nowrap">{c.number}</td>
                  <td>{c.title}</td>
                  <td><AccountLink account={acct(c.accountId)} /></td>
                  <td><Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge></td>
                  <td className="nowrap">{fmtDate(c.startDate)}</td>
                  <td className="nowrap">{c.termMonths} Mon.</td>
                  <td className="right"><b>{fmtMoney(v.annual)}</b>{v.once > 0 && <div className="cell-sub">+ {fmtMoney(v.once)} einm.</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Noch keine Verträge" hint="Laufzeitverträge mit wiederkehrender Abrechnung." action={{ label: 'Neuer Vertrag', onClick: () => setAdding(true) }} />}</div>
      </div>

      {sel && <ContractDrawer db={db} contract={sel} onClose={() => setSel(null)} toast={toast} setSel={setSel} />}
      {adding && <NewContract db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function ContractDrawer({ db, contract: c, onClose, toast, setSel }) {
  const nav = useNavigate();
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const contact = db.contacts.find((x) => x.id === c.contactId);
  const fromOrder = db.orders.find((o) => o.id === c.fromOrderId);
  const v = contractValues(c.items);
  const cancel = () => {
    const reason = prompt('Kündigungsgrund:');
    if (reason == null) return;
    store.update('contracts', c.id, { status: 'Gekündigt', cancellationReason: reason });
    toast('Vertrag gekündigt'); onClose();
  };
  return (
    <Drawer title={c.number} onClose={onClose}
      footer={<>
        {c.status !== 'Gekündigt' && <button className="btn danger" onClick={cancel}><XCircle size={14} /> Kündigen</button>}
        <button className="btn primary" onClick={onClose}>Schließen</button>
      </>}>
      <h3 style={{ fontSize: 16, marginBottom: 10 }}>{c.title}</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Badge tone={STATUS_TONE[c.status]} dot>{c.status}</Badge>
      </div>
      <Field label="Status">
        <select className="select" value={c.status} onChange={(e) => { store.update('contracts', c.id, { status: e.target.value }); toast('Status aktualisiert'); setSel({ ...c, status: e.target.value }); }}>
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <div style={{ height: 14 }} />
      <dl className="kv">
        <dt>Kunde</dt><dd><AccountLink account={acct(c.accountId)} /></dd>
        <dt>Ansprechpartner</dt><dd>{contact ? <ContactLink contact={contact} /> : '—'}</dd>
        {fromOrder && <><dt>Aus Auftrag</dt><dd><span className="rec-link" onClick={() => nav(openLink('/orders', fromOrder.id))}>{fromOrder.number}</span></dd></>}
        <dt>Verantwortlich</dt><dd>{db.users.find((u) => u.id === c.ownerId)?.name}</dd>
        <dt>Start / Ende</dt><dd>{fmtDate(c.startDate)} – {fmtDate(endDate(c.startDate, c.termMonths))}</dd>
        <dt>Laufzeit</dt><dd>{c.termMonths} Monate</dd>
        <dt>Jahreswert</dt><dd><b>{fmtMoney(v.annual)}</b></dd>
        {v.once > 0 && <><dt>Einmalig</dt><dd>{fmtMoney(v.once)}</dd></>}
        {c.cancellationReason && <><dt>Kündigungsgrund</dt><dd>{c.cancellationReason}</dd></>}
      </dl>
      {c.description && <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{c.description}</p>}
      <h3 style={{ fontSize: 14, margin: '20px 0 10px' }}>Vertragspositionen</h3>
      <div className="card" style={{ overflow: 'hidden' }}><table className="tbl">
        <thead><tr><th>Produkt</th><th>Zahlungsweise</th><th className="right">Menge</th><th className="right">Preis</th></tr></thead>
        <tbody>
          {c.items.map((it, i) => (
            <tr key={i} style={{ cursor: 'default' }}>
              <td className="cell-main">{it.name}</td><td><Badge tone="gray">{it.billing || 'einmalig'}</Badge></td>
              <td className="right">{it.qty}</td><td className="right">{fmtMoney(it.price)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div style={{ marginTop: 18 }}><CustomFieldsDisplay db={db} entity="Vertrag" record={c} /></div>
    </Drawer>
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
        <div className="full"><Field label="Betreff"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="z. B. Wartungsvertrag Endoskopie 2026" autoFocus /></Field></div>
        <Field label="Kunde"><select className="select" value={f.accountId} onChange={(e) => { set('accountId', e.target.value); set('contactId', ''); set('fromOrderId', ''); }}>{db.accounts.length === 0 && <option value="">— kein Konto —</option>}{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Ansprechpartner"><select className="select" value={f.contactId} onChange={(e) => set('contactId', e.target.value)}><option value="">— Keiner —</option>{accContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Verantwortlich"><select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Aus Auftrag (optional)"><select className="select" value={f.fromOrderId} onChange={(e) => set('fromOrderId', e.target.value)}><option value="">— Ohne —</option>{accOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}</select></Field>
        <Field label="Startdatum"><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="Laufzeit (Monate)"><input className="input" type="number" value={f.termMonths} onChange={(e) => set('termMonths', e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{['Aktiv', 'Entwurf'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="full"><Field label="Beschreibung"><input className="input" onChange={(e) => set('description', e.target.value)} /></Field></div>
        <CustomFieldsEditor db={db} entity="Vertrag" values={cv} onChange={setCv} />
      </div>
      <h4 style={{ marginBottom: 10 }}>Vertragspositionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} withBilling />
    </Modal>
  );
}
