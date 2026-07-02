# Bugs and Carryover

## Active

None.

## Accepted foundation debt

- GitHub Actions use mutable major-version tags. Pin action commits during Phase 8 supply-chain hardening or earlier if the repository becomes public.
- Hosted Supabase email-template configuration remains a deployment-time task; the tracked local template and end-to-end test define the required contract.

## Accepted planning risks

These are roadmap feasibility gates, not active defects:

- WhatsApp Business Platform provider setup, template behavior, and user mapping must be validated before Phase 2.
- Google OAuth verification, Pub/Sub ownership, and watch renewal must be validated before Phase 4.
- Granola API availability depends on the user's plan; CSV import is the documented fallback.
- Slack token type, scopes, and rate limits must be approved before Phase 6.
- Automated LinkedIn job/post monitoring remains blocked pending a compliant data source.

## Resolved during planning closeout

- **CLOSEOUT-001:** Roadmap and README still described the merged plans as awaiting approval. Resolved by marking planning complete and Phase 0 ready.
- **CLOSEOUT-002:** Legacy branch ancestry made the old CRM branch appear unmerged after a clean subtree import. Resolved by archiving the historical branch and using a clean integration PR.

## Resolved during Phase 0

- **PHASE0-001:** Primary login-action contrast was 3.83:1. Resolved by using the deeper coral action token and a rendered WCAG AA regression check.
- **PHASE0-002:** The default Supabase magic-link email bypassed `/auth/confirm`. Resolved with a tracked token-hash template and a full Mailpit-to-protected-page browser test.
- **PHASE0-003:** Verified auth cookies could be lost across an implicit origin change. Resolved by attaching cookies to the route response and deriving redirects from `NEXT_PUBLIC_APP_URL`.
- **PHASE0-004:** Supabase requests relied on an implicit timeout. Resolved with an abort-aware 10-second fetch boundary and cleanup tests.
- **PHASE0-005:** The login action had no pending state. Resolved with a disabled, live-labeled submit control.
- **PHASE0-006:** The lockfile resolved packages through an OpenAI-internal npm firewall. Resolved by normalizing tarball URLs to `registry.npmjs.org` and running a clean public-registry install under Node 24.17.0.
