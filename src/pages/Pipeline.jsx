import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LayoutGrid, List, GripVertical } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { AccountLink, Avatar, Badge, ContactLink, Drawer, Empty, Field, ScoreMeter, Select, UserChip } from '../components/ui.jsx';
import { useOpenParam, openLink } from '../lib/nav.js';
import QuickAdd from '../components/QuickAdd.jsx';
import { useToast } from '../components/Toast.jsx';
import { CommentCount, RowActions, StatusBadge } from '../components/Vorgang.jsx';
import { vorgangLink } from '../lib/vorgang.js';
import { fmtMoney, fmtMoneyShort, fmtDate } from '../lib/format.js';

export default function Pipeline() {
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [view, setView] = useState('board');
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  useOpenParam(db.deals, (r) => nav(vorgangLink('deals', r.id), { replace: true }));

  const acct = (id) => db.accounts.find((a) => a.id === id);
  const owner = (id) => db.users.find((u) => u.id === id);

  const byStage = useMemo(() => {
    const map = {};
    db.stages.forEach((s) => { map[s.id] = db.deals.filter((d) => d.stage === s.id); });
    return map;
  }, [db.deals, db.stages]);

  const totalOpen = db.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0);

  const onDrop = (stageId) => {
    if (dragId) {
      const deal = db.deals.find((d) => d.id === dragId);
      if (deal && deal.stage !== stageId) {
        store.update('deals', dragId, { stage: stageId });
        toast(`Verschoben nach ${db.stages.find((s) => s.id === stageId).name}`);
      }
    }
    setDragId(null); setOverCol(null);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Vertriebs-Pipeline</h1><div className="sub">{db.deals.length} Deals · {fmtMoneyShort(totalOpen)} offener Pipeline-Wert</div></div>
        <div className="page-actions">
          <div className="seg">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><LayoutGrid size={15} /></button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={15} /></button>
          </div>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neuer Deal</button>
        </div>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {db.stages.map((s) => {
            const deals = byStage[s.id] || [];
            const sum = deals.reduce((a, d) => a + d.value, 0);
            return (
              <div
                key={s.id}
                className={'kcol' + (overCol === s.id ? ' drop-hint' : '')}
                onDragOver={(e) => { e.preventDefault(); setOverCol(s.id); }}
                onDragLeave={() => setOverCol((c) => (c === s.id ? null : c))}
                onDrop={() => onDrop(s.id)}
              >
                <div className="kcol__head">
                  <div className="t"><span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color }} />{s.name}<span className="count" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{deals.length}</span></div>
                  <div className="sum">{fmtMoneyShort(sum)}</div>
                </div>
                <div className="kcol__body">
                  {deals.map((d) => {
                    const a = acct(d.accountId), o = owner(d.ownerId);
                    return (
                      <div
                        key={d.id}
                        className={'deal-card' + (dragId === d.id ? ' dragging' : '')}
                        draggable
                        onDragStart={() => setDragId(d.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => nav(vorgangLink('deals', d.id))}
                      >
                        <div className="dc-name">{d.name}</div>
                        <div className="dc-acct">{a?.name}</div>
                        <div style={{ marginBottom: 10 }}><ScoreMeter value={d.score} /></div>
                        <div className="dc-foot">
                          <span className="dc-val">{fmtMoney(d.value)}</span>
                          {o && <Avatar size="sm" name={o.name} color={o.color} />}
                        </div>
                      </div>
                    );
                  })}
                  {deals.length === 0 && <div className="muted tiny" style={{ textAlign: 'center', padding: 16 }}>Deals hierher ziehen</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap list"><table className="tbl">
            <thead><tr><th>Deal</th><th>Konto</th><th>Phase</th><th>Betreuer</th><th>Score</th><th>Abschluss</th><th className="right">Wert</th><th className="right">Aktionen</th></tr></thead>
            <tbody>
              {db.deals.map((d) => (
                <tr key={d.id} onClick={() => nav(vorgangLink('deals', d.id))}>
                  <td className="cell-main">{d.name}</td>
                  <td><AccountLink account={acct(d.accountId)} /></td>
                  <td><Badge tone="blue" dot>{db.stages.find((s) => s.id === d.stage)?.name}</Badge></td>
                  <td><UserChip user={owner(d.ownerId)} short /></td>
                  <td><ScoreMeter value={d.score} /></td>
                  <td>{fmtDate(d.expectedClose)}</td>
                  <td className="right"><b>{fmtMoney(d.value)}</b></td>
                  <td className="right nowrap"><RowActions kind="deals" rec={d} toast={toast} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      {adding && <QuickAdd initial="deal" onClose={() => setAdding(false)} />}
    </div>
  );
}

