//! Child process startup, executable lookup, and termination.

use serde_json::Value;
use std::{
    path::PathBuf,
    process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, Stdio},
    sync::{Arc, Mutex},
};
use tauri::ipc::Channel;

use super::rpc::Replies;
use crate::i18n::Message;

pub(super) struct PiProcess {
    pub(super) child: Child,
    pub(super) stdin: Arc<Mutex<ChildStdin>>,
    pub(super) replies: Replies,
    pub(super) path: PathBuf,
    pub(super) executable: String,
    pub(super) events: Arc<Mutex<Channel<Value>>>,
}

impl PiProcess {
    pub(super) fn spawn(
        cwd: PathBuf,
        executable: String,
        session_file: Option<String>,
        home: PathBuf,
        on_event: Channel<Value>,
    ) -> Result<(Self, ChildStdout, ChildStderr), String> {
        let configured_executable = executable.clone();
        let path = runtime_path(&home);
        let executable = crate::onboarding::resolve_executable(&executable, &home)?;
        let mut command = Command::new(executable);
        command
            .args(["--mode", "rpc", "--offline"])
            .env("PATH", path)
            .current_dir(&cwd)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // Native smoke tests inspect metadata without creating a pi session file.
        #[cfg(test)]
        command.arg("--no-session");
        if let Some(file) = session_file {
            if !file.is_empty() {
                command.args(["--session", &file]);
            }
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        let mut child = command.spawn().map_err(|e| Message::StartPi.detail(e))?;
        let stdin = Arc::new(Mutex::new(
            child.stdin.take().ok_or_else(|| Message::Stdin.text())?,
        ));
        let stdout = child.stdout.take().ok_or_else(|| Message::Stdout.text())?;
        let stderr = child.stderr.take().ok_or_else(|| Message::Stderr.text())?;
        let replies: Replies = Arc::default();
        let events = Arc::new(Mutex::new(on_event));
        Ok((
            Self {
                child,
                stdin,
                replies,
                path: cwd,
                executable: configured_executable,
                events,
            },
            stdout,
            stderr,
        ))
    }

    pub(super) fn stop(mut self) {
        // Terminate the process group so child tool processes do not outlive the window.
        #[cfg(unix)]
        unsafe {
            libc::kill(-(self.child.id() as i32), libc::SIGTERM);
        }
        #[cfg(not(unix))]
        {
            let _ = self.child.kill();
        }
        if self.child.try_wait().ok().flatten().is_none() {
            let _ = self.child.kill();
        }
        let _ = self.child.wait();
        if let Ok(mut replies) = self.replies.lock() {
            for (_, reply) in replies.drain() {
                let _ = reply.send(Err(Message::SessionClosed.text()));
            }
        };
    }
}

pub(crate) fn runtime_path(home: &std::path::Path) -> std::ffi::OsString {
    let mut paths = vec![
        home.join(".volta/bin"),
        home.join(".local/bin"),
        home.join(".bun/bin"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
    ];
    if let Some(existing) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&existing));
    }
    paths.extend([PathBuf::from("/usr/bin"), PathBuf::from("/bin")]);
    std::env::join_paths(paths).unwrap_or_default()
}
