# 42 Cluster Time Tracker - Installation Guide

## 📋 Pre-installation

Before installing the extension, you need to prepare the icon files.

### Create Icons (Important!)

The extension requires three icon files. Please follow these steps to create them:

1. Open `icons/README_ICONS.md` for detailed icon creation instructions
2. Create or download three PNG icons:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
3. Place the icon files in the `extension/icons/` folder

**Temporary solution**: If you don't have icons right now, you can rename any PNG image and use it. It won't affect the extension's functionality.

## 🚀 Installation Steps

### 1. Open Chrome Extensions Management Page

In the Chrome browser address bar, enter:
```
chrome://extensions/
```

### 2. Enable Developer Mode

Find the "Developer mode" toggle in the top right corner of the page and turn it on.

### 3. Load Extension

1. Click the "Load unpacked" button in the top left corner
2. In the file picker, navigate to:
   ```
   d:\42\cluster\extension
   ```
3. Select this folder and click "Select Folder"

### 4. Confirm Installation

If everything is correct, you will see:
- ✅ The extension card appears in the list
- ✅ Extension name: 42 Cluster Time Tracker
- ✅ Version: 1.0.0
- ✅ Status: Enabled

## ✅ Verify Installation

### Check if the extension is working properly

1. **Check the toolbar icon**
   - The extension icon should appear in the Chrome toolbar
   - If not, click the puzzle piece icon 📌 to pin the extension to the toolbar

2. **Visit the Matrix page**
   - Open https://matrix.42lyon.fr/
   - Log in to your 42 account
   - The time tracking panel should appear in the top right corner of the page

3. **Test the popup window**
   - Click the extension icon in the toolbar
   - The stats window should pop up

## ⚠️ Common Issues

### Issue 1: Extension fails to load

**Error message**: "Manifest file is missing or unreadable"

**Solution**:
- Make sure you selected the `extension` folder, not the `cluster` folder
- Check if the `manifest.json` file exists

### Issue 2: Icon display error

**Error message**: "Could not load icon"

**Solution**:
- Check if the `icons` folder exists
- Ensure all three icon files have been created
- Temporary solution: Rename any PNG image to use as an icon

### Issue 3: Tracking panel doesn't show on the page

**Possible causes**:
- Not logged into your 42 account
- Not on the Matrix page
- Extension permissions not granted

**Solution**:
1. Ensure you are logged into https://matrix.42lyon.fr/
2. Refresh the page (F5)
3. Open Developer Tools (F12) and check the Console for errors

### Issue 4: Unable to track time

**Possible causes**:
- Cookies not authorized
- Network connection issues

**Solution**:
1. Find the extension on the `chrome://extensions/` page
2. Click "Details"
3. Ensure the "On all sites" permission is enabled
4. Refresh the Matrix page

## 🔧 Developer Debugging

If you need to debug the extension:

1. **Check Background Logs**
   - Click on "service worker" on the extension card
   - Open the background console

2. **Check Content Script Logs**
   - Press F12 on the Matrix page
   - Check the Console tab

3. **Reload Extension**
   - After modifying code, click the refresh icon 🔄 on the extension card
   - Or disable and re-enable the extension

## 📝 Usage Instructions

After successful installation, please read `README.md` for detailed usage instructions.

## 🎯 Next Steps

1. ✅ Install extension
2. 📖 Read `README.md` to understand features
3. 🖥️ Visit the Matrix page to start tracking
4. ⏱️ Earn your first star!

---

**Good luck with your studies at 42! 🚀**
