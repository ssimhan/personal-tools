# Phase 8 Implementation Plan: Multi-User Private Beta

**Goal:** Make the relationship copilot safe, understandable, observable, recoverable, and supportable for invited users beyond Sandhya.

**Architecture:** Existing tenant boundaries remain authoritative. Private-beta onboarding uses database-backed invitations and per-user connector setup. Operations use structured redacted telemetry, health checks, bounded quotas, backup/restore procedures, and explicit data lifecycle controls.

**Design patterns:** Invite state machine, onboarding checklist, audit event, circuit breaker, rate limiter, privacy export/delete workflow, operational runbook.

**Tech stack:** Prior phases plus ADR-selected hosting, observability, error reporting, and backup services.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Production decisions gate

Before implementation, approve:

- `relationship-copilot/docs/architecture/ADR-009-hosting-and-operations.md`
- `relationship-copilot/docs/architecture/ADR-010-data-retention-and-deletion.md`
- `relationship-copilot/docs/architecture/ADR-011-beta-access-and-support.md`

These must name hosting/runtime, scheduler, domains, environments, secret management, observability, backups, retention periods, deletion SLA, invite policy, support owner, and incident escalation.

## Block 1: Exhaustive authorization and security audit

### Success criteria

- [ ] Every route/method has an explicit credential class and scope.
- [ ] Cross-tenant negative tests cover database, API, jobs, and connector callbacks.
- [ ] Secrets and sensitive content are absent from logs and client bundles.

### Chunk 1.1: Generate and enforce route authorization matrix

**Files:**

- Create `relationship-copilot/docs/security/route-authorization-matrix.md`
- Create `relationship-copilot/src/test/security/route-authorization.test.ts`
- Create `relationship-copilot/scripts/check-route-authorization.ts`

**Step 1 (RED):** Inventory every route and fail for any unclassified method. Credential classes: session-only, verified webhook, cron-only, OAuth callback, or unsupported.

**Step 2:** Run the checker; expect failures for missing classifications.

**Step 3 (GREEN):** Document every route/method and add metadata consumed by the checker.

**Step 4:** Run the checker and security tests.

**Step 5:** Commit `security(copilot): enforce route authorization matrix`.

### Chunk 1.2: Add least-privilege adversarial tests

**Files:**

- Create `relationship-copilot/src/test/security/cross-tenant-api.test.ts`
- Create `relationship-copilot/src/test/security/credential-scope.test.ts`
- Extend all Supabase RLS tests

**Step 1 (RED):** Test user A against every user B resource, webhook credentials against reads/mutations, cron against user routes, revoked OAuth tokens, object-ID guessing, stale signed states, and service-role repository calls missing owner ID.

**Step 2:** Run security suite; expect exposed gaps.

**Step 3 (GREEN):** Fix each gap without broadening credentials.

**Step 4:** Run security, database, and full suites.

**Step 5:** Commit `security(copilot): prove least-privilege isolation`.

### Chunk 1.3: Add rate limits and abuse controls

**Files:**

- Create `relationship-copilot/src/infrastructure/security/rate-limiter.ts`
- Create `relationship-copilot/src/infrastructure/security/rate-limiter.test.ts`
- Create `relationship-copilot/src/infrastructure/security/request-limits.ts`
- Add route tests for capture, import, sync, AI generation, and retries

**Step 1 (RED):** Test per-user and per-IP limits, webhook bypass only after valid signature, import size, AI budget, retry storm, and user-visible reset time.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement ADR-selected durable limiter and bounded request sizes.

**Step 4:** Run tests and burst simulation.

**Step 5:** Commit `security(copilot): add abuse and cost controls`.

## Block 2: Invitation and onboarding

### Success criteria

- [ ] Invited users onboard without database edits.
- [ ] Users understand what each connector reads and how approval works.
- [ ] Partial onboarding can resume safely.

### Chunk 2.1: Add invitation state machine

**Files:**

- Create `relationship-copilot/supabase/tests/0080_beta_invites.test.sql`
- Create `relationship-copilot/supabase/migrations/0080_beta_invites.sql`
- Create `relationship-copilot/src/domain/onboarding/beta-invite.ts`
- Create `relationship-copilot/src/domain/onboarding/beta-invite.test.ts`

**Step 1 (RED):** Test hashed token, expiry, one-time acceptance, email match, resend invalidation, revocation, and no invite-list disclosure.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Add `beta_invites` and minimal server-only invitation services.

**Step 4:** Run tests.

**Step 5:** Commit `feat(copilot): add secure beta invitations`.

### Chunk 2.2: Shape and build onboarding

**Precondition:** Run `/impeccable shape beta-onboarding` and approve the flow before code.

**Files:**

- Create `relationship-copilot/src/app/(onboarding)/welcome/page.tsx`
- Create `relationship-copilot/src/components/onboarding/onboarding-flow.tsx`
- Create `relationship-copilot/src/components/onboarding/onboarding-flow.test.tsx`
- Create `relationship-copilot/e2e/beta-onboarding.spec.ts`

**Step 1 (RED):** Test invite acceptance, product trust principle, WhatsApp/Google optional setup, skipped connector, permission copy, resume, failure, and completion.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Build a resumable checklist. Do not block product access on optional Granola/Slack/LinkedIn sources.

**Step 4:** Run accessibility, responsive, and E2E tests.

**Step 5:** Commit `feat(copilot): add trustworthy beta onboarding`.

## Block 3: Privacy, export, and deletion

### Success criteria

- [ ] Users can inspect connected sources and retained data.
- [ ] Export is complete and owner-scoped.
- [ ] Deletion revokes connections, cancels jobs, and erases owned data according to ADR-010.

### Chunk 3.1: Build data inventory and export

**Files:**

- Create `relationship-copilot/src/application/privacy/build-data-export.ts`
- Create `relationship-copilot/src/application/privacy/build-data-export.test.ts`
- Create `relationship-copilot/src/workers/build-data-export.ts`
- Create worker tests
- Create route/test pair under `src/app/api/account/export/`

**Step 1 (RED):** Test all owner tables, source evidence, audit decisions, connector metadata without secrets, large export pagination, duplicate request, expiry, cross-owner request, and signed download.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Generate an encrypted time-limited archive and notify the user without attaching sensitive data to email.

**Step 4:** Run tests and inspect a synthetic export.

**Step 5:** Commit `feat(copilot): export user relationship data`.

### Chunk 3.2: Implement account deletion workflow

**Files:**

- Create `relationship-copilot/src/application/privacy/delete-account.ts`
- Create `relationship-copilot/src/application/privacy/delete-account.test.ts`
- Create `relationship-copilot/src/workers/delete-account.ts`
- Create worker tests
- Create route/test pair under `src/app/api/account/delete/`

**Step 1 (RED):** Test explicit confirmation, cooling-off period if approved, connector revocation, job cancellation, source/trusted data deletion, audit tombstone policy, retry, partial provider failure, and cross-owner attempt.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement the ADR-010 lifecycle with user-visible progress and terminal confirmation.

**Step 4:** Run tests/database checks.

**Step 5:** Commit `feat(copilot): delete accounts and connected data safely`.

### Chunk 3.3: Add privacy settings UI

**Files:**

- Create `relationship-copilot/src/app/(app)/settings/privacy/page.tsx`
- Create `relationship-copilot/src/components/privacy/data-controls.tsx`
- Create component tests and `e2e/privacy-controls.spec.ts`

**Step 1 (RED):** Test source inventory, retention explanation, export progress, delete decision copy, irreversible boundary, connection revoke, and mobile accessibility.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement explicit controls with no dark patterns.

**Step 4:** Run accessibility/E2E tests.

**Step 5:** Commit `feat(copilot): add user data controls`.

## Block 4: Observability and connector health

### Success criteria

- [ ] Operators see failure rates without seeing relationship content.
- [ ] Users see connection-specific recovery actions.
- [ ] Alerts have owners and runbooks.

### Chunk 4.1: Add redacted structured telemetry

**Files:**

- Create `relationship-copilot/src/infrastructure/observability/logger.ts`
- Create `relationship-copilot/src/infrastructure/observability/logger.test.ts`
- Create `relationship-copilot/src/infrastructure/observability/metrics.ts`
- Create telemetry redaction tests

**Step 1 (RED):** Test redaction of tokens, emails, message bodies, notes, prompts, generated text, and provider payloads while retaining IDs, durations, status, and error class.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement ADR-selected logging/tracing/metrics adapters.

**Step 4:** Run redaction and bundle checks.

**Step 5:** Commit `ops(copilot): add privacy-safe telemetry`.

### Chunk 4.2: Build connector health model and UI

**Files:**

- Create `relationship-copilot/src/application/connections/get-connection-health.ts`
- Create corresponding tests
- Create `relationship-copilot/src/components/connections/connection-health-list.tsx`
- Create component/E2E tests

**Step 1 (RED):** Test healthy, delayed, rate-limited, expired, revoked, provider outage, dead-letter jobs, last success, reconnect/retry action, and owner isolation.

**Step 2:** Run tests; expect failure.

**Step 3 (GREEN):** Implement consistent health states across providers.

**Step 4:** Run tests/E2E.

**Step 5:** Commit `ops(copilot): expose connector health and recovery`.

### Chunk 4.3: Add alerts and runbooks

**Files:**

- Create `relationship-copilot/docs/runbooks/webhook-failures.md`
- Create `relationship-copilot/docs/runbooks/oauth-revocation.md`
- Create `relationship-copilot/docs/runbooks/job-backlog.md`
- Create `relationship-copilot/docs/runbooks/provider-outage.md`
- Create `relationship-copilot/scripts/verify-runbook-links.ts`

**Non-code chunk:** No failing product test. Add a failing link/owner checker first, then make it pass.

**Steps:**

1. Define alert thresholds, owner, first diagnostic, safe retry, and user communication for each failure class.
2. Link alert names to runbooks.
3. Run the checker.
4. Commit `docs(copilot): add operational runbooks`.

## Block 5: Backup, restore, load, and recovery

### Success criteria

- [ ] A synthetic backup restores with tenant boundaries intact.
- [ ] Recovery procedures are repeatable and owned.
- [ ] Private-beta load budgets pass under provider-fake traffic.

### Chunk 5.1: Prove backup and restore

**Files:**

- Create `relationship-copilot/docs/runbooks/backup-restore.md`
- Create `relationship-copilot/scripts/verify-backup-restore.sh`
- Create synthetic restore assertions under `relationship-copilot/src/test/recovery/`

**Step 1 (RED):** Restore a synthetic backup into an isolated environment and assert people, interactions, proposals, evidence, reminders, connections without secrets, and tenant boundaries.

**Step 2:** Run verification; expect failure until procedure is complete.

**Step 3 (GREEN):** Implement ADR-009 backup/restore procedure and document recovery-time/recovery-point observations.

**Step 4:** Run the drill twice, including an interrupted restore.

**Step 5:** Commit `ops(copilot): verify backup and restore`.

### Chunk 5.2: Add load and failure tests

**Files:**

- Create `relationship-copilot/load/webhook-ingestion.js`
- Create `relationship-copilot/load/review-queue.js`
- Create `relationship-copilot/load/job-runner.js`
- Create `relationship-copilot/docs/performance/beta-budget.md`

**Step 1 (RED):** Define beta budgets for webhook acknowledgment, review-list p95, job backlog drain, database connections, and error rate; run baseline and record failures.

**Step 2:** Confirm at least one budget fails or lacks evidence.

**Step 3 (GREEN):** Fix bottlenecks, add indexes/batch tuning, and preserve idempotency under concurrency.

**Step 4:** Run load tests with synthetic data and provider fakes.

**Step 5:** Commit `perf(copilot): meet private-beta budgets`.

## Block 6: End-to-end beta acceptance

### Success criteria

- [ ] Critical journeys pass for two isolated users on mobile and desktop.
- [ ] Accessibility and design audits have no release-blocking findings.
- [ ] Every enabled provider completes one sandbox live test and has a runbook.

### Chunk 6.1: Build full journey tests

**Files:**

- Create `relationship-copilot/e2e/journeys/whatsapp-to-review.spec.ts`
- Create `relationship-copilot/e2e/journeys/google-to-proposal.spec.ts`
- Create `relationship-copilot/e2e/journeys/reminder-to-complete.spec.ts`
- Create `relationship-copilot/e2e/journeys/cross-tenant-isolation.spec.ts`

**Step 1 (RED):** Write synthetic full journeys with provider fakes and two users; expect missing integration/failure-state gaps.

**Step 2:** Run E2E; record failures.

**Step 3 (GREEN):** Fix integration gaps only, without weakening domain tests.

**Step 4:** Run all journeys at mobile and desktop sizes.

**Step 5:** Commit `test(copilot): cover private-beta journeys`.

### Chunk 6.2: Final design and accessibility QA

**Precondition:** Use `/impeccable audit` and `/impeccable polish` on onboarding, Review, Today, person memory, reminders, connections, and privacy surfaces.

**Files:** Modify only issues found by the audit; update `relationship-copilot/docs/BUGS.md` for deferred findings.

**Steps:**

1. Run automated accessibility, keyboard, screen-reader labeling, contrast, responsive, reduced-motion, and offline/error checks.
2. Verify Warm + Quiet consistency and standard component vocabulary.
3. Fix release-blocking issues with failing regression tests first.
4. Log non-blocking polish debt explicitly.
5. Commit `fix(copilot): close private-beta quality gaps`.

## Production standards

- All external timeouts and retry limits from prior phases remain enforced.
- Feature flags can disable each connector and outbound notification path independently.
- Secrets use managed production storage and documented rotation.
- Production database access is audited; no routine manual service-role queries.
- Privacy-sensitive telemetry has retention and access controls.
- Beta invitations have a documented cap and support owner.

## Technical debt strategy

- No open P0/P1 security, data-loss, tenant-isolation, or approval-integrity debt at launch.
- P2 polish/performance issues require an owner and target date in `docs/BUGS.md`.
- Team collaboration, shared contacts, network graphs, and automatic LinkedIn monitoring remain out of scope.

## Final verification

Required before first external invite:

```bash
npm run check
npm run test:db
npm run test:e2e
npm run test:security
npm run test:load
npm run test:recovery
```

Also complete one sandbox live test for every enabled provider and one operator incident drill.

Ready to start building? Use `build`.
