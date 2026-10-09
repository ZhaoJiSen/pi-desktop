pub(crate) mod registry;

use crate::{i18n::Message, project_path, runtime::runtime_path};
use std::{
    path::PathBuf,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::Manager;
static PACKAGE_OPERATION: std::sync::Mutex<()> = std::sync::Mutex::new(());
use serde_json::{json, Value};

fn npm_name(source: &str) -> Option<&str> {
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

fn package_args(action: &str, source: &str, scope: &str) -> Result<Vec<String>, String> {
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

#[tauri::command]
pub async fn manage_extension_package(
    app: tauri::AppHandle,
    action: String,
    source: String,
    scope: String,
    path: String,
    executable: String,
) -> Result<(), String> {
    let args = package_args(&action, &source, &scope)?;
    let cwd = project_path(&app, &path)?;
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        let _operation = PACKAGE_OPERATION
            .try_lock()
            .map_err(|_| Message::PackageBusy.text())?;
        let search_path = runtime_path(&home);
        let binary = if executable == "pi" {
            std::env::split_paths(&search_path)
                .map(|dir| dir.join(if cfg!(windows) { "pi.cmd" } else { "pi" }))
                .find(|path| path.is_file())
                .ok_or_else(|| Message::PiNotFound.text())?
        } else {
            PathBuf::from(executable)
        };
        let mut command = Command::new(binary);
        command
            .args(args)
            .env("PATH", search_path)
            .env("NO_COLOR", "1")
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = command
            .spawn()
            .map_err(|e| Message::PackageAction.detail(e))?;
        // Drain stderr concurrently so subprocess output cannot fill its pipe.
        let stderr = child.stderr.take();
        let reader = std::thread::spawn(move || {
            use std::io::Read;
            let mut message = String::new();
            if let Some(mut stream) = stderr {
                let _ = stream.read_to_string(&mut message);
            }
            message
        });
        let started = Instant::now();
        loop {
            match child
                .try_wait()
                .map_err(|e| Message::PackageAction.detail(e))?
            {
                Some(status) => {
                    let detail = reader.join().unwrap_or_default();
                    return if status.success() {
                        Ok(())
                    } else {
                        Err(Message::PackageAction.detail(detail.trim()))
                    };
                }
                None if started.elapsed() > Duration::from_secs(180) => {
                    #[cfg(unix)]
                    unsafe {
                        libc::kill(-(child.id() as i32), libc::SIGKILL);
                    }
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(Message::PackageTimeout.text());
                }
                None => std::thread::sleep(Duration::from_millis(100)),
            }
        }
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
pub async fn open_extension_page(url: String) -> Result<(), String> {
    // This entry point opens only the official directory, never arbitrary schemes.
    if url != "https://pi.dev/packages" && !url.starts_with("https://pi.dev/packages/") {
        return Err(Message::PackageArguments.text());
    }
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        let status = Command::new("open").arg(url).status();
        #[cfg(target_os = "windows")]
        let status = Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .status();
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let status = Command::new("xdg-open").arg(url).status();
        if status
            .map_err(|e| Message::PackageAction.detail(e))?
            .success()
        {
            Ok(())
        } else {
            Err(Message::PackageAction.text())
        }
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
pub async fn extension_packages(app: tauri::AppHandle, path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let home = app
            .path()
            .home_dir()
            .map_err(|e| Message::HomeDirectory.detail(e))?;
        let project = project_path(&app, &path)?;
        let agent_dir = std::env::var_os("PI_CODING_AGENT_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".pi/agent"));
        let mut packages = Vec::new();
        for (file, scope) in [
            (agent_dir.join("settings.json"), "global"),
            (project.join(".pi/settings.json"), "project"),
        ] {
            if !file.exists() {
                continue;
            }
            let text =
                std::fs::read_to_string(file).map_err(|e| Message::ReadExtensions.detail(e))?;
            let settings: Value =
                serde_json::from_str(&text).map_err(|e| Message::InvalidExtensions.detail(e))?;
            if let Some(entries) = settings.get("packages").and_then(Value::as_array) {
                for entry in entries {
                    if let Some(source) = entry
                        .as_str()
                        .or_else(|| entry.get("source").and_then(Value::as_str))
                    {
                        let mut package = json!({ "source": source, "scope": scope });
                        if let Some(name) = npm_name(source) {
                            let roots = if scope == "project" {
                                vec![project.join(".pi/npm/node_modules").join(name)]
                            } else {
                                vec![
                                    agent_dir.join("npm/node_modules").join(name),
                                    home.join(".volta/tools/image/packages")
                                        .join(name)
                                        .join("lib/node_modules")
                                        .join(name),
                                    PathBuf::from("/opt/homebrew/lib/node_modules").join(name),
                                    PathBuf::from("/usr/local/lib/node_modules").join(name),
                                ]
                            };
                            for root in roots {
                                let manifest = std::fs::read_to_string(root.join("package.json"))
                                    .ok()
                                    .and_then(|text| serde_json::from_str::<Value>(&text).ok());
                                if let Some(manifest) = manifest {
                                    for key in ["version", "description"] {
                                        if let Some(value) =
                                            manifest.get(key).and_then(Value::as_str)
                                        {
                                            package[key] = json!(value);
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                        packages.push(package);
                    }
                }
            }
        }
        // Return only package sources, never authentication or other settings.
        Ok(json!(packages))
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[cfg(test)]
#[path = "../tests/packages/tests.rs"]
mod tests;
