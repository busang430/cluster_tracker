// injector.js — Content Script (ISOLATED world)
// Inject content.js to MAIN world + relay 42 API requests

// 1) Inject content.js into page
const s = document.createElement('script');
s.src = chrome.runtime.getURL('content.js');
s.type = 'text/javascript';
(document.head || document.documentElement).appendChild(s);

// 2) Inject styles.css
const c = document.createElement('link');
c.rel = 'stylesheet';
c.href = chrome.runtime.getURL('styles.css');
(document.head || document.documentElement).appendChild(c);

// 3) Listen for custom events from content.js (MAIN world) → forward to background.js
window.addEventListener('tracker_request', async (event) => {
    const { action, login, requestId } = event.detail;

    if (action === 'fetchLocations') {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'fetchLocations',
                login: login
            });
            // Send results back to MAIN world
            window.dispatchEvent(new CustomEvent('tracker_response', {
                detail: { requestId, ...response }
            }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tracker_response', {
                detail: { requestId, success: false, error: e.message }
            }));
        }
    }
});

console.log('[Injector] content.js + styles.css injected, API relay configured');
