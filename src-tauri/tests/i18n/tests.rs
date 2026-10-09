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
