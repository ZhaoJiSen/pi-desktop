//! JSON-line requests, response correlation, and event forwarding.

use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Write},
    process::{ChildStderr, ChildStdin, ChildStdout},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::ipc::Channel;

use super::lock_error;
use crate::i18n::Message;

type Reply = mpsc::Sender<Result<Value, String>>;
pub(super) type Replies = Arc<Mutex<HashMap<String, Reply>>>;

pub(super) fn emit(events: &Mutex<Channel<Value>>, value: Value) {
    if let Ok(channel) = events.lock() {
        let _ = channel.send(value);
    }
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

pub(super) fn command_id(command: &Value) -> Result<String, String> {
    if !command_allowed(command) {
        return Err(Message::UnsupportedCommand.text());
    }
    Ok(command
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| Message::MissingId.text())?
        .to_owned())
}

pub(super) fn request(
    stdin: Arc<Mutex<ChildStdin>>,
    replies: Replies,
    mut command: Value,
    id: String,
) -> Result<Value, String> {
    let (sender, receiver) = mpsc::channel();
    let ui_response = command.get("type").and_then(Value::as_str) == Some("extension_ui_response");
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
        return Err(Message::SendPi.detail(error));
    }
    if ui_response {
        return Ok(Value::Null);
    }
    let result = receiver
        .recv_timeout(Duration::from_secs(30))
        .map_err(|_| Message::RequestTimeout.text());
    replies.lock().map_err(lock_error)?.remove(&id);
    result?
}

pub(super) fn spawn_stdout_reader(
    stdout: ChildStdout,
    replies: Replies,
    events: Arc<Mutex<Channel<Value>>>,
    run_id: String,
    on_exit: impl FnOnce() + Send + 'static,
) {
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
                            let id = event.get("id").and_then(Value::as_str).unwrap_or_default();
                            if let Ok(mut waiting) = replies.lock() {
                                if let Some(reply) = waiting.remove(id) {
                                    let result = if event.get("success").and_then(Value::as_bool)
                                        == Some(true)
                                    {
                                        Ok(event.get("data").cloned().unwrap_or(Value::Null))
                                    } else {
                                        Err(event
                                            .get("error")
                                            .and_then(Value::as_str)
                                            .map(str::to_owned)
                                            .unwrap_or_else(|| Message::RequestFailed.text()))
                                    };
                                    let _ = reply.send(result);
                                }
                            }
                        } else {
                            emit(&events, json!({ "runId": run_id, "event": event }));
                        }
                    }
                }
            }
        }
        if let Ok(mut waiting) = replies.lock() {
            for (_, reply) in waiting.drain() {
                let _ = reply.send(Err(Message::ProcessExited.text()));
            }
        }
        emit(
            &events,
            json!({ "runId": run_id, "event": { "type": "runtime_exit" } }),
        );
        on_exit();
    });
}

pub(super) fn spawn_stderr_reader(
    stderr: ChildStderr,
    events: Arc<Mutex<Channel<Value>>>,
    run_id: String,
) {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut bytes = Vec::new();
        loop {
            bytes.clear();
            match reader.read_until(b'\n', &mut bytes) {
                Ok(0) | Err(_) => break,
                Ok(_) => {
                    let text = String::from_utf8_lossy(&bytes);
                    emit(
                        &events,
                        json!({ "runId": run_id, "event": { "type": "runtime_diagnostic", "message": text.trim() } }),
                    );
                }
            }
        }
    });
}
