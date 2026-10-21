//! Local project files and Git. Commands never touch the network.

mod diff;
mod files;
mod git;
mod history;
mod paths;
mod status;
mod types;

use crate::i18n::Message;
use types::{
    DirectoryListing, GitCommitDetail, GitDiff, GitLog, GitStatus, ProjectFile, ProjectSearch,
};

#[cfg(test)]
pub(crate) use diff::file_diff;
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
#[path = "../../tests/source/tests.rs"]
mod tests;
