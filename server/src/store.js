// Einfache Datei-Ablage (JSON, atomar geschrieben). Ein Prozess schreibt – für das Volumen eines
// Rechnungspostfachs völlig ausreichend. Jede Rechnung bekommt eine fortlaufende Nummer (seq),
// über die das CRM nur Neues abholt.
import fs from 'node:fs';
import path from 'node:path';

export function openStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'intake.json');
  let data = { seq: 0, invoices: [], runs: [], events: [], webhook: {} };
  if (fs.existsSync(file)) data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };

  const save = () => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };

  return {
    get data() { return data; },
    hasHash: (hash) => data.invoices.some((i) => i.fileHash === hash),
    findDuplicate: (lieferant, nr) => (nr ? data.invoices.find((i) => i.status !== 'duplikat' && i.rechnungsnummer === nr && (i.lieferant || '') === (lieferant || '')) : null),
    addInvoice(rec) {
      const r = { ...rec, seq: ++data.seq };
      data.invoices.push(r);
      save();
      return r;
    },
    since(seq, limit = 200) {
      const list = data.invoices.filter((i) => i.seq > seq).slice(0, limit);
      return { invoices: list, seq: list.length ? list[list.length - 1].seq : seq, more: data.invoices.some((i) => i.seq > (list.at(-1)?.seq ?? seq)) };
    },
    // Einzelereignisse (je Mail) für die Statusanzeige
    addEvent(ev) {
      data.events.unshift(ev);
      data.events = data.events.slice(0, 200);
      save();
    },
    setWebhook(patch) {
      data.webhook = { ...data.webhook, ...patch };
      save();
    },
    addRun(run) {
      data.runs.unshift(run);
      data.runs = data.runs.slice(0, 100);
      save();
    },
  };
}
