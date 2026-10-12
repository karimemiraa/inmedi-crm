import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  Euro, TrendingUp, Target, Trophy, Building2, ArrowRight,
  Phone, CalendarCheck, Mail, Users, CheckCircle2,
} from 'lucide-react';
import { useStore } from '../data/store.js';
import { KpiCard, Card, Avatar, Badge, AccountLink } from '../components/ui.jsx';
import { fmtMoney, fmtMoneyShort, fmtDate, relDate, initials } from '../lib/format.js';
import { toggleDone } from '../lib/status.js';

const MONTHS_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export default function Dashboard() {
  const db = useStore();
  const nav = useNavigate();

  const m = useMemo(() => {
    const won = db.deals.filter((d) => d.stage === 'won');
    const lost = db.deals.filter((d) => d.stage === 'lost');
    const open = db.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
    const revenue = won.reduce((s, d) => s + d.value, 0);
    const pipeline = open.reduce((s, d) => s + d.value, 0);
    const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
    const activeAccounts = db.accounts.filter((a) => a.status === 'Aktiv').length;

    // Monatsumsatz aus echten gewonnenen Deals (letzte 8 Monate)
    const now = new Date();
    const monthKeys = [];
    for (let k = 7; k >= 0; k--) { const d = new Date(now.getFullYear(), now.getMonth() - k, 1); monthKeys.push({ y: d.getFullYear(), m: d.getMonth(), label: MONTHS_LABELS[d.getMonth()] }); }
    const monthlyWon = {};
    won.forEach((d) => { const dt = new Date(d.expectedClose || d.createdAt); monthlyWon[dt.getFullYear() + '-' + dt.getMonth()] = (monthlyWon[dt.getFullYear() + '-' + dt.getMonth()] || 0) + d.value; });
    const target = won.length ? Math.round(revenue / 8) : 0;
    const trend = monthKeys.map((mk) => ({ month: mk.label, revenue: monthlyWon[mk.y + '-' + mk.m] || 0, target }));

    const byStage = db.stages.filter((s) => s.id !== 'lost').map((s) => ({
      name: s.name,
      value: db.deals.filter((d) => d.stage === s.id).reduce((sum, d) => sum + d.value, 0),
      count: db.deals.filter((d) => d.stage === s.id).length,
      color: s.color,
    }));

    const byTerritory = db.territories.map((t) => ({
      name: t.name,
      revenue: db.accounts.filter((a) => a.territoryId === t.id).reduce((s, a) => s + a.revenueYTD, 0),
      color: t.color,
    }));

    // top products by order volume
    const prodRev = {};
    db.orders.forEach((o) => o.items.forEach((it) => { prodRev[it.name] = (prodRev[it.name] || 0) + it.qty * it.price; }));
    const topProducts = Object.entries(prodRev).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, v]) => ({ name, v }));

    const acctMix = ['Krankenhaus', 'Praxis', 'Pflegeeinrichtung', 'Großhändler'].map((t) => ({
      name: t, value: db.accounts.filter((a) => a.type === t).length,
    }));

    const dueTasks = db.activities.filter((a) => !a.done)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 6);

    const topDeals = [...open].sort((a, b) => b.value - a.value).slice(0, 5);

    const recent = [...db.activities].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).slice(0, 6);

    return { revenue, pipeline, winRate, activeAccounts, trend, byStage, byTerritory, topProducts, acctMix, dueTasks, topDeals, recent, openCount: open.length };
  }, [db]);

  const acctName = (id) => db.accounts.find((a) => a.id === id)?.name || '—';
  const PIE_COLORS = ['#a81e22', '#0f8f86', '#7a5cf0', '#e0930b'];
  const ACT_ICON = { call: Phone, meeting: Users, task: CheckCircle2, email: Mail, followup: CalendarCheck };

  const toggleTask = (id) => toggleDone(db, db.activities.find((a) => a.id === id));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Guten Morgen, Karim</h1>
          <div className="sub">Ihr Überblick über InMedi — {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="page-actions">
          <Link to="/reports" className="btn">Berichte ansehen</Link>
          <Link to="/pipeline" className="btn primary">Pipeline öffnen <ArrowRight size={15} /></Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Euro} tone="brand" label="Umsatz (gewonnen)" value={fmtMoneyShort(m.revenue)} to="/reports" />
        <KpiCard icon={TrendingUp} tone="teal" label="Offene Pipeline" value={fmtMoneyShort(m.pipeline)} to="/pipeline" />
        <KpiCard icon={Trophy} tone="green" label="Abschlussquote" value={m.winRate + ' %'} to="/reports" />
        <KpiCard icon={Building2} tone="purple" label="Aktive Firmen" value={m.activeAccounts} to="/accounts" />
      </div>

      {/* Charts row 1 */}
      <div className="grid split-wide" style={{ marginBottom: 16 }}>
        <Card title="Umsatzentwicklung" sub="Monatsumsatz ggü. Ziel" action={<Badge tone="green" dot>Im Plan</Badge>}>
          <ResponsiveContainer width="100%" height={264}>
            <AreaChart data={m.trend} margin={{ left: 6, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={72} tickFormatter={fmtMoneyShort} tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="target" stroke="var(--border-strong)" strokeDasharray="5 5" fill="none" strokeWidth={2} name="Ziel" />
              <Area type="monotone" dataKey="revenue" stroke="var(--brand)" strokeWidth={2.5} fill="url(#gRev)" name="Umsatz" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Firmenverteilung" sub="Nach Einrichtungstyp">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={m.acctMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                {m.acctMix.map((e, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {m.acctMix.map((e, i) => (
              <div key={i} className="stat-line tiny">
                <span style={{ width: 9, height: 9, borderRadius: 3, background: PIE_COLORS[i] }} />
                <span className="muted">{e.name}</span>
                <b style={{ marginLeft: 'auto' }}>{e.value}</b>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <Card title="Pipeline nach Phase">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={m.byStage} layout="vertical" margin={{ left: 24, right: 12 }}>
              <XAxis type="number" tickFormatter={fmtMoneyShort} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} cursor={{ fill: 'var(--brand-050)' }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} cursor="pointer" onClick={() => nav('/pipeline')}>
                {m.byStage.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Umsatz nach Gebiet">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={m.byTerritory} margin={{ left: 6, right: 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={64} tickFormatter={fmtMoneyShort} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} cursor={{ fill: 'var(--brand-050)' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={34} cursor="pointer" onClick={() => nav('/territories')}>
                {m.byTerritory.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top-Produkte" sub="Nach Auftragswert">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, paddingTop: 4 }}>
            {m.topProducts.map((p, i) => {
              const max = m.topProducts[0].v;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}</span>
                    <span className="tiny muted" style={{ fontWeight: 700 }}>{fmtMoneyShort(p.v)}</span>
                  </div>
                  <div className="progress"><i style={{ width: (p.v / max) * 100 + '%', background: PIE_COLORS[i % 4] }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Lists row */}
      <div className="grid split">
        <Card title="Anstehende Aufgaben" sub="Ihre bevorstehenden Aktivitäten" pad={false}
          action={<Link to="/activities" className="btn sm ghost">Alle ansehen</Link>}>
          <div style={{ padding: '4px 8px' }}>
            {m.dueTasks.map((t) => {
              const Icon = ACT_ICON[t.type] || CheckCircle2;
              const overdue = !t.done && new Date(t.dueDate) < new Date();
              return (
                <div key={t.id} className="list-row" style={{ padding: '11px 12px' }}>
                  <label className="check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id, t.done)} />
                  </label>
                  <span className="ico" style={{ width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--brand-050)', color: 'var(--brand)' }}>
                    <Icon size={15} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.subject}</div>
                    <div className="muted tiny"><AccountLink id={t.accountId} name={acctName(t.accountId)} /></div>
                  </div>
                  <Badge tone={overdue ? 'red' : t.priority === 'Hoch' ? 'amber' : 'gray'}>{relDate(t.dueDate)}</Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Größte offene Deals" pad={false} action={<Link to="/pipeline" className="btn sm ghost">Pipeline</Link>}>
          <div className="table-wrap">
            <table className="tbl">
              <tbody>
                {m.topDeals.map((d) => {
                  const stage = db.stages.find((s) => s.id === d.stage);
                  return (
                    <tr key={d.id} onClick={() => nav('/pipeline')}>
                      <td>
                        <div className="cell-main">{d.name}</div>
                        <div className="cell-sub"><AccountLink id={d.accountId} name={acctName(d.accountId)} /></div>
                      </td>
                      <td><Badge tone="blue" dot>{stage?.name}</Badge></td>
                      <td className="right nowrap"><b>{fmtMoneyShort(d.value)}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)',
  fontSize: 12.5, padding: '8px 12px', background: 'var(--surface)', color: 'var(--text)',
};
