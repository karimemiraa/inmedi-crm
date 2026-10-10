import { useMemo, useState } from 'react';
import { Download, Filter, Euro, TrendingDown, AlertTriangle, Scale } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Card, KpiCard, Badge, Field, Empty } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { exportCsv } from '../lib/csv.js';
import { fmtMoney, fmtMoneyShort } from '../lib/format.js';

const _t = new Date();
const _iso = (d) => d.toISOString().slice(0, 10);
const TODAY = _iso(_t);
const YEAR_START = _iso(new Date(_t.getFullYear(), 0, 1));
const Q_START = _iso(new Date(_t.getFullYear(), Math.floor(_t.getMonth() / 3) * 3, 1));
const MONTH_START = _iso(new Date(_t.getFullYear(), _t.getMonth(), 1));
const PRESETS = [['month', 'Dieser Monat', MONTH_START, TODAY], ['quarter', 'Dieses Quartal', Q_START, TODAY], ['ytd', 'Lfd. Jahr', YEAR_START, TODAY], ['all', 'Alle', '2000-01-01', '2035-12-31']];
const DIMS = [['account', 'Nach Kunde'], ['rep', 'Nach Außendienst'], ['territory', 'Nach Gebiet']];

export default function CareCostAnalysis() {
  const db = useStore();
  const toast = useToast();
  const [from, setFrom] = useState(YEAR_START);
  const [to, setTo] = useState(TODAY);
  const [preset, setPreset] = useState('ytd');
  const [dim, setDim] = useState('account');

  const applyPreset = (p) => { setPreset(p[0]); setFrom(p[2]); setTo(p[3]); };
  const acct = (id) => db.accounts.find((a) => a.id === id);

  const { rows, totals } = useMemo(() => {
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T23:59:59');
    const inRange = (iso) => { const d = new Date(iso); return d >= f && d <= t; };
    const keyOf = (accountId, userId) => {
      if (dim === 'rep') return userId;
      if (dim === 'territory') return acct(accountId)?.territoryId || '—';
      return accountId;
    };
    const map = new Map();
    const bump = (k, field, v) => { if (!map.has(k)) map.set(k, { cost: 0, revenue: 0 }); map.get(k)[field] += v; };
    db.costEntries.filter((e) => inRange(e.date)).forEach((e) => bump(keyOf(e.accountId, e.userId), 'cost', e.cost || 0));
    db.orders.filter((o) => o.kind === 'Auftrag' && inRange(o.date)).forEach((o) => bump(keyOf(o.accountId, o.ownerId), 'revenue', o.total || 0));

    const label = (k) => {
      if (dim === 'rep') return db.users.find((u) => u.id === k)?.name || '—';
      if (dim === 'territory') return db.territories.find((x) => x.id === k)?.name || '—';
      return acct(k)?.name || '—';
    };
    const rows = [...map.entries()].map(([k, v]) => ({
      id: k, label: label(k), cost: v.cost, revenue: v.revenue,
      net: v.revenue - v.cost, ratio: v.revenue > 0 ? v.cost / v.revenue : null,
    })).sort((a, b) => b.cost - a.cost);
    const totals = rows.reduce((s, r) => ({ cost: s.cost + r.cost, revenue: s.revenue + r.revenue }), { cost: 0, revenue: 0 });
    return { rows, totals };
  }, [db, from, to, dim]);

  const unprofitable = rows.filter((r) => r.net < 0).length;
  const overallRatio = totals.revenue > 0 ? totals.cost / totals.revenue : null;
  const maxRev = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.cost)));

  const ratioTone = (r) => (r.revenue === 0 ? 'red' : r.ratio > 0.5 ? 'red' : r.ratio > 0.25 ? 'amber' : 'green');

  const doExport = () => {
    exportCsv('betreuungskosten-analyse.csv', [
      { label: DIMS.find((d) => d[0] === dim)[1].replace('Nach ', ''), get: (r) => r.label },
      { label: 'Betreuungskosten (€)', get: (r) => r.cost },
      { label: 'Umsatz (€)', get: (r) => r.revenue },
      { label: 'Netto nach Betreuung (€)', get: (r) => r.net },
      { label: 'Kostenquote %', get: (r) => (r.ratio == null ? '' : Math.round(r.ratio * 1000) / 10) },
    ], rows);
    toast('Betreuungskosten-Analyse exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Betreuungskosten-Analyse</h1><div className="sub">Betreuungsaufwand (Besuche, Anrufe, Fahrten, Schulungen) gegen Umsatz — Wirtschaftlichkeit je Kunde, Außendienst und Gebiet</div></div>
        <div className="page-actions"><button className="btn primary" onClick={doExport}><Download size={15} /> Exportieren</button></div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="stat-line" style={{ gap: 8, color: 'var(--text-2)', fontWeight: 600, alignSelf: 'center' }}><Filter size={16} /> Zeitraum</div>
          <div className="seg">{PRESETS.map((p) => <button key={p[0]} className={preset === p[0] ? 'active' : ''} onClick={() => applyPreset(p)}>{p[1]}</button>)}</div>
          <Field label="Von"><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(''); }} /></Field>
          <Field label="Bis"><input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(''); }} /></Field>
          <div style={{ marginLeft: 'auto' }}><div className="seg">{DIMS.map(([k, l]) => <button key={k} className={dim === k ? 'active' : ''} onClick={() => setDim(k)}>{l}</button>)}</div></div>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Euro} tone="brand" label="Betreuungskosten" value={fmtMoneyShort(totals.cost)} />
        <KpiCard icon={Euro} tone="teal" label="Umsatz (Aufträge)" value={fmtMoneyShort(totals.revenue)} />
        <KpiCard icon={Scale} tone="amber" label="Kostenquote gesamt" value={overallRatio == null ? '—' : Math.round(overallRatio * 1000) / 10 + ' %'} />
        <KpiCard icon={AlertTriangle} tone="red" label="Defizitär" value={unprofitable} />
      </div>

      <Card title="Wirtschaftlichkeit" sub="Umsatz (grün) vs. Betreuungskosten (rot) · sortiert nach Kosten" pad={false}>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>{DIMS.find((d) => d[0] === dim)[1].replace('Nach ', '')}</th><th style={{ width: '32%' }}>Umsatz / Betreuungskosten</th><th className="right">Betreuungskosten</th><th className="right">Umsatz</th><th className="right">Netto</th><th className="right">Kostenquote</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ cursor: 'default' }}>
                <td className="cell-main">{r.label}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 300 }}>
                    <div className="progress" style={{ background: 'var(--surface-2)' }}><i style={{ width: (r.revenue / maxRev) * 100 + '%', background: 'var(--brand-2)' }} /></div>
                    <div className="progress" style={{ background: 'var(--surface-2)' }}><i style={{ width: (r.cost / maxRev) * 100 + '%', background: 'var(--red)' }} /></div>
                  </div>
                </td>
                <td className="right">{fmtMoney(r.cost)}</td>
                <td className="right">{fmtMoney(r.revenue)}</td>
                <td className="right"><b style={{ color: r.net < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(r.net)}</b></td>
                <td className="right"><Badge tone={ratioTone(r)}>{r.ratio == null ? 'kein Umsatz' : Math.round(r.ratio * 1000) / 10 + ' %'}</Badge></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ cursor: 'default' }}><td className="cell-main">Gesamt</td><td /><td className="right"><b>{fmtMoney(totals.cost)}</b></td><td className="right"><b>{fmtMoney(totals.revenue)}</b></td><td className="right"><b style={{ color: totals.revenue - totals.cost < 0 ? 'var(--red)' : 'var(--green)' }}>{fmtMoney(totals.revenue - totals.cost)}</b></td><td className="right">{overallRatio == null ? '—' : Math.round(overallRatio * 1000) / 10 + ' %'}</td></tr></tfoot>
        </table>{rows.length === 0 && <Empty label="Keine Daten im gewählten Zeitraum" hint="Erfassen Sie Betreuungsaktivitäten unter Kostenkalkulation." />}</div>
      </Card>

      <div className="card card-pad" style={{ marginTop: 14 }}>
        <div className="stat-line muted tiny" style={{ gap: 8 }}><TrendingDown size={15} /> „Netto" = Umsatz (Aufträge) abzüglich Betreuungskosten im Zeitraum. Eine hohe Kostenquote oder ein negatives Netto zeigt Kunden, deren Betreuung im Verhältnis zum Umsatz teuer ist.</div>
      </div>
    </div>
  );
}
