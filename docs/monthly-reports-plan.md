# Monthly reports and categorization

1. Keep the ledger authoritative. Reports use saved categories, never silently infer old transactions. Unknown/generic categories remain visible as `Belum dikategorikan`.
2. Hybrid input: existing user-learned rules and deterministic categories take priority. Gemini may suggest only an owned category compatible with income/expense; it cannot supply category IDs or calculate totals. Provider failure keeps the local engine operational.
3. Read a complete bounded month (Asia/Jakarta) or all-time snapshot on the authenticated server. Fail explicitly above the row limit; never export a partial ledger.
4. Calculate with integer minor units. Separate ordinary income/expense, savings deposits/refunds, transfers, opening balances. Do not label net flow as account balance or claim statutory accounting compliance.
5. Show category coverage, category breakdown, cashflow reconciliation and a searchable review ledger. Existing history correction remains available for category changes.
6. Export the same snapshot to a paginated A4 PDF with totals, category breakdown and complete transaction details. No Gemini call is required for reports or PDF.
7. Test period boundaries, exact sums, saved-category truth, row caps, authorization scope, fallback behavior and PDF pagination. Verify lint/build and rendered PDF before release.

## Implemented / verification (2026-09-23)

- Authenticated `financial_report` reads one owner-scoped snapshot; no database migration or writes are required for reports.
- Monthly and all-time reports, deterministic conclusions, category totals, search, unclassified filter, and existing safe correction dialog are connected to the application.
- Gemini enriches unknown categories on single-transaction messages without changing understood amount/wallet/date. Bulk and pending confirmations retain the existing deterministic flow. Corrections and learned rules are not overwritten by Gemini.
- PDF contains summary, category totals, and all ledger rows (not only the visible page or current search results), with repeating headers and page numbers. Reviewed a six-page sample after rendering.
- 1,083 application tests passed; eight desktop/mobile browser tests passed, including real PDF download. New read-only Neon integration test passed against the isolated test branch and matched ledger sums. The existing 26 database tests were not rerun in this change; the local TCP connection attempt timed out, so the new report test uses production's HTTPS transport.
- Lint and production build pass; npm audit reports zero vulnerabilities. Lockfile validated with npm 11 and npm 12 dry-run clean install (npm 12 requires a newer Node patch than the local runtime).
- Known boundaries: maximum 10,000 ledger rows per report (explicit error, never partial output); PDF uses a standard Latin font; no statutory accounting/compliance claim and no reconstructed closing balance.
