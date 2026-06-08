# Bugs & Tech Debt

## Active

(None)

## Resolved (Phase 1)

| ID | Description | Severity | Fixed | Note |
|----|-------------|----------|-------|------|
| BUG-001 | First pill click does not apply the row filter — requires a second click to show only that category | High | 2026-06-07 | Fixed: added `event.stopPropagation()` + `event.preventDefault()` in pill click handlers to prevent Gmail re-rendering the view after click |
| BUG-002 | Email clicks silently fail immediately after extension loads, before any user interaction | Critical | 2026-06-07 | Fixed: moved pill-bar injection from `anchor.parentNode.insertBefore()` to `document.body.appendChild()` with `position:fixed`. Inserting into Gmail's observed DOM subtree triggered Gmail's MutationObserver, which disabled `pointer-events` on the main content area during re-render. |
| BUG-003 | Sub-labels permanently disappear from UI after first click on parent label | High | 2026-06-07 | Fixed: renamed `loadVisibleChildren(token, parentNode)` to `getVisibleChildren(parentNode)`. The old function mutated `parentNode.children` in place, destroying non-present children from shared state. New version returns a filtered array; caller decides whether to use it without mutating the original. |
| BUG-004 | Pill bar renders over Gmail's search bar in some layouts | High | 2026-06-07 | Fixed: added `MIN_ANCHOR_TOP = 100` guard in `inject()`. If `anchor.getBoundingClientRect().top < 100`, Gmail hasn't finished layout and injection is deferred via `scheduleInject()`. |

## Tech Debt

| ID | Description | Severity | File | Note |
|----|-------------|----------|------|------|
| DEBT-009 | `renderFromData` does 6 things: builds label tree, annotates presence, decides whether to render, creates DOM, binds events, inserts + positions, and restores active state — and mutates `state.tree`/`state.activeNodes` as a side effect of what reads as a render function. Split into `updateState(rawLabels, messages)` + `renderPillBar(anchor)`. | Low | `lib/injector.js` | |
| DEBT-010 | `loadAndCacheData` fetches AND caches — caller at background-refresh site only wants data to compare; whether to cache is a separate concern. Split into `fetchData(token)` + `cacheData(data)`. | Low | `lib/injector.js` | |
| DEBT-011 | `buildPillDataFromMessages` calls `annotatePresenceFromMessages` which mutates `tree` nodes in place, then reads from those mutated nodes to build return value. In-place mutation is invisible at call site. | Low | `lib/injector.js` | |
| DEBT-012 | `JSON.stringify` comparison on potentially 100 message objects on every warm-cache navigation — no comment explaining why a lighter check (count comparison, checksum) wasn't used. | Low | `lib/injector.js:430-434` | |
| DEBT-013 | `deps()` called multiple times inside `selectTopLevel` (lines ~289, ~295, ~302) — constructs a fresh object from `window.*` on every call. Call once at top of function. | Low | `lib/injector.js` | |
| DEBT-014 | `createPillElement` factory applied inconsistently — `createAllInboxPill` and `createAllSubPill` are structurally identical but don't use it. | Low | `lib/pill-bar.js` | |
