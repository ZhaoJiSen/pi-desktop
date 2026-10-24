//! Serialized project and Git results.

use serde::Serialize;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) kind: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub(crate) entries: Vec<DirectoryEntry>,
    pub(crate) truncated: bool,
    pub(crate) ignore_partial: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub(crate) path: String,
    pub(crate) binary: bool,
    pub(crate) truncated: bool,
    pub(crate) size: u64,
    pub(crate) text: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSearch {
    pub(crate) files: Vec<String>,
    pub(crate) truncated: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub(crate) path: String,
    pub(crate) code: String,
    pub(crate) staged: bool,
    pub(crate) unstaged: bool,
    #[serde(default)]
    pub(crate) additions: u32,
    #[serde(default)]
    pub(crate) deletions: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) old_path: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub(crate) available: bool,
    pub(crate) repo: bool,
    pub(crate) branch: Option<String>,
    pub(crate) files: Vec<GitFileStatus>,
    pub(crate) truncated: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitDiff {
    pub(crate) available: bool,
    pub(crate) repo: bool,
    pub(crate) path: String,
    pub(crate) binary: bool,
    pub(crate) truncated: bool,
    pub(crate) missing: bool,
    pub(crate) text: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub(crate) hash: String,
    pub(crate) parents: Vec<String>,
    pub(crate) author: String,
    pub(crate) timestamp: i64,
    pub(crate) refs: String,
    pub(crate) subject: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitLog {
    pub(crate) available: bool,
    pub(crate) repo: bool,
    pub(crate) commits: Vec<GitCommit>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommitFile {
    pub(crate) path: String,
    pub(crate) code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) old_path: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitDetail {
    pub(crate) available: bool,
    pub(crate) repo: bool,
    pub(crate) hash: String,
    pub(crate) files: Vec<CommitFile>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub(crate) name: String,
    pub(crate) tip: String,
    pub(crate) remote: bool,
    pub(crate) current: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitLogPage {
    pub(crate) available: bool,
    pub(crate) repo: bool,
    pub(crate) commits: Vec<GitCommit>,
    pub(crate) has_more: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHeadLocation {
    pub(crate) head: Option<String>,
    pub(crate) offset: u32,
    pub(crate) page: GitLogPage,
}
