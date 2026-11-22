# API reference

Base URL `http://localhost:4000/api`. Every endpoint except `GET /health` and `POST /auth/login` needs `Authorization: Bearer <JWT>`.
Responses use an envelope: `{ "success": true, "data": …, "meta": { page, limit, total, pages } }` or `{ "success": false, "message": "…", "code"?: "…", "errors"?: { field: message } }`.
Status codes: 400 validation · 401 not authenticated · 403 role not allowed · 404 not found (also for other offices' records) · 409 conflict/business rule · 413/422 upload limits · 500 unexpected.
Lists take `page` and `limit` (default 20, max 100). All queries are scoped to the signed-in user's office.

Roles: O=OWNER, A=ADMIN, W=WRITER, S=ASSISTANT, C=ACCOUNTANT.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{email,password}` → `{token,user}`; rate-limited; success/failure audited |
| GET | `/auth/me` | current user, office, permission flags |
| POST | `/auth/change-password` | `{currentPassword,newPassword}`; strong password required |
| POST | `/auth/logout` | audit only; client discards the token |

## Customers — `/customers` (read: all; write: O A W S; delete/deactivate: O A S)
`GET /` (`q`, `active=true|false|all`) · `POST /` · `GET /:id` (with deed history) · `PUT /:id` · `PATCH /:id/active {active}` · `DELETE /:id` (soft delete; 409 if used by a deed).
Extra deed-output fields: `husbandName`, `birthDate` (YYYY-MM-DD), `religion`, `profession`, `nationality`, `permanentAddress` (present address is `address`). NID: 10/13/17 digits, unique per office, masked in lists and for accountants. Phone normalised (`+8801…` → `01…`).

## Land records — `/lands` (same roles)
`GET /` (`q`: district/upazila/mouza/khatian/dag) · `POST /` · `GET /:id` (linked deeds, area conversion) · `PUT /:id` (extra fields `union`, `landOffice`, `holdingNo`; identifying fields locked while linked to a READY/PRINTED/DELIVERED deed) · `PATCH /:id/active` · `DELETE /:id`.

## Deeds — `/deeds`
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/` | all | `q` (title, number, type), `status`, `forPayment=1`; payment figures only for O A C |
| POST | `/preview-draft` | O A W | generates draft text, the full Bangladesh-format `documentHtml` and a missing/unresolved report, saves nothing |
| POST | `/` | O A W | create deed + parties + lands + revision + audit in one transaction |
| GET | `/:id` | all | snapshot (BR-06), checks, allowed transitions, fee lines, payments (O A C) |
| PUT/PATCH | `/:id` | O A W | edit while DRAFT/REVIEW; requires `version` (409 on conflict); `regenerate`, `reason` |
| PATCH | `/:id/status` | O A W* | `{status, reason?, checklist?}`; *writers: DRAFT/REVIEW/READY only |
| POST | `/:id/print` | all | records a print event (final copy count only when READY+) |
| GET | `/:id/document` | all | Bangladesh-format deed as HTML (`{html, watermark}`) – the preview and print layout |
| GET | `/:id/pdf` | all | Print-ready PDF with page numbers (watermarked unless READY+); needs headless Chrome/Edge |
| GET | `/:id/docx` | all | Editable Word file of the same document |
| GET | `/:id/history` | all | audit events + revisions |
| DELETE | `/:id` | O A | only an untouched DRAFT with no prints/payments |

Deed `lands` entries accept `{ landId, share?, value? }` (`share` = transferred area in the land's unit, `value` = that dag's value in BDT). `details` accepts `registryOffice`, `purpose`, `ownershipHistory`, `possessionNote`, `powerOfAttorney`.

Status machine (SRS 7.1): DRAFT→REVIEW|CANCELLED · REVIEW→DRAFT|READY|CANCELLED · READY→PRINTED|REVIEW|CANCELLED · PRINTED→DELIVERED|REVIEW (O/A) · DELIVERED→CANCELLED (owner) · CANCELLED→DRAFT (owner, audited). Rollbacks/cancel/reopen need `reason`. READY needs the full checklist, an approved template, no missing required data and no unresolved placeholders. PRINTED needs a recorded print event.

## Payments — `/payments` (read: O A C; write: O A C)
`GET /` (`deedId`, `method`, `from`, `to`) · `POST /` (`confirmOverpayment` to accept `409 OVERPAYMENT`) · `GET /:id` (receipt data) · `POST /:id/reverse {reason}`. Payments are append-only; a reversal is a linked entry and the original is kept.

## Reports — `/reports`
`GET /summary?from&to` (all roles; money only for O A C) · `GET /csv` (deeds; O A W) · `GET /payments-csv` (O A C). Dates are inclusive, Asia/Dhaka; `from > to` → 400.

## Documents — `/documents`
`GET /?ownerType=CUSTOMER|LAND|DEED&ownerId=` · `POST /` `{ownerType,ownerId,filename,mimeType,contentBase64}` (PDF/PNG/JPEG ≤ 5 MB) · `GET /:id/download[?inline=1]`.

## Configuration
`GET /office` (all) · `GET /settings` (O A) · `PUT /settings/profile|print|policy|area-conversions` (owner, or admin when granted) · `GET /calculations/units` · `POST /calculations/preview` · `GET|POST /rates`, `PATCH /rates/:id` · `GET /templates/types`, `GET /templates/placeholders`, `GET|POST /templates`, `POST /templates/:id/approve|unapprove` · `GET|POST /users`, `PATCH /users/:id` (owner, or admin when granted).
