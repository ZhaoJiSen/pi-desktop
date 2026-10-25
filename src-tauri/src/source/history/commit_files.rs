use super::*;

fn parse_name_status(bytes: &[u8]) -> Vec<CommitFile> {
    let parts: Vec<&[u8]> = bytes
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .collect();
    let mut index = 0;
    let mut files = Vec::new();
    while index < parts.len() {
        let status = String::from_utf8_lossy(parts[index]);
        index += 1;
        let code = status.chars().next().unwrap_or('M');
        if code == 'R' || code == 'C' {
            if index + 1 >= parts.len() {
                break;
            }
            let old_path = String::from_utf8_lossy(parts[index]).replace('\\', "/");
            let path = String::from_utf8_lossy(parts[index + 1]).replace('\\', "/");
            index += 2;
            files.push(CommitFile {
                path,
                code: code.to_string(),
                old_path: Some(old_path),
            });
            continue;
        }
        if index >= parts.len() {
            break;
        }
        let path = String::from_utf8_lossy(parts[index]).replace('\\', "/");
        index += 1;
        files.push(CommitFile {
            path,
            code: code.to_string(),
            old_path: None,
        });
    }
    files
}

pub(crate) fn commit_files(root: &Path, revision: &str) -> Result<GitCommitDetail, String> {
    if !git::valid_revision(revision) {
        return Err(Message::GitRead.text());
    }
    let hash = revision.to_owned();
    match git::presence(root)? {
        git::GitPresence::Missing => {
            return Ok(GitCommitDetail {
                available: false,
                repo: false,
                hash,
                files: Vec::new(),
            });
        }
        git::GitPresence::Plain => {
            return Ok(GitCommitDetail {
                available: true,
                repo: false,
                hash,
                files: Vec::new(),
            });
        }
        git::GitPresence::Repo => {}
    }
    let captured = git::run(
        root,
        &[
            "show",
            "--no-ext-diff",
            "--no-textconv",
            "--name-status",
            "--format=",
            "-z",
            "--first-parent",
            "--find-renames",
            "--relative",
            revision,
            "--",
            ".",
        ],
        git::LIMIT_LOG,
    )?;
    if !captured.success && !captured.truncated {
        return Err(Message::GitRead.detail(String::from_utf8_lossy(&captured.stderr).trim()));
    }
    Ok(GitCommitDetail {
        available: true,
        repo: true,
        hash,
        files: parse_name_status(git::drop_partial_z(&captured.stdout, captured.truncated)),
    })
}
