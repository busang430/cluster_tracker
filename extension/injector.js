// injector.js — Content Script (ISOLATED world)
// 注入content.js到MAIN world + 中转42 API请求

// 1) 注入content.js到页面
const s = document.createElement('script');
s.src = chrome.runtime.getURL('content.js');
s.type = 'text/javascript';
(document.head || document.documentElement).appendChild(s);

// 2) 注入styles.css
const c = document.createElement('link');
c.rel = 'stylesheet';
c.href = chrome.runtime.getURL('styles.css');
(document.head || document.documentElement).appendChild(c);

// 3) 监听来自content.js (MAIN world) 的自定义事件 → 转发给background.js
window.addEventListener('tracker_request', async (event) => {
    const { action, login, requestId } = event.detail;

    if (action === 'fetchLocations') {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'fetchLocations',
                login: login
            });
            // 把结果发回MAIN world
            window.dispatchEvent(new CustomEvent('tracker_response', {
                detail: { requestId, ...response }
            }));
        } catch (e) {
            window.dispatchEvent(new CustomEvent('tracker_response', {
                detail: { requestId, success: false, error: e.message }
            }));
        }
    }
});

console.log('[Injector] content.js + styles.css 已注入, API中转已设置');
