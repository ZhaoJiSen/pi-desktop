//! npm registry access and update policy. The webview receives display-ready metadata.

use super::npm_name;
use crate::i18n::Message;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, sync::OnceLock, time::Duration};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackageInfo {
    name: String,
    version: String,
    description: String,
    author: String,
    license: String,
    resources: Vec<String>,
    newer_than: Vec<String>,
}

#[derive(Deserialize)]
pub struct InstalledPackage {
    source: String,
    version: Option<String>,
}

#[derive(Clone)]
pub struct Registry {
    client: Client,
    base: Url,
}

impl Registry {
    fn new() -> Result<Self, String> {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(concat!("pi-desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| error.to_string())?;
        let base = Url::parse("https://registry.npmjs.org/").map_err(|error| error.to_string())?;
        Ok(Self { client, base })
    }

    async fn read(&self, url: Url) -> Result<Value, String> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| Message::PackageRegistry.detail(error))?
            .error_for_status()
            .map_err(|error| Message::PackageRegistry.detail(error))?;
        response
            .json()
            .await
            .map_err(|error| Message::PackageMetadata.detail(error))
    }

    fn detail_url(&self, name: &str) -> Result<Url, String> {
        if npm_name(&format!("npm:{name}")) != Some(name) {
            return Err(Message::PackageArguments.text());
        }
        let mut url = self.base.clone();
        url.path_segments_mut()
            .map_err(|_| Message::PackageArguments.text())?
            .pop_if_empty()
            .push(name)
            .push("latest");
        Ok(url)
    }

    async fn info(&self, name: &str, installed_versions: &[String]) -> Result<PackageInfo, String> {
        let data = self.read(self.detail_url(name)?).await?;
        parse_info(&data, name, installed_versions)
    }

    async fn discover(&self, query: &str) -> Result<Vec<PackageInfo>, String> {
        if query.len() > 512 || query.chars().any(char::is_control) {
            return Err(Message::PackageArguments.text());
        }
        let mut url = self
            .base
            .join("-/v1/search")
            .map_err(|_| Message::PackageArguments.text())?;
        url.query_pairs_mut()
            .append_pair("text", &format!("keywords:pi-package {}", query.trim()))
            .append_pair("size", "40");
        let data = self.read(url).await?;
        parse_search(&data)
    }

    async fn metadata(&self, packages: Vec<InstalledPackage>) -> Result<Vec<PackageInfo>, String> {
        let mut versions = BTreeMap::<String, Vec<String>>::new();
        for package in packages {
            if let Some(name) = npm_name(&package.source) {
                let entries = versions.entry(name.to_owned()).or_default();
                if let Some(version) = package.version {
                    if !entries.contains(&version) {
                        entries.push(version);
                    }
                }
            }
        }
        let entries: Vec<_> = versions.into_iter().collect();
        let mut result = Vec::new();
        // At most three requests per batch; deduplicate names across scopes.
        for batch in entries.chunks(3) {
            let tasks: Vec<_> = batch
                .iter()
                .map(|(name, versions)| {
                    let registry = self.clone();
                    let name = name.clone();
                    let versions = versions.clone();
                    tauri::async_runtime::spawn(
                        async move { registry.info(&name, &versions).await },
                    )
                })
                .collect();
            let mut failure = None;
            for task in tasks {
                match task
                    .await
                    .map_err(|error| Message::BackgroundTask.detail(error))?
                {
                    Ok(info) => result.push(info),
                    Err(error) => {
                        failure.get_or_insert(error);
                    }
                }
            }
            if let Some(error) = failure {
                return Err(error);
            }
        }
        Ok(result)
    }
}

fn registry() -> Result<&'static Registry, String> {
    static REGISTRY: OnceLock<Result<Registry, String>> = OnceLock::new();
    REGISTRY
        .get_or_init(Registry::new)
        .as_ref()
        .map_err(|error| Message::PackageRegistry.detail(error))
}

fn text(value: &Value) -> String {
    value.as_str().unwrap_or_default().to_owned()
}

fn has_update(installed: &str, latest: &str) -> bool {
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

fn parse_info(
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

fn parse_search(data: &Value) -> Result<Vec<PackageInfo>, String> {
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

#[tauri::command]
pub async fn package_info(
    name: String,
    installed_versions: Vec<String>,
) -> Result<PackageInfo, String> {
    registry()?.info(&name, &installed_versions).await
}

#[tauri::command]
pub async fn discover_packages(query: String) -> Result<Vec<PackageInfo>, String> {
    registry()?.discover(&query).await
}

#[tauri::command]
pub async fn extension_package_metadata(
    packages: Vec<InstalledPackage>,
) -> Result<Vec<PackageInfo>, String> {
    registry()?.metadata(packages).await
}

#[cfg(test)]
#[path = "../../tests/packages/registry/tests.rs"]
mod tests;
