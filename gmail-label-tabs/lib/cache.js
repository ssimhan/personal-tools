const GltCache = (() => {
  const STORAGE_PREFIX = 'glt_cache_v2:';

  function storageKey(key) {
    return STORAGE_PREFIX + key;
  }

  async function get(key) {
    try {
      const keyName = storageKey(key);
      const result = await chrome.storage.local.get(keyName);
      const entry = (result || {})[keyName];
      if (!entry || Date.now() >= entry.expiresAt) return null;
      return entry.data;
    } catch (error) {
      return null;
    }
  }

  async function set(key, data, ttlMs) {
    try {
      const keyName = storageKey(key);
      await chrome.storage.local.set({
        [keyName]: {
          data,
          expiresAt: Date.now() + ttlMs
        }
      });
    } catch (error) {
      // Cache failures are non-fatal; callers can continue with live data.
    }
  }

  const api = { get, set };

  if (typeof window !== 'undefined') window.GltCache = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
