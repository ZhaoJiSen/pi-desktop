//! First-run diagnostics and explicitly confirmed, isolated npm installation.
mod diagnostics;
mod installation;
mod managed;
mod npm;
mod process;

use crate::{i18n::Message, onboarding::EnvironmentCheck, runtime::Runtime};
pub(crate) use diagnostics::diagnose;
use installation::{perform_install, prepare_install};
pub(crate) use npm::managed_update;
pub(crate) use process::cancel_install;
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{atomic::AtomicU64, Mutex},
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager, State};

const BASELINE: &str = "1.0.0";
const REGISTRY: &str = "https://registry.npmjs.org";
static NEXT_PLAN: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnosis {
    kind: &'static str,
    environment: Option<EnvironmentCheck>,
    compatibility: &'static str,
    authentication: &'static str,
    path_recovered: bool,
    discovered_executable: Option<String>,
    detail: Option<String>,
    can_repair: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    id: String,
    command: String,
    source: &'static str,
    version: &'static str,
    directory: PathBuf,
    node_version: String,
    #[serde(skip)]
    node: PathBuf,
    #[serde(skip)]
    args: Vec<String>,
    #[serde(skip)]
    requested: String,
    #[serde(skip)]
    created: Instant,
}
#[derive(Default)]
pub struct PiInstaller {
    plan: Mutex<Option<InstallPlan>>,
}
impl PiInstaller {
    fn confirm(&self, id: &str, confirmed: bool) -> Result<InstallPlan, String> {
        if !confirmed {
            return Err(Message::PiInstallConsent.text());
        }
        self.plan
            .lock()
            .map_err(|_| Message::RuntimeState.text())?
            .take()
            .filter(|plan| plan.id == id && plan.created.elapsed() < Duration::from_secs(600))
            .ok_or_else(|| Message::PiInstallConsent.text())
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    stage: &'static str,
    stream: Option<&'static str>,
    text: Option<String>,
}

#[tauri::command]
pub async fn inspect_pi_environment(
    app: tauri::AppHandle,
    runtime: State<'_, Runtime>,
    executable: String,
) -> Result<Diagnosis, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _operation = runtime.operation()?;
        Ok(diagnose(&executable, &home))
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[tauri::command]
pub async fn prepare_pi_install(
    app: tauri::AppHandle,
    installer: State<'_, PiInstaller>,
    executable: String,
) -> Result<InstallPlan, String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    let plan = tauri::async_runtime::spawn_blocking(move || prepare_install(&executable, &home))
        .await
        .map_err(|e| Message::BackgroundTask.detail(e))??;
    *installer
        .plan
        .lock()
        .map_err(|_| Message::RuntimeState.text())? = Some(plan.clone());
    Ok(plan)
}

#[tauri::command]
pub async fn install_pi(
    app: tauri::AppHandle,
    installer: State<'_, PiInstaller>,
    runtime: State<'_, Runtime>,
    plan_id: String,
    confirmed: bool,
    on_progress: Channel<InstallProgress>,
) -> Result<Diagnosis, String> {
    let plan = installer.confirm(&plan_id, confirmed)?;
    let home = app
        .path()
        .home_dir()
        .map_err(|e| Message::HomeDirectory.detail(e))?;
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        perform_install(&runtime, &plan, &home, |event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|e| Message::BackgroundTask.detail(e))?
}

#[cfg(test)]
#[path = "../tests/environment/tests.rs"]
mod tests;
