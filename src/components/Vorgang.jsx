// Bausteine der Vorgang-Seite: Details/Bearbeiten, Positionen, Kommentare,
// Verknüpfungen, Verlauf sowie Listen-Helfer (Kommentarzähler, Zeilenaktionen).
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, MessageSquare, Send, CornerDownRight, Plus } from 'lucide-react';
import { AccountLink, Avatar, Badge, ContactLink, Empty, Field, RecordLink, Select, UserLink } from './ui.jsx';
import { CustomFieldsDisplay, CustomFieldsEditor, fieldsFor } from './CustomFields.jsx';
import { fmtDate, fmtMoney, relDate } from '../lib/format.js';
import { BILLING } from './LineItems.jsx';
import {
  VORGANG, kindLabel, vorgangLink, vorgangName, statusInfo, addComment, editComment, deleteComment,
  canEditComment, canDeleteComment, trashVorgang, sumItems,
} from '../lib/vorgang.js';

export { PRIO_TONE, SEV_TONE, TICKET_CATEGORIES, INC_TYPES, SEVERITIES } from '../lib/vorgangFields.js';

// ---------- Listen-Helfer ----------
export function CommentCount({ rec }) {
  const n = rec.comments?.length || 0;
  if (!n) return null;
  return <span className="comment-count" title={n + ' Kommentar(e)'}><MessageSquare size={11} /> {n}</span>;
}

// Bearbeiten öffnet die Vorgang-Seite, Löschen → Papierkorb (mit Rückfrage)
export function RowActions({ kind, rec, toast }) {
  const nav = useNavigate();
  const del = () => {
    if (!window.confirm(`${kindLabel(kind, rec)} „${VORGANG[kind].title(rec)}" in den Papierkorb verschieben?`)) return;
    trashVorgang(kind, rec.id);
    toast?.(kindLabel(kind, rec) + ' in den Papierkorb verschoben');
  };
  return (
    <span className="row-actions" onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn sm" title="Öffnen & bearbeiten" aria-label="Bearbeiten" onClick={() => nav(vorgangLink(kind, rec.id))}><Pencil size={14} /></button>
      <button className="icon-btn sm" title="Löschen" aria-label="Löschen" onClick={del}><Trash2 size={14} /></button>
    </span>
  );
}

export function StatusBadge({ db, kind, rec }) {
  const s = statusInfo(db, kind, rec);
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

// ---------- Details ----------
export function displayValue(db, f, v) {
  const empty = v === undefined || v === null || v === '';
  if (empty && f.type !== 'bool') return <span className="muted">—</span>;
  switch (f.type) {
    case 'enum': return f.labels?.[v] || v;
    case 'date': return fmtDate(v);
    case 'money': return fmtMoney(Number(v) || 0);
    case 'number': return Number(v).toLocaleString('de-DE');
    case 'bool': return v ? <Badge tone="red" dot>Ja</Badge> : <Badge tone="gray">Nein</Badge>;
    case 'textarea': return <span style={{ whiteSpace: 'pre-wrap' }}>{v}</span>;
    case 'account': return <AccountLink account={db.accounts.find((a) => a.id === v)} />;
    case 'contact': return <ContactLink contact={db.contacts.find((c) => c.id === v)} />;
    case 'user': return <UserLink user={db.users.find((u) => u.id === v)} />;
    case 'deal': return refLink(db, 'deals', v);
    case 'order': return refLink(db, 'orders', v);
    case 'product': return refLink(db, 'products', v);
    case 'incident': return refLink(db, 'incidents', v);
    default: return String(v);
  }
}
function refLink(db, kind, id) {
  const r = db[kind].find((x) => x.id === id);
  return <RecordLink to={r ? vorgangLink(kind, id) : null} label={r ? vorgangName(kind, r) : '(im Papierkorb)'} muted={!r} />;
}

export function DetailView({ db, kind, r, fields }) {
  const created = r.createdAt || r.reportedAt;
  const entity = VORGANG[kind].customEntity;
  return (
    <>
      <dl className="kv">
        {fields.map((f) => <Row key={f.key} label={f.label} value={displayValue(db, f, r[f.key])} />)}
        {kind === 'incidents' && r.meldepflichtig && <Row label="Meldefrist" value={fmtDate(new Date(new Date(r.reportedAt).getTime() + 15 * 86400000).toISOString()) + ' (spätestens, MDR Art. 87)'} />}
        {created && <Row label="Erstellt" value={fmtDate(created)} />}
        {kind === 'tickets' && r.resolvedAt && <Row label="Abgeschlossen" value={fmtDate(r.resolvedAt)} />}
      </dl>
      {entity && fieldsFor(db, entity).length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="vg-link-head">Zusatzfelder</div>
          <CustomFieldsDisplay db={db} entity={entity} record={r} />
        </div>
      )}
    </>
  );
}
const Row = ({ label, value }) => <><dt>{label}</dt><dd>{value}</dd></>;

// Entwurf aus Datensatz; beim Speichern werden Typen zurückgewandelt.
export const toDraft = (r, fields) => ({
  ...Object.fromEntries(fields.map((f) => [f.key, r[f.key] ?? (f.type === 'bool' ? false : '')])),
  customValues: r.customValues || {},
});
export function diffDraft(kind, r, fields, draft) {
  const patch = {};
  const changed = [];
  for (const f of fields) {
    let v = draft[f.key];
    if (f.required && !String(v ?? '').trim()) return { error: f.label + ' darf nicht leer sein' };
    if (f.type === 'date') v = v ? new Date(v).toISOString() : null;
    if (f.type === 'number' || f.type === 'money') v = v === '' || v === null ? 0 : Number(v);
    if (['account', 'contact', 'deal', 'order', 'product', 'user', 'incident'].includes(f.type)) v = v || null;
    if (f.type === 'text' && typeof v === 'string') v = v.trim();
    const old = r[f.key] ?? (f.type === 'bool' ? false : ['text', 'textarea'].includes(f.type) ? '' : ['number', 'money'].includes(f.type) ? 0 : null);
    const same = f.type === 'date' ? String(old || '').slice(0, 10) === String(v || '').slice(0, 10) : old === v;
    if (!same) { patch[f.key] = v; changed.push(f.label); }
  }
  if (VORGANG[kind].customEntity && JSON.stringify(draft.customValues || {}) !== JSON.stringify(r.customValues || {})) {
    patch.customValues = draft.customValues; changed.push('Zusatzfelder');
  }
  return { patch, changed };
}

export function EditForm({ db, kind, fields, draft, setDraft, selfId }) {
  const set = (k, v) => setDraft((d) => {
    const next = { ...d, [k]: v };
    // Ansprechpartner/Deal/Auftrag müssen zur gewählten Firma passen
    if (k === 'accountId') {
      if (next.contactId && db.contacts.find((c) => c.id === next.contactId)?.accountId !== v) next.contactId = '';
      if (next.dealId && db.deals.find((x) => x.id === next.dealId)?.accountId !== v) next.dealId = '';
      if (next.orderId && db.orders.find((x) => x.id === next.orderId)?.accountId !== v) next.orderId = '';
      if (next.fromOrderId && db.orders.find((x) => x.id === next.fromOrderId)?.accountId !== v) next.fromOrderId = '';
    }
    return next;
  });
  const byAcct = (list) => list.filter((x) => !draft.accountId || x.accountId === draft.accountId);
  const input = (f) => {
    const v = draft[f.key] ?? '';
    const sel = (opts, none) => (
      <Select value={v} onChange={(e) => set(f.key, e.target.value)}>
        {none && <option value="">{none}</option>}
        {opts}
      </Select>
    );
    switch (f.type) {
      case 'textarea': return <textarea className="input" rows={3} value={v} onChange={(e) => set(f.key, e.target.value)} />;
      case 'date': return <input className="input" type="date" value={v ? String(v).slice(0, 10) : ''} onChange={(e) => set(f.key, e.target.value)} />;
      case 'number': return <input className="input" type="number" value={v} onChange={(e) => set(f.key, e.target.value)} />;
      case 'money': return <input className="input" type="number" step="0.01" value={v} onChange={(e) => set(f.key, e.target.value)} />;
      case 'bool': return <label className="check"><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} /> {v ? 'Ja' : 'Nein'}</label>;
      case 'enum': return sel(f.options.map((o) => <option key={o} value={o}>{f.labels?.[o] || o}</option>));
      case 'user': return sel(db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>), '— Niemand —');
      case 'account': return sel(db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>), f.required ? null : '— Keine Firma —');
      case 'contact': return sel(byAcct(db.contacts).map((c) => <option key={c.id} value={c.id}>{c.name}</option>), '— Keiner —');
      case 'deal': return sel(byAcct(db.deals).map((d) => <option key={d.id} value={d.id}>{d.name}</option>), '— Kein Deal —');
      case 'order': return sel(byAcct(db.orders).map((o) => <option key={o.id} value={o.id}>{o.kind} {o.number}</option>), '— Kein Auftrag —');
      case 'product': return sel(db.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>), '— Kein Produkt —');
      case 'incident': return sel(db.incidents.filter((i) => i.id !== selfId).map((i) => <option key={i.id} value={i.id}>{vorgangName('incidents', i)}</option>), '— Ohne —');
      default: return <input className="input" value={v} onChange={(e) => set(f.key, e.target.value)} />;
    }
  };
  const entity = VORGANG[kind].customEntity;
  return (
    <>
      <div className="form-grid">
        {fields.map((f) => (
          <div key={f.key} className={f.full ? 'full' : undefined}>
            <Field label={f.label + (f.required ? ' *' : '')}>{input(f)}</Field>
          </div>
        ))}
      </div>
      {entity && fieldsFor(db, entity).length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="vg-link-head">Zusatzfelder</div>
          <CustomFieldsEditor db={db} entity={entity} values={draft.customValues || {}} onChange={(cv) => setDraft((d) => ({ ...d, customValues: cv }))} />
        </div>
      )}
    </>
  );
}

// ---------- Positionen ----------
export function ItemsEditor({ db, items, setItems, billing }) {
  const [pid, setPid] = useState(db.products[0]?.id || '');
  const upd = (i, patch) => setItems(items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const add = () => {
    const p = db.products.find((x) => x.id === pid);
    if (!p) return;
    setItems([...items, { productId: p.id, name: p.name, qty: 1, price: p.price, ...(billing ? { billing: 'jährlich' } : {}) }]);
  };
  return (
    <div>
      <div className="table-wrap"><table className="tbl items-edit">
        <thead><tr><th>Produkt</th><th className="right" style={{ width: 90 }}>Menge</th><th className="right" style={{ width: 120 }}>Preis</th>{billing && <th style={{ width: 150 }}>Zahlungsweise</th>}<th className="right">Gesamt</th><th style={{ width: 40 }} /></tr></thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} style={{ cursor: 'default' }}>
              <td className="cell-main">{it.name}</td>
              <td className="right"><input className="input" type="number" min="0" value={it.qty} aria-label="Menge" onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
              <td className="right"><input className="input" type="number" step="0.01" min="0" value={it.price} aria-label="Preis" onChange={(e) => upd(i, { price: Number(e.target.value) })} /></td>
              {billing && <td><Select value={it.billing || 'einmalig'} onChange={(e) => upd(i, { billing: e.target.value })}>{BILLING.map((b) => <option key={b} value={b}>{b}</option>)}</Select></td>}
              <td className="right"><b>{fmtMoney((Number(it.qty) || 0) * (Number(it.price) || 0))}</b></td>
              <td><button className="icon-btn sm" aria-label="Position entfernen" title="Entfernen" onClick={() => setItems(items.filter((_, k) => k !== i))}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>{items.length === 0 && <Empty label="Keine Positionen" />}</div>
      <div className="items-add">
        <Select value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Produkt wählen">
          {db.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price)})</option>)}
        </Select>
        <button className="btn sm" onClick={add}><Plus size={14} /> Position hinzufügen</button>
        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>Summe: {fmtMoney(sumItems(items))}</span>
      </div>
    </div>
  );
}

export function ItemsView({ db, items, billing }) {
  return (
    <div className="table-wrap"><table className="tbl">
      <thead><tr><th>Produkt</th><th className="right">Menge</th><th className="right">Preis</th>{billing && <th>Zahlungsweise</th>}<th className="right">Gesamt</th></tr></thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i} style={{ cursor: 'default' }}>
            <td className="cell-main">{db.products.some((p) => p.id === it.productId) ? <RecordLink to={vorgangLink('products', it.productId)} label={it.name} /> : it.name}</td>
            <td className="right">{it.qty}</td>
            <td className="right">{fmtMoney(it.price)}</td>
            {billing && <td>{it.billing || 'einmalig'}</td>}
            <td className="right"><b>{fmtMoney(it.qty * it.price)}</b></td>
          </tr>
        ))}
      </tbody>
    </table>{items.length === 0 && <Empty label="Keine Positionen" />}</div>
  );
}

// ---------- Verknüpfungen ----------
export function LinkRow({ db, kind, id, rec }) {
  const nav = useNavigate();
  if (!rec) return <div className="vg-link muted"><CornerDownRight size={14} /> {VORGANG[kind].label} (im Papierkorb)</div>;
  const s = statusInfo(db, kind, rec);
  return (
    <button className="vg-link" onClick={() => nav(vorgangLink(kind, id))}>
      <CornerDownRight size={14} />
      <span className="vg-link-kind">{kindLabel(kind, rec)}</span>
      <span className="vg-link-title">{vorgangName(kind, rec)}</span>
      {rec.total != null && <span className="muted tiny nowrap">{fmtMoney(rec.total)}</span>}
      {s.label && <Badge tone={s.tone} dot>{s.label}</Badge>}
    </button>
  );
}

// ---------- Kommentare ----------
export function Comments({ db, kind, r, toast }) {
  const [text, setText] = useState('');
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const list = r.comments || [];
  const send = () => { if (!text.trim()) return; addComment(kind, r.id, text); setText(''); toast('Kommentar gespeichert'); };
  const saveEdit = (cid) => { editComment(kind, r.id, cid, editText); setEditId(null); toast('Kommentar aktualisiert'); };
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
                <b><UserLink user={u} name="Unbekannt" /></b>
                <span className="muted tiny">{relDate(c.at)}{c.editedAt ? ' · bearbeitet' : ''}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                  {canEditComment(db, c) && editId !== c.id && <button className="btn ghost sm" onClick={() => { setEditId(c.id); setEditText(c.text); }}>Bearbeiten</button>}
                  {canDeleteComment(db, c) && <button className="btn ghost sm" onClick={() => { if (window.confirm('Kommentar löschen?')) { deleteComment(kind, r.id, c.id); toast('Kommentar gelöscht'); } }}>Löschen</button>}
                </span>
              </div>
              {editId === c.id ? (
                <div>
                  <textarea className="input" rows={2} value={editText} autoFocus onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(c.id); if (e.key === 'Escape') setEditId(null); }} />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button className="btn sm" onClick={() => setEditId(null)}>Abbrechen</button>
                    <button className="btn sm primary" onClick={() => saveEdit(c.id)}>Speichern</button>
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

// ---------- Verlauf ----------
export function HistoryList({ db, kind, r }) {
  const created = r.createdAt || r.reportedAt || r.date || r.issueDate;
  const items = r.history || [];
  const creator = db.users.find((u) => u.id === (r.reportedBy || r.ownerId));
  return (
    <div className="vg-history">
      {items.map((h) => (
        <div key={h.id || h.at} className="vg-history-row">
          <span className="vg-dot" />
          <div><div>{h.text}</div><div className="muted tiny"><UserLink user={db.users.find((u) => u.id === h.userId)} name="System" /> · {relDate(h.at)}</div></div>
        </div>
      ))}
      {created && (
        <div className="vg-history-row">
          <span className="vg-dot" />
          <div><div>{kindLabel(kind, r)} angelegt</div><div className="muted tiny">{creator ? <UserLink user={creator} /> : ''}{creator ? ' · ' : ''}{fmtDate(created)}</div></div>
        </div>
      )}
      {items.length === 0 && !created && <Empty label="Noch kein Verlauf" />}
    </div>
  );
}

