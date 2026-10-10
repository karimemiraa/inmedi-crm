import { useState, useMemo } from 'react';
import { Plus, Lightbulb, Search, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Empty, KpiCard, Modal, Field } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { relDate } from '../lib/format.js';

const STATUS = ['Neu', 'In Prüfung', 'Umgesetzt', 'Verworfen'];
const STATUS_TONE = { Neu: 'blue', 'In Prüfung': 'amber', Umgesetzt: 'green', Verworfen: 'gray' };
const PRIO_TONE = { Hoch: 'red', Mittel: 'amber', Niedrig: 'gray' };

export default function Ideas() {
  const db = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Alle');
  const [adding, setAdding] = useState(false);

  const user = (id) => db.users.find((u) => u.id === id);
  const rows = useMemo(() => db.ideas.filter((i) =>
    (status === 'Alle' || i.status === status) &&
    (!q || i.title.toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [db.ideas, q, status]);

  const cnt = (s) => db.ideas.filter((i) => i.status === s).length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Ideen</h1><div className="sub">Vorschläge und Verbesserungen sammeln, bewerten und umsetzen</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neue Idee</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Lightbulb} tone="brand" label="Ideen gesamt" value={db.ideas.length} />
        <KpiCard icon={Clock} tone="blue" label="Neu" value={cnt('Neu')} />
        <KpiCard icon={Clock} tone="amber" label="In Prüfung" value={cnt('In Prüfung')} />
        <KpiCard icon={CheckCircle2} tone="green" label="Umgesetzt" value={cnt('Umgesetzt')} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Ideen suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {['Alle', ...STATUS].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Idee</th><th>Priorität</th><th>Status</th><th>Eingereicht von</th><th>Datum</th><th></th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} style={{ cursor: 'default' }}>
                <td><div className="cell-main">{i.title}</div>{i.description && <div className="cell-sub" style={{ maxWidth: 420, whiteSpace: 'normal' }}>{i.description}</div>}</td>
                <td><Badge tone={PRIO_TONE[i.priority]}>{i.priority}</Badge></td>
                <td>
                  <select className="select" style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }} value={i.status} onChange={(e) => { store.update('ideas', i.id, { status: e.target.value }); toast('Status aktualisiert'); }}>
                    {STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td>{user(i.ownerId) && <div className="avatar-row"><Avatar size="sm" name={user(i.ownerId).name} color={user(i.ownerId).color} src={user(i.ownerId).avatar} /><span className="tiny">{user(i.ownerId).name.split(' ')[0]}</span></div>}</td>
                <td className="muted tiny nowrap">{relDate(i.createdAt)}</td>
                <td className="right"><button className="btn ghost sm" onClick={() => { store.remove('ideas', i.id); toast('Idee gelöscht'); }}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Noch keine Ideen" hint="Teilen Sie Vorschläge mit dem Team." />}</div>
      </div>

      {adding && <NewIdea db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewIdea({ db, onClose, toast }) {
  const [f, setF] = useState({ priority: 'Mittel', description: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title) return;
    store.add('ideas', { title: f.title, description: f.description, status: 'Neu', priority: f.priority, ownerId: db.meta.currentUserId, createdAt: new Date().toISOString() });
    toast('Idee eingereicht'); onClose();
  };
  return (
    <Modal title="Neue Idee" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Einreichen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Titel"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="Kurztitel der Idee" autoFocus /></Field></div>
        <Field label="Priorität"><select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['Hoch', 'Mittel', 'Niedrig'].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <div className="full"><Field label="Beschreibung"><textarea className="input" rows={3} onChange={(e) => set('description', e.target.value)} placeholder="Worum geht es? Welchen Nutzen bringt die Idee?" /></Field></div>
      </div>
    </Modal>
  );
}
