// injector.js — Content Script (ISOLATED world)
// Inject content.js to MAIN world + relay 42 API requests

// Wrap in async IIFE to fetch activeSkin first
(async function () {
    let activeSkin = 'glass_morphism';
    const cacheBust = `?v=${Date.now()}`;

    // Attempt to get activeSkin from local storage
    try {
        const result = await chrome.storage.local.get(['activeSkin']);
        if (result.activeSkin) {
            activeSkin = result.activeSkin;
        }
    } catch (e) {
        console.warn("[Injector] Failed to read activeSkin, using default", e);
    }

    // 1) Inject Skin CSS
    const c = document.createElement('link');
    c.id = 'tracker-skin-css';
    c.rel = 'stylesheet';
    c.href = chrome.runtime.getURL(`skins/${activeSkin}/cluster.css`) + cacheBust;
    (document.head || document.documentElement).appendChild(c);

    // Listen for dynamic skin changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.activeSkin) {
            const newSkin = changes.activeSkin.newValue;
            const newCacheBust = `?v=${Date.now()}`;

            // Update CSS
            const cssEl = document.getElementById('tracker-skin-css');
            if (cssEl) {
                cssEl.href = chrome.runtime.getURL(`skins/${newSkin}/cluster.css`) + newCacheBust;
            }

            // Inject new templates then notify MAIN world dynamically!
            const tmpl = document.createElement('script');
            tmpl.src = chrome.runtime.getURL(`skins/${newSkin}/templates.js`) + newCacheBust;
            tmpl.type = 'text/javascript';
            tmpl.onload = function () {
                window.dispatchEvent(new CustomEvent('tracker_skin_changed', { detail: { newSkin } }));
            };
            (document.head || document.documentElement).appendChild(tmpl);
        }
    });

    // 2) Inject Skin Manager
    const sm = document.createElement('script');
    sm.src = chrome.runtime.getURL('skins/skin_manager.js') + cacheBust;
    sm.type = 'text/javascript';
    (document.head || document.documentElement).appendChild(sm);

    // 3) Inject Active Skin Templates (Wait for Skin Manager)
    sm.onload = function () {
        const tmpl = document.createElement('script');
        tmpl.src = chrome.runtime.getURL(`skins/${activeSkin}/templates.js`) + cacheBust;
        tmpl.type = 'text/javascript';

        // 4) Inject content.js (Wait for templates)
        tmpl.onload = function () {
            // Pass activeSkin to content.js via a global variable or dataset on script
            const s = document.createElement('script');
            s.src = chrome.runtime.getURL('content.js') + cacheBust;
            s.type = 'text/javascript';
            s.dataset.activeSkin = activeSkin; // allow content.js to know its skin
            (document.head || document.documentElement).appendChild(s);
        };
        (document.head || document.documentElement).appendChild(tmpl);
    };

    // 5) Inject Network Interceptor (MAIN world, to spy on Fetch/XHR)
    const interceptScript = document.createElement('script');
    interceptScript.src = chrome.runtime.getURL('network-interceptor.js') + cacheBust;
    interceptScript.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(interceptScript);

})();

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

// Listen for custom events from content.js (MAIN world) → forward to background.js
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

// Listen for skin toggle requests from content.js (since content.js is in MAIN and lacks chrome.storage)
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'tracker_set_skin') {
        const newSkin = event.data.newSkin;
        if (newSkin) {
            chrome.storage.local.set({ activeSkin: newSkin });
        }
    }
});

console.log('[Injector] Initialization started (Async Skin Loading)');
