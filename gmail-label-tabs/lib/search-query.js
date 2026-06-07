const SearchQuery = (() => {
  function quoteLabelName(name) {
    return '"' + String(name).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function labelTerm(name) {
    return 'label:' + quoteLabelName(name);
  }

  function buildSearchQuery(labelName, descendantNames) {
    const names = [labelName].concat(descendantNames || []);

    if (names.length === 1) {
      return 'in:inbox ' + labelTerm(names[0]);
    }

    return 'in:inbox (' + names.map(labelTerm).join(' OR ') + ')';
  }

  function buildUnlabeledQuery() {
    return 'in:inbox has:nouserlabels';
  }

  function buildUnreadQuery(labelName, descendantNames) {
    return buildSearchQuery(labelName, descendantNames) + ' is:unread';
  }

  function buildGmailUrl(query) {
    return '#search/' + encodeURIComponent(query);
  }

  const api = {
    buildGmailUrl,
    buildSearchQuery,
    buildUnlabeledQuery,
    buildUnreadQuery,
    labelTerm,
    quoteLabelName
  };

  if (typeof window !== 'undefined') window.SearchQuery = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
