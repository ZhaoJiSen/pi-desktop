use super::*;
use super::{
    operation::{Operation, COMMITTING, RUNNING},
    progress::progress_line,
    validation::{valid_name, valid_url},
};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{atomic::Ordering, mpsc, Arc},
    thread,
    time::{Duration, Instant},
};

#[test]
fn accepts_only_remote_addresses_without_credentials_or_options() {
    for url in [
        "https://github.com/org/repo.git",
        "ssh://git@example.com:2222/org/repo",
        "git@example.com:org/repo.git",
    ] {
        assert!(valid_url(url), "{url}");
    }
    for url in [
        "--upload-pack=evil",
        "/tmp/repo",
        "file:///tmp/repo",
        "http://example.com/repo",
        "https://user:token@example.com/repo",
        "https://token@example.com/repo",
        "https://example.com/repo?token=secret",
        "https://example.com/",
        "git@host:",
        "git@host:repo\n",
    ] {
        assert!(!valid_url(url), "{url}");
    }
}

#[test]
fn rejects_path_traversal_and_platform_reserved_names() {
    for name in [
        "", ".", "..", "../repo", "x/y", "x\\y", "nul", "CON.txt", "COM1", "repo.", "repo ",
    ] {
        assert!(!valid_name(name), "{name}");
    }
    for name in ["repo", "my project", "项目", "repo.git"] {
        assert!(valid_name(name), "{name}");
    }
}

#[test]
fn parses_phase_percentages_without_fabricating_total_progress() {
    assert_eq!(
        progress_line("Receiving objects:  42% (4/10)"),
        Some(("receiving", Some(42)))
    );
    assert_eq!(
        progress_line("Updating files: 100% (1/1), done."),
        Some(("checkout", Some(100)))
    );
    assert_eq!(progress_line("remote: Counting objects: 100%"), None);
}

#[test]
fn only_the_active_task_can_be_claimed_and_cancel_before_commit_wins() {
    let manager = RepositoryClones::default();
    let operation = manager.claim("one").unwrap();
    assert_eq!(manager.claim("two").err().unwrap().code, "busy");
    operation.cancel();
    assert!(operation
        .phase
        .compare_exchange(RUNNING, COMMITTING, Ordering::SeqCst, Ordering::SeqCst)
        .is_err());
    drop(Claim {
        manager: manager.clone(),
    });
    assert!(manager.claim("two").is_ok());
}

#[cfg(unix)]
struct Fixture {
    root: PathBuf,
    script: PathBuf,
}
#[cfg(unix)]
impl Fixture {
    fn new(body: &str) -> Self {
        use std::os::unix::fs::PermissionsExt;
        static NEXT_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "pi-clone-test-{}-{stamp}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        let script = root.join("git-fixture");
        fs::write(&script, format!("#!/bin/sh\n{body}\n")).unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o700)).unwrap();
        Self { root, script }
    }
    fn run(
        &self,
        name: &str,
        operation: &Operation,
        report: impl FnMut(CloneProgress),
    ) -> Result<Option<String>> {
        run_clone(
            &self.root,
            CloneInput {
                task_id: "fixture",
                url: "https://example.com/org/repo.git",
                parent: self.root.to_str().unwrap(),
                name,
            },
            operation,
            report,
            self.script.as_os_str(),
        )
    }
    fn staging(&self) -> PathBuf {
        self.root
            .join(format!(".pi-clone-{}-fixture", std::process::id()))
    }
}
#[cfg(unix)]
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[cfg(unix)]
#[test]
fn clones_a_real_local_repository_then_publishes_without_staging_leftovers() {
    let fixture = Fixture::new("for target do :; done\nexec git clone --progress -- \"$(dirname \"$0\")/source\" \"$target\"");
    let status = Command::new("git")
        .args(["init", "--bare", "--quiet"])
        .arg(fixture.root.join("source"))
        .status()
        .unwrap();
    assert!(status.success());
    let path = fixture
        .run("checkout", &Operation::default(), |_| {})
        .unwrap()
        .unwrap();
    assert!(Path::new(&path).join(".git").is_dir());
    assert!(!fixture.staging().exists());
}

#[cfg(unix)]
#[test]
fn preserves_existing_targets_and_unowned_staging_directories() {
    let fixture = Fixture::new("exit 0");
    fs::create_dir(fixture.root.join("checkout")).unwrap();
    fs::write(fixture.root.join("checkout/keep"), "untouched").unwrap();
    assert_eq!(
        fixture
            .run("checkout", &Operation::default(), |_| {})
            .err()
            .unwrap()
            .code,
        "conflict"
    );
    assert_eq!(
        fs::read_to_string(fixture.root.join("checkout/keep")).unwrap(),
        "untouched"
    );
    fs::create_dir(fixture.staging()).unwrap();
    fs::write(fixture.staging().join("keep"), "untouched").unwrap();
    assert!(fixture.run("other", &Operation::default(), |_| {}).is_err());
    assert!(fixture.staging().join("keep").exists());
}

#[cfg(unix)]
#[test]
fn failed_clone_cleans_only_owned_staging_and_redacts_remote_error() {
    let fixture = Fixture::new("echo 'fatal: Authentication failed for https://secret-token@example.com/repo' >&2\nexit 128");
    let error = fixture
        .run("checkout", &Operation::default(), |_| {})
        .unwrap_err();
    assert_eq!(error.code, "auth");
    assert!(!serde_json::to_string(&error)
        .unwrap()
        .contains("secret-token"));
    assert!(!fixture.staging().exists());
    assert!(!fixture.root.join("checkout").exists());
}

#[cfg(unix)]
#[test]
fn cancellation_stops_git_and_its_transport_without_publishing() {
    let fixture = Fixture::new("printf 'Receiving objects: 1%% (1/100)\\r' >&2\nsleep 30 &\nwait");
    let operation = Operation::default();
    let mut received = false;
    let result = fixture
        .run("checkout", &operation, |progress| {
            if progress.stage == "receiving" {
                received = true;
                operation.cancel();
            }
        })
        .unwrap();
    assert!(received);
    assert!(result.is_none());
    assert!(!fixture.staging().exists());
    assert!(!fixture.root.join("checkout").exists());
}

#[cfg(unix)]
struct ProcessGroup(u32);
#[cfg(unix)]
impl Drop for ProcessGroup {
    fn drop(&mut self) {
        // Also clean up a deliberately orphaned helper when a regression fails.
        unsafe {
            libc::kill(-(self.0 as i32), libc::SIGKILL);
        }
    }
}

#[cfg(unix)]
fn wait_for_exited_git(operation: &Operation) -> ProcessGroup {
    let started = Instant::now();
    loop {
        if let Some(child) = operation.child.lock().unwrap().as_mut() {
            if child.try_wait().unwrap().is_some() {
                return ProcessGroup(child.id());
            }
        }
        assert!(
            started.elapsed() < Duration::from_secs(5),
            "Git must exit before cancellation"
        );
        thread::sleep(Duration::from_millis(5));
    }
}

#[cfg(unix)]
#[test]
fn cancellation_after_git_exit_stops_helpers_and_releases_the_clone_manager() {
    for shutdown in [false, true] {
        let fixture = Arc::new(Fixture::new("sleep 30 &\nexit 0"));
        let manager = RepositoryClones::default();
        let operation = manager.claim("fixture").unwrap();
        let (tx, rx) = mpsc::channel();
        let worker = {
            let fixture = fixture.clone();
            let operation = operation.clone();
            let manager = manager.clone();
            thread::spawn(move || {
                let result = {
                    let _claim = Claim { manager };
                    fixture.run("checkout", &operation, |_| {})
                };
                tx.send(result).unwrap();
            })
        };
        let _cleanup = wait_for_exited_git(&operation);
        if shutdown {
            manager.cancel_all();
        } else {
            operation.cancel();
        }
        assert!(rx
            .recv_timeout(Duration::from_secs(5))
            .unwrap()
            .unwrap()
            .is_none());
        worker.join().unwrap();
        assert!(operation.child.lock().unwrap().is_none());
        assert!(!fixture.staging().exists());
        assert!(!fixture.root.join("checkout").exists());
        assert!(manager.claim("next-clone").is_ok());
    }
}

#[cfg(unix)]
#[test]
fn helper_holding_stderr_after_git_exit_has_a_deadline_without_cancellation() {
    let fixture = Arc::new(Fixture::new("sleep 30 &\nexit 0"));
    let manager = RepositoryClones::default();
    let operation = manager.claim("fixture").unwrap();
    let (tx, rx) = mpsc::channel();
    let worker = {
        let fixture = fixture.clone();
        let operation = operation.clone();
        let manager = manager.clone();
        thread::spawn(move || {
            let result = {
                let _claim = Claim { manager };
                fixture.run("checkout", &operation, |_| {})
            };
            tx.send(result).unwrap();
        })
    };
    let _cleanup = wait_for_exited_git(&operation);
    let error = rx
        .recv_timeout(Duration::from_secs(5))
        .unwrap()
        .unwrap_err();
    worker.join().unwrap();
    assert_eq!(error.code, "failed");
    assert!(operation.child.lock().unwrap().is_none());
    assert!(!fixture.staging().exists());
    assert!(!fixture.root.join("checkout").exists());
    assert!(manager.claim("next-clone").is_ok());
}

#[cfg(unix)]
#[test]
fn destination_created_during_clone_is_never_overwritten_even_if_empty() {
    let fixture = Fixture::new("exit 0");
    let result = fixture.run("checkout", &Operation::default(), |progress| {
        if progress.stage == "finalizing" {
            fs::create_dir(fixture.root.join("checkout")).unwrap();
        }
    });
    assert!(result.is_err());
    assert!(fixture.root.join("checkout").is_dir());
    assert!(!fixture.staging().exists());
}
