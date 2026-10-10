import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Map, Users } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Avatar, Badge, Card, KpiCard } from '../components/ui.jsx';
import { fmtMoney, fmtMoneyShort } from '../lib/format.js';

const ROLE_TONE = { Administrator: 'purple', Manager: 'blue', Vertrieb: 'gray' };

export default function Territories() {
  const db = useStore();

  const reps = useMemo(() => db.users.map((u) => {
    const accounts = db.accounts.filter((a) => a.ownerId === u.id);
    const won = db.deals.filter((d) => d.ownerId === u.id && d.stage === 'won').reduce((s, d) => s + d.value, 0);
    const pipeline = db.deals.filter((d) => d.ownerId === u.id && d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0);
    const attain = u.quota ? Math.round((won / u.quota) * 100) : 0;
    return { ...u, accounts: accounts.length, won, pipeline, attain };
  }), [db]);

  const terrData = useMemo(() => db.territories.map((t) => ({
    name: t.name, color: t.color,
    revenue: db.accounts.filter((a) => a.territoryId === t.id).reduce((s, a) => s + a.revenueYTD, 0),
    accounts: db.accounts.filter((a) => a.territoryId === t.id).length,
  })), [db]);

  const terr = (id) => db.territories.find((t) => t.id === id)?.name || '—';
  const totalRevenue = terrData.reduce((s, t) => s + t.revenue, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Gebiete & Team</h1><div className="sub">Vertriebsleistung, Zielerreichung & Gebietsabdeckung</div></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Map} tone="brand" label="Gebiete" value={db.territories.length} />
        <KpiCard icon={Users} tone="teal" label="Teammitglieder" value={db.users.length} />
        <KpiCard icon={Map} tone="green" label="Gesamtumsatz" value={fmtMoneyShort(totalRevenue)} />
        <KpiCard icon={Users} tone="purple" label="Betreute Konten" value={db.accounts.length} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <Card title="Umsatz nach Gebiet">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={terrData} margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <YAxis width={64} tickFormatter={fmtMoneyShort} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5 }} cursor={{ fill: 'var(--brand-050)' }} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]} barSize={40}>
                {terrData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Gebietsabdeckung" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Gebiet</th><th className="right">Konten</th><th className="right">Umsatz lfd. Jahr</th></tr></thead>
            <tbody>
              {terrData.map((t) => (
                <tr key={t.name} style={{ cursor: 'default' }}>
                  <td><div className="avatar-row"><span style={{ width: 10, height: 10, borderRadius: 3, background: t.color }} /><span className="cell-main">{t.name}</span></div></td>
                  <td className="right">{t.accounts}</td>
                  <td className="right"><b>{fmtMoney(t.revenue)}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      </div>

      <Card title="Teamleistung" sub="Zielerreichung dieses Jahr" pad={false}>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Mitarbeiter</th><th>Rolle</th><th>Gebiet</th><th className="right">Konten</th><th className="right">Pipeline</th><th className="right">Gewonnen</th><th style={{ width: 200 }}>Zielerreichung</th></tr></thead>
          <tbody>
            {reps.map((r) => (
              <tr key={r.id} style={{ cursor: 'default' }}>
                <td><div className="avatar-row"><Avatar size="sm" name={r.name} color={r.color} /><div><div className="cell-main">{r.name}</div><div className="cell-sub">{r.title}</div></div></div></td>
                <td><Badge tone={ROLE_TONE[r.role]}>{r.role}</Badge></td>
                <td>{terr(r.territoryId)}</td>
                <td className="right">{r.accounts}</td>
                <td className="right">{fmtMoneyShort(r.pipeline)}</td>
                <td className="right"><b>{fmtMoneyShort(r.won)}</b></td>
                <td>
                  <div className="stat-line">
                    <div className="progress" style={{ flex: 1 }}><i style={{ width: Math.min(r.attain, 100) + '%', background: r.attain >= 100 ? 'var(--green)' : r.attain >= 60 ? 'var(--brand)' : 'var(--amber)' }} /></div>
                    <b className="tiny" style={{ width: 38, textAlign: 'right' }}>{r.attain}%</b>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </div>
  );
}
