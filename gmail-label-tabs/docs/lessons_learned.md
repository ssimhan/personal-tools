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
