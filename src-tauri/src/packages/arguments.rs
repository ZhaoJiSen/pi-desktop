use crate::i18n::Message;
use serde_json::{json, Value};

pub(super) fn npm_name(source: &str) -> Option<&str> {
    let spec = source.strip_prefix("npm:")?;
    let name = match spec.rfind('@') {
        Some(index) if index > 0 => {
            let version = &spec[index + 1..];
            if version.is_empty()
                || version
                    .chars()
                    .any(|c| c.is_whitespace() || c.is_control() || c == '@')
            {
                return None;
            }
            &spec[..index]
        }
        _ => spec,
    };
    let valid = |part: &str| {
        !part.is_empty()
            && !part.starts_with(['.', '-'])
            && part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
    };
    if name.len() > 214 {
        return None;
    }
    let accepted = if let Some(scoped) = name.strip_prefix('@') {
        scoped
            .split_once('/')
            .is_some_and(|(scope, package)| valid(scope) && valid(package))
    } else {
        valid(name)
    };
    accepted.then_some(name)
}

pub(super) fn package_args(action: &str, source: &str, scope: &str) -> Result<Vec<String>, String> {
    if !["install", "update", "remove"].contains(&action)
        || !["global", "project"].contains(&scope)
        || source.trim() != source
        || source.is_empty()
        || source.starts_with('-')
        || (action == "update" && ["pi", "self"].contains(&source))
        || source.chars().any(char::is_control)
    {
        return Err(Message::PackageArguments.text());
    }
    let mut args = vec![action.to_owned(), source.to_owned()];
    // A source-targeted update works with older and current pi releases. Never run
    // a bare `pi update`, which newer releases may interpret as updating pi itself.
    if scope == "project" && action != "update" {
        args.push("-l".into());
    }
    Ok(args)
}

pub(super) fn toggle_package(
    settings: &mut Value,
    source: &str,
    enabled: bool,
) -> Result<(), String> {
    let entries = settings
        .get_mut("packages")
        .and_then(Value::as_array_mut)
        .ok_or_else(|| Message::InvalidExtensions.text())?;
    let entry = entries
        .iter_mut()
        .find(|entry| {
            entry
                .as_str()
                .or_else(|| entry.get("source").and_then(Value::as_str))
                == Some(source)
        })
        .ok_or_else(|| Message::PackageArguments.text())?;
    if enabled {
        if let Some(original) = entry.get("piDesktopDisabledOriginal").cloned() {
            *entry = original;
        }
    } else if entry.get("piDesktopDisabledOriginal").is_none() {
        let original = entry.clone();
        *entry = json!({ "source": source, "extensions": [], "skills": [], "prompts": [], "themes": [], "piDesktopDisabledOriginal": original });
    }
    Ok(())
}
