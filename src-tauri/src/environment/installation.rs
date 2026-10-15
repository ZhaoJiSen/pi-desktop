use super::{
    diagnostics::diagnose,
    managed::{discover, managed_binary, managed_owned, managed_prefix, prepare_directory},
    npm::{npm_environment, npm_install_args},
    process::{command, Process, EXITING, INSTALL_PROCESS},
    Diagnosis, InstallPlan, InstallProgress, BASELINE, NEXT_PLAN, REGISTRY,
};
use crate::{
    i18n::Message, onboarding::resolve_executable, packages::PACKAGE_OPERATION, runtime::Runtime,
};
use std::{
    io::Read,
    path::{Path, PathBuf},
    sync::{atomic::Ordering, mpsc},
    time::{Duration, Instant},
};

const OUTPUT_LIMIT: usize = 32 * 1024;

pub(super) fn ensure_missing(executable: &str, home: &Path) -> Result<(), String> {
    // Do not install over an existing CLI, including a different configured path.
    let managed = managed_binary(home);
    for binary in [resolve_executable(executable, home).ok(), discover(home)]
        .into_iter()
        .flatten()
    {
        if binary != managed
            || !managed_owned(home)
            || diagnose(&binary.to_string_lossy(), home).kind == "ready"
        {
            return Err(Message::PiAlreadyInstalled.text());
        }
    }
    Ok(())
}

pub(super) fn prepare_install(executable: &str, home: &Path) -> Result<InstallPlan, String> {
    ensure_missing(executable, home)?;
    let (node, node_version, npm_cli) = npm_environment(home)?;
    Ok(build_plan(executable, home, node, node_version, npm_cli))
}

pub(super) fn build_plan(
    executable: &str,
    home: &Path,
    node: PathBuf,
    node_version: String,
    npm_cli: PathBuf,
) -> InstallPlan {
    let directory = managed_prefix(home);
    let args = npm_install_args(&npm_cli, &directory, BASELINE);
    // Display quoting only. Execution always passes the exact argument vector.
    let display = std::iter::once(node.to_string_lossy().into_owned())
        .chain(args.iter().cloned())
        .map(|arg| format!("'{}'", arg.replace('\'', "'\\''")))
        .collect::<Vec<_>>()
        .join(" ");
    InstallPlan {
        id: NEXT_PLAN.fetch_add(1, Ordering::Relaxed).to_string(),
        command: display,
        source: REGISTRY,
        version: BASELINE,
        directory,
        node_version,
        node,
        args,
        requested: executable.into(),
        created: Instant::now(),
    }
}

pub(super) fn run_install(
    plan: &InstallPlan,
    home: &Path,
    timeout: Duration,
    progress: impl Fn(InstallProgress),
) -> Result<(), String> {
    if EXITING.load(Ordering::SeqCst) {
        return Err(Message::PiInstallCancelled.text());
    }
    let mut child = Process(
        command(&plan.node, home)
            .args(&plan.args)
            .env_remove("PI_OFFLINE")
            .env("npm_config_update_notifier", "false")
            .spawn()
            .map_err(|e| Message::PiInstallFailed.detail(e))?,
        true,
    );
    INSTALL_PROCESS.store(child.0.id(), Ordering::SeqCst);
    if EXITING.load(Ordering::SeqCst) {
        return Err(Message::PiInstallCancelled.text());
    }
    let (sender, receiver) = mpsc::sync_channel(16);
    for (stream, output) in [
        (
            "stdout",
            child
                .0
                .stdout
                .take()
                .map(|v| Box::new(v) as Box<dyn Read + Send>),
        ),
        (
            "stderr",
            child
                .0
                .stderr
                .take()
                .map(|v| Box::new(v) as Box<dyn Read + Send>),
        ),
    ] {
        let sender = sender.clone();
        if let Some(mut output) = output {
            std::thread::spawn(move || {
                let mut bytes = [0; 2048];
                while let Ok(count) = output.read(&mut bytes) {
                    if count == 0
                        || sender
                            .send((
                                stream,
                                String::from_utf8_lossy(&bytes[..count]).into_owned(),
                            ))
                            .is_err()
                    {
                        break;
                    }
                }
            });
        }
    }
    drop(sender);
    let started = Instant::now();
    let mut tail = String::new();
    loop {
        match receiver.recv_timeout(Duration::from_millis(25)) {
            Ok((stream, text)) => {
                tail.push_str(&text);
                if tail.len() > OUTPUT_LIMIT {
                    let mut boundary = tail.len() - OUTPUT_LIMIT;
                    while !tail.is_char_boundary(boundary) {
                        boundary += 1;
                    }
                    tail.drain(..boundary);
                }
                progress(InstallProgress {
                    stage: "installing",
                    stream: Some(stream),
                    text: Some(text),
                });
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                if let Some(status) = child
                    .0
                    .try_wait()
                    .map_err(|e| Message::PiInstallFailed.detail(e))?
                {
                    return if status.success() {
                        Ok(())
                    } else {
                        Err(Message::PiInstallFailed.detail(tail.trim()))
                    };
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }
        if started.elapsed() >= timeout {
            return Err(Message::PiInstallTimeout.text());
        }
    }
}

pub(super) fn perform_install(
    runtime: &Runtime,
    plan: &InstallPlan,
    home: &Path,
    progress: impl Fn(InstallProgress),
) -> Result<Diagnosis, String> {
    let _maintenance = runtime.maintenance()?;
    let _packages = PACKAGE_OPERATION
        .try_lock()
        .map_err(|_| Message::PackageBusy.text())?;
    if !runtime.connections()?.as_array().is_some_and(Vec::is_empty) {
        return Err(Message::PiUpdateBusy.text());
    }
    ensure_missing(&plan.requested, home)?;
    prepare_directory(home)?;
    run_install(plan, home, Duration::from_secs(300), &progress)?;
    progress(InstallProgress {
        stage: "verifying",
        stream: None,
        text: None,
    });
    verify_install(home)
}

pub(super) fn verify_install(home: &Path) -> Result<Diagnosis, String> {
    let report = diagnose(&managed_binary(home).to_string_lossy(), home);
    if report.kind != "ready"
        || report
            .environment
            .as_ref()
            .is_none_or(|environment| environment.version != BASELINE)
    {
        return Err(Message::PiInstallVerify.text());
    }
    Ok(report)
}
