use super::support::{git_ok, init_repo, temp_dir};
use super::*;
use std::fs;

#[test]
fn many_ignored_files_stay_hidden() {
    let root = temp_dir();
    init_repo(&root.0);
    fs::write(root.0.join(".gitignore"), "ignored/\n").unwrap();
    fs::write(root.0.join("keep.txt"), "keep\n").unwrap();
    git_ok(&root.0, &["add", ".gitignore", "keep.txt"]);
    git_ok(&root.0, &["commit", "-m", "keep"]);
    let dir = root.0.join("ignored");
    fs::create_dir(&dir).unwrap();
    let pad = "n".repeat(48);
    let mut bytes = 0usize;
    for index in 0..1_200 {
        let name = format!("chunk-{index:04}-{pad}.txt");
        bytes += "ignored/".len() + name.len() + 1;
        fs::write(dir.join(name), "x").unwrap();
    }
    assert!(
        bytes > 64 * 1024,
        "names must exceed the old 64KB check-ignore cap, got {bytes}"
    );

    let listing = list_dir(&root.0, "").unwrap();
    let names = listing
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .collect::<Vec<_>>();
    assert!(names.contains(&"keep.txt"), "{names:?}");
    assert!(!names.contains(&"ignored"), "{names:?}");
    let nested = list_dir(&root.0, "ignored").unwrap();
    assert!(
        nested.entries.is_empty(),
        "ignored files leaked: {}",
        nested.entries.len()
    );
}

#[test]
fn ignored_files_past_one_batch_stay_hidden() {
    let root = temp_dir();
    init_repo(&root.0);
    fs::write(root.0.join(".gitignore"), "ignored/\n").unwrap();
    fs::write(root.0.join("keep.txt"), "keep\n").unwrap();
    git_ok(&root.0, &["add", ".gitignore", "keep.txt"]);
    git_ok(&root.0, &["commit", "-m", "keep"]);
    let dir = root.0.join("ignored");
    fs::create_dir(&dir).unwrap();
    let pad = "n".repeat(48);
    for index in 0..4_500 {
        fs::write(dir.join(format!("chunk-{index:04}-{pad}.txt")), "x").unwrap();
    }
    let nested = list_dir(&root.0, "ignored").unwrap();
    assert!(nested.entries.is_empty(), "{}", nested.entries.len());
    assert!(!nested.ignore_partial);
}

#[test]
fn untracked_directory_is_one_status_line() {
    let root = temp_dir();
    init_repo(&root.0);
    fs::write(root.0.join("keep.txt"), "keep\n").unwrap();
    git_ok(&root.0, &["add", "keep.txt"]);
    git_ok(&root.0, &["commit", "-m", "keep"]);
    let dir = root.0.join("newdir");
    fs::create_dir(&dir).unwrap();
    fs::write(dir.join("a.txt"), "a\n").unwrap();
    fs::write(dir.join("b.txt"), "b\n").unwrap();

    let status = repo_status(&root.0).unwrap();
    assert_eq!(status.files.len(), 1);
    assert_eq!(status.files[0].code, "?");
    assert!(
        status.files[0].path.ends_with('/'),
        "{}",
        status.files[0].path
    );
}

#[test]
fn missing_git_is_not_a_plain_folder() {
    if std::env::var_os("PI_SOURCE_MISSING_GIT").is_some() {
        let root = temp_dir();
        let status = repo_status(&root.0).unwrap();
        assert!(!status.available);
        assert!(!status.repo);
        let history = log(&root.0, None, 20).unwrap();
        assert!(!history.available);
        assert!(!history.repo);
        return;
    }
    let empty = temp_dir();
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .env("PI_SOURCE_MISSING_GIT", "1")
        .env("PATH", &empty.0)
        .args([
            "--exact",
            "source::followup::missing_git_is_not_a_plain_folder",
        ])
        .output()
        .unwrap();
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        output.status.success() && (stdout.contains("1 passed") || stderr.contains("1 passed")),
        "status {}\n{stdout}\n{stderr}",
        output.status
    );
}

#[test]
fn workspace_history_lists_and_filters_branches_without_checkout() {
    let root = temp_dir();
    init_repo(&root.0);
    fs::write(root.0.join("base.txt"), "base\n").unwrap();
    git_ok(&root.0, &["add", "."]);
    git_ok(&root.0, &["commit", "-m", "base"]);
    git_ok(&root.0, &["branch", "feature"]);
    fs::write(root.0.join("main.txt"), "main\n").unwrap();
    git_ok(&root.0, &["add", "."]);
    git_ok(&root.0, &["commit", "-m", "main only"]);
    let branches = history::branches(&root.0).unwrap();
    let feature = branches
        .iter()
        .find(|branch| branch.name == "feature")
        .unwrap();
    let page = history::workspace_log(&root.0, None, Some(&feature.tip), 0).unwrap();
    assert_eq!(page.commits.len(), 1);
    assert_eq!(page.commits[0].subject, "base");
    assert!(!page.has_more);
    assert!(branches
        .iter()
        .any(|branch| branch.current && branch.name != "feature"));
    let all = history::workspace_log(&root.0, None, None, 0).unwrap();
    assert_eq!(all.commits.len(), 2);
    let next = history::workspace_log(&root.0, None, None, 1).unwrap();
    assert_eq!(next.commits[0].subject, "base");
    let only_file = history::workspace_log(&root.0, Some("main.txt"), None, 0).unwrap();
    assert_eq!(only_file.commits.len(), 1);
    assert!(history::workspace_log(&root.0, None, Some("--all"), 0).is_err());
}

#[test]
fn workspace_history_paginates_without_duplicates() {
    let root = temp_dir();
    init_repo(&root.0);
    for index in 0..201 {
        git_ok(
            &root.0,
            &["commit", "--allow-empty", "-m", &format!("commit {index}")],
        );
    }
    let first = history::workspace_log(&root.0, None, None, 0).unwrap();
    assert_eq!(first.commits.len(), 200);
    assert!(first.has_more);
    let second = history::workspace_log(&root.0, None, None, 200).unwrap();
    assert_eq!(second.commits.len(), 1);
    assert!(!second.has_more);
    assert!(first
        .commits
        .iter()
        .all(|commit| commit.hash != second.commits[0].hash));
}

#[test]
fn workspace_history_handles_empty_and_plain_folders() {
    let root = temp_dir();
    let plain = history::workspace_log(&root.0, None, None, 0).unwrap();
    assert!(!plain.repo);
    let root = temp_dir();
    init_repo(&root.0);
    let empty = history::workspace_log(&root.0, None, None, 0).unwrap();
    assert!(empty.repo);
    assert!(empty.commits.is_empty());
    assert!(!empty.has_more);
    assert!(history::branches(&root.0).unwrap().is_empty());
}
