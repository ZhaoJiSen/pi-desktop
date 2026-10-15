use crate::{i18n::Message, onboarding::resolve_executable};
use std::path::{Path, PathBuf};

pub(super) fn managed_prefix(home: &Path) -> PathBuf {
    home.join(".local/share/pi-desktop/pi-cli")
}

pub(super) fn managed_binary(home: &Path) -> PathBuf {
    managed_prefix(home).join(if cfg!(windows) {
        "node_modules/.bin/pi.cmd"
    } else {
        "node_modules/.bin/pi"
    })
}

pub(super) fn managed_owned(home: &Path) -> bool {
    std::fs::read_to_string(managed_prefix(home).join(".pi-desktop-managed"))
        .is_ok_and(|value| value == "1\n")
}

pub(super) fn prepare_directory(home: &Path) -> Result<(), String> {
    let directory = managed_prefix(home);
    if std::fs::symlink_metadata(&directory).is_ok_and(|meta| meta.file_type().is_symlink())
        || (directory.exists()
            && !managed_owned(home)
            && std::fs::read_dir(&directory)
                .map_err(|e| Message::PiInstallFailed.detail(e))?
                .next()
                .is_some())
    {
        return Err(Message::PiInstallDirectory.text());
    }
    std::fs::create_dir_all(&directory).map_err(|e| Message::PiInstallFailed.detail(e))?;
    std::fs::write(directory.join(".pi-desktop-managed"), "1\n")
        .map_err(|e| Message::PiInstallFailed.detail(e))
}

pub(super) fn discover(home: &Path) -> Option<PathBuf> {
    resolve_executable("pi", home).ok().or_else(|| {
        let path = managed_binary(home);
        path.is_file().then_some(path)
    })
}
