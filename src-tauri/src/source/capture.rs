//! Read a git child until a byte cap, then stop it.
//! Stderr is drained on another thread so a full pipe cannot stall stdout.

use std::{
    io::{ErrorKind, Read},
    process::{Child, Command, Stdio},
    thread,
};

pub(crate) struct Captured {
    pub(crate) stdout: Vec<u8>,
    pub(crate) stderr: Vec<u8>,
    pub(crate) success: bool,
    pub(crate) truncated: bool,
}

const STDERR_LIMIT: usize = 16 * 1024;

pub(crate) fn spawn(command: &mut Command, stdin: Stdio) -> std::io::Result<Child> {
    command
        .stdin(stdin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
}

pub(crate) fn capture(mut child: Child, stdout_limit: usize) -> std::io::Result<Captured> {
    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();
    let stderr_thread = thread::spawn(move || drain(stderr_pipe, STDERR_LIMIT));
    let (stdout, truncated) = read_limit(stdout_pipe, stdout_limit);
    if truncated {
        let _ = child.kill();
    }
    let status = child.wait()?;
    let stderr = stderr_thread.join().unwrap_or_default();
    Ok(Captured {
        stdout,
        stderr,
        success: status.success(),
        truncated,
    })
}

fn read_limit<R: Read>(pipe: Option<R>, limit: usize) -> (Vec<u8>, bool) {
    let Some(mut pipe) = pipe else {
        return (Vec::new(), false);
    };
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        let read = match pipe.read(&mut chunk) {
            Ok(0) => return (buffer, false),
            Ok(count) => count,
            Err(error) if error.kind() == ErrorKind::Interrupted => continue,
            Err(_) => return (buffer, false),
        };
        let room = limit.saturating_sub(buffer.len());
        if read > room {
            buffer.extend_from_slice(&chunk[..room]);
            return (buffer, true);
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
}

fn drain<R: Read>(pipe: Option<R>, limit: usize) -> Vec<u8> {
    let Some(mut pipe) = pipe else {
        return Vec::new();
    };
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 8192];
    loop {
        match pipe.read(&mut chunk) {
            Ok(0) => break,
            Ok(count) => {
                if buffer.len() < limit {
                    let room = limit - buffer.len();
                    buffer.extend_from_slice(&chunk[..count.min(room)]);
                }
            }
            Err(error) if error.kind() == ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    buffer
}
