//! Directory listings, file reads, and project search.

use super::{git, paths, types::*};
use crate::i18n::Message;
use std::{collections::HashSet, fs, io::Read, path::Path};

const DIR_LIMIT: usize = 400;
const FILE_LIMIT: usize = 512 * 1024;
const SEARCH_LIMIT: usize = 8_000;

fn ignored_paths(root: &Path, relative_paths: &[String]) -> Result<HashSet<String>, String> {
    if relative_paths.is_empty() || !matches!(git::presence(root), Ok(git::GitPresence::Repo)) {
        return Ok(HashSet::new());
    }
    let mut stdin = Vec::new();
    for (index, path) in relative_paths.iter().enumerate() {
        if index > 0 {
            stdin.push(0);
        }
        stdin.extend(path.as_bytes());
    }
    let captured = git::run_stdin(
        root,
        &["check-ignore", "-z", "--stdin", "--"],
        &stdin,
        git::LIMIT_SEARCH,
    )?;
    // Exit 1 means nothing matched. A truncated read still lists the paths already seen.
    if !captured.success && !captured.truncated {
        return Ok(HashSet::new());
    }
    Ok(git::drop_partial_z(&captured.stdout, captured.truncated)
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(|part| {
            let path = String::from_utf8_lossy(part).replace('\\', "/");
            path.strip_prefix("./").unwrap_or(&path).to_owned()
        })
        .collect())
}

fn entry_kind(root: &Path, path: &Path) -> Option<&'static str> {
    let meta = fs::symlink_metadata(path).ok()?;
    if meta.file_type().is_symlink() {
        let followed = fs::metadata(path).ok();
        if followed.is_some_and(|item| item.is_dir()) && paths::inside(root, path).is_ok() {
            return Some("dir");
        }
        return Some("link");
    }
    Some(if meta.is_dir() { "dir" } else { "file" })
}

pub(crate) fn list_dir(root: &Path, relative: &str) -> Result<DirectoryListing, String> {
    let dir = paths::normalize_relative(relative)?;
    let folder = if dir.is_empty() {
        root.to_path_buf()
    } else {
        paths::inside(root, &root.join(&dir))?
    };
    if !folder.is_dir() {
        return Err(Message::SourceList.text());
    }
    let mut names = Vec::new();
    for entry in fs::read_dir(&folder).map_err(|error| Message::SourceList.detail(error))? {
        let entry = entry.map_err(|error| Message::SourceList.detail(error))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.is_empty() || name == ".git" {
            continue;
        }
        let Some(kind) = entry_kind(root, &entry.path()) else {
            continue;
        };
        names.push((name, kind));
    }
    let relative_paths = names
        .iter()
        .map(|(name, _)| paths::join_rel(&dir, name))
        .collect::<Vec<_>>();
    let ignored = ignored_paths(root, &relative_paths)?;
    names.retain(|(name, _)| !ignored.contains(&paths::join_rel(&dir, name)));
    names.sort_by(|(left, left_kind), (right, right_kind)| {
        let rank = |kind: &str| u8::from(kind != "dir");
        rank(left_kind)
            .cmp(&rank(right_kind))
            .then_with(|| left.to_lowercase().cmp(&right.to_lowercase()))
    });
    let truncated = names.len() > DIR_LIMIT;
    let entries = names
        .into_iter()
        .take(DIR_LIMIT)
        .map(|(name, kind)| DirectoryEntry {
            path: paths::join_rel(&dir, &name),
            kind: kind.to_owned(),
            name,
        })
        .collect();
    Ok(DirectoryListing { entries, truncated })
}

pub(crate) fn read_limited(path: &Path, limit: usize) -> Result<(Vec<u8>, bool, u64), String> {
    let file = fs::File::open(path).map_err(|error| Message::SourceRead.detail(error))?;
    let size = file
        .metadata()
        .map_err(|error| Message::SourceRead.detail(error))?
        .len();
    let mut buffer = Vec::new();
    file.take(limit as u64 + 1)
        .read_to_end(&mut buffer)
        .map_err(|error| Message::SourceRead.detail(error))?;
    let truncated = buffer.len() > limit;
    if truncated {
        buffer.truncate(limit);
    }
    Ok((buffer, truncated, size))
}

/// Drop a partial code point left by a byte cap. A real non-UTF8 file stays intact.
pub(crate) fn trim_partial_char(bytes: &[u8]) -> &[u8] {
    for extra in 0..4 {
        let end = bytes.len().saturating_sub(extra);
        if std::str::from_utf8(&bytes[..end]).is_ok() {
            return &bytes[..end];
        }
    }
    bytes
}

fn looks_binary(bytes: &[u8]) -> bool {
    bytes.iter().take(8_192).any(|byte| *byte == 0) || std::str::from_utf8(bytes).is_err()
}

pub(crate) fn read_file(root: &Path, relative: &str) -> Result<ProjectFile, String> {
    let path = paths::normalize_relative(relative)?;
    if path.is_empty() {
        return Err(Message::SourceRead.text());
    }
    let full = paths::inside(root, &root.join(&path))?;
    if !full.is_file() {
        return Err(Message::SourceRead.text());
    }
    let (bytes, truncated, size) = read_limited(&full, FILE_LIMIT)?;
    let text_bytes = if truncated {
        trim_partial_char(&bytes)
    } else {
        bytes.as_slice()
    };
    if looks_binary(text_bytes) {
        return Ok(ProjectFile {
            path,
            binary: true,
            truncated: false,
            size,
            text: String::new(),
        });
    }
    Ok(ProjectFile {
        path,
        binary: false,
        truncated,
        size,
        text: String::from_utf8_lossy(text_bytes).into_owned(),
    })
}

pub(crate) fn search_files(root: &Path) -> Result<ProjectSearch, String> {
    if matches!(git::presence(root), Ok(git::GitPresence::Repo)) {
        let captured = git::run(
            root,
            &[
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ],
            git::LIMIT_SEARCH,
        )?;
        if !captured.success && !captured.truncated {
            return Err(Message::GitRead.detail(String::from_utf8_lossy(&captured.stderr).trim()));
        }
        let mut files = git::z_paths(git::drop_partial_z(&captured.stdout, captured.truncated));
        let truncated = captured.truncated || files.len() > SEARCH_LIMIT;
        files.truncate(SEARCH_LIMIT);
        return Ok(ProjectSearch { files, truncated });
    }
    let mut files = Vec::new();
    let mut truncated = false;
    walk_files(root, root, 0, &mut files, &mut truncated);
    Ok(ProjectSearch { files, truncated })
}

fn walk_files(
    root: &Path,
    dir: &Path,
    depth: usize,
    files: &mut Vec<String>,
    truncated: &mut bool,
) {
    if *truncated || depth > 8 || files.len() >= SEARCH_LIMIT {
        *truncated = true;
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    let mut children: Vec<_> = entries.filter_map(|entry| entry.ok()).collect();
    children.sort_by_key(|entry| entry.file_name());
    for entry in children {
        if files.len() >= SEARCH_LIMIT {
            *truncated = true;
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if matches!(
            name.as_str(),
            "" | ".git" | "node_modules" | "target" | "dist"
        ) {
            continue;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            walk_files(root, &entry.path(), depth + 1, files, truncated);
            continue;
        }
        if !kind.is_file() {
            continue;
        }
        let Ok(canonical) = entry.path().canonicalize() else {
            continue;
        };
        if !canonical.starts_with(root) {
            continue;
        }
        let Ok(relative) = canonical.strip_prefix(root) else {
            continue;
        };
        files.push(relative.to_string_lossy().replace('\\', "/"));
    }
}
