//! Project-relative paths. Absolute paths and `..` never leave the root.

use crate::i18n::Message;
use std::path::{Path, PathBuf};

pub(crate) fn normalize_relative(relative: &str) -> Result<String, String> {
    if relative.contains('\0') || Path::new(relative).is_absolute() {
        return Err(Message::SourceOutside.text());
    }
    let mut parts = Vec::new();
    for part in relative.split(['/', '\\']) {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            return Err(Message::SourceOutside.text());
        }
        parts.push(part);
    }
    Ok(parts.join("/"))
}

pub(crate) fn inside(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let canonical = candidate
        .canonicalize()
        .map_err(|error| Message::SourceRead.detail(error))?;
    if !canonical.starts_with(root) {
        return Err(Message::SourceOutside.text());
    }
    Ok(canonical)
}

pub(crate) fn join_rel(dir: &str, name: &str) -> String {
    if dir.is_empty() {
        name.to_owned()
    } else {
        format!("{dir}/{name}")
    }
}
