use super::OUTPUT_LIMIT;
use crate::{i18n::Message, runtime::runtime_path};
use std::{
    io::Read,
    path::Path,
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

fn drain_output(mut stream: impl Read) -> Vec<u8> {
    let mut tail = Vec::new();
    let mut buffer = [0; 4096];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) | Err(_) => return tail,
            Ok(count) => {
                tail.extend_from_slice(&buffer[..count]);
                if tail.len() > OUTPUT_LIMIT {
                    tail.drain(..tail.len() - OUTPUT_LIMIT);
                }
            }
        }
    }
}

fn kill_update(child: &mut Child) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .output();
    }
    let _ = child.kill();
    let _ = child.wait();
}

pub(super) fn run_update(
    binary: &Path,
    home: &Path,
    version: &str,
    timeout: Duration,
) -> Result<(), String> {
    let mut command =
        if let Some(command) = crate::environment::managed_update(binary, home, version)? {
            command
        } else {
            let mut command = Command::new(binary);
            // Preserve the configured launcher's runtime for installations managed by Pi.
            let mut paths = vec![binary.parent().unwrap_or(home).to_path_buf()];
            paths.extend(std::env::split_paths(&runtime_path(home)));
            command.args(["update", "--self"]).env(
                "PATH",
                std::env::join_paths(paths).map_err(|e| Message::PiUpdateFailed.detail(e))?,
            );
            command
        };
    command
        .env("NO_COLOR", "1")
        .env_remove("PI_OFFLINE")
        .current_dir(home)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .spawn()
        .map_err(|e| Message::PiUpdateFailed.detail(e))?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let output = std::thread::spawn(move || stdout.map(drain_output).unwrap_or_default());
    let error = std::thread::spawn(move || stderr.map(drain_output).unwrap_or_default());
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() < timeout => {
                std::thread::sleep(Duration::from_millis(25))
            }
            other => {
                kill_update(&mut child);
                return Err(match other {
                    Err(e) => Message::PiUpdateFailed.detail(e),
                    _ => Message::PiUpdateTimeout.text(),
                });
            }
        }
    };
    while !output.is_finished() || !error.is_finished() {
        if started.elapsed() >= timeout {
            kill_update(&mut child);
            return Err(Message::PiUpdateTimeout.text());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let output = output.join().unwrap_or_default();
    let error = error.join().unwrap_or_default();
    if !status.success() {
        let detail = if error.is_empty() { &output } else { &error };
        return Err(Message::PiUpdateFailed.detail(String::from_utf8_lossy(detail).trim()));
    }
    Ok(())
}
