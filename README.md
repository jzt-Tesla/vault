# Vault - API Key Manager

> 本地 API Key 安全管理器，浏览器端加密存储，数据不离开本机。

## 快速开始

### 浏览器模式

双击 `index.html` 即可运行。

> 需要支持 Web Crypto API 的现代浏览器（Chrome / Edge / Firefox / Safari）

### Electron 桌面模式

```bash
npm install
npm start
```

### 打包为便携版 exe

```bash
npm run build:portable
```

打包产物输出到 `dist/Vault.exe`。

## 项目结构

```
vault/
├── index.html       — 页面结构
├── style.css        — 样式表
├── app.js           — 业务逻辑
├── main.js          — Electron 主进程
├── package.json     — 项目配置与构建脚本
├── eye-open.jpg     — ikun睁眼图标（密码隐藏态）
├── eye-closed.png   — ikun闭眼图标（密码可见态）
├── dist/            — 打包输出目录
└── README.md
```

## 功能特性

### 安全架构

| 特性 | 说明 |
|------|------|
| 加密算法 | AES-256-GCM |
| 密钥派生 | PBKDF2（SHA-256，100,000 次迭代） |
| 主密码 | 唯一核心认证（4-30 位） |
| 手势密码 | 可选快捷解锁，可随时开启/关闭/重置 |
| 免密访问 | 开启后自动解锁，无需输入密码或手势 |

### API Key 管理

- 添加 / 编辑 / 删除
- 实时搜索（名称、URL、备注）
- 显示 / 隐藏 Key 值
- 一键复制到剪贴板
- 导出为 Excel（.xlsx）
- 快速选择供应商自动填充名称和 URL

### 支持供应商

| 供应商 | 供应商 | 供应商 |
|--------|--------|--------|
| OpenAI | DeepSeek | Claude |
| Gemini | Qwen | MiniMax |
| Xiaomi Mimo | Kimi | GLM |

### 设置选项

| 功能 | 说明 |
|------|------|
| 修改主密码 | 验证旧密码后设置新密码，所有 Key 自动重新加密 |
| 免密访问 | 开启后打开页面直接进入，无需输入密码或手势 |
| 手势密码 | 开启/关闭/重置手势快捷解锁 |
| 主题切换 | 暗夜 / 纯白 / 柔雾紫 |
| 重置数据 | 双重确认后清除全部数据 |

## 数据存储

使用 `localStorage` 存储：

| 键名 | 内容 |
|------|------|
| `vault_config` | 安全配置（密码哈希、盐值、手势配置、免密配置） |
| `vault_data` | 加密后的 API Key 列表 |
| `vault_theme` | 主题设置 |

### vault_config 数据模型

| 字段 | 说明 |
|------|------|
| `pwHash` | 主密码验证哈希（PBKDF2 + SHA-256） |
| `pwSalt` | 主密码哈希派生盐 |
| `keySalt` | AES 密钥派生盐 |
| `test` | AES-GCM 加密的验证值 |
| `gestureEnabled` | 手势是否启用 |
| `gestureHash` | 手势验证哈希 |
| `gestureSalt` | 手势哈希派生盐 |
| `wrappedKey` | 手势密钥包裹的 AES 主密钥 |
| `noLock` | 免密访问是否开启 |
| `noLockWrapped` | 免密密钥包裹的 AES 主密钥 |

## 安全说明

- API Key 使用 AES-256-GCM 加密存储
- 主密码通过 PBKDF2 派生 AES 密钥，不存储明文
- 手势密码仅存储 SHA-256 哈希，不可逆推
- 免密访问使用独立密钥包裹 AES 主密钥
- 无后端、无网络请求、无数据上传
- 清除浏览器数据将导致所有内容丢失
- 修改主密码后手势和免密自动关闭，需重新开启

## 外部依赖

| 库 | 用途 |
|----|------|
| [SheetJS (xlsx)](https://sheetjs.com/) | Excel 文件生成 |
| [Electron](https://www.electronjs.org/) | 桌面应用框架（开发依赖） |
| [electron-builder](https://www.electron.build/) | 应用打包工具（开发依赖） |

## 浏览器兼容性

| 浏览器 | 支持 |
|--------|------|
| Chrome 63+ | ✅ |
| Edge 79+ | ✅ |
| Firefox 57+ | ✅ |
| Safari 11+ | ✅ |

## 开发

```bash
# 安装依赖
npm install

# 启动 Electron 应用
npm start

# 打包 Windows 便携版
npm run build:portable
```

## 许可证

MIT License
