// 42 Cluster Time Tracker v7.0 — 42 API Integration
// =============================================
// Fetch complete user login history via 42 API
// SSE is only used for real-time status updates

const TARGET_TIME_MS = (3 * 60 + 42) * 60 * 1000;
let currentUserLogin = null;
let allSessions = []; // Historical sessions from 42 API
let trackerPanel = null;
let logs = [];
let apiLoaded = false;
let currentTab = 'history'; // 'history' | 'ongoing' | 'stars'
let favoritesMap = {}; // Store if host is favorited { "e1r1p1": true }

// ============ Logger System ============
function log(level, msg, data) {
    const entry = {
        time: new Date().toISOString(), level, msg,
        data: data !== undefined ? JSON.stringify(data).substring(0, 1000) : null
    };
    logs.push(entry);
    if (logs.length > 500) logs = logs.slice(-400);
    console.log(`[Tracker v7] ${msg}`, data !== undefined ? data : '');
}

log('info', '=== v7.0 Started — 42 API Integration ===');

// Restore username
try {
    const saved = localStorage.getItem('tracker_user');
    if (saved) { currentUserLogin = saved; log('info', `Restored user: ${saved}`); }
} catch (e) { }

// Restore API cache
try {
    const cached = localStorage.getItem('tracker_api_cache');
    if (cached) {
        const data = JSON.parse(cached);
        if (data.sessions && data.login) {
            allSessions = data.sessions;
            currentUserLogin = data.login;
            apiLoaded = true;
            log('info', `Restored cache: ${allSessions.length} sessions (${data.login})`);
        }
    }
} catch (e) { }

// ============ Request 42 API data via injector.js to background.js ============
function requestLocations(login) {
    return new Promise((resolve, reject) => {
        const requestId = 'req_' + Date.now();

        const handler = (event) => {
            if (event.detail.requestId === requestId) {
                window.removeEventListener('tracker_response', handler);
                if (event.detail.success) {
                    resolve(event.detail.locations);
                } else {
                    reject(new Error(event.detail.error || 'API request failed'));
                }
            }
        };
        window.addEventListener('tracker_response', handler);

        window.dispatchEvent(new CustomEvent('tracker_request', {
            detail: { action: 'fetchLocations', login, requestId }
        }));

        // Timeout
        setTimeout(() => {
            window.removeEventListener('tracker_response', handler);
            reject(new Error('Request timeout (10s)'));
        }, 10000);
    });
}

// Fetch and process location data
async function loadFromAPI(login) {
    log('info', `Fetching location history for ${login} from 42 API...`);
    updateStatus('🔄 Fetching API data...');

    try {
        const locations = await requestLocations(login);
        if (!locations || locations.length === 0) {
            log('warn', 'API returned empty data');
            updateStatus('⚠️ No historical data');
            return;
        }

        log('info', `API returned ${locations.length} location records`);

        // Convert API data to sessions format
        allSessions = locations.map(loc => ({
            host: loc.host,
            beginAt: loc.begin_at,
            endAt: loc.end_at,
            duration: loc.end_at
                ? new Date(loc.end_at).getTime() - new Date(loc.begin_at).getTime()
                : Date.now() - new Date(loc.begin_at).getTime(),
            ongoing: !loc.end_at,
            campusId: loc.campus_id
        }));

        // Reverse chronological order
        allSessions.sort((a, b) => new Date(b.beginAt) - new Date(a.beginAt));

        // Cache to localStorage
        try {
            localStorage.setItem('tracker_api_cache', JSON.stringify({
                login, sessions: allSessions, fetchedAt: new Date().toISOString()
            }));
        } catch (e) { }

        apiLoaded = true;
        log('info', `Processed: ${allSessions.length} sessions`);
        updatePageDisplay();

        // Delay adding host overlays, waiting for DOM to fully load
        // Execute in non-blocking way
        setTimeout(() => {
            addHostOverlays().then(count => {
                if (count === 0) {
                    // If none found first time, retry at intervals
                    let retries = 0;
                    const retryInterval = setInterval(() => {
                        addHostOverlays().then(r => {
                            if (r > 0 || retries++ > 6) {
                                clearInterval(retryInterval);
                                if (r > 0) log('info', `✅ Retry successful, added ${r} badges`);
                            }
                        });
                    }, 5000);
                }
            });
        }, 2000);
    } catch (e) {
        log('error', `API request failed: ${e.message}`);
        updateStatus(`❌ API Error: ${e.message}`);
    }
}

// ============ SSE Intercept (Real-time updates) ============
const OrigES = window.EventSource;
if (OrigES) {
    window.EventSource = function (url, config) {
        log('info', `EventSource: ${url}`);
        const es = new OrigES(url, config);
        const origAdd = es.addEventListener.bind(es);

        es.addEventListener = function (type, listener, options) {
            const wrapped = function (event) {
                try {
                    if (event.data && type === 'activity') {
                        const data = JSON.parse(event.data);
                        handleRealtimeActivity(data);
                    }
                } catch (e) { }
                return listener.call(this, event);
            };
            return origAdd(type, wrapped, options);
        };
        return es;
    };
    window.EventSource.prototype = OrigES.prototype;
    window.EventSource.CONNECTING = OrigES.CONNECTING;
    window.EventSource.OPEN = OrigES.OPEN;
    window.EventSource.CLOSED = OrigES.CLOSED;
}

// Handle real-time activity events (augmenting API data)
function handleRealtimeActivity(data) {
    if (!currentUserLogin || !apiLoaded) return;
    if (!Array.isArray(data)) data = [data];

    data.forEach(item => {
        if (!item.user || !item.host) return;
        const userLogin = typeof item.user === 'string' ? item.user : item.user.login;
        if (userLogin !== currentUserLogin) return;

        if (item.type === 'login') {
            // Check if session already exists
            if (!allSessions.some(s => s.host === item.host && s.beginAt === item.at)) {
                allSessions.unshift({
                    host: item.host,
                    beginAt: item.at,
                    endAt: null,
                    duration: Date.now() - new Date(item.at).getTime(),
                    ongoing: true
                });
                updatePageDisplay();
            }
        } else if (item.type === 'logout') {
            const session = allSessions.find(s =>
                s.host === item.host && s.ongoing &&
                typeof s.beginAt === 'string' && userLogin === currentUserLogin
            );
            if (session) {
                session.endAt = item.at;
                session.ongoing = false;
                session.duration = new Date(item.at).getTime() - new Date(session.beginAt).getTime();
                updatePageDisplay();
            }
        }
    });
}

// ============ UI ============
function updateStatus(text) {
    const el = document.getElementById('apiStatus');
    if (el) el.textContent = text;
}

function createTrackerPanel() {
    if (trackerPanel) return;
    trackerPanel = document.createElement('div');
    trackerPanel.className = 'cluster-tracker-panel';
    trackerPanel.innerHTML = `
        <div class="tracker-header">
            <h3>⏱️ v7 API</h3>
            <div class="tracker-controls">
                <button class="tracker-btn" id="debugDomBtn" title="Inspect DOM">🔍</button>
                <button class="tracker-btn" id="refreshApiBtn" title="Refresh API">🔄</button>
                <button class="tracker-btn" id="exportLogsBtn" title="Export Logs">📋</button>
                <button class="tracker-toggle" id="toggleBtn">−</button>
            </div>
        </div>
        <div class="tracker-content" id="trackerContent">
            <div class="tracker-info">
                <div class="user-input-section">
                    <label for="userLoginInput">👤 Login：</label>
                    <input type="text" id="userLoginInput" placeholder="login" value="${currentUserLogin || ''}" />
                    <button id="setUserBtn" class="set-user-btn">Get</button>
                </div>
                <div id="apiStatus" style="color:#80d8ff;font-size:12px;margin-top:4px;">
                    ${apiLoaded ? `✅ ${allSessions.length} records loaded` : '⏳ Enter login and click "Get"'}
                </div>
                <div id="currentUserDisplay"></div>
                <div id="todayStats" style="margin-top:8px;"></div>
                
                <!-- Tabs -->
                <div class="tracker-tabs" style="display:flex;margin:10px 0 5px 0;background:rgba(0,0,0,0.2);border-radius:6px;padding:3px;">
                    <button class="tracker-tab active" data-tab="history" style="flex:1;background:transparent;border:none;color:white;padding:5px;cursor:pointer;border-radius:4px;font-size:12px;transition:0.2s;">📅 History</button>
                    <button class="tracker-tab" data-tab="ongoing" style="flex:1;background:transparent;border:none;color:rgba(255,255,255,0.6);padding:5px;cursor:pointer;border-radius:4px;font-size:12px;transition:0.2s;">⏳ Ongoing</button>
                    <button class="tracker-tab" data-tab="stars" style="flex:1;background:transparent;border:none;color:rgba(255,255,255,0.6);padding:5px;cursor:pointer;border-radius:4px;font-size:12px;transition:0.2s;">⭐ Stars</button>
                </div>
            </div>
            <div class="tracker-sessions" id="trackerSessions">
                <p style="text-align:center;color:rgba(255,255,255,0.7);padding:20px;">
                    ${apiLoaded ? 'Loading...' : 'Waiting for API data...'}
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(trackerPanel);

    // Styles for tabs
    const style = document.createElement('style');
    style.textContent = `
        .tracker-tab.active { background: rgba(255,255,255,0.1) !important; color: #fff !important; font-weight: bold; }
        .tracker-tab:hover { background: rgba(255,255,255,0.05); }
    `;
    document.head.appendChild(style);

    document.getElementById('toggleBtn').addEventListener('click', () => {
        const c = document.getElementById('trackerContent');
        const b = document.getElementById('toggleBtn');
        c.classList.toggle('collapsed');
        b.textContent = c.classList.contains('collapsed') ? '+' : '−';
    });
    document.getElementById('debugDomBtn').addEventListener('click', debugDOM);
    document.getElementById('refreshApiBtn').addEventListener('click', () => {
        if (currentUserLogin) loadFromAPI(currentUserLogin);
    });
    document.getElementById('exportLogsBtn').addEventListener('click', exportLogs);
    document.getElementById('setUserBtn').addEventListener('click', setUser);
    document.getElementById('userLoginInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') setUser();
    });

    // Tab Event Listeners
    document.querySelectorAll('.tracker-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tracker-tab').forEach(b => {
        const active = b.dataset.tab === tab;
        b.classList.toggle('active', active);
        b.style.color = active ? 'white' : 'rgba(255,255,255,0.6)';
    });
    updatePageDisplay();
}


function debugDOM() {
    console.clear();
    log('info', '🔍 DOM debug info logged to console');
    console.log('=== 🔍 DOM Debug Tool ===');
    console.log('DOM debug info logged.');
}

function setUser() {
    const v = document.getElementById('userLoginInput').value.trim();
    if (v) {
        currentUserLogin = v;
        log('info', `Set user: ${v}`);
        try { localStorage.setItem('tracker_user', v); } catch (e) { }
        loadFromAPI(v);
    }
}

function exportLogs() {
    const data = {
        exportTime: new Date().toISOString(),
        version: 'v7.0',
        currentUser: currentUserLogin,
        sessionsCount: allSessions.length,
        sessions: allSessions,
        logs
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tracker_v7_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
}

function updatePageDisplay() {
    if (!trackerPanel) createTrackerPanel();
    const ud = document.getElementById('currentUserDisplay');
    const ts = document.getElementById('todayStats');
    const sc = document.getElementById('trackerSessions');
    const as = document.getElementById('apiStatus');

    if (!ud || !sc) return;

    ud.innerHTML = currentUserLogin
        ? `<strong>👤 ${currentUserLogin}</strong> | ${allSessions.length} sessions`
        : `<span style="color:#ffcc80;">⚠️ Please enter login</span>`;

    if (as) as.textContent = apiLoaded ? `✅ ${allSessions.length} records loaded` : '⏳ Waiting...';

    // ===== Today's Stats =====
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todaySessions = allSessions.filter(s => new Date(s.beginAt) >= todayStart);
    let todayTotal = 0;
    todaySessions.forEach(s => {
        todayTotal += s.ongoing
            ? Date.now() - new Date(s.beginAt).getTime()
            : (s.duration || 0);
    });
    const todayPct = Math.min((todayTotal / TARGET_TIME_MS) * 100, 100);
    const todayStar = todayTotal >= TARGET_TIME_MS;

    ts.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>📅 Today: ${fmtD(todayTotal)}</strong>
            <span>${todayStar ? '⭐ Earned!' : `Needs ${fmtD(TARGET_TIME_MS - todayTotal)}`}</span>
        </div>
        <div class="progress-bar" style="margin-top:4px;">
            <div class="progress-fill" style="width:${todayPct}%;${todayStar ? 'background:linear-gradient(90deg,#ffd700,#ff8c00);' : ''}"></div>
        </div>
    `;

    // Render content based on tab
    if (currentTab === 'stars') {
        renderStars(sc);
    } else if (currentTab === 'ongoing') {
        renderOngoing(sc);
    } else {
        renderHistory(sc, todayStar); // Pass todayStar for styling
    }
}

function renderHistory(sc, todayStar) {
    if (allSessions.length === 0) {
        sc.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.7);padding:20px;">
            ${apiLoaded ? 'No records' : 'Enter login and click "Get"'}
        </p>`;
        return;
    }

    // ===== Group sessions by day =====
    const dayMap = {};
    allSessions.forEach(s => {
        const day = new Date(s.beginAt).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric'
        });
        if (!dayMap[day]) dayMap[day] = { sessions: [], total: 0, date: new Date(s.beginAt) };
        dayMap[day].sessions.push(s);
        dayMap[day].total += s.ongoing
            ? Date.now() - new Date(s.beginAt).getTime()
            : (s.duration || 0);
    });

    let html = '';
    const days = Object.entries(dayMap)
        .sort(([, a], [, b]) => b.date - a.date)
        .slice(0, 30); // Last 30 days

    days.forEach(([day, info]) => {
        const dayPct = Math.min((info.total / TARGET_TIME_MS) * 100, 100);
        const star = info.total >= TARGET_TIME_MS;

        html += `
            <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                    <strong style="color:${star ? '#ffd700' : 'rgba(255,255,255,0.9)'};">
                        ${star ? '⭐' : '📅'} ${day}
                    </strong>
                    <span style="color:${star ? '#ffd700' : 'rgba(255,255,255,0.7)'};">
                        ${fmtD(info.total)}
                    </span>
                </div>
                <div class="progress-bar" style="height:4px;margin-bottom:4px;">
                    <div class="progress-fill" style="width:${dayPct}%;${star ? 'background:linear-gradient(90deg,#ffd700,#ff8c00);' : ''}"></div>
                </div>`;

        info.sessions.forEach(s => {
            const begin = new Date(s.beginAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const end = s.ongoing ? 'Online' : new Date(s.endAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dur = fmtD(s.ongoing ? Date.now() - new Date(s.beginAt).getTime() : s.duration);

            html += `
                <div class="session-item" style="padding:4px 8px;margin-bottom:2px;">
                    <div class="session-header">
                        <span class="host-name">🖥️ ${s.host}</span>
                        <span style="color:rgba(255,255,255,0.6);font-size:11px;">${begin} → ${end}</span>
                        <span class="status-badge ${s.ongoing ? 'ongoing' : ''}">${s.ongoing ? '● Online' : dur}</span>
                    </div>
                </div>`;
        });

        html += `</div>`;
    });

    sc.innerHTML = html;
}

function renderOngoing(sc) {
    // Calculate total time per host
    const hostTotals = {};
    allSessions.forEach(s => {
        if (!hostTotals[s.host]) hostTotals[s.host] = 0;
        hostTotals[s.host] += s.ongoing
            ? Date.now() - new Date(s.beginAt).getTime()
            : (s.duration || 0);
    });

    // Filter: 0 < time < TARGET_TIME_MS
    let ongoing = Object.entries(hostTotals)
        .filter(([, total]) => total > 0 && total < TARGET_TIME_MS)
        .map(([host, total]) => ({ host, total }))
        .sort((a, b) => b.total - a.total);

    if (ongoing.length === 0) {
        sc.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.7);padding:20px;">
            No ongoing sessions
        </p>`;
        return;
    }

    let html = `<div style="padding:4px;">
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:10px;text-align:center;">
            ⏳ ${ongoing.length} hosts in progress
        </div>`;

    ongoing.forEach(q => {
        const pct = Math.min((q.total / TARGET_TIME_MS) * 100, 100);
        const remaining = TARGET_TIME_MS - q.total;

        html += `
            <div class="session-item" style="padding:8px;margin-bottom:8px;border-left:3px solid #ff9800;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="host-name" style="font-size:14px;">🖥️ ${q.host}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#ff9800;font-weight:bold;">${fmtD(q.total)}</span>
                        <div style="font-size:10px;color:rgba(255,255,255,0.4);">Needs ${fmtD(remaining)}</div>
                    </div>
                </div>
                <div class="progress-bar" style="height:3px;margin-top:6px;background:rgba(255,255,255,0.1);">
                    <div class="progress-fill" style="width:${pct}%;background:#ff9800;"></div>
                </div>
            </div>`;
    });

    html += `</div>`;
    sc.innerHTML = html;
}

function renderStars(sc) {
    if (allSessions.length === 0) {
        sc.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.7);padding:20px;">
            No data available
        </p>`;
        return;
    }

    // Calculate total time per host
    const hostTotals = {};
    allSessions.forEach(s => {
        if (!hostTotals[s.host]) hostTotals[s.host] = 0;
        hostTotals[s.host] += s.ongoing
            ? Date.now() - new Date(s.beginAt).getTime()
            : (s.duration || 0);
    });

    // Filter and sort
    let qualified = Object.entries(hostTotals)
        .filter(([, total]) => total >= TARGET_TIME_MS)
        .map(([host, total]) => ({ host, total, isFav: !!favoritesMap[host] }))
        .sort((a, b) => b.total - a.total);

    if (qualified.length === 0) {
        sc.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.7);padding:20px;">
            No host has reached 3h42m yet. Keep going! 🚀
        </p>`;
        return;
    }

    // Grouping: unfavorited (priority) and favorited
    const todo = qualified.filter(q => !q.isFav);
    const done = qualified.filter(q => q.isFav);

    let html = `<div style="padding:4px;">
        <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:10px;text-align:center;">
            🏆 ${qualified.length} hosts completed
        </div>`;

    // Render function
    const renderItem = (q, type) => {
        const isTodo = type === 'todo';
        return `
            <div class="session-item" style="padding:8px;margin-bottom:6px;border-left:3px solid ${isTodo ? '#ff5722' : '#4caf50'};background:${isTodo ? 'rgba(255,87,34,0.1)' : 'rgba(255,255,255,0.05)'}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="host-name" style="font-size:14px;">${q.host}</span>
                        ${isTodo ? '<span style="background:#ff5722;color:white;font-size:10px;padding:1px 4px;border-radius:3px;font-weight:bold;">To Star</span>' : '<span style="color:#ffd700;">⭐</span>'}
                    </div>
                    <span style="color:${isTodo ? '#ff5722' : '#4caf50'};font-weight:bold;">${fmtD(q.total)}</span>
                </div>
                <div style="margin-top:4px;font-size:11px;color:rgba(255,255,255,0.5);">
                    ${isTodo ? 'Completed, please star it on the map!' : 'Stared'}
                </div>
            </div>`;
    };

    if (todo.length > 0) {
        html += `<div style="margin-bottom:15px;"><div style="font-size:11px;color:#ff5722;margin-bottom:5px;font-weight:bold;">🔥 Pending (${todo.length})</div>`;
        todo.forEach(q => html += renderItem(q, 'todo'));
        html += `</div>`;
    }

    if (done.length > 0) {
        html += `<div><div style="font-size:11px;color:#4caf50;margin-bottom:5px;font-weight:bold;">✅ Done (${done.length})</div>`;
        done.forEach(q => html += renderItem(q, 'done'));
        html += `</div>`;
    }

    html += `</div>`;
    sc.innerHTML = html;
}


function fmtD(ms) {
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
}

// ==== Host grid overlay render (Non-blocking optimized) ====
let isOverlayProcessing = false;

function addHostOverlays() {
    if (!apiLoaded || allSessions.length === 0) return Promise.resolve(0);
    if (isOverlayProcessing) return Promise.resolve(0); // Prevent re-entry

    isOverlayProcessing = true;

    // Calculate total time per host
    const hostTotals = {};
    allSessions.forEach(s => {
        if (!hostTotals[s.host]) hostTotals[s.host] = 0;
        hostTotals[s.host] += s.ongoing
            ? Date.now() - new Date(s.beginAt).getTime()
            : (s.duration || 0);
    });

    // Find all host elements (class contains host)
    const machineEls = document.querySelectorAll('.host');
    const hostnameEls = Array.from(machineEls).filter(el => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return /z\d+r\d+p\d+/.test(text);
    });

    log('info', `Found ${hostnameEls.length} host elements (.host)`);

    return new Promise((resolve) => {
        let successCount = 0;
        let index = 0;

        function processChunk() {
            const start = performance.now();
            while (index < hostnameEls.length && performance.now() - start < 15) { // Max 15ms per chunk
                const el = hostnameEls[index++];

                // Extract hostname
                const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                const match = text.match(/z\d+r\d+p\d+/);
                const hostName = match ? match[0] : null;

                if (!hostName) continue;

                // === Detect if already starred (yellow text or icon) ===
                const html = el.innerHTML;
                if (html.includes('text-yellow') || html.includes('text-amber') || html.includes('text-orange')) {
                    favoritesMap[hostName] = true;
                }

                if (!hostTotals[hostName]) continue;

                // Check if badge already exists
                if (el.querySelector('.tracker-host-badge')) {
                    successCount++;
                    continue;
                }

                const totalMs = hostTotals[hostName];
                const hours = totalMs / 3600000;

                // Color code (3h42m = TARGET_TIME_MS)
                let bgColor = '#4caf50'; // Green: <2h
                if (totalMs >= TARGET_TIME_MS) bgColor = '#ff5722'; // Red: >= 3h42m (completed)
                else if (hours >= 2) bgColor = '#ff9800'; // Orange: 2h <= x < 3h42m

                // Create badge
                const badge = document.createElement('div');
                badge.className = 'tracker-host-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    background: ${bgColor};
                    color: white;
                    font-size: 9px;
                    font-weight: bold;
                    padding: 2px 4px;
                    border-radius: 3px;
                    z-index: 1000;
                    pointer-events: none;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                `;
                badge.textContent = hours >= 1 ? `${hours.toFixed(1)}h` : `${Math.round(hours * 60)}m`;

                // Set parent position to relative
                const style = window.getComputedStyle(el);
                if (style.position === 'static') {
                    el.style.position = 'relative';
                }

                el.appendChild(badge);
                successCount++;
            }

            if (index < hostnameEls.length) {
                requestAnimationFrame(processChunk);
            } else {
                isOverlayProcessing = false;
                if (successCount > 0) {
                    log('info', `✅ Host grid overlay applied: ${successCount} badges`);
                    updatePageDisplay(); // Refresh display to update star status
                }
                resolve(successCount);
            }
        }

        requestAnimationFrame(processChunk);
    });
}

// ============ Startup ============
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    createTrackerPanel();
    if (apiLoaded) {
        updatePageDisplay();
        // Attempt once on initialization
        setTimeout(() => addHostOverlays(), 1000);
    } else if (currentUserLogin) {
        // Auto-load
        setTimeout(() => loadFromAPI(currentUserLogin), 1000);
    }

    // Refresh display every minute (update ongoing sessions)
    setInterval(() => {
        if (allSessions.some(s => s.ongoing)) {
            updatePageDisplay();
        }
    }, 60000);

    // Watch DOM changes, Matrix might dynamic load hosts
    const observer = new MutationObserver(() => {
        if (apiLoaded && !isOverlayProcessing) {
            // Debounce
            if (window.overlayTimeout) clearTimeout(window.overlayTimeout);
            window.overlayTimeout = setTimeout(() => addHostOverlays(), 500);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

log('info', '=== v7.0 Initialization complete ===');
