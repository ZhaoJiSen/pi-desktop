use super::*;

/// Find a revision's exact date-order position without retaining the whole history.
pub(crate) fn revision_position(root: &Path, revision: &str) -> Result<Option<u32>, String> {
    use std::io::{BufRead, BufReader};
    let mut child = match spawn(
        root,
        &["rev-list", "--date-order", "--all", revision, "--"],
        Stdio::null(),
    ) {
        Ok(child) => child,
        Err(Start::Missing) => return Err(Message::GitUnavailable.text()),
        Err(Start::Error(message)) => return Err(message),
    };
    let stdout = child.stdout.take().ok_or_else(|| Message::GitRead.text())?;
    let stderr = child.stderr.take();
    let errors = thread::spawn(move || capture::drain(stderr, 16 * 1024));
    let mut reader = BufReader::new(stdout);
    let mut line = String::new();
    let mut index = 0_u32;
    let result = loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break Ok(None),
            Ok(_) if line.trim() == revision => break Ok(Some(index)),
            Ok(_) => match index.checked_add(1) {
                Some(next) => index = next,
                None => break Err(Message::GitRead.text()),
            },
            Err(error) => break Err(Message::GitRead.detail(error)),
        }
    };
    let found = matches!(result, Ok(Some(_)));
    // Stop as soon as HEAD is found; no need to walk its older ancestors.
    if found || result.is_err() {
        let _ = child.kill();
    }
    drop(reader);
    let status = child
        .wait()
        .map_err(|error| Message::GitRead.detail(error))?;
    let stderr = errors.join().unwrap_or_default();
    if !found && !status.success() && result.is_ok() {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&stderr).trim()));
    }
    result
}
