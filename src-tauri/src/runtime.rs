//! Process pool and the runtime interface used by Tauri commands.

mod process;
pub(crate) use process::runtime_path;
mod rpc;
#[cfg(test)]
#[path = "../tests/runtime/tests.rs"]
mod tests;

use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::ipc::Channel;

use crate::i18n::Message;
use process::PiProcess;

#[derive(Clone, Default)]
pub struct Runtime {
    processes: Arc<Mutex<HashMap<String, PiProcess>>>,
}

fn lock_error<T>(_: std::sync::PoisonError<T>) -> String {
    Message::RuntimeState.text()
}

impl Runtime {
    pub fn start(
        &self,
        cwd: PathBuf,
        executable: String,
        session_file: Option<String>,
        run_id: String,
        home: PathBuf,
        on_event: Channel<Value>,
    ) -> Result<(), String> {
        self.stop_run(&run_id)?;
        let (process, stdout, stderr) =
            PiProcess::spawn(cwd, executable, session_file, home, on_event)?;
        let pid = process.child.id();
        let replies = process.replies.clone();
        let events = process.events.clone();
        self.processes
            .lock()
            .map_err(lock_error)?
            .insert(run_id.clone(), process);

        let output_run = run_id.clone();
        let runtime = self.clone();
        rpc::spawn_stdout_reader(stdout, replies, events.clone(), run_id.clone(), move || {
            runtime.reap_process(&output_run, pid)
        });
        rpc::spawn_stderr_reader(stderr, events, run_id);
        Ok(())
    }

    /// The native process pool outlives a webview reload. Return only live handles.
    pub fn connections(&self) -> Result<Value, String> {
        let mut processes = self.processes.lock().map_err(lock_error)?;
        let mut connections = Vec::new();
        for (id, process) in processes.iter_mut() {
            if process
                .child
                .try_wait()
                .map_err(|e| Message::CheckProcess.detail(e))?
                .is_none()
            {
                connections.push(
                    json!({ "id": id, "path": process.path, "executable": process.executable }),
                );
            }
        }
        Ok(json!(connections))
    }

    pub fn attach(&self, run_id: &str, on_event: Channel<Value>) -> Result<(), String> {
        let mut processes = self.processes.lock().map_err(lock_error)?;
        let process = processes
            .get_mut(run_id)
            .ok_or_else(|| Message::ProcessExited.text())?;
        if process
            .child
            .try_wait()
            .map_err(|e| Message::CheckProcess.detail(e))?
            .is_some()
        {
            return Err(Message::ProcessExited.text());
        }
        *process.events.lock().map_err(lock_error)? = on_event;
        Ok(())
    }

    pub fn request(&self, run_id: &str, command: Value) -> Result<Value, String> {
        let id = rpc::command_id(&command)?;
        let (stdin, replies) = {
            let process = self.processes.lock().map_err(lock_error)?;
            let child = process
                .get(run_id)
                .ok_or_else(|| Message::SessionChanged.text())?;
            (child.stdin.clone(), child.replies.clone())
        };
        rpc::request(stdin, replies, command, id)
    }

    pub fn stop_run(&self, run_id: &str) -> Result<(), String> {
        let process = self.processes.lock().map_err(lock_error)?.remove(run_id);
        if let Some(process) = process {
            process.stop();
        }
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let processes: Vec<_> = self
            .processes
            .lock()
            .map_err(lock_error)?
            .drain()
            .map(|(_, process)| process)
            .collect();
        for process in processes {
            process.stop();
        }
        Ok(())
    }

    fn reap_process(&self, run_id: &str, pid: u32) {
        // Reap exited idle projects as well; an old reader must not remove a replacement.
        let exited = self.processes.lock().ok().and_then(|mut processes| {
            if processes
                .get(run_id)
                .is_some_and(|process| process.child.id() == pid)
            {
                processes.remove(run_id)
            } else {
                None
            }
        });
        if let Some(process) = exited {
            process.stop();
        }
    }
}
