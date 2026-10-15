use super::{CloneError, Result};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub(super) fn valid_url(input: &str) -> bool {
    if input.is_empty()
        || input.len() > 4096
        || input.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return false;
    }
    if input.starts_with("https://") || input.starts_with("ssh://") {
        let Ok(url) = reqwest::Url::parse(input) else {
            return false;
        };
        return url.host_str().is_some()
            && url.password().is_none()
            && (url.scheme() == "ssh" || url.username().is_empty())
            && url.query().is_none()
            && url.fragment().is_none()
            && url.path().split('/').any(|part| !part.is_empty());
    }
    let Some((authority, path)) = input.split_once(':') else {
        return false;
    };
    let Some((user, host)) = authority.split_once('@') else {
        return false;
    };
    let valid_part = |part: &str| {
        !part.is_empty()
            && part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
    };
    valid_part(user)
        && valid_part(host)
        && !path.is_empty()
        && path
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_./~-".contains(c))
}

pub(super) fn valid_name(name: &str) -> bool {
    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let reserved = matches!(stem.as_str(), "con" | "prn" | "aux" | "nul")
        || (stem.len() == 4
            && (stem.starts_with("com") || stem.starts_with("lpt"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'));
    !name.is_empty()
        && name.len() <= 120
        && name == name.trim()
        && !name.ends_with(['.', ' '])
        && !name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        && !reserved
}

pub(super) fn parent_path(home: &Path, input: &str) -> Result<PathBuf> {
    let path = if input == "~" {
        home.to_path_buf()
    } else if let Some(relative) = input.strip_prefix("~/") {
        home.join(relative)
    } else {
        PathBuf::from(input)
    };
    if !path.is_absolute() {
        return Err(CloneError::new("parent"));
    }
    if path == home.join("Projects") {
        fs::create_dir_all(&path).map_err(|_| CloneError::new("parent"))?;
    }
    let path = path.canonicalize().map_err(|_| CloneError::new("parent"))?;
    if !path.is_dir() {
        return Err(CloneError::new("parent"));
    }
    Ok(path)
}
