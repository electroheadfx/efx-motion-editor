use crate::services::script_library::{self, ScriptLibraryMigration, ScriptLibraryOperation, ScriptLibraryScan, ScriptLibraryState};
use serde_json::Value;
use std::path::Path;
use tauri::{command, State};

#[command]
pub fn script_library_bind_saved_project(state: State<'_, ScriptLibraryState>, file_path: String) -> Result<String, String> {
    let root = Path::new(&file_path).parent().ok_or_else(|| "Saved project path has no parent".to_string())?;
    state.bind(root)
}

#[command]
pub fn script_library_clear_active_project(state: State<'_, ScriptLibraryState>) -> Result<(), String> {
    state.clear()
}

#[command]
pub fn script_library_scan(state: State<'_, ScriptLibraryState>, authority: String) -> Result<ScriptLibraryScan, String> {
    script_library::scan(&state, &authority)
}

#[command]
pub fn script_library_load(state: State<'_, ScriptLibraryState>, authority: String, script_id: String) -> Result<ScriptLibraryOperation, String> {
    script_library::load(&state, &authority, &script_id)
}

#[command]
pub fn script_library_save(state: State<'_, ScriptLibraryState>, authority: String, script: Value) -> Result<ScriptLibraryOperation, String> {
    script_library::save(&state, &authority, script)
}

#[command]
pub fn script_library_rename(state: State<'_, ScriptLibraryState>, authority: String, script_id: String, name: String) -> Result<ScriptLibraryOperation, String> {
    script_library::rename(&state, &authority, &script_id, &name)
}

#[command]
pub fn script_library_delete(state: State<'_, ScriptLibraryState>, authority: String, script_id: String) -> Result<ScriptLibraryOperation, String> {
    script_library::delete(&state, &authority, &script_id)
}

#[command]
pub fn script_library_migrate_saved_projects(source_file_path: String, destination_file_path: String) -> Result<ScriptLibraryMigration, String> {
    let source = Path::new(&source_file_path).parent().ok_or_else(|| "Source project path has no parent".to_string())?;
    let destination = Path::new(&destination_file_path).parent().ok_or_else(|| "Destination project path has no parent".to_string())?;
    script_library::migrate_saved_projects(source, destination)
}
