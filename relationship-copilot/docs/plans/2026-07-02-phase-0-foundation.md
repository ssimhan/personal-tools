# Phase 0 Implementation Plan: Clean Foundation and Tenant Boundary

**Goal:** Create a new, tested `relationship-copilot/` application with secure authentication, a user-owned core data model, tenant-isolating RLS, CI, and explicit selective-reuse boundaries.

**Architecture:** Next.js App Router application backed by Supabase Auth/Postgres. Browser requests use the signed-in user's RLS-bound client. Background and webhook code may use a service-role client only through services that require an explicit `ownerId` and never infer a canonical owner.

**Design patterns:** Clean domain boundaries, repository interfaces, dependency injection for clocks/IDs/external adapters, server-side session resolver, deny-by-default RLS.

**Tech stack:** Next.js, React, TypeScript, Tailwind CSS, Supabase, Vitest, Testing Library, Playwright, Supabase CLI/pgTAP, ESLint.

**Approved source:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Preconditions

- Confirm whether any real CRM database contains data that must be migrated. If yes, stop and add a migration/export plan before schema work.
- Choose supported Node and package-manager versions and commit them in `.nvmrc` and `packageManager`.
- Keep `crm-claude-build-personal-crm-V9261/` unchanged as a reference.

## Block 1: Product context and clean scaffold

### Success criteria

- [x] New app runs independently from the legacy folder.
- [x] Test, typecheck, lint, build, and E2E scripts exist.
- [x] Product and design context point back to the approved discovery baseline.
- [x] Secret files and generated Supabase state are ignored.

### Chunk 1.1: Scaffold the application and test harness

**Files:**

- Create `relationship-copilot/package.json`
- Create `relationship-copilot/.nvmrc`
- Create `relationship-copilot/tsconfig.json`
- Create `relationship-copilot/next.config.ts`
- Create `relationship-copilot/vitest.config.ts`
- Create `relationship-copilot/playwright.config.ts`
- Create `relationship-copilot/src/test/setup.ts`
- Create `relationship-copilot/src/app/page.test.tsx`
- Create `relationship-copilot/src/app/page.tsx`

**Step 1 (RED):** Add a page test expecting the product name and a sign-in affordance before the page exists.

**Step 2:** Run `npm test -- --run src/app/page.test.tsx`; expect module/page failure.

**Step 3 (GREEN):** Add the minimal app shell and scripts: `test`, `test:watch`, `test:e2e`, `test:db`, `typecheck`, `lint`, and `build`.

**Step 4:** Run `npm test -- --run`, `npm run typecheck`, and `npm run build`; expect all to pass.

**Step 5:** Commit `chore(copilot): scaffold tested application shell`.

### Chunk 1.2: Capture durable product and design context

**Files:**

- Create `relationship-copilot/PRODUCT.md`
- Create `relationship-copilot/DESIGN.md`
- Create `relationship-copilot/docs/architecture/ADR-001-clean-shell-selective-reuse.md`
- Create `relationship-copilot/docs/architecture/reuse-audit.md`

**Non-code chunk:** No failing test required.

**Steps:**

1. Convert the approved discovery baseline into concise product principles without inventing unresolved behavior.
2. Record Warm + Quiet as a direction, not a completed UI shape.
3. Record the clean-shell/selective-reuse decision and rejected alternatives.
4. Inventory legacy candidates: person/interaction schema concepts, RLS policies, identity helpers, name/email utilities, import parsing, and summary prompts.
5. Mark each candidate `reuse`, `rewrite`, or `reference only`, with coupling and test requirements.
6. Commit `docs(copilot): record product context and reuse boundaries`.

## Block 2: Local Supabase and core schema

### Success criteria

- [x] Local Supabase starts from committed configuration.
- [x] `user_profiles`, `people`, `person_channels`, and `interactions` are user-owned.
- [x] Cross-user reads and writes fail under RLS.
- [x] Service-role repositories require an explicit owner.

### Chunk 2.1: Add the local database harness

**Files:**

- Create `relationship-copilot/supabase/config.toml`
- Create `relationship-copilot/supabase/seed.sql`
- Create `relationship-copilot/supabase/tests/helpers.sql`
- Create `relationship-copilot/supabase/tests/0001_core_schema.test.sql`

**Step 1 (RED):** Write pgTAP assertions for required tables, owner foreign keys, unique constraints, and timestamps.

**Step 2:** Run `npm run test:db`; expect missing-schema failures.

**Step 3 (GREEN):** Add the minimum local Supabase configuration and an empty seed strategy.

**Step 4:** Re-run `npm run test:db`; schema assertions should still fail only because the migration is absent.

**Step 5:** Commit with Chunk 2.2 after the migration turns the tests green.

### Chunk 2.2: Create the user-owned core migration

**Files:**

- Create `relationship-copilot/supabase/migrations/0001_core.sql`
- Modify `relationship-copilot/supabase/tests/0001_core_schema.test.sql`

**Step 1 (RED):** Extend tests to require RLS on every table and indexes beginning with `owner_id` for owner-scoped queries.

**Step 2:** Run `npm run test:db`; expect missing-table/policy failures.

**Step 3 (GREEN):** Create:

- `user_profiles(id references auth.users)`
- `people(id, owner_id, display_name, company, relationship_summary, notes, timestamps)`
- `person_channels(id, owner_id, person_id, type, value, normalized_value, last_meaningful_at)`
- `interactions(id, owner_id, person_id, type, occurred_at, summary, source_record_id nullable, timestamps)`

Enable RLS and add owner-only select/insert/update/delete policies. Do not create canonical-owner configuration.

**Step 4:** Run `npm run test:db`; expect all schema assertions to pass.

**Step 5:** Commit `feat(copilot): add tenant-isolated core schema`.

### Chunk 2.3: Prove tenant isolation negatively

**Files:**

- Create `relationship-copilot/supabase/tests/0002_core_rls.test.sql`

**Step 1 (RED):** Seed two auth users and write tests that user A cannot select, update, delete, or attach a channel or interaction to user B's person.

**Step 2:** Run `npm run test:db`; expect at least one negative assertion to expose any incomplete policy.

**Step 3 (GREEN):** Tighten policies, foreign-key ownership checks, and security-definer functions until all cross-tenant attempts fail.

**Step 4:** Run `npm run test:db`; expect all positive-owner and negative-cross-owner tests to pass.

**Step 5:** Commit `test(copilot): enforce cross-tenant isolation`.

## Block 3: Domain and repository boundaries

### Success criteria

- [x] Domain objects reject invalid identity and channel states.
- [x] Repositories always scope by owner.
- [x] No route imports a service-role client directly.

### Chunk 3.1: Define core domain types

**Files:**

- Create `relationship-copilot/src/domain/people/person.ts`
- Create `relationship-copilot/src/domain/people/person.test.ts`
- Create `relationship-copilot/src/domain/interactions/interaction.ts`
- Create `relationship-copilot/src/domain/interactions/interaction.test.ts`
- Create `relationship-copilot/src/domain/shared/result.ts`

**Step 1 (RED):** Test trimmed names, supported channel types, immutable owner IDs, source-safe interaction summaries, and invalid timestamps.

**Step 2:** Run the focused Vitest files; expect missing-module failures.

**Step 3 (GREEN):** Implement minimal constructors/parsers returning typed results rather than throwing for user input errors.

**Step 4:** Run focused tests and `npm run typecheck`; expect pass.

**Step 5:** Commit `feat(copilot): define person and interaction domains`.

### Chunk 3.2: Add owner-scoped repositories

**Files:**

- Create `relationship-copilot/src/domain/people/person-repository.ts`
- Create `relationship-copilot/src/infrastructure/supabase/supabase-person-repository.ts`
- Create `relationship-copilot/src/infrastructure/supabase/supabase-person-repository.test.ts`
- Create `relationship-copilot/src/infrastructure/supabase/server-client.ts`
- Create `relationship-copilot/src/infrastructure/supabase/admin-client.ts`

**Step 1 (RED):** Contract-test create/get/list/update so every call requires `ownerId`, and user A receives `not_found` for user B's ID.

**Step 2:** Run the repository test; expect missing implementation failure.

**Step 3 (GREEN):** Implement an RLS-bound repository and an admin-backed job repository that still adds `.eq("owner_id", ownerId)` to every query.

**Step 4:** Run unit, database, and type checks.

**Step 5:** Commit `feat(copilot): add owner-scoped repositories`.

## Block 4: Authentication and authorization

### Success criteria

- [x] Signed-out users cannot access app routes.
- [x] Signed-in users resolve only their own owner ID.
- [x] No allowlist, canonical owner, or global bearer key exists.

### Chunk 4.1: Add session resolution

**Files:**

- Create `relationship-copilot/src/infrastructure/auth/require-user.ts`
- Create `relationship-copilot/src/infrastructure/auth/require-user.test.ts`
- Create `relationship-copilot/src/proxy.ts` (Next.js 16 replacement for `middleware.ts`)
- Create `relationship-copilot/src/app/(auth)/login/page.tsx`
- Create `relationship-copilot/src/app/(app)/layout.tsx`

**Step 1 (RED):** Test missing, expired, and valid sessions; assert the returned `ownerId` equals the authenticated Supabase user ID.

**Step 2:** Run the focused test; expect missing-module failure.

**Step 3 (GREEN):** Implement email magic-link authentication and protected app routes. Keep Google source authorization separate from login.

**Step 4:** Run unit tests and add one Playwright redirect test.

**Step 5:** Commit `feat(copilot): add multi-user session boundary`.

### Chunk 4.2: Add route authorization test helpers

**Files:**

- Create `relationship-copilot/src/test/authenticated-request.ts`
- Create `relationship-copilot/src/test/tenant-fixtures.ts`
- Create `relationship-copilot/src/app/api/health/route.ts`
- Create `relationship-copilot/src/app/api/health/route.test.ts`

**Step 1 (RED):** Test anonymous rejection and authenticated health response without exposing user data.

**Step 2:** Run the route test; expect failure.

**Step 3 (GREEN):** Implement reusable session/request fixtures and the smallest health route.

**Step 4:** Run unit and type checks.

**Step 5:** Commit `test(copilot): add authenticated route harness`.

## Block 5: CI and baseline quality

### Success criteria

- [x] Pull requests run all offline checks.
- [x] Browser smoke test covers sign-in redirect and app shell.
- [x] Dependency and secret scanning are enabled.

### Chunk 5.1: Add CI

**Files:**

- Create `.github/workflows/relationship-copilot.yml`
- Create `relationship-copilot/e2e/app-shell.spec.ts`
- Modify `relationship-copilot/package.json`

**Step 1 (RED):** Add an E2E test for protected-route redirect and a workflow job that runs a nonexistent `check` script.

**Step 2:** Run `npm run test:e2e` and workflow lint locally where available; expect failure.

**Step 3 (GREEN):** Add `check` to run lint, typecheck, unit tests, and build. Configure CI to start local Supabase for database tests and Playwright for the smoke test.

**Step 4:** Run the full local verification sequence.

**Step 5:** Commit `ci(copilot): enforce foundation quality gates`.

## Reliability and security standards

- No external network calls exist in this phase.
- `.env.local`, Supabase temp directories, Playwright traces, and test artifacts must be ignored.
- Service-role credentials are server-only and never exposed through `NEXT_PUBLIC_*`.
- Structured logs may contain owner IDs and internal record IDs, but never email bodies, tokens, or notes.
- Database tests must prove least privilege, not only happy paths.

## Technical debt strategy

- Do not copy legacy UI or route files during scaffolding.
- Any reused utility must first receive characterization tests in the legacy location or be rewritten from its behavior contract.
- Hosting and job-runner choice may remain open until Phase 2, but the app must build as a standard Node deployment.

## Final verification

Run from `relationship-copilot/`:

```bash
npm run test
npm run test:db
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Expected: all commands pass with no live-service credentials.

Ready to start building? Use `build`.
