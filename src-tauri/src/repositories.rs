//! Local checkout creation. Only directories owned by this operation are cleaned up.
mod checkout;
mod operation;
mod progress;
mod validation;

use checkout::{run_clone, CloneInput};
use operation::Claim;
pub use operation::RepositoryClones;
use serde::Serialize;
use tauri::{ipc::Channel, Manager, State};

#[derive(Debug, Serialize)]
pub struct CloneError {
    code: &'static str,
}
impl CloneError {
    fn new(code: &'static str) -> Self {
        Self { code }
    }
}
type Result<T> = std::result::Result<T, CloneError>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneProgress {
    task_id: String,
    stage: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    percent: Option<u8>,
}

#[tauri::command]
pub async fn clone_repository(
    app: tauri::AppHandle,
    manager: State<'_, RepositoryClones>,
    task_id: String,
    url: String,
    parent: String,
    name: String,
    on_progress: Channel<CloneProgress>,
) -> Result<Option<String>> {
    if task_id.len() != 36 || !task_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return Err(CloneError::new("failed"));
    }
    let home = app
        .path()
        .home_dir()
        .map_err(|_| CloneError::new("parent"))?;
    let operation = manager.claim(&task_id)?;
    let claim = Claim {
        manager: manager.inner().clone(),
    };
    tauri::async_runtime::spawn_blocking(move || {
        let _claim = claim;
        run_clone(
            &home,
            CloneInput {
                task_id: &task_id,
                url: &url,
                parent: &parent,
                name: &name,
            },
            &operation,
            |event| {
                if on_progress.send(event).is_err() {
                    operation.cancel();
                }
            },
            std::ffi::OsStr::new("git"),
        )
    })
    .await
    .map_err(|_| CloneError::new("failed"))?
}

#[tauri::command]
pub fn cancel_clone(manager: State<'_, RepositoryClones>, task_id: String) {
    if let Ok(active) = manager.active.lock() {
        if let Some(active) = active.as_ref() {
            if active.id == task_id {
                active.operation.cancel();
            }
        }
    }
}

#[cfg(test)]
#[path = "../tests/repositories/tests.rs"]
mod tests;
