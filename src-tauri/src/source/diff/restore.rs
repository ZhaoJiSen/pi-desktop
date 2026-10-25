use super::*;
use crate::source::{branches, status};

/// Restore a literal tracked path and both sides of a staged rename.
pub(crate) fn restore_worktree(root: &Path, relative: &str) -> Result<(), String> {
    let path = paths::normalize_relative(relative)?;
    if path.is_empty() {
        return Err(Message::SourceRead.text());
    }
    let _guard = branches::OPERATION
        .try_lock()
        .map_err(|_| Message::GitOperationPending.text())?;
    match git::presence(root)? {
        git::GitPresence::Missing => return Err(Message::GitUnavailable.text()),
        git::GitPresence::Plain => return Err(Message::GitRead.text()),
        git::GitPresence::Repo => {}
    }
    if branches::state(root)?.operation.is_some() {
        return Err(Message::GitOperationPending.text());
    }
    let prefix = git::project_prefix(root)?;
    let selected = format!("{prefix}{path}");
    let raw = git::run(
        root,
        &["status", "--porcelain=v1", "-z", "-uno"],
        git::LIMIT_STATUS,
    )?;
    if !raw.success || raw.truncated {
        return Err(Message::GitRead.text());
    }
    let mut targets = vec![path.clone()];
    for file in status::parse_status(&raw.stdout) {
        if file.code != "R"
            || (file.path != selected && file.old_path.as_deref() != Some(&selected))
        {
            continue;
        }
        let old = file
            .old_path
            .as_deref()
            .ok_or_else(|| Message::GitRead.text())?;
        let old = old
            .strip_prefix(&prefix)
            .ok_or_else(|| Message::SourceOutside.text())?;
        let new = file
            .path
            .strip_prefix(&prefix)
            .ok_or_else(|| Message::SourceOutside.text())?;
        // Never overwrite a new, untracked file that reused the rename's old name.
        if old != path && root.join(old).symlink_metadata().is_ok() {
            return Err(Message::GitBranchChanged.text());
        }
        targets.extend([old.to_owned(), new.to_owned()]);
    }
    targets.sort();
    targets.dedup();
    let mut args = vec!["restore", "--source=HEAD", "--worktree", "--staged", "--"];
    args.extend(targets.iter().map(String::as_str));
    let result = git::run(root, &args, git::LIMIT_SMALL)?;
    if !result.success {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&result.stderr).trim()));
    }
    Ok(())
}
