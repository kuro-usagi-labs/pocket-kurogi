# Draft editing and consistent rupiah input

- Chat, bulk extraction, legacy amount parsing, transaction correction and wallet creation share `parseRupiahAmount` for numeric conversion. Bare amounts retain their literal value, grouping separators are validated, and amounts beyond safe cent precision are rejected.
- The chat Ubah action opens a structured editor for record_transactions drafts. Each item retains its identity/date and allows amount, type, wallet, category and description changes. Saving corrects the authenticated pending action; the existing confirmation workflow is still required to write the ledger.
- Corrections use the existing database row lock and expected payload hash. Previous card versions are inactive, and stale UI action handlers reject mismatched hashes.
- Assistant server logs contain an allowlisted operation, processing stage, outcome, provider fallback reason, duration and generated request ID. Prompts, user IDs, balances, tokens and raw database errors are excluded. Request IDs are returned in the response header and retained in chat failure metadata.
- Validation: amount parity/invalid-input tests, draft preservation/type validation tests, telemetry redaction tests and desktop/mobile bulk editor interaction tests. Database correction/idempotency tests remain in the required CI database job.

This release does not add offline persistence, month-to-month report comparison, or new category-learning controls; those remain follow-up work.
