# Phase 6 Implementation Plan: WDAI Slack Context

**Goal:** Connect the Women Defining AI Slack workspace and create reviewable relationship proposals from DMs and direct replies within the same thread, while ignoring passive channel activity.

**Architecture:** Slack Events API is the primary incremental source. Verified events enter the existing webhook inbox, normalize to Slack interaction records, pass a strict meaningful-interaction policy, and create sourced proposals. Bounded history backfill is optional and rate-limit-aware.

**Design patterns:** OAuth installation, signed webhook verification, event deduplication, semantic policy function, bounded backfill, workspace/user identity mapping.

**Tech stack:** Phase 4 stack plus official Slack OAuth, Events API, and Conversations API.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Feasibility and permissions gate

Before code:

1. Create a development Slack app in a test workspace and a separate WDAI installation plan.
2. Decide user-token vs bot-token access based on official scope behavior for public/private threads, DMs, and app distribution.
3. Approve the minimum scopes. Candidate history scopes include `channels:history`, `groups:history`, `im:history`, and `mpim:history`; identity/email scopes require separate justification.
4. Confirm current `conversations.replies` limits for the chosen app distribution. Design Events API as primary so history polling is not required for normal operation.
5. Record the decision in `relationship-copilot/docs/architecture/ADR-006-slack-wdai.md`.

## Required configuration

- `SLACK_CLIENT_ID`
- `SLACK_CLIENT_SECRET`
- `SLACK_SIGNING_SECRET`
- `SLACK_OAUTH_REDIRECT_URI`
- `RUN_SLACK_LIVE_TESTS=0`

Workspace/user tokens belong in encrypted connection secrets.

## Block 1: Slack installation and identity

### Success criteria

- [ ] A user connects only their own Slack identity/workspace installation.
- [ ] WDAI is explicitly identifiable by workspace ID, not display name.
- [ ] Revocation stops future ingestion without deleting approved history.

### Chunk 1.1: Define Slack OAuth contract

**Files:**

- Create `relationship-copilot/src/application/connections/slack-oauth.ts`
- Create `relationship-copilot/src/application/connections/slack-oauth.contract.test.ts`
- Create `relationship-copilot/src/test/fakes/fake-slack-oauth.ts`

**Step 1 (RED):** Test state, installation response, connected user ID, team ID, token type/scopes, refresh/rotation if supported, revoked token, and timeout.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Define the contract and fake from ADR-006.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): define Slack connection contract`.

### Chunk 1.2: Implement Slack connection routes

**Files:**

- Create `relationship-copilot/src/infrastructure/slack/slack-oauth-client.ts`
- Create `relationship-copilot/src/infrastructure/slack/slack-oauth-client.test.ts`
- Create route/test pairs under `relationship-copilot/src/app/api/connections/slack/`

**Step 1 (RED):** Test session-only start/revoke, state mismatch, callback replay, wrong workspace, encrypted token storage, and reconnection.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement 10-second OAuth timeout and store team/user IDs plus granted scopes.

**Step 4:** Run tests and optional sandbox OAuth flow.

**Step 5:** Commit `feat(copilot): connect WDAI Slack securely`.

## Block 2: Verified Slack event ingestion

### Success criteria

- [ ] Only verified, non-replayed Slack events enter the inbox.
- [ ] Webhooks acknowledge without waiting for downstream API calls.
- [ ] Message normalization excludes unsupported bot/system activity.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/connections/slack/start` | POST | Session only | Start owner installation |
| `/api/connections/slack/callback` | GET | OAuth state/code | Complete matching installation |
| `/api/connections/slack/revoke` | POST | Session only | Revoke owner installation |
| `/api/webhooks/slack/events` | POST | Valid Slack signature/timestamp | Persist/enqueue Slack events only |
| `/api/connections/slack/backfill` | POST | Session only | Enqueue bounded owner backfill |

Negative tests must prove OAuth/webhook credentials cannot call session-only routes and stale replayed signatures are rejected.

### Chunk 2.1: Verify Slack requests

**Files:**

- Create `relationship-copilot/src/infrastructure/slack/verify-slack-request.ts`
- Create `relationship-copilot/src/infrastructure/slack/verify-slack-request.test.ts`
- Create `relationship-copilot/src/app/api/webhooks/slack/events/route.ts`
- Create `relationship-copilot/src/app/api/webhooks/slack/events/route.test.ts`

**Step 1 (RED):** Test URL verification challenge, valid signature, invalid signature, timestamp replay, duplicate event ID, retry headers, unknown team, malformed body, and prompt acknowledgment.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Verify raw-body signature, enforce replay window, persist to inbox, and acknowledge without downstream processing.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): verify and persist Slack events`.

### Chunk 2.2: Normalize message events

**Files:**

- Create `relationship-copilot/src/domain/slack/slack-message.ts`
- Create `relationship-copilot/src/domain/slack/slack-message.test.ts`
- Create `relationship-copilot/src/infrastructure/slack/normalize-slack-event.ts`
- Create `relationship-copilot/src/infrastructure/slack/normalize-slack-event.test.ts`

**Step 1 (RED):** Cover DM, group DM, channel root, thread reply, edited/deleted message, bot message, app message, reaction, file share, unknown subtype, and duplicate event.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Normalize only human-authored message events needed by the policy. Store safe excerpts and source locators, not raw event bodies.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): normalize Slack interactions`.

## Block 3: Meaningful-interaction policy

### Success criteria

- [ ] DMs count.
- [ ] Direct replies in the same thread count.
- [ ] Reactions, passive membership, unrelated messages, and bots do not count.

### Chunk 3.1: Implement the strict policy

**Files:**

- Create `relationship-copilot/src/domain/slack/is-meaningful-interaction.ts`
- Create `relationship-copilot/src/domain/slack/is-meaningful-interaction.test.ts`

**Step 1 (RED):** Test:

- one-to-one DM involving the connected user;
- another human directly replying in a thread rooted by the user;
- the user directly replying in another human's thread;
- thread with both people but no direct reply relationship;
- same-channel message without a reply;
- reaction only;
- bot/app/system message;
- private/public channel distinction;
- message involving an unresolvable user.

**Step 2:** Run test; expect failure.

**Step 3 (GREEN):** Return `meaningful`, `ignored`, or `needs_context` with explicit reason codes. `needs_context` may enqueue one bounded thread lookup.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): identify meaningful Slack exchanges`.

### Chunk 3.2: Resolve Slack people conservatively

**Files:**

- Create `relationship-copilot/src/application/slack/resolve-slack-person.ts`
- Create `relationship-copilot/src/application/slack/resolve-slack-person.test.ts`
- Create `relationship-copilot/src/infrastructure/slack/slack-users-client.ts`
- Create `relationship-copilot/src/infrastructure/slack/slack-users-client.test.ts`

**Step 1 (RED):** Test existing Slack external ID, exact approved email, display-name-only ambiguity, deactivated user, missing permitted email, and cross-workspace same user ID.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Resolve exact trusted identifiers only. Ambiguity creates an unresolved proposal; never merge by display name alone.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): resolve Slack identities safely`.

## Block 4: Proposal creation and bounded backfill

### Success criteria

- [ ] Only meaningful interactions create proposals.
- [ ] Backfill is explicit, bounded, resumable, and rate-limit-aware.
- [ ] Duplicate event/history paths converge on one source record.

### Chunk 4.1: Turn meaningful events into proposals

**Files:**

- Create `relationship-copilot/src/application/slack/create-slack-proposal.ts`
- Create `relationship-copilot/src/application/slack/create-slack-proposal.test.ts`
- Create `relationship-copilot/src/workers/process-slack-event.ts`
- Create `relationship-copilot/src/workers/process-slack-event.test.ts`

**Step 1 (RED):** Test DM, direct reply, ignored passive message, unresolved identity, duplicate event, edited message, deleted message, source evidence, and provider timeout.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Persist safe source records and create proposals only for meaningful interactions.

**Step 4:** Run tests/database checks.

**Step 5:** Commit `feat(copilot): propose meaningful Slack context`.

### Chunk 4.2: Implement opt-in bounded history backfill

**Files:**

- Create `relationship-copilot/src/application/slack/slack-history-client.ts`
- Create `relationship-copilot/src/application/slack/slack-history-client.contract.test.ts`
- Create `relationship-copilot/src/workers/backfill-slack.ts`
- Create `relationship-copilot/src/workers/backfill-slack.test.ts`

**Step 1 (RED):** Test explicit date bound, cursor resume, rate-limit delay, maximum requests/job, revoked scope, thread lookup budget, duplicate history/event, and cancellation.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement rate-aware, resumable backfill only if ADR-006 approves it. Default to 30 days and require explicit user initiation.

**Step 4:** Run offline tests; gate live tests.

**Step 5:** Commit `feat(copilot): backfill Slack context within limits`.

## Block 5: Slack connection health UI

### Success criteria

- [ ] Users can see the connected workspace, scopes, and last successful event.
- [ ] Rate-limited, revoked, and missing-scope states offer clear recovery.
- [ ] The UI explains exactly which Slack interactions count.

### Chunk 5.1: Build WDAI connection surface

**Files:**

- Create `relationship-copilot/src/components/connections/slack-connection.tsx`
- Create `relationship-copilot/src/components/connections/slack-connection.test.tsx`
- Create `relationship-copilot/e2e/slack-connection.spec.ts`

**Step 1 (RED):** Test workspace identity, granted/missing scopes, event health, backfill progress, rate-limit pause, revoke, reconnect, and explanation of included/excluded interactions using API fixtures.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement connection health and transparent relevance rules.

**Step 4:** Run accessibility/E2E tests.

**Step 5:** Commit `feat(copilot): show WDAI Slack connection health`.

## Reliability standards

- Webhook acknowledgment does not wait for Slack API calls.
- Slack API timeout: 10 seconds; honor `Retry-After`; never busy-loop.
- Cap backfill requests and thread lookups per job according to ADR-006.
- Never log message text, channel names, member emails, or OAuth tokens.
- Live tests require `RUN_SLACK_LIVE_TESTS=1` and a dedicated sandbox workspace.

## Technical debt strategy

- Additional Slack workspaces are deferred until WDAI proves the model.
- Reactions and passive co-presence remain out of scope.
- Sentiment, topic modeling, and broad channel summarization are out of scope.

## Final verification

Run all previous checks plus Slack OAuth, signature, policy, identity, event worker, bounded backfill, and connection E2E suites. Perform one opt-in sandbox event test.

Ready to start building? Use `build`.
