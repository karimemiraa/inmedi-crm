import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, ArrowRightLeft, Flame } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Avatar, Badge, Card, Empty, Field, Modal, ScoreMeter, Select } from '../components/ui.jsx';
import Notes from '../components/Notes.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtMoney, fmtDate } from '../lib/format.js';

const STATUS_TONE = { Neu: 'blue', 'In Bearbeitung': 'amber', Qualifiziert: 'green', 'Nicht qualifiziert': 'gray' };

export default function LeadDetail() {
  const { id } = useParams();
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const l = db.leads.find((x) => x.id === id);
  if (!l) return <div className="page"><Empty label="Lead nicht gefunden" /></div>;
  const owner = db.users.find((u) => u.id === l.ownerId);

  const account = db.accounts.find((a) => a.id === l.accountId);
  const convert = () => {
    if (l.accountId) { toast('Interessent wurde bereits umgewandelt'); return; }
    const acc = store.add('accounts', {
      kundennummer: 'K-' + (10001 + db.accounts.length), name: l.company, type: 'Praxis',
      tier: 'Interessent', status: 'Interessent', territoryId: db.territories[0].id,
      ownerId: l.ownerId, innendienstId: (db.users[1] || db.users[0]).id, city: l.city || '', zip: '', street: '',
      country: 'Deutschland', phone: l.phone, email: l.email, website: '', vatId: '',
      paymentTerms: '30 Tage netto', discount: 0, revenueYTD: 0, beds: 0,
      createdAt: new Date().toISOString(), color: l.color, notes: l.notes || [],
      customValues: {}, priceList: [], leadId: l.id,
    });
    store.update('leads', l.id, { status: 'Qualifiziert', accountId: acc.id });
    toast(`${l.company} in Konto umgewandelt`);
    nav('/accounts/' + acc.id);
  };

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => nav('/leads')} style={{ marginBottom: 14 }}><ArrowLeft size={15} /> Leads</button>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div className="detail-hero">
            <Avatar name={l.name} color={l.color} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 21 }}>{l.name}</h1>
                <Badge tone={STATUS_TONE[l.status]} dot>{l.status}</Badge>
                {l.score >= 70 && <Badge tone="red"><Flame size={11} /> Heißer Lead</Badge>}
              </div>
              <div className="muted tiny" style={{ marginTop: 6 }}>{l.title} · {l.company}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} /> Bearbeiten</button>
            <button className="btn primary" disabled={l.status === 'Qualifiziert'} onClick={convert}><ArrowRightLeft size={15} /> In Konto umwandeln</button>
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <Card title="Lead-Daten" action={<button className="btn ghost sm" onClick={() => setEditing(true)}><Pencil size={13} /> Bearbeiten</button>}>
          <dl className="kv">
            <dt>Unternehmen</dt><dd>{l.company}</dd>
            <dt>Ansprechpartner</dt><dd>{l.name}</dd>
            <dt>Position</dt><dd>{l.title}</dd>
            <dt>E-Mail</dt><dd>{l.email}</dd>
            <dt>Telefon</dt><dd>{l.phone}</dd>
            <dt>Stadt</dt><dd>{l.city || '—'}</dd>
            <dt>Quelle</dt><dd><Badge tone="gray">{l.source}</Badge></dd>
            <dt>Score</dt><dd><ScoreMeter value={l.score} /></dd>
            <dt>Potenzial</dt><dd><b>{fmtMoney(l.potential || 0)}</b></dd>
            <dt>Betreuer</dt><dd>{owner?.name}</dd>
            {account && <><dt>Umgewandelt in</dt><dd><AccountLink account={account} /></dd></>}
            <dt>Erstellt</dt><dd>{fmtDate(l.createdAt)}</dd>
          </dl>
        </Card>

        <Card title="Notizen & Kommentare" sub="Gesprächsverlauf und Absprachen">
          <Notes coll="leads" record={l} />
        </Card>
      </div>

      {editing && <LeadEdit lead={l} db={db} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast('Interessent gespeichert'); }} />}
    </div>
  );
}

function LeadEdit({ lead, db, onClose, onSaved }) {
  const [f, setF] = useState({ ...lead });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const office = db.users.filter((u) => u.role !== 'Administrator');
  const save = () => {
    store.update('leads', lead.id, {
      name: f.name, company: f.company, title: f.title, email: f.email, phone: f.phone,
      city: f.city, source: f.source, status: f.status, score: Number(f.score) || 0,
      potential: Number(f.potential) || 0, ownerId: f.ownerId,
    });
    onSaved();
  };
  return (
    <Modal title="Lead bearbeiten" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Speichern</button></>}>
      <div className="form-grid">
        <Field label="Ansprechpartner"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Unternehmen"><input className="input" value={f.company} onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Position"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Quelle"><Select className="select" value={f.source} onChange={(e) => set('source', e.target.value)}>{['Website', 'Messe', 'Empfehlung', 'Kaltakquise', 'E-Mail-Kampagne', 'LinkedIn'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="E-Mail"><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Telefon"><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Stadt"><input className="input" value={f.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="Status"><Select className="select" value={f.status} onChange={(e) => set('status', e.target.value)}>{['Neu', 'In Bearbeitung', 'Qualifiziert', 'Nicht qualifiziert'].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Score (0–100)"><input className="input" type="number" value={f.score} onChange={(e) => set('score', e.target.value)} /></Field>
        <Field label="Potenzial €"><input className="input" type="number" value={f.potential || 0} onChange={(e) => set('potential', e.target.value)} /></Field>
        <Field label="Betreuer"><Select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{office.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
      </div>
    </Modal>
  );
}
