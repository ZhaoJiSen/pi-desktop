//! Ship the bridge with the app rather than modifying installed Pi packages.
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT_WRITE: AtomicU64 = AtomicU64::new(0);

pub(super) fn extension_path(home: &Path) -> Result<PathBuf, String> {
    const SOURCE: &str = include_str!("../../bridge/desktop-bridge.mjs");
    let mut hash = DefaultHasher::new();
    SOURCE.hash(&mut hash);
    let dir = home.join(".cache/pi-desktop/bridge");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(format!("desktop-bridge-{:x}.mjs", hash.finish()));
    if std::fs::read_to_string(&path).ok().as_deref() != Some(SOURCE) {
        let temporary = dir.join(format!(
            "bridge-{}-{}.tmp",
            std::process::id(),
            NEXT_WRITE.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::write(&temporary, SOURCE).map_err(|e| e.to_string())?;
        std::fs::rename(&temporary, &path).map_err(|e| e.to_string())?;
    }
    Ok(path)
}
