# Phase 1 Implementation Plan: Trusted Capture and App Review

**Goal:** Implement the approval-before-write core: sourced proposals, field-level editing, an app review queue, and an atomic approve/reject workflow that is fully usable without any external connector.

**Architecture:** Structured capture requests create immutable source records and mutable pending proposals. Trusted `people`, `interactions`, and `reminders` are written only by an owner-authorized approval transaction. Rejection writes an audit decision but no trusted relationship data.

**Design patterns:** Proposal state machine, command handler, transactional outbox-ready domain events, repository contracts, API-source mocks, list/detail review shell.

**Tech stack:** Phase 0 stack plus Zod for boundary validation and Testing Library for review UI.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Preconditions

- Phase 0 full verification passes.
- Run `/impeccable shape review-queue` before Block 4. The approved shape must cover mobile and desktop, field provenance, editing, rejection, empty/loading/error states, and Warm + Quiet direction.
- The list label `Review` maps exactly to `proposals.status = 'pending'`, ordered by `created_at desc`; its visible count must come from that same query.

## Block 1: Proposal and evidence schema

### Success criteria

- [ ] Source records are immutable and deduplicated.
- [ ] Proposals support field-level edits without modifying source evidence.
- [ ] State transitions are constrained and audited.
- [ ] RLS prevents cross-user access to proposals and evidence.

### Chunk 1.1: Define proposal schema tests

**Files:**

- Create `relationship-copilot/supabase/tests/0010_proposals.test.sql`
- Create `relationship-copilot/supabase/tests/0011_proposal_rls.test.sql`

**Step 1 (RED):** Assert required tables, owner IDs, foreign keys, immutable source identity, unique `(owner_id, provider, external_id)`, allowed statuses, and owner-only policies.

**Step 2:** Run `npm run test:db`; expect missing-table failures.

**Step 3:** Leave the tests failing until Chunk 1.2.

### Chunk 1.2: Add proposal migrations

**Files:**

- Create `relationship-copilot/supabase/migrations/0010_proposals.sql`
- Modify `relationship-copilot/supabase/tests/0010_proposals.test.sql`
- Modify `relationship-copilot/supabase/tests/0011_proposal_rls.test.sql`

**Step 1 (RED):** Add negative transition tests for approved-to-pending, rejected-to-approved, and cross-owner evidence links.

**Step 2:** Run database tests; expect failure.

**Step 3 (GREEN):** Create:

- `source_records(id, owner_id, provider, external_id, occurred_at, content_hash, source_url, safe_excerpt, metadata, created_at)`
- `proposals(id, owner_id, source_record_id, kind, subject_person_id nullable, status, version, deferred_until nullable, created_at, reviewed_at)`
- `proposal_changes(id, owner_id, proposal_id, target_type, target_id nullable, field_path, proposed_value jsonb, edited_value jsonb nullable, confidence nullable)`
- `proposal_evidence(id, owner_id, proposal_change_id, source_record_id, excerpt, locator jsonb)`
- `proposal_decisions(id, owner_id, proposal_id, action, proposal_version, decided_at)`
- `reminders(id, owner_id, person_id nullable, source_proposal_id, topic, context, due_at, status, snoozed_until nullable, completed_at nullable, dismissed_at nullable, timestamps)`

Allow proposal states `pending`, `deferred`, `approved`, `rejected`, and `superseded`; allow reminder states `pending`, `snoozed`, `completed`, and `dismissed`. Enforce owner-consistent foreign keys and deny client updates to immutable source/evidence columns.

**Step 4:** Run `npm run test:db`; expect pass.

**Step 5:** Commit `feat(copilot): add sourced proposal schema`.

## Block 2: Proposal domain and state machine

### Success criteria

- [ ] Invalid proposals fail before persistence.
- [ ] Every state transition is deterministic and version-checked.
- [ ] Approval commands are safe to retry.

### Chunk 2.1: Model proposals and changes

**Files:**

- Create `relationship-copilot/src/domain/proposals/proposal.ts`
- Create `relationship-copilot/src/domain/proposals/proposal.test.ts`
- Create `relationship-copilot/src/domain/proposals/proposal-change.ts`
- Create `relationship-copilot/src/domain/proposals/proposal-change.test.ts`

**Step 1 (RED):** Test allowed target fields, required evidence, confidence range, field edit semantics, version increments, and terminal states.

**Step 2:** Run focused tests; expect missing-module failures.

**Step 3 (GREEN):** Implement the minimal immutable domain objects and transition functions.

**Step 4:** Run focused tests and typecheck.

**Step 5:** Commit `feat(copilot): model proposal state transitions`.

### Chunk 2.2: Add owner-scoped proposal repository

**Files:**

- Create `relationship-copilot/src/domain/proposals/proposal-repository.ts`
- Create `relationship-copilot/src/infrastructure/supabase/supabase-proposal-repository.ts`
- Create `relationship-copilot/src/infrastructure/supabase/supabase-proposal-repository.test.ts`

**Step 1 (RED):** Contract-test create, pending list/count, get detail, edit with optimistic version, defer, and terminal transitions. Include cross-owner and stale-version cases.

**Step 2:** Run the contract test; expect failure.

**Step 3 (GREEN):** Implement queries scoped by owner and return typed conflict/not-found results.

**Step 4:** Run unit, database, and type checks.

**Step 5:** Commit `feat(copilot): add proposal repository`.

## Block 3: Atomic approval and rejection

### Success criteria

- [ ] Approval writes trusted data once, atomically.
- [ ] Retry returns the original result without duplicate people/interactions/reminders.
- [ ] Rejection never mutates trusted tables.

### Chunk 3.1: Write failing approval transaction tests

**Files:**

- Create `relationship-copilot/supabase/tests/0012_approve_proposal.test.sql`
- Create `relationship-copilot/src/application/proposals/approve-proposal.test.ts`

**Step 1 (RED):** Cover new person, existing person update, interaction creation, reminder draft creation, stale version, duplicate approval, partial failure rollback, and cross-owner attempt.

**Step 2:** Run database and focused unit tests; expect missing function/handler failures.

### Chunk 3.2: Implement the approval command

**Files:**

- Create `relationship-copilot/supabase/migrations/0011_approve_proposal.sql`
- Create `relationship-copilot/src/application/proposals/approve-proposal.ts`
- Modify tests from Chunk 3.1

**Step 1 (RED):** Keep retry/rollback tests failing.

**Step 2:** Verify expected failures.

**Step 3 (GREEN):** Add an owner-authorized database function that locks the proposal, checks version/status, applies edited-or-proposed values, writes the decision, and returns created IDs. Use a deterministic approval idempotency key.

**Step 4:** Run database, unit, and type checks.

**Step 5:** Commit `feat(copilot): approve proposals atomically`.

### Chunk 3.3: Implement rejection and deferral

**Files:**

- Create `relationship-copilot/src/application/proposals/reject-proposal.ts`
- Create `relationship-copilot/src/application/proposals/reject-proposal.test.ts`
- Create `relationship-copilot/src/application/proposals/defer-proposal.ts`
- Create `relationship-copilot/src/application/proposals/defer-proposal.test.ts`

**Step 1 (RED):** Test no trusted writes on rejection, optional reason, future-only deferral, idempotent retry, and terminal-state errors.

**Step 2:** Run focused tests; expect failure.

**Step 3 (GREEN):** Implement minimal commands and audit decisions.

**Step 4:** Run focused tests and database tests.

**Step 5:** Commit `feat(copilot): reject and defer proposals safely`.

## Block 4: Session-only proposal API

### Success criteria

- [ ] Every route requires a valid owner session.
- [ ] API errors are stable, typed, and do not reveal another user's record existence.
- [ ] Stale edits return a recoverable conflict rather than overwriting newer review work.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/proposals` | GET | Session only | List current owner's pending proposals |
| `/api/proposals` | POST | Session only | Create a structured manual proposal |
| `/api/proposals/[id]` | GET | Session only | Read owner proposal/evidence |
| `/api/proposals/[id]` | PATCH | Session only | Edit pending owner proposal at expected version |
| `/api/proposals/[id]/approve` | POST | Session only | Approve pending owner proposal |
| `/api/proposals/[id]/reject` | POST | Session only | Reject pending owner proposal |
| `/api/proposals/[id]/defer` | POST | Session only | Defer pending owner proposal |

Every route needs negative tests for anonymous access, another user's record, stale version, and unsupported method.

### Chunk 4.1: Create proposal API routes

**Files:**

- Create `relationship-copilot/src/app/api/proposals/route.ts`
- Create `relationship-copilot/src/app/api/proposals/route.test.ts`
- Create `relationship-copilot/src/app/api/proposals/[id]/route.ts`
- Create `relationship-copilot/src/app/api/proposals/[id]/route.test.ts`
- Create action route/test pairs under `approve/`, `reject/`, and `defer/`
- Create `relationship-copilot/src/application/proposals/create-manual-proposal.ts`

**Step 1 (RED):** Add route tests from the matrix using API-level source fixtures, not component mocks.

**Step 2:** Run route tests; expect missing-route failures.

**Step 3 (GREEN):** Implement Zod-validated session-only handlers that call application commands and map domain errors to stable HTTP errors.

**Step 4:** Run route, unit, database, and type checks.

**Step 5:** Commit `feat(copilot): expose session-only proposal API`.

## Block 5: Review queue and detail UI

### Success criteria

- [ ] Review list and count share the exact pending-query source.
- [ ] Detail shows source, proposed/edited values, and confidence without implying certainty.
- [ ] Approve/reject/defer decisions use explicit copy.
- [ ] Mobile and desktop states match the approved shape brief.

### Chunk 5.1: Build the review list from API fixtures

**Files:**

- Create `relationship-copilot/src/app/(app)/review/page.tsx`
- Create `relationship-copilot/src/app/(app)/review/loading.tsx`
- Create `relationship-copilot/src/app/(app)/review/error.tsx`
- Create `relationship-copilot/src/components/review/review-list.tsx`
- Create `relationship-copilot/src/components/review/review-list.test.tsx`
- Create `relationship-copilot/src/components/review/review-empty.tsx`

**Step 1 (RED):** Test default pending order, count, source labels, deferred exclusion, empty state, loading skeleton, and retryable error. Include a `deferred` fixture that a legacy `not approved` query would incorrectly include.

**Step 2:** Run focused component tests; expect failures.

**Step 3 (GREEN):** Implement the approved list shell with open rows, not a generic card grid.

**Step 4:** Run component tests and Playwright at 390 px and desktop widths.

**Step 5:** Commit `feat(copilot): add proposal review queue`.

### Chunk 5.2: Build field-level review detail

**Files:**

- Create `relationship-copilot/src/app/(app)/review/[id]/page.tsx`
- Create `relationship-copilot/src/components/review/proposal-review.tsx`
- Create `relationship-copilot/src/components/review/proposal-review.test.tsx`
- Create `relationship-copilot/src/components/review/source-evidence.tsx`
- Create `relationship-copilot/src/components/review/decision-bar.tsx`
- Create `relationship-copilot/e2e/proposal-review.spec.ts`

**Step 1 (RED):** Test editing before approval, provenance display, stale-version conflict, invalid field, reject confirmation, defer date copy, keyboard navigation, and completed state.

**Step 2:** Run focused and E2E tests; expect failure.

**Step 3 (GREEN):** Implement inline field editing and a persistent decision bar. Rejection copy must state that no profile data will be saved. Deferral copy must show the chosen date and that the proposal remains pending.

**Step 4:** Run component, accessibility, E2E, and type checks.

**Step 5:** Commit `feat(copilot): add sourced proposal review flow`.

## Reliability standards

- Database and API operations: 10-second server timeout.
- Optimistic edit conflicts return `409 proposal_version_conflict` and reload current values without dropping user edits.
- Async UI shows skeleton, retry, and persistent unsaved-edit indicators.
- Structured logs include proposal ID, owner ID, action, version, and error class; never source body or edited values.

## Technical debt strategy

- Manual structured proposal creation is intentionally a development/user fallback, not the final capture interface.
- Do not add LLM extraction in this phase.
- Do not duplicate proposal state in client-only stores.

## Final verification

Run all Phase 0 checks plus:

```bash
npm run test -- proposals review
npm run test:db
npm run test:e2e -- proposal-review
```

Ready to start building? Use `build`.
