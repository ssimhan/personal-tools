function tokenValue(result) {
  if (typeof result === 'string') return result;
  return result && result.token ? result.token : null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return false;

  if (message.type === 'GET_TOKEN') {
    chrome.identity.getAuthToken({ interactive: false }, result => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      const token = tokenValue(result);
      sendResponse(token ? { token } : { error: 'No Gmail token available' });
    });
    return true;
  }

  if (message.type === 'INVALIDATE_TOKEN' && message.token) {
    chrome.identity.removeCachedAuthToken({ token: message.token }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true });
    });
    return true;
  }

  return false;
});
