use super::*;
use serde_json::json;
use std::io::{Read, Write};
use std::net::TcpListener;

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
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap();
    (Registry { client, base }, server)
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
