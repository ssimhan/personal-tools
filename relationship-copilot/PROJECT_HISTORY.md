# Project History

## 2026-07-02: Phase 0 foundation implemented

### Accomplishments

- Built the independent Next.js 16 application shell with the Warm + Quiet welcome, login, and protected empty states.
- Added Supabase passwordless authentication with a custom token-hash email template and canonical redirect handling.
- Created the user-owned core schema, deny-by-default RLS, owner-scoped repositories, and service-role boundaries.
- Added unit, pgTAP, browser, accessibility, type, lint, build, dependency, and secret checks to CI.
- Added explicit 10-second Supabase request deadlines with upstream cancellation and `finally` cleanup.
- Normalized the npm lockfile from an employer-only proxy to the public npm registry and verified a clean install.
- Kept the legacy CRM unchanged and documented all selective-reuse decisions.

### Verification

- Unit tests: 20 passing across 8 files.
- Database tests: 72 passing pgTAP assertions across 3 files.
- Browser tests: 4 passing in Chrome, including a full local Mailpit magic-link round trip.
- Node 24.17.0 lint, typecheck, production build, npm audit, route, tenant-isolation, and secret checks pass.
- Node 24.17.0 `npm ci --registry=https://registry.npmjs.org` passes from the normalized lockfile.
- Manual desktop and 375px Browser inspection confirms the Warm + Quiet shell, keyboard focus, touch targets, responsive layout, and WCAG AA primary-action contrast.

### Approvals and environment

- Sandhya explicitly approved the `phase/0-foundation` branch and confirmed that no live CRM data migration is required.
- Sandhya explicitly approved installing Homebrew `docker` and `colima` and starting Colima for the local Supabase verification workflow.
- No push bypass or unapproved external write was used.

### Key learnings

- Static auth-route tests do not replace a real email-to-session round trip; the live test found both the template mismatch and redirect-cookie boundary.
- Auth cookies and redirects must share one configured application origin, even when `localhost` and `127.0.0.1` both resolve locally.
- Local Supabase tests require an explicit Docker-compatible runtime and a documented reduced-service command.

### Next phase

Phase 1: Trusted capture and app review, after Phase 0 passes final re-audit, closeout, and merge.

## 2026-07-02: Discovery and roadmap planning complete

### Accomplishments

- Captured the approved relationship-copilot discovery baseline from Sandhya's thought dump.
- Classified the friend's CRM and Bob CRM as inspiration/reference rather than product requirements.
- Chose a clean `relationship-copilot/` application with selective legacy reuse.
- Established approval-before-write, source provenance, and multi-user isolation as foundational constraints.
- Created a nine-phase roadmap from clean foundation through private beta.
- Created nine TDD-first implementation plans containing 47 blocks and 96 build chunks.
- Recorded official feasibility gates for WhatsApp, Google, Granola, Slack, and LinkedIn.
- Merged the planning artifacts to `main` through pull request #4.

### Verification

- Confirmed every roadmap phase has one implementation plan.
- Confirmed every plan includes goal, architecture, design patterns, tech stack, and approved source.
- Confirmed all 47 blocks include measurable success criteria.
- Confirmed every code chunk starts with a RED test; documentation/audit chunks are explicitly exempted.
- Confirmed `main` matches `origin/main` after merge.
- No application test count exists because no relationship-copilot product code has been implemented.

### Key learnings

- External projects must be explicitly classified as inspiration, baseline code, constraints, or approved requirements before requirements are inferred.
- Copying a clean subtree into `main` preserves files but not the divergent branch's commit ancestry; historical branches should be archived and removed separately.
- GitHub CLI authentication is independent of a working SSH Git remote and should be checked before prescribing PR commands.
- Large plan sets need automated structure and staged-diff checks before commit.

### Next phase

Phase 0: Clean foundation and tenant boundary. Start only after creating a dedicated phase branch through the `build` workflow.
