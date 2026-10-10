import { useState, useRef } from 'react';
import { Camera, ShieldCheck, LogOut, KeyRound, Trash2, Smartphone } from 'lucide-react';
import { useStore, store } from '../data/store.js';
import { Avatar, Badge, Card, Field, Modal } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { logout, DEMO_2FA } from '../data/auth.js';
import { fmtDate } from '../lib/format.js';

export default function Profile() {
  const db = useStore();
  const toast = useToast();
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const fileRef = useRef();
  const [twoFaSetup, setTwoFaSetup] = useState(false);
  const [pwd, setPwd] = useState(false);
  const [f, setF] = useState({ name: me.name, title: me.title, email: me.email });

  const onPic = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { toast('Bild zu groß (max. 1,5 MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => { store.update('users', me.id, { avatar: reader.result }); toast('Profilbild aktualisiert'); };
    reader.readAsDataURL(file);
  };

  const saveInfo = () => { store.update('users', me.id, { name: f.name, title: f.title, email: f.email }); toast('Profil gespeichert'); };

  const toggle2fa = () => {
    if (me.twoFactor) { if (confirm('Zwei-Faktor-Authentifizierung wirklich deaktivieren?')) { store.update('users', me.id, { twoFactor: false }); toast('2FA deaktiviert'); } }
    else setTwoFaSetup(true);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Mein Profil & Sicherheit</h1><div className="sub">Profilbild, persönliche Daten und Sicherheitseinstellungen</div></div>
        <div className="page-actions"><button className="btn danger" onClick={logout}><LogOut size={15} /> Abmelden</button></div>
      </div>

      <div className="grid cols-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Profilbild">
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={me.name} color={me.color} size="lg" src={me.avatar} />
                <button className="icon-btn" style={{ position: 'absolute', bottom: -6, right: -6, width: 30, height: 30, borderRadius: '50%' }} onClick={() => fileRef.current?.click()}><Camera size={14} /></button>
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{me.name}</div>
                <div className="muted tiny">{me.title}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn sm" onClick={() => fileRef.current?.click()}>Bild wählen</button>
                  {me.avatar && <button className="btn sm ghost" onClick={() => { store.update('users', me.id, { avatar: null }); toast('Profilbild entfernt'); }}><Trash2 size={13} /></button>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPic} />
              </div>
            </div>
          </Card>

          <Card title="Persönliche Daten" action={<button className="btn sm primary" onClick={saveInfo}>Speichern</button>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Position"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="E-Mail"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            </div>
          </Card>
        </div>

        <Card title="Sicherheit">
          <div className="list-row" style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--brand-050)', color: 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><ShieldCheck size={19} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>Zwei-Faktor-Authentifizierung <Badge tone={me.twoFactor ? 'green' : 'gray'} dot>{me.twoFactor ? 'Aktiv' : 'Inaktiv'}</Badge></div>
              <div className="muted tiny" style={{ marginTop: 2 }}>Zusätzlicher Code aus einer Authenticator-App bei jeder Anmeldung.</div>
            </div>
            <button className={'btn sm' + (me.twoFactor ? ' danger' : ' primary')} onClick={toggle2fa}>{me.twoFactor ? 'Deaktivieren' : 'Aktivieren'}</button>
          </div>

          <div className="list-row" style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><KeyRound size={19} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Passwort</div>
              <div className="muted tiny" style={{ marginTop: 2 }}>Zuletzt geändert vor über 90 Tagen.</div>
            </div>
            <button className="btn sm" onClick={() => setPwd(true)}>Ändern</button>
          </div>

          <div className="list-row" style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Smartphone size={19} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Microsoft-Konto verknüpfen</div>
              <div className="muted tiny" style={{ marginTop: 2 }}>Single-Sign-On vorgesehen — wird mit dem Backend aktiviert.</div>
            </div>
            <button className="btn sm" onClick={() => toast('Microsoft-SSO wird mit dem Backend aktiviert.')}>Verknüpfen</button>
          </div>

          <hr className="hr" />
          <dl className="kv">
            <dt>Rolle</dt><dd><Badge tone={me.role === 'Administrator' ? 'purple' : me.role === 'Manager' ? 'blue' : 'gray'}>{me.role}</Badge></dd>
            <dt>Letzte Anmeldung</dt><dd>{fmtDate(me.lastLogin)}</dd>
            <dt>Status</dt><dd><Badge tone="green" dot>{me.status}</Badge></dd>
          </dl>
        </Card>
      </div>

      {twoFaSetup && <TwoFaSetup me={me} onClose={() => setTwoFaSetup(false)} toast={toast} />}
      {pwd && <PasswordModal onClose={() => setPwd(false)} toast={toast} />}
    </div>
  );
}

function TwoFaSetup({ me, onClose, toast }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const confirm = () => {
    if (code.trim() !== DEMO_2FA) { setErr('Falscher Code. Demo-Code: ' + DEMO_2FA); return; }
    store.update('users', me.id, { twoFactor: true });
    toast('2FA aktiviert'); onClose();
  };
  return (
    <Modal title="Zwei-Faktor-Authentifizierung einrichten" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={confirm}>Aktivieren</button></>}>
      <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>Scannen Sie den Code mit einer Authenticator-App (z. B. Microsoft Authenticator) und geben Sie den 6-stelligen Code zur Bestätigung ein.</p>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 120, height: 120, border: '1px solid var(--border)', borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface-2)' }}>
          <QrPlaceholder />
        </div>
        <div className="tiny">
          <div className="muted">Einrichtungsschlüssel</div>
          <code style={{ fontSize: 13, letterSpacing: '.1em' }}>JBSW Y3DP EHPK 3PXP</code>
          <div className="muted" style={{ marginTop: 8 }}>Demo-Code: <code>{DEMO_2FA}</code></div>
        </div>
      </div>
      <Field label="Bestätigungscode"><input className="input" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} placeholder="123456" maxLength={6} style={{ letterSpacing: '.3em', textAlign: 'center' }} autoFocus /></Field>
      {err && <div className="login-error" style={{ marginTop: 10 }}>{err}</div>}
    </Modal>
  );
}

function PasswordModal({ onClose, toast }) {
  return (
    <Modal title="Passwort ändern" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Abbrechen</button><button className="btn primary" onClick={() => { toast('Passwort geändert'); onClose(); }}>Speichern</button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Aktuelles Passwort"><input className="input" type="password" autoFocus /></Field>
        <Field label="Neues Passwort"><input className="input" type="password" /></Field>
        <Field label="Neues Passwort bestätigen"><input className="input" type="password" /></Field>
      </div>
    </Modal>
  );
}

function QrPlaceholder() {
  // Dekoratives QR-Muster (Platzhalter)
  const cells = [];
  const seed = [1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1];
  for (let i = 0; i < 25; i++) cells.push(seed[(i * 7 + 3) % seed.length]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3, width: 80, height: 80 }}>
      {cells.map((c, i) => <div key={i} style={{ background: c ? 'var(--text)' : 'transparent', borderRadius: 2 }} />)}
    </div>
  );
}
