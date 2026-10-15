use super::*;
use super::{process::run_update, release::compare_release};
use crate::onboarding::check_environment;
use serde_json::json;
use std::{
    io::Read,
    time::{Duration, Instant},
};

#[cfg(unix)]
fn environment(version: &str) -> EnvironmentCheck {
    EnvironmentCheck {
        executable: "/fixture/pi".into(),
        version: version.to_owned(),
        node_version: None,
        default_workspace: "/fixture/workspace".into(),
    }
}

#[cfg(unix)]
struct Fixture {
    path: std::path::PathBuf,
}
#[cfg(unix)]
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
        let _ = std::fs::remove_file(self.path.with_extension("version"));
        let _ = std::fs::remove_file(format!("{}.version", self.path.display()));
    }
}
#[cfg(unix)]
fn fixture(script: &str) -> Fixture {
    use std::os::unix::fs::PermissionsExt;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path =
        std::env::temp_dir().join(format!("pi update fixture {} {stamp}", std::process::id()));
    std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
    Fixture { path }
}

#[cfg(unix)]
#[test]
fn compares_semantic_versions_without_downgrading_or_treating_builds_as_updates() {
    for (current, latest, expected) in [
        ("1.9.0", "1.10.0", true),
        ("1.2.0", "1.2.0", false),
        ("2.0.0", "1.2.0", false),
        ("1.2.0-beta.1", "1.2.0", true),
        ("1.3.0-beta.1", "1.2.0", false),
        ("1.2.0+local", "1.2.0", false),
    ] {
        assert_eq!(
            compare_release(
                &environment(current),
                json!({ "ok": true, "version": latest })
            )
            .unwrap()
            .has_update,
            expected
        );
    }
    for value in [
        json!({}),
        json!({ "ok": false, "version": "1.2.0" }),
        json!({ "ok": true, "version": "invalid" }),
        json!({ "ok": true, "version": "2.0.0-beta.1" }),
    ] {
        assert!(compare_release(&environment("1.0.0"), value).is_err());
    }
}

#[cfg(unix)]
#[test]
fn claims_once_per_native_launch_and_suppresses_after_guide_even_when_skipped() {
    let updates = PiUpdates::default();
    let update = compare_release(
        &environment("1.0.0"),
        json!({ "ok": true, "version": "1.2.0" }),
    )
    .unwrap();
    updates
        .entry("pi")
        .unwrap()
        .set(Ok(update.clone()))
        .unwrap();
    assert!(updates.claim("pi").unwrap());
    assert!(!updates.claim("pi").unwrap());
    // Recreating a webview does not recreate this native state. A real launch does.
    let next_launch = PiUpdates::default();
    next_launch.entry("pi").unwrap().set(Ok(update)).unwrap();
    assert!(next_launch.claim("pi").unwrap());
    let guide = PiUpdates::default();
    guide.reminder_consumed.store(true, Ordering::SeqCst);
    guide
        .entry("pi")
        .unwrap()
        .set(updates.checked("pi"))
        .unwrap();
    assert!(!guide.claim("pi").unwrap());
}

#[cfg(unix)]
#[test]
fn check_coalesces_parallel_callers() {
    let updates = PiUpdates::default();
    let calls = std::sync::atomic::AtomicUsize::new(0);
    std::thread::scope(|scope| {
        for _ in 0..4 {
            let calls = &calls;
            let updates = &updates;
            scope.spawn(move || {
                updates.entry("pi").unwrap().get_or_init(|| {
                    calls.fetch_add(1, Ordering::SeqCst);
                    std::thread::sleep(Duration::from_millis(20));
                    Err("offline".into())
                });
            });
        }
    });
    assert_eq!(calls.load(Ordering::SeqCst), 1);
}

#[cfg(unix)]
#[test]
fn update_uses_only_explicit_self_update_arguments_and_preserves_paths_with_spaces() {
    let binary =
        fixture("[ $# = 2 ] && [ \"$1\" = update ] && [ \"$2\" = --self ] || exit 9; printf done");
    run_update(
        &binary.path,
        &std::env::temp_dir(),
        "1.2.0",
        Duration::from_secs(10),
    )
    .unwrap();
}

#[cfg(unix)]
#[test]
fn update_drains_large_output_and_reports_bounded_stderr() {
    let binary = fixture("i=0; while [ $i -lt 8000 ]; do printf '0123456789012345678901234567890123456789\\n'; printf 'error output 012345678901234567890123456789\\n' >&2; i=$((i+1)); done; printf 'unsupported install' >&2; exit 3");
    let error = run_update(
        &binary.path,
        &std::env::temp_dir(),
        "1.2.0",
        Duration::from_secs(5),
    )
    .unwrap_err();
    assert!(error.ends_with("unsupported install"));
    assert!(error.len() < OUTPUT_LIMIT + 256);
}

#[cfg(unix)]
#[test]
fn hung_updates_and_descendants_holding_output_have_a_deadline() {
    for script in ["sleep 30", "sleep 30 & exit 0"] {
        let binary = fixture(script);
        let started = Instant::now();
        assert!(run_update(
            &binary.path,
            &std::env::temp_dir(),
            "1.2.0",
            Duration::from_millis(100)
        )
        .is_err());
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}

#[cfg(unix)]
#[test]
fn upgrade_verifies_result_and_refuses_changed_sessions_before_stopping() {
    let _serial = UPGRADE_TESTS.lock().unwrap();
    let binary = fixture("if [ \"$1\" = --version ]; then if [ -f \"$0.version\" ]; then cat \"$0.version\"; else printf '1.0.0\\n'; fi; else [ \"$1\" = update ] && [ \"$2\" = --self ] || exit 9; printf '1.2.0\\n' > \"$0.version\"; fi");
    let runtime = Runtime::default();
    let env = check_environment(binary.path.to_str().unwrap(), &std::env::temp_dir()).unwrap();
    let checked = compare_release(&env, json!({ "ok": true, "version": "1.2.0" })).unwrap();
    assert!(perform_upgrade(
        &runtime,
        &checked,
        &env.executable,
        &std::env::temp_dir(),
        vec![RunSnapshot {
            run_id: "changed".into(),
            session_file: None
        }],
        |_| panic!("must not stop")
    )
    .is_err());
    let stages = Mutex::new(Vec::new());
    let result = perform_upgrade(
        &runtime,
        &checked,
        &env.executable,
        &std::env::temp_dir(),
        vec![],
        |stage| stages.lock().unwrap().push(stage),
    )
    .unwrap();
    assert_eq!(result.version, "1.2.0");
    assert_eq!(
        *stages.lock().unwrap(),
        vec!["stopping", "updating", "verifying"]
    );
}

#[cfg(unix)]
#[test]
fn unchanged_version_after_successful_command_is_a_failure() {
    let _serial = UPGRADE_TESTS.lock().unwrap();
    let binary = fixture("if [ \"$1\" = --version ]; then printf '1.0.0\\n'; fi");
    let runtime = Runtime::default();
    let env = check_environment(binary.path.to_str().unwrap(), &std::env::temp_dir()).unwrap();
    let checked = compare_release(&env, json!({ "ok": true, "version": "1.2.0" })).unwrap();
    let error = perform_upgrade(
        &runtime,
        &checked,
        &env.executable,
        &std::env::temp_dir(),
        vec![],
        |_| {},
    )
    .unwrap_err();
    assert_eq!(error, Message::PiUpdateVerify.text());
}

static UPGRADE_TESTS: Mutex<()> = Mutex::new(());

#[cfg(unix)]
struct ManagedFixture(std::path::PathBuf);
#[cfg(unix)]
impl Drop for ManagedFixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
#[cfg(unix)]
impl ManagedFixture {
    fn new(mode: &str) -> Self {
        use std::os::unix::fs::PermissionsExt;
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let home = std::env::temp_dir().join(format!("managed pi {} {stamp}", std::process::id()));
        std::fs::create_dir_all(&home).unwrap();
        let fixture = Self(home.canonicalize().unwrap());
        let prefix = fixture.0.join(".local/share/pi-desktop/pi-cli");
        for (name, script) in [
            (".volta/bin/node", "exit 99"),
            (".volta/bin/npm", "exit 99"),
            (
                ".volta/bin/volta",
                r#"
[ "$#" = 3 ] && [ "$1" = which ] && [ "$2" = --quiet ] || exit 9
case "$3" in node|npm) ;; *) exit 9 ;; esac
printf '%s/tools/image/test/bin/%s\n' "${0%/bin/volta}" "$3"
"#,
            ),
            (
                ".volta/tools/image/test/bin/node",
                r#"
if [ "$1" = --version ]; then printf 'v24.18.0\n'; exit 0; fi
[ "$#" = 11 ] && [ "$2" = install ] && [ "$3" = --prefix ] || exit 9
[ "$5" = --registry ] && [ "$6" = https://registry.npmjs.org ] || exit 9
[ "$7" = --ignore-scripts ] && [ "$8" = --no-audit ] && [ "$9" = --no-fund ] || exit 9
[ "${10}" = --save-exact ] && [ "${11}" = @earendil-works/pi-coding-agent@1.2.0 ] || exit 9
[ "$1" = "${0%/node}/npm-cli.js" ] || exit 9
printf 'called' > "$4/npm-ran"
case "$(/bin/cat "$4/mode")" in
 failure) printf 'fixture registry unavailable' >&2; exit 3 ;;
 unchanged) exit 0 ;;
 *) printf '1.2.0\n' > "$4/version" ;;
esac
"#,
            ),
            (
                ".local/share/pi-desktop/pi-cli/node_modules/.bin/pi",
                r#"
if [ "$1" = --version ]; then /bin/cat "${0%/node_modules/.bin/pi}/version"; exit 0; fi
printf 'local installation cannot self-update' >&2; exit 3
"#,
            ),
        ] {
            let path = fixture.0.join(name);
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700)).unwrap();
        }
        let image = fixture.0.join(".volta/tools/image/test/bin");
        std::fs::write(image.join("npm-cli.js"), "// fixture").unwrap();
        std::os::unix::fs::symlink("npm-cli.js", image.join("npm")).unwrap();
        std::fs::write(prefix.join(".pi-desktop-managed"), "1\n").unwrap();
        std::fs::write(prefix.join("version"), "1.0.0\n").unwrap();
        std::fs::write(prefix.join("mode"), mode).unwrap();
        fixture
    }
    fn binary(&self) -> std::path::PathBuf {
        self.0
            .join(".local/share/pi-desktop/pi-cli/node_modules/.bin/pi")
    }
}

#[cfg(unix)]
#[test]
fn managed_installation_updates_its_own_prefix_and_verifies_the_result() {
    let _serial = UPGRADE_TESTS.lock().unwrap();
    for mode in ["success", "failure", "unchanged"] {
        let fixture = ManagedFixture::new(mode);
        let runtime = Runtime::default();
        let environment =
            check_environment(fixture.binary().to_str().unwrap(), &fixture.0).unwrap();
        let checked =
            compare_release(&environment, json!({"ok": true, "version": "1.2.0"})).unwrap();
        let result = perform_upgrade(
            &runtime,
            &checked,
            &environment.executable,
            &fixture.0,
            vec![],
            |_| {},
        );
        assert!(
            fixture
                .0
                .join(".local/share/pi-desktop/pi-cli/npm-ran")
                .exists(),
            "{result:?}"
        );
        match mode {
            "success" => assert_eq!(result.unwrap().version, "1.2.0"),
            "failure" => {
                assert!(result.unwrap_err().contains("fixture registry unavailable"));
                assert!(runtime.operation().is_ok());
            }
            _ => assert_eq!(result.unwrap_err(), Message::PiUpdateVerify.text()),
        }
    }
}

#[cfg(unix)]
#[test]
fn unmanaged_paths_keep_self_update_and_do_not_modify_the_managed_directory() {
    let managed = ManagedFixture::new("success");
    let prefix = managed.0.join(".local/share/pi-desktop/pi-cli");
    let external = fixture("[ \"$1\" = update ] && [ \"$2\" = --self ] || exit 9");
    run_update(&external.path, &managed.0, "1.2.0", Duration::from_secs(5)).unwrap();
    assert!(!prefix.join("npm-ran").exists());
    std::fs::remove_file(prefix.join(".pi-desktop-managed")).unwrap();
    assert!(run_update(
        &managed.binary(),
        &managed.0,
        "1.2.0",
        Duration::from_secs(5)
    )
    .unwrap_err()
    .contains("local installation cannot self-update"));
    assert!(!prefix.join("npm-ran").exists());
}

#[cfg(unix)]
#[test]
fn release_http_failures_and_invalid_or_oversized_metadata_are_errors() {
    use std::io::Write;
    use std::net::TcpListener;
    let binary = fixture("printf '1.0.0\\n'");
    for (status, body, succeeds) in [
        (
            "200 OK",
            r#"{"ok":true,"version":"1.2.0"}"#.to_owned(),
            true,
        ),
        ("503 Unavailable", "{}".to_owned(), false),
        ("200 OK", "not json".to_owned(), false),
        ("200 OK", " ".repeat(OUTPUT_LIMIT + 1), false),
    ] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/latest-version", listener.local_addr().unwrap());
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = [0; 4096];
            let _ = socket.read(&mut request);
            let reply = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = socket.write_all(reply.as_bytes());
        });
        assert_eq!(
            check_release(binary.path.to_str().unwrap(), &std::env::temp_dir(), &url).is_ok(),
            succeeds
        );
        server.join().unwrap();
    }
    assert!(check_release(
        binary.path.to_str().unwrap(),
        &std::env::temp_dir(),
        "http://127.0.0.1:0/latest-version"
    )
    .is_err());
}

#[cfg(unix)]
#[test]
fn upgrade_refuses_a_busy_background_run_without_stopping_it() {
    let _serial = UPGRADE_TESTS.lock().unwrap();
    let binary = fixture(
        r#"
if [ "$1" = --version ]; then printf '1.0.0\n'; exit 0; fi
while IFS= read -r request; do
  id=$(printf '%s' "$request" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  printf '{"type":"response","id":"%s","success":true,"data":{"isStreaming":true,"sessionFile":"/saved/session.jsonl"}}\n' "$id"
done
"#,
    );
    let runtime = Runtime::default();
    runtime
        .start(
            std::env::temp_dir(),
            binary.path.to_string_lossy().into_owned(),
            None,
            "background".into(),
            std::env::temp_dir(),
            Channel::new(|_| Ok(())),
        )
        .unwrap();
    struct Stop(Runtime);
    impl Drop for Stop {
        fn drop(&mut self) {
            let _ = self.0.stop();
        }
    }
    let _cleanup = Stop(runtime.clone());
    let environment =
        check_environment(binary.path.to_str().unwrap(), &std::env::temp_dir()).unwrap();
    let checked = compare_release(&environment, json!({ "ok": true, "version": "1.2.0" })).unwrap();
    let result = perform_upgrade(
        &runtime,
        &checked,
        &environment.executable,
        &std::env::temp_dir(),
        vec![],
        |_| panic!("must not stop a running task"),
    );
    assert_eq!(result.unwrap_err(), Message::PiUpdateBusy.text());
    assert_eq!(runtime.connections().unwrap().as_array().unwrap().len(), 1);
}

#[test]
fn maintenance_excludes_requests_connections_and_concurrent_upgrades() {
    let runtime = Runtime::default();
    let guard = runtime.maintenance().unwrap();
    assert!(runtime.operation().is_err());
    assert!(runtime.maintenance().is_err());
    assert!(runtime
        .request("missing", json!({ "id": "test", "type": "prompt" }))
        .unwrap_err()
        .contains(&Message::PiUpdateBusy.text()));
    drop(guard);
    assert!(runtime.operation().is_ok());
}
