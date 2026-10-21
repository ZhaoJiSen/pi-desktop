//! Create a local branch and commit the listed paths. Nothing here talks to a remote.

use super::{git, paths};
use crate::i18n::Message;
use std::path::Path;

fn valid_branch(name: &str) -> bool {
    let bytes = name.as_bytes();
    (1..=80).contains(&bytes.len())
        && !name.starts_with('-')
        && !name.starts_with('/')
        && !name.ends_with('/')
        && !name.ends_with('.')
        && !name.contains("..")
        && !name.contains("@{")
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'.' | b'_' | b'-'))
}

pub(crate) fn commit_branch(
    root: &Path,
    branch: &str,
    message: &str,
    relatives: &[String],
) -> Result<(), String> {
    let branch = branch.trim();
    let message = message.trim();
    if !valid_branch(branch) || message.is_empty() || message.len() > 2_000 || message.contains('\0')
    {
        return Err(Message::GitRead.text());
    }
    match git::presence(root)? {
        git::GitPresence::Missing => return Err(Message::GitUnavailable.text()),
        git::GitPresence::Plain => return Err(Message::GitRead.text()),
        git::GitPresence::Repo => {}
    }
    let mut paths = Vec::with_capacity(relatives.len());
    for relative in relatives {
        let path = paths::normalize_relative(relative)?;
        if path.is_empty() {
            return Err(Message::SourceRead.text());
        }
        paths.push(path);
    }
    if paths.is_empty() {
        return Err(Message::GitRead.text());
    }
    let switched = git::run(root, &["switch", "-c", branch], git::LIMIT_SMALL)?;
    if !switched.success {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&switched.stderr).trim()));
    }
    let mut add = vec!["add", "--"];
    for path in &paths {
        add.push(path);
    }
    let added = git::run(root, &add, git::LIMIT_SMALL)?;
    if !added.success {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&added.stderr).trim()));
    }
    let committed = git::run_stdin(root, &["commit", "-F", "-"], message.as_bytes(), git::LIMIT_SMALL)?;
    if !committed.success {
        return Err(Message::GitRead.detail(
            String::from_utf8_lossy(&committed.stderr).trim(),
        ));
    }
    Ok(())
}
