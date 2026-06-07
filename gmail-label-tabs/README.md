# Gmail Label Tabs

Personal Chrome MV3 extension that adds a warm, scrollable label pill bar above Gmail's inbox list.

## What It Does

- Shows only label categories that currently have inbox mail in a scrollable pill bar.
- Rolls up sub-labels into their parent category; expands on click.
- Visual design: unread count badge appears on all pills; colored background tint only on labels with unreads (reduces visual clutter).
- All Inbox pill clears filters and shows complete inbox.
- Keeps every generated search scoped to `in:inbox`.
- Uses Gmail's own search results view — no custom thread rendering.
- Click-safe: injection into `document.body` with `position:fixed` avoids blocking Gmail's pointer events during its re-render cycle.

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
