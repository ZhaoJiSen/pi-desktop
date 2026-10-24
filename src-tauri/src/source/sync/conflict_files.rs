use super::*;

pub(super) fn conflict_path(root: &Path, relative: &str) -> Result<String, String> {
    let path = paths::normalize_relative(relative)?;
    if !conflicts(root)?.contains(&path) {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    Ok(path)
}
pub(super) fn markers_in_file(path: &Path) -> Result<bool, String> {
    use std::io::Read;
    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = [0_u8; 8192];
    let mut marker = 0_u8;
    let mut run = 0;
    let mut at_start = true;
    let mut found = false;
    loop {
        let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if count == 0 {
            return Ok(found);
        }
        for &byte in &buffer[..count] {
            if byte == 0 {
                return Ok(false);
            } // Binary resolution is explicitly confirmed by the user.
            if byte == b'\n' {
                at_start = true;
                marker = 0;
                run = 0;
                continue;
            }
            if !at_start {
                continue;
            }
            if run == 0 && b"<=>|".contains(&byte) {
                marker = byte;
            }
            if marker != 0 && byte == marker {
                run += 1;
                if run >= 7 {
                    found = true;
                    at_start = false;
                }
            } else {
                at_start = false;
            }
        }
    }
}
pub(crate) fn write_resolution(
    root: &Path,
    relative: &str,
    expected: &str,
    text: &str,
) -> Result<(), String> {
    let _guard = branches::OPERATION
        .try_lock()
        .map_err(|_| "SOURCE_SYNC_BUSY")?;
    let relative = conflict_path(root, relative)?;
    let candidate = root.join(relative);
    // Editing symlinks and binary/large files belongs in the user's external editor.
    if candidate
        .symlink_metadata()
        .map_err(|e| e.to_string())?
        .file_type()
        .is_symlink()
    {
        return Err("SOURCE_SYNC_LIMIT".into());
    }
    let inside = paths::inside(root, &candidate)?;
    let (bytes, truncated, _) = files::read_limited(&inside, git::LIMIT_DIFF)?;
    if truncated
        || bytes.contains(&0)
        || text.len() > git::LIMIT_DIFF
        || std::str::from_utf8(&bytes).is_err()
    {
        return Err("SOURCE_SYNC_LIMIT".into());
    }
    if bytes != expected.as_bytes() {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    // Write through an open file, not a truncate-by-path, so a replaced symlink cannot redirect the write.
    let mut options = fs::OpenOptions::new();
    options.write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    options.read(true);
    let mut file = options.open(&inside).map_err(|e| e.to_string())?;
    use std::io::{Read, Seek, Write};
    let mut actual = Vec::new();
    Read::by_ref(&mut file)
        .take(git::LIMIT_DIFF as u64 + 1)
        .read_to_end(&mut actual)
        .map_err(|e| e.to_string())?;
    if actual != bytes {
        return Err("SOURCE_SYNC_CHANGED".into());
    }
    file.rewind().map_err(|e| e.to_string())?;
    file.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    file.set_len(text.len() as u64).map_err(|e| e.to_string())?;
    Ok(())
}
