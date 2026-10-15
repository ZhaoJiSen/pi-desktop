use super::{PiUpdate, OUTPUT_LIMIT};
use crate::{
    i18n::Message,
    onboarding::{check_environment, EnvironmentCheck},
};
use semver::Version;
use serde_json::Value;
use std::{path::Path, time::Duration};

pub(super) fn compare_release(
    environment: &EnvironmentCheck,
    data: Value,
) -> Result<PiUpdate, String> {
    if data["ok"].as_bool() != Some(true) {
        return Err(Message::PiUpdateCheck.text());
    }
    let latest = data["version"]
        .as_str()
        .ok_or_else(|| Message::PiUpdateCheck.text())?;
    let latest = Version::parse(latest).map_err(|_| Message::PiUpdateCheck.text())?;
    if !latest.pre.is_empty() {
        return Err(Message::PiUpdateCheck.text());
    }
    let current =
        Version::parse(&environment.version).map_err(|_| Message::InvalidPiExecutable.text())?;
    Ok(PiUpdate {
        executable: environment.executable.clone(),
        current_version: environment.version.clone(),
        latest_version: latest.to_string(),
        has_update: latest.cmp_precedence(&current).is_gt(),
    })
}

pub(super) fn check_release(executable: &str, home: &Path, url: &str) -> Result<PiUpdate, String> {
    let environment = check_environment(executable, home)?;
    let data = tauri::async_runtime::block_on(async {
        let client = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(concat!("pi-desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| Message::PiUpdateCheck.detail(e))?;
        let mut response = client
            .get(url)
            .header("accept", "application/json")
            .send()
            .await
            .map_err(|e| Message::PiUpdateCheck.detail(e))?
            .error_for_status()
            .map_err(|e| Message::PiUpdateCheck.detail(e))?;
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|e| Message::PiUpdateCheck.detail(e))?
        {
            if bytes.len() + chunk.len() > OUTPUT_LIMIT {
                return Err(Message::PiUpdateCheck.text());
            }
            bytes.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&bytes).map_err(|e| Message::PiUpdateCheck.detail(e))
    })?;
    compare_release(&environment, data)
}
