const API = require('../lib/api-client');

global.chrome = {
  runtime: {
    lastError: null,
    sendMessage: jest.fn((message, callback) => callback({ token: 'test-token' }))
  }
};

beforeEach(() => {
  global.fetch = jest.fn();
  global.chrome.runtime.lastError = null;
  global.chrome.runtime.sendMessage.mockImplementation((message, callback) => {
    callback(message.type === 'GET_TOKEN' ? { token: 'test-token' } : { ok: true });
  });
  jest.clearAllMocks();
});

test('getToken resolves with token from background', async () => {
  await expect(API.getToken()).resolves.toBe('test-token');
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TOKEN' }, expect.any(Function));
});

test('getToken throws a typed OAuth error when no token is available', async () => {
  chrome.runtime.sendMessage.mockImplementationOnce((message, callback) => callback({ error: 'not signed in' }));

  await expect(API.getToken()).rejects.toMatchObject({ type: 'OAuthError' });
});

test('invalidateToken asks the background worker to evict the cached token', async () => {
  await expect(API.invalidateToken('expired-token')).resolves.toBeUndefined();
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
    { type: 'INVALIDATE_TOKEN', token: 'expired-token' },
    expect.any(Function)
  );
});

test('fetchLabels calls the labels endpoint with auth header', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ labels: [{ id: 'career', name: '3- Career' }] })
  });

  const labels = await API.fetchLabels('test-token');

  expect(fetch).toHaveBeenCalledWith(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } })
  );
  expect(labels[0].name).toBe('3- Career');
});

test('api errors include a stable type and status', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

  await expect(API.fetchLabels('bad-token')).rejects.toMatchObject({
    type: 'ApiError',
    status: 401
  });
});

test('fetchThreadEstimate uses Gmail search semantics without fetching thread details', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 240 })
  });

  await expect(API.fetchThreadEstimate('test-token', 'in:inbox label:"Career"')).resolves.toBe(240);
  expect(fetch.mock.calls[0][0]).toContain('/threads?');
  expect(fetch.mock.calls[0][0]).toContain('maxResults=1');
  expect(fetch.mock.calls[0][0]).toContain('q=in%3Ainbox');
});

test('fetchQuerySummary uses the unread result as presence when unread mail exists', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 7 })
  });

  await expect(API.fetchQuerySummary(
    'test-token',
    'in:inbox label:"Career"',
    'in:inbox label:"Career" is:unread'
  )).resolves.toEqual({ present: true, unread: 7 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('fetchQuerySummary checks total presence when unread estimate is zero', async () => {
  global.fetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ resultSizeEstimate: 0 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ resultSizeEstimate: 3 }) });

  await expect(API.fetchQuerySummary(
    'test-token',
    'in:inbox label:"Career"',
    'in:inbox label:"Career" is:unread'
  )).resolves.toEqual({ present: true, unread: 0 });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('fetchQuerySummaries fails open per label on a transient API error', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

  await expect(API.fetchQuerySummaries('test-token', [{
    id: 'career',
    query: 'in:inbox label:"Career"',
    unreadQuery: 'in:inbox label:"Career" is:unread'
  }], 2)).resolves.toEqual([{
    id: 'career',
    present: true,
    unread: 0,
    error: true
  }]);
});

test('fetchQuerySummaries propagates auth failures for a single refresh retry', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });

  await expect(API.fetchQuerySummaries('test-token', [{
    id: 'career',
    query: 'in:inbox label:"Career"',
    unreadQuery: 'in:inbox label:"Career" is:unread'
  }], 2)).rejects.toMatchObject({ type: 'ApiError', status: 401 });
});
