// Browser-seitiges Auslesen einer PDF-Rechnung mit pdf.js.
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseInvoice } from './invoiceParse.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractInvoiceFromFile(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.filter((i) => i.str).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
  }
  const parsed = parseInvoice(pages);
  parsed.pageCount = doc.numPages;
  return parsed;
}
