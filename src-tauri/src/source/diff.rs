//! Unified diffs for the working tree and for one commit.

use super::{files, git, paths, types::*};
use crate::i18n::Message;
use std::{fs, path::Path};

fn binary_diff(text: &str) -> bool {
    text.lines().any(|line| {
        (line.starts_with("Binary files ") && line.ends_with(" differ"))
            || line.starts_with("GIT binary patch")
    })
}

fn blank(path: &str, repo: bool) -> GitDiff {
    GitDiff {
        available: true,
        repo,
        path: path.to_owned(),
        binary: false,
        truncated: false,
        missing: true,
        text: String::new(),
    }
}

fn unavailable(path: &str) -> GitDiff {
    GitDiff {
        available: false,
        repo: false,
        path: path.to_owned(),
        binary: false,
        truncated: false,
        missing: true,
        text: String::new(),
    }
}

fn finish_diff(path: &str, text: String, streamed: bool) -> GitDiff {
    if text.trim().is_empty() {
        return blank(path, true);
    }
    if binary_diff(&text) {
        return GitDiff {
            available: true,
            repo: true,
            path: path.to_owned(),
            binary: true,
            truncated: false,
            missing: false,
            text: String::new(),
        };
    }
    let (text, capped) = git::cap_text(text, git::LIMIT_DIFF);
    GitDiff {
        available: true,
        repo: true,
        path: path.to_owned(),
        binary: false,
        truncated: streamed || capped,
        missing: false,
        text,
    }
}

fn link_diff(path: &str, target: &str) -> GitDiff {
    GitDiff {
        available: true,
        repo: true,
        path: path.to_owned(),
        binary: false,
        truncated: false,
        missing: false,
        text: format!("--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,1 @@\n+{target}\n"),
    }
}

fn synthetic_untracked(root: &Path, path: &str) -> Result<GitDiff, String> {
    let candidate = root.join(path);
    let Ok(meta) = fs::symlink_metadata(&candidate) else {
        return Ok(blank(path, true));
    };
    if meta.file_type().is_symlink() {
        let target = fs::read_link(&candidate).map(|link| link.to_string_lossy().into_owned());
        return Ok(link_diff(path, target.as_deref().unwrap_or("")));
    }
    let Ok(full) = paths::inside(root, &candidate) else {
        return Ok(blank(path, true));
    };
    if !full.is_file() {
        return Ok(blank(path, true));
    }
    let (bytes, truncated, _) = files::read_limited(&full, git::LIMIT_DIFF)?;
    let text_bytes = files::trim_partial_char(&bytes);
    if bytes.iter().take(8_192).any(|byte| *byte == 0) || std::str::from_utf8(text_bytes).is_err() {
        return Ok(GitDiff {
            available: true,
            repo: true,
            path: path.to_owned(),
            binary: true,
            truncated: false,
            missing: false,
            text: String::new(),
        });
    }
    let body = String::from_utf8_lossy(text_bytes);
    let mut text = format!(
        "--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{} @@\n",
        body.lines().count()
    );
    for line in body.split_inclusive('\n') {
        text.push('+');
        text.push_str(line);
        if !line.ends_with('\n') {
            text.push('\n');
        }
    }
    if truncated {
        text.push_str("\\ truncated\n");
    }
    Ok(GitDiff {
        available: true,
        repo: true,
        path: path.to_owned(),
        binary: false,
        truncated,
        missing: false,
        text,
    })
}

fn captured_text(root: &Path, args: &[&str]) -> Result<(String, bool), String> {
    let captured = git::run(root, args, git::LIMIT_DIFF)?;
    if !captured.success && !captured.truncated {
        return Ok((String::new(), false));
    }
    Ok((
        String::from_utf8_lossy(&captured.stdout).into_owned(),
        captured.truncated,
    ))
}

fn working_diff(root: &Path, extra: &[&str], path: &str) -> Result<(String, bool), String> {
    let mut args = vec![
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        "--unified=3",
    ];
    args.extend_from_slice(extra);
    args.extend_from_slice(&["--", path]);
    captured_text(root, &args)
}

pub(crate) fn file_diff(
    root: &Path,
    relative: &str,
    revision: Option<&str>,
) -> Result<GitDiff, String> {
    let path = paths::normalize_relative(relative)?;
    if path.is_empty() {
        return Err(Message::SourceRead.text());
    }
    match git::presence(root)? {
        git::GitPresence::Missing => return Ok(unavailable(&path)),
        git::GitPresence::Plain => return Ok(blank(&path, false)),
        git::GitPresence::Repo => {}
    }
    if let Some(revision) = revision {
        if !git::valid_revision(revision) {
            return Err(Message::GitRead.text());
        }
        let captured = git::run(
            root,
            &[
                "show",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                "-m",
                "--first-parent",
                "--format=",
                "--unified=3",
                revision,
                "--",
                &path,
            ],
            git::LIMIT_DIFF,
        )?;
        if !captured.success && !captured.truncated {
            return Err(Message::GitRead.detail(String::from_utf8_lossy(&captured.stderr).trim()));
        }
        return Ok(finish_diff(
            &path,
            String::from_utf8_lossy(&captured.stdout).into_owned(),
            captured.truncated,
        ));
    }
    let (mut text, mut streamed) = working_diff(root, &["HEAD"], &path)?;
    if text.trim().is_empty() {
        (text, streamed) = working_diff(root, &["--cached"], &path)?;
    }
    if text.trim().is_empty() {
        let status = git::run(
            root,
            &["status", "--porcelain=v1", "-z", "--", &path],
            git::LIMIT_SMALL,
        )?;
        if status.stdout.starts_with(b"??") {
            return synthetic_untracked(root, &path);
        }
        return Ok(blank(&path, true));
    }
    Ok(finish_diff(&path, text, streamed))
}
