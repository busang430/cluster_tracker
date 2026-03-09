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
                <div class="header-container">
                    <div class="header-top-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
                        <div class="skin-selector-container" style="margin: 0; width: auto; padding: 2px 8px;">
                            <label style="margin-right: 4px;">Skin:</label>
                            <select id="skinSelector">${optionsHtml}</select>
                        </div>
                    </div>
                    
                    <div class="header-box">
                        <h1>Classroom Hub</h1>
                    </div>
                    <div class="sub-badge">⏱️ 42 Time Tracker</div>
                    <div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:2px 8px;background:#ffe066;border:2px solid #000;border-radius:4px;box-shadow:2px 2px 0 #000;font-size:10px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;">⚡ by zqian</div>
                </div>

                <div class="content" id="content">
                    <!-- Sessions list goes here -->
                </div>

                <div class="footer">
                    <div class="target-text">🎯 TARGET: 3H 42M</div>
                    <button class="btn" id="clearBtn">Clear</button>
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
                                ${isCompleted && !isActive ? '<span class="status-badge" style="background:#4caf50;">Completed</span>' : ''}
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
                        <button class="tracker-btn" id="colorToggleBtn" title="Toggle Colors" style="font-weight:bold; ${showAvailabilityColors ? 'color:#4caf50' : 'color:#555'};">🎨</button>
                        <button class="tracker-btn" id="skinToggleBtn" title="Change Theme (Skin)">👕</button>
                        <button class="tracker-toggle" id="toggleBtn" title="Minimize to Rabbit">−</button>
                    </div>
                    <div style="margin-top:5px; padding-top:4px; border-top:2px dashed rgba(0,0,0,0.2); text-align:center; font-size:10px; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; color:#555;">made by the best vibe coder <span style="color:#0d6efd; text-decoration:none;">@zqian</span></div>
                </div>

                <!-- The minimized Rabbit Form (Hidden by default) - Retro Comic Style -->
                <div id="tracker-rabbit-minimized" class="tracker-rabbit-hidden" title="Click to Restore">
                    <!-- Custom SVG based on user's rabbit image reference, comic-book style -->
                    <svg width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(4px 4px 0px rgba(0,0,0,1));">
                        
                        <!-- Left Ear (Brown/Tan) - THICK COMIC STROKE -->
                        <path d="M 25 35 Q 12 50 15 75 Q 25 85 30 65 Q 35 45 25 35 Z" fill="#D3C1B3" stroke="#000" stroke-width="4"/>
                        
                        <!-- Right Ear (Brown/Tan) - THICK COMIC STROKE -->
                        <path d="M 75 35 Q 88 50 85 75 Q 75 85 70 65 Q 65 45 75 35 Z" fill="#D3C1B3" stroke="#000" stroke-width="4"/>
                        
                        <!-- Main Body/Head - THICK COMIC STROKE -->
                        <path d="M 20 60 Q 30 15 50 15 Q 70 15 80 60 Q 85 90 50 90 Q 15 90 20 60 Z" fill="#D3C1B3" stroke="#000" stroke-width="4"/>
                        
                        <!-- White Belly / Bib Area - THICK COMIC STROKE -->
                        <path d="M 35 55 Q 50 60 65 55 L 75 80 Q 50 95 25 80 Z" fill="#FFFFFF" stroke="#000" stroke-width="4"/>
                        
                        <!-- Left Arm/Paw - THICK COMIC STROKE -->
                        <path d="M 25 55 Q 35 65 30 70 Q 20 70 25 55 Z" fill="#D3C1B3" stroke="#000" stroke-width="4"/>
                        
                        <!-- Right Arm/Paw - THICK COMIC STROKE -->
                        <path d="M 75 55 Q 65 65 70 70 Q 80 70 75 55 Z" fill="#D3C1B3" stroke="#000" stroke-width="4"/>
                        
                        <!-- Eyes (Large Black with White Highlights) -->
                        <ellipse cx="35" cy="32" rx="6" ry="7" fill="#000"/>
                        <circle cx="33" cy="29" r="2.5" fill="#fff"/>
                        <circle cx="37" cy="34" r="1.2" fill="#fff"/>
                        
                        <ellipse cx="65" cy="32" rx="6" ry="7" fill="#000"/>
                        <circle cx="63" cy="29" r="2.5" fill="#fff"/>
                        <circle cx="67" cy="34" r="1.2" fill="#fff"/>
                        
                        <!-- Nose and Mouth (Y-shape) - COMIC HEAVY WEIGHT -->
                        <path d="M 45 32 Q 50 35 55 32 L 50 38 Z" fill="#E6A19A" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>
                        <path d="M 50 38 L 50 42" stroke="#000" stroke-width="3" stroke-linecap="round"/>
                        <path d="M 50 42 Q 43 45 38 41" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
                        <path d="M 50 42 Q 57 45 62 41" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
                        
                        <!-- Little Chin Fluff - COMIC HEAVY WEIGHT -->
                        <path d="M 46 48 Q 50 51 54 48" stroke="#000" stroke-width="2" fill="none" stroke-linecap="round"/>
                        
                    </svg>
                </div>

                <div class="tracker-content" id="trackerContent">
                    <div class="tracker-info">
                        <div class="user-input-section">
                            <label for="userLoginInput">User:</label>
                            <input type="text" id="userLoginInput" placeholder="login" value="${currentUserLogin || ''}" />
                            <button id="setUserBtn" class="set-user-btn">Get</button>
                        </div>
                        <div id="apiStatus" style="font-weight:bold;font-size:12px;margin-top:4px;">
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
                        <p style="text-align:center;font-weight:bold;padding:20px;">
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
                    : `<span style="color:#d32f2f;font-weight:bold;">⚠️ Please enter login</span>`,
                apiStatus: apiLoaded ? `✅ ${sessionCount} records loaded` : '⏳ Waiting...',
                todayStats: `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <strong>📅 Today: ${fmtDFn(todayTotal)}</strong>
                        <span style="font-weight:bold; color:#d32f2f;">${todayStar ? '⭐ Earned!' : `Needs ${fmtDFn(targetTimeMs - todayTotal)}`}</span>
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
                return `<p style="text-align:center;font-weight:bold;padding:20px;">
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
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-weight:800;text-transform:uppercase;">
                            <span style="color:${star ? '#ff5252' : '#000'};">
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
                            <div style="font-weight:800; font-size:12px; color:#555;">${begin} → ${end}</div>
                        </div>`;
                });

                html += `</div>`;
            });

            return html;
        },

        // Render the Stars tab content
        renderStarsTab: function (sessions, hostTotals, targetTimeMs, favoritesMap, fmtDFn) {
            if (sessions.length === 0) {
                return `<p style="text-align:center;font-weight:bold;padding:20px;">No data available</p>`;
            }
            if (Object.keys(hostTotals).length === 0) {
                return `<p style="text-align:center;font-weight:bold;padding:20px;">No data for this floor yet. Switch floors if needed.</p>`;
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
                return `<p style="text-align:center;font-weight:bold;padding:20px;">No ongoing or starred sessions yet. Keep going! 🚀</p>`;
            }

            let html = `<div>`;

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
                            <span style="font-weight:800;font-size:16px;color:#000;">${fmtDFn(q.total)}</span>
                        </div>
                        <div style="margin-top:8px;font-size:12px;font-weight:800;text-transform:uppercase;color:#555;">
                            ${isTodo ? '📍 Click card to locate | Click TO STAR to mark done' : 'Starred • 📍 Click to locate'}
                        </div>
                    </div>`;
            };

            if (todo.length > 0) {
                html += `<div style="margin-bottom:20px;">
                    <div style="font-size:14px;font-weight:900;color:#000;text-transform:uppercase;margin-bottom:12px;text-align:center;border-bottom:2px solid #000;padding-bottom:4px;">
                        🔥 Needs Star (${todo.length})
                    </div>`;
                todo.forEach(q => html += renderQualifiedItem(q, true));
                html += `</div>`;
            }

            if (ongoing.length > 0) {
                html += `<div style="margin-bottom:20px;">
                    <div style="font-size:14px;font-weight:900;color:#000;text-transform:uppercase;margin-bottom:12px;text-align:center;border-bottom:2px solid #000;padding-bottom:4px;">
                        ⏳ Collecting Time (${ongoing.length})
                    </div>`;

                ongoing.forEach(q => {
                    const pct = Math.min((q.total / targetTimeMs) * 100, 100);
                    const remaining = targetTimeMs - q.total;

                    html += `
                        <div class="session-item" data-locate="${q.host}" style="cursor:pointer;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <span class="host-name">🖥️ ${q.host}</span>
                                </div>
                                <div style="text-align:right;">
                                    <span style="color:#000;font-weight:800;font-size:16px;">${fmtDFn(q.total)}</span>
                                    <div style="font-size:11px;font-weight:800;color:#ff5252;">Needs ${fmtDFn(remaining)}</div>
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

            if (done.length > 0) {
                html += `<div style="margin-bottom:20px;">
                    <div style="font-size:14px;font-weight:900;color:#000;text-transform:uppercase;margin-bottom:12px;text-align:center;border-bottom:2px solid #000;padding-bottom:4px;">
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
                hostElement.style.backgroundColor = 'rgba(255, 60, 60, 0.08)'; // Light red
            } else {
                hostElement.style.backgroundColor = 'rgba(60, 255, 60, 0.05)'; // Very light green
            }
        },

        clearHostColors: function (hostElement) {
            hostElement.style.backgroundColor = '';
        },

        applyHostOverlay: function (hostElement, hostData) {
            const { totalMs, isStarred, targetTimeMs } = hostData;

            // Handle Retro Star Class Toggle
            const contentEl = hostElement.querySelector('.content');
            if (contentEl) {
                if (isStarred) {
                    hostElement.classList.add('retro-fav-host');
                } else {
                    hostElement.classList.remove('retro-fav-host');
                }
            }

            // Only proceed if there is tracked time
            if (totalMs === undefined || totalMs === null) return;

            // Prevent adding multiple badges
            if (hostElement.querySelector('.tracker-host-badge')) return;

            const hours = totalMs / 3600000;

            // Color code (3h42m = TARGET_TIME_MS)
            let bgColor = '#4caf50'; // Green: <2h
            if (totalMs >= targetTimeMs) {
                bgColor = '#ff5252'; // Red: >= 3h42m (completed)
                hostElement.classList.add('retro-fav-host'); // Also add retro-fav-host if completed
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
        window.SkinManager.register('retro_comic', templates);
    } else {
        console.error("[SkinManager] Not found when loading retro_comic templates!");
    }
})();
