// Nachgebildetes Microsoft-365-Postfach (Login + die genutzten Graph-Endpunkte) für Tests.
import http from 'node:http';

export async function startMockGraph() {
  const state = {
    tokenCalls: 0, failNext429: 0, folders: [{ id: 'inbox', displayName: 'Posteingang', messages: [] }], seq: 0,
    subscriptions: new Map(), renewals: 0, creates: 0, dropNotifications: false, duplicateNotifications: false, notifyLog: [],
  };
  const inbox = () => state.folders[0];
  const findMsg = (id) => { for (const f of state.folders) { const m = f.messages.find((x) => x.id === id); if (m) return { f, m }; } return {}; };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const body = await new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
    const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (url.pathname.endsWith('/oauth2/v2.0/token')) {
      state.tokenCalls++;
      const p = new URLSearchParams(body);
      if (p.get('client_secret') !== 'secret') return json(401, { error: 'invalid_client', error_description: 'Falsches Secret' });
      return json(200, { access_token: 'tok', expires_in: 3600 });
    }
    if (req.headers.authorization !== 'Bearer tok') return json(401, { error: { message: 'unauthorized' } });
    if (state.failNext429 > 0) { state.failNext429--; res.writeHead(429, { 'Retry-After': '0' }); return res.end(); }
    const p = url.pathname.replace(/^\/v1\.0\/users\/[^/]+/, '');
    let m;
    // ---- Abos (Change Notifications) ----
    if (url.pathname === '/v1.0/subscriptions' && req.method === 'POST') {
      const b = JSON.parse(body);
      for (const target of [b.notificationUrl, b.lifecycleNotificationUrl].filter(Boolean)) {
        const vt = 'Validation: Token ' + Math.random().toString(36).slice(2);
        const r = await fetch(target + '?validationToken=' + encodeURIComponent(vt), { method: 'POST' }).catch(() => null);
        const echoed = r && r.status === 200 && (await r.text()) === vt && /text\/plain/.test(r.headers.get('content-type') || '');
        if (!echoed) return json(400, { error: { message: 'Subscription validation request failed for ' + target } });
      }
      const sub = { id: 'SUB' + ++state.seq, ...b };
      state.subscriptions.set(sub.id, sub);
      state.creates++;
      return json(201, { id: sub.id, expirationDateTime: b.expirationDateTime, resource: b.resource });
    }
    if ((m = url.pathname.match(/^\/v1\.0\/subscriptions\/([^/]+)$/))) {
      const sub = state.subscriptions.get(decodeURIComponent(m[1]));
      if (!sub) return json(404, { error: { message: 'Subscription not found' } });
      if (req.method === 'PATCH') { sub.expirationDateTime = JSON.parse(body).expirationDateTime; state.renewals++; return json(200, { id: sub.id, expirationDateTime: sub.expirationDateTime }); }
      if (req.method === 'DELETE') { state.subscriptions.delete(sub.id); res.writeHead(204); return res.end(); }
    }
    if ((m = p.match(/^\/mailFolders\/([^/]+)\/messages$/))) {
      const f = m[1] === 'inbox' ? inbox() : state.folders.find((x) => x.id === m[1]);
      return json(200, { value: (f?.messages || []).map(({ attachments, ...x }) => ({ ...x, hasAttachments: attachments.length > 0 })) });
    }
    if ((m = p.match(/^\/mailFolders\/([^/]+)$/)) && req.method === 'GET') {
      const f = m[1] === 'inbox' ? inbox() : state.folders.find((x) => x.id === m[1]);
      return f ? json(200, { id: f.id }) : json(404, { error: { message: 'folder' } });
    }
    if ((m = p.match(/^\/messages\/([^/]+)$/)) && req.method === 'GET') {
      const { f, m: msg } = findMsg(decodeURIComponent(m[1]));
      if (!msg) return json(404, { error: { message: 'not found' } });
      const { attachments, ...x } = msg;
      return json(200, { ...x, hasAttachments: attachments.length > 0, parentFolderId: f.id });
    }
    if (p === '/mailFolders' && req.method === 'GET') {
      const name = (url.searchParams.get('$filter') || '').match(/displayName eq '(.*)'/)?.[1]?.replace(/''/g, "'");
      return json(200, { value: state.folders.filter((f) => f.displayName === name).map(({ id, displayName }) => ({ id, displayName })) });
    }
    if (p === '/mailFolders' && req.method === 'POST') {
      const f = { id: 'F' + ++state.seq, displayName: JSON.parse(body).displayName, messages: [] };
      state.folders.push(f);
      return json(201, { id: f.id, displayName: f.displayName });
    }
    if ((m = p.match(/^\/messages\/([^/]+)\/attachments$/))) {
      const { m: msg } = findMsg(decodeURIComponent(m[1]));
      return json(200, { value: msg.attachments.map(({ bytes, ...a }) => a) });
    }
    if ((m = p.match(/^\/messages\/([^/]+)\/attachments\/([^/]+)\/\$value$/))) {
      const { m: msg } = findMsg(decodeURIComponent(m[1]));
      const a = msg.attachments.find((x) => x.id === decodeURIComponent(m[2]));
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      return res.end(a.bytes);
    }
    if ((m = p.match(/^\/messages\/([^/]+)\/move$/))) {
      const { f, m: msg } = findMsg(decodeURIComponent(m[1]));
      const dest = state.folders.find((x) => x.id === JSON.parse(body).destinationId);
      f.messages = f.messages.filter((x) => x !== msg);
      dest.messages.push(msg);
      return json(201, { id: msg.id });
    }
    return json(404, { error: { message: 'unbekannt ' + p } });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    state, base,
    graphBase: base + '/v1.0', loginBase: base,
    // Mail mit Anhängen [{name, contentType, bytes, isInline}] in den Posteingang legen.
    // Wie Microsoft: bei aktivem Abo wird der Server sofort benachrichtigt (optional doppelt oder gar nicht).
    deliver(subject, attachments, from = 'buchhaltung@ovesco.com') {
      const id = 'M' + ++state.seq;
      inbox().messages.push({
        id, subject, internetMessageId: `<${id}@test>`, receivedDateTime: new Date(Date.now() + state.seq * 1000).toISOString(),
        from: { emailAddress: { address: from } },
        attachments: attachments.map((a, i) => ({ '@odata.type': '#microsoft.graph.fileAttachment', id: id + 'A' + i, size: a.bytes.length, isInline: !!a.isInline, name: a.name, contentType: a.contentType || 'application/pdf', bytes: a.bytes })),
      });
      if (!state.dropNotifications) {
        for (const sub of state.subscriptions.values()) {
          const payload = { value: [{ subscriptionId: sub.id, clientState: sub.clientState, changeType: 'created', resource: `Users/x/Messages/${id}`, resourceData: { '@odata.type': '#Microsoft.Graph.Message', id } }] };
          const times = state.duplicateNotifications ? 2 : 1;
          for (let k = 0; k < times; k++) {
            fetch(sub.notificationUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
              .then((r) => state.notifyLog.push(r.status)).catch(() => state.notifyLog.push('fail'));
          }
        }
      }
      return id;
    },
    // Lebenszyklus-Ereignis senden (reauthorizationRequired | subscriptionRemoved | missed)
    async lifecycle(event, { clientState } = {}) {
      const results = [];
      for (const sub of [...state.subscriptions.values()]) {
        if (event === 'subscriptionRemoved') state.subscriptions.delete(sub.id);
        const r = await fetch(sub.lifecycleNotificationUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [{ subscriptionId: sub.id, clientState: clientState ?? sub.clientState, lifecycleEvent: event }] }) });
        results.push(r.status);
      }
      return results;
    },
    // Beliebige (z. B. gefälschte) Benachrichtigung an eine Adresse schicken
    sendRaw: (urlStr, body) => fetch(urlStr, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    folder: (name) => state.folders.find((f) => f.displayName === name),
    close: () => new Promise((r) => server.close(r)),
  };
}
