global.chrome = {
  runtime: {
    lastError: null,
    sendMessage: jest.fn()
  }
};

window.LabelHierarchy = require('../lib/label-hierarchy');
window.SearchQuery = require('../lib/search-query');
window.ApiClient = require('../lib/api-client');
window.PillBar = require('../lib/pill-bar');
window.GltCache = { get: jest.fn(), set: jest.fn() };
window.GltLayout = {
  getWrapper: jest.fn(),
  hide: jest.fn(),
  mount: jest.fn(),
  sync: jest.fn(),
  teardown: jest.fn()
};

const Injector = require('../lib/injector');
const realApiClient = window.ApiClient;

const labels = [
  { id: 'career', name: '3- Career' },
  { id: 'glean', name: '3- Career/Glean' },
  { id: 'competitive', name: '3- Career/Glean/Competitive' },
  { id: 'friends', name: '6- Friends' }
];

beforeEach(() => {
  Injector.__test.reset();
  window.ApiClient = realApiClient;
  window.GltCache.get.mockReset();
  window.GltCache.set.mockReset();
  window.location.hash = '#inbox';
});

afterEach(() => {
  jest.useRealTimers();
  window.ApiClient = realApiClient;
});

test('routeForHash distinguishes list, pagination, and conversation routes', () => {
  const searchHash = window.SearchQuery.buildGmailUrl('in:inbox label:"6- Friends"');

  expect(Injector.routeForHash('#inbox')).toEqual({ kind: 'inbox' });
  expect(Injector.routeForHash('#inbox/p2')).toEqual({ kind: 'inbox' });
  expect(Injector.routeForHash('#inbox/thread-id')).toEqual({ kind: 'conversation' });
  expect(Injector.routeForHash('#inbox/p2/thread-id')).toEqual({ kind: 'conversation' });
  expect(Injector.routeForHash(searchHash)).toEqual({
    kind: 'search',
    query: 'in:inbox label:"6- Friends"'
  });
  expect(Injector.routeForHash(searchHash + '/thread-id')).toEqual({ kind: 'conversation' });
  expect(Injector.routeForHash(searchHash + '/p2/thread-id')).toEqual({ kind: 'conversation' });
});

test('selection index recognizes parent rollups, direct children, and unlabeled', () => {
  const tree = window.LabelHierarchy.buildTree(labels);
  const index = Injector.buildSelectionIndex(tree);
  const career = tree.find(node => node.id === 'career');
  const glean = career.children.find(node => node.id === 'glean');

  expect(index[window.SearchQuery.normalizeQuery(Injector.queryForNode(career))]).toEqual({
    activeLabelId: 'career',
    activeSubId: null
  });
  expect(index[window.SearchQuery.normalizeQuery(Injector.queryForNode(glean))]).toEqual({
    activeLabelId: 'career',
    activeSubId: 'glean'
  });
  expect(index[window.SearchQuery.normalizeQuery(window.SearchQuery.buildUnlabeledQuery())]).toEqual({
    activeLabelId: '__unlabeled__',
    activeSubId: null
  });
});

test('native navigation uses the encoded Gmail search hash and inbox hash', () => {
  const tree = window.LabelHierarchy.buildTree(labels);
  const career = tree.find(node => node.id === 'career');

  Injector.navigateToNode(career);
  expect(window.location.hash).toBe(window.SearchQuery.buildGmailUrl(Injector.queryForNode(career)));

  Injector.navigateToInbox();
  expect(window.location.hash).toBe('#inbox');

  Injector.navigateToUnlabeled();
  expect(window.location.hash).toBe(window.SearchQuery.buildGmailUrl('in:inbox has:nouserlabels'));
});

test('top summaries refresh after one minute in a long-lived tab', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-02T17:00:00Z'));
  window.GltCache.get.mockResolvedValue(null);
  window.GltCache.set.mockResolvedValue(undefined);

  const fetchQuerySummaries = jest.fn(async (token, entries) => entries.map(entry => ({
    id: entry.id,
    present: true,
    unread: 1
  })));
  window.ApiClient = {
    fetchLabels: jest.fn(async () => labels),
    fetchQuerySummaries,
    getToken: jest.fn(async () => 'token'),
    invalidateToken: jest.fn(async () => undefined)
  };

  await Injector.__test.ensureData();
  expect(fetchQuerySummaries).toHaveBeenCalledTimes(1);

  jest.setSystemTime(new Date('2026-07-02T17:00:59Z'));
  await Injector.__test.ensureData();
  expect(fetchQuerySummaries).toHaveBeenCalledTimes(1);

  jest.setSystemTime(new Date('2026-07-02T17:01:01Z'));
  await Injector.__test.ensureData();
  expect(fetchQuerySummaries).toHaveBeenCalledTimes(2);
});

test('a failed initial load schedules a self-waking retry', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-02T17:00:00Z'));
  window.GltCache.get.mockResolvedValue(null);
  window.ApiClient = {
    fetchLabels: jest.fn(async () => { throw new Error('offline'); }),
    fetchQuerySummaries: jest.fn(),
    getToken: jest.fn(async () => 'token'),
    invalidateToken: jest.fn(async () => undefined)
  };

  await expect(Injector.__test.ensureData()).rejects.toThrow('offline');
  expect(Injector.__test.state.wakeAt).toBe(Date.parse('2026-07-02T17:00:30Z'));

  jest.advanceTimersByTime(30000);
  expect(Injector.__test.state.reconcileTimer).not.toBeNull();
});

test('withAuthRetry evicts one invalid token and retries exactly once', async () => {
  const operation = jest.fn()
    .mockRejectedValueOnce(Object.assign(new Error('expired'), { status: 401 }))
    .mockResolvedValueOnce('ok');
  window.ApiClient = {
    getToken: jest.fn()
      .mockResolvedValueOnce('expired-token')
      .mockResolvedValueOnce('fresh-token'),
    invalidateToken: jest.fn(async () => undefined)
  };

  await expect(Injector.__test.withAuthRetry(operation)).resolves.toBe('ok');
  expect(window.ApiClient.invalidateToken).toHaveBeenCalledTimes(1);
  expect(operation).toHaveBeenCalledTimes(2);
  expect(operation).toHaveBeenLastCalledWith('fresh-token');
});

test('transient summary errors preserve the last good pill state', () => {
  Injector.__test.installTree(labels);
  const topNodes = Injector.__test.state.tree;
  Injector.__test.applyTopSummaries(topNodes, [
    { id: 'career', present: true, unread: 5 },
    { id: 'friends', present: false, unread: 0 },
    { id: '__unlabeled__', present: true, unread: 2 }
  ]);

  const previous = {
    career: { present: true, unread: 5 },
    friends: { present: false, unread: 0 },
    __unlabeled__: { present: true, unread: 2 }
  };
  Injector.__test.applyTopSummaries(topNodes, [
    { id: 'career', present: true, unread: 0, error: true },
    { id: 'friends', present: true, unread: 0, error: true },
    { id: '__unlabeled__', present: true, unread: 0, error: true }
  ], previous);

  expect(topNodes.find(node => node.id === 'career').unread).toBe(5);
  expect(topNodes.find(node => node.id === 'friends').present).toBe(false);
  expect(Injector.__test.state.unlabeledUnread).toBe(2);
});
