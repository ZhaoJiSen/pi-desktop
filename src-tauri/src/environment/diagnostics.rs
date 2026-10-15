use super::{
    managed::{discover, managed_binary, managed_owned},
    process::{command, Process},
    Diagnosis,
};
use crate::{
    i18n::Message,
    onboarding::{check_environment, resolve_executable},
};
use semver::Version;
use serde_json::Value;
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::Stdio,
    sync::mpsc,
    time::{Duration, Instant},
};

pub(super) fn compatibility(version: &str) -> &'static str {
    match Version::parse(version) {
        Ok(version) if version == Version::new(1, 0, 0) => "verified",
        Ok(version) if version >= Version::new(1, 0, 0) => "unverified",
        _ => "unsupported",
    }
}

// Only read-only RPC commands, without a session, extensions, MCP or prompts.
// Model records and stderr never cross IPC: return credential availability only.
pub(super) fn probe_rpc(
    binary: &Path,
    home: &Path,
    timeout: Duration,
) -> Result<&'static str, String> {
    let mut child = Process(
        command(binary, home)
            .args([
                "--mode",
                "rpc",
                "--offline",
                "--no-session",
                "--no-extensions",
                "--no-context-files",
                "--no-approve",
                "--no-skills",
                "--no-prompt-templates",
                "--no-themes",
            ])
            .env("PI_OFFLINE", "1")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|_| Message::PiRpcCheck.text())?,
        false,
    );
    let stdout = child
        .0
        .stdout
        .take()
        .ok_or_else(|| Message::PiRpcCheck.text())?;
    if let Some(mut stderr) = child.0.stderr.take() {
        std::thread::spawn(move || {
            let _ = std::io::copy(&mut stderr, &mut std::io::sink());
        });
    }
    let (sender, receiver) = mpsc::sync_channel(4);
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let mut bytes = Vec::new();
            // Bound each JSON record; a malformed executable must not exhaust memory.
            match reader
                .by_ref()
                .take(1024 * 1024 + 1)
                .read_until(b'\n', &mut bytes)
            {
                Ok(0) | Err(_) => break,
                Ok(count) if count > 1024 * 1024 => break,
                _ => {}
            }
            if let Ok(value) = serde_json::from_slice::<Value>(&bytes) {
                if value["type"] == "response" && sender.send(value).is_err() {
                    break;
                }
            }
        }
    });
    let mut input = child
        .0
        .stdin
        .take()
        .ok_or_else(|| Message::PiRpcCheck.text())?;
    input.write_all(b"{\"id\":\"desktop-check-state\",\"type\":\"get_state\"}\n{\"id\":\"desktop-check-models\",\"type\":\"get_available_models\"}\n")
        .map_err(|_| Message::PiRpcCheck.text())?;
    let started = Instant::now();
    let mut state = false;
    let mut authentication = None;
    while !state || authentication.is_none() {
        let response = receiver
            .recv_timeout(timeout.saturating_sub(started.elapsed()))
            .map_err(|_| Message::PiRpcCheck.text())?;
        match response["id"].as_str() {
            Some("desktop-check-state")
                if response["success"] == true && response["data"]["isStreaming"].is_boolean() =>
            {
                state = true
            }
            Some("desktop-check-models") if response["success"] == true => {
                let models = response["data"]["models"]
                    .as_array()
                    .ok_or_else(|| Message::PiRpcCheck.text())?;
                authentication = Some(if models.is_empty() {
                    "missing"
                } else {
                    "ready"
                });
            }
            Some("desktop-check-state" | "desktop-check-models") => {
                return Err(Message::PiRpcCheck.text())
            }
            _ => {}
        }
        if started.elapsed() >= timeout {
            return Err(Message::PiRpcCheck.text());
        }
    }
    drop(input);
    Ok(authentication.unwrap_or("unknown"))
}

pub(crate) fn diagnose(executable: &str, home: &Path) -> Diagnosis {
    let requested = if executable.trim().is_empty() {
        "pi"
    } else {
        executable.trim()
    };
    let resolved = if requested == "pi" {
        discover(home)
    } else {
        resolve_executable(requested, home).ok()
    };
    let Some(binary) = resolved else {
        return Diagnosis {
            kind: if requested == "pi" {
                "missing"
            } else {
                "pathProblem"
            },
            environment: None,
            compatibility: "unknown",
            authentication: "unknown",
            path_recovered: false,
            discovered_executable: discover(home).map(|path| path.to_string_lossy().into_owned()),
            detail: None,
            can_repair: false,
        };
    };
    let mut report = Diagnosis {
        kind: "runtimeError",
        environment: None,
        compatibility: "unknown",
        authentication: "unknown",
        path_recovered: requested == "pi"
            && !std::env::var_os("PATH").is_some_and(|path| {
                std::env::split_paths(&path)
                    .any(|dir| dir.join(if cfg!(windows) { "pi.cmd" } else { "pi" }) == binary)
            }),
        discovered_executable: None,
        detail: None,
        can_repair: false,
    };
    match check_environment(&binary.to_string_lossy(), home) {
        Ok(environment) => {
            report.compatibility = compatibility(&environment.version);
            if report.compatibility == "unsupported" {
                report.kind = "incompatible";
            } else {
                match probe_rpc(&binary, home, Duration::from_secs(12)) {
                    Ok(authentication) => {
                        report.kind = "ready";
                        report.authentication = authentication;
                    }
                    Err(detail) => {
                        report.kind = "rpcError";
                        report.detail = Some(detail);
                    }
                }
            }
            report.environment = Some(environment);
        }
        Err(detail) => report.detail = Some(detail),
    }
    report.can_repair =
        report.kind != "ready" && binary == managed_binary(home) && managed_owned(home);
    report
}
