# Phase 7 Implementation Plan: Proactive Attention and LinkedIn Batch Import

**Goal:** Build an explainable relationship-attention queue from trusted interaction history and let users add LinkedIn contacts in reviewed batches without scraping or silently trusting imported facts.

**Architecture:** A deterministic scoring projection turns approved interactions, explicit follow-ups, and approved external signals into user-owned attention items. LinkedIn CSV/manual imports enter through the existing import and proposal pipelines. Automated job/post monitoring remains behind a future compliant-provider gate.

**Design patterns:** Explainable scoring policy, derived projection, source-weighted signal, batch import, duplicate-resolution workflow, dismiss/snooze state machine.

**Tech stack:** Phase 6 stack; no LinkedIn SDK is required for batch import.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Product and compliance gates

- Run `/impeccable shape today-attention-queue` before Block 4. The shape must cover reason/explanation, urgency without guilt language, snooze/dismiss, empty/loading/error, and Warm + Quiet mobile/desktop behavior.
- Record `relationship-copilot/docs/architecture/ADR-007-attention-model.md` after evaluating the proposed v1 scoring policy below against realistic fixtures.
- Do not scrape LinkedIn pages or messages. Official APIs for other members' profile/connection data are restricted and subject to storage limits.
- Automated job changes and posts require a separately approved compliant data provider and are not required for this phase's exit gate.

## Proposed v1 attention policy

Use transparent rules rather than an opaque model:

1. Explicit approved follow-ups become due attention items at their reminder time.
2. For inferred relationship rhythm, use up to the six most recent meaningful interaction gaps.
3. With three or more meaningful interactions, expected interval is the median gap clamped to 14–180 days.
4. With fewer than three meaningful interactions, use a 90-day default but label the reason as low-confidence.
5. Relationship strength is derived only from approved meaningful interaction count and recency, never channel co-membership.
6. An approved job/post signal can surface a person but must explain the source and date.

The ADR may adjust constants before implementation, but tests must lock the approved formula.

## Block 1: Signal and attention schema

### Success criteria

- [ ] Signals preserve source/provenance.
- [ ] Attention items are derived, explainable, and user-owned.
- [ ] Snooze/dismiss does not rewrite relationship history.

### Chunk 1.1: Add failing attention schema tests

**Files:**

- Create `relationship-copilot/supabase/tests/0070_attention.test.sql`

**Step 1 (RED):** Test source-linked signals, one active attention item per person/reason, explanation payload, eligible time, score bounds, snooze/dismiss state, and tenant isolation.

**Step 2:** Run database tests; expect missing-schema failures.

### Chunk 1.2: Create signal and attention tables

**Files:**

- Create `relationship-copilot/supabase/migrations/0070_attention.sql`
- Modify `relationship-copilot/supabase/tests/0070_attention.test.sql`

**Step 1 (RED):** Add negative tests for cross-owner source links and direct client score mutation.

**Step 2:** Verify failures.

**Step 3 (GREEN):** Add:

- `relationship_signals(id, owner_id, person_id, type, source_record_id nullable, occurred_at, payload, status, approved_at)`
- `attention_items(id, owner_id, person_id, reason_type, reason_key, eligible_at, score, explanation, status, snoozed_until, dismissed_at, projection_version, timestamps)`

Allow only server-side projection functions to set score/explanation. Add owner-only read and action policies.

**Step 4:** Run database tests.

**Step 5:** Commit `feat(copilot): add proactive attention projections`.

## Block 2: Explainable relationship scoring

### Success criteria

- [ ] Scoring uses approved data only.
- [ ] Every item has a human-readable reason.
- [ ] Reprojection is deterministic and idempotent.

### Chunk 2.1: Infer relationship rhythm

**Files:**

- Create `relationship-copilot/src/domain/attention/infer-relationship-rhythm.ts`
- Create `relationship-copilot/src/domain/attention/infer-relationship-rhythm.test.ts`

**Step 1 (RED):** Test 0–2 interactions, median of 3–6 gaps, 14/180-day clamps, identical timestamps, future timestamps, timezone boundaries, and non-meaningful interaction exclusion.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement the ADR-approved deterministic policy and confidence label.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): infer relationship rhythm`.

### Chunk 2.2: Rank attention reasons

**Files:**

- Create `relationship-copilot/src/domain/attention/score-attention.ts`
- Create `relationship-copilot/src/domain/attention/score-attention.test.ts`
- Create `relationship-copilot/src/application/attention/reproject-person-attention.ts`
- Create `relationship-copilot/src/application/attention/reproject-person-attention.test.ts`

**Step 1 (RED):** Test explicit follow-up precedence, overdue rhythm, approved job/post signal, multiple reasons, stale signal, rejected proposal exclusion, duplicate reprojection, and stable tie-break.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement score and explanation with `projection_version` and stable ordering.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): rank explainable attention items`.

### Chunk 2.3: Reproject on trusted events

**Files:**

- Create `relationship-copilot/src/workers/reproject-attention.ts`
- Create `relationship-copilot/src/workers/reproject-attention.test.ts`
- Modify approval/reminder/signal commands to enqueue reprojection jobs

**Step 1 (RED):** Test interaction approval, reminder completion, new signal approval, rejected proposal, duplicate job, and full rebuild.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Enqueue one idempotent reprojection per person/version and provide a bounded full-rebuild maintenance job.

**Step 4:** Run tests/database checks.

**Step 5:** Commit `feat(copilot): keep attention projections current`.

## Block 3: LinkedIn batch import

### Success criteria

- [ ] User-provided rows create proposals, not trusted profiles.
- [ ] Duplicate candidates are explicit and reviewable.
- [ ] Unsupported exports fail with actionable errors.

### Chunk 3.1: Define LinkedIn import format

**Files:**

- Create `relationship-copilot/src/infrastructure/linkedin/linkedin-csv-parser.ts`
- Create `relationship-copilot/src/infrastructure/linkedin/linkedin-csv-parser.test.ts`
- Create fixtures under `relationship-copilot/src/test/fixtures/linkedin/`
- Create `relationship-copilot/docs/imports/linkedin-format.md`

**Step 1 (RED):** Test supported user export/custom template headers, profile URL normalization, missing names, duplicate URLs, Unicode, malformed URLs, quoted newlines, formula injection, and extra columns.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Parse name, profile URL, company/title when present, and source date. Reject rather than guess unsupported fields.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): parse reviewed LinkedIn batches`.

### Chunk 3.2: Create proposals and duplicate candidates

**Files:**

- Create `relationship-copilot/src/application/linkedin/import-linkedin-batch.ts`
- Create `relationship-copilot/src/application/linkedin/import-linkedin-batch.test.ts`
- Create `relationship-copilot/src/app/api/imports/linkedin/route.ts`
- Create `relationship-copilot/src/app/api/imports/linkedin/route.test.ts`
- Create `relationship-copilot/src/workers/process-linkedin-import.ts`
- Create worker tests

**Step 1 (RED):** Test exact URL match, exact approved email if present, ambiguous name/company, new person, duplicate row, rerun, partial failure, owner isolation, and source evidence.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Reuse the Phase 5 import-batch infrastructure and Phase 1 proposal flow.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): propose LinkedIn batch updates`.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/imports/linkedin` | POST | Session only | Upload owner batch |
| `/api/imports/linkedin/[id]` | GET | Session only | Read owner batch status |
| `/api/attention` | GET | Session only | List active owner items |
| `/api/attention/[id]/snooze` | POST | Session only | Snooze owner item |
| `/api/attention/[id]/dismiss` | POST | Session only | Dismiss owner item |

## Block 4: Today attention queue

### Success criteria

- [ ] Today and its visible count share the exact eligibility predicate.
- [ ] Every item explains why the person surfaced and the confidence level.
- [ ] Snooze and dismiss affect only attention state, not trusted history.

The user-facing label `Today` maps to `attention_items.status = 'active' AND eligible_at <= now() AND (snoozed_until IS NULL OR snoozed_until <= now())`, ordered by score descending, then eligible time ascending, then ID. The visible count must use the same predicate.

### Chunk 4.1: Build Today list

**Files:**

- Create `relationship-copilot/src/app/(app)/today/page.tsx`
- Create `relationship-copilot/src/app/(app)/today/loading.tsx`
- Create `relationship-copilot/src/app/(app)/today/error.tsx`
- Create `relationship-copilot/src/components/attention/attention-list.tsx`
- Create `relationship-copilot/src/components/attention/attention-list.test.tsx`
- Create `relationship-copilot/e2e/today-attention.spec.ts`

**Step 1 (RED):** Test reason/explanation, score ordering, snoozed exclusion, dismissed exclusion, low-confidence rhythm label, source link, empty/loading/error, and responsive behavior. Include a future/snoozed fixture that a legacy `status=active` query would incorrectly include.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement the approved open-list shape using considerate copy such as “worth tending,” not guilt language.

**Step 4:** Run accessibility, responsive E2E, and visual checks.

**Step 5:** Commit `feat(copilot): add explainable Today queue`.

### Chunk 4.2: Add attention actions

**Files:**

- Create `relationship-copilot/src/application/attention/update-attention-item.ts`
- Create corresponding domain/API/component tests
- Modify Today list/action components

**Step 1 (RED):** Test snooze duration/date copy, dismiss irreversibility within the current signal, duplicate action, resurfacing on a new reason, and cross-owner attempt.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement explicit actions. Dismiss closes only that reason key; a genuinely new source signal may create a new item.

**Step 4:** Run tests/E2E.

**Step 5:** Commit `feat(copilot): manage proactive attention items`.

## Block 5: Future job/post signal port

### Success criteria

- [ ] The domain can accept compliant future signals without knowing a provider.
- [ ] No production LinkedIn scraper or unsupported adapter is introduced.
- [ ] Provider selection remains an explicit future ADR.

### Chunk 5.1: Define but do not fake provider access

**Files:**

- Create `relationship-copilot/src/application/signals/professional-signal-source.ts`
- Create `relationship-copilot/src/application/signals/professional-signal-source.contract.test.ts`
- Create `relationship-copilot/src/test/fakes/fake-professional-signal-source.ts`
- Create `relationship-copilot/docs/architecture/ADR-008-professional-signals.md`

**Step 1 (RED):** Contract-test source attribution, occurred date, job/post type, canonical URL, duplicate external ID, deletion, timeout, and revocation.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Define the port and fake for attention-engine tests. ADR-008 records that no production provider is selected.

**Step 4:** Run tests.

**Step 5:** Commit `docs(copilot): define compliant professional signal boundary`.

Do not create a production scraper or LinkedIn adapter in this phase.

## Reliability standards

- Attention reprojection is idempotent and bounded to 100 people/job by default.
- Import parsing is streaming/bounded; files are deleted after terminal processing.
- Never log imported profile data or signal text.
- Scoring changes require a projection-version bump and full rebuild test.

## Technical debt strategy

- The v1 scoring formula is intentionally transparent and simple; evaluate with real use before machine learning.
- Automated LinkedIn job/post monitoring remains blocked pending a compliant source.
- Network graph and introduction ledger remain future roadmap candidates.

## Final verification

Run all previous checks plus rhythm/scoring golden fixtures, reprojection, LinkedIn import, Today queue/action, responsive E2E, and a full projection rebuild.

Ready to start building? Use `build`.
