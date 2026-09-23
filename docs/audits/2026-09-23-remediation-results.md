# Audit remediation — 23 September 2026

Status: final maintainer review completed; release in progress. The earlier independent reviewer session did not survive restart; no independent verdict is claimed.

## Release review

- Reviewed routing, typed proposals, per-item bulk types/wallets, confirmation outcomes, message-only retries, provider SQL locks, and production server imports. No new release-blocking defect found in this pass. Known limits below remain disclosed, not treated as a guarantee of zero bugs.
- Production provider migration applied via Neon SQL editor in an explicit transaction; no user financial records modified.
- GitHub `test` environment database secret configured using the isolated test branch, without logging or committing its value. That branch expires after one day: future CI runs require a renewed test branch/secret. The production application does not depend on this test branch.
- Verified release basis: 1,069 application tests, 26 database tests, lint, build, and prior six browser fixtures. Production authenticated chat is not automatically exercised with real financial writes.

## Bulk and isolated database verification

- Added multiline mixed income/expense parsing (up to 20 lines), per-line amounts/descriptions/categories/wallets, shared-wallet follow-up and a single confirmation. Incomplete lists are not partially staged; Gemini cannot replace a bulk draft with one transaction. Review summaries distinguish income, expense and net change.
- With user approval, Neon branch `audit-bulk-test` (`br-jolly-bird-ax6whkfs`) contains an isolated copy of production, with one-day expiry. Schema-only branching was unsupported by the legacy anonymous role. Production was not modified.
- Connection hostname was verified against that branch; credentials stay in ignored `.env.test.local` and are not committed.
- All 26 real database integration tests passed across five suites (93.75s), including a new mixed 15,000 expense / 10,000 income / 8,000 expense case, net -13,000 and idempotent replay. The provider migration was tested inside a rolled-back transaction, not installed in production.
- Initial 5s test limits timed out on remote round trips and disrupted a following transaction test. Raising database-only test/hook limits to 30s yielded a clean full rerun; assertions and access protections were unchanged.
- Latest application suite: 1,069 passed before the added database case; bulk/card focused suite 11 passed. Lint and build passed. Remaining release tasks: final review, production provider migration, persistent CI test database secret (the temporary branch expires), and deployment verification.

## Resumed-session regression fixes

- Follow-up review found `useAssistantState.confirmPendingAction` overwrote definitive rejection outcomes with unknown and dropped confirmed outcomes. The hook now preserves all three reconciliation outcomes. Three real-hook regressions passed, followed by the complete suite: 1,062 passed and 25 database tests skipped; lint passed. This is a local follow-up review, not a replacement claim for the missing independent review.

- Reproduced both screenshot inputs: `pengeluaran gorengan 15k` and `pengeluaran gorengan 15k tunai` returned unknown when Gemini was unavailable. The router previously required a recording verb before giving an explicit expense label sufficient weight. It now recognizes the terse label plus a single amount, preserving query, negation and hypothetical protections. Tests verify Rp15,000, description Gorengan and a pending confirmation for Tunai, not automatic execution.
- Validated Gemini theme proposals now reach the local theme preference; invalid values are rejected.
- Definitive first-response API rejection retains its status and original explanation without pointless retry. A lost response followed by rejection remains unknown, preserving same-action reconciliation safety.
- Latest full suite: 1,059 passed, 25 database tests skipped. Lint and production build passed. An earlier build attempt exhausted local memory; the later rerun succeeded. Existing legacy-target and ineffective dynamic-import build warnings remain.
- Continuation checkout: `D:/Lang/pocket-kurogi/.worktrees/audit-continue`, branch `codex/audit-continue`; previous commits were preserved. No production data or deployment was changed.

## Continuation after restart

- Active continuation workspace: `D:\Lang\pocket-kurogi\.worktrees\audit-continue`, branch `codex/audit-continue`, based on `6cf3942`. The earlier worktree remains preserved.
- Fixed validated Gemini theme proposals not reaching the local theme preference.
- Preserved HTTP rejection status and definitive first-request validation/auth errors without retrying them or misreporting a lost receipt. An earlier uncertain execution still remains unknown even if reconciliation is later rejected.
- Added five regression tests. Full suite: **1,054 passed, 25 skipped**. The two initial bug reproductions failed before their fixes and passed afterward.
- Latest build verification is blocked by local memory exhaustion (Node allocation failure, then CLR failure). Drive C also reported no space during npm invocation. No system files were removed. Earlier build/browser evidence below predates these continuation edits and must not be treated as fresh release verification.
- Independent review from the earlier session did not return an available result. Isolated database configuration remains missing. No push or production deployment performed.

## Verified locally

- Clean install: 579 packages installed with `npm ci --ignore-scripts --no-audit`.
- Unit/component/hook suite before continuation: 1,049 passed; latest result is recorded above. 25 database tests remain skipped because no test database URL is configured.
- Browser fixtures: 6 passed across desktop Chromium and Pixel 7 viewport (composer clear, latest scroll, failed-send restore, manual adjustment, read-only history, dark mode, Escape, report retry).
- Build and lint passed. Dependency audit: 31 advisories before remediation; 0 after removing the application-local Vercel CLI and updating compatible js-yaml.
- Database-required preflight correctly fails with missing `TARGET_DATABASE_URL`; this is a release blocker, not a passing integration result.

## Delivered changes

1. Reports retain stale successful data, distinguish error/loading from empty success, and mask earlier-account snapshots.
2. Transaction history uses descending timestamp + UUID cursor, handles tied timestamps and ignores obsolete page responses.
3. Monthly schedules calculate from the original day, including leap years and old schedule anchors.
4. `interpret_v2` returns evidence-checked structured fields. Backend reads owned wallet/goal names and at most six messages/4,000 characters. Model-generated command strings are no longer parsed on the new client path; the old endpoint remains compatible.
5. Server-only provider migration adds per-user 10/minute usage, two provider leases, and monotonic cooldown recovery. Unknown 429 errors are transient; verified daily quota and configuration failures are distinct.
6. Shared money formatting preserves up to two decimals. Balance cards show previous/new/difference. Unknown financial execution replays the same action ID/hash, never restages it. Failed bot-message saving retains a local receipt with message-only synchronization.
7. Wallet actions expose read-only adjustment history with pagination, ownership filters and keyboard dismissal.
8. CI includes install, lint, unit, build, audit, browser and an explicitly required isolated database job.

## Remaining release work and limitations

- Configure an isolated Neon test branch and `TARGET_DATABASE_URL` locally and in the GitHub `test` environment. Existing integration suites require test-user records and the application schema.
- Apply/test additive `20260923030000_provider_fairness.sql` there before production. No production schema or financial data was changed in this work.
- Database integration, actual authenticated staging login, concurrent PostgreSQL sessions, production RLS checks and production deployment are not yet verified. Browser fixtures do not establish live backend correctness.
- Pending staged actions remain under the deterministic correction/confirmation flow, not model-generated field patches. Some free-form pending corrections still need guided wording. One provider attempt per turn prioritizes immediate fallback; subsequent turns retry after cooldown.
- Unsynced chat receipts are local to the current page until synchronized; no claim of durable offline storage is made.
- CI failure for missing database configuration is intentional. Do not bypass it to claim deployment readiness.

## Implementation decisions

- Commit shared report/history wiring together because both modify AppShell and use the same hook-test harness. Tradeoff: larger review unit.
- Add explicit development-only testing-library, jsdom and pg; pg must not rely on the removed deployment CLI's transitive tree. Tradeoff: added test dependencies.
- Keep staged action interpretation deterministic. Tradeoff: less free-form interpretation during confirmation, without weakening confirmation or negation protections.
- Use one provider attempt, below the two-attempt ceiling. Tradeoff: momentary errors recover on a later turn rather than delaying the current fallback.
