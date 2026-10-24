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
mod conflict_files;
pub(crate) use conflict_files::write_resolution;
use conflict_files::{conflict_path, markers_in_file};

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

#[cfg(test)]
mod tests;
