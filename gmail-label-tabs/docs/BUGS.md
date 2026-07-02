# Bugs & Tech Debt

## Active

None known after automated verification. Real-Gmail smoke testing is still required for the host-DOM integration.

## Resolved — Native Search Repair (2026-07-02)

| ID | Description | Severity | Resolution |
|----|-------------|----------|------------|
| BUG-004 | Label pills hid visible rows by matching label names against each row's text, causing false positives and false negatives | Critical | Removed all row-text filtering. Pills now navigate to deterministic, inbox-scoped Gmail searches. |
| BUG-005 | Fixed pill bar overlaid Gmail rows/search/dropdowns and became misplaced after resize, sidebar changes, or sub-row expansion | Critical | Added a layout controller that owns portal width/position, reserves exact wrapper height, observes resize, and restores the original inline padding on teardown. |
| BUG-006 | Bar and active state became stale across search, thread, Back, and Gmail SPA DOM replacement | High | Added route-driven reconciliation, owned-query recognition, thread teardown, anchor replacement handling, and stale async request guards. |
| BUG-007 | Pill visibility and counts were limited to the first 100 inbox messages and required up to 100 detail requests | High | Replaced the message crawl with bounded-concurrency Gmail thread query estimates using the same query semantics as navigation. |
| BUG-008 | A cached expired OAuth token produced silent 401 failures | High | Added typed API/OAuth errors, cached-token invalidation, and one silent retry before showing a reconnect message. |
| BUG-009 | Unlabeled could not render as the active pill | Medium | Added active styling and `aria-pressed` state for Unlabeled. |

## Resolved — Phase 1 (2026-06-07)

| ID | Description | Severity | Resolution |
|----|-------------|----------|------------|
| BUG-001 | First pill click did not apply the filter | High | Click handlers now stop propagation and prevent the default host-page action. Native search navigation removes the original race entirely. |
| BUG-002 | Email clicks silently failed after extension load | Critical | The extension portal remains attached to `document.body`; Gmail-owned message rows are never modified. |
| BUG-003 | Sub-labels permanently disappeared after a parent click | High | Child filtering is immutable; the original hierarchy remains intact. |

## Remaining Technical Risk

| ID | Risk | Severity | Note |
|----|------|----------|------|
| RISK-001 | Gmail list-anchor selectors and hash routes are undocumented host behavior | Medium | Integration fails closed when no stable anchor exists; keep the real-Gmail verification matrix current. |
| RISK-002 | Gmail API `resultSizeEstimate` values are estimates | Low | They are used only for visibility and unread badges, never for filtering correctness. |
| RISK-003 | `labels.list` does not return Gmail label colors | Low | Current UI uses the neutral palette unless a future version adds cached `labels.get` calls. |
| RISK-004 | Multi-account Gmail tabs can differ from the Chrome Identity account behind `users/me` | Medium | v1.1 is supported for a single personal Chrome/Gmail account profile; add explicit account matching before multi-account use. |
