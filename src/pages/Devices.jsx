import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Cpu, Wrench, AlertTriangle, Repeat, Download } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Empty, KpiCard, Drawer, Field, Modal, AccountLink } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { exportCsv } from '../lib/csv.js';
import { fmtDate } from '../lib/format.js';

const NOW = new Date();
const daysUntil = (iso) => (iso ? Math.round((new Date(iso) - NOW) / 86400000) : null);
const KIND_TONE = { Verkauf: 'teal', Leihgerät: 'amber', Konsignation: 'purple' };
const STATUS_TONE = { 'Im Einsatz': 'green', Lager: 'blue', 'In Wartung': 'amber', Defekt: 'red' };

function InspCell({ iso }) {
  if (!iso) return <span className="muted">—</span>;
  const d = daysUntil(iso);
  const tone = d < 0 ? 'red' : d < 30 ? 'amber' : 'gray';
  const label = d < 0 ? `überfällig (${Math.abs(d)} T.)` : d < 30 ? `in ${d} T.` : fmtDate(iso);
  return <Badge tone={tone} dot={d < 30}>{label}</Badge>;
}

export default function Devices() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('All');
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);

  const acct = (id) => db.accounts.find((a) => a.id === id);
  const rows = useMemo(() => db.devices.filter((d) =>
    (kind === 'All' || d.kind === kind) &&
    (!q || d.name.toLowerCase().includes(q.toLowerCase()) || d.serial.toLowerCase().includes(q.toLowerCase()) || acct(d.accountId)?.name.toLowerCase().includes(q.toLowerCase()))
  ), [db.devices, q, kind]);

  const dueSoon = db.devices.filter((d) => [d.nextMtk, d.nextStk].some((x) => x && daysUntil(x) < 30)).length;
  const loaners = db.devices.filter((d) => d.kind === 'Leihgerät' && d.status === 'Im Einsatz').length;
  const inService = db.devices.filter((d) => d.status === 'In Wartung').length;

  const doExport = () => {
    exportCsv('geraete.csv', [
      { label: 'Gerät', get: (d) => d.name }, { label: 'Seriennummer', get: (d) => d.serial },
      { label: 'UDI', get: (d) => d.udi }, { label: 'Kunde', get: (d) => acct(d.accountId)?.name },
      { label: 'Art', get: (d) => d.kind }, { label: 'Status', get: (d) => d.status },
      { label: 'Nächste MTK', get: (d) => (d.nextMtk ? fmtDate(d.nextMtk) : '—') },
      { label: 'Nächste STK', get: (d) => (d.nextStk ? fmtDate(d.nextStk) : '—') },
    ], rows);
    toast('Geräteliste exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Geräteverwaltung</h1><div className="sub">Verkaufte Geräte, Leihgeräte & Konsignation — mit MTK/STK-Fälligkeiten (MPBetreibV)</div></div>
        <div className="page-actions">
          <button className="btn" onClick={doExport}><Download size={15} /> Exportieren</button>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Gerät anlegen</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Cpu} tone="brand" label="Geräte gesamt" value={db.devices.length} />
        <KpiCard icon={Repeat} tone="amber" label="Leihgeräte aktiv" value={loaners} />
        <KpiCard icon={AlertTriangle} tone="red" label="MTK/STK fällig (<30 T.)" value={dueSoon} />
        <KpiCard icon={Wrench} tone="purple" label="In Wartung" value={inService} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Gerät, Seriennr. oder Kunde…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {[['All', 'Alle'], ['Verkauf', 'Verkauf'], ['Leihgerät', 'Leihgeräte'], ['Konsignation', 'Konsignation']].map(([v, l]) => <button key={v} className={kind === v ? 'active' : ''} onClick={() => setKind(v)}>{l}</button>)}
        </div>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Gerät</th><th>Seriennr.</th><th>Kunde</th><th>Art</th><th>Status</th><th>Nächste MTK</th><th>Nächste STK</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} onClick={() => setSel(d)}>
                <td><div className="cell-main">{d.name}</div><div className="cell-sub">{d.category}</div></td>
                <td className="muted nowrap">{d.serial}</td>
                <td><AccountLink account={acct(d.accountId)} /></td>
                <td><Badge tone={KIND_TONE[d.kind]}>{d.kind}</Badge></td>
                <td><Badge tone={STATUS_TONE[d.status]} dot>{d.status}</Badge></td>
                <td><InspCell iso={d.nextMtk} /></td>
                <td><InspCell iso={d.nextStk} /></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine Geräte gefunden" />}</div>
      </div>

      {sel && (
        <Drawer title={sel.name} onClose={() => setSel(null)}
          footer={<>
            <button className="btn" onClick={() => { store.update('devices', sel.id, { status: 'In Wartung' }); toast('Als „In Wartung" markiert'); setSel(null); }}><Wrench size={14} /> Wartung starten</button>
            <button className="btn primary" onClick={() => setSel(null)}>Schließen</button>
          </>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Badge tone={KIND_TONE[sel.kind]}>{sel.kind}</Badge>
            <Badge tone={STATUS_TONE[sel.status]} dot>{sel.status}</Badge>
          </div>
          <dl className="kv">
            <dt>Kunde</dt><dd><AccountLink account={acct(sel.accountId)} /></dd>
            {sel.orderId && <><dt>Aus Auftrag</dt><dd><span className="rec-link" onClick={() => nav('/orders')}>{db.orders.find((o) => o.id === sel.orderId)?.number || '—'}</span></dd></>}
            {sel.contractId && <><dt>Vertrag</dt><dd><span className="rec-link" onClick={() => nav('/contracts')}>{db.contracts.find((c) => c.id === sel.contractId)?.number || '—'}</span></dd></>}
            <dt>Kategorie</dt><dd>{sel.category}</dd>
            <dt>Seriennummer</dt><dd>{sel.serial}</dd>
            <dt>UDI</dt><dd style={{ fontSize: 12 }}>{sel.udi}</dd>
            <dt>Installiert</dt><dd>{fmtDate(sel.installedAt)}</dd>
            <dt>Servicetechniker</dt><dd>{db.users.find((u) => u.id === sel.ownerId)?.name}</dd>
          </dl>
          <h3 style={{ fontSize: 14, margin: '20px 0 10px' }}>Prüfungen (MPBetreibV)</h3>
          <div className="card" style={{ overflow: 'hidden' }}><table className="tbl">
            <thead><tr><th>Prüfung</th><th>Zuletzt</th><th>Nächste</th></tr></thead>
            <tbody>
              <tr style={{ cursor: 'default' }}><td className="cell-main">MTK (messtechnisch)</td><td>{sel.lastMtk ? fmtDate(sel.lastMtk) : '—'}</td><td><InspCell iso={sel.nextMtk} /></td></tr>
              <tr style={{ cursor: 'default' }}><td className="cell-main">STK (sicherheitstechnisch)</td><td>{sel.lastStk ? fmtDate(sel.lastStk) : '—'}</td><td><InspCell iso={sel.nextStk} /></td></tr>
            </tbody>
          </table></div>
        </Drawer>
      )}
      {adding && <NewDevice db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewDevice({ db, onClose, toast }) {
  const [f, setF] = useState({ category: 'Diagnostik', accountId: db.accounts[0]?.id, kind: 'Verkauf', status: 'Im Einsatz', orderId: '', contractId: '', ownerId: db.users.find((u) => u.title?.includes('Service'))?.id || db.users[0].id });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const accOrders = db.orders.filter((o) => o.accountId === f.accountId && o.kind === 'Auftrag');
  const accContracts = db.contracts.filter((c) => c.accountId === f.accountId);
  const save = () => {
    if (!f.name || !f.serial) { toast('Name und Seriennummer erforderlich'); return; }
    store.add('devices', {
      name: f.name, serial: f.serial, udi: f.udi || '', category: f.category, accountId: f.accountId,
      kind: f.kind, status: f.status, installedAt: new Date().toISOString(),
      lastMtk: null, nextMtk: f.nextMtk ? new Date(f.nextMtk).toISOString() : null,
      lastStk: null, nextStk: f.nextStk ? new Date(f.nextStk).toISOString() : null,
      ownerId: f.ownerId, notes: '', orderId: f.orderId || null, contractId: f.contractId || null,
    });
    toast('Gerät angelegt'); onClose();
  };
  const cats = Array.from(new Set(db.products.map((p) => p.category)));
  return (
    <Modal title="Gerät anlegen" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Anlegen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Gerätename"><input className="input" onChange={(e) => set('name', e.target.value)} placeholder="z. B. Vitalzeichenmonitor VS7" autoFocus /></Field></div>
        <Field label="Seriennummer"><input className="input" onChange={(e) => set('serial', e.target.value)} /></Field>
        <Field label="UDI (optional)"><input className="input" onChange={(e) => set('udi', e.target.value)} /></Field>
        <Field label="Kategorie"><select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Kunde"><select className="select" value={f.accountId} onChange={(e) => { set('accountId', e.target.value); set('orderId', ''); set('contractId', ''); }}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Art"><select className="select" value={f.kind} onChange={(e) => set('kind', e.target.value)}>{['Verkauf', 'Leihgerät', 'Konsignation'].map((k) => <option key={k}>{k}</option>)}</select></Field>
        <Field label="Aus Auftrag (optional)"><select className="select" value={f.orderId} onChange={(e) => set('orderId', e.target.value)}><option value="">— Ohne —</option>{accOrders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}</select></Field>
        <Field label="Vertrag (optional)"><select className="select" value={f.contractId} onChange={(e) => set('contractId', e.target.value)}><option value="">— Ohne —</option>{accContracts.map((c) => <option key={c.id} value={c.id}>{c.number} · {c.title}</option>)}</select></Field>
        <Field label="Status"><select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{['Im Einsatz', 'Lager', 'In Wartung', 'Defekt'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Nächste MTK"><input className="input" type="date" onChange={(e) => set('nextMtk', e.target.value)} /></Field>
        <Field label="Nächste STK"><input className="input" type="date" onChange={(e) => set('nextStk', e.target.value)} /></Field>
        <Field label="Servicetechniker"><select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
