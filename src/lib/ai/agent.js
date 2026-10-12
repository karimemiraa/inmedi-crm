// Steuerung des KI-Assistenten: Systemanweisung, Seitenkontext, Anbieterwahl.
import { store } from '../../data/store.js';
import { TOOL_DEFS, ACTION_TOOLS, runTool, createPrivacy } from './tools.js';
import { RUNNERS, ProviderError } from './providers.js';
import { runLocal } from './local.js';

// Stabil gehalten (nur Datum ändert sich täglich), damit der Prompt-Cache greift.
export function buildSystemPrompt(db) {
  const me = db.users.find((u) => u.id === db.meta.currentUserId);
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const iso = new Date().toISOString().slice(0, 10);
  return `Du bist der KI-Assistent im InMedi CRM. InMedi ist ein Medizinprodukte-Händler (Verkauf von Medizintechnik und Verbrauchsmaterial an Krankenhäuser, Praxen, Pflegeeinrichtungen, Apotheken und Großhändler). InMedi bietet KEINE Dienstleistungen wie Wartung, Reparatur oder Installation an.

Heute ist ${today} (${iso}). Du arbeitest für ${me?.name || 'den Benutzer'} (${me?.title || ''}, Rolle: ${me?.role || ''}, User-ID ${me?.id || ''}).

## Arbeitsweise
- Beantworte Fragen ausschließlich auf Basis der CRM-Daten, die du über die Werkzeuge abrufst. Erfinde niemals Zahlen, Namen, Produkte oder Termine. Wenn Daten fehlen, sag das klar.
- Rufe für jede Aussage mit Zahlen die passenden Werkzeuge auf. Kombiniere mehrere Werkzeuge, wenn die Frage es erfordert (z. B. Gesprächsvorbereitung = get_account_overview + get_account_orders + get_product_insights + get_account_timeline). Mehrere unabhängige Werkzeuge darfst du gleichzeitig aufrufen.
- Wird eine Firma nur mit Namen genannt, ermittle sie zuerst mit search_records.
- Antworte auf Deutsch, präzise und gut strukturiert (Überschriften, Aufzählungen, kompakte Tabellen). Beträge in Euro mit Tausenderpunkt (z. B. 48.000 €), Daten als TT.MM.JJJJ.
- Verlinke Datensätze immer als Markdown-Link mit dem Feld \`link\` aus den Werkzeugergebnissen, z. B. [Universitätsklinikum Nord](#/accounts/A1). Erfinde keine Links.
- Bewerte und priorisiere: Was ist wichtig, was ist dringend, was sollte der Vertrieb konkret tun? Schließe Analysen mit 2–4 konkreten Handlungsempfehlungen ab.
- Aktionen: Du kannst Aufgaben (propose_task) oder Kommentare (propose_comment) nur VORSCHLAGEN. Der Benutzer bestätigt sie selbst per Klick. Behaupte nie, etwas angelegt oder gespeichert zu haben.

## Begriffe im CRM
- Umsatz = Summe der Aufträge (Art „Auftrag“); Angebote zählen nicht zum Umsatz.
- Betreuungskosten = bewerteter Betreuungsaufwand (Besuche, Demos, Telefonate, Fahrten). Kostenquote = Betreuungskosten / Auftragsumsatz. Defizitär = Kosten > Umsatz.
- Offene Posten = Rechnungsbetrag minus bezahlt. Pipeline = offene Deals (nicht gewonnen/verloren).
- Vorgänge = Aufgaben/Termine, Kundendienst-Tickets, QM-Vorkommnisse (MDR-Vigilanz, Meldefrist max. 15 Tage), CAPA, Ideen.

## Datenschutz
E-Mail-Adressen und Telefonnummern von Kunden sind für dich nicht verfügbar. Namen können pseudonymisiert sein (z. B. „Ansprechpartner 2“) – übernimm sie dann genau so.

## Gesprächsvorbereitung (Struktur)
1. Kurzprofil (Typ, Kategorie, Status, Betreuer, Kunde seit, letzter Kontakt)
2. Umsatz & Entwicklung (lfd. Jahr vs. Vorjahr, Trend, offene Posten)
3. Zuletzt bestellt (letzte Aufträge mit wichtigsten Positionen)
4. Produkte & Bedarf (Kaufhistorie, Bestellrhythmus, fällige Nachbestellungen, Daueraufträge)
5. Empfehlungen (Cross-Selling mit Begründung)
6. Offene Punkte (Angebote, Deals, Rechnungen, Tickets, QM, Aufgaben)
7. Ansprechpartner
8. Gesprächsleitfaden: Ziele, Einstiegsthemen, Fragen an den Kunden, mögliche Einwände`;
}

// Seitenkontext als Text für die Frage (nicht im Systemprompt → Cache bleibt stabil)
export function contextNote(db, ctx) {
  if (!ctx) return '';
  const name = ctx.kind === 'accounts' ? db.accounts.find((a) => a.id === ctx.id)?.name
    : ctx.kind === 'contacts' ? 'Ansprechpartner ' + ctx.id : ctx.label;
  return name ? `[Kontext: Der Benutzer befindet sich gerade auf der Seite „${name}“ (${ctx.kind}, ID ${ctx.id}). Beziehe „dieser Kunde/diese Firma“ darauf.]\n\n` : '';
}

export function newConversation(settings) {
  return { id: Date.now(), provider: settings.provider, history: [], privacy: createPrivacy(settings.provider !== 'local' && settings.pseudonymize) };
}

// Eine Frage beantworten. cb: { text(delta), tool(name, input), action(name, input), usage(u) }
export async function ask({ conversation, settings, question, context, cb, signal }) {
  const db = store.get();
  const exec = (name, input) => {
    cb.tool?.(name, input);
    if (ACTION_TOOLS.has(name)) cb.action?.(name, input);
    return runTool(name, input, { privacy: conversation.privacy });
  };
  if (settings.provider === 'local') return runLocal({ question, context, exec, cb, db });

  const runner = RUNNERS[settings.provider];
  if (!runner) throw new ProviderError('Unbekannter Anbieter.');
  const userText = contextNote(db, context) + question;
  const { history } = conversation;
  const mark = history.length; // bei Fehler/Abbruch zurückrollen, damit der Verlauf gültig bleibt
  if (settings.provider === 'anthropic') history.push({ role: 'user', content: userText });
  else if (settings.provider === 'gemini') history.push({ role: 'user', parts: [{ text: userText }] });
  else history.push({ role: 'user', content: userText });
  const cfg = settings[settings.provider];
  try {
    await runner({ cfg, proxyUrl: settings.proxyUrl, system: buildSystemPrompt(db), history, tools: TOOL_DEFS, exec, cb, signal });
  } catch (e) {
    history.length = mark;
    throw e;
  }
}
