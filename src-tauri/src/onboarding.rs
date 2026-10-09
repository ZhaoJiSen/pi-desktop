//! Read-only CLI checks and an explicitly requested default workspace.
use crate::{i18n::Message, runtime::runtime_path};
use serde::Serialize;
use std::{
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentCheck {
    executable: String,
    version: String,
    node_version: Option<String>,
    default_workspace: String,
}

pub(crate) fn resolve_executable(executable: &str, home: &Path) -> Result<PathBuf, String> {
    let value = executable.trim();
    let expanded = if value == "~" || value.starts_with("~/") {
        home.join(value.trim_start_matches('~').trim_start_matches('/'))
    } else {
        PathBuf::from(value)
    };
    let path = if expanded.components().count() > 1 || expanded.is_absolute() {
        expanded
    } else {
        std::env::split_paths(&runtime_path(home))
            .map(|dir| {
                dir.join(if cfg!(windows) && value == "pi" {
                    "pi.cmd"
                } else {
                    value
                })
            })
            .find(|path| path.is_file())
            .ok_or_else(|| Message::PiNotFound.text())?
    };
    if !path.is_file() {
        return Err(Message::PiNotFound.text());
    }
    // Preserve symlinks (Volta and other tool managers dispatch by argv[0]).
    Ok(path)
}

fn version_output(binary: &Path, home: &Path, timeout: Duration) -> Result<String, String> {
    let mut command = Command::new(binary);
    command
        .arg("--version")
        .env("PATH", runtime_path(home))
        .env("NO_COLOR", "1")
        .current_dir(home)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .spawn()
        .map_err(|e| Message::EnvironmentCheck.detail(e))?;
    let stdout = child.stdout.take();
    let reader = std::thread::spawn(move || {
        let mut output = String::new();
        if let Some(stream) = stdout {
            let _ = stream.take(8192).read_to_string(&mut output);
        }
        output
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < timeout => {
                std::thread::sleep(Duration::from_millis(25))
            }
            result => {
                #[cfg(unix)]
                unsafe {
                    libc::kill(-(child.id() as i32), libc::SIGKILL);
                }
                let _ = child.kill();
                let _ = child.wait();
                return Err(match result {
                    Err(error) => Message::EnvironmentCheck.detail(error),
                    _ => Message::EnvironmentTimeout.text(),
                });
            }
        }
    };
    // A wrapper may leave children holding stdout after it exits; bound the read too.
    while !reader.is_finished() {
        if started.elapsed() >= timeout {
            #[cfg(unix)]
            unsafe {
                libc::kill(-(child.id() as i32), libc::SIGKILL);
            }
            return Err(Message::EnvironmentTimeout.text());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let output = reader.join().unwrap_or_default().trim().to_owned();
    if !status.success() || output.is_empty() {
        return Err(Message::EnvironmentCheck.text());
    }
    Ok(output)
}

fn check_environment(executable: &str, home: &Path) -> Result<EnvironmentCheck, String> {
    let binary =
        resolve_executable(executable, home).map_err(|_| Message::PiEnvironmentMissing.text())?;
    let version = version_output(&binary, home, Duration::from_secs(8))?;
    if semver::Version::parse(&version).is_err() {
        return Err(Message::InvalidPiExecutable.text());
    }
    Ok(EnvironmentCheck {
        executable: binary.to_string_lossy().into_owned(),
        version,
        node_version: resolve_executable("node", home)
            .ok()
            .and_then(|node| version_output(&node, home, Duration::from_secs(3)).ok()),
        default_workspace: home.join("Pi Desktop").to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub async fn check_pi_environment(
    app: tauri::AppHandle,
    executable: String,
) -> Result<EnvironmentCheck, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    tauri::async_runtime::spawn_blocking(move || check_environment(&executable, &home))
        .await
        .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
pub async fn default_workspace(app: tauri::AppHandle, create: bool) -> Result<String, String> {
    let path = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?
        .join("Pi Desktop");
    tauri::async_runtime::spawn_blocking(move || {
        if create {
            std::fs::create_dir_all(&path).map_err(|e| Message::CreateWorkspace.detail(e))?;
        }
        Ok(path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[cfg(test)]
#[path = "../tests/onboarding/tests.rs"]
mod tests;
