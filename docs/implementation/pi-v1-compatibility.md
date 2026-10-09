# Pi CLI v1.0.0 兼容验证

验收基线固定为 `@earendil-works/pi-coding-agent@1.0.0`，测试同时核对包版本和 CLI `--version`，不使用本机默认 `pi`。本次验证日期：2026-10-09。

本次实测结果：6 项真实 CLI 命令测试、3 项原生集成测试均通过；普通验证另有 146 项前端测试、22 项 Rust 测试通过，类型检查及 lint 通过。集成测试由独立命令实际执行，未把 skipped / ignored 计入通过数量。

## 隔离安装

```sh
pi_v1_prefix="$(mktemp -d)"
npm install --prefix "$pi_v1_prefix" --no-audit --no-fund --ignore-scripts --save-exact @earendil-works/pi-coding-agent@1.0.0
pi_v1_root="$pi_v1_prefix/node_modules/@earendil-works/pi-coding-agent"
```

安装位于临时目录，不修改现有 Pi 可执行文件、用户配置或扩展版本。建议保留安装目录中的 npm lockfile，以便复现依赖。

## 命令发现与执行

从仓库根目录执行：

```sh
PI_DESKTOP_PI_V1_ROOT="$pi_v1_root" pnpm verify:pi-v1
```

测试文件：`tests/compat/pi-v1.test.ts`。每次建立临时 HOME、agent 目录、项目及测试资源，测试结束后删除。子进程只继承 PATH 和隔离配置，不继承用户的模型认证环境变量。模型调用只访问测试创建的 `127.0.0.1` HTTP 端点，不访问外部模型服务。

验证范围：

- 从真实 `get_commands` 结果分别发现测试扩展命令、提示词模板及 `skill:` 技能，保留运行时来源路径；插入草稿时保留名称及参数。
- 从实际 v1.0.0 安装读取 24 个内置定义；`compact` 映射 RPC，`settings/model/thinking/session` 映射桌面操作，其余保守标记 TUI，不作为普通 prompt 插入。
- 扩展 Slash Command 由真实 Pi handler 处理，返回 `disposition: handled`，不发起模型运行。
- Prompt Template 在模型运行前完成 `$1` 参数替换，验证发给本机端点的实际正文及 `agent_settled`。
- Skill 在模型运行前展开文件正文并保留参数，作为独立的模型运行验证。
- 删除扩展文件后，旧进程仍显示已加载命令；重新启动 Pi 后该命令消失，模板与技能仍可发现。Pi 自带的扩展命令可以继续存在，因此不把“移除测试扩展”等同于“所有扩展命令为空”。

没有设置版本路径时，普通 `pnpm verify` 明确跳过这组集成测试。直接运行 `pnpm verify:pi-v1` 缺少路径则报错，避免把 skipped 当成验收通过。

## 原生只读 RPC 与目录测试

建立一个独立空 agent 目录，然后运行：

```sh
pi_v1_agent="$(mktemp -d)"
PI_DESKTOP_PI_V1_ROOT="$pi_v1_root" \
PI_DESKTOP_PI_V1_EXECUTABLE="$pi_v1_prefix/node_modules/.bin/pi" \
PI_CODING_AGENT_DIR="$pi_v1_agent" \
cargo test --manifest-path src-tauri/Cargo.toml --lib -- --ignored --nocapture
```

三个原生集成测试验证：

- 生产 Rust 目录解析器读取真实 v1.0.0 内置定义及参数提示。
- 生产 Runtime 通过真实子进程读取状态、模型、命令和用量；拒绝过期会话及不允许的 RPC。
- 复用同项目进程、隔离多项目历史、重新附着事件通道，并验证停止单个项目不影响其他项目。

这些测试不调用模型，使用 `--no-session` 和临时历史文件。普通 Rust 测试通过 `#[ignore]` 明确报告未运行的集成测试，替代早退后显示 passed 的旧方式。

## 扩展检测回归

`tests/components/packageChecks.test.ts` 在 React StrictMode 中验证：自动检测 → 手动强制检测 → 发现/已安装切换 → 再次手动检测 → 重新挂载。每次手动操作只产生一次新请求，之后复用缓存；同时检查全部失败及部分失败的实际汇总文案。DOM 环境使用测试依赖 happy-dom。

`tests/lib/packageUpdates.test.ts` 验证缓存时效、并发限制及全部失败、部分成功、空列表、固定版本和无法比较版本的汇总状态。

本验证不覆盖第三方扩展的全部行为、付费模型服务或 AAR-21 中其他未涉及的 RPC 功能。
