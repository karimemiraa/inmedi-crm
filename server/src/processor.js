// Verarbeitung EINER Nachricht: PDFs auslesen → speichern → Mail verschieben.
// Idempotent: wurde eine Mail schon (teilweise) verarbeitet, erkennt der Datei-Hash die PDF wieder.
import crypto from 'node:crypto';
import { extractInvoice, checkInvoice } from './pdf.js';

const isPdf = (a) => a['@odata.type'] !== '#microsoft.graph.itemAttachment' && !a.isInline
  && (/pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.name || ''));

// Ergebnis: { imported, review, duplicates, errors, noPdf, added: [Rechnungen] }
export async function processMessage({ cfg, graph, store }, m) {
  const r = { imported: 0, review: 0, duplicates: 0, errors: 0, noPdf: 0, added: [] };
  const meta = { messageId: m.internetMessageId || m.id, subject: m.subject || '', from: m.from?.emailAddress?.address || '', receivedAt: m.receivedDateTime };
  const pdfs = m.hasAttachments === false ? [] : (await graph.listAttachments(m.id)).filter(isPdf);
  if (!pdfs.length) {
    // Nur Rechnungen werden verarbeitet – alles andere landet zur Durchsicht in „Rechnungen prüfen“
    r.noPdf++;
    await graph.move(m.id, cfg.checkFolder);
    return r;
  }
  let needsCheck = false;
  for (const a of pdfs) {
    const buf = await graph.downloadAttachment(m.id, a.id);
    const fileHash = crypto.createHash('sha256').update(buf).digest('hex');
    if (store.hasHash(fileHash)) { r.duplicates++; continue; }
    const base = { ...meta, fileName: a.name, fileSize: buf.length, fileHash, processedAt: new Date().toISOString() };
    let parsed;
    try {
      parsed = await extractInvoice(buf);
    } catch (e) {
      r.added.push(store.addInvoice({ ...base, status: 'fehler', problems: ['PDF nicht lesbar: ' + (e?.message || e)], items: [] }));
      r.errors++; needsCheck = true;
      continue;
    }
    const dup = store.findDuplicate(parsed.lieferant, parsed.rechnungsnummer);
    if (dup) {
      store.addInvoice({ ...base, ...parsed, status: 'duplikat', duplicateOf: dup.seq, problems: [`Bereits eingegangen (Rechnung ${parsed.rechnungsnummer})`] });
      r.duplicates++;
      continue;
    }
    const problems = checkInvoice(parsed);
    r.added.push(store.addInvoice({ ...base, ...parsed, status: problems.length ? 'pruefen' : 'ok', problems }));
    if (problems.length) { r.review++; needsCheck = true; } else r.imported++;
  }
  await graph.move(m.id, needsCheck ? cfg.checkFolder : cfg.doneFolder);
  return r;
}
