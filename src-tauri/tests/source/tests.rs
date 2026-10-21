use super::support::{git_ok, init_repo, temp_dir};
use super::*;
use std::fs;

#[test]
fn directory_listing_skips_gitignore_and_git_dir() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join(".gitignore"), "node_modules/\n").unwrap();
    fs::create_dir_all(dir.0.join("node_modules")).unwrap();
    fs::write(dir.0.join("node_modules/left.js"), "x").unwrap();
    fs::write(dir.0.join("readme.md"), "hello").unwrap();
    fs::create_dir_all(dir.0.join("src")).unwrap();
    fs::write(dir.0.join("src/main.ts"), "export {}\n").unwrap();
    git_ok(&dir.0, &["add", "."]);
    git_ok(&dir.0, &["commit", "-m", "init"]);

    let listing = list_dir(&dir.0, "").unwrap();
    let names: Vec<_> = listing
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    assert!(names.contains(&"src"), "{names:?}");
    assert!(names.contains(&"readme.md"), "{names:?}");
    assert!(!names.contains(&"node_modules"), "{names:?}");
    assert!(!names.contains(&".git"), "{names:?}");
    assert_eq!(
        listing
            .entries
            .iter()
            .find(|entry| entry.name == "src")
            .unwrap()
            .kind,
        "dir"
    );

    let src = list_dir(&dir.0, "src").unwrap();
    assert_eq!(src.entries[0].path, "src/main.ts");
}

#[test]
fn rejects_paths_outside_the_project() {
    let dir = temp_dir();
    fs::write(dir.0.join("note.txt"), "inside").unwrap();
    assert!(list_dir(&dir.0, "../").is_err());
    assert!(read_file(&dir.0, "../note.txt").is_err());
    assert!(read_file(&dir.0, "/etc/passwd").is_err());
    assert!(normalize_relative("src/../../etc/passwd").is_err());
}

#[test]
fn status_and_diff_cover_edits_untracked_and_deletes() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("readme.md"), "one\n").unwrap();
    git_ok(&dir.0, &["add", "readme.md"]);
    git_ok(&dir.0, &["commit", "-m", "init"]);
    fs::write(dir.0.join("readme.md"), "one\ntwo\n").unwrap();
    fs::write(dir.0.join("notes.txt"), "fresh\n").unwrap();
    fs::write(dir.0.join("gone.txt"), "remove me\n").unwrap();
    git_ok(&dir.0, &["add", "gone.txt"]);
    git_ok(&dir.0, &["commit", "-m", "add gone"]);
    fs::remove_file(dir.0.join("gone.txt")).unwrap();

    let status = repo_status(&dir.0).unwrap();
    assert!(status.available);
    assert!(status.repo);
    assert_eq!(status.branch.as_deref(), Some("main"));
    let codes: Vec<_> = status
        .files
        .iter()
        .map(|file| (file.path.as_str(), file.code.as_str()))
        .collect();
    assert!(codes.contains(&("readme.md", "M")), "{codes:?}");
    assert!(codes.contains(&("notes.txt", "?")), "{codes:?}");
    assert!(codes.contains(&("gone.txt", "D")), "{codes:?}");

    let diff = file_diff(&dir.0, "readme.md", None).unwrap();
    assert!(!diff.missing);
    assert!(diff.text.contains("+two"));
    assert!(diff.text.contains("@@"));

    let added = file_diff(&dir.0, "notes.txt", None).unwrap();
    assert!(added.text.contains("+fresh"), "{}", added.text);
    assert!(added.text.contains("--- /dev/null"));

    let removed = file_diff(&dir.0, "gone.txt", None).unwrap();
    assert!(removed.text.contains("-remove me"), "{}", removed.text);

    let counted = repo_status(&dir.0).unwrap();
    let readme = counted
        .files
        .iter()
        .find(|file| file.path == "readme.md")
        .unwrap();
    assert!(readme.additions >= 1, "{readme:?}");

    restore_worktree(&dir.0, "readme.md").unwrap();
    assert_eq!(fs::read_to_string(dir.0.join("readme.md")).unwrap(), "one\n");
    assert!(restore_worktree(&dir.0, "../readme.md").is_err());
}

#[test]
fn binary_files_are_not_returned_as_text() {
    let dir = temp_dir();
    fs::write(dir.0.join("mark.bin"), [0x89, 0x50, 0x4e, 0x47, 0, 1, 2]).unwrap();
    let file = read_file(&dir.0, "mark.bin").unwrap();
    assert!(file.binary);
    assert!(file.text.is_empty());
}

#[test]
fn plain_folders_are_not_repositories() {
    let dir = temp_dir();
    fs::write(dir.0.join("solo.txt"), "hi").unwrap();
    let status = repo_status(&dir.0).unwrap();
    assert!(status.available);
    assert!(!status.repo);
    assert!(status.files.is_empty());
    let history = log(&dir.0, None, 20).unwrap();
    assert!(history.available);
    assert!(!history.repo);
    let listing = list_dir(&dir.0, "").unwrap();
    assert_eq!(listing.entries[0].name, "solo.txt");
    let found = search_files(&dir.0).unwrap();
    assert_eq!(found.files, vec!["solo.txt".to_owned()]);
}

#[test]
fn history_keeps_merge_parents_and_commit_files() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("readme.md"), "root\n").unwrap();
    git_ok(&dir.0, &["add", "readme.md"]);
    git_ok(&dir.0, &["commit", "-m", "Lay out the workspace"]);
    git_ok(&dir.0, &["checkout", "-b", "model-search"]);
    fs::write(dir.0.join("search.ts"), "export const search = true\n").unwrap();
    git_ok(&dir.0, &["add", "search.ts"]);
    git_ok(
        &dir.0,
        &["commit", "-m", "Add search to the model selector"],
    );
    git_ok(&dir.0, &["checkout", "main"]);
    fs::write(dir.0.join("recent.ts"), "export const recent = []\n").unwrap();
    git_ok(&dir.0, &["add", "recent.ts"]);
    git_ok(&dir.0, &["commit", "-m", "Remember recently used models"]);
    git_ok(
        &dir.0,
        &[
            "merge",
            "--no-ff",
            "model-search",
            "-m",
            "Merge model search",
        ],
    );

    let history = log(&dir.0, None, 20).unwrap();
    assert!(history.repo);
    let merge = history
        .commits
        .iter()
        .find(|commit| commit.subject == "Merge model search")
        .unwrap();
    assert_eq!(merge.parents.len(), 2, "{:?}", merge.parents);
    assert!(merge.refs.contains("HEAD"));

    let files = commit_files(&dir.0, &merge.hash).unwrap();
    assert!(files.files.iter().any(|file| file.path == "search.ts"));

    let shown = file_diff(&dir.0, "search.ts", Some(&merge.hash)).unwrap();
    assert!(
        shown.text.contains("+export const search"),
        "{}",
        shown.text
    );

    let filtered = log(&dir.0, Some("search.ts"), 20).unwrap();
    assert!(filtered
        .commits
        .iter()
        .all(|commit| commit.subject.contains("search") || commit.subject.contains("Merge")));
}

#[test]
fn rename_status_keeps_both_paths() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("old-name.ts"), "export const value = 1\n").unwrap();
    git_ok(&dir.0, &["add", "old-name.ts"]);
    git_ok(&dir.0, &["commit", "-m", "add"]);
    git_ok(&dir.0, &["mv", "old-name.ts", "new-name.ts"]);
    let status = repo_status(&dir.0).unwrap();
    let renamed = status.files.iter().find(|file| file.code == "R");
    let renamed = renamed.unwrap_or_else(|| panic!("{status:?}"));
    assert_eq!(renamed.path, "new-name.ts");
    assert_eq!(renamed.old_path.as_deref(), Some("old-name.ts"));
}

#[test]
fn commit_branch_records_the_change_on_a_new_branch() {
    let dir = temp_dir();
    init_repo(&dir.0);
    fs::write(dir.0.join("readme.md"), "one\n").unwrap();
    git_ok(&dir.0, &["add", "readme.md"]);
    git_ok(&dir.0, &["commit", "-m", "init"]);
    fs::write(dir.0.join("readme.md"), "one\ntwo\n").unwrap();
    commit_branch(
        &dir.0,
        "review",
        "ship the change",
        &["readme.md".to_owned()],
    )
    .unwrap();
    let status = repo_status(&dir.0).unwrap();
    assert_eq!(status.branch.as_deref(), Some("review"));
    assert!(status.files.iter().all(|file| file.path != "readme.md"));
    let history = log(&dir.0, None, 5).unwrap();
    assert_eq!(history.commits[0].subject, "ship the change");
    assert!(commit_branch(&dir.0, "-bad", "nope", &["readme.md".to_owned()]).is_err());
}

#[test]
fn caps_oversized_diff_text() {
    let (text, truncated) = cap_text("a".repeat(20), 8);
    assert!(truncated);
    assert!(text.len() <= 8);
}
