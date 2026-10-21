//! Local `git` process helpers. Nothing here talks to a remote.

use super::capture::{self, Captured};
use crate::i18n::Message;
use std::{
    collections::HashMap,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
    process::Stdio,
    sync::{Mutex, OnceLock},
    thread,
    time::{Duration, Instant},
};

pub(crate) const LIMIT_DIFF: usize = 256 * 1024;
pub(crate) const LIMIT_STATUS: usize = 1024 * 1024;
pub(crate) const LIMIT_LOG: usize = 1024 * 1024;
pub(crate) const LIMIT_SEARCH: usize = 1024 * 1024;
pub(crate) const LIMIT_SMALL: usize = 64 * 1024;

const PRESENCE_TTL: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum GitPresence {
    Repo,
    Plain,
    Missing,
}

enum Start {
    Missing,
    Error(String),
}

fn base_command(root: &Path) -> std::process::Command {
    let mut command = std::process::Command::new("git");
    command
        .args([
            "-c",
            "core.quotepath=false",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "protocol.allow=never",
        ])
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0");
    command
}

fn spawn(root: &Path, args: &[&str], stdin: Stdio) -> Result<std::process::Child, Start> {
    let mut command = base_command(root);
    command.args(args);
    capture::spawn(&mut command, stdin).map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            Start::Missing
        } else {
            Start::Error(Message::GitUnavailable.detail(error))
        }
    })
}

pub(crate) fn run(root: &Path, args: &[&str], limit: usize) -> Result<Captured, String> {
    let child = match spawn(root, args, Stdio::null()) {
        Ok(child) => child,
        Err(Start::Missing) => return Err(Message::GitUnavailable.text()),
        Err(Start::Error(message)) => return Err(message),
    };
    capture::capture(child, limit).map_err(|error| Message::GitRead.detail(error))
}

pub(crate) fn run_stdin(
    root: &Path,
    args: &[&str],
    stdin: &[u8],
    limit: usize,
) -> Result<Captured, String> {
    let mut child = match spawn(root, args, Stdio::piped()) {
        Ok(child) => child,
        Err(Start::Missing) => return Err(Message::GitUnavailable.text()),
        Err(Start::Error(message)) => return Err(message),
    };
    let pipe = child.stdin.take();
    let payload = stdin.to_vec();
    let writer = thread::spawn(move || {
        if let Some(mut pipe) = pipe {
            let _ = pipe.write_all(&payload);
        }
    });
    let captured = capture::capture(child, limit).map_err(|error| Message::GitRead.detail(error));
    let _ = writer.join();
    captured
}

fn presence_cache() -> &'static Mutex<HashMap<PathBuf, Instant>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, Instant>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn cached_repo(root: &Path) -> bool {
    let Ok(guard) = presence_cache().lock() else {
        return false;
    };
    guard
        .get(root)
        .is_some_and(|seen| seen.elapsed() < PRESENCE_TTL)
}

fn remember_repo(root: &Path) {
    let Ok(mut guard) = presence_cache().lock() else {
        return;
    };
    guard.insert(root.to_path_buf(), Instant::now());
    if guard.len() > 32 {
        guard.retain(|_, seen| seen.elapsed() < PRESENCE_TTL);
    }
}

fn forget_repo(root: &Path) {
    if let Ok(mut guard) = presence_cache().lock() {
        guard.remove(root);
    }
}

fn probe(root: &Path) -> Result<GitPresence, String> {
    let child = match spawn(root, &["rev-parse", "--is-inside-work-tree"], Stdio::null()) {
        Ok(child) => child,
        Err(Start::Missing) => return Ok(GitPresence::Missing),
        Err(Start::Error(message)) => return Err(message),
    };
    let captured = capture::capture(child, 32).map_err(|error| Message::GitRead.detail(error))?;
    if captured.success && captured.stdout.starts_with(b"true") {
        Ok(GitPresence::Repo)
    } else {
        Ok(GitPresence::Plain)
    }
}

/// Repo checks are reused for a few seconds. A missing binary is never stored as "not a repo".
pub(crate) fn presence(root: &Path) -> Result<GitPresence, String> {
    if cached_repo(root) {
        return Ok(GitPresence::Repo);
    }
    let found = probe(root)?;
    if found == GitPresence::Repo {
        remember_repo(root);
    } else {
        forget_repo(root);
    }
    Ok(found)
}

pub(crate) fn branch_name(root: &Path) -> Option<String> {
    let output = run(
        root,
        &["symbolic-ref", "--quiet", "--short", "HEAD"],
        LIMIT_SMALL,
    )
    .ok()?;
    if !output.success || output.truncated {
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

pub(crate) fn drop_partial_z(bytes: &[u8], truncated: bool) -> &[u8] {
    if !truncated {
        return bytes;
    }
    match bytes.iter().rposition(|byte| *byte == 0) {
        Some(index) => &bytes[..index],
        None => &[],
    }
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
