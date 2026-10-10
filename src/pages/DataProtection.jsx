import { useState } from 'react';
import { ShieldCheck, ScrollText, UserCheck, FileDown, Trash2, Lock, KeyRound, Server, FileSignature, Eye } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Badge, Card, Empty } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { fmtDate, relDate } from '../lib/format.js';

const TABS = [
  { key: 'overview', label: 'Übersicht', icon: ShieldCheck },
  { key: 'audit', label: 'Audit-Log', icon: ScrollText },
  { key: 'consent', label: 'Einwilligungen', icon: UserCheck },
  { key: 'rights', label: 'Betroffenenrechte', icon: Eye },
];

const MEASURES = [
  { icon: KeyRound, title: 'Zugriffskontrolle & Rollen', text: 'Rollenbasierte Rechte (Administrator, Manager, Vertrieb) steuern den Zugriff — Prinzip der Datenminimierung.' },
  { icon: Lock, title: 'Authentifizierung & 2FA', text: 'Passwortschutz, Zwei-Faktor-Authentifizierung und Sperre nach 10 Fehlversuchen schützen vor unbefugtem Zugriff.' },
  { icon: ScrollText, title: 'Protokollierung (Audit-Log)', text: 'Anmeldungen, Änderungen, Exporte und Löschungen werden nachvollziehbar protokolliert (Rechenschaftspflicht, Art. 5 DSGVO).' },
  { icon: Server, title: 'Verarbeitung & Hosting in der EU', text: 'Für den Produktivbetrieb vorgesehen: Hosting in einem deutschen/EU-Rechenzentrum, Verschlüsselung in Transit & at Rest.' },
  { icon: FileSignature, title: 'Auftragsverarbeitung (AVV)', text: 'Vorlagen für Auftragsverarbeitungsverträge und Verzeichnis von Verarbeitungstätigkeiten (Art. 30) vorgesehen.' },
  { icon: Trash2, title: 'Lösch- & Aufbewahrungskonzept', text: 'Recht auf Auskunft (Art. 15) und Löschung (Art. 17) sind unter „Betroffenenrechte" direkt umsetzbar.' },
];

export default function DataProtection() {
  const db = useStore();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const uname = (id) => db.users.find((u) => u.id === id)?.name || '—';
  const acct = (id) => db.accounts.find((a) => a.id === id);

  const exportPerson = (c) => {
    const data = {
      kontakt: c, konto: acct(c.accountId)?.name,
      aktivitaeten: db.activities.filter((a) => a.contactId === c.id),
      tickets: db.tickets.filter((t) => t.contactId === c.id),
      exportiertAm: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `auskunft_${c.name.replace(/\s/g, '_')}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Auskunft (Art. 15)', entity: 'Kontakt ' + c.id, detail: 'Datenauskunft exportiert für ' + c.name });
    toast('Auskunft exportiert (JSON)');
  };

  const deletePerson = (c) => {
    if (!confirm(`Alle personenbezogenen Daten zu „${c.name}" unwiderruflich löschen (Art. 17 DSGVO)?`)) return;
    store.remove('contacts', c.id);
    store.add('auditLog', { at: new Date().toISOString(), userId: db.meta.currentUserId, action: 'Löschung (Art. 17)', entity: 'Kontakt ' + c.id, detail: 'Personenbezogene Daten gelöscht: ' + c.name });
    toast('Kontakt gelöscht & protokolliert');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Datenschutz & Compliance</h1><div className="sub">DSGVO-Werkzeuge: Protokollierung, Einwilligungen und Betroffenenrechte</div></div>
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>{t.label}</button>)}
      </div>

      {tab === 'overview' && (
        <div className="grid cols-3">
          {MEASURES.map((m, i) => (
            <div key={i} className="card card-pad">
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--brand-050)', color: 'var(--brand)', display: 'grid', placeItems: 'center', marginBottom: 12 }}><m.icon size={20} /></div>
              <div style={{ fontWeight: 700, marginBottom: 5 }}>{m.title}</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{m.text}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <Card title="Audit-Log" sub="Nachvollziehbare Protokollierung sicherheits- & datenschutzrelevanter Aktionen" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Zeitpunkt</th><th>Benutzer</th><th>Aktion</th><th>Objekt</th><th>Details</th></tr></thead>
            <tbody>
              {[...db.auditLog].sort((a, b) => new Date(b.at) - new Date(a.at)).map((e) => (
                <tr key={e.id} style={{ cursor: 'default' }}>
                  <td className="nowrap muted">{relDate(e.at)}</td>
                  <td className="cell-main">{uname(e.userId)}</td>
                  <td><Badge tone={e.action.includes('Löschung') ? 'red' : e.action.includes('Sperr') ? 'amber' : 'blue'}>{e.action}</Badge></td>
                  <td>{e.entity}</td>
                  <td className="muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>{db.auditLog.length === 0 && <Empty label="Noch keine Protokolleinträge" />}</div>
        </Card>
      )}

      {tab === 'consent' && (
        <Card title="Einwilligungen" sub="Erfasste Einwilligungen je Kontakt (z. B. für E-Mail-Marketing)" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Kontakt</th><th>Konto</th><th>E-Mail-Kontakt</th><th>Telefon</th><th>Marketing</th><th>Erfasst</th></tr></thead>
            <tbody>
              {db.contacts.map((c) => (
                <tr key={c.id} style={{ cursor: 'default' }}>
                  <td className="cell-main">{c.name}</td>
                  <td>{acct(c.accountId)?.name}</td>
                  <td><Badge tone={c.consent?.email ? 'green' : 'gray'} dot>{c.consent?.email ? 'Ja' : 'Nein'}</Badge></td>
                  <td><Badge tone={c.consent?.phone ? 'green' : 'gray'} dot>{c.consent?.phone ? 'Ja' : 'Nein'}</Badge></td>
                  <td>
                    <label className="check" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={!!c.consent?.marketing} onChange={() => { store.update('contacts', c.id, { consent: { ...c.consent, marketing: !c.consent?.marketing } }); toast('Einwilligung aktualisiert'); }} />
                      <Badge tone={c.consent?.marketing ? 'teal' : 'gray'}>{c.consent?.marketing ? 'Erteilt' : 'Keine'}</Badge>
                    </label>
                  </td>
                  <td className="muted tiny">{c.consent?.date ? fmtDate(c.consent.date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}

      {tab === 'rights' && (
        <Card title="Betroffenenrechte" sub="Auskunft (Art. 15) und Löschung (Art. 17) je Person — jede Aktion wird protokolliert" pad={false}>
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>Person</th><th>Konto</th><th>E-Mail</th><th className="right">Aktionen</th></tr></thead>
            <tbody>
              {db.contacts.map((c) => (
                <tr key={c.id} style={{ cursor: 'default' }}>
                  <td className="cell-main">{c.name}</td>
                  <td>{acct(c.accountId)?.name}</td>
                  <td className="muted">{c.email}</td>
                  <td className="right nowrap">
                    <button className="btn sm" onClick={() => exportPerson(c)}><FileDown size={13} /> Auskunft</button>
                    <button className="btn sm danger" style={{ marginLeft: 8 }} onClick={() => deletePerson(c)}><Trash2 size={13} /> Löschen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>{db.contacts.length === 0 && <Empty label="Keine Kontakte" />}</div>
        </Card>
      )}
    </div>
  );
}
