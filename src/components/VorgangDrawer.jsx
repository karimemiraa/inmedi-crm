import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, MessageSquare, Link2, History, FileText, Send, CornerDownRight, ListPlus, AlertOctagon, ClipboardCheck } from 'lucide-react';
import { useStore } from '../data/store.js';
import { AccountLink, Avatar, Badge, ContactLink, Drawer, Empty, Field, RecordLink, Select } from './ui.jsx';
import { useToast } from './Toast.jsx';
import { openLink } from '../lib/nav.js';
import { fmtDate, relDate } from '../lib/format.js';
import { ACT_LABEL } from '../lib/labels.js';
import { statusList, statusTone, setStatus } from '../lib/status.js';
import {
  VORGANG, vorgangLink, vorgangName, updateVorgang, addComment, editComment, deleteComment,
  canEditComment, canDeleteComment, parentOf, childrenOf, createLinked, trashVorgang,
} from '../lib/vorgang.js';

export const PRIORITIES = ['Hoch', 'Mittel', 'Niedrig'];
export const PRIO_TONE = { Hoch: 'red', Mittel: 'amber', Niedrig: 'gray' };
export const TICKET_CATEGORIES = ['Feedback', 'Produktfrage', 'Reklamation', 'Retoure', 'Lieferung', 'Rechnungsfrage'];
export const INC_TYPES = ['Vorkommnis', 'Beinahe-Vorkommnis', 'Produktmangel', 'Rückruf (FSCA)'];
export const SEVERITIES = ['Niedrig', 'Mittel', 'Hoch', 'Schwerwiegend'];
export const SEV_TONE = { Niedrig: 'gray', Mittel: 'blue', Hoch: 'amber', Schwerwiegend: 'red' };

const F = (key, label, type, extra = {}) => ({ key, label, type, ...extra });
// Bearbeitbare Felder je Vorgangsart.
export const FIELDS = {
  tickets: [
    F('subject', 'Betreff', 'text', { required: true, full: true }),
    F('description', 'Beschreibung', 'textarea', { full: true }),
    F('category', 'Kategorie', 'enum', { options: TICKET_CATEGORIES }),
    F('priority', 'Priorität', 'enum', { options: PRIORITIES }),
    F('channel', 'Kanal', 'enum', { options: ['Telefon', 'E-Mail', 'Web'] }),
    F('ownerId', 'Bearbeiter', 'user'),
    F('accountId', 'Firma', 'account'),
    F('contactId', 'Ansprechpartner', 'contact'),
    F('productId', 'Produkt', 'product'),
  ],
  activities: [
    F('subject', 'Betreff', 'text', { required: true, full: true }),
    F('notes', 'Beschreibung', 'textarea', { full: true }),
    F('type', 'Art', 'enum', { options: Object.keys(ACT_LABEL), labels: ACT_LABEL }),
    F('priority', 'Priorität', 'enum', { options: PRIORITIES }),
    F('dueDate', 'Fällig am', 'date'),
    F('ownerId', 'Verantwortlich', 'user'),
    F('accountId', 'Firma', 'account'),
    F('contactId', 'Ansprechpartner', 'contact'),
    F('dealId', 'Deal', 'deal'),
  ],
  ideas: [
    F('title', 'Titel', 'text', { required: true, full: true }),
    F('description', 'Beschreibung', 'textarea', { full: true }),
    F('priority', 'Priorität', 'enum', { options: PRIORITIES }),
    F('ownerId', 'Eingereicht von', 'user'),
  ],
  incidents: [
    F('title', 'Titel', 'text', { required: true, full: true }),
    F('description', 'Beschreibung', 'textarea', { full: true }),
    F('type', 'Typ', 'enum', { options: INC_TYPES }),
    F('severity', 'Schweregrad', 'enum', { options: SEVERITIES }),
    F('accountId', 'Firma', 'account'),
    F('productId', 'Produkt', 'product'),
    F('lot', 'Charge / LOT', 'text'),
    F('serial', 'Seriennummer', 'text'),
    F('meldepflichtig', 'Meldepflichtig (BfArM & Hersteller)', 'bool', { full: true }),
  ],
  capas: [
    F('title', 'Titel', 'text', { required: true, full: true }),
    F('description', 'Beschreibung', 'textarea', { full: true }),
    F('type', 'Typ', 'enum', { options: ['Korrektur', 'Vorbeugung'] }),
    F('ownerId', 'Verantwortlich', 'user'),
    F('dueDate', 'Fällig am', 'date'),
    F('incidentId', 'Bezug Vorkommnis', 'incident'),
  ],
};

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

// Bearbeiten/Löschen-Knöpfe für Listenzeilen (Löschen → Papierkorb mit Rückfrage)
export function RowActions({ kind, rec, onEdit, toast }) {
  const del = () => {
    if (!window.confirm(`${VORGANG[kind].label} „${VORGANG[kind].title(rec)}" in den Papierkorb verschieben?`)) return;
    trashVorgang(kind, rec.id);
    toast?.(VORGANG[kind].label + ' in den Papierkorb verschoben');
  };
  return (
    <span className="row-actions" onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn sm" title="Bearbeiten" aria-label="Bearbeiten" onClick={onEdit}><Pencil size={14} /></button>
      <button className="icon-btn sm" title="Löschen" aria-label="Löschen" onClick={del}><Trash2 size={14} /></button>
    </span>
  );
}

// Kleiner Zähler für Listen
export function CommentCount({ rec }) {
  const n = rec.comments?.length || 0;
  if (!n) return null;
  return <span className="comment-count" title={n + ' Kommentar(e)'}><MessageSquare size={11} /> {n}</span>;
}

// Einheitliche Detailansicht für jeden Vorgang: Details bearbeiten, Status,
// Kommentare, Verknüpfungen, Verlauf, Löschen (Papierkorb).
export default function VorgangDrawer({ kind, id, onClose }) {
  const db = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const r = db[kind]?.find((x) => x.id === id);
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => { setTab('details'); setEditing(false); }, [kind, id]);
  useEffect(() => { if (!r) onClose(); }, [r]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!r) return null;

  const meta = VORGANG[kind];
  const fields = FIELDS[kind];
  const parent = parentOf(db, kind, r);
  const children = childrenOf(db, kind, id);
  const links = (parent ? 1 : 0) + children.length;

  const startEdit = () => { setDraft(Object.fromEntries(fields.map((f) => [f.key, r[f.key] ?? (f.type === 'bool' ? false : '')]))); setEditing(true); setTab('details'); };
  const save = () => {
    const missing = fields.find((f) => f.required && !String(draft[f.key] || '').trim());
    if (missing) { toast(missing.label + ' darf nicht leer sein'); return; }
    const patch = {};
    const changed = [];
    fields.forEach((f) => {
      let v = draft[f.key];
      if (f.type === 'date') v = v ? new Date(v).toISOString() : null;
      if (['account', 'contact', 'deal', 'product', 'user', 'incident'].includes(f.type)) v = v || null;
      if (typeof v === 'string' && f.type !== 'textarea') v = v.trim();
      const old = r[f.key] ?? (f.type === 'bool' ? false : f.type === 'text' || f.type === 'textarea' ? '' : null);
      const same = f.type === 'date' ? String(old || '').slice(0, 10) === String(v || '').slice(0, 10) : old === v;
      if (!same) { patch[f.key] = v; changed.push(f.label); }
    });
    if (changed.length) { updateVorgang(kind, id, patch, 'Geändert: ' + changed.join(', ')); toast('Änderungen gespeichert'); }
    setEditing(false);
  };
  const remove = () => {
    if (!window.confirm(`${meta.label} „${meta.title(r)}" in den Papierkorb verschieben? Wiederherstellen ist unter Einstellungen → Daten möglich.`)) return;
    trashVorgang(kind, id);
    toast(meta.label + ' in den Papierkorb verschoben');
    onClose();
  };

  // Schnellaktionen: verknüpfte Vorgänge anlegen
  const followUp = () => {
    const rec = createLinked('activities', {
      type: 'followup', subject: 'Nachfassen: ' + meta.title(r), accountId: r.accountId || null, contactId: r.contactId || null,
      dealId: r.dealId || null, ownerId: db.meta.currentUserId, dueDate: addDays(3), priority: r.priority || 'Mittel', notes: '', status: '',
    }, kind, id);
    toast('Folgeaufgabe angelegt'); setTab('links');
    return rec;
  };
  const toIncident = () => {
    const n = 'VK-2026-' + String(16 + db.incidents.length).padStart(3, '0');
    createLinked('incidents', {
      number: n, title: r.subject, type: 'Vorkommnis', severity: 'Mittel', productId: r.productId || null, lot: '', serial: '',
      accountId: r.accountId, status: '', reportedBy: db.meta.currentUserId, reportedAt: new Date().toISOString(),
      meldepflichtig: false, description: r.description || '', capaId: null,
    }, kind, id);
    toast('Vorkommnis ' + n + ' erfasst'); setTab('links');
  };
  const toCapa = () => {
    const n = 'CAPA-2026-' + String(10 + db.capas.length).padStart(3, '0');
    createLinked('capas', {
      number: n, type: 'Korrektur', title: 'Maßnahme zu ' + (r.number || meta.title(r)), incidentId: kind === 'incidents' ? id : null,
      ownerId: db.meta.currentUserId, status: '', dueDate: addDays(30), createdAt: new Date().toISOString(), description: '',
    }, kind, id);
    toast('CAPA ' + n + ' angelegt'); setTab('links');
  };

  const badges = (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Badge tone={statusTone(db, kind, r.status)} dot>{r.status}</Badge>
      {r.priority && <Badge tone={PRIO_TONE[r.priority]}>Priorität: {r.priority}</Badge>}
      {r.severity && <Badge tone={SEV_TONE[r.severity]} dot>{r.severity}</Badge>}
      {r.meldepflichtig && <Badge tone="red" dot>Meldepflichtig</Badge>}
      {kind === 'activities' && r.type && <Badge tone="gray">{ACT_LABEL[r.type] || r.type}</Badge>}
      {r.category && <Badge tone="gray">{r.category}</Badge>}
    </div>
  );

  const footer = editing ? (
    <>
      <button className="btn" onClick={() => setEditing(false)}>Abbrechen</button>
      <button className="btn primary" onClick={save}>Speichern</button>
    </>
  ) : (
    <>
      <button className="btn danger" onClick={remove} style={{ marginRight: 'auto' }}><Trash2 size={14} /> Löschen</button>
      <button className="btn" onClick={() => setTab('comments')}><MessageSquare size={14} /> Kommentieren</button>
      <button className="btn primary" onClick={startEdit}><Pencil size={14} /> Bearbeiten</button>
    </>
  );

  return (
    <Drawer title={[meta.label, meta.number(r)].filter(Boolean).join(' ')} onClose={onClose} footer={footer}>
      <h3 style={{ fontSize: 16, marginBottom: 10 }}>{meta.title(r)}</h3>
      {badges}

      <div className="vg-status">
        <Field label="Status">
          <Select value={r.status} onChange={(e) => { setStatus(kind, id, e.target.value); toast('Status: ' + e.target.value); }} aria-label="Status">
            {statusList(db, kind).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </Select>
        </Field>
      </div>

      <div className="tabs vg-tabs">
        <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}><FileText size={13} /> Details</button>
        <button className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}><MessageSquare size={13} /> Kommentare ({r.comments?.length || 0})</button>
        <button className={tab === 'links' ? 'active' : ''} onClick={() => setTab('links')}><Link2 size={13} /> Verknüpfungen ({links})</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><History size={13} /> Verlauf</button>
      </div>

      {tab === 'details' && (editing
        ? <EditForm db={db} fields={fields} draft={draft} setDraft={setDraft} selfId={id} />
        : <DetailView db={db} kind={kind} r={r} fields={fields} />)}

      {tab === 'comments' && <Comments db={db} kind={kind} r={r} toast={toast} />}

      {tab === 'links' && (
        <div>
          <div className="vg-actions">
            <button className="btn sm" onClick={followUp}><ListPlus size={14} /> Folgeaufgabe</button>
            {kind === 'tickets' && <button className="btn sm" onClick={toIncident}><AlertOctagon size={14} /> Als QM-Vorkommnis erfassen</button>}
            {kind === 'incidents' && <button className="btn sm" onClick={toCapa}><ClipboardCheck size={14} /> CAPA anlegen</button>}
          </div>
          {parent && (
            <div className="vg-link-group">
              <div className="vg-link-head">Übergeordnet</div>
              <LinkRow kind={parent.kind} rec={parent.rec} id={parent.id} db={db} nav={nav} />
            </div>
          )}
          <div className="vg-link-group">
            <div className="vg-link-head">Daraus entstanden ({children.length})</div>
            {children.length === 0 && <div className="muted tiny" style={{ padding: '6px 2px' }}>Noch keine verknüpften Vorgänge — oben anlegen.</div>}
            {children.map((c) => <LinkRow key={c.kind + c.rec.id} kind={c.kind} rec={c.rec} id={c.rec.id} db={db} nav={nav} />)}
          </div>
          <div className="vg-link-group">
            <div className="vg-link-head">Stammdaten</div>
            <dl className="kv">
              {r.accountId !== undefined && <><dt>Firma</dt><dd><AccountLink account={db.accounts.find((a) => a.id === r.accountId)} /></dd></>}
              {r.contactId !== undefined && <><dt>Ansprechpartner</dt><dd>{r.contactId ? <ContactLink contact={db.contacts.find((c) => c.id === r.contactId)} /> : '—'}</dd></>}
              {r.dealId !== undefined && <><dt>Deal</dt><dd><RecordLink to={r.dealId ? openLink('/pipeline', r.dealId) : null} label={db.deals.find((d) => d.id === r.dealId)?.name} /></dd></>}
              {r.productId !== undefined && <><dt>Produkt</dt><dd><RecordLink to={r.productId ? '/products' : null} label={db.products.find((p) => p.id === r.productId)?.name} /></dd></>}
            </dl>
          </div>
        </div>
      )}

      {tab === 'history' && <HistoryList db={db} kind={kind} r={r} />}
    </Drawer>
  );
}

function LinkRow({ kind, rec, id, db, nav }) {
  if (!rec) return <div className="vg-link muted"><CornerDownRight size={14} /> {VORGANG[kind].label} (im Papierkorb)</div>;
  return (
    <button className="vg-link" onClick={() => nav(vorgangLink(kind, id))}>
      <CornerDownRight size={14} />
      <span className="vg-link-kind">{VORGANG[kind].label}</span>
      <span className="vg-link-title">{vorgangName(kind, rec)}</span>
      <Badge tone={statusTone(db, kind, rec.status)} dot>{rec.status}</Badge>
    </button>
  );
}

function display(db, f, v) {
  if (v === undefined || v === null || v === '') return f.type === 'bool' ? <Badge tone="gray">Nein</Badge> : <span className="muted">—</span>;
  switch (f.type) {
    case 'enum': return f.labels?.[v] || v;
    case 'date': return fmtDate(v);
    case 'bool': return v ? <Badge tone="red" dot>Ja</Badge> : <Badge tone="gray">Nein</Badge>;
    case 'textarea': return <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span>;
    case 'account': return <AccountLink account={db.accounts.find((a) => a.id === v)} />;
    case 'contact': return <ContactLink contact={db.contacts.find((c) => c.id === v)} />;
    case 'deal': return <RecordLink to={openLink('/pipeline', v)} label={db.deals.find((d) => d.id === v)?.name} />;
    case 'product': return <RecordLink to="/products" label={db.products.find((p) => p.id === v)?.name} />;
    case 'user': return db.users.find((u) => u.id === v)?.name || '—';
    case 'incident': { const i = db.incidents.find((x) => x.id === v); return <RecordLink to={i ? vorgangLink('incidents', v) : null} label={i ? vorgangName('incidents', i) : '(im Papierkorb)'} />; }
    default: return String(v);
  }
}

function DetailView({ db, kind, r, fields }) {
  const created = r.createdAt || r.reportedAt;
  return (
    <dl className="kv">
      {fields.map((f) => <FragmentRow key={f.key} label={f.label} value={display(db, f, r[f.key])} />)}
      {kind === 'incidents' && r.meldepflichtig && <FragmentRow label="Meldefrist" value={fmtDate(new Date(new Date(r.reportedAt).getTime() + 15 * 86400000).toISOString()) + ' (spätestens, MDR Art. 87)'} />}
      {created && <FragmentRow label="Erstellt" value={fmtDate(created)} />}
      {kind === 'tickets' && r.resolvedAt && <FragmentRow label="Abgeschlossen" value={fmtDate(r.resolvedAt)} />}
    </dl>
  );
}
const FragmentRow = ({ label, value }) => <><dt>{label}</dt><dd>{value}</dd></>;

function EditForm({ db, fields, draft, setDraft, selfId }) {
  const set = (k, v) => setDraft((d) => {
    const next = { ...d, [k]: v };
    // Ansprechpartner/Deal müssen zur gewählten Firma passen
    if (k === 'accountId') {
      if (next.contactId && db.contacts.find((c) => c.id === next.contactId)?.accountId !== v) next.contactId = '';
      if (next.dealId && db.deals.find((x) => x.id === next.dealId)?.accountId !== v) next.dealId = '';
    }
    return next;
  });
  const input = (f) => {
    const v = draft[f.key] ?? '';
    switch (f.type) {
      case 'textarea': return <textarea className="input" rows={3} value={v} onChange={(e) => set(f.key, e.target.value)} />;
      case 'date': return <input className="input" type="date" value={v ? String(v).slice(0, 10) : ''} onChange={(e) => set(f.key, e.target.value)} />;
      case 'bool': return <label className="check"><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} /> {v ? 'Ja' : 'Nein'}</label>;
      case 'enum': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}>{f.options.map((o) => <option key={o} value={o}>{f.labels?.[o] || o}</option>)}</Select>;
      case 'user': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">— Niemand —</option>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>;
      case 'account': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">— Keine Firma —</option>{db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>;
      case 'contact': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">— Keiner —</option>{db.contacts.filter((c) => !draft.accountId || c.accountId === draft.accountId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>;
      case 'deal': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">— Kein Deal —</option>{db.deals.filter((d) => !draft.accountId || d.accountId === draft.accountId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>;
      case 'product': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">— Kein Produkt —</option>{db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>;
      case 'incident': return <Select value={v} onChange={(e) => set(f.key, e.target.value)}><option value="">— Ohne —</option>{db.incidents.filter((i) => i.id !== selfId).map((i) => <option key={i.id} value={i.id}>{vorgangName('incidents', i)}</option>)}</Select>;
      default: return <input className="input" value={v} onChange={(e) => set(f.key, e.target.value)} />;
    }
  };
  return (
    <div className="form-grid">
      {fields.map((f) => (
        <div key={f.key} className={f.full ? 'full' : undefined}>
          <Field label={f.label + (f.required ? ' *' : '')}>{input(f)}</Field>
        </div>
      ))}
    </div>
  );
}

function Comments({ db, kind, r, toast }) {
  const [text, setText] = useState('');
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const list = r.comments || [];
  const send = () => { if (!text.trim()) return; addComment(kind, r.id, text); setText(''); toast('Kommentar gespeichert'); };
  return (
    <div>
      {list.length === 0 && <Empty label="Noch keine Kommentare" hint="Absprachen, Rückfragen und Zwischenstände festhalten." />}
      {list.map((c) => {
        const u = db.users.find((x) => x.id === c.userId);
        return (
          <div key={c.id} className="vg-comment">
            <Avatar name={u?.name || '?'} color={u?.color} src={u?.avatar} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="vg-comment-head">
                <b>{u?.name || 'Unbekannt'}</b>
                <span className="muted tiny">{relDate(c.at)}{c.editedAt ? ' · bearbeitet' : ''}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                  {canEditComment(db, c) && editId !== c.id && <button className="btn ghost sm" onClick={() => { setEditId(c.id); setEditText(c.text); }}>Bearbeiten</button>}
                  {canDeleteComment(db, c) && <button className="btn ghost sm" onClick={() => { if (window.confirm('Kommentar löschen?')) { deleteComment(kind, r.id, c.id); toast('Kommentar gelöscht'); } }}>Löschen</button>}
                </span>
              </div>
              {editId === c.id ? (
                <div>
                  <textarea className="input" rows={2} value={editText} autoFocus onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { editComment(kind, r.id, c.id, editText); setEditId(null); } if (e.key === 'Escape') setEditId(null); }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button className="btn sm" onClick={() => setEditId(null)}>Abbrechen</button>
                    <button className="btn sm primary" onClick={() => { editComment(kind, r.id, c.id, editText); setEditId(null); toast('Kommentar aktualisiert'); }}>Speichern</button>
                  </div>
                </div>
              ) : <div className="vg-comment-text">{c.text}</div>}
            </div>
          </div>
        );
      })}
      <div className="vg-comment-new">
        <Avatar name={me?.name} color={me?.color} src={me?.avatar} size="sm" />
        <div style={{ flex: 1 }}>
          <textarea className="input" rows={2} placeholder="Kommentar schreiben … (Strg+Enter zum Senden)" value={text} aria-label="Neuer Kommentar"
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn primary sm" onClick={send} disabled={!text.trim()}><Send size={13} /> Kommentar senden</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryList({ db, kind, r }) {
  const created = r.createdAt || r.reportedAt;
  const items = [...(r.history || [])];
  return (
    <div className="vg-history">
      {items.map((h) => (
        <div key={h.id || h.at} className="vg-history-row">
          <span className="vg-dot" />
          <div><div>{h.text}</div><div className="muted tiny">{db.users.find((u) => u.id === h.userId)?.name || 'System'} · {relDate(h.at)}</div></div>
        </div>
      ))}
      {created && (
        <div className="vg-history-row">
          <span className="vg-dot" />
          <div><div>{VORGANG[kind].label} angelegt</div><div className="muted tiny">{db.users.find((u) => u.id === (r.reportedBy || r.ownerId))?.name || ''} · {fmtDate(created)}</div></div>
        </div>
      )}
      {items.length === 0 && !created && <Empty label="Noch kein Verlauf" />}
    </div>
  );
}
