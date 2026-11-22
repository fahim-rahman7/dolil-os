# Architecture

Browser → Next.js UI (`frontend/`) → REST API (`backend/src`) → Prisma → MySQL. The API is the single source of truth for validation, permissions, status transitions and payment totals; the UI repeats validation only for fast feedback.

## Backend layout
- `src/app.ts` – middleware, route mounting. `src/middleware/` – auth (re-reads the user each request), error envelope, request id.
- `src/modules/<feature>/` – routes per feature (auth, users, settings, customers, lands, deeds, payments, reports, documents, templates, rates, calc).
- `src/utils/` – pure/domain logic: `permissions` (SRS matrix), `transitions` (status machine), `draft` (template rendering, missing-field checks), `words` (amount in words), `areas`, `fees` (effective-dated fee lines), `deedService` (snapshots, template choice, numbering), `deedHtml` + `pdf`.
- `src/docs/` – Bangladesh deed document engine: `bnDeed.ts` builds one block model (tables, party cards, তফসিল, চৌহদ্দি, signatures; Bangla digits/words) that `bnHtml.ts` renders to HTML/PDF and `bnDocx.ts` renders to Word.
- `prisma/schema.prisma` – data model; every business table carries `officeId`, and every query filters on it.

## Key rules and where they live
- Snapshot (BR-06): `Deed.snapshot` stores party/land values at generation time; later master-data edits never rewrite a deed.
- Revisions/audit: `DeedRevision` per save, `AuditLog` for logins, CRUD, status changes, prints, payments, settings, template/rate/user changes (never passwords).
- Concurrency: `Deed.version` optimistic locking; status changes use a compare-and-set on the previous status.
- Money/area are `DECIMAL` in MySQL and `Prisma.Decimal` in code. Payments are append-only; reversals are linked rows.
- Privacy: NIDs masked in lists and for accountants (including inside generated draft text); passwords hashed with bcrypt; secrets never logged.

## Frontend layout
`src/app/*` pages, `src/components/*` shared UI (`RecordsPage` generic list/form, `DeedForm`, `StatusModal`, `EntityPicker`, `DocumentsPanel`, settings panels), `src/lib/api.ts` (fetch + formatting in BDT / Asia/Dhaka), `src/lib/perms.ts` (UI mirror of the permission matrix), `src/lib/session.tsx` (auth guard).
