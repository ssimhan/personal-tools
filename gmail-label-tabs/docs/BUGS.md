# Bugs & Tech Debt

## Active

(None)

## Resolved (Phase 1)

| ID | Description | Severity | Fixed | Note |
|----|-------------|----------|-------|------|
| BUG-001 | First pill click does not apply the row filter — requires a second click to show only that category | High | 2026-06-07 | Fixed: added `event.stopPropagation()` + `event.preventDefault()` in pill click handlers to prevent Gmail re-rendering the view after click |
| BUG-002 | Email clicks silently fail immediately after extension loads, before any user interaction | Critical | 2026-06-07 | Fixed: moved pill-bar injection from `anchor.parentNode.insertBefore()` to `document.body.appendChild()` with `position:fixed`. Inserting into Gmail's observed DOM subtree triggered Gmail's MutationObserver, which disabled `pointer-events` on the main content area during re-render. |
| BUG-003 | Sub-labels permanently disappear from UI after first click on parent label | High | 2026-06-07 | Fixed: renamed `loadVisibleChildren(token, parentNode)` to `getVisibleChildren(parentNode)`. The old function mutated `parentNode.children` in place, destroying non-present children from shared state. New version returns a filtered array; caller decides whether to use it without mutating the original. |

## Tech Debt

| ID | Description | Severity | File | Note |
|----|-------------|----------|------|------|
| DEBT-001 | `queryForNode` and `unreadQueryForNode` are structural duplicates — both call `deps()` + `getDescendantNames`, differ only in which `SearchQuery` method they invoke. Extract to `buildQuery(node, type)`. | Low | `lib/injector.js` |  |
| DEBT-002 | `countMessagesForNode` and `countUnreadMessagesForNode` share identical family-ID construction. One should call the other, or both should use a shared `getMessagesByNode(node, messages, unreadOnly)` helper. | Low | `lib/injector.js` |  |
| DEBT-003 | `createPill` and `createSubPill` are near-identical — same structure, different class names. Extract to a shared `createPillElement(label, isActive, classes)` factory. | Low | `lib/pill-bar.js` |  |
| DEBT-004 | `setActivePill` and `setActiveSubPill` are structurally identical — differ only in selector string. Merge into `setActiveState(wrapper, selector, labelId)`. | Low | `lib/injector.js` |  |
| DEBT-005 | `inject()` does six things: guards, dep resolution, data fetching, state mutation, DOM insertion, error handling. Split data-fetch + state into a `refresh()` helper; `inject()` should only own DOM work. | Low | `lib/injector.js` |  |
| DEBT-006 | Token/OAuth error detection uses substring matching (`indexOf('token')`, `indexOf('OAuth')`) on free-text error messages. Fragile — will silently miss or misroute errors. Throw a typed error at `ApiClient.getToken()` instead. | Low | `lib/injector.js` |  |
| DEBT-007 | `navigateToNode` applies the row filter immediately then re-applies it 500 ms later on every label click. The 500 ms retry is speculative — remove it and add back only if a specific race condition is confirmed. | Low | `lib/injector.js` |  |
| DEBT-008 | Fallback branch in `getInboxRows` (`document.querySelectorAll('div[role="main"] tr.zA')`) is unreachable — the guard above returns early if `findAnchor()` returned nothing. Remove the dead branch. | Low | `lib/injector.js` |  |
