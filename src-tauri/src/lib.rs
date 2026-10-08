mod runtime;

use runtime::Runtime;
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{Manager, State};

fn project_path(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, String> {
    let expanded = if path == "~" || path.starts_with("~/") {
        app.path()
            .home_dir()
            .map_err(|e| e.to_string())?
            .join(path.trim_start_matches('~').trim_start_matches('/'))
    } else {
        PathBuf::from(path)
    };
    let canonical = expanded
        .canonicalize()
        .map_err(|e| format!("无法打开项目目录：{e}"))?;
    if !canonical.is_dir() {
        return Err("请选择项目文件夹".into());
    }
    Ok(canonical)
}

#[tauri::command]
async fn inspect_project(app: tauri::AppHandle, path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = project_path(&app, &path)?;
        let output = std::process::Command::new("git")
            .args(["symbolic-ref", "--quiet", "--short", "HEAD"])
            .current_dir(&path)
            .output();
        let branch = output
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned());
        Ok(json!({ "path": path, "branch": branch }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn desktop_environment() -> Result<Value, String> {
    let mut cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    if cwd.file_name().is_some_and(|name| name == "src-tauri") {
        cwd.pop();
    }
    Ok(json!({ "cwd": cwd }))
}

#[tauri::command]
async fn start_pi(
    app: tauri::AppHandle,
    runtime: State<'_, Runtime>,
    path: String,
    executable: String,
    session_file: Option<String>,
    run_id: String,
    on_event: tauri::ipc::Channel<Value>,
) -> Result<(), String> {
    let shared = runtime.inner().clone();
    let path = project_path(&app, &path)?;
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        shared.start(path, executable, session_file, run_id, home, on_event)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pi_request(
    runtime: State<'_, Runtime>,
    run_id: String,
    command: Value,
) -> Result<Value, String> {
    let shared = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || shared.request(&run_id, command))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn stop_pi(runtime: State<'_, Runtime>, run_id: Option<String>) -> Result<(), String> {
    let shared = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || match run_id {
        Some(id) => shared.stop_run(&id),
        None => shared.stop(),
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn extension_packages(app: tauri::AppHandle, path: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let home = app.path().home_dir().map_err(|e| e.to_string())?;
        let project = project_path(&app, &path)?;
        let agent_dir = std::env::var_os("PI_CODING_AGENT_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| home.join(".pi/agent"));
        let mut packages = Vec::new();
        for (file, scope) in [
            (agent_dir.join("settings.json"), "global"),
            (project.join(".pi/settings.json"), "project"),
        ] {
            if !file.exists() {
                continue;
            }
            let text = std::fs::read_to_string(file).map_err(|e| e.to_string())?;
            let settings: Value =
                serde_json::from_str(&text).map_err(|e| format!("扩展配置格式错误：{e}"))?;
            if let Some(entries) = settings.get("packages").and_then(Value::as_array) {
                for entry in entries {
                    if let Some(source) = entry
                        .as_str()
                        .or_else(|| entry.get("source").and_then(Value::as_str))
                    {
                        packages.push(json!({ "source": source, "scope": scope }));
                    }
                }
            }
        }
        // Return only package sources, never authentication or other settings.
        Ok(json!(packages))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Runtime::default())
        .invoke_handler(tauri::generate_handler![
            desktop_environment,
            inspect_project,
            start_pi,
            pi_request,
            stop_pi,
            extension_packages
        ])
        .build(tauri::generate_context!())
        .expect("无法启动 pi Desktop");
    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            let _ = handle.state::<Runtime>().stop();
        }
    });
}
