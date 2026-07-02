// Clicking the toolbar icon opens (toggles) the side panel. The panel then
// stays open as the user navigates — including across LinkedIn profiles — and
// re-renders itself from the active tab's URL (see popup.js).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error("setPanelBehavior failed:", e));
