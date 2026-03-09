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
                <div class="skin-selector-container">
                    <label>Skin:</label>
                    <select id="skinSelector">${optionsHtml}</select>
                </div>
                <div class="header-container">
                    <div class="header-box">
                        <h1>Classroom Hub</h1>
                    </div>
                    <div class="sub-badge">⏱️ 42 Time Tracker</div>
                    <div style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:2px 10px;background:linear-gradient(135deg,#e9ecef,#dee2e6);border:1px solid #ced4da;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:0.5px;color:#495057;box-shadow:0 1px 3px rgba(0,0,0,0.08);">&#x2726; by zqian</div>
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
            return `
                <div class="tracker-header">
                    <h3 style="text-align: center; width: 100%;">⏱️ Catch 'Em All!</h3>
                    <div class="tracker-controls" style="display: flex; justify-content: center; flex-wrap: wrap;">
                        <button class="tracker-btn" id="debugDomBtn" title="Inspect DOM">🔍</button>
                        <button class="tracker-btn" id="refreshApiBtn" title="Refresh API">🔄</button>
                        <button class="tracker-btn" id="exportLogsBtn" title="Export Logs">📋</button>
                        <button class="tracker-btn" id="colorToggleBtn" title="Toggle Colors" style="${showAvailabilityColors ? 'color:#0d6efd' : 'color:#495057'};">🎨</button>
                        <button class="tracker-toggle" id="toggleBtn">−</button>
                    </div>
                    <div style="margin-top:5px; padding-top:4px; border-top:1px solid #dee2e6; text-align:center; font-size:10px; font-weight:600; letter-spacing:0.5px; color:#adb5bd;">made by the best vibe coder <span style="color:#0d6efd; font-weight:700;">@zqian</span></div>
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
                        </div>
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
                hostElement.style.backgroundColor = 'rgba(220, 53, 69, 0.1)'; // Light red
            } else {
                hostElement.style.backgroundColor = 'rgba(25, 135, 84, 0.1)'; // Light green
            }
        },

        clearHostColors: function (hostElement) {
            hostElement.style.backgroundColor = '';
        },

        applyHostOverlay: function (hostElement, hostData) {
            const { totalMs, targetTimeMs } = hostData;

            // Only proceed if there is tracked time
            if (totalMs === undefined || totalMs === null) return;

            // Prevent adding multiple badges
            if (hostElement.querySelector('.tracker-host-badge')) return;

            const hours = totalMs / 3600000;

            // Color code (3h42m = TARGET_TIME_MS)
            let bgColor = '#198754'; // Success Green: <2h
            if (totalMs >= targetTimeMs) {
                bgColor = '#dc3545'; // Danger Red: >= 3h42m (completed)
            }
            else if (hours >= 2) bgColor = '#ffc107'; // Warning Yellow: 2h <= x < 3h42m

            // Create badge at TOP-MIDDLE to avoid hiding anything
            const badge = document.createElement('div');
            badge.className = 'tracker-host-badge';
            badge.style.cssText = `
                position: absolute;
                top: -6px;
                left: 50%;
                transform: translateX(-50%);
                background: ${bgColor};
                color: #fff;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 12px;
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                border: 1px solid rgba(0,0,0,0.1);
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
        window.SkinManager.register('default', templates);
    } else {
        console.error("[SkinManager] Not found when loading default templates!");
    }
})();
