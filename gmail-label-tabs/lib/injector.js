const Injector = (() => {
  const INJECTION_ID = 'glt-pill-bar';
  const LABEL_TTL_MS = 60 * 60 * 1000;
  const SUMMARY_TTL_MS = 60 * 1000;
  const RETRY_DELAY_MS = 120;
  const ERROR_RETRY_MS = 30 * 1000;

  const state = {
    activeLabelId: '__all__',
    activeNodes: [],
    activeSubId: null,
    anchorCandidate: null,
    anchorSignature: '',
    childrenLoaded: {},
    childrenRefreshAt: {},
    childrenPromises: {},
    dataPromise: null,
    initialized: false,
    labelsRefreshAt: 0,
    lastLoadError: null,
    nextLoadAttemptAt: 0,
    observer: null,
    queryIndex: {},
    ready: false,
    reconcileRequest: 0,
    reconcileTimer: null,
    token: null,
    topSummariesRefreshAt: 0,
    tree: [],
    unlabeledUnread: false,
    wakeAt: 0,
    wakeTimer: null
  };

  function deps() {
    return {
      ApiClient: window.ApiClient,
      Cache: window.GltCache,
      LabelHierarchy: window.LabelHierarchy,
      Layout: window.GltLayout,
      PillBar: window.PillBar,
      SearchQuery: window.SearchQuery
    };
  }

  function routeForHash(hash) {
    const { SearchQuery } = deps();
    const value = String(hash || '').replace(/^#/, '');
    const segments = value.split('/');
    const section = segments[0];

    if (!section || section === 'inbox') {
      if (!section || segments.length === 1) return { kind: 'inbox' };
      if (segments.length === 2 && /^p\d+$/.test(segments[1])) return { kind: 'inbox' };
      return { kind: 'conversation' };
    }

    if (section === 'search') {
      if (segments.length > 3) return { kind: 'conversation' };
      if (segments.length === 3 && !/^p\d+$/.test(segments[2])) return { kind: 'conversation' };
      const query = SearchQuery.queryFromGmailHash(hash);
      return query ? { kind: 'search', query } : { kind: 'other' };
    }

    return { kind: 'other' };
  }

  function isRelevantGmailView() {
    const route = routeForHash(window.location.hash);
    return route.kind === 'inbox' || route.kind === 'search';
  }

  function findAnchor() {
    const main = document.querySelector('div[role="main"]');
    if (!main) return null;

    const semanticGrid = main.querySelector('div[role="grid"]');
    if (semanticGrid) return semanticGrid;

    const knownRow = main.querySelector('tr.zA');
    if (knownRow) {
      const rowTable = knownRow.closest('table');
      if (rowTable) return rowTable;
    }

    return main.querySelector('table.F.cf.zt') ||
      main.querySelector('table');
  }

  function queryForNode(node) {
    const { LabelHierarchy, SearchQuery } = deps();
    return SearchQuery.buildSearchQuery(node.name, LabelHierarchy.getDescendantNames(node));
  }

  function unreadQueryForNode(node) {
    const { LabelHierarchy, SearchQuery } = deps();
    return SearchQuery.buildUnreadQuery(node.name, LabelHierarchy.getDescendantNames(node));
  }

  function buildSelectionIndex(tree) {
    const { SearchQuery } = deps();
    const index = {};

    (tree || []).forEach(parent => {
      index[SearchQuery.normalizeQuery(queryForNode(parent))] = {
        activeLabelId: parent.id,
        activeSubId: null
      };

      (parent.children || []).forEach(child => {
        index[SearchQuery.normalizeQuery(queryForNode(child))] = {
          activeLabelId: parent.id,
          activeSubId: child.id
        };
      });
    });

    index[SearchQuery.normalizeQuery(SearchQuery.buildUnlabeledQuery())] = {
      activeLabelId: '__unlabeled__',
      activeSubId: null
    };
    return index;
  }

  function selectionForRoute(route) {
    const { SearchQuery } = deps();
    if (route.kind === 'inbox') {
      return { activeLabelId: '__all__', activeSubId: null };
    }
    if (route.kind !== 'search') return null;
    return state.queryIndex[SearchQuery.normalizeQuery(route.query)] || null;
  }

  function entriesForNodes(nodes) {
    return (nodes || []).map(node => ({
      id: node.id,
      query: queryForNode(node),
      unreadQuery: unreadQueryForNode(node)
    }));
  }

  function entriesFingerprint(entries) {
    return (entries || []).map(entry => entry.id + ':' + entry.query).join('|');
  }

  function summaryMap(summaries) {
    return (summaries || []).reduce((map, summary) => {
      map[summary.id] = summary;
      return map;
    }, {});
  }

  function isAuthError(error) {
    return !!error && (
      error.type === 'OAuthError' ||
      error.status === 401 ||
      error.status === 403
    );
  }

  function clearWakeTimer() {
    if (state.wakeTimer !== null) window.clearTimeout(state.wakeTimer);
    state.wakeTimer = null;
    state.wakeAt = 0;
  }

  function scheduleWakeAt(timestamp) {
    if (!timestamp || timestamp <= 0) return;
    if (state.wakeTimer !== null && state.wakeAt === timestamp) return;

    clearWakeTimer();
    state.wakeAt = timestamp;
    state.wakeTimer = window.setTimeout(() => {
      state.wakeTimer = null;
      state.wakeAt = 0;
      scheduleReconcile();
    }, Math.max(0, timestamp - Date.now()));
  }

  function scheduleKnownRefresh() {
    const activeChildRefresh = state.childrenRefreshAt[state.activeLabelId];
    const candidates = [
      state.labelsRefreshAt,
      state.topSummariesRefreshAt,
      state.nextLoadAttemptAt,
      activeChildRefresh
    ].filter(timestamp => timestamp > 0);

    if (candidates.length === 0) {
      clearWakeTimer();
      return;
    }
    scheduleWakeAt(Math.min(...candidates));
  }

  function dataRefreshIsDue() {
    const now = Date.now();
    if (!state.ready) return !state.lastLoadError || now >= state.nextLoadAttemptAt;
    return now >= state.labelsRefreshAt || now >= state.topSummariesRefreshAt;
  }

  async function withAuthRetry(operation) {
    const { ApiClient } = deps();
    if (!state.token) state.token = await ApiClient.getToken();

    try {
      return await operation(state.token);
    } catch (error) {
      if (error.status !== 401) throw error;
      await ApiClient.invalidateToken(state.token);
      state.token = await ApiClient.getToken();
      return operation(state.token);
    }
  }

  async function fetchSummaries(entries) {
    const { ApiClient } = deps();
    return withAuthRetry(token => ApiClient.fetchQuerySummaries(token, entries, 4));
  }

  function currentTopSummaries() {
    const summaries = {};
    (state.tree || []).forEach(node => {
      summaries[node.id] = { present: node.present, unread: node.unread };
    });
    summaries.__unlabeled__ = {
      present: state.unlabeledUnread !== false,
      unread: state.unlabeledUnread === false ? 0 : state.unlabeledUnread
    };
    return summaries;
  }

  function applyTopSummaries(topNodes, summaries, previous) {
    const byId = summaryMap(summaries);

    topNodes.forEach(node => {
      let summary = byId[node.id] || { present: true, unread: 0, error: true };
      if (summary.error && previous && previous[node.id]) summary = previous[node.id];
      node.present = summary.present;
      node.unread = summary.unread;
    });

    state.activeNodes = topNodes.filter(node => node.present);
    let unlabeled = byId.__unlabeled__;
    if (unlabeled && unlabeled.error && previous && previous.__unlabeled__) {
      unlabeled = previous.__unlabeled__;
    }
    state.unlabeledUnread = unlabeled && unlabeled.present ? unlabeled.unread : false;
  }

  function installTree(rawLabels) {
    const { LabelHierarchy } = deps();
    state.tree = LabelHierarchy.buildTree(rawLabels);
    state.queryIndex = buildSelectionIndex(state.tree);
    state.childrenLoaded = {};
    state.childrenRefreshAt = {};
    state.childrenPromises = {};
  }

  function topSummaryEntries() {
    const { LabelHierarchy, SearchQuery } = deps();
    const topNodes = LabelHierarchy.sortTopLevel(state.tree);
    return {
      entries: entriesForNodes(topNodes).concat([{
        id: '__unlabeled__',
        query: SearchQuery.buildUnlabeledQuery(),
        unreadQuery: SearchQuery.buildUnlabeledQuery() + ' is:unread'
      }]),
      topNodes
    };
  }

  function summariesHaveErrors(summaries) {
    return (summaries || []).some(summary => summary.error);
  }

  function finishSuccessfulLoad() {
    state.ready = true;
    state.lastLoadError = null;
    state.nextLoadAttemptAt = 0;
    scheduleKnownRefresh();
  }

  async function loadCatalogAndTopSummaries() {
    const { ApiClient, Cache } = deps();
    const now = Date.now();
    let rawLabels = Cache ? await Cache.get('labels') : null;

    if (!rawLabels) {
      rawLabels = await withAuthRetry(token => ApiClient.fetchLabels(token));
      if (Cache) await Cache.set('labels', rawLabels, LABEL_TTL_MS);
    }
    state.labelsRefreshAt = now + LABEL_TTL_MS;

    installTree(rawLabels);
    const { entries, topNodes } = topSummaryEntries();
    const fingerprint = entriesFingerprint(entries);
    let cached = Cache ? await Cache.get('top-summaries') : null;
    let summaries = cached && cached.fingerprint === fingerprint ? cached.summaries : null;

    if (!summaries) {
      summaries = await fetchSummaries(entries);
      if (Cache && !summariesHaveErrors(summaries)) {
        await Cache.set('top-summaries', { fingerprint, summaries }, SUMMARY_TTL_MS);
      }
    }

    applyTopSummaries(topNodes, summaries);
    state.topSummariesRefreshAt = now + (
      summariesHaveErrors(summaries) ? ERROR_RETRY_MS : SUMMARY_TTL_MS
    );
    finishSuccessfulLoad();
  }

  async function refreshCatalogAndTopSummaries() {
    const { ApiClient, Cache } = deps();
    const now = Date.now();
    const labelsExpired = now >= state.labelsRefreshAt;
    const previousSummaries = currentTopSummaries();

    if (labelsExpired) {
      const rawLabels = await withAuthRetry(token => ApiClient.fetchLabels(token));
      if (Cache) await Cache.set('labels', rawLabels, LABEL_TTL_MS);
      installTree(rawLabels);
      state.labelsRefreshAt = now + LABEL_TTL_MS;
    }

    if (labelsExpired || now >= state.topSummariesRefreshAt) {
      const { entries, topNodes } = topSummaryEntries();
      const summaries = await fetchSummaries(entries);
      const hasErrors = summariesHaveErrors(summaries);
      if (Cache && !hasErrors) {
        await Cache.set('top-summaries', {
          fingerprint: entriesFingerprint(entries),
          summaries
        }, SUMMARY_TTL_MS);
      }
      applyTopSummaries(topNodes, summaries, previousSummaries);
      state.topSummariesRefreshAt = now + (hasErrors ? ERROR_RETRY_MS : SUMMARY_TTL_MS);
    }

    finishSuccessfulLoad();
  }

  async function ensureData() {
    const now = Date.now();
    const refreshDue = state.ready && (
      now >= state.labelsRefreshAt ||
      now >= state.topSummariesRefreshAt
    );
    if (state.ready && !refreshDue) {
      scheduleKnownRefresh();
      return;
    }
    if (state.lastLoadError && Date.now() < state.nextLoadAttemptAt) {
      scheduleKnownRefresh();
      throw state.lastLoadError;
    }
    if (state.dataPromise) return state.dataPromise;

    const hadData = state.ready;
    const loader = hadData ? refreshCatalogAndTopSummaries : loadCatalogAndTopSummaries;
    state.dataPromise = loader()
      .catch(error => {
        state.lastLoadError = error;
        state.nextLoadAttemptAt = Date.now() + ERROR_RETRY_MS;
        if (hadData) state.topSummariesRefreshAt = state.nextLoadAttemptAt;
        scheduleKnownRefresh();
        if (hadData && !isAuthError(error)) {
          console.error('[GmailLabelTabs] Keeping stale data after refresh failure:', error);
          return;
        }
        throw error;
      })
      .finally(() => {
        state.dataPromise = null;
      });
    return state.dataPromise;
  }

  function applyChildSummaries(parentNode, summaries, ttlMs, preserveExisting) {
    const byId = summaryMap(summaries);
    (parentNode.children || []).forEach(child => {
      const summary = byId[child.id] || { present: true, unread: 0, error: true };
      if (summary.error && preserveExisting) return;
      child.present = summary.present;
      child.unread = summary.unread;
    });
    state.childrenLoaded[parentNode.id] = true;
    state.childrenRefreshAt[parentNode.id] = Date.now() + ttlMs;
    scheduleKnownRefresh();
  }

  function ensureChildren(parentNode) {
    const { Cache } = deps();
    if (!parentNode) return Promise.resolve();
    if (state.childrenLoaded[parentNode.id] && Date.now() < state.childrenRefreshAt[parentNode.id]) {
      scheduleKnownRefresh();
      return Promise.resolve();
    }
    if (state.childrenPromises[parentNode.id]) return state.childrenPromises[parentNode.id];

    const entries = entriesForNodes(parentNode.children || []);
    if (entries.length === 0) {
      state.childrenLoaded[parentNode.id] = true;
      state.childrenRefreshAt[parentNode.id] = Date.now() + LABEL_TTL_MS;
      scheduleKnownRefresh();
      return Promise.resolve();
    }

    const fingerprint = entriesFingerprint(entries);
    const cacheKey = 'children:' + parentNode.id;
    const hadChildData = !!state.childrenLoaded[parentNode.id];
    state.childrenPromises[parentNode.id] = (async () => {
      const cached = Cache ? await Cache.get(cacheKey) : null;
      let summaries = cached && cached.fingerprint === fingerprint ? cached.summaries : null;

      if (!summaries) {
        summaries = await fetchSummaries(entries);
        if (Cache && !summariesHaveErrors(summaries)) {
          await Cache.set(cacheKey, { fingerprint, summaries }, SUMMARY_TTL_MS);
        }
      }

      applyChildSummaries(
        parentNode,
        summaries,
        summariesHaveErrors(summaries) ? ERROR_RETRY_MS : SUMMARY_TTL_MS,
        hadChildData
      );
    })().catch(error => {
      console.error('[GmailLabelTabs] Could not load sub-label counts:', error);
      if (isAuthError(error)) {
        state.ready = false;
        state.token = null;
        state.lastLoadError = error;
        state.nextLoadAttemptAt = Date.now() + ERROR_RETRY_MS;
        scheduleKnownRefresh();
      } else {
        applyChildSummaries(parentNode, entries.map(entry => ({
          id: entry.id,
          present: true,
          unread: 0,
          error: true
        })), ERROR_RETRY_MS, hadChildData);
      }
    }).finally(() => {
      delete state.childrenPromises[parentNode.id];
      scheduleReconcile();
    });

    return state.childrenPromises[parentNode.id];
  }

  function getVisibleChildren(parentNode) {
    return (parentNode.children || []).filter(child => child.present);
  }

  function navigateToHash(hash) {
    if (window.location.hash === hash) {
      scheduleReconcile();
      return;
    }
    window.location.hash = hash;
  }

  function navigateToQuery(query) {
    const { SearchQuery } = deps();
    navigateToHash(SearchQuery.buildGmailUrl(query));
  }

  function navigateToNode(node) {
    navigateToQuery(queryForNode(node));
  }

  function navigateToInbox() {
    const { SearchQuery } = deps();
    navigateToHash(SearchQuery.buildInboxUrl());
  }

  function navigateToUnlabeled() {
    const { SearchQuery } = deps();
    navigateToQuery(SearchQuery.buildUnlabeledQuery());
  }

  function selectTopLevel(labelId) {
    if (labelId === '__all__') {
      navigateToInbox();
      return;
    }
    if (labelId === '__unlabeled__') {
      navigateToUnlabeled();
      return;
    }

    const node = state.activeNodes.find(candidate => candidate.id === labelId);
    if (node) navigateToNode(node);
  }

  function selectSubLevel(parentNode, pill) {
    const isAll = pill.getAttribute('data-sub-all') === 'true';
    if (isAll) {
      navigateToNode(parentNode);
      return;
    }

    const labelId = pill.getAttribute('data-label-id');
    const child = (parentNode.children || []).find(candidate => candidate.id === labelId);
    if (child) navigateToNode(child);
  }

  function bindEvents(wrapper) {
    const pillRow = wrapper.querySelector('.glt-pill-row');
    const subRow = wrapper.querySelector('.glt-subpill-row');

    pillRow.addEventListener('click', event => {
      const pill = event.target.closest('[data-label-id]');
      if (!pill) return;
      event.preventDefault();
      event.stopPropagation();
      selectTopLevel(pill.getAttribute('data-label-id'));
    });

    subRow.addEventListener('click', event => {
      const pill = event.target.closest('[data-label-id]');
      if (!pill || !state.activeLabelId) return;
      const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
      if (!parentNode) return;
      event.preventDefault();
      event.stopPropagation();
      selectSubLevel(parentNode, pill);
    });
  }

  function render(anchor) {
    const { Layout, PillBar } = deps();
    if (state.activeNodes.length === 0 && state.unlabeledUnread === false) {
      Layout.teardown();
      return;
    }

    const wrapper = PillBar.createPillBar(
      state.activeNodes,
      state.unlabeledUnread,
      state.activeLabelId
    );
    wrapper.id = INJECTION_ID;
    bindEvents(wrapper);

    const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
    if (parentNode && state.childrenLoaded[parentNode.id]) {
      const children = getVisibleChildren(parentNode);
      if (children.length > 0) {
        PillBar.showSubPills(wrapper, { ...parentNode, children }, state.activeSubId);
      }
    }

    Layout.mount(wrapper, anchor);
  }

  function errorMessage(error) {
    if (error.status === 403) {
      return 'Gmail Label Tabs lacks Gmail API access. Check the API, OAuth client, and consent settings.';
    }
    if (error.type === 'OAuthError' || error.status === 401) {
      return 'Gmail Label Tabs needs sign-in. Click the extension icon to reconnect Gmail.';
    }
    return 'Gmail Label Tabs could not refresh. Gmail is unchanged; it will retry shortly.';
  }

  function showError(anchor, error) {
    const { Layout } = deps();
    const element = document.createElement('section');
    element.id = INJECTION_ID;
    element.className = 'glt-wrapper glt-error';
    element.setAttribute('role', 'alert');
    element.textContent = errorMessage(error);
    Layout.mount(element, anchor);
  }

  function anchorGeometrySignature(anchor) {
    const rect = anchor.getBoundingClientRect();
    return [Math.round(rect.top), Math.round(rect.left), Math.round(rect.width)].join(':');
  }

  function anchorIsStable(anchor) {
    const signature = anchorGeometrySignature(anchor);
    if (state.anchorCandidate === anchor && state.anchorSignature === signature) return true;

    state.anchorCandidate = anchor;
    state.anchorSignature = signature;
    window.requestAnimationFrame(scheduleReconcile);
    return false;
  }

  async function reconcile() {
    const requestId = ++state.reconcileRequest;
    const { Layout } = deps();
    let route = routeForHash(window.location.hash);

    if (route.kind !== 'inbox' && route.kind !== 'search') {
      Layout.teardown();
      return;
    }

    let anchor = findAnchor();
    if (!anchor) {
      Layout.hide();
      if (dataRefreshIsDue()) scheduleWakeAt(Date.now() + 1000);
      return;
    }

    try {
      await ensureData();
    } catch (error) {
      if (requestId === state.reconcileRequest && isRelevantGmailView()) showError(anchor, error);
      return;
    }

    if (requestId !== state.reconcileRequest) return;
    route = routeForHash(window.location.hash);
    const selection = selectionForRoute(route);

    if (!selection) {
      Layout.teardown();
      return;
    }

    anchor = findAnchor();
    if (!anchor) {
      Layout.hide();
      return;
    }

    if (!Layout.getWrapper() && !anchorIsStable(anchor)) return;

    state.activeLabelId = selection.activeLabelId;
    state.activeSubId = selection.activeSubId;
    render(anchor);

    const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
    if (parentNode && (parentNode.children || []).length > 0) ensureChildren(parentNode);
  }

  function scheduleReconcile() {
    if (state.reconcileTimer !== null) return;
    state.reconcileTimer = window.setTimeout(() => {
      state.reconcileTimer = null;
      reconcile();
    }, RETRY_DELAY_MS);
  }

  function handleMutation() {
    const { Layout } = deps();
    const wrapper = Layout.getWrapper();
    const route = routeForHash(window.location.hash);

    if (wrapper && (route.kind === 'inbox' || route.kind === 'search')) {
      const anchor = findAnchor();
      if (anchor) {
        Layout.scheduleSync(anchor);
        if (dataRefreshIsDue()) scheduleReconcile();
      }
      else Layout.hide();
      return;
    }

    scheduleReconcile();
  }

  function init() {
    if (state.initialized) return;
    if (!document.body) {
      window.setTimeout(init, RETRY_DELAY_MS);
      return;
    }

    state.initialized = true;
    window.addEventListener('hashchange', scheduleReconcile);
    window.addEventListener('resize', scheduleReconcile);
    state.observer = new MutationObserver(handleMutation);
    state.observer.observe(document.body, { childList: true, subtree: true });
    scheduleReconcile();
  }

  function resetForTests() {
    clearWakeTimer();
    if (state.reconcileTimer !== null) window.clearTimeout(state.reconcileTimer);
    Object.assign(state, {
      activeLabelId: '__all__',
      activeNodes: [],
      activeSubId: null,
      anchorCandidate: null,
      anchorSignature: '',
      childrenLoaded: {},
      childrenRefreshAt: {},
      childrenPromises: {},
      dataPromise: null,
      labelsRefreshAt: 0,
      lastLoadError: null,
      nextLoadAttemptAt: 0,
      queryIndex: {},
      ready: false,
      reconcileRequest: 0,
      reconcileTimer: null,
      token: null,
      topSummariesRefreshAt: 0,
      tree: [],
      unlabeledUnread: false
    });
  }

  const api = {
    buildSelectionIndex,
    init,
    isRelevantGmailView,
    navigateToInbox,
    navigateToNode,
    navigateToQuery,
    navigateToUnlabeled,
    queryForNode,
    reconcile,
    routeForHash
  };

  if (typeof module !== 'undefined') {
    api.__test = {
      ensureData,
      applyTopSummaries,
      dataRefreshIsDue,
      installTree,
      reset: resetForTests,
      state,
      withAuthRetry
    };
  }

  if (typeof window !== 'undefined') window.Injector = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();

if (typeof window !== 'undefined' && typeof module === 'undefined') {
  try {
    Injector.init();
  } catch (error) {
    console.error('[GmailLabelTabs] Startup failed:', error);
  }
}
