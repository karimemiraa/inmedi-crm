import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Building2, MapPin, SlidersHorizontal } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Avatar, Badge, Empty, Select, SortTh } from '../components/ui.jsx';
import QuickAdd from '../components/QuickAdd.jsx';
import { useToast } from '../components/Toast.jsx';
import { useSort } from '../lib/useSort.js';
import { fieldsFor } from '../components/CustomFields.jsx';
import { exportCsv } from '../lib/csv.js';
import { fmtMoney, fmtDate } from '../lib/format.js';

const TYPE_TONE = { Krankenhaus: 'blue', Praxis: 'teal', Pflegeeinrichtung: 'purple', Apotheke: 'green', Großhändler: 'amber' };
const STATUS_TONE = { Aktiv: 'green', Gefährdet: 'red', Interessent: 'gray' };

export default function Accounts() {
  const db = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [terr, setTerr] = useState('All');
  const [cfId, setCfId] = useState('');    // Zusatzfeld-Filter: Feld-ID
  const [cfVal, setCfVal] = useState('');  // Zusatzfeld-Filter: Wert
  const [adding, setAdding] = useState(false);

  const customFields = fieldsFor(db, 'Firma');
  const cfField = customFields.find((f) => f.id === cfId);
  const { sort, toggle, apply } = useSort('name', 'asc');
  const owner = (id) => db.users.find((u) => u.id === id);

  const rows = useMemo(() => {
    const filtered = db.accounts.filter((a) => {
      if (type !== 'All' && a.type !== type) return false;
      if (terr !== 'All' && a.territoryId !== terr) return false;
      if (cfId && cfVal) {
        const v = a.customValues?.[cfId];
        if (cfField?.type === 'Auswahl') { if (v !== cfVal) return false; }
        else if (!String(v ?? '').toLowerCase().includes(cfVal.toLowerCase())) return false;
      }
      if (q && !a.name.toLowerCase().includes(q.toLowerCase()) && !a.city.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return apply(filtered, {
      kundennummer: (a) => a.kundennummer, name: (a) => a.name, type: (a) => a.type, tier: (a) => a.tier,
      owner: (a) => owner(a.ownerId)?.name, status: (a) => a.status, revenueYTD: (a) => a.revenueYTD,
    });
  }, [db.accounts, q, type, terr, cfId, cfVal, cfField, sort]);

  const toast = useToast();
  const terrName = (id) => db.territories.find((t) => t.id === id)?.name || '—';

  const doExport = () => {
    exportCsv('firmen.csv', [
      { label: 'Firma', get: (a) => a.name },
      { label: 'Typ', get: (a) => a.type },
      { label: 'Kategorie', get: (a) => a.tier },
      { label: 'Gebiet', get: (a) => terrName(a.territoryId) },
      { label: 'Betreuer', get: (a) => owner(a.ownerId)?.name },
      { label: 'Stadt', get: (a) => a.city },
      { label: 'Status', get: (a) => a.status },
      { label: 'Umsatz lfd. Jahr', get: (a) => a.revenueYTD },
    ], rows);
    toast('Firmen exportiert (CSV)');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Firmen</h1>
          <div className="sub">{db.accounts.length} Einrichtungen — Krankenhäuser, Kliniken, Apotheken & Großhändler</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={doExport}><Download size={15} /> Exportieren</button>
          <button className="btn primary" onClick={() => setAdding(true)}><Plus size={16} /> Neue Firma</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search" style={{ background: 'var(--surface)', maxWidth: 300 }}>
          <Search size={16} />
          <input placeholder="Firmen suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="select" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
          {[['All', 'Alle Typen'], ['Krankenhaus', 'Krankenhaus'], ['Praxis', 'Praxis'], ['Pflegeeinrichtung', 'Pflegeeinrichtung'], ['Apotheke', 'Apotheke'], ['Großhändler', 'Großhändler']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select className="select" style={{ width: 'auto' }} value={terr} onChange={(e) => setTerr(e.target.value)}>
          <option value="All">Alle Gebiete</option>
          {db.territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        {customFields.length > 0 && (
          <>
            <Select className="select" style={{ width: 'auto' }} value={cfId} onChange={(e) => { setCfId(e.target.value); setCfVal(''); }}>
              <option value="">Zusatzfeld-Filter…</option>
              {customFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </Select>
            {cfId && (cfField?.type === 'Auswahl'
              ? <Select className="select" style={{ width: 'auto' }} value={cfVal} onChange={(e) => setCfVal(e.target.value)}><option value="">Alle Werte</option>{cfField.options.map((o) => <option key={o}>{o}</option>)}</Select>
              : <input className="input" style={{ width: 160 }} placeholder="Wert enthält…" value={cfVal} onChange={(e) => setCfVal(e.target.value)} />)}
          </>
        )}
        <span className="muted tiny" style={{ marginLeft: 'auto' }}>{rows.length} angezeigt</span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap list">
          <table className="tbl">
            <thead>
              <tr>
                <SortTh label="Kundennr." sortKey="kundennummer" sort={sort} onSort={toggle} />
                <SortTh label="Firma" sortKey="name" sort={sort} onSort={toggle} />
                <SortTh label="Typ" sortKey="type" sort={sort} onSort={toggle} />
                <SortTh label="Kategorie" sortKey="tier" sort={sort} onSort={toggle} />
                <SortTh label="Außendienst" sortKey="owner" sort={sort} onSort={toggle} />
                <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
                <SortTh label="Umsatz lfd. Jahr" sortKey="revenueYTD" sort={sort} onSort={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} onClick={() => nav('/accounts/' + a.id)}>
                  <td className="muted nowrap tiny" style={{ fontWeight: 600 }}>{a.kundennummer}</td>
                  <td>
                    <div className="avatar-row">
                      <Avatar name={a.name} color={a.color} />
                      <div>
                        <div className="cell-main">{a.name}</div>
                        <div className="cell-sub"><MapPin size={11} style={{ verticalAlign: -1 }} /> {a.city}</div>
                      </div>
                    </div>
                  </td>
                  <td><Badge tone={TYPE_TONE[a.type]}>{a.type}</Badge></td>
                  <td>{a.tier}</td>
                  <td>{owner(a.ownerId) && <div className="avatar-row"><Avatar size="sm" name={owner(a.ownerId).name} color={owner(a.ownerId).color} /><span className="tiny">{owner(a.ownerId).name.split(' ')[0]}</span></div>}</td>
                  <td><Badge tone={STATUS_TONE[a.status]} dot>{a.status}</Badge></td>
                  <td className="right"><b>{fmtMoney(a.revenueYTD)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <Empty label="Keine Firmen für diese Filter" action={{ label: 'Neue Firma anlegen', onClick: () => setAdding(true) }} />}
        </div>
      </div>

      {adding && <QuickAdd initial="account" onClose={() => setAdding(false)} />}
    </div>
  );
}
