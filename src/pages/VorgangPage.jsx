import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, MessageSquare, Link2, History, FileText, ListPlus, AlertOctagon, ClipboardCheck,
  Copy, Package, Users, ShoppingCart, Receipt, FileSignature, CheckCircle2, Send, XCircle, Zap, RotateCcw, Building2,
} from 'lucide-react';
import { useStore } from '../data/store.js';
import { AccountLink, Badge, Card, Empty, RecordLink, Select, UserLink } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, fmtMoney } from '../lib/format.js';
import { ACT_LABEL } from '../lib/labels.js';
import { FIELDS, PRIO_TONE, SEV_TONE } from '../lib/vorgangFields.js';
import {
  VORGANG, kindBySlug, kindLabel, vorgangLink, vorgangName, statusOptions, statusInfo, statusValue, setVorgangStatus,
  updateVorgang, relationsOf, createLinked, requestDelete, duplicateVorgang, restoreVorgang, setItems, sumItems, nextNumber,
} from '../lib/vorgang.js';
import {
  DetailView, EditForm, toDraft, diffDraft, ItemsView, ItemsEditor, LinkRow, Comments, HistoryList,
} from '../components/Vorgang.jsx';
import { contractValues } from './Contracts.jsx';
import { generateOne, INTERVAL_MONTHS } from './RecurringOrders.jsx';
import { EventAttendees } from './Events.jsx';

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };

// Eigene Seite für jeden Vorgang / jedes Objekt: /vorgang/:slug/:id
export default function VorgangPage() {
  const { slug, id } = useParams();
  const kind = kindBySlug(slug);
  const db = useStore();
  const nav = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [itemsDraft, setItemsDraft] = useState(null);

  useEffect(() => { setTab('details'); setEditing(false); setItemsDraft(null); window.scrollTo(0, 0); }, [slug, id]);

  if (!kind) return <div className="page"><Empty label="Unbekannte Objektart" /></div>;
  const meta = VORGANG[kind];
  if (meta.detail) return <Navigate to={meta.detail(id)} replace />;
  const r = db[kind]?.find((x) => x.id === id);
  const back = () => (location.key !== 'default' ? nav(-1) : nav(meta.list));

  if (!r) {
    const t = (db.trash || []).find((x) => x.kind === kind && x.record.id === id);
    return (
      <div className="page">
        <button className="btn ghost sm" onClick={() => nav(meta.list)} style={{ marginBottom: 14 }}><ArrowLeft size={15} /> {meta.listLabel}</button>
        <Card>
          <Empty label={t ? `${kindLabel(kind, t.record)} liegt im Papierkorb` : `${meta.label} nicht gefunden`}
            hint={t ? vorgangName(kind, t.record) : 'Der Datensatz wurde endgültig gelöscht oder existiert nicht.'}
            action={t ? { label: 'Wiederherstellen', onClick: () => { restoreVorgang(t.id); toast('Wiederhergestellt'); } } : undefined} />
        </Card>
      </div>
    );
  }

  const label = kindLabel(kind, r);
  const fields = FIELDS[kind];
  const status = statusInfo(db, kind, r);
  const groups = relationsOf(db, kind, r);
  const linkCount = groups.reduce((s, g) => s + g.items.length, 0);
  const owner = db.users.find((u) => u.id === r.ownerId);
  const account = db.accounts.find((a) => a.id === r.accountId);
  const items = r.items || [];

  // ---- Aktionen ----
  const startEdit = () => { setDraft(toDraft(r, fields)); setEditing(true); setTab('details'); };
  const save = () => {
    const { patch, changed, error } = diffDraft(kind, r, fields, draft);
    if (error) { toast(error); return; }
    if (changed.length) { updateVorgang(kind, id, patch, 'Geändert: ' + changed.join(', ')); toast('Änderungen gespeichert'); }
    setEditing(false);
  };
  const remove = () => {
    const res = requestDelete(kind, id);
    if (res === 'trashed') { toast(label + ' in den Papierkorb verschoben'); nav(meta.list); }
  };
  const duplicate = () => {
    const copy = duplicateVorgang(kind, id);
    if (copy) { toast(label + ' dupliziert'); nav(vorgangLink(kind, copy.id)); }
  };
  const changeStatus = (value) => {
    if (kind === 'contracts' && value === 'Gekündigt' && r.status !== 'Gekündigt') { cancelContract(); return; }
    setVorgangStatus(kind, id, value);
    toast('Status: ' + (statusOptions(db, kind).find((o) => o.value === value)?.label || value));
  };
  const cancelContract = () => {
    const reason = window.prompt('Kündigungsgrund:', r.cancellationReason || '');
    if (reason === null) return;
    setVorgangStatus(kind, id, 'Gekündigt', { status: 'Gekündigt', cancellationReason: reason, cancelledAt: new Date().toISOString() });
    toast('Vertrag gekündigt');
  };
  const followUp = () => {
    createLinked('activities', {
      type: 'followup', subject: 'Nachfassen: ' + meta.title(r), accountId: r.accountId || null, contactId: r.contactId || null,
      dealId: kind === 'deals' ? r.id : r.dealId || null, ownerId: db.meta.currentUserId, dueDate: addDays(3),
      priority: r.priority || 'Mittel', notes: '', status: '',
    }, kind, id);
    toast('Folgeaufgabe angelegt'); setTab('links');
  };
  const toIncident = () => {
    const rec = createLinked('incidents', {
      number: nextNumber(db.incidents, 'VK-2026-015'), title: r.subject, type: 'Vorkommnis', severity: 'Mittel', productId: r.productId || null,
      lot: '', serial: '', accountId: r.accountId, status: '', reportedBy: db.meta.currentUserId, reportedAt: new Date().toISOString(),
      meldepflichtig: false, description: r.description || '', capaId: null,
    }, kind, id);
    toast('Vorkommnis ' + rec.number + ' erfasst'); setTab('links');
  };
  const toCapa = () => {
    const rec = createLinked('capas', {
      number: nextNumber(db.capas, 'CAPA-2026-009'), type: 'Korrektur', title: 'Maßnahme zu ' + (r.number || meta.title(r)), incidentId: id,
      ownerId: db.meta.currentUserId, status: '', dueDate: addDays(30), createdAt: new Date().toISOString(), description: '',
    }, kind, id);
    toast('CAPA ' + rec.number + ' angelegt'); setTab('links');
  };
  const dealToQuote = () => {
    const its = (r.products || []).map((pid) => db.products.find((p) => p.id === pid)).filter(Boolean).map((p) => ({ productId: p.id, name: p.name, qty: 1, price: p.price }));
    const rec = createLinked('orders', {
      number: nextNumber(db.orders, 'ANG-24500'), kind: 'Angebot', accountId: r.accountId, contactId: r.contactId || null, dealId: r.id,
      ownerId: r.ownerId, status: 'Entwurf', items: its, total: sumItems(its), date: new Date().toISOString(),
    }, kind, id);
    toast('Angebot ' + rec.number + ' erstellt'); nav(vorgangLink('orders', rec.id));
  };
  const quoteToOrder = () => {
    updateVorgang(kind, id, { kind: 'Auftrag', status: 'Bestätigt' }, 'Angebot in Auftrag umgewandelt');
    toast('Angebot ist jetzt ein Auftrag');
  };
  const orderToInvoice = () => {
    const its = items.map((it) => ({ ...it }));
    const rec = createLinked('invoices', {
      number: nextNumber(db.invoices, 'RE-25000'), accountId: r.accountId, ownerId: r.ownerId, orderId: r.id, status: 'Entwurf',
      issueDate: new Date().toISOString(), dueDate: addDays(30), items: its, total: sumItems(its), paid: 0,
    }, kind, id);
    toast('Rechnung ' + rec.number + ' erstellt'); nav(vorgangLink('invoices', rec.id));
  };
  const orderToContract = () => {
    const rec = createLinked('contracts', {
      number: nextNumber(db.contracts, 'V-1000'), title: 'Vertrag zu ' + r.number, accountId: r.accountId, contactId: r.contactId || null,
      ownerId: r.ownerId, status: 'Entwurf', startDate: new Date().toISOString(), termMonths: 12, fromOrderId: r.id,
      items: items.map((it) => ({ ...it, billing: 'jährlich' })), cancellationReason: '', description: '', createdAt: new Date().toISOString(), customValues: {},
    }, kind, id);
    toast('Vertrag ' + rec.number + ' angelegt'); nav(vorgangLink('contracts', rec.id));
  };
  const markPaid = () => { setVorgangStatus(kind, id, 'Bezahlt'); toast('Als bezahlt markiert'); };
  const sendInvoice = () => { updateVorgang(kind, id, r.status === 'Entwurf' ? { status: 'Versendet' } : {}, 'Rechnung per E-Mail versendet'); toast('Rechnung per E-Mail versendet'); };
  const generateNow = () => { const o = generateOne(db, r, 0); updateVorgang(kind, id, {}, 'Auftrag erzeugt: ' + o.number); toast('Auftrag ' + o.number + ' erzeugt'); setTab('links'); };

  const actions = [
    { label: 'Folgeaufgabe', icon: ListPlus, run: followUp, show: true },
    { label: 'Als QM-Vorkommnis erfassen', icon: AlertOctagon, run: toIncident, show: kind === 'tickets' },
    { label: 'CAPA anlegen', icon: ClipboardCheck, run: toCapa, show: kind === 'incidents' },
    { label: 'Angebot erstellen', icon: FileText, run: dealToQuote, show: kind === 'deals' },
    { label: 'In Auftrag umwandeln', icon: ShoppingCart, run: quoteToOrder, show: kind === 'orders' && r.kind === 'Angebot' },
    { label: 'Rechnung erstellen', icon: Receipt, run: orderToInvoice, show: kind === 'orders' && r.kind === 'Auftrag' },
    { label: 'Vertrag anlegen', icon: FileSignature, run: orderToContract, show: kind === 'orders' && r.kind === 'Auftrag' },
    { label: 'Als bezahlt markieren', icon: CheckCircle2, run: markPaid, show: kind === 'invoices' && r.status !== 'Bezahlt' },
    { label: 'Per E-Mail senden', icon: Send, run: sendInvoice, show: kind === 'invoices' },
    { label: 'Kündigen', icon: XCircle, run: cancelContract, show: kind === 'contracts' && r.status !== 'Gekündigt' },
    { label: 'Jetzt Auftrag erzeugen', icon: Zap, run: generateNow, show: kind === 'recurringOrders' },
  ].filter((a) => a.show);

  // ---- Kennzahlen je Art ----
  const kpis = [];
  if (kind === 'orders') kpis.push(['Summe', fmtMoney(r.total || 0)], ['Positionen', items.length], ['Rechnungen', db.invoices.filter((i) => i.orderId === r.id).length]);
  if (kind === 'invoices') kpis.push(['Rechnungsbetrag', fmtMoney(r.total || 0)], ['Bezahlt', fmtMoney(r.paid || 0)], ['Offen', fmtMoney((r.total || 0) - (r.paid || 0))]);
  if (kind === 'contracts') { const v = contractValues(items); kpis.push(['Jahreswert', fmtMoney(v.annual)], ['Einmalig', fmtMoney(v.once)], ['Laufzeit', (r.termMonths || 0) + ' Monate']); }
  if (kind === 'recurringOrders') { const s = sumItems(items); kpis.push(['Wert je Lauf', fmtMoney(s)], ['Monatswert', fmtMoney(s / (INTERVAL_MONTHS[r.interval] || 1))], ['Erzeugte Aufträge', (r.generatedOrderIds || []).length]); }
  if (kind === 'deals') kpis.push(['Wert', fmtMoney(r.value || 0)], ['Score', r.score ?? '—'], ['Angebote/Aufträge', db.orders.filter((o) => o.dealId === r.id).length]);
  if (kind === 'events') kpis.push(['Budget', fmtMoney(r.budget || 0)], ['Kosten', fmtMoney(r.cost || 0)], ['Teilnehmer', (r.attendees || []).length]);
  if (kind === 'campaigns') kpis.push(['Versendet', r.sent || 0], ['Öffnungsrate', r.sent ? Math.round((r.opened / r.sent) * 100) + ' %' : '—'], ['Klickrate', r.sent ? Math.round((r.clicked / r.sent) * 100) + ' %' : '—']);
  if (kind === 'products') kpis.push(['Preis', fmtMoney(r.price || 0)], ['Bestand', (r.stock ?? 0) + ' ' + (r.unit || '')], ['In Aufträgen', db.orders.filter((o) => (o.items || []).some((it) => it.productId === r.id)).length]);

  const tabs = [
    ['details', 'Details', FileText],
    ...(meta.items ? [['items', `Positionen (${items.length})`, Package]] : []),
    ...(kind === 'events' ? [['attendees', `Teilnehmer (${(r.attendees || []).length})`, Users]] : []),
    ...(kind === 'campaigns' ? [['members', `Empfänger (${(r.memberIds || []).length})`, Users]] : []),
    ['comments', `Kommentare (${r.comments?.length || 0})`, MessageSquare],
    ['links', `Verknüpfungen (${linkCount})`, Link2],
    ['history', 'Verlauf', History],
  ];

  return (
    <div className="page">
      <div className="vp-crumbs">
        <button className="btn ghost sm" onClick={back}><ArrowLeft size={15} /> Zurück</button>
        <span className="muted tiny"><Link to={meta.list} className="rec-link">{meta.listLabel}</Link> / {label} {vorgangName(kind, r)}</span>
      </div>

      <div className="card card-pad vp-hero">
        <div className="vp-hero-main">
          <div className="vp-kind">{label}{meta.number(r) ? ' · ' + meta.number(r) : ''}</div>
          <h1 className="vp-title">{meta.title(r)}</h1>
          <div className="vp-badges">
            <Badge tone={status.tone} dot>{status.label}</Badge>
            {r.priority && <Badge tone={PRIO_TONE[r.priority]}>Priorität: {r.priority}</Badge>}
            {r.severity && <Badge tone={SEV_TONE[r.severity]} dot>{r.severity}</Badge>}
            {r.meldepflichtig && <Badge tone="red" dot>Meldepflichtig</Badge>}
            {kind === 'activities' && r.type && <Badge tone="gray">{ACT_LABEL[r.type] || r.type}</Badge>}
            {r.category && <Badge tone="gray">{r.category}</Badge>}
            {kind === 'events' && r.type && <Badge tone="gray">{r.type}</Badge>}
          </div>
          <div className="vp-meta">
            {account && <span><Building2 size={13} /> <AccountLink account={account} /></span>}
            {owner && <span>Betreuer: <UserLink user={owner} /></span>}
            {(r.date || r.issueDate || r.createdAt || r.reportedAt || r.dueDate) && <span>{fmtDate(r.date || r.issueDate || r.createdAt || r.reportedAt || r.dueDate)}</span>}
          </div>
        </div>
        <div className="vp-hero-side">
          <div className="vp-status">
            <span className="muted tiny">Status</span>
            <Select value={statusValue(kind, r)} onChange={(e) => changeStatus(e.target.value)} aria-label="Status">
              {statusOptions(db, kind).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="vp-buttons">
            <button className="btn" onClick={() => setTab('comments')}><MessageSquare size={14} /> Kommentieren</button>
            <button className="btn" onClick={duplicate}><Copy size={14} /> Duplizieren</button>
            <button className="btn danger" onClick={remove}><Trash2 size={14} /> Löschen</button>
            <button className="btn primary" onClick={startEdit}><Pencil size={14} /> Bearbeiten</button>
          </div>
        </div>
      </div>

      {kpis.length > 0 && (
        <div className="vp-kpis">
          {kpis.map(([k, v]) => <div key={k} className="card vp-kpi"><span>{k}</span><b>{v}</b></div>)}
        </div>
      )}

      {actions.length > 0 && (
        <div className="vp-actions">
          {actions.map((a) => <button key={a.label} className="btn sm" onClick={a.run}><a.icon size={14} /> {a.label}</button>)}
        </div>
      )}

      <div className="tabs">
        {tabs.map(([k, l, Icon]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}><Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{l}</button>)}
      </div>

      {tab === 'details' && (
        <Card title={editing ? label + ' bearbeiten' : 'Details'}
          action={!editing && <button className="btn sm ghost" onClick={startEdit}><Pencil size={13} /> Bearbeiten</button>}>
          {editing
            ? <>
                <EditForm db={db} kind={kind} fields={fields} draft={draft} setDraft={setDraft} selfId={id} />
                <div className="vp-form-foot">
                  <button className="btn" onClick={() => setEditing(false)}>Abbrechen</button>
                  <button className="btn primary" onClick={save}>Speichern</button>
                </div>
              </>
            : <DetailView db={db} kind={kind} r={r} fields={fields} />}
        </Card>
      )}

      {tab === 'items' && (
        <Card title="Positionen" pad={!itemsDraft}
          action={!itemsDraft
            ? <button className="btn sm primary" onClick={() => setItemsDraft(items.map((it) => ({ ...it })))}><Pencil size={13} /> Positionen bearbeiten</button>
            : null}>
          {itemsDraft ? (
            <div style={{ padding: 16 }}>
              <ItemsEditor db={db} items={itemsDraft} setItems={setItemsDraft} billing={meta.billing} />
              <div className="vp-form-foot">
                <button className="btn" onClick={() => setItemsDraft(null)}>Abbrechen</button>
                <button className="btn primary" onClick={() => { setItems(kind, id, itemsDraft.filter((it) => it.qty > 0)); setItemsDraft(null); toast('Positionen gespeichert'); }}>Positionen speichern</button>
              </div>
            </div>
          ) : (
            <>
              <ItemsView db={db} items={items} billing={meta.billing} />
              <div className="vp-total"><span>Gesamt</span><span>{fmtMoney(sumItems(items))}</span></div>
            </>
          )}
        </Card>
      )}

      {tab === 'attendees' && <Card><EventAttendees db={db} event={r} toast={toast} /></Card>}

      {tab === 'members' && (
        <Card title="Empfänger" sub={r.segment} pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Name</th><th>Art</th></tr></thead>
            <tbody>
              {(r.memberIds || []).map((mid) => {
                const isAcc = r.memberType === 'account';
                const m = (isAcc ? db.accounts : db.contacts).find((x) => x.id === mid);
                return (
                  <tr key={mid} style={{ cursor: 'default' }}>
                    <td className="cell-main"><RecordLink to={m ? (isAcc ? '/accounts/' : '/contacts/') + mid : null} label={m?.name || '(gelöscht)'} /></td>
                    <td>{isAcc ? 'Firma' : 'Ansprechpartner'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>{!(r.memberIds || []).length && <Empty label="Keine Empfänger" />}</div>
        </Card>
      )}

      {tab === 'comments' && <Card title="Kommentare"><Comments db={db} kind={kind} r={r} toast={toast} /></Card>}

      {tab === 'links' && (
        <Card title="Verknüpfungen" sub="Alle zusammenhängenden Vorgänge — ein Klick öffnet die jeweilige Seite.">
          {groups.length === 0 && <div className="muted tiny" style={{ marginBottom: 14 }}>Noch keine verknüpften Vorgänge — über die Aktionen oben anlegen.</div>}
          {groups.map((g) => (
            <div key={g.label} className="vg-link-group">
              <div className="vg-link-head">{g.label} ({g.items.length})</div>
              {g.items.map((it) => <LinkRow key={it.kind + it.id} db={db} kind={it.kind} id={it.id} rec={it.rec} />)}
            </div>
          ))}
          <div className="vg-link-group">
            <div className="vg-link-head">Stammdaten</div>
            <dl className="kv">
              {'accountId' in r && <><dt>Firma</dt><dd><AccountLink account={account} /></dd></>}
              {'contactId' in r && <><dt>Ansprechpartner</dt><dd>{r.contactId ? <RecordLink to={'/contacts/' + r.contactId} label={db.contacts.find((c) => c.id === r.contactId)?.name} /> : '—'}</dd></>}
              {'ownerId' in r && <><dt>Betreuer</dt><dd><UserLink user={owner} /></dd></>}
              {account && <><dt>Außendienst Firma</dt><dd><UserLink user={db.users.find((u) => u.id === account.ownerId)} /></dd></>}
              {account?.innendienstId && <><dt>Innendienst Firma</dt><dd><UserLink user={db.users.find((u) => u.id === account.innendienstId)} /></dd></>}
            </dl>
          </div>
        </Card>
      )}

      {tab === 'history' && <Card title="Verlauf"><HistoryList db={db} kind={kind} r={r} /></Card>}

      {editing && tab !== 'details' && (
        <div className="vp-editing-hint"><RotateCcw size={13} /> Ungespeicherte Änderungen in „Details" — <button className="rec-link" onClick={() => setTab('details')}>zurück zum Formular</button></div>
      )}
    </div>
  );
}
