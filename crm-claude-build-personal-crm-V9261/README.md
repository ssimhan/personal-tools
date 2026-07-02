# Relationship Memory Layer

Personal CRM built to PRD V1.1 — a relationship memory layer with semantic retrieval, lightweight personalized broadcast, and AI-maintained summaries. Single-user.

## Stack

- Next.js 15 (App Router, RSC, Server Actions)
- Tailwind + shadcn-style UI primitives
- Supabase (Postgres + pgvector + Auth, single-user via `ALLOWED_USER_EMAILS`)
- Anthropic Claude — vision (OCR) and text (summarization, identity, personalization)
- OpenAI `text-embedding-3-small` — 1536-dim embeddings
- Resend — individual per-recipient sends (no group threads)

## Setup

1. **Supabase project** — create one at supabase.com.
2. Apply migrations (paste into the SQL editor in order, or use the CLI):
   ```
   supabase/migrations/0001_init.sql
   supabase/migrations/0002_search.sql
   ```
   These create the tables, RLS policies, the `match_people` RPC, and enable `pgvector` + `pg_trgm`.
3. **Env vars** — copy `.env.example` to `.env.local`, fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL` — a verified Resend sender
   - `ALLOWED_USER_EMAILS` — your email (comma-separated allowlist)
4. `npm install && npm run dev`
5. Sign in at `/login` — first sign-in creates your account.

## Deploy (Vercel)

- Connect repo, add the same env vars in Project Settings → Environment Variables.
- Set the function timeout in `vercel.json` or per-route (the routes that need >60s already declare `export const maxDuration`).

## Configuration

All tunables live in env vars (single source of truth — see `lib/config.ts`):

| Env | Default | What |
|---|---|---|
| `VISION_MODEL` | `claude-haiku-4-5-20251001` | Screenshot OCR. Swap independently. |
| `TEXT_MODEL` | `claude-haiku-4-5-20251001` | Summary regen + personalization + Tier 4 identity. |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Fixed at build time — changing requires re-embed + column migration. |
| `SEMANTIC_SIMILARITY_FLOOR` | `0.75` | Hard floor; results below this are hidden. Tune in first week. |

## Key PRD behaviors implemented

- **Person-centric data model** — `people` is the canonical object; `interactions` are append-only.
- **Three memory layers** — interaction history (immutable), AI relationship summary (continuously rewritten, max 1000 chars), permanent notes (human-only, authoritative).
- **Embedding input = summary + permanent notes** — concatenated. Editing notes regenerates the embedding.
- **Scoped regeneration** — summary regen sees only the current summary + permanent notes + the new interaction(s). It never re-reads old raw interactions.
- **Decay by re-writing** — no per-fact flags; stale info disappears because the regen prompt doesn't carry it forward.
- **Hard similarity floor** — semantic search returns "no results" rather than the least-irrelevant matches.
- **Two retrieval modes** — semantic and structured (tags/name/company), combined as filter-then-rank (AND). The merge-then-rank co-ranking model is explicitly out of scope.
- **"No summary yet" filter** — first-class surface for imported contacts; outreach backlog.
- **Imports** — create records only. Zero LLM calls. Searchable via structured retrieval immediately.
- **Broadcast sends** — log `broadcast_sent` interactions per recipient, but short-circuit before summary/embedding regen.
- **Single prior snapshot + revert** — exactly one previous summary version, user-visible with one-click revert.
- **Screenshot pipeline** — OCR at log time, image discarded. Low-confidence extraction surfaces to the user.
- **WhatsApp** — stored only, always non-actionable.
- **Per-recipient individual sends** — never a group thread.

## Chrome extension

A companion popup-only Chrome extension lives in `extension/`. It does three things based on the active tab's URL:

- **LinkedIn profile already in the CRM** → renders a PersonCard with the summary, notes, tags, channels, and a Log Interaction box. All sections are editable inline; saving any of them syncs back to the web app.
- **LinkedIn profile not in the CRM** → renders an Add Contact form pre-filled with the LinkedIn URL.
- **Any other URL** → renders a search box that hits `/api/search`.

### Install (developer mode, Chrome)

1. Generate a key: `openssl rand -hex 32`
2. Add to Vercel env vars: `EXTENSION_API_KEY=<the key>`. Redeploy. Also confirm `CANONICAL_OWNER_EMAIL` is set (required — the extension operates on that user's data).
3. In Chrome: `chrome://extensions` → toggle **Developer mode** → **Load unpacked** → select the `extension/` folder.
4. Click the extension's "Details" → **Extension options** (or right-click the toolbar icon → Options). Paste:
   - **CRM base URL** — your Vercel URL, no trailing slash
   - **API key** — the same string you put in Vercel
5. Click **Test connection** → ✓ Connected. Save.

### How auth works

The extension sends `Authorization: Bearer <EXTENSION_API_KEY>` on every request. The server's `requireUserOrApiKey()` helper accepts that header in lieu of the web app's session cookie. When authenticated by key, the extension acts as the canonical owner (same data as the web app). Rotate by changing the value in Vercel and the options page.

`host_permissions` covers the CRM origin, which means Chrome bypasses CORS for the extension — no backend CORS configuration is needed.

## Tuning the similarity floor

After the first week of real use, look at queries that should have returned someone but didn't (floor too high) or returned irrelevant people (floor too low). Adjust `SEMANTIC_SIMILARITY_FLOOR` in one place.
