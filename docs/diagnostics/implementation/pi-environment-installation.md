# Pi 环境检测与首次安装（AAR-10）

首次引导的「连接 Pi」步骤自动诊断当前配置的可执行文件，保留手动路径和已有配置。普通 `check_pi_environment` 继续用于版本读取；引导页使用 `inspect_pi_environment` 追加只读 RPC 检查。

- PATH 不足时补充 Volta、Homebrew、`~/.local/bin`、NVM 已安装版本及 Pi Desktop 独立安装目录。显式配置错误时不静默替换路径，展示找到的安装并由用户选择。
- 区分未找到、路径问题、运行环境错误、低于基线、不通过 RPC；Pi 1.0.0 标为已验证，新版本标为尚未完整验证。
- RPC 使用离线、无会话、无扩展、无上下文文件的进程，仅查询 `get_state` 和 `get_available_models`。认证提示表示 Pi 报告的模型凭证可用性，不代表联网验证或账号有效性。桌面端不读取、复制或显示密钥，不调用模型。

## 确认安装

通过 `prepare_pi_install` 预览来源、版本、Node 版本、目录和完整参数；在 AlertDialog 中展示安装方案，点击「确认并安装」后才调用 `install_pi`。弹窗外点击不关闭；安装与复检期间禁止关闭，底部操作始终可见，较长内容在弹窗内滚动。原生进程持有十分钟有效、一次性消费的安装方案，拒绝缺少确认、过期及重复请求。确认时再次检查已有安装和原生连接，并与启动、更新、扩展操作互斥。

默认包：`@earendil-works/pi-coding-agent@1.0.0`，registry 固定为 `https://registry.npmjs.org`。采用 [Pi 官方 npm 安装方式](https://pi.dev/docs/latest/quickstart)，要求 Node.js 22.19.0 以上及 npm，并设置 `--ignore-scripts`。用已解析的 Node 执行 npm JS 入口，参数分开传入，不调用 shell、远程脚本或管理员提权。

安装在 `~/.local/share/pi-desktop/pi-cli`，不覆盖全局 CLI、不修改 PATH 或用户认证配置。目录标记用于安全重试应用自己的不完整安装；已有其他文件或符号链接的目录不被接管。成功后验证实际版本恰好是审核的 1.0.0，并验证 RPC，才更新引导页可用状态。用户确认项目进入工作区后，沿用现有连接流程自动连接。

更新时仅对具有应用所有权标记、路径匹配的独立安装使用 npm，在原 prefix 中安装检测到的确切目标版本，并沿用固定 registry、禁用脚本及超时、版本复检保护；其他来源继续交给目标 Pi 的 `update --self`。Node/npm 由 Volta 管理时，通过同目录的 `volta which --quiet` 解析真实入口，用验证后的 Node 执行 npm JS，不猜测 Volta 的版本目录。

stdout/stderr 实时显示，原生错误尾部限制 32 KiB，界面保留最近 32K 字符，使用无百分比进度条展示安装、复检状态。五分钟超时；退出应用会终止安装进程组。失败后保留路径、输出和原因，重试需重新查看安装方案，也可以手动安装或重新检测。

## 验证

- 前端：`tests/pages/OnboardingPage.test.ts`、`tests/lib/onboarding.test.ts`，覆盖确认前不安装、取消、进度、互斥、失败重试、路径恢复、未验证版本和缺少认证；保留升级及启动提醒回归。
- 原生：`src-tauri/tests/environment/tests.rs`，模拟 CLI/npm 验证版本、只读 RPC、输出、超时、确认令牌、忙碌拒绝、独立目录保护、安装后复检；普通测试不执行真实安装。
- 实机基线：临时目录安装 1.0.0，隔离 HOME、agent 目录及认证环境变量，执行生产 Rust 诊断；逐字节核对既有 `auth.json` 和 `settings.json` 未变。继续运行 `docs/implementation/pi-v1-compatibility.md` 的真实命令与多项目 RPC 回归。
- 浏览器预览使用真实 React/HeroUI 组件和模拟原生接口，检查中英、深浅主题、确认、进度和成功状态。预览不安装或更新机器上的 Pi。

当前实测平台为 macOS；其他操作系统未进行原生端到端验证。
