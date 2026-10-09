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
    HomeDirectory => ("无法读取用户主目录", "Could not read the home directory"),
    CurrentDirectory => ("无法读取当前目录", "Could not read the current directory"),
    OpenProject => ("无法打开项目目录", "Could not open the project directory"),
    ChooseProject => ("请选择项目文件夹", "Choose a project folder"),
    RevealProject => ("无法显示项目目录", "Could not reveal the project directory"),
    RevealProjectMissing => ("无法显示项目目录，请检查文件夹是否存在。", "Could not reveal the project directory. Check that the folder exists."),
    BackgroundTask => ("后台操作失败", "The background operation failed"),
    ReadExtensions => ("无法读取扩展配置", "Could not read the extension settings"),
    InvalidExtensions => ("扩展配置格式错误", "Invalid extension settings"),
    AppStart => ("无法启动 pi Desktop", "Could not start pi Desktop"),
    RuntimeState => ("pi 运行状态无法读取，请重新连接", "Could not read the pi runtime state. Please reconnect"),
    CheckProcess => ("无法读取 pi 进程状态", "Could not read the pi process status"),
    ProcessExited => ("pi 进程已退出，请重新连接", "The pi process has exited. Please reconnect"),
    SessionChanged => ("pi 会话已切换，请重新连接", "The pi session has changed. Please reconnect"),
    PiNotFound => ("找不到 pi，请在设置中选择 pi 可执行文件路径", "Could not find pi. Set its executable path in Settings"),
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_chinese_locales_select_chinese() {
        for locale in [
            "zh",
            "zh-CN",
            "zh-Hant-TW",
            "zh_HK.UTF-8",
            "ZH-sg",
            " zh-MO ",
        ] {
            assert_eq!(Language::from_locale(locale), Language::Zh);
        }
        for locale in [
            "", "en", "en-US", "ja-JP", "fr-FR", "C", "C.UTF-8", "zhuang", "zhong",
        ] {
            assert_eq!(Language::from_locale(locale), Language::En);
        }
    }

    #[test]
    fn every_native_message_has_both_languages() {
        for message in ALL_MESSAGES {
            let en = message.in_language(Language::En);
            let zh = message.in_language(Language::Zh);
            assert!(
                !en.is_empty() && en.is_ascii(),
                "{message:?} needs English text"
            );
            assert!(
                !zh.is_empty() && !zh.is_ascii(),
                "{message:?} needs Chinese text"
            );
        }
    }

    #[test]
    fn native_errors_follow_language_changes_without_replacing_runtime() {
        let previous = language();
        let runtime = crate::runtime::Runtime::default();
        for (locale, expected) in [
            ("ja-JP", "The pi session has changed. Please reconnect"),
            ("zh-CN", "pi 会话已切换，请重新连接"),
        ] {
            set_language(locale);
            let error = runtime
                .request(
                    "missing",
                    serde_json::json!({ "id": "test", "type": "get_state" }),
                )
                .unwrap_err();
            assert_eq!(error, expected);
            let missing_id = runtime
                .request("missing", serde_json::json!({ "type": "get_state" }))
                .unwrap_err();
            assert_eq!(missing_id, Message::MissingId.text());
            assert!(Message::OpenProject
                .detail("fixture detail")
                .ends_with(": fixture detail"));
        }
        set_language(if previous == Language::Zh { "zh" } else { "en" });
    }
}
