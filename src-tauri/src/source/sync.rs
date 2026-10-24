//! Remote synchronization and explicit conflict recovery, serialized with branch actions.
use super::{branches, files, git, paths};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path, time::UNIX_EPOCH};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub branch: branches::BranchState,
    pub remote: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u64,
    pub behind: u64,
    pub last_fetch: Option<u64>,
    pub conflicts: Vec<String>,
}
#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SyncAction {
    Fetch,
    Pull,
    Resolve,
    Continue,
    Abort,
}
#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PullMode {
    FfOnly,
    Merge,
    Rebase,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    pub action: SyncAction,
    pub mode: Option<PullMode>,
    pub relative: Option<String>,
    pub expected_head: Option<String>,
    pub expected_branch: Option<String>,
    pub expected_upstream: Option<String>,
}
fn checked(root: &Path, args: &[&str], network: bool) -> Result<String, String> {
    let output = git::run_sync(root, args, network)?;
    if !output.success || output.truncated {
        return Err(format!(
            "{}\n{}",
            String::from_utf8_lossy(&output.stderr),
            String::from_utf8_lossy(&output.stdout)
        )
        .trim()
        .to_owned());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_owned())
}
fn optional(root: &Path, args: &[&str]) -> Result<Option<String>, String> {
    let output = git::run(root, args, git::LIMIT_SMALL)?;
    if output.truncated {
        return Err("SOURCE_SYNC_LIMIT".into());
    }
    Ok(output
        .success
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_owned())
        .filter(|s| !s.is_empty()))
}
fn conflicts(root: &Path) -> Result<Vec<String>, String> {
    let output = git::run(
        root,
        &["diff", "--name-only", "--diff-filter=U", "-z"],
        git::LIMIT_STATUS,
    )?;
    if !output.success || output.truncated {
        return Err("SOURCE_SYNC_LIMIT".into());
    }
    Ok(git::z_paths(&output.stdout))
}
pub(crate) fn state(root: &Path) -> Result<SyncState, String> {
    let branch = branches::state(root)?;
    let refs = if branch.current.is_some() {
        optional(
            root,
            &[
                "for-each-ref",
                "--format=%(upstream)%09%(upstream:short)%09%(upstream:remotename)",
                &format!("refs/heads/{}", branch.current.as_deref().unwrap_or("")),
            ],
        )?
        .unwrap_or_default()
    } else {
        String::new()
    };
    let mut parts = refs.split('\t');
    let upstream_ref = parts.next().filter(|s| !s.is_empty());
    let upstream = parts.next().filter(|s| !s.is_empty()).map(str::to_owned);
    let configured_remote = parts.next().filter(|s| !s.is_empty() && *s != ".");
    let remotes = optional(root, &["remote"])?.unwrap_or_default();
    let remote = if upstream.is_some() {
        configured_remote.filter(|r| remotes.lines().any(|s| s == *r))
    } else {
        remotes
            .lines()
            .find(|r| *r == "origin")
            .or_else(|| remotes.lines().next())
    }
    .map(str::to_owned);
    let (ahead, behind) = if let Some(reference) = upstream_ref {
        let counts = optional(
            root,
            &[
                "rev-list",
                "--left-right",
                "--count",
                &format!("HEAD...{reference}"),
                "--",
            ],
        )?
        .unwrap_or_default();
        let mut counts = counts.split_whitespace().filter_map(|s| s.parse().ok());
        (counts.next().unwrap_or(0), counts.next().unwrap_or(0))
    } else {
        (0, 0)
    };
    let fetch_path = optional(root, &["rev-parse", "--git-path", "pi-desktop-last-fetch"])?;
    let last_fetch = fetch_path
        .and_then(|p| {
            let path = root.join(p);
            (fs::read_to_string(&path).ok().as_deref() == remote.as_deref())
                .then(|| fs::metadata(path).ok())
                .flatten()
        })
        .and_then(|m| m.modified().ok())
        .and_then(|at| at.duration_since(UNIX_EPOCH).ok())
        .map(|at| at.as_millis() as u64);
    Ok(SyncState {
        branch,
        remote,
        upstream,
        ahead,
        behind,
        last_fetch,
        conflicts: conflicts(root)?,
    })
}
fn fetch(root: &Path, remote: Option<&str>) -> Result<(), String> {
    let remote = remote.ok_or("SOURCE_SYNC_NO_REMOTE")?;
    // Names come from `git remote`, never arbitrary caller-supplied URLs or options.
    checked(
        root,
        &["fetch", "--no-recurse-submodules", "--", remote],
        true,
    )?;
    let stamp = checked(
        root,
        &["rev-parse", "--git-path", "pi-desktop-last-fetch"],
        false,
    )?;
    fs::write(root.join(stamp), remote).map_err(|e| e.to_string())?;
    Ok(())
}
fn verify(current: &SyncState, request: &SyncRequest) -> Result<(), String> {
    if current.branch.head != request.expected_head
        || current.branch.current != request.expected_branch
        || current.upstream != request.expected_upstream
    {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    Ok(())
}
fn conflict_path(root: &Path, relative: &str) -> Result<String, String> {
    let path = paths::normalize_relative(relative)?;
    if !conflicts(root)?.contains(&path) {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    Ok(path)
}
fn markers_in_file(path: &Path) -> Result<bool, String> {
    use std::io::Read;
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = [0_u8; 8192];
    let mut marker = 0_u8;
    let mut run = 0;
    let mut at_start = true;
    let mut found = false;
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            return Ok(found);
        }
        for &byte in &buffer[..count] {
            if byte == 0 {
                return Ok(false);
            } // Binary resolution is explicitly confirmed by the user.
            if byte == b'\n' {
                at_start = true;
                marker = 0;
                run = 0;
                continue;
            }
            if !at_start {
                continue;
            }
            if run == 0 && b"<=>|".contains(&byte) {
                marker = byte;
            }
            if marker != 0 && byte == marker {
                run += 1;
                if run >= 7 {
                    found = true;
                    at_start = false;
                }
            } else {
                at_start = false;
            }
        }
    }
}
pub(crate) fn execute(root: &Path, request: &SyncRequest) -> Result<(), String> {
    let _guard = branches::OPERATION
        .try_lock()
        .map_err(|_| "SOURCE_SYNC_BUSY")?;
    let current = state(root)?;
    if request.action == SyncAction::Fetch {
        return fetch(root, current.remote.as_deref());
    }
    verify(&current, request)?;
    if request.action == SyncAction::Pull {
        if current.branch.operation.is_some() || !current.conflicts.is_empty() {
            return Err("SOURCE_SYNC_PENDING".into());
        }
        if current.branch.dirty {
            return Err("SOURCE_SYNC_DIRTY".into());
        }
        if current.branch.current.is_none() || current.upstream.is_none() {
            return Err("SOURCE_SYNC_NO_UPSTREAM".into());
        }
        fetch(root, current.remote.as_deref())?;
        let after = state(root)?;
        verify(&after, request)?;
        if after.branch.dirty {
            return Err("SOURCE_SYNC_DIRTY".into());
        }
        if after.branch.operation.is_some() {
            return Err("SOURCE_SYNC_PENDING".into());
        }
        let upstream = checked(
            root,
            &["rev-parse", "--symbolic-full-name", "@{upstream}"],
            false,
        )?;
        let tip = checked(root, &["rev-parse", "--verify", &upstream], false)?;
        if !git::valid_revision(&tip) {
            return Err("SOURCE_SYNC_NO_UPSTREAM".into());
        }
        match request.mode.as_ref().unwrap_or(&PullMode::FfOnly) {
            PullMode::FfOnly => {
                checked(root, &["merge", "--ff-only", "--no-edit", &tip], false)?;
            }
            PullMode::Merge => {
                checked(root, &["merge", "--ff", "--no-edit", &tip], false)?;
            }
            PullMode::Rebase => {
                checked(root, &["rebase", &tip], false)?;
            }
        }
        return Ok(());
    }
    if request.action == SyncAction::Resolve {
        let relative = conflict_path(root, request.relative.as_deref().unwrap_or(""))?;
        let candidate = root.join(&relative);
        if candidate.symlink_metadata().is_ok() {
            let inside = paths::inside(root, &candidate)?;
            if inside.is_file()
                && !candidate
                    .symlink_metadata()
                    .map_err(|e| e.to_string())?
                    .file_type()
                    .is_symlink()
                && markers_in_file(&inside)?
            {
                return Err("SOURCE_SYNC_MARKERS".into());
            }
        } else {
            // A removed file is valid, but its parent still must remain inside the repository.
            let mut parent = candidate.parent().ok_or("SOURCE_SYNC_CHANGED")?;
            while !parent.exists() {
                parent = parent.parent().ok_or("SOURCE_SYNC_CHANGED")?;
            }
            paths::inside(root, parent)?;
        }
        checked(
            root,
            &["--literal-pathspecs", "add", "-A", "--", &relative],
            false,
        )?;
        return Ok(());
    }
    let operation = current
        .branch
        .operation
        .as_deref()
        .ok_or("SOURCE_SYNC_CHANGED")?;
    if request.action == SyncAction::Abort {
        checked(root, &[operation, "--abort"], false)?;
    } else {
        if !current.conflicts.is_empty() {
            return Err("SOURCE_SYNC_PENDING".into());
        }
        // --continue rechecks Git's operation metadata; never manufacture a replacement commit.
        checked(root, &[operation, "--continue"], false)?;
    }
    Ok(())
}

pub(crate) fn write_resolution(
    root: &Path,
    relative: &str,
    expected: &str,
    text: &str,
) -> Result<(), String> {
    let _guard = branches::OPERATION
        .try_lock()
        .map_err(|_| "SOURCE_SYNC_BUSY")?;
    let relative = conflict_path(root, relative)?;
    let candidate = root.join(relative);
    // Editing symlinks and binary/large files belongs in the user's external editor.
    if candidate
        .symlink_metadata()
        .map_err(|e| e.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("SOURCE_SYNC_LIMIT".into());
    }
    let inside = paths::inside(root, &candidate)?;
    let (bytes, truncated, _) = files::read_limited(&inside, git::LIMIT_DIFF)?;
    if truncated
        || bytes.contains(&0)
        || text.len() > git::LIMIT_DIFF
        || std::str::from_utf8(&bytes).is_err()
    {
        return Err("SOURCE_SYNC_LIMIT".into());
    }
    if bytes != expected.as_bytes() {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    // Write through an open file, not a truncate-by-path, so a replaced symlink cannot redirect the write.
    let mut options = fs::OpenOptions::new();
    options.write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    options.read(true);
    let mut file = options.open(&inside).map_err(|e| e.to_string())?;
    use std::io::{Read, Seek, Write};
    let mut actual = Vec::new();
    Read::by_ref(&mut file)
        .take(git::LIMIT_DIFF as u64 + 1)
        .read_to_end(&mut actual)
        .map_err(|e| e.to_string())?;
    if actual != bytes {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    file.rewind().map_err(|e| e.to_string())?;
    file.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    file.set_len(text.len() as u64).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::source::support::{git_ok, init_repo, temp_dir, TempDir};
    use std::sync::Mutex;
    static TEST: Mutex<()> = Mutex::new(());
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
}
