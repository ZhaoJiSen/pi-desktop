//! Local `git` process helpers. Nothing here talks to a remote.

use crate::i18n::Message;
use std::{
    path::Path,
    process::{Command, Output, Stdio},
};

pub(crate) fn git(root: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .args(["-c", "core.quotepath=false", "-c", "core.fsmonitor=false"])
        .args(args)
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .map_err(|error| Message::GitUnavailable.detail(error))
}

pub(crate) fn git_stdin(root: &Path, args: &[&str], stdin: &[u8]) -> Result<Output, String> {
    let mut child = Command::new("git")
        .args(["-c", "core.quotepath=false"])
        .args(args)
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| Message::GitUnavailable.detail(error))?;
    if let Some(mut pipe) = child.stdin.take() {
        use std::io::Write;
        let _ = pipe.write_all(stdin);
    }
    child
        .wait_with_output()
        .map_err(|error| Message::GitRead.detail(error))
}

pub(crate) fn is_repo(root: &Path) -> bool {
    git(root, &["rev-parse", "--is-inside-work-tree"])
        .ok()
        .is_some_and(|output| output.status.success() && output.stdout.starts_with(b"true"))
}

pub(crate) fn branch_name(root: &Path) -> Option<String> {
    let output = git(root, &["symbolic-ref", "--quiet", "--short", "HEAD"]).ok()?;
    if !output.status.success() {
        return None;
    }
    let name = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    (!name.is_empty()).then_some(name)
}

pub(crate) fn z_paths(bytes: &[u8]) -> Vec<String> {
    bytes
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(|part| String::from_utf8_lossy(part).replace('\\', "/"))
        .collect()
}

pub(crate) fn valid_revision(revision: &str) -> bool {
    let bytes = revision.as_bytes();
    (4..=64).contains(&bytes.len()) && bytes.iter().all(|byte| byte.is_ascii_hexdigit())
}

pub(crate) fn cap_text(text: String, limit: usize) -> (String, bool) {
    if text.len() <= limit {
        return (text, false);
    }
    let mut end = limit.min(text.len());
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    if let Some(newline) = text[..end].rfind('\n') {
        end = newline;
    }
    let mut capped = text;
    capped.truncate(end);
    (capped, true)
}
