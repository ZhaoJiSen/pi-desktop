use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

pub(crate) struct TempDir(pub(crate) PathBuf);

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub(crate) fn temp_dir() -> TempDir {
    // Clock resolution alone can collide across concurrent test threads.
    static NEXT_DIRECTORY: AtomicU64 = AtomicU64::new(0);
    let path = std::env::temp_dir().join(format!(
        "pi-source-{}-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
        NEXT_DIRECTORY.fetch_add(1, Ordering::Relaxed)
    ));
    fs::create_dir(&path).unwrap();
    TempDir(path.canonicalize().unwrap())
}

pub(crate) fn git_ok(root: &std::path::Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{args:?}\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

pub(crate) fn init_repo(root: &std::path::Path) {
    git_ok(root, &["init", "-b", "main"]);
    git_ok(root, &["config", "user.email", "test@example.com"]);
    git_ok(root, &["config", "user.name", "Test"]);
}

// Serializes test scenarios that mutate Git, independently of the production lock.
pub(crate) static MUTATION_TEST: std::sync::Mutex<()> = std::sync::Mutex::new(());
