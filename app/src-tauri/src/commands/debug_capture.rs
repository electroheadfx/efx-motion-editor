/// Fixed on-disk path for the physics-paint stall-diagnosis capture (debug
/// telemetry, session 2026-09-11). A fixed path lets the diagnosis read the
/// metrics back from disk instead of a manual console copy.
const STALL_CAPTURE_PATH: &str = "/tmp/efx-stall-capture.json";

/// Write a stall-diagnosis capture payload to disk and return the path. An
/// optional name suffixes the file (`efx-stall-capture-{name}.json`) so the
/// Studio and main windows can dump without clobbering each other.
#[tauri::command(async)]
pub fn write_debug_capture(contents: String, name: Option<String>) -> Result<String, String> {
    let path = match name.as_deref() {
        None => STALL_CAPTURE_PATH.to_string(),
        Some(value)
            if !value.is_empty()
                && value
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') =>
        {
            format!("/tmp/efx-stall-capture-{value}.json")
        }
        Some(_) => return Err("write_debug_capture: name must match [a-z0-9-]+".to_string()),
    };
    std::fs::write(&path, contents).map_err(|error| format!("write_debug_capture: {error}"))?;
    Ok(path)
}
