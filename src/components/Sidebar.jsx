import { NavLink } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Target, ShoppingCart, Package,
  CalendarCheck, UserPlus, Megaphone, Map, BarChart3, FileText, Settings,
  LifeBuoy, Receipt, Cpu, Calculator, ShieldCheck, LogOut, Wrench, ShieldAlert,
  FileSignature, Lightbulb, Mail, Presentation, Repeat, CopyCheck, Percent,
} from 'lucide-react';
import { Logo } from './Logo.jsx';
import { Avatar } from './ui.jsx';
import { useStore } from '../data/store.js';
import { logout } from '../data/auth.js';

const GROUPS = [
  {
    label: 'Überblick',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true }],
  },
  {
    label: 'Kontakte',
    items: [
      { to: '/accounts', icon: Building2, label: 'Firmen' },
      { to: '/contacts', icon: Users, label: 'Ansprechpartner' },
      { to: '/leads', icon: UserPlus, label: 'Interessenten', countKey: 'newLeads' },
      { to: '/duplicates', icon: CopyCheck, label: 'Dublettenprüfung' },
    ],
  },
  {
    label: 'Vorgänge',
    items: [
      { to: '/activities', icon: CalendarCheck, label: 'Aufgaben & Termine', countKey: 'dueTasks' },
      { to: '/service', icon: LifeBuoy, label: 'Kundendienst', countKey: 'openTickets' },
      { to: '/ideas', icon: Lightbulb, label: 'Ideen' },
    ],
  },
  {
    label: 'Vertrieb',
    items: [
      { to: '/pipeline', icon: Target, label: 'Pipeline', countKey: 'openDeals' },
      { to: '/orders', icon: ShoppingCart, label: 'Angebote & Aufträge' },
      { to: '/recurring-orders', icon: Repeat, label: 'Daueraufträge', countKey: 'dueRecurring' },
      { to: '/contracts', icon: FileSignature, label: 'Verträge' },
      { to: '/invoices', icon: Receipt, label: 'Rechnungen' },
      { to: '/products', icon: Package, label: 'Produkte' },
    ],
  },
  {
    label: 'Service & Technik',
    items: [
      { to: '/service-orders', icon: Wrench, label: 'Serviceaufträge', countKey: 'openOrders' },
      { to: '/devices', icon: Cpu, label: 'Geräteverwaltung', countKey: 'dueDevices' },
      { to: '/quality', icon: ShieldAlert, label: 'QM & Vigilanz', countKey: 'openIncidents' },
    ],
  },
  {
    label: 'Analyse & Controlling',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Berichte' },
      { to: '/cost-calc', icon: Calculator, label: 'Kostenkalkulation' },
      { to: '/provision', icon: Percent, label: 'Provision' },
      { to: '/territories', icon: Map, label: 'Gebiete & Team' },
      { to: '/campaigns', icon: Megaphone, label: 'Kampagnen' },
      { to: '/events', icon: Presentation, label: 'Messen & Events' },
    ],
  },
  {
    label: 'Dokumente & System',
    items: [
      { to: '/documents', icon: FileText, label: 'Dokumente' },
      { to: '/messages', icon: Mail, label: 'Nachrichten' },
      { to: '/datenschutz', icon: ShieldCheck, label: 'Datenschutz' },
      { to: '/settings', icon: Settings, label: 'Einstellungen' },
    ],
  },
];

export default function Sidebar({ open, collapsed, onNavigate }) {
  const db = useStore();
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const counts = {
    openDeals: db.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length,
    newLeads: db.leads.filter((l) => l.status === 'Neu').length,
    dueTasks: db.activities.filter((a) => !a.done).length,
    openTickets: db.tickets.filter((t) => t.status !== 'Gelöst').length,
    dueDevices: db.devices.filter((d) => [d.nextMtk, d.nextStk].some((x) => x && new Date(x) - new Date() < 30 * 86400000)).length,
    openOrders: db.serviceOrders.filter((s) => s.status !== 'Erledigt').length,
    openIncidents: db.incidents.filter((i) => i.meldepflichtig && i.status !== 'Abgeschlossen').length,
    dueRecurring: db.recurringOrders.filter((r) => r.active && new Date(r.nextDue) <= new Date()).length,
  };
  const nav = useNavigate();

  return (
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <div className="sidebar__brand"><Logo compact={collapsed} /></div>
      <nav className="sidebar__nav">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="nav-group-label">{g.label}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={onNavigate}
                title={collapsed ? it.label : undefined}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                <it.icon size={18} />
                <span>{it.label}</span>
                {it.countKey && counts[it.countKey] > 0 && (
                  <span className="count">{counts[it.countKey]}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
