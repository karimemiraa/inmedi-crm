import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, UserPlus, ArrowRightLeft, Flame } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Empty, KpiCard, ScoreMeter, Modal, Field, SortTh } from '../components/ui.jsx';
import { useSort } from '../lib/useSort.js';
import { useToast } from '../components/Toast.jsx';
import { relDate } from '../lib/format.js';

const STATUS_TONE = { Neu: 'blue', 'In Bearbeitung': 'amber', Qualifiziert: 'green', 'Nicht qualifiziert': 'gray' };
const AV_COLORS = ['#a81e22', '#0f8f86', '#7a5cf0', '#e0930b', '#2f7ce0', '#10a760', '#d6459b'];

export default function Leads() {
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [adding, setAdding] = useState(false);

  const { sort, toggle, apply } = useSort('score', 'desc');
  const owner = (id) => db.users.find((u) => u.id === id);
  const rows = useMemo(() => {
    const filtered = db.leads.filter((l) =>
      (status === 'All' || l.status === status) &&
      (!q || l.name.toLowerCase().includes(q.toLowerCase()) || l.company.toLowerCase().includes(q.toLowerCase())));
    return apply(filtered, {
      name: (l) => l.name, company: (l) => l.company, source: (l) => l.source, score: (l) => l.score,
      status: (l) => l.status, owner: (l) => owner(l.ownerId)?.name, created: (l) => new Date(l.createdAt).getTime(),
    });
  }, [db.leads, q, status, sort]);
  const hot = db.leads.filter((l) => l.score >= 70).length;

  const convert = (lead) => {
    if (lead.accountId) { toast('Interessent wurde bereits umgewandelt'); return; }
    const acc = store.add('accounts', {
      kundennummer: 'K-' + (10001 + db.accounts.length), name: lead.company, type: 'Praxis',
      tier: 'Interessent', status: 'Interessent', territoryId: db.territories[0].id,
      ownerId: lead.ownerId, innendienstId: (db.users[1] || db.users[0]).id, city: lead.city || '', zip: '', street: '',
      country: 'Deutschland', phone: lead.phone, email: lead.email, website: '', vatId: '',
      paymentTerms: '30 Tage netto', discount: 0, revenueYTD: 0, beds: 0,
      createdAt: new Date().toISOString(), color: lead.color, notes: lead.notes || [],
      customValues: {}, priceList: [], leadId: lead.id,
    });
    store.update('leads', lead.id, { status: 'Qualifiziert', accountId: acc.id });
    toast(`${lead.company} in Konto umgewandelt`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Interessenten</h1><div className="sub">{db.leads.length} eingehende und recherchierte Interessenten mit Bewertung</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neuer Interessent</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={UserPlus} tone="brand" label="Interessenten gesamt" value={db.leads.length} />
        <KpiCard icon={UserPlus} tone="blue" label="Neu" value={db.leads.filter((l) => l.status === 'Neu').length} />
        <KpiCard icon={Flame} tone="red" label="Heiß (Score ≥70)" value={hot} />
        <KpiCard icon={ArrowRightLeft} tone="green" label="Qualifiziert" value={db.leads.filter((l) => l.status === 'Qualifiziert').length} />
      </div>

      <div className="filter-bar">
        <div className="search" style={{ background: 'var(--surface)', maxWidth: 300 }}>
          <Search size={16} /><input placeholder="Interessenten suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="seg">
          {[['All', 'Alle'], ['Neu', 'Neu'], ['In Bearbeitung', 'In Bearbeitung'], ['Qualifiziert', 'Qualifiziert'], ['Nicht qualifiziert', 'Nicht qualifiziert']].map(([v, l]) => <button key={v} className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>)}
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list"><table className="tbl">
          <thead><tr>
            <SortTh label="Name" sortKey="name" sort={sort} onSort={toggle} />
            <SortTh label="Unternehmen" sortKey="company" sort={sort} onSort={toggle} />
            <SortTh label="Quelle" sortKey="source" sort={sort} onSort={toggle} />
            <SortTh label="Score" sortKey="score" sort={sort} onSort={toggle} />
            <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
            <SortTh label="Betreuer" sortKey="owner" sort={sort} onSort={toggle} />
            <SortTh label="Erstellt" sortKey="created" sort={sort} onSort={toggle} />
            <th></th>
          </tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} onClick={() => nav('/leads/' + l.id)}>
                <td><div className="avatar-row"><Avatar size="sm" name={l.name} color={l.color} /><div><div className="cell-main">{l.name}</div><div className="cell-sub">{l.title}</div></div></div></td>
                <td>{l.company}</td>
                <td><Badge tone="gray">{l.source}</Badge></td>
                <td><ScoreMeter value={l.score} /></td>
                <td><Badge tone={STATUS_TONE[l.status]} dot>{l.status}</Badge></td>
                <td>{owner(l.ownerId)?.name.split(' ')[0]}</td>
                <td className="muted tiny">{relDate(l.createdAt)}</td>
                <td className="right"><button className="btn sm" onClick={(e) => { e.stopPropagation(); convert(l); }} disabled={l.status === 'Qualifiziert'}><ArrowRightLeft size={13} /> Umwandeln</button></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <Empty label="Keine passenden Interessenten" action={{ label: 'Neuer Interessent', onClick: () => setAdding(true) }} />}</div>
      </div>
      {adding && <NewLead db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewLead({ db, onClose, toast }) {
  const [f, setF] = useState({ source: 'Website', score: 50, potential: 0, ownerId: db.meta.currentUserId });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name || !f.company) { toast('Name und Unternehmen erforderlich'); return; }
    store.add('leads', {
      name: f.name, company: f.company, title: f.title || '', source: f.source, status: 'Neu',
      score: Number(f.score) || 0, ownerId: f.ownerId, email: f.email || '', phone: f.phone || '',
      city: f.city || '', potential: Number(f.potential) || 0, createdAt: new Date().toISOString(),
      color: AV_COLORS[Math.floor(Math.random() * AV_COLORS.length)], notes: [],
    });
    toast('Interessent erstellt'); onClose();
  };
  return (
    <Modal title="Neuer Interessent" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid">
        <Field label="Ansprechpartner"><input className="input" onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Unternehmen"><input className="input" onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Position"><input className="input" onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Quelle"><select className="select" value={f.source} onChange={(e) => set('source', e.target.value)}>{['Website', 'Messe', 'Empfehlung', 'Kaltakquise', 'E-Mail-Kampagne', 'LinkedIn'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="E-Mail"><input className="input" onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Telefon"><input className="input" onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Score (0–100)"><input className="input" type="number" value={f.score} onChange={(e) => set('score', e.target.value)} /></Field>
        <Field label="Potenzial (€)"><input className="input" type="number" value={f.potential} onChange={(e) => set('potential', e.target.value)} /></Field>
        <Field label="Betreuer"><select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
