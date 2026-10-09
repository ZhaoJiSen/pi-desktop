//! Build catalog queries and parse the package directory page.

use super::{client::Registry, CatalogPackage, CatalogPage, PackageInfo};
use crate::{i18n::Message, packages::npm_name};
use reqwest::Url;
use scraper::{Html, Selector};

const MAX_CATALOG_BYTES: u64 = 8_000_000;

pub(super) fn catalog_url(
    query: &str,
    sort: &str,
    category: &str,
    page: u32,
) -> Result<Url, String> {
    if query.len() > 512
        || query.chars().any(char::is_control)
        || !["downloads", "recent"].contains(&sort)
        || !["", "extension", "skill", "prompt", "theme"].contains(&category)
        || !(1..=10_000).contains(&page)
    {
        return Err(Message::PackageArguments.text());
    }
    let mut url = Url::parse("https://pi.dev/packages").map_err(|e| e.to_string())?;
    if !query.trim().is_empty() || sort != "downloads" || !category.is_empty() || page != 1 {
        let mut pairs = url.query_pairs_mut();
        if !query.trim().is_empty() {
            pairs.append_pair("name", query.trim());
        }
        if sort != "downloads" {
            pairs.append_pair("sort", sort);
        }
        if !category.is_empty() {
            pairs.append_pair("type", category);
        }
        if page != 1 {
            pairs.append_pair("page", &page.to_string());
        }
    }
    Ok(url)
}

pub(super) fn parse_catalog(html: &str, page: u32) -> Result<CatalogPage, String> {
    let document = Html::parse_document(html);
    let selector = |value| Selector::parse(value).map_err(|_| Message::PackageMetadata.text());
    // Validate the page contract, so a changed website is reported rather than a false empty list.
    if document
        .select(&selector("form.packages-action-bar")?)
        .next()
        .is_none()
    {
        return Err(Message::PackageMetadata.text());
    }
    let desc = selector(".packages-desc")?;
    let author = selector(".packages-meta span")?;
    let items = document
        .select(&selector("article[data-package-name]")?)
        .filter_map(|card| {
            let name = card.value().attr("data-package-name")?;
            if npm_name(&format!("npm:{name}")) != Some(name) {
                return None;
            }
            let resources = card
                .value()
                .attr("data-package-types")
                .unwrap_or_default()
                .split_whitespace()
                .filter_map(|kind| match kind {
                    "extension" => Some("extensions"),
                    "skill" => Some("skills"),
                    "prompt" => Some("prompts"),
                    "theme" => Some("themes"),
                    _ => None,
                })
                .map(str::to_owned)
                .collect();
            Some(CatalogPackage {
                info: PackageInfo {
                    name: name.to_owned(),
                    version: String::new(),
                    description: card
                        .select(&desc)
                        .next()
                        .map(|x| x.text().collect::<String>())
                        .unwrap_or_default(),
                    author: card
                        .select(&author)
                        .next()
                        .map(|x| x.text().collect::<String>())
                        .unwrap_or_default(),
                    license: String::new(),
                    resources,
                    newer_than: Vec::new(),
                },
                downloads: card
                    .value()
                    .attr("data-package-downloads")
                    .and_then(|x| x.parse().ok()),
                published_at: card
                    .value()
                    .attr("data-package-date")
                    .and_then(|x| x.parse().ok()),
            })
        })
        .collect();
    let has_next = document
        .select(&selector(".packages-pagination a.pagination-link")?)
        .filter_map(|a| a.value().attr("href"))
        .filter_map(|href| Url::parse("https://pi.dev").ok()?.join(href).ok())
        .any(|url| {
            url.query_pairs().any(|(key, value)| {
                key == "page" && value.parse::<u32>().ok().is_some_and(|p| p > page)
            })
        });
    Ok(CatalogPage { items, has_next })
}

impl Registry {
    pub(super) async fn browse(
        &self,
        query: &str,
        sort: &str,
        category: &str,
        page: u32,
    ) -> Result<CatalogPage, String> {
        let response = self.get(catalog_url(query, sort, category, page)?).await?;
        if response
            .content_length()
            .is_some_and(|n| n > MAX_CATALOG_BYTES)
        {
            return Err(Message::PackageMetadata.text());
        }
        let html = response
            .text()
            .await
            .map_err(|error| Message::PackageMetadata.detail(error))?;
        if html.len() as u64 > MAX_CATALOG_BYTES {
            return Err(Message::PackageMetadata.text());
        }
        parse_catalog(&html, page)
    }
}
