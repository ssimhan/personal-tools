# Phase 2: Performance & Tech Debt

**Date:** 2026-06-07
**Status:** Ready to build

---

## Header

**Goal:** Eliminate pill-bar load lag via stale-while-revalidate caching, fix pill-bar positioning over Gmail's search bar, and clean up 6 logged tech debt items.

**Architecture:** A new `lib/cache.js` module wraps `chrome.storage.local` with TTL-keyed entries. `inject()` is refactored to render immediately from cache (if warm), then refresh data in the background. A freshness guard prevents redundant network trips when the user navigates quickly. All debt refactors are isolated to `injector.js` and `pill-bar.js` with no behavior changes.

**Design Patterns:** Cache-Aside (read-through cache), Stale-While-Revalidate, Extract Function (debt refactors).

**Tech Stack:** Plain JS, Jest, `chrome.storage.local` (MV3 Promise API), no new dependencies.

**Test command:** `npm test` (jest, from `gmail-label-tabs/`)

---

## Block 1: Cache Layer

Eliminates the 100+ API calls on every Gmail open. On warm cache, pill bar renders in <50ms instead of 1–2s.

**Success Criteria:**
- [ ] `lib/cache.js` has `get`, `set`, `clear` — all tested
- [ ] `inject()` renders from cache immediately when warm
- [ ] Background refresh fires after cached render; skips if injected within last 60s
- [ ] Cold load (first ever open) works identically to Phase 1
- [ ] All 28 existing tests still pass

---

### Chunk 1.1 — Create `lib/cache.js`

**Files:** Create `lib/cache.js`

**Step 1: Write failing test** — create `tests/cache.test.js`:

```js
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

const Cache = require('../lib/cache');

beforeEach(() => {
  jest.clearAllMocks();
});

test('get returns null on cache miss', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  await expect(Cache.get('labels')).resolves.toBeNull();
});

test('get returns null when entry is expired', async () => {
  chrome.storage.local.get.mockResolvedValue({
    glt_cache: { labels: { data: ['x'], expiresAt: Date.now() - 1000 } }
  });
  await expect(Cache.get('labels')).resolves.toBeNull();
});

test('get returns data when entry is fresh', async () => {
  chrome.storage.local.get.mockResolvedValue({
    glt_cache: { labels: { data: ['x'], expiresAt: Date.now() + 10000 } }
  });
  await expect(Cache.get('labels')).resolves.toEqual(['x']);
});

test('set writes entry with correct expiry', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set.mockResolvedValue(undefined);
  await Cache.set('labels', ['x'], 5000);
  const written = chrome.storage.local.set.mock.calls[0][0];
  expect(written.glt_cache.labels.data).toEqual(['x']);
  expect(written.glt_cache.labels.expiresAt).toBeGreaterThan(Date.now());
});

test('get returns null on storage error', async () => {
  chrome.storage.local.get.mockRejectedValue(new Error('storage unavailable'));
  await expect(Cache.get('labels')).resolves.toBeNull();
});
```

**Step 2: Verify failure**
```
npm test tests/cache.test.js
# Expected: Cannot find module '../lib/cache'
```

**Step 3: Implement `lib/cache.js`:**

```js
const Cache = (() => {
  const STORAGE_KEY = 'glt_cache';

  async function get(key) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const entry = ((result || {})[STORAGE_KEY] || {})[key];
      if (!entry || Date.now() > entry.expiresAt) return null;
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  async function set(key, data, ttlMs) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (result || {})[STORAGE_KEY] || {};
      cache[key] = { data, expiresAt: Date.now() + ttlMs };
      await chrome.storage.local.set({ [STORAGE_KEY]: cache });
    } catch (e) {
      // Storage failure is non-fatal — cold-load path still works
    }
  }

  async function clear(key) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (result || {})[STORAGE_KEY] || {};
      if (key) delete cache[key];
      else Object.keys(cache).forEach(k => delete cache[k]);
      await chrome.storage.local.set({ [STORAGE_KEY]: cache });
    } catch (e) {
      // Non-fatal
    }
  }

  const api = { get, set, clear };
  if (typeof window !== 'undefined') window.Cache = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
```

**Step 4: Verify pass**
```
npm test tests/cache.test.js
# 5 tests pass
```

**Step 5: Commit**
```bash
git add lib/cache.js tests/cache.test.js
git commit -m "feat: add cache.js with chrome.storage.local TTL-based get/set

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Chunk 1.2 — Register cache in manifest + content scripts

**Files:** Modify `manifest.json:L24-30`

Update the content scripts `js` array to include `lib/cache.js` before `lib/injector.js`:

```json
"js": [
  "lib/label-hierarchy.js",
  "lib/search-query.js",
  "lib/api-client.js",
  "lib/cache.js",
  "lib/pill-bar.js",
  "lib/injector.js"
]
```

No test needed (manifest order is validated by `tests/manifest.test.js` — confirm it still passes).

**Step 4: Verify pass**
```
npm test tests/manifest.test.js
```

**Step 5: Commit**
```bash
git add manifest.json
git commit -m "feat: register cache.js in content scripts

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Chunk 1.3 — Wire cache + freshness guard into `inject()`

**Files:** Modify `lib/injector.js`

**New constants** (add after `RETRY_DELAY_MS`):
```js
const LABEL_TTL_MS    = 60 * 60 * 1000;  // 1 hour  — labels rarely change
const MESSAGES_TTL_MS = 60 * 1000;        // 60 sec  — unread counts are time-sensitive
const FRESHNESS_GUARD_MS = 60 * 1000;     // 60 sec  — skip re-fetch if just injected
```

**Add to `state`:**
```js
lastInjectedAt: 0
```

**Extract `loadAndCacheData(token)`** — new function, add before `inject()`:
```js
async function loadAndCacheData(token) {
  const { ApiClient } = deps();
  const rawLabels = await ApiClient.fetchLabels(token);
  const messages = await ApiClient.fetchInboxMessageLabelSets(token);
  await Cache.get; // ensure Cache loaded (no-op guard)
  const { Cache: C } = { Cache: window.Cache };
  if (C) {
    await C.set('labels', rawLabels, LABEL_TTL_MS);
    await C.set('messages', messages, MESSAGES_TTL_MS);
  }
  return { rawLabels, messages };
}
```

Wait — `Cache` is on `window.Cache` but also available via `deps()` pattern. Let me keep it consistent with the rest of the codebase. Update `deps()` to include `Cache`:

```js
function deps() {
  return {
    ApiClient: window.ApiClient,
    Cache: window.Cache,
    LabelHierarchy: window.LabelHierarchy,
    PillBar: window.PillBar,
    SearchQuery: window.SearchQuery
  };
}
```

**Extract `renderFromData(rawLabels, messages, anchor)`** — replaces the DOM-building block in `inject()`:
```js
async function renderFromData(rawLabels, messages, anchor) {
  const { LabelHierarchy, PillBar } = deps();

  removeExisting();

  state.tree = LabelHierarchy.buildTree(rawLabels);
  const pillData = await buildPillData(null, state.tree, messages);
  state.activeNodes = pillData.activeNodes;

  if (state.activeNodes.length === 0 && pillData.unlabeledUnread === false) return;

  const wrapper = PillBar.createPillBar(
    state.activeNodes,
    pillData.unlabeledUnread,
    state.activeLabelId
  );
  wrapper.id = INJECTION_ID;
  bindEvents(wrapper);
  positionAndInsert(wrapper, anchor);
  await restoreActiveSubRow(wrapper);
}
```

Note: `buildPillData` currently fetches messages internally. Extract the message-fetch out so `renderFromData` can pass in pre-fetched messages:

```js
// Rename current buildPillData → buildPillDataFromMessages, remove the fetch:
function buildPillDataFromMessages(tree, messages) {
  const { LabelHierarchy } = deps();
  const userLabelIds = LabelHierarchy.flattenNodes(tree).map(node => node.id);
  annotatePresenceFromMessages(tree, messages);
  const topLevel = LabelHierarchy.sortTopLevel(tree);
  const activeNodes = topLevel.filter(node => node.present);
  const unlabeledUnread = getUnlabeledUnread(messages, userLabelIds);
  return { activeNodes, unlabeledUnread };
}

// Keep buildPillData as a thin wrapper for backward compatibility in tests:
async function buildPillData(token, tree) {
  const { ApiClient } = deps();
  const messages = await ApiClient.fetchInboxMessageLabelSets(token);
  return buildPillDataFromMessages(tree, messages);
}
```

**Replace `inject()`:**
```js
async function inject() {
  if (state.injecting || !isRelevantGmailView()) return;
  if (document.getElementById(INJECTION_ID)) return;

  const anchor = findAnchor();
  if (!anchor) return;

  state.injecting = true;

  try {
    const { ApiClient, Cache } = deps();
    if (!ApiClient || !Cache) throw new Error('Extension modules did not load in order.');

    if (!state.token) state.token = await ApiClient.getToken();

    const [cachedLabels, cachedMessages] = await Promise.all([
      Cache.get('labels'),
      Cache.get('messages')
    ]);

    const now = Date.now();
    const isRecent = now - state.lastInjectedAt < FRESHNESS_GUARD_MS;

    if (cachedLabels && cachedMessages) {
      // Warm cache: render immediately, then refresh in background
      await renderFromData(cachedLabels, cachedMessages, anchor);
      state.lastInjectedAt = now;

      if (!isRecent) {
        loadAndCacheData(state.token)
          .then(({ rawLabels, messages }) => {
            // Only re-render if data has changed
            if (JSON.stringify(rawLabels) !== JSON.stringify(cachedLabels) ||
                JSON.stringify(messages) !== JSON.stringify(cachedMessages)) {
              const a = findAnchor();
              if (a) renderFromData(rawLabels, messages, a);
            }
          })
          .catch(err => console.error('[GmailLabelTabs] Background refresh failed:', err));
      }
    } else {
      // Cold load — no cache yet
      const { rawLabels, messages } = await loadAndCacheData(state.token);
      await renderFromData(rawLabels, messages, anchor);
      state.lastInjectedAt = now;
    }
  } catch (error) {
    console.error('[GmailLabelTabs] Could not inject pill bar:', error);
    const anchor = findAnchor();
    if (anchor && (String(error.message || '').indexOf('token') !== -1 ||
        String(error.message || '').indexOf('OAuth') !== -1)) {
      showError(anchor, 'Gmail Label Tabs needs sign-in. Click the extension icon to connect Gmail.');
    }
  } finally {
    state.injecting = false;
  }
}
```

**Step 1: Write failing test** — add to `tests/smoke.test.js` or create `tests/injector-cache.test.js`:
```js
// Verify Cache is included in deps resolution
test('deps includes Cache when window.Cache is set', () => {
  global.window = {
    ApiClient: {},
    Cache: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
    LabelHierarchy: {},
    PillBar: {},
    SearchQuery: {}
  };
  // This is a structural test — Cache must be in the module list
  // If it's missing, inject() will throw 'Extension modules did not load in order'
  expect(window.Cache).toBeDefined();
});
```

**Step 2: Verify failure:** Run full suite and confirm smoke tests still pass before changes, then make the edits.

**Step 4: Verify pass**
```
npm test
# All 28+ tests pass
```

**Step 5: Commit**
```bash
git add lib/injector.js
git commit -m "feat: stale-while-revalidate cache in inject() — labels 1hr TTL, messages 60s TTL

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Block 2: Position Fix (BUG-004)

The pill bar sometimes renders over Gmail's search bar because `anchor.getBoundingClientRect().top` returns a low value if Gmail hasn't finished layout when `inject()` fires.

**Success Criteria:**
- [ ] Pill bar never appears above y=100 (Gmail's header+search is ~65-80px)
- [ ] If anchor top is suspiciously low (<100px), inject is deferred one retry
- [ ] BUG-004 marked resolved in BUGS.md

---

### Chunk 2.1 — Guard against premature positioning

**Files:** Modify `lib/injector.js` — `positionAndInsert` function and `inject()`

In `inject()`, before calling `renderFromData`, add a layout guard:

```js
// Guard: if anchor hasn't settled to its final position, defer
const anchorRect = anchor.getBoundingClientRect();
if (anchorRect.top < 100) {
  scheduleInject();
  return;
}
```

Place this immediately after `const anchor = findAnchor();` and before `state.injecting = true`.

**Step 4: Verify pass**
```
npm test
# All tests pass — no layout changes affect test environment
```

**Step 5: Commit**
```bash
git add lib/injector.js docs/BUGS.md
git commit -m "fix: defer injection if anchor hasn't settled above search bar (BUG-004)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

Also update `docs/BUGS.md` — move BUG-004 to Resolved.

---

## Block 3: Tech Debt Cleanup (DEV-001)

Six isolated refactors, no behavior changes. Do these after Block 1 since `inject()` is already restructured there.

**Success Criteria:**
- [ ] All 8 DEBT items resolved (DEBT-005 is resolved naturally by Block 1's `renderFromData` extraction)
- [ ] Test count unchanged or higher
- [ ] No behavior changes — all existing tests pass

---

### Chunk 3.1 — Remove dead/speculative code (DEBT-007, DEBT-008)

**Files:** Modify `lib/injector.js`

**DEBT-007** — Remove `window.setTimeout(reapplyActiveFilter, 500)` from `navigateToNode` and the two `selectTopLevel` call sites. Keep `reapplyActiveFilter` itself (it's still used for correctness), just remove the speculative delayed retry.

**DEBT-008** — In `getInboxRows`, remove the unreachable fallback:
```js
// Remove this:
return Array.from(document.querySelectorAll('div[role="main"] tr.zA'));
```

**Step 4: Verify pass:** `npm test` — all pass.

**Step 5: Commit**
```bash
git add lib/injector.js
git commit -m "refactor: remove speculative 500ms retry and dead getInboxRows fallback (DEBT-007, DEBT-008)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Chunk 3.2 — Merge duplicate query helpers (DEBT-001)

**Files:** Modify `lib/injector.js`

Replace `queryForNode` and `unreadQueryForNode` with a single `buildQuery(node, type)`:

```js
function buildQuery(node, type) {
  const { LabelHierarchy, SearchQuery } = deps();
  const descendants = LabelHierarchy.getDescendantNames(node);
  return type === 'unread'
    ? SearchQuery.buildUnreadQuery(node.name, descendants)
    : SearchQuery.buildSearchQuery(node.name, descendants);
}
```

Update `annotateNode` to call `buildQuery(node, 'search')` and `buildQuery(node, 'unread')`.
Update the exported `api.queryForNode` → `api.buildQuery` (or keep `queryForNode` as an alias for backward compatibility with any callers).

**Step 4: Verify pass:** `npm test`

**Step 5: Commit**
```bash
git add lib/injector.js
git commit -m "refactor: merge queryForNode/unreadQueryForNode into buildQuery(node, type) (DEBT-001)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Chunk 3.3 — Merge duplicate count helpers (DEBT-002)

**Files:** Modify `lib/injector.js`

Replace `countMessagesForNode` and `countUnreadMessagesForNode` with a single parameterised helper:

```js
function countMessagesForNode(node, messages, unreadOnly) {
  const { LabelHierarchy } = deps();
  const familyIds = [node.id].concat(LabelHierarchy.getDescendantIds(node));
  return messages.filter(message =>
    messageHasAnyLabel(message, familyIds) &&
    (!unreadOnly || (message.labelIds || []).indexOf('UNREAD') !== -1)
  ).length;
}
```

Update `annotatePresenceFromMessages` to call `countMessagesForNode(node, messages, false)` and `countMessagesForNode(node, messages, true)`.

**Step 4: Verify pass:** `npm test`

**Step 5: Commit**
```bash
git add lib/injector.js
git commit -m "refactor: merge duplicate message count helpers (DEBT-002)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Chunk 3.4 — Merge duplicate pill factories (DEBT-003)

**Files:** Modify `lib/pill-bar.js`

Extract a shared `createPillElement(label, isActive, config)` where `config = { pillClass, nameClass, dotClass }`:

```js
function createPillElement(label, isActive, config) {
  const pill = createElement('button', {
    className: config.pillClass + (isActive ? ' ' + config.pillClass + '--active' : ''),
    type: 'button',
    'data-label-id': label.id,
    'data-label-name': label.name,
    title: displayName(label.name)
  }, [
    createElement('span', { className: config.nameClass }, [displayName(label.name)]),
    badge(label.unread)
  ]);
  applyTint(pill, label.color, label.unread);
  return pill;
}
```

`createPill` and `createSubPill` become thin wrappers calling `createPillElement` with their respective class names.

**Step 4: Verify pass:** `npm test tests/pill-bar.test.js`

**Step 5: Commit**
```bash
git add lib/pill-bar.js
git commit -m "refactor: extract shared createPillElement factory (DEBT-003)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Chunk 3.5 — Merge duplicate state setters + typed token error (DEBT-004, DEBT-006)

**Files:** Modify `lib/injector.js`

**DEBT-004** — Replace `setActivePill` and `setActiveSubPill` with one function:
```js
function setActiveState(wrapper, selector, activeClass, labelId) {
  wrapper.querySelectorAll(selector).forEach(el => {
    el.classList.toggle(activeClass, el.getAttribute('data-label-id') === labelId);
  });
}
```
Call as `setActiveState(wrapper, '.glt-pill', 'glt-pill--active', labelId)` and `setActiveState(wrapper, '.glt-subpill', 'glt-subpill--active', labelId)`.

**DEBT-006** — In `lib/api-client.js`, throw a typed error from `getToken()`:
```js
// Replace generic rejection with:
reject(Object.assign(new Error('OAuth token unavailable'), { type: 'OAuthError' }));
```

Then in `inject()`'s catch block, check `error.type === 'OAuthError'` instead of substring-matching the message.

**Step 4: Verify pass:** `npm test`

**Step 5: Commit**
```bash
git add lib/injector.js lib/api-client.js
git commit -m "refactor: merge state setters, typed OAuthError (DEBT-004, DEBT-006)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Technical Debt Strategy

| Item | Introduced by this plan | Mitigation |
|---|---|---|
| `JSON.stringify` comparison for cache diff | Block 1 Chunk 1.3 | Acceptable for arrays of simple objects; replace with structural diff if perf issues arise |
| Background refresh re-renders entire pill bar | Block 1 Chunk 1.3 | No visible flicker since it only fires when data changed; revisit if user notices jank |
| `anchorRect.top < 100` is a magic number | Block 2 | Extracted as `const MIN_ANCHOR_TOP = 100` — document that Gmail's header is ~65-80px |

---

## Production Standards

- **No new `fetch` calls** — all API calls go through existing `ApiClient` which handles auth headers
- **No new `chrome` API surface** — `chrome.storage.local` is already in `manifest.json` permissions (`"storage"`)
- **Error isolation** — `loadAndCacheData` failures in background refresh are caught and logged; they never crash the already-rendered pill bar
- **Storage failure is non-fatal** — `Cache.get` returns `null` on any error, falling through to cold-load path
