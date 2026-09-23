# Gemini language-to-action layer

Gemini classifies fresh messages through authenticated `POST /api/assistant` with
`operation: interpret`. Structured output supports income/expenses, wallet transfers,
wallet/goal creation, goal deposits/withdrawals, financial queries and theme changes.
The server compiles an allowlisted command, requiring source evidence for amounts and
referenced names. The existing deterministic pipeline validates and stages financial
actions for confirmation; reports use actual backend data. Gemini never executes SQL
or supplies authoritative balances. Unknown or unsafe interpretations fall back locally.

Only the current message (maximum 2,000 characters) and wallet/goal names are sent,
not balances, transaction records, images or chat history. Pending confirmations,
clarification followups and memory workflows stay deterministic. Successful AI replies
no longer have the old conversation-only banner. Theme changes apply immediately to
the local device preference; supported dark/light requests also work without Gemini.

## Activate on Vercel

1. Run `neon/migrations/20260923010000_add_gemini_cooldown.sql` against the relevant
   Neon branch, using the same trusted database owner as `DATABASE_URL`.
2. Add `GEMINI_API_KEY` as a sensitive server environment variable in Vercel. Do not
   prefix it with `VITE_` or commit it. Select the intended Production/Preview scope.
3. Set `GEMINI_MODEL=gemini-3.5-flash-lite` and optionally `GEMINI_ENABLED=true`.
   Existing `DATABASE_URL` and Neon JWT configuration are still required.
4. Redeploy to load the new server variables and code. `GEMINI_ENABLED=false` disables
   the optional layer without changing deterministic chat.

Local secrets belong in ignored `.env.local`. Use Vercel's local development server
for API routes; Vite alone does not run the Vercel backend.

## Availability and quota

- Authenticated requests only, through the existing assistant JWT gateway.
- Atomic shared Neon gate: one in-flight attempt per key/model with a 15-second lease.
  Success releases the lease immediately for the next turn.
  Concurrent/busy messages immediately keep their deterministic reply.
- HTTP 429: 24-hour cooldown. Invalid credentials/model/configuration: 24 hours.
- Transient failures, timeouts, malformed/blocked/truncated output: 60 seconds.
- Google request timeout: 8 seconds; browser interpretation request: 12 seconds.
- After cooldown expires, the next eligible message probes again automatically.
- Cooldowns survive Vercel cold starts. Only a SHA-256 key/model fingerprint is stored.
- If the private cooldown table cannot be accessed, Gemini is skipped. If a later
  cooldown write fails, the initial 15-second gate remains; a full 24-hour cooldown
  cannot be guaranteed until the store recovers.
- No provider retry storm or secondary paid model. This does not impose a monetary
  cap; configure Google project budgets/quotas separately if using a paid API tier.

The table must stay private: no grants to browser roles and no Data API exposure.
Preview and Production sharing the same Neon branch/key/model share one cooldown.
Rotating the key or changing the model creates a new cooldown scope.

## Verification

Run `npm run lint`, `npm test`, and `npm run build`. Unit tests cover success, quota,
timeouts, missing configuration/store, blocked output, and preservation of financial
safety/confirmation paths. Production smoke checks after setup: conversational reply,
transaction confirmation unchanged, and deterministic chat after disabling Gemini.

Provider reference: https://ai.google.dev/api/generate-content
