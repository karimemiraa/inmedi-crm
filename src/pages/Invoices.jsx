import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Download, FileText, Euro, AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Empty, KpiCard, Drawer, Modal, Field, AccountLink, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useOpenParam, openLink } from '../lib/nav.js';
import LineItems from '../components/LineItems.jsx';
import { useToast } from '../components/Toast.jsx';
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
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);

  useOpenParam(db.invoices, setSel);
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
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}>
          {[['All', 'Alle Status'], ['offen', 'Offene Posten'], ['Entwurf', 'Entwurf'], ['Versendet', 'Versendet'], ['Teilbezahlt', 'Teilbezahlt'], ['Bezahlt', 'Bezahlt'], ['Überfällig', 'Überfällig']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
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
          </tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} onClick={() => setSel(i)}>
                <td className="cell-main nowrap">{i.number}</td>
                <td><AccountLink account={acct(i.accountId)} /></td>
                <td className="nowrap">{fmtDate(i.issueDate)}</td>
                <td className="nowrap">{fmtDate(i.dueDate)}</td>
                <td><Badge tone={STATUS_TONE[i.status]} dot>{i.status}</Badge></td>
                <td className="right"><b>{fmtMoney(i.total)}</b></td>
                <td className="right" style={{ color: i.total - i.paid > 0 ? 'var(--red)' : 'var(--text-3)' }}>{fmtMoney(i.total - i.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine passenden Rechnungen" />}</div>
      </div>

      {sel && (
        <Drawer title={sel.number} onClose={() => setSel(null)}
          footer={<>
            <button className="btn" onClick={() => toast('Rechnung als PDF versendet')}><Send size={14} /> Per E-Mail senden</button>
            <button className="btn primary" disabled={sel.status === 'Bezahlt'} onClick={() => { markPaid(sel.id); setSel(null); }}>Als bezahlt markieren</button>
          </>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Badge tone={STATUS_TONE[sel.status]} dot>{sel.status}</Badge>
          </div>
          <dl className="kv" style={{ marginBottom: 18 }}>
            <dt>Konto</dt><dd><AccountLink account={acct(sel.accountId)} /></dd>
            {sel.orderId && <><dt>Auftrag</dt><dd><span className="rec-link" onClick={() => nav(openLink('/orders', sel.orderId))}>{db.orders.find((o) => o.id === sel.orderId)?.number || '—'}</span></dd></>}
            <dt>Rechnungsdatum</dt><dd>{fmtDate(sel.issueDate)}</dd>
            <dt>Fällig am</dt><dd>{fmtDate(sel.dueDate)}</dd>
            <dt>Betreuer</dt><dd>{db.users.find((u) => u.id === sel.ownerId)?.name}</dd>
          </dl>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Positionen</h3>
          <div className="card" style={{ overflow: 'hidden' }}><table className="tbl">
            <thead><tr><th>Produkt</th><th className="right">Menge</th><th className="right">Preis</th><th className="right">Gesamt</th></tr></thead>
            <tbody>
              {sel.items.map((it, k) => (
                <tr key={k} style={{ cursor: 'default' }}>
                  <td className="cell-main">{it.name}</td><td className="right">{it.qty}</td>
                  <td className="right">{fmtMoney(it.price)}</td><td className="right"><b>{fmtMoney(it.qty * it.price)}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div style={{ marginTop: 16, padding: '0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span className="muted">Bezahlt</span><span>{fmtMoney(sel.paid)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 6 }}><span>Offener Betrag</span><span style={{ color: sel.total - sel.paid > 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(sel.total - sel.paid)}</span></div>
          </div>
        </Drawer>
      )}
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
        <Field label="Kunde"><select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setOrderId(''); }}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Rechnungsdatum"><input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{['Entwurf', 'Versendet', 'Bezahlt'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="full"><Field label="Aus Auftrag (optional — übernimmt Positionen)"><select className="select" value={orderId} onChange={(e) => pickOrder(e.target.value)}><option value="">— Ohne Auftragsbezug —</option>{accOrders.map((o) => <option key={o.id} value={o.id}>{o.number} · {fmtMoney(o.total)}</option>)}</select></Field></div>
      </div>
      <h4 style={{ marginBottom: 10 }}>Positionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} />
    </Modal>
  );
}
