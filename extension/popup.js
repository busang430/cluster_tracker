// 42 Cluster Time Tracker - Popup Script

const TARGET_TIME_MS = (3 * 60 + 42) * 60 * 1000; // 3 hours 42 minutes

// Format time
function formatTime(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}

// Update display
function updateDisplay() {
  chrome.storage.local.get(['sessions'], (result) => {
    const sessions = result.sessions || {};
    const content = document.getElementById('content');

    if (Object.keys(sessions).length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🖥️</div>
          <p>No login records</p>
          <p style="font-size: 12px; margin-top: 8px;">Visit Matrix page to start tracking</p>
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
            ${isActive ? '<span class="status-badge">Online</span>' : ''}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="stats">
            <div class="stat-item">
              <span class="stat-label">Logged time</span>
              <span class="stat-value">${formatTime(totalTime)}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">${isCompleted ? 'Status' : 'Time remaining'}</span>
              <span class="stat-value ${isCompleted ? 'completed' : 'remaining'}">
                ${isCompleted ? '✨ Star earned!' : formatTime(remaining)}
              </span>
            </div>
          </div>
        </div>
      `;
    }

    content.innerHTML = html;
  });
}

// Clear data
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear all tracking data?')) {
    chrome.runtime.sendMessage({ action: 'clearSessions' }, () => {
      updateDisplay();
    });
  }
});

// Initialize
updateDisplay();

// Update every second
setInterval(updateDisplay, 1000);
