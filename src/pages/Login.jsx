import { useState } from 'react';
import { Lock, Mail, ShieldCheck, AlertTriangle, LogIn } from 'lucide-react';
import { Logo } from '../components/Logo.jsx';
import { Field } from '../components/ui.jsx';
import { useStore } from '../data/store.js';
import { login, verify2fa, DEMO_PASSWORD, DEMO_2FA } from '../data/auth.js';

export default function Login() {
  const db = useStore();
  const ssoEnabled = !!db.meta?.integrations?.microsoft365?.ssoEnabled;
  const [step, setStep] = useState('login');
  const [email, setEmail] = useState('karim@inmedi.de');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setError('');
    const r = login(email, password);
    if (r.error) { setError(r.error); return; }
    if (r.need2fa) { setPendingUser(r.userId); setStep('2fa'); setInfo('Bitte den 6-stelligen Code aus Ihrer Authenticator-App eingeben.'); return; }
    // r.ok → session set, AuthGate re-renders automatically
  };

  const submit2fa = (e) => {
    e.preventDefault();
    setError('');
    const r = verify2fa(pendingUser, code);
    if (r.error) { setError(r.error); return; }
  };

  return (
    <div className="login-wrap">
      <div className="login-side">
        <div className="login-side-inner">
          <Logo light />
          <h2 style={{ color: '#fff', fontSize: 26, marginTop: 40, lineHeight: 1.3 }}>Das CRM für den<br />Medizintechnik-Vertrieb</h2>
          <p style={{ color: '#aeb9d0', marginTop: 14, maxWidth: 340, lineHeight: 1.6 }}>
            Kunden, Produkte, Vorgänge und Regulatorik an einem Ort. Für Außendienst und Innendienst.
          </p>
          <div style={{ marginTop: 'auto', display: 'flex', gap: 18, color: '#8e9bb5', fontSize: 12.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={15} /> 2FA & DSGVO-konform</span>
          </div>
        </div>
      </div>

      <div className="login-main">
        <div className="login-card">
          {step === 'login' ? (
            <form onSubmit={submit}>
              <h1 style={{ fontSize: 22 }}>Anmelden</h1>
              <p className="muted" style={{ marginTop: 4, marginBottom: 24, fontSize: 13.5 }}>Willkommen zurück bei InMedi CRM.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Field label="E-Mail">
                  <div className="input-ico"><Mail size={16} /><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@inmedi.de" autoFocus /></div>
                </Field>
                <Field label="Passwort">
                  <div className="input-ico"><Lock size={16} /><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></div>
                </Field>
              </div>

              {error && <div className="login-error"><AlertTriangle size={15} /> {error}</div>}

              <button className="btn primary" type="submit" style={{ width: '100%', marginTop: 20, padding: '11px' }}><LogIn size={16} /> Anmelden</button>

              {ssoEnabled && (<>
                <div className="login-divider"><span>oder</span></div>
                <button type="button" className="btn" style={{ width: '100%', padding: '10px' }} onClick={() => setInfo('Microsoft-Anmeldung (SSO) ist vorgesehen und wird mit dem Backend aktiviert.')}>
                  <MsIcon /> Mit Microsoft anmelden
                </button>
              </>)}

              {info && <div className="login-info">{info}</div>}

              <div className="login-demo">
                <b>Zugang zum Testen</b>
                <div>E-Mail: <code>karim@inmedi.de</code> (Administrator, mit 2FA)</div>
                <div>Passwort: <code>{DEMO_PASSWORD}</code> · 2FA-Code: <code>{DEMO_2FA}</code></div>
                <div className="muted tiny" style={{ marginTop: 4 }}>3 Versuche/Minute · nach 10 Fehlversuchen Sperre (Admin-Reset nötig).</div>
              </div>
            </form>
          ) : (
            <form onSubmit={submit2fa}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--brand-050)', color: 'var(--brand)', display: 'grid', placeItems: 'center', marginBottom: 14 }}><ShieldCheck size={24} /></div>
              <h1 style={{ fontSize: 22 }}>Zwei-Faktor-Bestätigung</h1>
              <p className="muted" style={{ marginTop: 4, marginBottom: 20, fontSize: 13.5 }}>{info}</p>
              <Field label="6-stelliger Code">
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} inputMode="numeric" autoFocus style={{ letterSpacing: '.4em', fontSize: 18, textAlign: 'center' }} />
              </Field>
              {error && <div className="login-error"><AlertTriangle size={15} /> {error}</div>}
              <button className="btn primary" type="submit" style={{ width: '100%', marginTop: 18, padding: '11px' }}>Bestätigen</button>
              <button type="button" className="btn ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => { setStep('login'); setError(''); setCode(''); }}>Zurück</button>
            </form>
          )}
        </div>
        <div className="muted tiny" style={{ textAlign: 'center', marginTop: 18 }}>© 2026 InMedi · Daten liegen lokal in Ihrem Browser (Prototyp)</div>
      </div>
    </div>
  );
}

function MsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="12" width="10" height="10" fill="#00a4ef" />
      <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}
