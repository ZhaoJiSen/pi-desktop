use super::{CloneError, Result};
use std::{
    process::Child,
    sync::{
        atomic::{AtomicU8, Ordering},
        Arc, Mutex,
    },
};

pub(super) const RUNNING: u8 = 0;
pub(super) const CANCELLED: u8 = 1;
pub(super) const COMMITTING: u8 = 2;

#[derive(Default)]
pub(super) struct Operation {
    pub(super) phase: AtomicU8,
    pub(super) child: Mutex<Option<Child>>,
}
impl Operation {
    pub(super) fn cancel(&self) {
        if self
            .phase
            .compare_exchange(RUNNING, CANCELLED, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            if let Ok(mut child) = self.child.lock() {
                if let Some(child) = child.as_mut() {
                    kill_tree(child);
                }
            }
        }
    }
}
impl Drop for Operation {
    fn drop(&mut self) {
        if let Ok(child) = self.child.get_mut() {
            if let Some(child) = child.as_mut() {
                kill_tree(child);
            }
        }
    }
}

pub(super) struct ActiveClone {
    pub(super) id: String,
    pub(super) operation: Arc<Operation>,
}
#[derive(Clone, Default)]
pub struct RepositoryClones {
    pub(super) active: Arc<Mutex<Option<ActiveClone>>>,
}
impl RepositoryClones {
    pub(super) fn claim(&self, id: &str) -> Result<Arc<Operation>> {
        let mut active = self.active.lock().map_err(|_| CloneError::new("failed"))?;
        if active.is_some() {
            return Err(CloneError::new("busy"));
        }
        let operation = Arc::new(Operation::default());
        *active = Some(ActiveClone {
            id: id.to_owned(),
            operation: operation.clone(),
        });
        Ok(operation)
    }
    pub fn cancel_all(&self) {
        if let Ok(active) = self.active.lock() {
            if let Some(active) = active.as_ref() {
                active.operation.cancel();
            }
        }
    }
}

pub(super) struct Claim {
    pub(super) manager: RepositoryClones,
}
impl Drop for Claim {
    fn drop(&mut self) {
        if let Ok(mut active) = self.manager.active.lock() {
            *active = None;
        }
    }
}
pub(super) fn kill_tree(child: &mut Child) {
    #[cfg(unix)]
    // Git transports and credential helpers must stop before their directory is cleaned up.
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .output();
    }
    let _ = child.kill();
    let _ = child.wait();
    #[cfg(unix)]
    // A transport may fork while the first signal is being delivered. Once Git has
    // exited, no new descendants can be created by it; stop remaining group members.
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
}
