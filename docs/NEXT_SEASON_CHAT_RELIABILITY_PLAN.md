# Next Season — Chat Reliability Plan

## Why this exists

The chat experience must behave like a reliable conversation, not a screen
whose state changes unpredictably. The next development season should finish
the remaining reliability work behind the **“Riwayat belum tersambung”** state
and make every chat transition observable and testable.

This plan intentionally prioritises correctness over new assistant features.

## Current baseline

The current patch fixes four immediate failure modes:

- Initial database or assistant-state loading no longer renders as “Kurogi
  sedang berpikir”. That status is reserved for a message the user actually
  sent.
- A late history request cannot replace messages that were saved while it was
  in flight.
- A refresh of the auth user object no longer clears the conversation when the
  signed-in user ID has not changed.
- Pending-action and dialogue expiry are calculated by the server, so an
  incorrect device clock cannot trigger the “masa berlaku … di luar rentang”
  error. A new message also supersedes an unconfirmed older draft instead of
  repeatedly pulling the user back to it.

## P0 — Diagnose and eliminate connection recovery failures

The screenshot still identifies an important unresolved condition: the client
is receiving a chat-history error and can fall back to an empty chat surface.

1. Add privacy-safe telemetry for every chat read/write: request ID, user
   session generation, operation, duration, HTTP/database error code, and
   retry outcome. Never record chat text, user IDs, JWTs, attachment paths, or
   financial values.
2. Correlate the frontend request ID with the Neon Data API/Vercel request
   logs to identify whether the failure is an expired token, RLS timing race,
   network failure, or schema/API mismatch.
3. Change recovery into a bounded state machine:
   `idle → loading → ready | degraded → retrying → ready | unavailable`.
   Only a manual retry or a bounded automatic retry may move `degraded`.
4. Preserve the last successful message snapshot while degraded. Never show
   the welcome state until a successful empty response has been received for
   the current authenticated user.
5. Add a small, non-blocking sync indicator with a technical retry detail
   hidden behind “Detail”, rather than placing a large warning above the chat.

### P0 acceptance criteria

- Simulated token refresh, one failed request, slow network, and a cancelled
  request never remove visible messages.
- An empty chat welcome is shown only after the current account returns a
  successful zero-message result.
- Retrying produces one request per click and does not duplicate messages.
- Production logs can identify the failure class without exposing user data.

## P1 — Make conversation state an explicit server-backed lifecycle

1. Store an immutable conversation event sequence (message ID, ordering key,
   state transition, request ID) separate from display metadata.
2. Use cursor pagination with `(created_at, id)` everywhere and test timestamp
   ties, page boundaries, deleted messages, and messages arriving during
   pagination.
3. Add server-side cancellation/supersession for every pending action. A new
   substantive user message should atomically mark the older draft as
   `superseded`, not merely hide it in the client.
4. Return a structured error code for expired, cancelled, superseded, and
   unavailable actions. Map these to calm user copy rather than generic
   technical error bubbles.
5. Expire stale server rows in a scheduled cleanup job, while retaining a
   short audit trail needed for idempotency and support diagnostics.

### P1 acceptance criteria

- A draft can be confirmed exactly once, cancelled exactly once, or
  superseded exactly once across reloads and multiple tabs.
- Opening a new tab, refreshing, or returning tomorrow cannot resurrect an
  expired draft as the active conversation.
- The history ordering is stable across pages and across client restarts.

## P2 — End-to-end regression suite

1. Add browser-level tests for login, initial load, send, reload during send,
   auth refresh, failed history fetch, retry, pagination, clear history, and
   pending-action supersession.
2. Add deterministic network fixtures: delayed success, 401 then refreshed
   success, RLS denial, offline failure, and duplicate responses.
3. Run the suite against a disposable Neon branch in CI before migrations are
   promoted to production.
4. Add a production smoke check that verifies the chat shell loads and the
   assistant endpoint responds without testing or recording a real user
   message.

## P3 — Simplify the assistant architecture

The current assistant has overlapping local and deterministic pending-action
paths. Consolidate them behind one conversation coordinator with one source
of truth for:

- message submission and idempotency;
- current pending action;
- dialogue state;
- loading/degraded state; and
- persistence and retry rules.

Do not add more parsing rules until this consolidation is complete. Every new
assistant behaviour should include a regression case in the Indonesian test
corpus and one end-to-end conversation test.

## Suggested implementation order

1. P0 telemetry and state machine.
2. P0 browser tests reproducing the screenshot.
3. P1 server-side pending-action supersession migration/API.
4. P1 cleanup and structured client errors.
5. P2 CI Neon-branch verification.
6. P3 coordinator consolidation.
