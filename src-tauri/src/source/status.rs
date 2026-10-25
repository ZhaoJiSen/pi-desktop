//! Working tree status from `git status --porcelain=v1 -z`.

use super::{git, types::*};
use crate::i18n::Message;
use std::path::Path;

const FILE_CAP: usize = 2_000;

fn status_code(x: char, y: char) -> char {
    if x == '?' {
        return '?';
    }
    if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
        return 'U';
    }
    if x == 'R' || x == 'C' {
        return x;
    }
    let primary = if y == ' ' { x } else { y };
    match primary {
        'A' | 'D' | 'R' | 'C' | 'M' | 'T' => primary,
        _ => 'M',
    }
}

pub(super) fn parse_status(bytes: &[u8]) -> Vec<GitFileStatus> {
    let mut parts = bytes
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty());
    let mut files = Vec::new();
    while let Some(entry) = parts.next() {
        if entry.len() < 4 {
            continue;
        }
        let x = entry[0] as char;
        let y = entry[1] as char;
        let path = String::from_utf8_lossy(&entry[3..]).replace('\\', "/");
        let rename = x == 'R' || y == 'R' || x == 'C' || y == 'C';
        let (path, old_path) = if rename {
            let Some(next) = parts.next() else {
                break;
            };
            (path, Some(String::from_utf8_lossy(next).replace('\\', "/")))
        } else {
            (path, None)
        };
        files.push(GitFileStatus {
            code: status_code(x, y).to_string(),
            staged: x != ' ' && x != '?',
            unstaged: y != ' ' && y != '?',
            additions: 0,
            deletions: 0,
            path,
            old_path,
        });
    }
    files
}

fn apply_numstat(files: &mut [GitFileStatus], bytes: &[u8]) {
    for line in String::from_utf8_lossy(bytes).lines() {
        let mut parts = line.split('\t');
        let Some(added) = parts.next() else { continue };
        let Some(deleted) = parts.next() else {
            continue;
        };
        let Some(raw_path) = parts.next() else {
            continue;
        };
        let path = raw_path
            .replace('\\', "/")
            .rsplit(" => ")
            .next()
            .unwrap_or(raw_path)
            .trim_matches('"')
            .to_owned();
        let Some(file) = files.iter_mut().find(|file| file.path == path) else {
            continue;
        };
        file.additions = file.additions.saturating_add(added.parse().unwrap_or(0));
        file.deletions = file.deletions.saturating_add(deleted.parse().unwrap_or(0));
    }
}

fn attach_numstat(root: &Path, files: &mut [GitFileStatus]) {
    if files.is_empty() {
        return;
    }
    let against_head = git::run(
        root,
        &["diff", "--relative", "--numstat", "HEAD", "--", "."],
        git::LIMIT_STATUS,
    );
    if let Ok(captured) = against_head {
        if captured.success || captured.truncated {
            apply_numstat(files, &captured.stdout);
            return;
        }
    }
    if let Ok(captured) = git::run(
        root,
        &["diff", "--relative", "--numstat", "--cached", "--", "."],
        git::LIMIT_STATUS,
    ) {
        if captured.success || captured.truncated {
            apply_numstat(files, &captured.stdout);
        }
    }
}

fn idle(available: bool, repo: bool) -> GitStatus {
    GitStatus {
        available,
        repo,
        branch: None,
        files: Vec::new(),
        truncated: false,
    }
}

pub(crate) fn repo_status(root: &Path) -> Result<GitStatus, String> {
    match git::presence(root)? {
        git::GitPresence::Missing => return Ok(idle(false, false)),
        git::GitPresence::Plain => return Ok(idle(true, false)),
        git::GitPresence::Repo => {}
    }
    let prefix = git::project_prefix(root)?;
    // An entirely untracked project folder otherwise collapses to the prefix itself.
    let untracked = if prefix.is_empty() {
        "-unormal"
    } else {
        "-uall"
    };
    let captured = git::run(
        root,
        &["status", "--porcelain=v1", "-z", untracked, "--", "."],
        git::LIMIT_STATUS,
    )?;
    if !captured.success && !captured.truncated {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&captured.stderr).trim()));
    }
    let mut files = parse_status(git::drop_partial_z(&captured.stdout, captured.truncated));
    files.retain_mut(|file| {
        let path = file.path.strip_prefix(&prefix).map(str::to_owned);
        let old = file
            .old_path
            .as_deref()
            .and_then(|p| p.strip_prefix(&prefix))
            .map(str::to_owned);
        match (path, old) {
            (Some(path), old) => {
                if file.old_path.is_some() && old.is_none() {
                    file.code = "A".into();
                }
                file.path = path;
                file.old_path = old;
                true
            }
            (None, Some(old)) => {
                file.path = old;
                file.old_path = None;
                file.code = "D".into();
                true
            }
            (None, None) => false,
        }
    });
    let mut truncated = captured.truncated;
    if files.len() > FILE_CAP {
        files.truncate(FILE_CAP);
        truncated = true;
    }
    attach_numstat(root, &mut files);
    Ok(GitStatus {
        available: true,
        repo: true,
        branch: git::branch_name(root),
        files,
        truncated,
    })
}
