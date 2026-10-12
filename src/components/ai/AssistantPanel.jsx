import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, X, Maximize2 } from 'lucide-react';
import AssistantChat from './AssistantChat.jsx';
import { useStore } from '../../data/store.js';
import { kindBySlug, VORGANG } from '../../lib/vorgang.js';

// Seitenkontext aus der aktuellen Route (Firma, Ansprechpartner, Vorgang, Mitarbeiter)
export function routeContext(db, pathname) {
  let m;
  if ((m = pathname.match(/^\/accounts\/([^/]+)/))) return { kind: 'accounts', id: m[1], label: db.accounts.find((a) => a.id === m[1])?.name };
  if ((m = pathname.match(/^\/contacts\/([^/]+)/))) { const c = db.contacts.find((x) => x.id === m[1]); return c ? { kind: 'accounts', id: c.accountId, label: db.accounts.find((a) => a.id === c.accountId)?.name } : null; }
  if ((m = pathname.match(/^\/vorgang\/([^/]+)\/([^/]+)/))) {
    const kind = kindBySlug(m[1]);
    const r = kind && db[kind]?.find((x) => x.id === decodeURIComponent(m[2]));
    if (r?.accountId) return { kind: 'accounts', id: r.accountId, label: db.accounts.find((a) => a.id === r.accountId)?.name };
    return r ? { kind, id: r.id, label: `${VORGANG[kind].label} ${VORGANG[kind].title(r)}` } : null;
  }
  if ((m = pathname.match(/^\/team\/([^/]+)/))) return { kind: 'users', id: m[1], label: 'Mitarbeiter ' + (db.users.find((u) => u.id === m[1])?.name || '') };
  return null;
}

export default function AssistantPanel() {
  const db = useStore();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(null);
  const context = routeContext(db, loc.pathname);

  useEffect(() => {
    const h = (e) => { setOpen(true); if (e.detail?.prompt) setAuto(e.detail.prompt); };
    window.addEventListener('inmedi-ai-open', h);
    return () => window.removeEventListener('inmedi-ai-open', h);
  }, []);
  useEffect(() => { if (loc.pathname === '/assistant') setOpen(false); }, [loc.pathname]);
  if (loc.pathname === '/assistant') return null;

  return (
    <>
      {!open && <button className="ai-fab" onClick={() => setOpen(true)} aria-label="KI-Assistent öffnen" title="KI-Assistent"><Sparkles size={18} /> <span>KI-Assistent</span></button>}
      {open && (
        <aside className="ai-panel" aria-label="KI-Assistent">
          <div className="ai-panel-head">
            <b><Sparkles size={15} /> KI-Assistent</b>
            {context?.label && <span className="chip" title="Bezieht sich auf diese Seite">{context.label}</span>}
            <span style={{ flex: 1 }} />
            <button className="icon-btn sm" title="Als Seite öffnen" aria-label="Als Seite öffnen" onClick={() => { setOpen(false); nav('/assistant'); }}><Maximize2 size={14} /></button>
            <button className="icon-btn sm" title="Schließen" aria-label="Schließen" onClick={() => setOpen(false)}><X size={15} /></button>
          </div>
          <AssistantChat compact context={context} autoPrompt={auto} onAutoPromptUsed={() => setAuto(null)} />
        </aside>
      )}
    </>
  );
}
