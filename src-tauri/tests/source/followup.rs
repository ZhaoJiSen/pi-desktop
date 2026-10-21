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
