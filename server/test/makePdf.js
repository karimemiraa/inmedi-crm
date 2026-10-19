// Erzeugt einfache Test-PDFs im Layout der Lieferanten-Rechnungen (für automatische Tests,
// ohne externe Bibliothek). Text wird an festen Koordinaten in Helvetica/WinAnsi gesetzt.
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function makePdf(lines) {
  const content = lines.map(([x, y, t, size = 9]) => `BT /F1 ${size} Tf ${x} ${y} Td (${esc(t)}) Tj ET`).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// Rechnung im Layout „Ovesco Endoscopy AG“ (wie der Parser sie erwartet)
export function invoicePdf({ nr = '9104711', datum = '05.10.2026', kdnr = '10001', kunde = 'Universitätsklinikum Nord', items = [['OTSC Clip 12/6t', 2, 395]], zahlbar = '04.11.2026' } = {}) {
  const fmt = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const L = [
    [56, 740, 'Ovesco Endoscopy AG, Friedrich-Miescher-Str. 9, 72076 Tübingen', 7],
    [56, 700, kunde], [56, 688, 'Einkauf'], [56, 676, 'Martinistraße 52'], [56, 664, '20246 Hamburg'],
    [380, 700, 'Rechnung', 12], [380, 686, `${nr} ${datum}`],
    [380, 660, 'Kundennummer'], [380, 648, kdnr],
    [470, 660, 'Ihre Zeichen'], [470, 648, 'Bestellung Okt'],
    [56, 600, 'Pos Beschreibung Menge Preis USt Betrag'],
  ];
  let y = 580, net = 0;
  items.forEach(([name, qty, price], i) => {
    const sum = qty * price; net += sum;
    L.push([56, y, String(i + 1)], [80, y, name], [300, y, String(qty)], [330, y, 'Stk'], [370, y, fmt(price)], [430, y, '19'], [480, y, fmt(sum)]);
    L.push([80, y - 12, `Artikel-Nr.: 100.${String(i + 1).padStart(2, '0')}`], [80, y - 24, `LOT-Nr.: L2026${i}A`], [80, y - 36, 'Ablaufdatum: 31.12.2028']);
    y -= 52;
  });
  L.push([380, y, 'Nettobetrag'], [480, y, fmt(net)], [380, y - 14, 'Gesamtbetrag'], [480, y - 14, fmt(Math.round(net * 119) / 100)]);
  L.push([56, y - 50, `Zahlbar bis ${zahlbar} ohne Abzug`], [56, y - 62, 'Zahlungskonditionen: 30 Tage netto']);
  return makePdf(L);
}
