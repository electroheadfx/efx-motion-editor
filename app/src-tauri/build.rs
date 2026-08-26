fn main() {
    tauri_build::build();
    // 47-05 crash provenance: embed the short commit hash so UAT sessions can
    // prove which build ran (shown in the paint window title). Refreshes on
    // every crate change, which is exactly when the hash changes.
    let sha = std::process::Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".into());
    println!("cargo:rustc-env=GIT_SHA={sha}");
}
