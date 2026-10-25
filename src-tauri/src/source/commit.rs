//! Create a local branch and commit the listed paths. Nothing here talks to a remote.

use super::{branches, git, paths, status};
use crate::i18n::Message;
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub(crate) struct CommitExpectation {
    pub head: Option<String>,
    pub current: Option<String>,
    pub resume: bool,
}

fn valid_branch(name: &str) -> bool {
    let bytes = name.as_bytes();
    (1..=80).contains(&bytes.len())
        && !name.starts_with('-')
        && !name.starts_with('/')
        && !name.ends_with('/')
        && !name.ends_with('.')
        && !name.contains("..")
        && !name.contains("@{")
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'.' | b'_' | b'-'))
}

pub(crate) fn commit_branch(
    root: &Path,
    branch: &str,
    message: &str,
    relatives: &[String],
    expected: Option<&CommitExpectation>,
) -> Result<(), String> {
    let _guard = branches::OPERATION
        .lock()
        .map_err(|_| Message::GitOperationPending.text())?;
    let state = branches::state(root)?;
    if state.operation.is_some() {
        return Err(Message::GitOperationPending.text());
    }
    if let Some(expected) = expected {
        if state.head != expected.head || state.current != expected.current {
            return Err(Message::GitBranchChanged.text());
        }
    }
    let branch = branch.trim();
    let message = message.trim();
    if !valid_branch(branch)
        || message.is_empty()
        || message.len() > 2_000
        || message.contains('\0')
    {
        return Err(Message::GitRead.text());
    }
    match git::presence(root)? {
        git::GitPresence::Missing => return Err(Message::GitUnavailable.text()),
        git::GitPresence::Plain => return Err(Message::GitRead.text()),
        git::GitPresence::Repo => {}
    }
    let mut paths = Vec::with_capacity(relatives.len());
    for relative in relatives {
        let path = paths::normalize_relative(relative)?;
        if path.is_empty() {
            return Err(Message::SourceRead.text());
        }
        paths.push(path);
    }
    if paths.is_empty() {
        return Err(Message::GitRead.text());
    }
    if expected.is_some_and(|value| value.resume) {
        if state.current.as_deref() != Some(branch) {
            return Err(Message::GitBranchChanged.text());
        }
    } else {
        let switched = git::run(root, &["switch", "-c", branch], git::LIMIT_SMALL)?;
        if !switched.success {
            return Err(Message::GitRead.detail(String::from_utf8_lossy(&switched.stderr).trim()));
        }
    }
    let mut add = vec!["add", "--"];
    for path in &paths {
        add.push(path);
    }
    let added = git::run(root, &add, git::LIMIT_SMALL)?;
    if !added.success {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&added.stderr).trim()));
    }
    let prefix = git::project_prefix(root)?;
    let staged = git::run(
        root,
        &["status", "--porcelain=v1", "-z", "-uno"],
        git::LIMIT_STATUS,
    )?;
    if !staged.success || staged.truncated {
        return Err(Message::GitRead.text());
    }
    let mut commit_paths = paths.clone();
    for file in status::parse_status(&staged.stdout) {
        if file.code != "R"
            || !file
                .path
                .strip_prefix(&prefix)
                .is_some_and(|p| paths.iter().any(|path| path == p))
        {
            continue;
        }
        if let Some(old) = file
            .old_path
            .as_deref()
            .and_then(|p| p.strip_prefix(&prefix))
        {
            if !paths.iter().any(|path| path == old) && root.join(old).symlink_metadata().is_ok() {
                return Err(Message::GitBranchChanged.text());
            }
            commit_paths.push(old.to_owned());
        }
    }
    commit_paths.sort();
    commit_paths.dedup();
    // The index may contain unrelated staged work, especially outside a subproject.
    let mut args = vec!["commit", "--only", "-F", "-", "--"];
    args.extend(commit_paths.iter().map(String::as_str));
    let committed = git::run_stdin(root, &args, message.as_bytes(), git::LIMIT_SMALL)?;
    if !committed.success {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&committed.stderr).trim()));
    }
    Ok(())
}
