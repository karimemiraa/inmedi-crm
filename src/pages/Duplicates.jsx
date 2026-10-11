import { useState, useMemo } from 'react';
import { CopyCheck, Merge, X, ArrowRight, Building2, Users } from 'lucide-react';
import { useStore } from '../data/store.js';
import { Badge, Empty, KpiCard, Card } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { findAccountDuplicates, findContactDuplicates, mergeAccounts, mergeContacts } from '../lib/dedupe.js';

const pairKey = (p) => [p.a.id, p.b.id].sort().join('|');

export default function Duplicates() {
  const db = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('accounts');
  const [dismissed, setDismissed] = useState(() => new Set());

  const acctPairs = useMemo(() => findAccountDuplicates(db.accounts).filter((p) => !dismissed.has(pairKey(p))), [db.accounts, dismissed]);
  const contactPairs = useMemo(() => findContactDuplicates(db.contacts).filter((p) => !dismissed.has(pairKey(p))), [db.contacts, dismissed]);

  const childCount = (aid) => ['contacts', 'deals', 'orders', 'invoices', 'contracts', 'activities', 'devices', 'tickets', 'serviceOrders', 'incidents', 'costEntries', 'documents', 'recurringOrders']
    .reduce((s, coll) => s + db[coll].filter((r) => r.accountId === aid).length, 0);
  const contactChildCount = (cid) => ['deals', 'activities', 'contracts', 'tickets'].reduce((s, coll) => s + db[coll].filter((r) => r.contactId === cid).length, 0);

  const dismiss = (p) => { setDismissed((prev) => new Set(prev).add(pairKey(p))); toast('Als „keine Dublette" markiert'); };

  const doMergeAcct = (survivor, dup) => {
    if (!confirm(`„${dup.name}" in „${survivor.name}" zusammenführen?\n\nAlle verknüpften Datensätze (Kontakte, Aufträge, Rechnungen …) werden auf „${survivor.name}" umgehängt und „${dup.name}" wird gelöscht. Das kann nicht rückgängig gemacht werden.`)) return;
    const n = mergeAccounts(survivor.id, dup.id);
    toast(`Zusammengeführt – ${n} Datensätze umgehängt`);
  };
  const doMergeContact = (survivor, dup) => {
    if (!confirm(`„${dup.name}" in „${survivor.name}" zusammenführen?\n\nAlle Verknüpfungen werden auf „${survivor.name}" umgehängt und der doppelte Ansprechpartner wird gelöscht.`)) return;
    const n = mergeContacts(survivor.id, dup.id);
    toast(`Zusammengeführt – ${n} Datensätze umgehängt`);
  };

  const accName = (id) => db.accounts.find((a) => a.id === id)?.name || '—';

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Dublettenprüfung</h1><div className="sub">Mögliche Doppelerfassungen von Firmen und Ansprechpartnern erkennen und zusammenführen</div></div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <KpiCard icon={Building2} tone="brand" label="Firmen-Dubletten" value={acctPairs.length} />
        <KpiCard icon={Users} tone="teal" label="Kontakt-Dubletten" value={contactPairs.length} />
        <KpiCard icon={CopyCheck} tone="amber" label="Zu prüfen" value={acctPairs.length + contactPairs.length} />
        <KpiCard icon={Merge} tone="green" label="Erfasste Firmen" value={db.accounts.length} />
      </div>

      <div className="tabs">
        <button className={tab === 'accounts' ? 'active' : ''} onClick={() => setTab('accounts')}>Firmen ({acctPairs.length})</button>
        <button className={tab === 'contacts' ? 'active' : ''} onClick={() => setTab('contacts')}>Ansprechpartner ({contactPairs.length})</button>
      </div>

      {tab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {acctPairs.length === 0 && <Card><Empty label="Keine Firmen-Dubletten gefunden" hint="Alle Firmen wirken eindeutig." /></Card>}
          {acctPairs.map((p) => (
            <PairCard key={pairKey(p)} p={p}
              render={(rec) => (
                <AcctFields rec={rec} count={childCount(rec.id)} />
              )}
              onKeep={(survivor, dup) => doMergeAcct(survivor, dup)} onDismiss={() => dismiss(p)} />
          ))}
        </div>
      )}

      {tab === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {contactPairs.length === 0 && <Card><Empty label="Keine Kontakt-Dubletten gefunden" /></Card>}
          {contactPairs.map((p) => (
            <PairCard key={pairKey(p)} p={p}
              render={(rec) => (
                <ContactFields rec={rec} accName={accName(rec.accountId)} count={contactChildCount(rec.id)} />
              )}
              onKeep={(survivor, dup) => doMergeContact(survivor, dup)} onDismiss={() => dismiss(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PairCard({ p, render, onKeep, onDismiss }) {
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <Badge tone={p.score >= 0.85 ? 'red' : 'amber'} dot>Übereinstimmung {Math.round(p.score * 100)} %</Badge>
        {p.reasons.map((r, i) => <Badge key={i} tone="gray">{r}</Badge>)}
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onDismiss}><X size={14} /> Keine Dublette</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'stretch' }}>
        <Side rec={p.a} other={p.b} render={render} onKeep={onKeep} />
        <div style={{ display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}><Merge size={20} /></div>
        <Side rec={p.b} other={p.a} render={render} onKeep={onKeep} />
      </div>
    </div>
  );
}

function Side({ rec, other, render, onKeep }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>{render(rec)}</div>
      <button className="btn primary sm" style={{ marginTop: 12 }} onClick={() => onKeep(rec, other)}>
        Diesen behalten <ArrowRight size={13} /> zusammenführen
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}><span className="muted">{label}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span></div>;
}

function AcctFields({ rec, count }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{rec.name}</div>
      <Row label="Kundennr." value={rec.kundennummer} />
      <Row label="Typ" value={rec.type} />
      <Row label="Adresse" value={`${rec.zip || ''} ${rec.city || ''}`.trim()} />
      <Row label="Telefon" value={rec.phone} />
      <Row label="E-Mail" value={rec.email} />
      <Row label="Umsatz lfd. J." value={(rec.revenueYTD || 0).toLocaleString('de-DE') + ' €'} />
      <Row label="Verknüpfte Datensätze" value={<Badge tone={count > 0 ? 'teal' : 'gray'}>{count}</Badge>} />
    </div>
  );
}

function ContactFields({ rec, accName, count }) {
  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{rec.name}</div>
      <Row label="Position" value={rec.title} />
      <Row label="Firma" value={accName} />
      <Row label="E-Mail" value={rec.email} />
      <Row label="Telefon" value={rec.phone} />
      <Row label="Hauptkontakt" value={rec.isPrimary ? 'Ja' : 'Nein'} />
      <Row label="Verknüpfte Datensätze" value={<Badge tone={count > 0 ? 'teal' : 'gray'}>{count}</Badge>} />
    </div>
  );
}
