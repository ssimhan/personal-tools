const Injector = (() => {
  const INJECTION_ID = 'glt-pill-bar';
  const RETRY_DELAY_MS = 350;
  const LABEL_TTL_MS = 60 * 60 * 1000;  // 1 hour  — labels rarely change
  const MESSAGES_TTL_MS = 60 * 1000;     // 60 sec  — unread counts are time-sensitive
  const FRESHNESS_GUARD_MS = 60 * 1000;  // 60 sec  — skip re-fetch if just injected
  const MIN_ANCHOR_TOP = 100;            // Gmail header+search is ~65-80px

  const state = {
    activeLabelId: null,
    activeSubId: null,
    activeNodes: [],
    initialized: false,
    injecting: false,
    token: null,
    tree: [],
    anchorParent: null,
    anchorParentOriginalPadding: '',
    lastInjectedAt: 0
  };

  function deps() {
    return {
      ApiClient: window.ApiClient,
      Cache: window.GltCache,
      LabelHierarchy: window.LabelHierarchy,
      PillBar: window.PillBar,
      SearchQuery: window.SearchQuery
    };
  }

  function isConversationOpen() {
    // An open thread looks like "#inbox/<threadId>" or "#search/<q>/<threadId>".
    // A plain list view is "#inbox", "#inbox/p2" (pagination), or "#search/<q>".
    const hash = window.location.hash || '';
    const segments = hash.replace(/^#/, '').split('/');

    if (segments[0] === 'inbox') {
      const tail = segments[1];
      // No tail, or pagination markers like "p2", are still list views.
      return !!tail && !/^p\d+$/.test(tail);
    }

    if (segments[0] === 'search') {
      // #search/<query> is a list; #search/<query>/<threadId> is open.
      return segments.length > 2;
    }

    return false;
  }

  function isRelevantGmailView() {
    const hash = window.location.hash || '';
    const isInboxOrSearch = hash === '' ||
      hash === '#inbox' ||
      hash.indexOf('#inbox') === 0 ||
      hash.indexOf('#search') === 0;

    // Stay out of the way while a single email is open.
    return isInboxOrSearch && !isConversationOpen();
  }

  function findAnchor() {
    const main = document.querySelector('div[role="main"]');
    if (!main) return null;

    return main.querySelector('table.F.cf.zt') ||
      main.querySelector('div[role="grid"]') ||
      main.querySelector('table');
  }

  function removeExisting() {
    const existing = document.getElementById(INJECTION_ID);
    if (existing) existing.remove();
    if (state.anchorParent) {
      state.anchorParent.style.paddingTop = state.anchorParentOriginalPadding;
      state.anchorParent = null;
      state.anchorParentOriginalPadding = '';
    }
  }

  function positionAndInsert(wrapper, anchor) {
    // Insert onto document.body (NOT into Gmail's DOM) to avoid triggering
    // Gmail's MutationObserver, which disables pointer-events on div[role="main"]
    // during its re-render cycle. Inserting inside Gmail's DOM caused all email
    // row clicks to silently fail until Gmail's re-render settled — even before
    // any label pill was clicked. Using position:fixed + body-append sidesteps
    // Gmail's DOM entirely. padding-top on the anchor parent compensates for the
    // space the pill bar occupies.
    const rect = anchor.getBoundingClientRect();
    wrapper.style.top = rect.top + 'px';
    wrapper.style.left = rect.left + 'px';
    wrapper.style.right = '0';

    document.body.appendChild(wrapper);

    state.anchorParent = anchor.parentNode;
    state.anchorParentOriginalPadding = anchor.parentNode.style.paddingTop || '';

    window.requestAnimationFrame(() => {
      if (!state.anchorParent) return;
      state.anchorParent.style.paddingTop = wrapper.offsetHeight + 'px';
    });
  }

  function showError(anchor, message) {
    removeExisting();

    const error = document.createElement('div');
    error.id = INJECTION_ID;
    error.className = 'glt-error';
    error.textContent = message;
    anchor.parentNode.insertBefore(error, anchor);
  }

  function buildQuery(node, type) {
    const { LabelHierarchy, SearchQuery } = deps();
    const descendants = LabelHierarchy.getDescendantNames(node);
    return type === 'unread'
      ? SearchQuery.buildUnreadQuery(node.name, descendants)
      : SearchQuery.buildSearchQuery(node.name, descendants);
  }

  function messageHasAnyLabel(message, labelIds) {
    const messageLabelIds = message.labelIds || [];
    return labelIds.some(id => messageLabelIds.indexOf(id) !== -1);
  }

  function countMessagesForNode(node, messages, unreadOnly) {
    const { LabelHierarchy } = deps();
    const familyIds = [node.id].concat(LabelHierarchy.getDescendantIds(node));
    return messages.filter(message =>
      messageHasAnyLabel(message, familyIds) &&
      (!unreadOnly || (message.labelIds || []).indexOf('UNREAD') !== -1)
    ).length;
  }

  function annotatePresenceFromMessages(nodes, messages) {
    (nodes || []).forEach(node => {
      node.present = countMessagesForNode(node, messages, false) > 0;
      node.unread = countMessagesForNode(node, messages, true);
      annotatePresenceFromMessages(node.children || [], messages);
    });
  }

  function getUnlabeledUnread(messages, userLabelIds) {
    const unlabeledMessages = messages.filter(message =>
      !messageHasAnyLabel(message, userLabelIds)
    );

    if (unlabeledMessages.length === 0) return false;

    return unlabeledMessages.filter(message =>
      (message.labelIds || []).indexOf('UNREAD') !== -1
    ).length;
  }

  function buildPillDataFromMessages(tree, messages) {
    const { LabelHierarchy } = deps();
    const userLabelIds = LabelHierarchy.flattenNodes(tree).map(node => node.id);

    annotatePresenceFromMessages(tree, messages);

    const topLevel = LabelHierarchy.sortTopLevel(tree);
    const activeNodes = topLevel.filter(node => node.present);
    const unlabeledUnread = getUnlabeledUnread(messages, userLabelIds);

    return { activeNodes, unlabeledUnread };
  }

  async function buildPillData(token, tree) {
    const { ApiClient } = deps();
    const messages = await ApiClient.fetchInboxMessageLabelSets(token);
    return buildPillDataFromMessages(tree, messages);
  }

  function getVisibleChildren(parentNode) {
    return (parentNode.children || []).filter(child => child.present);
  }

  function getInboxRows() {
    const anchor = findAnchor();
    if (!anchor) return [];

    // Scope strictly to Gmail inbox-list rows (tr.zA). Grabbing every <tr>
    // would also catch the rows that make up an open conversation and hide
    // the message you just opened.
    return Array.from(anchor.querySelectorAll('tr.zA'));
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/…/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getMatchTermsForNode(node) {
    const { LabelHierarchy } = deps();
    const names = [node.name].concat(LabelHierarchy.getDescendantNames(node));
    const terms = [];

    names.forEach(name => {
      const parts = name.split('/');
      terms.push(name);
      terms.push(LabelHierarchy.getDisplayName(name));
      terms.push(parts[parts.length - 1]);
    });

    return terms
      .map(normalizeText)
      .filter(Boolean)
      .filter((term, index, list) => list.indexOf(term) === index);
  }

  function rowMatchesTerms(row, terms) {
    const rowText = normalizeText(row.textContent);
    return terms.some(term => rowText.indexOf(term) !== -1);
  }

  function applyRowFilterForNode(node) {
    const terms = getMatchTermsForNode(node);
    getInboxRows().forEach(row => {
      row.classList.toggle('glt-row-hidden', !rowMatchesTerms(row, terms));
    });
  }

  function applyUnlabeledRowFilter() {
    const { LabelHierarchy } = deps();
    const labelTerms = LabelHierarchy.flattenNodes(state.tree)
      .map(node => normalizeText(LabelHierarchy.getDisplayName(node.name)))
      .filter(Boolean);

    getInboxRows().forEach(row => {
      row.classList.toggle('glt-row-hidden', rowMatchesTerms(row, labelTerms));
    });
  }

  function clearRowFilter() {
    getInboxRows().forEach(row => row.classList.remove('glt-row-hidden'));
  }

  function reapplyActiveFilter() {
    if (!state.activeLabelId || state.activeLabelId === '__all__') {
      clearRowFilter();
      return;
    }
    if (state.activeLabelId === '__unlabeled__') {
      applyUnlabeledRowFilter();
      return;
    }
    const parentNode = state.activeNodes.find(n => n.id === state.activeLabelId);
    if (!parentNode) return;
    if (state.activeSubId) {
      const subNode = (parentNode.children || []).find(c => c.id === state.activeSubId);
      if (subNode) { applyRowFilterForNode(subNode); return; }
    }
    applyRowFilterForNode(parentNode);
  }

  function navigateToNode(node) {
    applyRowFilterForNode(node);
  }

  function setActiveState(wrapper, selector, activeClass, labelId) {
    wrapper.querySelectorAll(selector).forEach(el => {
      el.classList.toggle(activeClass, el.getAttribute('data-label-id') === labelId);
    });
  }

  async function selectTopLevel(wrapper, labelId) {
    state.activeLabelId = labelId;
    state.activeSubId = null;
    setActiveState(wrapper, '.glt-pill', 'glt-pill--active', labelId);

    if (labelId === '__all__') {
      const { PillBar } = deps();
      PillBar.hideSubPills(wrapper);
      clearRowFilter();
      return;
    }

    if (labelId === '__unlabeled__') {
      const { PillBar } = deps();
      PillBar.hideSubPills(wrapper);
      applyUnlabeledRowFilter();
      return;
    }

    const { PillBar } = deps();
    const parentNode = state.activeNodes.find(node => node.id === labelId);
    if (!parentNode) return;

    navigateToNode(parentNode);

    const visibleChildren = getVisibleChildren(parentNode);
    if (visibleChildren.length > 0) {
      PillBar.showSubPills(wrapper, { ...parentNode, children: visibleChildren }, null);
    } else {
      PillBar.hideSubPills(wrapper);
    }
  }

  function selectSubLevel(wrapper, parentNode, pill) {
    const labelId = pill.getAttribute('data-label-id');
    const isAll = pill.getAttribute('data-sub-all') === 'true';

    state.activeSubId = isAll ? null : labelId;
    setActiveState(wrapper, '.glt-subpill', 'glt-subpill--active', labelId);

    if (isAll) {
      navigateToNode(parentNode);
      return;
    }

    const subNode = (parentNode.children || []).find(child => child.id === labelId);
    if (subNode) navigateToNode(subNode);
  }

  function bindEvents(wrapper) {
    const pillRow = wrapper.querySelector('.glt-pill-row');
    const subRow = wrapper.querySelector('.glt-subpill-row');

    pillRow.addEventListener('click', event => {
      const pill = event.target.closest('[data-label-id]');
      if (!pill) return;
      event.stopPropagation();
      selectTopLevel(wrapper, pill.getAttribute('data-label-id'));
    });

    subRow.addEventListener('click', event => {
      const pill = event.target.closest('[data-label-id]');
      if (!pill || !state.activeLabelId) return;
      event.stopPropagation();
      const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
      if (parentNode) selectSubLevel(wrapper, parentNode, pill);
    });
  }

  async function restoreActiveSubRow(wrapper) {
    const { PillBar } = deps();
    if (!state.activeLabelId || state.activeLabelId === '__unlabeled__') return;

    const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
    if (!parentNode) return;

    const visibleChildren = getVisibleChildren(parentNode);
    if (visibleChildren.length > 0) {
      PillBar.showSubPills(wrapper, { ...parentNode, children: visibleChildren }, state.activeSubId);
    }
  }

  async function renderFromData(rawLabels, messages, anchor) {
    const { LabelHierarchy, PillBar } = deps();

    removeExisting();

    state.tree = LabelHierarchy.buildTree(rawLabels);
    const pillData = buildPillDataFromMessages(state.tree, messages);
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

  async function loadAndCacheData(token) {
    const { ApiClient, Cache } = deps();
    const rawLabels = await ApiClient.fetchLabels(token);
    const messages = await ApiClient.fetchInboxMessageLabelSets(token);
    if (Cache) {
      await Cache.set('labels', rawLabels, LABEL_TTL_MS);
      await Cache.set('messages', messages, MESSAGES_TTL_MS);
    }
    return { rawLabels, messages };
  }

  async function inject() {
    if (state.injecting || !isRelevantGmailView()) return;
    if (document.getElementById(INJECTION_ID)) return;

    const anchor = findAnchor();
    if (!anchor) return;

    // Guard: if anchor hasn't settled below Gmail's header+search bar, defer.
    // Gmail's header is ~65-80px; an anchor.top < MIN_ANCHOR_TOP means layout
    // isn't finished and the pill bar would render over the search bar.
    const anchorRect = anchor.getBoundingClientRect();
    if (anchorRect.top < MIN_ANCHOR_TOP) {
      scheduleInject();
      return;
    }

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
        // Warm cache: render immediately from stale data
        await renderFromData(cachedLabels, cachedMessages, anchor);
        state.lastInjectedAt = now;

        // Background refresh — skip if we just injected recently
        if (!isRecent) {
          loadAndCacheData(state.token)
            .then(({ rawLabels, messages }) => {
              // Only re-render if something changed
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

      if (error.type === 'OAuthError') {
        const a = findAnchor();
        if (a) showError(a, 'Gmail Label Tabs needs sign-in. Click the extension icon to connect Gmail.');
      }
    } finally {
      state.injecting = false;
    }
  }

  let injectTimer = null;
  function scheduleInject() {
    if (injectTimer) window.clearTimeout(injectTimer);
    injectTimer = window.setTimeout(() => {
      injectTimer = null;
      inject();
    }, RETRY_DELAY_MS);
  }

  function init() {
    if (state.initialized) return;

    if (!document.body) {
      window.setTimeout(init, RETRY_DELAY_MS);
      return;
    }

    state.initialized = true;

    window.addEventListener('hashchange', scheduleInject);

    const observer = new MutationObserver(() => {
      if (!document.getElementById(INJECTION_ID) && isRelevantGmailView() && findAnchor()) {
        scheduleInject();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    scheduleInject();
  }

  const api = {
    init,
    isRelevantGmailView,
    buildQuery
  };

  if (typeof window !== 'undefined') window.Injector = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();

if (typeof window !== 'undefined') {
  try {
    Injector.init();
  } catch (error) {
    console.error('[GmailLabelTabs] Startup failed:', error);
  }
}
