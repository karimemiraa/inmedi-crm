// PDF-Text mit pdf.js (Node-Build) auslesen und mit dem gleichen Parser wie im CRM auswerten.
import { parseInvoice } from '../../src/lib/invoiceParse.js';

let pdfjs = null;
async function lib() {
  if (!pdfjs) pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

export async function extractInvoice(buffer) {
  const { getDocument } = await lib();
  // isEvalSupported:false – kein Ausführen von Code aus fremden PDFs
  const doc = await getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  try {
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      pages.push(tc.items.filter((i) => i.str).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
    }
    const parsed = parseInvoice(pages);
    parsed.pageCount = doc.numPages;
    return parsed;
  } finally {
    await doc.destroy();
  }
}

// Plausibilitätsprüfung: was fehlt oder passt nicht? Leere Liste = sauber erkannt.
export function checkInvoice(p) {
  const problems = [];
  if (!p.rechnungsnummer) problems.push('Rechnungsnummer nicht erkannt');
  if (!p.kundennummer) problems.push('Kundennummer nicht erkannt');
  if (p.gesamt == null) problems.push('Gesamtbetrag nicht erkannt');
  if (!p.items?.length) problems.push('Keine Positionen erkannt');
  if (p.netto != null && p.items?.length && Math.abs(p.itemsTotal - p.netto) > 0.05) problems.push(`Positionssumme ${p.itemsTotal.toFixed(2)} ≠ Netto ${p.netto.toFixed(2)}`);
  return problems;
}
