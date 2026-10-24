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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
    let _guard = crate::source::support::MUTATION_TEST.lock().unwrap();
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
