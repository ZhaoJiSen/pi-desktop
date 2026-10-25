//! Desktop app updates. Pi CLI updates remain in `updates`.
use crate::{i18n::Message, packages::PACKAGE_OPERATION, runtime::Runtime};
use serde::Serialize;
use std::{path::Path, sync::Mutex, time::Duration};
use tauri::{Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

const EVENT: &str = "desktop-update";

fn is_update_installation(executable: &Path, development: bool) -> bool {
    if development {
        return false;
    }
    if cfg!(target_os = "macos") {
        let Some(macos) = executable.parent() else {
            return false;
        };
        let Some(contents) = macos.parent() else {
            return false;
        };
        macos.file_name().is_some_and(|name| name == "MacOS")
            && contents.file_name().is_some_and(|name| name == "Contents")
            && contents
                .parent()
                .and_then(Path::extension)
                .is_some_and(|extension| extension == "app")
    } else {
        true
    }
}

fn ensure_update_installation() -> Result<(), String> {
    let executable = tauri::utils::platform::current_exe()
        .map_err(|error| Message::DesktopUpdateInstall.detail(error))?;
    if is_update_installation(&executable, tauri::is_dev() || cfg!(debug_assertions)) {
        Ok(())
    } else {
        Err(Message::DesktopUpdateUnavailable.text())
    }
}

fn with_installation_guard(
    runtime: &Runtime,
    packages: &Mutex<()>,
    install: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let _maintenance = runtime.maintenance()?;
    let _packages = packages
        .try_lock()
        .map_err(|_| Message::PackageBusy.text())?;
    runtime.idle_sessions()?;
    install()
}

#[derive(Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
enum Phase {
    #[default]
    Checking,
    Idle,
    Available,
    Downloading,
    Ready,
    Installing,
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    revision: u64,
    phase: Phase,
    version: Option<String>,
    current_version: Option<String>,
    notes: Option<String>,
    downloaded: u64,
    total: Option<u64>,
    error: Option<String>,
}

#[derive(Default)]
struct Inner {
    status: UpdateStatus,
    update: Option<Update>,
    bytes: Option<Vec<u8>>,
}

#[derive(Default)]
pub struct DesktopUpdates(Mutex<Inner>);

impl DesktopUpdates {
    fn change<T>(
        &self,
        app: &tauri::AppHandle,
        change: impl FnOnce(&mut Inner) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut inner = self.0.lock().map_err(|_| Message::RuntimeState.text())?;
        let value = change(&mut inner)?;
        inner.status.revision += 1;
        // Emit under the lock so progress and completion events preserve their order.
        let _ = app.emit(EVENT, &inner.status);
        Ok(value)
    }
}

pub async fn check_on_startup(app: tauri::AppHandle) {
    if ensure_update_installation().is_err() {
        let _ = app.state::<DesktopUpdates>().change(&app, |inner| {
            inner.status.phase = Phase::Idle;
            Ok(())
        });
        return;
    }
    let result = async {
        app.updater_builder()
            .timeout(Duration::from_secs(20))
            .build()?
            .check()
            .await
    }
    .await;
    let _ = app.state::<DesktopUpdates>().change(&app, |inner| {
        match result {
            Ok(Some(update)) => {
                inner.status.phase = Phase::Available;
                inner.status.version = Some(update.version.clone());
                inner.status.current_version = Some(update.current_version.clone());
                inner.status.notes = update.body.clone();
                inner.update = Some(update);
            }
            Ok(None) => inner.status.phase = Phase::Idle,
            Err(error) => {
                // Offline startup and missing releases must never interrupt the workspace.
                eprintln!("Desktop update check failed: {error}");
                inner.status.phase = Phase::Idle;
            }
        }
        Ok(())
    });
}

#[tauri::command]
pub fn desktop_update_status(updates: State<'_, DesktopUpdates>) -> Result<UpdateStatus, String> {
    updates
        .0
        .lock()
        .map(|inner| inner.status.clone())
        .map_err(|_| Message::RuntimeState.text())
}

#[tauri::command]
pub async fn download_desktop_update(app: tauri::AppHandle) -> Result<(), String> {
    ensure_update_installation()?;
    let updates = app.state::<DesktopUpdates>();
    let update = updates.change(&app, |inner| {
        if inner.status.phase != Phase::Available {
            return Err(Message::DesktopUpdateUnavailable.text());
        }
        let update = inner
            .update
            .clone()
            .ok_or_else(|| Message::DesktopUpdateUnavailable.text())?;
        inner.status.phase = Phase::Downloading;
        inner.status.downloaded = 0;
        inner.status.total = None;
        inner.status.error = None;
        Ok(update)
    })?;
    // The request timeout used for the startup check is too short for a full bundle.
    let mut update = update;
    update.timeout = Some(Duration::from_secs(30 * 60));
    let result = update
        .download(
            |chunk, total| {
                let _ = updates.change(&app, |inner| {
                    inner.status.downloaded += chunk as u64;
                    inner.status.total = total;
                    Ok(())
                });
            },
            || {},
        )
        .await;
    updates.change(&app, |inner| {
        match result {
            Ok(bytes) => {
                inner.bytes = Some(bytes);
                inner.status.phase = Phase::Ready;
            }
            Err(error) => {
                inner.status.phase = Phase::Available;
                inner.status.error = Some(Message::DesktopUpdateDownload.detail(error));
            }
        }
        Ok(())
    })
}

#[tauri::command]
pub async fn install_desktop_update(app: tauri::AppHandle) -> Result<(), String> {
    ensure_update_installation()?;
    // Blocking installation and idle checks must not hold up the main event loop.
    tauri::async_runtime::spawn_blocking(move || {
        let updates = app.state::<DesktopUpdates>();
        let (update, bytes) = updates.change(&app, |inner| {
            if inner.status.phase != Phase::Ready {
                return Err(Message::DesktopUpdateUnavailable.text());
            }
            let update = inner
                .update
                .clone()
                .ok_or_else(|| Message::DesktopUpdateUnavailable.text())?;
            let bytes = inner
                .bytes
                .take()
                .ok_or_else(|| Message::DesktopUpdateUnavailable.text())?;
            inner.status.phase = Phase::Installing;
            inner.status.error = None;
            Ok((update, bytes))
        })?;
        let runtime = app.state::<Runtime>();
        // Both locks remain held through replacement and restart, so an extension
        // operation cannot start between the idle check and application exit.
        let result = with_installation_guard(&runtime, &PACKAGE_OPERATION, || {
            update
                .install(&bytes)
                .map_err(|error| Message::DesktopUpdateInstall.detail(error))?;
            let _ = runtime.stop();
            app.restart();
            #[allow(unreachable_code)]
            Ok::<(), String>(())
        });
        if let Err(error) = result {
            updates.change(&app, |inner| {
                inner.bytes = Some(bytes);
                inner.status.phase = Phase::Ready;
                inner.status.error = Some(error);
                Ok(())
            })?;
        }
        Ok(())
    })
    .await
    .map_err(|error| Message::BackgroundTask.detail(error))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn development_bundles_cannot_update() {
        assert!(!is_update_installation(
            Path::new("/Applications/Pi.app/Contents/MacOS/pi-desktop"),
            true
        ));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn only_packaged_macos_executables_can_update() {
        for invalid in [
            "/project/target/debug/pi-desktop",
            "/project/target/release/pi-desktop",
            "/project/Contents/MacOS/pi-desktop",
            "/Applications/Pi.app/Contents/pi-desktop",
        ] {
            assert!(!is_update_installation(Path::new(invalid), false));
        }
        assert!(is_update_installation(
            Path::new("/Applications/Pi Desktop.app/Contents/MacOS/pi-desktop"),
            false
        ));
    }

    #[test]
    fn installation_waits_for_package_operations_without_calling_installer() {
        let packages = Mutex::new(());
        let runtime = Runtime::default();
        let called = Cell::new(false);
        let busy = packages.lock().unwrap();
        assert!(with_installation_guard(&runtime, &packages, || {
            called.set(true);
            Ok(())
        })
        .is_err());
        assert!(!called.get());
        drop(busy);
        assert!(with_installation_guard(&runtime, &packages, || {
            assert!(runtime.operation().is_err());
            assert!(packages.try_lock().is_err());
            called.set(true);
            Ok(())
        })
        .is_ok());
        assert!(called.get());
        assert!(runtime.operation().is_ok());
        assert!(packages.try_lock().is_ok());
    }

    #[test]
    fn failed_installation_releases_both_guards_for_retry() {
        let packages = Mutex::new(());
        let runtime = Runtime::default();
        assert!(with_installation_guard(&runtime, &packages, || Err("failed".into())).is_err());
        assert!(runtime.operation().is_ok());
        assert!(packages.try_lock().is_ok());
    }

    #[test]
    fn active_runtime_operations_prevent_installation() {
        let packages = Mutex::new(());
        let runtime = Runtime::default();
        let operation = runtime.operation().unwrap();
        let called = Cell::new(false);
        assert!(with_installation_guard(&runtime, &packages, || {
            called.set(true);
            Ok(())
        })
        .is_err());
        assert!(!called.get());
        assert!(packages.try_lock().is_ok());
        drop(operation);
        assert!(with_installation_guard(&runtime, &packages, || Ok(())).is_ok());
    }
}
