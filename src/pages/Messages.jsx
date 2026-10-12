import { useState, useMemo } from 'react';
import { Plus, Mail, Search, Info, Send } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Avatar, Badge, Empty, Field, Modal, Select, UserChip } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { relDate } from '../lib/format.js';

export default function Messages() {
  const db = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState(false);

  const acct = (id) => db.accounts.find((a) => a.id === id);
  const user = (id) => db.users.find((u) => u.id === id);
  // Kommunikation = Aktivitäten vom Typ E-Mail (Protokoll)
  const rows = useMemo(() => db.activities.filter((a) => a.type === 'email' &&
    (!q || a.subject.toLowerCase().includes(q.toLowerCase()) || (acct(a.accountId)?.name || '').toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)), [db.activities, q]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Nachrichten</h1><div className="sub">E-Mail-Kommunikation und Korrespondenz je Firma, zentral protokolliert</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setComposing(true)}><Plus size={16} /> Neue Nachricht</button></div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, background: 'var(--brand-050)', borderColor: 'transparent' }}>
        <div className="stat-line" style={{ color: 'var(--brand-700)', gap: 10 }}>
          <Info size={17} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>Die direkte Postfach-Anbindung (Senden und Empfangen) wird mit dem Backend aktiviert. Hier wird die Kommunikation je Firma festgehalten und ist mit Vorgängen verknüpft.</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search" style={{ maxWidth: 320 }}>
          <Search size={16} /><input placeholder="Nachrichten suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr><th>Betreff</th><th>Firma</th><th>Von</th><th>Datum</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} style={{ cursor: 'default' }}>
                <td className="cell-main"><Mail size={14} style={{ verticalAlign: -2, marginRight: 8, color: 'var(--brand)' }} />{m.subject}</td>
                <td><AccountLink account={acct(m.accountId)} /></td>
                <td><UserChip user={user(m.ownerId)} short /></td>
                <td className="muted tiny nowrap">{relDate(m.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine Nachrichten" hint="Oben rechts die erste Korrespondenz festhalten." />}</div>
      </div>

      {composing && <Compose db={db} onClose={() => setComposing(false)} toast={toast} />}
    </div>
  );
}

function Compose({ db, onClose, toast }) {
  const [f, setF] = useState({ accountId: db.accounts[0]?.id || '', subject: '', body: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.subject) { toast('Bitte einen Betreff angeben'); return; }
    store.add('activities', {
      type: 'email', subject: f.subject, accountId: f.accountId || null,
      contactId: db.contacts.find((c) => c.accountId === f.accountId)?.id || null,
      ownerId: db.meta.currentUserId, dueDate: new Date().toISOString(), done: true,
      priority: 'Mittel', notes: f.body,
    });
    toast('Nachricht protokolliert'); onClose();
  };
  return (
    <Modal title="Neue Nachricht" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}><Send size={15} /> Protokollieren</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Firma"><Select className="select" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{db.accounts.length === 0 && <option value="">— keine Firma —</option>}{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Betreff"><input className="input" value={f.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Betreff der Nachricht" autoFocus /></Field>
        <Field label="Nachricht"><textarea className="input" rows={5} value={f.body} onChange={(e) => set('body', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
