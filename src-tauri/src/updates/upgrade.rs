use super::{process::run_update, PiUpdate, RunSnapshot};
use crate::{
    i18n::Message,
    onboarding::{check_environment, resolve_executable, EnvironmentCheck},
    packages::PACKAGE_OPERATION,
    runtime::Runtime,
};
use semver::Version;
use std::{path::Path, time::Duration};

pub(super) fn perform_upgrade(
    runtime: &Runtime,
    checked: &PiUpdate,
    executable: &str,
    home: &Path,
    mut sessions: Vec<RunSnapshot>,
    progress: impl Fn(&'static str),
) -> Result<EnvironmentCheck, String> {
    let _maintenance = runtime.maintenance()?;
    let _packages = PACKAGE_OPERATION
        .try_lock()
        .map_err(|_| Message::PackageBusy.text())?;
    let environment = check_environment(executable, home)?;
    if environment.executable != checked.executable {
        return Err(Message::PiUpdateChanged.text());
    }
    let target =
        Version::parse(&checked.latest_version).map_err(|_| Message::PiUpdateCheck.text())?;
    let current =
        Version::parse(&environment.version).map_err(|_| Message::InvalidPiExecutable.text())?;
    sessions.sort_by(|a, b| a.run_id.cmp(&b.run_id));
    if runtime.idle_sessions()? != sessions {
        return Err(Message::PiUpdateChanged.text());
    }
    // The webview has persisted these exact session paths. No new RPC or package
    // operation can race with the idle check while the maintenance guard is held.
    progress("stopping");
    runtime.stop()?;
    progress("updating");
    if target.cmp_precedence(&current).is_gt() {
        let binary = resolve_executable(executable, home)?;
        run_update(
            &binary,
            home,
            &checked.latest_version,
            Duration::from_secs(300),
        )?;
    }
    progress("verifying");
    let updated = check_environment(executable, home)?;
    let version =
        Version::parse(&updated.version).map_err(|_| Message::InvalidPiExecutable.text())?;
    if version.cmp_precedence(&target).is_lt() {
        return Err(Message::PiUpdateVerify.text());
    }
    Ok(updated)
}
