// Reiner Rechnungs-Parser (ohne pdf.js) — testbar in Node.
// Eingabe: pages = Array je Seite von Text-Items {str,x,y}. Ausgabe: strukturierte Rechnung.

export const parseDE = (s) => {
  if (s == null) return null;
  const m = String(s).match(/-?[\d.]*\d(?:,\d{1,2})?/);
  if (!m) return null;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
};

// Items je Seite → Zeilen (nach y gruppiert, nach x sortiert). Strenge Toleranz,
// damit benachbarte Spalten nicht verschmelzen; Positionszeilen haben exakt gleiches y.
export function buildLines(pageItems) {
  const lines = [];
  for (const items of pageItems) {
    const rows = [];
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue;
      let row = rows.find((r) => Math.abs(r.y - it.y) < 1.6);
      if (!row) { row = { y: it.y, cells: [] }; rows.push(row); }
      row.cells.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.cells.sort((a, b) => a.x - b.x);
      lines.push(r.cells.map((c) => c.str.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim());
    }
  }
  return lines;
}

// Wert direkt UNTER einem Label (gleiche Spalte) — spaltengenau per Geometrie.
function below(items, labelRe, { maxDy = 26, maxDx = 40, valueRe = null } = {}) {
  const label = items.find((i) => labelRe.test(i.str.trim()));
  if (!label) return null;
  const cands = items.filter((i) => i !== label && i.str.trim() && i.y < label.y && (label.y - i.y) <= maxDy && Math.abs(i.x - label.x) <= maxDx);
  cands.sort((a, b) => (label.y - a.y) - (label.y - b.y) || Math.abs(a.x - label.x) - Math.abs(b.x - label.x));
  if (valueRe) { for (const c of cands) { const m = c.str.match(valueRe); if (m) return m[1] || m[0]; } return null; }
  return cands[0] ? cands[0].str.trim() : null;
}

const UNITS = 'Stk|Stück|Stk\\.|St|ME|Set|Box|Pkg|Paar|Pack\\.?|m';
const ITEM_RE = new RegExp(
  `^(.*\\S)\\s+(\\d{1,4}(?:[.,]\\d{1,3})?)\\s+(${UNITS})\\s+([\\d.]+,\\d{2})\\s+(\\d{1,2})\\s+([\\d.]+,\\d{2})$`,
);

function findAfter(lines, labelRe, valueRe, within = 3) {
  for (let i = 0; i < lines.length; i++) {
    if (labelRe.test(lines[i])) {
      const same = lines[i].replace(labelRe, '').match(valueRe);
      if (same) return same[1] || same[0];
      for (let k = 1; k <= within && i + k < lines.length; k++) {
        const m = lines[i + k].match(valueRe);
        if (m) return m[1] || m[0];
      }
    }
  }
  return null;
}

export function parseInvoice(pages) {
  const lines = buildLines(pages);
  const page0 = pages[0] || [];
  const text = lines.join('\n');

  // --- Rechnungsnummer + Datum ---
  let rechnungsnummer = null, datum = null;
  for (let i = 0; i < lines.length; i++) {
    if (/^Rechnung$/i.test(lines[i].trim())) {
      for (let k = 1; k <= 3 && i + k < lines.length; k++) {
        if (!rechnungsnummer) { const n = lines[i + k].match(/\b(\d{5,9})\b/); if (n) rechnungsnummer = n[1]; }
        if (!datum) { const d = lines[i + k].match(/\b(\d{2}\.\d{2}\.\d{4})\b/); if (d) datum = d[1]; }
      }
      if (rechnungsnummer) break;
    }
  }
  if (!rechnungsnummer) rechnungsnummer = below(page0, /^Rechnung$/i, { valueRe: /(\d{4,9})/, maxDy: 40, maxDx: 220 });
  if (!datum) datum = (text.match(/\b(\d{2}\.\d{2}\.\d{4})\b/) || [])[1] || null;

  // --- Kundennummer (spaltengenau unter Label) ---
  const kundennummer = below(page0, /^Kundennummer$/i, { valueRe: /(\d{3,12})/, maxDy: 22, maxDx: 30 })
    || findAfter(lines, /^Kundennummer$/i, /^(\d{3,12})$/, 1);

  // --- Rechnungsempfänger: zusammenhängender Block oben links (x<250) ---
  const left = page0.filter((i) => i.x < 250 && i.str.trim() && !/Friedrich-Miescher|72076 Tübingen|Endoscopy AG,|^\s*$/.test(i.str))
    .sort((a, b) => b.y - a.y);
  // Startzeile: erste Firmenzeile unterhalb des Kopfbereichs
  const kundeBlock = [];
  let started = false, lastY = null;
  for (const it of left) {
    const s = it.str.trim();
    if (!started) {
      if (it.y < 705 && /[A-Za-zÄÖÜäöü]/.test(s) && !/Belegnummer|Rechnung|Seite/i.test(s)) { started = true; kundeBlock.push(s); lastY = it.y; }
      continue;
    }
    if (lastY - it.y > 20) break;              // größere Lücke → Blockende
    if (/Sehr geehrt|Beschreibung|Basierend auf/i.test(s)) break;
    kundeBlock.push(s); lastY = it.y;
    if (kundeBlock.length >= 6) break;
  }
  const kundeName = kundeBlock[0] || null;

  // --- Referenz / Ansprechpartner / Leistungsempfänger (unter Label) ---
  const referenz = below(page0, /Ihre Zeichen|Referenz/i, { maxDy: 16, maxDx: 30 });
  const ansprechpartner = below(page0, /Ihr Ansprechpartner/i, { maxDy: 16, maxDx: 30 });
  const leistungsempfaenger = below(page0, /Leistungsempf/i, { maxDy: 16, maxDx: 220 })
    || findAfter(lines, /Leistungsempf/i, /(.+)/, 1);
  const email = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []).find((e) => !/ovesco\.com|service@ovesco/i.test(e)) || null;

  // --- Lieferant (Absender) ---
  const retLine = page0.find((i) => /72076 Tübingen/.test(i.str) && i.str.includes(','));
  const lieferant = retLine ? (retLine.str.split(',')[0].trim()) : (text.match(/^([A-Za-zÄÖÜ][^\n]*(?:AG|GmbH))$/m) || [])[1] || null;

  // --- Positionen ---
  const stopIdx = lines.findIndex((l) => /^(Zwischensumme|Nettobetrag|Gesamtbetrag)/i.test(l.trim()));
  const itemIdxs = [];
  for (let i = 0; i < lines.length; i++) if (ITEM_RE.test(lines[i]) && (stopIdx < 0 || i < stopIdx)) itemIdxs.push(i);
  const items = [];
  for (let n = 0; n < itemIdxs.length; n++) {
    const i = itemIdxs[n];
    const m = lines[i].match(ITEM_RE);
    const name = m[1].replace(/^\d+\s+/, '').trim();
    let end = n + 1 < itemIdxs.length ? itemIdxs[n + 1] : lines.length;
    if (stopIdx >= 0 && stopIdx < end && stopIdx > i) end = stopIdx;
    const block = lines.slice(i + 1, end);
    const bt = block.join('\n');
    const artikelnr = (bt.match(/Artikel-?nr\.?:?\s*([A-Za-z0-9.\-]+)/i) || [])[1] || null;
    let lot = (bt.match(/LOT-?Nr\.?:?\s*([A-Za-z0-9][A-Za-z0-9\-\/]*)/i) || [])[1] || null;
    if (!lot) { const li = block.findIndex((l) => /LOT-?Nr/i.test(l)); if (li > 0) lot = (block[li - 1].match(/([A-Za-z0-9\-\/]{4,})/) || [])[1] || null; }
    const ablauf = (bt.match(/Ablaufdatum:?\s*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || null;
    const beschreibung = block.filter((l) => l && !/Artikel-?nr|LOT-?Nr|Ablaufdatum|Zolltarif|Ursprungsland|^\d/.test(l)).join(' ').trim() || null;
    items.push({ pos: n + 1, name, artikelnr, menge: parseDE(m[2]), einheit: m[3], preis: parseDE(m[4]), ust: Number(m[5]), betrag: parseDE(m[6]), lot, ablauf, beschreibung });
  }

  // --- Summen ---
  const netto = findAfter(lines, /Nettobetrag/i, /([\d.]+,\d{2})/, 2);
  const gesamt = findAfter(lines, /Gesamtbetrag/i, /([\d.]+,\d{2})/, 2);
  const zahlbarBis = (text.match(/Zahlbar bis[\s\S]{0,120}?(\d{2}\.\d{2}\.\d{4})/) || [])[1] || null;
  const zahlungskonditionen = (text.match(/(\d+\s*Tage\s*netto)/i) || [])[1]
    || findAfter(lines, /Zahlungskonditionen/i, /(\d+\s*Tage[^\n]*)/, 3);

  const itemsTotal = items.reduce((s, it) => s + (it.betrag || 0), 0);

  return {
    rechnungsnummer, datum, kundennummer, kundeName, kundeBlock,
    leistungsempfaenger, referenz, ansprechpartner, email, lieferant,
    items, netto: parseDE(netto), gesamt: parseDE(gesamt), itemsTotal,
    zahlbarBis, zahlungskonditionen,
  };
}
