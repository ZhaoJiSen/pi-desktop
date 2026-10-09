use super::*;

#[test]
#[ignore = "requires isolated Pi CLI 1.0.0; see docs/implementation/pi-v1-compatibility.md"]
fn installed_pi_v1_builtin_catalog() {
    let root =
        PathBuf::from(std::env::var("PI_DESKTOP_PI_V1_ROOT").expect("Pi CLI 1.0.0 package root"));
    let manifest: Value =
        serde_json::from_str(&std::fs::read_to_string(root.join("package.json")).unwrap()).unwrap();
    assert_eq!(manifest["version"], "1.0.0");
    let catalog = read_catalog(&root).expect("read actual installed Pi command definitions");
    assert_eq!(catalog.len(), 24);
    assert!(catalog.iter().all(|command| command["source"] == "builtin"));
    for name in ["compact", "tree", "quit", "reload", "session"] {
        assert!(catalog.iter().any(|command| command["name"] == name));
    }
    let model = catalog
        .iter()
        .find(|command| command["name"] == "model")
        .unwrap();
    assert_eq!(model["argumentHint"], "<provider/model>");
}

#[test]
fn reads_quoted_fields_without_executing_code() {
    let line =
        r#"{ name: "model", description: "Select \"model\"", argumentHint: "<provider/model>" },"#;
    assert_eq!(quoted_field(line, "name").as_deref(), Some("model"));
    assert_eq!(
        quoted_field(line, "description").as_deref(),
        Some("Select \"model\"")
    );
    assert_eq!(
        quoted_field("description: `dynamic ${value}`", "description"),
        None
    );
}

#[test]
fn reads_only_an_installed_official_catalog_and_preserves_argument_hint() {
    let root = std::env::temp_dir().join(format!("pi-command-test-{}", std::process::id()));
    std::fs::create_dir_all(root.join("dist/core")).unwrap();
    let path = root.join("dist/core/slash-commands.js");
    std::fs::write(
        &path,
        r#"export const BUILTIN_SLASH_COMMANDS = [
    { name: "model", description: "Select model", argumentHint: "<provider/model>" },
    { name: "compact", description: "Compact context" },
];"#,
    )
    .unwrap();
    let catalog = read_catalog(&root).unwrap();
    assert_eq!(catalog.len(), 2);
    assert_eq!(catalog[0]["source"], "builtin");
    assert_eq!(catalog[0]["argumentHint"], "<provider/model>");
    std::fs::write(&path, "export const OTHER = [];").unwrap();
    assert!(read_catalog(&root).is_none());
    std::fs::remove_dir_all(root).unwrap();
}
