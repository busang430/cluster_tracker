// 42 Cluster Time Tracker - Popup Script

const TARGET_TIME_MS = (3 * 60 + 42) * 60 * 1000; // 3小时42分钟

// 格式化时间
function formatTime(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
}

// 更新显示
function updateDisplay() {
    chrome.storage.local.get(['sessions'], (result) => {
        const sessions = result.sessions || {};
        const content = document.getElementById('content');

        if (Object.keys(sessions).length === 0) {
            content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🖥️</div>
          <p>暂无登录记录</p>
          <p style="font-size: 12px; margin-top: 8px;">访问 Matrix 页面开始追踪</p>
        </div>
      `;
            return;
        }

        let html = '';

        for (const [host, data] of Object.entries(sessions)) {
            const currentTime = data.currentSession ? Date.now() - data.currentSession.loginTime : 0;
            const totalTime = data.totalTime + currentTime;
            const remaining = Math.max(0, TARGET_TIME_MS - totalTime);
            const progress = Math.min(100, (totalTime / TARGET_TIME_MS) * 100);
            const isActive = data.currentSession !== null;
            const isCompleted = totalTime >= TARGET_TIME_MS;

            html += `
        <div class="session-card ${isActive ? 'active' : ''}">
          <div class="card-header">
            <span class="host-name">${host}</span>
            ${isActive ? '<span class="status-badge">在线</span>' : ''}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="stats">
            <div class="stat-item">
              <span class="stat-label">已登录时间</span>
              <span class="stat-value">${formatTime(totalTime)}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">${isCompleted ? '状态' : '还需时间'}</span>
              <span class="stat-value ${isCompleted ? 'completed' : 'remaining'}">
                ${isCompleted ? '✨ 已获得星号!' : formatTime(remaining)}
              </span>
            </div>
          </div>
        </div>
      `;
        }

        content.innerHTML = html;
    });
}

// 清除数据
document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm('确定要清除所有追踪数据吗？')) {
        chrome.runtime.sendMessage({ action: 'clearSessions' }, () => {
            updateDisplay();
        });
    }
});

// 初始化
updateDisplay();

// 每秒更新一次
setInterval(updateDisplay, 1000);
