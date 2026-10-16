# SELTRACK — Cash Tracking App · PRD

## Original Problem Statement
Build a cash tracking app named **SELTRACK** for daily cash flow in a store using a cash drawer connected to a thermal printer via the Web Printing API. Send a pulse to the cash drawer. Record every payment in and out. Drawer should open **only for transactions, closing, opening, and adjustments**. Add a user dropdown to identify who opens the cash drawer. Everything should be recorded.

## User Choices (Feb 24, 2026)
- Auth: **Simple staff dropdown** (predefined list, no password)
- Hardware: **Web Serial + WebUSB** (both), with **Test Drawer** button
- Receipts: **Printed on every transaction** (ESC/POS)
- Currency: **INR** with denomination counting
- Reports: **X-Report / Z-Report** with **CSV / PDF / Thermal** export

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`. Collections: `staff`, `shifts`, `transactions`, `counters`.
- **Frontend**: React 19 + Tailwind + Shadcn UI. Web Serial / WebUSB driver in `/app/frontend/src/lib/printer.js` sends ESC/POS commands (drawer pulse `0x1B 0x70 0x00 0x19 0xFA`, cut, feed, receipt text).
- **Design system**: Dark navy `#0B1120` + amber `#F59E0B` accent, IBM Plex Sans + JetBrains Mono, dense grid layout, no gradients.

## Core Requirements
1. Staff dropdown (seeded: Rahul Sharma, Priya Patel, Amit Kumar, Sneha Iyer) — every action recorded with `staff_id + staff_name`.
2. Shift lifecycle: Open (denomination count → drawer pulse) → many Transactions (IN / OUT / ADJUSTMENT — drawer pulse + receipt) → Close (recount → variance vs expected → Z-report + drawer pulse).
3. Drawer pulses **only** on: shift open, shift close, transaction confirm, or explicit "Test Drawer" button in Devices settings.
4. Reports: X-report (live snapshot), Z-report (closed shift), Daily report. Export CSV / PDF (browser print) / Thermal print.
5. Everything is persisted with ISO-8601 timestamps.

## User Personas
- **Cashier**: opens/closes shift, records sales/refunds, prints receipts.
- **Manager/Supervisor**: reviews reports, records adjustments, sets up drawer/printer.

## What's Been Implemented (Feb 24, 2026)
- Backend: `/api/staff`, `/api/shifts/{open,close,current,list,get}`, `/api/transactions`, `/api/reports/{x,z,daily}`, `/api/meta/denominations`. Atomic `receipt_number` counter. Auto-seed 4 staff.
- Frontend: Dashboard (top nav + balance card + shift control + quick actions + live transaction feed + receipt preview), all dialogs (Shift Open, Shift Close, Transaction, Devices, Reports), denomination grid, X/Z report views with CSV/PDF/Thermal export.
- Web Serial + WebUSB ESC/POS driver with pair/disconnect, drawer pulse, full receipt printing, cut.
- Backend tested: **25/25 passing** (100%).

## Prioritized Backlog
### P1 (near-term)
- Denomination-based Cash Adjustment dialog (currently free-amount only).
- Shift history table with detail drill-down UI (backend already exists).
- Per-user PIN lock (optional).
- Receipt number scoped per shift (currently global).

### P2 (nice-to-have)
- Multi-till / multi-store support.
- User roles & permissions.
- Barcode / item catalog for cash sale receipts.
- Auto Z-report email at end-of-day.
- Server-side receipt render (PDF) for reprints.
- MongoDB indexes on `shifts.status`, `transactions.shift_id`, `transactions.created_at`.

## Next Tasks
- Optional: split `server.py` into `routers/` + `services/` as it grows.
- Add pagination metadata on list endpoints.
