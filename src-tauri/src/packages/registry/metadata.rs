//! Normalize npm metadata and determine stable version updates.

use super::PackageInfo;
use crate::{i18n::Message, packages::npm_name};
use serde_json::Value;

fn text(value: &Value) -> String {
    value.as_str().unwrap_or_default().to_owned()
}

pub(super) fn has_update(installed: &str, latest: &str) -> bool {
    let stable = |value: &str| {
        semver::Version::parse(value)
            .ok()
            .filter(|version| version.pre.is_empty() && version.build.is_empty())
    };
    match (stable(installed), stable(latest)) {
        (Some(installed), Some(latest)) => latest > installed,
        _ => false,
    }
}

pub(super) fn parse_info(
    data: &Value,
    name: &str,
    installed_versions: &[String],
) -> Result<PackageInfo, String> {
    if data["name"].as_str() != Some(name) || data["version"].as_str().is_none() {
        return Err(Message::PackageMetadata.text());
    }
    let version = text(&data["version"]);
    Ok(PackageInfo {
        name: name.to_owned(),
        newer_than: installed_versions
            .iter()
            .filter(|installed| has_update(installed, &version))
            .cloned()
            .collect(),
        version,
        description: text(&data["description"]),
        author: if data["author"].is_string() {
            text(&data["author"])
        } else {
            text(&data["author"]["name"])
        },
        license: text(&data["license"]),
        resources: ["extensions", "skills", "prompts", "themes"]
            .into_iter()
            .filter(|key| {
                data["pi"][key]
                    .as_array()
                    .is_some_and(|entries| !entries.is_empty())
            })
            .map(str::to_owned)
            .collect(),
    })
}

pub(super) fn parse_search(data: &Value) -> Result<Vec<PackageInfo>, String> {
    let objects = data["objects"]
        .as_array()
        .ok_or_else(|| Message::PackageMetadata.text())?;
    Ok(objects
        .iter()
        .filter_map(|item| {
            let package = &item["package"];
            let name = package["name"].as_str()?;
            if npm_name(&format!("npm:{name}")) != Some(name) {
                return None;
            }
            Some(PackageInfo {
                name: name.to_owned(),
                version: text(&package["version"]),
                description: text(&package["description"]),
                author: text(&package["publisher"]["username"]),
                license: String::new(),
                resources: Vec::new(),
                newer_than: Vec::new(),
            })
        })
        .collect())
}
