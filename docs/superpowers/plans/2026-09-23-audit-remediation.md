# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the approved audit findings without misleading financial output, losing history, or weakening transaction confirmation.

**Architecture:** Retain React/Vercel/Neon and the existing atomic financial executors. Introduce explicit read-state contracts and a structured language-proposal boundary; deterministic interpretation and Gemini both converge on validated proposals. Deliver data correctness, language orchestration, presentation, and release safety as independently testable groups.

**Tech Stack:** React 19, JavaScript, Vitest, Vite, Neon PostgreSQL, Vercel, Gemini, Playwright for automated browser tests.

**Spec:** `docs/superpowers/specs/2026-09-23-audit-remediation-design.md` (approved by user).

## Global Constraints

- Stack React, Vercel, Neon, dan Gemini dipertahankan.
- Tidak mengubah saldo atau menghapus data pengguna untuk pengujian.
- Setiap tahap harus tetap dapat dijalankan dan diuji sendiri.
- Migrasi database harus kompatibel dengan aplikasi yang masih berjalan selama rollout.
- Secret CI harus berasal dari pengaturan layanan, tidak dari git.
- Tidak menerima SQL, nama fungsi bebas, atau klaim keberhasilan dari model.
- Fallback tetap bekerja tanpa Gemini.
- Tidak menganggap izin deploy sebagai izin membeli layanan, mengubah paket berbayar, atau menghapus data produksi.

## Review Focus

1. Logout/account switch while a request is unresolved must not expose the previous user's snapshot (Task 1).
2. A batch spanning the page boundary with equal timestamps must remain fully reachable (Task 2).
3. A negated correction during a pending action must preserve the draft rather than change or execute it (Task 4).
4. A successful database execution followed by response timeout must replay its receipt, not create another operation (Task 6).
5. A provider outage and a second concurrent user must not exhaust retries or incorrectly impose a daily lock (Task 5).

## Execution and review

Recommended method: native implementation in this task, followed by an independent whole-change review. Implement sequentially because Tasks 4–6 share conversation contracts. Use one test worker if host memory is constrained. Read the spec and this plan before implementation; inspect current git state and applicable instructions. Use an isolated worktree for the implementation if supported, leaving existing work intact.

Each numbered task is a separate reviewable deliverable. Do not deploy partially wired language contracts. Commit only files belonging to the completed task, then run the whole suite at integration.

### Task 1: Truthful financial read states

**Files:** create `src/lib/financialReadState.js`, `src/lib/financialReadState.test.js`; modify `src/hooks/useAnalytics.js`, `src/components/Analytics/AnalyticsView.jsx`, `src/components/Layout/AppShell.jsx`, and the financial-context consumers identified through imports.

**Interface:** `createFinancialReadState(ownerId)` returns `{ ownerId, generation: 0, data: null, status: 'loading', error: null, updatedAt: null }`. `reduceFinancialReadState(state,event)` accepts `reset`, `start`, `success`, and `failure`; every non-reset event carries `ownerId` and `generation`. Hook returns `analytics`, `status`, `error`, `updatedAt`, `loading`, `refetch`, and `getSnapshot`. A failed snapshot returns `{data:null,error}`, never successful-looking zeros.

- [ ] Write regression assertions using a successful snapshot then a failed refresh and a stale-owner completion:

```js
const initial = createFinancialReadState('a')
const ready = reduceFinancialReadState(initial, { type: 'success', ownerId: 'a', generation: 0, data: { totalIncome: 100 }, updatedAt: '2026-09-23T00:00:00Z' })
const stale = reduceFinancialReadState(ready, { type: 'failure', ownerId: 'a', generation: 0, error: 'network' })
expect(stale.status).toBe('stale')
expect(stale.data.totalIncome).toBe(100)
const switched = createFinancialReadState('b')
expect(reduceFinancialReadState(switched, { type: 'success', ownerId: 'a', generation: 0, data: ready.data })).toEqual(switched)
expect(reduceFinancialReadState(initial, { type: 'failure', ownerId: 'a', generation: 0, error: 'network' }).data).toBeNull()
```

- [ ] Run `npx vitest run src/lib/financialReadState.test.js --maxWorkers=1` and verify the missing implementation failure.
- [ ] Implement the reducer's identity guard before handling results:

```js
if (event.type === 'reset') return createFinancialReadState(event.ownerId)
if (event.ownerId !== state.ownerId || event.generation !== state.generation) return state
if (event.type === 'failure') return { ...state, status: state.data ? 'stale' : 'error', error: event.error }
```

Wire request generation and effect cleanup in the hook; mask mismatched-owner data synchronously in the returned value. UI shows loading/error/retry without financial numbers until success. On stale data, preserve numbers with the timestamp and warning. Explicitly gate advice and chat conclusions on fresh/complete financial state; inspect every `getSnapshot` caller so `null` cannot become an accidental zero.
- [ ] Run reducer tests, existing insight tests, and lint. Verify initial failure, stale refresh, recovery, empty success, overlapping refresh, and account switch in the component fixture.
- [ ] Commit: `fix: distinguish unavailable financial data from zero balances`.

### Task 2: Stable transaction pagination

**Files:** create `src/lib/transactionCursor.js`, `src/lib/transactionCursor.test.js`; modify `src/hooks/useTransactions.js`, `src/components/History/HistoryView.jsx`, and its AppShell props.

**Interface:** `transactionCursor(row)` returns `{createdAt:row.created_at,id:row.id}`; `transactionCursorFilter(cursor)` returns the PostgREST filter after validating an ISO timestamp and UUID. Query order is descending `created_at`, then descending `id`.

- [ ] Add tests with 31 rows sharing a timestamp, ascending UUID suffixes, page size 30; compare the second page against the remaining ID. Also test malformed cursor values, refresh during load-more, and an exhausted final page.

```js
expect(transactionCursorFilter({ createdAt: '2026-09-23T00:00:00.000Z', id: '11111111-1111-4111-8111-111111111111' }))
  .toBe('created_at.lt.2026-09-23T00:00:00.000Z,and(created_at.eq.2026-09-23T00:00:00.000Z,id.lt.11111111-1111-4111-8111-111111111111)')
```

- [ ] Run the new test and confirm red.
- [ ] Replace timestamp-only filtering with the composite predicate, retain row deduplication, and add request-generation invalidation for refresh/account changes. Preserve existing rows on load-more failure and expose a retry notice rather than “no transactions.”

```js
query = query.order('created_at', { ascending: false }).order('id', { ascending: false })
if (cursor) query = query.or(transactionCursorFilter(cursor))
```

- [ ] Run cursor/history tests and a database integration fixture with 31 equal timestamps, rolled back in the test database.
- [ ] Commit: `fix: paginate transaction history with a unique cursor`.

### Task 3: Anchored recurring dates

**Files:** modify `src/lib/financialPlanning.js`, `src/lib/financialPlanning.test.js`.

**Interface:** keep `expandFinancialSchedule(schedule,{from,days})` unchanged. Retain original scheduled date as the anchor; use recurrence index for monthly calculations.

- [ ] Add and run a failing test:

```js
const dates = expandFinancialSchedule({ id: 's', is_active: true, next_due_date: '2026-01-31', cadence: 'monthly', amount: 1 }, { from: new Date(2026, 0, 1), days: 120 }).map(x => x.date)
expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
```

- [ ] Compute monthly occurrences from the anchor, not the previous clamped date:

```js
const anchor = parseDateOnly(schedule.next_due_date)
let recurrenceIndex = 0
// Advance after each existing loop iteration:
recurrenceIndex += 1
cursor = schedule.cadence === 'weekly' ? addDays(anchor, recurrenceIndex * 7) : addMonthsClamped(anchor, recurrenceIndex)
```

- [ ] Test Jan 30, Jan 28, leap-year February, year boundary, weekly/once schedules, and an anchor older than the display window. Ensure the existing loop bound does not silently omit the requested window for old active schedules; calculate a safe starting recurrence index when necessary.
- [ ] Run `npx vitest run src/lib/financialPlanning.test.js --maxWorkers=1`; commit `fix: preserve monthly schedule anchor dates`.

### Task 4: Structured language proposals and contextual conversation

**Files:** create `src/lib/assistant/languageProposal.js`, `src/lib/assistant/languageProposal.test.js`, `src/lib/assistant/conversationTurn.js`, `src/lib/assistant/conversationTurn.test.js`; modify `api/_lib/geminiCommands.js`, `api/_lib/geminiAssistant.js`, `api/assistant.js`, their tests, `src/lib/assistant/languageAssistant.js`, `src/lib/assistant/assistantEngine.js`, `src/lib/assistant/semanticFrame.js`, `src/lib/assistant/intentDefinitions.js`, `src/components/Layout/AppShell.jsx`.

**Interface:** `validateLanguageProposal({proposal,text,context})` returns `{intent,slots,missingFields}` or throws a safe validation error. Proposal schema is version 1 with `intent`, `amountText`, `targetText`, `wallet`, `sourceWallet`, `destinationWallet`, `name`, `description`, `dateText`, `theme`, and `reply`; numeric evidence remains a literal quote. `resolveConversationTurn(input,{interpret})` returns the existing orchestration result plus optional `languageResponse` and `responseSource`; it never executes a mutation. `interpret` accepts the original text and bounded conversation context. `runAssistantEngine` gains an optional validated proposal input mapped directly into its slot/route preparation, without generating another command string.

- [ ] Test proposal validation independently, preserving the existing evidence rules:

```js
expect(() => validateLanguageProposal({ proposal: { intent: 'record_income', amountText: '900rb' }, text: 'gaji 500rb', context: {} })).toThrow()
expect(() => validateLanguageProposal({ proposal: { intent: 'record_income', amountText: '500rb' }, text: 'jangan catat gaji 500rb', context: {} })).toThrow()
const p = validateLanguageProposal({ proposal: { intent: 'set_wallet_balance', amountText: '0', wallet: 'Tunai' }, text: 'ubah saldo Tunai menjadi 0', context: { wallets: [{id:'w',name:'Tunai',current_balance:100}] } })
expect(p.slots.targetBalance).toBe(0)
```

- [ ] Run new tests and confirm red. Add integration assertions that a structured proposal reaches the existing staging path and never calls a text rewrite/parser a second time.
- [ ] Derive the supported mutation/query allowlist from one shared contract. Resolve wallet and goal references against authenticated database state on the server; ignore supplied ownership IDs or balances. For chat context, cap at six turns and 4,000 total characters, include pending type/slots and missing fields, and exclude secrets/attachments. A pronoun requires one unambiguous referenced entity; otherwise clarify.
- [ ] Keep original-text safety flags and validate proposal slots before dialogue state updates. Model output cannot confirm, cancel, execute, or silently replace a pending action. Explicit deterministic confirmation/cancellation retains precedence. Support contextual clarification through Gemini only as field proposals to the active draft, with updated visible confirmation.
- [ ] Extract the existing language decision block from AppShell into `resolveConversationTurn`; pass dependencies explicitly. Preserve image, wallet provisioning, memory proposal, and deterministic fallback paths. Keep server compatibility with the current client during rollout through a versioned operation, then switch the new client to that operation.
- [ ] Test “BCA”, “yang tadi”, “bukan 50 tapi 40”, “jangan ubah”, context intent switch, foreign ownership, unknown wallet, partial fields, no API key, theme changes, and unsupported multiple actions. Confirm ledger mutation requires explicit confirmation and uses the same executor as the deterministic path.
- [ ] Run all assistant/API suites, lint, and build; commit `refactor: unify structured language and deterministic proposals`.

### Task 5: Provider recovery and per-user fairness

**Files:** create `api/_lib/providerRecovery.js`, `api/_lib/providerRecovery.test.js`, a new additive migration under `neon/migrations/`; modify `api/_lib/geminiAssistant.js`, its tests, and `api/assistant.js`.

**Interface:** `classifyProviderFailure({status,retryAfterSeconds,dailyQuota,attempt,random})` returns `{reason,retryAfterMs}`. `getGeminiReply` receives authenticated `userId`; rate-limit identity is computed server-side. Shared provider recovery state remains key/model-scoped, while user usage is separately keyed by authenticated user.

- [ ] Write and run failing policy tests:

```js
expect(classifyProviderFailure({ status: 429, retryAfterSeconds: 20, attempt: 0, random: () => 0 }).retryAfterMs).toBe(20000)
expect(classifyProviderFailure({ status: 429, attempt: 0, random: () => 0 }).retryAfterMs).toBeLessThan(86400000)
expect(classifyProviderFailure({ status: 429, dailyQuota: true, attempt: 0, random: () => 0 }).reason).toBe('daily_quota')
```

- [ ] Implement bounded exponential backoff (base 1 second, cap 60 seconds for transient failures), clamp provider retry guidance to a safe range, and distinguish verified daily quota and configuration errors. Permit no more than two provider attempts per turn and keep the existing overall response timeout. Prefer returning fallback immediately when the retry would exceed that budget.
- [ ] Use atomic DB usage/lease operations with independent per-user limits (initial cap 10 requests/minute) and explicit provider concurrency capacity. Do not store raw keys. A failed usage store fails closed to fallback; a successful reply must not overwrite a later failure's recovery state.
- [ ] Add mocked two-user/concurrent requests, quota, 503, malformed response, invalid retry hints, missing DB, and recovery tests. Log only reason, request ID, elapsed time, and response source.
- [ ] Apply migration to the test database and run its integration fixture before production; commit `fix: bound Gemini retries and separate user rate limits`.

### Task 6: Clear financial confirmations and reliable outcome states

**Files:** create `src/lib/formatMoney.js`, `src/lib/formatMoney.test.js`, `src/lib/assistant/actionOutcome.js`, `src/lib/assistant/actionOutcome.test.js`; modify `src/components/Chat/MessageBubble.jsx`, `src/hooks/useChat.js`, `src/hooks/useDeterministicAssistant.js`, `src/hooks/useAssistantState.js`, `src/lib/assistant/assistantChatBridge.js`, `src/components/Layout/AppShell.jsx`, and `src/lib/walletBalanceAdjustment.js`.

**Interface:** `formatMoney(value)` uses IDR, zero minimum fraction digits, maximum two; `classifyActionOutcome({confirmedResult,error,requestSent})` returns `confirmed`, `failed`, or `unknown`. An unknown result triggers state reconciliation using the existing action ID/hash, not staging a new action.

- [ ] Add and run failing tests:

```js
expect(formatMoney(400000.01)).toContain('400.000,01')
expect(formatMoney(0)).toContain('0')
expect(classifyActionOutcome({ confirmedResult: { action_id: 'a' }, error: new Error('reply save failed'), requestSent: true })).toBe('confirmed')
expect(classifyActionOutcome({ error: new Error('timeout'), requestSent: true })).toBe('unknown')
```

- [ ] Share formatting across wallet values, header, analytics, and confirmation/receipts. Show explicit old/new/difference for adjustment; source/destination for transfer; category/date/description for transactions. Render zero, not truthiness-based omission.
- [ ] Track message persistence independently of financial execution. On ambiguous network outcome, refresh pending action/result; only replay the same idempotent execution if needed. On confirmed execution with failed reply persistence, show the confirmed receipt locally and offer message synchronization, not another transaction request.
- [ ] Cover keyboard navigation, pending/busy/expired cards, edited amount, negative/ambiguous correction, duplicate click, response lost after commit, and chat save failure in unit and component/E2E tests.
- [ ] Run chat/assistant suites, lint, build; commit `fix: separate chat delivery from financial action outcomes`.

### Task 7: Read-only wallet adjustment history

**Files:** create `src/hooks/useWalletAdjustments.js`, `src/components/Wallets/WalletAdjustmentHistory.jsx`, and focused tests; modify `src/components/Wallets/WalletsView.jsx` and `src/dev/design-preview.jsx`.

**Interface:** `useWalletAdjustments(walletId)` returns `{items,status,error,hasMore,loadMore,retry}`. Query `wallet_balance_adjustments` with user and wallet filters and composite `(created_at,id)` cursor. Row fields are ID, time, wallet name, previous balance, target balance, and calculated difference. Reuse Task 2 cursor helpers and Task 6 formatting.

- [ ] Test empty, error, pagination, session change, and ownership filters through a mocked query adapter. Assert difference from previous=100,target=0 is -100 and that history retrieval calls no mutation RPC.
- [ ] Implement a read-only history dialog/drawer accessible from the wallet actions menu, with focus return, Escape, loading/empty/error/retry states, and timestamp. Clearly label adjustments as excluded from income/expense reports. No undo button is offered.
- [ ] Add synthetic fixture rows to the development preview; verify light/dark and mobile. Run RLS integration checks with two test users, never production identity fixtures.
- [ ] Commit `feat: show wallet balance adjustment history`.

### Task 8: Dependency remediation and release gates

**Files:** modify `package.json`, `package-lock.json`, `README.md`; create `.github/workflows/ci.yml`, `playwright.config.js`, `e2e/finance-flows.spec.js`, `scripts/require-test-database.mjs`, and `docs/audits/2026-09-23-remediation-results.md`.

**Interface:** `npm run test:e2e` runs Playwright against the isolated fixture app; `npm run test:db:required` fails when `TARGET_DATABASE_URL` is absent and otherwise runs the existing database tests plus new fixtures. No secret enters public bundles or git.

- [ ] Capture current `npm audit --json`; inspect dependency paths using `npm explain`. Remove local Vercel CLI from application devDependencies if deployment can use an explicitly selected verified external CLI; otherwise update to a patched compatible release. Re-run audit after each change. Do not force downgrade/override an incompatible transitive package.
- [ ] Add a preflight that makes missing integration configuration explicit:

```js
if (!process.env.TARGET_DATABASE_URL) {
  console.error('TARGET_DATABASE_URL is required for database integration tests')
  process.exit(1)
}
```

- [ ] Create CI jobs for clean install, lint, tests, build, browser fixture tests, and separately configured test-database integration. Unconfigured integration emits a visible non-passing/configuration result, not a successful empty test run. Use synthetic data and cleanup confined to the test database. Keep permissions read-only unless a specific CI task needs otherwise.
- [ ] Browser tests cover initial/history scrolling, immediate composer clear, failed-send retry, confirmation then balance update in the fixture adapter, manual adjustment, report error/retry, and keyboard/mobile/dark mode. A separate authenticated staging workflow covers actual login and persistence when its credentials are configured; do not equate fixture coverage with live backend coverage.

```js
await page.getByRole('textbox', { name: 'Tulis pesan' }).fill('uji kirim')
await page.getByRole('button', { name: 'Kirim', exact: true }).click()
await expect(page.getByRole('textbox', { name: 'Tulis pesan' })).toHaveValue('')
```

- [ ] Run clean install, full unit suite, required database suite when configured, E2E, lint, build, audit, and `git diff --check`. Review all findings independently and fix blockers. Record exact passed/skipped/blocked counts and any residual dependency exposure.
- [ ] Commit only verified changes. Push and deploy under the existing user authorization once required release checks pass; otherwise report the concrete missing configuration instead of claiming production is verified. Apply additive production migrations before activating dependent client code. Check deployment readiness and production asset response without modifying user financial data.

## Plan self-review

- Coverage: spec data/jadwal → Tasks 1–3; structured conversation → Task 4; quota → Task 5; cards/status/format → Task 6; history → Task 7; security/CI/telemetry/release → Tasks 5 and 8.
- Interfaces: Tasks 2/7 share cursor helpers; Tasks 6/7 share formatting; Tasks 4/5 use authenticated user context; financial executors remain authoritative.
- No hardcoded production credentials, destructive test fixtures, unapproved paid services, or guarantee of complete bug freedom.
- All five Review Focus cases have an owning task. Unknown staging credentials are an explicit execution dependency, not a reason to silently skip integration coverage.
