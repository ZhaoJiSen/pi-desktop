use super::{
    managed::{managed_binary, managed_owned, managed_prefix},
    process::command,
    REGISTRY,
};
use crate::{
    i18n::Message,
    onboarding::{command_output, resolve_executable, version_output},
};
use semver::Version;
use std::{
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

// Volta dispatches native shims by name. Ask the sibling manager for the actual
// tool instead of guessing its versioned image directory or executing a shell.
fn unwrap_volta(binary: PathBuf, tool: &str, home: &Path) -> Result<PathBuf, String> {
    let volta =
        binary
            .parent()
            .unwrap_or(home)
            .join(if cfg!(windows) { "volta.exe" } else { "volta" });
    if !volta.is_file() {
        return Ok(binary);
    }
    let path = PathBuf::from(command_output(
        &volta,
        &["which", "--quiet", tool],
        home,
        Duration::from_secs(3),
    )?);
    if !path.is_absolute() || !path.is_file() {
        return Err(Message::PiNpmRequired.text());
    }
    Ok(path)
}

pub(super) fn npm_cli(binary: &Path) -> Result<PathBuf, String> {
    let canonical = binary
        .canonicalize()
        .map_err(|_| Message::PiNpmRequired.text())?;
    let entry = if canonical.extension().is_some_and(|ext| ext == "js") {
        canonical
    } else {
        binary
            .parent()
            .unwrap_or(Path::new("."))
            .join("node_modules/npm/bin/npm-cli.js")
    };
    entry
        .is_file()
        .then_some(entry)
        .ok_or_else(|| Message::PiNpmRequired.text())
}

pub(super) fn npm_environment(home: &Path) -> Result<(PathBuf, String, PathBuf), String> {
    let node = resolve_executable(if cfg!(windows) { "node.exe" } else { "node" }, home)
        .map_err(|_| Message::PiNodeRequired.text())?;
    let node = unwrap_volta(node, "node", home).map_err(|_| Message::PiNodeRequired.text())?;
    let node_version = version_output(&node, home, Duration::from_secs(3))?;
    if Version::parse(node_version.trim_start_matches('v'))
        .map_or(true, |v| v < Version::new(22, 19, 0))
    {
        return Err(Message::PiNodeRequired.text());
    }
    let npm = if cfg!(windows) {
        // Volta exposes npm.exe, while the standard Node installer uses npm.cmd.
        resolve_executable("npm.exe", home).or_else(|_| resolve_executable("npm.cmd", home))
    } else {
        resolve_executable("npm", home)
    }
    .map_err(|_| Message::PiNpmRequired.text())?;
    // Invoke npm's JS entry with the validated Node, never through a shell or cmd.exe.
    let npm = unwrap_volta(npm, "npm", home).map_err(|_| Message::PiNpmRequired.text())?;
    Ok((node, node_version, npm_cli(&npm)?))
}

pub(super) fn npm_install_args(npm_cli: &Path, directory: &Path, version: &str) -> Vec<String> {
    vec![
        npm_cli.to_string_lossy().into_owned(),
        "install".into(),
        "--prefix".into(),
        directory.to_string_lossy().into_owned(),
        "--registry".into(),
        REGISTRY.into(),
        "--ignore-scripts".into(),
        "--no-audit".into(),
        "--no-fund".into(),
        "--save-exact".into(),
        format!("@earendil-works/pi-coding-agent@{version}"),
    ]
}

pub(crate) fn managed_update(
    binary: &Path,
    home: &Path,
    version: &str,
) -> Result<Option<Command>, String> {
    let managed = managed_binary(home);
    if !managed_owned(home)
        || std::fs::symlink_metadata(managed_prefix(home))
            .is_ok_and(|meta| meta.file_type().is_symlink())
        || (binary != managed
            && !binary
                .canonicalize()
                .ok()
                .is_some_and(|path| managed.canonicalize().is_ok_and(|managed| path == managed)))
    {
        return Ok(None);
    }
    let version = Version::parse(version).map_err(|_| Message::PiUpdateCheck.text())?;
    let (node, _, npm_cli) = npm_environment(home)?;
    let mut update = command(&node, home);
    update
        .args(npm_install_args(
            &npm_cli,
            &managed_prefix(home),
            &version.to_string(),
        ))
        .env("npm_config_update_notifier", "false");
    Ok(Some(update))
}
