import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import { startIntakeAutoSync } from '../lib/intake.js';
import Topbar from './Topbar.jsx';
import QuickAdd from './QuickAdd.jsx';
import AssistantPanel from './ai/AssistantPanel.jsx';

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('inmedi-sb-collapsed') === '1'; } catch (e) { return false; }
  });
  const [quickAdd, setQuickAdd] = useState(false);

  useEffect(() => startIntakeAutoSync(), []); // Rechnungseingang per E-Mail im Hintergrund abgleichen
  useEffect(() => { try { localStorage.setItem('inmedi-sb-collapsed', collapsed ? '1' : '0'); } catch (e) {} }, [collapsed]);

  return (
    <div className={'app' + (collapsed ? ' sb-collapsed' : '')}>
      <Sidebar open={navOpen} collapsed={collapsed} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="overlay" style={{ zIndex: 35 }} onClick={() => setNavOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setNavOpen((v) => !v)} onToggleCollapse={() => setCollapsed((v) => !v)} onQuickAdd={() => setQuickAdd(true)} />
        <Outlet />
      </div>
      {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} />}
      <AssistantPanel />
    </div>
  );
}
