import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, Mail } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Avatar, Badge, Empty } from '../components/ui.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import { relDate } from '../lib/format.js';

export default function Contacts() {
  const db = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => db.contacts.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.title.toLowerCase().includes(q.toLowerCase())
  ), [db.contacts, q]);

  const acct = (id) => db.accounts.find((a) => a.id === id);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Ansprechpartner</h1><div className="sub">{db.contacts.length} Personen in Ihren Firmen</div></div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neuer Ansprechpartner</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search" style={{ background: 'var(--surface)', maxWidth: 320 }}>
          <Search size={16} /><input placeholder="Ansprechpartner suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Name</th><th>Position</th><th>Firma</th><th>E-Mail</th><th>Telefon</th><th>Letzter Kontakt</th></tr></thead>
            <tbody>
              {rows.map((c) => {
                const a = acct(c.accountId);
                return (
                  <tr key={c.id} onClick={() => a && nav('/accounts/' + a.id)}>
                    <td>
                      <div className="avatar-row">
                        <Avatar size="sm" name={c.name} color={c.color} />
                        <span className="cell-main">{c.name}{c.isPrimary && <Badge tone="brand" >Hauptkontakt</Badge>}</span>
                      </div>
                    </td>
                    <td>{c.title}</td>
                    <td>{a?.name}</td>
                    <td className="muted"><Mail size={12} style={{ verticalAlign: -1, marginRight: 5 }} />{c.email}</td>
                    <td className="muted"><Phone size={12} style={{ verticalAlign: -1, marginRight: 5 }} />{c.phone}</td>
                    <td>{relDate(c.lastContact)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty label="Keine passenden Ansprechpartner" />}
        </div>
      </div>
      {adding && <QuickAdd initial="contact" onClose={() => setAdding(false)} />}
    </div>
  );
}
