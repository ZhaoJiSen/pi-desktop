#[cfg(target_os = "macos")]
fn mac_permission(request: bool) -> Result<&'static str, String> {
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSBundle, NSError};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNAuthorizationStatus, UNNotificationSettings,
        UNUserNotificationCenter,
    };
    use std::{ptr::NonNull, sync::mpsc, time::Duration};
    // UNUserNotificationCenter throws for an unbundled development executable.
    // Do not report the Terminal app's notification permission as our own.
    if NSBundle::mainBundle().bundleIdentifier().is_none() {
        return Ok("unavailable");
    }
    let center = UNUserNotificationCenter::currentNotificationCenter();
    if request {
        let (send, receive) = mpsc::channel();
        let callback = RcBlock::new(move |granted: Bool, error: *mut NSError| {
            let result = if error.is_null() {
                Ok(if granted.as_bool() {
                    "granted"
                } else {
                    "denied"
                })
            } else {
                Err("Unable to request notification authorization".to_owned())
            };
            let _ = send.send(result);
        });
        center.requestAuthorizationWithOptions_completionHandler(
            UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound,
            &callback,
        );
        return receive
            .recv_timeout(Duration::from_secs(120))
            .map_err(|e| e.to_string())?;
    }
    let (send, receive) = mpsc::channel();
    let callback = RcBlock::new(move |settings: NonNull<UNNotificationSettings>| {
        // Apple's completion handler supplies a live, non-null settings object.
        let status = unsafe { settings.as_ref() }.authorizationStatus();
        let permission = match status {
            UNAuthorizationStatus::Authorized
            | UNAuthorizationStatus::Provisional
            | UNAuthorizationStatus::Ephemeral => "granted",
            UNAuthorizationStatus::Denied => "denied",
            _ => "default",
        };
        let _ = send.send(permission);
    });
    center.getNotificationSettingsWithCompletionHandler(&callback);
    receive
        .recv_timeout(Duration::from_secs(10))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn notification_permission(request: bool) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    return tauri::async_runtime::spawn_blocking(move || {
        mac_permission(request).map(|value| Some(value.to_owned()))
    })
    .await
    .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = request;
        Ok(None)
    }
}

#[tauri::command]
pub async fn open_notification_settings(app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "macos")]
        let status = std::process::Command::new("open")
            .arg(format!(
                "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id={}",
                app.config().identifier
            ))
            .status();
        #[cfg(target_os = "windows")]
        let status = {
            let _ = app;
            std::process::Command::new("cmd")
                .args(["/C", "start", "", "ms-settings:notifications"])
                .status()
        };
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            let _ = app;
            return Err("Open notification preferences in your system settings".to_owned());
        }
        #[cfg(any(target_os = "macos", target_os = "windows"))]
        status.map_err(|e| e.to_string()).and_then(|status| {
            if status.success() {
                Ok(())
            } else {
                Err("Unable to open system notification settings".to_owned())
            }
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
