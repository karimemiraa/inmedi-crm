import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, Plus, PanelLeft, ChevronDown, Building2, Users, Target, ShoppingCart, Receipt, Package, UserPlus, Presentation, Sun, Moon, AlignJustify, StretchVertical } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Avatar } from './ui.jsx';
import { openLink } from '../lib/nav.js';
import { relDate } from '../lib/format.js';

export default function Topbar({ onMenu, onToggleCollapse, onQuickAdd }) {
  const db = useStore();
  const nav = useNavigate();
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const [q, setQ] = useState('');
  const [openRes, setOpenRes] = useState(false);
  const [active, setActive] = useState(0);
  const [openNotif, setOpenNotif] = useState(false);
  const searchRef = useRef();
  const notifRef = useRef();
  const inputRef = useRef();

  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('inmedi-theme') || 'system'; } catch (e) { return 'system'; } });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('inmedi-theme', theme); } catch (e) {}
  }, [theme]);
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  const [density, setDensity] = useState(() => { try { return localStorage.getItem('inmedi-density') || 'compact'; } catch (e) { return 'compact'; } });
  useEffect(() => {
    const root = document.documentElement;
    if (density === 'comfort') root.setAttribute('data-density', 'comfort'); else root.removeAttribute('data-density');
    try { localStorage.setItem('inmedi-density', density); } catch (e) {}
  }, [density]);

  useEffect(() => {
    const h = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setOpenRes(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setOpenNotif(false);
    };
    const key = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); } };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', key); };
  }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    const has = (v) => v && v.toLowerCase().includes(s);
    const out = [];
    db.accounts.filter((a) => has(a.name) || has(a.kundennummer)).slice(0, 4)
      .forEach((a) => out.push({ icon: Building2, label: a.name, sub: a.type, to: `/accounts/${a.id}` }));
    db.contacts.filter((c) => has(c.name) || has(c.title)).slice(0, 3)
      .forEach((c) => out.push({ icon: Users, label: c.name, sub: c.title || 'Ansprechpartner', to: `/contacts/${c.id}` }));
    db.leads.filter((l) => has(l.name) || has(l.company)).slice(0, 2)
      .forEach((l) => out.push({ icon: UserPlus, label: l.name, sub: 'Interessent · ' + l.company, to: `/leads/${l.id}` }));
    db.deals.filter((d) => has(d.name)).slice(0, 3)
      .forEach((d) => out.push({ icon: Target, label: d.name, sub: 'Deal', to: openLink('/pipeline', d.id) }));
    db.orders.filter((o) => has(o.number)).slice(0, 3)
      .forEach((o) => out.push({ icon: ShoppingCart, label: o.number, sub: o.kind, to: openLink('/orders', o.id) }));
    db.invoices.filter((i) => has(i.number)).slice(0, 2)
      .forEach((i) => out.push({ icon: Receipt, label: i.number, sub: 'Rechnung', to: openLink('/invoices', i.id) }));
    db.products.filter((p) => has(p.name) || has(p.sku)).slice(0, 2)
      .forEach((p) => out.push({ icon: Package, label: p.name, sub: 'Produkt · ' + p.sku, to: '/products' }));
    db.events.filter((e) => has(e.name) || has(e.location)).slice(0, 2)
      .forEach((e) => out.push({ icon: Presentation, label: e.name, sub: e.type, to: openLink('/events', e.id) }));
    return out.slice(0, 10);
  }, [q, db]);

  const notifications = useMemo(() => {
    const overdue = db.activities.filter((a) => !a.done && new Date(a.dueDate) < new Date());
    const hot = db.deals.filter((d) => d.value > 100000 && d.stage === 'negotiation');
    const list = [];
    hot.slice(0, 3).forEach((d) => list.push({ title: 'Großauftrag in Verhandlung', body: `${d.name} · ${(d.value / 1000).toFixed(0)} Tsd. €`, tone: 'amber' }));
    overdue.slice(0, 4).forEach((a) => list.push({ title: `Überfällig: ${a.subject}`, body: relDate(a.dueDate), tone: 'red' }));
    return list;
  }, [db]);

  const go = (to) => { nav(to); setQ(''); setOpenRes(false); };

  return (
    <header className="topbar">
      <button className="icon-btn hamburger" aria-label="Menü öffnen" onClick={onMenu}><Menu size={18} /></button>
      <button className="icon-btn" aria-label="Seitenleiste ein- und ausklappen" title="Seitenleiste ein- und ausklappen" onClick={onToggleCollapse} style={{ display: 'grid' }}><PanelLeft size={18} /></button>

      <div className="search" ref={searchRef} style={{ position: 'relative' }}>
        <Search size={16} />
        <input
          ref={inputRef}
          aria-label="Suche über alles"
          autoComplete="off"
          spellCheck={false}
          placeholder="Suche über alles …"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenRes(true); setActive(0); }}
          onFocus={() => setOpenRes(true)}
          onKeyDown={(e) => {
            if (!openRes || results.length === 0) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); const r = results[active]; if (r) go(r.to); }
            else if (e.key === 'Escape') { setOpenRes(false); inputRef.current?.blur(); }
          }}
        />
        <span className="kbd">⌘K</span>
        {openRes && results.length > 0 && (
          <div className="dropdown" style={{ left: 0, right: 0, width: 'auto' }}>
            {results.map((r, i) => (
              <button key={i} className={'nav-item' + (i === active ? ' active' : '')} style={{ color: 'var(--text)', width: '100%', borderRadius: 0 }} onMouseEnter={() => setActive(i)} onClick={() => go(r.to)}>
                <r.icon size={16} />
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span className="muted tiny" style={{ marginLeft: 'auto' }}>{r.sub}</span>
              </button>
            ))}
          </div>
        )}
        {openRes && q.trim() && results.length === 0 && (
          <div className="dropdown" style={{ left: 0, right: 0, width: 'auto' }}>
            <div className="empty" style={{ padding: 20 }}>Keine Treffer für „{q}"</div>
          </div>
        )}
      </div>

      <button className="icon-btn" aria-label={density === 'compact' ? 'Komfort-Ansicht' : 'Kompakt-Ansicht'} title={density === 'compact' ? 'Komfort-Dichte' : 'Kompakt-Dichte'} onClick={() => setDensity((d) => (d === 'compact' ? 'comfort' : 'compact'))}>{density === 'compact' ? <StretchVertical size={18} /> : <AlignJustify size={18} />}</button>

      <button className="icon-btn" aria-label={isDark ? 'Helles Design' : 'Dunkles Design'} title={isDark ? 'Helles Design' : 'Dunkles Design'} onClick={() => setTheme(isDark ? 'light' : 'dark')}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>

      <button className="icon-btn" aria-label="Schnell erfassen" title="Schnell erfassen" onClick={onQuickAdd}><Plus size={18} /></button>

      <div style={{ position: 'relative' }} ref={notifRef}>
        <button className="icon-btn" aria-label="Benachrichtigungen" onClick={() => setOpenNotif((v) => !v)}>
          <Bell size={18} />
          {notifications.length > 0 && <span className="dot" />}
        </button>
        {openNotif && (
          <div className="dropdown">
            <div className="card-head" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 14 }}>Benachrichtigungen</h3>
              <span className="muted tiny">{notifications.length} neu</span>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {notifications.length === 0 && <div className="empty" style={{ padding: 28 }}>Keine Benachrichtigungen</div>}
              {notifications.map((n, i) => (
                <div key={i} className="list-row" style={{ padding: '12px 16px' }}>
                  <span className={'badge ' + n.tone} style={{ width: 8, height: 8, padding: 0, borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div>
                    <div className="muted tiny">{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="topbar-user" onClick={() => nav('/profile')} title="Mein Profil">
        <Avatar name={me.name} color={me.color} src={me.avatar} size="sm" />
        <div className="tu-meta"><b>{me.name}</b><span>{me.title}</span></div>
        <ChevronDown size={15} style={{ color: 'var(--text-3)' }} />
      </div>
    </header>
  );
}
