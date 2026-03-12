use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Default)]
struct BuilderConfig {
    #[serde(default)]
    theme: Option<String>,
}

/// Returns the path to ~/.config/efx-motion/builder-config.yaml.
/// Uses $HOME directly to avoid dirs crate mapping to ~/Library/Application Support on macOS.
fn config_path() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".into()))
        .join(".config/efx-motion/builder-config.yaml")
}

/// Reads the YAML config file, returning Default on any error (missing file, parse error).
fn read_config() -> BuilderConfig {
    let path = config_path();
    if !path.exists() {
        return BuilderConfig::default();
    }
    match std::fs::read_to_string(&path) {
        Ok(contents) => serde_yaml::from_str(&contents).unwrap_or_default(),
        Err(_) => BuilderConfig::default(),
    }
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
