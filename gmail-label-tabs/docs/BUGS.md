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

(None — all items resolved in Phase 2)
