//! Commit graph data and the files a commit changed.

use super::{git, paths, types::*};
use crate::i18n::Message;
use std::path::Path;

fn parse_log(bytes: &[u8]) -> Vec<GitCommit> {
    bytes
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .filter_map(|record| {
            let text = String::from_utf8_lossy(record);
            let mut fields = text.split('\u{1f}');
            let hash = fields.next()?.trim().to_owned();
            if hash.len() < 4 {
                return None;
            }
            let parents = fields
                .next()?
                .split_whitespace()
                .filter(|parent| !parent.is_empty())
                .map(ToOwned::to_owned)
                .collect();
            let author = fields.next()?.to_owned();
            let timestamp = fields.next()?.parse().ok()?;
            let refs = fields.next()?.to_owned();
            let subject = fields.collect::<Vec<_>>().join("\u{1f}");
            Some(GitCommit {
                hash,
                parents,
                author,
                timestamp,
                refs,
                subject,
            })
        })
        .collect()
}

fn empty_log(available: bool, repo: bool) -> GitLog {
    GitLog {
        available,
        repo,
        commits: Vec::new(),
    }
}

pub(crate) fn commit_log(
    root: &Path,
    relative: Option<&str>,
    limit: u32,
) -> Result<GitLog, String> {
    match git::presence(root)? {
        git::GitPresence::Missing => return Ok(empty_log(false, false)),
        git::GitPresence::Plain => return Ok(empty_log(true, false)),
        git::GitPresence::Repo => {}
    }
    let limit = limit.clamp(1, 400);
    let count = limit.to_string();
    let mut args = vec![
        "log",
        "--date-order",
        "-z",
        "-n",
        count.as_str(),
        "--pretty=format:%H%x1f%P%x1f%an%x1f%at%x1f%D%x1f%s",
    ];
    let path;
    if let Some(relative) = relative.filter(|value| !value.is_empty()) {
        path = paths::normalize_relative(relative)?;
        args.push("--");
        args.push(&path);
    }
    let captured = git::run(root, &args, git::LIMIT_LOG)?;
    if !captured.success && !captured.truncated {
        let stderr = String::from_utf8_lossy(&captured.stderr);
        if stderr.contains("does not have any commits") {
            return Ok(empty_log(true, true));
        }
        return Err(Message::GitRead.detail(stderr.trim()));
    }
    Ok(GitLog {
        available: true,
        repo: true,
        commits: parse_log(git::drop_partial_z(&captured.stdout, captured.truncated)),
    })
}

fn parse_name_status(bytes: &[u8]) -> Vec<CommitFile> {
    let parts: Vec<&[u8]> = bytes
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .collect();
    let mut index = 0;
    let mut files = Vec::new();
    while index < parts.len() {
        let status = String::from_utf8_lossy(parts[index]);
        index += 1;
        let code = status.chars().next().unwrap_or('M');
        if code == 'R' || code == 'C' {
            if index + 1 >= parts.len() {
                break;
            }
            let old_path = String::from_utf8_lossy(parts[index]).replace('\\', "/");
            let path = String::from_utf8_lossy(parts[index + 1]).replace('\\', "/");
            index += 2;
            files.push(CommitFile {
                path,
                code: code.to_string(),
                old_path: Some(old_path),
            });
            continue;
        }
        if index >= parts.len() {
            break;
        }
        let path = String::from_utf8_lossy(parts[index]).replace('\\', "/");
        index += 1;
        files.push(CommitFile {
            path,
            code: code.to_string(),
            old_path: None,
        });
    }
    files
}

pub(crate) fn commit_files(root: &Path, revision: &str) -> Result<GitCommitDetail, String> {
    if !git::valid_revision(revision) {
        return Err(Message::GitRead.text());
    }
    let hash = revision.to_owned();
    match git::presence(root)? {
        git::GitPresence::Missing => {
            return Ok(GitCommitDetail {
                available: false,
                repo: false,
                hash,
                files: Vec::new(),
            });
        }
        git::GitPresence::Plain => {
            return Ok(GitCommitDetail {
                available: true,
                repo: false,
                hash,
                files: Vec::new(),
            });
        }
        git::GitPresence::Repo => {}
    }
    let captured = git::run(
        root,
        &[
            "show",
            "--no-ext-diff",
            "--no-textconv",
            "--name-status",
            "--format=",
            "-z",
            "--first-parent",
            "--find-renames",
            revision,
        ],
        git::LIMIT_LOG,
    )?;
    if !captured.success && !captured.truncated {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&captured.stderr).trim()));
    }
    Ok(GitCommitDetail {
        available: true,
        repo: true,
        hash,
        files: parse_name_status(git::drop_partial_z(&captured.stdout, captured.truncated)),
    })
}
