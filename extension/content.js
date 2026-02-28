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
let favoritesMap = {};
try {
    favoritesMap = JSON.parse(localStorage.getItem('tracker_stars') || '{}');
} catch (e) {
    favoritesMap = {};
}
let showAvailabilityColors = true; // Toggle for green/red host backgrounds
let colorsRefreshInterval = null;

// Helper to start the refresh loop
function startColorsLoop() {
    if (colorsRefreshInterval) clearInterval(colorsRefreshInterval);
    colorsRefreshInterval = setInterval(() => {
        if (showAvailabilityColors) applyAvailabilityColors();
    }, 5 * 60 * 1000);
}

// Restore user preference if saved
try {
    const savedColors = localStorage.getItem('tracker_show_colors');
    if (savedColors !== null) showAvailabilityColors = savedColors === 'true';
} catch (e) { }

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

// ============ Feature 5: Auto-detect logged-in user from DOM ============
function getStudentLoginFromDOM() {
    // Try 42 Intra pages: <a class="login" data-login="...">
    const intraLogin = document.querySelector('.login[data-login]');
    if (intraLogin) return intraLogin.getAttribute('data-login');
    // Try Matrix pages: <h2> in user-infos block
    const matrixLogin = document.querySelector('.user-infos h2');
    if (matrixLogin) return matrixLogin.innerText.trim();
    return null;
}

// Restore API cache (only if it matches the saved user)
try {
    const cached = localStorage.getItem('tracker_api_cache');
    if (cached) {
        const data = JSON.parse(cached);
        if (data.sessions && data.login) {
            // Only use cache if it matches the currently saved user
            if (!currentUserLogin || data.login === currentUserLogin) {
                allSessions = data.sessions;
                currentUserLogin = data.login;
                apiLoaded = true;
                log('info', `Restored cache: ${allSessions.length} sessions (${data.login})`);
            } else {
                log('info', `Cache login (${data.login}) != saved user (${currentUserLogin}), ignoring cache`);
            }
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

        // Allow up to 90s for the sequential fetch to finish (handling 42 API limits)
        setTimeout(() => {
            window.removeEventListener('tracker_response', handler);
            reject(new Error('Request timeout (90s)'));
        }, 90000);
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
        setTimeout(() => {
            addHostOverlays().then(count => {
                if (count === 0) {
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

        // --- SMART FALLBACK ---
        // If 42 API is down, try to rescue the session data from local cache
        try {
            const cached = localStorage.getItem('tracker_api_cache');
            if (cached) {
                const data = JSON.parse(cached);
                if (data.login === login && data.sessions) {
                    allSessions = data.sessions;
                    apiLoaded = true;
                    log('info', `✅ Recovered ${allSessions.length} sessions from cache due to API failure`);
                    updatePageDisplay();

                    // Delay adding host overlays, waiting for DOM to fully load
                    setTimeout(() => {
                        addHostOverlays();
                    }, 500);
                }
            }
        } catch (err) { }
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
            <h3 style="text-align: center; width: 100%;">⏱️ Catch 'Em All</h3>
            <div class="tracker-controls" style="display: flex; justify-content: center; flex-wrap: wrap;">
                <button class="tracker-btn" id="debugDomBtn" title="Inspect DOM">🔍</button>
                <button class="tracker-btn" id="refreshApiBtn" title="Refresh API">🔄</button>
                <button class="tracker-btn" id="exportLogsBtn" title="Export Logs">📋</button>
                <button class="tracker-btn" id="colorToggleBtn" title="Toggle Colors" style="font-weight:bold; ${showAvailabilityColors ? 'color:#4caf50' : 'color:#555'};">🎨</button>
                <button class="tracker-toggle" id="toggleBtn">−</button>
            </div>
        </div>
        <div class="tracker-content" id="trackerContent">
            <div class="tracker-info">
                <div class="user-input-section">
                    <label for="userLoginInput">User:</label>
                    <input type="text" id="userLoginInput" placeholder="login" value="${currentUserLogin || ''}" />
                    <button id="setUserBtn" class="set-user-btn">Get</button>
                </div>
                <div id="apiStatus" style="font-weight:bold;font-size:12px;margin-top:4px;">
                    ${apiLoaded ? `✅ ${allSessions.length} records loaded` : '⏳ Enter login'}
                </div>
                <div id="currentUserDisplay"></div>
                <div id="todayStats" style="margin-top:8px;"></div>
                
                <!-- Tabs -->
                <div class="tracker-tabs">
                    <button class="tracker-tab active" data-tab="history">📅 History</button>
                    <button class="tracker-tab" data-tab="stars">⭐ Stars</button>
                </div>
            </div>
            <div class="tracker-sessions" id="trackerSessions">
                <p style="text-align:center;font-weight:bold;padding:20px;">
                    ${apiLoaded ? 'Loading...' : 'Waiting for API data...'}
                </p>
            </div>
        </div>
    `;
    document.body.appendChild(trackerPanel);

    // Direct CSS injection for Matrix Grid overrides (avoids extension caching issues)
    const style = document.createElement('style');
    style.textContent = `
        /* Remove native hover effects if they interfere */
        .retro-fav-host {
            z-index: 10 !important;
        }
        .retro-fav-host:hover {
            z-index: 50 !important;
        }
        /* Style the star to pop and move it down slightly */
        .retro-fav-host svg[data-icon="star"],
        .retro-fav-host .text-yellow-400,
        .retro-fav-host .text-amber-400 {
            color: #ffca28 !important;
            filter: drop-shadow(2px 2px 0px #000) !important;
            transform: translateY(6px) scale(1.3) !important;
            z-index: 20 !important;
            position: relative;
        }
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

    document.getElementById('colorToggleBtn').addEventListener('click', (e) => {
        showAvailabilityColors = !showAvailabilityColors;
        try { localStorage.setItem('tracker_show_colors', showAvailabilityColors.toString()); } catch (e) { }

        e.target.style.color = showAvailabilityColors ? '#4caf50' : '#555';
        console.log('[Colors] Toggle clicked, showAvailabilityColors =', showAvailabilityColors);

        if (showAvailabilityColors) {
            applyAvailabilityColors().catch(err => console.error('[Colors] Toggle error:', err));
            startColorsLoop();
        } else {
            clearAvailabilityColors();
            if (colorsRefreshInterval) clearInterval(colorsRefreshInterval);
        }
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

    // Make the panel Draggable
    setupDraggablePanel(trackerPanel);
}

function setupDraggablePanel(panel) {
    const header = panel.querySelector('.tracker-header');
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panelStartX = 0;
    let panelStartY = 0;

    header.addEventListener('mousedown', (e) => {
        // Prevent dragging if clicking a button
        if (e.target.closest('button')) return;

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        // Ensure we calculate from top/left rather than bottom/right to avoid glitching
        const rect = panel.getBoundingClientRect();
        panel.style.left = rect.left + 'px';
        panel.style.top = rect.top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.margin = '0px';

        panelStartX = rect.left;
        panelStartY = rect.top;

        panel.style.opacity = '0.9';
        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // Prevent default text selection during drag
        e.preventDefault();

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        panel.style.left = (panelStartX + dx) + 'px';
        panel.style.top = (panelStartY + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            panel.style.opacity = '1';
            header.style.cursor = 'grab';

            // === Magnetic Snap to Edge ===
            const SNAP_THRESHOLD = 40; // pixels from edge to trigger snap
            const rect = panel.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            let newLeft = rect.left;
            let newTop = rect.top;

            // Snap horizontally
            if (rect.left < SNAP_THRESHOLD) {
                newLeft = 0; // Snap to left edge
            } else if (vw - rect.right < SNAP_THRESHOLD) {
                newLeft = vw - rect.width; // Snap to right edge
            }

            // Snap vertically
            if (rect.top < SNAP_THRESHOLD) {
                newTop = 0; // Snap to top edge
            } else if (vh - rect.bottom < SNAP_THRESHOLD) {
                newTop = vh - rect.height; // Snap to bottom edge
            }

            // Apply with smooth transition
            panel.style.transition = 'left 0.15s ease, top 0.15s ease';
            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';

            // Remove transition after animation so drag feels instantaneous again
            setTimeout(() => { panel.style.transition = ''; }, 200);
        }
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tracker-tab').forEach(b => {
        const active = b.dataset.tab === tab;
        b.classList.toggle('active', active);
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
        // Clear old data before switching user
        allSessions = [];
        apiLoaded = false;
        // Do not clear favoritesMap here so it persists across reloads
        currentUserLogin = v;
        log('info', `Set user: ${v}`);
        try {
            localStorage.setItem('tracker_user', v);
            // DO NOT delete the tracker_api_cache here yet!
            // Wait for the API request to succeed or fail first.
        } catch (e) { }
        updatePageDisplay(); // Show empty state immediately
        loadFromAPI(v);
    }
}

function exportLogs() {
    const data = {
        exportTime: new Date().toISOString(),
        version: 'v7.0',
        currentUser: currentUserLogin,
        sessionsCount: allSessions.length,
        targetTimeMs: TARGET_TIME_MS,
        targetTimeFormatted: "3h42m",
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
        : `<span style="color:#d32f2f;font-weight:bold;">⚠️ Please enter login</span>`;

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
            <span style="font-weight:bold; color:#d32f2f;">${todayStar ? '⭐ Earned!' : `Needs ${fmtD(TARGET_TIME_MS - todayTotal)}`}</span>
        </div>
        <div class="progress-bar">
            <div class="progress-fill ${todayStar ? 'star' : ''}" style="width:${todayPct}%;"></div>
        </div>
    `;

    // Save scroll position
    const currentScroll = sc.scrollTop;

    // Render content based on tab
    if (currentTab === 'stars') {
        renderStars(sc);
    } else {
        renderHistory(sc, todayStar); // Pass todayStar for styling
    }

    // Restore scroll position
    sc.scrollTop = currentScroll;

    // Attach click listeners for manual star toggling
    document.querySelectorAll('.manual-star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Stop from also triggering locate logic
            e.stopPropagation();
            const h = e.currentTarget.dataset.host;
            const action = e.currentTarget.dataset.action;
            if (h) {
                if (action === 'add') {
                    favoritesMap[h] = true;
                } else if (action === 'remove') {
                    delete favoritesMap[h];
                }
                try { localStorage.setItem('tracker_stars', JSON.stringify(favoritesMap)); } catch (err) { }
                updatePageDisplay();
            }
        });
    });

    // Attach click listeners for locate-on-map
    document.querySelectorAll('[data-locate]').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger locate if they clicked the star/unstar button
            if (e.target.closest('.manual-star-btn')) return;
            const h = card.dataset.locate;
            if (h) locateOnMap(h);
        });
    });
}

function renderHistory(sc, todayStar) {
    if (allSessions.length === 0) {
        sc.innerHTML = `<p style="text-align:center;font-weight:bold;padding:20px;">
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
        .slice(0, 1000); // Last 1000 days

    days.forEach(([day, info]) => {
        const dayPct = Math.min((info.total / TARGET_TIME_MS) * 100, 100);
        const star = info.total >= TARGET_TIME_MS;

        html += `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-weight:800;text-transform:uppercase;">
                    <span style="color:${star ? '#ff5252' : '#000'};">
                        ${star ? '⭐' : '📅'} ${day}
                    </span>
                    <span>
                        ${fmtD(info.total)}
                    </span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill ${star ? 'star' : ''}" style="width:${dayPct}%;"></div>
                </div>`;

        info.sessions.forEach(s => {
            const begin = new Date(s.beginAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const end = s.ongoing ? 'Online' : new Date(s.endAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            const dur = fmtD(s.ongoing ? Date.now() - new Date(s.beginAt).getTime() : s.duration);

            html += `
                <div class="session-item">
                    <div class="session-header">
                        <span class="host-name">🖥️ ${s.host}</span>
                        <span class="status-badge ${s.ongoing ? 'ongoing' : ''}">${s.ongoing ? '● Online' : dur}</span>
                    </div>
                    <div style="font-weight:800; font-size:12px; color:#555;">${begin} → ${end}</div>
                </div>`;
        });

        html += `</div>`;
    });

    sc.innerHTML = html;
}


function renderStars(sc) {
    if (allSessions.length === 0) {
        sc.innerHTML = `<p style="text-align:center;font-weight:bold;padding:20px;">
            No data available
        </p>`;
        return;
    }

    // Calculate total time per host (with interval merging + floor filter)
    const hostTotals = calcHostTotals(allSessions);

    if (Object.keys(hostTotals).length === 0) {
        sc.innerHTML = `<p style="text-align:center;font-weight:bold;padding:20px;">
            No data for this floor yet. Switch floors if needed.
        </p>`;
        return;
    }

    // --- 1. Processing Ongoing (0 < total < TARGET) ---
    let ongoing = Object.entries(hostTotals)
        .filter(([, total]) => total > 0 && total < TARGET_TIME_MS)
        .map(([host, total]) => ({ host, total }))
        .sort((a, b) => b.total - a.total);

    // --- 2. Processing Qualified (total >= TARGET) ---
    let qualified = Object.entries(hostTotals)
        .filter(([, total]) => total >= TARGET_TIME_MS)
        .map(([host, total]) => ({ host, total, isFav: !!favoritesMap[host] }))
        .sort((a, b) => b.total - a.total);

    const todo = qualified.filter(q => !q.isFav);
    const done = qualified.filter(q => q.isFav);

    if (ongoing.length === 0 && qualified.length === 0) {
        sc.innerHTML = `<p style="text-align:center;font-weight:bold;padding:20px;">
            No ongoing or starred sessions yet. Keep going! 🚀
        </p>`;
        return;
    }

    let html = `<div>`;

    // Render function for qualified items
    const renderQualifiedItem = (q, isTodo) => {
        return `
            <div class="session-item" data-locate="${q.host}" style="cursor:pointer;${isTodo ? 'background-color:#ffab91;' : 'background-color:#a5d6a7;'}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        <span class="host-name">${q.host}</span>
                        ${isTodo
                ? `<span class="status-badge manual-star-btn" data-action="add" data-host="${q.host}" style="background:#ff5252;color:#fff;cursor:pointer;" title="Click to manually mark as STARRED">To Star</span>`
                : `<span class="manual-star-btn" data-action="remove" data-host="${q.host}" style="font-size:18px;cursor:pointer;" title="Click to UN-STAR (Mistake?)">⭐</span>`}
                    </div>
                    <span style="font-weight:800;font-size:16px;color:#000;">${fmtD(q.total)}</span>
                </div>
                <div style="margin-top:8px;font-size:12px;font-weight:800;text-transform:uppercase;color:#555;">
                    ${isTodo ? '📍 Click card to locate | Click TO STAR to mark done' : 'Starred • 📍 Click to locate'}
                </div>
            </div>`;
    };

    // ------------- Section 1: Needs Star (Actionable First) -------------
    if (todo.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:900;color:#000;text-transform:uppercase;margin-bottom:12px;text-align:center;border-bottom:2px solid #000;padding-bottom:4px;">
                🔥 Needs Star (${todo.length})
            </div>`;
        todo.forEach(q => html += renderQualifiedItem(q, true));
        html += `</div>`;
    }

    // ------------- Section 2: Ongoing (Collecting Time) -------------
    if (ongoing.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:900;color:#000;text-transform:uppercase;margin-bottom:12px;text-align:center;border-bottom:2px solid #000;padding-bottom:4px;">
                ⏳ Collecting Time (${ongoing.length})
            </div>`;

        ongoing.forEach(q => {
            const pct = Math.min((q.total / TARGET_TIME_MS) * 100, 100);
            const remaining = TARGET_TIME_MS - q.total;

            html += `
                <div class="session-item" data-locate="${q.host}" style="cursor:pointer;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span class="host-name">🖥️ ${q.host}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="color:#000;font-weight:800;font-size:16px;">${fmtD(q.total)}</span>
                            <div style="font-size:11px;font-weight:800;color:#ff5252;">Needs ${fmtD(remaining)}</div>
                        </div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${pct}%;background-color:#81d4fa !important;"></div>
                    </div>
                    <div style="margin-top:4px;font-size:11px;font-weight:800;text-transform:uppercase;color:#555;">📍 Click to locate on map</div>
                </div>`;
        });
        html += `</div>`;
    }

    // ------------- Section 3: Starred (Completed Last) -------------
    if (done.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <div style="font-size:14px;font-weight:900;color:#000;text-transform:uppercase;margin-bottom:12px;text-align:center;border-bottom:2px solid #000;padding-bottom:4px;">
                ✅ Starred (${done.length})
            </div>`;
        done.forEach(q => html += renderQualifiedItem(q, false));
        html += `</div>`;
    }

    html += `</div>`;
    sc.innerHTML = html;
}


// ============ Feature 1: Interval Merging + Feature 2: Floor Filter ============
// Returns merged total time (ms) per host, filtered to the currently visible cluster floor
function calcHostTotals(sessions) {
    // Feature 2: auto-detect which cluster pair is currently visible
    const onFloor1 = document.querySelector('#z2r2p6') !== null;
    const cluster1 = onFloor1 ? 'z1' : 'z3';
    const cluster2 = onFloor1 ? 'z2' : 'z4';

    // Group sessions by host, filtered to the visible floor
    const sessionsByHost = {};
    sessions.forEach(s => {
        const h = (s.host || '').toLowerCase();
        if (!h.startsWith(cluster1) && !h.startsWith(cluster2)) return;
        if (!sessionsByHost[h]) sessionsByHost[h] = [];
        const start = new Date(s.beginAt).getTime();
        const end = s.ongoing ? Date.now() : new Date(s.endAt).getTime();
        sessionsByHost[h].push({ start, end });
    });

    // Feature 1: merge overlapping intervals per host
    const totals = {};
    for (const host in sessionsByHost) {
        const intervals = sessionsByHost[host].sort((a, b) => a.start - b.start);
        const merged = [{ ...intervals[0] }];
        for (let i = 1; i < intervals.length; i++) {
            const last = merged[merged.length - 1];
            if (intervals[i].start <= last.end) {
                last.end = Math.max(last.end, intervals[i].end);
            } else {
                merged.push({ ...intervals[i] });
            }
        }
        totals[host] = merged.reduce((acc, iv) => acc + (iv.end - iv.start), 0);
    }
    return totals;
}

function fmtD(ms) {
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
}

// ============ Click-to-Locate: Jump to machine on map (Style A: Comic Starburst) ============
function locateOnMap(hostName) {
    // Try direct ID match first (e.g. #z2r8p2)
    let el = document.getElementById(hostName);

    // Fallback: search all host cards for one containing the text
    if (!el) {
        const allCards = document.querySelectorAll('div[data-slot="card"].host, .host');
        el = Array.from(allCards).find(card => {
            const id = card.id || '';
            const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
            return id.toLowerCase() === hostName.toLowerCase() || text.toLowerCase().includes(hostName.toLowerCase());
        }) || null;
    }

    if (!el) {
        log('warn', `locateOnMap: could not find DOM element for ${hostName}`);
        return;
    }

    // Smooth scroll to element center
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    // ============ Advanced Card Lift Animation (Scroll-Aware) ============

    // Run animation ONLY when the element actually scrolls into view
    // (fixes issue where clicking a far machine ran the animation while still scrolling)
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            observer.disconnect();

            // 1. Card Lift & Spin & Slam
            el.classList.remove('tracker-locate-lift-advanced');
            void el.offsetWidth; // force reflow
            el.classList.add('tracker-locate-lift-advanced');

            // Remove class after animation
            setTimeout(() => el.classList.remove('tracker-locate-lift-advanced'), 1400);

            // 2. Dust Particles Effect (Triggered at 63% of 1.4s = ~882ms)
            setTimeout(() => {
                // Spawn Dust Particles (Increased to 22 for big explosion)
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const bottomY = rect.bottom - 4; // Slightly up from very bottom

                for (let i = 0; i < 22; i++) {
                    const dust = document.createElement('div');
                    dust.className = 'tracker-dust-particle';

                    // Randomize trajectory (wider spread)
                    const angle = Math.random() * Math.PI; // Upper half
                    const distance = 40 + Math.random() * 120; // 40px to 160px travel
                    const dx = Math.cos(angle) * distance;
                    const dy = -Math.sin(angle) * distance - 20; // Upwards bias

                    // Randomize size slightly
                    const size = 10 + Math.random() * 10; // 10-20px
                    dust.style.width = `${size}px`;
                    dust.style.height = `${size}px`;

                    dust.style.left = `${centerX - (size / 2)}px`;
                    dust.style.top = `${bottomY - (size / 2)}px`;
                    dust.style.setProperty('--dx', `${dx}px`);
                    dust.style.setProperty('--dy', `${dy}px`);

                    // Randomize animation duration
                    const dur = 0.4 + Math.random() * 0.5;
                    dust.style.animation = `tracker-dust-fly ${dur}s cubic-bezier(0.25, 1, 0.5, 1) forwards`;

                    document.body.appendChild(dust);
                    setTimeout(() => dust.remove(), dur * 1000);
                }
            }, 882); // 1.4s * 0.63 (impact point)

            log('info', `📍 Located ${hostName} on map (Scroll-aware, Advanced Lift)`);
        }
    }, { threshold: 0.5 }); // Trigger when at least 50% visible

    // Start observing the element immediately
    observer.observe(el);
}

// ==== Host grid overlay render (Non-blocking optimized) ====
let isOverlayProcessing = false;

let _colorObserver = null;
let _activeHostsCache = null; // Cache the API result

// Request campus status via the event relay (MAIN world → injector → background)
function requestCampusStatus() {
    return new Promise((resolve, reject) => {
        const requestId = 'campus_' + Date.now() + '_' + Math.random();
        const handler = (event) => {
            if (event.detail.requestId === requestId) {
                window.removeEventListener('tracker_response', handler);
                if (event.detail.success) {
                    resolve(event.detail.data);
                } else {
                    reject(new Error(event.detail.error || 'Campus status request failed'));
                }
            }
        };
        window.addEventListener('tracker_response', handler);

        window.dispatchEvent(new CustomEvent('tracker_request', {
            detail: { action: 'fetchCampusStatus', requestId }
        }));

        setTimeout(() => {
            window.removeEventListener('tracker_response', handler);
            reject(new Error('Campus status request timeout (30s)'));
        }, 30000);
    });
}

async function applyAvailabilityColors() {
    if (!showAvailabilityColors) return;

    console.log('[Colors] Fetching active campus locations from 42 API...');

    try {
        // Fetch active hosts from 42 API
        const campusLocations = await requestCampusStatus();
        const activeHosts = Array.isArray(campusLocations)
            ? campusLocations.map(session => session.host.toLowerCase())
            : [];

        // Prevent "all green" bug: If API succeeds but returns 0 hosts during normal hours, treat as failure
        if (activeHosts.length === 0) {
            throw new Error('API returned 0 active hosts. 42 API is likely down.');
        }

        _activeHostsCache = activeHosts;
        console.log(`[Colors] API returned ${activeHosts.length} active hosts`);

        // Cache to localStorage
        try { localStorage.setItem('tracker_campus_cache', JSON.stringify(activeHosts)); } catch (e) { }

        paintHostColors(activeHosts);
    } catch (e) {
        console.error('[Colors] Error fetching campus status:', e);
        // If we have cached data, use it
        if (_activeHostsCache) {
            console.log('[Colors] Using cached data instead');
            paintHostColors(_activeHostsCache);
        }
    }
}

function paintHostColors(activeHosts) {
    // Find ALL host card elements
    const allHostEls = document.querySelectorAll('div[data-slot="card"].host');
    let occupiedCount = 0;
    let emptyCount = 0;

    allHostEls.forEach(el => {
        const hostId = el.id; // e.g. "z2r8p4"
        if (!hostId) return;

        const isOccupied = activeHosts.includes(hostId.toLowerCase());

        if (isOccupied) {
            el.style.backgroundColor = 'rgba(255, 60, 60, 0.08)'; // Light red
            occupiedCount++;
        } else {
            el.style.backgroundColor = 'rgba(60, 255, 60, 0.05)'; // Very light green
            emptyCount++;
        }
    });
    console.log(`[Colors] Applied: ${occupiedCount} occupied (red), ${emptyCount} empty (green) out of ${allHostEls.length} hosts`);
}

function clearAvailabilityColors() {
    const allHosts = document.querySelectorAll('div[data-slot="card"].host');
    allHosts.forEach(el => {
        el.style.backgroundColor = '';
    });
    _activeHostsCache = null;
    console.log(`[Colors] Cleared colors from ${allHosts.length} hosts`);
}

function addHostOverlays() {
    // Apply cached colors IMMEDIATELY when DOM redraws, without triggering an API fetch
    if (showAvailabilityColors && _activeHostsCache) {
        paintHostColors(_activeHostsCache);
    }

    if (!apiLoaded || allSessions.length === 0) {
        return Promise.resolve(0);
    }
    if (isOverlayProcessing) return Promise.resolve(0); // Prevent re-entry

    isOverlayProcessing = true;

    // Calculate total time per host (with interval merging + floor filter)
    const hostTotals = calcHostTotals(allSessions);

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

                // === Detect if already starred (using robust rotate-y-180 logic from Crappo) ===
                const contentEl = el.querySelector('.content');
                if (contentEl) {
                    if (contentEl.classList.contains('rotate-y-180')) {
                        if (!favoritesMap[hostName]) {
                            favoritesMap[hostName] = true;
                            try { localStorage.setItem('tracker_stars', JSON.stringify(favoritesMap)); } catch (err) { }
                        }
                        el.classList.add('retro-fav-host');
                    } else {
                        // SELF-HEALING: It's on screen and doesn't have the star class.
                        // If we previously thought it had a star (false positive), remove it!
                        if (favoritesMap[hostName]) {
                            delete favoritesMap[hostName];
                            try { localStorage.setItem('tracker_stars', JSON.stringify(favoritesMap)); } catch (err) { }
                            el.classList.remove('retro-fav-host');
                        }
                    }
                }

                if (!hostTotals[hostName]) continue;

                // Check if badge already exists
                if (el.querySelector('.tracker-host-badge')) {
                    // Do NOT increment successCount here to prevent infinite updatePageDisplay loop!
                    continue;
                }

                const totalMs = hostTotals[hostName];
                const hours = totalMs / 3600000;

                // Color code (3h42m = TARGET_TIME_MS)
                let bgColor = '#4caf50'; // Green: <2h
                if (totalMs >= TARGET_TIME_MS) {
                    bgColor = '#ff5252'; // Red: >= 3h42m (completed)
                    el.classList.add('retro-fav-host');
                }
                else if (hours >= 2) bgColor = '#ffca28'; // Yellow: 2h <= x < 3h42m

                // Create badge at TOP-MIDDLE to avoid hiding anything
                const badge = document.createElement('div');
                badge.className = 'tracker-host-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: 0px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: ${bgColor};
                    color: #000;
                    font-size: 11px;
                    font-weight: 900;
                    padding: 2px 6px;
                    border: 2px solid #000;
                    border-radius: 6px;
                    z-index: 1000;
                    pointer-events: none;
                    box-shadow: 2px 2px 0px #000;
                    text-transform: uppercase;
                `;
                const h = Math.floor(totalMs / 3600000);
                const m = Math.floor((totalMs % 3600000) / 60000);
                badge.textContent = h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m`;

                // Set parent position to relative
                const style = window.getComputedStyle(el);
                if (style.position === 'static') {
                    el.style.position = 'relative';
                }

                el.appendChild(badge);

                // Add a click listener for manual validation
                if (!el.dataset.hasLogger) {
                    el.dataset.hasLogger = 'true';
                    el.addEventListener('click', () => {
                        const hostSessions = allSessions.filter(s => s.host === hostName);

                        // Construct the summary string
                        let report = `🌟 CLAIM STAR VERIFICATION LOG 🌟\n`;
                        report += `Host: ${hostName}\nUser: ${currentUserLogin}\n`;
                        report += `----------------------------------------\n`;
                        report += `Calculated Total Time: ${h}h ${m}m (${totalMs} ms)\n`;
                        report += `Target Amount Needed : 3h 42m (${TARGET_TIME_MS} ms)\n`;
                        report += `Difference (ms)      : ${totalMs - TARGET_TIME_MS} ms\n`;
                        report += `Bonus Achieved?      : ${totalMs >= TARGET_TIME_MS ? 'YES ✅' : 'NO ❌'}\n`;
                        report += `----------------------------------------\n`;
                        report += `Raw Sessions Array (${hostSessions.length} total):\n`;

                        hostSessions.forEach((s, idx) => {
                            const startStr = new Date(s.beginAt).toLocaleString();
                            const endStr = s.ongoing ? 'Ongoing' : new Date(s.endAt).toLocaleString();
                            const durStr = s.ongoing ? Date.now() - new Date(s.beginAt).getTime() : s.duration;
                            report += `[${idx + 1}] Begin: ${startStr} | End: ${endStr} | DurationMs: ${durStr}\n`;
                        });

                        // Also keep it in the console just in case
                        console.log(report);
                    });
                }

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
    // Feature 5: Auto-detect user login from the DOM if not already saved
    if (!currentUserLogin) {
        const domLogin = getStudentLoginFromDOM();
        if (domLogin) {
            currentUserLogin = domLogin;
            try { localStorage.setItem('tracker_user', domLogin); } catch (e) { }
            log('info', `Auto-detected login from DOM: ${domLogin}`);
        }
    }

    createTrackerPanel();

    if (showAvailabilityColors) {
        applyAvailabilityColors().catch(err => console.error('[Colors] Init error:', err));
        startColorsLoop();
    }

    if (apiLoaded) {
        updatePageDisplay();
        // Attempt once on initialization
        setTimeout(() => addHostOverlays(), 1000);
    }
    // Always re-fetch fresh data from API on page load
    if (currentUserLogin) {
        setTimeout(() => loadFromAPI(currentUserLogin), apiLoaded ? 3000 : 1000);
    }

    // Refresh display every minute (update ongoing sessions)
    setInterval(() => {
        if (allSessions.some(s => s.ongoing)) {
            updatePageDisplay();
        }
    }, 60000);

    // Watch DOM changes, Matrix might dynamic load hosts
    const observer = new MutationObserver(() => {
        if (!isOverlayProcessing) {
            // Debounce
            if (window.overlayTimeout) clearTimeout(window.overlayTimeout);
            window.overlayTimeout = setTimeout(() => addHostOverlays(), 500);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

log('info', '=== v7.0 Initialization complete ===');
