use super::{rpc::emit, Runtime};
use serde_json::{json, Value};
use std::{path::PathBuf, sync::mpsc, time::Duration};
use tauri::ipc::Channel;

fn pi_v1_executable() -> String {
    let executable = std::env::var("PI_DESKTOP_PI_V1_EXECUTABLE")
        .expect("set PI_DESKTOP_PI_V1_EXECUTABLE to an isolated Pi CLI 1.0.0 installation");
    assert!(
        std::env::var_os("PI_CODING_AGENT_DIR").is_some(),
        "use an isolated agent directory"
    );
    let version = std::process::Command::new(&executable)
        .arg("--version")
        .output()
        .expect("read Pi CLI version");
    assert!(version.status.success());
    assert_eq!(
        String::from_utf8_lossy(&version.stdout).trim(),
        "1.0.0",
        "these regression tests require the exact Pi CLI 1.0.0 baseline"
    );
    executable
}

#[test]
#[ignore = "requires isolated Pi CLI 1.0.0; see docs/implementation/pi-v1-compatibility.md"]
fn installed_pi_session_reuse_smoke() {
    let executable = pi_v1_executable();
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
            executable.clone(),
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
    assert_eq!(runtime.connections().unwrap()[0]["id"], "reuse-smoke");
    assert_eq!(runtime.connections().unwrap()[0]["path"], json!(dir));
    let (events_tx, events_rx) = mpsc::channel();
    runtime
        .attach(
            "reuse-smoke",
            Channel::new(move |body| {
                if let tauri::ipc::InvokeResponseBody::Json(json) = body {
                    let value: Value = serde_json::from_str(&json).unwrap();
                    if value["event"]["type"] == "attach_probe" {
                        let _ = events_tx.send(value);
                    }
                }
                Ok(())
            }),
        )
        .expect("reattach the refreshed frontend");
    let events = runtime
        .processes
        .lock()
        .unwrap()
        .get("reuse-smoke")
        .unwrap()
        .events
        .clone();
    emit(
        &events,
        json!({ "runId": "reuse-smoke", "event": { "type": "attach_probe" } }),
    );
    assert_eq!(
        events_rx.recv_timeout(Duration::from_secs(1)).unwrap()["runId"],
        "reuse-smoke"
    );
    assert!(runtime
        .attach("missing-run", Channel::new(|_| Ok(())))
        .is_err());
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
            executable,
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
#[ignore = "requires isolated Pi CLI 1.0.0; see docs/implementation/pi-v1-compatibility.md"]
fn installed_pi_rpc_smoke() {
    let executable = pi_v1_executable();
    let home = PathBuf::from(std::env::var_os("HOME").expect("home directory"));
    let runtime = Runtime::default();
    runtime
        .start(
            std::env::current_dir().unwrap(),
            executable,
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
