import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Repeat, CalendarClock, PlayCircle, Pause, Trash2, Zap } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Badge, Drawer, Empty, Field, KpiCard, Modal, Select } from '../components/ui.jsx';
import { useOpenParam } from '../lib/nav.js';
import LineItems from '../components/LineItems.jsx';
import { useToast } from '../components/Toast.jsx';
import { CommentCount, RowActions, StatusBadge } from '../components/Vorgang.jsx';
import { vorgangLink } from '../lib/vorgang.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

export const INTERVALS = ['monatlich', 'quartalsweise', 'halbjährlich', 'jährlich'];
export const INTERVAL_MONTHS = { monatlich: 1, quartalsweise: 3, halbjährlich: 6, jährlich: 12 };
const sum = (items) => items.reduce((s, it) => s + it.qty * it.price, 0);
const advance = (iso, interval) => { const d = new Date(iso); d.setMonth(d.getMonth() + (INTERVAL_MONTHS[interval] || 1)); return d.toISOString(); };
const isDue = (r) => r.active && new Date(r.nextDue) <= new Date();

// Erzeugt für einen fälligen Dauerauftrag einen echten Auftrag und schiebt das
// nächste Fälligkeitsdatum um ein Intervall weiter. Gibt die neue Auftragsnummer zurück.
export function generateOne(db, r, seq) {
  const number = 'AUF-' + (24515 + db.orders.length + seq + 1);
  const rec = store.add('orders', {
    number, kind: 'Auftrag', accountId: r.accountId,
    ownerId: r.ownerId || db.accounts.find((a) => a.id === r.accountId)?.ownerId || db.meta.currentUserId,
    status: 'Bestätigt', items: r.items.map((it) => ({ ...it })), total: sum(r.items),
    date: new Date().toISOString(), recurringId: r.id,
  });
  store.update('recurringOrders', r.id, {
    lastGenerated: new Date().toISOString(), nextDue: advance(r.nextDue, r.interval),
    generatedOrderIds: [...(r.generatedOrderIds || []), rec.id],
  });
  return rec;
}

export default function RecurringOrders() {
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  useOpenParam(db.recurringOrders, (r) => nav(vorgangLink('recurringOrders', r.id), { replace: true }));

  const rows = useMemo(() => [...db.recurringOrders].sort((a, b) => new Date(a.nextDue) - new Date(b.nextDue)), [db.recurringOrders]);
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const due = rows.filter(isDue);
  const activeCount = rows.filter((r) => r.active).length;
  const mrr = rows.filter((r) => r.active).reduce((s, r) => s + (sum(r.items) * 12) / INTERVAL_MONTHS[r.interval], 0) / 12;

  const generateAllDue = () => {
    if (due.length === 0) { toast('Keine fälligen Daueraufträge'); return; }
    due.forEach((r, i) => generateOne(db, r, i));
    toast(`${due.length} Auftrag/Aufträge erzeugt`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Daueraufträge</h1><div className="sub">Wiederkehrende Bestellungen — Intervall & Positionen je Kunde, Aufträge auf Knopfdruck erzeugen</div></div>
        <div className="page-actions">
          <button className="btn primary" onClick={generateAllDue} disabled={due.length === 0}><Zap size={15} /> Fällige Aufträge erzeugen{due.length > 0 ? ` (${due.length})` : ''}</button>
          <button className="btn" onClick={() => setAdding(true)}><Plus size={16} /> Neuer Dauerauftrag</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Repeat} tone="brand" label="Daueraufträge" value={db.recurringOrders.length} />
        <KpiCard icon={PlayCircle} tone="green" label="Aktiv" value={activeCount} />
        <KpiCard icon={CalendarClock} tone="amber" label="Jetzt fällig" value={due.length} />
        <KpiCard icon={Repeat} tone="teal" label="Ø monatl. Volumen" value={fmtMoneyShort(mrr)} />
      </div>

      {due.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--amber-bg)', borderColor: 'transparent' }}>
          <div className="stat-line" style={{ color: 'var(--amber)', fontWeight: 700 }}><CalendarClock size={18} /> {due.length} Dauerauftrag/-aufträge fällig — über „Fällige Aufträge erzeugen" als Aufträge anlegen.</div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr><th>Kunde</th><th>Intervall</th><th>Positionen</th><th>Nächste Fälligkeit</th><th>Status</th><th className="right">Betrag/Lauf</th><th className="right">Aktionen</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => nav(vorgangLink('recurringOrders', r.id))}>
                <td className="cell-main"><AccountLink account={acct(r.accountId)} /></td>
                <td><Badge tone="teal">{r.interval}</Badge></td>
                <td className="muted">{r.items.length} Position(en)</td>
                <td className="nowrap"><Badge tone={isDue(r) ? 'amber' : 'gray'} dot={isDue(r)}>{fmtDate(r.nextDue)}</Badge></td>
                <td><Badge tone={r.active ? 'green' : 'gray'} dot>{r.active ? 'Aktiv' : 'Pausiert'}</Badge></td>
                <td className="right"><b>{fmtMoney(sum(r.items))}</b></td>
                <td className="right nowrap"><RowActions kind="recurringOrders" rec={r} toast={toast} /></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine Daueraufträge" hint="Wiederkehrende Bestellungen je Kunde." action={{ label: 'Neuer Dauerauftrag', onClick: () => setAdding(true) }} />}</div>
      </div>

      {adding && <NewRO db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}


function NewRO({ db, onClose, toast }) {
  const [f, setF] = useState({ accountId: db.accounts[0]?.id, ownerId: db.meta.currentUserId, interval: 'monatlich', startDate: new Date().toISOString().slice(0, 10) });
  const [items, setItems] = useState([]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.accountId) { toast('Bitte einen Kunden wählen'); return; }
    if (items.length === 0) { toast('Bitte mindestens eine Position hinzufügen'); return; }
    store.add('recurringOrders', {
      accountId: f.accountId, ownerId: f.ownerId, interval: f.interval,
      items, startDate: new Date(f.startDate).toISOString(), nextDue: new Date(f.startDate).toISOString(),
      active: true, lastGenerated: null, generatedOrderIds: [],
    });
    toast('Dauerauftrag angelegt'); onClose();
  };
  return (
    <Modal title="Neuer Dauerauftrag" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Anlegen</button></>}>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        <Field label="Kunde"><Select className="select" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Verantwortlich"><Select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Intervall"><Select className="select" value={f.interval} onChange={(e) => set('interval', e.target.value)}>{INTERVALS.map((i) => <option key={i}>{i}</option>)}</Select></Field>
        <Field label="Erste Fälligkeit"><input className="input" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
      </div>
      <h4 style={{ marginBottom: 10 }}>Positionen</h4>
      <LineItems products={db.products} items={items} setItems={setItems} />
    </Modal>
  );
}
