// Sicheres Markdown-Rendering für KI-Antworten: erzeugt nur React-Elemente (kein innerHTML),
// erlaubt nur interne CRM-Links (#/…) und https-Links.
import { Fragment } from 'react';

const INLINE = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)/;

function inline(text, key = 'i') {
  const out = [];
  let rest = text, n = 0;
  while (rest) {
    const m = rest.match(INLINE);
    if (!m) { out.push(rest); break; }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<strong key={k}>{inline(m[2], k)}</strong>);
    else if (m[3]) {
      const href = m[5];
      if (href.startsWith('#/')) out.push(<a key={k} className="rec-link" href={href}>{inline(m[4], k)}</a>);
      else if (/^https:\/\//.test(href)) out.push(<a key={k} className="rec-link" href={href} target="_blank" rel="noopener noreferrer">{inline(m[4], k)}</a>);
      else out.push(<Fragment key={k}>{m[4]}</Fragment>);
    } else if (m[6]) out.push(<code key={k}>{m[7]}</code>);
    else if (m[8]) out.push(<em key={k}>{inline(m[9], k)}</em>);
    else if (m[10]) out.push(<em key={k}>{inline(m[11], k)}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export default function Markdown({ text }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }
    if (t.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={i} className="md-pre">{buf.join('\n')}</pre>);
      continue;
    }
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const L = Math.min(h[1].length + 1, 5); const Tag = `h${L}`; blocks.push(<Tag key={i} className="md-h">{inline(h[2], 'h' + i)}</Tag>); i++; continue; }
    if (/^(-{3,}|\*{3,})$/.test(t)) { blocks.push(<hr key={i} className="md-hr" />); i++; continue; }
    if (t.startsWith('|') && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      const head = cells(t);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={i} className="md-table-wrap"><table className="tbl md-table">
          <thead><tr>{head.map((c, k) => <th key={k}>{inline(c, `th${i}${k}`)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri} style={{ cursor: 'default' }}>{r.map((c, k) => <td key={k}>{inline(c, `td${i}${ri}${k}`)}</td>)}</tr>)}</tbody>
        </table></div>,
      );
      continue;
    }
    if (/^([-*•])\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const ordered = /^\d+[.)]\s+/.test(t);
      const items = [];
      while (i < lines.length) {
        const l = lines[i].trim();
        const m = ordered ? l.match(/^\d+[.)]\s+(.*)$/) : l.match(/^[-*•]\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(<Tag key={i} className="md-list">{items.map((it, k) => <li key={k}>{inline(it, `li${i}${k}`)}</li>)}</Tag>);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\||[-*•]\s|\d+[.)]\s)/.test(lines[i].trim())) para.push(lines[i++].trim());
    if (!para.length) { para.push(t); i++; }
    blocks.push(<p key={i} className="md-p">{para.map((p, k) => <Fragment key={k}>{k > 0 && <br />}{inline(p, `p${i}${k}`)}</Fragment>)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
