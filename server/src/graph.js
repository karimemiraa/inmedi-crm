// Minimaler Microsoft-Graph-Client (App-Berechtigung, Client-Credentials-Flow).
// Benötigt die Anwendungsberechtigung Mail.ReadWrite – per RBAC for Applications auf EIN Postfach beschränken.

export class GraphError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export function createGraph(cfg, fetchImpl = fetch) {
  let token = null, tokenExp = 0;
  const folderIds = new Map();
  const mb = encodeURIComponent(cfg.mailbox);

  async function getToken() {
    if (token && Date.now() < tokenExp - 60_000) return token;
    const res = await fetchImpl(`${cfg.loginBase}/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new GraphError('Anmeldung bei Microsoft fehlgeschlagen: ' + (data.error_description || data.error || res.status), res.status);
    token = data.access_token;
    tokenExp = Date.now() + (Number(data.expires_in) || 3600) * 1000;
    return token;
  }

  async function call(method, url, { body, raw = false } = {}) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url.startsWith('http') ? url : cfg.graphBase + url, {
        method,
        headers: { Authorization: 'Bearer ' + (await getToken()), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if ((res.status === 429 || res.status === 503) && attempt < 3) {
        const wait = Math.min(30, Number(res.headers.get('retry-after')) || 2 ** attempt);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      if (res.status === 401 && attempt === 0) { token = null; continue; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new GraphError(`Graph ${method} ${url.split('?')[0]} → ${res.status}: ${data?.error?.message || res.statusText}`, res.status);
      }
      if (raw) return Buffer.from(await res.arrayBuffer());
      return res.status === 204 ? null : res.json();
    }
  }

  return {
    // Ungelesene wie gelesene Nachrichten mit Anhängen im Quellordner (älteste zuerst)
    async listMessages(limit) {
      const out = [];
      let url = `/users/${mb}/mailFolders/${encodeURIComponent(cfg.sourceFolder)}/messages?$filter=hasAttachments eq true&$top=25&$select=id,subject,from,receivedDateTime,internetMessageId`;
      while (url && out.length < limit) {
        const page = await call('GET', url);
        out.push(...(page.value || []));
        url = page['@odata.nextLink'] || null;
      }
      return out.sort((a, b) => String(a.receivedDateTime).localeCompare(String(b.receivedDateTime))).slice(0, limit);
    },
    async listAttachments(messageId) {
      const page = await call('GET', `/users/${mb}/messages/${encodeURIComponent(messageId)}/attachments?$select=id,name,contentType,size,isInline`);
      return page.value || [];
    },
    async downloadAttachment(messageId, attachmentId) {
      return call('GET', `/users/${mb}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`, { raw: true });
    },
    async folderId(name) {
      if (folderIds.has(name)) return folderIds.get(name);
      const safe = name.replace(/'/g, "''");
      const found = await call('GET', `/users/${mb}/mailFolders?$filter=displayName eq '${encodeURIComponent(safe)}'&$select=id,displayName`);
      let id = found.value?.[0]?.id;
      if (!id) id = (await call('POST', `/users/${mb}/mailFolders`, { body: { displayName: name } })).id;
      folderIds.set(name, id);
      return id;
    },
    async move(messageId, folderName) {
      const destinationId = await this.folderId(folderName);
      return call('POST', `/users/${mb}/messages/${encodeURIComponent(messageId)}/move`, { body: { destinationId } });
    },
  };
}
