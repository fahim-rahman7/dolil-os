# QA status

Legend: ✅ automated test passes · 🖥 verified manually in a real browser (Chrome engine, desktop and mobile widths) · ⛔ not verified / needs the office.

Run the automated suite with `cd backend && npm test` (51 tests: 9 unit, 39 API integration, geo-data and form-sync tests against a real MySQL/MariaDB test database, 3 frontend↔backend sync checks that compare the UI permission mirror, status/role enums and every endpoint the frontend calls against the API). `cd frontend && npm run lint` runs the TypeScript type-check.

## SRS §12 test plan
| ID | Scenario | Status |
|---|---|---|
| QA-01 | Login with valid credentials | ✅ 🖥 |
| QA-02 | Invalid credentials: denied, clear message, no session | ✅ 🖥 |
| QA-03 | Protected page/API without token | ✅ |
| QA-04 | Create customer | ✅ 🖥 (Bangla name, phone normalised) |
| QA-05 | Duplicate NID rejected | ✅ |
| QA-06 | Edit customer persists | ✅ |
| QA-07 | Create/search land record | ✅ |
| QA-08 | Missing land fields rejected client and server | ✅ (server) · 🖥 (client, customer form) |
| QA-09 | Deed + relations saved atomically | ✅ 🖥 |
| QA-10 | Invalid customer/land id → no partial deed | ✅ |
| QA-11 | Draft generated, missing fields flagged | ✅ 🖥 |
| QA-12 | Bangla preview and print | ✅ document structure/Bangla digits/NID masking tested · 🖥 on-screen Bangladesh-format preview checked against the reference deed · PDF (4 pages, Nirmala UI embedded) and DOCX (valid package, 14 tables) generated; the PDF/DOCX pages were not opened visually in Word/PDF viewers · ⛔ real sample documents on the target printer and sub-registry acceptance |
| QA-13 | Status changes in order + audit event | ✅ 🖥 |
| QA-14 | Unauthorised status change blocked | ✅ |
| QA-15 | Record payment, totals update | ✅ 🖥 |
| QA-16 | Zero/negative payment rejected | ✅ 🖥 |
| QA-17 | Deed with payment cannot be deleted | ✅ |
| QA-18 | CSV export (auth, BOM, formula-injection safe) | ✅ |
| QA-19 | API unavailable during save: error shown, no duplicate submit | Duplicate-submit guard (`useSubmit`) and network error message implemented · ⛔ not exercised by stopping the API |
| QA-20 | Responsive layout | 🖥 dashboard, customers (mobile 431 px); desktop for deed/payment/settings pages · ⛔ real tablet |
| QA-21 | Role-based access | ✅ API matrix · 🖥 accountant UI |
| QA-22 | Cross-office isolation | ✅ |

## Release acceptance (SRS §12.1 / Appendix B) – what remains for the office
- ⛔ Backup and restore demonstration (procedure documented in README; not automated or run).
- ⛔ Security review / penetration test, antivirus scanner integration, HTTPS deployment.
- ⛔ Legal/office approval of deed templates and fee configuration (templates ship **unapproved**; no statutory rates are pre-loaded).
- ⛔ Bangla amount-in-words reviewed by a Bangla-literate reviewer (SRS FR-GEN-03).
- ⛔ Frontend component tests and automated browser E2E tests were not written; UI was checked manually.
- ⛔ Not every button in every state was clicked (e.g. overpayment dialog, payment reversal dialog, document upload and settings forms were verified through the API tests, not by clicking them).
