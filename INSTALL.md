# Installation

这份文件只保留安装和排查步骤。完整说明见 `README.md`。

## 安装前检查

项目根目录必须直接包含这些文件：

```text
manifest.json
background.js
content.js
injector.js
popup.html
icons/
skins/
```

当前正确目录是：

```text
D:\42\cluster
```

## 安装步骤

1. 打开 `background.js`，填写 `CLIENT_ID` 和 `CLIENT_SECRET`。
2. 打开 Chrome。
3. 访问 `chrome://extensions/`。
4. 打开 Developer mode。
5. 点击 Load unpacked。
6. 选择 `D:\42\cluster`。
7. 打开 `https://matrix.42lyon.fr/` 并刷新页面。

## 验证安装

安装成功后应该能看到：

- Chrome 扩展列表里出现 `Catch 'Em All!`
- 扩展状态是 Enabled
- Matrix 页面右上角出现追踪面板
- 面板 API 状态最终显示 `Fresh ...`

## 常见错误

### Manifest file is missing or unreadable

选择的文件夹不对。必须选择包含 `manifest.json` 的 `D:\42\cluster`。

### Could not load icon

确认这些文件存在：

```text
icons/icon16.png
icons/icon48.png
icons/icon128.png
```

### API 401 或 Token API Error

重新检查 `background.js` 里的 `CLIENT_ID` 和 `CLIENT_SECRET`。修改后必须在 `chrome://extensions/` reload 扩展。

### 页面提示 Extension reloaded

扩展刚刚被重载过，Matrix 页面里的旧脚本失效了。刷新 Matrix 页面即可。

## 调试入口

- background 日志：`chrome://extensions/` -> 扩展卡片 -> service worker
- 页面日志：Matrix 页面按 F12 -> Console
- 导出追踪日志：面板里的 export logs 按钮
