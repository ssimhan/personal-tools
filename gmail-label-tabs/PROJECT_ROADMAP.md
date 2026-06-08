# Gmail Label Tabs — Project Roadmap

## ✅ Phase 1: Core Filtering (Complete)

### Completed
- [x] FEAT-001: "All Inbox" pill — clears active label filter and shows all inbox rows
- [x] FEAT-002: Visual refinement — color tints only on labels with unreads (clutter reduction)
- [x] BUG-FIX: Click blocking from DOM injection into host SPA's observed subtree
- [x] BUG-FIX: Row filter hiding opened conversation threads
- [x] BUG-FIX: State mutation destroying sub-label data

## ✅ Phase 2: Performance & Tech Debt (Complete)

### Completed
- [x] PERF-001: Cache label hierarchy (1h TTL) and message counts (60s TTL) locally
- [x] PERF-002: Implement stale-while-revalidate pattern with freshness guard
- [x] DEV-001: Resolve 8 logged tech debt items — 2 blocking (cache.js window.Cache collision, dead annotateNode removal), 6 improvement-level deferred
- [x] DEV-002: Refactor pill rendering: split state update from DOM rendering
- [x] DEV-003: Audit and kaizen workflow improvements logged

## Phase 3: Code Cleanup & Refinement

### Planned
- [ ] TECH-001: Resolve DEBT-009–014 (renderFromData split, deps() duplication, factory consistency, comment clarity)
- [ ] TEST-001: Audit test coverage for edge cases (cache miss, expired TTL, stale comparisons)
- [ ] DOC-001: Update architecture docs with caching strategy and stale-while-revalidate pattern
