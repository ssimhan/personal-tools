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

  function buildInboxUrl() {
    return '#inbox';
  }

  function normalizeQuery(query) {
    return String(query || '').replace(/\s+/g, ' ').trim();
  }

  function queryFromGmailHash(hash) {
    const value = String(hash || '').replace(/^#/, '');
    const segments = value.split('/');

    if (segments[0] !== 'search' || !segments[1]) return null;
    if (segments.length > 3) return null;
    if (segments.length === 3 && !/^p\d+$/.test(segments[2])) return null;

    try {
      return normalizeQuery(decodeURIComponent(segments[1].replace(/\+/g, ' ')));
    } catch (error) {
      return null;
    }
  }

  const api = {
    buildGmailUrl,
    buildInboxUrl,
    buildSearchQuery,
    buildUnlabeledQuery,
    buildUnreadQuery,
    labelTerm,
    normalizeQuery,
    queryFromGmailHash,
    quoteLabelName
  };

  if (typeof window !== 'undefined') window.SearchQuery = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
