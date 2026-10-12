import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Building2, Target, TrendingUp, ListTodo } from 'lucide-react';
import { useStore } from '../data/store.js';
import { AccountLink, Avatar, Badge, Card, Empty, KpiCard } from '../components/ui.jsx';
import { LinkRow } from '../components/Vorgang.jsx';
import { fmtMoney, fmtMoneyShort, relDate } from '../lib/format.js';
import { VORGANG_KINDS, vorgangLink, vorgangName, kindLabel } from '../lib/vorgang.js';
import { isOpen } from '../lib/status.js';

// Mitarbeiterseite: Profil, Kennzahlen, betreute Firmen, offene Vorgänge, letzte Änderungen.
export default function TeamMember() {
  const { id } = useParams();
  const db = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const u = db.users.find((x) => x.id === id);
  const back = () => (location.key !== 'default' ? nav(-1) : nav('/territories'));
  if (!u) return <div className="page"><Empty label="Mitarbeiter nicht gefunden" /></div>;

  const year = new Date().getFullYear();
  const territory = db.territories.find((t) => t.id === u.territoryId);
  const accounts = db.accounts.filter((a) => a.ownerId === id || a.innendienstId === id);
  const openDeals = db.deals.filter((d) => d.ownerId === id && d.stage !== 'won' && d.stage !== 'lost');
  const revenue = db.orders.filter((o) => o.ownerId === id && o.kind === 'Auftrag' && new Date(o.date).getFullYear() === year).reduce((s, o) => s + (o.total || 0), 0);
  const quotaPct = u.quota ? Math.round((revenue / u.quota) * 100) : null;

  const open = [
    ...openDeals.map((r) => ({ kind: 'deals', id: r.id, rec: r })),
    ...db.orders.filter((o) => o.ownerId === id && o.kind === 'Angebot' && !['Abgelehnt'].includes(o.status)).map((r) => ({ kind: 'orders', id: r.id, rec: r })),
    ...db.invoices.filter((i) => i.ownerId === id && !['Bezahlt', 'Storniert'].includes(i.status)).map((r) => ({ kind: 'invoices', id: r.id, rec: r })),
    ...db.tickets.filter((t) => t.ownerId === id && isOpen(db, 'tickets', t.status)).map((r) => ({ kind: 'tickets', id: r.id, rec: r })),
    ...db.activities.filter((a) => a.ownerId === id && !a.done).map((r) => ({ kind: 'activities', id: r.id, rec: r })),
    ...db.capas.filter((c) => c.ownerId === id && isOpen(db, 'capas', c.status)).map((r) => ({ kind: 'capas', id: r.id, rec: r })),
  ];

  // Letzte Änderungen dieses Mitarbeiters über alle Vorgänge
  const recent = [];
  VORGANG_KINDS.forEach((k) => (db[k] || []).forEach((r) => (r.history || []).forEach((h) => { if (h.userId === id) recent.push({ kind: k, rec: r, h }); })));
  recent.sort((a, b) => new Date(b.h.at) - new Date(a.h.at));

  return (
    <div className="page">
      <div className="vp-crumbs">
        <button className="btn ghost sm" onClick={back}><ArrowLeft size={15} /> Zurück</button>
        <span className="muted tiny"><Link to="/territories" className="rec-link">Gebiete & Team</Link> / {u.name}</span>
      </div>

      <div className="card card-pad vp-hero">
        <div className="detail-hero">
          <Avatar name={u.name} color={u.color} src={u.avatar} size="lg" />
          <div>
            <h1 style={{ fontSize: 21 }}>{u.name}</h1>
            <div className="vp-badges" style={{ marginTop: 6 }}>
              <Badge tone="blue">{u.title}</Badge>
              <Badge tone="gray">{u.role}</Badge>
              {u.status && <Badge tone={u.status === 'Aktiv' ? 'green' : 'gray'} dot>{u.status}</Badge>}
            </div>
            <div className="vp-meta">
              {u.email && <span><Mail size={13} /> <a className="rec-link" href={'mailto:' + u.email}>{u.email}</a></span>}
              {territory && <span><MapPin size={13} /> <Link className="rec-link" to="/territories">Gebiet {territory.name}</Link></span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Building2} tone="brand" label="Betreute Firmen" value={accounts.length} />
        <KpiCard icon={Target} tone="amber" label="Offene Pipeline" value={fmtMoneyShort(openDeals.reduce((s, d) => s + d.value, 0))} />
        <KpiCard icon={TrendingUp} tone="green" label={'Auftragsumsatz ' + year} value={fmtMoneyShort(revenue)} />
        <KpiCard icon={ListTodo} tone="purple" label={quotaPct != null ? 'Zielerreichung' : 'Offene Vorgänge'} value={quotaPct != null ? quotaPct + ' %' : open.length} />
      </div>

      <div className="grid cols-2">
        <Card title={`Offene Vorgänge (${open.length})`} sub="Deals, Angebote, Rechnungen, Tickets, Aufgaben, CAPA">
          {open.length === 0 && <Empty label="Keine offenen Vorgänge" />}
          {open.map((it) => <LinkRow key={it.kind + it.id} db={db} kind={it.kind} id={it.id} rec={it.rec} />)}
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title={`Betreute Firmen (${accounts.length})`} pad={false}>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Firma</th><th>Rolle</th><th className="right">Umsatz lfd. J.</th></tr></thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} onClick={() => nav('/accounts/' + a.id)}>
                    <td className="cell-main"><AccountLink account={a} /></td>
                    <td>{a.ownerId === id ? 'Außendienst' : 'Innendienst'}</td>
                    <td className="right">{fmtMoney(a.revenueYTD || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>{accounts.length === 0 && <Empty label="Keine Firmen zugeordnet" />}</div>
          </Card>
          <Card title="Zuletzt bearbeitet">
            {recent.length === 0 && <Empty label="Noch keine Änderungen" />}
            {recent.slice(0, 8).map(({ kind, rec, h }) => (
              <div key={h.id || h.at + rec.id} className="list-row clickable" onClick={() => nav(vorgangLink(kind, rec.id))}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{kindLabel(kind, rec)} · {vorgangName(kind, rec)}</div>
                  <div className="muted tiny">{h.text}</div>
                </div>
                <span className="muted tiny nowrap">{relDate(h.at)}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
