use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFont {
    pub family: String,
    pub monospace: bool,
}

#[cfg(target_os = "macos")]
pub fn system_fonts() -> Vec<SystemFont> {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2_foundation::{NSArray, NSString};
    use std::ffi::c_void;

    // CTFontManagerCopyAvailableFontFamilyNames returns a +1 CFArray of family names.
    #[link(name = "CoreText", kind = "framework")]
    unsafe extern "C" {
        fn CTFontManagerCopyAvailableFontFamilyNames() -> *mut NSArray<NSString>;
        fn CTFontCreateWithName(
            name: *const NSString,
            size: f64,
            matrix: *const c_void,
        ) -> *mut AnyObject;
        fn CTFontGetSymbolicTraits(font: *mut AnyObject) -> u32;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        fn CFRelease(cf: *const c_void);
    }

    const MONOSPACE: u32 = 1 << 10;

    unsafe {
        let raw = CTFontManagerCopyAvailableFontFamilyNames();
        let Some(families) = Retained::from_raw(raw) else {
            return Vec::new();
        };
        let mut fonts = Vec::with_capacity(families.count());
        for index in 0..families.count() {
            let name = families.objectAtIndex(index);
            let family = name.to_string();
            if family.is_empty() || family.starts_with('.') || family == "LastResort" {
                continue;
            }
            let face = CTFontCreateWithName(&*name, 12.0, std::ptr::null());
            let monospace = if face.is_null() {
                false
            } else {
                let traits = CTFontGetSymbolicTraits(face);
                CFRelease(face.cast());
                traits & MONOSPACE != 0
            };
            fonts.push(SystemFont { family, monospace });
        }
        fonts.sort_by_cached_key(|font| font.family.to_lowercase());
        fonts.dedup_by(|left, right| left.family == right.family);
        fonts
    }
}

#[cfg(not(target_os = "macos"))]
pub fn system_fonts() -> Vec<SystemFont> {
    Vec::new()
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::system_fonts;

    #[test]
    fn separates_installed_monospace_faces() {
        let fonts = system_fonts();
        let menlo = fonts.iter().find(|font| font.family == "Menlo");
        assert!(menlo.is_some_and(|font| font.monospace), "{fonts:?}");
        assert!(
            fonts
                .iter()
                .any(|font| font.family == "PingFang SC" && !font.monospace),
            "{fonts:?}"
        );
    }
}
