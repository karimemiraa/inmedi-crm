import { Fragment } from 'react';
import { Field } from './ui.jsx';
import { fmtDate } from '../lib/format.js';

// Zusatzfelder (custom fields) engine — definitions live in db.customFields,
// values live on each record under record.customValues[fieldId].

export function fieldsFor(db, entity) {
  return (db.customFields || []).filter((f) => f.entity === entity && f.active);
}

export function displayValue(field, raw) {
  if (raw == null || raw === '') return '—';
  if (field.type === 'Kontrollkästchen') return raw ? 'Ja' : 'Nein';
  if (field.type === 'Datum') return fmtDate(raw);
  if (field.type === 'Zahl') return Number(raw).toLocaleString('de-DE');
  return String(raw);
}

// Editable section for modals. `values` = customValues object, onChange(newValues).
export function CustomFieldsEditor({ db, entity, values, onChange }) {
  const fields = fieldsFor(db, entity);
  if (fields.length === 0) return null;
  const set = (id, v) => onChange({ ...values, [id]: v });
  return (
    <>
      <div className="full" style={{ marginTop: 6 }}><div className="muted tiny" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Zusatzfelder</div></div>
      {fields.map((f) => {
        const v = values?.[f.id];
        if (f.type === 'Kontrollkästchen') {
          return <div key={f.id} className="full"><label className="check"><input type="checkbox" checked={!!v} onChange={(e) => set(f.id, e.target.checked)} /> {f.label}</label></div>;
        }
        if (f.type === 'Auswahl') {
          return <Field key={f.id} label={f.label}><select className="select" value={v || ''} onChange={(e) => set(f.id, e.target.value)}><option value="">— Bitte wählen —</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select></Field>;
        }
        const inputType = f.type === 'Zahl' ? 'number' : f.type === 'Datum' ? 'date' : 'text';
        return <Field key={f.id} label={f.label}><input className="input" type={inputType} value={v || ''} onChange={(e) => set(f.id, e.target.value)} /></Field>;
      })}
    </>
  );
}

// Read-only display (kv rows) for detail pages.
export function CustomFieldsDisplay({ db, entity, record }) {
  const fields = fieldsFor(db, entity);
  const vals = record.customValues || {};
  const filled = fields.filter((f) => vals[f.id] != null && vals[f.id] !== '');
  if (fields.length === 0) return <div className="muted tiny">Keine Zusatzfelder für dieses Objekt definiert. (Einstellungen → Benutzerdefinierte Felder)</div>;
  return (
    <dl className="kv">
      {fields.map((f) => <Fragment key={f.id}><dt>{f.label}</dt><dd>{displayValue(f, vals[f.id])}</dd></Fragment>)}
    </dl>
  );
}
