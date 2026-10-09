use super::*;

#[test]
fn missing_executable_returns_an_actionable_error() {
    let home = std::env::temp_dir();
    assert!(resolve_executable("/nonexistent/pi-desktop-missing", &home).is_err());
}

#[cfg(unix)]
fn fixture(script: &str) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let name = format!(
        "pi-onboarding-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    let path = std::env::temp_dir().join(name);
    std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
    path
}

#[cfg(unix)]
#[test]
fn version_check_runs_without_rpc_or_session_arguments() {
    let binary = fixture("[ \"$1\" = '--version' ] && [ $# = 1 ] || exit 1; printf '1.0.0\\n'");
    let result = check_environment(binary.to_str().unwrap(), &std::env::temp_dir()).unwrap();
    assert_eq!(result.version, "1.0.0");
    assert_eq!(result.executable, binary.to_string_lossy());
    assert!(result.default_workspace.ends_with("Pi Desktop"));
    std::fs::remove_file(binary).unwrap();
}

#[cfg(unix)]
#[test]
fn nonzero_empty_output_and_hung_processes_fail() {
    for script in ["exit 1", "exit 0", "sleep 30"] {
        let binary = fixture(script);
        let started = Instant::now();
        assert!(
            version_output(&binary, &std::env::temp_dir(), Duration::from_millis(100)).is_err()
        );
        assert!(started.elapsed() < Duration::from_secs(2));
        std::fs::remove_file(binary).unwrap();
    }
}

#[cfg(unix)]
#[test]
fn custom_paths_expand_home_and_preserve_manager_symlinks() {
    let binary = fixture("printf '1.0.0\\n'");
    let link = binary.with_extension("link");
    std::os::unix::fs::symlink(&binary, &link).unwrap();
    let value = format!("~/{}", link.file_name().unwrap().to_string_lossy());
    assert_eq!(
        resolve_executable(&value, &std::env::temp_dir()).unwrap(),
        link
    );
    std::fs::remove_file(link).unwrap();
    std::fs::remove_file(binary).unwrap();
}

#[cfg(unix)]
#[test]
fn rejects_an_executable_that_does_not_report_a_pi_version() {
    let binary = fixture("printf 'v22.18.0\\n'");
    assert!(check_environment(binary.to_str().unwrap(), &std::env::temp_dir()).is_err());
    std::fs::remove_file(binary).unwrap();
}

#[test]
#[ignore = "requires a locally installed Pi CLI; runs only --version"]
fn installed_pi_environment_smoke() {
    let home = PathBuf::from(std::env::var("HOME").expect("home path for desktop smoke check"));
    let result = check_environment("pi", &home).unwrap();
    assert!(semver::Version::parse(&result.version).is_ok());
    assert!(Path::new(&result.executable).is_file());
    assert_eq!(
        result.default_workspace,
        home.join("Pi Desktop").to_string_lossy()
    );
}
