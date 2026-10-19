import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, SlidersHorizontal, Users, Palette, Database, Plus, Trash2, Cloud, ListChecks, Sparkles, MailCheck, FileSpreadsheet } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { adminResetUser } from '../data/auth.js';
import { OBJECTS, EVENTS, OPERATORS, ACTIONS, ruleSummary, fieldsForObject } from '../lib/automation.js';
import { Avatar, Badge, Card, Field, Modal, Select, UserLink } from '../components/ui.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { useToast } from '../components/Toast.jsx';
import StatusSettings from '../components/StatusSettings.jsx';
import Trash from '../components/Trash.jsx';
import AiSettings from '../components/ai/AiSettings.jsx';
import IntakeSettings from '../components/IntakeSettings.jsx';
import Microsoft365Status from '../components/Microsoft365Status.jsx';
import { exportCsv } from '../lib/csv.js';
import { INVOICE_COLUMNS, POSITION_COLUMNS, positionRows } from '../lib/intake.js';

const TABS = [
  ['status', 'Vorgänge & Status', ListChecks],
  ['ai', 'KI-Assistent', Sparkles],
  ['intake', 'Rechnungseingang', MailCheck],
  ['automation', 'Automatisierung', Zap],
  ['fields', 'Benutzerdefinierte Felder', SlidersHorizontal],
  ['users', 'Benutzer & Rollen', Users],
  ['integrations', 'Integrationen', Cloud],
  ['branding', 'Branding', Palette],
  ['data', 'Daten & Papierkorb', Database],
];
const AV_COLORS = ['#a81e22', '#0f8f86', '#7a5cf0', '#e0930b', '#2f7ce0', '#10a760', '#d6459b'];

export default function Settings() {
  const db = useStore();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'status');
  const [modal, setModal] = useState(null); // 'field' | 'rule' | 'user'
  const [editRule, setEditRule] = useState(null);

  const exportAll = () => {
    try {
      const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `inmedi-crm-daten-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Alle Daten exportiert (JSON)');
    } catch (e) { toast('Export fehlgeschlagen'); }
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1>Einstellungen</h1><div className="sub">InMedi CRM für Ihr Team konfigurieren</div></div></div>

      <div className="grid menu-split">
        <div className="card smenu" style={{ padding: 8 }}>
          {TABS.map(([k, label, Icon]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>

        <div>
          {tab === 'ai' && <AiSettings toast={toast} />}
          {tab === 'intake' && <IntakeSettings toast={toast} />}
          {tab === 'status' && <StatusSettings db={db} toast={toast} initialKind={params.get('kind')} />}

          {tab === 'automation' && (
            <Card title="Automatisierungsregeln" sub="WENN ein Objekt bestimmte Bedingungen erfüllt, DANN führe Aktionen aus — wird bei Änderungen automatisch ausgeführt." pad={false}
              action={<button className="btn sm primary" onClick={() => { setEditRule(null); setModal('rule'); }}><Plus size={14} /> Neue Regel</button>}>
              <div style={{ padding: 8 }}>
                {db.automations.map((r) => {
                  const s = ruleSummary(r);
                  return (
                    <div key={r.id} className="list-row" style={{ alignItems: 'flex-start', padding: '14px 12px' }}>
                      <label className="check" onClick={(e) => e.stopPropagation()} style={{ marginTop: 2 }}>
                        <input type="checkbox" checked={r.active} onChange={() => { store.update('automations', r.id, { active: !r.active }); toast(r.active ? 'Regel deaktiviert' : 'Regel aktiviert'); }} />
                      </label>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{r.name} <Badge tone={r.active ? 'green' : 'gray'}>{r.active ? 'Aktiv' : 'Aus'}</Badge></div>
                        <div className="tiny" style={{ marginTop: 4, lineHeight: 1.6 }}>
                          <span className="badge blue" style={{ marginRight: 6 }}>WENN</span><span className="muted">{s.wenn}</span><br />
                          <span className="badge teal" style={{ marginRight: 6 }}>DANN</span><span className="muted">{s.dann}</span>
                        </div>
                      </div>
                      <button className="btn ghost sm" onClick={() => { setEditRule(r); setModal('rule'); }}>Bearbeiten</button>
                      <button className="btn ghost sm" onClick={() => { store.remove('automations', r.id); toast('Regel gelöscht'); }}><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {db.automations.length === 0 && <div className="empty">Noch keine Regeln. Mit „Neue Regel" die erste anlegen.</div>}
              </div>
            </Card>
          )}

          {tab === 'fields' && (
            <Card title="Benutzerdefinierte Felder" sub="Zusätzliche Felder für Ihre Datensätze" pad={false}
              action={<button className="btn sm primary" onClick={() => setModal('field')}><Plus size={14} /> Feld hinzufügen</button>}>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Bezeichnung</th><th>Objekt</th><th>Typ</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {db.customFields.map((f) => (
                    <tr key={f.id} style={{ cursor: 'default' }}>
                      <td className="cell-main">{f.label}</td>
                      <td><Badge tone="blue">{f.entity}</Badge></td>
                      <td>{f.type}</td>
                      <td>
                        <label className="check" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={f.active} onChange={() => store.update('customFields', f.id, { active: !f.active })} />
                          <Badge tone={f.active ? 'green' : 'gray'} dot>{f.active ? 'Aktiv' : 'Aus'}</Badge>
                        </label>
                      </td>
                      <td className="right"><button className="btn ghost sm" onClick={() => { store.remove('customFields', f.id); toast('Feld gelöscht'); }}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>{db.customFields.length === 0 && <div className="empty">Noch keine Felder — legen Sie mit „Feld hinzufügen" das erste an.</div>}</div>
            </Card>
          )}

          {tab === 'users' && (
            <Card title="Benutzer & Rollen" sub="Zugriffsrechte im Team" pad={false}
              action={<button className="btn sm primary" onClick={() => setModal('user')}><Plus size={14} /> Benutzer einladen</button>}>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>Benutzer</th><th>Rolle</th><th>Gebiet</th><th>2FA</th><th>Status</th><th className="right">Aktionen</th></tr></thead>
                <tbody>
                  {db.users.map((u) => (
                    <tr key={u.id} style={{ cursor: 'default' }}>
                      <td><div className="avatar-row"><Avatar size="sm" name={u.name} color={u.color} src={u.avatar} /><div><div className="cell-main"><UserLink user={u} /></div><div className="cell-sub">{u.title}</div></div></div></td>
                      <td><Badge tone={u.role === 'Administrator' ? 'purple' : u.role === 'Manager' ? 'blue' : 'gray'}>{u.role}</Badge></td>
                      <td>{db.territories.find((t) => t.id === u.territoryId)?.name || '—'}</td>
                      <td><Badge tone={u.twoFactor ? 'green' : 'gray'} dot>{u.twoFactor ? 'Aktiv' : 'Aus'}</Badge></td>
                      <td>{u.locked ? <Badge tone="red" dot>Gesperrt</Badge> : <Badge tone="green" dot>Aktiv</Badge>}</td>
                      <td className="right nowrap">
                        {u.locked && <button className="btn sm" onClick={() => { adminResetUser(u.id); toast('Benutzer entsperrt'); }}>Entsperren</button>}
                        {u.role !== 'Administrator' && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => { store.remove('users', u.id); toast('Benutzer entfernt'); }}><Trash2 size={13} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Card>
          )}

          {tab === 'integrations' && <Microsoft365Status />}

          {tab === 'branding' && <Branding toast={toast} db={db} />}

          {tab === 'data' && (
            <Card title="Daten" sub="Daten liegen in Ihrem Browser (localStorage)">
              <p className="muted" style={{ marginBottom: 16 }}>InMedi CRM wird mit realistischen Demodaten ausgeliefert, damit Sie jede Funktion ausprobieren können. Sie können den Demodatensatz jederzeit wiederherstellen oder vollständig leeren, um „von 0" zu starten. Im Produktivbetrieb würde hier eine echte API/Datenbank angebunden.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn" onClick={exportAll}>Alle Daten exportieren (JSON)</button>
                <button className="btn" onClick={() => { exportCsv(`rechnungen-${new Date().toISOString().slice(0, 10)}.csv`, INVOICE_COLUMNS(db), db.incomingInvoices); toast('Rechnungen exportiert (CSV)'); }}><FileSpreadsheet size={14} /> Rechnungen (CSV/Excel)</button>
                <button className="btn" onClick={() => { exportCsv(`rechnungspositionen-${new Date().toISOString().slice(0, 10)}.csv`, POSITION_COLUMNS(db), positionRows(db.incomingInvoices)); toast('Positionen exportiert (CSV)'); }}><FileSpreadsheet size={14} /> Rechnungspositionen (CSV/Excel)</button>
                <button className="btn" onClick={() => { if (confirm('Demodatensatz wiederherstellen? Vorhandene Änderungen gehen verloren.')) { store.reset(); toast('Demodaten wiederhergestellt'); } }}><Trash2 size={14} /> Demodaten wiederherstellen</button>
                <button className="btn danger" onClick={() => { if (confirm('Alle Daten löschen und leer starten? Dies kann nicht rückgängig gemacht werden.')) { store.reset({ empty: true }); toast('Alle Daten gelöscht'); } }}><Trash2 size={14} /> Alle Daten löschen</button>
              </div>
            </Card>
          )}
          {tab === 'data' && <div style={{ marginTop: 16 }}><Trash db={db} toast={toast} /></div>}
        </div>
      </div>

      {modal === 'field' && <FieldModal onClose={() => setModal(null)} toast={toast} />}
      {modal === 'rule' && <RuleBuilder db={db} rule={editRule} onClose={() => setModal(null)} toast={toast} />}
      {modal === 'user' && <UserModal db={db} onClose={() => setModal(null)} toast={toast} />}
    </div>
  );
}

function FieldModal({ onClose, toast }) {
  const [f, setF] = useState({ entity: 'Konto', type: 'Text', options: '', active: true });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.label) return;
    const options = f.type === 'Auswahl' ? f.options.split(',').map((o) => o.trim()).filter(Boolean) : [];
    if (f.type === 'Auswahl' && options.length === 0) { toast('Bitte Auswahlwerte angeben'); return; }
    store.add('customFields', { label: f.label, entity: f.entity, type: f.type, options, active: true });
    toast('Feld hinzugefügt'); onClose();
  };
  return (
    <Modal title="Zusatzfeld hinzufügen" wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Speichern</button></>}>
      <div className="form-grid">
        <div className="full"><Field label="Bezeichnung"><input className="input" onChange={(e) => set('label', e.target.value)} placeholder="z. B. Einkaufsverbund" autoFocus /></Field></div>
        <Field label="Objekt"><Select className="select" value={f.entity} onChange={(e) => set('entity', e.target.value)}>{['Firma', 'Ansprechpartner', 'Deal', 'Interessent', 'Vorgang', 'Vertrag'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Feldtyp"><Select className="select" value={f.type} onChange={(e) => set('type', e.target.value)}>{['Text', 'Zahl', 'Datum', 'Auswahl', 'Kontrollkästchen'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        {f.type === 'Auswahl' && <div className="full"><Field label="Auswahlwerte (durch Komma getrennt)"><input className="input" onChange={(e) => set('options', e.target.value)} placeholder="z. B. Bronze, Silber, Gold" /></Field></div>}
      </div>
    </Modal>
  );
}

function RuleBuilder({ db, rule, onClose, toast }) {
  const [name, setName] = useState(rule?.name || '');
  const [object, setObject] = useState(rule?.trigger?.object || 'Deal');
  const [event, setEvent] = useState(rule?.trigger?.event || 'any');
  const [match, setMatch] = useState(rule?.match || 'all');
  const [conds, setConds] = useState(rule?.conditions?.length ? rule.conditions : [{ field: '', op: 'eq', value: '' }]);
  const [acts, setActs] = useState(rule?.actions?.length ? rule.actions : [{ type: 'notify', params: {} }]);

  const fields = fieldsForObject(db, object);
  const fieldDef = (key) => fields.find((f) => f.key === key);

  const setCond = (i, patch) => setConds(conds.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const setAct = (i, patch) => setActs(acts.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const setActParam = (i, key, val) => setActs(acts.map((a, k) => (k === i ? { ...a, params: { ...a.params, [key]: val } } : a)));

  const save = () => {
    if (!name) { toast('Bitte einen Regelnamen angeben'); return; }
    const payload = {
      name, active: rule ? rule.active : true,
      trigger: { object, event }, match,
      conditions: conds.filter((c) => c.field),
      actions: acts.filter((a) => a.type),
    };
    if (rule) store.update('automations', rule.id, payload);
    else store.add('automations', payload);
    toast(rule ? 'Regel gespeichert' : 'Regel erstellt'); onClose();
  };

  const ValueInput = ({ fdef, value, onChange }) => {
    if (fdef?.type === 'enum') return <Select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">— Wert —</option>{fdef.options.map((o) => <option key={o} value={o}>{fdef.optionLabels?.[o] || o}</option>)}</Select>;
    if (fdef?.type === 'bool') return <Select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)}><option value="">— Wert —</option><option value="true">Ja</option><option value="false">Nein</option></Select>;
    return <input className="input" type={fdef?.type === 'number' ? 'number' : 'text'} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Wert" />;
  };

  return (
    <Modal title={rule ? 'Regel bearbeiten' : 'Neue Automatisierungsregel'} wide onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Speichern</button></>}>
      <Field label="Regelname"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Warnung bei Großauftrag" autoFocus /></Field>

      <div style={{ marginTop: 18 }}>
        <div className="stat-line" style={{ marginBottom: 8 }}><span className="badge blue">WENN</span> <span className="muted tiny">Auslöser & Bedingungen</span></div>
        <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Objekt"><Select className="select" value={object} onChange={(e) => { setObject(e.target.value); setConds([{ field: '', op: 'eq', value: '' }]); }}>{Object.keys(OBJECTS).map((o) => <option key={o}>{o}</option>)}</Select></Field>
            <Field label="Ereignis"><Select className="select" value={event} onChange={(e) => setEvent(e.target.value)}>{EVENTS.map((ev) => <option key={ev[0]} value={ev[0]}>{ev[1]}</option>)}</Select></Field>
            <Field label="Verknüpfung"><Select className="select" value={match} onChange={(e) => setMatch(e.target.value)}><option value="all">ALLE Bedingungen (UND)</option><option value="any">EINE Bedingung (ODER)</option></Select></Field>
          </div>
          <hr className="hr" />
          {conds.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select className="select" style={{ flex: 2, minWidth: 150 }} value={c.field} onChange={(e) => setCond(i, { field: e.target.value, value: '' })}>
                <option value="">— Feld wählen —</option>{fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </Select>
              <Select className="select" style={{ width: 150 }} value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>{OPERATORS.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</Select>
              <div style={{ flex: 1, minWidth: 120 }}><ValueInput fdef={fieldDef(c.field)} value={c.value} onChange={(v) => setCond(i, { value: v })} /></div>
              <button className="btn ghost sm" onClick={() => setConds(conds.filter((_, k) => k !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn sm" onClick={() => setConds([...conds, { field: '', op: 'eq', value: '' }])}><Plus size={13} /> Bedingung</button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="stat-line" style={{ marginBottom: 8 }}><span className="badge teal">DANN</span> <span className="muted tiny">Aktionen (eine oder mehrere)</span></div>
        <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
          {acts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Select className="select" style={{ width: 190 }} value={a.type} onChange={(e) => setAct(i, { type: e.target.value, params: {} })}>{Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
              <div style={{ flex: 1, minWidth: 180, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ACTIONS[a.type]?.params.map((p) => (
                  <div key={p.key} style={{ flex: 1, minWidth: 130 }}>
                    {p.type === 'enum' ? <Select className="select" value={a.params?.[p.key] || ''} onChange={(e) => setActParam(i, p.key, e.target.value)}><option value="">{p.label}</option>{p.options.map((o) => <option key={o}>{o}</option>)}</Select>
                      : p.type === 'objectField' ? <Select className="select" value={a.params?.[p.key] || ''} onChange={(e) => setActParam(i, p.key, e.target.value)}><option value="">{p.label}</option>{fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</Select>
                      : <input className="input" value={a.params?.[p.key] || ''} onChange={(e) => setActParam(i, p.key, e.target.value)} placeholder={p.placeholder || p.label} />}
                  </div>
                ))}
              </div>
              <button className="btn ghost sm" onClick={() => setActs(acts.filter((_, k) => k !== i))}><Trash2 size={13} /></button>
            </div>
          ))}
          <button className="btn sm" onClick={() => setActs([...acts, { type: 'notify', params: {} }])}><Plus size={13} /> Aktion</button>
        </div>
      </div>
    </Modal>
  );
}

function UserModal({ db, onClose, toast }) {
  const [f, setF] = useState({ role: 'Vertrieb' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    if (!f.name) return;
    store.add('users', {
      name: f.name, title: f.title || 'Vertrieb', role: f.role,
      territoryId: f.territoryId || null, email: f.email || '',
      color: AV_COLORS[Math.floor(Math.random() * AV_COLORS.length)], quota: 400000,
    });
    toast('Benutzer eingeladen'); onClose();
  };
  return (
    <Modal title="Benutzer einladen" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Einladen</button></>}>
      <div className="form-grid">
        <Field label="Name"><input className="input" onChange={(e) => set('name', e.target.value)} placeholder="Vor- und Nachname" autoFocus /></Field>
        <Field label="Position"><input className="input" onChange={(e) => set('title', e.target.value)} placeholder="z. B. Account Manager" /></Field>
        <Field label="Rolle"><Select className="select" onChange={(e) => set('role', e.target.value)}>{['Vertrieb', 'Manager', 'Administrator'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Gebiet"><Select className="select" onChange={(e) => set('territoryId', e.target.value)}><option value="">— Keins —</option>{db.territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <div className="full"><Field label="E-Mail"><input className="input" onChange={(e) => set('email', e.target.value)} placeholder="name@inmedi.de" /></Field></div>
      </div>
    </Modal>
  );
}

function Branding({ toast, db }) {
  const [brand, setBrand] = useState('#a81e22');
  const [accent, setAccent] = useState('#0f8f86');
  const fileRef = useRef();
  const logo = db.meta?.logo;
  const apply = (which, v) => {
    if (which === 'brand') { setBrand(v); document.documentElement.style.setProperty('--brand', v); }
    else { setAccent(v); document.documentElement.style.setProperty('--brand-2', v); }
  };
  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { toast('Datei zu groß (max. 1,5 MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => { store.set((s) => ({ ...s, meta: { ...s.meta, logo: reader.result } })); toast('Logo hochgeladen'); };
    reader.readAsDataURL(file);
  };
  return (
    <Card title="Branding" sub="Machen Sie es zu Ihrem — Logo & Farben einsetzen">
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 92, height: 72, padding: '0 14px', borderRadius: 16, background: logo ? '#0d1b2e' : 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' }}>
          {logo ? <img src={logo} alt="Logo" style={{ maxHeight: 50, maxWidth: 150, objectFit: 'contain' }} /> : <LogoMark size={44} />}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>Firmenlogo</div>
          <div className="muted tiny" style={{ maxWidth: 400 }}>PNG, SVG oder JPG (max. 1,5 MB). Erscheint sofort in der Seitenleiste und auf dem Login.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn sm primary" onClick={() => fileRef.current?.click()}>Logo hochladen</button>
            {logo && <button className="btn sm ghost" onClick={() => { store.set((s) => ({ ...s, meta: { ...s.meta, logo: null } })); toast('Logo entfernt'); }}><Trash2 size={13} /> Zurücksetzen</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
        </div>
      </div>
      <h4 style={{ marginBottom: 10 }}>Markenfarben — Live-Vorschau</h4>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div className="field" style={{ width: 200 }}>
          <label>Primärfarbe</label>
          <div className="stat-line" style={{ gap: 10 }}>
            <input type="color" value={brand} onChange={(e) => apply('brand', e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
            <input className="input" value={brand} onChange={(e) => apply('brand', e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ width: 200 }}>
          <label>Akzentfarbe</label>
          <div className="stat-line" style={{ gap: 10 }}>
            <input type="color" value={accent} onChange={(e) => apply('accent', e.target.value)} style={{ width: 44, height: 38, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }} />
            <input className="input" value={accent} onChange={(e) => apply('accent', e.target.value)} />
          </div>
        </div>
      </div>
      <p className="muted tiny" style={{ marginTop: 16 }}>Die Vorschau wirkt sofort auf die ganze App. Dauerhaft speichern: Werte in <code>src/index.css</code> (<code>--brand</code>, <code>--brand-2</code>) eintragen.</p>
    </Card>
  );
}
