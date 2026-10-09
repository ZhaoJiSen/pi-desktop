use super::catalog::{catalog_url, parse_catalog};
use super::client::{redirect_policy, Registry};
use super::metadata::{has_update, parse_info, parse_search};
use reqwest::{Client, Url};
use serde_json::json;
use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::time::Duration;

fn fixture(status: &str, body: &str) -> (Registry, std::thread::JoinHandle<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
    let reply = format!("HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
    let server = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        let mut buffer = [0; 1024];
        while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
            let read = socket.read(&mut buffer).unwrap();
            if read == 0 {
                break;
            }
            request.extend_from_slice(&buffer[..read]);
        }
        socket.write_all(reply.as_bytes()).unwrap();
        String::from_utf8(request).unwrap()
    });
    let client = Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(5))
        .redirect(redirect_policy())
        .build()
        .unwrap();
    (Registry { client, base }, server)
}

fn redirect_fixture(
    location: &str,
    redirects: usize,
    body: Option<&str>,
) -> (Registry, std::thread::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let base = Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
    let registry = Registry {
        client: Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .redirect(redirect_policy())
            .build()
            .unwrap(),
        base,
    };
    let location = location.to_owned();
    let body = body.map(str::to_owned);
    let server = std::thread::spawn(move || {
        let mut requests = Vec::new();
        let started = std::time::Instant::now();
        for index in 0..redirects + usize::from(body.is_some()) {
            let (mut socket, _) = loop {
                match listener.accept() {
                    Ok(connection) => break connection,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        if started.elapsed() >= Duration::from_secs(5) {
                            return requests;
                        }
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    Err(error) => panic!("{error}"),
                }
            };
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 1024];
            while !request.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
                let read = socket.read(&mut buffer).unwrap();
                if read == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..read]);
            }
            let reply = if index < redirects {
                format!("HTTP/1.1 302 Found\r\nLocation: {location}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
            } else {
                let body = body.as_deref().unwrap();
                format!("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len())
            };
            socket.write_all(reply.as_bytes()).unwrap();
            requests.push(String::from_utf8(request).unwrap());
        }
        requests
    });
    (registry, server)
}

#[test]
fn catalog_follows_same_origin_canonical_redirects_before_parsing() {
    let html = r#"<form class="packages-action-bar"></form>
        <article data-package-name="pi-zentui"><p class="packages-desc">Terminal UI</p></article>"#;
    let (registry, server) = redirect_fixture("/packages", 1, Some(html));
    let response = tauri::async_runtime::block_on(async {
        registry
            .get(
                registry
                    .base
                    .join("packages?sort=downloads&page=1")
                    .unwrap(),
            )
            .await
            .unwrap()
            .text()
            .await
            .unwrap()
    });
    let page = parse_catalog(&response, 1).unwrap();
    assert_eq!(page.items[0].info.name, "pi-zentui");
    let requests = server.join().unwrap();
    assert_eq!(requests.len(), 2);
    assert!(requests[1].starts_with("GET /packages HTTP/1.1"));
}

#[test]
fn registry_rejects_cross_origin_redirects_and_redirect_loops() {
    for (location, redirects) in [("https://example.invalid/packages", 1), ("/packages", 5)] {
        let (registry, server) = redirect_fixture(location, redirects, None);
        let result =
            tauri::async_runtime::block_on(registry.get(registry.base.join("packages").unwrap()));
        assert!(result.is_err());
        assert_eq!(server.join().unwrap().len(), redirects);
    }
}

#[test]
fn stable_updates_do_not_include_downgrades_pins_or_prereleases() {
    assert!(has_update("1.9.0", "1.10.0"));
    assert!(has_update("1.0.0", "2.0.0"));
    for (installed, latest) in [
        ("2.0.0", "1.9.0"),
        ("1.0.0", "1.0.0"),
        ("1.0.0-beta.1", "1.0.0"),
        ("1.0.0", "2.0.0-beta.1"),
        ("1.0.0+build.1", "2.0.0"),
        ("01.0.0", "2.0.0"),
        ("latest", "2.0.0"),
        ("", "2.0.0"),
    ] {
        assert!(!has_update(installed, latest), "{installed} -> {latest}");
    }
}

#[test]
fn metadata_normalizes_author_resources_and_versions_across_scopes() {
    let data = json!({"name":"@demo/tool", "version":"2.0.0", "author":{"name":"Author"},
        "pi":{"extensions":["index.ts"],"skills":[],"themes":["theme.json"]}});
    let info = parse_info(
        &data,
        "@demo/tool",
        &["1.0.0".into(), "2.0.0".into(), "3.0.0".into()],
    )
    .unwrap();
    assert_eq!(
        serde_json::to_value(info).unwrap(),
        json!({
            "name":"@demo/tool", "version":"2.0.0", "description":"", "author":"Author", "license":"",
            "resources":["extensions","themes"], "newerThan":["1.0.0"]
        })
    );
    assert_eq!(
        parse_info(
            &json!({"name":"demo", "version":"1.0.0", "author":"Person"}),
            "demo",
            &[]
        )
        .unwrap()
        .author,
        "Person"
    );
}

#[test]
fn malformed_or_mismatched_registry_data_is_an_error() {
    for data in [
        json!(null),
        json!({"name":"wrong","version":"1.0.0"}),
        json!({"name":"demo"}),
    ] {
        assert!(parse_info(&data, "demo", &[]).is_err());
    }
    assert!(parse_search(&json!({"error":"not found"})).is_err());
}

#[test]
fn search_discards_unusable_package_names() {
    let result = parse_search(&json!({"objects":[
        {"package":{"name":"@demo/tool", "version":"1.0.0", "publisher":{"username":"Author"}}},
        {"package":{"name":"../evil"}}, {"package":{"name":"https://example.com"}}, {}
    ]}))
    .unwrap();
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].name, "@demo/tool");
    assert_eq!(result[0].author, "Author");
}

#[test]
fn native_detail_request_encodes_scoped_names_and_returns_update_flags() {
    let (registry, server) = fixture("200 OK", r#"{"name":"@demo/tool","version":"2.0.0"}"#);
    let info =
        tauri::async_runtime::block_on(registry.info("@demo/tool", &["1.0.0".into()])).unwrap();
    assert_eq!(info.newer_than, vec!["1.0.0"]);
    assert!(server
        .join()
        .unwrap()
        .starts_with("GET /@demo%2Ftool/latest HTTP/1.1"));
}

#[test]
fn native_search_encodes_the_query_without_injecting_parameters() {
    let (registry, server) = fixture("200 OK", r#"{"objects":[]}"#);
    tauri::async_runtime::block_on(registry.discover("tool &size=999")).unwrap();
    let request = server.join().unwrap();
    assert!(request.starts_with(
        "GET /-/v1/search?text=keywords%3Api-package+tool+%26size%3D999&size=40 HTTP/1.1"
    ));
}

#[test]
fn native_registry_propagates_http_errors_and_invalid_json() {
    for (status, body) in [
        ("404 Not Found", r#"{"error":"missing"}"#),
        ("200 OK", "invalid json"),
    ] {
        let (registry, server) = fixture(status, body);
        assert!(tauri::async_runtime::block_on(registry.info("demo", &[])).is_err());
        server.join().unwrap();
    }
}

#[test]
fn detail_request_refuses_sources_that_are_not_bare_npm_names() {
    let registry = Registry::new().unwrap();
    for name in [
        "demo@1.0.0",
        "../evil",
        "@demo/../evil",
        "https://example.com",
        "demo?x=1",
    ] {
        assert!(registry.detail_url(name).is_err(), "{name}");
    }
}

#[test]
fn batch_metadata_fetches_each_npm_name_once_across_scopes() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let registry = Registry {
        client: Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(5))
            .build()
            .unwrap(),
        base: Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap(),
    };
    let server = std::thread::spawn(move || {
        let started = std::time::Instant::now();
        let mut requests = Vec::new();
        while requests.len() < 2 && started.elapsed() < Duration::from_secs(5) {
            let (mut socket, _) = match listener.accept() {
                Ok(connection) => connection,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(5));
                    continue;
                }
                Err(error) => panic!("{error}"),
            };
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut buffer = [0; 4096];
            let length = socket.read(&mut buffer).unwrap();
            let request = String::from_utf8_lossy(&buffer[..length]).to_string();
            let name = if request.starts_with("GET /demo/") {
                "demo"
            } else {
                "other"
            };
            let body = json!({"name":name,"version":"2.0.0"}).to_string();
            let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
            socket.write_all(reply.as_bytes()).unwrap();
            requests.push(request);
        }
        requests
    });
    let packages = serde_json::from_value(json!([
        {"source":"npm:demo","scope":"global","version":"1.0.0"},
        {"source":"npm:demo@2.0.0","scope":"project","version":"2.0.0"},
        {"source":"git:github.com/demo/other","scope":"global"},
        {"source":"npm:other","scope":"global","version":"0.9.0"}
    ]))
    .unwrap();
    let info = tauri::async_runtime::block_on(registry.metadata(packages)).unwrap();
    assert_eq!(server.join().unwrap().len(), 2);
    assert_eq!(
        info.iter()
            .map(|item| item.name.as_str())
            .collect::<Vec<_>>(),
        vec!["demo", "other"]
    );
    assert_eq!(info[0].newer_than, vec!["1.0.0"]);
    assert_eq!(info[1].newer_than, vec!["0.9.0"]);
}

#[test]
fn catalog_uses_official_filters_and_encodes_search() {
    assert_eq!(
        catalog_url("  ", "downloads", "", 1).unwrap().as_str(),
        "https://pi.dev/packages"
    );
    assert_eq!(
        catalog_url("", "downloads", "", 2).unwrap().as_str(),
        "https://pi.dev/packages?page=2"
    );
    let url = catalog_url("mcp &page=999", "recent", "skill", 2).unwrap();
    assert_eq!(url.host_str(), Some("pi.dev"));
    let pairs: BTreeMap<_, _> = url.query_pairs().into_owned().collect();
    assert_eq!(pairs.get("name").unwrap(), "mcp &page=999");
    assert_eq!(pairs.get("sort").unwrap(), "recent");
    assert_eq!(pairs.get("type").unwrap(), "skill");
    assert_eq!(pairs.get("page").unwrap(), "2");
    for (sort, category, page) in [("bad", "", 1), ("downloads", "bad", 1), ("recent", "", 0)] {
        assert!(catalog_url("", sort, category, page).is_err());
    }
}

#[test]
fn catalog_preserves_real_downloads_dates_and_resource_types() {
    let html = r#"<form class="packages-action-bar"></form>
    <article data-package-name="@demo/tool" data-package-downloads="12500" data-package-date="1791525331718" data-package-types="extension skill">
      <p class="packages-desc">Tools &amp; skills</p><div class="packages-meta"><span>Alice</span><span>12.5K/mo</span></div>
    </article>
    <article data-package-name="../evil"></article>
    <nav class="packages-pagination"><a class="pagination-link" href="/packages?sort=recent&amp;page=2">Next</a></nav>"#;
    let page = parse_catalog(html, 1).unwrap();
    assert!(page.has_next);
    assert_eq!(page.items.len(), 1);
    let pkg = &page.items[0];
    assert_eq!(pkg.info.name, "@demo/tool");
    assert_eq!(pkg.info.description, "Tools & skills");
    assert_eq!(pkg.info.author, "Alice");
    assert_eq!(pkg.downloads, Some(12500));
    assert_eq!(pkg.published_at, Some(1791525331718));
    assert_eq!(pkg.info.resources, ["extensions", "skills"]);
    assert!(!parse_catalog(html, 2).unwrap().has_next);
}

#[test]
fn catalog_rejects_changed_html_but_accepts_genuine_empty_results() {
    assert!(parse_catalog("<html><body>Service unavailable</body></html>", 1).is_err());
    let page = parse_catalog("<form class=\"packages-action-bar\"></form>", 1).unwrap();
    assert!(page.items.is_empty());
    assert!(!page.has_next);
}
