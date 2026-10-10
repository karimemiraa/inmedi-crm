# PRD — InMedi CRM: Emnis Gap-Fill, Relational Integrity & Advanced Reporting

- **Status:** APPROVED — building (all 7 phases)
- **Decisions (2026-10-10):** Q1 demo data = **yes, seed realistic demo data** (keep an "empty" reset too). Q2 commission basis = **Aufträge/orders**, per-rep rate + global default. Q3 recurring generation = **manual button**.
- **Author:** Claude (pair-building with Karim)
- **Date:** 2026-10-10
- **Branch:** `main-pkf2ce`
- **Stack constraint:** Frontend-only (React + Vite + localStorage). No backend this session.

---

## 1. Problem

The InMedi CRM has 26 modules but three weaknesses block it from being a complete Emnis replacement:

1. **Missing Emnis modules.** No trade-show/event management (Messen), no sales commission (Provision), no recurring orders (Daueraufträge), no duplicate detection (Dubletten).
2. **Weak relational integrity.** A code audit found **20 gaps** where records that logically belong together are not linked — either the foreign key is missing, or the link exists in data but no screen shows it, or the customer name is plain text instead of a clickable path back to the account. The result: you can land on an invoice and not reach its order; a contact has no page of its own; devices/tickets/service orders don't appear on the customer. The user's words: *"everything linked to each other … so there is no gaps."*
3. **Reporting is shallow.** Reports does one-dimensional group-by only (no true pivot), and there is **no cost-to-serve analysis** — the `costEntries` data (Betreuungskosten: visits, calls, travel, demos, training) is captured in CostCalc but never crossed against revenue to show which customers are actually profitable to serve. The user explicitly asked for *"very strong Reports possibility, specially Betreuungskosten-Analyse."*

## 2. Goals & success criteria

| # | Goal | Done when… |
|---|------|-----------|
| G1 | Trade-show management | A **Messen** module exists: create an event (date, location, cost, status, budget), attach attendees (accounts/contacts/leads), and see event participation on the customer and contact. |
| G2 | Sales commission | A **Provision** report computes commission per rep over a date range from a configurable rate, with a per-rep breakdown and CSV export. |
| G3 | Recurring orders | **Daueraufträge** can be defined on a customer (interval + products); a "fällige Aufträge erzeugen" action generates real orders when due, each linked back to its schedule. |
| G4 | Duplicate detection | A **Dubletten** screen finds likely-duplicate accounts (and contacts) by name/email/address similarity and offers **merge** (re-point all child records) or **dismiss**. |
| G5 | Relational integrity | All 20 audited gaps closed: every missing FK has a selector, every logical child list is surfaced on its parent detail page, and the customer name is a clickable link to the account from every list/drawer. A new **ContactDetail** page exists. |
| G6 | True pivot | Reports gains a **2-D cross-tab** (row dimension × column dimension) with totals and CSV export, alongside the existing 1-D builder. |
| G7 | Betreuungskosten-Analyse | A cost-to-serve report crosses `costEntries` against revenue per **customer / rep / territory**: care-cost, revenue, cost ratio (%), and net contribution — so unprofitable-to-serve customers are visible. |

**Non-goals (explicitly out of scope this session):**
- Real email send/receive (needs backend — the M365 config stays a frontend stub).
- Backend/database/auth, multi-user, deployment.
- PDF generation and a standalone audit-log page (you deselected these; easy to add later).
- Aligning the data model to the real exported InMedi file (still pending that file).

## 3. Constraints & principles

- **Frontend-only.** All new state lives in the existing localStorage store (`src/data/store.js`). New collections get added to `buildSeed()`.
- **No regressions.** Existing modules keep working. The store `KEY` may bump (`inmedi-crm-v11` → `v12`) so new collections initialise cleanly; this resets local demo data on first load (acceptable — all transactional data currently seeds empty).
- **Consistent UX.** Reuse existing primitives (`ui.jsx`: Card, Modal, Field, Badge, KpiCard, Empty; Toast; `csv.js`; `format.js`; `labels.js`). German interface, zero emojis, lucide icons, InMedi red `#A81E22`.
- **Reversible.** Each phase is a separate commit. Nothing hard-to-undo without confirmation.

## 4. Data-model changes

### New collections (added to `buildSeed`)
- `events` — `{id, name, type(Messe/Kongress/Webinar/Hausmesse), location, startDate, endDate, status(Geplant/Läuft/Abgeschlossen/Abgesagt), budget, cost, ownerId, notes, attendees:[{refType(account|contact|lead), refId, role, status(Eingeladen/Zugesagt/Teilgenommen/Abgesagt)}]}`
- `recurringOrders` — `{id, accountId, ownerId, interval(monatlich/quartalsweise/halbjährlich/jährlich), items:[...], startDate, nextDue, active, lastGenerated, generatedOrderIds:[]}`

### New config (in `meta`)
- `meta.commission` — `{defaultRate: 0.05, basis: 'orders'}` (basis = Aufträge). Per-rep override stored on the user: `user.commissionRate`.

### Foreign-key fields added to existing create/edit flows (closing audit gaps 1–12)
| Link | Field | Where a selector is added |
|------|-------|---------------------------|
| invoice → order | `invoice.orderId` | NewInvoice modal (optional "aus Auftrag") |
| order → deal | `order.dealId` | NewOrder modal (optional) |
| deal → contact | `deal.contactId` | Deal create (QuickAdd) |
| activity → contact + deal | `activity.contactId`, `activity.dealId` | QuickAdd activity |
| contract → contact + order | `contract.contactId`, `contract.fromOrderId` | Contract create |
| serviceOrder → ticket | `serviceOrder.ticketId` | ServiceOrder create |
| incident → capa | `incident.capaId` | Quality (link action) |
| ticket → device | `ticket.deviceId` | Service ticket create |
| device → order/contract | `device.orderId`, `device.contractId` | Device create |
| lead ↔ account | `lead.accountId` + `account.leadId` set on **convert** | Convert flow |
| campaign → members | `campaign.memberIds` + `memberType` | Campaign (attach segment) |

## 5. Build plan (phased, one commit per phase)

**Phase 1 — Data-model foundation.** New collections + `meta.commission`; bump store KEY; add the FK fields above into every create/edit modal; demo-seed (pending decision Q1). No new pages yet. *Validates: app still builds, new selectors save.*

**Phase 2 — Relational integrity & navigation (G5).**
- Shared `<AccountLink>` / `<ContactLink>` components; make customer name clickable in Orders, Invoices, Contracts, Devices, Service, ServiceOrders, Quality, Activities, Pipeline, CostCalc, Messages, Dashboard.
- New **ContactDetail** page + route `contacts/:id` (contact's account, activities, deals, tickets, events, notes).
- AccountDetail: add **Geräte**, **Rechnungen** (fix the dead tab counter), **Service**, **Serviceaufträge**, **QM/Vigilanz**, **Messen** tabs; make contact rows clickable → ContactDetail.
- Cross-link drawers: invoice↔order↔account, deal↔resulting orders/invoices, contract↔order.

**Phase 3 — Messen (G1).** `events` CRUD page + detail with attendee management; event participation surfaced on AccountDetail & ContactDetail; event cost feeds reporting.

**Phase 4 — Daueraufträge (G3).** Recurring-order definitions on the customer; "fällige Aufträge erzeugen" generates orders (manual trigger — see Q3); generated orders link to the schedule; surfaced on AccountDetail.

**Phase 5 — Dubletten (G4).** Detection screen (similarity on name/email/postal/phone), side-by-side compare, merge (re-point contacts/deals/orders/invoices/contracts/activities/devices to the survivor) with confirm, or dismiss.

**Phase 6 — Provision (G2).** Commission config in Settings; commission computed per rep over date range (basis per Q2); per-rep breakdown + CSV; summary tile on Territories.

**Phase 7 — Reporting (G6 + G7).**
- 2-D pivot cross-tab in Reports (row dim × column dim, cell measure, row/col totals, CSV).
- Betreuungskosten-Analyse: add `costEntries` as a report source; dedicated cost-to-serve view crossing care-cost vs revenue per customer/rep/territory → cost, revenue, ratio %, net contribution, flagged negatives.

**Phase 8 — Verify & handoff.** `npm run build` clean; click-through smoke test of every new/changed screen; update this PRD's status to "Delivered"; update README; commit + push to `main-pkf2ce`.

## 6. Open questions (need answers before build)

- **Q1 — Demo data.** Seed a small, clearly-labeled realistic dataset (≈8 customers with contacts, orders, invoices, deals, cost entries, one event) so every new feature is visibly testable? *Recommend: yes* — otherwise Provision/Betreuungskosten/pivot show empty tables. The existing "reset to empty" stays available in Settings.
- **Q2 — Commission basis.** Compute Provision on **Aufträge (orders)** = realized sales, attributed to the order's Außendienst? *Recommend: yes, orders, per-rep rate with a global default.* Alternative bases: won deals, or paid invoices.
- **Q3 — Recurring-order generation.** No backend scheduler exists, so generation is a **manual "fällige Aufträge erzeugen" button** (recommend) rather than auto-firing on app load.

## 7. Risks

- **Scope is large** (7 build phases). Mitigation: phased commits; each phase independently useful; can stop after any phase.
- **Merge logic (Dubletten)** must re-point every child collection or it orphans records. Mitigation: single reusable re-point routine driven by the FK map in §4; confirm dialog; merge is logged to `auditLog`.
- **Store KEY bump wipes local data.** Acceptable given empty transactional seed; demo-seed softens it. Called out so it's not a surprise.
