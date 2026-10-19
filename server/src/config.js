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
    pollMinutes: Math.max(1, Number(env.POLL_MINUTES) || 5),
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
  return cfg;
}

export function validateConfig(cfg) {
  const problems = [];
  if (!cfg.apiToken || cfg.apiToken.length < 24) problems.push('API_TOKEN fehlt oder ist kürzer als 24 Zeichen');
  if (!cfg.mailConfigured) problems.push('Microsoft-Zugang unvollständig (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MAILBOX) – Postfach wird nicht abgerufen');
  return problems;
}
