use super::*;
use crate::source::support::{git_ok, init_repo, temp_dir};

#[test]
fn locates_head_262_commits_behind_without_returning_the_whole_log() {
    let root = temp_dir();
    init_repo(&root.0);
    let mut stream = String::new();
    for i in 0..450 {
        let message = format!("commit {i}");
        stream.push_str(&format!("commit refs/heads/remote\nmark :{}\ncommitter Test <test@example.com> {} +0000\ndata {}\n{}\n\n", i + 1, 1700000000 + i, message.len(), message));
    }
    stream.push_str("done\n");
    let imported = git::run_stdin(
        &root.0,
        &["fast-import", "--quiet"],
        stream.as_bytes(),
        git::LIMIT_SMALL,
    )
    .unwrap();
    assert!(
        imported.success,
        "{}",
        String::from_utf8_lossy(&imported.stderr)
    );
    git_ok(
        &root.0,
        &["update-ref", "refs/heads/main", "refs/heads/remote~262"],
    );
    let head = head_revision(&root.0).unwrap().unwrap();
    assert!(!workspace_log(&root.0, None, None, 0)
        .unwrap()
        .commits
        .iter()
        .any(|commit| commit.hash == head));
    let located = locate_head(&root.0).unwrap();
    assert_eq!(located.offset, 200);
    assert_eq!(located.head.as_ref(), Some(&head));
    assert_eq!(located.page.commits.len(), 200);
    assert_eq!(located.page.commits[62].hash, head);
    assert!(located.page.has_more);
}

#[test]
fn includes_an_unreferenced_detached_head_and_handles_an_unborn_repository() {
    let root = temp_dir();
    init_repo(&root.0);
    let empty = locate_head(&root.0).unwrap();
    assert!(empty.head.is_none());
    assert!(empty.page.commits.is_empty());
    git_ok(
        &root.0,
        &[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--allow-empty",
            "-m",
            "base",
        ],
    );
    git_ok(&root.0, &["checkout", "--detach"]);
    git_ok(
        &root.0,
        &[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "--allow-empty",
            "-m",
            "detached work",
        ],
    );
    let located = locate_head(&root.0).unwrap();
    assert_eq!(located.offset, 0);
    assert_eq!(located.head.as_ref(), Some(&located.page.commits[0].hash));
    assert_eq!(located.page.commits[0].subject, "detached work");
}
