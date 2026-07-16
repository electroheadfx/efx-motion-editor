use crate::commands::script_library::encode_thumbnail_webp_for_test;
use crate::services::script_library::{self, ScriptLibraryMigration, ScriptLibraryOperation, ScriptLibraryScan, ScriptLibraryState};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub struct FixtureLibrary {
    fixture_root: PathBuf,
    project_root: PathBuf,
    state: ScriptLibraryState,
    authority: String,
}

impl FixtureLibrary {
    pub fn new() -> Result<Self, String> {
        let fixture_root = std::env::temp_dir().join(format!("efx-script-library-test-{}", Uuid::new_v4()));
        let project_root = fixture_root.join("project");
        fs::create_dir_all(&project_root).map_err(|error| format!("Could not create fixture project: {error}"))?;
        let state = ScriptLibraryState::default();
        let authority = state.bind(&project_root)?;
        Ok(Self { fixture_root, project_root, state, authority })
    }

    pub fn project_root(&self) -> &Path { &self.project_root }
    pub fn scripts_root(&self) -> PathBuf { self.project_root.join("scripts") }
    pub fn authority(&self) -> &str { &self.authority }
    pub fn scan(&self) -> Result<ScriptLibraryScan, String> { script_library::scan(&self.state, &self.authority) }
    pub fn save(&self, value: Value) -> Result<ScriptLibraryOperation, String> { script_library::save(&self.state, &self.authority, value) }
    pub fn load(&self, id: &str) -> Result<ScriptLibraryOperation, String> { script_library::load(&self.state, &self.authority, id) }
    pub fn rename(&self, id: &str, revision: &str, name: &str) -> Result<ScriptLibraryOperation, String> { script_library::rename(&self.state, &self.authority, id, revision, name) }
    pub fn delete(&self, id: &str, revision: &str) -> Result<ScriptLibraryOperation, String> { script_library::delete(&self.state, &self.authority, id, revision) }
    pub fn stale_scan(&self) -> Result<ScriptLibraryScan, String> { script_library::scan(&self.state, "stale-authority") }
    pub fn migrate_to(&self, destination_name: &str) -> Result<(PathBuf, ScriptLibraryMigration), String> {
        let destination = self.fixture_root.join(destination_name);
        fs::create_dir_all(&destination).map_err(|error| format!("Could not create migration destination: {error}"))?;
        let result = self.state.migrate_active(&self.project_root, &destination)?;
        Ok((destination, result))
    }
    pub fn write_managed_raw(&self, filename: &str, contents: &str) -> Result<PathBuf, String> {
        let path = self.scripts_root().join(filename);
        fs::write(&path, contents).map_err(|error| format!("Could not write fixture file: {error}"))?;
        Ok(path)
    }
}

impl Drop for FixtureLibrary {
    fn drop(&mut self) { let _ = fs::remove_dir_all(&self.fixture_root); }
}

pub fn validate_document(value: Value, expected_id: Option<&str>) -> Result<Value, String> {
    script_library::validate_document(value, expected_id)
}

pub fn validate_webp(bytes: &[u8]) -> Result<(u64, u64), String> {
    script_library::validate_webp_payload(bytes)
}

pub fn encode_webp(operation_id: &str, width: u32, height: u32, quality: f32, rgba: &[u8]) -> Result<Value, String> {
    encode_thumbnail_webp_for_test(operation_id.to_string(), width, height, quality, encode_base64(rgba))
}

fn encode_base64(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let value = (u32::from(chunk[0]) << 16)
            | (u32::from(*chunk.get(1).unwrap_or(&0)) << 8)
            | u32::from(*chunk.get(2).unwrap_or(&0));
        output.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        output.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        output.push(if chunk.len() > 1 { ALPHABET[((value >> 6) & 63) as usize] as char } else { '=' });
        output.push(if chunk.len() > 2 { ALPHABET[(value & 63) as usize] as char } else { '=' });
    }
    output
}
