# Gmail Label Tabs — Project Roadmap

## ✅ Phase 1: Core Filtering (Complete)

### Completed
- [x] FEAT-001: "All Inbox" pill — clears active label filter and shows all inbox rows
- [x] FEAT-002: Visual refinement — color tints only on labels with unreads (clutter reduction)
- [x] BUG-FIX: Click blocking from DOM injection into host SPA's observed subtree
- [x] BUG-FIX: Row filter hiding opened conversation threads
- [x] BUG-FIX: State mutation destroying sub-label data

## Phase 2: Polish & Optimization

### Planned
- [ ] PERF-001: Debounce Gmail API calls during rapid filter clicks
- [ ] PERF-002: Cache label hierarchy locally to reduce API round-trips
- [ ] UX-001: Keyboard navigation (arrow keys to navigate pills, Enter to select)
- [ ] UX-002: Hover state indication and accessibility improvements (ARIA labels, focus management)
- [ ] DEV-001: Resolve 8 logged tech debt items (DRY refactors, SRP splits)
