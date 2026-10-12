import { RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, Empty } from './ui.jsx';
import { fmtDate, relDate } from '../lib/format.js';
import { VORGANG, vorgangLink, vorgangName, restoreVorgang, purgeVorgang, purgeAll } from '../lib/vorgang.js';

// Papierkorb für gelöschte Vorgänge: wiederherstellen oder endgültig löschen.
export default function Trash({ db, toast }) {
  const nav = useNavigate();
  const items = db.trash || [];
  const user = (id) => db.users.find((u) => u.id === id)?.name || '—';
  return (
    <Card title={`Papierkorb (${items.length})`} sub="Gelöschte Vorgänge lassen sich wiederherstellen — inkl. Kommentaren, Verlauf und Verknüpfungen." pad={false}
      action={items.length > 0 && <button className="btn sm danger" onClick={() => { if (window.confirm(`Alle ${items.length} Einträge endgültig löschen? Dies kann nicht rückgängig gemacht werden.`)) { purgeAll(); toast('Papierkorb geleert'); } }}><Trash2 size={13} /> Papierkorb leeren</button>}>
      {items.length === 0 ? <Empty label="Papierkorb ist leer" /> : (
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Vorgang</th><th>Art</th><th>Gelöscht</th><th>Von</th><th className="right">Aktionen</th></tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} style={{ cursor: 'default' }}>
                <td className="cell-main">{vorgangName(t.kind, t.record)}{t.cascade?.length ? <span className="muted tiny"> (+ {t.cascade.length} Ansprechpartner)</span> : null}</td>
                <td><Badge tone="gray">{VORGANG[t.kind]?.label}</Badge></td>
                <td className="nowrap" title={fmtDate(t.deletedAt)}>{relDate(t.deletedAt)}</td>
                <td>{user(t.deletedBy)}</td>
                <td className="right nowrap">
                  <span className="row-actions">
                    <button className="btn sm" onClick={() => { restoreVorgang(t.id); toast(VORGANG[t.kind].label + ' wiederhergestellt'); }}><RotateCcw size={13} /> Wiederherstellen</button>
                    <button className="btn sm ghost" onClick={() => { restoreVorgang(t.id); nav(vorgangLink(t.kind, t.record.id)); }}>Öffnen</button>
                    <button className="icon-btn sm" title="Endgültig löschen" aria-label="Endgültig löschen" onClick={() => { if (window.confirm('Endgültig löschen? Dies kann nicht rückgängig gemacht werden.')) { purgeVorgang(t.id); toast('Endgültig gelöscht'); } }}><Trash2 size={14} /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </Card>
  );
}
