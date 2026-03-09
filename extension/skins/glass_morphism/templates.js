// skins/default/templates.js
(function () {
    const templates = {

        // ==========================================
        // POPUP TEMPLATES
        // ==========================================

        // Renders the main shell of the popup
        renderPopupShell: function (activeSkinName, availableSkins) {
            let optionsHtml = '';
            for (const skin of availableSkins) {
                const selected = skin === activeSkinName ? 'selected' : '';
                optionsHtml += `<option value="${skin}" ${selected}>${skin}</option>`;
            }

            return `
                <div class="glass-environment">
                    <div class="glass-blob glass-blob-1"></div>
                    <div class="glass-blob glass-blob-2"></div>
                    <div class="glass-blob glass-blob-3"></div>
                </div>
                
                <div class="glass-panel main-popup-wrapper">
                    <div class="header-container">
                        <div class="header-top-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
                            <div class="skin-selector-container" style="margin: 0; width: auto; padding: 2px 8px; background: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.5); backdrop-filter: blur(10px);">
                                <label style="margin-right: 4px; color: #333;">Skin:</label>
                                <select id="skinSelector" style="background: transparent; border: none; font-weight: bold; color: #333; outline: none;">${optionsHtml}</select>
                            </div>
                        </div>
                        <div class="header-box">
                            <h1>Classroom Hub</h1>
                        </div>
                        <div class="sub-badge">✨ Glass Edition</div>
                        <div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:3px 10px;background:rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.6);border-radius:20px;backdrop-filter:blur(10px);font-size:10px;font-weight:600;letter-spacing:0.8px;color:#333;box-shadow:0 2px 8px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.5);">✦ by zqian</div>
                    </div>

                    <div class="content" id="content">
                        <!-- Sessions list goes here -->
                    </div>

                    <div class="footer">
                        <div class="target-text">🎯 TARGET: 3H 42M</div>
                        <button class="btn" id="clearBtn">Clear</button>
                    </div>
                </div>
            `;
        },

        // Renders the content area of the popup when empty
        renderPopupEmptyState: function () {
            return `
                <div class="empty-state">
                    <h2>No Records Yet!</h2>
                    <p>Visit the Matrix page to start tracking your login sessions.</p>
                </div>
        `;
        },

        // Renders the content area of the popup with session data
        renderPopupSessions: function (sessionsData, targetTimeMs, formatTimeFn) {
            let html = '';
            for (const [host, data] of Object.entries(sessionsData)) {
                const currentTime = data.currentSession ? Date.now() - data.currentSession.loginTime : 0;
                const totalTime = data.totalTime + currentTime;
                const remaining = Math.max(0, targetTimeMs - totalTime);
                const progress = Math.min(100, (totalTime / targetTimeMs) * 100);
                const isActive = data.currentSession !== null;
                const isCompleted = totalTime >= targetTimeMs;

                html += `
        <div class="session-card ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                        <div class="card-icon">
                            ${isCompleted ? '⭐' : (isActive ? '⚡' : '🖥️')}
                        </div>
                        <div class="card-details">
                            <div class="card-header">
                                <span class="host-name">${host}</span>
                                ${isActive ? '<span class="status-badge">Online</span>' : ''}
                                ${isCompleted && !isActive ? '<span class="status-badge" style="background:#198754; color:white;">Completed</span>' : ''}
                            </div>
                            
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progress}%"></div>
                            </div>
                            
                            <div class="stats">
                                <div class="stat-item">
                                    <span class="stat-label">Logged Time</span>
                                    <span class="stat-value">${formatTimeFn(totalTime)}</span>
                                </div>
                                <div class="stat-item" style="text-align: right;">
                                    <span class="stat-label">${isCompleted ? 'Status' : 'Remaining'}</span>
                                    <span class="stat-value ${isCompleted ? 'completed' : 'remaining'}">
                                        ${isCompleted ? 'DONE!' : formatTimeFn(remaining)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
        `;
            }
            return html;
        },

        // ==========================================
        // CLUSTER TRACKER TEMPLATES
        // ==========================================

        // Renders the main floating panel shell
        renderClusterPanel: function (currentUserLogin, apiLoaded, sessionCount, showAvailabilityColors) {
            // Include skin selection in the panel
            const currentSkin = window.activeSkin || 'glass_morphism';
            const skins = ['retro_comic', 'glass_morphism'];
            const skinOptionsHtml = skins.map(s => `<option value="${s}" ${s === currentSkin ? 'selected' : ''}>${s.replace('_', ' ').toUpperCase()}</option>`).join('');

            return `
        <div class="tracker-header">
                    <h3 style="text-align: center; width: 100%;">⏱️ Catch 'Em All!</h3>
                    <div class="tracker-controls" style="display: flex; justify-content: center; flex-wrap: wrap; gap: 6px;">
                        <button class="tracker-btn" id="debugDomBtn" title="Inspect DOM">🔍</button>
                        <button class="tracker-btn" id="refreshApiBtn" title="Refresh API">🔄</button>
                        <button class="tracker-btn" id="exportLogsBtn" title="Export Logs">📋</button>
                        <button class="tracker-btn" id="colorToggleBtn" title="Toggle Colors" style="${showAvailabilityColors ? 'color:#0d6efd' : 'color:#495057'};">🎨</button>
                        <button class="tracker-btn" id="skinToggleBtn" title="Change Theme (Skin)">👕</button>
                        <button class="tracker-toggle" id="toggleBtn" title="Minimize to Rabbit">−</button>
                    </div>
                    <div style="margin-top:5px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.4); text-align:center; font-size:10px; font-weight:600; letter-spacing:0.5px; color:rgba(0,0,0,0.45);">made by the best vibe coder <span style="color:#0d6efd; font-weight:700;">@zqian</span></div>
                </div>
                
                <!--The minimized Rabbit Form (Hidden by default)-->
                <div id="tracker-rabbit-minimized" class="tracker-rabbit-hidden" title="Click to Restore">
                    <!-- Custom SVG based on user's rabbit image reference -->
                    <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15));">
                        
                        <!-- Left Ear (Brown/Tan) -->
                        <path d="M 25 35 Q 12 50 15 75 Q 25 85 30 65 Q 35 45 25 35 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
                        
                        <!-- Right Ear (Brown/Tan) -->
                        <path d="M 75 35 Q 88 50 85 75 Q 75 85 70 65 Q 65 45 75 35 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
                        
                        <!-- Main Body/Head -->
                        <path d="M 20 60 Q 30 15 50 15 Q 70 15 80 60 Q 85 90 50 90 Q 15 90 20 60 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
                        
                        <!-- White Belly / Bib Area -->
                        <path d="M 35 55 Q 50 60 65 55 L 75 80 Q 50 95 25 80 Z" fill="#FFFFFF" stroke="#333" stroke-width="2"/>
                        
                        <!-- Left Arm/Paw -->
                        <path d="M 25 55 Q 35 65 30 70 Q 20 70 25 55 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
                        
                        <!-- Right Arm/Paw -->
                        <path d="M 75 55 Q 65 65 70 70 Q 80 70 75 55 Z" fill="#D3C1B3" stroke="#333" stroke-width="2"/>
                        
                        <!-- Eyes (Large Black with White Highlights) -->
                        <!-- Left Eye Vector -->
                        <ellipse cx="35" cy="32" rx="6" ry="7" fill="#000"/>
                        <circle cx="33" cy="29" r="2.5" fill="#fff"/>
                        <circle cx="37" cy="34" r="1.2" fill="#fff"/>
                        
                        <!-- Right Eye Vector -->
                        <ellipse cx="65" cy="32" rx="6" ry="7" fill="#000"/>
                        <circle cx="63" cy="29" r="2.5" fill="#fff"/>
                        <circle cx="67" cy="34" r="1.2" fill="#fff"/>
                        
                        <!-- Nose and Mouth (Y-shape) -->
                        <path d="M 45 32 Q 50 35 55 32 L 50 38 Z" fill="#E6A19A" stroke="#333" stroke-width="1.5" stroke-linejoin="round"/>
                        <path d="M 50 38 L 50 42" stroke="#333" stroke-width="2" stroke-linecap="round"/>
                        <path d="M 50 42 Q 43 45 38 41" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
                        <path d="M 50 42 Q 57 45 62 41" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
                        
                        <!-- Little Chin Fluff -->
                        <path d="M 46 48 Q 50 51 54 48" stroke="#333" stroke-width="1" fill="none" stroke-linecap="round"/>
                        
                    </svg>
                </div>

                <div class="tracker-content" id="trackerContent">
                    <div class="tracker-info">
                        <div class="user-input-section">
                            <label for="userLoginInput">User:</label>
                            <input type="text" id="userLoginInput" placeholder="login" value="${currentUserLogin || ''}" />
                            <button id="setUserBtn" class="set-user-btn">Get</button>
                        </div>
                        <div id="apiStatus" style="font-weight:500;font-size:12px;margin-top:4px;color:#6c757d;">
                            ${apiLoaded ? `✅ ${sessionCount} records loaded` : '⏳ Enter login'}
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
                        <p style="text-align:center;color:#6c757d;padding:20px;">
                            ${apiLoaded ? 'Loading...' : 'Waiting for API data...'}
                        </p>
                    </div>
                </div>
    `;
        },

        // Updates the top info section of the cluster panel
        renderClusterInfo: function (currentUserLogin, sessionCount, apiLoaded, todayTotal, todayPct, todayStar, targetTimeMs, fmtDFn) {
            return {
                userDisplay: currentUserLogin
                    ? `<strong>👤 ${currentUserLogin}</strong> | ${sessionCount} sessions`
                    : `<span style="color:#dc3545;font-weight:600;">⚠️ Please enter login</span>`,
                apiStatus: apiLoaded ? `✅ ${sessionCount} records loaded` : '⏳ Waiting...',
                todayStats: `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <strong>📅 Today: ${fmtDFn(todayTotal)}</strong>
                        <span style="font-weight:600; color:#dc3545;">${todayStar ? '⭐ Earned!' : `Needs ${fmtDFn(targetTimeMs - todayTotal)}`}</span>
                    </div>
        <div class="progress-bar">
            <div class="progress-fill ${todayStar ? 'star' : ''}" style="width:${todayPct}%;"></div>
        </div>
    `
            };
        },

        // Renders the History tab content
        renderHistoryTab: function (sessions, apiLoaded, targetTimeMs, fmtDFn) {
            if (sessions.length === 0) {
                return `<p style="text-align:center;color:#6c757d;padding:20px;">
        ${apiLoaded ? 'No records' : 'Enter login and click "Get"'}
                </p>`;
            }

            const dayMap = {};
            sessions.forEach(s => {
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
            const days = Object.entries(dayMap).sort(([, a], [, b]) => b.date - a.date).slice(0, 1000);

            days.forEach(([day, info]) => {
                const dayPct = Math.min((info.total / targetTimeMs) * 100, 100);
                const star = info.total >= targetTimeMs;

                html += `
        <div style="margin-bottom:16px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;color:#495057;">
                            <span style="color:${star ? '#198754' : '#495057'};">
                                ${star ? '⭐' : '📅'} ${day}
                            </span>
                            <span>
                                ${fmtDFn(info.total)}
                            </span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${star ? 'star' : ''}" style="width:${dayPct}%;"></div>
                        </div>`;

                info.sessions.forEach(s => {
                    const begin = new Date(s.beginAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const end = s.ongoing ? 'Online' : new Date(s.endAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const dur = fmtDFn(s.ongoing ? Date.now() - new Date(s.beginAt).getTime() : s.duration);

                    html += `
        <div class="session-item">
                            <div class="session-header">
                                <span class="host-name">🖥️ ${s.host}</span>
                                <span class="status-badge ${s.ongoing ? 'ongoing' : ''}">${s.ongoing ? '● Online' : dur}</span>
                            </div>
                            <div style="font-size:12px; color:#6c757d;">${begin} → ${end}</div>
                        </div>`;
                });

                html += `</div>`;
            });

            return html;
        },

        // Render the Stars tab content
        renderStarsTab: function (sessions, hostTotals, targetTimeMs, favoritesMap, fmtDFn) {
            if (sessions.length === 0) {
                return `<p style="text-align:center;color:#6c757d;padding:20px;">No data available</p>`;
            }
            if (Object.keys(hostTotals).length === 0) {
                return `<p style="text-align:center;color:#6c757d;padding:20px;">No data for this floor yet. Switch floors if needed.</p>`;
            }

            let ongoing = Object.entries(hostTotals)
                .filter(([, total]) => total > 0 && total < targetTimeMs)
                .map(([host, total]) => ({ host, total }))
                .sort((a, b) => b.total - a.total);

            let qualified = Object.entries(hostTotals)
                .filter(([, total]) => total >= targetTimeMs)
                .map(([host, total]) => ({ host, total, isFav: !!favoritesMap[host] }))
                .sort((a, b) => b.total - a.total);

            const todo = qualified.filter(q => !q.isFav);
            const done = qualified.filter(q => q.isFav);

            if (ongoing.length === 0 && qualified.length === 0) {
                return `<p style="text-align:center;color:#6c757d;padding:20px;">No ongoing or starred sessions yet. Keep going! 🚀</p>`;
            }

            let html = `<div>`;

            const renderQualifiedItem = (q, isTodo) => {
                return `
        <div class="session-item" data-locate="${q.host}" style="cursor:pointer;${isTodo ? 'border-left: 4px solid #fd7e14;' : 'border-left: 4px solid #198754;'}">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span class="host-name">${q.host}</span>
                                ${isTodo
                        ? `<span class="status-badge manual-star-btn" data-action="add" data-host="${q.host}" style="background:#fd7e14;color:#fff;cursor:pointer;" title="Click to manually mark as STARRED">To Star</span>`
                        : `<span class="manual-star-btn" data-action="remove" data-host="${q.host}" style="font-size:16px;cursor:pointer;" title="Click to UN-STAR (Mistake?)">⭐</span>`}
                            </div>
                            <span style="font-weight:600;font-size:15px;color:#212529;">${fmtDFn(q.total)}</span>
                        </div>
                        <div style="margin-top:8px;font-size:11px;color:#6c757d;">
                            ${isTodo ? '📍 Click card to locate | Click TO STAR to mark done' : 'Starred • 📍 Click to locate'}
                    </div>`;
            };

            if (todo.length > 0) {
                html += `<div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:#495057;text-transform:uppercase;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #dee2e6;">
            🔥 Needs Star (${todo.length})
        </div>`;
                todo.forEach(q => html += renderQualifiedItem(q, true));
                html += `</div>`;
            }

            if (ongoing.length > 0) {
                html += `<div style="margin-bottom:24px;">
        <div style="font-size:13px;font-weight:600;color:#495057;text-transform:uppercase;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #dee2e6;">
            ⏳ Collecting Time (${ongoing.length})
        </div>`;

                ongoing.forEach(q => {
                    const pct = Math.min((q.total / targetTimeMs) * 100, 100);
                    const remaining = targetTimeMs - q.total;

                    html += `
            <div class="session-item" data-locate="${q.host}" style="cursor:pointer;border-left: 4px solid #0d6efd;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <span class="host-name">🖥️ ${q.host}</span>
                                </div>
                                <div style="text-align:right;">
                                    <span style="color:#212529;font-weight:600;font-size:15px;">${fmtDFn(q.total)}</span>
                                    <div style="font-size:11px;color:#dc3545;">Needs ${fmtDFn(remaining)}</div>
                                </div>
                            </div>
                            <div class="progress-bar" style="margin-bottom:4px !important;">
                                <div class="progress-fill" style="width:${pct}%;"></div>
                            </div>
                            <div style="margin-top:4px;font-size:11px;color:#6c757d;">📍 Click to locate on map</div>
                        </div>`;
                });
                html += `</div>`;
            }

            if (done.length > 0) {
                html += `<div style="margin-bottom:20px;">
        <div style="font-size:13px;font-weight:600;color:#495057;text-transform:uppercase;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #dee2e6;">
            ✅ Starred (${done.length})
        </div>`;
                done.forEach(q => html += renderQualifiedItem(q, false));
                html += `</div>`;
            }

            html += `</div>`;
            return html;
        },

        // ==========================================
        // MATRIX HOST OVERLAY TEMPLATES
        // ==========================================

        applyHostColors: function (hostElement, isOccupied) {
            if (isOccupied) {
                // Frosty Pink/Red gradient for occupied seats
                hostElement.style.background = 'linear-gradient(135deg, rgba(255, 170, 185, 0.4) 0%, rgba(255, 200, 210, 0.15) 100%)';
                hostElement.style.backdropFilter = 'blur(12px)';
                hostElement.style.border = '1px solid rgba(255, 255, 255, 0.6)';
                hostElement.style.boxShadow = '0 4px 15px rgba(255, 154, 158, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
            } else {
                // Frosty Mint/Green gradient for free seats
                hostElement.style.background = 'linear-gradient(135deg, rgba(140, 230, 210, 0.4) 0%, rgba(180, 250, 240, 0.15) 100%)';
                hostElement.style.backdropFilter = 'blur(12px)';
                hostElement.style.border = '1px solid rgba(255, 255, 255, 0.6)';
                hostElement.style.boxShadow = '0 4px 15px rgba(161, 253, 225, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)';
            }
        },

        clearHostColors: function (hostElement) {
            hostElement.style.backgroundColor = '';
            hostElement.style.backdropFilter = '';
            hostElement.style.border = '';
            hostElement.style.boxShadow = '';
        },

        applyHostOverlay: function (hostElement, hostData) {
            const { totalMs, targetTimeMs } = hostData;

            // Only proceed if there is tracked time
            if (totalMs === undefined || totalMs === null) return;

            // Prevent adding multiple badges
            if (hostElement.querySelector('.tracker-host-badge')) return;

            const hours = totalMs / 3600000;

            // Color code (3h42m = TARGET_TIME_MS) - Glass morphism vibrant variants
            let bgColor = 'linear-gradient(135deg, rgba(160, 230, 220, 0.7) 0%, rgba(120, 210, 190, 0.5) 100%)'; // Soft Frosty Green
            if (totalMs >= targetTimeMs) {
                bgColor = 'linear-gradient(135deg, rgba(255, 170, 185, 0.7) 0%, rgba(255, 140, 160, 0.5) 100%)'; // Soft Frosty Pink
            }
            else if (hours >= 2) {
                bgColor = 'linear-gradient(135deg, rgba(255, 210, 150, 0.7) 0%, rgba(255, 180, 120, 0.5) 100%)'; // Soft Frosty Orange
            }

            const badge = document.createElement('div');
            badge.className = 'tracker-host-badge glass-badge';
            badge.style.cssText = `
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 6px;
    z-index: 1000;
    pointer-events: none;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6);
    `;

            // Inner time format
            const h = Math.floor(totalMs / 3600000);
            const m = Math.floor((totalMs % 3600000) / 60000);
            badge.textContent = h > 0 ? `${h}h${m}m` : `${m}m`;

            hostElement.style.position = 'relative'; // Ensure absolute positioning works
            hostElement.appendChild(badge);
        }
    };

    // Auto-register upon injection
    if (window.SkinManager) {
        window.SkinManager.register('glass_morphism', templates);
    } else {
        console.error("[SkinManager] Not found when loading glass morphism templates!");
    }
})();
