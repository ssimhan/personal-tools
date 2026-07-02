const button = document.getElementById('signin');
const statusEl = document.getElementById('status');

function tokenValue(result) {
  if (typeof result === 'string') return result;
  return result && result.token ? result.token : null;
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : '';
}

function markConnected() {
  button.textContent = 'Connected';
  button.disabled = true;
  setStatus('Reload Gmail to refresh the pill bar.', false);
}

chrome.identity.getAuthToken({ interactive: false }, result => {
  if (chrome.runtime.lastError) {
    setStatus('Not connected yet.', false);
    return;
  }
  if (tokenValue(result)) markConnected();
});

button.addEventListener('click', () => {
  button.disabled = true;
  setStatus('Opening Google sign-in...', false);

  chrome.identity.getAuthToken({ interactive: true }, result => {
    const token = tokenValue(result);
    if (chrome.runtime.lastError || !token) {
      button.disabled = false;
      button.textContent = 'Connect Gmail';
      setStatus(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Could not connect Gmail.', true);
      return;
    }

    markConnected();
  });
});
