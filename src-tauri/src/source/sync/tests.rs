use super::*;
use crate::source::support::MUTATION_TEST as TEST;
use crate::source::support::{git_ok, init_repo, temp_dir, TempDir};
struct Repos {
    origin: TempDir,
    producer: TempDir,
    local: TempDir,
}
fn repos() -> Repos {
    let origin = temp_dir();
    git_ok(&origin.0, &["init", "--bare", "-b", "main"]);
    let producer = temp_dir();
    init_repo(&producer.0);
    fs::write(producer.0.join("file.txt"), "base\n").unwrap();
    git_ok(&producer.0, &["add", "."]);
    git_ok(&producer.0, &["commit", "-m", "base"]);
    git_ok(
        &producer.0,
        &["remote", "add", "origin", origin.0.to_str().unwrap()],
    );
    git_ok(&producer.0, &["push", "-u", "origin", "main"]);
    let local = temp_dir();
    git_ok(&local.0, &["clone", origin.0.to_str().unwrap(), "."]);
    git_ok(&local.0, &["config", "user.name", "Test"]);
    git_ok(&local.0, &["config", "user.email", "test@example.com"]);
    git_ok(&local.0, &["config", "commit.gpgsign", "false"]);
    Repos {
        origin,
        producer,
        local,
    }
}
fn change(root: &Path, file: &str, text: &str) {
    fs::write(root.join(file), text).unwrap();
    git_ok(root, &["add", "."]);
    git_ok(root, &["commit", "-m", "update"]);
}
fn request(root: &Path, action: SyncAction, mode: Option<PullMode>) -> SyncRequest {
    let s = state(root).unwrap();
    SyncRequest {
        action,
        mode,
        relative: None,
        expected_head: s.branch.head,
        expected_branch: s.branch.current,
        expected_upstream: s.upstream,
    }
}
#[test]
fn fetch_preserves_dirty_files_and_pull_fast_forwards_only_after_review() {
    let _guard = TEST.lock().unwrap();
    let r = repos();
    let root = &r.local.0;
    change(&r.producer.0, "remote.txt", "incoming\n");
    git_ok(&r.producer.0, &["push"]);
    let head = state(root).unwrap().branch.head;
    fs::write(root.join("pending.txt"), "mine\n").unwrap();
    execute(root, &request(root, SyncAction::Fetch, None)).unwrap();
    let fetched = state(root).unwrap();
    assert_eq!(fetched.branch.head, head);
    assert_eq!(fetched.behind, 1);
    assert!(fetched.last_fetch.is_some());
    assert_eq!(
        execute(root, &request(root, SyncAction::Pull, None)).unwrap_err(),
        "SOURCE_SYNC_DIRTY"
    );
    assert_eq!(
        fs::read_to_string(root.join("pending.txt")).unwrap(),
        "mine\n"
    );
    fs::remove_file(root.join("pending.txt")).unwrap();
    execute(root, &request(root, SyncAction::Pull, None)).unwrap();
    assert_eq!(state(root).unwrap().behind, 0);
    assert!(root.join("remote.txt").exists());
    let stale = request(root, SyncAction::Pull, None);
    change(root, "local.txt", "local\n");
    assert_eq!(execute(root, &stale).unwrap_err(), "SOURCE_SYNC_CHANGED");
    git_ok(root, &["checkout", "--detach"]);
    assert!(state(root).unwrap().upstream.is_none());
    assert_eq!(
        execute(root, &request(root, SyncAction::Pull, None)).unwrap_err(),
        "SOURCE_SYNC_NO_UPSTREAM"
    );
}
#[test]
fn divergent_merge_and_rebase_recover_after_a_fresh_state_read() {
    let _guard = TEST.lock().unwrap();
    for mode in [PullMode::Merge, PullMode::Rebase] {
        let r = repos();
        let root = &r.local.0;
        change(&r.producer.0, "file.txt", "remote\n");
        git_ok(&r.producer.0, &["push"]);
        change(root, "file.txt", "local\n");
        let original = state(root).unwrap().branch.head;
        if mode == PullMode::Merge {
            git_ok(root, &["config", "merge.ff", "only"]);
        }
        assert!(execute(
            root,
            &request(root, SyncAction::Pull, Some(PullMode::FfOnly))
        )
        .is_err());
        assert_eq!(state(root).unwrap().branch.head, original);
        assert!(state(root).unwrap().branch.operation.is_none());
        assert!(execute(root, &request(root, SyncAction::Pull, Some(mode))).is_err());
        // Reads use on-disk metadata, just as reopening/restarting the app would.
        let s = state(root).unwrap();
        assert!(s.branch.operation.is_some());
        assert_eq!(s.conflicts, ["file.txt"]);
        assert!(crate::source::commit::commit_branch(
            root,
            "unsafe-during-conflict",
            "wrong workflow",
            &["file.txt".into()]
        )
        .is_err());
        assert_eq!(state(root).unwrap().branch.current, s.branch.current);
        assert_eq!(
            execute(root, &request(root, SyncAction::Continue, None)).unwrap_err(),
            "SOURCE_SYNC_PENDING"
        );
        let mut resolve = request(root, SyncAction::Resolve, None);
        resolve.relative = Some("file.txt".into());
        assert_eq!(execute(root, &resolve).unwrap_err(), "SOURCE_SYNC_MARKERS");
        assert_eq!(
            write_resolution(root, "file.txt", "stale", "resolved\n").unwrap_err(),
            "SOURCE_SYNC_CHANGED"
        );
        let original_text = fs::read_to_string(root.join("file.txt")).unwrap();
        write_resolution(root, "file.txt", &original_text, "resolved\n").unwrap();
        execute(root, &resolve).unwrap();
        assert!(state(root).unwrap().conflicts.is_empty());
        execute(root, &request(root, SyncAction::Continue, None)).unwrap();
        assert!(state(root).unwrap().branch.operation.is_none());
        assert_eq!(
            fs::read_to_string(root.join("file.txt")).unwrap(),
            "resolved\n"
        );
    }
}
#[test]
fn abort_restores_original_head_and_failed_fetch_keeps_last_success() {
    let _guard = TEST.lock().unwrap();
    for mode in [PullMode::Merge, PullMode::Rebase] {
        let r = repos();
        let root = &r.local.0;
        change(&r.producer.0, "file.txt", "remote\n");
        git_ok(&r.producer.0, &["push"]);
        change(root, "file.txt", "local\n");
        let before = state(root).unwrap().branch.head;
        assert!(execute(root, &request(root, SyncAction::Pull, Some(mode))).is_err());
        execute(root, &request(root, SyncAction::Abort, None)).unwrap();
        assert_eq!(state(root).unwrap().branch.head, before);
        let last = state(root).unwrap().last_fetch;
        git_ok(
            root,
            &[
                "remote",
                "set-url",
                "origin",
                r.origin.0.join("missing").to_str().unwrap(),
            ],
        );
        assert!(execute(root, &request(root, SyncAction::Fetch, None)).is_err());
        assert_eq!(state(root).unwrap().last_fetch, last);
    }
}
#[test]
fn marker_scan_handles_large_files_and_chunk_boundaries_without_loading_them_all() {
    let root = temp_dir();
    let path = root.0.join("large.txt");
    let mut bytes = vec![b'x'; 8190];
    bytes.push(b'\n');
    bytes.extend_from_slice(b"<<<<<<< HEAD\n");
    bytes.extend(vec![b'x'; git::LIMIT_DIFF + 100]);
    fs::write(&path, &bytes).unwrap();
    assert!(markers_in_file(&path).unwrap());
    bytes.push(0);
    fs::write(&path, &bytes).unwrap();
    assert!(!markers_in_file(&path).unwrap());
    fs::write(&path, vec![b'x'; git::LIMIT_DIFF + 100]).unwrap();
    assert!(!markers_in_file(&path).unwrap());
}
#[test]
fn resolution_handles_deleted_paths_and_rejects_paths_outside_conflicts() {
    let _guard = TEST.lock().unwrap();
    let r = repos();
    let root = &r.local.0;
    change(&r.producer.0, "file.txt", "remote\n");
    git_ok(&r.producer.0, &["push"]);
    git_ok(root, &["rm", "file.txt"]);
    git_ok(root, &["commit", "-m", "remove"]);
    assert!(execute(
        root,
        &request(root, SyncAction::Pull, Some(PullMode::Merge))
    )
    .is_err());
    fs::remove_file(root.join("file.txt")).unwrap();
    let mut resolve = request(root, SyncAction::Resolve, None);
    resolve.relative = Some("../outside".into());
    assert!(execute(root, &resolve).is_err());
    resolve.relative = Some("file.txt".into());
    execute(root, &resolve).unwrap();
    execute(root, &request(root, SyncAction::Continue, None)).unwrap();
    assert!(!root.join("file.txt").exists());
}
