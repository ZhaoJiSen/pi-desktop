use std::{io::Read, sync::mpsc};

pub(super) fn progress_line(line: &str) -> Option<(&'static str, Option<u8>)> {
    let stage = if line.contains("Receiving objects:") {
        "receiving"
    } else if line.contains("Resolving deltas:") {
        "resolving"
    } else if line.contains("Updating files:") || line.contains("Checking out files:") {
        "checkout"
    } else {
        return None;
    };
    let percent = line
        .split('%')
        .next()?
        .split_whitespace()
        .last()?
        .parse::<u8>()
        .ok()
        .filter(|p| *p <= 100);
    Some((stage, percent))
}

pub(super) fn read_progress(
    mut stream: impl Read,
    tx: mpsc::SyncSender<(&'static str, Option<u8>)>,
) -> String {
    let mut chunk = [0; 1024];
    let mut line = Vec::new();
    let mut tail = Vec::new();
    while let Ok(count) = stream.read(&mut chunk) {
        if count == 0 {
            break;
        }
        tail.extend_from_slice(&chunk[..count]);
        if tail.len() > 16384 {
            tail.drain(..tail.len() - 16384);
        }
        for byte in &chunk[..count] {
            if *byte == b'\r' || *byte == b'\n' {
                if let Some(event) = progress_line(&String::from_utf8_lossy(&line)) {
                    let _ = tx.try_send(event);
                }
                line.clear();
            } else if line.len() < 4096 {
                line.push(*byte);
            }
        }
    }
    String::from_utf8_lossy(&tail).into_owned()
}

pub(super) fn failure_code(stderr: &str) -> &'static str {
    let output = stderr.to_ascii_lowercase();
    if output.contains("authentication")
        || output.contains("permission denied")
        || output.contains("could not read username")
        || output.contains("host key verification")
    {
        "auth"
    } else if output.contains("not found") || output.contains("does not exist") {
        "notFound"
    } else if output.contains("could not resolve")
        || output.contains("failed to connect")
        || output.contains("timed out")
        || output.contains("ssl")
        || output.contains("connection")
    {
        "network"
    } else {
        "failed"
    }
}
