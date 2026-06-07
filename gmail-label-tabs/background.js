chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'GET_TOKEN') return false;

  chrome.identity.getAuthToken({ interactive: false }, token => {
    if (chrome.runtime.lastError) {
      sendResponse({ error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ token });
  });

  return true;
});
