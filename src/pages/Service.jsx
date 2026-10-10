import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LifeBuoy, Clock, CheckCircle2, AlertTriangle, Phone, Mail, Globe, BookOpen } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Empty, KpiCard, Drawer, Card, Field, Modal, AccountLink, ContactLink } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { relDate, fmtDate } from '../lib/format.js';

const STATUS_TONE = { Neu: 'blue', 'In Bearbeitung': 'amber', 'Wartet auf Kunde': 'purple', Gelöst: 'green' };
const PRIO_TONE = { Hoch: 'red', Mittel: 'amber', Niedrig: 'gray' };
const CHANNEL_ICON = { Telefon: Phone, 'E-Mail': Mail, Web: Globe };

export default function Service() {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Offen');
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState(null);

  const acct = (id) => db.accounts.find((a) => a.id === id);

  const rows = useMemo(() => {
    let r = [...db.tickets];
    if (status === 'Offen') r = r.filter((t) => t.status !== 'Gelöst');
    else if (status !== 'Alle') r = r.filter((t) => t.status === status);
    if (q) r = r.filter((t) => t.subject.toLowerCase().includes(q.toLowerCase()) || t.number.toLowerCase().includes(q.toLowerCase()));
    return r.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [db.tickets, q, status]);

  const open = db.tickets.filter((t) => t.status !== 'Gelöst').length;
  const inProgress = db.tickets.filter((t) => t.status === 'In Bearbeitung').length;
  const highPrio = db.tickets.filter((t) => t.status !== 'Gelöst' && t.priority === 'Hoch').length;
  const solved = db.tickets.filter((t) => t.status === 'Gelöst').length;

  const setStatusOf = (id, s) => { store.update('tickets', id, { status: s, resolvedAt: s === 'Gelöst' ? new Date().toISOString() : null }); toast('Ticket aktualisiert'); };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Kundendienst</h1><div className="sub">Tickets, Reklamationen & Wissensdatenbank</div></div>
        <div className="page-actions"><button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neues Ticket</button></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={LifeBuoy} tone="brand" label="Offene Tickets" value={open} />
        <KpiCard icon={Clock} tone="amber" label="In Bearbeitung" value={inProgress} />
        <KpiCard icon={AlertTriangle} tone="red" label="Hohe Priorität" value={highPrio} />
        <KpiCard icon={CheckCircle2} tone="green" label="Gelöst" value={solved} />
      </div>

      <div className="grid split">
        <div>
          <div className="filter-bar">
            <div className="search" style={{ background: 'var(--surface)', maxWidth: 260 }}>
              <Search size={16} /><input placeholder="Tickets suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="seg">
              {['Offen', 'In Bearbeitung', 'Gelöst', 'Alle'].map((s) => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}
            </div>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Ticket</th><th>Konto</th><th>Kanal</th><th>Priorität</th><th>Status</th><th>Erstellt</th></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const Ch = CHANNEL_ICON[t.channel] || Globe;
                  return (
                    <tr key={t.id} onClick={() => setSel(t)}>
                      <td><div className="cell-main">{t.subject}</div><div className="cell-sub">{t.number} · {t.category}</div></td>
                      <td><AccountLink account={acct(t.accountId)} /></td>
                      <td><span className="chip" style={{ padding: '3px 8px' }}><Ch size={12} /> {t.channel}</span></td>
                      <td><Badge tone={PRIO_TONE[t.priority]}>{t.priority}</Badge></td>
                      <td><Badge tone={STATUS_TONE[t.status]} dot>{t.status}</Badge></td>
                      <td className="muted tiny nowrap">{relDate(t.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>{rows.length === 0 && <Empty label="Keine Tickets" />}</div>
          </div>
        </div>

        <Card title="Wissensdatenbank" sub="Lösungswissen für das Team" pad={false}
          action={<button className="btn sm ghost"><Plus size={14} /> Artikel</button>}>
          <div style={{ padding: '6px 8px' }}>
            {db.kbArticles.map((a) => (
              <div key={a.id} className="list-row" style={{ padding: '11px 12px' }}>
                <span className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--brand-050)', color: 'var(--brand)' }}><BookOpen size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                  <div className="muted tiny">{a.category} · {a.views} Aufrufe</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {sel && (
        <Drawer title={sel.number} onClose={() => setSel(null)}
          footer={<>
            <button className="btn" onClick={() => { setStatusOf(sel.id, 'Wartet auf Kunde'); setSel(null); }}>Eskalieren</button>
            <button className="btn primary" disabled={sel.status === 'Gelöst'} onClick={() => { setStatusOf(sel.id, 'Gelöst'); setSel(null); }}>Als gelöst markieren</button>
          </>}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{sel.subject}</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Badge tone={STATUS_TONE[sel.status]} dot>{sel.status}</Badge>
            <Badge tone={PRIO_TONE[sel.priority]}>Priorität: {sel.priority}</Badge>
            <Badge tone="gray">{sel.category}</Badge>
          </div>
          <Field label="Status ändern">
            <select className="select" value={sel.status} onChange={(e) => { setStatusOf(sel.id, e.target.value); setSel({ ...sel, status: e.target.value }); }}>
              {['Neu', 'In Bearbeitung', 'Wartet auf Kunde', 'Gelöst'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div style={{ height: 14 }} />
          <dl className="kv">
            <dt>Konto</dt><dd><AccountLink account={acct(sel.accountId)} /></dd>
            <dt>Kontakt</dt><dd>{sel.contactId ? <ContactLink contact={db.contacts.find((c) => c.id === sel.contactId)} /> : '—'}</dd>
            {sel.deviceId && <><dt>Gerät</dt><dd><span className="rec-link" onClick={() => nav('/devices')}>{db.devices.find((d) => d.id === sel.deviceId)?.name || '—'}</span></dd></>}
            <dt>Kanal</dt><dd>{sel.channel}</dd>
            <dt>Betreuer</dt><dd>{db.users.find((u) => u.id === sel.ownerId)?.name}</dd>
            <dt>Erstellt</dt><dd>{fmtDate(sel.createdAt)}</dd>
            <dt>Gelöst</dt><dd>{sel.resolvedAt ? fmtDate(sel.resolvedAt) : '—'}</dd>
          </dl>
        </Drawer>
      )}
      {adding && <NewTicket db={db} onClose={() => setAdding(false)} toast={toast} />}
    </div>
  );
}

function NewTicket({ db, onClose, toast }) {
  const firstContact = (aid) => db.contacts.find((c) => c.accountId === aid)?.id || '';
  const [f, setF] = useState({ accountId: db.accounts[0]?.id, contactId: firstContact(db.accounts[0]?.id), deviceId: '', channel: 'Telefon', priority: 'Mittel', category: 'Technische Anfrage', subject: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setAccount = (v) => setF((p) => ({ ...p, accountId: v, contactId: firstContact(v), deviceId: '' }));
  const accContacts = db.contacts.filter((c) => c.accountId === f.accountId);
  const accDevices = db.devices.filter((d) => d.accountId === f.accountId);
  const save = () => {
    if (!f.subject) return;
    const n = 'TK-' + (4804 + db.tickets.length + 1);
    const acc = db.accounts.find((a) => a.id === f.accountId);
    store.add('tickets', {
      number: n, subject: f.subject, accountId: f.accountId, contactId: f.contactId || null, deviceId: f.deviceId || null,
      ownerId: acc?.innendienstId || db.meta.currentUserId, channel: f.channel, category: f.category,
      priority: f.priority, status: 'Neu', createdAt: new Date().toISOString(), resolvedAt: null,
    });
    toast('Ticket erstellt'); onClose();
  };
  return (
    <Modal title="Neues Ticket" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erstellen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Betreff"><input className="input" onChange={(e) => set('subject', e.target.value)} placeholder="Kurzbeschreibung des Anliegens" autoFocus /></Field></div>
        <Field label="Kunde"><select className="select" value={f.accountId} onChange={(e) => setAccount(e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Ansprechpartner"><select className="select" value={f.contactId} onChange={(e) => set('contactId', e.target.value)}><option value="">— Keiner —</option>{accContacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Betroffenes Gerät"><select className="select" value={f.deviceId} onChange={(e) => set('deviceId', e.target.value)}><option value="">— Kein Gerät —</option>{accDevices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.serial})</option>)}</select></Field>
        <Field label="Kategorie"><select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>{['Technische Anfrage', 'Reklamation', 'Retoure', 'Wartung', 'Rechnungsfrage'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Kanal"><select className="select" value={f.channel} onChange={(e) => set('channel', e.target.value)}>{['Telefon', 'E-Mail', 'Web'].map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Priorität"><select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value)}>{['Mittel', 'Hoch', 'Niedrig'].map((c) => <option key={c}>{c}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
