use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Default)]
struct BuilderConfig {
    #[serde(default)]
    theme: Option<String>,
    #[serde(default)]
    canvas_bg: Option<HashMap<String, String>>,
}

/// Returns the path to ~/.config/efx-motion/builder-config.yaml.
/// Uses $HOME directly to avoid dirs crate mapping to ~/Library/Application Support on macOS.
fn config_path() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
        .join(".config/efx-motion/builder-config.yaml")
}

fn default_canvas_bg() -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert("dark".into(), "#1A1A1A".into());
    map.insert("medium".into(), "#2E2E2E".into());
    map.insert("light".into(), "#3A3A3A".into());
    map
}

/// Reads the YAML config file, returning Default on any error (missing file, parse error).
/// Populates canvas_bg defaults on first run and persists them.
fn read_config() -> BuilderConfig {
    let path = config_path();
    let mut config: BuilderConfig = if !path.exists() {
        BuilderConfig::default()
    } else {
        match std::fs::read_to_string(&path) {
            Ok(contents) => serde_yaml::from_str(&contents).unwrap_or_default(),
            Err(_) => BuilderConfig::default(),
        }
    };
    if config.canvas_bg.is_none() {
        config.canvas_bg = Some(default_canvas_bg());
        let _ = write_config(&config);
    }
    config
}

/// Writes the config to YAML atomically (write to .tmp then rename).
/// Creates parent directories if needed.
fn write_config(config: &BuilderConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }
    let yaml =
        serde_yaml::to_string(config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    let tmp_path = path.with_extension("yaml.tmp");
    std::fs::write(&tmp_path, &yaml)
        .map_err(|e| format!("Failed to write config temp file: {e}"))?;
    std::fs::rename(&tmp_path, &path)
        .map_err(|e| format!("Failed to rename config temp file: {e}"))?;
    Ok(())
}

#[command]
pub fn config_get_theme() -> Option<String> {
    read_config().theme
}

#[command]
pub fn config_set_theme(theme: String) -> Result<(), String> {
    let mut config = read_config();
    config.theme = Some(theme);
    write_config(&config)
}

#[command]
pub fn config_get_canvas_bg(theme: String) -> Option<String> {
    read_config()
        .canvas_bg
        .and_then(|map| map.get(&theme).cloned())
}

#[command]
pub fn config_set_canvas_bg(theme: String, color: String) -> Result<(), String> {
    let mut config = read_config();
    let mut map = config.canvas_bg.unwrap_or_default();
    map.insert(theme, color);
    config.canvas_bg = Some(map);
    write_config(&config)
}
