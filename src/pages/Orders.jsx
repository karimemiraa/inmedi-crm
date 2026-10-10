import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, ShoppingCart } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Empty, Drawer, KpiCard, Modal, Field, AccountLink } from '../components/ui.jsx';
import { useOpenParam, openLink } from '../lib/nav.js';
import LineItems from '../components/LineItems.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

const STATUS_TONE = { Entwurf: 'gray', 'Angebot gesendet': 'amber', Bestätigt: 'blue', Versendet: 'purple', Geliefert: 'green' };

export default function Orders() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('All');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(null); // 'Angebot' | 'Auftrag'

  useOpenParam(db.orders, setSel);
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const rows = useMemo(() => db.orders.filter((o) =>
    (kind === 'All' || o.kind === kind) &&
    (!q || o.number.toLowerCase().includes(q.toLowerCase()) || acct(o.accountId)?.name.toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => new Date(b.date) - new Date(a.date)), [db.orders, q, kind]);

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
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Nummer</th><th>Art</th><th>Konto</th><th>Pos.</th><th>Status</th><th>Datum</th><th className="right">Gesamt</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} onClick={() => setSel(o)}>
                <td className="cell-main nowrap">{o.number}</td>
                <td><Badge tone={o.kind === 'Angebot' ? 'amber' : 'teal'}>{o.kind}</Badge></td>
                <td><AccountLink account={acct(o.accountId)} /></td>
                <td>{o.items.length}</td>
                <td><Badge tone={STATUS_TONE[o.status]} dot>{o.status}</Badge></td>
                <td className="nowrap">{fmtDate(o.date)}</td>
                <td className="right"><b>{fmtMoney(o.total)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine passenden Datensätze" />}</div>
      </div>

      {sel && (
        <Drawer title={sel.number} onClose={() => setSel(null)} footer={<button className="btn primary" onClick={() => setSel(null)}>Schließen</button>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Badge tone={sel.kind === 'Angebot' ? 'amber' : 'teal'}>{sel.kind}</Badge>
            <Badge tone={STATUS_TONE[sel.status]} dot>{sel.status}</Badge>
          </div>
          <dl className="kv" style={{ marginBottom: 18 }}>
            <dt>Konto</dt><dd><AccountLink account={acct(sel.accountId)} /></dd>
            <dt>Datum</dt><dd>{fmtDate(sel.date)}</dd>
            <dt>Betreuer</dt><dd>{db.users.find((u) => u.id === sel.ownerId)?.name}</dd>
            {sel.dealId && <><dt>Deal</dt><dd><span className="rec-link" onClick={() => nav(openLink('/pipeline', sel.dealId))}>{db.deals.find((d) => d.id === sel.dealId)?.name || '—'}</span></dd></>}
            {db.invoices.filter((i) => i.orderId === sel.id).length > 0 && (
              <><dt>Rechnungen</dt><dd>{db.invoices.filter((i) => i.orderId === sel.id).map((i) => <span key={i.id} className="rec-link" style={{ marginRight: 8 }} onClick={() => nav(openLink('/invoices', i.id))}>{i.number}</span>)}</dd></>
            )}
          </dl>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Positionen</h3>
          <div className="card" style={{ overflow: 'hidden' }}><table className="tbl">
            <thead><tr><th>Produkt</th><th className="right">Menge</th><th className="right">Preis</th><th className="right">Gesamt</th></tr></thead>
            <tbody>
              {sel.items.map((it, i) => (
                <tr key={i} style={{ cursor: 'default' }}>
                  <td className="cell-main">{it.name}</td>
                  <td className="right">{it.qty}</td>
                  <td className="right">{fmtMoney(it.price)}</td>
                  <td className="right"><b>{fmtMoney(it.qty * it.price)}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, padding: '0 4px', fontSize: 16, fontWeight: 800 }}>
            <span>Gesamt</span><span>{fmtMoney(sel.total)}</span>
          </div>
        </Drawer>
      )}
      {adding && <NewOrder db={db} kind={adding} onClose={() => setAdding(null)} toast={toast} />}
    </div>
  );
}

function NewOrder({ db, kind, onClose, toast }) {
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
    store.add('orders', {
      number: n, kind, accountId, dealId: dealId || null, ownerId: db.accounts.find((a) => a.id === accountId)?.ownerId || db.meta.currentUserId,
      status, items, total, date: new Date(date).toISOString(),
    });
    toast(kind + ' erstellt'); onClose();
  };
  return (
    <Modal title={'Neue(r) ' + kind} wide onClose={onClose}
      footer={<><div style={{ marginRight: 'auto', fontWeight: 700 }}>Gesamt: {fmtMoney(total)}</div><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="Kunde"><select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setDealId(''); }}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Datum"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Status"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>{statusOpts.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="full"><Field label="Zugehöriger Deal (optional)"><select className="select" value={dealId} onChange={(e) => setDealId(e.target.value)}><option value="">— Kein Deal —</option>{accDeals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field></div>
      </div>
      <h4 style={{ marginBottom: 10 }}>Positionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} />
    </Modal>
  );
}
