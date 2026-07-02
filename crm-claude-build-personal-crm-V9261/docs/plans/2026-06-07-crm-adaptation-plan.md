# CRM Adaptation — Implementation Plan
**Date:** 2026-06-07  
**PRD:** `docs/plans/2026-06-07-crm-adaptation-design.md`  
**Mockup:** `docs/mockups/mobile-crm.html` (approved)  
**Branch:** `CRM`

---

## Header

**Goal:** Adapt the friend's personal CRM into a mobile-first PWA with relationship type classification, per-contact Keep In Touch cadences, a Dex-inspired kanban board for desktop, and removal of broadcast/OpenAI dependencies.

**Architecture:** Extend the existing Next.js 15 App Router structure in-place. New fields added via Supabase migration. New UI built as new components/pages layered onto existing routes. Removed code deleted cleanly rather than feature-flagged.

**Design Patterns:** Server Components for data fetching, Client Components (`"use client"`) for interactivity, fetch-to-API-route for mutations, `useTransition` + `router.refresh()` for optimistic-ish updates. No new state management library.

**Tech Stack:** Next.js 15, Supabase, Tailwind CSS, shadcn-style primitives (already in repo), Claude AI (unchanged), TypeScript.

**Test command (no test runner — use typecheck):**
```
npm run typecheck
```
Every chunk's RED step is a typecheck failure (or a visible broken state). GREEN is typecheck passing + visual verification.

---

## Conventions (observed from codebase)

- Named exports everywhere (`export function Foo`)
- `"use client"` at top of any interactive component
- Mutations: `fetch("/api/...")` → `useTransition` → `router.refresh()`
- Error display: inline `setError(...)` state rendered as `<p className="text-sm text-destructive">` — no toast library
- Imports: `@/` alias, named imports from `@/components/ui/*`, `@/lib/*`
- API routes: always call `requireUser()` or `requireUserOrApiKey()` first
- Types defined inline or in the file that uses them — no separate `types/` directory yet (we add `lib/types.ts`)
- Tailwind: utility-first, no custom CSS files beyond `globals.css`

---

## Block 1 — Database Migration

**Goal:** Add `relationship_type` and `keep_in_touch_cadence` columns to the `people` table.

**Success Criteria:**
- [ ] Migration file exists and is valid SQL
- [ ] Columns exist in remote Supabase project
- [ ] `npm run typecheck` passes after types reference new fields

---

### Chunk 1.1 — Write migration SQL

**Files:** Create `supabase/migrations/0015_relationship_and_cadence.sql`

```sql
-- Add relationship type and keep-in-touch cadence to people.
-- Both are nullable — existing contacts get NULL (no badge / no cadence).
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS relationship_type text
    CHECK (relationship_type IN ('professional', 'personal', 'acquaintance')),
  ADD COLUMN IF NOT EXISTS keep_in_touch_cadence text
    CHECK (keep_in_touch_cadence IN (
      'biweekly', 'monthly', 'quarterly',
      'every_6_months', 'annual', 'every_18_months'
    ));

-- Index for filtering by relationship type
CREATE INDEX IF NOT EXISTS people_relationship_type_idx
  ON public.people(owner_id, relationship_type)
  WHERE relationship_type IS NOT NULL;
```

**Step 1 (RED):** File doesn't exist yet — typecheck passes but migration is not applied.

**Step 2 (Apply):** In Supabase dashboard → SQL editor, paste and run the migration. Verify columns appear in Table Editor under `people`.

**Step 3 (GREEN):** Confirm columns exist. Typecheck still passes (no code references them yet).

**Commit:**
```
git add supabase/migrations/0015_relationship_and_cadence.sql
git commit -m "db: add relationship_type and keep_in_touch_cadence columns to people"
```

---

## Block 2 — Remove Broadcast & OpenAI

**Goal:** Delete all broadcast UI/API code and the OpenAI dependency. Leave `semantic_embedding` column in DB untouched for Phase 2.

**Success Criteria:**
- [ ] No import of `resend`, `openai`, or broadcast routes anywhere
- [ ] `lib/ai/openai.ts` deleted
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes (no dead import references)

---

### Chunk 2.1 — Delete broadcast files

**Files:** Delete the following:
- `app/(app)/broadcast/` (entire directory)
- `app/api/broadcast/` (entire directory)
- `app/(app)/_components/broadcast-picker.tsx`
- `app/(app)/_components/ask-picker.tsx`
- `app/(app)/_components/footer-copy-button.tsx`

**Step 1 (RED):** `npm run typecheck` — will show errors for any remaining imports of these files.

```bash
rm -rf "app/(app)/broadcast" "app/api/broadcast"
rm "app/(app)/_components/broadcast-picker.tsx"
rm "app/(app)/_components/ask-picker.tsx"
rm "app/(app)/_components/footer-copy-button.tsx"
```

**Step 2:** Fix any broken imports (check `_contact-editor.tsx` which imports `ask-picker`):
- `app/(app)/people/[id]/_contact-editor.tsx` — remove `TextMethodPicker` import and usage; remove `text_method` from the editor (it's an obscure field, drop it).

**Step 3 (GREEN):** `npm run typecheck` passes.

**Commit:**
```
git commit -m "chore: remove broadcast feature and ask-picker components"
```

---

### Chunk 2.2 — Remove OpenAI from search and config

**Files:**
- Delete `lib/ai/openai.ts`
- Modify `lib/search.ts` — remove `rankedQuery`, `embed` call, `match_people` RPC; search becomes browse-only
- Modify `lib/config.ts` — remove `embeddingModel`, `semanticSimilarityFloor`, `resendFromEmail`; update `requireApiKeys()` to only require `anthropic`
- Modify `lib/pipeline.ts` — remove `embed` and `buildEmbeddingInput` calls; stop writing `semantic_embedding`

**lib/config.ts changes:**
- Remove `embeddingModel`, `semanticSimilarityFloor`, `resendFromEmail` fields
- `requireApiKeys()` returns only `{ anthropic: required("ANTHROPIC_API_KEY") }`

**lib/search.ts changes:**
- Delete `rankedQuery()`, `candidateIdsFor()`, `structuredQueryMatch()`
- Delete `import { embed }` line
- `search()` function: always calls `browseQuery()` (remove `browseMode` branch)
- Remove `SearchSort.key === "broadcast"` and `"broadcast_months"` cases
- Remove `BroadcastFilter` type and `broadcastMonths` from `SearchFilters`
- Remove `last_broadcast_at`, `broadcast_months`, `short_token`, `contact_token` from `PEOPLE_COLS` and `SearchHit`
- Remove `acceptsAsksYes` filter (was tied to broadcast)

**lib/pipeline.ts changes:**
- Remove `import { embed, buildEmbeddingInput }` 
- In `logInteractionAndProcess`: after `regenerateSummary`, skip the `embed` call; just update `relationship_summary` and `relationship_summary_previous` (no `semantic_embedding` write)
- Delete `regenerateEmbeddingForPerson()` export
- Delete `applyManualSummaryEdit()` embed call (still update summary, skip embedding)
- Delete `revertSummary()` embed call (same)

**Step 1 (RED):** Delete `lib/ai/openai.ts`, run `npm run typecheck` — shows missing module errors.

**Step 2:** Apply all the above changes.

**Step 3 (GREEN):** `npm run typecheck` passes. `npm run build` passes.

**Commit:**
```
git commit -m "chore: remove OpenAI dependency; search is structured-only until Phase 2"
```

---

### Chunk 2.3 — Update nav to remove Broadcast link

**Files:** Modify `app/(app)/_components/nav.tsx`

Remove `/broadcast` from the `TABS` array. The nav now has: Search, Feed, Admin.

```ts
const TABS = [
  { href: "/", label: "People" },      // rename Search → People
  { href: "/feed", label: "Feed" },
];
```

**Step 1 (RED):** Visual — Broadcast link still visible.
**Step 2:** Apply change.
**Step 3 (GREEN):** `npm run typecheck` passes. Nav shows People + Feed + Admin.

**Commit:**
```
git commit -m "chore: remove broadcast nav link; rename Search to People"
```

---

## Block 3 — Core Types & Cadence Utilities

**Goal:** Single source of truth for the new enum values and cadence math.

**Success Criteria:**
- [ ] `RELATIONSHIP_TYPES` and `CADENCE_OPTIONS` exported as const arrays
- [ ] `computeCadenceStatus()` returns `{ dueAt, isOverdue, daysOverdue }` correctly
- [ ] TypeScript types derived from const arrays (no drift)

---

### Chunk 3.1 — lib/types.ts

**Files:** Create `lib/types.ts`

```ts
export const RELATIONSHIP_TYPES = ['professional', 'personal', 'acquaintance'] as const;
export type RelationshipType = typeof RELATIONSHIP_TYPES[number];

export const CADENCE_OPTIONS = [
  'biweekly', 'monthly', 'quarterly',
  'every_6_months', 'annual', 'every_18_months',
] as const;
export type CadenceOption = typeof CADENCE_OPTIONS[number];

export const CADENCE_DAYS: Record<CadenceOption, number> = {
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  every_6_months: 180,
  annual: 365,
  every_18_months: 540,
};

export const CADENCE_LABELS: Record<CadenceOption, string> = {
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
  quarterly: 'Every 3 months',
  every_6_months: 'Every 6 months',
  annual: 'Annually',
  every_18_months: 'Every 18 months',
};

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  professional: 'Professional',
  personal: 'Personal',
  acquaintance: 'Acquaintance',
};

export interface CadenceStatus {
  dueAt: Date | null;       // null if no cadence or no last_interaction_at
  isOverdue: boolean;
  daysOverdue: number;      // 0 if not overdue
  daysUntilDue: number;     // 0 if overdue
}
```

**Step 1 (RED):** File doesn't exist — any import of it fails typecheck.
**Step 2:** Create the file.
**Step 3 (GREEN):** `npm run typecheck` passes.

**Commit:**
```
git commit -m "feat: add relationship type and cadence type definitions"
```

---

### Chunk 3.2 — lib/cadence.ts

**Files:** Create `lib/cadence.ts`

```ts
import { CADENCE_DAYS, type CadenceOption, type CadenceStatus } from '@/lib/types';

export function computeCadenceStatus(
  cadence: CadenceOption | null | undefined,
  lastInteractionAt: string | null | undefined,
  createdAt: string,
): CadenceStatus {
  if (!cadence) return { dueAt: null, isOverdue: false, daysOverdue: 0, daysUntilDue: 0 };

  const intervalDays = CADENCE_DAYS[cadence];
  const anchor = lastInteractionAt ? new Date(lastInteractionAt) : new Date(createdAt);
  const dueAt = new Date(anchor.getTime() + intervalDays * 86_400_000);
  const now = new Date();
  const diffMs = now.getTime() - dueAt.getTime();
  const isOverdue = diffMs > 0;
  const daysOverdue = isOverdue ? Math.floor(diffMs / 86_400_000) : 0;
  const daysUntilDue = isOverdue ? 0 : Math.ceil(-diffMs / 86_400_000);

  return { dueAt, isOverdue, daysOverdue, daysUntilDue };
}

export function formatDaysOverdue(days: number): string {
  if (days === 0) return 'Due today';
  return `${days}d overdue`;
}

export function formatDaysUntilDue(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}
```

**Step 1 (RED):** Import fails until file exists.
**Step 2:** Create file.
**Step 3 (GREEN):** `npm run typecheck` passes.

**Commit:**
```
git commit -m "feat: add cadence computation utilities"
```

---

## Block 4 — PWA Setup

**Goal:** Make the app installable as a PWA on mobile (home screen icon, standalone display, cached shell).

**Success Criteria:**
- [ ] `manifest.json` present and linked in `<head>`
- [ ] Chrome DevTools → Application → Manifest shows no errors
- [ ] "Add to Home Screen" prompt appears on mobile Safari/Chrome

---

### Chunk 4.1 — manifest.json + metadata

**Files:**
- Create `public/manifest.json`
- Modify `app/layout.tsx`

**public/manifest.json:**
```json
{
  "name": "My CRM",
  "short_name": "CRM",
  "description": "Personal relationship memory layer",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a1a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

**app/layout.tsx** — update `metadata` export and add manifest link:
```ts
export const metadata: Metadata = {
  title: 'My CRM',
  description: 'Personal relationship memory layer',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'My CRM' },
  viewport: { width: 'device-width', initialScale: 1, maximumScale: 1 },
};
```

**Icons:** Copy existing extension icons as placeholders: `extension/icons/icon-128.png` → `public/icons/icon-192.png` and `icon-512.png`. Replace with proper icons before production deploy.

**Step 1 (RED):** `manifest.json` missing → Chrome shows manifest warning.
**Step 2:** Create files.
**Step 3 (GREEN):** DevTools Application tab shows valid manifest. `npm run typecheck` passes.

**Commit:**
```
git commit -m "feat: add PWA manifest and web app metadata"
```

---

## Block 5 — Layout Restructure (Sidebar + Bottom Nav)

**Goal:** Replace the top header nav with a desktop sidebar + mobile bottom nav bar.

**Success Criteria:**
- [ ] Desktop (≥768px): left sidebar with logo and nav links, no top nav
- [ ] Mobile (<768px): no sidebar, bottom nav bar with 5 tabs
- [ ] Active tab highlighted correctly on both layouts
- [ ] Sign out accessible on both layouts

---

### Chunk 5.1 — Desktop sidebar component

**Files:** Create `app/(app)/_components/sidebar.tsx`

Named exports:
- `Sidebar` — server component, receives `signOut` action
- Links: Keep In Touch (`/keep-in-touch`), People (`/`), Feed (`/feed`), Search (`/search`), Import (`/import`), Admin (`/admin`)
- Active state via `usePathname()` (needs `"use client"` wrapper for the active logic)

Structure:
```tsx
"use client";
// logo + nav links + sign out at bottom
// w-56 fixed left sidebar, hidden on mobile (hidden md:flex)
```

**Step 1 (RED):** Layout still uses old `<Nav>` component — no sidebar visible.
**Step 2:** Create `sidebar.tsx`.
**Step 3 (GREEN):** `npm run typecheck` passes.

---

### Chunk 5.2 — Mobile bottom nav component

**Files:** Create `app/(app)/_components/bottom-nav.tsx`

```tsx
"use client";
// Fixed bottom bar, only visible on mobile (flex md:hidden)
// 5 items: People (/) | Feed (/feed) | + (quick actions) | Search (/search) | Admin (/admin)
// The + button opens QuickActionsSheet (built in Block 10)
// Active state via usePathname()
```

Tabs in order:
```
People  Feed  [+]  Search  Admin
👥      📋   (+)   🔍      ⚙️
```

Note: `+` button is a state toggle (opens sheet), not a link. The sheet is rendered as a sibling.

---

### Chunk 5.3 — Update app layout

**Files:** Modify `app/(app)/layout.tsx`

Replace the `<header>` + `<Nav>` with:
```tsx
<div className="min-h-screen md:flex">
  <Sidebar signOut={signOut} />             {/* hidden on mobile */}
  <main className="flex-1 md:ml-56 pb-20 md:pb-0 max-w-4xl mx-auto px-4 py-6">
    {children}
  </main>
  <BottomNav />                              {/* hidden on desktop */}
</div>
```

`pb-20 md:pb-0` on main gives space for the bottom nav on mobile.

**Step 1 (RED):** Old nav still present.
**Step 2:** Apply changes.
**Step 3 (GREEN):** `npm run typecheck` passes. Visual: sidebar on desktop, bottom nav on mobile.

**Commit:**
```
git commit -m "feat: add desktop sidebar and mobile bottom nav; replace top header nav"
```

---

## Block 6 — Relationship Type & Cadence — API + Selectors

**Goal:** Wire the new fields into the PATCH API and build reusable selector components.

**Success Criteria:**
- [ ] `PATCH /api/people/[id]` accepts and saves `relationship_type` and `keep_in_touch_cadence`
- [ ] `RelationshipTypeSelect` component renders and calls the API on change
- [ ] `CadenceSelect` component renders and calls the API on change

---

### Chunk 6.1 — Update PATCH /api/people/[id]

**Files:** Modify `app/api/people/[id]/route.ts`

In the PATCH handler, extend the allowed patch fields to include:
```ts
const allowed = ['linkedin_url', 'phone_number', 'slack_channel',
  'preferred_channel', 'full_name', 'company',
  'relationship_type', 'keep_in_touch_cadence'];
```

Validate `relationship_type` against `RELATIONSHIP_TYPES` and `keep_in_touch_cadence` against `CADENCE_OPTIONS` from `lib/types.ts`. Return 400 if invalid value supplied.

**Step 1 (RED):** API ignores the new fields — saving them silently does nothing.
**Step 2:** Apply changes.
**Step 3 (GREEN):** `npm run typecheck` passes. Manual test: PATCH with `{ relationship_type: "professional" }` returns 200 and saves.

**Commit:**
```
git commit -m "feat: accept relationship_type and keep_in_touch_cadence in PATCH /api/people/[id]"
```

---

### Chunk 6.2 — RelationshipTypeSelect component

**Files:** Create `app/(app)/_components/relationship-type-select.tsx`

```tsx
"use client";
// Props: personId, currentValue: RelationshipType | null
// Renders a <select> or button group (3 options + "None")
// On change: PATCH /api/people/[id] with { relationship_type }
// Shows inline saving/error state
// Used on contact detail → Details tab
```

Badge colors (Tailwind):
- professional → `bg-blue-100 text-blue-700`
- personal → `bg-pink-100 text-pink-700`
- acquaintance → `bg-gray-100 text-gray-600`
- null → no badge

Also export a `RelationshipBadge` component for read-only display in lists.

---

### Chunk 6.3 — CadenceSelect component

**Files:** Create `app/(app)/_components/cadence-select.tsx`

```tsx
"use client";
// Props: personId, currentValue: CadenceOption | null
// Renders a native <select> with CADENCE_OPTIONS + "None"
// On change: PATCH /api/people/[id] with { keep_in_touch_cadence }
// Shows inline saving/error state
// Used on contact detail → Details tab
```

**Commit (6.2 + 6.3 together):**
```
git commit -m "feat: add RelationshipTypeSelect, RelationshipBadge, and CadenceSelect components"
```

---

## Block 7 — People List (Mobile Home)

**Goal:** Transform the home page from a search-first view to a contact list sorted overdue-first, with relationship type filter chips and cadence status labels.

**Success Criteria:**
- [ ] Home page (`/`) shows contact list, not search bar as hero
- [ ] Default sort: overdue contacts first (red section), then by last interaction desc
- [ ] Each row shows: avatar, name, company, cadence label, relationship badge, overdue/due status
- [ ] Filter chips (All / Professional / Personal / Acquaintance) narrow the list
- [ ] "No cadence set" contacts appear in a third section sorted by last interaction

---

### Chunk 7.1 — Add overdue sort to search/browse

**Files:** Modify `lib/search.ts`

Add `relationship_type` to `SearchFilters`:
```ts
relationshipType?: RelationshipType | null;
```

Add `relationship_type` to `PEOPLE_COLS` string and `SearchHit` interface.

Add a new sort option `'overdue'` that orders by cadence due date (computed in SQL or app layer). Since due date is computed, implement in app layer: fetch all contacts for the owner (with filters), compute cadence status client-side, sort.

Simpler approach for now: add a `sortBy?: 'overdue' | 'last_interaction'` param. When `'overdue'`, also fetch `keep_in_touch_cadence` and `created_at` and sort in JS after fetch. Cap at 200 results (single user, manageable).

Also add `relationship_type` filter to `browseQuery()`:
```ts
if (f.relationshipType) qb = qb.eq('relationship_type', f.relationshipType);
```

---

### Chunk 7.2 — Overdue-first People list page

**Files:**
- Modify `app/(app)/page.tsx` — rewrite to be a contact list, not search-first
- Modify `app/(app)/_components/results.tsx` — update card layout to show cadence status

**page.tsx structure:**
```tsx
// Fetch all people (up to 200), compute cadence status for each
// Split into: overdue[], dueSoon[], fine[]
// Pass sections to <PeopleList> component
```

**New component:** `app/(app)/_components/people-list.tsx`
- Renders section headers ("⚠ Overdue", "Recent") + contact cards
- Each card: avatar initials + color, name, company, RelationshipBadge, cadence label, overdue/due days

**Filter chips** at top: All / Professional / Personal / Acquaintance — use `useRouter` + URL params to persist filter.

**Step 1 (RED):** Old search-first page still present.
**Step 2:** Apply changes.
**Step 3 (GREEN):** `npm run typecheck` passes. Mobile shows overdue contacts at top in red.

**Commit:**
```
git commit -m "feat: replace search-first home with overdue-first people list"
```

---

## Block 8 — Keep In Touch Board (Desktop Home)

**Goal:** Build the kanban-style desktop home at `/keep-in-touch` with columns per cadence.

**Success Criteria:**
- [ ] `/keep-in-touch` renders kanban columns: Overdue · Biweekly · Monthly · Quarterly · 6 Months · Annual · 18 Months · No cadence
- [ ] Overdue column has red header; cards show "Xd late" in red
- [ ] Non-overdue cards show "Due in Xd"
- [ ] Clicking a card navigates to `/people/[id]`
- [ ] Desktop sidebar "Keep In Touch" link is active on this page

---

### Chunk 8.1 — Keep In Touch page

**Files:** Create `app/(app)/keep-in-touch/page.tsx`

```tsx
// Server component
// Fetches all people: id, full_name, company, relationship_type,
//   keep_in_touch_cadence, last_interaction_at, created_at
// Computes cadence status for each via computeCadenceStatus()
// Groups into: overdue[], and one bucket per cadence option, plus noCadence[]
// Renders <KITBoard sections={...} />
```

**Files:** Create `app/(app)/keep-in-touch/_board.tsx`

```tsx
"use client";
// Renders horizontal scrolling kanban layout
// Each column: header (label + color) + list of KITCard components
// KITCard: avatar initials, name, company, days label
// Clicking KITCard → router.push(`/people/${id}`)
```

Column color coding:
- Overdue → `border-red-200 bg-red-50` header `text-red-600`
- Others → `border-gray-200` header `text-gray-500`

**Step 1 (RED):** Page doesn't exist — `/keep-in-touch` returns 404.
**Step 2:** Create files.
**Step 3 (GREEN):** `npm run typecheck` passes. Desktop home shows kanban board.

**Commit:**
```
git commit -m "feat: add Keep In Touch kanban board as desktop home"
```

---

### Chunk 8.2 — Make /keep-in-touch the desktop default

**Files:** Modify `app/(app)/_components/sidebar.tsx`

Set "Keep In Touch" as the first and visually primary link. Update `isActive` logic so the sidebar item highlights correctly when on `/keep-in-touch`.

Also update the desktop sidebar so the logo click goes to `/keep-in-touch` on desktop (mobile logo goes to `/`).

**Commit:**
```
git commit -m "feat: set Keep In Touch board as desktop home in sidebar"
```

---

## Block 9 — Contact Detail Tabs + Channel Buttons

**Goal:** Restructure the contact detail page into Timeline / Notes / Details tabs and add tappable channel icon buttons.

**Success Criteria:**
- [ ] Contact detail has three tabs: Timeline, Notes, Details
- [ ] Timeline tab: Log interaction button + chronological interaction list + AI summary card
- [ ] Notes tab: permanent notes textarea, auto-saves on blur
- [ ] Details tab: contact info (email, phone, LinkedIn), RelationshipTypeSelect, CadenceSelect
- [ ] Channel icon buttons row below profile header: tappable, deep-link to correct app scheme
- [ ] Overdue indicator in profile header when cadence is set and overdue

---

### Chunk 9.1 — Channel icon buttons component

**Files:** Create `app/(app)/people/[id]/_channel-buttons.tsx`

```tsx
// Props: person (with all channel fields)
// Renders row of circular icon buttons
// Each button is an <a href="..."> deep link:
//   email      → mailto:{primary_email}
//   phone      → tel:{phone_number}
//   linkedin   → {linkedin_url}
//   whatsapp   → https://wa.me/{phone_number stripped}
//   slack      → {slack_channel}
// Buttons are disabled/greyed if value is null
// On mobile these open native apps
```

---

### Chunk 9.2 — Tabbed contact detail layout

**Files:**
- Create `app/(app)/people/[id]/_detail-tabs.tsx` — client component with tab state
- Modify `app/(app)/people/[id]/page.tsx` — new layout structure

**page.tsx new structure:**
```tsx
<div className="space-y-0">
  {/* Profile header — always visible */}
  <header>
    <back button, name, relationship badge, overdue indicator>
    <ChannelButtons person={person} />
    <TagsSection ... />
    <DetailTabs ... />  {/* tabs + content below */}
  </header>
</div>
```

**_detail-tabs.tsx:**
```tsx
"use client";
// State: activeTab: 'timeline' | 'notes' | 'details'
// Tab bar: three tab buttons with active underline
// Timeline tab content: <LogInteractionSection> + interactions list + AI summary
// Notes tab content: permanent notes textarea (auto-save on blur via PATCH)
// Details tab content: contact info fields + RelationshipTypeSelect + CadenceSelect
```

Remove the existing `_notes.tsx`, `_summary.tsx` panels from being top-level — move them inside the tab content.

**Step 1 (RED):** Old flat layout still in place.
**Step 2:** Apply changes.
**Step 3 (GREEN):** `npm run typecheck` passes. Contact detail shows tabs; channel buttons deep-link correctly.

**Commit:**
```
git commit -m "feat: tabbed contact detail (Timeline/Notes/Details) with channel icon buttons"
```

---

### Chunk 9.3 — Overdue indicator on contact header

**Files:** Modify `app/(app)/people/[id]/page.tsx`

Compute `CadenceStatus` server-side from person data. Pass it to the header area. Show red pill "Xd overdue" when `isOverdue`, grey "Due in Xd" otherwise (only when cadence is set).

```tsx
import { computeCadenceStatus, formatDaysOverdue, formatDaysUntilDue } from '@/lib/cadence';

const cadenceStatus = computeCadenceStatus(
  person.keep_in_touch_cadence,
  person.last_interaction_at,
  person.created_at,
);
```

**Commit:**
```
git commit -m "feat: show cadence overdue indicator on contact detail header"
```

---

## Block 10 — Quick Actions Bottom Sheet

**Goal:** The `+` tab in the mobile bottom nav opens a bottom sheet with Log Interaction, Add Contact, and Scan Business Card actions.

**Success Criteria:**
- [ ] Tapping `+` in bottom nav shows the sheet sliding up
- [ ] "Log an interaction" → opens a contact-search + note-entry form
- [ ] "Add new contact" → opens the existing AddContact dialog
- [ ] "Scan business card" → file/camera input → Claude OCR → pre-fills AddContact form
- [ ] Sheet closes on cancel or successful action
- [ ] Works on mobile (touch events, no hover dependencies)

---

### Chunk 10.1 — QuickActionsSheet component

**Files:** Create `app/(app)/_components/quick-actions-sheet.tsx`

```tsx
"use client";
// Props: open, onClose
// Renders a fixed bottom sheet overlay (z-50)
// Sheet slides up from bottom (CSS transform transition)
// Three action rows with icon, title, subtitle
// "Log interaction" action:
//   - Shows contact search input (hits /api/search)
//   - On contact selected: shows textarea for note
//   - Submit → POST /api/people/[id]/notes (or the log interaction endpoint)
// "Add new contact" action:
//   - Renders <AddContact> in dialog mode
// "Scan business card" action:
//   - <input type="file" accept="image/*" capture="environment">
//   - On file select: POST /api/ocr with base64 image
//   - Parse response → pre-fill name/email/company in AddContact form
// Cancel row at bottom
```

**Modify `app/(app)/_components/bottom-nav.tsx`:** Add local state `[sheetOpen, setSheetOpen]` and render `<QuickActionsSheet>` as a sibling.

**Step 1 (RED):** `+` button in bottom nav does nothing.
**Step 2:** Create sheet component and wire up.
**Step 3 (GREEN):** `npm run typecheck` passes. Mobile: tapping `+` shows the sheet; actions work.

**Commit:**
```
git commit -m "feat: add Quick Actions bottom sheet (log, add contact, scan business card)"
```

---

## Block 11 — Search Screen

**Goal:** Dedicated `/search` page with relationship type filter, recency filter, tag browser, and name/company text search.

**Success Criteria:**
- [ ] `/search` page renders search input + filter chips + tag grid + results
- [ ] Relationship type filter chips: All / Professional / Personal / Acquaintance
- [ ] Recency filter: Any / This week / This month / 30+ days / Never contacted
- [ ] Tag grid shows all user tags; clicking a tag filters results
- [ ] Text search does name + company ilike
- [ ] Results list uses the same contact card style as People list

---

### Chunk 11.1 — Search page

**Files:** Create `app/(app)/search/page.tsx`

```tsx
// Server component — reads searchParams for q, relationship_type, tag[], li (last interaction bucket)
// Calls search() with those filters
// Renders <SearchScreen> client component with initial data
```

**Files:** Create `app/(app)/search/_screen.tsx`

```tsx
"use client";
// Text input → debounced fetch to /api/search
// Relationship type chip filter (URL param)
// Recency chip filter (URL param)  
// Tag grid from allTags prop — clicking tag adds to URL params
// Results: same PeopleList card style
```

**Step 1 (RED):** `/search` returns 404.
**Step 2:** Create files.
**Step 3 (GREEN):** `npm run typecheck` passes. Search page filters work.

**Commit:**
```
git commit -m "feat: add dedicated search page with relationship type and recency filters"
```

---

## Block 12 — AddContact & Details Tab Wiring

**Goal:** Surface relationship type and cadence in the "Add Contact" flow and confirm the Details tab is fully functional.

**Success Criteria:**
- [ ] AddContact dialog includes RelationshipType selector
- [ ] AddContact dialog includes CadenceSelect
- [ ] POST /api/people accepts and saves both new fields
- [ ] Details tab shows all fields populated from DB

---

### Chunk 12.1 — Update AddContact dialog

**Files:** Modify `app/(app)/_components/add-contact.tsx`

Add `relationshipType` and `cadence` state. Add `<RelationshipTypeSelect>` (non-API mode — just a local `<select>`) and `<CadenceSelect>` to the form. Include both in the POST body to `/api/people`.

**Files:** Modify `app/api/people/route.ts` (POST handler)

Accept `relationshipType` and `cadence` in the body. Pass to the Supabase insert.

**Step 1 (RED):** New fields absent from Add Contact form.
**Step 2:** Apply changes.
**Step 3 (GREEN):** `npm run typecheck` passes. New contact can be added with relationship type and cadence set.

**Commit:**
```
git commit -m "feat: add relationship type and cadence to Add Contact form and POST /api/people"
```

---

## Technical Debt

These shortcuts are taken knowingly. Log in `docs/BUGS.md` before closing the phase:

1. **Cadence sort is JS-side:** The overdue-first sort on the People list fetches up to 200 contacts and sorts in memory. For a single-user app this is fine, but it won't scale. Phase 2: compute `cadence_due_at` in a DB generated column.

2. **Avatar initials only:** No photo support. Dex shows real photos (from LinkedIn/Google Contacts sync). Phase 2 when Gmail/Google sync is added.

3. **No push notifications for overdue contacts:** The overdue state is visible in-app only. Phase 2: background job + web push.

4. **PWA icons are placeholder copies of extension icons:** Replace with proper 192px/512px icons before any public deploy.

5. **Bottom nav `+` sheet is local state, not a route:** Deep-linking to the quick-log flow isn't possible. Acceptable for MVP.

6. **`semantic_embedding` column is now dead weight:** Still in DB (intentionally, for Phase 2). Not written to or read. Add a DB comment noting this.

---

## Production & Design Standards

- **No timeouts needed on new API calls** — all new routes are standard Supabase CRUD (< 1s). The only long-running call is OCR (already has `maxDuration` on the existing `/api/ocr` route).
- **Error handling:** All new client components follow existing pattern: `setError(e instanceof Error ? e.message : "Save failed")` displayed as `<p className="text-sm text-destructive">`.
- **Loading states:** New pages get `loading.tsx` with a skeleton (grey pulse divs matching the card layout).
- **Mobile tap targets:** All interactive elements ≥ 44px height (Apple HIG minimum). Channel buttons are 38px circles — acceptable since they're in a row and finger-sized.
- **`pb-20 md:pb-0` on main:** Ensures bottom nav doesn't overlap content on mobile.

---

Ready to start building? Use `/build`.
