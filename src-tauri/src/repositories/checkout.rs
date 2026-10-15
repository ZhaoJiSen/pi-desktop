use super::{
    operation::{kill_tree, Operation, CANCELLED, COMMITTING, RUNNING},
    progress::{failure_code, read_progress},
    validation::{parent_path, valid_name, valid_url},
    CloneError, CloneProgress, Result,
};
use crate::runtime::runtime_path;
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{atomic::Ordering, mpsc},
    thread,
    time::{Duration, Instant},
};

const OUTPUT_DRAIN_TIMEOUT: Duration = Duration::from_secs(2);

struct Staging(PathBuf);
impl Drop for Staging {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

// The destination must never be replaced, including an empty directory created during cloning.
fn rename_exclusive(source: &Path, destination: &Path) -> std::io::Result<()> {
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        use std::{ffi::CString, os::unix::ffi::OsStrExt};
        let source = CString::new(source.as_os_str().as_bytes())?;
        let destination = CString::new(destination.as_os_str().as_bytes())?;
        #[cfg(target_os = "macos")]
        let result =
            unsafe { libc::renamex_np(source.as_ptr(), destination.as_ptr(), libc::RENAME_EXCL) };
        #[cfg(target_os = "linux")]
        let result = unsafe {
            libc::renameat2(
                libc::AT_FDCWD,
                source.as_ptr(),
                libc::AT_FDCWD,
                destination.as_ptr(),
                libc::RENAME_NOREPLACE,
            )
        };
        if result != 0 {
            return Err(std::io::Error::last_os_error());
        }
        Ok(())
    }
    #[cfg(windows)]
    {
        fs::rename(source, destination)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
    {
        let _ = (source, destination);
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Exclusive rename unavailable",
        ))
    }
}

pub(super) struct CloneInput<'a> {
    pub(super) task_id: &'a str,
    pub(super) url: &'a str,
    pub(super) parent: &'a str,
    pub(super) name: &'a str,
}

pub(super) fn run_clone(
    home: &Path,
    input: CloneInput<'_>,
    operation: &Operation,
    mut report: impl FnMut(CloneProgress),
    git: &std::ffi::OsStr,
) -> Result<Option<String>> {
    let CloneInput {
        task_id,
        url,
        parent,
        name,
    } = input;
    if !valid_url(url) {
        return Err(CloneError::new("invalidUrl"));
    }
    if !valid_name(name) {
        return Err(CloneError::new("invalidName"));
    }
    let parent = parent_path(home, parent)?;
    let target = parent.join(name);
    if target.symlink_metadata().is_ok() {
        return Err(CloneError::new("conflict"));
    }
    let staging_path = parent.join(format!(".pi-clone-{}-{task_id}", std::process::id()));
    fs::create_dir(&staging_path).map_err(|_| CloneError::new("parent"))?;
    let staging = Staging(staging_path);
    report(CloneProgress {
        task_id: task_id.into(),
        stage: "connecting",
        percent: None,
    });
    if operation.phase.load(Ordering::SeqCst) == CANCELLED {
        return Ok(None);
    }
    let mut command = Command::new(git);
    command
        .args(["clone", "--progress", "--", url])
        .arg(&staging.0)
        .env("PATH", runtime_path(home))
        .env("LC_ALL", "C")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env(
            "GIT_SSH_COMMAND",
            "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes",
        )
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command.spawn().map_err(|error| {
        CloneError::new(if error.kind() == std::io::ErrorKind::NotFound {
            "gitMissing"
        } else {
            "failed"
        })
    })?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| CloneError::new("failed"))?;
    let (tx, rx) = mpsc::sync_channel(32);
    let reader = thread::spawn(move || read_progress(stderr, tx));
    *operation
        .child
        .lock()
        .map_err(|_| CloneError::new("failed"))? = Some(child);
    let mut exited = None;
    let status = loop {
        if operation.phase.load(Ordering::SeqCst) == CANCELLED {
            if let Ok(mut child) = operation.child.lock() {
                if let Some(child) = child.as_mut() {
                    kill_tree(child);
                }
            }
        }
        for (stage, percent) in rx.try_iter() {
            report(CloneProgress {
                task_id: task_id.into(),
                stage,
                percent,
            });
        }
        if exited.is_none() {
            let status = operation
                .child
                .lock()
                .map_err(|_| CloneError::new("failed"))?
                .as_mut()
                .ok_or_else(|| CloneError::new("failed"))?
                .try_wait()
                .map_err(|_| CloneError::new("failed"))?;
            if let Some(status) = status {
                exited = Some((status, Instant::now()));
            }
        }
        if let Some((status, since)) = exited {
            if reader.is_finished() {
                break status;
            }
            // Helpers can outlive Git while retaining stderr. Keep the group
            // reachable by cancellation, and never join a reader without EOF.
            if since.elapsed() >= OUTPUT_DRAIN_TIMEOUT {
                if let Some(mut child) = operation
                    .child
                    .lock()
                    .map_err(|_| CloneError::new("failed"))?
                    .take()
                {
                    kill_tree(&mut child);
                }
                return if operation.phase.load(Ordering::SeqCst) == CANCELLED {
                    Ok(None)
                } else {
                    Err(CloneError::new("failed"))
                };
            }
        }
        thread::sleep(Duration::from_millis(40));
    };
    let stderr = reader.join().unwrap_or_default();
    operation
        .child
        .lock()
        .map_err(|_| CloneError::new("failed"))?
        .take();
    if operation.phase.load(Ordering::SeqCst) == CANCELLED {
        return Ok(None);
    }
    if !status.success() {
        return Err(CloneError::new(failure_code(&stderr)));
    }
    if operation
        .phase
        .compare_exchange(RUNNING, COMMITTING, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(None);
    }
    report(CloneProgress {
        task_id: task_id.into(),
        stage: "finalizing",
        percent: None,
    });
    rename_exclusive(&staging.0, &target).map_err(|error| {
        CloneError::new(if error.kind() == std::io::ErrorKind::AlreadyExists {
            "conflict"
        } else {
            "parent"
        })
    })?;
    Ok(Some(target.to_string_lossy().into_owned()))
}
