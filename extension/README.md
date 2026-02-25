# 42 Cluster Time Tracker - Chrome Extension

## 📖 Introduction

This is a Chrome browser extension used to track your cluster time at 42. It helps you to:
- Monitor login duration for each host in real-time
- Calculate the time remaining to earn a star (3 hours and 42 minutes needed per host)
- Display progress directly on the Matrix page

## ✨ Features

- **History view**: Shows your historical login times on each host (last 3 records)
- **Real-time tracking**: Automatically listens to Matrix stream events to update login status in real-time
- **Visual progress**: Beautiful progress bars displaying the completion rate for each host
- **Floating panel**: Real-time tracking info in the top right corner of the Matrix page
- **Expandable history**: Click to expand and view detailed login/logout times
- **Popup window**: Click the extension icon to see detailed stats
- **Data persistence**: Automatically saves all login records
- **Modern UI**: Modern design featuring gradients and animations

## 🚀 Installation

### Method 1: Load Developer Mode (Recommended)

1. Open Chrome browser
2. Visit `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `d:\42\cluster\extension` folder
6. Extension installation complete!

### Method 2: Packaged Installation

1. Go to the `chrome://extensions/` page
2. Click "Pack extension"
3. Select the `d:\42\cluster\extension` folder
4. Once the `.crx` file is generated, drag and drop it into Chrome to install

## 📝 How to Use

1. **Visit Matrix page**: Open https://matrix.42lyon.fr/
2. **Auto tracking**: The extension will automatically start listening to login/logout events
3. **View progress**:
   - A real-time tracking panel will appear in the top right corner of the page
   - Click the extension icon to view detailed stats
4. **Earn stars**: When a host's login duration reaches 3 hours 42 minutes, "✨ Star earned!" will be displayed

## 🎨 Interface Overview

### Floating Panel (Matrix Page)
- Displays real-time login status for all hosts
- Green "Online" badge indicates currently in use
- Progress bar shows completion percentage
- Real-time countdown shows remaining time
- **📋 Login History**: Click to expand and view recent login times
  - Shows login date and time
  - Shows duration for each session
  - Highlights ongoing sessions

### Popup Window (Click Extension Icon)
- View detailed stats for all hosts
- Logged time / Time remaining
- Clear data button (resets all records)

## 🔧 Technical Details

- **Manifest V3**: Uses the latest Chrome extension APIs
- **Service Worker**: Continuously tracks login status in the background
- **Content Script**: Injects tracking logic into the Matrix page
- **Chrome Storage**: Local storage for all login records
- **Server-Sent Events**: Listens to the real-time Matrix stream

## 📊 Data Structure

The extension stores the following information for each host:
```javascript
{
  "hostName": {
    "totalTime": Cumulative login duration (milliseconds),
    "sessions": [Historical login records],
    "currentSession": {Current login info}
  }
}
```

## ⚠️ Notes

1. **Login Required**: You must log in to your 42 account to use it
2. **Keep Open**: The Matrix page must remain open for tracking to work
3. **Local Data**: All data is stored locally and will not be uploaded to any server
4. **Clear Data**: Clicking "Clear Data" will delete all historical records

## 🐛 Troubleshooting

### Extension fails to load
- Ensure "Developer mode" is enabled
- Check if the folder path is correct
- Check the console for error messages

### Unable to track time
- Ensure you are logged into your 42 account
- Check if you are on the https://matrix.42lyon.fr/ page
- Open Developer Tools to check if the Console has errors

### Data loss
- Extension data is stored locally in Chrome
- Clearing browser data will delete tracking records
- It is recommended to take screenshots periodically to save important data

## 🎯 Target Time

- **Per host target**: 3 hours 42 minutes (3h 42m)
- **Total duration**: 222 minutes = 13,320 seconds = 13,320,000 milliseconds

## 📄 File Description

- `manifest.json` - Extension configuration file
- `background.js` - Background service worker
- `content.js` - Page injection script
- `styles.css` - Stylesheet
- `popup.html` - Popup window HTML
- `popup.js` - Popup window logic
- `icons/` - Extension icons (16x16, 48x48, 128x128)

## 🔮 Future Improvements

- [ ] Export data feature (CSV/JSON)
- [ ] Multi-campus support
- [ ] Data visualization charts
- [ ] Notification reminders
- [ ] Dark mode toggle

## 📞 Support

If you have any questions or suggestions, please contact the developer.

---

**Made with ❤️ for 42 students**
