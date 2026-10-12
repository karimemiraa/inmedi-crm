import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, Target, ShoppingCart, Package,
  CalendarCheck, UserPlus, Megaphone, Map, BarChart3, FileText, Settings,
  LifeBuoy, Receipt, Calculator, ShieldCheck, ShieldAlert,
  FileSignature, Lightbulb, Mail, Presentation, Repeat, CopyCheck, Percent, Scale, Sparkles, ChevronRight,
} from 'lucide-react';
import { Logo } from './Logo.jsx';

const TOP = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/assistant', icon: Sparkles, label: 'KI-Assistent' },
];

const GROUPS = [
  {
    id: 'kunden', label: 'Kunden',
    items: [
      { to: '/accounts', icon: Building2, label: 'Firmen' },
      { to: '/contacts', icon: Users, label: 'Ansprechpartner' },
      { to: '/leads', icon: UserPlus, label: 'Interessenten' },
      { to: '/duplicates', icon: CopyCheck, label: 'Dubletten' },
    ],
  },
  {
    id: 'vertrieb', label: 'Vertrieb',
    items: [
      { to: '/pipeline', icon: Target, label: 'Pipeline' },
      { to: '/orders', icon: ShoppingCart, label: 'Angebote & Aufträge' },
      { to: '/recurring-orders', icon: Repeat, label: 'Daueraufträge' },
      { to: '/contracts', icon: FileSignature, label: 'Verträge' },
      { to: '/invoices', icon: Receipt, label: 'Rechnungen' },
      { to: '/products', icon: Package, label: 'Produkte' },
    ],
  },
  {
    id: 'vorgaenge', label: 'Vorgänge',
    items: [
      { to: '/activities', icon: CalendarCheck, label: 'Aufgaben & Termine' },
      { to: '/service', icon: LifeBuoy, label: 'Kundendienst' },
      { to: '/quality', icon: ShieldAlert, label: 'QM & Vigilanz' },
      { to: '/ideas', icon: Lightbulb, label: 'Ideen' },
    ],
  },
  {
    id: 'marketing', label: 'Marketing',
    items: [
      { to: '/campaigns', icon: Megaphone, label: 'Kampagnen' },
      { to: '/events', icon: Presentation, label: 'Messen' },
    ],
  },
  {
    id: 'controlling', label: 'Controlling',
    items: [
      { to: '/reports', icon: BarChart3, label: 'Berichte' },
      { to: '/care-cost', icon: Scale, label: 'Betreuungskosten' },
      { to: '/cost-calc', icon: Calculator, label: 'Kostenkalkulation' },
      { to: '/provision', icon: Percent, label: 'Provision' },
      { to: '/territories', icon: Map, label: 'Gebiete & Team' },
    ],
  },
  {
    id: 'system', label: 'System',
    items: [
      { to: '/documents', icon: FileText, label: 'Dokumente' },
      { to: '/messages', icon: Mail, label: 'Nachrichten' },
      { to: '/datenschutz', icon: ShieldCheck, label: 'Datenschutz' },
      { to: '/settings', icon: Settings, label: 'Einstellungen' },
    ],
  },
];

// Detailseiten (/vorgang/<slug>/…, /team/…) der passenden Gruppe zuordnen, damit diese offen ist
const VORGANG_GROUP = {
  firma: 'kunden', ansprechpartner: 'kunden',
  deal: 'vertrieb', angebot: 'vertrieb', auftrag: 'vertrieb', dauerauftrag: 'vertrieb', vertrag: 'vertrieb', rechnung: 'vertrieb', produkt: 'vertrieb',
  aufgabe: 'vorgaenge', ticket: 'vorgaenge', vorkommnis: 'vorgaenge', capa: 'vorgaenge', idee: 'vorgaenge',
  kampagne: 'marketing', messe: 'marketing',
};
function groupOf(pathname) {
  const v = pathname.match(/^\/vorgang\/([^/]+)/);
  if (v) return VORGANG_GROUP[v[1]] || null;
  if (pathname.startsWith('/team')) return 'controlling';
  const g = GROUPS.find((x) => x.items.some((it) => pathname === it.to || pathname.startsWith(it.to + '/')));
  return g?.id || null;
}

const OPEN_KEY = 'inmedi-nav-open';
const loadOpen = () => { try { return JSON.parse(localStorage.getItem(OPEN_KEY)) || {}; } catch (e) { return {}; } };

function Item({ it, collapsed, onNavigate }) {
  return (
    <NavLink
      to={it.to}
      end={it.end}
      onClick={onNavigate}
      title={collapsed ? it.label : undefined}
      className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
    >
      <it.icon size={17} />
      <span>{it.label}</span>
    </NavLink>
  );
}

export default function Sidebar({ open, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const current = groupOf(pathname);
  const [openGroups, setOpenGroups] = useState(loadOpen);
  // Gruppe der aktuellen Seite immer aufklappen (bleibt danach gespeichert)
  useEffect(() => {
    if (current && !openGroups[current]) setOpenGroups((o) => ({ ...o, [current]: true }));
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(openGroups)); } catch (e) {} }, [openGroups]);
  const toggle = (id) => setOpenGroups((o) => ({ ...o, [id]: !o[id] }));

  return (
    <aside className={'sidebar' + (open ? ' open' : '')}>
      <div className="sidebar__brand"><Logo compact={collapsed} /></div>
      <nav className="sidebar__nav">
        {TOP.map((it) => <Item key={it.to} it={it} collapsed={collapsed} onNavigate={onNavigate} />)}
        {GROUPS.map((g) => {
          const isOpen = collapsed || !!openGroups[g.id];
          return (
            <div key={g.id} className={'nav-group' + (isOpen ? ' open' : '')}>
              <button type="button" className={'nav-group-head' + (current === g.id ? ' current' : '')} onClick={() => toggle(g.id)} aria-expanded={isOpen}>
                <span>{g.label}</span>
                <ChevronRight size={13} />
              </button>
              {isOpen && <div className="nav-group-items">{g.items.map((it) => <Item key={it.to} it={it} collapsed={collapsed} onNavigate={onNavigate} />)}</div>}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
