// Hard-coded base URL. Change this constant (and the one in popup.js) if the
// CRM ever moves to a different host.
const BASE_URL = "https://crm.andymowat.com";

const $ = (id) => document.getElementById(id);

async function load() {
  const { apiKey = "" } = await chrome.storage.sync.get(["apiKey"]);
  $("baseUrl").value = BASE_URL;
  $("apiKey").value = apiKey;
}

async function save() {
  const apiKey = $("apiKey").value.trim();
  if (!apiKey) {
    setStatus("API key is required.", "error");
    return;
  }
  await chrome.storage.sync.set({ apiKey });
  setStatus("Saved.", "ok");
}

async function test() {
  const apiKey = $("apiKey").value.trim();
  if (!apiKey) {
    setStatus("Enter an API key first.", "error");
    return;
  }
  setStatus("Testing…", "");
  try {
    const res = await fetch(`${BASE_URL}/api/search?q=__ping__`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      setStatus("Connected, but the API key was rejected (401).", "error");
      return;
    }
    if (!res.ok) {
      setStatus(`Server returned ${res.status}.`, "error");
      return;
    }
    setStatus("✓ Connected.", "ok");
  } catch (e) {
    setStatus(`Network error: ${e instanceof Error ? e.message : "unknown"}`, "error");
  }
}

function setStatus(msg, kind) {
  const el = $("status");
  el.textContent = msg;
  el.className = `status ${kind}`;
}

$("save").addEventListener("click", (e) => { e.preventDefault(); save(); });
$("test").addEventListener("click", test);
load();
