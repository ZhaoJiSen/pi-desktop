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

fn parse_status(bytes: &[u8]) -> Vec<GitFileStatus> {
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
            path,
            old_path,
        });
    }
    files
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
    let captured = git::run(
        root,
        &["status", "--porcelain=v1", "-z", "-unormal"],
        git::LIMIT_STATUS,
    )?;
    if !captured.success && !captured.truncated {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&captured.stderr).trim()));
    }
    let mut files = parse_status(git::drop_partial_z(&captured.stdout, captured.truncated));
    let mut truncated = captured.truncated;
    if files.len() > FILE_CAP {
        files.truncate(FILE_CAP);
        truncated = true;
    }
    Ok(GitStatus {
        available: true,
        repo: true,
        branch: git::branch_name(root),
        files,
        truncated,
    })
}
