# Legacy Reuse Audit

**Reference root:** `../../crm-claude-build-personal-crm-V9261/`
**Rule:** No legacy module is imported into the new application without an updated decision and tests.

| Candidate | Decision | Evidence | Required before reuse |
|---|---|---|---|
| Person and interaction schema concepts | Reference only | `supabase/migrations/0001_init.sql` demonstrates owner IDs, owner-first indexes, and basic RLS, but the model writes source content directly into trusted interactions and lacks the new proposal boundary. | Rewrite around the approved Phase 0 schema and add positive and negative pgTAP tests. |
| RLS policy shapes | Rewrite | The owner policies are useful examples, but junction ownership is inferred through parent rows and later canonical-owner server paths bypass RLS. | Deny-by-default policies, composite owner checks, and two-user negative tests. |
| Supabase browser/server client setup | Rewrite | `lib/supabase/server.ts` can return a service-role client for ordinary signed-in users when a canonical owner is configured. | Session-bound clients only; admin access isolated behind explicit owner-scoped services. |
| Admin client | Rewrite | `lib/supabase/admin.ts` caches a canonical owner and supports a shared extension key. | Server-only factory plus repository methods that require `ownerId` for every operation. |
| LinkedIn URL normalization | Rewrite from behavior contract | `lib/identity.ts` has a small normalization helper, but the file is coupled to AI and unscoped database queries and has no characterization tests. | Add pure tests for scheme, host, casing, query, hash, and path behavior before implementing later identity work. |
| Identifier sniffing | Reference only | `lib/identity.ts` contains useful email and LinkedIn patterns but can produce false positives and is not part of Phase 0. | Threat-model untrusted text and add adversarial parsing tests in the identity-resolution phase. |
| Name composition and splitting | Rewrite from behavior contract | `lib/names.ts` is pure and compact, but Western first-space splitting is too lossy for a durable person model and lacks tests. | Define international-name behavior and add characterization cases before reuse. |
| Email/name mismatch heuristic | Reference only | `lib/emails.ts` captures a useful typo signal but is heuristic, English-centric, and untested. | Treat only as a review signal and add false-positive cases before consideration. |
| CSV import parsing and deduplication | Reference only | `app/api/people/import/route.ts` contains practical dedupe behavior but combines parsing, matching, direct trusted writes, tag mutation, and interaction creation in one route. | Separate parser, proposal creation, matching, and approval; contract-test each boundary in the LinkedIn/import phase. |
| Summary and personalization prompts | Reference only | `lib/ai/anthropic.ts` includes relationship-summary guidance but is provider-coupled and can write generated content without the new proposal lifecycle. | Provider-neutral adapter, source boundaries, prompt-injection tests, and approval provenance. |
| Legacy UI routes and components | Reference only | The routes solve different workflows, use the old information architecture, and include broadcast and extension surfaces outside current scope. | Feature-level shape brief and new tests before implementing each approved surface. |

## Explicitly prohibited carryover

- `CANONICAL_OWNER_EMAIL`
- `ALLOWED_USER_EMAILS` as a data-access boundary
- `AUTH_PASSWORD` as a shared application password
- `EXTENSION_API_KEY` as a global bearer credential
- Ordinary user routes backed by the service-role client
- Direct source-to-trusted-profile or source-to-trusted-interaction writes
- Automatic outreach or broadcast behavior
