// Simulierte Authentifizierung für den Prototyp.
// WICHTIG: Dies ist eine Frontend-Simulation (localStorage). Für den Produktiv-
// betrieb gehört Login/2FA/Sperrlogik auf einen Server mit gehashten Passwörtern
// und echter Rate-Limiting-Durchsetzung. Die UI/Abläufe sind hier bereits fertig.
import { useSyncExternalStore } from 'react';
import { store } from './store.js';

const SESSION = 'inmedi-session';
const ATTEMPTS = 'inmedi-attempts';
export const DEMO_PASSWORD = 'inmedi2026';
export const DEMO_2FA = '123456';
export const MAX_PER_MINUTE = 3;
export const MAX_FAILS = 10;

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function getSessionUserId() {
  try { return JSON.parse(localStorage.getItem(SESSION))?.userId || null; } catch (e) { return null; }
}
function setSession(userId) { try { localStorage.setItem(SESSION, JSON.stringify({ userId })); } catch (e) {} emit(); }

function recentAttempts() {
  try { const a = JSON.parse(localStorage.getItem(ATTEMPTS)) || []; const cut = Date.now() - 60000; return a.filter((t) => t > cut); }
  catch (e) { return []; }
}
function pushAttempt() { const a = recentAttempts(); a.push(Date.now()); try { localStorage.setItem(ATTEMPTS, JSON.stringify(a)); } catch (e) {} }

function audit(userId, action, entity, detail) {
  store.add('auditLog', { at: new Date().toISOString(), userId, action, entity, detail });
}

function establish(u) {
  store.update('users', u.id, { failedLogins: 0, lastLogin: new Date().toISOString() });
  store.set((s) => ({ ...s, meta: { ...s.meta, currentUserId: u.id } }));
  setSession(u.id);
  audit(u.id, 'Anmeldung', 'System', 'Erfolgreiche Anmeldung' + (u.twoFactor ? ' (2FA)' : ''));
}

export function login(email, password) {
  const u = store.get().users.find((x) => x.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!u) return { error: 'Benutzer nicht gefunden.' };
  if (u.locked) return { error: 'Konto gesperrt — bitte Administrator kontaktieren.' };
  if (recentAttempts().length >= MAX_PER_MINUTE) return { error: `Zu viele Versuche. Bitte 1 Minute warten (max. ${MAX_PER_MINUTE}/Minute).` };
  pushAttempt();
  if (password !== DEMO_PASSWORD) {
    const fails = (u.failedLogins || 0) + 1;
    const patch = { failedLogins: fails };
    if (fails >= MAX_FAILS) patch.locked = true;
    store.update('users', u.id, patch);
    if (fails >= MAX_FAILS) {
      audit(u.id, 'Sperrung', 'System', `Konto nach ${MAX_FAILS} Fehlversuchen gesperrt`);
      return { error: `Konto gesperrt — ${MAX_FAILS} Fehlversuche erreicht. Ein Administrator muss das Konto zurücksetzen.` };
    }
    return { error: `Falsches Passwort. Verbleibende Versuche: ${MAX_FAILS - fails}.` };
  }
  if (u.twoFactor) return { need2fa: true, userId: u.id };
  establish(u);
  return { ok: true };
}

export function verify2fa(userId, code) {
  const u = store.get().users.find((x) => x.id === userId);
  if (!u) return { error: 'Benutzer nicht gefunden.' };
  if (String(code).trim() !== DEMO_2FA) return { error: 'Falscher Bestätigungscode.' };
  establish(u);
  return { ok: true };
}

export function logout() {
  const uid = getSessionUserId();
  if (uid) audit(uid, 'Abmeldung', 'System', 'Benutzer abgemeldet');
  try { localStorage.removeItem(SESSION); } catch (e) {}
  emit();
}

export function adminResetUser(userId) {
  store.update('users', userId, { locked: false, failedLogins: 0 });
  const admin = store.get().meta.currentUserId;
  audit(admin, 'Benutzer entsperrt', 'Benutzer ' + userId, 'Sperre und Fehlversuche zurückgesetzt');
}

export function useSession() {
  return useSyncExternalStore(subscribe, getSessionUserId);
}
