mod commands;
mod i18n;
mod packages;
mod runtime;

use i18n::Message;
use runtime::Runtime;
use serde_json::{json, Value};
use std::path::PathBuf;
use tauri::{Manager, State};

#[tauri::command]
fn system_locale() -> String {
    i18n::system_locale()
}

#[tauri::command]
fn set_app_language(language: String) {
    i18n::set_language(&language);
}

fn project_path(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, String> {
    let expanded = if path == "~" || path.starts_with("~/") {
        app.path()
            .home_dir()
            .map_err(|e| Message::HomeDirectory.detail(e))?
            .join(path.trim_start_matches('~').trim_start_matches('/'))
    } else {
        PathBuf::from(path)
    };
    let canonical = expanded
        .canonicalize()
        .map_err(|e| Message::OpenProject.detail(e))?;
    if !canonical.is_dir() {
        return Err(Message::ChooseProject.text());
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
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
fn desktop_environment() -> Result<Value, String> {
    let mut cwd = std::env::current_dir().map_err(|e| Message::CurrentDirectory.detail(e))?;
    if cwd.file_name().is_some_and(|name| name == "src-tauri") {
        cwd.pop();
    }
    Ok(json!({ "cwd": cwd }))
}

#[tauri::command]
async fn reveal_project(app: tauri::AppHandle, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = project_path(&app, &path)?;
        #[cfg(target_os = "macos")]
        let status = std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .status();
        #[cfg(target_os = "windows")]
        let status = std::process::Command::new("explorer")
            .arg(format!("/select,{}", path.display()))
            .status();
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let status = std::process::Command::new("xdg-open").arg(&path).status();
        if !status
            .map_err(|e| Message::RevealProject.detail(e))?
            .success()
        {
            return Err(Message::RevealProjectMissing.text());
        }
        Ok(())
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
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
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    tauri::async_runtime::spawn_blocking(move || {
        shared.start(path, executable, session_file, run_id, home, on_event)
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
fn pi_connections(runtime: State<'_, Runtime>) -> Result<Value, String> {
    runtime.connections()
}

#[tauri::command]
fn attach_pi(
    runtime: State<'_, Runtime>,
    run_id: String,
    on_event: tauri::ipc::Channel<Value>,
) -> Result<(), String> {
    runtime.attach(&run_id, on_event)
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
        .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
async fn stop_pi(runtime: State<'_, Runtime>, run_id: Option<String>) -> Result<(), String> {
    let shared = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || match run_id {
        Some(id) => shared.stop_run(&id),
        None => shared.stop(),
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Runtime::default())
        .invoke_handler(tauri::generate_handler![
            commands::builtin_commands,
            system_locale,
            set_app_language,
            desktop_environment,
            inspect_project,
            reveal_project,
            start_pi,
            pi_connections,
            attach_pi,
            pi_request,
            stop_pi,
            packages::extension_packages,
            packages::registry::package_info,
            packages::registry::discover_packages,
            packages::registry::browse_extension_catalog,
            packages::registry::extension_package_metadata,
            packages::manage_extension_package,
            packages::open_extension_page
        ])
        .build(tauri::generate_context!())
        .unwrap_or_else(|error| panic!("{}", Message::AppStart.detail(error)));
    app.run(|handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            let _ = handle.state::<Runtime>().stop();
        }
    });
}
