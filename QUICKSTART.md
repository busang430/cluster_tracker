# Quick Start

Use this guide when you just want to get the extension running quickly.

## 1. Add API Credentials

Open `background.js` and fill in your 42 API application credentials:

```javascript
const CLIENT_ID = 'your UID';
const CLIENT_SECRET = 'your Secret';
```

## 2. Load the Extension

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the repository root:

```text
D:\42\cluster
```

Do not select the old `D:\42\cluster\extension` folder.

## 3. Open Matrix

1. Go to `https://matrix.42lyon.fr/`.
2. Log in with your 42 account.
3. Refresh the page.
4. Wait for the floating panel in the upper-right corner.
5. Confirm the API status becomes `Fresh ...`.

## 4. When You Change Code

After editing `background.js`, `content.js`, a skin file, or API credentials:

1. Return to `chrome://extensions/`.
2. Reload the extension card.
3. Refresh the Matrix page.

## 5. If Data Looks Old

Check the panel status:

- `Fresh`: the 42 API fetch succeeded.
- `Cached`: the panel is showing local startup cache.
- `Using cached`: the API request failed and the panel is showing old cache.

For full troubleshooting, read `README.md`.
