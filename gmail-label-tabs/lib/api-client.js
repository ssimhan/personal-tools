const ApiClient = (() => {
  const BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

  function getToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_TOKEN' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.token) {
          resolve(response.token);
          return;
        }

        reject(Object.assign(new Error('OAuth token unavailable'), { type: 'OAuthError' }));
      });
    });
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
    const response = await fetch(buildUrl(path, params), {
      headers: {
        Authorization: 'Bearer ' + token
      }
    });

    if (!response.ok) {
      throw new Error('Gmail API error: ' + response.status);
    }

    return response.json();
  }

  async function fetchLabels(token) {
    const data = await apiFetch(token, '/labels');
    return data.labels || [];
  }

  async function fetchInboxMessages(token) {
    const data = await apiFetch(token, '/messages', {
      labelIds: 'INBOX',
      maxResults: '100',
      fields: 'messages(id),nextPageToken,resultSizeEstimate'
    });
    return data.messages || [];
  }

  async function fetchMessageLabels(token, messageId) {
    const data = await apiFetch(token, '/messages/' + encodeURIComponent(messageId), {
      format: 'minimal',
      fields: 'id,labelIds'
    });
    return data.labelIds || [];
  }

  async function fetchInboxMessageLabelSets(token) {
    const messages = await fetchInboxMessages(token);
    return Promise.all(messages.map(async message => ({
      id: message.id,
      labelIds: await fetchMessageLabels(token, message.id)
    })));
  }

  async function fetchMessageEstimate(token, query) {
    const data = await apiFetch(token, '/messages', {
      q: query,
      maxResults: '1'
    });
    return data.resultSizeEstimate || 0;
  }

  async function checkInboxPresence(token, query) {
    const estimate = await fetchMessageEstimate(token, query);
    return estimate > 0;
  }

  async function fetchUnreadEstimate(token, query) {
    return fetchMessageEstimate(token, query);
  }

  async function checkUnlabeledPresence(token) {
    return checkInboxPresence(token, 'in:inbox has:nouserlabels');
  }

  const api = {
    apiFetch,
    checkInboxPresence,
    checkUnlabeledPresence,
    fetchLabels,
    fetchInboxMessageLabelSets,
    fetchInboxMessages,
    fetchMessageLabels,
    fetchMessageEstimate,
    fetchUnreadEstimate,
    getToken
  };

  if (typeof window !== 'undefined') window.ApiClient = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();
