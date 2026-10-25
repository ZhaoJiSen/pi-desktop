# Desktop app updates

The Rust `tauri-plugin-updater` checks GitHub Releases once per app launch. It reads
`https://github.com/ZhaoJiSen/pi-desktop/releases/latest/download/latest.json`.
Startup is never blocked by the check. No update, an offline device or a missing
release leaves the update button hidden. A check failure can be retried on the next
launch. This updates pi Desktop; the separate Pi CLI update flow is unchanged.

The upper-right update button appears on workspace pages only when a newer release
is available. Download runs in the background and verifies the update signature.
The user chooses when to restart and install. The panel shows the latest release
notes in a bounded scroll area. A progress ring surrounds the top-bar update button
and remains visible when the panel is collapsed. The panel footer shows the download
percentage; transferred bytes appear on hover and in the accessible progress text.
Unknown sizes and signature verification use an indeterminate ring. Native checks prevent restarting
while any Pi session is busy. Failed downloads and installations can be retried.
Installation also holds the extension-package operation lock through restart, so
an active package install/update delays the app update without losing its download.
Before installation, the current workspace snapshot is saved again; a failed save
blocks restart, and retrying after storage recovers clears the old error.
Downloaded bytes live in memory for this app launch, survive a webview reload,
and are discarded when quitting. The plugin downloads the full updater bundle.

Development/debug builds skip the check and reject both download and install
commands. On macOS, release executables must run inside an `.app/Contents/MacOS`
bundle; an unbundled binary in `target/release` cannot update its parent directory.

## Signing key and GitHub setup

A signing key was generated locally in `.secrets.local/updater.key` with public key
`.secrets.local/updater.key.pub`. The directory is excluded by the existing
`*.local` Git ignore rule. The matching public key is committed in
`src-tauri/tauri.conf.json`. Back up the private key securely and keep using this
same key for future releases. Do not regenerate it for every release.

Before running the GitHub `build` workflow, configure the repository Actions secret
`TAURI_SIGNING_PRIVATE_KEY` with the complete contents of the local private key file.
The generated key has an empty password, so `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
can be left unset. If replacing the key with a password-protected key, configure
that secret too and update the application's public key before distributing it.
Never commit the private key or paste it into a chat.

The existing build workflow produces a universal macOS DMG, `.app.tar.gz` updater
bundle and `.sig`. The publish script validates that signed updater artifacts are
present and creates `latest.json` with `darwin-aarch64` and `darwin-x86_64` entries
pointing at the universal bundle. Release notes are generated once with the GitHub API, included in `latest.json`,
and used as the GitHub Release body. A reviewed `docs/releases/<version>.md` takes
precedence over automatic notes; the same text is used in both places. Empty reviewed
notes stop publication. All four release assets are published together. Prereleases
remain outside the stable `latest` channel. This pipeline currently targets macOS;
Windows/Linux release artifacts and manifest entries are not configured.

For a local signed build (from the repository root):

```sh
TAURI_SIGNING_PRIVATE_KEY="$(cat .secrets.local/updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD='' pnpm package:mac
```

Use a publicly downloadable release repository. A private GitHub repository will
require a separate authenticated distribution design; never embed a GitHub token
in the app. Existing app versions without the updater need a manual upgrade once.

## Verification

The status reader subscribes before taking its initial snapshot and uses revisions
to avoid stale responses overriding download events. Checking/download/install all
run natively, so webview reloads do not repeat the launch check or lose a download.
End-to-end replacement must be verified between two installed signed releases;
unit tests and a browser preview do not perform a real application replacement.
