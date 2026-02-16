// 42 Cluster Time Tracker - Background Service Worker
// 通过42 API获取用户位置历史

const API_42_TOKEN_URL = 'https://api.intra.42.fr/oauth/token';
const API_42_LOCATIONS_URL = 'https://api.intra.42.fr/v2/users';

// ⚠️ 42 API 凭据
const CLIENT_ID = 'u-s4t2ud-3976948a5e6d3d380509824569e33bb58d1dd04ebcd232a10a39c9a882586d58';
const CLIENT_SECRET = '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';

let accessToken = null;
let tokenExpiry = 0;

// 获取OAuth token
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
            tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 提前1分钟刷新
            console.log('[Background] Token获取成功');
            return accessToken;
        }
        console.error('[Background] Token获取失败:', data);
        return null;
    } catch (e) {
        console.error('[Background] Token请求出错:', e);
        return null;
    }
}

// 获取用户位置历史
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
        console.error('[Background] 位置请求出错:', e);
        return null;
    }
}

// 获取所有页面的位置数据
async function fetchAllLocations(login) {
    let allLocations = [];
    let page = 1;

    while (page <= 10) { // 最多10页 = 1000条记录
        const locs = await fetchLocations(login, page, 100);
        if (!locs || locs.length === 0) break;
        allLocations = allLocations.concat(locs);
        if (locs.length < 100) break; // 最后一页
        page++;
    }

    console.log(`[Background] 获取了${allLocations.length}条位置记录 for ${login}`);
    return allLocations;
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchLocations') {
        const login = request.login || 'zqian';
        fetchAllLocations(login).then(locations => {
            sendResponse({ success: true, locations: locations });
        }).catch(e => {
            sendResponse({ success: false, error: e.message });
        });
        return true; // 异步响应
    }

    if (request.action === 'getToken') {
        getToken().then(token => {
            sendResponse({ token: token });
        });
        return true;
    }
});

// 扩展启动时预获取token
getToken().then(t => {
    if (t) console.log('[Background] 启动token准备就绪');
});
