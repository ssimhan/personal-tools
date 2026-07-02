# Phase 3 Implementation Plan: Relationship Memory and Reminders

**Goal:** Turn approved context into a trustworthy person timeline, proactive follow-up reminders, contextual opener drafts, and actionable snooze/complete/dismiss flows.

**Architecture:** Trusted interactions are the source of relationship memory. Summary and opener generation run only from approved data through asynchronous jobs. Reminder delivery uses a provider-neutral notification port, a transactional outbox, and a scheduler-neutral job runner.

**Design patterns:** Event-driven projection, derived summary with version history, strategy-based channel recommendation, job lease, transactional outbox, deterministic clock.

**Tech stack:** Phase 2 stack plus the approved background scheduler/email provider recorded in ADR-003.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Preconditions

- Phase 2 verification passes.
- Approve `relationship-copilot/docs/architecture/ADR-003-jobs-and-notifications.md`, naming scheduler transport, email provider, WhatsApp reminder template/fallback, retry policy, and production ownership.
- Run `/impeccable shape person-memory-and-reminder` before Blocks 3 and 5. The shape must cover person timeline, reminder notification landing, opener draft, snooze duration copy, complete/dismiss semantics, mobile states, and Warm + Quiet direction.

## Required configuration

Add to `.env.example` and `src/config/server-env.ts`:

- `CRON_SECRET`
- `JOB_LEASE_SECONDS=120`
- Email provider credentials chosen by ADR-003
- `REMINDER_AI_MODEL`
- `RUN_NOTIFICATION_LIVE_TESTS=0`

## Block 1: Trusted memory projections

### Success criteria

- [ ] Approved interactions appear chronologically on the correct person.
- [ ] Summary generations are versioned and source-bounded.
- [ ] Rejected/pending source content never enters memory.

### Chunk 1.1: Add summary version schema

**Files:**

- Create `relationship-copilot/supabase/tests/0030_memory.test.sql`
- Create `relationship-copilot/supabase/migrations/0030_memory.sql`

**Step 1 (RED):** Test `relationship_summary_versions`, owner-consistent person/interaction links, current-version uniqueness, and RLS. Assert a version must list approved interaction IDs.

**Step 2:** Run `npm run test:db`; expect failure.

**Step 3 (GREEN):** Add `relationship_summary_versions(id, owner_id, person_id, summary, source_interaction_ids, model, prompt_version, created_at, is_current)` and owner-only policies.

**Step 4:** Run database tests.

**Step 5:** Commit `feat(copilot): add versioned relationship memory`.

### Chunk 1.2: Build the timeline query

**Files:**

- Create `relationship-copilot/src/application/people/get-person-timeline.ts`
- Create `relationship-copilot/src/application/people/get-person-timeline.test.ts`
- Modify `relationship-copilot/src/domain/people/person-repository.ts`
- Modify `relationship-copilot/src/infrastructure/supabase/supabase-person-repository.ts`

**Step 1 (RED):** Test chronological ordering, pagination, same-timestamp tie-break, approved-only interactions, missing person, and cross-owner access.

**Step 2:** Run focused test; expect failure.

**Step 3 (GREEN):** Implement the owner-scoped timeline query with cursor pagination.

**Step 4:** Run unit/database/type checks.

**Step 5:** Commit `feat(copilot): project trusted person timelines`.

### Chunk 1.3: Regenerate summaries after approval

**Files:**

- Create `relationship-copilot/src/application/memory/summary-generator.ts`
- Create `relationship-copilot/src/application/memory/summary-generator.contract.test.ts`
- Create `relationship-copilot/src/application/memory/regenerate-summary.ts`
- Create `relationship-copilot/src/application/memory/regenerate-summary.test.ts`
- Create `relationship-copilot/src/infrastructure/ai/relationship-summary-generator.ts`
- Create `relationship-copilot/src/infrastructure/ai/prompts/relationship-summary-v1.ts`

**Step 1 (RED):** Test approved source selection, unchanged-summary no-op, new version creation, provider timeout, malformed output, manual notes precedence, and retry idempotency.

**Step 2:** Run offline tests; expect failure.

**Step 3 (GREEN):** Implement a 30-second adapter timeout and persist only source-bounded summaries. Never include pending/rejected source text.

**Step 4:** Run offline tests; gate live test behind `RUN_NOTIFICATION_LIVE_TESTS=1`.

**Step 5:** Commit `feat(copilot): generate approved relationship summaries`.

## Block 2: Job runner and reminder state machine

### Success criteria

- [ ] Due reminders are claimed once under concurrency.
- [ ] Jobs recover from crashed leases.
- [ ] Reminder actions are idempotent and terminal semantics are explicit.

### Chunk 2.1: Add job schema and lease tests

**Files:**

- Create `relationship-copilot/supabase/tests/0031_jobs.test.sql`
- Create `relationship-copilot/supabase/migrations/0031_jobs.sql`

**Step 1 (RED):** Test unique job idempotency keys, due ordering, atomic lease, expired lease recovery, max-attempt dead-letter state, and owner scope.

**Step 2:** Run database tests; expect failure.

**Step 3 (GREEN):** Add `jobs(id, owner_id, kind, payload, idempotency_key, run_at, status, lease_until, attempt_count, max_attempts, last_error_code, timestamps)` and secure claim/complete/fail functions.

**Step 4:** Run database tests.

**Step 5:** Commit `feat(copilot): add retry-safe job queue`.

### Chunk 2.2: Model reminder actions

**Files:**

- Create `relationship-copilot/src/domain/reminders/reminder.ts`
- Create `relationship-copilot/src/domain/reminders/reminder.test.ts`
- Create `relationship-copilot/src/application/reminders/update-reminder.ts`
- Create `relationship-copilot/src/application/reminders/update-reminder.test.ts`

**Step 1 (RED):** Test due, snooze-until, complete, dismiss, duplicate action, invalid past snooze, and terminal-state action conflicts using a fake clock.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement explicit state transitions. `Complete` records that outreach occurred; `Dismiss` closes without claiming outreach; neither silently creates an interaction.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): model reminder lifecycle`.

### Chunk 2.3: Schedule and process due reminders

**Files:**

- Create `relationship-copilot/src/application/reminders/schedule-reminders.ts`
- Create `relationship-copilot/src/application/reminders/schedule-reminders.test.ts`
- Create `relationship-copilot/src/workers/process-due-reminders.ts`
- Create `relationship-copilot/src/workers/process-due-reminders.test.ts`
- Create `relationship-copilot/src/app/api/internal/jobs/run/route.ts`
- Create `relationship-copilot/src/app/api/internal/jobs/run/route.test.ts`

**Step 1 (RED):** Test exact due boundary, timezone-safe UTC storage, duplicate cron invocation, concurrent lease, provider retry, and max-attempt user-visible failure.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement cron-secret authentication, bounded batch size, lease processing, and next-run scheduling.

**Step 4:** Run tests and database checks.

**Step 5:** Commit `feat(copilot): process due reminders reliably`.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/internal/jobs/run` | POST | Cron secret only | Lease and process allowed job kinds |
| `/api/reminders/[id]` | GET | Session only | Read owner reminder |
| `/api/reminders/[id]/snooze` | POST | Session only | Snooze owner reminder |
| `/api/reminders/[id]/complete` | POST | Session only | Complete owner reminder |
| `/api/reminders/[id]/dismiss` | POST | Session only | Dismiss owner reminder |

Negative tests must prove cron credentials cannot read session resources and session credentials cannot invoke job processing.

## Block 3: Channel recommendation and opener drafting

### Success criteria

- [ ] Recommendation uses the last meaningful exchange.
- [ ] Tie-break order is Slack, text, LinkedIn, email.
- [ ] Opener uses only trusted context and is never auto-sent.

### Chunk 3.1: Implement channel recommendation

**Files:**

- Create `relationship-copilot/src/domain/outreach/recommend-channel.ts`
- Create `relationship-copilot/src/domain/outreach/recommend-channel.test.ts`

**Step 1 (RED):** Test most-recent channel, identical timestamps with the required tie-break, missing channel value, stale channel, and no history.

**Step 2:** Run test; expect failure.

**Step 3 (GREEN):** Implement the deterministic recommendation and explanation string.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): recommend trusted outreach channel`.

### Chunk 3.2: Generate a contextual opener

**Files:**

- Create `relationship-copilot/src/application/outreach/opener-generator.ts`
- Create `relationship-copilot/src/application/outreach/opener-generator.contract.test.ts`
- Create `relationship-copilot/src/infrastructure/ai/contextual-opener-generator.ts`
- Create `relationship-copilot/src/infrastructure/ai/contextual-opener-generator.test.ts`
- Create `relationship-copilot/src/infrastructure/ai/prompts/opener-v1.ts`

**Step 1 (RED):** Test trusted context selection, source omission, neutral fallback when context is thin, no invented current facts, provider timeout, and user-editable output.

**Step 2:** Run offline tests; expect failure.

**Step 3 (GREEN):** Implement a 20-second adapter timeout. Return a draft plus cited internal source IDs; never call a send API.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): draft source-grounded outreach openers`.

## Block 4: Notification delivery and deferred digest

### Success criteria

- [ ] Due reminders use an allowed delivery path and are sent at most once.
- [ ] Deferred proposals appear in one owner-scoped digest with exact review links.
- [ ] Delivery failures remain visible and retryable without exposing content in logs.

### Chunk 4.1: Deliver reminder notifications

**Files:**

- Create `relationship-copilot/src/application/notifications/build-reminder-notification.ts`
- Create `relationship-copilot/src/application/notifications/build-reminder-notification.test.ts`
- Create WhatsApp reminder-template support in `src/infrastructure/whatsapp/`
- Create ADR-selected email adapter under `src/infrastructure/email/`
- Modify `relationship-copilot/src/workers/send-delivery.ts`

**Step 1 (RED):** Test active WhatsApp conversation, approved template path, missing/rejected template fallback to email, deep link, duplicate job, and delivery failure visibility.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Deliver through the allowed channel and persist provider response without message content.

**Step 4:** Run offline tests and optional sandbox tests.

**Step 5:** Commit `feat(copilot): deliver actionable reminders`.

### Chunk 4.2: Email deferred proposal digest

**Files:**

- Create `relationship-copilot/src/application/digests/build-review-digest.ts`
- Create `relationship-copilot/src/application/digests/build-review-digest.test.ts`
- Create `relationship-copilot/src/workers/send-review-digest.ts`
- Create `relationship-copilot/src/workers/send-review-digest.test.ts`
- Create `relationship-copilot/src/emails/review-digest.tsx`

**Step 1 (RED):** Test owner grouping, deferred-only inclusion, exact review links, empty no-send, digest idempotency, partial failure, and no source-body leakage.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Send one digest per owner/schedule window. Do not mark proposals reviewed.

**Step 4:** Run tests and snapshot accessible email markup.

**Step 5:** Commit `feat(copilot): send deferred review digests`.

## Block 5: Person and reminder UI

### Success criteria

- [ ] Person pages distinguish trusted memory from generated suggestions.
- [ ] Reminder screens explain the channel recommendation and never send outreach.
- [ ] Mobile, desktop, loading, empty, error, and terminal states are accessible.

### Chunk 5.1: Build person memory screen

**Files:**

- Create `relationship-copilot/src/app/(app)/people/[id]/page.tsx`
- Create `relationship-copilot/src/app/(app)/people/[id]/loading.tsx`
- Create `relationship-copilot/src/app/(app)/people/[id]/error.tsx`
- Create `relationship-copilot/src/components/people/person-header.tsx`
- Create `relationship-copilot/src/components/people/relationship-summary.tsx`
- Create `relationship-copilot/src/components/people/timeline.tsx`
- Create component tests and `e2e/person-memory.spec.ts`

**Step 1 (RED):** Test no summary, long history, source dates, unavailable channel, loading, missing person, retry, mobile layout, and keyboard access using API fixtures.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement the approved shape with trusted content clearly separated from suggestions.

**Step 4:** Run component, accessibility, responsive E2E, and visual checks.

**Step 5:** Commit `feat(copilot): add trusted relationship memory`.

### Chunk 5.2: Build reminder action screen

**Files:**

- Create `relationship-copilot/src/app/(app)/reminders/[id]/page.tsx`
- Create `relationship-copilot/src/components/reminders/reminder-action.tsx`
- Create `relationship-copilot/src/components/reminders/reminder-action.test.tsx`
- Create `relationship-copilot/e2e/reminder-action.spec.ts`

**Step 1 (RED):** Test channel explanation, opener loading/failure/editing, snooze date, complete/dismiss decision copy, stale action, and terminal state.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement the action screen. No button sends outreach.

**Step 4:** Run accessibility and E2E tests.

**Step 5:** Commit `feat(copilot): add actionable follow-up reminders`.

## Reliability standards

- Job batches finish within the hosting timeout; default maximum 25 jobs per invocation.
- AI summary timeout: 30 seconds. Opener timeout: 20 seconds. Notification timeout: 8 seconds.
- Failed reminders remain visible with retry/reconnect guidance.
- Summary and opener logs exclude prompt content and generated text.

## Technical debt strategy

- Advanced priority scoring is Phase 7.
- A basic reminder appears only from explicit approved follow-up intent in this phase.
- Do not implement automatic outreach or background LinkedIn lookup.

## Final verification

Run all previous checks plus focused memory, jobs, reminder, digest, and responsive E2E suites.

Ready to start building? Use `build`.
