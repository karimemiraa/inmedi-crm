import { useState } from 'react';
import { Building2, Users, Target, CalendarCheck } from 'lucide-react';
import { Field, Modal, Select } from './ui.jsx';
import { store, useStore } from '../data/store.js';
import { useToast } from './Toast.jsx';

const TYPES = [
  { key: 'account', label: 'Firma', icon: Building2 },
  { key: 'contact', label: 'Ansprechpartner', icon: Users },
  { key: 'deal', label: 'Deal', icon: Target },
  { key: 'activity', label: 'Aktivität', icon: CalendarCheck },
];

export default function QuickAdd({ onClose, initial = 'account', accountId, actType, lockAccount }) {
  const db = useStore();
  const toast = useToast();
  const [type, setType] = useState(initial);
  const [f, setF] = useState({ accountId: accountId || db.accounts[0]?.id, actType: actType || 'task' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setAccount = (v) => setF((p) => ({ ...p, accountId: v, contactId: '', dealId: '' }));
  const lockedAccount = lockAccount ? db.accounts.find((a) => a.id === accountId) : null;
  const accContacts = db.contacts.filter((c) => c.accountId === f.accountId);
  const accDeals = db.deals.filter((d) => d.accountId === f.accountId);

  const save = () => {
    const me = db.meta.currentUserId;
    if (type === 'account') {
      if (!f.name) return;
      store.add('accounts', {
        kundennummer: 'K-' + (10001 + db.accounts.length), name: f.name, type: f.subtype || 'Praxis',
        tier: 'Interessent', status: 'Interessent',
        territoryId: f.territoryId || db.territories[0].id, ownerId: f.ownerId || me,
        innendienstId: (db.users[1] || db.users[0]).id, city: f.city || '', zip: '', street: '',
        country: 'Deutschland', phone: f.phone || '', email: f.email || '', website: '', vatId: '',
        paymentTerms: '30 Tage netto', discount: 0,
        revenueYTD: 0, beds: 0, createdAt: new Date().toISOString(), color: '#a81e22', comments: [],
      });
      toast('Firma erstellt');
    } else if (type === 'contact') {
      if (!f.name) return;
      store.add('contacts', {
        name: f.name, title: f.title || '', accountId: f.accountId || db.accounts[0].id,
        email: f.email || '', phone: f.phone || '', isPrimary: false,
        lastContact: new Date().toISOString(), color: '#0f8f86',
      });
      toast('Ansprechpartner erstellt');
    } else if (type === 'deal') {
      if (!f.name) return;
      store.add('deals', {
        name: f.name, accountId: f.accountId || db.accounts[0].id, contactId: f.contactId || null, ownerId: f.ownerId || me,
        stage: 'lead', value: Number(f.value) || 0, score: 50, products: [],
        expectedClose: f.expectedClose || new Date().toISOString(), createdAt: new Date().toISOString(),
      });
      toast('Deal zur Pipeline hinzugefügt');
    } else {
      if (!f.subject) return;
      store.add('activities', {
        type: f.actType || 'task', subject: f.subject, accountId: f.accountId || db.accounts[0].id,
        contactId: f.contactId || null, dealId: f.dealId || null,
        ownerId: me, dueDate: f.dueDate || new Date().toISOString(), done: false,
        priority: f.priority || 'Mittel', notes: f.notes || '',
      });
      toast('Aktivität geplant');
    }
    onClose();
  };

  return (
    <Modal
      title="Schnell erfassen"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}
    >
      {!lockAccount && (
        <div className="seg" style={{ marginBottom: 18, width: '100%' }}>
          {TYPES.map((t) => (
            <button key={t.key} className={type === t.key ? 'active' : ''} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setType(t.key)}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      )}
      {lockedAccount && (
        <div className="chip" style={{ marginBottom: 16 }}>Kunde: <b style={{ marginLeft: 4 }}>{lockedAccount.name}</b> · {lockedAccount.kundennummer}</div>
      )}

      <div className="form-grid">
        {type === 'account' && (<>
          <Field label="Firmenname"><input className="input" onChange={(e) => set('name', e.target.value)} placeholder="z. B. Klinik am Fluss" /></Field>
          <Field label="Typ"><Select className="select" onChange={(e) => set('subtype', e.target.value)}><option>Praxis</option><option>Krankenhaus</option><option>Pflegeeinrichtung</option><option>Apotheke</option><option>Großhändler</option></Select></Field>
          <Field label="Stadt"><input className="input" onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Betreuer"><Select className="select" onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Telefon"><input className="input" onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="E-Mail"><input className="input" onChange={(e) => set('email', e.target.value)} /></Field>
        </>)}

        {type === 'contact' && (<>
          <Field label="Voller Name"><input className="input" onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Position"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="z. B. Einkaufsleiter/in" /></Field>
          <div className="full"><Field label="Firma"><Select className="select" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field></div>
          <Field label="E-Mail"><input className="input" onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Telefon"><input className="input" onChange={(e) => set('phone', e.target.value)} /></Field>
        </>)}

        {type === 'deal' && (<>
          <div className="full"><Field label="Deal-Name"><input className="input" onChange={(e) => set('name', e.target.value)} placeholder="z. B. Erneuerung Intensivausstattung" /></Field></div>
          <Field label="Firma"><Select className="select" value={f.accountId} onChange={(e) => setAccount(e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <Field label="Ansprechpartner"><Select className="select" value={f.contactId || ''} onChange={(e) => set('contactId', e.target.value)}><option value="">— Keiner —</option>{accContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Wert (€)"><input className="input" type="number" onChange={(e) => set('value', e.target.value)} /></Field>
          <Field label="Betreuer"><Select className="select" onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Erwarteter Abschluss"><input className="input" type="date" onChange={(e) => set('expectedClose', new Date(e.target.value).toISOString())} /></Field>
        </>)}

        {type === 'activity' && (<>
          <Field label="Typ"><Select className="select" value={f.actType} onChange={(e) => set('actType', e.target.value)}><option value="task">Aufgabe</option><option value="call">Anruf</option><option value="meeting">Termin</option><option value="email">E-Mail</option><option value="followup">Nachfassen</option></Select></Field>
          <Field label="Priorität"><Select className="select" onChange={(e) => set('priority', e.target.value)}><option>Mittel</option><option>Hoch</option><option>Niedrig</option></Select></Field>
          <div className="full"><Field label="Betreff"><input className="input" onChange={(e) => set('subject', e.target.value)} placeholder="z. B. Nachfass-Anruf" /></Field></div>
          {!lockAccount && <Field label="Firma"><Select className="select" value={f.accountId} onChange={(e) => setAccount(e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>}
          <Field label="Ansprechpartner"><Select className="select" value={f.contactId || ''} onChange={(e) => set('contactId', e.target.value)}><option value="">— Keiner —</option>{accContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Zugehöriger Deal"><Select className="select" value={f.dealId || ''} onChange={(e) => set('dealId', e.target.value)}><option value="">— Keiner —</option>{accDeals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Fällig am"><input className="input" type="date" onChange={(e) => set('dueDate', new Date(e.target.value).toISOString())} /></Field>
        </>)}
      </div>
    </Modal>
  );
}
