import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, Plus, PanelLeft, ChevronDown, Building2, Users, Target } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Avatar } from './ui.jsx';
import { relDate } from '../lib/format.js';

export default function Topbar({ onMenu, onToggleCollapse, onQuickAdd }) {
  const db = useStore();
  const nav = useNavigate();
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const [q, setQ] = useState('');
  const [openRes, setOpenRes] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const searchRef = useRef();
  const notifRef = useRef();
  const inputRef = useRef();

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
    const out = [];
    db.accounts.filter((a) => a.name.toLowerCase().includes(s)).slice(0, 4)
      .forEach((a) => out.push({ icon: Building2, label: a.name, sub: a.type, to: `/accounts/${a.id}` }));
    db.contacts.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 3)
      .forEach((c) => out.push({ icon: Users, label: c.name, sub: c.title, to: '/contacts' }));
    db.deals.filter((d) => d.name.toLowerCase().includes(s)).slice(0, 3)
      .forEach((d) => out.push({ icon: Target, label: d.name, sub: 'Deal', to: '/pipeline' }));
    return out.slice(0, 8);
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
      <button className="icon-btn hamburger" onClick={onMenu}><Menu size={18} /></button>
      <button className="icon-btn" title="Seitenleiste ein- und ausklappen" onClick={onToggleCollapse} style={{ display: 'grid' }}><PanelLeft size={18} /></button>

      <div className="search" ref={searchRef} style={{ position: 'relative' }}>
        <Search size={16} />
        <input
          ref={inputRef}
          placeholder="Suche über alles …"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenRes(true); }}
          onFocus={() => setOpenRes(true)}
        />
        <span className="kbd">⌘K</span>
        {openRes && results.length > 0 && (
          <div className="dropdown" style={{ left: 0, right: 0, width: 'auto' }}>
            {results.map((r, i) => (
              <button key={i} className="nav-item" style={{ color: 'var(--text)', width: '100%', borderRadius: 0 }} onClick={() => go(r.to)}>
                <r.icon size={16} />
                <span style={{ fontWeight: 600 }}>{r.label}</span>
                <span className="muted tiny" style={{ marginLeft: 'auto' }}>{r.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="icon-btn" title="Schnell erfassen" onClick={onQuickAdd}><Plus size={18} /></button>

      <div style={{ position: 'relative' }} ref={notifRef}>
        <button className="icon-btn" onClick={() => setOpenNotif((v) => !v)}>
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
