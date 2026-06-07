const Injector = (() => {
  const INJECTION_ID = 'glt-pill-bar';
  const RETRY_DELAY_MS = 350;

  const state = {
    activeLabelId: null,
    activeSubId: null,
    activeNodes: [],
    initialized: false,
    injecting: false,
    token: null,
    tree: []
  };

  function deps() {
    return {
      ApiClient: window.ApiClient,
      LabelHierarchy: window.LabelHierarchy,
      PillBar: window.PillBar,
      SearchQuery: window.SearchQuery
    };
  }

  function isRelevantGmailView() {
    const hash = window.location.hash || '';
    return hash === '' ||
      hash === '#inbox' ||
      hash.indexOf('#inbox') === 0 ||
      hash.indexOf('#search') === 0;
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
  }

  function showError(anchor, message) {
    removeExisting();

    const error = document.createElement('div');
    error.id = INJECTION_ID;
    error.className = 'glt-error';
    error.textContent = message;
    anchor.parentNode.insertBefore(error, anchor);
  }

  function queryForNode(node) {
    const { LabelHierarchy, SearchQuery } = deps();
    return SearchQuery.buildSearchQuery(node.name, LabelHierarchy.getDescendantNames(node));
  }

  function unreadQueryForNode(node) {
    const { LabelHierarchy, SearchQuery } = deps();
    return SearchQuery.buildUnreadQuery(node.name, LabelHierarchy.getDescendantNames(node));
  }

  async function annotateNode(token, node) {
    const { ApiClient } = deps();
    const query = queryForNode(node);
    const unreadQuery = unreadQueryForNode(node);

    node.present = await ApiClient.checkInboxPresence(token, query).catch(() => false);
    node.unread = node.present
      ? await ApiClient.fetchUnreadEstimate(token, unreadQuery).catch(() => 0)
      : 0;

    return node;
  }

  function messageHasAnyLabel(message, labelIds) {
    const messageLabelIds = message.labelIds || [];
    return labelIds.some(id => messageLabelIds.indexOf(id) !== -1);
  }

  function countMessagesForNode(node, messages) {
    const { LabelHierarchy } = deps();
    const familyIds = [node.id].concat(LabelHierarchy.getDescendantIds(node));
    return messages.filter(message => messageHasAnyLabel(message, familyIds)).length;
  }

  function countUnreadMessagesForNode(node, messages) {
    const { LabelHierarchy } = deps();
    const familyIds = [node.id].concat(LabelHierarchy.getDescendantIds(node));
    return messages.filter(message =>
      messageHasAnyLabel(message, familyIds) &&
      (message.labelIds || []).indexOf('UNREAD') !== -1
    ).length;
  }

  function annotatePresenceFromMessages(nodes, messages) {
    (nodes || []).forEach(node => {
      node.present = countMessagesForNode(node, messages) > 0;
      node.unread = countUnreadMessagesForNode(node, messages);
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

  async function buildPillData(token, tree) {
    const { ApiClient, LabelHierarchy } = deps();
    const messages = await ApiClient.fetchInboxMessageLabelSets(token);
    const userLabelIds = LabelHierarchy.flattenNodes(tree).map(node => node.id);

    annotatePresenceFromMessages(tree, messages);

    const topLevel = LabelHierarchy.sortTopLevel(tree);
    const activeNodes = topLevel.filter(node => node.present);
    const unlabeledUnread = getUnlabeledUnread(messages, userLabelIds);

    return { activeNodes, unlabeledUnread };
  }

  async function loadVisibleChildren(token, parentNode) {
    const children = parentNode.children || [];
    parentNode.children = children.filter(child => child.present);
    return parentNode.children;
  }

  function getInboxRows() {
    const anchor = findAnchor();
    if (!anchor) return [];

    const rows = Array.from(anchor.querySelectorAll('tr'));
    if (rows.length > 0) return rows;

    return Array.from(document.querySelectorAll('div[role="main"] tr'));
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/\u2026/g, '')
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

  function setActivePill(wrapper, labelId) {
    wrapper.querySelectorAll('.glt-pill').forEach(pill => {
      pill.classList.toggle('glt-pill--active', pill.getAttribute('data-label-id') === labelId);
    });
  }

  function setActiveSubPill(wrapper, labelId) {
    wrapper.querySelectorAll('.glt-subpill').forEach(pill => {
      pill.classList.toggle('glt-subpill--active', pill.getAttribute('data-label-id') === labelId);
    });
  }

  async function selectTopLevel(wrapper, labelId) {
    state.activeLabelId = labelId;
    state.activeSubId = null;
    setActivePill(wrapper, labelId);

    if (labelId === '__unlabeled__') {
      const { PillBar, SearchQuery } = deps();
      PillBar.hideSubPills(wrapper);
      navigateToQuery(SearchQuery.buildUnlabeledQuery());
      return;
    }

    const { PillBar } = deps();
    const parentNode = state.activeNodes.find(node => node.id === labelId);
    if (!parentNode) return;

    navigateToNode(parentNode);

    await loadVisibleChildren(state.token, parentNode);
    if (parentNode.children.length > 0) {
      PillBar.showSubPills(wrapper, parentNode, null);
    } else {
      PillBar.hideSubPills(wrapper);
    }
  }

  function selectSubLevel(wrapper, parentNode, pill) {
    const labelId = pill.getAttribute('data-label-id');
    const isAll = pill.getAttribute('data-sub-all') === 'true';

    state.activeSubId = isAll ? null : labelId;
    setActiveSubPill(wrapper, labelId);

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
      selectTopLevel(wrapper, pill.getAttribute('data-label-id'));
    });

    subRow.addEventListener('click', event => {
      const pill = event.target.closest('[data-label-id]');
      if (!pill || !state.activeLabelId) return;

      const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
      if (parentNode) selectSubLevel(wrapper, parentNode, pill);
    });
  }

  async function restoreActiveSubRow(wrapper) {
    const { PillBar } = deps();
    if (!state.activeLabelId || state.activeLabelId === '__unlabeled__') return;

    const parentNode = state.activeNodes.find(node => node.id === state.activeLabelId);
    if (!parentNode) return;

    await loadVisibleChildren(state.token, parentNode);
    if (parentNode.children.length > 0) {
      PillBar.showSubPills(wrapper, parentNode, state.activeSubId);
    }
  }

  async function inject() {
    if (state.injecting || !isRelevantGmailView()) return;
    if (document.getElementById(INJECTION_ID)) return;

    const anchor = findAnchor();
    if (!anchor) return;

    state.injecting = true;

    try {
      removeExisting();

      const { ApiClient, LabelHierarchy, PillBar, SearchQuery } = deps();
      if (!ApiClient || !LabelHierarchy || !PillBar || !SearchQuery) {
        throw new Error('Extension modules did not load in order.');
      }

      if (!state.token) state.token = await ApiClient.getToken();

      const rawLabels = await ApiClient.fetchLabels(state.token);
      state.tree = LabelHierarchy.buildTree(rawLabels);

      const pillData = await buildPillData(state.token, state.tree);
      state.activeNodes = pillData.activeNodes;

      if (state.activeNodes.length === 0 && pillData.unlabeledUnread === false) {
        return;
      }

      const wrapper = PillBar.createPillBar(
        state.activeNodes,
        pillData.unlabeledUnread,
        state.activeLabelId
      );
      wrapper.id = INJECTION_ID;

      bindEvents(wrapper);
      anchor.parentNode.insertBefore(wrapper, anchor);
      await restoreActiveSubRow(wrapper);
    } catch (error) {
      console.error('[GmailLabelTabs] Could not inject pill bar:', error);

      if (String(error.message || '').indexOf('token') !== -1 || String(error.message || '').indexOf('OAuth') !== -1) {
        showError(anchor, 'Gmail Label Tabs needs sign-in. Click the extension icon to connect Gmail.');
      }
    } finally {
      state.injecting = false;
    }
  }

  function scheduleInject() {
    window.setTimeout(inject, RETRY_DELAY_MS);
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
    queryForNode
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
