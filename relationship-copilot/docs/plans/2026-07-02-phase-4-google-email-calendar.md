# Phase 4 Implementation Plan: Google Email and Calendar

**Goal:** Connect each user's Google account and turn direct email exchanges plus calendar meetings with fewer than 15 attendees into sourced, reviewable proposals.

**Architecture:** Per-user Google OAuth credentials are encrypted in existing connection records. Initial and incremental sync adapters persist immutable source records before classification. Gmail Pub/Sub and Calendar webhook notifications enqueue sync jobs; they never write trusted relationship data directly.

**Design patterns:** OAuth adapter, sync cursor, webhook notification inbox, incremental sync, deterministic relevance policy, anti-corruption layer, proposal fan-out.

**Tech stack:** Phase 3 stack plus official Google OAuth, Gmail API, Calendar API, and Cloud Pub/Sub.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Feasibility and configuration gate

Before code:

1. Create a Google Cloud project and OAuth consent screen for test users.
2. Approve least-privilege scopes: Gmail read-only and Calendar read-only, plus identity scopes needed for account labeling.
3. Configure offline access and encrypted refresh-token storage.
4. Configure a Pub/Sub topic/subscription for Gmail and HTTPS notification endpoint for Calendar.
5. Record Google verification requirements and test-user limits in `docs/architecture/ADR-004-google-connection.md`.

Add to `.env.example` and `src/config/server-env.ts`:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `GOOGLE_PUBSUB_AUDIENCE`
- `GOOGLE_INITIAL_SYNC_DAYS=365`
- `RUN_GOOGLE_LIVE_TESTS=0`

## Block 1: OAuth connection lifecycle

### Success criteria

- [ ] Each user connects and revokes only their own Google account.
- [ ] Refresh tokens are encrypted and never returned to the browser.
- [ ] OAuth state and PKCE prevent cross-session connection swaps.

### Chunk 1.1: Define Google OAuth adapter contract

**Files:**

- Create `relationship-copilot/src/application/connections/google-oauth.ts`
- Create `relationship-copilot/src/application/connections/google-oauth.contract.test.ts`
- Create `relationship-copilot/src/test/fakes/fake-google-oauth.ts`

**Step 1 (RED):** Test authorization URL, state/PKCE, callback exchange, offline refresh token, incremental scopes, revoke, timeout, and missing refresh token.

**Step 2:** Run contract tests; expect failure.

**Step 3 (GREEN):** Define the port and deterministic fake.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): define Google OAuth contract`.

### Chunk 1.2: Implement connection routes

**Files:**

- Create `relationship-copilot/src/infrastructure/google/google-oauth-client.ts`
- Create `relationship-copilot/src/infrastructure/google/google-oauth-client.test.ts`
- Create route/test pairs under `relationship-copilot/src/app/api/connections/google/start/`, `callback/`, and `revoke/`
- Modify connections settings components/tests

**Step 1 (RED):** Test session-only start/revoke, state mismatch, callback replay, another user's state, encrypted secret persistence, revocation, and user-visible reconnect state.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement 10-second token endpoint timeout and per-user connection storage.

**Step 4:** Run tests and optional sandbox OAuth E2E.

**Step 5:** Commit `feat(copilot): connect Google accounts securely`.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/connections/google/start` | POST | Session only | Start owner's OAuth flow |
| `/api/connections/google/callback` | GET | OAuth state/code | Complete matching owner's flow |
| `/api/connections/google/revoke` | POST | Session only | Revoke owner's connection |
| `/api/webhooks/google/gmail` | POST | Verified Pub/Sub identity | Enqueue Gmail sync only |
| `/api/webhooks/google/calendar` | POST | Valid channel token/headers | Enqueue Calendar sync only |
| `/api/connections/google/sync` | POST | Session only | Enqueue bounded owner sync |

Negative tests must prove provider callbacks cannot call session mutations and one user cannot complete another user's OAuth state.

## Block 2: Sync state and source persistence

### Success criteria

- [ ] Cursors advance only after durable source persistence.
- [ ] Duplicate provider records do not create duplicate sources or proposals.
- [ ] Sync state and source metadata remain tenant-isolated.

### Chunk 2.1: Add sync schema

**Files:**

- Create `relationship-copilot/supabase/tests/0040_google_sync.test.sql`
- Create `relationship-copilot/supabase/migrations/0040_google_sync.sql`

**Step 1 (RED):** Test per-connection cursors, watch subscription expiry, unique external source IDs, bounded error state, and tenant isolation.

**Step 2:** Run database tests; expect failure.

**Step 3 (GREEN):** Add `sync_cursors(connection_id, source, cursor, last_full_sync_at, last_incremental_sync_at, status, last_error_code)` and `watch_subscriptions(connection_id, source, external_channel_id, resource_id, expires_at, status)`.

**Step 4:** Run database tests.

**Step 5:** Commit `feat(copilot): add Google sync state`.

### Chunk 2.2: Persist source records idempotently

**Files:**

- Create `relationship-copilot/src/application/sources/upsert-source-record.ts`
- Create `relationship-copilot/src/application/sources/upsert-source-record.test.ts`
- Create `relationship-copilot/src/domain/sources/source-record.ts`

**Step 1 (RED):** Test duplicate external ID, changed content hash, safe excerpt truncation, source URL, metadata allowlist, and owner mismatch.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement immutable original identity plus versioned safe metadata. Do not store full email or calendar payload by default.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): persist deduplicated source records`.

## Block 3: Gmail ingestion and filtering

### Success criteria

- [ ] Initial and incremental sync are retry-safe.
- [ ] Newsletters, automated mail, and bulk mail do not create proposals.
- [ ] Direct relationship exchanges retain enough evidence for review.

### Chunk 3.1: Define Gmail client and fixtures

**Files:**

- Create `relationship-copilot/src/application/google/gmail-client.ts`
- Create `relationship-copilot/src/application/google/gmail-client.contract.test.ts`
- Create `relationship-copilot/src/test/fixtures/google/gmail/`
- Create `relationship-copilot/src/test/fakes/fake-gmail-client.ts`

**Step 1 (RED):** Cover pagination, history cursor, 404 invalid cursor, token refresh, 429 retry-after, timeout, deleted message, and partial page failure.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Define the contract/fake with a 15-second per-page timeout.

**Step 4:** Run tests.

**Step 5:** Commit `test(copilot): define Gmail sync contract`.

### Chunk 3.2: Implement relationship-bearing email policy

**Files:**

- Create `relationship-copilot/src/domain/email/classify-email.ts`
- Create `relationship-copilot/src/domain/email/classify-email.test.ts`

**Step 1 (RED):** Add fixtures for direct one-to-one, small direct thread, `List-Unsubscribe`, bulk precedence, no-reply sender, automated headers, mailing list, self-only, and ambiguous mail.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Return `relationship_candidate`, `ignored`, or `needs_review` with reason codes. Ambiguous mail may create a low-confidence review proposal; obvious bulk/automation may not.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): filter relationship-bearing email`.

### Chunk 3.3: Implement Gmail initial/incremental sync

**Files:**

- Create `relationship-copilot/src/infrastructure/google/gmail-api-client.ts`
- Create `relationship-copilot/src/infrastructure/google/gmail-api-client.test.ts`
- Create `relationship-copilot/src/workers/sync-gmail.ts`
- Create `relationship-copilot/src/workers/sync-gmail.test.ts`

**Step 1 (RED):** Test 365-day initial bound, cursor advance only after page commit, duplicate notification, invalid-history full-sync fallback, newsletter exclusion, proposal fan-out, and revoked token.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement bounded sync, source persistence, classification, and proposal creation. Never advance a cursor past failed work.

**Step 4:** Run offline tests; gate live test.

**Step 5:** Commit `feat(copilot): sync relationship email safely`.

## Block 4: Calendar ingestion

### Success criteria

- [ ] Only non-cancelled meetings with fewer than 15 human attendees qualify.
- [ ] Every qualifying attendee receives a sourced proposal.
- [ ] Recurring updates and invalid sync tokens are retry-safe.

### Chunk 4.1: Define meeting relevance

**Files:**

- Create `relationship-copilot/src/domain/calendar/classify-meeting.ts`
- Create `relationship-copilot/src/domain/calendar/classify-meeting.test.ts`

**Step 1 (RED):** Test 1, 14, and 15 attendees; recurring meetings; cancelled events; resource rooms; missing attendee response; external guests; self attendee; duplicate aliases; and all-day events.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Accept non-cancelled meetings with 1–14 human attendees excluding the connected user and resources. Propose every remaining attendee.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): classify relationship meetings`.

### Chunk 4.2: Implement Calendar sync

**Files:**

- Create `relationship-copilot/src/application/google/calendar-client.ts`
- Create `relationship-copilot/src/application/google/calendar-client.contract.test.ts`
- Create `relationship-copilot/src/infrastructure/google/calendar-api-client.ts`
- Create `relationship-copilot/src/workers/sync-calendar.ts`
- Create `relationship-copilot/src/workers/sync-calendar.test.ts`

**Step 1 (RED):** Test initial window, sync token, recurring update, cancellation, duplicate attendee proposal, event mutation, timeout, 410 invalid token, and revoked connection.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement 15-second page timeout, event source records, attendee identity hints, and proposal fan-out.

**Step 4:** Run tests and optional sandbox sync.

**Step 5:** Commit `feat(copilot): sync small Google meetings`.

## Block 5: Push notifications and watch renewal

### Success criteria

- [ ] Provider notifications are verified, acknowledged quickly, and enqueue work only.
- [ ] Watches renew before expiry.
- [ ] Periodic catch-up handles delayed or dropped notifications.

### Chunk 5.1: Verify provider notifications

**Files:**

- Create Gmail/Calendar webhook route tests and implementations under `src/app/api/webhooks/google/`
- Create `relationship-copilot/src/infrastructure/google/verify-pubsub.ts`
- Create `relationship-copilot/src/infrastructure/google/verify-calendar-channel.ts`

**Step 1 (RED):** Test invalid audience/token, replay, unknown connection, duplicate event, empty notification, and prompt acknowledgment.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Verify, persist, and enqueue only. Never fetch Google data in the webhook request.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): enqueue verified Google updates`.

### Chunk 5.2: Renew watches and catch up

**Files:**

- Create `relationship-copilot/src/workers/renew-google-watches.ts`
- Create `relationship-copilot/src/workers/renew-google-watches.test.ts`
- Modify job scheduling configuration

**Step 1 (RED):** Test daily Gmail renewal, expiring Calendar channel, renewal failure, duplicate job, dropped notification catch-up, and disabled connection.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Renew before expiry and schedule periodic incremental catch-up even when no notification arrives.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): maintain Google sync watches`.

## Block 6: Connection and sync-status UI

### Success criteria

- [ ] Users understand granted scopes and current sync health.
- [ ] Expired/revoked connections offer clear recovery.
- [ ] Revocation stops future sync without deleting approved history.

### Chunk 6.1: Add Google connection status

**Files:**

- Modify connection settings page/components
- Create `relationship-copilot/src/components/connections/google-connection.tsx`
- Create `relationship-copilot/src/components/connections/google-connection.test.tsx`
- Create `relationship-copilot/e2e/google-connection.spec.ts`

**Step 1 (RED):** Test disconnected, consent pending, syncing, connected, partial failure, expired, revoked, reconnect, manual sync, and last-success timestamps using API fixtures.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement clear scope explanation and failure recovery. Revocation copy must state that historical approved records remain while future sync stops.

**Step 4:** Run accessibility/E2E tests.

**Step 5:** Commit `feat(copilot): show Google connection health`.

## Reliability standards

- Google token calls: 10 seconds. Gmail/Calendar page calls: 15 seconds.
- Honor provider retry-after; max five transient attempts.
- Initial sync is resumable and capped per job invocation.
- Store minimal safe excerpts; never log email bodies, attendee descriptions, or OAuth tokens.
- Live tests require `RUN_GOOGLE_LIVE_TESTS=1` and a dedicated sandbox account.

## Technical debt strategy

- Full-text email storage is out of scope.
- Gmail/Calendar proposals may initially use deterministic extraction; AI enrichment can operate on safe excerpts after approval policy review.
- Multi-calendar selection beyond the primary calendar may be deferred and logged.

## Final verification

Run all previous checks plus focused Google OAuth, sync, filter, webhook, watch, and connection E2E suites. Perform one opt-in sandbox initial and incremental sync.

Ready to start building? Use `build`.
