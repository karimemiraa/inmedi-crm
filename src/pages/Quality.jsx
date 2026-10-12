import { useState } from 'react';
import { Plus, AlertOctagon, Siren, ClipboardCheck, ShieldAlert, FileWarning } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Badge, Card, Drawer, Empty, Field, KpiCard, Modal, Select, StatusConfigLink } from '../components/ui.jsx';
import { useOpenParam } from '../lib/nav.js';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, relDate } from '../lib/format.js';
import { statusList, statusTone, isOpen, setStatus } from '../lib/status.js';

const INC_TYPES = ['Vorkommnis', 'Beinahe-Vorkommnis', 'Produktmangel', 'Rückruf (FSCA)'];
const SEV = ['Niedrig', 'Mittel', 'Hoch', 'Schwerwiegend'];
const SEV_TONE = { Niedrig: 'gray', Mittel: 'blue', Hoch: 'amber', Schwerwiegend: 'red' };
// Spätester Meldezeitpunkt für schwerwiegende Vorkommnisse (MDR Art. 87: max. 15 Tage).
const deadline = (i) => new Date(new Date(i.reportedAt).getTime() + 15 * 86400000).toISOString();

export default function Quality() {
  const db = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('incidents');
  const [sel, setSel] = useState(null);
  const [capaSel, setCapaSel] = useState(null);
  const [adding, setAdding] = useState(null); // 'incident' | 'capa'
  useOpenParam(db.incidents, (rec) => { setTab('incidents'); setSel(rec); });

  const acct = (id) => db.accounts.find((a) => a.id === id);
  const prod = (id) => db.products.find((p) => p.id === id);
  const user = (id) => db.users.find((u) => u.id === id);

  const openInc = db.incidents.filter((i) => isOpen(db, 'incidents', i.status)).length;
  const reportable = db.incidents.filter((i) => i.meldepflichtig && isOpen(db, 'incidents', i.status)).length;
  const overdueReport = db.incidents.filter((i) => i.meldepflichtig && isOpen(db, 'incidents', i.status) && new Date(deadline(i)) < new Date()).length;
  const openCapa = db.capas.filter((c) => isOpen(db, 'capas', c.status)).length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>QM & Vigilanz</h1><div className="sub">Vorkommnisse (MDR/MPDG), Meldungen und Korrektur-/Vorbeugemaßnahmen (CAPA)</div></div>
        <div className="page-actions">
          <StatusConfigLink kind={tab === 'capa' ? 'capas' : 'incidents'} />{tab === 'incidents'
            ? <button className="btn primary" onClick={() => setAdding('incident')}><Plus size={16} /> Vorkommnis erfassen</button>
            : <button className="btn primary" onClick={() => setAdding('capa')}><Plus size={16} /> Maßnahme anlegen</button>}
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={AlertOctagon} tone="brand" label="Offene Vorkommnisse" value={openInc} />
        <KpiCard icon={Siren} tone="red" label="Meldepflichtig (offen)" value={reportable} />
        <KpiCard icon={FileWarning} tone="amber" label="Meldefrist überschritten" value={overdueReport} />
        <KpiCard icon={ClipboardCheck} tone="teal" label="Offene CAPA" value={openCapa} />
      </div>

      {reportable > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--red-bg)', background: 'var(--red-bg)' }}>
          <div className="stat-line" style={{ color: 'var(--red)', fontWeight: 700 }}><ShieldAlert size={18} /> {reportable} meldepflichtige(s) Vorkommnis(se) — Meldefristen nach MDR/MPDG beachten (an BfArM &amp; Hersteller).</div>
        </div>
      )}

      <div className="tabs">
        <button className={tab === 'incidents' ? 'active' : ''} onClick={() => setTab('incidents')}>Vorkommnisse ({db.incidents.length})</button>
        <button className={tab === 'capa' ? 'active' : ''} onClick={() => setTab('capa')}>CAPA / Maßnahmen ({db.capas.length})</button>
      </div>

      {tab === 'incidents' && (
        <Card pad={false}><div className="table-wrap list"><table className="tbl">
          <thead><tr><th>Nr.</th><th>Vorkommnis</th><th>Typ</th><th>Produkt / Kunde</th><th>Schweregrad</th><th>Meldepflichtig</th><th>Status</th><th>Meldefrist</th></tr></thead>
          <tbody>
            {db.incidents.map((i) => (
              <tr key={i.id} onClick={() => setSel(i)}>
                <td className="cell-main nowrap">{i.number}</td>
                <td style={{ maxWidth: 260 }}>{i.title}</td>
                <td><Badge tone="gray">{i.type}</Badge></td>
                <td><div className="cell-main" style={{ fontWeight: 500 }}>{prod(i.productId)?.name || '—'}</div><div className="cell-sub">{acct(i.accountId)?.name}</div></td>
                <td><Badge tone={SEV_TONE[i.severity]} dot>{i.severity}</Badge></td>
                <td>{i.meldepflichtig ? <Badge tone="red" dot>Ja</Badge> : <Badge tone="gray">Nein</Badge>}</td>
                <td><Badge tone={statusTone(db, 'incidents', i.status)} dot>{i.status}</Badge></td>
                <td className="tiny nowrap">{i.meldepflichtig && isOpen(db, 'incidents', i.status)
                  ? <Badge tone={new Date(deadline(i)) < new Date() ? 'red' : 'amber'} dot>{relDate(deadline(i))}</Badge>
                  : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>{db.incidents.length === 0 && <Empty label="Keine Vorkommnisse erfasst" />}</div></Card>
      )}

      {tab === 'capa' && (
        <Card pad={false}><div className="table-wrap list"><table className="tbl">
          <thead><tr><th>Nr.</th><th>Maßnahme</th><th>Typ</th><th>Vorkommnis</th><th>Verantwortlich</th><th>Fällig</th><th>Status</th></tr></thead>
          <tbody>
            {db.capas.map((c) => {
              const overdue = isOpen(db, 'capas', c.status) && new Date(c.dueDate) < new Date();
              return (
                <tr key={c.id} onClick={() => setCapaSel(c)}>
                  <td className="cell-main nowrap">{c.number}</td>
                  <td style={{ maxWidth: 280 }}>{c.title}</td>
                  <td><Badge tone={c.type === 'Korrektur' ? 'amber' : 'teal'}>{c.type}</Badge></td>
                  <td className="muted">{db.incidents.find((i) => i.id === c.incidentId)?.number || '—'}</td>
                  <td>{user(c.ownerId)?.name.split(' ')[0]}</td>
                  <td><Badge tone={overdue ? 'red' : 'gray'} dot={overdue}>{relDate(c.dueDate)}</Badge></td>
                  <td><Badge tone={statusTone(db, 'capas', c.status)} dot>{c.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>{db.capas.length === 0 && <Empty label="Keine Maßnahmen" />}</div></Card>
      )}

      {sel && (
        <Drawer title={sel.number} onClose={() => setSel(null)}
          footer={<>
            <button className="btn" onClick={() => { store.update('incidents', sel.id, { meldepflichtig: !sel.meldepflichtig }); toast('Meldepflicht aktualisiert'); setSel({ ...sel, meldepflichtig: !sel.meldepflichtig }); }}>Meldepflicht umschalten</button>
            <button className="btn primary" onClick={() => setSel(null)}>Schließen</button>
          </>}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{sel.title}</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <Badge tone={SEV_TONE[sel.severity]} dot>{sel.severity}</Badge>
            <Badge tone="gray">{sel.type}</Badge>
            {sel.meldepflichtig && <Badge tone="red" dot>Meldepflichtig</Badge>}
          </div>
          <p style={{ fontSize: 13.5, marginBottom: 16 }}>{sel.description}</p>
          <Field label="Status">
            <Select className="select" value={sel.status} onChange={(e) => { setStatus('incidents', sel.id, e.target.value); toast('Status aktualisiert'); setSel({ ...sel, status: e.target.value }); }}>
              {statusList(db, 'incidents').map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </Select>
          </Field>
          <div style={{ height: 14 }} />
          <dl className="kv">
            <dt>Produkt</dt><dd>{prod(sel.productId)?.name || '—'}</dd>
            <dt>Charge / LOT</dt><dd>{sel.lot || '—'}</dd>
            <dt>Seriennr.</dt><dd>{sel.serial || '—'}</dd>
            {sel.meldepflichtig && <><dt>Meldefrist</dt><dd>{fmtDate(deadline(sel))} (spätestens, MDR Art. 87)</dd></>}
            <dt>Kunde</dt><dd><AccountLink account={acct(sel.accountId)} /></dd>
            <dt>Erfasst von</dt><dd>{user(sel.reportedBy)?.name}</dd>
            <dt>Erfasst am</dt><dd>{fmtDate(sel.reportedAt)}</dd>
            <dt>CAPA</dt><dd>{db.capas.filter((c) => c.incidentId === sel.id || c.id === sel.capaId).map((c) => c.number).join(', ') || '—'}</dd>
          </dl>
        </Drawer>
      )}

      {capaSel && (
        <Drawer title={capaSel.number} onClose={() => setCapaSel(null)}
          footer={<button className="btn primary" onClick={() => setCapaSel(null)}>Schließen</button>}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>{capaSel.title}</h3>
          <Badge tone={capaSel.type === 'Korrektur' ? 'amber' : 'teal'}>{capaSel.type}maßnahme</Badge>
          <p style={{ fontSize: 13.5, margin: '16px 0' }}>{capaSel.description}</p>
          <Field label="Status">
            <Select className="select" value={capaSel.status} onChange={(e) => { setStatus('capas', capaSel.id, e.target.value); toast('Maßnahme aktualisiert'); setCapaSel({ ...capaSel, status: e.target.value }); }}>
              {statusList(db, 'capas').map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </Select>
          </Field>
          <div style={{ height: 14 }} />
          <dl className="kv">
            <dt>Bezug Vorkommnis</dt><dd>{db.incidents.find((i) => i.id === capaSel.incidentId)?.number || '—'}</dd>
            <dt>Verantwortlich</dt><dd>{user(capaSel.ownerId)?.name}</dd>
            <dt>Fällig</dt><dd>{fmtDate(capaSel.dueDate)}</dd>
            <dt>Erstellt</dt><dd>{fmtDate(capaSel.createdAt)}</dd>
          </dl>
        </Drawer>
      )}

      {adding === 'incident' && <AddIncident db={db} onClose={() => setAdding(null)} toast={toast} />}
      {adding === 'capa' && <AddCapa db={db} onClose={() => setAdding(null)} toast={toast} />}
    </div>
  );
}

function AddIncident({ db, onClose, toast }) {
  const [f, setF] = useState({ type: 'Vorkommnis', severity: 'Mittel', accountId: db.accounts[0]?.id, meldepflichtig: false, description: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title) return;
    const n = 'VK-2026-' + String(16 + db.incidents.length).padStart(3, '0');
    store.add('incidents', {
      number: n, title: f.title, type: f.type, severity: f.severity, productId: f.productId || null, lot: f.lot || '', serial: f.serial || '',
      accountId: f.accountId, status: '', reportedBy: db.meta.currentUserId, reportedAt: new Date().toISOString(),
      meldepflichtig: f.meldepflichtig || f.severity === 'Schwerwiegend', description: f.description, capaId: null,
    });
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Vorkommnis erfasst', entity: n, detail: f.title });
    toast('Vorkommnis erfasst'); onClose();
  };
  return (
    <Modal title="Vorkommnis erfassen" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Erfassen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Titel"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="Kurzbeschreibung des Vorkommnisses" autoFocus /></Field></div>
        <Field label="Typ"><Select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{INC_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Schweregrad"><Select className="select" value={f.severity} onChange={(e) => set('severity', e.target.value)}>{SEV.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Kunde"><Select className="select" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        <Field label="Produkt"><Select className="select" value={f.productId || ''} onChange={(e) => set('productId', e.target.value)}><option value="">— Ohne Produkt —</option>{db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Charge / LOT"><input className="input" onChange={(e) => set('lot', e.target.value)} placeholder="z. B. LOT 24-0815" /></Field>
        <Field label="Seriennummer"><input className="input" onChange={(e) => set('serial', e.target.value)} placeholder="falls vorhanden" /></Field>
        <div className="full"><label className="check" style={{ marginTop: 4 }}><input type="checkbox" checked={f.meldepflichtig} onChange={(e) => set('meldepflichtig', e.target.checked)} /> Meldepflichtig (an BfArM &amp; Hersteller)</label></div>
        <div className="full"><Field label="Beschreibung"><textarea className="input" rows={3} onChange={(e) => set('description', e.target.value)} placeholder="Was ist passiert? Auswirkung? Sofortmaßnahmen?" /></Field></div>
      </div>
    </Modal>
  );
}

function AddCapa({ db, onClose, toast }) {
  const [f, setF] = useState({ type: 'Korrektur', incidentId: db.incidents[0]?.id || '', ownerId: db.meta.currentUserId, dueDate: new Date().toISOString().slice(0,10), description: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.title) return;
    const n = 'CAPA-2026-' + String(10 + db.capas.length).padStart(3, '0');
    store.add('capas', {
      number: n, type: f.type, title: f.title, incidentId: f.incidentId || null, ownerId: f.ownerId,
      status: '', dueDate: new Date(f.dueDate).toISOString(), createdAt: new Date().toISOString(), description: f.description,
    });
    toast('Maßnahme angelegt'); onClose();
  };
  return (
    <Modal title="CAPA / Maßnahme anlegen" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Anlegen</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Titel"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="Was ist zu tun?" autoFocus /></Field></div>
        <Field label="Typ"><Select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{['Korrektur', 'Vorbeugung'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Bezug Vorkommnis"><Select className="select" value={f.incidentId} onChange={(e) => set('incidentId', e.target.value)}><option value="">— Ohne —</option>{db.incidents.map((i) => <option key={i.id} value={i.id}>{i.number}</option>)}</Select></Field>
        <Field label="Verantwortlich"><Select className="select" value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Fällig am"><input className="input" type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
        <div className="full"><Field label="Beschreibung"><textarea className="input" rows={3} onChange={(e) => set('description', e.target.value)} /></Field></div>
      </div>
    </Modal>
  );
}
