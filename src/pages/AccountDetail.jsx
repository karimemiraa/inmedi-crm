import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Phone, MapPin, Building2, BedDouble, CalendarCheck, Star, FileText,
  Pencil, Plus, Trash2, Hash, Percent, Receipt, CheckSquare, Clock, FileSignature,
  LifeBuoy, Presentation, ShieldAlert, Copy, MessageSquare, Archive,
} from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Card, ContactLink, Empty, Field, Modal, ScoreMeter, Select, UserLink } from '../components/ui.jsx';
import { Comments, EditForm, HistoryList, toDraft, diffDraft } from '../components/Vorgang.jsx';
import { FIELDS } from '../lib/vorgangFields.js';
import { statusTone } from '../lib/status.js';
import { vorgangLink, updateVorgang, requestDelete, duplicateVorgang, statusOptions, setVorgangStatus } from '../lib/vorgang.js';
import QuickAdd from '../components/QuickAdd.jsx';
import { CustomFieldsEditor, CustomFieldsDisplay } from '../components/CustomFields.jsx';
import { openLink } from '../lib/nav.js';
import { useToast } from '../components/Toast.jsx';
import { ACT_LABEL } from '../lib/labels.js';
import { fmtMoney, fmtMoneyShort, fmtDate, relDate } from '../lib/format.js';

const TABS = [
  { key: 'overview', label: 'Übersicht' },
  { key: 'custom', label: 'Zusatzfelder' },
  { key: 'comments', label: 'Kommentare' },
  { key: 'process', label: 'Vorgänge' },
  { key: 'recurring', label: 'Daueraufträge' },
  { key: 'conditions', label: 'Konditionen' },
  { key: 'contacts', label: 'Ansprechpartner' },
  { key: 'deals', label: 'Deals' },
  { key: 'activities', label: 'Aktivitäten' },
  { key: 'invoices', label: 'Rechnungen' },
  { key: 'serviceqm', label: 'Kundendienst & QM' },
  { key: 'events', label: 'Messen' },
  { key: 'documents', label: 'Dokumente' },
  { key: 'history', label: 'Verlauf' },
];
const INV_TONE = { Entwurf: 'gray', Versendet: 'blue', Teilbezahlt: 'amber', Bezahlt: 'green', Überfällig: 'red' };
const STATUS_TONE = { Aktiv: 'green', Gefährdet: 'red', Interessent: 'blue', Inaktiv: 'gray' };

export default function AccountDetail() {
  const { id } = useParams();
  const db = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [draft, setDraft] = useState(null); // Bearbeitungsmodus
  const [quick, setQuick] = useState(null); // { actType }

  const a = db.accounts.find((x) => x.id === id);
  if (!a) {
    const t = (db.trash || []).find((x) => x.kind === 'accounts' && x.record.id === id);
    return <div className="page"><Card><Empty label={t ? 'Firma liegt im Papierkorb' : 'Firma nicht gefunden'} hint={t ? t.record.name : undefined} action={t ? { label: 'Zum Papierkorb', onClick: () => nav('/settings?tab=data') } : undefined} /></Card></div>;
  }
  const fields = FIELDS.accounts;
  const startEdit = () => { setDraft(toDraft(a, fields)); setTab('overview'); };
  const save = () => {
    const { patch, changed, error } = diffDraft('accounts', a, fields, draft);
    if (error) { toast(error); return; }
    if (changed.length) { updateVorgang('accounts', a.id, patch, 'Geändert: ' + changed.join(', ')); toast('Firma gespeichert'); }
    setDraft(null);
  };
  const remove = () => {
    const res = requestDelete('accounts', a.id);
    if (res === 'trashed') { toast('Firma in den Papierkorb verschoben'); nav('/accounts'); }
    if (res === 'inactive') toast('Firma als inaktiv markiert');
  };
  const duplicate = () => { const c = duplicateVorgang('accounts', a.id); if (c) { toast('Firma dupliziert'); nav('/accounts/' + c.id); } };
  const assign = (key, label, value) => {
    const name = key === 'territoryId' ? db.territories.find((t) => t.id === value)?.name : db.users.find((u) => u.id === value)?.name;
    updateVorgang('accounts', a.id, { [key]: value }, `${label}: ${name || '—'}`);
    toast(label + ' zugewiesen');
  };

  const contacts = db.contacts.filter((c) => c.accountId === id);
  const deals = db.deals.filter((d) => d.accountId === id);
  const orders = db.orders.filter((o) => o.accountId === id);
  const invoices = db.invoices.filter((o) => o.accountId === id);
  const activities = db.activities.filter((x) => x.accountId === id).sort((x, y) => new Date(y.dueDate) - new Date(x.dueDate));
  const docs = db.documents.filter((d) => d.accountId === id);
  const tickets = db.tickets.filter((t) => t.accountId === id);
  const incidents = db.incidents.filter((i) => i.accountId === id);
  const events = db.events.filter((e) => (e.attendees || []).some((at) => at.refType === 'account' && at.refId === id));
  const recurring = db.recurringOrders.filter((r) => r.accountId === id);
  const aussen = db.users.find((u) => u.id === a.ownerId);
  const innen = db.users.find((u) => u.id === a.innendienstId);
  const terr = db.territories.find((t) => t.id === a.territoryId);
  const stage = (s) => db.stages.find((x) => x.id === s);
  const uname = (uid) => db.users.find((u) => u.id === uid)?.name || '—';

  const openPipe = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0);
  const wonVal = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value, 0);
  const openItems = invoices.reduce((s, i) => s + (i.total - i.paid), 0);

  return (
    <div className="page">
      <button className="btn ghost sm" onClick={() => nav('/accounts')} style={{ marginBottom: 14 }}><ArrowLeft size={15} /> Firmen</button>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div className="detail-hero">
            <Avatar name={a.name} color={a.color} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 21 }}>{a.name}</h1>
                <Badge tone={STATUS_TONE[a.status]} dot>{a.status}</Badge>
                <span className="chip" style={{ padding: '3px 9px' }}><Hash size={12} /> {a.kundennummer}</span>
              </div>
              <div className="stat-line muted tiny" style={{ marginTop: 6, gap: 16, flexWrap: 'wrap' }}>
                <span><Building2 size={13} style={{ verticalAlign: -2 }} /> {a.type}</span>
                <span><MapPin size={13} style={{ verticalAlign: -2 }} /> {a.zip} {a.city}</span>
                <span><Star size={13} style={{ verticalAlign: -2 }} /> {a.tier}</span>
                {a.beds > 0 && <span><BedDouble size={13} style={{ verticalAlign: -2 }} /> {a.beds} Betten</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setQuick({ actType: 'task' })}><CheckSquare size={15} /> Aufgabe</button>
            <button className="btn" onClick={() => setQuick({ actType: 'meeting' })}><Clock size={15} /> Termin</button>
            <button className="btn" onClick={() => setTab('comments')}><MessageSquare size={15} /> Kommentieren</button>
            <button className="btn" onClick={duplicate}><Copy size={15} /> Duplizieren</button>
            <button className="btn danger" onClick={remove}><Trash2 size={15} /> Löschen</button>
            <button className="btn primary" onClick={startEdit}><Pencil size={15} /> Bearbeiten</button>
            <div className="vp-status" style={{ width: 170 }}>
              <Select value={a.status} onChange={(e) => { setVorgangStatus('accounts', a.id, e.target.value); toast('Status: ' + e.target.value); }} aria-label="Status">
                {statusOptions(db, 'accounts').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          </div>
        </div>

        <div className="grid cols-4" style={{ marginTop: 20 }}>
          <MiniStat label="Offene Pipeline" value={fmtMoneyShort(openPipe)} tone="brand" />
          <MiniStat label="Gewonnen" value={fmtMoneyShort(wonVal)} tone="green" />
          <MiniStat label="Umsatz lfd. Jahr" value={fmtMoney(a.revenueYTD)} tone="teal" />
          <MiniStat label="Offene Posten" value={fmtMoney(openItems)} tone={openItems > 0 ? 'red' : 'purple'} />
        </div>
      </div>

      {a.status === 'Inaktiv' && (
        <div className="inactive-banner"><Archive size={15} /> Diese Firma ist inaktiv und wird in Listen ausgeblendet. Alle Daten bleiben erhalten.
          <button className="btn sm" onClick={() => { setVorgangStatus('accounts', a.id, 'Aktiv'); toast('Firma reaktiviert'); }}>Reaktivieren</button>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'comments' && ` (${a.comments?.length || 0})`}
            {t.key === 'contacts' && ` (${contacts.length})`}
            {t.key === 'deals' && ` (${deals.length})`}
            {t.key === 'invoices' && ` (${invoices.length})`}
            {t.key === 'recurring' && ` (${recurring.length})`}
            {t.key === 'serviceqm' && ` (${tickets.length + incidents.length})`}
            {t.key === 'events' && ` (${events.length})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && draft && (
        <Card title="Firma bearbeiten" sub="Alle Stammdaten inkl. Zusatzfelder — Änderungen werden im Verlauf protokolliert.">
          <EditForm db={db} kind="accounts" fields={fields} draft={draft} setDraft={setDraft} selfId={a.id} />
          <div className="vp-form-foot">
            <button className="btn" onClick={() => setDraft(null)}>Abbrechen</button>
            <button className="btn primary" onClick={save}>Speichern</button>
          </div>
        </Card>
      )}

      {tab === 'overview' && !draft && (
        <div className="grid cols-2">
          <Card title="Stammdaten" action={<button className="btn ghost sm" onClick={startEdit}><Pencil size={13} /> Bearbeiten</button>}>
            <dl className="kv">
              <dt>Kundennummer</dt><dd>{a.kundennummer}</dd>
              <dt>Typ</dt><dd>{a.type}</dd>
              <dt>Kategorie</dt><dd>{a.tier}</dd>
              <dt>Adresse</dt><dd>{a.street}, {a.zip} {a.city}</dd>
              <dt>Telefon</dt><dd>{a.phone}</dd>
              <dt>E-Mail</dt><dd>{a.email}</dd>
              <dt>Website</dt><dd>{a.website}</dd>
              <dt>USt-IdNr.</dt><dd>{a.vatId}</dd>
              <dt>Kunde seit</dt><dd>{fmtDate(a.createdAt)}</dd>
            </dl>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card title="Zuständigkeit & Betreuung" sub="Kundenbetreuer direkt zuweisen">
              <div className="kv">
                <span style={{ color: 'var(--text-3)', alignSelf: 'center' }}>Außendienst{aussen && <> · <UserLink user={aussen} /></>}</span>
                <Select className="select" value={a.ownerId} onChange={(e) => assign('ownerId', 'Außendienst', e.target.value)}>
                  {db.users.filter((u) => u.role !== 'Administrator').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
                <span style={{ color: 'var(--text-3)', alignSelf: 'center' }}>Innendienst{innen && <> · <UserLink user={innen} /></>}</span>
                <Select className="select" value={a.innendienstId} onChange={(e) => assign('innendienstId', 'Innendienst', e.target.value)}>
                  {db.users.filter((u) => u.role !== 'Administrator').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
                <span style={{ color: 'var(--text-3)', alignSelf: 'center' }}>Gebiet</span>
                <Select className="select" value={a.territoryId} onChange={(e) => assign('territoryId', 'Gebiet', e.target.value)}>
                  {db.territories.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
            </Card>
            <Card title="Letzte Aktivitäten" pad={false}>
              <div style={{ padding: '16px 20px' }}>
                {activities.length === 0 && <Empty label="Noch keine Aktivitäten" />}
                <div className="timeline">
                  {activities.slice(0, 5).map((act) => (
                    <div key={act.id} className="tl-item">
                      <span className="tl-dot" />
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{act.subject}</div>
                      <div className="tl-time">{ACT_LABEL[act.type]} · {relDate(act.dueDate)} · {act.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'custom' && (
        <Card title="Zusatzfelder" sub="Individuelle Felder (Einstellungen → Benutzerdefinierte Felder)"
          action={<button className="btn ghost sm" onClick={startEdit}><Pencil size={13} /> Bearbeiten</button>}>
          <CustomFieldsDisplay db={db} entity="Firma" record={a} />
        </Card>
      )}

      {tab === 'comments' && <Card title="Kommentare" sub="Sichtbar für Außendienst, Innendienst & Kundendienst"><Comments db={db} kind="accounts" r={a} toast={toast} /></Card>}

      {tab === 'history' && <Card title="Verlauf"><HistoryList db={db} kind="accounts" r={a} /></Card>}

      {tab === 'conditions' && <Conditions account={a} db={db} toast={toast} />}

      {tab === 'contacts' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Name</th><th>Position</th><th>E-Mail</th><th>Telefon</th><th>Letzter Kontakt</th></tr></thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} onClick={() => nav('/contacts/' + c.id)}>
                <td><div className="avatar-row"><Avatar size="sm" name={c.name} color={c.color} /><span className="cell-main">{c.name} {c.isPrimary && <Badge tone="brand">Hauptkontakt</Badge>}</span></div></td>
                <td>{c.title}</td><td className="muted">{c.email}</td><td className="muted">{c.phone}</td><td>{relDate(c.lastContact)}</td>
              </tr>
            ))}
          </tbody></table>{contacts.length === 0 && <Empty label="Keine Kontakte" />}</div></Card>
      )}

      {tab === 'deals' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Deal</th><th>Phase</th><th>Score</th><th>Erw. Abschluss</th><th className="right">Wert</th></tr></thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} onClick={() => nav(vorgangLink('deals', d.id))}>
                <td className="cell-main">{d.name}</td>
                <td><Badge tone="blue" dot>{stage(d.stage)?.name}</Badge></td>
                <td><ScoreMeter value={d.score} /></td>
                <td>{fmtDate(d.expectedClose)}</td>
                <td className="right"><b>{fmtMoney(d.value)}</b></td>
              </tr>
            ))}
          </tbody></table>{deals.length === 0 && <Empty label="Keine Deals" />}</div></Card>
      )}

      {tab === 'process' && <ProcessHistory deals={deals} orders={orders} invoices={invoices} contracts={db.contracts.filter((c) => c.accountId === id)} stage={stage} nav={nav} />}

      {tab === 'recurring' && (
        <Card title="Daueraufträge" sub="Wiederkehrende Bestellungen dieses Kunden" pad={false}
          action={<button className="btn ghost sm" onClick={() => nav('/recurring-orders')}>Alle verwalten</button>}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Intervall</th><th>Positionen</th><th>Nächste Fälligkeit</th><th>Status</th><th className="right">Betrag/Lauf</th></tr></thead>
            <tbody>
              {recurring.map((r) => (
                <tr key={r.id} onClick={() => nav(vorgangLink('recurringOrders', r.id))}>
                  <td className="cell-main">{r.interval}</td>
                  <td className="muted">{r.items.length} Position(en)</td>
                  <td className="nowrap">{fmtDate(r.nextDue)}</td>
                  <td><Badge tone={r.active ? 'green' : 'gray'} dot>{r.active ? 'Aktiv' : 'Pausiert'}</Badge></td>
                  <td className="right"><b>{fmtMoney(r.items.reduce((s, it) => s + it.qty * it.price, 0))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>{recurring.length === 0 && <Empty label="Keine Daueraufträge" />}</div>
        </Card>
      )}

      {tab === 'activities' && (
        <Card pad={false}><div style={{ padding: '16px 20px' }}>
          {activities.length === 0 && <Empty label="Keine Aktivitäten" />}
          {activities.map((act) => (
            <div key={act.id} className="list-row clickable" onClick={() => nav(vorgangLink('activities', act.id))}>
              <span className="badge gray" style={{ width: 8, height: 8, padding: 0, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{act.subject}</div>
                <div className="muted tiny">{ACT_LABEL[act.type]} · <UserLink user={db.users.find((u) => u.id === act.ownerId)} /></div>
              </div>
              <Badge tone={act.done ? statusTone(db, 'activities', act.status) : 'amber'}>{act.done ? act.status : relDate(act.dueDate)}</Badge>
            </div>
          ))}
        </div></Card>
      )}

      {tab === 'invoices' && (
        <Card title="Rechnungen" sub="Offene Posten & Zahlungsstatus" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Nummer</th><th>Auftrag</th><th>Datum</th><th>Status</th><th className="right">Gesamt</th><th className="right">Offen</th></tr></thead>
            <tbody>
              {invoices.map((i) => {
                const ord = orders.find((o) => o.id === i.orderId);
                return (
                  <tr key={i.id} onClick={() => nav(vorgangLink('invoices', i.id))}>
                    <td className="cell-main nowrap">{i.number}</td>
                    <td className="muted">{ord?.number || '—'}</td>
                    <td className="nowrap">{fmtDate(i.issueDate)}</td>
                    <td><Badge tone={INV_TONE[i.status]} dot>{i.status}</Badge></td>
                    <td className="right"><b>{fmtMoney(i.total)}</b></td>
                    <td className="right" style={{ color: i.total - i.paid > 0 ? 'var(--red)' : 'var(--text-3)' }}>{fmtMoney(i.total - i.paid)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>{invoices.length === 0 && <Empty label="Keine Rechnungen" />}</div>
        </Card>
      )}

      {tab === 'serviceqm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Tickets" sub="Kundendienst & Reklamationen" pad={false}>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Ticket</th><th>Produkt</th><th>Priorität</th><th>Status</th></tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} onClick={() => nav(vorgangLink('tickets', t.id))}>
                    <td><div className="cell-main">{t.subject}</div><div className="cell-sub">{t.number}</div></td>
                    <td className="muted">{db.products.find((p) => p.id === t.productId)?.name || '—'}</td>
                    <td><Badge tone={t.priority === 'Hoch' ? 'red' : t.priority === 'Niedrig' ? 'gray' : 'amber'}>{t.priority}</Badge></td>
                    <td><Badge tone={statusTone(db, 'tickets', t.status)} dot>{t.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>{tickets.length === 0 && <Empty label="Keine Tickets" />}</div>
          </Card>
          <Card title="QM-Vorkommnisse" sub="Vigilanz nach MDR/MPDG" pad={false}>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>Nr.</th><th>Vorkommnis</th><th>Schweregrad</th><th>Status</th></tr></thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id} onClick={() => nav(vorgangLink('incidents', i.id))}>
                    <td className="cell-main nowrap">{i.number}</td><td>{i.title}</td>
                    <td><Badge tone={i.severity === 'Schwerwiegend' ? 'red' : i.severity === 'Hoch' ? 'amber' : 'gray'} dot>{i.severity}</Badge></td>
                    <td><Badge tone={statusTone(db, 'incidents', i.status)} dot>{i.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>{incidents.length === 0 && <Empty label="Keine Vorkommnisse" />}</div>
          </Card>
        </div>
      )}

      {tab === 'events' && (
        <Card title="Messen & Veranstaltungen" sub="Teilnahmen dieser Firma" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Veranstaltung</th><th>Typ</th><th>Datum</th><th>Rolle</th><th>Status</th></tr></thead>
            <tbody>
              {events.map((e) => {
                const at = e.attendees.find((x) => x.refType === 'account' && x.refId === id);
                return (
                  <tr key={e.id} onClick={() => nav(vorgangLink('events', e.id))}>
                    <td className="cell-main"><Presentation size={14} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--brand)' }} />{e.name}</td>
                    <td><Badge tone="teal">{e.type}</Badge></td>
                    <td className="nowrap">{fmtDate(e.startDate)}</td>
                    <td>{at?.role || '—'}</td>
                    <td><Badge tone="gray" dot>{at?.status || '—'}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>{events.length === 0 && <Empty label="Keine Messe-Teilnahmen" />}</div>
        </Card>
      )}

      {tab === 'documents' && (
        <Card pad={false}><div className="table-wrap"><table className="tbl">
          <thead><tr><th>Dokument</th><th>Typ</th><th>Größe</th><th>Datum</th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}><td className="cell-main"><FileText size={15} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--brand)' }} />{d.name}</td><td><Badge tone="gray">{d.type}</Badge></td><td>{d.size}</td><td>{fmtDate(d.date)}</td></tr>
            ))}
          </tbody></table>{docs.length === 0 && <Empty label="Keine Dokumente hinterlegt" />}</div></Card>
      )}

      {quick && <QuickAdd initial="activity" accountId={a.id} actType={quick.actType} lockAccount onClose={() => setQuick(null)} />}
    </div>
  );
}

function ProcessHistory({ deals, orders, invoices, contracts = [], stage, nav }) {
  const events = [
    ...deals.map((d) => ({ kind: 'Deal', date: d.createdAt, title: d.name, sub: stage(d.stage)?.name, amount: d.value, tone: 'purple', k: 'deals', id: d.id })),
    ...orders.map((o) => ({ kind: o.kind, date: o.date, title: o.number, sub: o.status, amount: o.total, tone: o.kind === 'Angebot' ? 'amber' : 'teal', k: 'orders', id: o.id })),
    ...contracts.map((c) => ({ kind: 'Vertrag', date: c.startDate, title: c.number + ' · ' + c.title, sub: c.status, amount: c.items.reduce((s, it) => s + it.qty * it.price, 0), tone: 'green', k: 'contracts', id: c.id })),
    ...invoices.map((i) => ({ kind: 'Rechnung', date: i.issueDate, title: i.number, sub: i.status, amount: i.total, open: i.total - i.paid, tone: 'blue', k: 'invoices', id: i.id })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalOrders = orders.filter((o) => o.kind === 'Auftrag').reduce((s, o) => s + o.total, 0);

  return (
    <Card title="Vorgänge & Bestellhistorie" sub="Angebote, Aufträge und Rechnungen chronologisch"
      action={<span className="muted tiny">Auftragsvolumen gesamt: <b style={{ color: 'var(--text)' }}>{fmtMoney(totalOrders)}</b></span>} pad={false}>
      <div className="table-wrap"><table className="tbl">
        <thead><tr><th>Vorgang</th><th>Referenz</th><th>Status</th><th>Datum</th><th className="right">Betrag</th></tr></thead>
        <tbody>
          {events.map((e, k) => (
            <tr key={k} onClick={() => nav(vorgangLink(e.k, e.id))}>
              <td><Badge tone={e.tone}>{e.kind}</Badge></td>
              <td className="cell-main">{e.title}</td>
              <td className="muted">{e.sub}{e.open > 0 ? ` · offen ${fmtMoney(e.open)}` : ''}</td>
              <td className="nowrap">{fmtDate(e.date)}</td>
              <td className="right"><b>{fmtMoney(e.amount)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>{events.length === 0 && <Empty label="Noch keine Vorgänge" hint="Angebote, Aufträge und Rechnungen erscheinen hier chronologisch." />}</div>
    </Card>
  );
}

function MiniStat({ label, value, tone }) {
  const map = { brand: 'var(--brand)', green: 'var(--green)', teal: 'var(--brand-2)', purple: 'var(--purple)', red: 'var(--red)' };
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div className="stat-line" style={{ gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: map[tone] }} />
        <span className="muted tiny" style={{ fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Conditions({ account, db, toast }) {
  const [pid, setPid] = useState(db.products[0]?.id || '');
  const [price, setPrice] = useState('');
  const list = account.priceList || [];
  const prod = (id) => db.products.find((p) => p.id === id);

  const add = () => {
    if (!pid || !price) return;
    const entry = { id: 'PA' + Date.now(), productId: pid, price: Number(price) };
    store.update('accounts', account.id, { priceList: [entry, ...list] });
    setPrice(''); toast('Preisvereinbarung hinzugefügt');
  };
  const remove = (eid) => store.update('accounts', account.id, { priceList: list.filter((e) => e.id !== eid) });

  return (
    <div className="grid cols-2">
      <Card title="Konditionen">
        <dl className="kv">
          <dt>Zahlungsziel</dt><dd>{account.paymentTerms}</dd>
          <dt>Rabatt</dt><dd><Badge tone={account.discount > 0 ? 'teal' : 'gray'}><Percent size={11} /> {account.discount} % Standardrabatt</Badge></dd>
          <dt>USt-IdNr.</dt><dd>{account.vatId}</dd>
        </dl>
        <p className="muted tiny" style={{ marginTop: 12 }}>Rabatt & Zahlungsziel über „Bearbeiten" anpassbar.</p>
      </Card>

      <Card title="Preisvereinbarungen" sub="Individuelle Verkaufspreise für diesen Kunden" pad={false}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 2, minWidth: 180 }}>
              <label>Produkt</label>
              <Select className="select" value={pid} onChange={(e) => setPid(e.target.value)}>
                {db.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({fmtMoney(p.price)})</option>)}
              </Select>
            </div>
            <div className="field" style={{ flex: 1, minWidth: 110 }}>
              <label>Verkaufspreis €</label>
              <input className="input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
            <button className="btn primary" onClick={add}><Plus size={15} /> Hinzufügen</button>
          </div>
        </div>
        <div className="table-wrap"><table className="tbl">
          <thead><tr><th>Produkt</th><th className="right">Listenpreis</th><th className="right">Vereinbart</th><th className="right">Ersparnis</th><th></th></tr></thead>
          <tbody>
            {list.map((e) => {
              const p = prod(e.productId);
              const save = p ? Math.round((1 - e.price / p.price) * 100) : 0;
              return (
                <tr key={e.id} style={{ cursor: 'default' }}>
                  <td className="cell-main">{p?.name}</td>
                  <td className="right muted">{fmtMoney(p?.price || 0)}</td>
                  <td className="right"><b>{fmtMoney(e.price)}</b></td>
                  <td className="right"><Badge tone={save > 0 ? 'green' : 'gray'}>{save} %</Badge></td>
                  <td className="right"><button className="btn ghost sm" onClick={() => remove(e.id)}><Trash2 size={13} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>{list.length === 0 && <Empty label="Noch keine Preisvereinbarungen" hint="Legen Sie kundenspezifische Verkaufspreise fest." />}</div>
      </Card>
    </div>
  );
}

