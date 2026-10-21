//! Working tree status from `git status --porcelain=v1 -z`.

use super::{git, types::*};
use crate::i18n::Message;
use std::path::Path;

fn status_code(x: char, y: char) -> char {
    if x == '?' {
        return '?';
    }
    if x == 'U' || y == 'U' || (x == 'A' && y == 'A') || (x == 'D' && y == 'D') {
        return 'U';
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
        // Porcelain puts the new path first and the original path in the next record.
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

pub(crate) fn repo_status(root: &Path) -> Result<GitStatus, String> {
    if !git::is_repo(root) {
        return Ok(GitStatus {
            repo: false,
            branch: None,
            files: Vec::new(),
        });
    }
    let output = git::git(root, &["status", "--porcelain=v1", "-z", "-uall"])?;
    if !output.status.success() {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&output.stderr).trim()));
    }
    Ok(GitStatus {
        repo: true,
        branch: git::branch_name(root),
        files: parse_status(&output.stdout),
    })
}
