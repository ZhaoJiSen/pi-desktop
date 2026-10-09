//! Shared HTTP client, npm endpoints and bounded metadata batches.

use super::{
    metadata::{parse_info, parse_search},
    InstalledPackage, PackageInfo,
};
use crate::{i18n::Message, packages::npm_name};
use reqwest::{Client, Url};
use serde_json::Value;
use std::{collections::BTreeMap, sync::OnceLock, time::Duration};

#[derive(Clone)]
pub(super) struct Registry {
    pub(super) client: Client,
    pub(super) base: Url,
}

pub(super) fn redirect_policy() -> reqwest::redirect::Policy {
    reqwest::redirect::Policy::custom(|attempt| {
        if attempt.previous().len() >= 5 {
            attempt.error("too many package redirects")
        } else if attempt
            .previous()
            .first()
            .is_some_and(|original| original.origin() != attempt.url().origin())
        {
            attempt.error("package redirect changed origin")
        } else {
            attempt.follow()
        }
    })
}

impl Registry {
    pub(super) fn new() -> Result<Self, String> {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            // The official directory redirects default filters to its canonical URL.
            .redirect(redirect_policy())
            .user_agent(concat!("pi-desktop/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|error| error.to_string())?;
        let base = Url::parse("https://registry.npmjs.org/").map_err(|error| error.to_string())?;
        Ok(Self { client, base })
    }

    pub(super) async fn get(&self, url: Url) -> Result<reqwest::Response, String> {
        self.client
            .get(url)
            .send()
            .await
            .map_err(|error| Message::PackageRegistry.detail(error))?
            .error_for_status()
            .map_err(|error| Message::PackageRegistry.detail(error))
    }

    async fn read(&self, url: Url) -> Result<Value, String> {
        self.get(url)
            .await?
            .json()
            .await
            .map_err(|error| Message::PackageMetadata.detail(error))
    }

    pub(super) fn detail_url(&self, name: &str) -> Result<Url, String> {
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

    pub(super) async fn info(
        &self,
        name: &str,
        installed_versions: &[String],
    ) -> Result<PackageInfo, String> {
        let data = self.read(self.detail_url(name)?).await?;
        parse_info(&data, name, installed_versions)
    }

    pub(super) async fn discover(&self, query: &str) -> Result<Vec<PackageInfo>, String> {
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

    pub(super) async fn metadata(
        &self,
        packages: Vec<InstalledPackage>,
    ) -> Result<Vec<PackageInfo>, String> {
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

pub(super) fn registry() -> Result<&'static Registry, String> {
    static REGISTRY: OnceLock<Result<Registry, String>> = OnceLock::new();
    REGISTRY
        .get_or_init(Registry::new)
        .as_ref()
        .map_err(|error| Message::PackageRegistry.detail(error))
}
