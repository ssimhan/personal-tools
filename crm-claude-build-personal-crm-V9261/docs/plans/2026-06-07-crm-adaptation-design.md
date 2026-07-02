# CRM Adaptation — Product Requirements Document
**Date:** 2026-06-07
**Branch:** CRM
**Status:** Design approved — ready for /plan

---

## Goal

Adapt an existing personal CRM (built by a friend) into a mobile-first PWA tailored for managing both professional and personal relationships. The core value is relationship memory: never forget who someone is, what you talked about, or how long it's been since you connected.

---

## Audience

Single user (Sandhya). Accesses primarily via:
- **Mobile** (PWA, installed to home screen) — dominant use case
- **Desktop browser** — secondary, deeper editing and browsing
- **Chrome extension** — LinkedIn context and quick-add (existing, kept)

---

## What We're NOT Building

- Broadcast / bulk email sending (removed entirely)
- Semantic / vector search via OpenAI (removed; structured search only)
- Gmail inbox sync (Phase 2 roadmap item — not in this build)
- Native iOS/Android app (PWA covers mobile need)
- Multi-user / team features (single-user product)
- Public contact form `/c/[token]` — evaluate whether to keep or remove during build

---

## Core Requirements

### 1. Relationship Type Field
- New field on `people`: `relationship_type` enum — `professional | personal | acquaintance`
- Fully editable dropdown on contact detail (can change any time)
- Shown as a colored badge everywhere a contact appears
  - Professional → blue
  - Personal → pink
  - Acquaintance → grey
- Filter chip on People list and Search screen

### 2. Keep In Touch Cadence (per contact)
- New field on `people`: `keep_in_touch_cadence` enum — `biweekly | monthly | quarterly | every_6_months | annual | every_18_months | none`
- Set per-contact on their detail page (Details tab)
- System computes `cadence_due_at` = `last_interaction_at + cadence interval`
- Contact is "overdue" when `now > cadence_due_at`
- "Days overdue" = `now - cadence_due_at`

### 3. Mobile PWA
- `manifest.json` + service worker for installability
- App shell cached for offline reading (contact list, individual contact pages)
- Writes require network connection
- `theme-color`, `display: standalone`, icons at 192px and 512px
- Viewport optimized for 375px–430px widths (iPhone range)

### 4. Mobile Navigation — Bottom Nav Bar
Five tabs, always visible on mobile:
```
[ People ] [ Feed ] [ + ] [ Search ] [ Admin ]
```
- **People** — contact list (default home on mobile)
- **Feed** — activity timeline (existing feature)
- **+** — bottom sheet with Quick Actions
- **Search** — dedicated search screen
- **Admin** — tags management, import, Google Contacts sync

Bottom nav hidden on desktop (replaced by sidebar).

### 5. People List (Mobile Home)
- Default sort: **overdue first**, then by days-since-last-interaction descending
- Two visual sections: "⚠ Overdue" (red header) and "Recent" (grey header)
- Each row shows: avatar, name, company/context, cadence label, relationship badge, overdue status
- Filter chips at top: All / Work / Personal / Acquaintance
- No cadence set → contacts appear in "Recent" section sorted by last interaction

### 6. Contact Detail Page — Tabbed Layout
Three tabs: **Timeline | Notes | Details**

**Header (always visible above tabs):**
- Back button, star/bookmark, edit, overflow menu
- Avatar, name, job title/company
- Relationship type badge + overdue indicator
- Channel icon buttons row (tappable): Email · Phone · LinkedIn · WhatsApp · Slack
- Tags row with inline `+ tag` button

**Timeline tab:**
- Log Interaction button (prominent, top)
- Chronological interaction list — each item has type icon, content, date
- Interaction types: note 📝 · email ✉️ · screenshot 📷 · LinkedIn 💼
- AI summary card (below interactions)

**Notes tab:**
- Permanent notes (human-owned, authoritative) — large inline textarea, auto-saves
- Claude never overwrites permanent notes

**Details tab:**
- Primary email, secondary emails, phone
- LinkedIn URL
- Preferred channel selector
- Slack channel
- Keep In Touch cadence selector (biweekly / monthly / quarterly / 6 months / annual / 18 months / none)
- Relationship type selector

### 7. Quick Actions Bottom Sheet (+ button)
Three actions:
1. **Log an interaction** — search for contact → text area → type selector → submit
2. **Add new contact** — name, email/LinkedIn (minimum), relationship type, cadence
3. **Scan business card** — camera capture → Claude OCR → pre-filled add form

### 8. Desktop Layout — Keep In Touch Board (Home)
- Left sidebar nav: Keep In Touch · People · Feed · Search · Import · Admin
- **Keep In Touch board is the desktop home screen**
- Kanban-style columns: Overdue · Biweekly · Monthly · Quarterly · 6 Months · Annual · 18 Months · No cadence
- Overdue column: red header, red-tinted cards, "Xd late" label
- Other columns: due-in countdown label
- Click a card → navigate to contact detail

### 9. Search Screen
- Text input: name, company search (structured, no semantic/vector)
- Filter chips: relationship type
- Recency filter: Any / This week / This month / 30+ days / Never
- Tag browser grid
- Results list (same card style as People list)

### 10. Remove Broadcast Feature
- Delete: `/app/(app)/broadcast/`, `/app/api/broadcast/`, `broadcast-picker.tsx`, `ask-picker.tsx`
- Remove `last_broadcast_at`, `broadcast_months`, `accepts_asks` fields from search/display
- Keep `broadcast_sent` interaction type in DB for backwards compat (just don't create new ones)
- Remove broadcast-related filter options from search

### 11. Remove OpenAI / Semantic Search
- Delete: `lib/ai/openai.ts`
- Remove `semantic_embedding` column usage from search (keep column in DB, just stop writing/reading)
- Remove `match_people` RPC call from search
- Search falls back to structured-only: name ilike, company ilike, tag join
- Remove `OPENAI_API_KEY` and `EMBEDDING_MODEL` from env and config

### 12. Keep (unchanged)
- Claude AI relationship summaries (regenerated on every logged interaction)
- Claude OCR for screenshots and business card scanning
- Claude identity resolution for inbound BCC emails
- Inbound email BCC logging (Postmark webhook)
- Chrome extension (LinkedIn sidebar + search)
- Tags system (admin-managed)
- Import (CSV)
- Google Contacts sync (admin page)
- Feed / activity timeline

---

## Data Model Changes

### `people` table — add columns
```sql
ALTER TABLE public.people
  ADD COLUMN relationship_type text
    CHECK (relationship_type IN ('professional','personal','acquaintance')),
  ADD COLUMN keep_in_touch_cadence text
    CHECK (keep_in_touch_cadence IN (
      'biweekly','monthly','quarterly',
      'every_6_months','annual','every_18_months'
    ));
-- NULL cadence = "none" (no keep-in-touch tracking)
```

### Computed value (no DB column needed)
- `cadence_due_at` — computed in application code: `last_interaction_at + interval`
- `is_overdue` — computed: `now() > cadence_due_at`
- `days_overdue` — computed: `floor((now - cadence_due_at) / 86400)`

### Cadence interval map (application code)
```
biweekly       → 14 days
monthly        → 30 days
quarterly      → 90 days
every_6_months → 180 days
annual         → 365 days
every_18_months→ 540 days
```

---

## Success Criteria

- [ ] Install to iPhone home screen as PWA — opens full-screen, no browser chrome
- [ ] People list loads on mobile showing overdue contacts first with red indicators
- [ ] Can log a quick note from mobile in under 10 seconds (+ → Log → find contact → type → submit)
- [ ] Contact detail shows channel buttons that deep-link to correct app (mailto:, tel:, linkedin://)
- [ ] Keep In Touch board is the first screen on desktop
- [ ] Relationship type is settable and visible everywhere
- [ ] Cadence is settable per contact; overdue state is accurate
- [ ] No OpenAI calls anywhere in the codebase
- [ ] No broadcast UI anywhere in the app
- [ ] Chrome extension still works (no regression)
- [ ] BCC email logging still works (no regression)

---

## Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| Contact has no `last_interaction_at` (just imported) | Treat as never contacted — show at top of overdue list if cadence set, else in "no cadence" section |
| Cadence set but `last_interaction_at` is null | Due date = `created_at + cadence interval` |
| PWA offline — user tries to log interaction | Show friendly "you're offline" toast; interaction not saved |
| Business card OCR returns low confidence | Surface low-confidence fields highlighted in yellow for manual review |
| Relationship type not set (existing contacts) | Default display: no badge (null state) — user prompted to set it on detail page |
| Channel button tapped but no value stored | Button disabled / greyed out for that channel |

---

## Phased Roadmap

### Phase 1 (this build)
All requirements above.

### Phase 2 (future)
- Gmail inbox sync (OAuth + Google People API) — auto-log emails without BCC
- Semantic search — replace OpenAI with an alternative provider (Supabase Edge Functions + open-source model, or another embeddings API); keep `semantic_embedding` column in DB so re-embedding is possible without a schema migration
- Reminders / push notifications for overdue contacts (requires backend job)
- Birthday tracking

---

## Mockup Reference
`docs/mockups/mobile-crm.html` — approved 2026-06-07
