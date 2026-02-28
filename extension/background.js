// 42 Cluster Time Tracker - Background Service Worker
// Fetch user location history via 42 API - HIGHLY RESILIENT & FAST

const API_42_TOKEN_URL = 'https://api.intra.42.fr/oauth/token';
const API_42_LOCATIONS_URL = 'https://api.intra.42.fr/v2/users';

// ⚠️ 42 API Credentials
const CLIENT_ID = 'u-s4t2ud-3976948a5e6d3d380509824569e33bb58d1dd04ebcd232a10a39c9a882586d58';
const CLIENT_SECRET = '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';

let accessToken = null;
let tokenExpiry = 0;

// Helper: Async sleep to prevent 42 API rate limits
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Fetch with strict timeout so it NEVER hangs forever
async function fetchWithTimeout(url, options, timeoutMs = 25000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw new Error(e.name === 'AbortError' ? 'timeout' : e.message);
    }
}

// Get OAuth token
async function getToken() {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    try {
        const response = await fetchWithTimeout(API_42_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Background] Token API error ${response.status}:`, errText);
            throw new Error(`Token API Error: ${response.status}`);
        }

        const data = await response.json();
        if (data.access_token) {
            accessToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
            console.log('[Background] Token fetched successfully');
            return accessToken;
        }
        throw new Error('Token payload missing access_token');
    } catch (e) {
        console.error('[Background] Token request failed:', e.message);
        throw e;
    }
}

// Fetch a single page
async function fetchLocationsPage(login, page, perPage, token) {
    const url = `${API_42_LOCATIONS_URL}/${login}/locations?page[number]=${page}&page[size]=${perPage}&sort=-begin_at`;
    const response = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${token}` } }, 10000);
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Location API error ${response.status}: ${errText.substring(0, 100)}`);
    }
    return await response.json();
}

// Sequential fetching to avoid rate limits/503s from 42 API, stops immediately if < 100 items
async function fetchAllLocationsSafely(login) {
    const token = await getToken();

    let allLocations = [];
    let page = 1;

    console.log(`[Background] Fetching locations for ${login}...`);

    while (page <= 10) { // Max 1000 records
        let maxRetries = 3;
        let success = false;
        let data = null;

        while (maxRetries > 0 && !success) {
            try {
                data = await fetchLocationsPage(login, page, 100, token);
                success = true;
            } catch (e) {
                console.error(`[Background] Page ${page} failed: ${e.message}. Retries left: ${maxRetries - 1}`);
                maxRetries--;
                if (maxRetries === 0) {
                    if (page === 1) throw e;
                    break;
                }
                await sleep(2000); // give 42 API a chance to recover
            }
        }

        if (!success) {
            console.log(`[Background] Stopping fetch after successive failures on page ${page}.`);
            break;
        }

        if (!data || data.length === 0) break; // Reached end

        allLocations = allLocations.concat(data);

        // If we got LESS than 100 records, there are NO MORE pages. Stop immediately!
        if (data.length < 100) break;

        page++;
        // Gentle delay to avoid "429 Too Many Requests (Spam Rate Limit Exceeded)"
        await sleep(500);
    }

    console.log(`[Background] Grabbed ${allLocations.length} records safely.`);
    return allLocations;
}

// Fetch active campus locations (sequential)
async function fetchCampusStatusSafely() {
    const token = await getToken();
    let allLocations = [];
    let page = 1;

    console.log('[Background] Fetching campus status...');
    while (page <= 5) {
        let maxRetries = 3;
        let success = false;
        let data = null;
        const url = `https://api.intra.42.fr/v2/campus/9/locations?filter[active]=true&page[size]=100&page[number]=${page}`;

        while (maxRetries > 0 && !success) {
            try {
                const res = await fetchWithTimeout(url, { headers: { 'Authorization': `Bearer ${token}` } }, 10000);
                if (!res.ok) throw new Error(`Status ${res.status}`);
                data = await res.json();
                success = true;
            } catch (e) {
                console.error(`[Background] Campus page ${page} failed: ${e.message}`);
                maxRetries--;
                if (maxRetries === 0) break;
                await sleep(2000);
            }
        }

        if (!success) break;
        if (!data || data.length === 0) break;

        allLocations = allLocations.concat(data);
        if (data.length < 100) break; // Finished early
        page++;
        await sleep(500); // Dodge the rate limits
    }
    return allLocations;
}

// Keep Service Worker Alive
let lifesaver;
function keepAlive() {
    if (lifesaver) clearInterval(lifesaver);
    lifesaver = setInterval(() => {
        chrome.runtime.getPlatformInfo(() => { });
    }, 20000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    keepAlive();

    if (request.action === 'fetchLocations') {
        const login = request.login;
        if (!login) {
            sendResponse({ success: false, error: 'No login provided' });
            return true;
        }
        fetchAllLocationsSafely(login).then(locations => {
            sendResponse({ success: true, locations: locations });
        }).catch(e => {
            sendResponse({ success: false, error: e.message });
        });
        return true;
    }

    if (request.action === 'fetchCampusStatus') {
        fetchCampusStatusSafely().then(data => {
            sendResponse({ success: true, data: data });
        }).catch(e => {
            sendResponse({ success: false, error: e.message });
        });
        return true;
    }
});

// Pre-fetch token
getToken().then(() => console.log('[Background] Startup token ready')).catch(e => console.log('Init token error:', e.message));
