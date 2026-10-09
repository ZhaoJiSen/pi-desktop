//! Read command definitions from the configured Pi installation, without executing JS.
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::Manager;

fn quoted_field(line: &str, key: &str) -> Option<String> {
    let rest = line.split_once(&format!("{key}: "))?.1;
    if !rest.starts_with('"') {
        return None;
    }
    let mut escaped = false;
    for (i, c) in rest.char_indices().skip(1) {
        if c == '"' && !escaped {
            return serde_json::from_str(&rest[..=i]).ok();
        }
        escaped = c == '\\' && !escaped;
    }
    None
}

fn read_catalog(root: &Path) -> Option<Vec<Value>> {
    let text = std::fs::read_to_string(root.join("dist/core/slash-commands.js")).ok()?;
    if !text.contains("BUILTIN_SLASH_COMMANDS") {
        return None;
    }
    let commands = text
        .lines()
        .filter_map(|line| {
            let name = quoted_field(line, "name")?;
            Some(
                json!({ "name": name, "description": quoted_field(line, "description"),
            "argumentHint": quoted_field(line, "argumentHint"), "source": "builtin" }),
            )
        })
        .collect();
    Some(commands)
}

#[tauri::command]
pub async fn builtin_commands(
    app: tauri::AppHandle,
    executable: String,
) -> Result<Vec<Value>, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| crate::i18n::Message::HomeDirectory.detail(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut roots = Vec::new();
        let executable_path = if executable == "pi" {
            std::env::split_paths(&crate::runtime::runtime_path(&home))
                .map(|p| p.join(if cfg!(windows) { "pi.cmd" } else { "pi" }))
                .find(|p| p.is_file())
        } else {
            Some(PathBuf::from(&executable))
        };
        if let Some(path) = executable_path.and_then(|p| p.canonicalize().ok()) {
            roots.extend(path.ancestors().take(6).map(Path::to_path_buf));
        }
        if executable == "pi" {
            // Volta uses a shim rather than a symlink to its installed package.
            for name in [
                "@earendil-works/pi-coding-agent",
                "@mariozechner/pi-coding-agent",
            ] {
                roots.push(
                    home.join(".volta/tools/image/packages")
                        .join(name)
                        .join("lib/node_modules")
                        .join(name),
                );
                for prefix in [
                    home.join(".npm-global/lib"),
                    PathBuf::from("/opt/homebrew/lib"),
                    PathBuf::from("/usr/local/lib"),
                ] {
                    roots.push(prefix.join("node_modules").join(name));
                }
            }
        }
        Ok(roots
            .iter()
            .find_map(|root| read_catalog(root))
            .unwrap_or_default())
    })
    .await
    .map_err(|e| crate::i18n::Message::BackgroundTask.detail(e))?
}

#[cfg(test)]
#[path = "../tests/commands/tests.rs"]
mod tests;
