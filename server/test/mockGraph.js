// Nachgebildetes Microsoft-365-Postfach (Login + die genutzten Graph-Endpunkte) für Tests.
import http from 'node:http';

export async function startMockGraph() {
  const state = { tokenCalls: 0, failNext429: 0, folders: [{ id: 'inbox', displayName: 'Posteingang', messages: [] }], seq: 0 };
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
    if ((m = p.match(/^\/mailFolders\/([^/]+)\/messages$/))) {
      const f = m[1] === 'inbox' ? inbox() : state.folders.find((x) => x.id === m[1]);
      return json(200, { value: (f?.messages || []).filter((x) => x.attachments.length).map(({ attachments, ...x }) => x) });
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
    // Mail mit Anhängen [{name, contentType, bytes, isInline}] in den Posteingang legen
    deliver(subject, attachments, from = 'buchhaltung@ovesco.com') {
      const id = 'M' + ++state.seq;
      inbox().messages.push({
        id, subject, internetMessageId: `<${id}@test>`, receivedDateTime: new Date(Date.now() + state.seq * 1000).toISOString(),
        from: { emailAddress: { address: from } },
        attachments: attachments.map((a, i) => ({ '@odata.type': '#microsoft.graph.fileAttachment', id: id + 'A' + i, size: a.bytes.length, isInline: !!a.isInline, name: a.name, contentType: a.contentType || 'application/pdf', bytes: a.bytes })),
      });
      return id;
    },
    folder: (name) => state.folders.find((f) => f.displayName === name),
    close: () => new Promise((r) => server.close(r)),
  };
}
