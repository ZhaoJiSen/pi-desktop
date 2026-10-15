use super::*;
use super::{
    diagnostics::{compatibility, probe_rpc},
    installation::{build_plan, ensure_missing, perform_install, run_install, verify_install},
    managed::{managed_binary, managed_owned, managed_prefix, prepare_directory},
    npm::{npm_cli, npm_environment},
};
use std::sync::atomic::Ordering;

#[cfg(unix)]
struct Fixture(PathBuf);
#[cfg(unix)]
impl Fixture {
    fn new() -> Self {
        let dir = std::env::temp_dir().join(format!(
            "pi-environment-{}-{}",
            std::process::id(),
            NEXT_PLAN.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
    fn binary(&self, name: &str, script: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let binary = self.0.join(name);
        std::fs::write(&binary, format!("#!/bin/sh\n{script}\n")).unwrap();
        std::fs::set_permissions(&binary, std::fs::Permissions::from_mode(0o700)).unwrap();
        binary
    }
    fn pi(&self, version: &str, models: &str) -> PathBuf {
        self.binary("pi", &format!(r#"
if [ "$1" = --version ]; then printf '{version}\n'; exit 0; fi
case " $* " in *" --no-session "*) ;; *) exit 9;; esac
read -r state
read -r models
printf '%s\n' '{{"type":"response","id":"desktop-check-models","success":true,"data":{{"models":{models}}}}}'
printf '%s\n' '{{"type":"response","id":"desktop-check-state","success":true,"data":{{"isStreaming":false}}}}'
sleep 30
"#))
    }
    fn plan(&self, binary: PathBuf) -> InstallPlan {
        InstallPlan {
            id: "fixture".into(),
            command: "reviewed command".into(),
            source: REGISTRY,
            version: BASELINE,
            directory: self.0.join("installation"),
            node_version: "v22.19.0".into(),
            node: binary,
            args: vec![
                "install".into(),
                "--ignore-scripts".into(),
                "@earendil-works/pi-coding-agent@1.0.0".into(),
            ],
            requested: "/missing/pi".into(),
            created: Instant::now(),
        }
    }
}
#[cfg(unix)]
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn compatibility_distinguishes_baseline_newer_and_unsupported_versions() {
    for (version, expected) in [
        ("1.0.0", "verified"),
        ("1.1.0", "unverified"),
        ("1.2.0", "unverified"),
        ("1.0.0-beta.1", "unsupported"),
        ("0.60.0", "unsupported"),
    ] {
        assert_eq!(compatibility(version), expected, "{version}");
    }
}

#[cfg(unix)]
#[test]
fn plan_pins_the_reviewed_official_package_and_never_uses_remote_scripts() {
    let fixture = Fixture::new();
    let plan = build_plan(
        "pi",
        &fixture.0,
        fixture.0.join("node"),
        "v22.19.0".into(),
        fixture.0.join("npm-cli.js"),
    );
    assert_eq!(
        plan.args,
        vec![
            fixture.0.join("npm-cli.js").to_string_lossy().into_owned(),
            "install".into(),
            "--prefix".into(),
            managed_prefix(&fixture.0).to_string_lossy().into_owned(),
            "--registry".into(),
            REGISTRY.into(),
            "--ignore-scripts".into(),
            "--no-audit".into(),
            "--no-fund".into(),
            "--save-exact".into(),
            "@earendil-works/pi-coding-agent@1.0.0".into()
        ]
    );
    assert_eq!(plan.source, REGISTRY);
    assert_eq!(plan.version, "1.0.0");
    assert!(!plan.command.contains("curl"));
    assert!(!managed_prefix(&fixture.0).exists());
}

#[cfg(unix)]
#[test]
fn volta_shims_resolve_real_node_and_npm_before_building_install_arguments() {
    let fixture = Fixture::new();
    let bin = fixture.0.join(".volta/bin");
    let image = fixture.0.join(".volta/tools/image/toolchain/bin");
    std::fs::create_dir_all(&bin).unwrap();
    std::fs::create_dir_all(&image).unwrap();
    // Native-style shims have no JS suffix and must never run as npm's JS entry.
    fixture.binary(".volta/bin/node", "exit 99");
    fixture.binary(".volta/bin/npm", "exit 99");
    fixture.binary(
        ".volta/tools/image/toolchain/bin/node",
        "[ \"$1\" = --version ] || exit 9; printf 'v24.18.0\\n'",
    );
    std::fs::write(image.join("npm-cli.js"), "// fixture npm entry").unwrap();
    std::os::unix::fs::symlink("npm-cli.js", image.join("npm")).unwrap();
    fixture.binary(
        ".volta/bin/volta",
        r#"
[ "$#" = 3 ] && [ "$1" = which ] && [ "$2" = --quiet ] || exit 9
case "$3" in node|npm) ;; *) exit 9 ;; esac
printf '%s/tools/image/toolchain/bin/%s\n' "${0%/bin/volta}" "$3"
"#,
    );
    let (node, version, npm) = npm_environment(&fixture.0).unwrap();
    assert_eq!(node, image.join("node"));
    assert_eq!(version, "v24.18.0");
    assert_eq!(npm, image.join("npm-cli.js").canonicalize().unwrap());
    let plan = build_plan("/missing/pi", &fixture.0, node, version, npm.clone());
    assert_eq!(plan.args[0], npm.to_string_lossy());

    // A broken manager response must not silently fall back to guessing a path.
    fixture.binary(".volta/bin/volta", "printf '/not/an/installed/npm\\n'");
    assert!(npm_environment(&fixture.0).is_err());
}

#[cfg(unix)]
#[test]
fn npm_symlinks_and_windows_style_launcher_layouts_resolve_the_js_entry() {
    let fixture = Fixture::new();
    let entry = fixture.0.join("npm-cli.js");
    std::fs::write(&entry, "// npm fixture").unwrap();
    let symlink = fixture.0.join("npm");
    std::os::unix::fs::symlink(&entry, &symlink).unwrap();
    assert_eq!(npm_cli(&symlink).unwrap(), entry.canonicalize().unwrap());

    let shim = fixture.binary("npm.cmd", "exit 99");
    let windows_entry = fixture.0.join("node_modules/npm/bin/npm-cli.js");
    std::fs::create_dir_all(windows_entry.parent().unwrap()).unwrap();
    std::fs::write(&windows_entry, "// npm fixture").unwrap();
    assert_eq!(npm_cli(&shim).unwrap(), windows_entry);
}

#[cfg(unix)]
#[test]
fn repair_owns_only_the_desktop_directory_and_preserves_unrelated_files() {
    let fixture = Fixture::new();
    prepare_directory(&fixture.0).unwrap();
    assert!(managed_owned(&fixture.0));
    std::fs::write(
        managed_prefix(&fixture.0).join("partial-package"),
        "partial",
    )
    .unwrap();
    prepare_directory(&fixture.0).unwrap();
    let other = Fixture::new();
    std::fs::create_dir_all(managed_prefix(&other.0)).unwrap();
    let file = managed_prefix(&other.0).join("user-file");
    std::fs::write(&file, "keep").unwrap();
    assert!(prepare_directory(&other.0).is_err());
    assert_eq!(std::fs::read_to_string(file).unwrap(), "keep");
}

#[cfg(unix)]
#[test]
#[ignore = "requires isolated Pi CLI 1.0.0; run with an isolated PI_CODING_AGENT_DIR"]
fn real_baseline_diagnosis_checks_version_rpc_and_preserves_existing_config() {
    let binary = std::env::var("PI_DESKTOP_PI_V1_EXECUTABLE").expect("isolated baseline path");
    let agent =
        PathBuf::from(std::env::var("PI_CODING_AGENT_DIR").expect("isolated agent directory"));
    let fixture = Fixture::new();
    let auth = agent.join("auth.json");
    let settings = agent.join("settings.json");
    let before_auth = std::fs::read(&auth).unwrap();
    let before_settings = std::fs::read(&settings).unwrap();
    let report = diagnose(&binary, &fixture.0);
    assert_eq!(report.kind, "ready");
    assert_eq!(report.compatibility, "verified");
    assert_eq!(report.environment.unwrap().version, "1.0.0");
    assert_eq!(std::fs::read(auth).unwrap(), before_auth);
    assert_eq!(std::fs::read(settings).unwrap(), before_settings);
}

#[cfg(unix)]
#[test]
fn rpc_and_authentication_checks_return_only_status_and_do_not_create_sessions() {
    let fixture = Fixture::new();
    let config = fixture.0.join("auth.json");
    std::fs::write(&config, "unchanged credential fixture").unwrap();
    let binary = fixture.pi(
        "1.0.0",
        r#"[{"id":"model","apiKey":"must-never-cross-ipc"}]"#,
    );
    let result = diagnose(binary.to_str().unwrap(), &fixture.0);
    assert_eq!(result.kind, "ready");
    assert_eq!(result.authentication, "ready");
    assert_eq!(result.compatibility, "verified");
    let json = serde_json::to_string(&result).unwrap();
    assert!(!json.contains("must-never-cross-ipc"));
    assert_eq!(
        std::fs::read_to_string(config).unwrap(),
        "unchanged credential fixture"
    );
    let binary = fixture.pi("1.2.0", "[]");
    let result = diagnose(binary.to_str().unwrap(), &fixture.0);
    assert_eq!(result.kind, "ready");
    assert_eq!(result.authentication, "missing");
    assert_eq!(result.compatibility, "unverified");
}

#[cfg(unix)]
#[test]
fn unsupported_versions_do_not_attempt_rpc_and_invalid_rpc_is_not_ready() {
    let fixture = Fixture::new();
    let binary = fixture.binary(
        "old-pi",
        "[ \"$1\" = --version ] || exit 8; printf '0.1.0\\n'",
    );
    assert_eq!(
        diagnose(binary.to_str().unwrap(), &fixture.0).kind,
        "incompatible"
    );
    let binary = fixture.binary("broken-pi", "printf 'garbage\\n'");
    assert_eq!(
        diagnose(binary.to_str().unwrap(), &fixture.0).kind,
        "runtimeError"
    );
    assert!(probe_rpc(&binary, &fixture.0, Duration::from_millis(100)).is_err());
}

#[cfg(unix)]
#[test]
fn bad_configured_path_is_distinct_from_missing_and_existing_pi_blocks_install() {
    let fixture = Fixture::new();
    assert_eq!(diagnose("/not/a/real/pi", &fixture.0).kind, "pathProblem");
    let binary = fixture.pi("1.0.0", "[]");
    assert!(ensure_missing(binary.to_str().unwrap(), &fixture.0).is_err());
}

#[cfg(unix)]
#[test]
fn installer_requires_explicit_current_single_use_confirmation() {
    let fixture = Fixture::new();
    let installer = PiInstaller::default();
    let plan = fixture.plan(fixture.binary("npm", "exit 0"));
    *installer.plan.lock().unwrap() = Some(plan.clone());
    assert!(installer.confirm("fixture", false).is_err());
    assert!(installer.confirm("fixture", true).is_ok());
    assert!(installer.confirm("fixture", true).is_err());
    let mut expired = plan;
    expired.created = Instant::now() - Duration::from_secs(601);
    *installer.plan.lock().unwrap() = Some(expired);
    assert!(installer.confirm("fixture", true).is_err());
}

#[cfg(unix)]
#[test]
fn installer_streams_real_output_and_uses_exact_arguments_without_a_shell() {
    let fixture = Fixture::new();
    let binary = fixture.binary("fake-node", "[ \"$1\" = install ] && [ \"$2\" = --ignore-scripts ] && [ \"$3\" = @earendil-works/pi-coding-agent@1.0.0 ] || exit 9; printf 'download complete\\n'; printf 'warning fixture\\n' >&2");
    let plan = fixture.plan(binary);
    let events = Mutex::new(Vec::new());
    run_install(&plan, &fixture.0, Duration::from_secs(2), |event| {
        events.lock().unwrap().push(event)
    })
    .unwrap();
    let events = events.into_inner().unwrap();
    assert!(events.iter().any(|event| event.stream == Some("stdout")
        && event.text.as_ref().unwrap().contains("download complete")));
    assert!(events.iter().any(|event| event.stream == Some("stderr")
        && event.text.as_ref().unwrap().contains("warning fixture")));
}

#[cfg(unix)]
#[test]
fn failures_and_hung_descendants_are_bounded_and_retry_can_succeed() {
    let fixture = Fixture::new();
    let binary = fixture.binary("failure", "printf 'network fixture failure\\n' >&2; exit 3");
    let error = run_install(
        &fixture.plan(binary),
        &fixture.0,
        Duration::from_secs(5),
        |_| {},
    )
    .unwrap_err();
    assert!(error.contains("network fixture failure"), "{error}");
    let binary = fixture.binary("hung", "sleep 30 & exit 0");
    let started = Instant::now();
    assert!(run_install(
        &fixture.plan(binary),
        &fixture.0,
        Duration::from_millis(100),
        |_| {}
    )
    .is_err());
    assert!(started.elapsed() < Duration::from_secs(2));
    let binary = fixture.binary("retry", "printf 'retry complete\\n'");
    run_install(
        &fixture.plan(binary),
        &fixture.0,
        Duration::from_secs(5),
        |_| {},
    )
    .unwrap();
}

#[cfg(unix)]
#[test]
fn installation_rejects_concurrent_maintenance_before_running_any_command() {
    let fixture = Fixture::new();
    let runtime = Runtime::default();
    let _guard = runtime.maintenance().unwrap();
    let binary = fixture.binary("must-not-run", "touch command-ran");
    assert!(perform_install(&runtime, &fixture.plan(binary), &fixture.0, |_| {}).is_err());
    assert!(!fixture.0.join("command-ran").exists());
}

#[cfg(unix)]
#[test]
fn installation_refuses_existing_native_connections_without_stopping_them() {
    let fixture = Fixture::new();
    let runtime = Runtime::default();
    let binary = fixture.binary("live-pi", "sleep 30");
    runtime
        .start(
            fixture.0.clone(),
            binary.to_string_lossy().into_owned(),
            None,
            "live".into(),
            fixture.0.clone(),
            Channel::new(|_| Ok(())),
        )
        .unwrap();
    let result = perform_install(
        &runtime,
        &fixture.plan(fixture.binary("installer", "touch command-ran")),
        &fixture.0,
        |_| {},
    );
    let connections = runtime.connections().unwrap();
    runtime.stop().unwrap();
    assert!(result.is_err());
    assert_eq!(connections.as_array().unwrap().len(), 1);
    assert!(!fixture.0.join("command-ran").exists());
}

#[cfg(unix)]
#[test]
fn installed_binary_must_match_the_reviewed_version_and_pass_rpc() {
    let fixture = Fixture::new();
    let managed = managed_binary(&fixture.0);
    std::fs::create_dir_all(managed.parent().unwrap()).unwrap();
    let wrong_version = fixture.pi("1.2.0", "[]");
    std::os::unix::fs::symlink(&wrong_version, &managed).unwrap();
    assert!(verify_install(&fixture.0).is_err());
    fixture.pi("1.0.0", "[]");
    assert_eq!(verify_install(&fixture.0).unwrap().kind, "ready");
    fixture.binary(
        "pi",
        "if [ \"$1\" = --version ]; then printf '1.0.0\\n'; else exit 1; fi",
    );
    assert!(verify_install(&fixture.0).is_err());
}
