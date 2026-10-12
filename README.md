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
| **Campaigns** | Email marketing & newsletters, open/click rates, segmentation, member links |
| **Reports** | Flexible builder — list **and 2-D cross-tab (Kreuztabelle)**, any source × dimension × measure, date-filtered, CSV export |
| **Betreuungskosten-Analyse** | Cost-to-serve vs. revenue per customer / rep / territory — Netto, Kostenquote, defizitär flagging |
| **Provision** | Sales commission on realized Aufträge per rep (configurable rates), date-filtered, CSV export |
| **Kostenkalkulation** | Visit/call/travel/training costs valued via stored rates |
| **Territories & Team** | Territory coverage, rep quota attainment, commission, user roles |
| **Documents / Messages / Datenschutz** | Document register, per-customer correspondence log, GDPR tools + audit trail |
| **Settings** | **Vorgänge & Status** (rename, recolor, reorder, add, delete statuses per Vorgangsart, with an "abgeschlossen" flag that drives counters/KPIs; existing records are migrated automatically), if-then **automation rules**, **custom fields**, **users & roles**, **branding**, demo-data / empty reset + JSON export |

Plus global search, notifications, quick-add (account/contact/deal/activity), clickable record links everywhere, and a responsive layout.

### Ease-of-use & professional polish

- **Deep-linking** — every record reference opens that exact record (via `?open=<id>`), not just its list.
- **Global search** (⌘K) spans Firmen, Ansprechpartner, Interessenten, Deals, Aufträge, Rechnungen, Produkte and Messen, each deep-linked, with ↑/↓/↵ keyboard navigation.
- **Sortable tables** — click any column header to sort (asc/desc) on all major lists.
- **Dashboard drill-downs** — KPI cards and charts jump into the matching (filtered) view; empty states carry a primary create button.
- **Dark mode** — sun/moon toggle in the top bar, remembers your choice and follows the OS by default.

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
