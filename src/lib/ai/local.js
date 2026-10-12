// „Ohne KI“: regelbasierte Auswertungen aus denselben Datenwerkzeugen – kein API-Schlüssel,
// keine Daten verlassen den Browser. Liefert Markdown wie die KI-Anbieter.
import { fmtMoney, fmtDate } from '../format.js';

const eur = (n) => fmtMoney(Number(n) || 0);
const d = (iso) => (iso ? fmtDate(iso) : '—');
const lk = (label, href) => (href ? `[${label}](${href})` : label);
const pct = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n} %`);
const table = (head, rows) => (rows.length ? `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n` : '_Keine Einträge._\n');

const GENERIC = new Set(['praxis', 'klinikum', 'krankenhaus', 'zentrum', 'gmbh', 'klinik', 'medizinisches', 'universitätsklinikum', 'gesundheitszentrum', 'seniorenresidenz', 'dr.']);
function detectAccount(db, text) {
  const t = text.toLowerCase();
  const kn = t.match(/k-\d{3,}/);
  if (kn) { const a = db.accounts.find((x) => (x.kundennummer || '').toLowerCase() === kn[0]); if (a) return a; }
  let best = null, score = 0;
  db.accounts.forEach((a) => {
    const name = a.name.toLowerCase();
    if (t.includes(name)) { if (name.length > score) { best = a; score = name.length + 100; } return; }
    const hits = name.split(/[\s&,.-]+/).filter((w) => w.length >= 4 && !GENERIC.has(w) && t.includes(w)).length;
    if (hits > 0 && hits * 10 > score) { best = a; score = hits * 10; }
  });
  return best;
}

const has = (t, re) => re.test(t);

export async function runLocal({ question, context, exec, cb, db }) {
  const t = question.toLowerCase();
  const ctxAccount = context?.kind === 'accounts' ? db.accounts.find((a) => a.id === context.id) : null;
  const mentioned = detectAccount(db, question);
  const account = mentioned || (/(dies|diese[nmr]?|kunde|firma|termin|gespräch|vorbereit)/.test(t) ? ctxAccount : null) || null;
  const out = (s) => cb.text(s);

  if (has(t, /aufmerksam|achtung|risik|kritisch|problem|handlungsbedarf|brennt|warn/)) return out(attention(exec));
  if (has(t, /follow|nachfass|wer muss|anruf|kontaktier|fällig|to-?do|erledigen/)) return out(followups(exec));
  if (has(t, /betreuungskost|kostenquote|unwirtschaft|defizit|rentab|kosten/)) return out(careCosts(exec, account));
  if (account && has(t, /vorbereit|gespräch|termin|meeting|briefing|besuch|analys|überblick|zusammenfass|alles über/)) return out(meetingPrep(exec, account));
  if (has(t, /umsatz|revenue|verkauf|erlös/)) {
    if (account) return out(meetingPrep(exec, account));
    const g = has(t, /betreuer|mitarbeiter|vertriebl|außendienst/) ? 'owner' : has(t, /gebiet|region/) ? 'territory' : has(t, /produkt|artikel/) ? 'product' : has(t, /monat|verlauf|entwicklung|trend/) ? 'month' : has(t, /typ|segment|branche/) ? 'type' : 'account';
    return out(revenue(exec, g));
  }
  if (has(t, /pipeline|deal|chance|prognose|forecast/)) return out(pipeline(exec));
  if (has(t, /team|zielerreich|quote|vertriebler|mitarbeiter/)) return out(team(exec));
  if (has(t, /kpi|kennzahl|lage|überblick|zusammenfass|summary|dashboard|status/)) return out(kpis(exec));
  if (account || ctxAccount) return out(meetingPrep(exec, account || ctxAccount));
  return out(help());
}

function meetingPrep(exec, a) {
  const o = exec('get_account_overview', { account_id: a.id });
  const ord = exec('get_account_orders', { account_id: a.id, limit: 5 });
  const pi = exec('get_product_insights', { account_id: a.id });
  const tl = exec('get_account_timeline', { account_id: a.id, limit: 6 });
  const u = o.umsatz;
  const trend = u.vorjahr_bis_heute ? Math.round(((u.laufendes_jahr - u.vorjahr_bis_heute) / u.vorjahr_bis_heute) * 100) : null;
  const due = pi.gekaufte_produkte.filter((p) => p.nachbestellung_faellig);
  let s = `# Gesprächsvorbereitung: ${lk(o.name, o.link)}\n\n`;
  s += `**${o.typ}** · ${o.kategorie} · Status **${o.status}** · ${o.ort} · Kundennr. ${o.kundennummer}\n\n`;
  s += `Außendienst: ${lk(o.aussendienst?.name || '—', o.aussendienst?.link)} · Innendienst: ${lk(o.innendienst?.name || '—', o.innendienst?.link)} · Gebiet: ${o.gebiet || '—'} · Kunde seit ${d(o.kunde_seit)} · letzter Kontakt ${d(o.letzter_kontakt)}${o.tage_seit_kontakt != null ? ` (vor ${o.tage_seit_kontakt} Tagen)` : ''}\n\n`;
  s += `## Umsatz & Entwicklung\n`;
  s += table(['Kennzahl', 'Wert'], [
    ['Auftragsumsatz lfd. Jahr', `**${eur(u.laufendes_jahr)}**`], ['Vorjahr (gleicher Zeitraum)', eur(u.vorjahr_bis_heute)], ['Veränderung', pct(trend)],
    ['Vorjahr gesamt', eur(u.vorjahr_gesamt)], ['Offene Pipeline', eur(o.offene_pipeline)], ['Offene Posten', eur(o.offene_posten)],
  ]);
  s += `\n## Zuletzt bestellt\n`;
  s += table(['Beleg', 'Datum', 'Status', 'Positionen', 'Summe'], ord.angebote_und_auftraege.map((x) => [lk(`${x.art} ${x.nummer}`, x.link), d(x.datum), x.status, x.positionen.map((p) => `${p.menge}× ${p.produkt}`).join(', '), eur(x.summe)]));
  s += `\n## Produkte & Bedarf\n`;
  s += table(['Produkt', 'Menge gesamt', 'Umsatz', 'Letzter Kauf', 'Rhythmus', 'Nachbestellung'], pi.gekaufte_produkte.map((p) => [lk(p.produkt, p.link), p.menge_gesamt, eur(p.umsatz), d(p.letzter_kauf), p.bestellrhythmus_tage ? `≈ ${p.bestellrhythmus_tage} Tage` : '—', p.nachbestellung_faellig ? '**fällig**' : p.nachbestellung_faellig === false ? 'nein' : '—']));
  if (pi.dauerauftraege.length) s += `\nDaueraufträge: ${pi.dauerauftraege.map((r) => `${lk(r.intervall, r.link)} (${eur(r.wert_je_lauf)}, nächste ${d(r.naechste_faelligkeit)}${r.aktiv ? '' : ', pausiert'})`).join('; ')}\n`;
  s += `\n## Empfehlungen (Cross-Selling)\n`;
  s += pi.cross_selling_empfehlungen.length ? pi.cross_selling_empfehlungen.map((r) => `- ${lk(r.produkt, r.link)} (${eur(r.preis)}) – gekauft von ${r.gekauft_von_vergleichbaren_kunden} vergleichbaren ${o.typ}-Kunden`).join('\n') + '\n' : '_Keine Empfehlungen aus vergleichbaren Kunden._\n';
  s += `\n## Offene Punkte\n`;
  const open = [
    ...o.offene_angebote.map((x) => `- Angebot ${lk(x.nummer, x.link)} (${eur(x.wert)}, ${x.status}, vom ${d(x.datum)})`),
    ...o.offene_deals.map((x) => `- Deal ${lk(x.name, x.link)} – ${x.phase}, ${eur(x.wert)}, Abschluss ${d(x.abschluss)}`),
    ...o.ueberfaellige_rechnungen.map((x) => `- **Überfällige Rechnung** ${lk(x.nummer, x.link)}: ${eur(x.offen)} offen`),
    ...o.offene_tickets.map((x) => `- Ticket ${lk(x.betreff, x.link)} (${x.status}, Priorität ${x.prioritaet})`),
    ...o.offene_qm_vorkommnisse.map((x) => `- QM-Vorkommnis ${lk(x.titel, x.link)} (${x.schweregrad}${x.meldepflichtig ? ', meldepflichtig' : ''})`),
    ...o.offene_aufgaben.map((x) => `- Aufgabe ${lk(x.betreff, x.link)} – fällig ${d(x.faellig)}`),
  ];
  s += open.length ? open.join('\n') + '\n' : '_Keine offenen Punkte._\n';
  s += `\n## Ansprechpartner\n`;
  s += o.ansprechpartner.length ? o.ansprechpartner.map((c) => `- ${lk(c.name, c.link)} – ${c.rolle || '—'}${c.haupt ? ' (Hauptkontakt)' : ''}, letzter Kontakt ${d(c.letzter_kontakt)}`).join('\n') + '\n' : '_Keine Ansprechpartner hinterlegt._\n';
  if (tl.eintraege.length) s += `\n## Letzte Ereignisse\n` + tl.eintraege.map((e) => `- ${d(e.datum)} · ${e.typ}: ${e.link ? lk(e.text, e.link) : e.text}`).join('\n') + '\n';
  s += `\n## Gesprächsleitfaden\n`;
  const g = [];
  if (o.ueberfaellige_rechnungen.length) g.push(`Offene Posten von ${eur(o.offene_posten)} diplomatisch ansprechen und Zahlungstermin vereinbaren.`);
  if (due.length) g.push(`Nachbestellung anbieten: ${due.map((p) => p.produkt).join(', ')} (Bestellrhythmus überschritten).`);
  if (trend != null && trend < -10) g.push(`Umsatzrückgang (${pct(trend)}) offen ansprechen: Bedarf, Wettbewerb, Budget klären.`);
  if (trend != null && trend > 10) g.push(`Positive Entwicklung (${pct(trend)}) würdigen und Ausbau anbieten.`);
  o.offene_angebote.forEach((x) => g.push(`Angebot ${x.nummer} nachfassen: Entscheidungsstand und Einwände klären.`));
  if (pi.cross_selling_empfehlungen[0]) g.push(`Neues Produkt vorstellen: ${pi.cross_selling_empfehlungen[0].produkt} – bei vergleichbaren Kunden etabliert.`);
  if (o.offene_tickets.length || o.offene_qm_vorkommnisse.length) g.push('Offene Reklamationen/Vorkommnisse zuerst klären – Zufriedenheit sichern.');
  if (o.status === 'Gefährdet') g.push('Kunde ist als **gefährdet** markiert: Zufriedenheit und Kündigungsrisiko aktiv erfragen.');
  g.push('Fragen: Welche Projekte/Investitionen stehen an? Wer entscheidet mit? Wie zufrieden sind Sie mit Lieferung und Ansprechpartnern?');
  s += g.map((x, i) => `${i + 1}. ${x}`).join('\n') + '\n';
  return s;
}

function attention(exec) {
  const a = exec('get_attention_list', {});
  let s = '# Wo ist Aufmerksamkeit nötig?\n\n';
  const sec = (title, rows, fmt) => { if (rows.length) s += `## ${title} (${rows.length})\n` + rows.map(fmt).join('\n') + '\n\n'; };
  sec('Meldepflichtige QM-Vorkommnisse', a.meldepflichtige_qm_vorkommnisse, (x) => `- **${lk(x.nummer + ' ' + x.titel, x.link)}** (${x.firma}) – Meldefrist spätestens ${d(x.meldefrist)}`);
  sec('Überfällige Rechnungen', a.ueberfaellige_rechnungen, (x) => `- ${lk(x.rechnung, x.link)} · ${x.firma} · **${eur(x.offen)}** offen`);
  sec('Gefährdete Kunden', a.gefaehrdete_kunden, (x) => `- ${lk(x.firma, x.link)} (Betreuer: ${x.betreuer || '—'})`);
  sec('Umsatzrückgang ggü. Vorjahr', a.umsatzrueckgang_ggue_vorjahr, (x) => `- ${lk(x.firma, x.link)}: ${eur(x.umsatz_lfd)} vs. ${eur(x.vorjahr_gleicher_zeitraum)} (${pct(x.veraenderung_prozent)})`);
  sec('Tickets mit hoher Priorität', a.tickets_hohe_prioritaet, (x) => `- ${lk(x.ticket, x.link)} · ${x.firma} · ${x.status}`);
  sec('Festgefahrene Deals', a.festgefahrene_deals, (x) => `- ${lk(x.deal, x.link)} · ${x.firma} · ${eur(x.wert)} – ${x.grund}`);
  sec('Überfällige Aufgaben', a.ueberfaellige_aufgaben, (x) => `- ${lk(x.betreff, x.link)} · ${x.firma || '—'} · fällig ${d(x.faellig)} · ${x.verantwortlich || '—'}`);
  sec('Kein Kontakt seit über 60 Tagen', a.kein_kontakt_seit, (x) => `- ${lk(x.firma, x.link)} – ${x.tage != null ? `${x.tage} Tage` : 'nie'} (${x.betreuer || '—'})`);
  sec('Unwirtschaftliche Kunden (lfd. Jahr)', a.unwirtschaftliche_kunden_lfd_jahr, (x) => `- ${lk(x.firma, x.link)}: Betreuungskosten ${eur(x.betreuungskosten)} > Umsatz ${eur(x.umsatz)}`);
  return s.trim() === '# Wo ist Aufmerksamkeit nötig?' ? s + 'Aktuell gibt es keine kritischen Punkte.' : s;
}

function followups(exec) {
  const f = exec('get_followups', { days_ahead: 14 });
  let s = `# Follow-ups (nächste ${f.horizont_tage} Tage)\n\n${f.anzahl} offene Punkte · ` + Object.entries(f.pro_betreuer).map(([k, v]) => `${k}: ${v}`).join(' · ') + '\n\n';
  s += table(['Typ', 'Was', 'Firma', 'Fällig', 'Betreuer'], f.follow_ups.map((x) => [x.ueberfaellig ? `**${x.typ} (überfällig)**` : x.typ, lk(x.was, x.link), x.firma || '—', x.faellig ? d(x.faellig) : x.gesendet_vor_tagen != null ? `seit ${x.gesendet_vor_tagen} T.` : x.seit_tagen != null ? `seit ${x.seit_tagen} T.` : '—', x.betreuer || '—']));
  return s;
}

function careCosts(exec, account) {
  const c = exec('get_care_costs', account ? { group_by: 'account', account_id: account.id } : { group_by: 'account' });
  let s = `# Betreuungskosten-Analyse${account ? ': ' + account.name : ''}\n\nZeitraum ${d(c.zeitraum.von)} – ${d(c.zeitraum.bis)}\n\n`;
  s += `**Gesamt:** Betreuungskosten ${eur(c.gesamt.betreuungskosten)} · Auftragsumsatz ${eur(c.gesamt.auftragsumsatz)} · Netto ${eur(c.gesamt.netto)} · Kostenquote ${c.gesamt.kostenquote_prozent ?? '—'} %\n\n`;
  s += table(['Firma', 'Kosten', 'Umsatz', 'Netto', 'Quote', 'Einsätze'], c.zeilen.map((r) => [lk(r.gruppe, r.link), eur(r.betreuungskosten), eur(r.auftragsumsatz), r.defizitaer ? `**${eur(r.netto)}**` : eur(r.netto), r.kostenquote_prozent != null ? r.kostenquote_prozent + ' %' : '—', r.einsaetze]));
  if (c.defizitaere.length) s += `\n**Defizitär:** ${c.defizitaere.join(', ')} – Betreuungsintensität prüfen (Telefon/Remote statt Besuch, Besuche bündeln) oder Umsatzpotenzial heben.\n`;
  return s;
}

function revenue(exec, group) {
  const r = exec('get_revenue', { group_by: group });
  const label = { account: 'Firma', owner: 'Betreuer', territory: 'Gebiet', product: 'Produkt', month: 'Monat', type: 'Firmentyp' }[group];
  let s = `# Umsatz nach ${label}\n\nZeitraum ${d(r.zeitraum.von)} – ${d(r.zeitraum.bis)} · Basis: ${r.basis}\n\n**Gesamt: ${eur(r.gesamt)}** (Vorjahreszeitraum ${eur(r.gesamt_vorjahreszeitraum)})\n\n`;
  s += table([label, 'Umsatz', 'Vorjahreszeitraum', 'Veränderung', 'Aufträge'], r.zeilen.map((x) => [lk(x.gruppe, x.link), eur(x.umsatz), eur(x.vorjahreszeitraum), pct(x.veraenderung_prozent), x.auftraege]));
  return s;
}

function pipeline(exec) {
  const p = exec('get_pipeline', {});
  let s = `# Pipeline\n\nGewonnen: ${p.gewonnen.anzahl} (${eur(p.gewonnen.wert)}) · Verloren: ${p.verloren.anzahl} · Gewinnquote: ${p.gewinnquote_prozent ?? '—'} %\n\n`;
  p.phasen.forEach((ph) => { s += `## ${ph.phase} – ${ph.anzahl} Deals, ${eur(ph.wert)}\n` + (ph.deals.map((x) => `- ${lk(x.name, x.link)} · ${x.firma} · ${eur(x.wert)} · Score ${x.score} · Abschluss ${d(x.abschluss)}`).join('\n') || '_—_') + '\n\n'; });
  return s;
}

function team(exec) {
  const t = exec('get_team', {});
  return '# Team & Zielerreichung\n\n' + table(['Mitarbeiter', 'Rolle', 'Umsatz lfd. J.', 'Ziel', 'Erreichung', 'Pipeline', 'Firmen', 'Offene Aufgaben'],
    t.team.map((u) => [lk(u.name, u.link), u.rolle, eur(u.auftragsumsatz_lfd_jahr), u.ziel ? eur(u.ziel) : '—', u.zielerreichung_prozent != null ? u.zielerreichung_prozent + ' %' : '—', eur(u.offene_pipeline), u.betreute_firmen, u.offene_aufgaben]));
}

function kpis(exec) {
  const k = exec('get_kpis', {});
  return `# Lagebild\n\nZeitraum ${d(k.zeitraum.von)} – ${d(k.zeitraum.bis)}\n\n` + table(['Kennzahl', 'Wert'], [
    ['Auftragsumsatz', `**${eur(k.auftragsumsatz)}**`], ['Angebotsvolumen', eur(k.angebotsvolumen)], ['Offene Pipeline', eur(k.offene_pipeline)], ['Gewinnquote', (k.gewinnquote_prozent ?? '—') + ' %'],
    ['Offene Posten', eur(k.offene_posten)], ['Überfällige Rechnungen', k.ueberfaellige_rechnungen], ['Aktive / gefährdete Kunden', `${k.kunden_aktiv} / ${k.kunden_gefaehrdet}`],
    ['Interessenten', k.interessenten], ['Offene Tickets', k.offene_tickets], ['Offene QM-Vorkommnisse', k.offene_qm_vorkommnisse], ['Betreuungskosten', eur(k.betreuungskosten)],
  ]) + '\nTipp: Fragen Sie „Wo ist Aufmerksamkeit nötig?“ oder „Wer braucht ein Follow-up?“.';
}

function help() {
  return `Im Modus **Ohne KI** beantworte ich diese Fragen direkt aus den CRM-Daten:

- **Gesprächsvorbereitung** – z. B. „Bereite meinen Termin mit Klinikum Ostsee vor“
- **Wo ist Aufmerksamkeit nötig?** – Risiken, Überfälliges, Rückgänge
- **Wer braucht ein Follow-up?**
- **Betreuungskosten** – gesamt oder für eine Firma
- **Umsatz** nach Firma, Betreuer, Gebiet, Produkt, Monat oder Firmentyp
- **Pipeline**, **Team & Zielerreichung**, **Lagebild/KPIs**

Für freie Fragen, Zusammenfassungen und tiefere Analysen in eigenen Worten verbinden Sie unter **Einstellungen → KI-Assistent** einen KI-Anbieter (Claude, Gemini oder OpenAI-kompatibel).`;
}
