# Phase 5 Implementation Plan: Granola Meeting Context

**Goal:** Match Granola notes to Google Calendar meetings and create sourced proposals for attendee context, topics, commitments, and follow-ups without treating unreviewed notes or transcripts as trusted memory.

**Architecture:** A provider-neutral `MeetingNotesSource` port supports an official Granola API adapter when the user's plan permits it and a CSV import adapter otherwise. Both produce normalized meeting-note records that match existing calendar source records before proposal creation.

**Design patterns:** Capability-gated adapter, anti-corruption layer, import batch, deterministic event matching, human-in-the-loop ambiguity resolution.

**Tech stack:** Phase 4 stack plus official Granola API access if available; standards-compliant CSV parsing as fallback.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Feasibility gate

Before API implementation:

1. Confirm the target Granola account plan and official API access. Granola documents custom API access for Business and Enterprise plans.
2. Obtain the official API schema, authentication method, rate limits, and webhook/polling guidance.
3. If API access is unavailable, approve CSV import as the Phase 5 production path. Granola's historical CSV export includes note metadata/summaries but not bulk transcripts.
4. Record the decision in `relationship-copilot/docs/architecture/ADR-005-granola-source.md`.
5. Do not scrape the Granola desktop app, local cache, or authenticated web UI.

## Required configuration

- `RUN_GRANOLA_LIVE_TESTS=0`
- `GRANOLA_API_BASE_URL` only if documented by the official API

Personal API keys belong in encrypted per-user connection secrets. CSV imports never persist the source file after processing unless the user explicitly requests retention.

## Block 1: Normalized meeting-note contract

### Success criteria

- [ ] API and CSV paths produce the same normalized record.
- [ ] Full transcripts are not required or stored.
- [ ] Invalid or oversized content fails safely.

### Chunk 1.1: Define `MeetingNotesSource`

**Files:**

- Create `relationship-copilot/src/application/meeting-notes/meeting-notes-source.ts`
- Create `relationship-copilot/src/application/meeting-notes/meeting-notes-source.contract.test.ts`
- Create `relationship-copilot/src/domain/meeting-notes/meeting-note.ts`
- Create `relationship-copilot/src/domain/meeting-notes/meeting-note.test.ts`
- Create `relationship-copilot/src/test/fakes/fake-meeting-notes-source.ts`

**Step 1 (RED):** Test title, start/end, attendees, summary, topics, commitments, follow-ups, source URL, external ID, optional transcript availability flag, and size limits.

**Step 2:** Run tests; expect missing implementation.

**Step 3 (GREEN):** Define the normalized type, validation, pagination contract, and deterministic fake.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): define meeting notes source contract`.

## Block 2: CSV fallback import

### Success criteria

- [ ] Official Granola CSV exports import idempotently.
- [ ] Malformed rows are reported without losing valid rows.
- [ ] Files are deleted after processing.

### Chunk 2.1: Parse Granola CSV safely

**Files:**

- Create `relationship-copilot/src/infrastructure/granola/granola-csv-parser.ts`
- Create `relationship-copilot/src/infrastructure/granola/granola-csv-parser.test.ts`
- Create fixtures under `relationship-copilot/src/test/fixtures/granola/csv/`

**Step 1 (RED):** Test current headers, reordered headers, missing summary, quoted newlines, Unicode, duplicate note, malformed date, oversized field, and formula-injection text.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement streaming/bounded parsing and neutralize formula-prefixed values in any generated error export.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): parse Granola exports safely`.

### Chunk 2.2: Add import batch schema and route

**Files:**

- Create `relationship-copilot/supabase/tests/0050_import_batches.test.sql`
- Create `relationship-copilot/supabase/migrations/0050_import_batches.sql`
- Create `relationship-copilot/src/app/api/imports/granola/route.ts`
- Create `relationship-copilot/src/app/api/imports/granola/route.test.ts`
- Create `relationship-copilot/src/workers/process-granola-import.ts`
- Create `relationship-copilot/src/workers/process-granola-import.test.ts`

**Step 1 (RED):** Test session-only upload, MIME/size limits, owner isolation, batch progress, duplicate file hash, partial row errors, deletion after processing, and retry.

**Step 2:** Run route/database tests; expect failure.

**Step 3 (GREEN):** Add `import_batches` and `import_row_errors`; stream the file to a private temporary object, enqueue processing, then delete it on terminal success/failure.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): import Granola summaries in batches`.

## Block 3: Official API adapter, capability-gated

### Success criteria

- [ ] The official adapter is built only when entitlement and documentation are confirmed.
- [ ] API and CSV records satisfy the same contract.
- [ ] Revocation and rate limits produce recoverable connection states.

### Chunk 3.1: Implement the official adapter

**Files:**

- Create `relationship-copilot/src/infrastructure/granola/granola-api-client.ts`
- Create `relationship-copilot/src/infrastructure/granola/granola-api-client.test.ts`
- Create recorded safe fixtures from official sandbox responses
- Modify connection settings/API routes for `granola`

**Step 1 (RED):** Based on ADR-005, test authentication, pagination, updated-since cursor, rate limit, timeout, revoked key, deleted note, and unsupported transcript access.

**Step 2:** Run offline tests; expect failure.

**Step 3 (GREEN):** Implement only documented endpoints with a 15-second page timeout and encrypted personal key storage.

**Step 4:** Run contract tests; live test only with `RUN_GRANOLA_LIVE_TESTS=1`.

**Step 5:** Commit `feat(copilot): sync Granola notes through official API`.

If ADR-005 selects CSV-only, mark this chunk `not applicable` with the reason and do not create placeholder production code.

## Block 4: Calendar matching and proposal creation

### Success criteria

- [ ] Exact matches link automatically as proposals.
- [ ] Ambiguous matches require review.
- [ ] Every attendee receives a proposed update, never an automatic profile mutation.

### Chunk 4.1: Match note to calendar event

**Files:**

- Create `relationship-copilot/src/domain/meeting-notes/match-calendar-event.ts`
- Create `relationship-copilot/src/domain/meeting-notes/match-calendar-event.test.ts`

**Step 1 (RED):** Test external event ID, exact time/title, timezone variation, rescheduled meeting, recurring instance, attendee overlap, two plausible events, and no match.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Return exact, ambiguous, or unmatched with reason codes. Only exact matches proceed automatically to proposal generation.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): match Granola notes to meetings`.

### Chunk 4.2: Generate attendee proposals

**Files:**

- Create `relationship-copilot/src/application/meeting-notes/create-meeting-proposals.ts`
- Create `relationship-copilot/src/application/meeting-notes/create-meeting-proposals.test.ts`
- Create `relationship-copilot/src/workers/sync-granola.ts`
- Create `relationship-copilot/src/workers/sync-granola.test.ts`

**Step 1 (RED):** Test all human attendees under 15, self/resource exclusion, duplicate attendee identity, summary/topics/commitments evidence, follow-up proposal, duplicate note, and ambiguous event.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Persist a Granola source record and create one linked proposal per attendee. Keep shared meeting context sourced once and referenced by each proposal.

**Step 4:** Run tests/database checks.

**Step 5:** Commit `feat(copilot): propose Granola meeting context`.

## Block 5: Import/connection UI

### Success criteria

- [ ] The UI presents only capabilities available to the user's plan.
- [ ] Import progress and row errors are recoverable and owner-scoped.
- [ ] Users are not led to believe bulk transcripts were imported.

### Authorization matrix

| Route | Method | Credential | Permission |
|---|---|---|---|
| `/api/imports/granola` | POST | Session only | Upload owner's supported CSV |
| `/api/imports/granola/[id]` | GET | Session only | Read owner batch status/errors |
| `/api/connections/granola` | POST | Session only | Connect owner API key when supported |
| `/api/connections/granola` | DELETE | Session only | Revoke owner key |
| `/api/connections/granola/sync` | POST | Session only | Enqueue owner sync |

### Chunk 5.1: Build Granola setup surface

**Files:**

- Create `relationship-copilot/src/components/connections/granola-connection.tsx`
- Create `relationship-copilot/src/components/connections/granola-connection.test.tsx`
- Create `relationship-copilot/src/components/imports/granola-import.tsx`
- Create `relationship-copilot/src/components/imports/granola-import.test.tsx`
- Create `relationship-copilot/e2e/granola-import.spec.ts`

**Step 1 (RED):** Test API available/unavailable, plan explanation, CSV upload/progress/errors, retry, revoke, duplicate import, and empty result using API fixtures.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement the selected capability path without implying transcript access when unavailable.

**Step 4:** Run accessibility/E2E tests.

**Step 5:** Commit `feat(copilot): add Granola import and connection flow`.

## Reliability standards

- Granola API page timeout: 15 seconds; max five transient retries respecting provider limits.
- CSV upload limit and row count must be documented after measuring official exports; start conservatively and expose a clear error.
- Never log note summaries, commitments, attendee emails, or API keys.
- Live tests require a dedicated non-sensitive Granola workspace and explicit flag.

## Technical debt strategy

- Transcript ingestion is out of scope unless a later approved design defines retention and consent.
- Unmatched notes remain visible for manual resolution; do not fuzzy-link silently.
- API polling/webhooks depend entirely on official capability and must not be simulated with scraping.

## Final verification

Run all previous checks plus CSV parser/import, event matching, proposal fan-out, connection/import E2E, and optional official sandbox contract tests.

Ready to start building? Use `build`.
