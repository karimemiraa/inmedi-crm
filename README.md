# InMedi CRM

A modern, professional CRM for **InMedi** — medical devices & supplies. Built as a high-level upgrade of the Emnis CRM workflow, with a clean dashboard-first layout and every Emnis function reimagined for a medical sales team.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # production build to /dist
```

## What's inside (all Emnis functions, upgraded)

| Module | Covers |
|--------|--------|
| **Dashboard** | KPIs (revenue, pipeline, win rate, accounts), revenue trend, account mix, pipeline-by-stage, revenue-by-territory, top products, tasks due, top deals |
| **Pipeline** | Drag-and-drop Kanban + list view, deal scoring, stage management; deal drawer links contact + resulting orders |
| **Leads** | Lead scoring, sources, status, one-click convert to account (records provenance both ways) |
| **Orders & Quotes** | Quotes → orders, line items, statuses; order ↔ deal ↔ invoice cross-links |
| **Daueraufträge** | Recurring orders per customer (interval + items); one-click "generate due orders" creates linked Aufträge |
| **Invoices** | Open items & payment status; invoice ↔ order ↔ account cross-links, item prefill from order |
| **Contracts** | Term contracts with recurring billing (MRR), contact + origin-order links |
| **Activities** | Tasks, calls, meetings, emails, follow-ups · list + month calendar · linked to contact + deal |
| **Accounts** | Hospitals / clinics / pharmacies / distributors; detail view with tabs: overview, custom fields, notes, Vorgänge, Daueraufträge, conditions, contacts, deals, activities, invoices, Kundendienst & QM, Messen, documents |
| **Contacts** | Full contact detail page — its own deals, activities, tickets, contracts, Messen participation, custom fields, notes |
| **Dublettenprüfung** | Duplicate detection for accounts & contacts (name/email/phone/PLZ) with side-by-side review and safe merge that re-points all child records |
| **Messen & Events** | Trade shows / congresses / webinars with budget vs. cost and mixed attendee lists (accounts, contacts, leads) |
| **Products** | Medical catalog — SKU, category, price, stock, inventory value |
| **Vorgänge: Kundendienst / QM & Vigilanz / Ideen** | Customer requests, complaints & product feedback (linked to product); MDR/MPDG incidents with product, LOT/serial, reportable flag and 15-day reporting deadline; CAPA. InMedi sells products only — no field-service, repair or device-maintenance modules |
| **Vorgang-Seiten** | Every record has its own page at `/vorgang/:typ/:id` — Tickets, Aufgaben, Ideen, QM-Vorkommnisse, CAPA, Deals, Angebote/Aufträge, Rechnungen, Verträge, Daueraufträge, Messen, Kampagnen, Produkte. Edit all fields (incl. custom fields), editable line items with live totals, status, comments (author edits own, admins delete any), linked records (Deal → Angebot → Auftrag → Rechnung/Vertrag, Ticket → Vorkommnis → CAPA, parent/child), automatic change history, duplicate, delete to **Papierkorb** (restore or purge in Einstellungen → Daten & Papierkorb). One-click conversions: Angebot erstellen, In Auftrag umwandeln, Rechnung erstellen, Vertrag anlegen, Als bezahlt markieren, Kündigen (with reason), Dauerauftrag ausführen, Folgeaufgabe. List rows open the page; legacy `?open=` links redirect. |
| **Firmen & Ansprechpartner** | Same editing model as Vorgänge: inline edit form (all master data + custom fields), Kommentieren, Duplizieren, Löschen, status, Kommentare (former Notizen migrated automatically, also for Interessenten), Verlauf. Deleting a Firma with Aufträge/Rechnungen/Verträge/Daueraufträge is blocked (GoBD retention) and offers *Inaktiv* instead — inactive Firmen are hidden from the list by default; otherwise the Firma moves to the Papierkorb together with its Ansprechpartner and can be restored as a unit. List rows have edit/delete buttons. |
| **Mitarbeiter** | `/team/:id` — profile, KPIs (Firmen, Pipeline, Umsatz, Zielerreichung), open Vorgänge, betreute Firmen, recent changes; every Betreuer/Verantwortlicher name is clickable |
| **Campaigns** | Email marketing & newsletters, open/click rates, segmentation, member links |
| **Reports** | Flexible builder — list **and 2-D cross-tab (Kreuztabelle)**, any source × dimension × measure, date-filtered, CSV export |
| **Betreuungskosten-Analyse** | Cost-to-serve vs. revenue per customer / rep / territory — Netto, Kostenquote, defizitär flagging |
| **Provision** | Sales commission on realized Aufträge per rep (configurable rates), date-filtered, CSV export |
| **Kostenkalkulation** | Visit/call/travel/training costs valued via stored rates |
| **Territories & Team** | Territory coverage, rep quota attainment, commission, user roles |
| **Documents / Messages / Datenschutz** | Document register, per-customer correspondence log, GDPR tools + audit trail |
| **Settings** | **Vorgänge & Status** (rename, recolor, reorder, add, delete statuses per Vorgangsart, with an "abgeschlossen" flag that drives counters/KPIs; existing records are migrated automatically), if-then **automation rules**, **custom fields**, **users & roles**, **branding**, demo-data / empty reset + JSON export |

Plus a **KI-Assistent** (see below), global search, notifications, quick-add (account/contact/deal/activity), clickable record links everywhere, and a responsive layout.

### Ease-of-use & professional polish

- **Deep-linking** — every record reference opens that exact record (via `?open=<id>`), not just its list.
- **Global search** (⌘K) spans Firmen, Ansprechpartner, Interessenten, Deals, Aufträge, Rechnungen, Produkte and Messen, each deep-linked, with ↑/↓/↵ keyboard navigation.
- **Sortable tables** — click any column header to sort (asc/desc) on all major lists.
- **Dashboard drill-downs** — KPI cards and charts jump into the matching (filtered) view; empty states carry a primary create button.
- **Dark mode** — sun/moon toggle in the top bar, remembers your choice and follows the OS by default.

## Rechnungseingang per E-Mail

PDF invoices sent to a Microsoft 365 mailbox are imported fully automatically:
- A small server (`server/`, runs on your own Oracle server) reads the mailbox every 5 minutes, day and night. It parses each PDF and files the email into "Rechnungen verarbeitet" or "Rechnungen prüfen".
- The CRM syncs on opening and every few minutes while open. It assigns each invoice to a Firma and Betreuer by Kundennummer, marks unclear invoices **Zu prüfen** (fixable in one click), and skips duplicates.
- **Dokumente → Rechnungen** shows the source (E-Mail/Upload), a "Zu prüfen" filter, search, and CSV/Excel exports for invoices and for positions (filtered). **Einstellungen → Daten** also has both CSV exports and the full JSON backup.
- Setup guide: [`server/README.md`](server/README.md). Connect in **Einstellungen → Rechnungseingang** (the server address and token stay in the browser).

## KI-Assistent

A data-connected assistant for meeting preparation and analysis. It is available as a full page (**KI-Assistent** in the sidebar), as a side panel on every page (floating button, bottom right) and through the **Gesprächsvorbereitung** button on each Firma.

**What it does:** client meeting preparation (profile, recent orders and products, reorder rhythm, cross-selling, Umsatz vs. prior year, open items, talking points), Umsatz analysis (by Firma, Betreuer, Gebiet, Produkt, Monat or Typ, compared with the prior-year period), Betreuungskosten vs. Umsatz, an attention list (risks, declines, overdue items, no contact), follow-ups per Betreuer, pipeline, team and KPIs.

**How it works:**
- The model never receives the whole database.
- It calls 15 data tools (`src/lib/ai/tools.js`) that run locally in the browser and return only what a question needs.
- Every answer links back to the records (`#/vorgang/...`).

**Providers** (Settings, KI-Assistent tab):

| Provider | Notes |
|---|---|
| Ohne KI (default) | Offline, deterministic reports built from the same tools; no key needed |
| Claude (Anthropic) | Official `@anthropic-ai/sdk`. Models: Opus 5.5 (default), Sonnet 5.5, Haiku 5.5. Adaptive thinking, selectable effort, cached system prompt, streaming |
| Google Gemini | REST function calling (default `gemini-2.5-pro`) |
| OpenAI-compatible | Any `/chat/completions` endpoint with tools (OpenAI, Azure, Mistral, local Ollama/LM Studio) |

**Actions:**
- The assistant can only *propose* a task or a comment.
- Nothing is written until the user clicks **Ausführen** on the proposal card.

**Privacy and security:**
- E-mail addresses and phone numbers are never sent. They are left out of tool results and scrubbed from free text.
- Optional pseudonymization replaces contact and lead names with placeholders such as "Ansprechpartner 1" before sending. Answers are translated back locally for display.
- Names of your own employees stay visible so that responsibilities can be named.
- API keys live only in this browser's localStorage (`inmedi-ai-settings`). They are not part of the CRM data, the JSON export or this repository.
- A browser-stored key can be read by anyone with access to this browser profile. For production, set a **Proxy-URL** (a small server that holds the key and forwards requests). The client already supports it.
- Before using real customer data, sign a data processing agreement (AVV/DPA) with the provider and check the data region.

Code: `src/lib/ai/` (tools, providers, agent, local mode, chat state) and `src/components/ai/` (chat, panel, Markdown renderer, settings).

## Tech

- **React 18 + Vite**, React Router (hash routing), Recharts, lucide-react.
- **Data layer:** `src/data/store.js` — a localStorage-backed store with pub/sub. Fully cross-linked German demo data in `src/data/seed.js` (`buildSeed({ empty: true })` for a blank start). Swap this layer for a real API later; the pages don't change.
- **Domain logic libs:** `src/lib/dedupe.js` (duplicate detection + merge), `src/lib/commission.js` (Provision), plus csv/format/labels helpers.

## Demo login

Any user signs in with password **`inmedi2026`**. The admin (Karim, `karim@inmedi.de`) also needs 2FA code **`123456`**. Reset or clear the demo data under **Einstellungen → Daten**.

## Rebranding to real InMedi assets

Everything is wired for a one-step swap:

1. **Colors** — edit `--brand` and `--brand-2` (and friends) at the top of `src/index.css`. The whole app re-themes.
2. **Logo** — replace the `<svg>` mark in `src/components/Logo.jsx` (or drop `logo.svg` into `/public` and reference it), and update the wordmark text.
3. See **Settings → Branding** in the app for the live reference.
