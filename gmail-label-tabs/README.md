# Gmail Label Tabs

Personal Chrome MV3 extension that adds a warm, scrollable label pill bar above Gmail's inbox list.

## What It Does

- Shows top-level label categories that currently have inbox conversations.
- Rolls sub-labels into their parent category and loads direct child pills on demand.
- Uses Gmail-native, inbox-scoped searches when a pill is clicked. Gmail—not the extension—renders and filters the results.
- Keeps grandchildren rolled into their direct parent sub-label.
- Shows an unread estimate on pills and an Unlabeled pill when applicable.
- Keeps an All Inbox pill that returns to `#inbox`.
- Removes the bar while a conversation is open and restores it when the user returns.
- Repositions the bar when Gmail replaces the list, the sidebar changes, the browser resizes, or the sub-label row changes height.

The extension never hides or rewrites Gmail message rows.

## Local Setup

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this `gmail-label-tabs` folder.
4. Copy the extension ID Chrome shows after loading.
5. In Google Cloud Console:
   - Create or select a personal project.
   - Enable the Gmail API.
   - Configure OAuth consent with your Gmail address as a test user.
   - Create an OAuth Client ID with application type **Chrome Extension**.
   - Confirm that the Chrome extension ID matches the ID from step 4.
6. Put that OAuth client ID in `manifest.json` under `oauth2.client_id` if it differs from the existing personal configuration.
7. Reload the extension in `chrome://extensions`.
8. Open Gmail, click the extension icon, connect Gmail, and reload Gmail once.

An unpacked extension can receive a different extension ID when its path or machine changes. If sign-in fails after a fresh install, check the Chrome extension ID against the OAuth client configuration first.

v1.1 assumes the Gmail tab and Chrome Identity token belong to the same single personal account. Multi-account Gmail profiles are not yet supported.

## How Filtering Works

Parent labels build a deterministic Gmail query containing the parent and every descendant:

```text
in:inbox (label:"3- Career" OR label:"3- Career/Glean" OR ...)
```

Direct child pills use the same rollup for that child and its descendants. Unlabeled uses `in:inbox has:nouserlabels`.

Pill visibility and badges use Gmail thread-search estimates with the same canonical queries. Top-level summaries load first; child summaries load only when a parent is selected. Label metadata is cached for one hour and summaries for one minute.

## Development

```bash
npm ci
npm test
```

The extension has no production build step. Chrome loads the files directly from this folder.

## Verification

Automated tests cover query generation, route recognition, caching, auth error handling, pill rendering, and non-compounding layout spacing. Real Gmail smoke testing is still required because Gmail's DOM and hash routes are not public extension APIs.

Check at least:

- parent, child, Unlabeled, and All Inbox results;
- opening a thread and returning with Back;
- collapsed and expanded Gmail sidebar;
- sub-label row opening and closing;
- browser resize and 80%, 100%, and 125% zoom;
- Gmail menus and search remaining clickable.
