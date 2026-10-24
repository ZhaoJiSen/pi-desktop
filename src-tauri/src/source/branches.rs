//! Explicit, confirmed local branch operations. No network, forced checkout or auto-stash.
use super::{git, history};
use crate::i18n::Message;
use serde::{Deserialize, Serialize};
use std::{path::Path, sync::Mutex};

// Prevent two application branch operations from interleaving their preflight and mutation.
static OPERATION: Mutex<()> = Mutex::new(());

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchState {
    current: Option<String>,
    head: Option<String>,
    operation: Option<String>,
    dirty: bool,
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
mod tests {
    use super::*;
    use crate::source::support::{git_ok, init_repo, temp_dir, TempDir};
    use std::fs;

    fn repo() -> TempDir {
        let root = temp_dir();
        init_repo(&root.0);
        git_ok(&root.0, &["config", "commit.gpgsign", "false"]);
        fs::write(root.0.join("file.txt"), "base\n").unwrap();
        git_ok(&root.0, &["add", "."]);
        git_ok(&root.0, &["commit", "-m", "base"]);
        git_ok(&root.0, &["branch", "feature"]);
        root
    }
    fn request(root: &Path, action: BranchAction, target: &str, name: &str) -> BranchRequest {
        let state = state(root).unwrap();
        BranchRequest {
            action,
            target: target.into(),
            target_tip: checked(root, &["rev-parse", target]).unwrap(),
            name: name.into(),
            expected_head: state.head,
            expected_branch: state.current,
        }
    }
    #[test]
    fn creates_from_selected_branch_and_switches() {
        let root = repo();
        execute(
            &root.0,
            &request(
                &root.0,
                BranchAction::Create,
                "refs/heads/feature",
                "work/new",
            ),
        )
        .unwrap();
        assert_eq!(state(&root.0).unwrap().current.as_deref(), Some("work/new"));
    }
    #[test]
    fn switches_remote_as_a_tracking_local_branch() {
        let root = repo();
        git_ok(
            &root.0,
            &[
                "remote",
                "add",
                "origin",
                "https://example.invalid/repository",
            ],
        );
        git_ok(
            &root.0,
            &["update-ref", "refs/remotes/origin/feature", "HEAD"],
        );
        execute(
            &root.0,
            &request(
                &root.0,
                BranchAction::Switch,
                "refs/remotes/origin/feature",
                "remote-feature",
            ),
        )
        .unwrap();
        assert_eq!(
            checked(&root.0, &["rev-parse", "--abbrev-ref", "@{upstream}"]).unwrap(),
            "origin/feature"
        );
    }
    #[test]
    fn stale_confirmation_and_dirty_files_leave_branch_unchanged() {
        let root = repo();
        let old = request(&root.0, BranchAction::Switch, "refs/heads/feature", "");
        git_ok(&root.0, &["commit", "--allow-empty", "-m", "new HEAD"]);
        assert!(execute(&root.0, &old).is_err());
        fs::write(root.0.join("file.txt"), "dirty\n").unwrap();
        let next = request(&root.0, BranchAction::Merge, "refs/heads/feature", "");
        assert!(execute(&root.0, &next).is_err());
        assert_eq!(state(&root.0).unwrap().current.as_deref(), Some("main"));
        assert_eq!(
            fs::read_to_string(root.0.join("file.txt")).unwrap(),
            "dirty\n"
        );
    }
    #[test]
    fn new_branch_preserves_working_changes_and_switch_rejects_overwrite() {
        let root = repo();
        fs::write(root.0.join("file.txt"), "my pending changes\n").unwrap();
        execute(
            &root.0,
            &request(
                &root.0,
                BranchAction::Create,
                "refs/heads/main",
                "work/pending",
            ),
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(root.0.join("file.txt")).unwrap(),
            "my pending changes\n"
        );
        git_ok(&root.0, &["add", "."]);
        git_ok(&root.0, &["commit", "-m", "pending work"]);
        git_ok(&root.0, &["switch", "main"]);
        fs::write(root.0.join("file.txt"), "local uncommitted\n").unwrap();
        assert!(execute(
            &root.0,
            &request(&root.0, BranchAction::Switch, "refs/heads/work/pending", "")
        )
        .is_err());
        assert_eq!(state(&root.0).unwrap().current.as_deref(), Some("main"));
        assert_eq!(
            fs::read_to_string(root.0.join("file.txt")).unwrap(),
            "local uncommitted\n"
        );
    }
    #[test]
    fn reference_collision_and_invalid_name_cannot_retarget_operation() {
        let root = repo();
        git_ok(&root.0, &["branch", "origin/feature"]);
        git_ok(
            &root.0,
            &["update-ref", "refs/remotes/origin/feature", "HEAD"],
        );
        let mut invalid = request(&root.0, BranchAction::Create, "refs/heads/feature", "@{-1}");
        assert!(execute(&root.0, &invalid).is_err());
        invalid.target = "--all".into();
        assert!(execute(&root.0, &invalid).is_err());
        execute(
            &root.0,
            &request(
                &root.0,
                BranchAction::Switch,
                "refs/heads/origin/feature",
                "",
            ),
        )
        .unwrap();
        assert_eq!(
            state(&root.0).unwrap().current.as_deref(),
            Some("origin/feature")
        );
    }
    fn divergent(root: &Path, conflict: bool) {
        git_ok(root, &["switch", "feature"]);
        fs::write(
            root.join(if conflict { "file.txt" } else { "feature.txt" }),
            "feature\n",
        )
        .unwrap();
        git_ok(root, &["add", "."]);
        git_ok(root, &["commit", "-m", "feature work"]);
        git_ok(root, &["switch", "main"]);
        fs::write(
            root.join(if conflict { "file.txt" } else { "main.txt" }),
            "main\n",
        )
        .unwrap();
        git_ok(root, &["add", "."]);
        git_ok(root, &["commit", "-m", "main work"]);
    }
    #[test]
    fn merge_and_rebase_apply_selected_branch_to_current() {
        for action in [BranchAction::Merge, BranchAction::Rebase] {
            let root = repo();
            divergent(&root.0, false);
            execute(&root.0, &request(&root.0, action, "refs/heads/feature", "")).unwrap();
            assert!(root.0.join("feature.txt").exists());
            assert!(root.0.join("main.txt").exists());
            assert_eq!(state(&root.0).unwrap().current.as_deref(), Some("main"));
        }
    }
    #[test]
    fn conflicted_merge_and_rebase_can_abort_without_losing_original_head() {
        for (action, abort, operation) in [
            (BranchAction::Merge, BranchAction::AbortMerge, "merge"),
            (BranchAction::Rebase, BranchAction::AbortRebase, "rebase"),
        ] {
            let root = repo();
            divergent(&root.0, true);
            let before = state(&root.0).unwrap().head;
            assert!(execute(&root.0, &request(&root.0, action, "refs/heads/feature", "")).is_err());
            assert_eq!(
                state(&root.0).unwrap().operation.as_deref(),
                Some(operation)
            );
            execute(&root.0, &request(&root.0, abort, "refs/heads/feature", "")).unwrap();
            let after = state(&root.0).unwrap();
            assert_eq!(after.head, before);
            assert!(after.operation.is_none());
            assert!(!after.dirty);
        }
    }
}
