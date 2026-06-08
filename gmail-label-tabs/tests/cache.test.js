global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

const Cache = require('../lib/cache');

beforeEach(() => {
  jest.clearAllMocks();
});

test('get returns null on cache miss', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  await expect(Cache.get('labels')).resolves.toBeNull();
});

test('get returns null when entry is expired', async () => {
  chrome.storage.local.get.mockResolvedValue({
    glt_cache: { labels: { data: ['x'], expiresAt: Date.now() - 1000 } }
  });
  await expect(Cache.get('labels')).resolves.toBeNull();
});

test('get returns data when entry is fresh', async () => {
  chrome.storage.local.get.mockResolvedValue({
    glt_cache: { labels: { data: ['x'], expiresAt: Date.now() + 10000 } }
  });
  await expect(Cache.get('labels')).resolves.toEqual(['x']);
});

test('set writes entry with correct expiry', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set.mockResolvedValue(undefined);
  await Cache.set('labels', ['x'], 5000);
  const written = chrome.storage.local.set.mock.calls[0][0];
  expect(written.glt_cache.labels.data).toEqual(['x']);
  expect(written.glt_cache.labels.expiresAt).toBeGreaterThan(Date.now());
});

test('get returns null on storage error', async () => {
  chrome.storage.local.get.mockRejectedValue(new Error('storage unavailable'));
  await expect(Cache.get('labels')).resolves.toBeNull();
});
