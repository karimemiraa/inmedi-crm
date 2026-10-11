import { useState, useMemo } from 'react';
import { Plus, Search, Package } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Empty, Field, KpiCard, Modal, Select, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useToast } from '../components/Toast.jsx';
import { fmtMoney } from '../lib/format.js';
import { Package2, Boxes, AlertTriangle, Tag } from 'lucide-react';

export default function Products() {
  const db = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [adding, setAdding] = useState(false);

  const { sort, toggle, apply } = useSort('name', 'asc');
  const cats = useMemo(() => ['All', ...Array.from(new Set(db.products.map((p) => p.category)))], [db.products]);
  const rows = useMemo(() => {
    const filtered = db.products.filter((p) =>
      (cat === 'All' || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())));
    return apply(filtered, {
      sku: (p) => p.sku, name: (p) => p.name, category: (p) => p.category, unit: (p) => p.unit,
      price: (p) => p.price, stock: (p) => p.stock, status: (p) => (p.stock < 20 ? 0 : 1),
    });
  }, [db.products, q, cat, sort]);

  const lowStock = db.products.filter((p) => p.stock < 20).length;
  const catalogValue = db.products.reduce((s, p) => s + p.price * p.stock, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Produktkatalog</h1><div className="sub">{db.products.length} Medizingeräte & -bedarf</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neues Produkt</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Boxes} tone="brand" label="Artikel gesamt" value={db.products.length} />
        <KpiCard icon={Tag} tone="teal" label="Kategorien" value={cats.length - 1} />
        <KpiCard icon={Package2} tone="green" label="Lagerwert" value={fmtMoney(catalogValue)} />
        <KpiCard icon={AlertTriangle} tone="amber" label="Geringer Bestand" value={lowStock} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ background: 'var(--surface)', maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Produkt oder Artikelnr. suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="select" style={{ width: 'auto' }} value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map((c) => <option key={c} value={c}>{c === 'All' ? 'Alle Kategorien' : c}</option>)}
        </Select>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr>
            <SortTh label="Artikelnr." sortKey="sku" sort={sort} onSort={toggle} />
            <SortTh label="Produkt" sortKey="name" sort={sort} onSort={toggle} />
            <SortTh label="Kategorie" sortKey="category" sort={sort} onSort={toggle} />
            <SortTh label="Einheit" sortKey="unit" sort={sort} onSort={toggle} />
            <SortTh label="Preis" sortKey="price" sort={sort} onSort={toggle} align="right" />
            <SortTh label="Bestand" sortKey="stock" sort={sort} onSort={toggle} align="right" />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
          </tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="muted nowrap">{p.sku}</td>
                <td className="cell-main">{p.name}</td>
                <td><Badge tone="gray">{p.category}</Badge></td>
                <td className="muted">{p.unit}</td>
                <td className="right"><b>{fmtMoney(p.price)}</b></td>
                <td className="right">{p.stock}</td>
                <td><Badge tone={p.stock < 20 ? 'red' : 'green'} dot>{p.stock < 20 ? 'Geringer Bestand' : 'Auf Lager'}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine passenden Produkte" action={{ label: 'Neues Produkt anlegen', onClick: () => setAdding(true) }} />}</div>
      </div>
      {adding && <NewProduct db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewProduct({ db, onClose, toast }) {
  const cats = Array.from(new Set([...(db.meta.productCategories || []), ...db.products.map((p) => p.category)]));
  const [f, setF] = useState({ category: cats[0] || 'Sonstige', unit: 'Stück', price: 0, stock: 0 });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name) return;
    const sku = f.sku || 'IM-' + (1013 + db.products.length);
    store.add('products', {
      sku, name: f.name, category: f.category, price: Number(f.price) || 0,
      unit: f.unit, stock: Number(f.stock) || 0, status: 'Aktiv',
    });
    toast('Produkt angelegt'); onClose();
  };
  return (
    <Modal title="Neues Produkt" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Anlegen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Produktname"><input className="input" onChange={(e) => set('name', e.target.value)} placeholder="z. B. Infusionspumpe X300" autoFocus /></Field></div>
        <Field label="Artikelnummer"><input className="input" onChange={(e) => set('sku', e.target.value)} placeholder="automatisch, wenn leer" /></Field>
        <Field label="Kategorie"><Select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Preis (€)"><input className="input" type="number" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
        <Field label="Einheit"><Select className="select" value={f.unit} onChange={(e) => set('unit', e.target.value)}>{['Stück', 'Karton', 'Box', 'Pack.', 'Set'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Bestand"><input className="input" type="number" value={f.stock} onChange={(e) => set('stock', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
