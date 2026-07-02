# Gmail Label Tabs — Project History

## Phase 2: Native Search Reliability Repair v1.1 (2026-07-02)

**Why it was needed:**
- Real Gmail filtering was inaccurate because the extension searched rendered row text for label names.
- The fixed portal could overlap the inbox and drift after navigation or layout changes.
- Visibility and badges only considered the first 100 inbox messages.

**What changed:**
- Replaced DOM row hiding with Gmail-native, inbox-scoped search navigation.
- Made the URL route the source of truth for active parent/sub-label state.
- Added a standalone layout controller with exact padding restoration, resize observation, anchor replacement, and sub-row height reconciliation.
- Replaced the first-100 message-detail crawl with bounded-concurrency thread query summaries.
- Added one-hour label caching, one-minute summary caching, typed OAuth/API errors, invalid-token eviction, and one retry.
- Added active `aria-pressed` state and corrected Unlabeled selection.
- Expanded the suite from 28 to 56 tests across 11 suites.

**Verification:**
- 56/56 Jest tests passing
- JavaScript syntax checks passing
- `git diff --check` passing
- `npm audit --omit=dev`: 0 vulnerabilities

**Known boundary:** Gmail's DOM and hash routes are not public extension APIs, so a real-Gmail smoke pass remains required before merging.

## Phase 1: Core Filtering v1 (2026-06-07)

**Key Accomplishments:**
- Built and shipped fully functional Chrome MV3 extension with OAuth integration
- Implemented pill-bar UI with label hierarchy traversal and dynamic sub-label expansion
- Resolved critical click-blocking bug caused by DOM injection triggering host SPA's mutation handlers
- Designed visual hierarchy: color tints appear only on labels with unread mail (clutter reduction)
- Fixed state mutation bug that silently destroyed sub-label data on interaction

**Key Learnings:**
1. Content script injection into a host SPA's observed DOM can block pointer events if insertion triggers the SPA's MutationObserver and re-render cycle — solution: insert to `document.body` with `position:fixed`, position via `getBoundingClientRect()`
2. Chrome extension content scripts must treat the host's DOM as read-only; DOM mutations from injected code cause the host to re-render defensively
3. Obfuscated CSS class names (e.g., `div.aKh`) rotate on SPA deploy cycles — targeting them breaks silently and unpredictably
4. Shared state mutations (e.g., `parentNode.children = filtered`) are invisible to callers and destroy data without notification — use immutable patterns even in simple state objects
5. Test suite must be green pre-flight before audit — a stale test is a lie, every finding made against a broken baseline is suspect

**Test Status:** 28/28 passing (1 stale assertion fixed during audit)

**Tech Debt Logged:** 8 low-severity items (DRY violations, SRP splits, dead code)
