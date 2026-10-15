use crate::onboarding::executable_path;
use std::{
    path::Path,
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicBool, AtomicU32, Ordering},
};

// The runtime maintenance guard permits only one installer in the app process.
pub(super) static INSTALL_PROCESS: AtomicU32 = AtomicU32::new(0);
pub(super) static EXITING: AtomicBool = AtomicBool::new(false);

// Always reap the probe/installer and its descendants, including early errors.
pub(super) struct Process(pub(super) Child, pub(super) bool);
fn kill_process(id: u32) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(id as i32), libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &id.to_string(), "/T", "/F"])
            .output();
    }
}

pub(crate) fn cancel_install() {
    EXITING.store(true, Ordering::SeqCst);
    let id = INSTALL_PROCESS.load(Ordering::SeqCst);
    if id != 0 {
        kill_process(id);
    }
}

impl Drop for Process {
    fn drop(&mut self) {
        kill_process(self.0.id());
        let _ = self.0.kill();
        let _ = self.0.wait();
        if self.1 {
            let _ = INSTALL_PROCESS.compare_exchange(
                self.0.id(),
                0,
                Ordering::SeqCst,
                Ordering::SeqCst,
            );
        }
    }
}

pub(super) fn command(binary: &Path, home: &Path) -> Command {
    let mut command = Command::new(binary);
    command
        .env("PATH", executable_path(binary, home))
        .env("NO_COLOR", "1")
        .current_dir(home)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    command
}
