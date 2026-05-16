(function () {
    console.log("🌟 [42 Tracker] Network Interceptor v2 — Capturing ALL api.intra.42.fr requests...");

    // Store all captured API calls for export
    window._trackerApiCaptures = window._trackerApiCaptures || [];

    // ============================================================
    // STAR HUNT MODE: Log ALL GET requests to api.intra.42.fr
    // so we can discover which endpoint returns the star count
    // shown in the top navigation bar ("6S ⭐")
    // ============================================================

    const STAR_HUNT = true; // Set to false after we find the endpoint

    function logApiCall(method, url, status, responseText) {
        const is42Api = url.includes('api.intra.42.fr') || url.includes('/v2/');
        if (!is42Api) return;

        const isGet = method === 'GET';
        const isWriteToInteresting = !isGet && (
            url.includes('locations') || url.includes('stars') || url.includes('claims') || url.includes('users') || url.includes('matrix')
        );

        if (!STAR_HUNT && !isWriteToInteresting) return;

        let parsed = null;
        try { parsed = JSON.parse(responseText); } catch (e) { parsed = responseText?.substring(0, 300); }

        // For GET requests: highlight if response looks like it has stars/logtime/score data
        const responseStr = JSON.stringify(parsed);
        const looksInteresting = responseStr && (
            responseStr.includes('star') ||
            responseStr.includes('logtime') ||
            responseStr.includes('score') ||
            responseStr.includes('correction_point') ||
            responseStr.includes('achievement')
        );

        const bg = isGet
            ? (looksInteresting ? '#00c853' : '#1565c0')  // Green if star-related, blue if normal GET
            : '#ff5252'; // Red for non-GET
        const label = isGet
            ? (looksInteresting ? '⭐ STAR-RELATED GET' : '📡 GET')
            : '✏️ WRITE';

        // Build capture object and dispatch as CustomEvent (crosses main→isolated world boundary)
        // content.js listens and collects these for the export.
        const capture = {
            time: new Date().toISOString(),
            method,
            url,
            status,
            looksInteresting,
            response: parsed && typeof parsed === 'object'
                ? JSON.stringify(parsed).substring(0, 2000)
                : String(parsed || '').substring(0, 500)
        };
        window.dispatchEvent(new CustomEvent('tracker_api_capture', { detail: capture }));

        console.groupCollapsed(`%c${label} ${status} — ${url.replace('https://api.intra.42.fr', '')}`, `background:${bg};color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px;`);
        console.log('Full URL:', url);
        console.log('Response:', parsed);
        console.groupEnd();
    }

    // --- Patch fetch ---
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');
        const method = (args[1]?.method ?? 'GET').toUpperCase();
        try {
            const response = await originalFetch.apply(this, args);
            const cloned = response.clone();
            cloned.text().then(text => logApiCall(method, url, response.status, text)).catch(() => { });
            return response;
        } catch (error) { throw error; }
    };

    // --- Patch XHR ---
    const proto = window.XMLHttpRequest.prototype;
    const origOpen = proto.open;
    const origSend = proto.send;
    proto.open = function (method, url) {
        this._method = method?.toUpperCase();
        this._url = url;
        return origOpen.apply(this, arguments);
    };
    proto.send = function () {
        this.addEventListener('load', function () {
            logApiCall(this._method || 'GET', this._url || '', this.status, this.responseText);
        });
        return origSend.apply(this, arguments);
    };
})();
