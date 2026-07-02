const ApiClient = (() => {
  const BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';
  const REQUEST_TIMEOUT_MS = 15000;

  function createError(message, type, details) {
    return Object.assign(new Error(message), { type }, details || {});
  }

  function runtimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          reject(createError(chrome.runtime.lastError.message, 'RuntimeError'));
          return;
        }
        resolve(response || {});
      });
    });
  }

  async function getToken() {
    const response = await runtimeMessage({ type: 'GET_TOKEN' });
    if (response.token) return response.token;
    throw createError('OAuth token unavailable', 'OAuthError');
  }

  async function invalidateToken(token) {
    const response = await runtimeMessage({ type: 'INVALIDATE_TOKEN', token });
    if (response.error) throw createError(response.error, 'OAuthError');
  }

  function buildUrl(path, params) {
    const url = new URL(BASE_URL + path);
    Object.keys(params || {}).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, params[key]);
      }
    });
    return url.toString();
  }

  async function apiFetch(token, path, params) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;

    try {
      response = await fetch(buildUrl(path, params), {
        headers: { Authorization: 'Bearer ' + token },
        signal: controller.signal
      });
    } catch (error) {
      throw createError('Gmail API request failed', 'NetworkError');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw createError('Gmail API error: ' + response.status, 'ApiError', {
        status: response.status
      });
    }

    return response.json();
  }

  async function fetchLabels(token) {
    const data = await apiFetch(token, '/labels');
    return data.labels || [];
  }

  async function fetchThreadPage(token, query) {
    const data = await apiFetch(token, '/threads', {
      q: query,
      maxResults: '1',
      fields: 'threads(id),resultSizeEstimate'
    });
    const threads = data.threads || [];
    return {
      estimate: Math.max(data.resultSizeEstimate || 0, threads.length),
      hasResults: threads.length > 0
    };
  }

  async function fetchThreadEstimate(token, query) {
    const page = await fetchThreadPage(token, query);
    return page.estimate;
  }

  async function fetchQuerySummary(token, query, unreadQuery) {
    const unread = await fetchThreadPage(token, unreadQuery);
    if (unread.hasResults || unread.estimate > 0) {
      return { present: true, unread: unread.estimate };
    }

    const total = await fetchThreadPage(token, query);
    return { present: total.hasResults || total.estimate > 0, unread: 0 };
  }

  async function mapWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(concurrency || 1, items.length || 1));

    async function run() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }

    await Promise.all(Array.from({ length: workerCount }, run));
    return results;
  }

  async function fetchQuerySummaries(token, entries, concurrency) {
    return mapWithConcurrency(entries || [], concurrency || 4, async entry => {
      try {
        const summary = await fetchQuerySummary(token, entry.query, entry.unreadQuery);
        return { id: entry.id, ...summary };
      } catch (error) {
        if (error.status === 401 || error.status === 403 || error.type === 'OAuthError') {
          throw error;
        }
        return { id: entry.id, present: true, unread: 0, error: true };
      }
    });
  }

  const api = {
    apiFetch,
    fetchLabels,
    fetchQuerySummaries,
    fetchQuerySummary,
    fetchThreadEstimate,
    getToken,
    invalidateToken
  };

  if (typeof window !== 'undefined') window.ApiClient = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
