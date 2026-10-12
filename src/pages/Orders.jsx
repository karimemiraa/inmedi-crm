import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, ShoppingCart } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Avatar, Badge, Drawer, Empty, Field, KpiCard, Modal, Select, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useOpenParam, openLink } from '../lib/nav.js';
import LineItems from '../components/LineItems.jsx';
import { useToast } from '../components/Toast.jsx';
import { CommentCount, RowActions, StatusBadge } from '../components/Vorgang.jsx';
import { vorgangLink } from '../lib/vorgang.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

const STATUS_TONE = { Entwurf: 'gray', 'Angebot gesendet': 'amber', Bestätigt: 'blue', Versendet: 'purple', Geliefert: 'green' };

export default function Orders() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState(['Auftrag', 'Angebot'].includes(params.get('kind')) ? params.get('kind') : 'All');
  const [adding, setAdding] = useState(null); // 'Angebot' | 'Auftrag'

  useOpenParam(db.orders, (r) => nav(vorgangLink('orders', r.id), { replace: true }));
  const { sort, toggle, apply } = useSort('date', 'desc');
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const rows = useMemo(() => {
    const filtered = db.orders.filter((o) =>
      (kind === 'All' || o.kind === kind) &&
      (!q || o.number.toLowerCase().includes(q.toLowerCase()) || acct(o.accountId)?.name.toLowerCase().includes(q.toLowerCase())));
    return apply(filtered, {
      number: (o) => o.number, kind: (o) => o.kind, account: (o) => acct(o.accountId)?.name,
      pos: (o) => o.items.length, status: (o) => o.status, date: (o) => new Date(o.date).getTime(), total: (o) => o.total,
    });
  }, [db.orders, q, kind, sort]);

  const orderVal = db.orders.filter((o) => o.kind === 'Auftrag').reduce((s, o) => s + o.total, 0);
  const quoteVal = db.orders.filter((o) => o.kind === 'Angebot').reduce((s, o) => s + o.total, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Aufträge & Angebote</h1><div className="sub">{db.orders.length} Datensätze</div></div>
        <div className="page-actions"><button className="btn" onClick={() => setAdding('Angebot')}><FileText size={15} /> Neues Angebot</button><button className="btn primary" onClick={() => setAdding('Auftrag')}><Plus size={16} /> Neuer Auftrag</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={ShoppingCart} tone="brand" label="Auftragswert" value={fmtMoneyShort(orderVal)} />
        <KpiCard icon={FileText} tone="amber" label="Offene Angebote" value={fmtMoneyShort(quoteVal)} />
        <KpiCard icon={ShoppingCart} tone="green" label="Aufträge" value={db.orders.filter((o) => o.kind === 'Auftrag').length} />
        <KpiCard icon={FileText} tone="purple" label="Angebote" value={db.orders.filter((o) => o.kind === 'Angebot').length} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ background: 'var(--surface)', maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Nach Nummer oder Konto suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {[['All', 'Alle'], ['Auftrag', 'Aufträge'], ['Angebot', 'Angebote']].map(([k, l]) => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr>
            <SortTh label="Nummer" sortKey="number" sort={sort} onSort={toggle} />
            <SortTh label="Art" sortKey="kind" sort={sort} onSort={toggle} />
            <SortTh label="Konto" sortKey="account" sort={sort} onSort={toggle} />
            <SortTh label="Pos." sortKey="pos" sort={sort} onSort={toggle} />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
            <SortTh label="Datum" sortKey="date" sort={sort} onSort={toggle} />
            <SortTh label="Gesamt" sortKey="total" sort={sort} onSort={toggle} align="right" />
            <th className="right">Aktionen</th>
          </tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} onClick={() => nav(vorgangLink('orders', o.id))}>
                <td className="cell-main nowrap">{o.number}<CommentCount rec={o} /></td>
                <td><Badge tone={o.kind === 'Angebot' ? 'amber' : 'teal'}>{o.kind}</Badge></td>
                <td><AccountLink account={acct(o.accountId)} /></td>
                <td>{o.items.length}</td>
                <td><StatusBadge db={db} kind="orders" rec={o} /></td>
                <td className="nowrap">{fmtDate(o.date)}</td>
                <td className="right"><b>{fmtMoney(o.total)}</b></td>
                <td className="right nowrap"><RowActions kind="orders" rec={o} toast={toast} /></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine passenden Datensätze" />}</div>
      </div>

      {adding && <NewOrder db={db} kind={adding} onClose={() => setAdding(null)} toast={toast} onCreated={(rec) => nav(vorgangLink('orders', rec.id))} />}
    </div>
  );
}

function NewOrder({ db, kind, onClose, toast, onCreated }) {
  const [accountId, setAccountId] = useState(db.accounts[0]?.id);
  const [dealId, setDealId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState(kind === 'Angebot' ? 'Entwurf' : 'Bestätigt');
  const [items, setItems] = useState([]);
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);
  const statusOpts = kind === 'Angebot' ? ['Entwurf', 'Angebot gesendet'] : ['Bestätigt', 'Versendet', 'Geliefert'];
  const accDeals = db.deals.filter((d) => d.accountId === accountId);
  const save = () => {
    if (items.length === 0) { toast('Bitte mindestens eine Position hinzufügen'); return; }
    const prefix = kind === 'Angebot' ? 'ANG-' : 'AUF-';
    const n = prefix + (24515 + db.orders.length + 1);
    const rec = store.add('orders', {
      number: n, kind, accountId, dealId: dealId || null, ownerId: db.accounts.find((a) => a.id === accountId)?.ownerId || db.meta.currentUserId,
      status, items, total, date: new Date(date).toISOString(),
    });
    toast(kind + ' erstellt'); onClose(); onCreated?.(rec);
  };
  return (
    <Modal title={'Neue(r) ' + kind} wide onClose={onClose}
      footer={<><div style={{ marginRight: 'auto', fontWeight: 700 }}>Gesamt: {fmtMoney(total)}</div><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="Kunde"><Select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setDealId(''); }}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Datum"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Status"><Select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{statusOpts.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="full"><Field label="Zugehöriger Deal (optional)"><Select className="select" value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">— Kein Deal —</option>{accDeals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field></div>
      </div>
      <h4 style={{ marginBottom: 10 }}>Positionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} />
    </Modal>
  );
}
