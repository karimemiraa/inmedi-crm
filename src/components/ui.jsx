import { useState, useRef, useEffect, useLayoutEffect, Children, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { initials } from '../lib/format.js';
import { X, Inbox, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, ChevronsUpDown, Check } from 'lucide-react';

// Styled dropdown — a drop-in replacement for native <select>. Reads <option>
// children and keeps the native onChange(e.target.value) signature. Renders the
// menu in a portal so it is never clipped inside modals/drawers and matches the
// app theme in light and dark.
function optionText(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(optionText).join('');
  if (isValidElement(node)) return optionText(node.props.children);
  return '';
}
export function Select({ value, onChange, children, className = '', style, disabled, 'aria-label': ariaLabel, placeholder }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const opts = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c) || c.type !== 'option') return;
    const val = c.props.value !== undefined ? c.props.value : optionText(c.props.children);
    opts.push({ value: val, label: c.props.children, disabled: !!c.props.disabled });
  });
  const selIdx = opts.findIndex((o) => String(o.value) === String(value));
  const current = selIdx >= 0 ? opts[selIdx] : null;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, bottom: r.top, width: r.width, vh: window.innerHeight });
  };
  const openMenu = () => { if (disabled) return; place(); setHi(selIdx >= 0 ? selIdx : 0); setOpen(true); };
  const close = () => setOpen(false);
  const pick = (i) => { const o = opts[i]; if (!o || o.disabled) return; onChange && onChange({ target: { value: o.value } }); close(); btnRef.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close(); };
    const onScroll = (e) => { if (!menuRef.current?.contains(e.target)) close(); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close); };
  }, [open]);

  // Clamp into the viewport (shift left if overflowing, flip up if no room below).
  useLayoutEffect(() => {
    if (!open || !pos || !menuRef.current) return;
    const m = menuRef.current.getBoundingClientRect();
    let left = pos.left, top = pos.top;
    if (left + m.width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - m.width - 8);
    if (top + m.height > window.innerHeight - 8) { const up = pos.bottom - 4 - m.height; top = up > 8 ? up : Math.max(8, window.innerHeight - m.height - 8); }
    if (left !== pos.left || top !== pos.top) { menuRef.current.style.left = left + 'px'; menuRef.current.style.top = top + 'px'; }
  }, [open, pos]);

  useEffect(() => { // keep highlighted option in view
    if (open && menuRef.current) { const el = menuRef.current.children[hi]; el?.scrollIntoView({ block: 'nearest' }); }
  }, [hi, open]);

  const onKey = (e) => {
    if (disabled) return;
    if (!open) { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openMenu(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, opts.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hi); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(opts.length - 1); }
    else if (e.key === 'Tab') close();
  };

  return (
    <>
      <button type="button" ref={btnRef} className={'select select-trigger ' + className} style={style} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())} onKeyDown={onKey}>
        <span className="select-value">{current ? current.label : (placeholder || '')}</span>
        <ChevronDown size={15} className="select-chev" />
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} className="select-menu" role="listbox"
          style={{ position: 'fixed', left: pos.left, top: pos.top, minWidth: pos.width }}>
          {opts.map((o, i) => (
            <div key={i} role="option" aria-selected={i === selIdx}
              className={'select-opt' + (i === hi ? ' hi' : '') + (i === selIdx ? ' sel' : '') + (o.disabled ? ' disabled' : '')}
              onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
              <span className="select-opt-label">{o.label}</span>
              {i === selIdx && <Check size={14} className="select-opt-check" />}
            </div>
          ))}
        </div>, document.body)}
    </>
  );
}

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

export function KpiCard({ icon: Icon, label, value, delta, deltaLabel, tone = 'brand', to }) {
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
  const inner = (<>
    <div className="top">
      <div className="ico" style={{ background: bg, color: fg }}>
        {Icon && <Icon size={19} />}
      </div>
      <div className="label">{label}</div>
      {to && <ArrowUpRight size={15} className="kpi-go" />}
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
  </>);
  if (to) return <Link to={to} className="card kpi kpi-link">{inner}</Link>;
  return <div className="card kpi">{inner}</div>;
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

export function Empty({ label = 'Noch keine Einträge', hint, action }) {
  return (
    <div className="empty">
      <Inbox size={38} />
      <div style={{ fontWeight: 600 }}>{label}</div>
      {hint && <div className="tiny" style={{ marginTop: 4 }}>{hint}</div>}
      {action && <button className="btn primary sm" style={{ marginTop: 12 }} onClick={action.onClick}>{action.label}</button>}
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
