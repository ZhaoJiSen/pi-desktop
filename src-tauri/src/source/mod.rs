//! Project files and Git. Only explicit sync commands can access configured remotes.

mod branches;
mod capture;
mod commit;
mod diff;
mod files;
mod git;
mod history;
mod paths;
mod status;
mod sync;
mod types;

use crate::i18n::Message;
use types::{
    DirectoryListing, GitCommitDetail, GitDiff, GitLog, GitStatus, ProjectFile, ProjectSearch,
};

#[cfg(test)]
pub(crate) use commit::commit_branch;
#[cfg(test)]
pub(crate) use diff::{file_diff, restore_worktree};
#[cfg(test)]
pub(crate) use files::{list_dir, read_file, search_files};
#[cfg(test)]
pub(crate) use git::cap_text;
#[cfg(test)]
pub(crate) use history::{commit_files, commit_log as log};
#[cfg(test)]
pub(crate) use paths::normalize_relative;
#[cfg(test)]
pub(crate) use status::repo_status;

const LOG_LIMIT: u32 = 200;

fn root_of(app: &tauri::AppHandle, path: &str) -> Result<std::path::PathBuf, String> {
    crate::project_path(app, path)
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|error| Message::BackgroundTask.detail(error))?
}

#[tauri::command]
pub async fn list_project_directory(
    app: tauri::AppHandle,
    path: String,
    relative: String,
) -> Result<DirectoryListing, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        files::list_dir(&root, &relative)
    })
    .await
}

#[tauri::command]
pub async fn read_project_file(
    app: tauri::AppHandle,
    path: String,
    relative: String,
) -> Result<ProjectFile, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        files::read_file(&root, &relative)
    })
    .await
}

#[tauri::command]
pub async fn search_project_files(
    app: tauri::AppHandle,
    path: String,
) -> Result<ProjectSearch, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        files::search_files(&root)
    })
    .await
}

#[tauri::command]
pub async fn git_status(app: tauri::AppHandle, path: String) -> Result<GitStatus, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        status::repo_status(&root)
    })
    .await
}

#[tauri::command]
pub async fn git_file_diff(
    app: tauri::AppHandle,
    path: String,
    relative: String,
    revision: Option<String>,
) -> Result<GitDiff, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        diff::file_diff(&root, &relative, revision.as_deref())
    })
    .await
}

#[tauri::command]
pub async fn git_commit_branch(
    app: tauri::AppHandle,
    path: String,
    branch: String,
    message: String,
    files: Vec<String>,
    expected: Option<commit::CommitExpectation>,
) -> Result<(), String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        commit::commit_branch(&root, &branch, &message, &files, expected.as_ref())
    })
    .await
}

#[tauri::command]
pub async fn git_restore_file(
    app: tauri::AppHandle,
    path: String,
    relative: String,
) -> Result<(), String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        diff::restore_worktree(&root, &relative)
    })
    .await
}

#[tauri::command]
pub async fn git_log(
    app: tauri::AppHandle,
    path: String,
    relative: Option<String>,
    limit: Option<u32>,
) -> Result<GitLog, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        history::commit_log(&root, relative.as_deref(), limit.unwrap_or(LOG_LIMIT))
    })
    .await
}

#[tauri::command]
pub async fn git_commit_files(
    app: tauri::AppHandle,
    path: String,
    revision: String,
) -> Result<GitCommitDetail, String> {
    blocking(move || {
        let root = root_of(&app, &path)?;
        history::commit_files(&root, &revision)
    })
    .await
}

#[cfg(test)]
#[path = "../../tests/source/support.rs"]
mod support;

#[cfg(test)]
#[path = "../../tests/source/tests.rs"]
mod tests;

#[cfg(test)]
#[path = "../../tests/source/safety.rs"]
mod safety;

#[cfg(test)]
#[path = "../../tests/source/followup.rs"]
mod followup;

#[cfg(test)]
#[path = "../../tests/source/regressions.rs"]
mod regressions;

#[tauri::command]
pub async fn git_branches(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<types::GitBranch>, String> {
    blocking(move || history::branches(&root_of(&app, &path)?)).await
}

#[tauri::command]
pub async fn git_log_page(
    app: tauri::AppHandle,
    path: String,
    relative: Option<String>,
    tip: Option<String>,
    skip: Option<u32>,
) -> Result<types::GitLogPage, String> {
    blocking(move || {
        history::workspace_log(
            &root_of(&app, &path)?,
            relative.as_deref(),
            tip.as_deref(),
            skip.unwrap_or(0),
        )
    })
    .await
}

#[tauri::command]
pub async fn git_branch_state(
    app: tauri::AppHandle,
    path: String,
) -> Result<branches::BranchState, String> {
    blocking(move || branches::state(&root_of(&app, &path)?)).await
}

#[tauri::command]
pub async fn git_branch_action(
    app: tauri::AppHandle,
    path: String,
    request: branches::BranchRequest,
) -> Result<(), String> {
    blocking(move || branches::execute(&root_of(&app, &path)?, &request)).await
}

#[tauri::command]
pub async fn git_sync_state(
    app: tauri::AppHandle,
    path: String,
) -> Result<sync::SyncState, String> {
    blocking(move || sync::state(&root_of(&app, &path)?)).await
}

#[tauri::command]
pub async fn git_sync_action(
    app: tauri::AppHandle,
    path: String,
    request: sync::SyncRequest,
) -> Result<(), String> {
    blocking(move || sync::execute(&root_of(&app, &path)?, &request)).await
}

#[tauri::command]
pub async fn git_conflict_write(
    app: tauri::AppHandle,
    path: String,
    relative: String,
    expected: String,
    text: String,
) -> Result<(), String> {
    blocking(move || sync::write_resolution(&root_of(&app, &path)?, &relative, &expected, &text))
        .await
}

#[tauri::command]
pub async fn git_log_head(
    app: tauri::AppHandle,
    path: String,
) -> Result<types::GitHeadLocation, String> {
    blocking(move || history::locate_head(&root_of(&app, &path)?)).await
}
