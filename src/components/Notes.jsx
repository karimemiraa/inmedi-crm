import { useState } from 'react';
import { Send } from 'lucide-react';
import { store, useStore } from '../data/store.js';
import { Avatar, Empty } from './ui.jsx';
import { useToast } from './Toast.jsx';
import { relDate } from '../lib/format.js';

// Notes / comments thread stored on a record's `notes` array.
export default function Notes({ coll, record }) {
  const db = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const notes = record.notes || [];

  const add = () => {
    if (!text.trim()) return;
    const note = { id: 'N' + Date.now(), author: me.name, at: new Date().toISOString(), text: text.trim() };
    store.update(coll, record.id, { notes: [note, ...notes] });
    setText('');
    toast('Notiz hinzugefügt');
  };

  const remove = (id) => store.update(coll, record.id, { notes: notes.filter((n) => n.id !== id) });

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <Avatar name={me.name} color={me.color} size="sm" />
        <div style={{ flex: 1 }}>
          <textarea
            className="input" rows={2} placeholder="Notiz für Vertrieb & Kundendienst hinzufügen…"
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }}
            style={{ resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn primary sm" onClick={add}><Send size={14} /> Notiz speichern</button>
          </div>
        </div>
      </div>

      {notes.length === 0 && <Empty label="Noch keine Notizen" hint="Halten Sie Gespräche, Absprachen und Hinweise fest." />}
      <div>
        {notes.map((n) => (
          <div key={n.id} className="list-row" style={{ alignItems: 'flex-start' }}>
            <Avatar name={n.author} color="#6d4bd8" size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b style={{ fontSize: 13 }}>{n.author}</b>
                <span className="muted tiny">{relDate(n.at)}</span>
                <button className="btn ghost sm" style={{ marginLeft: 'auto', padding: '2px 6px' }} onClick={() => remove(n.id)}>Löschen</button>
              </div>
              <div style={{ fontSize: 13.5, marginTop: 2 }}>{n.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
