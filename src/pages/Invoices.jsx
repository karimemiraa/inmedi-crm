import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, FileText, Euro, AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Badge, Drawer, Empty, Field, KpiCard, Modal, Select, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useOpenParam, openLink } from '../lib/nav.js';
import LineItems from '../components/LineItems.jsx';
import { useToast } from '../components/Toast.jsx';
import { CommentCount, RowActions, StatusBadge } from '../components/Vorgang.jsx';
import { vorgangLink } from '../lib/vorgang.js';
import { exportCsv } from '../lib/csv.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

const STATUS_TONE = { Entwurf: 'gray', Versendet: 'blue', Teilbezahlt: 'amber', Bezahlt: 'green', Überfällig: 'red' };
const NOW = new Date();

export default function Invoices() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') || 'All');
  const [adding, setAdding] = useState(false);

  useOpenParam(db.invoices, (r) => nav(vorgangLink('invoices', r.id), { replace: true }));
  const { sort, toggle, apply } = useSort('issue', 'desc');
  const acct = (id) => db.accounts.find((a) => a.id === id);

  const rows = useMemo(() => {
    const filtered = db.invoices.filter((i) =>
      (status === 'All' || (status === 'offen' ? (i.total - i.paid) > 0 : i.status === status)) &&
      (!q || i.number.toLowerCase().includes(q.toLowerCase()) || acct(i.accountId)?.name.toLowerCase().includes(q.toLowerCase())));
    return apply(filtered, {
      number: (i) => i.number, account: (i) => acct(i.accountId)?.name, issue: (i) => new Date(i.issueDate).getTime(),
      due: (i) => new Date(i.dueDate).getTime(), status: (i) => i.status, total: (i) => i.total, open: (i) => i.total - i.paid,
    });
  }, [db.invoices, q, status, sort]);

  const invoiced = db.invoices.reduce((s, i) => s + i.total, 0);
  const openItems = db.invoices.reduce((s, i) => s + (i.total - i.paid), 0);
  const overdue = db.invoices.filter((i) => i.status === 'Überfällig').reduce((s, i) => s + (i.total - i.paid), 0);
  const paidRate = invoiced ? Math.round((db.invoices.reduce((s, i) => s + i.paid, 0) / invoiced) * 100) : 0;

  const markPaid = (id) => { store.update('invoices', id, { status: 'Bezahlt', paid: db.invoices.find((i) => i.id === id).total }); toast('Als bezahlt markiert'); };

  const doExport = () => {
    exportCsv('rechnungen.csv', [
      { label: 'Nummer', get: (r) => r.number },
      { label: 'Konto', get: (r) => acct(r.accountId)?.name },
      { label: 'Rechnungsdatum', get: (r) => fmtDate(r.issueDate) },
      { label: 'Fällig', get: (r) => fmtDate(r.dueDate) },
      { label: 'Status', get: (r) => r.status },
      { label: 'Gesamt', get: (r) => r.total },
      { label: 'Bezahlt', get: (r) => r.paid },
      { label: 'Offen', get: (r) => r.total - r.paid },
    ], rows);
    toast('Rechnungen exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Rechnungen</h1><div className="sub">{db.invoices.length} Rechnungen · offene Posten & Zahlungsstatus</div></div>
        <div className="page-actions">
          <button className="btn" onClick={doExport}><Download size={15} /> Exportieren</button>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neue Rechnung</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Euro} tone="brand" label="Fakturiert" value={fmtMoneyShort(invoiced)} />
        <KpiCard icon={FileText} tone="amber" label="Offene Posten" value={fmtMoneyShort(openItems)} />
        <KpiCard icon={AlertTriangle} tone="red" label="Überfällig" value={fmtMoneyShort(overdue)} />
        <KpiCard icon={CheckCircle2} tone="green" label="Bezahlquote" value={paidRate + ' %'} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ background: 'var(--surface)', maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Nach Nummer oder Konto suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {[['All', 'Alle Status'], ['offen', 'Offene Posten'], ['Entwurf', 'Entwurf'], ['Versendet', 'Versendet'], ['Teilbezahlt', 'Teilbezahlt'], ['Bezahlt', 'Bezahlt'], ['Überfällig', 'Überfällig']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr>
            <SortTh label="Nummer" sortKey="number" sort={sort} onSort={toggle} />
            <SortTh label="Konto" sortKey="account" sort={sort} onSort={toggle} />
            <SortTh label="Datum" sortKey="issue" sort={sort} onSort={toggle} />
            <SortTh label="Fällig" sortKey="due" sort={sort} onSort={toggle} />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
            <SortTh label="Gesamt" sortKey="total" sort={sort} onSort={toggle} align="right" />
            <SortTh label="Offen" sortKey="open" sort={sort} onSort={toggle} align="right" />
          <th className="right">Aktionen</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} onClick={() => nav(vorgangLink('invoices', i.id))}>
                <td className="cell-main nowrap">{i.number}</td>
                <td><AccountLink account={acct(i.accountId)} /></td>
                <td className="nowrap">{fmtDate(i.issueDate)}</td>
                <td className="nowrap">{fmtDate(i.dueDate)}</td>
                <td><StatusBadge db={db} kind="invoices" rec={i} /></td>
                <td className="right"><b>{fmtMoney(i.total)}</b></td>
                <td className="right" style={{ color: i.total - i.paid > 0 ? 'var(--red)' : 'var(--text-3)' }}>{fmtMoney(i.total - i.paid)}</td>
                <td className="right nowrap"><RowActions kind="invoices" rec={i} toast={toast} /></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine passenden Rechnungen" />}</div>
      </div>

      {adding && <NewInvoice db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewInvoice({ db, onClose, toast }) {
  const [accountId, setAccountId] = useState(db.accounts[0]?.id);
  const [orderId, setOrderId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState('Entwurf');
  const [items, setItems] = useState([]);
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);
  const accOrders = db.orders.filter((o) => o.accountId === accountId && o.kind === 'Auftrag');
  const pickOrder = (oid) => {
    setOrderId(oid);
    const o = db.orders.find((x) => x.id === oid);
    if (o) setItems(o.items.map((it) => ({ ...it }))); // Positionen aus Auftrag übernehmen
  };
  const save = () => {
    if (items.length === 0) { toast('Bitte mindestens eine Position hinzufügen'); return; }
    const iss = new Date(issueDate); const due = new Date(iss); due.setDate(due.getDate() + 30);
    const n = 'RE-' + (25010 + db.invoices.length + 1);
    store.add('invoices', {
      number: n, accountId, ownerId: db.accounts.find((a) => a.id === accountId)?.ownerId || db.meta.currentUserId,
      orderId: orderId || null, status, issueDate: iss.toISOString(), dueDate: due.toISOString(),
      items, total, paid: status === 'Bezahlt' ? total : 0,
    });
    toast('Rechnung erstellt'); onClose();
  };
  return (
    <Modal title="Neue Rechnung" wide onClose={onClose}
      footer={<><div style={{ marginRight: 'auto', fontWeight: 700 }}>Gesamt: {fmtMoney(total)}</div><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="Kunde"><Select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setOrderId(''); }}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Rechnungsdatum"><input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
        <Field label="Status"><Select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{['Entwurf', 'Versendet', 'Bezahlt'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="full"><Field label="Aus Auftrag (optional — übernimmt Positionen)"><Select className="select" value={orderId} onChange={(e) => pickOrder(e.target.value)}><option value="">— Ohne Auftragsbezug —</option>{accOrders.map((o) => <option key={o.id} value={o.id}>{o.number} · {fmtMoney(o.total)}</option>)}</Select></Field></div>
      </div>
      <h4 style={{ marginBottom: 10 }}>Positionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} />
    </Modal>
  );
}
