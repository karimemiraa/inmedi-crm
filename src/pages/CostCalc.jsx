import { useState, useMemo } from 'react';
import { Plus, Euro, Car, Phone, Users, Download, Calculator } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Badge, Card, Empty, Field, KpiCard, Modal, Select, UserChip } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { exportCsv } from '../lib/csv.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

const TYPES = ['Besuch', 'Anruf', 'Fahrt', 'Demo', 'Schulung'];
const TYPE_TONE = { Besuch: 'brand', Anruf: 'blue', Fahrt: 'amber', Demo: 'purple', Schulung: 'teal' };

export function computeCost(type, durationMin, distanceKm, r) {
  const h = (Number(durationMin) || 0) / 60, km = Number(distanceKm) || 0;
  if (type === 'Besuch') return r.visit + h * r.hourly + km * r.travelPerKm;
  if (type === 'Anruf') return r.call + h * r.hourly;
  if (type === 'Fahrt') return km * r.travelPerKm;
  if (type === 'Demo') return r.demo + h * r.hourly + km * r.travelPerKm;
  if (type === 'Schulung') return h * r.hourly + km * r.travelPerKm;
  return 0;
}

const _t = new Date();
const _iso = (d) => d.toISOString().slice(0, 10);
const TODAY = _iso(_t);
const YEAR_START = _iso(new Date(_t.getFullYear(), 0, 1));
const Q_START = _iso(new Date(_t.getFullYear(), Math.floor(_t.getMonth() / 3) * 3, 1));
const MONTH_START = _iso(new Date(_t.getFullYear(), _t.getMonth(), 1));
const PRESETS = [['month', 'Dieser Monat', MONTH_START, TODAY], ['q', 'Dieses Quartal', Q_START, TODAY], ['ytd', 'Lfd. Jahr', YEAR_START, TODAY], ['all', 'Alle', '2000-01-01', '2035-12-31']];

export default function CostCalc() {
  const db = useStore();
  const toast = useToast();
  const rates = db.meta.costRates;
  const [from, setFrom] = useState(YEAR_START);
  const [to, setTo] = useState(TODAY);
  const [preset, setPreset] = useState('ytd');
  const [rep, setRep] = useState('All');
  const [adding, setAdding] = useState(false);

  const acct = (id) => db.accounts.find((a) => a.id === id);
  const user = (id) => db.users.find((u) => u.id === id);

  const rows = useMemo(() => {
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T23:59:59');
    return db.costEntries.filter((e) => {
      const d = new Date(e.date);
      return d >= f && d <= t && (rep === 'All' || e.userId === rep);
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [db.costEntries, from, to, rep]);

  const total = rows.reduce((s, e) => s + e.cost, 0);
  const visits = rows.filter((e) => e.type === 'Besuch').length;
  const calls = rows.filter((e) => e.type === 'Anruf').length;
  const avgVisit = visits ? rows.filter((e) => e.type === 'Besuch').reduce((s, e) => s + e.cost, 0) / visits : 0;

  const byRep = useMemo(() => {
    const m = {};
    rows.forEach((e) => { m[e.userId] = (m[e.userId] || 0) + e.cost; });
    return Object.entries(m).map(([uid, v]) => ({ name: user(uid)?.name || '—', v })).sort((a, b) => b.v - a.v);
  }, [rows]);

  const applyPreset = (p) => { setPreset(p[0]); setFrom(p[2]); setTo(p[3]); };

  const doExport = () => {
    exportCsv('kostenkalkulation.csv', [
      { label: 'Typ', get: (e) => e.type }, { label: 'Datum', get: (e) => fmtDate(e.date) },
      { label: 'Kunde', get: (e) => acct(e.accountId)?.name }, { label: 'Mitarbeiter', get: (e) => user(e.userId)?.name },
      { label: 'Dauer (Min)', get: (e) => e.durationMin }, { label: 'km', get: (e) => e.distanceKm },
      { label: 'Kosten (€)', get: (e) => e.cost }, { label: 'Notiz', get: (e) => e.note },
    ], rows);
    toast('Kostenkalkulation exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Kostenkalkulation</h1><div className="sub">Besuche, Anrufe, Fahrten & Schulungen — mit hinterlegten Sätzen automatisch bewertet</div></div>
        <div className="page-actions">
          <button className="btn" onClick={doExport}><Download size={15} /> Exportieren</button>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Aktivität erfassen</button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="seg">{PRESETS.map((p) => <button key={p[0]} className={preset === p[0] ? 'active' : ''} onClick={() => applyPreset(p)}>{p[1]}</button>)}</div>
          <Field label="Von"><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(''); }} /></Field>
          <Field label="Bis"><input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(''); }} /></Field>
          <Field label="Mitarbeiter"><Select className="select" value={rep} onChange={(e) => setRep(e.target.value)}><option value="All">Alle</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Euro} tone="brand" label="Gesamtkosten" value={fmtMoneyShort(total)} />
        <KpiCard icon={Users} tone="teal" label="Besuche" value={visits} />
        <KpiCard icon={Phone} tone="blue" label="Anrufe" value={calls} />
        <KpiCard icon={Calculator} tone="purple" label="Ø Kosten / Besuch" value={fmtMoney(avgVisit)} />
      </div>

      <div className="grid split-wide">
        <Card title="Erfasste Aktivitäten" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Typ</th><th>Datum</th><th>Kunde</th><th>Mitarbeiter</th><th className="right">Dauer</th><th className="right">km</th><th className="right">Kosten</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} style={{ cursor: 'default' }}>
                  <td><Badge tone={TYPE_TONE[e.type]}>{e.type}</Badge></td>
                  <td className="nowrap">{fmtDate(e.date)}</td>
                  <td><AccountLink account={acct(e.accountId)} /></td>
                  <td><UserChip user={user(e.userId)} short /></td>
                  <td className="right">{e.durationMin ? e.durationMin + ' Min' : '—'}</td>
                  <td className="right">{e.distanceKm ? e.distanceKm : '—'}</td>
                  <td className="right"><b>{fmtMoney(e.cost)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>{rows.length === 0 && <Empty label="Keine Einträge im Zeitraum" />}</div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Kosten je Mitarbeiter">
            {byRep.length === 0 && <div className="muted tiny">Keine Daten.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {byRep.map((r, i) => {
                const max = byRep[0].v || 1;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span><b className="tiny">{fmtMoney(r.v)}</b></div>
                    <div className="progress"><i style={{ width: (r.v / max) * 100 + '%' }} /></div>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="Hinterlegte Sätze">
            <dl className="kv">
              <dt>Besuch (Pauschale)</dt><dd>{fmtMoney(rates.visit)}</dd>
              <dt>Anruf (Pauschale)</dt><dd>{fmtMoney(rates.call)}</dd>
              <dt>Demo (Pauschale)</dt><dd>{fmtMoney(rates.demo)}</dd>
              <dt>Stundensatz</dt><dd>{fmtMoney(rates.hourly)} / Std.</dd>
              <dt>Fahrtkosten</dt><dd>{fmtMoney(rates.travelPerKm, 2)} / km</dd>
            </dl>
          </Card>
        </div>
      </div>

      {adding && <AddEntry db={db} rates={rates} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function AddEntry({ db, rates, onClose, toast }) {
  const [f, setF] = useState({ type: 'Besuch', accountId: db.accounts[0]?.id, userId: db.meta.currentUserId, date: new Date().toISOString().slice(0,10), durationMin: 60, distanceKm: 0, note: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const preview = computeCost(f.type, f.durationMin, f.distanceKm, rates);
  const save = () => {
    store.add('costEntries', {
      type: f.type, accountId: f.accountId, userId: f.userId, date: new Date(f.date).toISOString(),
      durationMin: Number(f.durationMin) || 0, distanceKm: Number(f.distanceKm) || 0,
      cost: Math.round(preview * 100) / 100, note: f.note,
    });
    toast('Aktivität erfasst'); onClose();
  };
  return (
    <Modal title="Aktivität erfassen" onClose={onClose}
      footer={<><div style={{ marginRight: 'auto', fontWeight: 700 }}>Kosten: {fmtMoney(preview)}</div><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Speichern</button></>}>
      <div className="form-grid">
        <Field label="Typ"><Select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Datum"><input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <div className="full"><Field label="Kunde"><Select className="select" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field></div>
        <Field label="Mitarbeiter"><Select className="select" value={f.userId} onChange={(e) => set('userId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Dauer (Min)"><input className="input" type="number" value={f.durationMin} onChange={(e) => set('durationMin', e.target.value)} /></Field>
          <Field label="Fahrt (km)"><input className="input" type="number" value={f.distanceKm} onChange={(e) => set('distanceKm', e.target.value)} /></Field>
        </div>
        <div className="full"><Field label="Notiz"><input className="input" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="z. B. Demo-Termin vor Ort" /></Field></div>
      </div>
    </Modal>
  );
}
