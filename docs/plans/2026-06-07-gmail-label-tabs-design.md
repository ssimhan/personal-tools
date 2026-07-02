# Gmail Label Tabs — Chrome Extension PRD
_Date: 2026-06-07_

---

## Goal

Build a personal Chrome extension that injects a dynamic, visually polished pill-based tab bar into Gmail's inbox. Pills represent the user's top-level Gmail labels and reveal scrollable sub-label pills on click. Only labels with at least one email currently in the inbox are shown — nothing is hardcoded or static.

---

## Audience

Single user (Sandhya), personal Gmail on personal laptop. No multi-user, no sharing, no settings UI required in v1.

---

## Scope — What We Are NOT Building

- A new email client or custom reader
- Any email compose, reply, archive, or delete functionality
- Settings or configuration UI (labels are derived live from Gmail API)
- Mobile support
- Firefox support (Chrome only, v1)
- Dark mode
- Push notifications
- Any backend server — extension is fully client-side

---

## UI Pattern: Option C — Floating Pill Bar

A two-row pill bar injected above Gmail's email list, inside the main inbox pane.

### Row 1 — Category Pills (top-level labels)
- One pill per top-level label that has ≥1 email in the inbox right now
- Ordered by label number prefix (1-Sandhya, 2-Kids, 3-Career, etc.)
- Non-numbered labels (cc-automated, Chatting) appear at the end
- "Unlabeled" pill always appears last if any inbox emails have no user label
- Each pill shows: color dot (from Gmail label color), label display name (strip number prefix), unread count badge
- Inactive state: cream background, warm border
- Active state: teal fill (`#1A9E96`), white text, soft drop shadow

### Row 2 — Sub-label Pills (appears when a category pill is active)
- One pill per direct child label that has ≥1 email in the inbox
- "All [Category]" pill always appears first — shows all emails for parent + any depth of children
- 3-level labels (grandchildren) silently roll up into their parent sub-label — never shown as a 3rd row
- Sub-pills use outline style (border only), teal fill when active

### Dynamic Behavior
- Both rows are horizontally scrollable with no visible scrollbar
- A fade gradient on the right edge hints at more pills
- The pill bar re-evaluates on each Gmail inbox load / label change

---

## Label Hierarchy

Derived dynamically from Gmail API label names using `/` as hierarchy separator.
Full known structure (as of 2026-06-07):

```
1 - Sandhya
  ├── Dance
  ├── Reading
  ├── Songs
  └── Uplevel

2 - Kids
  ├── Akira
  ├── Anya
  └── PTA

3- Career
  ├── Almost Technical AT
  ├── Coding Projects
  ├── DL
  ├── Experiments
  ├── FB
  ├── Fractional Work FW
  ├── Glean
  │   └── Competitive  ← rolls up into Glean
  ├── Growth
  ├── Job Hunt
  ├── Learn
  ├── MBA
  ├── Meetups
  ├── Networking
  ├── News
  ├── OpenAI
  ├── Personal Brand
  │   └── Maven  ← rolls up into Personal Brand
  ├── Recruiter
  ├── Section4
  ├── TMS
  ├── WDAI
  └── Workday

4- Financial
  ├── Ally
  ├── Investments
  ├── Robinhood
  ├── Shopping
  └── Tax

5- Side
  ├── Little Brown Diary LBD
  ├── Mission
  │   ├── CMNY  ← rolls up into Mission
  │   ├── Fremont  ← rolls up into Mission
  │   ├── MSC  ← rolls up into Mission
  │   ├── SMT  ← rolls up into Mission
  │   └── Thoughts  ← rolls up into Mission
  └── Moms in Tech MinTs

6- Friends  (no sub-labels)

7- House
  ├── Bills
  ├── Car
  ├── HOA
  └── Moving
      └── Furniture  ← rolls up into Moving

8- Family
  ├── Book
  ├── Hari
  ├── Health
  ├── Vacation
  ├── Values
  └── Wedding
      ├── Engagement  ← rolls up into Wedding
      ├── Honeymoon  ← rolls up into Wedding
      └── Reception  ← rolls up into Wedding

9- Random
  ├── Accounts
  ├── American Desis
  ├── Classes
  ├── College
  ├── Ludejo
  ├── Narika
  ├── Newsletters
  ├── Podcasts
  └── Tutoring

cc-automated  (no sub-labels)
Chatting  (no sub-labels)
```

The hierarchy is re-derived at runtime from `users.labels.list()` — the above is documentation, not hardcoded config.

---

## Technical Architecture

### Extension Files
```
gmail-label-tabs/
  manifest.json          Chrome Manifest V3
  background.js          Service worker — token retrieval and invalidation
  lib/
    api-client.js        Typed Gmail API and bounded summary requests
    cache.js             Per-entry Chrome Storage TTL cache
    injector.js          Route, data, render, and Gmail lifecycle coordinator
    label-hierarchy.js   Dynamic label tree and rollups
    layout.js            Body-portal placement, spacing, and cleanup
    pill-bar.js          Pill DOM renderer
    search-query.js      Canonical Gmail queries and route parsing
  styles.css             Pill bar styles (brand palette)
  popup/                 Minimal "Connect Gmail" popup
```

### Authentication
- OAuth 2.0 via `chrome.identity.getAuthToken()`
- Scope: `https://www.googleapis.com/auth/gmail.readonly`
- One-time sign-in via extension popup; token cached by Chrome
- A 401 evicts the rejected token and retries silently once; persistent auth failures show a reconnect message

### Data Flow
1. **Label list:** `GET /gmail/v1/users/me/labels` → build hierarchy tree
2. **Top-level summaries:** `GET /threads?q=<canonical query>&maxResults=1` with bounded concurrency → presence and unread estimates
3. **Child summaries:** fetched lazily with the same queries when a parent is selected
4. **Render:** append a fixed portal to `document.body`; reserve its exact height above the current Gmail list anchor
5. **Click — category/sub-label:** navigate to the canonical `#search/<encoded query>` route; Gmail renders the results
6. **Route reconciliation:** derive active pills from inbox or an exact extension-generated search; unmount for threads and arbitrary searches
7. **Refresh:** labels refresh hourly, summaries every minute, and transient failures retry after 30 seconds without requiring a page reload

### Gmail DOM Injection Strategy
- A throttled body `MutationObserver` discovers Gmail list-anchor replacement
- The portal stays outside Gmail's message-row subtree and never hides or rewrites rows
- A `ResizeObserver` plus window resize handling reconciles wrapper height and list geometry
- Semantic grid/toolbar roles are preferred; unstable anchors fail closed and leave Gmail untouched
- Hash changes mount on inbox/owned searches and teardown on conversations or unrelated routes

### Scale
- Filtering and pagination are entirely Gmail-native
- Pill visibility is not capped at the first 100 or 1000 inbox messages
- Summary calls request one thread plus `resultSizeEstimate`; API estimates affect badges only, never which Gmail results are displayed

---

## Visual Design

All values from `BRAND_GUIDELINES.md` in `inspiration-repo`:

| Token | Value | Usage |
|---|---|---|
| `--cream` | `#F5F2E8` | Inactive pill background, pill bar background |
| `--surface` | `#FAFAF8` | Sub-pill row background |
| `--border` | `#E8E4D9` | Pill borders, dividers |
| `--charcoal` | `#2B2B2B` | Active pill text |
| `--taupe` | `#7A7469` | Inactive pill text |
| `--teal` | `#1A9E96` | Active category pill fill, active sub-pill text/border |
| `--muted` | `#AEAAA0` | Unlabeled pill, zero-count states |
| Font UI | `DM Sans` | All pill text |

Label display names: strip the numeric prefix (`1 - Sandhya` → `Sandhya`, `3- Career` → `Career`).

---

## Success Criteria

Automated:

- [x] Every category/sub-label query is inbox-scoped and includes all descendants
- [x] Pills navigate through Gmail search; the extension never hides Gmail rows
- [x] All Inbox and Unlabeled produce canonical Gmail routes
- [x] Parent and child visibility is not capped by a first-100-message crawl
- [x] 3-level labels roll up into their direct parent sub-label
- [x] Cache expiry and fatal-load retry wake a long-lived tab without a reload
- [x] Thread routes, including paginated-thread shapes, unmount the bar
- [x] Layout spacing does not compound and restores or preserves host padding safely

Pending real-Gmail verification:

- [ ] Bar appears without overlapping Gmail in every supported density, zoom, and sidebar state
- [ ] Parent, child, Unlabeled, and All Inbox results match the equivalent typed Gmail searches
- [ ] Thread → Back/Forward restores the correct bar and active state
- [ ] Gmail menus, search, message rows, and keyboard interaction remain unaffected

---

## Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| Gmail API rate limit or transient failure | Keep the last good data when available; retry after 30s; never cache fallback summaries |
| OAuth token expired | Evict the rejected token and retry silently once; if it still fails, direct the user to the extension popup |
| No inbox emails | Pill bar not rendered; Gmail displays normally |
| All inbox emails are unlabeled | Only "Unlabeled" pill shown |
| Gmail DOM structure changes (Gmail update) | Extension fails gracefully — Gmail shows normally, no crash. Log injection failure to console. |
| Large inbox | Gmail owns result pagination; thread queries are not capped by a local message crawl |
| Label renamed in Gmail | Re-derived on the hourly label refresh or the next content-script load |
| Sub-label with no parent match | Treated as top-level label |

---

## Decisions Log

- **2026-06-07** [UI Pattern] — Decision: Option C (floating pill bar). Rejected: Option A (horizontal tab bar — too crowded with 12 labels), Option B (sidebar accordion — redundant with Gmail's existing label nav). Because: pills are horizontally scrollable, visually distinct from Gmail chrome, and take minimal screen space.
- **2026-06-07** [Sub-label depth] — Decision: max 2 visible levels (category pill + sub-label pill). 3rd-level labels roll up into their parent sub-label silently. Because: 3-level pill UI is too complex; rollup preserves discoverability without adding a 3rd row.
- **2026-06-07** [Dynamic visibility] — Decision: only show pills for labels with ≥1 inbox email right now. Rejected: static list of all labels. Because: user wants the bar to reflect actual inbox state, not a menu of every label they've ever created.
- **2026-06-07** [Data approach] — Decision: Gmail API (readonly scope) + OAuth. Rejected: DOM scraping of Gmail's label sidebar. Because: true rollup across sub-labels requires knowing each message's full label set, which only the API provides.
- **2026-06-07** [Label name display] — Decision: strip numeric prefix for display (`3- Career` → `Career`). Because: numbers are Gmail sort-order hacks, not meaningful to the user in a visual UI.

---

## Implementation Addendum — 2026-07-02

The v1 implementation drifted from this PRD by hiding rendered Gmail rows using label-name substring matching. That behavior was removed in v1.1.

- Pill clicks now use the Gmail search queries specified in this design.
- Gmail owns filtering, pagination, thread rendering, and result interaction.
- The extension uses thread-query estimates for pill visibility and unread badges instead of crawling the first 100 message details.
- The pill bar remains a body-mounted portal, with a dedicated layout controller that reserves its height and reconciles resize, navigation, and Gmail anchor replacement.
- Arbitrary Gmail searches do not show the bar; inbox and exact extension-generated searches do.
- The Technical Architecture, Success Criteria, and Failure Modes above now describe v1.1; earlier message-crawl and DOM-row-filtering plans are superseded.
