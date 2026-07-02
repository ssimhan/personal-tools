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

test('get returns null on cache miss or expiry', async () => {
  chrome.storage.local.get.mockResolvedValueOnce({});
  await expect(Cache.get('labels')).resolves.toBeNull();

  chrome.storage.local.get.mockResolvedValueOnce({
    'glt_cache_v2:labels': { data: ['old'], expiresAt: Date.now() - 1 }
  });
  await expect(Cache.get('labels')).resolves.toBeNull();
});

test('get returns fresh data', async () => {
  chrome.storage.local.get.mockResolvedValue({
    'glt_cache_v2:labels': { data: ['fresh'], expiresAt: Date.now() + 1000 }
  });

  await expect(Cache.get('labels')).resolves.toEqual(['fresh']);
});

test('set writes a namespaced entry with an expiry', async () => {
  chrome.storage.local.get.mockResolvedValue({});
  chrome.storage.local.set.mockResolvedValue(undefined);

  await Cache.set('labels', ['fresh'], 5000);

  const written = chrome.storage.local.set.mock.calls[0][0];
  expect(written['glt_cache_v2:labels'].data).toEqual(['fresh']);
  expect(written['glt_cache_v2:labels'].expiresAt).toBeGreaterThan(Date.now());
});

test('different cache entries write independent Chrome storage keys', async () => {
  chrome.storage.local.set.mockResolvedValue(undefined);

  await Promise.all([
    Cache.set('children:career', ['career'], 5000),
    Cache.set('children:family', ['family'], 5000)
  ]);

  expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
    'glt_cache_v2:children:career': expect.any(Object)
  }));
  expect(chrome.storage.local.set).toHaveBeenCalledWith(expect.objectContaining({
    'glt_cache_v2:children:family': expect.any(Object)
  }));
});

test('storage errors are non-fatal', async () => {
  chrome.storage.local.get.mockRejectedValue(new Error('unavailable'));
  await expect(Cache.get('labels')).resolves.toBeNull();
});
