# ADR-001: Build a Clean Shell with Selective Legacy Reuse

**Status:** Accepted
**Date:** 2026-07-02
**Decision owner:** Sandhya

## Context

The imported Relationship Memory Layer proves several useful CRM concepts, but it was designed around a single active owner. Its authentication, service-role access, browser-extension key, inbound email, and notification paths can resolve multiple identities to one canonical dataset. The new product instead requires per-user ownership, proposal review before trusted writes, source provenance, and connector isolation from the first phase.

## Decision

Build a new application in `relationship-copilot/`. Keep `crm-claude-build-personal-crm-V9261/` unchanged as a reference. Reuse a legacy module only when a written audit confirms that it:

1. matches the approval-before-write model;
2. has no canonical-owner or global-credential assumption;
3. can be protected by characterization tests before extraction; and
4. saves more effort than implementing its behavior contract cleanly.

The default for schema, authorization, ingestion, and route code is rewrite. Small pure utilities may be candidates for later extraction after tests exist.

## Alternatives considered

### Evolve the legacy application in place

Rejected. The single-owner shortcuts cross authentication, data access, inbound routes, and configuration. Removing them safely would be harder to review than establishing a deny-by-default boundary in a new application.

### Copy the legacy application wholesale, then remove unsafe parts

Rejected. Copying would make unrelated UI, broadcast, extension, AI, and connector behavior appear in scope and could preserve unsafe assumptions that are not obvious at the route level.

### Ignore the legacy application completely

Rejected. The existing schema, owner indexes, identity heuristics, and import behavior provide useful evidence about edge cases and can reduce rediscovery when treated as reference material.

## Consequences

- Phase 0 has more scaffolding work but a smaller trusted computing base.
- Legacy files remain untouched and do not share imports with the new application.
- Reuse decisions are explicit and reviewable in `reuse-audit.md`.
- Future extracted utilities require tests and tenant-safe interfaces.
- No legacy data migration is included because no live dataset was identified for preservation.
