# Gmail Label Tabs — Lessons Learned

## Content Script Injection into SPA-Owned DOM

**Pattern:** Inserting content script elements directly into a SPA's (Gmail, Notion, Linear) owned DOM subtree.

**Problem:** SPAs watch their own DOM with MutationObserver and respond to unexpected mutations by locking interaction. When an extension injects a new element into `div[role="main"]` or similar, the SPA's mutation handler fires, the SPA re-renders defensively, and `pointer-events: none` is applied to the main content area *during* the re-render. Email row clicks are silently dropped. The SPA settles after ~500ms, but by then the user's click is lost.

**Wrong:**
```js
const wrapper = document.createElement('div');
anchor.parentNode.insertBefore(wrapper, anchor); // ← inside the SPA's tree
```

**Right:**
```js
const wrapper = document.createElement('div');
wrapper.style.position = 'fixed';
wrapper.style.top = anchor.getBoundingClientRect().top + 'px';
document.body.appendChild(wrapper); // ← outside the SPA's observed subtree
anchor.parentNode.style.paddingTop = wrapper.offsetHeight + 'px'; // ← push content down
```

**Tell:** Email clicks work for ~1 second after page load, then silently fail even before any user interaction with the extension. Disabling the extension restores clicks immediately.

---

## Obfuscated Class Names Drift on SPA Deploy

**Pattern:** Targeting minified/obfuscated CSS class names in feature detection or hiding.

**Problem:** Gmail's DOM classes like `div.aKh` and `div.J-KU-Jg` are minified and rotate on each deploy. A rule like `div.aKh { display: none !important }` that hides a loading spinner today may hide the message-reading pane on next week's deploy. The breakage is silent (the feature still renders, but the UI is invisible).

**Wrong:**
```css
div.aKh,
div.J-KU-Jg {
  display: none !important; /* What are these targeting? Nobody knows. */
}
```

**Right:**
```css
/* Don't hide obfuscated classes. If a native Gmail element must be suppressed,
   target by stable selectors: role, aria-label, or structural position. */
```

**Tell:** A CSS rule that "worked fine during dev" silently breaks on production deploy. No error, no console warning — the feature just doesn't work.

---

## Shared State Mutations Are Invisible to Callers

**Pattern:** Functions that mutate their input arguments (objects, arrays) when those arguments are part of shared state.

**Problem:** If a function does `parentNode.children = parentNode.children.filter(...)`, the object reference is unchanged, so no consumer is notified via assignment (`=`), object property change, or event. The mutation is permanent and silent. If a second code path later tries to iterate `parentNode.children` and expects all original children, it gets the pruned set. Data is lost with no traceback.

**Wrong:**
```js
async function loadVisibleChildren(token, parentNode) {
  const children = parentNode.children || [];
  parentNode.children = children.filter(child => child.present); // ← mutates state
  return parentNode.children;
}
```

When the pill bar is refreshed, `parentNode.children` is already trimmed and the non-present children are gone forever.

**Right:**
```js
function getVisibleChildren(parentNode) {
  return (parentNode.children || []).filter(child => child.present); // ← returns new array
}

// Caller decides whether to use the returned array or mutate
const visibleChildren = getVisibleChildren(parentNode);
PillBar.showSubPills(wrapper, { ...parentNode, children: visibleChildren }, null);
```

**Tell:** Sub-labels visible in the UI disappear on a second interaction even though the data hasn't changed. Callers can't see the side effect because the object identity is the same.

---

## Stale Tests Hide Real Bugs Until Audit

**Pattern:** Running an audit without confirming tests are green.

**Problem:** A stale test assertion (e.g., counting pills when the count is known to have changed) lies silently. Every code review finding made against a broken test baseline is suspect — the code might be right and the test wrong, or the code might be right and the test obsolete. A blocking bug found during code review should have been caught by a test; if the test was stale, the bug hid for longer than necessary.

**Wrong:**
```
$ npm test
FAIL tests/pill-bar.test.js — Expected 2 pills, got 3
$ # ... proceed with audit anyway
```

**Right:**
```
$ npm test
FAIL tests/pill-bar.test.js — Expected 2 pills, got 3
$ # STOP. Fix the test or confirm it's pre-existing.
$ git stash && npm test  # Is the failure pre-existing on main?
$ # If yes, document it. If no, fix it before proceeding.
```

**Tell:** Audit catches a code smell that feels like it should have been caught by tests. It was — the test was stale.

---

## Browser Global Namespace Collisions

**Pattern:** Exporting content script APIs via `window.X = api` without checking for collisions with browser-native globals.

**Problem:** The browser provides built-in APIs like `Cache`, `Request`, `Response`, `Headers`, `Storage`, `History`, `Navigator`, `Event`, etc. on the `window` object. If a content script exports `window.Cache = cacheApi`, host-page code that depends on `instanceof window.Cache` (used in Service Worker contexts or feature detection) silently breaks — it now points to your cache object, not the native Cache constructor. This happens silently during the "normal" page load, and the symptom appears only when code paths that use the native API are triggered.

**Wrong:**
```js
const Cache = (() => { ... })();
if (typeof window !== 'undefined') window.Cache = api; // ← collides with Service Worker API
```

**Right:**
```js
const Cache = (() => { ... })();
if (typeof window !== 'undefined') window.GltCache = api; // ← namespaced, no collision
```

**Tell:** Page-level code that uses `new window.Cache()` or `Cache.prototype` checks in Service Workers fails. Or feature-detection code like `typeof window.Cache === 'function'` returns true when it shouldn't. No error in extension context — the break happens in the host page's own scripts.

---

## Dead Code in Audit

**Pattern:** Functions defined but never called, left behind after refactoring.

**Problem:** During a refactor (e.g., `annotateNode` was replaced by the `buildPillDataFromMessages` → `annotatePresenceFromMessages` path), the old function may be left in place. It takes up cognitive overhead for the next reader ("is this used somewhere?"). Code review may not catch it if the refactoring was incremental. It gets found later in audit, which is late — a fresh eye on the files would have caught it sooner.

**Wrong:**
```js
function annotateNode(tree, token) {
  // old per-label API fetch path, never called, replaced by buildPillDataFromMessages
  // ... 50 lines of dead code ...
}

// exported but annotateNode never appears in any caller
const api = { buildQuery, buildData, /* annotateNode omitted from exports */ };
```

**Right:**
- If the function was replaced, delete it entirely.
- If it's speculative code for a future feature, move to a `.md` file under `docs/ideas/` and reference it in the roadmap.

**Tell:** Code review finds a function that looks important but grep reveals it's never called within the file and not exported. Or: grep for calls to the function across the entire codebase returns zero results.

---

## Dependency Accessor Duplication

**Pattern:** Repeated calls to a `deps()` factory function that reconstructs an object from `window.*` globals.

**Problem:** A function like `deps()` that reads `window.X`, `window.Y`, `window.Z` and returns `{ X, Y, Z }` is intended to be called once per function scope and destructured. If it's called 3 times inside a loop or in separate code paths within the same function, the object is reconstructed 3 times. This is a micro-optimization problem, but more importantly, it's a signal that the code is unclear about what it depends on — if a reader sees `deps()` called multiple times, they may think each call does something different.

**Wrong:**
```js
function selectTopLevel(tree) {
  const { ApiClient } = deps();
  const visible = tree.filter(n => n.present);
  // ... some logic ...
  const { ApiClient: api2 } = deps(); // ← reconstructed, unused second name
  // ... more logic ...
  const unread = deps().UnreadCounter; // ← reconstructed again
}
```

**Right:**
```js
function selectTopLevel(tree) {
  const { ApiClient, UnreadCounter } = deps(); // ← called once, all deps destructured
  const visible = tree.filter(n => n.present);
  // ... logic uses ApiClient and UnreadCounter ...
}
```

**Tell:** Grep shows a function calling `deps()` more than once (e.g., `grep -n "deps()" lib/injector.js | head -20` shows lines 289, 295, 302 all in the same function).
