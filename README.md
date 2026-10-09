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

应用启动时预热全部未隐藏项目的 pi 进程，包括没有会话的项目，准备完成后进入工作区。同项目新建、切换会话通过 `new_session` / `switch_session` RPC 切换上下文；跨项目返回时复用该项目的进程，恢复其历史、模型、思考设置和扩展来源。删除会话（包括最后一个会话）保留项目进程；切换或同步失败也保留已有进程，重试先核对实际会话状态。运行中新添加项目、手动重连、修改可执行文件或进程退出后允许按需连接，不显示「正在连接 pi」。停止或重连一个项目不会影响其他项目，关闭应用时清理全部子进程。扩展的 `session_start` 通知仍可能在会话切换时出现。

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

Tauri 2 + React/TypeScript + Vite + TanStack Router + Tailwind CSS 4 + Zustand + ahooks + Motion + HeroUI 3。桌面前端采用 React/Vite 静态资源；本版没有引入 Next.js 服务端运行时，避免与 Vite 的桌面资源管线重复。若后续增加独立 Web 服务，可再把需要 SSR 的页面放入 Next.js 应用。

- `src/router`：类型安全的路由树、Hash 历史和页面导航；URL 是当前页面的唯一来源，Zustand 只管理工作区状态。
- `src/routes`：聊天（`/`）、命令、扩展、用量和设置的独立路由定义，按需加载对应页面。
- `src/pages`：各页面的入口与内容，不再将整页放在组件目录。
- `src/layouts` / `src/hooks`：跨页面共享的工作台布局、弹窗、快捷键及桌面初始化生命周期。
- `src/components`：对话、输入、导航、浮层和其他界面组件。
- `src/styles`：`vendor.css` 加载 Tailwind/HeroUI，`index.scss` 按原有覆盖顺序汇总主题、基础样式和各功能模块。业务样式使用 SCSS，由 Vite 和 `sass-embedded` 编译；跨模块的深色、窗口尺寸和减少动态效果规则集中在 `_responsive.scss`。
- `src/store/workspace.ts`：工作区、草稿、偏好与持久化。
- `src/lib/desktop.ts`：前端 RPC 与运行状态管理。
- `src/lib/rpc.ts`：消息、工具结果、diff 和用量归一化。
- `src/lib/packages.ts`：扩展界面的类型与原生 command 调用，不直接访问 npm registry。
- `src-tauri/src/packages.rs` / `packages/registry.rs`：本地扩展配置、安装管理、npm 搜索、包详情、版本比较和批量检查更新。原生 HTTP 客户端复用连接，并设置连接和请求超时。
- `src-tauri/src/runtime.rs`：本机 pi 子进程、JSONL 请求关联、事件转发与退出清理。
- `tests/lib` / `tests/store`：对应 `src/lib` / `src/store` 的前端测试；`tests/scripts` 对应构建脚本；`src-tauri/tests` 保留 `src-tauri/src` 的模块层级，每个模块的测试文件统一命名为 `tests.rs`。Rust 通过仅测试时加载的模块引用这些文件，不暴露内部实现。
- `PRODUCT.md` / `DESIGN.md`：产品范围与模板约束。

## 验证

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm verify
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

`pnpm typecheck` 分别检查前端、构建脚本和测试；`pnpm verify` 只扫描 `tests/**/*.test.ts`。`pnpm lint` 使用 oxlint，覆盖前端、构建脚本、测试和 Vite/Vitest 配置；`pnpm lint:fix` 自动修复 lint 问题。`pnpm format` 使用 oxfmt 格式化代码，`pnpm format:check` 仅检查格式。Rust（包括 `src-tauri/tests`）继续使用 rustfmt，设计稿和生成文件不参与 oxfmt 格式化。包获取只在桌面端执行，浏览器预览不发起 registry 请求。

macOS 安装包：

```sh
pnpm package:mac
```

产物在 `src-tauri/target/release/bundle/dmg/`。GitHub Actions 的 `build` 仅支持手动运行：在 Actions → build → Run workflow 中选择分支，并填写必填的 `version`（如 `0.1.0` 或 `0.2.0-beta.1`，不带 `v` 前缀）。工作流执行类型检查、lint、全部前端测试、Rust fmt/Clippy/测试和前端生产构建；通过后使用填写的版本构建同时支持 Apple Silicon 与 Intel 的 universal DMG，上传到本次运行的 `pi-desktop-macos-<version>` artifact。随后发布任务自动创建 `v<version>` 标签和 GitHub Release，生成发布说明并附上本次构建的 DMG；标签指向本次运行的 commit，带预发布后缀的版本标记为 prerelease。已有 Release 不覆盖，已有同名标签若指向其他 commit 则拒绝发布，需要使用新版本号。仅发布任务拥有 `contents: write` 权限，使用内置 `GITHUB_TOKEN`，无需额外配置 PAT。版本通过临时 Tauri 配置覆盖，不修改仓库中的版本文件。Push、PR 和 tag 不自动触发。当前安装包不签名、不公证。本机 pi RPC 冒烟检查需要显式启用，不在 CI 中运行。

命令兼容验收固定 **Pi CLI v1.0.0**，使用隔离安装、临时配置和本机模拟模型端点。`pnpm verify:pi-v1` 分别验证扩展命令、Skills、Prompt Templates 的发现与执行，以及内置命令能力分类；Rust 冒烟测试验证同版本的真实 RPC、会话复用和内置目录读取。普通测试会明确标记这些集成测试为 skipped / ignored。安装和运行步骤见 [Pi v1.0.0 兼容验证](docs/implementation/pi-v1-compatibility.md)。

验收记录和视觉证据索引在 `docs/implementation/notes.md`。

## 当前边界

真实模型生成尚未执行端到端验收；请使用本机已有认证的模型运行实际任务。已验证本机 pi 的状态、模型、命令和用量读取，以及发送、错误与运行锁的前端协议行为。原生窗口已启动，视觉证据来自同一套前端的浏览器预览。

扩展安装/卸载、启停、会话树分叉、导入已有 pi 会话和自动更新尚未实现。macOS 安装包可由本机或 GitHub Actions 构建，但尚未签名或公证。扩展包视图目前读取配置来源，不能证明包成功加载。用量是本应用已打开会话的 pi 统计，不代表服务商账户余额或订阅额度。Windows/Linux 尚未验收。
