# Gmail Label Tabs — Implementation Plan
_Date: 2026-06-07 | PRD: `docs/plans/2026-06-07-gmail-label-tabs-design.md`_

---

## Header

**Goal:** Build a Chrome MV3 extension that injects a dynamic pill bar into Gmail's inbox, using Gmail API (readonly) for label metadata and Gmail search URLs for filtered navigation.

**Architecture:** Vanilla JS, no build step. Five pure-function modules (`label-hierarchy`, `search-query`, `api-client`, `pill-bar`, `injector`) loaded as ordered content scripts sharing a single scope via the revealing module pattern. Pure functions are fully unit-testable with Jest + jsdom. DOM injection uses a MutationObserver targeting `div[role="main"]` — stable across Gmail updates.

**Design Patterns:** Revealing Module (each lib file exposes a single global), Repository (api-client wraps all Gmail API calls), Observer (MutationObserver + hashchange for SPA detection).

**Tech Stack:** Vanilla JS (ES5-compatible for content scripts), Chrome Manifest V3, Gmail API v1 (readonly), Jest 29 + jsdom (tests).

**Test runner:** `npx jest` (verified below in Block 1 setup).

---

## Updated Data Flow (simplified from PRD)

| Step | API Call | Purpose |
|---|---|---|
| 1 | `labels.list()` | Get all label names, IDs, colors → build hierarchy tree |
| 2 | Parallel: `messages.list(q='in:inbox label:X', maxResults=1)` × top-level labels | Determine which pills to show |
| 3 | Parallel: `messages.list(q='in:inbox label:X is:unread', maxResults=1)` × active labels | Unread count via `resultSizeEstimate` |
| 4 | On pill click (lazy): same checks for sub-labels of clicked category | Sub-pill visibility |
| 5 | Build search URL → navigate Gmail | Filtering (Gmail renders results) |

No custom email list rendering. No batch message fetching. Gmail does the heavy lifting.

---

## File Structure

```
gmail-label-tabs/
  manifest.json
  background.js              (service worker — OAuth token fetch)
  popup/
    popup.html               (sign in button)
    popup.js
  lib/
    label-hierarchy.js       (pure: parse, build tree, get descendants)
    search-query.js          (pure: build Gmail search URLs)
    api-client.js            (Gmail API wrapper)
    pill-bar.js              (DOM: render pills, handle clicks)
    injector.js              (MutationObserver, SPA, wiring)
  styles.css                 (pill bar brand styles)
  icons/
    icon16.png
    icon48.png
    icon128.png
  tests/
    label-hierarchy.test.js
    search-query.test.js
    api-client.test.js
    pill-bar.test.js
  package.json
  jest.config.js
  .gitignore
```

---

## Block 1 — Scaffold & Test Setup

**Success Criteria:**
- [ ] Extension loads in `chrome://extensions` without errors
- [ ] `npx jest` runs and passes with one smoke test
- [ ] `manifest.json` declares all required permissions and content scripts in load order

### Chunk 1.1 — Folder structure, manifest, gitignore

**Files:** Create `gmail-label-tabs/manifest.json`, `gmail-label-tabs/.gitignore`

**Step 1 — Write failing test:**
```js
// tests/manifest.test.js
const manifest = require('../manifest.json');
test('manifest has required MV3 fields', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toContain('identity');
  expect(manifest.host_permissions).toContain('https://mail.google.com/*');
});
```

**Step 2 — Verify failure:** `npx jest tests/manifest.test.js` → Cannot find module `../manifest.json`

**Step 3 — Implement:**
```json
{
  "manifest_version": 3,
  "name": "Gmail Label Tabs",
  "version": "1.0.0",
  "description": "Organizes Gmail inbox into label-based pill tabs",
  "permissions": ["identity", "storage"],
  "host_permissions": ["https://mail.google.com/*"],
  "oauth2": {
    "client_id": "REPLACE_WITH_CLIENT_ID",
    "scopes": ["https://www.googleapis.com/auth/gmail.readonly"]
  },
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [{
    "matches": ["https://mail.google.com/*"],
    "js": [
      "lib/label-hierarchy.js",
      "lib/search-query.js",
      "lib/api-client.js",
      "lib/pill-bar.js",
      "lib/injector.js"
    ],
    "css": ["styles.css"],
    "run_at": "document_idle"
  }]
}
```

`.gitignore`:
```
node_modules/
*.DS_Store
manifest.json.local
```

**Step 4 — Verify pass:** `npx jest tests/manifest.test.js` → PASS

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/manifest.json gmail-label-tabs/.gitignore
git commit -m "feat: add extension manifest and scaffold structure"
```

---

### Chunk 1.2 — package.json + Jest config

**Files:** Create `gmail-label-tabs/package.json`, `gmail-label-tabs/jest.config.js`

**Step 1 — Write failing test:**
```js
// tests/smoke.test.js
test('jest is configured correctly', () => {
  expect(1 + 1).toBe(2);
});
```

**Step 2 — Verify failure:** `npx jest` → jest not found

**Step 3 — Implement:**
```json
// package.json
{
  "name": "gmail-label-tabs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```

```js
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  globals: { 'chrome': {} }
};
```

Run: `npm install`

**Step 4 — Verify pass:** `npx jest` → PASS (1 test)

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/package.json gmail-label-tabs/jest.config.js gmail-label-tabs/tests/smoke.test.js
git commit -m "feat: configure Jest + jsdom test environment"
```

---

### Chunk 1.3 — Popup (sign in UI)

**Files:** Create `popup/popup.html`, `popup/popup.js`

**Step 3 — Implement (no unit test — DOM-only):**
```html
<!-- popup/popup.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'DM Sans', sans-serif; width: 240px; padding: 20px; background: #F5F2E8; }
    h3 { font-size: 14px; color: #2B2B2B; margin: 0 0 4px; }
    p { font-size: 12px; color: #7A7469; margin: 0 0 16px; }
    button {
      width: 100%; padding: 10px; border: none; border-radius: 8px;
      background: #1A9E96; color: white; font-family: 'DM Sans', sans-serif;
      font-size: 13px; font-weight: 500; cursor: pointer;
    }
    button:disabled { background: #AEAAA0; cursor: default; }
    #status { font-size: 11px; color: #7A7469; margin-top: 10px; text-align: center; }
  </style>
</head>
<body>
  <h3>Gmail Label Tabs</h3>
  <p>Sign in to organize your inbox by label.</p>
  <button id="signin">Connect Gmail</button>
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>
```

```js
// popup/popup.js
const btn = document.getElementById('signin');
const status = document.getElementById('status');

chrome.identity.getAuthToken({ interactive: false }, (token) => {
  if (token) {
    btn.textContent = 'Connected ✓';
    btn.disabled = true;
    status.textContent = 'Gmail is connected.';
  }
});

btn.addEventListener('click', () => {
  btn.disabled = true;
  status.textContent = 'Connecting…';
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      btn.disabled = false;
      status.textContent = 'Sign in failed. Try again.';
      return;
    }
    btn.textContent = 'Connected ✓';
    status.textContent = 'Gmail connected. Reload Gmail.';
  });
});
```

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/popup/
git commit -m "feat: add popup sign-in UI with OAuth trigger"
```

---

### Chunk 1.4 — Background service worker

**Files:** Create `gmail-label-tabs/background.js`

```js
// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token });
      }
    });
    return true; // keep message channel open for async response
  }
});
```

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/background.js
git commit -m "feat: add background service worker for token relay"
```

---

## Block 2 — Label Hierarchy Engine (Pure Functions)

**Success Criteria:**
- [ ] `parseLabels()` builds a correct tree from Gmail API response
- [ ] `getDescendantIds()` returns all child+grandchild IDs for any node
- [ ] `getDisplayName()` strips numeric prefixes correctly
- [ ] `sortTopLevel()` orders by numeric prefix, unnumbered labels at end
- [ ] All 8 tests pass

### Chunk 2.1 — `parseLabels` + `buildTree`

**Files:** Create `lib/label-hierarchy.js`, `tests/label-hierarchy.test.js`

**Step 1 — Write failing tests:**
```js
// tests/label-hierarchy.test.js
const LH = require('../lib/label-hierarchy');

const MOCK_LABELS = [
  { id: 'l1', name: '3- Career', color: { backgroundColor: '#E67E22' } },
  { id: 'l2', name: '3- Career/Job Hunt', color: null },
  { id: 'l3', name: '3- Career/Glean', color: null },
  { id: 'l4', name: '3- Career/Glean/Competitive', color: null },
  { id: 'l5', name: '1 - Sandhya', color: { backgroundColor: '#9B59B6' } },
  { id: 'l6', name: '6- Friends', color: null },
  { id: 'INBOX', name: 'INBOX', color: null },
  { id: 'SENT', name: 'SENT', color: null },
];

describe('parseLabels', () => {
  test('filters out system labels', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    expect(tree.find(n => n.id === 'INBOX')).toBeUndefined();
  });

  test('identifies top-level labels correctly', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    const topLevel = tree.filter(n => n.depth === 0);
    expect(topLevel.map(n => n.id)).toContain('l1');
    expect(topLevel.map(n => n.id)).toContain('l5');
  });

  test('nests children under parents', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    const career = tree.find(n => n.id === 'l1');
    expect(career.children.map(c => c.id)).toContain('l2');
    expect(career.children.map(c => c.id)).toContain('l3');
  });

  test('nests grandchildren under direct parents', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    const career = tree.find(n => n.id === 'l1');
    const glean = career.children.find(c => c.id === 'l3');
    expect(glean.children.map(c => c.id)).toContain('l4');
  });
});
```

**Step 2 — Verify failure:** `npx jest tests/label-hierarchy.test.js` → Cannot find module

**Step 3 — Implement:**
```js
// lib/label-hierarchy.js
const LabelHierarchy = (() => {
  const SYSTEM_LABEL_PREFIXES = ['INBOX', 'SENT', 'TRASH', 'SPAM', 'DRAFT', 'STARRED', 'IMPORTANT', 'UNREAD', 'CATEGORY_'];

  function isSystemLabel(name) {
    return SYSTEM_LABEL_PREFIXES.some(p => name.startsWith(p));
  }

  function buildTree(apiLabels) {
    const userLabels = apiLabels.filter(l => !isSystemLabel(l.name));
    const byName = {};
    userLabels.forEach(l => { byName[l.name] = { ...l, children: [], depth: 0 }; });

    const roots = [];
    userLabels.forEach(label => {
      const parts = label.name.split('/');
      if (parts.length === 1) {
        roots.push(byName[label.name]);
      } else {
        const parentName = parts.slice(0, -1).join('/');
        if (byName[parentName]) {
          const node = byName[label.name];
          node.depth = parts.length - 1;
          byName[parentName].children.push(node);
        } else {
          roots.push(byName[label.name]);
        }
      }
    });

    return roots;
  }

  const api = { buildTree, isSystemLabel };
  if (typeof module !== 'undefined') module.exports = api;
  else window.LabelHierarchy = api;
})();
```

**Step 4 — Verify pass:** `npx jest tests/label-hierarchy.test.js` → PASS

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/lib/label-hierarchy.js gmail-label-tabs/tests/label-hierarchy.test.js
git commit -m "feat: implement label tree builder with parent/child nesting"
```

---

### Chunk 2.2 — `getDescendantIds` + `getDisplayName` + `sortTopLevel`

**Step 1 — Add tests** (append to `label-hierarchy.test.js`):
```js
describe('getDescendantIds', () => {
  test('returns all descendant IDs at any depth', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    const career = tree.find(n => n.id === 'l1');
    const ids = LH.getDescendantIds(career);
    expect(ids).toContain('l2'); // Job Hunt
    expect(ids).toContain('l3'); // Glean
    expect(ids).toContain('l4'); // Competitive (grandchild)
  });

  test('returns empty array for leaf node', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    const friends = tree.find(n => n.id === 'l6');
    expect(LH.getDescendantIds(friends)).toEqual([]);
  });
});

describe('getDisplayName', () => {
  test('strips numeric prefix "3- Career" → "Career"', () => {
    expect(LH.getDisplayName('3- Career')).toBe('Career');
  });
  test('strips prefix "1 - Sandhya" → "Sandhya"', () => {
    expect(LH.getDisplayName('1 - Sandhya')).toBe('Sandhya');
  });
  test('returns last segment for sub-labels', () => {
    expect(LH.getDisplayName('3- Career/Job Hunt')).toBe('Job Hunt');
  });
  test('leaves non-prefixed names alone', () => {
    expect(LH.getDisplayName('cc-automated')).toBe('cc-automated');
  });
});

describe('sortTopLevel', () => {
  test('sorts numbered labels before unnumbered', () => {
    const tree = LH.buildTree(MOCK_LABELS);
    const sorted = LH.sortTopLevel(tree);
    const names = sorted.map(n => LH.getDisplayName(n.name));
    expect(names.indexOf('Sandhya')).toBeLessThan(names.indexOf('Career'));
    expect(names.indexOf('Friends')).toBeGreaterThan(names.indexOf('Career'));
  });
});
```

**Step 3 — Implement** (extend `label-hierarchy.js`):
```js
function getDescendantIds(node) {
  const ids = [];
  function walk(n) {
    n.children.forEach(child => {
      ids.push(child.id);
      walk(child);
    });
  }
  walk(node);
  return ids;
}

function getDisplayName(fullName) {
  const lastSegment = fullName.split('/').pop();
  return lastSegment.replace(/^\d+\s*[-–]\s*/, '').trim();
}

function getNumericPrefix(name) {
  const match = name.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : Infinity;
}

function sortTopLevel(nodes) {
  return [...nodes].sort((a, b) => getNumericPrefix(a.name) - getNumericPrefix(b.name));
}
```

Add to `api` object: `getDescendantIds, getDisplayName, sortTopLevel`

**Step 4 — Verify:** `npx jest tests/label-hierarchy.test.js` → PASS (all tests)

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/lib/label-hierarchy.js gmail-label-tabs/tests/label-hierarchy.test.js
git commit -m "feat: add getDescendantIds, getDisplayName, sortTopLevel"
```

---

## Block 3 — Search Query Builder (Pure Functions)

**Success Criteria:**
- [ ] Correct Gmail search string for a top-level label with descendants
- [ ] Correct URL encoding for navigation
- [ ] "Unlabeled" query uses `has:nouserlabels`
- [ ] All 5 tests pass

### Chunk 3.1 — `buildSearchQuery` + `buildGmailUrl`

**Files:** Create `lib/search-query.js`, `tests/search-query.test.js`

**Step 1 — Write failing tests:**
```js
// tests/search-query.test.js
const SQ = require('../lib/search-query');

test('single label with no descendants', () => {
  expect(SQ.buildSearchQuery('6- Friends', [])).toBe('in:inbox label:6- Friends');
});

test('label with descendants builds OR query', () => {
  const q = SQ.buildSearchQuery('3- Career', ['3- Career/Job Hunt', '3- Career/Glean']);
  expect(q).toBe('in:inbox (label:3- Career OR label:3- Career/Job Hunt OR label:3- Career/Glean)');
});

test('unlabeled query', () => {
  expect(SQ.buildUnlabeledQuery()).toBe('in:inbox has:nouserlabels');
});

test('buildGmailUrl returns correct hash', () => {
  const url = SQ.buildGmailUrl('in:inbox label:Friends');
  expect(url).toBe('#search/in%3Ainbox%20label%3AFriends');
});

test('sub-label query scopes to sub-label + grandchildren', () => {
  const q = SQ.buildSearchQuery('3- Career/Glean', ['3- Career/Glean/Competitive']);
  expect(q).toBe('in:inbox (label:3- Career/Glean OR label:3- Career/Glean/Competitive)');
});
```

**Step 2 — Verify failure:** `npx jest tests/search-query.test.js` → Cannot find module

**Step 3 — Implement:**
```js
// lib/search-query.js
const SearchQuery = (() => {
  function buildSearchQuery(labelName, descendantNames) {
    if (!descendantNames || descendantNames.length === 0) {
      return `in:inbox label:${labelName}`;
    }
    const allNames = [labelName, ...descendantNames];
    const parts = allNames.map(n => `label:${n}`).join(' OR ');
    return `in:inbox (${parts})`;
  }

  function buildUnlabeledQuery() {
    return 'in:inbox has:nouserlabels';
  }

  function buildGmailUrl(query) {
    return '#search/' + encodeURIComponent(query);
  }

  const api = { buildSearchQuery, buildUnlabeledQuery, buildGmailUrl };
  if (typeof module !== 'undefined') module.exports = api;
  else window.SearchQuery = api;
})();
```

**Step 4 — Verify:** `npx jest tests/search-query.test.js` → PASS

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/lib/search-query.js gmail-label-tabs/tests/search-query.test.js
git commit -m "feat: implement Gmail search query builder with rollup support"
```

---

## Block 4 — Gmail API Client

**Success Criteria:**
- [ ] `fetchLabels()` returns raw labels array
- [ ] `checkInboxPresence()` correctly interprets `resultSizeEstimate`
- [ ] `fetchUnreadEstimate()` returns numeric count
- [ ] All API calls include `Authorization: Bearer {token}` header
- [ ] `getToken()` sends message to background service worker
- [ ] All 6 tests pass with fetch mocked

### Chunk 4.1 — `fetchLabels` + `getToken`

**Files:** Create `lib/api-client.js`, `tests/api-client.test.js`

**Step 1 — Write failing tests:**
```js
// tests/api-client.test.js
const API = require('../lib/api-client');

global.chrome = {
  runtime: {
    sendMessage: jest.fn((msg, cb) => cb({ token: 'test-token' }))
  }
};

beforeEach(() => {
  global.fetch = jest.fn();
  jest.clearAllMocks();
});

test('getToken resolves with token from background', async () => {
  const token = await API.getToken();
  expect(token).toBe('test-token');
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
    { type: 'GET_TOKEN' },
    expect.any(Function)
  );
});

test('fetchLabels calls correct endpoint with auth header', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ labels: [{ id: 'l1', name: '3- Career' }] })
  });
  const labels = await API.fetchLabels('test-token');
  expect(fetch).toHaveBeenCalledWith(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' }
    })
  );
  expect(labels[0].name).toBe('3- Career');
});

test('fetchLabels throws on non-ok response', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(API.fetchLabels('bad-token')).rejects.toThrow('Gmail API error: 401');
});
```

**Step 3 — Implement:**
```js
// lib/api-client.js
const ApiClient = (() => {
  const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

  function getToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, (response) => {
        if (response && response.token) resolve(response.token);
        else reject(new Error(response ? response.error : 'No token'));
      });
    });
  }

  async function apiFetch(token, path, params = {}) {
    const url = new URL(`${BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
    return res.json();
  }

  async function fetchLabels(token) {
    const data = await apiFetch(token, '/labels');
    return data.labels || [];
  }

  async function checkInboxPresence(token, labelName) {
    const data = await apiFetch(token, '/messages', {
      q: `in:inbox label:${labelName}`,
      maxResults: 1
    });
    return (data.resultSizeEstimate || 0) > 0;
  }

  async function fetchUnreadEstimate(token, labelName) {
    const data = await apiFetch(token, '/messages', {
      q: `in:inbox label:${labelName} is:unread`,
      maxResults: 1
    });
    return data.resultSizeEstimate || 0;
  }

  async function checkUnlabeledPresence(token) {
    const data = await apiFetch(token, '/messages', {
      q: 'in:inbox has:nouserlabels',
      maxResults: 1
    });
    return (data.resultSizeEstimate || 0) > 0;
  }

  const api = { getToken, fetchLabels, checkInboxPresence, fetchUnreadEstimate, checkUnlabeledPresence };
  if (typeof module !== 'undefined') module.exports = api;
  else window.ApiClient = api;
})();
```

**Step 4 — Verify:** `npx jest tests/api-client.test.js` → PASS

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/lib/api-client.js gmail-label-tabs/tests/api-client.test.js
git commit -m "feat: implement Gmail API client with token relay and inbox presence checks"
```

---

### Chunk 4.2 — `checkInboxPresence` + `fetchUnreadEstimate` tests

**Step 1 — Add to `api-client.test.js`:**
```js
test('checkInboxPresence returns true when resultSizeEstimate > 0', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 3, messages: [{ id: 'abc' }] })
  });
  const present = await API.checkInboxPresence('test-token', '3- Career');
  expect(present).toBe(true);
});

test('checkInboxPresence returns false when estimate is 0', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 0 })
  });
  const present = await API.checkInboxPresence('test-token', '6- Friends');
  expect(present).toBe(false);
});

test('fetchUnreadEstimate returns estimate number', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 7 })
  });
  const count = await API.fetchUnreadEstimate('test-token', '3- Career');
  expect(count).toBe(7);
});
```

**Step 4 — Verify:** `npx jest tests/api-client.test.js` → PASS (all 6)

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/tests/api-client.test.js
git commit -m "test: add inbox presence and unread estimate coverage"
```

---

## Block 5 — Pill Bar UI Component

**Success Criteria:**
- [ ] `renderPillBar()` outputs correct HTML with all active pills
- [ ] Active pill has teal class applied
- [ ] Sub-pill row is hidden by default, visible when a category pill is active
- [ ] Clicking a pill calls the navigate callback with the correct Gmail URL
- [ ] Unlabeled pill always renders last
- [ ] All 5 tests pass

### Chunk 5.1 — `renderPillBar` HTML generation

**Files:** Create `lib/pill-bar.js`, `tests/pill-bar.test.js`

**Step 1 — Write failing tests:**
```js
// tests/pill-bar.test.js
const PB = require('../lib/pill-bar');

const MOCK_ACTIVE_LABELS = [
  { id: 'l5', name: '1 - Sandhya', unread: 1, color: '#9B59B6', children: [] },
  { id: 'l1', name: '3- Career', unread: 4, color: '#E67E22', children: [
    { id: 'l2', name: '3- Career/Job Hunt', unread: 2, children: [] },
    { id: 'l3', name: '3- Career/Glean', unread: 1, children: [
      { id: 'l4', name: '3- Career/Glean/Competitive', unread: 0, children: [] }
    ]}
  ]},
];

test('renders a pill for each active top-level label', () => {
  document.body.innerHTML = '<div id="test"></div>';
  const bar = PB.createPillBar(MOCK_ACTIVE_LABELS, false);
  document.body.appendChild(bar);
  const pills = document.querySelectorAll('[data-label-id]');
  expect(pills.length).toBe(2);
});

test('pill shows display name (no numeric prefix)', () => {
  document.body.innerHTML = '';
  const bar = PB.createPillBar(MOCK_ACTIVE_LABELS, false);
  document.body.appendChild(bar);
  expect(document.body.textContent).toContain('Sandhya');
  expect(document.body.textContent).not.toContain('1 - Sandhya');
});

test('unread badge renders when count > 0', () => {
  document.body.innerHTML = '';
  const bar = PB.createPillBar(MOCK_ACTIVE_LABELS, false);
  document.body.appendChild(bar);
  const badges = document.querySelectorAll('.glt-badge');
  expect(badges.length).toBeGreaterThan(0);
  expect(badges[0].textContent).toBe('1');
});

test('sub-pill row hidden by default', () => {
  document.body.innerHTML = '';
  const bar = PB.createPillBar(MOCK_ACTIVE_LABELS, false);
  document.body.appendChild(bar);
  const subRow = document.querySelector('.glt-subpill-row');
  expect(subRow.style.display).toBe('none');
});
```

**Step 3 — Implement:**
```js
// lib/pill-bar.js
const PillBar = (() => {
  // Reuse LabelHierarchy.getDisplayName — available as global in browser,
  // required inline for tests
  function getDisplayName(fullName) {
    const lastSegment = fullName.split('/').pop();
    return lastSegment.replace(/^\d+\s*[-–]\s*/, '').trim();
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else if (k === 'style') Object.assign(node.style, v);
      else node.setAttribute(k, v);
    });
    children.forEach(c => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function createPill(label, isActive) {
    const dot = el('span', { className: 'glt-dot', style: { background: label.color || '#AEAAA0' } });
    const name = el('span', { className: 'glt-name' }, getDisplayName(label.name));
    const pillChildren = [dot, name];

    if (label.unread > 0) {
      pillChildren.push(el('span', { className: 'glt-badge' }, String(label.unread)));
    }

    return el('button', {
      className: `glt-pill${isActive ? ' glt-pill--active' : ''}`,
      'data-label-id': label.id,
      'data-label-name': label.name,
    }, ...pillChildren);
  }

  function createSubPill(label, isActive) {
    const dot = el('span', { className: 'glt-subdot', style: { background: label.color || '#AEAAA0' } });
    const name = el('span', {}, getDisplayName(label.name));
    return el('button', {
      className: `glt-subpill${isActive ? ' glt-subpill--active' : ''}`,
      'data-label-id': label.id,
      'data-label-name': label.name,
    }, dot, name);
  }

  function createPillBar(activeLabels, hasUnlabeled, activeLabelId = null, activeSubId = null) {
    const wrapper = el('div', { className: 'glt-wrapper' });

    // Row 1: category pills
    const pillRow = el('div', { className: 'glt-pill-row' });
    activeLabels.forEach(label => {
      pillRow.appendChild(createPill(label, label.id === activeLabelId));
    });
    if (hasUnlabeled) {
      const unlabeledPill = el('button', {
        className: 'glt-pill glt-pill--unlabeled',
        'data-label-id': '__unlabeled__'
      }, el('span', { className: 'glt-name' }, 'Unlabeled'));
      pillRow.appendChild(unlabeledPill);
    }
    wrapper.appendChild(pillRow);

    // Row 2: sub-pills (hidden until a category pill is active)
    const subRow = el('div', { className: 'glt-subpill-row', style: { display: 'none' } });
    wrapper.appendChild(subRow);

    return wrapper;
  }

  function showSubPills(wrapper, parentLabel, activeSubId) {
    const subRow = wrapper.querySelector('.glt-subpill-row');
    subRow.innerHTML = '';
    subRow.style.display = 'flex';

    // "All X" pill always first
    const allPill = el('button', {
      className: `glt-subpill${!activeSubId ? ' glt-subpill--active' : ''}`,
      'data-label-id': parentLabel.id,
      'data-label-name': parentLabel.name,
      'data-sub-all': 'true'
    }, el('span', {}, `All ${getDisplayName(parentLabel.name)}`));
    subRow.appendChild(allPill);

    // Direct children only (grandchildren roll up)
    parentLabel.children.forEach(child => {
      subRow.appendChild(createSubPill(child, child.id === activeSubId));
    });
  }

  function hideSubPills(wrapper) {
    const subRow = wrapper.querySelector('.glt-subpill-row');
    subRow.style.display = 'none';
    subRow.innerHTML = '';
  }

  const api = { createPillBar, showSubPills, hideSubPills, createPill };
  if (typeof module !== 'undefined') module.exports = api;
  else window.PillBar = api;
})();
```

**Step 4 — Verify:** `npx jest tests/pill-bar.test.js` → PASS

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/lib/pill-bar.js gmail-label-tabs/tests/pill-bar.test.js
git commit -m "feat: implement pill bar DOM component with sub-pill support"
```

---

## Block 6 — Styles (Brand Palette)

**Success Criteria:**
- [ ] Pill bar uses `#F5F2E8` cream background, DM Sans font
- [ ] Active pill is `#1A9E96` teal with white text
- [ ] Sub-pill row uses `#FAFAF8` surface background
- [ ] Gmail's native category tabs (`div.aKh`) are hidden
- [ ] Right-edge fade gradient hints at overflow

### Chunk 6.1 — `styles.css`

**Files:** Create `gmail-label-tabs/styles.css`

```css
/* gmail-label-tabs/styles.css */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

/* Hide Gmail's native Primary/Social/Promotions tabs */
div.aKh, div.J-KU-Jg { display: none !important; }

/* Wrapper */
.glt-wrapper {
  font-family: 'DM Sans', sans-serif;
  border-bottom: 1px solid #E8E4D9;
  background: #F5F2E8;
}

/* Row 1 — category pills */
.glt-pill-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
  mask-image: linear-gradient(to right, black 85%, transparent 100%);
}
.glt-pill-row::-webkit-scrollbar { display: none; }

.glt-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid #E8E4D9;
  background: #F5F2E8;
  color: #7A7469;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color 0.15s, color 0.15s;
}
.glt-pill:hover { border-color: #1A9E96; color: #2B2B2B; }
.glt-pill--active {
  background: #1A9E96;
  border-color: #1A9E96;
  color: #ffffff;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(26,158,150,0.28);
}
.glt-pill--active .glt-badge { background: rgba(255,255,255,0.25); color: #fff; }

.glt-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.glt-pill--active .glt-dot { background: rgba(255,255,255,0.6) !important; }

.glt-badge {
  font-size: 10px;
  font-weight: 600;
  background: rgba(0,0,0,0.08);
  padding: 1px 5px;
  border-radius: 8px;
  min-width: 16px;
  text-align: center;
}

/* Row 2 — sub-pills */
.glt-subpill-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 20px 10px;
  background: #FAFAF8;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
  mask-image: linear-gradient(to right, black 85%, transparent 100%);
}
.glt-subpill-row::-webkit-scrollbar { display: none; }

.glt-subpill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border-radius: 12px;
  border: 1px solid #E8E4D9;
  background: transparent;
  color: #7A7469;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.glt-subpill:hover { background: #F5F2E8; color: #2B2B2B; }
.glt-subpill--active {
  background: #E8F7F6;
  border-color: #1A9E96;
  color: #1A9E96;
  font-weight: 500;
}

.glt-subdot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Reconnect error state */
.glt-error {
  font-size: 12px;
  color: #D94F3D;
  padding: 8px 20px;
  font-family: 'DM Sans', sans-serif;
}
```

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/styles.css
git commit -m "feat: add brand-palette styles for pill bar (DM Sans, cream/teal)"
```

---

## Block 7 — DOM Injector & SPA Handler

**Success Criteria:**
- [ ] Pill bar is injected above Gmail's email list on inbox load
- [ ] Extension survives navigating into an email thread and back
- [ ] Extension does not inject twice on re-navigation
- [ ] Errors are caught and logged; Gmail renders normally if injection fails

### Chunk 7.1 — `injector.js` (MutationObserver + full wiring)

**Files:** Create `lib/injector.js`

```js
// lib/injector.js
const Injector = (() => {
  const INJECTION_ID = 'glt-pill-bar';
  let state = {
    token: null,
    tree: [],
    activeLabelId: null,
    activeSubId: null,
  };

  function isInjected() {
    return !!document.getElementById(INJECTION_ID);
  }

  function removeExisting() {
    const existing = document.getElementById(INJECTION_ID);
    if (existing) existing.remove();
  }

  // Find the email list container — targets div[role="main"] > first table
  function findAnchor() {
    const main = document.querySelector('div[role="main"]');
    if (!main) return null;
    // Gmail renders the thread list as a table inside role=main
    const table = main.querySelector('table.F.cf.zt');
    if (table) return table;
    // Fallback: any table inside main
    return main.querySelector('table');
  }

  async function buildPillData(token, tree) {
    const sorted = LabelHierarchy.sortTopLevel(tree);

    // Parallel inbox presence checks for all top-level labels
    const presenceResults = await Promise.all(
      sorted.map(node =>
        ApiClient.checkInboxPresence(token, node.name)
          .then(present => ({ node, present }))
          .catch(() => ({ node, present: false }))
      )
    );

    const activeNodes = presenceResults
      .filter(r => r.present)
      .map(r => r.node);

    // Parallel unread counts for active labels
    await Promise.all(
      activeNodes.map(async node => {
        node.unread = await ApiClient.fetchUnreadEstimate(token, node.name)
          .catch(() => 0);
      })
    );

    const hasUnlabeled = await ApiClient.checkUnlabeledPresence(token).catch(() => false);

    return { activeNodes, hasUnlabeled };
  }

  async function loadSubPills(token, parentNode) {
    const children = parentNode.children;
    if (children.length === 0) return;

    await Promise.all(
      children.map(async child => {
        child.present = await ApiClient.checkInboxPresence(token, child.name).catch(() => false);
        child.unread = await ApiClient.fetchUnreadEstimate(token, child.name).catch(() => 0);
      })
    );
    parentNode.children = children.filter(c => c.present);
  }

  function handlePillClick(e, wrapper, activeNodes, token) {
    const pill = e.target.closest('[data-label-id]');
    if (!pill) return;

    const labelId = pill.getAttribute('data-label-id');
    const labelName = pill.getAttribute('data-label-name');

    // Update active state visuals
    wrapper.querySelectorAll('.glt-pill').forEach(p => p.classList.remove('glt-pill--active'));
    pill.classList.add('glt-pill--active');
    state.activeLabelId = labelId;
    state.activeSubId = null;

    if (labelId === '__unlabeled__') {
      PillBar.hideSubPills(wrapper);
      window.location.hash = SearchQuery.buildGmailUrl(SearchQuery.buildUnlabeledQuery());
      return;
    }

    const parentNode = activeNodes.find(n => n.id === labelId);

    if (parentNode && parentNode.children.length > 0) {
      loadSubPills(token, parentNode).then(() => {
        PillBar.showSubPills(wrapper, parentNode, null);
        handleSubRowClicks(wrapper, parentNode, token);
      });
    } else {
      PillBar.hideSubPills(wrapper);
    }

    // Navigate using all descendant label names
    const descendantNames = LabelHierarchy.getDescendantIds(parentNode || {children:[]})
      .map(id => {
        const found = findNodeById(state.tree, id);
        return found ? found.name : null;
      })
      .filter(Boolean);

    const query = SearchQuery.buildSearchQuery(labelName, descendantNames);
    window.location.hash = SearchQuery.buildGmailUrl(query);
  }

  function handleSubRowClicks(wrapper, parentNode, token) {
    const subRow = wrapper.querySelector('.glt-subpill-row');
    subRow.addEventListener('click', (e) => {
      const pill = e.target.closest('[data-label-id]');
      if (!pill) return;

      subRow.querySelectorAll('.glt-subpill').forEach(p => p.classList.remove('glt-subpill--active'));
      pill.classList.add('glt-subpill--active');

      const isAll = pill.getAttribute('data-sub-all') === 'true';
      const labelName = pill.getAttribute('data-label-name');

      if (isAll) {
        const descendantNames = LabelHierarchy.getDescendantIds(parentNode)
          .map(id => { const n = findNodeById(state.tree, id); return n ? n.name : null; })
          .filter(Boolean);
        window.location.hash = SearchQuery.buildGmailUrl(
          SearchQuery.buildSearchQuery(parentNode.name, descendantNames)
        );
      } else {
        const subNode = parentNode.children.find(c => c.name === labelName);
        const descendantNames = subNode ? LabelHierarchy.getDescendantIds(subNode)
          .map(id => { const n = findNodeById(state.tree, id); return n ? n.name : null; })
          .filter(Boolean) : [];
        window.location.hash = SearchQuery.buildGmailUrl(
          SearchQuery.buildSearchQuery(labelName, descendantNames)
        );
      }
    });
  }

  function findNodeById(nodes, id) {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNodeById(node.children || [], id);
      if (found) return found;
    }
    return null;
  }

  async function inject() {
    if (isInjected()) return;

    const anchor = findAnchor();
    if (!anchor) return;

    try {
      if (!state.token) {
        state.token = await ApiClient.getToken();
      }

      const rawLabels = await ApiClient.fetchLabels(state.token);
      state.tree = LabelHierarchy.buildTree(rawLabels);

      const { activeNodes, hasUnlabeled } = await buildPillData(state.token, state.tree);

      if (activeNodes.length === 0 && !hasUnlabeled) return;

      const wrapper = PillBar.createPillBar(activeNodes, hasUnlabeled);
      wrapper.id = INJECTION_ID;

      wrapper.querySelector('.glt-pill-row').addEventListener('click', (e) => {
        handlePillClick(e, wrapper, activeNodes, state.token);
      });

      anchor.parentNode.insertBefore(wrapper, anchor);
    } catch (err) {
      console.error('[GmailLabelTabs] Injection failed:', err);
    }
  }

  function isInbox() {
    return window.location.hash === '' ||
      window.location.hash === '#inbox' ||
      window.location.hash.startsWith('#inbox');
  }

  function init() {
    // Watch for Gmail SPA navigation
    window.addEventListener('hashchange', () => {
      if (isInbox()) {
        removeExisting();
        inject();
      } else {
        // On search results page (our navigation), don't re-inject
        // but keep the bar if already present
      }
    });

    // Watch for Gmail's lazy DOM rendering
    const observer = new MutationObserver(() => {
      if (isInbox() && !isInjected() && findAnchor()) {
        inject();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial load
    if (isInbox()) inject();
  }

  const api = { init };
  if (typeof module !== 'undefined') module.exports = api;
  else window.Injector = api;
})();

// Auto-initialize when loaded as a content script
if (typeof module === 'undefined') {
  Injector.init();
}
```

**Step 5 — Commit:**
```bash
git add gmail-label-tabs/lib/injector.js
git commit -m "feat: add MutationObserver injector with SPA navigation and error handling"
```

---

## Block 8 — Google Cloud OAuth Setup (One-Time Manual Step)

This block is manual (no code). Required before the extension works in Chrome.

### Steps:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: `gmail-label-tabs`
3. Enable **Gmail API** (APIs & Services → Enable APIs)
4. Create credentials: **OAuth 2.0 Client ID** → Application type: **Chrome Extension**
5. Enter your extension ID (found at `chrome://extensions` after loading unpacked)
6. Copy the **Client ID** into `manifest.json` → `oauth2.client_id`
7. OAuth consent screen: External, Scopes: `gmail.readonly`, Test users: your Gmail address

---

## Block 9 — Icons & Load as Unpacked

### Chunk 9.1 — Placeholder icons

**Files:** Create `icons/` with placeholder PNGs (or use any 16/48/128px images initially)

```bash
# Quick placeholder icons using Canvas (run in browser console, save as PNG)
# Or use any square PNG images renamed to icon16.png, icon48.png, icon128.png
```

### Chunk 9.2 — Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `gmail-label-tabs/` folder
4. Note the Extension ID shown
5. Add Extension ID to Google Cloud OAuth credentials (Block 8, Step 5)
6. Open Gmail → click extension icon → **Connect Gmail**
7. Reload Gmail tab

---

## Technical Debt

| Item | Severity | Notes |
|---|---|---|
| `resultSizeEstimate` is approximate | Low | Google's API explicitly says this is an estimate. For a personal inbox it's accurate enough. Exact counting requires fetching all messages. |
| Gmail DOM selector `table.F.cf.zt` may change | Medium | Fallback to `table` inside `role=main`. If both fail, injection skips gracefully with console log. |
| Unread counts show label total, not inbox-only | Low | `fetchUnreadEstimate` queries `in:inbox is:unread` but uses `resultSizeEstimate`. Acceptable for v1. |
| No token refresh on 401 | Low | If token expires mid-session, next Gmail navigation will re-request silently. |
| Sub-label presence check is lazy (on first click) | Low | Could pre-fetch all sub-labels on load. Deferred to avoid API quota usage on labels that are never clicked. |

---

## Production & Design Standards

- **Error handling:** All async paths in `injector.js` wrapped in `try/catch` → `console.error`. Gmail renders normally on failure.
- **Timeouts:** Gmail API calls rely on browser `fetch` default (no explicit timeout). For a personal tool this is acceptable. Add `AbortController` if latency becomes a problem.
- **API quota:** 12 parallel `messages.list` calls on load + lazy sub-label checks. Well within Gmail API's 250 quota units/second free limit.
- **No data written:** Extension is fully readonly (`gmail.readonly` scope). Cannot send, archive, or modify email.
- **Font loading:** DM Sans loaded via Google Fonts in `styles.css`. If offline, system sans-serif fallback applies.
