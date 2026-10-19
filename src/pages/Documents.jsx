import { useState, useMemo, useRef } from 'react';
import { Upload, Search, FileText, FileType2, FileSpreadsheet, File, ScanLine, CheckCircle2, AlertTriangle, Building2, Pencil, Trash2, Mail, RefreshCw, Settings2, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore, store } from '../data/store.js';
import { AccountLink, Avatar, Badge, Drawer, Empty, Field, KpiCard, Modal, Select, UserChip, UserLink } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { extractInvoiceFromFile } from '../lib/pdfExtract.js';
import { fmtMoney, fmtDate } from '../lib/format.js';
import { exportCsv } from '../lib/csv.js';
import { matchAccount, useIntakeSettings, useIntakeState, intakeConfigured, syncIntake, INVOICE_COLUMNS, POSITION_COLUMNS, positionRows } from '../lib/intake.js';
import { syncSummary, LiveBadge } from '../components/IntakeSettings.jsx';

const TYPE_TONE = { Vertrag: 'blue', Angebot: 'amber', Auftrag: 'teal', Katalog: 'purple', Präsentation: 'red', Regulatorisch: 'red', Sonstiges: 'gray' };

export default function Documents() {
  const db = useStore();
  const toast = useToast();
  const fileRef = useRef();
  const [tab, setTab] = useState('invoices');
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [importing, setImporting] = useState(false);
  const [selInv, setSelInv] = useState(null);
  const [editDoc, setEditDoc] = useState(null);
  const [invFilter, setInvFilter] = useState('all'); // all | review | email | upload
  const [invQ, setInvQ] = useState('');
  const intakeSettings = useIntakeSettings();
  const intake = useIntakeState();

  const delDoc = (d) => {
    if (!window.confirm(`Dokument „${d.name}" wirklich löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    store.remove('documents', d.id);
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Dokument gelöscht', entity: d.name });
    toast('Dokument gelöscht');
  };

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
  const reviewCount = inv.filter((i) => i.needsReview).length;
  const invRows = useMemo(() => {
    const ql = invQ.trim().toLowerCase();
    return inv.filter((i) => (invFilter === 'all' || (invFilter === 'review' && i.needsReview) || (invFilter === 'email' && i.source === 'email') || (invFilter === 'upload' && i.source !== 'email'))
      && (!ql || [i.rechnungsnummer, i.kundennummer, i.kundeName, i.lieferant, db.accounts.find((a) => a.id === i.accountId)?.name].some((v) => String(v || '').toLowerCase().includes(ql))));
  }, [inv, invFilter, invQ, db.accounts]);
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportInvoices = () => { exportCsv(`rechnungen-${stamp()}.csv`, INVOICE_COLUMNS(db), invRows); toast(`${invRows.length} Rechnung(en) exportiert`); };
  const exportPositions = () => { const rows = positionRows(invRows); exportCsv(`rechnungspositionen-${stamp()}.csv`, POSITION_COLUMNS(db), rows); toast(`${rows.length} Position(en) exportiert`); };
  const syncNow = async () => { const r = await syncIntake({ manual: true }); toast(!r ? 'Abgleich läuft bereits' : r.ok ? 'Abgeglichen: ' + syncSummary(r) : r.error); };

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
        <KpiCard icon={AlertTriangle} tone="amber" label="Zu prüfen" value={reviewCount} />
        <KpiCard icon={FileText} tone="teal" label="Dateien" value={db.documents.length} />
      </div>

      <div className="tabs">
        <button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>Rechnungen ({inv.length})</button>
        <button className={tab === 'files' ? 'active' : ''} onClick={() => setTab('files')}>Dateien ({db.documents.length})</button>
      </div>

      {tab === 'invoices' && (<>
        <div className="inv-intake">
          <Mail size={16} style={{ color: 'var(--brand)' }} />
          <div className="grow">
            {intakeConfigured(intakeSettings)
              ? <><LiveBadge live={intake.live} /> · E-Mail-Eingang · {intake.last ? <>zuletzt abgeglichen {new Date(intake.last.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} – {syncSummary(intake.last)}</> : 'noch nicht abgeglichen'}</>
              : <>E-Mail-Eingang ist nicht eingerichtet – Rechnungen werden nur manuell eingelesen.</>}
          </div>
          {intakeConfigured(intakeSettings)
            ? <button className="btn sm" onClick={syncNow} disabled={intake.running}><RefreshCw size={13} className={intake.running ? 'spin' : ''} /> Jetzt abgleichen</button>
            : <Link className="btn sm" to="/settings?tab=intake"><Settings2 size={13} /> Einrichten</Link>}
        </div>
        <div className="filter-bar">
          <div className="search" style={{ maxWidth: 300 }}>
            <Search size={16} /><input placeholder="Rechnungen suchen…" value={invQ} onChange={(e) => setInvQ(e.target.value)} aria-label="Rechnungen suchen" />
          </div>
          <div className="seg">
            {[['all', 'Alle'], ['review', `Zu prüfen (${reviewCount})`], ['email', 'E-Mail'], ['upload', 'Upload']].map(([k, l]) => (
              <button key={k} className={invFilter === k ? 'active' : ''} onClick={() => setInvFilter(k)}>{l}</button>
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <button className="btn sm" onClick={exportInvoices} disabled={!invRows.length}><Download size={13} /> Rechnungen (CSV)</button>
          <button className="btn sm" onClick={exportPositions} disabled={!invRows.length}><Download size={13} /> Positionen (CSV)</button>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Rechnungsnr.</th><th>Lieferant</th><th>Kundennr.</th><th>Kunde</th><th>Zugeordnet an</th><th>Datum</th><th>Quelle</th><th className="right">Gesamt</th></tr></thead>
            <tbody>
              {invRows.map((i) => {
                const a = acct(i.accountId); const rep = user(i.ownerId);
                return (
                  <tr key={i.id} onClick={() => setSelInv(i.id)}>
                    <td className="cell-main nowrap">{i.rechnungsnummer || i.fileName || '—'}{i.needsReview && <> <Badge tone="amber" dot>Zu prüfen</Badge></>}</td>
                    <td>{i.lieferant || '—'}</td>
                    <td className="nowrap"><b>{i.kundennummer || '—'}</b></td>
                    <td>{i.kundeName || '—'}</td>
                    <td>{a ? <><span className="tiny">{a.name}</span> · <UserChip user={rep} short /></> : <Badge tone="amber" dot>nicht zugeordnet</Badge>}</td>
                    <td className="nowrap">{i.datum || '—'}</td>
                    <td>{i.source === 'email' ? <Badge tone="blue"><Mail size={11} style={{ verticalAlign: -1 }} /> E-Mail</Badge> : <Badge tone="gray">Upload</Badge>}</td>
                    <td className="right"><b>{i.gesamt != null ? fmtMoney(i.gesamt) : '—'}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>{invRows.length === 0 && <Empty label={inv.length ? 'Keine Rechnungen für diesen Filter' : 'Noch keine Rechnungen eingelesen'} hint={inv.length ? 'Filter oder Suche anpassen.' : 'Oben rechts eine PDF-Rechnung importieren oder den E-Mail-Eingang einrichten.'} />}</div>
        </div>
      </>)}

      {tab === 'files' && (<>
        <div className="filter-bar">
          <div className="search" style={{ maxWidth: 300 }}>
            <Search size={16} /><input placeholder="Dokumente suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="select" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t === 'All' ? 'Alle Typen' : t}</option>)}
          </Select>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Dokument</th><th>Typ</th><th>Verknüpftes Konto</th><th>Besitzer</th><th>Größe</th><th>Datum</th><th className="right">Aktionen</th></tr></thead>
            <tbody>
              {rows.map((d) => { const Icon = iconFor(d.name); return (
                <tr key={d.id} onClick={() => setEditDoc(d)} title="Bearbeiten">
                  <td className="cell-main"><Icon size={16} style={{ verticalAlign: -3, marginRight: 9, color: 'var(--brand)' }} />{d.name}</td>
                  <td><Badge tone={TYPE_TONE[d.type] || 'gray'}>{d.type}</Badge></td>
                  <td>{acct(d.accountId)?.name || <span className="muted">Allgemein</span>}</td>
                  <td><UserChip user={user(d.ownerId)} short /></td>
                  <td className="muted">{d.size}</td>
                  <td className="nowrap">{fmtDate(d.date)}</td>
                  <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn sm" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => setEditDoc(d)}><Pencil size={15} /></button>
                    <button className="icon-btn sm" title="Löschen" aria-label="Löschen" onClick={() => delDoc(d)} style={{ marginLeft: 4 }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>{rows.length === 0 && <Empty label="Keine Dateien" />}</div>
        </div>
      </>)}

      {importing && <ImportInvoice db={db} onClose={() => setImporting(false)} toast={toast} />}
      {selInv && db.incomingInvoices.some((x) => x.id === selInv) && <InvoiceDrawer db={db} inv={db.incomingInvoices.find((x) => x.id === selInv)} toast={toast} onClose={() => setSelInv(null)} />}
      {editDoc && <DocEditModal db={db} doc={editDoc} onClose={() => setEditDoc(null)} onDelete={delDoc} toast={toast} />}
    </div>
  );
}

const DOC_TYPES = ['Vertrag', 'Angebot', 'Auftrag', 'Katalog', 'Präsentation', 'Regulatorisch', 'Sonstiges'];

function DocEditModal({ db, doc, onClose, onDelete, toast }) {
  const [name, setName] = useState(doc.name);
  const [type, setType] = useState(doc.type);
  const [accountId, setAccountId] = useState(doc.accountId || '');
  const matched = db.accounts.find((a) => a.id === accountId) || null;

  const save = () => {
    if (!name.trim()) { toast('Bitte einen Namen angeben'); return; }
    store.update('documents', doc.id, {
      name: name.trim(), type,
      accountId: matched ? matched.id : null,
      ownerId: matched ? matched.ownerId : doc.ownerId,
    });
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Dokument bearbeitet', entity: name.trim(), detail: matched ? 'Verknüpft mit ' + matched.name : 'Keine Zuordnung' });
    toast('Dokument gespeichert');
    onClose();
  };

  return (
    <Modal title="Dokument bearbeiten" onClose={onClose}
      footer={<>
        <button className="btn danger" onClick={() => { onDelete(doc); onClose(); }} style={{ marginRight: 'auto' }}><Trash2 size={15} /> Löschen</button>
        <button className="btn" onClick={onClose}>Abbrechen</button>
        <button className="btn primary" onClick={save}>Speichern</button>
      </>}>
      <Field label="Dokumentname"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Typ">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="Verknüpftes Konto">
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">— Allgemein (keine Zuordnung) —</option>
          {db.accounts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
            <option key={a.id} value={a.id}>{a.name}{a.kundennummer ? ` (${a.kundennummer})` : ''}</option>
          ))}
        </Select>
      </Field>
      {matched && (
        <div className="muted tiny" style={{ marginTop: -4 }}>
          Betreuer: <b>{db.users.find((u) => u.id === matched.ownerId)?.name || '—'}</b>
        </div>
      )}
    </Modal>
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
    const reasons = matched ? [] : ['Keine Firma zugeordnet'];
    const rec = {
      ...data, fileName, source: 'upload',
      accountId: matched ? matched.id : null,
      ownerId: matched ? matched.ownerId : null,
      importedAt: new Date().toISOString(), importedBy: db.meta.currentUserId,
      needsReview: reasons.length > 0, reviewReasons: reasons,
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
              <Select className="select" style={{ width: 220 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">— Nicht zuordnen —</option>
                {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.kundennummer})</option>)}
              </Select>
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

function InvoiceDrawer({ db, inv, toast, onClose }) {
  const a = db.accounts.find((x) => x.id === inv.accountId);
  const rep = db.users.find((u) => u.id === inv.ownerId);
  const me = db.meta.currentUserId;
  const log = (action, detail) => store.add('auditLog', { at: new Date().toISOString(), userId: me, action, entity: 'RE ' + (inv.rechnungsnummer || inv.fileName || ''), detail });
  const assign = (accountId) => {
    const acc = db.accounts.find((x) => x.id === accountId) || null;
    const reasons = (inv.reviewReasons || []).filter((r) => !/Firma zugeordnet|keiner Firma/.test(r));
    if (!acc) reasons.push('Keine Firma zugeordnet');
    store.update('incomingInvoices', inv.id, { accountId: acc?.id || null, ownerId: acc?.ownerId || null, reviewReasons: reasons, needsReview: reasons.length > 0 });
    log('Rechnung zugeordnet', acc ? acc.name : 'Zuordnung entfernt');
    toast(acc ? 'Zugeordnet: ' + acc.name : 'Zuordnung entfernt');
  };
  const markReviewed = () => {
    store.update('incomingInvoices', inv.id, { needsReview: false, reviewedAt: new Date().toISOString(), reviewedBy: me });
    log('Rechnung geprüft', (inv.reviewReasons || []).join(' | '));
    toast('Als geprüft markiert');
  };
  const del = () => {
    if (!window.confirm(`Rechnung „${inv.rechnungsnummer || inv.fileName}“ aus dem CRM löschen? Die Original-Mail im Postfach bleibt erhalten.`)) return;
    store.remove('incomingInvoices', inv.id);
    log('Rechnung gelöscht', inv.lieferant || '');
    toast('Rechnung gelöscht');
    onClose();
  };
  return (
    <Drawer title={'Rechnung ' + (inv.rechnungsnummer || inv.fileName || '')} onClose={onClose}
      footer={<>
        <button className="btn danger" onClick={del}><Trash2 size={14} /> Löschen</button>
        <span style={{ flex: 1 }} />
        {inv.needsReview && <button className="btn" onClick={markReviewed}><CheckCircle2 size={14} /> Als geprüft markieren</button>}
        <button className="btn primary" onClick={onClose}>Schließen</button>
      </>}>
      {inv.needsReview && (
        <div className="inv-review"><b><AlertTriangle size={14} style={{ verticalAlign: -2, color: 'var(--amber)' }} /> Zu prüfen</b>
          <ul>{(inv.reviewReasons || ['Bitte prüfen']).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <Field label="Zugeordnete Firma">
        <Select value={inv.accountId || ''} onChange={(e) => assign(e.target.value)} aria-label="Zugeordnete Firma">
          <option value="">— Nicht zugeordnet —</option>
          {db.accounts.slice().sort((x, y) => x.name.localeCompare(y.name)).map((x) => <option key={x.id} value={x.id}>{x.name}{x.kundennummer ? ` (${x.kundennummer})` : ''}</option>)}
        </Select>
      </Field>
      <dl className="kv" style={{ margin: '12px 0 16px' }}>
        <dt>Lieferant</dt><dd>{inv.lieferant || '—'}</dd>
        <dt>Datum</dt><dd>{inv.datum || '—'}</dd>
        <dt>Kundennummer</dt><dd><b>{inv.kundennummer || '—'}</b></dd>
        <dt>Kunde</dt><dd>{inv.kundeName || '—'}</dd>
        <dt>Zugeordnet</dt><dd>{a ? <><AccountLink account={a} /> → <UserLink user={rep} /></> : <Badge tone="amber" dot>nicht zugeordnet</Badge>}</dd>
        <dt>Referenz</dt><dd>{inv.referenz || '—'}</dd>
        <dt>Zahlbar bis</dt><dd>{inv.zahlbarBis || '—'}{inv.zahlungskonditionen ? ` (${inv.zahlungskonditionen})` : ''}</dd>
        <dt>Quelle</dt><dd>{inv.source === 'email' ? <>E-Mail von {inv.emailFrom || '—'}{inv.emailSubject ? <> · „{inv.emailSubject}“</> : null}</> : 'Manueller Upload'}</dd>
        <dt>Eingegangen</dt><dd>{fmtDate(inv.receivedAt || inv.importedAt)}</dd>
        <dt>Datei</dt><dd>{inv.fileName || '—'}</dd>
      </dl>
      <h3 style={{ fontSize: 14, marginBottom: 10 }}>Positionen ({(inv.items || []).length})</h3>
      <div className="card" style={{ overflow: 'hidden' }}><div className="table-wrap"><table className="tbl">
        <thead><tr><th>Artikelnr.</th><th>Bezeichnung</th><th className="right">Menge</th><th className="right">Betrag</th></tr></thead>
        <tbody>
          {(inv.items || []).map((it) => (
            <tr key={it.pos} style={{ cursor: 'default' }}>
              <td className="nowrap">{it.artikelnr || '—'}</td><td className="cell-main">{it.name}{it.lot ? <div className="tiny muted">LOT {it.lot}{it.ablauf ? ' · Ablauf ' + it.ablauf : ''}</div> : null}</td>
              <td className="right">{it.menge} {it.einheit}</td><td className="right"><b>{fmtMoney(it.betrag)}</b></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontWeight: 800, fontSize: 15, padding: '0 4px' }}>
        <span>Gesamt</span><span>{inv.gesamt != null ? fmtMoney(inv.gesamt) : '—'}</span>
      </div>
    </Drawer>
  );
}
