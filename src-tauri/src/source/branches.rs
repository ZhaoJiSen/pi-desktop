//! Explicit, confirmed local branch operations. No network, forced checkout or auto-stash.
use super::{git, history};
use crate::i18n::Message;
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Mutex};

// Prevent two application branch operations from interleaving their preflight and mutation.
pub(super) static OPERATION: Mutex<()> = Mutex::new(());

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchState {
    pub(super) current: Option<String>,
    pub(super) head: Option<String>,
    pub(super) operation: Option<String>,
    pub(super) dirty: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchRequest {
    action: BranchAction,
    target: String,
    target_tip: String,
    name: String,
    expected_head: Option<String>,
    expected_branch: Option<String>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum BranchAction {
    Switch,
    Create,
    Merge,
    Rebase,
    AbortMerge,
    AbortRebase,
}

fn checked(root: &Path, args: &[&str]) -> Result<String, String> {
    let result = git::run(root, args, git::LIMIT_SMALL)?;
    if !result.success || result.truncated {
        let error = format!(
            "{}\n{}",
            String::from_utf8_lossy(&result.stderr),
            String::from_utf8_lossy(&result.stdout)
        );
        return Err(Message::GitRead.detail(error.trim()));
    }
    Ok(String::from_utf8_lossy(&result.stdout).trim().to_owned())
}

fn git_path_exists(root: &Path, name: &str) -> Result<bool, String> {
    let path = checked(root, &["rev-parse", "--git-path", name])?;
    Ok(root.join(path).exists())
}

pub(crate) fn state(root: &Path) -> Result<BranchState, String> {
    if git::presence(root)? != git::GitPresence::Repo {
        return Err(Message::GitRead.text());
    }
    let current = git::branch_name(root);
    let head = git::run(root, &["rev-parse", "--verify", "HEAD"], git::LIMIT_SMALL)?;
    let head = head
        .success
        .then(|| String::from_utf8_lossy(&head.stdout).trim().to_owned());
    let operation =
        if git_path_exists(root, "rebase-merge")? || git_path_exists(root, "rebase-apply")? {
            Some("rebase".to_owned())
        } else if git_path_exists(root, "MERGE_HEAD")? {
            Some("merge".to_owned())
        } else {
            None
        };
    let status = git::run(
        root,
        &["status", "--porcelain=v1", "--untracked-files=normal"],
        git::LIMIT_SMALL,
    )?;
    if !status.success {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&status.stderr).trim()));
    }
    Ok(BranchState {
        current,
        head,
        operation,
        dirty: status.truncated || !status.stdout.is_empty(),
    })
}

pub(crate) fn execute(root: &Path, request: &BranchRequest) -> Result<(), String> {
    let _guard = OPERATION.lock().map_err(|_| Message::GitRead.text())?;
    let current = state(root)?;
    if current.current != request.expected_branch || current.head != request.expected_head {
        return Err(Message::GitBranchChanged.text());
    }
    let abort = match request.action {
        BranchAction::AbortMerge => Some("merge"),
        BranchAction::AbortRebase => Some("rebase"),
        _ => None,
    };
    if let Some(operation) = abort {
        if current.operation.as_deref() != Some(operation) {
            return Err(Message::GitBranchChanged.text());
        }
        checked(root, &[operation, "--abort"])?;
        return Ok(());
    }
    if current.operation.is_some() {
        return Err(Message::GitOperationPending.text());
    }
    if current.dirty && matches!(request.action, BranchAction::Merge | BranchAction::Rebase) {
        return Err(Message::GitBranchDirty.text());
    }
    // Resolve an exact listed reference: local and remote names can otherwise collide.
    let branches = history::branches(root)?;
    let target = branches
        .iter()
        .find(|branch| {
            let prefix = if branch.remote {
                "refs/remotes/"
            } else {
                "refs/heads/"
            };
            request.target == format!("{prefix}{}", branch.name) && request.target_tip == branch.tip
        })
        .ok_or_else(|| Message::GitBranchChanged.text())?;
    if matches!(request.action, BranchAction::Merge | BranchAction::Rebase)
        && (current.current.is_none() || target.current)
    {
        return Err(Message::GitBranchChanged.text());
    }
    if request.action == BranchAction::Create
        || request.action == BranchAction::Switch && target.remote
    {
        if request.name.is_empty()
            || request.name.len() > 160
            || request.name.starts_with('-')
            || request.name.contains('\0')
            || request.name.contains("@{")
        {
            return Err(Message::GitBranchName.text());
        }
        checked(root, &["check-ref-format", "--branch", &request.name])?;
    }
    match request.action {
        BranchAction::Switch if target.remote => {
            checked(
                root,
                &["switch", "-c", &request.name, "--track", &request.target],
            )?;
        }
        BranchAction::Switch => {
            checked(root, &["switch", "--no-guess", "--", &target.name])?;
        }
        BranchAction::Create => {
            checked(
                root,
                &["switch", "--no-track", "-c", &request.name, &request.target],
            )?;
        }
        BranchAction::Merge => {
            checked(root, &["merge", "--no-edit", &request.target])?;
        }
        BranchAction::Rebase => {
            checked(root, &["rebase", &request.target])?;
        }
        BranchAction::AbortMerge | BranchAction::AbortRebase => {
            return Err(Message::GitBranchChanged.text())
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;
