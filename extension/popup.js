// 42 Cluster Time Tracker - Popup Script

const TARGET_TIME_MS = (3 * 60 + 42) * 60 * 1000; // 3 hours 42 minutes

// Format time
function formatTime(ms) {
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h${minutes}m` : `${minutes}m`;
}

// Global state
let activeSkin = 'glass_morphism';
let availableSkins = ['retro_comic', 'glass_morphism']; // 'default' skin is intentionally hidden from selection
let isAppInitialized = false;

// 1. Initialize App Frame
function renderApp() {
  // Set CSS
  document.getElementById('skin-css').href = `skins/${activeSkin}/popup.css`;

  // Render Shell (assuming templates are already loaded via <script> tag)
  const shellHTML = window.SkinManager.getTemplate(activeSkin, 'renderPopupShell')(activeSkin, availableSkins);
  document.getElementById('app').innerHTML = shellHTML;

  // Attach permanent listeners
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all tracking data?')) {
      chrome.runtime.sendMessage({ action: 'clearSessions' }, () => {
        updateDisplay();
      });
    }
  });

  document.getElementById('skinSelector').addEventListener('change', (e) => {
    const selectedSkin = e.target.value;
    chrome.storage.local.set({ activeSkin: selectedSkin }, () => {
      activeSkin = selectedSkin;
      renderApp();
      updateDisplay();
    });
  });

  // Dev Tool: Generate and Download PNG Icons from the SVG!
  // We add this button dynamically for the user to grab the icons.
  if (!document.getElementById('devIconBtn')) {
    const btn = document.createElement('button');
    btn.id = 'devIconBtn';
    btn.textContent = '🐰 Click here to Download New Icons!';
    btn.style.cssText = 'width:100%; padding:8px; margin-top:10px; background:#ff6b6b; color:#fff; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:12px;';

    btn.addEventListener('click', async () => {
      const svgData = `
  <svg width="1024" height="1024" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <!-- Solid background block for the icon to avoid pure transparent holes blending poorly in taskbars -->
    <path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" fill="transparent" />
    <path d="M 25 35 Q 12 50 15 75 Q 25 85 30 65 Q 35 45 25 35 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
    <path d="M 75 35 Q 88 50 85 75 Q 75 85 70 65 Q 65 45 75 35 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
    <path d="M 20 60 Q 30 15 50 15 Q 70 15 80 60 Q 85 90 50 90 Q 15 90 20 60 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
    <path d="M 35 55 Q 50 60 65 55 L 75 80 Q 50 95 25 80 Z" fill="#FFFFFF" stroke="#333" stroke-width="2"/>
    <path d="M 25 55 Q 35 65 30 70 Q 20 70 25 55 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
    <path d="M 75 55 Q 65 65 70 70 Q 80 70 75 55 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
    <ellipse cx="35" cy="32" rx="6" ry="7" fill="#000"/>
    <circle cx="33" cy="29" r="2.5" fill="#fff"/>
    <circle cx="37" cy="34" r="1.2" fill="#fff"/>
    <ellipse cx="65" cy="32" rx="6" ry="7" fill="#000"/>
    <circle cx="63" cy="29" r="2.5" fill="#fff"/>
    <circle cx="67" cy="34" r="1.2" fill="#fff"/>
    <path d="M 45 32 Q 50 35 55 32 L 50 38 Z" fill="#E6A19A" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M 50 38 L 50 42" stroke="#333" stroke-width="2" stroke-linecap="round"/>
    <path d="M 50 42 Q 43 45 38 41" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 50 42 Q 57 45 62 41" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M 46 48 Q 50 51 54 48" stroke="#333" stroke-width="1" fill="none" stroke-linecap="round"/>
  </svg>`;

      const sizes = [16, 48, 128];
      for (const size of sizes) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const img = new Image();
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        await new Promise(resolve => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0, size, size);
            const dataUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `icon${size}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            resolve();
          };
          img.src = url;
        });
      }
      btn.textContent = '✅ Downloaded! Check your Downloads folder.';
      btn.style.background = '#4cd137';
    });
    document.getElementById('app').appendChild(btn);
  }
}

function initApp() {
  chrome.storage.local.get(['activeSkin'], (res) => {
    if (res.activeSkin) {
      activeSkin = res.activeSkin;
    }
    renderApp();
    isAppInitialized = true;
    updateDisplay(); // Trigger first render
  });
}

// 2. Update Dynamic Content
function updateDisplay() {
  if (!isAppInitialized) return;

  chrome.storage.local.get(['sessions'], (result) => {
    const sessions = result.sessions || {};
    const content = document.getElementById('content');
    if (!content) return;

    if (Object.keys(sessions).length === 0) {
      content.innerHTML = window.SkinManager.getTemplate(activeSkin, 'renderPopupEmptyState')();
      return;
    }

    content.innerHTML = window.SkinManager.getTemplate(activeSkin, 'renderPopupSessions')(sessions, TARGET_TIME_MS, formatTime);
  });
}

// Start
initApp();
setInterval(updateDisplay, 1000);
