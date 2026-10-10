import { useMemo, useState } from 'react';
import { Download, BarChart3, TrendingUp, Filter } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Card, KpiCard, Badge, Field } from '../components/ui.jsx';
import { fieldsFor } from '../components/CustomFields.jsx';
import { contractValues } from './Contracts.jsx';
import { useToast } from '../components/Toast.jsx';

const SRC_ENTITY = { accounts: 'Firma', deals: 'Deal', contracts: 'Vertrag' };
import { exportCsv } from '../lib/csv.js';
import { ACT_LABEL } from '../lib/labels.js';
import { fmtMoney, fmtMoneyShort, fmtNum, fmtDate } from '../lib/format.js';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const SOURCES = {
  orders: { label: 'Aufträge & Angebote', dateField: 'date', groups: { owner: 'Betreuer', account: 'Konto', kind: 'Art', status: 'Status', month: 'Monat' }, measures: { count: 'Anzahl', total: 'Summe Betrag' } },
  invoices: { label: 'Rechnungen', dateField: 'issueDate', groups: { status: 'Status', owner: 'Betreuer', account: 'Konto', month: 'Monat' }, measures: { count: 'Anzahl', total: 'Summe Betrag', open: 'Summe offen' } },
  deals: { label: 'Deals / Pipeline', dateField: 'createdAt', groups: { stage: 'Phase', owner: 'Betreuer', territory: 'Gebiet', month: 'Monat' }, measures: { count: 'Anzahl', value: 'Summe Wert' } },
  activities: { label: 'Aktivitäten', dateField: 'dueDate', groups: { type: 'Typ', owner: 'Betreuer', done: 'Status', month: 'Monat' }, measures: { count: 'Anzahl' } },
  accounts: { label: 'Konten', dateField: 'createdAt', groups: { type: 'Typ', tier: 'Kategorie', territory: 'Gebiet', status: 'Status', owner: 'Betreuer' }, measures: { count: 'Anzahl', revenueYTD: 'Summe Umsatz' } },
  contracts: { label: 'Verträge', dateField: 'startDate', groups: { status: 'Status', account: 'Konto', owner: 'Verantwortlich', month: 'Monat' }, measures: { count: 'Anzahl', annual: 'Jahreswert' } },
};

const _t = new Date();
const _iso = (d) => d.toISOString().slice(0, 10);
const TODAY = _iso(_t);
const YEAR_START = _iso(new Date(_t.getFullYear(), 0, 1));
const Q_START = _iso(new Date(_t.getFullYear(), Math.floor(_t.getMonth() / 3) * 3, 1));
const MONTH_START = _iso(new Date(_t.getFullYear(), _t.getMonth(), 1));
const PRESETS = [
  ['month', 'Dieser Monat', MONTH_START, TODAY],
  ['quarter', 'Dieses Quartal', Q_START, TODAY],
  ['ytd', 'Lfd. Jahr', YEAR_START, TODAY],
  ['all', 'Alle', '2000-01-01', '2035-12-31'],
];

export default function Reports() {
  const db = useStore();
  const toast = useToast();
  const [source, setSource] = useState('orders');
  const [groupBy, setGroupBy] = useState('owner');
  const [measure, setMeasure] = useState('total');
  const [from, setFrom] = useState(YEAR_START);
  const [to, setTo] = useState(TODAY);
  const [preset, setPreset] = useState('ytd');

  const baseCfg = SOURCES[source];
  const cfFields = SRC_ENTITY[source] ? fieldsFor(db, SRC_ENTITY[source]) : [];
  const cfg = { ...baseCfg, groups: { ...baseCfg.groups, ...Object.fromEntries(cfFields.map((f) => ['cf:' + f.id, f.label + ' (Zusatzfeld)'])) } };

  const setSrc = (s) => {
    setSource(s);
    setGroupBy(Object.keys(SOURCES[s].groups)[0]);
    setMeasure(Object.keys(SOURCES[s].measures)[0]);
  };
  const applyPreset = (p) => { setPreset(p[0]); setFrom(p[2]); setTo(p[3]); };

  const acctName = (id) => db.accounts.find((a) => a.id === id)?.name || '—';
  const userName = (id) => db.users.find((u) => u.id === id)?.name || '—';
  const terrName = (id) => db.territories.find((t) => t.id === id)?.name || '—';

  const groupLabel = (r) => {
    if (groupBy.startsWith('cf:')) {
      const fid = groupBy.slice(3);
      const val = r.customValues?.[fid];
      return (val == null || val === '') ? '(leer)' : String(val);
    }
    switch (groupBy) {
      case 'owner': return userName(r.ownerId);
      case 'account': return acctName(r.accountId);
      case 'kind': return r.kind;
      case 'status': return r.status;
      case 'stage': return db.stages.find((s) => s.id === r.stage)?.name || r.stage;
      case 'territory': return terrName(r.territoryId || db.accounts.find((a) => a.id === r.accountId)?.territoryId);
      case 'type': return ACT_LABEL[r.type] || r.type;
      case 'done': return r.done ? 'Erledigt' : 'Offen';
      case 'tier': return r.tier;
      case 'month': { const d = new Date(r[cfg.dateField]); return MONTHS_DE[d.getMonth()] + ' ' + d.getFullYear(); }
      default: return '—';
    }
  };
  const measureVal = (r) => {
    switch (measure) {
      case 'count': return 1;
      case 'total': return r.total || 0;
      case 'value': return r.value || 0;
      case 'open': return (r.total || 0) - (r.paid || 0);
      case 'revenueYTD': return r.revenueYTD || 0;
      case 'annual': return contractValues(r.items).annual;
      default: return 0;
    }
  };
  const isMoney = measure !== 'count';

  const report = useMemo(() => {
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T23:59:59');
    const recs = (db[source] || []).filter((r) => {
      const d = new Date(r[cfg.dateField]);
      return d >= f && d <= t;
    });
    const map = new Map();
    recs.forEach((r) => { const k = groupLabel(r); map.set(k, (map.get(k) || 0) + measureVal(r)); });
    const rows = [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { rows, total, count: recs.length };
  }, [db, source, groupBy, measure, from, to]);

  // date-filtered KPI band
  const kpi = useMemo(() => {
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T23:59:59');
    const inRange = (iso) => { const d = new Date(iso); return d >= f && d <= t; };
    const orders = db.orders.filter((o) => inRange(o.date));
    const revenue = orders.filter((o) => o.kind === 'Auftrag').reduce((s, o) => s + o.total, 0);
    const quotes = orders.filter((o) => o.kind === 'Angebot').reduce((s, o) => s + o.total, 0);
    const invOpen = db.invoices.filter((i) => inRange(i.issueDate)).reduce((s, i) => s + (i.total - i.paid), 0);
    const wonDeals = db.deals.filter((d) => d.stage === 'won' && inRange(d.createdAt)).length;
    return { revenue, quotes, invOpen, wonDeals };
  }, [db, from, to]);

  const fmt = (v) => (isMoney ? fmtMoney(v) : fmtNum(v));
  const max = report.rows[0]?.value || 1;

  const doExport = () => {
    exportCsv(`bericht_${source}.csv`, [
      { label: cfg.groups[groupBy], get: (r) => r.label },
      { label: cfg.measures[measure], get: (r) => r.value },
      { label: 'Anteil %', get: (r) => (report.total ? Math.round((r.value / report.total) * 100) : 0) },
    ], report.rows);
    toast('Bericht exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Berichte & Analysen</h1><div className="sub">Flexible Auswertungen — frei kombinierbar, nach Datum gefiltert</div></div>
      </div>

      {/* Date range */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="stat-line" style={{ gap: 8, color: 'var(--text-2)', fontWeight: 600, alignSelf: 'center' }}><Filter size={16} /> Zeitraum</div>
          <div className="seg">
            {PRESETS.map((p) => <button key={p[0]} className={preset === p[0] ? 'active' : ''} onClick={() => applyPreset(p)}>{p[1]}</button>)}
          </div>
          <Field label="Von"><input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(''); }} /></Field>
          <Field label="Bis"><input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(''); }} /></Field>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={TrendingUp} tone="brand" label="Umsatz (Aufträge)" value={fmtMoneyShort(kpi.revenue)} />
        <KpiCard icon={BarChart3} tone="amber" label="Angebotsvolumen" value={fmtMoneyShort(kpi.quotes)} />
        <KpiCard icon={BarChart3} tone="red" label="Offene Posten" value={fmtMoneyShort(kpi.invOpen)} />
        <KpiCard icon={TrendingUp} tone="green" label="Gewonnene Deals" value={kpi.wonDeals} />
      </div>

      {/* Report builder */}
      <Card title="Bericht erstellen" sub="Datenquelle, Gruppierung und Kennzahl frei wählen"
        action={<button className="btn primary sm" onClick={doExport}><Download size={14} /> CSV exportieren</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
          <Field label="Datenquelle">
            <select className="select" value={source} onChange={(e) => setSrc(e.target.value)}>
              {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Gruppieren nach">
            <select className="select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
              {Object.entries(cfg.groups).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Kennzahl">
            <select className="select" value={measure} onChange={(e) => setMeasure(e.target.value)}>
              {Object.entries(cfg.measures).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <div className="muted tiny" style={{ marginBottom: 10 }}>
          {report.count} Datensätze im Zeitraum {fmtDate(from)} – {fmtDate(to)} · Gesamt: <b style={{ color: 'var(--text)' }}>{fmt(report.total)}</b>
        </div>

        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>{cfg.groups[groupBy]}</th><th style={{ width: '45%' }}>{cfg.measures[measure]}</th><th className="right">Wert</th><th className="right">Anteil</th></tr></thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.label} style={{ cursor: 'default' }}>
                <td className="cell-main">{r.label}</td>
                <td><div className="progress" style={{ maxWidth: 320 }}><i style={{ width: (r.value / max) * 100 + '%' }} /></div></td>
                <td className="right"><b>{fmt(r.value)}</b></td>
                <td className="right muted">{report.total ? Math.round((r.value / report.total) * 100) : 0} %</td>
              </tr>
            ))}
          </tbody>
        </table>{report.rows.length === 0 && <div className="empty">Keine Daten im gewählten Zeitraum.</div>}</div>
      </Card>
    </div>
  );
}
