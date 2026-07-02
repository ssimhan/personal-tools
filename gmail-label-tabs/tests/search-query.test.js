const SQ = require('../lib/search-query');

test('single label query is inbox-scoped and quoted', () => {
  expect(SQ.buildSearchQuery('6- Friends', [])).toBe('in:inbox label:"6- Friends"');
});

test('label with descendants builds inbox-scoped OR rollup query', () => {
  const query = SQ.buildSearchQuery('3- Career', [
    '3- Career/Job Hunt',
    '3- Career/Glean'
  ]);

  expect(query).toBe('in:inbox (label:"3- Career" OR label:"3- Career/Job Hunt" OR label:"3- Career/Glean")');
});

test('unlabeled query stays inbox scoped', () => {
  expect(SQ.buildUnlabeledQuery()).toBe('in:inbox has:nouserlabels');
});

test('unread query preserves rollup and inbox scope', () => {
  expect(SQ.buildUnreadQuery('3- Career/Glean', ['3- Career/Glean/Competitive']))
    .toBe('in:inbox (label:"3- Career/Glean" OR label:"3- Career/Glean/Competitive") is:unread');
});

test('buildGmailUrl encodes the Gmail search hash', () => {
  expect(SQ.buildGmailUrl('in:inbox label:"Friends"')).toBe('#search/in%3Ainbox%20label%3A%22Friends%22');
});

test('buildInboxUrl returns the canonical inbox hash', () => {
  expect(SQ.buildInboxUrl()).toBe('#inbox');
});

test('queryFromGmailHash decodes a search route and ignores a thread suffix', () => {
  const hash = SQ.buildGmailUrl('in:inbox label:"3- Career/Glean"');

  expect(SQ.queryFromGmailHash(hash)).toBe('in:inbox label:"3- Career/Glean"');
  expect(SQ.queryFromGmailHash(hash + '/thread-id')).toBeNull();
  expect(SQ.queryFromGmailHash(hash + '/p2/thread-id')).toBeNull();
  expect(SQ.queryFromGmailHash('#inbox')).toBeNull();
});

test('normalizeQuery makes equivalent route queries comparable', () => {
  expect(SQ.normalizeQuery('  in:inbox   label:"Friends"  '))
    .toBe('in:inbox label:"Friends"');
});
