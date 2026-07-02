# Personal Relationship Copilot

**Status:** Phase 0 complete and ready to merge. Phase 1 is next after merge.

This directory is the clean home for the new relationship-copilot product. The friend's imported CRM remains in `../crm-claude-build-personal-crm-V9261/` as a legacy reference and selective-reuse source.

## What works today

- Passwordless email sign-in and a protected, account-scoped application shell.
- A user-owned person, channel, and interaction schema protected by deny-by-default RLS.
- Owner-scoped application repositories and explicit service-role boundaries.
- Unit, database-isolation, browser, accessibility, build, dependency, and secret checks in CI.

Capture, proposal review, reminders, and external connectors are intentionally not implemented yet; they begin in Phase 1 and later roadmap phases.

## Start here

1. Read `PROJECT_ROADMAP.md` for phase order, gates, and milestones.
2. Read the approved discovery baseline at `../crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`.
3. Review the Phase 0 foundation in `PRODUCT.md`, `DESIGN.md`, and `docs/architecture/`.
4. Begin Phase 1 only after the Phase 0 branch passes closeout and merges.

## Local verification

The app uses Node 24 and a local Supabase stack. On macOS, install a Docker-compatible runtime before database or auth tests. This repository was verified with Homebrew `docker` and Colima:

```bash
colima start --cpu 2 --memory 4 --disk 40
npm install
npx supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector,supavisor
npm run check
npm run test:db
npm run test:e2e
```

Docker Desktop, OrbStack, Rancher Desktop, or Podman may be used instead of Colima. Local auth email is captured by Mailpit; no real email is sent.

## Roadmap and implementation plans

- `PROJECT_ROADMAP.md`
- `docs/plans/2026-07-02-phase-0-foundation.md`
- `docs/plans/2026-07-02-phase-1-trusted-capture-review.md`
- `docs/plans/2026-07-02-phase-2-whatsapp-capture.md`
- `docs/plans/2026-07-02-phase-3-relationship-memory-reminders.md`
- `docs/plans/2026-07-02-phase-4-google-email-calendar.md`
- `docs/plans/2026-07-02-phase-5-granola.md`
- `docs/plans/2026-07-02-phase-6-slack-wdai.md`
- `docs/plans/2026-07-02-phase-7-proactivity-linkedin.md`
- `docs/plans/2026-07-02-phase-8-multi-user-beta.md`
