// 42 Cluster Time Tracker - Background Service Worker
// Fetch user location history via 42 API

const API_42_TOKEN_URL = 'https://api.intra.42.fr/oauth/token';
const API_42_LOCATIONS_URL = 'https://api.intra.42.fr/v2/users';

// ⚠️ 42 API Credentials
const CLIENT_ID = 'u-s4t2ud-3976948a5e6d3d380509824569e33bb58d1dd04ebcd232a10a39c9a882586d58';
const CLIENT_SECRET = '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';

let accessToken = null;
let tokenExpiry = 0;

// Get OAuth token
async function getToken() {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    try {
        const response = await fetch(API_42_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
        });
        const data = await response.json();
        if (data.access_token) {
            accessToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early
            console.log('[Background] Token fetched successfully');
            return accessToken;
        }
        console.error('[Background] Token fetch failed:', data);
        return null;
    } catch (e) {
        console.error('[Background] Token request error:', e);
        return null;
    }
}

// Fetch user location history
async function fetchLocations(login, page = 1, perPage = 100) {
    const token = await getToken();
    if (!token) return null;

    try {
        const url = `${API_42_LOCATIONS_URL}/${login}/locations?page=${page}&per_page=${perPage}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            console.error(`[Background] API ${response.status}:`, await response.text());
            return null;
        }
        return await response.json();
    } catch (e) {
        console.error('[Background] Location request error:', e);
        return null;
    }
}

// Fetch location data for all pages
async function fetchAllLocations(login) {
    let allLocations = [];
    let page = 1;

    while (page <= 10) { // Max 10 pages = 1000 records
        const locs = await fetchLocations(login, page, 100);
        if (!locs || locs.length === 0) break;
        allLocations = allLocations.concat(locs);
        if (locs.length < 100) break; // Last page
        page++;
    }

    console.log(`[Background] Fetched ${allLocations.length} location records for ${login}`);
    return allLocations;
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchLocations') {
        const login = request.login || 'zqian';
        fetchAllLocations(login).then(locations => {
            sendResponse({ success: true, locations: locations });
        }).catch(e => {
            sendResponse({ success: false, error: e.message });
        });
        return true; // Async response
    }

    if (request.action === 'getToken') {
        getToken().then(token => {
            sendResponse({ token: token });
        });
        return true;
    }

    // Fetch all active campus locations (which hosts are currently occupied)
    if (request.action === 'fetchCampusStatus') {
        (async () => {
            try {
                const token = await getToken();
                if (!token) { sendResponse({ success: false, error: 'No token' }); return; }
                let allLocations = [];
                let page = 1;
                while (true) {
                    const url = `https://api.intra.42.fr/v2/campus/9/locations?filter[active]=true&page[size]=100&page[number]=${page}`;
                    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
                    const data = await res.json();
                    if (!data || data.length === 0) break;
                    allLocations.push(...data);
                    if (data.length < 100) break;
                    page++;
                }
                console.log(`[Background] Fetched ${allLocations.length} active campus locations`);
                sendResponse({ success: true, data: allLocations });
            } catch (e) {
                console.error('[Background] fetchCampusStatus error:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }
});

// Pre-fetch token on extension startup
getToken().then(t => {
    if (t) console.log('[Background] Startup token ready');
});
