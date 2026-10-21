//! Unified diffs for the working tree and for one commit.

use super::{files, git, paths, types::*};
use crate::i18n::Message;
use std::path::Path;

const DIFF_LIMIT: usize = 256 * 1024;

fn binary_diff(text: &str) -> bool {
    text.contains("Binary files ") || text.contains("GIT binary patch")
}

fn empty_diff(path: &str, repo: bool) -> GitDiff {
    GitDiff {
        repo,
        path: path.to_owned(),
        binary: false,
        truncated: false,
        missing: true,
        text: String::new(),
    }
}

fn finish_diff(path: &str, text: String) -> GitDiff {
    if text.trim().is_empty() {
        return empty_diff(path, true);
    }
    if binary_diff(&text) {
        return GitDiff {
            repo: true,
            path: path.to_owned(),
            binary: true,
            truncated: false,
            missing: false,
            text: String::new(),
        };
    }
    let (text, truncated) = git::cap_text(text, DIFF_LIMIT);
    GitDiff {
        repo: true,
        path: path.to_owned(),
        binary: false,
        truncated,
        missing: false,
        text,
    }
}

fn synthetic_untracked(root: &Path, path: &str) -> Result<GitDiff, String> {
    let full = root.join(path);
    if !full.is_file() {
        return Ok(empty_diff(path, true));
    }
    let (bytes, truncated, _) = files::read_limited(&full, DIFF_LIMIT)?;
    let text_bytes = files::trim_partial_char(&bytes);
    if bytes.iter().take(8_192).any(|byte| *byte == 0) || std::str::from_utf8(text_bytes).is_err() {
        return Ok(GitDiff {
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
    Ok(GitDiff {
        repo: true,
        path: path.to_owned(),
        binary: false,
        truncated,
        missing: false,
        text,
    })
}

fn diff_stdout(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = git::git(root, args)?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Ok(String::new())
    }
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
    if !git::is_repo(root) {
        return Ok(empty_diff(&path, false));
    }
    if let Some(revision) = revision {
        if !git::valid_revision(revision) {
            return Err(Message::GitRead.text());
        }
        let output = git::git(
            root,
            &[
                "show",
                "--no-ext-diff",
                "--no-color",
                "-m",
                "--first-parent",
                "--format=",
                "--unified=3",
                revision,
                "--",
                &path,
            ],
        )?;
        if !output.status.success() {
            return Err(Message::GitRead.detail(String::from_utf8_lossy(&output.stderr).trim()));
        }
        return Ok(finish_diff(
            &path,
            String::from_utf8_lossy(&output.stdout).into_owned(),
        ));
    }
    let mut text = diff_stdout(
        root,
        &[
            "diff",
            "--no-ext-diff",
            "--no-color",
            "--unified=3",
            "HEAD",
            "--",
            &path,
        ],
    )?;
    if text.trim().is_empty() {
        text = diff_stdout(
            root,
            &[
                "diff",
                "--no-ext-diff",
                "--no-color",
                "--unified=3",
                "--cached",
                "--",
                &path,
            ],
        )?;
    }
    if text.trim().is_empty() {
        let status = git::git(root, &["status", "--porcelain=v1", "-z", "--", &path])?;
        if status.stdout.starts_with(b"??") {
            return synthetic_untracked(root, &path);
        }
        return Ok(empty_diff(&path, true));
    }
    Ok(finish_diff(&path, text))
}
