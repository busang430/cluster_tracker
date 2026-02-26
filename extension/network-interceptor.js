(function () {
    console.log("🌟 [42 Tracker] Network Interceptor injected and running! Listening for Star Claims...");

    // Monkey-patch fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : "");

        try {
            const response = await originalFetch.apply(this, args);

            // Only intercept interesting API calls (like POST/PUT/PATCH to an intra endpoint or something related to locations/stars)
            // As we don't know the exact endpoint for the "Claim Star", we will log anything that is a POST/PUT/PATCH request
            const method = (args[1] && args[1].method) ? args[1].method.toUpperCase() : "GET";

            if (method !== "GET" && (url.includes('api') || url.includes('locations') || url.includes('stars') || url.includes('claims') || url.includes('users') || url.includes('matrix'))) {
                const clonedResponse = response.clone();
                clonedResponse.text().then(text => {
                    let logStr = `========= 🌟 42 TRACKER INTERCEPTOR (FETCH) =========\n`;
                    logStr += `URL: ${url}\n`;
                    logStr += `METHOD: ${method}\n`;
                    logStr += `STATUS: ${response.status}\n`;

                    try {
                        const jsonObj = JSON.parse(text);
                        logStr += `RESPONSE: ${JSON.stringify(jsonObj, null, 2)}\n`;
                    } catch (e) {
                        logStr += `RESPONSE (Raw Text): ${text}\n`;
                    }

                    logStr += `=====================================================`;
                    console.log(`%c${logStr}`, "background: #ff5252; color: white; font-weight: bold;");
                }).catch(e => console.error("Interceptor response parse error:", e));
            }

            return response;
        } catch (error) {
            throw error;
        }
    };

    // Monkey-patch XMLHttpRequest
    const XHR = window.XMLHttpRequest;
    const proto = XHR.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;

    proto.open = function (method, url) {
        this._method = method;
        this._url = url;
        return originalOpen.apply(this, arguments);
    };

    proto.send = function () {
        this.addEventListener('load', function () {
            const method = this._method ? this._method.toUpperCase() : "GET";
            const url = this._url || "";

            // We intercept non-GET requests to potential validation endpoints
            if (method !== "GET" && (url.includes('api') || url.includes('locations') || url.includes('stars') || url.includes('claims') || url.includes('users') || url.includes('matrix'))) {
                let logStr = `========= 🌟 42 TRACKER INTERCEPTOR (XHR) =========\n`;
                logStr += `URL: ${url}\n`;
                logStr += `METHOD: ${method}\n`;
                logStr += `STATUS: ${this.status}\n`;

                try {
                    const jsonObj = JSON.parse(this.responseText);
                    logStr += `RESPONSE: ${JSON.stringify(jsonObj, null, 2)}\n`;
                } catch (e) {
                    logStr += `RESPONSE (Raw Text): ${this.responseText}\n`;
                }

                logStr += `===================================================`;
                console.log(`%c${logStr}`, "background: #ffca28; color: black; font-weight: bold;");
            }
        });
        return originalSend.apply(this, arguments);
    };
})();
