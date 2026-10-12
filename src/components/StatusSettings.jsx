import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, AlertTriangle } from 'lucide-react';
import { store } from '../data/store.js';
import { DEFAULT_STATUS } from '../data/statusDefaults.js';
import { STATUS_KINDS, STATUS_TONES, statusList, statusUsage, saveStatusConfig } from '../lib/status.js';
import { Badge, Card, Select } from './ui.jsx';

let seq = 0;
const toRows = (list) => list.map((s) => ({ ...s, orig: s.name, key: 'r' + ++seq, deleted: false, moveTo: '' }));

// Einstellungen → Vorgänge & Status: Status je Vorgangsart umbenennen, einfärben,
// sortieren, hinzufügen und löschen. Bestehende Vorgänge werden automatisch nachgezogen.
export default function StatusSettings({ db, toast, initialKind }) {
  const [kind, setKind] = useState(STATUS_KINDS[initialKind] ? initialKind : 'tickets');
  const [rows, setRows] = useState(() => toRows(statusList(db, kind)));
  const usage = statusUsage(db, kind);

  useEffect(() => { setRows(toRows(statusList(store.get(), kind))); }, [kind]);

  const live = rows.filter((r) => !r.deleted);
  const patch = (key, p) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (key, dir) => setRows((rs) => {
    const i = rs.findIndex((r) => r.key === key);
    const j = i + dir;
    if (j < 0 || j >= rs.length) return rs;
    const next = [...rs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const remove = (r) => {
    if (!r.orig) { setRows((rs) => rs.filter((x) => x.key !== r.key)); return; }
    const target = live.find((x) => x.key !== r.key && x.closed === r.closed) || live.find((x) => x.key !== r.key);
    patch(r.key, { deleted: true, moveTo: target?.key || '' });
  };
  const add = () => setRows((rs) => [...rs, { name: '', tone: 'gray', closed: false, orig: null, key: 'r' + ++seq, deleted: false, moveTo: '' }]);

  const names = live.map((r) => r.name.trim());
  const errors = [];
  if (names.some((n) => !n)) errors.push('Jeder Status braucht einen Namen.');
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) errors.push('Statusnamen müssen eindeutig sein.');
  if (!live.some((r) => !r.closed)) errors.push('Mindestens ein offener Status ist nötig.');
  if (!live.some((r) => r.closed)) errors.push('Mindestens ein abgeschlossener Status ist nötig.');

  const original = statusList(db, kind);
  const dirty = JSON.stringify(live.map(({ name, tone, closed }) => ({ name: name.trim(), tone, closed }))) !== JSON.stringify(original.map(({ name, tone, closed }) => ({ name, tone, closed })));

  const save = () => {
    if (errors.length) return;
    const list = live.map((r) => ({ name: r.name.trim(), tone: r.tone, closed: r.closed }));
    const renames = {};
    live.forEach((r) => { if (r.orig && r.orig !== r.name.trim()) renames[r.orig] = r.name.trim(); });
    const reassign = {};
    rows.filter((r) => r.deleted && r.orig).forEach((r) => {
      const t = live.find((x) => x.key === r.moveTo) || live[0];
      reassign[r.orig] = t.name.trim();
    });
    saveStatusConfig(kind, list, renames, reassign);
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Status geändert', entity: STATUS_KINDS[kind].label, detail: list.map((s) => s.name).join(' → ') });
    setRows(toRows(list));
    toast('Status gespeichert — bestehende Vorgänge wurden angepasst');
  };

  const restoreDefaults = () => {
    if (!window.confirm('Standard-Status wiederherstellen? Vorgänge mit nicht mehr vorhandenem Status erhalten den ersten offenen Status.')) return;
    setRows([...rows.filter((r) => r.orig).map((r) => ({ ...r, deleted: true, moveTo: '' })), ...toRows(DEFAULT_STATUS[kind]).map((r) => ({ ...r, orig: null }))]);
  };

  return (
    <Card title="Vorgänge & Status" sub="Status je Vorgangsart festlegen. „Abgeschlossen“ steuert Zähler, KPIs und Filter — unabhängig vom Namen." pad={false}>
      <div className="status-kinds">
        {Object.entries(STATUS_KINDS).map(([k, v]) => (
          <button key={k} className={'status-kind' + (k === kind ? ' active' : '')} onClick={() => setKind(k)}>
            <b>{v.label}</b><span>{v.hint}</span>
          </button>
        ))}
      </div>

      <div className="status-editor">
        <div className="status-row status-head">
          <span /><span>Status</span><span>Farbe</span><span>Abgeschlossen</span><span>Vorgänge</span><span />
        </div>
        {rows.map((r, i) => r.deleted ? (
          <div key={r.key} className="status-row status-deleted">
            <span />
            <span><s>{r.orig}</s> wird gelöscht</span>
            {usage[r.orig] ? (
              <span className="status-move">
                {usage[r.orig] === 1 ? '1 Vorgang' : usage[r.orig] + ' Vorgänge'} verschieben nach
                <Select value={r.moveTo} onChange={(e) => patch(r.key, { moveTo: e.target.value })} aria-label="Ziel-Status">
                  {live.map((x) => <option key={x.key} value={x.key}>{x.name || '(ohne Namen)'}</option>)}
                </Select>
              </span>
            ) : <span className="muted tiny">nicht verwendet</span>}
            <button className="btn ghost sm" onClick={() => patch(r.key, { deleted: false })}><RotateCcw size={13} /> Rückgängig</button>
          </div>
        ) : (
          <div key={r.key} className="status-row">
            <span className="status-order">
              <button className="icon-btn xs" aria-label="Nach oben" disabled={i === 0} onClick={() => move(r.key, -1)}><ArrowUp size={13} /></button>
              <button className="icon-btn xs" aria-label="Nach unten" disabled={i === rows.length - 1} onClick={() => move(r.key, 1)}><ArrowDown size={13} /></button>
            </span>
            <span>
              <input className="input" value={r.name} placeholder="Statusname" aria-label="Statusname" onChange={(e) => patch(r.key, { name: e.target.value })} />
              {r.orig && r.orig !== r.name.trim() && r.name.trim() && <span className="tiny muted">vorher: {r.orig}</span>}
            </span>
            <span>
              <Select value={r.tone} onChange={(e) => patch(r.key, { tone: e.target.value })} aria-label="Farbe">
                {STATUS_TONES.map(([t, l]) => <option key={t} value={t}><Badge tone={t} dot>{l}</Badge></option>)}
              </Select>
            </span>
            <span><label className="check"><input type="checkbox" checked={r.closed} onChange={(e) => patch(r.key, { closed: e.target.checked })} /> {r.closed ? 'Ja' : 'Nein'}</label></span>
            <span>{r.orig && usage[r.orig] ? <Badge tone="gray">{usage[r.orig]}</Badge> : <span className="muted tiny">—</span>}</span>
            <button className="icon-btn sm" aria-label="Status löschen" title="Löschen" disabled={live.length <= 2} onClick={() => remove(r)}><Trash2 size={14} /></button>
          </div>
        ))}

        <div className="status-preview">
          <span className="muted tiny">Vorschau:</span>
          {live.map((r) => <Badge key={r.key} tone={r.tone} dot>{r.name || '…'}</Badge>)}
        </div>

        {errors.length > 0 && (
          <div className="status-errors">{errors.map((e) => <div key={e}><AlertTriangle size={13} /> {e}</div>)}</div>
        )}
      </div>

      <div className="status-foot">
        <button className="btn sm" onClick={add}><Plus size={14} /> Status hinzufügen</button>
        <button className="btn sm ghost" onClick={restoreDefaults}>Standard wiederherstellen</button>
        <span style={{ flex: 1 }} />
        <button className="btn sm" disabled={!dirty && !rows.some((r) => r.deleted)} onClick={() => setRows(toRows(statusList(db, kind)))}>Verwerfen</button>
        <button className="btn sm primary" disabled={errors.length > 0 || (!dirty && !rows.some((r) => r.deleted))} onClick={save}>Speichern</button>
      </div>
    </Card>
  );
}
