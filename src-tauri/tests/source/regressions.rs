use super::support::{git_ok, init_repo, temp_dir, TempDir, MUTATION_TEST};
use super::*;
use std::{fs, path::Path};

fn seeded(names: &[&str]) -> TempDir {
    let root = temp_dir();
    init_repo(&root.0);
    git_ok(&root.0, &["config", "commit.gpgsign", "false"]);
    git_ok(
        &root.0,
        &[
            "config",
            "core.hooksPath",
            root.0.join(".git/hooks").to_str().unwrap(),
        ],
    );
    for name in names {
        let path = root.0.join(name);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, "original\n").unwrap();
    }
    git_ok(&root.0, &["add", "."]);
    git_ok(&root.0, &["commit", "-m", "baseline"]);
    root
}

fn expected(root: &Path, resume: bool) -> commit::CommitExpectation {
    let state = branches::state(root).unwrap();
    commit::CommitExpectation {
        head: state.head,
        current: state.current,
        resume,
    }
}

#[test]
fn literal_restore_never_discards_matching_siblings() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["[ab].txt", "a.txt", "b.txt"]);
    for name in ["[ab].txt", "a.txt", "b.txt"] {
        fs::write(root.0.join(name), "edited\n").unwrap();
    }
    let diff = file_diff(&root.0, "[ab].txt", None).unwrap();
    assert_eq!(diff.text.matches("diff --git").count(), 1);
    restore_worktree(&root.0, "[ab].txt").unwrap();
    assert_eq!(
        fs::read_to_string(root.0.join("[ab].txt")).unwrap(),
        "original\n"
    );
    assert_eq!(
        fs::read_to_string(root.0.join("a.txt")).unwrap(),
        "edited\n"
    );
    assert_eq!(
        fs::read_to_string(root.0.join("b.txt")).unwrap(),
        "edited\n"
    );
}

#[test]
fn literal_commit_does_not_stage_matching_siblings() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["[ab].txt", "a.txt"]);
    for name in ["[ab].txt", "a.txt"] {
        fs::write(root.0.join(name), "edited\n").unwrap();
    }
    let before = expected(&root.0, false);
    commit::commit_branch(
        &root.0,
        "review",
        "literal",
        &["[ab].txt".into()],
        Some(&before),
    )
    .unwrap();
    let detail = commit_files(&root.0, &branches::state(&root.0).unwrap().head.unwrap()).unwrap();
    assert_eq!(detail.files.len(), 1);
    assert_eq!(detail.files[0].path, "[ab].txt");
    assert_eq!(repo_status(&root.0).unwrap().files[0].path, "a.txt");
}

#[test]
fn subproject_commit_keeps_unrelated_staged_work_out_of_the_commit() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["packages/app/app.ts", "outside.txt"]);
    let project = root.0.join("packages/app");
    fs::write(root.0.join("outside.txt"), "independent staged work\n").unwrap();
    git_ok(&root.0, &["add", "outside.txt"]);
    fs::write(project.join("app.ts"), "project edit\n").unwrap();
    let before = expected(&project, false);
    commit::commit_branch(
        &project,
        "review",
        "project only",
        &["app.ts".into()],
        Some(&before),
    )
    .unwrap();
    let head = branches::state(&root.0).unwrap().head.unwrap();
    let detail = commit_files(&root.0, &head).unwrap();
    assert_eq!(detail.files.len(), 1);
    assert_eq!(detail.files[0].path, "packages/app/app.ts");
    let status = repo_status(&root.0).unwrap();
    assert_eq!(status.files[0].path, "outside.txt");
    assert!(status.files[0].staged);
}

#[test]
fn commit_includes_both_paths_of_a_selected_staged_rename() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["old.txt"]);
    git_ok(&root.0, &["mv", "old.txt", "new.txt"]);
    let before = expected(&root.0, false);
    commit::commit_branch(
        &root.0,
        "review",
        "rename",
        &["new.txt".into()],
        Some(&before),
    )
    .unwrap();
    assert!(repo_status(&root.0).unwrap().files.is_empty());
    let detail = commit_files(&root.0, &branches::state(&root.0).unwrap().head.unwrap()).unwrap();
    assert_eq!(detail.files[0].code, "R");
    assert_eq!(detail.files[0].old_path.as_deref(), Some("old.txt"));
}

#[test]
fn restore_reverses_both_sides_of_a_staged_rename() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["old.txt"]);
    git_ok(&root.0, &["mv", "old.txt", "new.txt"]);
    fs::write(root.0.join("new.txt"), "original\nextra\n").unwrap();
    restore_worktree(&root.0, "new.txt").unwrap();
    assert_eq!(
        fs::read_to_string(root.0.join("old.txt")).unwrap(),
        "original\n"
    );
    assert!(!root.0.join("new.txt").exists());
    assert!(repo_status(&root.0).unwrap().files.is_empty());
}

#[test]
fn restore_does_not_overwrite_a_reused_old_filename() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["old.txt"]);
    git_ok(&root.0, &["mv", "old.txt", "new.txt"]);
    fs::write(root.0.join("old.txt"), "new independent work\n").unwrap();
    assert!(restore_worktree(&root.0, "new.txt").is_err());
    assert_eq!(
        fs::read_to_string(root.0.join("old.txt")).unwrap(),
        "new independent work\n"
    );
    assert!(root.0.join("new.txt").exists());
}

#[test]
fn subproject_paths_can_be_read_diffed_and_restored() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["packages/app/app.ts", "outside.txt"]);
    let project = root.0.join("packages/app");
    fs::write(project.join("app.ts"), "changed\n").unwrap();
    fs::write(root.0.join("outside.txt"), "unrelated\n").unwrap();
    let status = repo_status(&project).unwrap();
    assert_eq!(status.files.len(), 1);
    assert_eq!(status.files[0].path, "app.ts");
    assert_eq!(status.files[0].additions, 1);
    assert_eq!(read_file(&project, "app.ts").unwrap().text, "changed\n");
    assert!(file_diff(&project, "app.ts", None)
        .unwrap()
        .text
        .contains("+changed"));
    restore_worktree(&project, "app.ts").unwrap();
    assert!(repo_status(&project).unwrap().files.is_empty());
    assert_eq!(
        fs::read_to_string(root.0.join("outside.txt")).unwrap(),
        "unrelated\n"
    );
}

#[test]
fn an_entirely_untracked_subproject_lists_real_files_instead_of_an_empty_path() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["base.txt"]);
    let project = root.0.join("packages/app");
    fs::create_dir_all(&project).unwrap();
    fs::write(project.join("new.ts"), "new file\n").unwrap();
    let files = repo_status(&project).unwrap().files;
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].path, "new.ts");
    assert!(file_diff(&project, &files[0].path, None)
        .unwrap()
        .text
        .contains("+new file"));
}

#[test]
fn subproject_commit_details_use_project_relative_paths() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["packages/app/app.ts", "outside.txt"]);
    let project = root.0.join("packages/app");
    let head = branches::state(&root.0).unwrap().head.unwrap();
    let detail = commit_files(&project, &head).unwrap();
    assert_eq!(detail.files.len(), 1);
    assert_eq!(detail.files[0].path, "app.ts");
    assert!(
        !file_diff(&project, &detail.files[0].path, Some(&head))
            .unwrap()
            .missing
    );
}

#[test]
fn subproject_restore_reverses_renames_without_touching_outside_files() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["packages/app/old.ts", "outside.txt"]);
    let project = root.0.join("packages/app");
    git_ok(&project, &["mv", "old.ts", "new.ts"]);
    assert_eq!(
        repo_status(&project).unwrap().files[0].old_path.as_deref(),
        Some("old.ts")
    );
    restore_worktree(&project, "new.ts").unwrap();
    assert!(project.join("old.ts").exists());
    git_ok(&root.0, &["mv", "outside.txt", "packages/app/moved.txt"]);
    assert!(restore_worktree(&project, "moved.txt").is_err());
    assert!(project.join("moved.txt").exists());
}

#[test]
#[cfg(unix)]
fn a_failed_commit_can_resume_on_the_already_created_branch() {
    use std::os::unix::fs::PermissionsExt;
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["a.ts"]);
    fs::write(root.0.join("a.ts"), "edited\n").unwrap();
    let hook = root.0.join(".git/hooks/pre-commit");
    fs::write(&hook, "#!/bin/sh\nexit 1\n").unwrap();
    fs::set_permissions(&hook, fs::Permissions::from_mode(0o700)).unwrap();
    let before = expected(&root.0, false);
    assert!(
        commit::commit_branch(&root.0, "review", "change", &["a.ts".into()], Some(&before))
            .is_err()
    );
    let actual = expected(&root.0, true);
    assert_eq!(actual.current.as_deref(), Some("review"));
    assert_eq!(actual.head, before.head);
    fs::remove_file(hook).unwrap();
    commit::commit_branch(&root.0, "review", "change", &["a.ts".into()], Some(&actual)).unwrap();
    assert!(repo_status(&root.0).unwrap().files.is_empty());
}

#[test]
fn resume_rejects_a_branch_changed_outside_the_dialog() {
    let _guard = MUTATION_TEST.lock().unwrap();
    let root = seeded(&["a.ts"]);
    let stale = expected(&root.0, true);
    git_ok(&root.0, &["commit", "--allow-empty", "-m", "external"]);
    fs::write(root.0.join("a.ts"), "edited\n").unwrap();
    assert!(
        commit::commit_branch(&root.0, "main", "wrong", &["a.ts".into()], Some(&stale)).is_err()
    );
    assert_eq!(repo_status(&root.0).unwrap().files.len(), 1);
}
