# Personal Relationship Copilot Roadmap

**Created:** 2026-07-02
**Status:** Phase 0 complete and ready to merge; Phase 1 next
**Approved discovery baseline:** `crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Product goal

Build a multi-user-ready relationship copilot that captures context conversationally, proposes trustworthy profile updates for review, preserves source evidence, and proactively helps users restart relationships without ever sending outreach automatically.

## Architecture decision

Create a clean `relationship-copilot/` application and selectively reuse proven ideas or small modules from `crm-claude-build-personal-crm-V9261/`. Do not evolve the legacy application in place.

The legacy code remains a read-only reference until a reuse audit identifies a module that:

1. aligns with the new approval-before-write model;
2. has no single-owner or global-credential assumptions;
3. can be covered by tests before extraction; and
4. saves more work than rewriting it cleanly.

## Non-negotiable product principles

- Incorrect information is worse than missing information.
- Source-derived facts remain proposals until a user approves them.
- WhatsApp captures and notifies; the app is the review and editing surface.
- Outreach is drafted, never sent automatically.
- Every durable record, connection, job, and notification belongs to one user.
- RLS and service-layer authorization enforce tenant isolation from Phase 0.
- Every webhook and background job is idempotent and retry-safe.
- Live-service tests are opt-in; deterministic fakes are the default test path.

## Milestones

| Milestone | Outcome | Included phases |
|---|---|---|
| M0: Trusted core | Multi-user foundation and a complete app-based proposal review loop | 0–1 |
| M1: Self-use alpha | WhatsApp capture, relationship memory, and actionable reminders | 2–3 |
| M2: Context-aware alpha | Google email/calendar and Granola context enrichment | 4–5 |
| M3: Community context | WDAI Slack signals and improved proactive ranking | 6–7 |
| M4: Private beta | Secure onboarding, operations, privacy controls, and multi-user hardening | 8 |

## Phase summary

| Phase | Name | User-visible outcome | Depends on | Status |
|---|---|---|---|---|
| 0 | Clean foundation and tenant boundary | Secure sign-in and an empty, multi-user-safe product shell | Approved discovery baseline | Complete |
| 1 | Trusted capture and app review | Create, edit, approve, or reject a sourced proposal in the app | 0 | Not started |
| 2 | WhatsApp capture and deep links | Text the copilot and receive a link to the exact review item | 1 | Not started |
| 3 | Relationship memory and reminders | View trusted history, receive follow-ups, and generate an opener | 2 | Not started |
| 4 | Google email and calendar | Connect Google and review relationship proposals from direct email and meetings under 15 attendees | 3 | Not started |
| 5 | Granola meeting context | Attach reviewed Granola summaries and follow-ups to meeting attendees | 4 | Not started |
| 6 | WDAI Slack context | Review proposals created from DMs and direct thread replies | 4 | Not started |
| 7 | Proactive attention and LinkedIn batch import | Ranked relationship attention queue plus reviewed LinkedIn imports | 3, 4; 5–6 improve quality | Not started |
| 8 | Multi-user private beta | Safe onboarding, connector health, privacy controls, observability, and recovery | 0–7 | Not started |

Granola and Slack may be implemented in parallel after Phase 4 if two isolated workstreams are available. Phase 7 can begin after Phase 4 using Google-derived signals, then incorporate Granola and Slack as they land.

## Current phase

Phase 0 now provides the tested application shell, Supabase schema, deny-by-default RLS, owner-scoped repositories, passwordless authentication, CI, and multi-user isolation checks. Its build, audit fixes, final re-audit, and closeout are complete. **Phase 1: Trusted capture and app review** is next after Phase 0 merges.

## Phase gates

### Phase 0: Clean foundation and tenant boundary

**Goal:** Establish the new app, automated tests, CI, core schema, RLS, and user-owned domain boundaries.

**Exit gate:** Two authenticated test users cannot access or mutate each other's records through either database or application routes. CI runs unit, database, type, lint, and build checks.

**Plan:** `docs/plans/2026-07-02-phase-0-foundation.md`

### Phase 1: Trusted capture and app review

**Goal:** Prove the central trust model before adding any external transport.

**Exit gate:** A structured capture creates a pending proposal, the owner can inspect source evidence and edit fields, approval atomically creates trusted records, and rejection changes no trusted data.

**Plan:** `docs/plans/2026-07-02-phase-1-trusted-capture-review.md`

### Phase 2: WhatsApp capture and deep links

**Goal:** Make WhatsApp the conversational capture and notification surface.

**Feasibility gate:** Confirm the approved WhatsApp Business Platform setup, webhook verification, user-to-phone mapping, approved reminder template strategy, and test-number workflow. Do not use unofficial WhatsApp scraping or browser automation.

**Exit gate:** A duplicate-safe inbound WhatsApp message creates one proposal and returns one authenticated deep link. Delivery failures are visible in the app and retryable.

**Plan:** `docs/plans/2026-07-02-phase-2-whatsapp-capture.md`

### Phase 3: Relationship memory and reminders

**Goal:** Turn approved context into useful memory and follow-up assistance.

**Exit gate:** Approved interactions appear in a person's timeline, due reminders are delivered once, and users can generate an opener, snooze, complete, or dismiss without any automatic outreach.

**Plan:** `docs/plans/2026-07-02-phase-3-relationship-memory-reminders.md`

### Phase 4: Google email and calendar

**Goal:** Add the first automatic context sources with per-user OAuth and strict relevance filtering.

**Feasibility gate:** Google OAuth consent configuration, required read-only scopes, encrypted refresh-token storage, Pub/Sub ownership, and watch-renewal operations are documented and tested in a sandbox account.

**Exit gate:** Direct email exchanges and calendar events with fewer than 15 attendees create reviewable, sourced proposals. Newsletters, automated mail, and large meetings do not.

**Plan:** `docs/plans/2026-07-02-phase-4-google-email-calendar.md`

### Phase 5: Granola meeting context

**Goal:** Enrich meeting relationships with Granola notes while preserving source and plan constraints.

**Feasibility gate:** Confirm whether the target Granola account supports the API. The official API is plan-gated; CSV import is the supported fallback and does not include bulk transcripts.

**Exit gate:** A Granola note or supported export can be matched to a calendar event and generate reviewable attendee updates without storing an unapproved transcript.

**Plan:** `docs/plans/2026-07-02-phase-5-granola.md`

### Phase 6: WDAI Slack context

**Goal:** Enrich relationships from WDAI DMs and direct thread replies only.

**Feasibility gate:** Approve Slack OAuth scopes and token type. Public/private thread history may require user-token scopes, and API rate limits prohibit naive backfills.

**Exit gate:** Only a DM or a direct reply involving the connected user can generate a proposal. Passive co-membership, reactions, and unrelated channel messages do not.

**Plan:** `docs/plans/2026-07-02-phase-6-slack-wdai.md`

### Phase 7: Proactive attention and LinkedIn batch import

**Goal:** Rank relationships using trusted interaction history and add LinkedIn data through compliant, reviewed imports.

**Feasibility gate:** Do not plan scraping. Official LinkedIn profile and connections APIs are restricted, and profile storage is constrained. Start with user-provided batch data and URLs; treat automated job/post monitoring as a later provider decision.

**Exit gate:** The attention queue explains why each person surfaced. LinkedIn imports create proposals rather than trusted facts, and imported duplicates are reviewable.

**Plan:** `docs/plans/2026-07-02-phase-7-proactivity-linkedin.md`

### Phase 8: Multi-user private beta

**Goal:** Make the system safe and operable for invited users beyond Sandhya.

**Exit gate:** New users can onboard without operator database edits, connect and revoke sources, export/delete their data, recover from connector failures, and remain isolated under security and load tests.

**Plan:** `docs/plans/2026-07-02-phase-8-multi-user-beta.md`

## Cross-phase quality gates

Every phase must satisfy all applicable checks before the roadmap status advances:

- Start each code chunk with a failing test.
- Unit and integration tests use deterministic clocks, IDs, and provider fakes.
- Database changes include positive and negative RLS tests.
- Every external event has a persisted idempotency key.
- Every external call has a timeout and classified retry policy.
- Async failures produce both user-visible state and structured technical logs.
- No production secret appears in source, fixtures, snapshots, or logs.
- New UI includes loading, empty, error, offline, and success states.
- Mobile flows support 375–430 px widths; desktop remains fully usable.
- Interactive controls meet WCAG 2.2 AA and 44 px touch-target guidance.
- `npm run test`, `npm run test:db`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- Live-provider tests require an explicit environment flag and dedicated sandbox accounts.

## External integration constraints recorded during planning

- Gmail push uses Cloud Pub/Sub, requires history-based synchronization, and mailbox watches must be renewed at least every seven days. Plan a daily renewal job and periodic catch-up sync.
- Google server-side OAuth needs offline access for background synchronization and secure refresh-token storage.
- Google Calendar push channels are per user/resource and deliver change notifications rather than full event payloads.
- Granola offers custom API access on Business and Enterprise plans; CSV export is a fallback and does not bulk-export transcripts.
- Slack Events API retries deliveries; thread history and scope availability vary by conversation type and token type.
- LinkedIn access to other members' profile/connection data is restricted and subject to storage limits. No scraping is part of this roadmap.
- WhatsApp reminders may occur outside the active conversation window, so approved template-message behavior must be validated before Phase 3 delivery is enabled.

### Official references

- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Gmail synchronization](https://developers.google.com/workspace/gmail/api/guides/sync)
- [Gmail push notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- [Google Calendar push notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Google OAuth for server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Granola integrations and API availability](https://docs.granola.ai/help-center/sharing/integrations/integrations-with-granola)
- [Granola historical export](https://docs.granola.ai/help-center/sharing/exporting-notes)
- [Slack Events API](https://docs.slack.dev/apis/events-api/)
- [Slack thread replies](https://docs.slack.dev/reference/methods/conversations.replies/)
- [LinkedIn Profile API restrictions](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api)
- [LinkedIn Connections API restrictions](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/connections-api)

## Technical debt policy

No phase may leave tenant isolation, approval provenance, idempotency, or secret handling as future debt. Cosmetic polish, advanced ranking, additional source coverage, and performance optimization may be deferred when logged with an owner and target phase.

## Planning artifacts

- `docs/plans/2026-07-02-phase-0-foundation.md`
- `docs/plans/2026-07-02-phase-1-trusted-capture-review.md`
- `docs/plans/2026-07-02-phase-2-whatsapp-capture.md`
- `docs/plans/2026-07-02-phase-3-relationship-memory-reminders.md`
- `docs/plans/2026-07-02-phase-4-google-email-calendar.md`
- `docs/plans/2026-07-02-phase-5-granola.md`
- `docs/plans/2026-07-02-phase-6-slack-wdai.md`
- `docs/plans/2026-07-02-phase-7-proactivity-linkedin.md`
- `docs/plans/2026-07-02-phase-8-multi-user-beta.md`
