# Quick Start

## 1. 填 API 凭证

打开 `background.js`，填写你的 42 API 应用凭证：

```javascript
const CLIENT_ID = '你的 UID';
const CLIENT_SECRET = '你的 Secret';
```

## 2. 安装扩展

1. 打开 Chrome。
2. 访问 `chrome://extensions/`。
3. 打开 Developer mode。
4. 点击 Load unpacked。
5. 选择项目根目录：

```text
D:\42\cluster
```

不要选择旧的 `D:\42\cluster\extension`。

## 3. 开始使用

1. 打开 `https://matrix.42lyon.fr/`。
2. 登录你的 42 账号。
3. 刷新页面。
4. 右上角出现面板后，确认状态变成 `Fresh ...`。

## 4. 更新代码后

每次改 `background.js`、`content.js`、主题文件或 API 凭证后：

1. 回到 `chrome://extensions/`。
2. 点击扩展卡片上的 reload。
3. 刷新 Matrix 页面。

## 5. 数据不更新时

如果最新记录停在旧日期，先看面板状态：

- `Fresh`：API 拉取成功。
- `Cached`：正在显示本地缓存。
- `Using cached`：API 失败，继续显示旧缓存。

详细排查见 `README.md`。
