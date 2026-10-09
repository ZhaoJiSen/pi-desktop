//! Package commands and display-ready types shared by npm and the catalog.

mod catalog;
mod client;
mod metadata;

use client::registry;
use serde::{Deserialize, Serialize};

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPackage {
    #[serde(flatten)]
    info: PackageInfo,
    downloads: Option<u64>,
    published_at: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogPage {
    items: Vec<CatalogPackage>,
    has_next: bool,
}

#[tauri::command]
pub async fn browse_extension_catalog(
    query: String,
    sort: String,
    category: String,
    page: u32,
) -> Result<CatalogPage, String> {
    registry()?.browse(&query, &sort, &category, page).await
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
