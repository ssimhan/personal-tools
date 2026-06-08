const Cache = (() => {
  const STORAGE_KEY = 'glt_cache';

  async function get(key) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const entry = ((result || {})[STORAGE_KEY] || {})[key];
      if (!entry || Date.now() > entry.expiresAt) return null;
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  async function set(key, data, ttlMs) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (result || {})[STORAGE_KEY] || {};
      cache[key] = { data, expiresAt: Date.now() + ttlMs };
      await chrome.storage.local.set({ [STORAGE_KEY]: cache });
    } catch (e) {
      // Storage failure is non-fatal — cold-load path still works
    }
  }

  async function clear(key) {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const cache = (result || {})[STORAGE_KEY] || {};
      if (key) delete cache[key];
      else Object.keys(cache).forEach(k => delete cache[k]);
      await chrome.storage.local.set({ [STORAGE_KEY]: cache });
    } catch (e) {
      // Non-fatal
    }
  }

  const api = { get, set, clear };
  // Use GltCache not Cache — window.Cache is the browser's Service Worker Cache API
  if (typeof window !== 'undefined') window.GltCache = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
