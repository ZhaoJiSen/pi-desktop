use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::ipc::Channel;

type Reply = mpsc::Sender<Result<Value, String>>;
type Replies = Arc<Mutex<HashMap<String, Reply>>>;

struct PiProcess {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    replies: Replies,
}

#[derive(Clone, Default)]
pub struct Runtime {
    processes: Arc<Mutex<HashMap<String, PiProcess>>>,
}

fn lock_error<T>(_: std::sync::PoisonError<T>) -> String {
    "pi 运行状态无法读取，请重新连接".into()
}

fn command_allowed(command: &Value) -> bool {
    matches!(
        command.get("type").and_then(Value::as_str),
        Some(
            "prompt"
                | "new_session"
                | "switch_session"
                | "abort"
                | "get_state"
                | "get_messages"
                | "get_available_models"
                | "get_available_thinking_levels"
                | "set_model"
                | "set_thinking_level"
                | "get_session_stats"
                | "get_commands"
                | "set_session_name"
                | "compact"
                | "extension_ui_response"
        )
    )
}

fn runtime_path(home: &std::path::Path) -> std::ffi::OsString {
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
        let path = runtime_path(&home);
        let executable = if executable == "pi" {
            std::env::split_paths(&path)
                .map(|dir| dir.join(if cfg!(windows) { "pi.cmd" } else { "pi" }))
                .find(|file| file.is_file())
                .ok_or("找不到 pi，请在设置中选择 pi 可执行文件路径")?
        } else {
            PathBuf::from(executable)
        };
        let mut command = Command::new(executable);
        command
            .args(["--mode", "rpc", "--offline"])
            .env("PATH", path)
            .current_dir(cwd)
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
        let mut child = command.spawn().map_err(|e| format!("无法启动 pi：{e}"))?;
        let pid = child.id();
        let stdin = Arc::new(Mutex::new(child.stdin.take().ok_or("pi 输入管道无法打开")?));
        let stdout = child.stdout.take().ok_or("pi 输出管道无法打开")?;
        let stderr = child.stderr.take().ok_or("pi 错误管道无法打开")?;
        let replies: Replies = Arc::default();
        self.processes.lock().map_err(lock_error)?.insert(
            run_id.clone(),
            PiProcess {
                child,
                stdin,
                replies: replies.clone(),
            },
        );
        let channel = on_event.clone();
        let output_run = run_id.clone();
        let runtime = self.clone();
        std::thread::spawn(move || {
            // BufRead::read_until only splits LF; U+2028/U+2029 remain inside JSON strings.
            let mut reader = BufReader::new(stdout);
            let mut bytes = Vec::new();
            loop {
                bytes.clear();
                match reader.read_until(b'\n', &mut bytes) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        if let Ok(event) = serde_json::from_slice::<Value>(&bytes) {
                            if event.get("type").and_then(Value::as_str) == Some("response") {
                                let id =
                                    event.get("id").and_then(Value::as_str).unwrap_or_default();
                                if let Ok(mut waiting) = replies.lock() {
                                    if let Some(reply) = waiting.remove(id) {
                                        let result = if event
                                            .get("success")
                                            .and_then(Value::as_bool)
                                            == Some(true)
                                        {
                                            Ok(event.get("data").cloned().unwrap_or(Value::Null))
                                        } else {
                                            Err(event
                                                .get("error")
                                                .and_then(Value::as_str)
                                                .unwrap_or("pi 请求失败")
                                                .to_owned())
                                        };
                                        let _ = reply.send(result);
                                    }
                                }
                            } else {
                                let _ =
                                    channel.send(json!({ "runId": output_run, "event": event }));
                            }
                        }
                    }
                }
            }
            if let Ok(mut waiting) = replies.lock() {
                for (_, reply) in waiting.drain() {
                    let _ = reply.send(Err("pi 进程已退出，请重新连接".into()));
                }
            }
            let _ =
                channel.send(json!({ "runId": output_run, "event": { "type": "runtime_exit" } }));
            // Reap exited idle projects as well; an old reader must not remove a replacement.
            let exited = runtime.processes.lock().ok().and_then(|mut processes| {
                if processes
                    .get(&output_run)
                    .is_some_and(|process| process.child.id() == pid)
                {
                    processes.remove(&output_run)
                } else {
                    None
                }
            });
            if let Some(process) = exited {
                Self::stop_process(process);
            }
        });
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut bytes = Vec::new();
            loop {
                bytes.clear();
                match reader.read_until(b'\n', &mut bytes) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let text = String::from_utf8_lossy(&bytes);
                        let _ = on_event.send(json!({ "runId": run_id, "event": { "type": "runtime_diagnostic", "message": text.trim() } }));
                    }
                }
            }
        });
        Ok(())
    }

    pub fn request(&self, run_id: &str, mut command: Value) -> Result<Value, String> {
        if !command_allowed(&command) {
            return Err("此 pi 命令不受桌面端支持".into());
        }
        let id = command
            .get("id")
            .and_then(Value::as_str)
            .ok_or("请求缺少关联 ID")?
            .to_owned();
        let (sender, receiver) = mpsc::channel();
        let (stdin, replies) = {
            let process = self.processes.lock().map_err(lock_error)?;
            let child = process.get(run_id).ok_or("pi 会话已切换，请重新连接")?;
            (child.stdin.clone(), child.replies.clone())
        };
        let ui_response =
            command.get("type").and_then(Value::as_str) == Some("extension_ui_response");
        if !ui_response {
            replies
                .lock()
                .map_err(lock_error)?
                .insert(id.clone(), sender);
        }
        // command is passed as structured JSON; no shell interpolation is used.
        command["id"] = json!(id);
        let write_result = (|| -> Result<(), String> {
            let mut writer = stdin.lock().map_err(lock_error)?;
            serde_json::to_writer(&mut *writer, &command).map_err(|e| e.to_string())?;
            writer.write_all(b"\n").map_err(|e| e.to_string())?;
            writer.flush().map_err(|e| e.to_string())
        })();
        if let Err(error) = write_result {
            replies.lock().map_err(lock_error)?.remove(&id);
            return Err(format!("无法发送到 pi：{error}"));
        }
        if ui_response {
            return Ok(Value::Null);
        }
        let result = receiver
            .recv_timeout(Duration::from_secs(30))
            .map_err(|_| "pi 请求超时，请检查连接后重试".to_owned());
        replies.lock().map_err(lock_error)?.remove(&id);
        result?
    }

    pub fn stop_run(&self, run_id: &str) -> Result<(), String> {
        let process = self.processes.lock().map_err(lock_error)?.remove(run_id);
        if let Some(process) = process {
            Self::stop_process(process);
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
            Self::stop_process(process);
        }
        Ok(())
    }

    fn stop_process(mut process: PiProcess) {
        // Terminate the process group so child tool processes do not outlive the window.
        #[cfg(unix)]
        unsafe {
            libc::kill(-(process.child.id() as i32), libc::SIGTERM);
        }
        #[cfg(not(unix))]
        {
            let _ = process.child.kill();
        }
        if process.child.try_wait().ok().flatten().is_none() {
            let _ = process.child.kill();
        }
        let _ = process.child.wait();
        if let Ok(mut replies) = process.replies.lock() {
            for (_, reply) in replies.drain() {
                let _ = reply.send(Err("pi 会话已关闭".into()));
            }
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn installed_pi_session_reuse_smoke() {
        if std::env::var("PI_DESKTOP_RPC_SMOKE").as_deref() != Ok("1") {
            return;
        }
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("pi-desktop-reuse-{stamp}"));
        std::fs::create_dir_all(&dir).unwrap();
        let runtime = Runtime::default();
        struct Cleanup(Runtime, PathBuf);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                let _ = self.0.stop();
                let _ = std::fs::remove_dir_all(&self.1);
            }
        }
        let _cleanup = Cleanup(runtime.clone(), dir.clone());
        let file = dir.join("fixture.jsonl");
        let header = json!({ "type": "session", "version": 3, "id": "reuse-fixture", "timestamp": "2026-10-08T00:00:00.000Z", "cwd": dir });
        let message = json!({ "type": "message", "id": "user-one", "parentId": null, "timestamp": "2026-10-08T00:00:00.000Z", "message": { "role": "user", "content": [{ "type": "text", "text": "local fixture; do not generate" }], "timestamp": 1791417600000_u64 } });
        std::fs::write(&file, format!("{header}\n{message}\n")).unwrap();
        runtime
            .start(
                dir.clone(),
                "pi".into(),
                None,
                "reuse-smoke".into(),
                PathBuf::from(std::env::var_os("HOME").unwrap()),
                Channel::new(|_| Ok(())),
            )
            .expect("start installed pi");
        let pid = runtime
            .processes
            .lock()
            .unwrap()
            .get("reuse-smoke")
            .unwrap()
            .child
            .id();
        let switch = runtime
            .request(
                "reuse-smoke",
                json!({ "id": "switch-one", "type": "switch_session", "sessionPath": file }),
            )
            .expect("switch to isolated fixture");
        assert_eq!(switch["cancelled"], false);
        let before = runtime
            .request(
                "reuse-smoke",
                json!({ "id": "before", "type": "get_messages" }),
            )
            .unwrap();
        assert_eq!(
            before["messages"][0]["content"][0]["text"],
            "local fixture; do not generate"
        );
        let new = runtime
            .request("reuse-smoke", json!({ "id": "new", "type": "new_session" }))
            .expect("new session on same process");
        assert_eq!(new["cancelled"], false);
        let empty = runtime
            .request(
                "reuse-smoke",
                json!({ "id": "empty", "type": "get_messages" }),
            )
            .unwrap();
        assert!(empty["messages"].as_array().unwrap().is_empty());
        runtime
            .request(
                "reuse-smoke",
                json!({ "id": "switch-back", "type": "switch_session", "sessionPath": file }),
            )
            .expect("switch back on same process");
        let restored = runtime
            .request(
                "reuse-smoke",
                json!({ "id": "restored", "type": "get_messages" }),
            )
            .unwrap();
        assert_eq!(before, restored);
        assert_eq!(
            runtime
                .processes
                .lock()
                .unwrap()
                .get("reuse-smoke")
                .unwrap()
                .child
                .id(),
            pid
        );
        let stats = runtime
            .request(
                "reuse-smoke",
                json!({ "id": "stats", "type": "get_session_stats" }),
            )
            .unwrap();
        assert_eq!(stats["tokens"]["total"], 0);

        // Opening a second project must retain the first project's PID and history.
        let second_dir = dir.join("project-two");
        std::fs::create_dir_all(&second_dir).unwrap();
        let second_file = second_dir.join("fixture.jsonl");
        let second_header = json!({ "type": "session", "version": 3, "id": "second-project", "timestamp": "2026-10-08T00:00:00.000Z", "cwd": second_dir });
        let second_message = json!({ "type": "message", "id": "user-two", "parentId": null, "timestamp": "2026-10-08T00:00:00.000Z", "message": { "role": "user", "content": [{ "type": "text", "text": "second project fixture" }], "timestamp": 1791417600000_u64 } });
        std::fs::write(&second_file, format!("{second_header}\n{second_message}\n")).unwrap();
        runtime
            .start(
                second_dir,
                "pi".into(),
                None,
                "project-two".into(),
                PathBuf::from(std::env::var_os("HOME").unwrap()),
                Channel::new(|_| Ok(())),
            )
            .unwrap();
        runtime
            .request(
                "project-two",
                json!({ "id": "load-two", "type": "switch_session", "sessionPath": second_file }),
            )
            .unwrap();
        let second_pid = runtime
            .processes
            .lock()
            .unwrap()
            .get("project-two")
            .unwrap()
            .child
            .id();
        assert_ne!(pid, second_pid);
        for index in 0..3 {
            let first = runtime
                .request(
                    "reuse-smoke",
                    json!({ "id": format!("first-{index}"), "type": "get_messages" }),
                )
                .unwrap();
            let second = runtime
                .request(
                    "project-two",
                    json!({ "id": format!("second-{index}"), "type": "get_messages" }),
                )
                .unwrap();
            assert_eq!(first, before);
            assert_eq!(
                second["messages"][0]["content"][0]["text"],
                "second project fixture"
            );
            let processes = runtime.processes.lock().unwrap();
            assert_eq!(processes.get("reuse-smoke").unwrap().child.id(), pid);
            assert_eq!(processes.get("project-two").unwrap().child.id(), second_pid);
        }
        runtime.stop_run("project-two").unwrap();
        assert!(runtime
            .request(
                "project-two",
                json!({ "id": "closed-two", "type": "get_state" })
            )
            .is_err());
        assert!(runtime
            .request(
                "reuse-smoke",
                json!({ "id": "still-one", "type": "get_state" })
            )
            .is_ok());
    }

    #[test]
    fn installed_pi_rpc_smoke() {
        // Explicit opt-in: needs the developer's installed pi and configuration.
        if std::env::var("PI_DESKTOP_RPC_SMOKE").as_deref() != Ok("1") {
            return;
        }
        let home = PathBuf::from(std::env::var_os("HOME").expect("home directory"));
        let runtime = Runtime::default();
        runtime
            .start(
                std::env::current_dir().unwrap(),
                "pi".into(),
                None,
                "smoke".into(),
                home,
                Channel::new(|_| Ok(())),
            )
            .expect("start installed pi");
        let result = (|| -> Result<(), String> {
            let state = runtime.request("smoke", json!({ "id": "state", "type": "get_state" }))?;
            assert!(state.get("sessionId").and_then(Value::as_str).is_some());
            let models = runtime.request(
                "smoke",
                json!({ "id": "models", "type": "get_available_models" }),
            )?;
            assert!(models.get("models").and_then(Value::as_array).is_some());
            let stats = runtime.request(
                "smoke",
                json!({ "id": "stats", "type": "get_session_stats" }),
            )?;
            assert_eq!(stats["tokens"]["total"], 0);
            let commands =
                runtime.request("smoke", json!({ "id": "commands", "type": "get_commands" }))?;
            assert!(commands.get("commands").and_then(Value::as_array).is_some());
            assert!(runtime
                .request("old-session", json!({ "id": "stale", "type": "get_state" }))
                .is_err());
            assert!(runtime
                .request(
                    "smoke",
                    json!({ "id": "unsupported", "type": "bash", "command": "pwd" })
                )
                .is_err());
            Ok(())
        })();
        runtime.stop().expect("stop owned pi process");
        result.expect("read-only RPC metadata smoke test");
        assert!(runtime
            .request("smoke", json!({ "id": "closed", "type": "get_state" }))
            .is_err());
    }
}
