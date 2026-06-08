# Gmail Label Tabs

Personal Chrome MV3 extension that adds a warm, scrollable label pill bar above Gmail's inbox list.

## Core Features (Phase 1 + 2)

- **Responsive pill bar**: Shows only label categories with inbox mail in a scrollable, collapsible UI above the inbox list.
- **Hierarchy navigation**: Rolls up sub-labels into parents; expands on click to show children.
- **Visual clarity**: Unread count badge on all pills; colored background tint only when unreads exist (reduces clutter).
- **All Inbox filter**: Special pill clears filters and shows complete inbox without re-triggering OAuth.
- **Search scoping**: Every filter query scoped to `in:inbox`, using Gmail's native search results view.
- **Performance**: Caches label hierarchy (1h TTL) and message counts (60s TTL) locally; stale-while-revalidate pattern renders from cache instantly, refreshes in background only if stale.
- **Click-safe**: Injection into `document.body` with `position:fixed` avoids blocking Gmail's pointer events during its re-render cycle.

## Local Setup

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `gmail-label-tabs` folder.
4. Copy the extension ID Chrome shows after loading.
5. In Google Cloud Console:
   - Create or select a project.
   - Enable the Gmail API.
   - Configure OAuth consent with your Gmail address as a test user.
   - Create an OAuth Client ID with application type **Chrome Extension**.
   - Paste the Chrome extension ID from step 4.
6. Replace `REPLACE_WITH_CHROME_EXTENSION_OAUTH_CLIENT_ID` in `manifest.json`.
7. Reload the extension in `chrome://extensions`.
8. Open Gmail, click the extension icon, connect Gmail, then reload Gmail.

## Development

```bash
npm install
npm test
```

The extension has no production build step. Chrome loads the files directly from this folder.
