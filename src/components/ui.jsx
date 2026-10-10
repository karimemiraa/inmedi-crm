import { Link } from 'react-router-dom';
import { initials } from '../lib/format.js';
import { X, Inbox, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// Sortable table header cell. Pairs with useSort(): <SortTh label sortKey sort onSort />
export function SortTh({ label, sortKey, sort, onSort, align, style }) {
  const dir = sort.key === sortKey ? sort.dir : null;
  const Icon = dir === 'asc' ? ChevronUp : dir === 'desc' ? ChevronDown : ChevronsUpDown;
  return (
    <th className={align === 'right' ? 'right' : ''} style={{ cursor: 'pointer', userSelect: 'none', ...style }} onClick={() => onSort(sortKey)} title="Sortieren">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: dir ? 'var(--brand)' : 'inherit', flexDirection: align === 'right' ? 'row-reverse' : 'row' }}>
        {label}<Icon size={12} style={{ opacity: dir ? 1 : 0.35 }} />
      </span>
    </th>
  );
}

// Clickable deep-link to a record detail page. Stops row-click propagation so it
// works inside clickable table rows/drawers. Falls back to plain text when unresolved.
export function RecordLink({ to, label, muted, onClick }) {
  if (!label) return <span className="muted">—</span>;
  if (!to) return <span className={muted ? 'muted' : undefined}>{label}</span>;
  return (
    <Link className="rec-link" to={to} onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}>{label}</Link>
  );
}
export function AccountLink({ account, id, name }) {
  const aid = account?.id || id;
  const label = account?.name ?? name;
  return <RecordLink to={aid ? '/accounts/' + aid : null} label={label} />;
}
export function ContactLink({ contact, id, name }) {
  const cid = contact?.id || id;
  const label = contact?.name ?? name;
  return <RecordLink to={cid ? '/contacts/' + cid : null} label={label} />;
}

export function Avatar({ name, color = '#a81e22', size, src }) {
  if (src) {
    return <img className={'avatar' + (size ? ' ' + size : '')} src={src} alt={name} title={name} style={{ objectFit: 'cover' }} />;
  }
  return (
    <div className={'avatar' + (size ? ' ' + size : '')} style={{ background: color }} title={name}>
      {initials(name)}
    </div>
  );
}

export function Badge({ children, tone = 'gray', dot = false }) {
  return (
    <span className={'badge ' + tone}>
      {dot && <span className="bullet" />}
      {children}
    </span>
  );
}

export function KpiCard({ icon: Icon, label, value, delta, deltaLabel, tone = 'brand' }) {
  const tones = {
    brand: ['var(--brand)', 'var(--brand-050)'],
    teal: ['var(--brand-2)', 'var(--brand-2-050)'],
    green: ['var(--green)', 'var(--green-bg)'],
    amber: ['var(--amber)', 'var(--amber-bg)'],
    purple: ['var(--purple)', 'var(--purple-bg)'],
    red: ['var(--red)', 'var(--red-bg)'],
  };
  const [fg, bg] = tones[tone] || tones.brand;
  const up = delta == null ? null : delta >= 0;
  return (
    <div className="card kpi">
      <div className="top">
        <div className="ico" style={{ background: bg, color: fg }}>
          {Icon && <Icon size={19} />}
        </div>
        <div className="label">{label}</div>
      </div>
      <div className="value">{value}</div>
      {delta != null && (
        <div className="foot">
          <span className={'delta-pill ' + (up ? 'up' : 'down')}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {Math.abs(delta).toLocaleString('de-DE')} %
          </span>
          <span className="muted">{deltaLabel || 'ggü. Vormonat'}</span>
        </div>
      )}
    </div>
  );
}

export function Card({ title, action, children, pad = true, sub }) {
  return (
    <div className="card">
      {(title || action) && (
        <div className="card-head">
          <div>
            <h3>{title}</h3>
            {sub && <div className="muted tiny" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </div>
  );
}

export function ScoreMeter({ value }) {
  const color = value >= 70 ? 'var(--green)' : value >= 40 ? 'var(--amber)' : 'var(--red)';
  return (
    <span className="score">
      <span className="bar"><i style={{ width: value + '%', background: color }} /></span>
      <span className="tiny" style={{ fontWeight: 700, color }}>{value}</span>
    </span>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="overlay center" onMouseDown={onClose}>
      <div className="modal" style={wide ? { width: 640 } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer__head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer__body">{children}</div>
        {footer && <div className="drawer__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ label = 'Noch keine Einträge', hint }) {
  return (
    <div className="empty">
      <Inbox size={38} />
      <div style={{ fontWeight: 600 }}>{label}</div>
      {hint && <div className="tiny" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}
