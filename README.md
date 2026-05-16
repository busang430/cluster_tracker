# 42 Cluster Time Tracker

用于 42 Lyon Matrix 的 Chrome 扩展。它会读取 42 API 的历史 location 记录，并在 Matrix 页面上显示每台机器的累计时长、当天进度和星星目标。

## 你需要准备

- Chrome 或 Chromium 浏览器
- 可以登录 `https://matrix.42lyon.fr/` 的 42 账号
- 42 API 应用的 `UID` 和 `Secret`

重要：现在扩展文件已经直接放在项目根目录。安装时请选择：

```text
D:\42\cluster
```

不要再选择旧的 `D:\42\cluster\extension`。

## 第一次安装

1. 打开 `background.js`。
2. 找到下面两行，把自己的 42 API 凭证填进去：

```javascript
const CLIENT_ID = '你的 UID';
const CLIENT_SECRET = '你的 Secret';
```

3. 打开 Chrome，访问 `chrome://extensions/`。
4. 打开右上角的 Developer mode。
5. 点击 Load unpacked。
6. 选择项目根目录 `D:\42\cluster`。
7. 打开 `https://matrix.42lyon.fr/`，登录后刷新页面。

如果之后修改了代码或 API 凭证，回到 `chrome://extensions/`，点击这个扩展卡片上的 reload 按钮，然后刷新 Matrix 页面。

## 怎么使用

1. 打开 Matrix 页面：`https://matrix.42lyon.fr/`。
2. 页面右上角会出现浮动面板。
3. 如果没有自动识别登录名，在 User 输入框里输入你的 42 login，然后点 Get。
4. 点刷新按钮可以重新拉取 42 API 数据。
5. History 查看每天的登录记录；Stars 查看每台机器距离 3h42m 目标还差多少。

## 状态栏怎么看

面板里的 API 状态很重要：

- `Fresh ... latest ...`：刚刚从 42 API 成功拉到了最新数据。
- `Cached ...`：页面刚启动，先显示浏览器本地缓存。
- `Using cached ... (API: ...)`：API 请求失败，所以暂时显示旧缓存；括号里是失败原因。
- `API error: ...`：没有可用数据，API 请求失败。

如果你看到数据只停在某一天，比如 07/05，先看状态是不是 `Cached` 或 `Using cached`。这通常表示扩展还没真正重载，或者 API 请求失败后继续显示旧缓存。

## 常见问题

### Chrome 提示 Manifest file is missing

你选错目录了。Load unpacked 必须选择 `D:\42\cluster`，也就是包含 `manifest.json` 的目录。

### 改了 UID/Secret 但数据没更新

1. 去 `chrome://extensions/`。
2. 点击扩展卡片上的 reload。
3. 刷新 Matrix 页面。
4. 点面板里的 API refresh。
5. 看状态栏是否变成 `Fresh ...`。

### API 显示 401 或 Token API Error

通常是 `CLIENT_ID` 或 `CLIENT_SECRET` 不对，或者复制时多了空格。重新复制 42 API 应用里的 UID/Secret，然后 reload 扩展。

### 面板没有出现

- 确认正在访问 `https://matrix.42lyon.fr/`。
- 确认扩展是 Enabled。
- 刷新页面。
- 打开 F12 Console 看是否有错误。

### 页面显示旧数据

浏览器会保存 `tracker_api_cache` 作为兜底缓存。只要状态是 `Fresh`，才代表本次 API 拉取成功。状态是 `Cached` 或 `Using cached` 时，显示的是旧缓存。

## 文件结构

```text
D:\42\cluster
├─ manifest.json              Chrome 扩展配置
├─ background.js              42 API token 和 location 请求
├─ injector.js                注入页面脚本，并转发请求到 background
├─ content.js                 Matrix 页面上的主逻辑和浮动面板
├─ network-interceptor.js     调试用 API 捕获
├─ popup.html / popup.js      扩展弹窗
├─ icons/                     扩展图标
└─ skins/                     面板主题
```

## 目标时间

每台机器的目标是 3 小时 42 分钟，也就是 222 分钟。

## 安全提醒

`CLIENT_SECRET` 放在 Chrome 扩展源码里并不是真正保密。不要把自己的 Secret 提交到公开仓库，也不要截图分享包含 Secret 的代码。
