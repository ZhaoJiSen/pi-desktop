use super::*;
#[test]
fn source_targeted_update_never_updates_pi_itself() {
    assert_eq!(
        package_args("update", "npm:pi-web-access", "global").unwrap(),
        vec!["update", "npm:pi-web-access"]
    );
    assert_eq!(
        package_args("install", "npm:@a/b", "project").unwrap(),
        vec!["install", "npm:@a/b", "-l"]
    );
    assert!(package_args("update", "", "global").is_err());
    assert!(package_args("update", "self", "global").is_err());
    assert!(package_args("install", "--help", "global").is_err());
    assert!(package_args("remove", "npm:a\n", "global").is_err());
    assert!(package_args("exec", "npm:a", "global").is_err());
}

#[test]
fn npm_sources_accept_scopes_and_versions_without_allowing_path_traversal() {
    for (source, expected) in [
        ("npm:demo", "demo"),
        ("npm:demo@^1.2.0", "demo"),
        ("npm:@demo/tool", "@demo/tool"),
        ("npm:@demo/tool@latest", "@demo/tool"),
    ] {
        assert_eq!(npm_name(source), Some(expected));
    }
    for source in [
        "git:demo",
        "npm:../evil",
        "npm:@scope/..",
        "npm:demo/evil",
        "npm:demo@",
        "npm:demo@1\n",
        "npm:demo?x=1",
        "npm:@scope/tool/more",
    ] {
        assert_eq!(npm_name(source), None, "{source}");
    }
}
