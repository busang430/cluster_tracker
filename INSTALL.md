# Installation Guide

This file focuses on installation and debugging. For the full project overview, read `README.md`.

## Folder to Select

The extension is loaded from the repository root:

```text
D:\42\cluster
```

That folder must contain `manifest.json` directly.

## Install

1. Open `background.js`.
2. Fill in `CLIENT_ID` and `CLIENT_SECRET`.
3. Open Chrome.
4. Go to `chrome://extensions/`.
5. Enable Developer mode.
6. Click Load unpacked.
7. Select `D:\42\cluster`.
8. Open `https://matrix.42lyon.fr/`.
9. Refresh the page.

## Verify

Installation is working when:

- Chrome shows the extension card named `Catch 'Em All!`.
- The extension is enabled.
- The Matrix page shows the floating tracker panel.
- The panel API status eventually shows `Fresh ...`.

## Common Errors

### Manifest file is missing or unreadable

You selected the wrong folder. Choose `D:\42\cluster`, not the old `extension` folder.

### Could not load icon

Check that these files exist:

```text
icons/icon16.png
icons/icon48.png
icons/icon128.png
```

### Token API Error or 401

Check the UID and Secret in `background.js`, then reload the extension from `chrome://extensions/`.

### Extension reloaded, please refresh the page

The background service worker was reloaded while the Matrix page still had the old injected script. Refresh the Matrix page.

## Debugging

- Background logs: `chrome://extensions/` -> extension card -> service worker.
- Page logs: Matrix page -> F12 -> Console.
- Tracker export: floating panel -> export logs button.
