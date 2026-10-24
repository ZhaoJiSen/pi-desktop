//! Desktop-owned messages. Provider, tool, and extension output stays verbatim.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    LazyLock,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Language {
    Zh,
    En,
}

impl Language {
    pub fn from_locale(locale: &str) -> Self {
        let primary = locale
            .trim()
            .split(['-', '_', '.', '@'])
            .next()
            .unwrap_or_default();
        if primary.eq_ignore_ascii_case("zh") {
            Self::Zh
        } else {
            Self::En
        }
    }
}

pub fn system_locale() -> String {
    sys_locale::get_locale().unwrap_or_else(|| "en".into())
}

// The native process pool and its reader threads share the current UI language.
// This survives a webview refresh and can be changed without restarting pi.
static CHINESE: LazyLock<AtomicBool> =
    LazyLock::new(|| AtomicBool::new(Language::from_locale(&system_locale()) == Language::Zh));

pub fn set_language(locale: &str) {
    CHINESE.store(
        Language::from_locale(locale) == Language::Zh,
        Ordering::Relaxed,
    );
}

pub fn language() -> Language {
    if CHINESE.load(Ordering::Relaxed) {
        Language::Zh
    } else {
        Language::En
    }
}

macro_rules! messages {
    ($($key:ident => ($zh:literal, $en:literal)),+ $(,)?) => {
        #[derive(Clone, Copy, Debug)]
        pub enum Message { $($key),+ }

        impl Message {
            pub fn in_language(self, language: Language) -> &'static str {
                match (self, language) {
                    $((Self::$key, Language::Zh) => $zh,
                    (Self::$key, Language::En) => $en),+
                }
            }

            pub fn text(self) -> String { self.in_language(language()).into() }

            pub fn detail(self, error: impl std::fmt::Display) -> String {
                format!("{}: {error}", self.in_language(language()))
            }
        }

        #[cfg(test)]
        const ALL_MESSAGES: &[Message] = &[$(Message::$key),+];
    };
}

messages! {
    PiUpdateBusy => ("Pi 正在执行任务或其他操作，请稍后更新", "Pi is busy with a task or another operation. Try updating later"),
    PiUpdateCheck => ("无法检测 Pi 最新版本", "Could not check the latest Pi version"),
    PiUpdateFailed => ("Pi 更新失败", "Pi update failed"),
    PiUpdateTimeout => ("Pi 更新超时，请检查网络后重试", "Pi update timed out. Check your connection and retry"),
    PiUpdateVerify => ("更新后 Pi 版本未达到预期，请手动检查安装", "The updated Pi version is older than expected. Check the installation manually"),
    PiUpdateChanged => ("Pi 路径或会话已变化，请重新检测后更新", "The Pi path or session changed. Check again before updating"),
    HomeDirectory => ("无法读取用户主目录", "Could not read the home directory"),
    CurrentDirectory => ("无法读取当前目录", "Could not read the current directory"),
    OpenProject => ("无法打开项目目录", "Could not open the project directory"),
    ChooseProject => ("请选择项目文件夹", "Choose a project folder"),
    RevealProject => ("无法显示项目目录", "Could not reveal the project directory"),
    RevealProjectMissing => ("无法显示项目目录，请检查文件夹是否存在。", "Could not reveal the project directory. Check that the folder exists."),
    BackgroundTask => ("后台操作失败", "The background operation failed"),
    PackageArguments => ("扩展包操作参数无效", "Invalid package operation"),
    PackageBusy => ("另一个扩展包操作正在进行，请稍后重试", "Another package operation is in progress. Try again shortly"),
    PackageAction => ("扩展包操作失败", "Package operation failed"),
    PackageTimeout => ("扩展包操作超时，请重试", "Package operation timed out. Try again"),
    PackageRegistry => ("无法获取扩展信息，请重试", "Could not fetch package information. Try again"),
    PackageMetadata => ("扩展包元数据格式错误", "Invalid package metadata"),
    ReadExtensions => ("无法读取扩展配置", "Could not read the extension settings"),
    WriteExtensions => ("无法保存扩展配置", "Could not save extension settings"),
    InvalidExtensions => ("扩展配置格式错误", "Invalid extension settings"),
    AppStart => ("无法启动 pi Desktop", "Could not start pi Desktop"),
    RuntimeState => ("pi 运行状态无法读取，请重新连接", "Could not read the pi runtime state. Please reconnect"),
    CheckProcess => ("无法读取 pi 进程状态", "Could not read the pi process status"),
    ProcessExited => ("pi 进程已退出，请重新连接", "The pi process has exited. Please reconnect"),
    SessionChanged => ("pi 会话已切换，请重新连接", "The pi session has changed. Please reconnect"),
    PiNotFound => ("找不到 pi，请在设置中选择 pi 可执行文件路径", "Could not find pi. Set its executable path in Settings"),
    EnvironmentCheck => ("无法运行版本检查，请确认文件可执行且 Pi CLI 的运行环境已安装", "Could not run the version check. Verify executable permissions and the Pi CLI runtime installation"),
    PiEnvironmentMissing => ("找不到 Pi CLI，请确认安装并检查可执行文件路径，再重新检测", "Could not find Pi CLI. Check its installation and executable path, then check again"),
    PiRpcCheck => ("Pi 版本可读取，但只读 RPC 检查失败或超时。请检查运行环境后重新检测", "Pi reports a version, but the read-only RPC check failed or timed out. Check the runtime and retry"),
    PiAlreadyInstalled => ("已发现 Pi，请重新检测并使用已有安装，避免重复安装", "Pi was found. Check again and use the existing installation"),
    PiNodeRequired => ("安装需要 Node.js 22.19.0 或更高版本，请先安装 Node.js，再重新检测", "Installation requires Node.js 22.19.0 or newer. Install Node.js, then check again"),
    PiNpmRequired => ("找不到 npm，请安装包含 npm 的 Node.js 后重试", "Could not find npm. Install Node.js with npm and retry"),
    PiInstallConsent => ("请重新查看安装命令并确认安装", "Review the installation command again and confirm installation"),
    PiInstallFailed => ("Pi 安装失败，请检查网络或目录权限后重试", "Pi installation failed. Check the network or directory permissions and retry"),
    PiInstallTimeout => ("Pi 安装超时（5 分钟），请检查网络后重试", "Pi installation timed out after 5 minutes. Check the network and retry"),
    PiInstallVerify => ("安装后的版本或 RPC 检查未通过，请重新检测，或手动指定可用的 Pi 路径", "The installed version or RPC check did not pass. Check again or choose a working Pi executable"),
    PiInstallDirectory => ("安装目录已有其他文件，请使用手动安装或指定已有 Pi 路径", "The installation directory contains other files. Install manually or choose an existing Pi executable"),
    PiInstallCancelled => ("应用正在退出，安装已停止。下次打开时可重新检测并重试", "Installation stopped because the app is closing. Check again and retry on the next launch"),
    EnvironmentTimeout => ("环境检测超时，请在终端运行 pi --version 后重试", "Environment check timed out. Run pi --version in a terminal and retry"),
    InvalidPiExecutable => ("版本输出不是有效的 Pi CLI 版本，请选择 pi 可执行文件", "The version output is not a valid Pi CLI version. Choose the pi executable"),
    CreateWorkspace => ("无法创建默认工作区，请选择可写入的项目目录", "Could not create the default workspace. Choose a writable project folder"),
    StartPi => ("无法启动 pi", "Could not start pi"),
    Stdin => ("pi 输入管道无法打开", "Could not open the pi input pipe"),
    Stdout => ("pi 输出管道无法打开", "Could not open the pi output pipe"),
    Stderr => ("pi 错误管道无法打开", "Could not open the pi error pipe"),
    SessionClosed => ("pi 会话已关闭", "The pi session has closed"),
    UnsupportedCommand => ("此 pi 命令不受桌面端支持", "This pi command is not supported by the desktop app"),
    MissingId => ("请求缺少关联 ID", "The request is missing a correlation ID"),
    SendPi => ("无法发送到 pi", "Could not send the request to pi"),
    RequestTimeout => ("pi 请求超时，请检查连接后重试", "The pi request timed out. Check the connection and retry"),
    RequestFailed => ("pi 请求失败", "The pi request failed"),
    GitUnavailable => ("找不到 git，无法读取仓库", "Could not find git"),
    SourceOutside => ("路径超出项目目录", "That path is outside the project"),
    SourceRead => ("无法读取项目文件", "Could not read the project file"),
    SourceList => ("无法读取项目目录", "Could not read the project folder"),
    GitBranchChanged => ("分支状态已改变，请重新打开操作确认", "Branch state changed. Reopen the operation and confirm again"),
    GitBranchDirty => ("请先提交或 stash 工作区改动", "Commit or stash working tree changes first"),
    GitOperationPending => ("请先完成或中止正在进行的 Git 操作", "Finish or abort the Git operation in progress first"),
    GitBranchName => ("分支名称无效", "Invalid branch name"),
    GitRead => ("无法读取 Git 仓库", "Could not read the Git repository"),
}

#[cfg(test)]
#[path = "../tests/i18n/tests.rs"]
mod tests;
