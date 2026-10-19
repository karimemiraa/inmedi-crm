// Ein Durchlauf: neue Mails mit Anhängen holen → PDFs auslesen → speichern → Mail verschieben.
// Idempotent: läuft ein Durchlauf ab, bevor die Mail verschoben wurde, erkennt der nächste
// Durchlauf den Anhang am Datei-Hash wieder und legt nichts doppelt an.
import crypto from 'node:crypto';
import { extractInvoice, checkInvoice } from './pdf.js';

const isPdf = (a) => a['@odata.type'] !== '#microsoft.graph.itemAttachment' && !a.isInline
  && (/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.name || ''));

export async function runOnce({ cfg, graph, store, log = console }) {
  const run = { at: new Date().toISOString(), messages: 0, imported: 0, review: 0, duplicates: 0, errors: 0, noPdf: 0, problems: [] };
  const started = Date.now();
  try {
    const messages = await graph.listMessages(cfg.maxPerRun);
    for (const m of messages) {
      run.messages++;
      const meta = { messageId: m.internetMessageId || m.id, subject: m.subject || '', from: m.from?.emailAddress?.address || '', receivedAt: m.receivedDateTime };
      let needsCheck = false;
      try {
        const pdfs = (await graph.listAttachments(m.id)).filter(isPdf);
        if (!pdfs.length) {
          run.noPdf++;
          await graph.move(m.id, cfg.checkFolder);
          log.info?.(`[intake] keine PDF in „${meta.subject}“ → ${cfg.checkFolder}`);
          continue;
        }
        for (const a of pdfs) {
          const buf = await graph.downloadAttachment(m.id, a.id);
          const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
          if (store.hasHash(fileHash)) { run.duplicates++; continue; }
          const base = { ...meta, fileName: a.name, fileSize: buf.length, fileHash, processedAt: new Date().toISOString() };
          let parsed;
          try {
            parsed = await extractInvoice(buf);
          } catch (e) {
            store.addInvoice({ ...base, status: 'fehler', problems: ['PDF nicht lesbar: ' + (e?.message || e)], items: [] });
            run.errors++; needsCheck = true;
            continue;
          }
          const dup = store.findDuplicate(parsed.lieferant, parsed.rechnungsnummer);
          if (dup) {
            store.addInvoice({ ...base, ...parsed, status: 'duplikat', duplicateOf: dup.seq, problems: [`Bereits eingegangen (Rechnung ${parsed.rechnungsnummer})`] });
            run.duplicates++;
            continue;
          }
          const problems = checkInvoice(parsed);
          store.addInvoice({ ...base, ...parsed, status: problems.length ? 'pruefen' : 'ok', problems });
          if (problems.length) { run.review++; needsCheck = true; } else run.imported++;
        }
        await graph.move(m.id, needsCheck ? cfg.checkFolder : cfg.doneFolder);
      } catch (e) {
        run.errors++;
        run.problems.push(`„${meta.subject}“: ${e?.message || e}`);
        log.error?.('[intake] Fehler bei Nachricht', meta.subject, e?.message || e);
      }
    }
    run.ok = true;
  } catch (e) {
    run.ok = false;
    run.problems.push(e?.message || String(e));
    log.error?.('[intake] Durchlauf fehlgeschlagen:', e?.message || e);
  }
  run.ms = Date.now() - started;
  store.addRun(run);
  return run;
}
