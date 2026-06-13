// Side panel entry point. Three views:
//   - PersonCard: an existing person — view + inline edit + log interaction
//   - AddContact: pre-filled with the active tab's LinkedIn URL
//   - Search: free-text search across all people
//
// The panel stays open as the user browses; it re-renders from the active
// tab's URL on tab switches and navigations. Auth: Bearer token from
// chrome.storage; the extension only ever fetches from the hard-coded CRM URL.

// Hard-coded base URL. Mirror this in options.js if it ever changes.
const BASE_URL = "https://crm.andymowat.com";

const $root = document.getElementById("root");
let cfg = null; // { apiKey }
let lastRenderedUrl = null; // avoid clobbering the panel on no-op tab events

document.getElementById("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

bootstrap();

// Re-render when the user switches tabs or the active tab navigates.
chrome.tabs.onActivated.addListener(() => bootstrap());
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (!tab.active) return;
  if (changeInfo.url || changeInfo.status === "complete") bootstrap();
});

async function bootstrap() {
  cfg = await chrome.storage.sync.get(["apiKey"]);
  if (!cfg.apiKey) {
    renderNeedsConfig();
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url ?? "";

  // Skip if the active tab's URL hasn't changed since the last render — keeps
  // the panel stable (and preserves any in-progress edits) on noisy tab events.
  if (url === lastRenderedUrl) return;
  lastRenderedUrl = url;

  const linkedinUrl = extractLinkedInProfileUrl(url);
  if (linkedinUrl) {
    await loadByLinkedIn(linkedinUrl);
  } else {
    renderSearch();
  }
}

function renderNeedsConfig() {
  $root.innerHTML = `
    <p>Set your API key in settings to get started.</p>
    <button id="goSettings" class="primary">Open settings</button>
  `;
  document.getElementById("goSettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

// ---------------------------------------------------------------------------
// LinkedIn URL detection + normalization
// ---------------------------------------------------------------------------

function extractLinkedInProfileUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/in\/([a-zA-Z0-9_\-%]+)/);
    if (!m) return null;
    // Reconstruct the canonical profile URL (no query, no trailing path)
    return `https://www.linkedin.com/in/${m[1]}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function apiFetch(path, init = {}) {
  const headers = {
    Authorization: `Bearer ${cfg.apiKey}`,
    ...(init.headers || {}),
  };
  // Don't set content-type for FormData — browser sets it with boundary.
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok && res.status !== 409) {
    throw new ApiError(json?.error ?? `HTTP ${res.status}`, res.status, json);
  }
  return { ok: res.ok, status: res.status, json };
}

function safeJson(t) { try { return JSON.parse(t); } catch { return null; } }

class ApiError extends Error {
  constructor(message, status, json) {
    super(message);
    this.status = status;
    this.json = json;
  }
}

// ---------------------------------------------------------------------------
// LinkedIn lookup → PersonCard or AddContact
// ---------------------------------------------------------------------------

async function loadByLinkedIn(linkedinUrl) {
  $root.innerHTML = `<p class="muted">Looking up <code>${escapeHtml(linkedinUrl)}</code>…</p>`;
  try {
    const { json } = await apiFetch(`/api/people/by-linkedin?url=${encodeURIComponent(linkedinUrl)}`);
    if (json?.person) {
      renderPerson(json);
    } else {
      renderAddContact({ linkedin: linkedinUrl });
    }
  } catch (e) {
    renderError(e);
  }
}

// ---------------------------------------------------------------------------
// Person card
// ---------------------------------------------------------------------------

function renderPerson(payload) {
  const p = payload.person;
  const ixs = payload.recentInteractions ?? [];
  const tags = payload.tags ?? [];
  const allTags = payload.allTags ?? [];

  $root.innerHTML = `
    <div class="card">
      <div class="row between">
        <div>
          <div class="name">${escapeHtml(p.full_name)}</div>
        </div>
        <div class="row" style="gap:6px; align-items:center">
          <button id="copyFooter" title="Copy contact-update footer (line + link)" class="muted"
                  style="background:transparent; border:none; cursor:pointer; padding:2px 4px; font-size:14px">📋</button>
          <a href="${BASE_URL}/people/${p.id}" target="_blank" title="Open in CRM" class="muted">↗</a>
        </div>
      </div>
      <div class="channels" id="channels"></div>
      <div id="channelEditor" style="display:none; margin-top:6px"></div>
      <div class="row" style="margin-top:8px; align-items:center; gap:8px">
        <span class="muted" style="font-size:11px" title="Months before the next touch">Broadcast</span>
        <div id="broadcast"></div>
      </div>
      <div class="row" style="margin-top:6px; align-items:center; gap:8px">
        <span class="muted" style="font-size:11px" title="Has the contact opted in to small asks?">Ask</span>
        <div id="ask"></div>
      </div>
    </div>

    <div class="card">
      <h2>Tags</h2>
      <div class="tags" id="tags"></div>
    </div>

    <div class="card">
      <h2>Permanent notes</h2>
      <textarea id="notes" rows="2">${escapeHtml(p.permanent_notes ?? "")}</textarea>
      <div class="row" style="margin-top:6px; justify-content:flex-end">
        <button class="primary" id="saveNotes">Save notes</button>
      </div>
    </div>

    <div class="card">
      <h2>Log interaction</h2>
      <textarea id="ixContent" placeholder="What happened? (or paste a screenshot to OCR)" rows="3"></textarea>
      <p id="ixHint" class="muted" style="margin:4px 0 0; font-size:11px">Tip: paste a screenshot here to extract text.</p>
      <div class="row" style="margin-top:6px; justify-content:flex-end">
        <button class="primary" id="logIx">Log + regenerate</button>
      </div>
    </div>

    <div class="card">
      <h2>Recent interactions</h2>
      <div id="ixList"></div>
    </div>
  `;

  renderChannels(p);
  renderBroadcast(p);
  renderAsk(p);
  renderTags(p.id, tags, allTags);
  renderInteractionList(ixs);
  attachPasteToOcr(p);

  document.getElementById("copyFooter").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const text = buildFooterText(p);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = "✓";
      setTimeout(() => { btn.textContent = original; }, 1500);
    } catch {
      toast("Copy failed");
    }
  });

  document.getElementById("saveNotes").addEventListener("click", async (e) => {
    const notes = document.getElementById("notes").value;
    await withButton(e.target, async () => {
      await apiFetch(`/api/people/${p.id}/notes`, { method: "POST", body: JSON.stringify({ notes }) });
      toast("Notes saved");
    });
  });

  document.getElementById("logIx").addEventListener("click", async (e) => {
    const content = document.getElementById("ixContent").value.trim();
    if (!content) return;
    await withButton(e.target, async () => {
      const fd = new FormData();
      fd.set("mode", "text");
      fd.set("content", content);
      fd.set("force_person_id", p.id);
      const res = await apiFetch(`/api/quick-add`, { method: "POST", body: fd });
      if (res.ok) {
        toast("Logged. Summary regenerated.");
        loadPersonById(p.id); // refresh card with new summary + interaction
      }
    });
  });
}

// Channel definitions. `field` is the column on people; `endpoint` selects
// how the value is persisted (most channels go through PATCH; email uses the
// dedicated /emails endpoint to keep secondary-email semantics intact).
const CHANNELS = [
  { key: "email",    label: "Email",    field: "primary_email", endpoint: "email-primary" },
  { key: "linkedin", label: "LinkedIn", field: "linkedin_url",  endpoint: "patch" },
  { key: "phone",    label: "Phone",    field: "phone_number",  endpoint: "patch" },
  { key: "slack",    label: "Slack",    field: "slack_channel", endpoint: "patch" },
  { key: "whatsapp", label: "WhatsApp", field: "phone_number",  endpoint: "patch" },
];

// Country picker data — mirrors app/(app)/_components/phone-input.tsx.
const PHONE_COUNTRIES = [
  { key: "US", flag: "🇺🇸", dial: "+1",   name: "United States" },
  { key: "CA", flag: "🇨🇦", dial: "+1",   name: "Canada" },
  { key: "GB", flag: "🇬🇧", dial: "+44",  name: "United Kingdom" },
  { key: "MX", flag: "🇲🇽", dial: "+52",  name: "Mexico" },
  { key: "IN", flag: "🇮🇳", dial: "+91",  name: "India" },
  { key: "AU", flag: "🇦🇺", dial: "+61",  name: "Australia" },
  { key: "DE", flag: "🇩🇪", dial: "+49",  name: "Germany" },
  { key: "FR", flag: "🇫🇷", dial: "+33",  name: "France" },
  { key: "ES", flag: "🇪🇸", dial: "+34",  name: "Spain" },
  { key: "IT", flag: "🇮🇹", dial: "+39",  name: "Italy" },
  { key: "NL", flag: "🇳🇱", dial: "+31",  name: "Netherlands" },
  { key: "IL", flag: "🇮🇱", dial: "+972", name: "Israel" },
  { key: "BR", flag: "🇧🇷", dial: "+55",  name: "Brazil" },
  { key: "AR", flag: "🇦🇷", dial: "+54",  name: "Argentina" },
  { key: "JP", flag: "🇯🇵", dial: "+81",  name: "Japan" },
  { key: "KR", flag: "🇰🇷", dial: "+82",  name: "South Korea" },
  { key: "CN", flag: "🇨🇳", dial: "+86",  name: "China" },
  { key: "SG", flag: "🇸🇬", dial: "+65",  name: "Singapore" },
  { key: "ZA", flag: "🇿🇦", dial: "+27",  name: "South Africa" },
  { key: "AE", flag: "🇦🇪", dial: "+971", name: "UAE" },
];

function parsePhone(raw) {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("+")) {
    const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (trimmed.startsWith(c.dial)) return { country: c, local: trimmed.slice(c.dial.length).trim() };
    }
  }
  return { country: PHONE_COUNTRIES[0], local: trimmed };
}

function combinePhone(countryKey, local) {
  const country = PHONE_COUNTRIES.find((c) => c.key === countryKey) ?? PHONE_COUNTRIES[0];
  const trimmed = (local ?? "").trim();
  return trimmed ? `${country.dial} ${trimmed}` : "";
}

// Contact-update URL — just the link. Falls back to the legacy contact_token
// UUID if short_token isn't populated yet.
function buildFooterText(p) {
  const token = p.short_token || p.contact_token;
  if (!token) return null;
  return `${BASE_URL}/c/${token}`;
}

function renderChannels(p) {
  const el = document.getElementById("channels");
  el.innerHTML = "";
  for (const c of CHANNELS) {
    const value = p[c.field];
    const present = !!value;
    const preferred = p.preferred_channel === c.key;
    const cls = preferred ? "ch preferred" : present ? "ch have" : "ch missing";
    const btn = document.createElement("button");
    btn.className = cls;
    btn.style.border = "none";
    btn.style.background = "transparent";
    btn.style.cursor = "pointer";
    btn.style.padding = "2px 6px";
    btn.title = present ? `${c.label}: ${value}` : `Click to add ${c.label}`;
    btn.textContent = c.label;
    btn.addEventListener("click", () => openChannelEditor(p, c));
    el.appendChild(btn);
  }
}

// Broadcast cadence: a connected 2/4/6/8/None segmented control. "Broadcast" =
// months before the next touch. Clicking PATCHes broadcast_months on the person.
function renderBroadcast(p) {
  const el = document.getElementById("broadcast");
  if (!el) return;
  el.innerHTML = "";
  el.style.display = "inline-flex";
  el.style.border = "1px solid #d0d0d0";
  el.style.borderRadius = "6px";
  el.style.overflow = "hidden";
  const opts = [2, 4, 6, 8, null];
  opts.forEach((o, i) => {
    const active = (p.broadcast_months ?? null) === o;
    const b = document.createElement("button");
    b.textContent = o === null ? "None" : String(o);
    b.style.border = "none";
    b.style.borderLeft = i === 0 ? "none" : "1px solid #d0d0d0";
    b.style.padding = "3px 8px";
    b.style.fontSize = "12px";
    b.style.cursor = "pointer";
    b.style.background = active ? "#16a34a" : "transparent";
    b.style.color = active ? "#fff" : "inherit";
    b.addEventListener("click", async () => {
      if ((p.broadcast_months ?? null) === o) return;
      try {
        await apiFetch(`/api/people/${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ broadcast_months: o }),
        });
        p.broadcast_months = o;
        renderBroadcast(p);
        toast("Broadcast updated");
      } catch (e) {
        toast(e?.message ?? "Save failed");
      }
    });
    el.appendChild(b);
  });
}

// Ask segmented control: [Yes][No][None]. Mirrors renderBroadcast — PATCHes
// accepts_asks (boolean | null) on click.
function renderAsk(p) {
  const el = document.getElementById("ask");
  if (!el) return;
  el.innerHTML = "";
  el.style.display = "inline-flex";
  el.style.border = "1px solid #d0d0d0";
  el.style.borderRadius = "6px";
  el.style.overflow = "hidden";
  const opts = [
    { v: true, label: "Yes" },
    { v: false, label: "No" },
    { v: null, label: "None" },
  ];
  opts.forEach((o, i) => {
    const current = p.accepts_asks ?? null;
    const active = current === o.v;
    const b = document.createElement("button");
    b.textContent = o.label;
    b.style.border = "none";
    b.style.borderLeft = i === 0 ? "none" : "1px solid #d0d0d0";
    b.style.padding = "3px 8px";
    b.style.fontSize = "12px";
    b.style.cursor = "pointer";
    b.style.background = active ? "#16a34a" : "transparent";
    b.style.color = active ? "#fff" : "inherit";
    b.addEventListener("click", async () => {
      if ((p.accepts_asks ?? null) === o.v) return;
      try {
        await apiFetch(`/api/people/${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ accepts_asks: o.v }),
        });
        p.accepts_asks = o.v;
        renderAsk(p);
        toast("Ask updated");
      } catch (e) {
        toast(e?.message ?? "Save failed");
      }
    });
    el.appendChild(b);
  });
}

// Inline editor that swaps into the channelEditor slot under the channel row.
function openChannelEditor(p, channel) {
  const slot = document.getElementById("channelEditor");
  const currentValue = p[channel.field] ?? "";
  slot.style.display = "block";

  // Phone gets a country-code picker + local input; everything else stays a
  // single text input. The save handler below reads getValue() to combine them.
  const isPhone = channel.key === "phone";
  if (isPhone) {
    const { country, local } = parsePhone(currentValue);
    const opts = PHONE_COUNTRIES.map(
      (c) => `<option value="${c.key}" title="${escapeHtml(c.name)}"${c.key === country.key ? " selected" : ""}>${c.flag} ${c.dial}</option>`,
    ).join("");
    slot.innerHTML = `
      <div class="row" style="gap:4px">
        <select id="chCountry" title="Country code" style="height:28px">${opts}</select>
        <input id="chInput" type="tel" placeholder="555 555 5555" value="${escapeHtml(local)}" style="flex:1" />
        <button class="primary" id="chSave">Save</button>
        <button id="chCancel">Cancel</button>
      </div>
      <small class="muted">Editing Phone for ${escapeHtml(p.full_name)}</small>
    `;
  } else {
    slot.innerHTML = `
      <div class="row" style="gap:4px">
        <input id="chInput" placeholder="${escapeHtml(channel.label)} value" value="${escapeHtml(currentValue)}" style="flex:1" />
        <button class="primary" id="chSave">Save</button>
        <button id="chCancel">Cancel</button>
      </div>
      <small class="muted">Editing ${escapeHtml(channel.label)} for ${escapeHtml(p.full_name)}</small>
    `;
  }
  document.getElementById("chInput").focus();

  const getValue = () => {
    const local = document.getElementById("chInput").value;
    if (!isPhone) return local.trim();
    const countryKey = document.getElementById("chCountry").value;
    return combinePhone(countryKey, local);
  };

  document.getElementById("chCancel").addEventListener("click", () => {
    slot.style.display = "none";
    slot.innerHTML = "";
  });

  document.getElementById("chSave").addEventListener("click", async () => {
    const value = getValue();
    try {
      if (channel.endpoint === "email-primary") {
        // Add as a new email and promote it to primary (handles dedupe).
        // If empty, delete the current primary.
        if (!value) {
          if (p.primary_email) {
            await apiFetch(`/api/people/${p.id}/emails`, {
              method: "POST",
              body: JSON.stringify({ action: "delete", email: p.primary_email }),
            });
          }
        } else if (value.toLowerCase() === (p.primary_email ?? "").toLowerCase()) {
          // no-op
        } else {
          // Add (or no-op if already present), then make primary
          const addRes = await apiFetch(`/api/people/${p.id}/emails`, {
            method: "POST",
            body: JSON.stringify({ action: "add", email: value }),
          });
          if (!addRes.ok && addRes.status !== 409) throw new Error(addRes.json?.error ?? "Add failed");
          await apiFetch(`/api/people/${p.id}/emails`, {
            method: "POST",
            body: JSON.stringify({ action: "make_primary", email: value }),
          });
        }
      } else {
        await apiFetch(`/api/people/${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ [channel.field]: value || null }),
        });
      }
      toast(`${channel.label} saved`);
      loadPersonById(p.id);
    } catch (e) {
      toast(e?.message ?? "Save failed");
    }
  });
}

// Render every tag in the CRM as a chip; the person's tags are marked active.
// Click toggles assignment. Avoids the separate "+ Tag" prompt and lets the
// user pick from existing tags without retyping them.
function renderTags(personId, personTags, allTags) {
  const el = document.getElementById("tags");
  const personIds = new Set(personTags.map((t) => t.id));
  // Merge: union of allTags + any tags the person has that somehow aren't in allTags
  // (shouldn't happen but defends against stale data)
  const byId = new Map();
  for (const t of allTags) byId.set(t.id, t);
  for (const t of personTags) if (!byId.has(t.id)) byId.set(t.id, t);
  const merged = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));

  if (merged.length === 0) {
    el.innerHTML = `<span class="muted">No tags yet. Create tags in the CRM Admin tab.</span>`;
    return;
  }

  el.innerHTML = "";
  for (const t of merged) {
    const active = personIds.has(t.id);
    const chip = document.createElement("button");
    chip.className = "tag";
    chip.style.cursor = "pointer";
    chip.style.border = active ? "1px solid var(--fg)" : "1px solid transparent";
    chip.style.opacity = active ? "1" : "0.55";
    chip.textContent = t.name;
    chip.addEventListener("click", async () => {
      chip.disabled = true;
      try {
        if (active) {
          await apiFetch(`/api/people/${personId}/tags?tag_id=${t.id}`, { method: "DELETE" });
        } else {
          await apiFetch(`/api/people/${personId}/tags`, {
            method: "POST",
            body: JSON.stringify({ name: t.name }),
          });
        }
        // Toggle locally without a full reload.
        if (active) personIds.delete(t.id); else personIds.add(t.id);
        chip.style.border = personIds.has(t.id) ? "1px solid var(--fg)" : "1px solid transparent";
        chip.style.opacity = personIds.has(t.id) ? "1" : "0.55";
      } catch (e) {
        toast(e?.message ?? "Failed");
      } finally {
        chip.disabled = false;
      }
    });
    el.appendChild(chip);
  }
}

// Paste handler for the interaction textarea — if the clipboard has an image,
// send it through /api/ocr and prefill the textarea with the extracted text.
// User reviews and clicks Log to save it as a manual_note interaction.
function attachPasteToOcr(p) {
  const ta = document.getElementById("ixContent");
  const hint = document.getElementById("ixHint");
  ta.addEventListener("paste", async (e) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.kind === "file" && i.type.startsWith("image/"));
    if (!item) return; // normal text paste — let it through
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    hint.textContent = "Extracting text from screenshot…";
    try {
      const fd = new FormData();
      fd.set("file", file, file.name || "screenshot.png");
      const res = await apiFetch(`/api/ocr`, { method: "POST", body: fd });
      const text = res.json?.text ?? "";
      const conf = res.json?.confidence ?? 0;
      if (!text.trim()) {
        hint.innerHTML = `<span class="error">Couldn't read any text from that image.</span>`;
        return;
      }
      ta.value = ta.value ? `${ta.value}\n\n${text}` : text;
      hint.textContent = `Extracted ${text.length} chars (${Math.round(conf * 100)}% confident). Edit and Log.`;
    } catch (err) {
      hint.innerHTML = `<span class="error">${escapeHtml(err?.message ?? "OCR failed")}</span>`;
    }
  });
}

function renderInteractionList(ixs) {
  const el = document.getElementById("ixList");
  if (ixs.length === 0) {
    el.innerHTML = `<span class="muted">No interactions yet.</span>`;
    return;
  }
  el.innerHTML = ixs.slice(0, 5).map((i) => `
    <div class="ix">
      <div class="ix-meta">
        <span>${escapeHtml(i.interaction_type.replace("_", " "))}</span>
        <span style="margin-left:auto">${escapeHtml(new Date(i.created_at).toLocaleString())}</span>
      </div>
      <div>${escapeHtml(truncate(i.raw_content, 200))}</div>
    </div>
  `).join("");
}

// ---------------------------------------------------------------------------
// Add Contact form (LinkedIn unmatched)
// ---------------------------------------------------------------------------

function renderAddContact(initial) {
  $root.innerHTML = `
    <div class="card">
      <h2>Add new contact</h2>
      <p class="muted" style="margin:0 0 6px 0; font-size:11px;">
        Not yet in your CRM. Fill in details and save.
      </p>
      <div class="grid2">
        <label class="field"><span>First name *</span><input id="first" autofocus /></label>
        <label class="field"><span>Last name</span><input id="last" /></label>
      </div>
      <label class="field"><span>Email</span><input id="email" type="email" /></label>
      <label class="field"><span>LinkedIn</span><input id="linkedin" value="${escapeHtml(initial?.linkedin ?? "")}" /></label>
      <label class="field"><span>Permanent notes</span><textarea id="notes" rows="2"></textarea></label>
      <div id="warning" class="banner" style="display:none"></div>
      <div class="row" style="margin-top:8px; justify-content:flex-end;">
        <button id="save" class="primary">Save contact</button>
      </div>
      <p id="status" class="status"></p>
    </div>
  `;

  const submit = async (confirmMismatch = false) => {
    const firstName = document.getElementById("first").value.trim();
    const lastName = document.getElementById("last").value.trim();
    const email = document.getElementById("email").value.trim();
    const linkedin = document.getElementById("linkedin").value.trim();
    const permanentNotes = document.getElementById("notes").value.trim();
    if (!firstName) { setText("status", "First name is required.", "error"); return; }
    if (!email && !linkedin) { setText("status", "Provide an email or LinkedIn URL.", "error"); return; }

    setText("status", "Saving…", "");
    try {
      const res = await apiFetch(`/api/people`, {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, linkedin, permanentNotes, confirmMismatch }),
      });
      if (res.status === 409 && res.json?.warning === "email_name_mismatch") {
        const warn = document.getElementById("warning");
        warn.style.display = "block";
        warn.innerHTML = `<p style="margin:0 0 6px 0">⚠ ${escapeHtml(res.json.message ?? "Email and name don't match.")}</p>`;
        const btn = document.createElement("button");
        btn.textContent = "Save anyway";
        btn.addEventListener("click", () => submit(true));
        warn.appendChild(btn);
        setText("status", "", "");
        return;
      }
      if (res.json?.ok) {
        setText("status", "Saved.", "ok");
        // Re-fetch by-linkedin to land on the PersonCard.
        if (linkedin) loadByLinkedIn(linkedin);
        else renderSearchHit(res.json.personId);
      }
    } catch (e) {
      setText("status", e.message ?? "Save failed", "error");
    }
  };
  document.getElementById("save").addEventListener("click", () => submit(false));
}

// ---------------------------------------------------------------------------
// Search view (non-LinkedIn URLs)
// ---------------------------------------------------------------------------

function renderSearch() {
  $root.innerHTML = `
    <div class="card">
      <p class="muted" style="margin:0 0 6px;">Not a LinkedIn profile. Search your CRM:</p>
      <input id="q" placeholder="name or topic…" autofocus />
      <div id="hits" class="results" style="margin-top:6px"></div>
    </div>
  `;
  const input = document.getElementById("q");
  const hitsEl = document.getElementById("hits");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (!q) { hitsEl.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try {
        const { json } = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
        const hits = json?.hits ?? [];
        if (hits.length === 0) {
          hitsEl.innerHTML = `<span class="muted">No matches.</span>`;
          return;
        }
        hitsEl.innerHTML = "";
        for (const h of hits.slice(0, 10)) {
          const b = document.createElement("button");
          b.className = "result";
          b.innerHTML = `
            <div class="rname">${escapeHtml(h.full_name)}</div>
            <div class="rsub">${escapeHtml(h.primary_email || "—")}</div>
          `;
          b.addEventListener("click", () => renderSearchHit(h.id));
          hitsEl.appendChild(b);
        }
      } catch (e) {
        hitsEl.innerHTML = `<span class="error">${escapeHtml(e.message ?? "search failed")}</span>`;
      }
    }, 300);
  });
}

// Hydrate and render a person by id. Used both by the search-results flow and
// as the refresh path after every in-card mutation (save summary, save notes,
// log interaction, toggle tag, edit channel) — works regardless of whether the
// person has a LinkedIn URL.
async function loadPersonById(personId) {
  $root.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const { json } = await apiFetch(`/api/people/${personId}`);
    if (!json?.person) {
      $root.innerHTML = `<p class="error">Person not found.</p>`;
      return;
    }
    renderPerson(json);
  } catch (e) {
    renderError(e);
  }
}
const renderSearchHit = loadPersonById; // backwards-compatible alias

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderError(e) {
  const msg = e instanceof ApiError ? `${e.message} (${e.status})` : (e?.message ?? String(e));
  $root.innerHTML = `
    <p class="error">${escapeHtml(msg)}</p>
    <p class="muted">Check your settings (API key + base URL) and that you're online.</p>
    <button id="goSettings">Open settings</button>
  `;
  document.getElementById("goSettings").addEventListener("click", () => chrome.runtime.openOptionsPage());
}

function setText(id, msg, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${kind ?? ""}`;
}

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

async function withButton(btn, fn) {
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "…";
  try { await fn(); }
  catch (e) { toast(e?.message ?? "Failed"); }
  finally { btn.disabled = false; btn.textContent = prev; }
}

function escapeHtml(s) {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
