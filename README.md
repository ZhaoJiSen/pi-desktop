# pi Desktop

基于已确认设计模板的 pi CLI 桌面工作台。第一版面向 macOS，桌面端通过本机 pi 的 JSONL RPC 工作，沿用 pi 已有的模型与认证配置。

## 启动

需要 Node.js 22+、pnpm、Rust 和 Tauri 对应平台的开发依赖，以及已安装、已完成认证的 `pi`。

```sh
pnpm install
pnpm desktop
```

首次启动会打开当前项目并创建会话。侧栏「项目」旁的加号可选择其他文件夹。默认从 PATH、Volta、Homebrew 等常见目录寻找 pi；也可在设置中填写可执行文件完整路径。模型与思考等级从本机 pi 读取。

语言在首次加载时读取系统首选语言：`zh`（包括 `zh-CN`、`zh-Hant-TW` 等）使用中文，其余语言及读取不到语言的情况默认英文。浏览器预览使用 `navigator.language`，桌面端通过 Rust 读取操作系统语言并在连接 pi 前同步。设置中手动选择的语言会持久化，重新启动不会覆盖；旧版本已保存的中文/英文设置也会保留。前端提示、原生目录选择标题、导出标题以及 Rust 的应用错误使用同一语言；pi、模型提供商和扩展返回的原始内容保留原文。

每个项目首次访问时启动一个 pi 进程，应用运行期间保留连接。同项目新建、切换会话通过 `new_session` / `switch_session` RPC 切换上下文；跨项目返回时复用该项目的进程，恢复其历史、模型、思考设置和扩展来源。只有首次启动、手动重连、修改可执行文件或进程退出后需要重新连接；停止或重连一个项目不会影响其他项目。关闭应用时清理全部子进程。复用连接时不会显示「正在连接 pi」，但扩展的 `session_start` 通知仍可能在会话切换时出现。

浏览器预览：

```sh
pnpm dev
```

打开 http://127.0.0.1:1420 。浏览器预览包含用于还原模板的固定会话与模型数据，可以验证界面、搜索、草稿和偏好；真实 Agent 运行只在桌面端提供，浏览器不会伪造模型回复。浏览器与桌面使用不同的本地存储键。


前端翻译资源位于 `src/locales/en.ts` 和 `src/locales/zh.ts`，业务代码使用语义化 key，例如 `t('connection.connecting')`；含变量的完整文案使用 `t('composer.sendHint', { shortcut: '⌘ ↵' })`。TypeScript 校验 key 及必需参数，测试检查语言资源和插值参数一致性。新会话标题以空值保存，显示时使用 `sessions.new`，用户输入的标题与插件内容不作为翻译 key。
## 已实现

- 项目文件夹组织会话；新建、切换、搜索标题和全文。右键会话可重命名、导出 Markdown 或移除，也支持 `Shift F10` / 菜单键。移除清理桌面端记录及草稿，保留 pi 原始会话文件；当前会话移除后优先打开同项目最近会话。未连接会话的名称会在下次连接时同步到 pi。
- 搜索模型名称、提供商和 ID；最近使用；思考强度选择。
- pi 进程管理、流式回复、Markdown/代码渲染、工具输出与 edit diff、停止运行、连接失败重试。
- 图片与文本附件、按会话保存草稿及附件、刷新恢复；保存失败保留内存输入并提示导出备份。
- 分支、当前上下文、累计 Token、估算费用；会话及全部会话用量视图。
- 读取已配置扩展包来源与扩展命令，向输入区插入命令；处理扩展选择、确认、输入、编辑弹窗。
- 浅色/深色/系统主题，中英文主界面，侧栏折叠、原生窗控和拖动区。

快捷键：`⌘/Ctrl N` 新聊天、`⌘/Ctrl K` 搜索、`⌘/Ctrl B` 折叠侧栏、`⌘/Ctrl Enter` 发送。运行期间锁定会话切换，待 `agent_settled` 后解除，避免把自动重试当成结束。

## 技术结构

Tauri 2 + React/TypeScript + Vite + Tailwind CSS 4 + Zustand + ahooks + Motion + HeroUI 3。桌面前端采用 React/Vite 静态资源；本版没有引入 Next.js 服务端运行时，避免与 Vite 的桌面资源管线重复。若后续增加独立 Web 服务，可再把需要 SSR 的页面放入 Next.js 应用。

- `src/components`：主工作台、对话、输入、导航、浮层和辅助页面。
- `src/store/workspace.ts`：工作区、草稿、偏好与持久化。
- `src/lib/desktop.ts`：前端 RPC 与运行状态管理。
- `src/lib/rpc.ts`：消息、工具结果、diff 和用量归一化。
- `src-tauri/src/runtime.rs`：本机 pi 子进程、JSONL 请求关联、事件转发与退出清理。
- `PRODUCT.md` / `DESIGN.md`：产品范围与模板约束。

## 验证

```sh
pnpm typecheck
pnpm lint
pnpm verify
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

macOS 安装包：

```sh
pnpm package:mac
```

产物在 `src-tauri/target/release/bundle/dmg/`。GitHub Actions 的 CI and macOS package 会在 PR（目标为 `dev` / `main`）、推送到 `dev` / `main`、推送 `v*` 标签或手动运行时执行类型检查、lint、全部前端测试、Rust fmt/Clippy/测试和前端生产构建。PR 只运行质量检查；其他触发在检查通过后构建同时支持 Apple Silicon 与 Intel 的 universal DMG，`v*` 标签再把 DMG 附到对应的 GitHub Release。当前安装包不签名、不公证。本机 pi RPC 冒烟检查需要显式启用，不在 CI 中运行。

只读本机 pi RPC 冒烟检查（不调用模型、不创建 pi 会话文件）：

```sh
PI_DESKTOP_RPC_SMOKE=1 cargo test --manifest-path src-tauri/Cargo.toml installed_pi_rpc_smoke -- --nocapture
```

验收记录和视觉证据索引在 `docs/implementation/notes.md`。

## 当前边界

真实模型生成尚未执行端到端验收；请使用本机已有认证的模型运行实际任务。已验证本机 pi 的状态、模型、命令和用量读取，以及发送、错误与运行锁的前端协议行为。原生窗口已启动，视觉证据来自同一套前端的浏览器预览。

扩展安装/卸载、启停、会话树分叉、导入已有 pi 会话和自动更新尚未实现。macOS 安装包可由本机或 GitHub Actions 构建，但尚未签名或公证。扩展包视图目前读取配置来源，不能证明包成功加载。用量是本应用已打开会话的 pi 统计，不代表服务商账户余额或订阅额度。Windows/Linux 尚未验收。
