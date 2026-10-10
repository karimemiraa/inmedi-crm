import { useState, useMemo, useRef } from 'react';
import { Upload, Search, FileText, FileType2, FileSpreadsheet, File, ScanLine, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Empty, KpiCard, Modal, Drawer, Field } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { extractInvoiceFromFile } from '../lib/pdfExtract.js';
import { fmtMoney, fmtDate } from '../lib/format.js';

const TYPE_TONE = { Vertrag: 'blue', Angebot: 'amber', Auftrag: 'teal', Katalog: 'purple', Präsentation: 'red', Regulatorisch: 'red', Sonstiges: 'gray' };
const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const matchAccount = (db, kdnr) => {
  const d = onlyDigits(kdnr);
  if (!d) return null;
  return db.accounts.find((a) => onlyDigits(a.kundennummer) === d) || null;
};

export default function Documents() {
  const db = useStore();
  const toast = useToast();
  const fileRef = useRef();
  const [tab, setTab] = useState('invoices');
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [importing, setImporting] = useState(false);
  const [selInv, setSelInv] = useState(null);

  const guessType = (name) => {
    const l = name.toLowerCase();
    if (l.includes('vertrag')) return 'Vertrag';
    if (l.includes('angebot')) return 'Angebot';
    if (l.includes('auftrag') || l.includes('bestell')) return 'Auftrag';
    if (l.includes('katalog')) return 'Katalog';
    if (l.endsWith('.pptx')) return 'Präsentation';
    return 'Sonstiges';
  };
  const onUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      store.add('documents', {
        name: file.name, type: guessType(file.name), accountId: null,
        size: (file.size / 1024 > 1024 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.round(file.size / 1024) + ' KB'),
        date: new Date().toISOString(), ownerId: db.meta.currentUserId,
      });
    });
    if (files.length) toast(files.length + ' Dokument(e) hochgeladen');
    e.target.value = '';
  };

  const rows = useMemo(() => db.documents.filter((d) =>
    (type === 'All' || d.type === type) && (!q || d.name.toLowerCase().includes(q.toLowerCase()))
  ), [db.documents, q, type]);
  const types = useMemo(() => ['All', ...Array.from(new Set(db.documents.map((d) => d.type)))], [db.documents]);
  const acct = (id) => db.accounts.find((a) => a.id === id);
  const user = (id) => db.users.find((u) => u.id === id);
  const iconFor = (name) => name.endsWith('.pdf') ? FileText : name.endsWith('.docx') ? FileType2 : name.endsWith('.pptx') ? File : FileSpreadsheet;

  const inv = db.incomingInvoices;
  const assigned = inv.filter((i) => i.accountId).length;

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Dokumente</h1><div className="sub">Rechnungen automatisch einlesen & Dateien verwalten</div></div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setImporting(true)}><ScanLine size={16} /> Rechnung einlesen</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={15} /> Datei hochladen</button>
          <input ref={fileRef} type="file" multiple hidden onChange={onUpload} />
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={ScanLine} tone="brand" label="Eingelesene Rechnungen" value={inv.length} />
        <KpiCard icon={CheckCircle2} tone="green" label="Zugeordnet (Kundennr.)" value={assigned} />
        <KpiCard icon={FileText} tone="teal" label="Dateien" value={db.documents.length} />
        <KpiCard icon={AlertTriangle} tone="amber" label="Ohne Zuordnung" value={inv.length - assigned} />
      </div>

      <div className="tabs">
        <button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>Rechnungen ({inv.length})</button>
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>Dateien ({db.documents.length})</button>
      </div>

      {tab === 'invoices' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Rechnungsnr.</th><th>Lieferant</th><th>Kundennr.</th><th>Kunde</th><th>Zugeordnet an</th><th>Datum</th><th className="right">Gesamt</th></tr></thead>
            <tbody>
              {inv.map((i) => {
                const a = acct(i.accountId); const rep = user(i.ownerId);
                return (
                  <tr key={i.id} onClick={() => setSelInv(i)}>
                    <td className="cell-main nowrap">{i.rechnungsnummer || '—'}</td>
                    <td>{i.lieferant || '—'}</td>
                    <td className="nowrap"><b>{i.kundennummer || '—'}</b></td>
                    <td>{i.kundeName || '—'}</td>
                    <td>{a ? <div className="avatar-row"><Avatar size="sm" name={rep?.name || '?'} color={rep?.color} src={rep?.avatar} /><span className="tiny">{rep?.name.split(' ')[0] || '—'}</span></div> : <Badge tone="amber" dot>nicht zugeordnet</Badge>}</td>
                    <td className="nowrap">{i.datum || '—'}</td>
                    <td className="right"><b>{i.gesamt != null ? fmtMoney(i.gesamt) : '—'}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>{inv.length === 0 && <Empty label="Noch keine Rechnungen eingelesen" hint="Oben rechts eine PDF-Rechnung importieren." />}</div>
        </div>
      )}

      {tab === 'files' && (<>
        <div className="filter-bar">
          <div className="search" style={{ maxWidth: 300 }}>
            <Search size={16} /><input placeholder="Dokumente suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t === 'All' ? 'Alle Typen' : t}</option>)}
          </select>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Dokument</th><th>Typ</th><th>Verknüpftes Konto</th><th>Besitzer</th><th>Größe</th><th>Datum</th></tr></thead>
            <tbody>
              {rows.map((d) => { const Icon = iconFor(d.name); return (
                <tr key={d.id} style={{ cursor: 'default' }}>
                  <td className="cell-main"><Icon size={16} style={{ verticalAlign: -3, marginRight: 9, color: 'var(--brand)' }} />{d.name}</td>
                  <td><Badge tone={TYPE_TONE[d.type] || 'gray'}>{d.type}</Badge></td>
                  <td>{acct(d.accountId)?.name || <span className="muted">Allgemein</span>}</td>
                  <td>{user(d.ownerId)?.name.split(' ')[0]}</td>
                  <td className="muted">{d.size}</td>
                  <td className="nowrap">{fmtDate(d.date)}</td>
                </tr>
              ); })}
            </tbody>
          </table>{rows.length === 0 && <Empty label="Keine Dateien" />}</div>
        </div>
      </>)}

      {importing && <ImportInvoice db={db} onClose={() => setImporting(false)} toast={toast} />}
      {selInv && <InvoiceDrawer db={db} inv={selInv} onClose={() => setSelInv(null)} />}
    </div>
  );
}

function ImportInvoice({ db, onClose, toast }) {
  const fileRef = useRef();
  const [stage, setStage] = useState('pick'); // pick | loading | review | error
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [err, setErr] = useState('');

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setStage('loading'); setErr('');
    try {
      const parsed = await extractInvoiceFromFile(file);
      setData(parsed);
      const m = matchAccount(db, parsed.kundennummer);
      setAccountId(m ? m.id : '');
      setStage('review');
    } catch (ex) {
      setErr('Die PDF konnte nicht gelesen werden: ' + (ex?.message || ex));
      setStage('error');
    }
  };

  const matched = db.accounts.find((a) => a.id === accountId) || null;
  const rep = matched ? db.users.find((u) => u.id === matched.ownerId) : null;

  const save = () => {
    const rec = {
      ...data, fileName,
      accountId: matched ? matched.id : null,
      ownerId: matched ? matched.ownerId : null,
      importedAt: new Date().toISOString(), importedBy: db.meta.currentUserId,
    };
    store.add('incomingInvoices', rec);
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Rechnung eingelesen', entity: 'RE ' + (data.rechnungsnummer || ''), detail: `${data.lieferant || ''} · Kundennr. ${data.kundennummer || '—'}${matched ? ' → ' + matched.name : ''}` });
    toast('Rechnung gespeichert' + (matched ? ' & zugeordnet' : ''));
    onClose();
  };

  return (
    <Modal title="Rechnung einlesen (PDF)" wide onClose={onClose}
      footer={stage === 'review'
        ? <><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={save}>Speichern{matched ? ' & zuordnen' : ''}</button></>
        : <button className="btn" onClick={onClose}>Schließen</button>}>
      {stage === 'pick' && (
        <div style={{ textAlign: 'center', padding: '28px 10px' }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--brand-050)', color: 'var(--brand)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}><ScanLine size={26} /></div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>PDF-Rechnung auswählen</div>
          <div className="muted tiny" style={{ marginBottom: 16 }}>Rechnungsnummer, Kundennummer, Positionen, Mengen, Preise & Summen werden automatisch erkannt.</div>
          <button className="btn primary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Datei wählen</button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onFile} />
        </div>
      )}
      {stage === 'loading' && <div className="empty"><ScanLine size={34} /><div style={{ fontWeight: 600 }}>„{fileName}" wird gelesen…</div></div>}
      {stage === 'error' && <div className="login-error" style={{ marginTop: 0 }}><AlertTriangle size={15} /> {err}</div>}
      {stage === 'review' && data && (
        <div>
          {/* Zuordnung */}
          <div className="card card-pad" style={{ marginBottom: 16, background: matched ? 'var(--green-bg)' : 'var(--amber-bg)', borderColor: 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Building2 size={18} style={{ color: matched ? 'var(--green)' : 'var(--amber)' }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Kundennummer {data.kundennummer || '—'}</div>
                <div className="tiny" style={{ color: 'var(--text-2)' }}>
                  {matched ? <>Zugeordnet: <b>{matched.name}</b> → Betreuer <b>{rep?.name || '—'}</b></> : 'Kein Konto mit dieser Kundennummer gefunden — bitte manuell zuordnen.'}
                </div>
              </div>
              <select className="select" style={{ width: 220 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">— Nicht zuordnen —</option>
                {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.kundennummer})</option>)}
              </select>
            </div>
          </div>

          <div className="kv" style={{ marginBottom: 16 }}>
            <dt>Rechnungsnr.</dt><dd>{data.rechnungsnummer || '—'}</dd>
            <dt>Datum</dt><dd>{data.datum || '—'}</dd>
            <dt>Lieferant</dt><dd>{data.lieferant || '—'}</dd>
            <dt>Kunde</dt><dd>{data.kundeName || '—'}</dd>
            <dt>Leistungsempfänger</dt><dd>{data.leistungsempfaenger || '—'}</dd>
            <dt>Referenz</dt><dd>{data.referenz || '—'}</dd>
            <dt>Zahlbar bis</dt><dd>{data.zahlbarBis || '—'} ({data.zahlungskonditionen || '—'})</dd>
          </div>

          <h4 style={{ marginBottom: 8 }}>Positionen ({data.items.length})</h4>
          <div className="card" style={{ overflow: 'hidden', marginBottom: 14 }}><div className="table-wrap"><table className="tbl">
            <thead><tr><th>Pos</th><th>Artikelnr.</th><th>Bezeichnung</th><th className="right">Menge</th><th className="right">Preis</th><th>USt</th><th>LOT / Ablauf</th><th className="right">Betrag</th></tr></thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.pos} style={{ cursor: 'default' }}>
                  <td>{it.pos}</td>
                  <td className="nowrap">{it.artikelnr || '—'}</td>
                  <td className="cell-main">{it.name}</td>
                  <td className="right">{it.menge} {it.einheit}</td>
                  <td className="right">{fmtMoney(it.preis)}</td>
                  <td>{it.ust}%</td>
                  <td className="tiny muted nowrap">{it.lot || '—'}{it.ablauf ? ' · ' + it.ablauf : ''}</td>
                  <td className="right"><b>{fmtMoney(it.betrag)}</b></td>
                </tr>
              ))}
            </tbody>
          </table></div></div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 28, padding: '0 4px', fontSize: 14 }}>
            <span className="muted">Netto: <b style={{ color: 'var(--text)' }}>{data.netto != null ? fmtMoney(data.netto) : '—'}</b></span>
            <span style={{ fontWeight: 800 }}>Gesamt: {data.gesamt != null ? fmtMoney(data.gesamt) : '—'}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InvoiceDrawer({ db, inv, onClose }) {
  const a = db.accounts.find((x) => x.id === inv.accountId);
  const rep = db.users.find((u) => u.id === inv.ownerId);
  return (
    <Drawer title={'Rechnung ' + (inv.rechnungsnummer || '')} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Schließen</button>}>
      <dl className="kv" style={{ marginBottom: 16 }}>
        <dt>Lieferant</dt><dd>{inv.lieferant || '—'}</dd>
        <dt>Datum</dt><dd>{inv.datum || '—'}</dd>
        <dt>Kundennummer</dt><dd><b>{inv.kundennummer || '—'}</b></dd>
        <dt>Kunde</dt><dd>{inv.kundeName || '—'}</dd>
        <dt>Zugeordnet</dt><dd>{a ? <>{a.name} → {rep?.name}</> : <Badge tone="amber" dot>nicht zugeordnet</Badge>}</dd>
        <dt>Referenz</dt><dd>{inv.referenz || '—'}</dd>
        <dt>Zahlbar bis</dt><dd>{inv.zahlbarBis || '—'}</dd>
        <dt>Datei</dt><dd>{inv.fileName || '—'}</dd>
      </dl>
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>Positionen</h3>
      <div className="card" style={{ overflow: 'hidden' }}><table className="tbl">
        <thead><tr><th>Artikelnr.</th><th>Bezeichnung</th><th className="right">Menge</th><th className="right">Betrag</th></tr></thead>
        <tbody>
          {inv.items.map((it) => (
            <tr key={it.pos} style={{ cursor: 'default' }}>
              <td className="nowrap">{it.artikelnr || '—'}</td><td className="cell-main">{it.name}</td>
              <td className="right">{it.menge} {it.einheit}</td><td className="right"><b>{fmtMoney(it.betrag)}</b></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontWeight: 800, fontSize: 15, padding: '0 4px' }}>
        <span>Gesamt</span><span>{inv.gesamt != null ? fmtMoney(inv.gesamt) : '—'}</span>
      </div>
    </Drawer>
  );
}
