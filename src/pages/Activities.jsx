import { useState, useMemo } from 'react';
import { Plus, Phone, Users, CheckCircle2, Mail, CalendarCheck, List, Calendar as CalIcon } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Empty, KpiCard, AccountLink, ContactLink } from '../components/ui.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import { relDate, fmtDate } from '../lib/format.js';

const ICON = { call: Phone, meeting: Users, task: CheckCircle2, email: Mail, followup: CalendarCheck };
const TONE = { call: 'blue', meeting: 'purple', task: 'teal', email: 'amber', followup: 'brand' };
const NOW = new Date();

export default function Activities() {
  const db = useStore();
  const [view, setView] = useState('list');
  const [filter, setFilter] = useState('open');
  const [adding, setAdding] = useState(false);

  const acct = (id) => db.accounts.find((a) => a.id === id);

  const list = useMemo(() => {
    let r = [...db.activities];
    if (filter === 'open') r = r.filter((a) => !a.done);
    if (filter === 'done') r = r.filter((a) => a.done);
    if (filter === 'overdue') r = r.filter((a) => !a.done && new Date(a.dueDate) < NOW);
    return r.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [db.activities, filter]);

  const overdue = db.activities.filter((a) => !a.done && new Date(a.dueDate) < NOW).length;
  const today = db.activities.filter((a) => !a.done && fmtDate(a.dueDate) === fmtDate(NOW.toISOString())).length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Aktivitäten</h1><div className="sub">Aufgaben, Anrufe, Termine & Nachfassaktionen</div></div>
        <div className="page-actions">
          <div className="seg">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={15} /></button>
            <button className={view === 'cal' ? 'active' : ''} onClick={() => setView('cal')}><CalIcon size={15} /></button>
          </div>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neue Aktivität</button>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={CalendarCheck} tone="brand" label="Offen" value={db.activities.filter((a) => !a.done).length} />
        <KpiCard icon={CheckCircle2} tone="amber" label="Heute fällig" value={today} />
        <KpiCard icon={Phone} tone="red" label="Überfällig" value={overdue} />
        <KpiCard icon={CheckCircle2} tone="green" label="Erledigt" value={db.activities.filter((a) => a.done).length} />
      </div>

      {view === 'list' ? (<>
        <div className="filter-bar">
          <div className="seg">
            {[['open', 'Offen'], ['overdue', 'Überfällig'], ['done', 'Erledigt'], ['all', 'Alle']].map(([k, l]) => (
              <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {list.length === 0 && <Empty label="Keine Aktivitäten" />}
          {list.map((a) => {
            const Icon = ICON[a.type] || CheckCircle2;
            const isOverdue = !a.done && new Date(a.dueDate) < NOW;
            return (
              <div key={a.id} className="list-row" style={{ padding: '13px 18px' }}>
                <label className="check"><input type="checkbox" checked={a.done} onChange={() => store.update('activities', a.id, { done: !a.done })} /></label>
                <span className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: `var(--${TONE[a.type] === 'brand' ? 'brand-050' : TONE[a.type] + '-bg'})`, color: `var(--${TONE[a.type] === 'brand' ? 'brand' : TONE[a.type]})` }}><Icon size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--text-3)' : 'var(--text)' }}>{a.subject}</div>
                  <div className="muted tiny stat-line" style={{ gap: 6, flexWrap: 'wrap' }}><AccountLink account={acct(a.accountId)} />{a.contactId && <> · <ContactLink contact={db.contacts.find((c) => c.id === a.contactId)} /></>} · {db.users.find((u) => u.id === a.ownerId)?.name.split(' ')[0]}</div>
                </div>
                <Badge tone={a.priority === 'Hoch' ? 'red' : a.priority === 'Niedrig' ? 'gray' : 'amber'}>{a.priority}</Badge>
                <Badge tone={a.done ? 'green' : isOverdue ? 'red' : 'blue'}>{a.done ? 'Erledigt' : relDate(a.dueDate)}</Badge>
              </div>
            );
          })}
        </div>
      </>) : <CalendarView db={db} acct={acct} />}

      {adding && <QuickAdd initial="activity" onClose={() => setAdding(false)} />}
    </div>
  );
}

function CalendarView({ db, acct }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-start offset
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const actsForDay = (d) => db.activities.filter((a) => {
    const dt = new Date(a.dueDate);
    return dt.getMonth() === month && dt.getFullYear() === year && dt.getDate() === d;
  });

  const TONE = { call: 'blue', meeting: 'purple', task: 'teal', email: 'amber', followup: 'brand' };
  const monthLabel = today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <div className="card card-pad">
      <h3 style={{ marginBottom: 14 }}>{monthLabel}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
          <div key={d} className="muted tiny" style={{ fontWeight: 700, textAlign: 'center', paddingBottom: 4 }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const acts = actsForDay(d);
          const isToday = d === today.getDate();
          return (
            <div key={i} style={{ minHeight: 92, border: '1px solid var(--border)', borderRadius: 9, padding: 7, background: isToday ? 'var(--brand-050)' : 'var(--surface)' }}>
              <div style={{ fontWeight: isToday ? 800 : 600, fontSize: 12.5, color: isToday ? 'var(--brand)' : 'var(--text-2)', marginBottom: 4 }}>{d}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {acts.slice(0, 3).map((a) => (
                  <div key={a.id} className={'badge ' + (TONE[a.type] === 'brand' ? 'teal' : TONE[a.type])} style={{ fontSize: 10, padding: '2px 6px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={a.subject}>{a.subject}</div>
                ))}
                {acts.length > 3 && <span className="muted tiny">+{acts.length - 3} weitere</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
