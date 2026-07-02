# Gmail Label Tabs — Project Roadmap

## ✅ Phase 1: Initial Extension (Complete — 2026-06-07)

- [x] OAuth connection through Chrome Identity
- [x] Dynamic Gmail label hierarchy
- [x] Top-level and direct-child pill UI
- [x] All Inbox and Unlabeled pills
- [x] Inbox-scoped label query builder

## ✅ Phase 2: Native Search Reliability Repair (Complete — 2026-07-02)

- [x] Replace DOM row-text filtering with Gmail-native search navigation
- [x] Remove all `.glt-row-hidden` behavior
- [x] Add route-derived active state for inbox and extension-owned searches
- [x] Teardown on thread views and restore on Back/Forward
- [x] Add a dedicated portal layout controller for resize, sidebar, anchor replacement, and sub-row height changes
- [x] Replace first-100-message crawl with bounded thread-query summaries
- [x] Cache labels for one hour and summaries for one minute
- [x] Invalidate and retry expired OAuth tokens once
- [x] Expand automated coverage from 28 to 56 tests
- [x] Correct setup, architecture, and known-risk documentation

## Phase 3: Live Gmail QA & Accessibility Release Gate

- [ ] Run the full real-Gmail verification matrix on Sandhya's personal account
- [ ] Tune the stable anchor selector if any Gmail density/split-pane layout fails
- [ ] Add visible loading state while direct-child summaries load
- [ ] Add keyboard arrow navigation and focus management
- [ ] Raise pill and popup text contrast to WCAG AA (4.5:1 for normal text)
- [ ] Decide whether label colors justify cached `labels.get` requests
- [ ] Add a repeatable browser-level smoke test using a dedicated test Gmail account

## Deferred: Repository Organization

- [ ] Separate the Gmail extension from the unrelated personal CRM work currently living on `origin/CRM`
- [ ] Incorporate and evaluate the friend-shared CRM repository when Sandhya provides the ZIP
