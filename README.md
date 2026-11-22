# Dolil OS — Deed Writing & Office Management (MVP)

Implements the *Dolil OS Software Requirements Specification v1.0* with Next.js + TypeScript (frontend), Express + TypeScript (API), MySQL and Prisma.

- `frontend/` – Next.js App Router UI (port 3000)
- `backend/` – Express REST API (port 4000), Prisma schema + migrations in `backend/prisma`
- `docs/` – `API.md`, `ARCHITECTURE.md`, `QA-CHECKLIST.md`

## Requirements
- Node.js 20+ (developed on 24)
- MySQL 8+ (MariaDB 10.4+ also works for development)
- For **Download PDF**: a Chrome / Edge / Chromium install on the API server (the PDF is rendered by a headless browser so Bangla text shapes correctly). Set `CHROME_PATH` if it is not auto-detected. Print-from-browser works without it.

## Setup
1. Create an empty database, e.g. `dolil_os`.
2. `backend/`: copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET` (32+ random characters) and `FRONTEND_URL`.
3. In `backend/`:
   ```
   npm install
   npx prisma migrate deploy      # or: npx prisma migrate dev   (development)
   npm run seed
   npm run dev
   ```
4. `frontend/`: copy `.env.example` to `.env.local` (`NEXT_PUBLIC_API_URL`), then `npm install` and `npm run dev`.
5. Open http://localhost:3000 and sign in with the seed owner: `admin@dolilos.local` / `ChangeMe123!` — **change it in Settings → Account immediately.**

The seed creates one office, the owner account and the seven starter deed templates (all **unapproved**, see below). It is idempotent.

## Roles and permissions (SRS §3)
`OWNER`, `ADMIN`, `WRITER`, `ASSISTANT`, `ACCOUNTANT` are enforced by the API on every request (the UI only hides controls). The role is re-read from the database on each request, so deactivating a user or changing a role takes effect immediately. `ADMIN` can change settings / manage users only if the owner grants it (Settings → Office & print → Office policy). Create staff accounts in Settings → Users.

## Important first-use steps
1. **Approve templates** – Settings → Templates. Starter templates are drafting aids with generic wording. A local legal professional must review them; only an *approved* template version can be used for a deed to reach `READY`. Editing creates a new unapproved version.
2. **Fill the Bangladesh deed details** – all of it can be entered while creating the deed: each party and land row has a **নতুন** button and a **বিস্তারিত দিন / সম্পাদনা** button that opens the full customer / land form in a modal, shows what is still missing for the dolil, and the right-hand panel renders the real dolil live. Per dag you can also set *হস্তান্তরিত জমি* and *মূল্য* (feeds the তফসিল and শ্রেণি অনুযায়ী মূল্য tables). Required inputs – customers need father/mother/husband name, date of birth, religion, profession, nationality, permanent and present address; land records need union, land office, holding no., khatian, dag, class and boundaries; each deed has registry office, purpose, ownership history, possession note and power-of-attorney fields. Anything missing prints as "—" or a dotted line for the office to complete by hand. The deed *template* now only supplies the narrative clauses (section ১০); everything else is generated from the data. Existing databases get new unapproved template versions via `npm run seed`.
3. **Configure fees** – Settings → Calculation. Area-conversion factors ship with conventional defaults that you must verify. No government fee rates are pre-loaded; anything you add is labelled `ESTIMATE – VERIFY OFFICIAL RATE` until you mark it verified. Rates are effective-dated and append-only.
4. Optionally enable automatic internal deed numbering (Settings → Office policy). It is an internal reference, never an official registration number.

## Implemented features
Authentication (JWT, rate-limited login, password change), dashboard, customers & land records (search, validation, masking of NID in lists/for accountants, soft-delete/deactivate, restricted edits), deed creation with snapshotting, **Bangladesh-format Bangla deed output** (Registration Rules Form 40 style: header table, ২ নং সার-সংক্ষেপ, দাতা/গ্রহীতার পূর্ণ বিবরণ with photo box, তফসিল, শ্রেণি/মূল্য, চৌহদ্দি, সাক্ষী ও স্বাক্ষর, Bangla numerals, page numbers) as on-screen preview, print-ready PDF and editable Word (DOCX), template-driven draft generation (Bangla amount-in-words, unresolved-placeholder and missing-field detection, editable draft, revisions with optimistic locking), calculation management (area conversion, per-unit valuation, effective-dated fee lines, audited manual overrides), the full status state machine with reasons/checklist/print-event rules and audit trail, print layout + server-side PDF, payments (append-only, reversal workflow, overpayment confirmation, unique receipt numbers, printable receipts), reports with date filters and CSV exports (formula-injection safe), document upload (PDF/PNG/JPEG ≤ 5 MB, magic-byte + signature check, stored on disk), settings (office profile, print preferences, policy, area conversions, rates, templates, users), audit log, multi-office data isolation on every query.

## Tests
```
cd backend
npm test        # pushes the schema to dolil_os_test (see .env.test) and runs unit + API integration tests
```
`backend/.env.test` points at a separate `dolil_os_test` database (created automatically); **never** point it at real data — the tests wipe it. The suite covers QA-01…QA-22 at API level (see `docs/QA-CHECKLIST.md`). Frontend: `cd frontend && npm run build` (type-checks and lints); UI flows were exercised manually in a browser (see QA checklist for what was and was not verified).

## Scripts
Backend: `npm run dev`, `build`, `start`, `seed`, `test`, `db:migrate`, `db:deploy`
Frontend: `npm run dev`, `build`, `start`, `lint`

## Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | MySQL connection string |
| `JWT_SECRET` | backend | Token signing secret (32+ chars) |
| `FRONTEND_URL` | backend | Allowed CORS origin |
| `PORT` | backend | API port (default 4000) |
| `CHROME_PATH` | backend | Chrome/Edge executable for PDF export |
| `UPLOAD_DIR` | backend | Document storage folder (default `backend/uploads`) |
| `NEXT_PUBLIC_API_URL` | frontend | API base URL |

## Deployment, backup and security notes
- Serve both apps over **HTTPS** behind a reverse proxy; set a strong `JWT_SECRET`; restrict `FRONTEND_URL`; run the API with `NODE_ENV=production`.
- Keep `UPLOAD_DIR` outside any web root and include it in backups. Uploaded files get only a magic-byte check and an EICAR-signature scan — **integrate a real antivirus scanner before production** (`scanBuffer` in `documents.routes.ts`).
- **Backups (NFR-10):** schedule an encrypted dump, e.g. `mysqldump --single-transaction dolil_os | gpg --symmetric --cipher-algo AES256 > dolil_os_$(date +%F).sql.gpg`, copy it off-server, and test a restore (`gpg -d file | mysql dolil_os_restore`) regularly. Scheduling/encryption/restore drills are an operations task and are **not automated by this project**.
- The session token is kept in browser `localStorage`; for a stricter posture move to an httpOnly cookie with CSRF protection.
- Run a security review, and have deed templates, fee configuration and Bangla print output checked by the responsible legal/office representative before live use (SRS §12.1).

## Legal disclaimer
Dolil OS is a drafting and office-management aid. It is not a government land-record system, title verification or legal advice. Verify identity, title, land records, applicable law, registration requirements and all amounts before execution or registration.
