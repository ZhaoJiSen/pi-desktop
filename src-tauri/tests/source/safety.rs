use super::support::{git_ok, init_repo, temp_dir};
use super::*;
use std::{fs, os::unix::fs::symlink};

#[test]
fn untracked_symlink_does_not_follow_outside_the_project() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("readme.md"), "in\n").unwrap();
    git_ok(&dir.0, &["add", "readme.md"]);
    git_ok(&dir.0, &["commit", "-m", "init"]);
    let outside = temp_dir();
    let secret = "SECRET-OUTSIDE-CONTENT";
    fs::write(outside.0.join("secret.txt"), secret).unwrap();
    symlink(outside.0.join("secret.txt"), dir.0.join("leak.txt")).unwrap();

    let diff = file_diff(&dir.0, "leak.txt", None).unwrap();
    assert!(diff.available);
    assert!(!diff.binary);
    assert!(!diff.text.contains(secret), "{}", diff.text);
    assert!(diff.text.contains("secret.txt"), "{}", diff.text);
    assert!(diff.text.lines().any(|line| line.starts_with('+')));
    assert!(read_file(&dir.0, "leak.txt").is_err());

    let listing = list_dir(&dir.0, "").unwrap();
    let entry = listing
        .entries
        .iter()
        .find(|entry| entry.name == "leak.txt")
        .unwrap();
    assert_eq!(entry.kind, "link");
}

#[test]
fn directory_symlink_outside_is_not_listed_as_a_directory() {
    let dir = temp_dir();
    let outside = temp_dir();
    fs::create_dir_all(outside.0.join("hidden")).unwrap();
    fs::write(outside.0.join("hidden/secret.txt"), "SECRET-DIR").unwrap();
    fs::create_dir_all(dir.0.join("inner")).unwrap();
    fs::write(dir.0.join("inner/keep.txt"), "keep\n").unwrap();
    symlink(outside.0.join("hidden"), dir.0.join("escape")).unwrap();
    symlink(dir.0.join("inner"), dir.0.join("alias")).unwrap();

    let listing = list_dir(&dir.0, "").unwrap();
    let escape = listing
        .entries
        .iter()
        .find(|entry| entry.name == "escape")
        .unwrap();
    assert_eq!(escape.kind, "link");
    let alias = listing
        .entries
        .iter()
        .find(|entry| entry.name == "alias")
        .unwrap();
    assert_eq!(alias.kind, "dir");
    let inner = list_dir(&dir.0, "alias").unwrap();
    assert!(inner.entries.iter().any(|entry| entry.name == "keep.txt"));
    assert!(list_dir(&dir.0, "escape").is_err());
}

#[test]
fn text_mentioning_binary_files_is_not_binary() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("note.txt"), "before\n").unwrap();
    git_ok(&dir.0, &["add", "note.txt"]);
    git_ok(&dir.0, &["commit", "-m", "init"]);
    fs::write(
        dir.0.join("note.txt"),
        "before\nBinary files a and b differ\n",
    )
    .unwrap();
    let diff = file_diff(&dir.0, "note.txt", None).unwrap();
    assert!(!diff.binary, "{}", diff.text);
    assert!(
        diff.text.contains("Binary files a and b differ"),
        "{}",
        diff.text
    );

    fs::write(dir.0.join("mark.bin"), [0, 1, 2, 3, 4, 5, 6, 7]).unwrap();
    let binary = file_diff(&dir.0, "mark.bin", None).unwrap();
    assert!(binary.binary);
    assert!(binary.text.is_empty());
}

#[test]
fn empty_repository_reports_status_log_and_untracked_diff() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("fresh.txt"), "hello\n").unwrap();
    let status = repo_status(&dir.0).unwrap();
    assert!(status.available);
    assert!(status.repo);
    assert!(status
        .files
        .iter()
        .any(|file| file.path == "fresh.txt" && file.code == "?"));
    let history = log(&dir.0, None, 20).unwrap();
    assert!(history.available);
    assert!(history.repo);
    assert!(history.commits.is_empty());
    let diff = file_diff(&dir.0, "fresh.txt", None).unwrap();
    assert!(diff.text.contains("+hello"), "{}", diff.text);
}

#[test]
fn odd_filenames_round_trip_through_status_and_diff() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("-tracked.txt"), "base\n").unwrap();
    git_ok(&dir.0, &["add", "--", "-tracked.txt"]);
    git_ok(&dir.0, &["commit", "-m", "init"]);
    fs::write(dir.0.join("-tracked.txt"), "base\nchanged\n").unwrap();
    for name in ["-odd name.txt", "中文.txt", "space name.txt"] {
        fs::write(dir.0.join(name), format!("body {name}\n")).unwrap();
    }
    let status = repo_status(&dir.0).unwrap();
    for name in [
        "-tracked.txt",
        "-odd name.txt",
        "中文.txt",
        "space name.txt",
    ] {
        assert!(
            status.files.iter().any(|file| file.path == name),
            "{name} {status:?}"
        );
    }
    let tracked = file_diff(&dir.0, "-tracked.txt", None).unwrap();
    assert!(tracked.text.contains("+changed"), "{}", tracked.text);
    let spaced = file_diff(&dir.0, "space name.txt", None).unwrap();
    assert!(
        spaced.text.contains("+body space name.txt"),
        "{}",
        spaced.text
    );
    let chinese = file_diff(&dir.0, "中文.txt", None).unwrap();
    assert!(chinese.text.contains("+body 中文.txt"), "{}", chinese.text);
    let dashed = file_diff(&dir.0, "-odd name.txt", None).unwrap();
    assert!(
        dashed.text.contains("+body -odd name.txt"),
        "{}",
        dashed.text
    );
}

#[test]
fn rename_plus_edit_keeps_the_rename() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("old-name.ts"), "export const value = 1\n").unwrap();
    git_ok(&dir.0, &["add", "old-name.ts"]);
    git_ok(&dir.0, &["commit", "-m", "add"]);
    git_ok(&dir.0, &["mv", "old-name.ts", "new-name.ts"]);
    fs::write(dir.0.join("new-name.ts"), "export const value = 2\n").unwrap();
    let status = repo_status(&dir.0).unwrap();
    let renamed = status
        .files
        .iter()
        .find(|file| file.path == "new-name.ts")
        .unwrap_or_else(|| panic!("{status:?}"));
    assert_eq!(renamed.code, "R");
    assert_eq!(renamed.old_path.as_deref(), Some("old-name.ts"));
}

#[test]
fn large_working_diff_is_capped_while_reading() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("big.txt"), "seed\n").unwrap();
    git_ok(&dir.0, &["add", "big.txt"]);
    git_ok(&dir.0, &["commit", "-m", "seed"]);
    fs::write(
        dir.0.join("big.txt"),
        format!("seed\n{}", "y".repeat(300 * 1024)),
    )
    .unwrap();
    let diff = file_diff(&dir.0, "big.txt", None).unwrap();
    assert!(diff.truncated, "len {}", diff.text.len());
    assert!(diff.text.len() <= 256 * 1024);
    assert!(!diff.binary);
}

#[test]
fn gitignore_uses_the_full_relative_path() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join(".gitignore"), "nested/notes.txt\n").unwrap();
    fs::write(dir.0.join("notes.txt"), "root\n").unwrap();
    fs::create_dir_all(dir.0.join("nested")).unwrap();
    fs::write(dir.0.join("nested/notes.txt"), "hidden\n").unwrap();
    fs::write(dir.0.join("nested/keep.txt"), "keep\n").unwrap();
    git_ok(&dir.0, &["add", ".gitignore"]);
    git_ok(&dir.0, &["commit", "-m", "ignore"]);
    let root = list_dir(&dir.0, "").unwrap();
    assert!(root.entries.iter().any(|entry| entry.name == "notes.txt"));
    let nested = list_dir(&dir.0, "nested").unwrap();
    let names: Vec<_> = nested
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    assert!(names.contains(&"keep.txt"), "{names:?}");
    assert!(!names.contains(&"notes.txt"), "{names:?}");
}
