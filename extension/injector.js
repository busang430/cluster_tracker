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

// 3) Inject Network Interceptor (MAIN world, to spy on Fetch/XHR)
const interceptScript = document.createElement('script');
interceptScript.src = chrome.runtime.getURL('network-interceptor.js');
interceptScript.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(interceptScript);

// Helper: safely send message to background, with extension context check
async function safeSendMessage(message) {
    try {
        if (!chrome.runtime || !chrome.runtime.id) {
            throw new Error('Extension reloaded — please refresh the page (F5)');
        }
        const response = await chrome.runtime.sendMessage(message);
        return response;
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
            throw new Error('Extension reloaded — please refresh the page (F5)');
        }
        throw e;
    }
}

// 4) Listen for custom events from content.js (MAIN world) → forward to background.js
window.addEventListener('tracker_request', async (event) => {
    const { action, login, requestId } = event.detail;

    if (action === 'fetchLocations') {
        try {
            const response = await safeSendMessage({ action: 'fetchLocations', login });
            window.dispatchEvent(new CustomEvent('tracker_response', { detail: { requestId, ...response } }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tracker_response', { detail: { requestId, success: false, error: e.message } }));
        }
    }

    if (action === 'fetchCampusStatus') {
        try {
            const response = await safeSendMessage({ action: 'fetchCampusStatus' });
            window.dispatchEvent(new CustomEvent('tracker_response', { detail: { requestId, ...response } }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tracker_response', { detail: { requestId, success: false, error: e.message } }));
        }
    }
});

console.log('[Injector] content.js + styles.css injected, API relay configured');
