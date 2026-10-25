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

const REPO_TTL: Duration = Duration::from_secs(5);
const PLAIN_TTL: Duration = Duration::from_secs(2);

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
            "--literal-pathspecs",
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
    let writer = thread::spawn(move || -> std::io::Result<()> {
        if let Some(mut pipe) = pipe {
            pipe.write_all(&payload)?;
        }
        Ok(())
    });
    let captured = capture::capture(child, limit);
    let write_result = writer.join();
    let captured = captured.map_err(|error| Message::GitRead.detail(error))?;
    match write_result {
        Ok(Ok(())) => Ok(captured),
        Ok(Err(error)) if error.kind() == ErrorKind::BrokenPipe => Ok(captured),
        Ok(Err(error)) => Err(Message::GitRead.detail(error)),
        Err(_) => Err(Message::GitRead.text()),
    }
}

struct PresenceHit {
    at: Instant,
    kind: GitPresence,
}

fn presence_cache() -> &'static Mutex<HashMap<PathBuf, PresenceHit>> {
    static CACHE: OnceLock<Mutex<HashMap<PathBuf, PresenceHit>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn presence_ttl(kind: GitPresence) -> Duration {
    if kind == GitPresence::Plain {
        PLAIN_TTL
    } else {
        REPO_TTL
    }
}

fn cached_presence(root: &Path) -> Option<GitPresence> {
    let guard = presence_cache().lock().ok()?;
    let hit = guard.get(root)?;
    if hit.kind == GitPresence::Missing || hit.at.elapsed() >= presence_ttl(hit.kind) {
        return None;
    }
    Some(hit.kind)
}

fn remember_presence(root: &Path, kind: GitPresence) {
    let Ok(mut guard) = presence_cache().lock() else {
        return;
    };
    if kind == GitPresence::Missing {
        guard.remove(root);
        return;
    }
    guard.insert(
        root.to_path_buf(),
        PresenceHit {
            at: Instant::now(),
            kind,
        },
    );
    if guard.len() > 32 {
        guard.retain(|_, hit| hit.at.elapsed() < presence_ttl(hit.kind));
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

/// Repo checks last a few seconds. Plain folders use a shorter cache. A missing binary is never stored.
pub(crate) fn presence(root: &Path) -> Result<GitPresence, String> {
    if let Some(hit) = cached_presence(root) {
        return Ok(hit);
    }
    let found = probe(root)?;
    remember_presence(root, found);
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

/// Porcelain paths are repository-relative even when Git runs in a project subdirectory.
pub(crate) fn project_prefix(root: &Path) -> Result<String, String> {
    let output = run(root, &["rev-parse", "--show-prefix"], LIMIT_SMALL)?;
    if !output.success || output.truncated {
        return Err(Message::GitRead.text());
    }
    Ok(String::from_utf8_lossy(&output.stdout)
        .trim_end_matches(['\n', '\r'])
        .to_owned())
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

/// Only the explicit synchronization API opts into configured remote transports.
pub(crate) fn run_sync(root: &Path, args: &[&str], network: bool) -> Result<Captured, String> {
    let mut command = base_command(root);
    if network {
        command.args(["-c", "protocol.ext.allow=never"]);
        for protocol in ["https", "http", "ssh", "git", "file"] {
            command.args(["-c", &format!("protocol.{protocol}.allow=always")]);
        }
        command.env("GIT_SSH_COMMAND", "ssh -oBatchMode=yes -oConnectTimeout=10");
        command
            .env("GIT_ASKPASS", "false")
            .env("SSH_ASKPASS", "false");
    }
    command
        .args(["-c", "core.editor=true", "-c", "sequence.editor=true"])
        .args(args)
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true");
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let child = capture::spawn(&mut command, Stdio::null())
        .map_err(|error| Message::GitUnavailable.detail(error))?;
    capture::capture_timeout(child, LIMIT_SMALL, Duration::from_secs(60))
        .map_err(|error| Message::GitRead.detail(error))
}

mod revision;
pub(crate) use revision::revision_position;
