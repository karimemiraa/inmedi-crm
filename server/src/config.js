// Konfiguration ausschließlich über Umgebungsvariablen (Datei /etc/inmedi-intake.env auf dem Server).
// Geheimnisse (Client-Secret, API-Token) gehören NIE ins Repository.
import path from 'node:path';

export function loadConfig(env = process.env) {
  const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cfg = {
    tenantId: env.MS_TENANT_ID || '',
    clientId: env.MS_CLIENT_ID || '',
    clientSecret: env.MS_CLIENT_SECRET || '',
    mailbox: env.MAILBOX || '',
    sourceFolder: env.SOURCE_FOLDER || 'inbox',
    doneFolder: env.DONE_FOLDER || 'Rechnungen verarbeitet',
    checkFolder: env.CHECK_FOLDER || 'Rechnungen prüfen',
    // Öffentliche HTTPS-Adresse dieses Servers. Gesetzt → Microsoft meldet neue Mails sofort (Webhook).
    publicUrl: String(env.PUBLIC_URL || '').trim().replace(/\/+$/, ''),
    // Sicherheitsnetz-Abgleich in Minuten: mit Webhook selten (Standard 60), ohne Webhook häufig (Standard 5)
    sweepMinutes: Number(env.SWEEP_MINUTES || env.POLL_MINUTES) || 0,
    maxPerRun: Math.max(1, Number(env.MAX_PER_RUN) || 50),
    apiToken: env.API_TOKEN || '',
    allowedOrigins: list(env.ALLOWED_ORIGINS || 'https://karimemiraa.github.io'),
    host: env.HOST || '127.0.0.1',
    port: env.PORT !== undefined && env.PORT !== '' ? Number(env.PORT) : 8787,
    dataDir: path.resolve(env.DATA_DIR || './data'),
    // Nur für Tests überschreibbar
    graphBase: env.GRAPH_BASE || 'https://graph.microsoft.com/v1.0',
    loginBase: env.LOGIN_BASE || 'https://login.microsoftonline.com',
  };
  cfg.mailConfigured = !!(cfg.tenantId && cfg.clientId && cfg.clientSecret && cfg.mailbox);
  cfg.webhook = cfg.mailConfigured && /^https:\/\//.test(cfg.publicUrl) || (cfg.mailConfigured && env.ALLOW_HTTP_WEBHOOK === '1' && !!cfg.publicUrl);
  if (!cfg.sweepMinutes) cfg.sweepMinutes = cfg.webhook ? 60 : 5;
  cfg.sweepMinutes = Math.max(1, cfg.sweepMinutes);
  return cfg;
}

export function validateConfig(cfg) {
  const problems = [];
  if (!cfg.apiToken || cfg.apiToken.length < 24) problems.push('API_TOKEN fehlt oder ist kürzer als 24 Zeichen');
  if (!cfg.mailConfigured) problems.push('Microsoft-Zugang unvollständig (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAILBOX) – Postfach wird nicht abgerufen');
  else if (!cfg.webhook) problems.push('PUBLIC_URL (https://…) fehlt – keine Sofort-Benachrichtigung, Postfach wird alle ' + cfg.sweepMinutes + ' min geprüft');
  return problems;
}
