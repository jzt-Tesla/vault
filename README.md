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

### 重新生成应用图标

```bash
node gen-icon.js
```

基于 `eye-closed.png` 生成透明 squircle 圆角图标（Google Material Design 风格），输出各尺寸到项目根目录。

## 项目结构

```
vault/
├── index.html              — 页面结构（HTML）
├── style.css               — 样式表（CSS，含三套主题）
├── app.js                  — 业务逻辑（JavaScript）
├── main.js                 — Electron 主进程入口
├── package.json            — 项目配置与构建脚本
├── gen-icon.js             — 图标生成脚本（squircle 圆角 + 透明背景）
├── eye-open.jpg            — ikun睁眼图标（密码隐藏态）
├── eye-closed.png          — ikun闭眼图标（密码可见态）
├── icon-vault-md.png       — 应用图标源文件（1024x1024，透明 squircle）
├── icon-vault-md-*.png     — 各尺寸图标（16/32/48/64/128/256/512）
├── uml/                    — PlantUML 架构图（7 张）
│   ├── 01-class-diagram.puml       — 类图
│   ├── 02-state-diagram.puml       — 状态机图
│   ├── 03-sequence-setup.puml      — 首次设置时序图
│   ├── 04-sequence-unlock.puml     — 解锁流程时序图
│   ├── 05-sequence-keymgmt.puml    — Key 管理时序图
│   ├── 06-component-diagram.puml   — 组件图
│   └── 07-data-flow-diagram.puml   — 数据流图
├── dist/                   — 打包输出目录（已忽略）
└── README.md
```

## 功能特性

### 安全架构

| 特性 | 说明 |
|------|------|
| 加密算法 | AES-256-GCM |
| 密钥派生 | PBKDF2（SHA-256，100,000 次迭代） |
| 主密码 | 唯一核心认证（4-30 位） |
| 手势密码 | 3×3 九宫格，可选快捷解锁，可随时开启/关闭/重置 |
| 免密访问 | 开启后自动解锁，无需输入密码或手势 |
| 浏览器兼容检测 | 启动时检测 Web Crypto API，不支持则提示更换浏览器 |
| 数据清除监测 | 定时检测 localStorage 是否被清除，自动回到设置页 |

### API Key 管理

- 添加 / 编辑 / 删除
- 实时搜索（名称、URL、备注）
- 显示 / 隐藏 Key 值（脱敏显示）
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
| 手势密码 | 开启/关闭/重置手势快捷解锁（3×3 九宫格） |
| 主题切换 | 暗夜 / 纯白 / 柔雾紫 |
| 重置数据 | 双重确认后清除全部数据 |

## 应用流程

```
首次使用 → 创建主密码 → 可选手势 → 进入主界面
         ↓
后续访问 → 手势/密码/免密解锁 → 进入主界面
```

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
| `pwHash` | 主密码验证哈希（SHA-256） |
| `pwSalt` | 主密码哈希派生盐 |
| `keySalt` | AES 密钥派生盐 |
| `test` | AES-GCM 加密的验证值 |
| `gestureEnabled` | 手势是否启用 |
| `gestureHash` | 手势验证哈希 |
| `gestureSalt` | 手势哈希派生盐 |
| `wrappedKey` | 手势密钥包裹的 AES 主密钥 |
| `noLock` | 免密访问是否开启 |
| `noLockWrapped` | 免密密钥包裹的 AES 主密钥 |

## 架构设计

项目包含 7 张 PlantUML 架构图，详见 [uml/](uml/) 目录：

| 图表 | 说明 |
|------|------|
| 类图 | 系统架构、模块结构、类与数据模型 |
| 状态机图 | 应用页面状态流转 (Setup → Lock → Main) |
| 首次设置时序图 | 密码创建 + 手势设置流程 |
| 解锁流程时序图 | 手势/密码/免密三种解锁方式 |
| Key 管理时序图 | API Key CRUD + 搜索 + 导出 |
| 组件图 | 系统组件关系与依赖 |
| 数据流图 | 密钥层次与加密数据流 |

### 渲染方式

- **在线渲染**：复制 `.puml` 内容到 [PlantUML Online](https://www.plantuml.com/plantuml/uml/)
- **VS Code**：安装 [PlantUML](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml) 插件，按 `Alt+D` 预览
- **命令行**：`java -jar plantuml.jar uml/*.puml`（需要 Java + Graphviz）

## 安全说明

- API Key 使用 AES-256-GCM 加密存储
- 主密码通过 PBKDF2 派生 AES 密钥，不存储明文
- 手势密码仅存储 SHA-256 哈希，不可逆推
- 免密访问使用独立密钥包裹 AES 主密钥
- 无后端、无网络请求、无数据上传
- 清除浏览器数据将导致所有内容丢失
- 修改主密码后手势和免密自动关闭，需重新开启
- 重置数据后自动回到密码创建页，不会误触发页面刷新

## 数据存储位置

| 运行方式 | 数据存储位置 |
|----------|-------------|
| Vault.exe（Electron） | `%APPDATA%\vault\Local Storage\leveldb\` |
| 浏览器打开 index.html | 浏览器自身的 Local Storage（各浏览器路径不同） |

> 两种运行方式的数据**完全独立**，互不影响。

## 忘记密码怎么办

由于主密码通过 PBKDF2 派生 AES 密钥、手势密码仅存 SHA-256 哈希，**均无法逆向恢复**。忘记密码后无法通过软件内重置，只能手动删除数据文件：

1. 关闭 Vault.exe
2. 删除数据目录（见上方路径）
3. 重新打开应用，回到首次设置页面

> 删除后所有 API Key 和设置将永久丢失，请谨慎操作。

## 更新日志

### v1.1 (2026-05-28)
- 修复：重置数据后页面返回手势设置页的问题，现在正确回到密码创建页
- 修复：重置数据时 localStorage 监测误触发页面刷新的竞态条件
- 新增：7 张 PlantUML 架构图（uml/ 目录）
- 新增：免密访问功能（头部按钮一键开关）
- 新增：Google Material Design 风格应用图标

### v1.0 (初始版本)
- 基于 Web Crypto API 的本地 API Key 加密管理
- AES-256-GCM 加密 + PBKDF2 密钥派生
- 3×3 九宫格手势密码
- 三套主题（暗夜 / 纯白 / 柔雾紫）
- Electron 桌面应用支持
- Excel 导出功能

## 外部依赖

| 库 | 用途 |
|----|------|
| [SheetJS (xlsx)](https://sheetjs.com/) | Excel 文件生成 |
| [Electron](https://www.electronjs.org/) | 桌面应用框架（开发依赖） |
| [electron-builder](https://www.electron.build/) | 应用打包工具（开发依赖） |
| [sharp](https://sharp.pixelplumbing.com/) | 图标图像处理（开发依赖） |

## 浏览器兼容性

| 浏览器 | 支持 |
|--------|------|
| Chrome 63+ | ✅ |
| Edge 79+ | ✅ |
| Firefox 57+ | ✅ |
| Safari 11+ | ✅ |

> 所有浏览器均需要支持 Web Crypto API（`crypto.subtle`）

## 开发

```bash
# 安装依赖
npm install

# 启动 Electron 应用
npm start

# 打包 Windows 便携版
npm run build:portable

# 重新生成应用图标
node gen-icon.js
```

## 许可证

MIT License
