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
  jest.clearAllMocks();
});

test('getToken resolves with token from background', async () => {
  await expect(API.getToken()).resolves.toBe('test-token');
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'GET_TOKEN' }, expect.any(Function));
});

test('fetchLabels calls the labels endpoint with auth header', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ labels: [{ id: 'career', name: '3- Career' }] })
  });

  const labels = await API.fetchLabels('test-token');

  expect(fetch).toHaveBeenCalledWith(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    expect.objectContaining({
      headers: { Authorization: 'Bearer test-token' }
    })
  );
  expect(labels[0].name).toBe('3- Career');
});

test('fetchLabels throws on non-ok response', async () => {
  global.fetch.mockResolvedValueOnce({ ok: false, status: 401 });
  await expect(API.fetchLabels('bad-token')).rejects.toThrow('Gmail API error: 401');
});

test('checkInboxPresence returns true when estimate is positive', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 3 })
  });

  await expect(API.checkInboxPresence('test-token', 'in:inbox label:"3- Career"')).resolves.toBe(true);
});

test('checkInboxPresence returns false when estimate is zero', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 0 })
  });

  await expect(API.checkInboxPresence('test-token', 'in:inbox label:"6- Friends"')).resolves.toBe(false);
});

test('fetchUnreadEstimate returns resultSizeEstimate', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ resultSizeEstimate: 7 })
  });

  await expect(API.fetchUnreadEstimate('test-token', 'in:inbox label:"3- Career" is:unread')).resolves.toBe(7);
});

test('fetchInboxMessages requests inbox message ids only', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ messages: [{ id: 'm1' }] })
  });

  await expect(API.fetchInboxMessages('test-token')).resolves.toEqual([{ id: 'm1' }]);
  expect(fetch.mock.calls[0][0]).toContain('/messages?');
  expect(fetch.mock.calls[0][0]).toContain('labelIds=INBOX');
  expect(fetch.mock.calls[0][0]).toContain('maxResults=100');
});

test('fetchMessageLabels returns label ids for a message', async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 'm1', labelIds: ['INBOX', 'career', 'UNREAD'] })
  });

  await expect(API.fetchMessageLabels('test-token', 'm1')).resolves.toEqual(['INBOX', 'career', 'UNREAD']);
  expect(fetch.mock.calls[0][0]).toContain('/messages/m1?');
  expect(fetch.mock.calls[0][0]).toContain('format=minimal');
});

test('fetchInboxMessageLabelSets joins inbox ids with their label ids', async () => {
  global.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'm1' }, { id: 'm2' }] })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'm1', labelIds: ['INBOX', 'career'] })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'm2', labelIds: ['INBOX'] })
    });

  await expect(API.fetchInboxMessageLabelSets('test-token')).resolves.toEqual([
    { id: 'm1', labelIds: ['INBOX', 'career'] },
    { id: 'm2', labelIds: ['INBOX'] }
  ]);
});
