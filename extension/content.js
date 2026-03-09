// 42 Cluster Time Tracker v7.0 — 42 API Integration
// =============================================
// Fetch complete user login history via 42 API
// SSE is only used for real-time status updates

const TARGET_TIME_MS = (3 * 60 + 42) * 60 * 1000;
let currentUserLogin = null;
let allSessions = []; // Historical sessions from 42 API
let trackerPanel = null;
let logs = [];
let apiCaptures = []; // Collects captures from network-interceptor.js (main world) via CustomEvent

// Listen for API captures dispatched from the main world (network-interceptor.js)
window.addEventListener('tracker_api_capture', (e) => {
    if (e.detail) {
        apiCaptures.push(e.detail);
        if (apiCaptures.length > 300) apiCaptures.shift(); // cap at 300
    }
});
let apiLoaded = false;
let currentTab = 'history'; // 'history' | 'stars' | 'leaderboard'
let leaderboardData = null;    // cached computed leaderboard [{login, count, rank}]
let leaderboardLoading = false;
let leaderboardError = null;
let leaderboardFetchedAt = 0;  // timestamp of last fetch (cache for 6h)
let favoritesMap = {};
try {
    favoritesMap = JSON.parse(localStorage.getItem('tracker_stars') || '{}');
} catch (e) {
    favoritesMap = {};
}
let showAvailabilityColors = true; // Toggle for green/red host backgrounds
let colorsRefreshInterval = null;
let _skinSwitchInProgress = false; // Guard: prevents watchdog/observer interference during skin fade
let _rabbitDragListenersAdded = false; // Guard: prevents duplicate document-level drag listeners
let _sessionDelegationAdded = false; // Guard: prevents duplicate event delegation on session list
const _rabbitDragState = { dragging: false, wasDragged: false, startX: 0, startY: 0, panelStartX: 0, panelStartY: 0 };

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
let activeSkin = 'glass_morphism';

// Try to read activeSkin injected from injector.js
try {
    const scripts = document.head.getElementsByTagName('script');
    for (let s of scripts) {
        if (s.dataset.activeSkin) {
            activeSkin = s.dataset.activeSkin;
            break;
        }
    }
} catch (e) {
    console.warn("[Tracker v7] Could not identify dataset skin, defaulting to:", activeSkin);
}

function updateStatus(text) {
    const el = document.getElementById('apiStatus');
    if (el) el.textContent = text;
}

let _panelRetryCount = 0;
const MAX_PANEL_RETRIES = 10;
const PANEL_RETRY_DELAY = 300;

function createTrackerPanel() {
    // If panel exists but was detached from DOM (SPA navigation), reset it
    if (trackerPanel && !trackerPanel.isConnected) {
        log('warn', 'Panel was detached from DOM (SPA navigation?), recreating...');
        trackerPanel = null;
    }
    if (trackerPanel) return;
    trackerPanel = document.createElement('div');
    trackerPanel.className = 'cluster-tracker-panel';

    // Check if SkinManager is available and templates are registered
    const skinReady = window.SkinManager && activeSkin &&
        window.SkinManager._templates && window.SkinManager._templates[activeSkin];

    if (skinReady) {
        trackerPanel.innerHTML = window.SkinManager.getTemplate(activeSkin, 'renderClusterPanel')(
            currentUserLogin, apiLoaded, allSessions.length, showAvailabilityColors
        );
        _panelRetryCount = 0; // Reset on success
    } else if (_panelRetryCount < MAX_PANEL_RETRIES) {
        // SkinManager not ready yet — retry after a short delay
        _panelRetryCount++;
        log('warn', `SkinManager not ready (attempt ${_panelRetryCount}/${MAX_PANEL_RETRIES}), retrying in ${PANEL_RETRY_DELAY}ms...`);
        trackerPanel = null; // Reset so retry can create fresh
        setTimeout(() => createTrackerPanel(), PANEL_RETRY_DELAY);
        return; // Don't append an empty panel
    } else {
        log('error', 'SkinManager still not ready after max retries, using fallback');
        trackerPanel.innerHTML = '<div style="padding:20px;text-align:center;">⚠️ Loading failed. Please refresh.</div>';
    }

    document.body.appendChild(trackerPanel);

    // Attach events using the new function
    attachTrackerListeners();

    // Make the panel Draggable
    setupDraggablePanel(trackerPanel);
}

// === Minimize/Restore Rabbit Logic (Top-level for reuse) ===
function minimizeToRabbit(isLeftEdge) {
    if (!trackerPanel) return;
    const header = trackerPanel.querySelector('.tracker-header');
    const content = trackerPanel.querySelector('.tracker-content');
    const rabbit = trackerPanel.querySelector('#tracker-rabbit-minimized');

    if (!header || !rabbit || !content) return;

    // Hide normal UI
    header.style.display = 'none';
    content.style.display = 'none';

    // Save old styles to restore later
    trackerPanel.dataset.oldBg = trackerPanel.style.background || '';
    trackerPanel.dataset.oldBorder = trackerPanel.style.border || '';
    trackerPanel.dataset.oldShadow = trackerPanel.style.boxShadow || '';
    trackerPanel.dataset.oldBackdrop = trackerPanel.style.backdropFilter || '';
    trackerPanel.dataset.oldWebkitBackdrop = trackerPanel.style.webkitBackdropFilter || '';

    // Make the panel itself invisible so only the rabbit shows
    trackerPanel.style.background = 'transparent';
    trackerPanel.style.border = 'none';
    trackerPanel.style.boxShadow = 'none';
    trackerPanel.style.backdropFilter = 'none';
    trackerPanel.style.webkitBackdropFilter = 'none';

    // Show rabbit
    rabbit.classList.remove('tracker-rabbit-hidden');
    rabbit.classList.add('tracker-rabbit-visible');

    // Adjust position to "peek" from edge
    if (isLeftEdge !== undefined) {
        const vw = window.innerWidth;
        if (isLeftEdge) {
            trackerPanel.style.left = '-10px';
        } else {
            trackerPanel.style.left = (vw - 80) + 'px';
        }
    }
}

function restoreFromRabbit() {
    if (!trackerPanel) return;
    const header = trackerPanel.querySelector('.tracker-header');
    const content = trackerPanel.querySelector('.tracker-content');
    const rabbit = trackerPanel.querySelector('#tracker-rabbit-minimized');

    if (!header || !rabbit || !content) return;

    // Hide rabbit
    rabbit.classList.remove('tracker-rabbit-visible');
    rabbit.classList.add('tracker-rabbit-hidden');

    // Restore normal UI
    header.style.display = 'flex';
    content.style.display = 'flex';

    // Restore panel styling
    trackerPanel.style.background = trackerPanel.dataset.oldBg || '';
    trackerPanel.style.border = trackerPanel.dataset.oldBorder || '';
    trackerPanel.style.boxShadow = trackerPanel.dataset.oldShadow || '';
    trackerPanel.style.backdropFilter = trackerPanel.dataset.oldBackdrop || '';
    trackerPanel.style.webkitBackdropFilter = trackerPanel.dataset.oldWebkitBackdrop || '';

    // Push slightly away from edges so it doesn't immediately snap back
    const rect = trackerPanel.getBoundingClientRect();
    const vw = window.innerWidth;
    if (rect.left < 20) trackerPanel.style.left = '40px';
    if (vw - rect.right < 20) trackerPanel.style.left = (vw - 360) + 'px';
}

function attachTrackerListeners() {
    if (!trackerPanel) return;

    const toggleBtn = document.getElementById('toggleBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const rect = trackerPanel.getBoundingClientRect();
            const vw = window.innerWidth;
            minimizeToRabbit(rect.left < vw / 2);
        });
    }

    // Rabbit: drag to move + click to restore
    const rabbitEl = document.getElementById('tracker-rabbit-minimized');
    if (rabbitEl) {
        rabbitEl.addEventListener('mousedown', (e) => {
            e.preventDefault();
            _rabbitDragState.dragging = true;
            _rabbitDragState.wasDragged = false;
            _rabbitDragState.startX = e.clientX;
            _rabbitDragState.startY = e.clientY;
            const rect = trackerPanel.getBoundingClientRect();
            _rabbitDragState.panelStartX = rect.left;
            _rabbitDragState.panelStartY = rect.top;
            trackerPanel.style.right = 'auto';
            trackerPanel.style.bottom = 'auto';
            trackerPanel.style.margin = '0px';
        });

        rabbitEl.addEventListener('click', (e) => {
            if (_rabbitDragState.wasDragged) {
                _rabbitDragState.wasDragged = false;
                return; // Was a drag, don't restore
            }
            restoreFromRabbit();
        });

        // Document-level listeners — add only once to prevent leak
        if (!_rabbitDragListenersAdded) {
            _rabbitDragListenersAdded = true;
            document.addEventListener('mousemove', (e) => {
                if (!_rabbitDragState.dragging) return;
                e.preventDefault();
                const dx = e.clientX - _rabbitDragState.startX;
                const dy = e.clientY - _rabbitDragState.startY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _rabbitDragState.wasDragged = true;
                if (trackerPanel) {
                    trackerPanel.style.left = (_rabbitDragState.panelStartX + dx) + 'px';
                    trackerPanel.style.top = (_rabbitDragState.panelStartY + dy) + 'px';
                }
            });
            document.addEventListener('mouseup', () => {
                _rabbitDragState.dragging = false;
            });
        }
    }

    // Skin Toggle Button
    const skinToggleBtn = document.getElementById('skinToggleBtn');
    if (skinToggleBtn) {
        skinToggleBtn.addEventListener('click', () => {
            const currentSkin = typeof activeSkin !== 'undefined' ? activeSkin : 'glass_morphism';
            const nextSkin = currentSkin === 'glass_morphism' ? 'retro_comic' : 'glass_morphism';

            // Use postMessage to communicate between MAIN world and ISOLATED world reliably
            window.postMessage({ type: 'tracker_set_skin', newSkin: nextSkin }, '*');
        });
    }

    const debugDomBtn = document.getElementById('debugDomBtn');
    if (debugDomBtn) debugDomBtn.addEventListener('click', debugDOM);

    const refreshApiBtn = document.getElementById('refreshApiBtn');
    if (refreshApiBtn) refreshApiBtn.addEventListener('click', () => {
        if (currentUserLogin) loadFromAPI(currentUserLogin);
    });

    const exportLogsBtn = document.getElementById('exportLogsBtn');
    if (exportLogsBtn) exportLogsBtn.addEventListener('click', exportLogs);

    const colorToggleBtn = document.getElementById('colorToggleBtn');
    if (colorToggleBtn) {
        colorToggleBtn.addEventListener('click', (e) => {
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
    }

    const setUserBtn = document.getElementById('setUserBtn');
    if (setUserBtn) setUserBtn.addEventListener('click', setUser);

    const userLoginInput = document.getElementById('userLoginInput');
    if (userLoginInput) {
        userLoginInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') setUser();
        });
    }

    // Tab Event Listeners
    document.querySelectorAll('.tracker-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
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

            // Snap horizontally and naturally trigger minimize
            let didSnap = false;
            let snapLeft = false;
            if (rect.left < SNAP_THRESHOLD) {
                newLeft = 0; // Snap to left edge
                didSnap = true;
                snapLeft = true;
            } else if (vw - rect.right < SNAP_THRESHOLD) {
                newLeft = vw - rect.width; // Snap to right edge
                didSnap = true;
                snapLeft = false;
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

            // Check if we should minimize — use shared function
            if (didSnap) {
                setTimeout(() => minimizeToRabbit(snapLeft), 50);
            }

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
    if (tab === 'leaderboard' && !leaderboardLoading) {
        // Auto-load if cache is missing or older than 6h
        const sixHours = 6 * 60 * 60 * 1000;
        if (!leaderboardData && !leaderboardError || (Date.now() - leaderboardFetchedAt > sixHours)) {
            loadLeaderboard();
            return; // loadLeaderboard calls updatePageDisplay itself
        }
    }
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
        logs,
        // Network API captures from the interceptor — helps identify star count endpoints
        apiCaptures
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tracker_v7_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
}

function updatePageDisplay() {
    // Check if panel was detached from DOM by SPA
    if (trackerPanel && !trackerPanel.isConnected) {
        trackerPanel = null;
    }
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
    if (currentTab === 'leaderboard') {
        renderLeaderboard(sc);
    } else if (currentTab === 'stars') {
        renderStars(sc);
    } else {
        renderHistory(sc, todayStar);
    }

    // Restore scroll position
    sc.scrollTop = currentScroll;

    // Event delegation: attach once on the session container instead of per-element
    if (!_sessionDelegationAdded) {
        _sessionDelegationAdded = true;
        sc.addEventListener('click', (e) => {
            // Handle star button clicks
            const starBtn = e.target.closest('.manual-star-btn');
            if (starBtn) {
                e.stopPropagation();
                const h = starBtn.dataset.host;
                const action = starBtn.dataset.action;
                if (h) {
                    if (action === 'add') {
                        favoritesMap[h] = true;
                    } else if (action === 'remove') {
                        delete favoritesMap[h];
                    }
                    try { localStorage.setItem('tracker_stars', JSON.stringify(favoritesMap)); } catch (err) { }
                    updatePageDisplay();
                }
                return;
            }

            // Handle locate-on-map clicks
            const locateCard = e.target.closest('[data-locate]');
            if (locateCard) {
                const h = locateCard.dataset.locate;
                if (h) locateOnMap(h);
            }
        });
    }
}

function renderHistory(sc, todayStar) {
    sc.innerHTML = window.SkinManager.getTemplate(activeSkin, 'renderHistoryTab')(
        allSessions, apiLoaded, TARGET_TIME_MS, fmtD
    );
}

function renderStars(sc) {
    const hostTotals = calcHostTotals(allSessions);
    sc.innerHTML = window.SkinManager.getTemplate(activeSkin, 'renderStarsTab')(
        allSessions, hostTotals, TARGET_TIME_MS, favoritesMap, fmtD
    );
}

// ============ Leaderboard ============
function requestLeaderboard() {
    return new Promise((resolve, reject) => {
        const requestId = 'lb_' + Date.now();
        const handler = (event) => {
            if (event.detail.requestId === requestId) {
                window.removeEventListener('tracker_response', handler);
                if (event.detail.success) resolve(event.detail.locations);
                else reject(new Error(event.detail.error || 'Leaderboard fetch failed'));
            }
        };
        window.addEventListener('tracker_response', handler);
        window.dispatchEvent(new CustomEvent('tracker_request', {
            detail: { action: 'fetchLeaderboard', requestId }
        }));
        setTimeout(() => {
            window.removeEventListener('tracker_response', handler);
            reject(new Error('Leaderboard timeout (120s)'));
        }, 120000);
    });
}

async function loadLeaderboard() {
    leaderboardLoading = true;
    leaderboardError = null;
    updatePageDisplay();
    try {
        const records = await requestLeaderboard();
        // Group by user login and count
        const counts = {};
        records.forEach(r => {
            const login = r.user && (r.user.login || r.user);
            if (!login) return;
            counts[login] = (counts[login] || 0) + 1;
        });
        // Sort descending
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 100)
            .map(([login, count], i) => ({ rank: i + 1, login, count }));
        leaderboardData = sorted;
        leaderboardFetchedAt = Date.now();
        log('info', `Leaderboard built: ${sorted.length} users, top star=${sorted[0]?.count}`);
    } catch (e) {
        leaderboardError = e.message;
        log('error', `Leaderboard failed: ${e.message}`);
    } finally {
        leaderboardLoading = false;
        updatePageDisplay();
    }
}

function renderLeaderboard(sc) {
    sc.innerHTML = window.SkinManager.getTemplate(activeSkin, 'renderLeaderboardTab')(
        leaderboardData, leaderboardLoading, leaderboardError, currentUserLogin
    );
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
        window.SkinManager.getTemplate(activeSkin, 'applyHostColors')(el, isOccupied);
        if (isOccupied) occupiedCount++;
        else emptyCount++;
    });
    console.log(`[Colors] Applied: ${occupiedCount} occupied (red), ${emptyCount} empty (green) out of ${allHostEls.length} hosts`);
}

function clearAvailabilityColors() {
    const allHosts = document.querySelectorAll('div[data-slot="card"].host');
    allHosts.forEach(el => {
        window.SkinManager.getTemplate(activeSkin, 'clearHostColors')(el);
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
        isOverlayProcessing = false;
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

    if (hostnameEls.length > 0) log('info', `Found ${hostnameEls.length} host elements (.host)`);

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

                // Let the skin handle the actual DOM changes (Star toggles, Badges, etc)
                window.SkinManager.getTemplate(activeSkin, 'applyHostOverlay')(el, {
                    totalMs,
                    isStarred: !!favoritesMap[hostName],
                    targetTimeMs: TARGET_TIME_MS
                });

                // Add a click listener for manual validation
                if (!el.dataset.hasLogger) {
                    el.dataset.hasLogger = 'true';
                    el.addEventListener('click', () => {
                        const hostSessions = allSessions.filter(s => s.host === hostName);

                        const h = Math.floor(totalMs / 3600000);
                        const m = Math.floor((totalMs % 3600000) / 60000);

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

    // Watch DOM changes, Matrix might dynamic load hosts OR remove our panel via SPA navigation
    let _panelRecoveryTimeout = null;
    const observer = new MutationObserver(() => {
        // Skip during skin switch to avoid interference with fade transition
        if (_skinSwitchInProgress) return;

        if (!isOverlayProcessing) {
            // Debounce overlay refresh
            if (window.overlayTimeout) clearTimeout(window.overlayTimeout);
            window.overlayTimeout = setTimeout(() => addHostOverlays(), 500);
        }

        // === Panel recovery: detect if SPA navigation removed our panel ===
        if (trackerPanel && !trackerPanel.isConnected) {
            if (!_panelRecoveryTimeout) {
                _panelRecoveryTimeout = setTimeout(() => {
                    _panelRecoveryTimeout = null;
                    if (_skinSwitchInProgress) return; // Double-check
                    if (trackerPanel && !trackerPanel.isConnected) {
                        log('warn', 'MutationObserver: panel removed by SPA, recovering...');
                        _panelRetryCount = 0; // Reset so retries can happen fresh
                        trackerPanel = null;
                        createTrackerPanel();
                        if (trackerPanel) updatePageDisplay();
                    }
                }, 200);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // === Watchdog: backup safety net ===
    setInterval(() => {
        if (_skinSwitchInProgress) return; // Don't interfere with skin transition

        const needsRecovery = (trackerPanel && !trackerPanel.isConnected) || !trackerPanel;
        if (needsRecovery) {
            log('warn', 'Watchdog: panel missing or detached, recovering...');
            _panelRetryCount = 0; // Reset so retries can happen fresh
            trackerPanel = null;
            createTrackerPanel();
            if (trackerPanel) updatePageDisplay();
        }
    }, 500);
}

// Listen for dynamic skin changes from injector.js
window.addEventListener('tracker_skin_changed', (e) => {
    activeSkin = e.detail.newSkin;
    log('info', `Skin dynamically changed to ${activeSkin}`);

    // === Smooth Fade Transition ===
    const FADE_DURATION = 300; // ms
    _skinSwitchInProgress = true; // Prevent watchdog/observer interference

    // 1. Fade out the panel
    if (trackerPanel) {
        trackerPanel.style.transition = `opacity ${FADE_DURATION}ms ease`;
        trackerPanel.style.opacity = '0';
    }

    // 2. After fade-out completes, swap the content and fade back in
    setTimeout(() => {
        // Re-render Panel
        if (trackerPanel) {
            trackerPanel.remove();
            trackerPanel = null;
        }
        _panelRetryCount = 0; // Reset for fresh creation
        createTrackerPanel();
        if (trackerPanel) {
            trackerPanel.style.opacity = '0';
            trackerPanel.style.transition = `opacity ${FADE_DURATION}ms ease`;
            void trackerPanel.offsetWidth; // Trigger reflow
            trackerPanel.style.opacity = '1';
            setTimeout(() => {
                if (trackerPanel) trackerPanel.style.transition = '';
            }, FADE_DURATION);
            updatePageDisplay();
        }

        // Cleanup old host badges and classes (single DOM query)
        document.querySelectorAll('.tracker-host-badge').forEach(b => b.remove());
        const allHosts = document.querySelectorAll('.host');
        allHosts.forEach(h => {
            h.classList.remove('retro-fav-host');
            h.style.background = '';
            h.style.backgroundColor = '';
            h.style.backdropFilter = '';
            h.style.webkitBackdropFilter = '';
            h.style.border = '';
            h.style.boxShadow = '';

            if (window.SkinManager) {
                try {
                    window.SkinManager.getTemplate(activeSkin, 'clearHostColors')(h);
                } catch (e) {
                    h.style.cssText = ""; // Hard fallback
                }
            }
        });

        // Re-apply host overlays and colors
        addHostOverlays();
        if (showAvailabilityColors && _activeHostsCache) {
            paintHostColors(_activeHostsCache);
        }

        // Release lock after everything is done
        _skinSwitchInProgress = false;
    }, FADE_DURATION);
});

log('info', '=== v7.0 Initialization complete ===');
