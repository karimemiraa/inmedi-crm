import { useMemo, useState } from 'react';
import { Download, Percent, Euro, TrendingUp, Filter, Settings2 } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Card, KpiCard, Avatar, Field, Badge } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { exportCsv } from '../lib/csv.js';
import { computeCommission } from '../lib/commission.js';
import { fmtMoney, fmtMoneyShort } from '../lib/format.js';

const _t = new Date();
const _iso = (d) => d.toISOString().slice(0, 10);
const TODAY = _iso(_t);
const YEAR_START = _iso(new Date(_t.getFullYear(), 0, 1));
const Q_START = _iso(new Date(_t.getFullYear(), Math.floor(_t.getMonth() / 3) * 3, 1));
const MONTH_START = _iso(new Date(_t.getFullYear(), _t.getMonth(), 1));
const PRESETS = [['month', 'Dieser Monat', MONTH_START, TODAY], ['quarter', 'Dieses Quartal', Q_START, TODAY], ['ytd', 'Lfd. Jahr', YEAR_START, TODAY], ['all', 'Alle', '2000-01-01', '2035-12-31']];

export default function Provision() {
  const db = useStore();
  const toast = useToast();
  const [from, setFrom] = useState(YEAR_START);
  const [to, setTo] = useState(TODAY);
  const [preset, setPreset] = useState('ytd');
  const [config, setConfig] = useState(false);

  const applyPreset = (p) => { setPreset(p[0]); setFrom(p[2]); setTo(p[3]); };
  const { rows, totals } = useMemo(() => computeCommission(db, from, to, { includeAllReps: true }), [db, from, to]);
  const max = rows[0]?.commission || 1;

  const doExport = () => {
    exportCsv('provision.csv', [
      { label: 'Mitarbeiter', get: (r) => r.name }, { label: 'Aufträge', get: (r) => r.orders },
      { label: 'Umsatzbasis (€)', get: (r) => r.base }, { label: 'Satz %', get: (r) => Math.round(r.rate * 1000) / 10 },
      { label: 'Provision (€)', get: (r) => r.commission },
    ], rows);
    toast('Provision exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Provision</h1><div className="sub">Vertriebsprovision auf abgerechnete Aufträge — je Außendienst, nach Zeitraum</div></div>
        <div className="page-actions">
          <button className="btn" onClick={() => setConfig((v) => !v)}><Settings2 size={15} /> Sätze</button>
          <button className="btn primary" onClick={doExport}><Download size={15} /> Exportieren</button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="stat-line" style={{ gap: 8, color: 'var(--text-2)', fontWeight: 600, alignSelf: 'center' }}><Filter size={16} /> Zeitraum</div>
          <div className="seg">{PRESETS.map((p) => <button key={p[0]} className={preset === p[0] ? 'active' : ''} onClick={() => applyPreset(p)}>{p[1]}</button>)}</div>
          <Field label="Von"><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(''); }} /></Field>
          <Field label="Bis"><input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(''); }} /></Field>
        </div>
      </div>

      {config && <RateConfig db={db} toast={toast} />}

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Euro} tone="brand" label="Umsatzbasis (Aufträge)" value={fmtMoneyShort(totals.base)} />
        <KpiCard icon={Percent} tone="teal" label="Provision gesamt" value={fmtMoneyShort(totals.commission)} />
        <KpiCard icon={TrendingUp} tone="purple" label="Aufträge" value={totals.orders} />
        <KpiCard icon={Percent} tone="amber" label="Ø Provisionssatz" value={(totals.base ? Math.round((totals.commission / totals.base) * 1000) / 10 : 0) + ' %'} />
      </div>

      <Card title="Provision je Außendienst" sub={`Basis: abgerechnete Aufträge im Zeitraum`} pad={false}>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Mitarbeiter</th><th className="right">Aufträge</th><th className="right">Umsatzbasis</th><th className="right">Satz</th><th style={{ width: '28%' }}>Provision</th><th className="right">Betrag</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} style={{ cursor: 'default' }}>
                <td><div className="avatar-row"><Avatar size="sm" name={r.name} color={r.color} /><span className="cell-main">{r.name}</span></div></td>
                <td className="right">{r.orders}</td>
                <td className="right">{fmtMoney(r.base)}</td>
                <td className="right"><Badge tone="gray">{Math.round(r.rate * 1000) / 10} %</Badge></td>
                <td><div className="progress" style={{ maxWidth: 260 }}><i style={{ width: (r.commission / max) * 100 + '%' }} /></div></td>
                <td className="right"><b>{fmtMoney(r.commission)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ cursor: 'default' }}><td className="cell-main">Gesamt</td><td className="right">{totals.orders}</td><td className="right">{fmtMoney(totals.base)}</td><td /><td /><td className="right"><b>{fmtMoney(totals.commission)}</b></td></tr></tfoot>
        </table>{rows.length === 0 && <div className="empty">Keine Aufträge im gewählten Zeitraum.</div>}</div>
      </Card>
    </div>
  );
}

function RateConfig({ db, toast }) {
  const def = Math.round((db.meta.commission?.defaultRate ?? 0) * 1000) / 10;
  const reps = db.users.filter((u) => u.role !== 'Administrator');
  const setDefault = (pct) => { const v = Math.max(0, Number(pct) || 0) / 100; store.set((s) => ({ ...s, meta: { ...s.meta, commission: { ...s.meta.commission, defaultRate: v } } })); };
  const setRep = (id, pct) => store.update('users', id, { commissionRate: Math.max(0, Number(pct) || 0) / 100 });
  return (
    <Card title="Provisionssätze" sub="Globaler Standardsatz und individuelle Sätze je Mitarbeiter" >
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <Field label="Standardsatz (%)"><input className="input" type="number" step="0.5" defaultValue={def} onBlur={(e) => { setDefault(e.target.value); toast('Standardsatz gespeichert'); }} /></Field>
      </div>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Mitarbeiter</th><th>Rolle</th><th style={{ width: 160 }}>Individueller Satz (%)</th></tr></thead>
        <tbody>
          {reps.map((u) => (
            <tr key={u.id} style={{ cursor: 'default' }}>
              <td><div className="avatar-row"><Avatar size="sm" name={u.name} color={u.color} /><span className="cell-main">{u.name}</span></div></td>
              <td className="muted">{u.role}</td>
              <td><input className="input" type="number" step="0.5" defaultValue={u.commissionRate ? Math.round(u.commissionRate * 1000) / 10 : ''} placeholder={`Standard (${def} %)`} onBlur={(e) => { setRep(u.id, e.target.value); toast('Satz gespeichert'); }} /></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <p className="muted tiny" style={{ marginTop: 10 }}>Leer = Standardsatz. Änderungen wirken sofort auf die Berechnung.</p>
    </Card>
  );
}
