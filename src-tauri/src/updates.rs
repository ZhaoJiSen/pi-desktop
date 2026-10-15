//! Pi self-update orchestration. All state lives for the native app's lifetime.
mod process;
mod release;
mod upgrade;

use crate::{i18n::Message, onboarding::EnvironmentCheck, runtime::Runtime};
use release::check_release;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
};
use tauri::{ipc::Channel, Manager, State};
use upgrade::perform_upgrade;

const RELEASE_URL: &str = "https://pi.dev/api/latest-version";
const OUTPUT_LIMIT: usize = 16 * 1024;
type Check = Arc<OnceLock<Result<PiUpdate, String>>>;

#[derive(Default)]
pub struct PiUpdates {
    checks: Mutex<HashMap<String, Check>>,
    reminder_consumed: AtomicBool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PiUpdate {
    executable: String,
    current_version: String,
    latest_version: String,
    has_update: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RunSnapshot {
    pub(crate) run_id: String,
    pub(crate) session_file: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    stage: &'static str,
}

impl PiUpdates {
    fn entry(&self, executable: &str) -> Result<Check, String> {
        let mut checks = self
            .checks
            .lock()
            .map_err(|_| Message::RuntimeState.text())?;
        Ok(checks
            .entry(executable.trim().to_owned())
            .or_default()
            .clone())
    }

    fn checked(&self, executable: &str) -> Result<PiUpdate, String> {
        let checks = self
            .checks
            .lock()
            .map_err(|_| Message::RuntimeState.text())?;
        if let Some(result) = checks.get(executable.trim()).and_then(|check| check.get()) {
            return result.clone();
        }
        checks
            .values()
            .filter_map(|check| check.get())
            .filter_map(|result| result.as_ref().ok())
            .find(|update| update.executable == executable)
            .cloned()
            .ok_or_else(|| Message::PiUpdateCheck.text())
    }

    fn claim(&self, executable: &str) -> Result<bool, String> {
        if !self.checked(executable)?.has_update {
            return Ok(false);
        }
        Ok(!self.reminder_consumed.swap(true, Ordering::SeqCst))
    }
}

#[tauri::command]
pub async fn check_pi_update(
    app: tauri::AppHandle,
    updates: State<'_, PiUpdates>,
    runtime: State<'_, Runtime>,
    executable: String,
) -> Result<PiUpdate, String> {
    let entry = updates.entry(&executable)?;
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    let runtime = runtime.inner().clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _operation = runtime.operation()?;
        entry
            .get_or_init(|| check_release(&executable, &home, RELEASE_URL))
            .clone()
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?;
    // A manual retry in the guide must be able to recover from a temporary outage.
    if result.is_err() {
        updates
            .checks
            .lock()
            .map_err(|_| Message::RuntimeState.text())?
            .retain(|_, check| !matches!(check.get(), Some(Err(_))));
    }
    result
}

#[tauri::command]
pub fn suppress_pi_update_prompt(updates: State<'_, PiUpdates>) {
    updates.reminder_consumed.store(true, Ordering::SeqCst);
}

#[tauri::command]
pub async fn claim_pi_update_prompt(
    updates: State<'_, PiUpdates>,
    runtime: State<'_, Runtime>,
    executable: String,
) -> Result<bool, String> {
    // Check all native runs before consuming the one-per-launch reminder.
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _operation = runtime.operation()?;
        runtime.idle_sessions()
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))??;
    updates.claim(&executable)
}

#[tauri::command]
pub async fn upgrade_pi(
    app: tauri::AppHandle,
    updates: State<'_, PiUpdates>,
    runtime: State<'_, Runtime>,
    executable: String,
    sessions: Vec<RunSnapshot>,
    on_progress: Channel<UpdateProgress>,
) -> Result<EnvironmentCheck, String> {
    let checked = updates.checked(&executable)?;
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    let runtime = runtime.inner().clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        perform_upgrade(&runtime, &checked, &executable, &home, sessions, |stage| {
            let _ = on_progress.send(UpdateProgress { stage });
        })
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?;
    if result.is_ok() {
        updates
            .checks
            .lock()
            .map_err(|_| Message::RuntimeState.text())?
            .clear();
        updates.reminder_consumed.store(true, Ordering::SeqCst);
    }
    result
}

#[cfg(test)]
#[path = "../tests/updates/tests.rs"]
mod tests;
