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
  background.js          Service worker — handles OAuth token flow
  content.js             Injected into mail.google.com — main UI logic
  styles.css             Pill bar styles (brand palette)
  popup.html / popup.js  Minimal popup: "Sign in with Google" button
  icons/                 16, 48, 128px icons
```

### Authentication
- OAuth 2.0 via `chrome.identity.getAuthToken()`
- Scope: `https://www.googleapis.com/auth/gmail.readonly`
- One-time sign-in via extension popup; token cached by Chrome

### Data Flow
1. **Label list:** `GET /gmail/v1/users/me/labels` → build hierarchy tree
2. **Inbox messages:** `GET /gmail/v1/users/me/messages?labelIds=INBOX&maxResults=500` → get message IDs + labelIds (use `format=metadata`)
3. **Active label set:** reduce all returned labelIds → determine which hierarchy nodes have ≥1 inbox email
4. **Unread counts:** count messages where `UNREAD` labelId is present, per active label node
5. **Render:** inject pill bar HTML into Gmail's inbox DOM
6. **Click — category pill:** filter displayed messages to those matching parent label OR any descendant label IDs
7. **Click — sub-label pill:** filter to that sub-label + its grandchildren label IDs

### Gmail DOM Injection Strategy
- MutationObserver on `document.body` to detect Gmail's inbox load (Gmail is a SPA)
- Inject pill bar immediately before Gmail's email list container
- Hide Gmail's native "Primary / Promotions / Social" tab bar via CSS override
- On URL hash change (`#inbox` → `#label/X`), re-evaluate and re-render

### Pagination
- Fetch up to 500 inbox messages per load (covers typical inbox sizes)
- If `nextPageToken` exists, fetch one more page (1000 messages max)
- Display note if inbox exceeds 1000 unread — rare edge case

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

- [ ] Pill bar appears on Gmail inbox load within 1 second of emails rendering
- [ ] Only labels with ≥1 inbox email are shown as pills
- [ ] Clicking a category pill filters the email list to show all emails matching that label or any descendant label
- [ ] Sub-label pills appear on category pill click; show only sub-labels with ≥1 inbox email
- [ ] "All [Category]" sub-pill always appears first and shows the full rollup
- [ ] Unread counts on pills are accurate
- [ ] 3-level labels roll up silently into their parent sub-label
- [ ] Unlabeled pill shows emails with no user-created label
- [ ] Gmail's native Primary/Social/Promotions tabs are hidden
- [ ] Extension survives Gmail's SPA navigation (inbox → email → back to inbox)

---

## Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| Gmail API rate limit hit | Show pills from last successful fetch; retry after 30s |
| OAuth token expired | Silently refresh via `chrome.identity.getAuthToken({interactive: false})`; if fails, show "reconnect" button in pill bar |
| No inbox emails | Pill bar not rendered; Gmail displays normally |
| All inbox emails are unlabeled | Only "Unlabeled" pill shown |
| Gmail DOM structure changes (Gmail update) | Extension fails gracefully — Gmail shows normally, no crash. Log injection failure to console. |
| Inbox > 1000 emails | Fetch 2 pages (1000 max); show pill bar based on those. Edge case note shown if truncated. |
| Label renamed in Gmail | Resolved on next inbox load — hierarchy is always re-derived live |
| Sub-label with no parent match | Treated as top-level label |

---

## Decisions Log

- **2026-06-07** [UI Pattern] — Decision: Option C (floating pill bar). Rejected: Option A (horizontal tab bar — too crowded with 12 labels), Option B (sidebar accordion — redundant with Gmail's existing label nav). Because: pills are horizontally scrollable, visually distinct from Gmail chrome, and take minimal screen space.
- **2026-06-07** [Sub-label depth] — Decision: max 2 visible levels (category pill + sub-label pill). 3rd-level labels roll up into their parent sub-label silently. Because: 3-level pill UI is too complex; rollup preserves discoverability without adding a 3rd row.
- **2026-06-07** [Dynamic visibility] — Decision: only show pills for labels with ≥1 inbox email right now. Rejected: static list of all labels. Because: user wants the bar to reflect actual inbox state, not a menu of every label they've ever created.
- **2026-06-07** [Data approach] — Decision: Gmail API (readonly scope) + OAuth. Rejected: DOM scraping of Gmail's label sidebar. Because: true rollup across sub-labels requires knowing each message's full label set, which only the API provides.
- **2026-06-07** [Label name display] — Decision: strip numeric prefix for display (`3- Career` → `Career`). Because: numbers are Gmail sort-order hacks, not meaningful to the user in a visual UI.
