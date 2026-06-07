const button = document.getElementById('signin');
const statusEl = document.getElementById('status');

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'error' : '';
}

function markConnected() {
  button.textContent = 'Connected';
  button.disabled = true;
  setStatus('Reload Gmail to refresh the pill bar.', false);
}

chrome.identity.getAuthToken({ interactive: false }, token => {
  if (token) markConnected();
});

button.addEventListener('click', () => {
  button.disabled = true;
  setStatus('Opening Google sign-in...', false);

  chrome.identity.getAuthToken({ interactive: true }, token => {
    if (chrome.runtime.lastError || !token) {
      button.disabled = false;
      button.textContent = 'Connect Gmail';
      setStatus(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Could not connect Gmail.', true);
      return;
    }

    markConnected();
  });
});
