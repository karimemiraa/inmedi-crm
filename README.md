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
| **Pipeline** | Drag-and-drop Kanban + list view, deal scoring, stage management, deal drawer |
| **Leads** | Lead scoring, sources, status, one-click convert to account |
| **Orders & Quotes** | Quotes → orders, line items, statuses, itemized drawer |
| **Activities** | Tasks, calls, meetings, emails, follow-ups · list + month calendar |
| **Accounts** | Hospitals / clinics / pharmacies / distributors, full detail view with tabs (contacts, deals, orders, activities, documents, timeline) |
| **Contacts** | People linked to accounts, call/email info |
| **Products** | Medical catalog — SKU, category, price, stock, inventory value |
| **Campaigns** | Email marketing & newsletters, open/click rates, segmentation |
| **Territories & Team** | Territory coverage, rep quota attainment, user roles |
| **Reports** | Revenue & deal-volume, conversion funnel, revenue by category, win-rate gauge, export |
| **Documents** | Contracts, quotes, catalogs linked to accounts |
| **Settings** | If-then **automation rules**, **custom fields**, **users & roles**, **branding**, data reset |

Plus global search, notifications, quick-add (account/contact/deal/activity), and a responsive layout.

## Tech

- **React 18 + Vite**, React Router (hash routing), Recharts, lucide-react.
- **Data layer:** `src/data/store.js` — a localStorage-backed store with pub/sub. Realistic seed data in `src/data/seed.js`. Swap this layer for a real API later; the pages don't change.

## Rebranding to real InMedi assets

Everything is wired for a one-step swap:

1. **Colors** — edit `--brand` and `--brand-2` (and friends) at the top of `src/index.css`. The whole app re-themes.
2. **Logo** — replace the `<svg>` mark in `src/components/Logo.jsx` (or drop `logo.svg` into `/public` and reference it), and update the wordmark text.
3. See **Settings → Branding** in the app for the live reference.
