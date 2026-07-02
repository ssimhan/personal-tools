# Phase 2 Implementation Plan: WhatsApp Capture and Deep Links

**Goal:** Receive natural-language WhatsApp captures, extract reviewable proposals, ask clarifying questions when identity is uncertain, and return a link to the exact app review item.

**Architecture:** Meta WhatsApp Business Platform webhook adapter feeds an idempotent capture application service. Provider payloads are normalized before entering the domain. AI extraction and WhatsApp delivery are replaceable ports with deterministic fakes. The app remains the only approval surface.

**Design patterns:** Hexagonal adapters, webhook inbox, idempotency key, stateful clarification conversation, provider contract tests, transactional outbox.

**Tech stack:** Phase 1 stack plus the approved Meta Graph client approach and one approved structured-output AI provider selected by ADR before implementation.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Feasibility and setup gate

Before code:

1. Create a Meta app and WhatsApp test number using official tooling.
2. Confirm webhook verification and signed POST delivery to a development endpoint.
3. Document the 24-hour conversation behavior and which future reminders require approved templates.
4. Decide how a WhatsApp sender maps to an authenticated app user.
5. Write `relationship-copilot/docs/architecture/ADR-002-whatsapp-and-extraction-providers.md` naming the Meta API version, AI provider/model, SDKs, credential model, and fallback behavior.
6. Do not use WhatsApp Web automation, personal-session scraping, or unofficial reverse-engineered clients.

## Required configuration

Document in `relationship-copilot/.env.example` and load through `src/config/server-env.ts`:

- `APP_BASE_URL`
- `META_APP_ID`
- `META_APP_SECRET`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `TOKEN_ENCRYPTION_KEY`
- AI provider key and `CAPTURE_AI_MODEL` chosen by ADR-002
- `RUN_WHATSAPP_LIVE_TESTS=0` by default

Per-user WhatsApp access tokens, phone-number IDs, and sender mappings belong in encrypted database records, not environment variables.

## Block 1: Connections, webhook inbox, and delivery outbox

### Success criteria

- [ ] Provider credentials are encrypted per user.
- [ ] Duplicate webhook events are acknowledged but processed once.
- [ ] Outbound delivery has observable pending/sent/failed states.
- [ ] Cross-user connection access fails under RLS.

### Chunk 1.1: Add failing connection and event tests

**Files:**

- Create `relationship-copilot/supabase/tests/0020_connections.test.sql`
- Create `relationship-copilot/supabase/tests/0021_webhook_delivery_rls.test.sql`

**Step 1 (RED):** Test per-user connections, unique provider account IDs, encrypted-secret-only storage, unique provider event/message IDs, outbox states, and tenant isolation.

**Step 2:** Run `npm run test:db`; expect missing-schema failures.

### Chunk 1.2: Create integration transport schema

**Files:**

- Create `relationship-copilot/supabase/migrations/0020_integration_transport.sql`
- Modify tests from Chunk 1.1

**Step 1 (RED):** Add tests denying client reads of encrypted credential ciphertext and direct client writes to delivery state.

**Step 2:** Verify failures.

**Step 3 (GREEN):** Create:

- `connections(id, owner_id, provider, external_account_id, status, settings, timestamps)`
- `connection_secrets(connection_id, owner_id, encrypted_payload, key_version, timestamps)` with service-only access
- `webhook_events(id, provider, external_event_id, connection_id, received_at, payload_hash, processing_status, attempt_count, last_error_code)`
- `capture_conversations(id, owner_id, connection_id, external_sender_id, state, pending_proposal_id, expires_at)`
- `delivery_attempts(id, owner_id, connection_id, kind, idempotency_key, status, provider_message_id, attempt_count, next_attempt_at, last_error_code)`

**Step 4:** Run database tests.

**Step 5:** Commit `feat(copilot): add connector inbox and delivery outbox`.

## Block 2: Webhook verification and normalization

### Success criteria

- [ ] Only verified Meta events enter the webhook inbox.
- [ ] Duplicate events are acknowledged and processed once.
- [ ] Unsupported content produces a safe response without a trusted write.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/webhooks/whatsapp` | GET | Verify token challenge | Meta webhook setup only |
| `/api/webhooks/whatsapp` | POST | Valid Meta signature | Persist and enqueue WhatsApp events only |
| `/api/connections/whatsapp` | GET | Session only | Read owner's connection status |
| `/api/connections/whatsapp` | POST | Session only | Start/complete owner connection flow |
| `/api/connections/whatsapp` | DELETE | Session only | Revoke owner's connection and secrets |
| `/api/deliveries/[id]/retry` | POST | Session only | Retry owner's retryable failed delivery |

Add negative tests proving session credentials cannot forge webhooks and webhook credentials cannot access any session route.

### Chunk 2.1: Verify webhook requests

**Files:**

- Create `relationship-copilot/src/infrastructure/whatsapp/verify-webhook.ts`
- Create `relationship-copilot/src/infrastructure/whatsapp/verify-webhook.test.ts`
- Create `relationship-copilot/src/app/api/webhooks/whatsapp/route.ts`
- Create `relationship-copilot/src/app/api/webhooks/whatsapp/route.test.ts`

**Step 1 (RED):** Test valid/invalid challenge, valid/invalid signature, malformed JSON, unknown phone-number ID, timeout, and duplicate event acknowledgment.

**Step 2:** Run focused tests; expect failure.

**Step 3 (GREEN):** Implement constant-time verification, a 256 KB body limit, normalized error codes, and inbox persistence before acknowledging.

**Step 4:** Run route and security tests.

**Step 5:** Commit `feat(copilot): verify and persist WhatsApp webhooks`.

### Chunk 2.2: Normalize inbound messages

**Files:**

- Create `relationship-copilot/src/domain/capture/capture-message.ts`
- Create `relationship-copilot/src/domain/capture/capture-message.test.ts`
- Create `relationship-copilot/src/infrastructure/whatsapp/normalize-message.ts`
- Create `relationship-copilot/src/infrastructure/whatsapp/normalize-message.test.ts`

**Step 1 (RED):** Cover text, unsupported media, delivery receipts, status events, edited/duplicate messages, missing sender, and oversized text.

**Step 2:** Run tests; expect missing implementation.

**Step 3 (GREEN):** Normalize only supported text captures and status events. Unsupported content receives a safe, non-destructive response.

**Step 4:** Run tests and typecheck.

**Step 5:** Commit `feat(copilot): normalize WhatsApp capture events`.

## Block 3: Structured extraction and identity clarification

### Success criteria

- [ ] Extraction output is schema-validated and never writes trusted records.
- [ ] Ambiguous identity creates a clarification state, not a guess.
- [ ] AI failure preserves raw capture and exposes retry.

### Chunk 3.1: Define the extraction contract

**Files:**

- Create `relationship-copilot/src/application/capture/capture-extractor.ts`
- Create `relationship-copilot/src/application/capture/capture-extractor.contract.test.ts`
- Create `relationship-copilot/src/application/capture/capture-schema.ts`
- Create `relationship-copilot/src/test/fakes/fake-capture-extractor.ts`

**Step 1 (RED):** Contract-test person hints, conversation summary, occurred-at interpretation, follow-up intent/date, unsupported claims, evidence locators, and invalid provider output.

**Step 2:** Run the contract test; expect failure.

**Step 3 (GREEN):** Implement the port, schema, and deterministic fake.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): define capture extraction contract`.

### Chunk 3.2: Implement the approved AI adapter

**Files:**

- Create `relationship-copilot/src/infrastructure/ai/structured-capture-extractor.ts`
- Create `relationship-copilot/src/infrastructure/ai/structured-capture-extractor.test.ts`
- Create `relationship-copilot/src/infrastructure/ai/prompts/capture-v1.ts`
- Modify `relationship-copilot/src/config/server-env.ts`

**Step 1 (RED):** Use recorded provider responses to test valid structured output, hallucinated fields without evidence, refusal, rate limit, timeout, and malformed response.

**Step 2:** Run offline tests; expect failure.

**Step 3 (GREEN):** Implement the ADR-selected adapter with a 30-second timeout. Drop any extracted field that lacks a source locator. Never log message content.

**Step 4:** Run offline tests. Run live contract only with `RUN_WHATSAPP_LIVE_TESTS=1` and sandbox credentials.

**Step 5:** Commit `feat(copilot): extract sourced WhatsApp proposals`.

### Chunk 3.3: Resolve or clarify identity

**Files:**

- Create `relationship-copilot/src/application/capture/resolve-capture-identity.ts`
- Create `relationship-copilot/src/application/capture/resolve-capture-identity.test.ts`
- Create `relationship-copilot/src/application/capture/handle-clarification.ts`
- Create `relationship-copilot/src/application/capture/handle-clarification.test.ts`

**Step 1 (RED):** Test exact existing match, no match, two plausible matches, user selects a candidate, user supplies details, user says cancel, and expired conversation.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Match only approved existing data. No match or ambiguity creates a pending proposal with a clarification question; never select the highest score silently.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): clarify uncertain capture identity`.

## Block 4: Capture orchestration and deep-link delivery

### Success criteria

- [ ] One inbound message produces at most one proposal and one notification.
- [ ] The notification links directly to the owner-authorized review item.
- [ ] Partial failures resume without duplicate proposals or messages.

### Chunk 4.1: Orchestrate one idempotent capture

**Files:**

- Create `relationship-copilot/src/application/capture/process-whatsapp-capture.ts`
- Create `relationship-copilot/src/application/capture/process-whatsapp-capture.test.ts`
- Create `relationship-copilot/src/workers/process-webhook-event.ts`
- Create `relationship-copilot/src/workers/process-webhook-event.test.ts`

**Step 1 (RED):** Test duplicate delivery, extraction success, needs clarification, AI timeout, proposal persistence failure, and worker retry after partial failure.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement inbox-to-proposal orchestration. Mark the webhook processed only after proposal and delivery-outbox records commit.

**Step 4:** Run tests and database checks.

**Step 5:** Commit `feat(copilot): process WhatsApp captures idempotently`.

### Chunk 4.2: Send the exact review deep link

**Files:**

- Create `relationship-copilot/src/application/notifications/notification-sender.ts`
- Create `relationship-copilot/src/infrastructure/whatsapp/whatsapp-sender.ts`
- Create `relationship-copilot/src/infrastructure/whatsapp/whatsapp-sender.test.ts`
- Create `relationship-copilot/src/workers/send-delivery.ts`
- Create `relationship-copilot/src/workers/send-delivery.test.ts`

**Step 1 (RED):** Test deep-link URL, owner/recipient mapping, immediate reply, provider timeout, 429 retry-after, permanent failure, duplicate worker execution, and redacted logs.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement an 8-second Meta request timeout, bounded exponential retry with jitter, and one outbox record per idempotency key.

**Step 4:** Run tests and optional sandbox delivery test.

**Step 5:** Commit `feat(copilot): deliver WhatsApp review links`.

### Chunk 4.3: Support “I'm busy”

**Files:**

- Modify `relationship-copilot/src/application/capture/process-whatsapp-capture.ts`
- Create `relationship-copilot/src/application/capture/defer-command.ts`
- Create `relationship-copilot/src/application/capture/defer-command.test.ts`

**Step 1 (RED):** Test exact and natural-language busy intents, no active proposal, multiple active proposals, chosen defer date, and duplicate message.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Defer the active proposal and confirm it remains available in the app. Email digest delivery is Phase 3.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): defer WhatsApp reviews safely`.

## Block 5: Connection and failure UI

### Success criteria

- [ ] Users can connect, inspect, revoke, and recover WhatsApp without seeing credentials.
- [ ] Failed deliveries surface a clear retry or reconnect action.
- [ ] Revocation stops capture while preserving already approved records.

### Chunk 5.1: Add WhatsApp connection settings

**Files:**

- Create `relationship-copilot/src/app/(app)/settings/connections/page.tsx`
- Create `relationship-copilot/src/components/connections/whatsapp-connection.tsx`
- Create `relationship-copilot/src/components/connections/whatsapp-connection.test.tsx`
- Create API route/test pairs under `src/app/api/connections/whatsapp/`
- Create `relationship-copilot/e2e/whatsapp-connection.spec.ts`

**Step 1 (RED):** Test disconnected, connecting, connected, expired, revoked, and reconnect states using API fixtures. Test that disconnect copy states capture will stop and queued proposals remain.

**Step 2:** Run component/E2E tests; expect failure.

**Step 3 (GREEN):** Implement connection status and revocation without exposing secrets.

**Step 4:** Run accessibility, component, and E2E checks.

**Step 5:** Commit `feat(copilot): add WhatsApp connection management`.

## Reliability standards

- Webhook handler persists within 3 seconds and does not wait for AI/provider completion.
- Meta API calls timeout after 8 seconds; AI extraction after 30 seconds.
- Maximum worker attempts: 5 for transient failures; permanent auth/template failures stop and surface reconnection action.
- Payload logging is prohibited. Log hashes, provider IDs, connection IDs, attempt counts, and classified codes only.
- Live Meta/AI tests are off by default and use only sandbox data.

## Technical debt strategy

- Reminder templates are deliberately deferred to Phase 3.
- Email digest sending is deferred, but proposal deferral state is complete now.
- Identity enrichment from Google/Granola/Slack is deferred; Phase 2 matches only trusted existing records and explicit user clarification.

## Final verification

Run all prior checks plus:

```bash
npm run test -- whatsapp capture deliveries
npm run test:db
npm run test:e2e -- whatsapp-connection
RUN_WHATSAPP_LIVE_TESTS=1 npm run test:live -- whatsapp
```

The live command is optional and must use the Meta test number.

Ready to start building? Use `build`.
