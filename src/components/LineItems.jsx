import { useState } from 'react';
import { Select } from './ui.jsx';
import { Plus, Trash2 } from 'lucide-react';
import { fmtMoney } from '../lib/format.js';

export const BILLING = ['einmalig', 'monatlich', 'quartalsweise', 'jährlich'];
// Faktor zur Hochrechnung auf Jahreswert (einmalig zählt nicht als wiederkehrend)
export const BILLING_FACTOR = { einmalig: 0, monatlich: 12, quartalsweise: 4, jährlich: 1 };

// Reusable product line-item editor for orders, invoices & contracts.
// withBilling=true blendet Zahlungsweise je Position ein (für Verträge/Angebote).
export default function LineItems({ products, items, setItems, withBilling = false }) {
  const [pid, setPid] = useState(products[0]?.id || '');
  const [qty, setQty] = useState(1);
  const [billing, setBilling] = useState('einmalig');
  const add = () => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    const item = { productId: p.id, name: p.name, qty: Number(qty) || 1, price: p.price };
    if (withBilling) item.billing = billing;
    setItems([...items, item]);
    setQty(1);
  };
  const remove = (i) => setItems(items.filter((_, k) => k !== i));
  const total = items.reduce((s, it) => s + it.qty * it.price, 0);

  if (products.length === 0) {
    return <div className="muted tiny" style={{ padding: '8px 0' }}>Noch keine Produkte angelegt. Bitte zuerst unter „Produkte" einen Artikel erfassen.</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 2, minWidth: 160 }}>
          <label>Produkt</label>
          <Select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price)})</option>)}
          </Select>
        </div>
        <div className="field" style={{ width: 80 }}><label>Menge</label><input className="input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        {withBilling && (
          <div className="field" style={{ width: 150 }}><label>Zahlungsweise</label>
            <Select className="select" value={billing} onChange={(e) => setBilling(e.target.value)}>{BILLING.map((b) => <option key={b}>{b}</option>)}</Select>
          </div>
        )}
        <button className="btn" type="button" onClick={add}><Plus size={15} /> Position</button>
      </div>
      {items.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}><table className="tbl">
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ cursor: 'default' }}>
                <td className="cell-main">{it.name}</td>
                {withBilling && <td><span className="badge gray">{it.billing || 'einmalig'}</span></td>}
                <td className="right">{it.qty} ×</td>
                <td className="right">{fmtMoney(it.price)}</td>
                <td className="right"><b>{fmtMoney(it.qty * it.price)}</b></td>
                <td className="right" style={{ width: 40 }}><button className="btn ghost sm" type="button" onClick={() => remove(i)}><Trash2 size={13} /></button></td>
              </tr>
            ))}
            <tr style={{ cursor: 'default' }}><td className="cell-main">Summe</td>{withBilling && <td />}<td /><td /><td className="right"><b>{fmtMoney(total)}</b></td><td /></tr>
          </tbody>
        </table></div>
      )}
    </div>
  );
}
