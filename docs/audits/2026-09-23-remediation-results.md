# Audit remediation — 23 September 2026

Status: implemented locally; **not released to production**. Independent review pending.

## Verified locally

- Clean install: 579 packages installed with `npm ci --ignore-scripts --no-audit`.
- Unit/component/hook suite: 1,049 passed; 25 database tests skipped because no test database URL is configured.
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
