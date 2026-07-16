use crate::services::script_library::{self, ScriptLibraryMigration, ScriptLibraryOperation, ScriptLibraryScan, ScriptLibraryState};
use serde_json::Value;
use std::path::Path;
use tauri::{command, State, WebviewWindow};

const MAIN_WINDOW_LABEL: &str = "main";

fn require_main_window(window: &WebviewWindow) -> Result<(), String> {
    if window.label() == MAIN_WINDOW_LABEL { Ok(()) } else { Err("Script library authority is owned by the main window".to_string()) }
}

#[command]
pub fn script_library_bind_saved_project(window: WebviewWindow, state: State<'_, ScriptLibraryState>, file_path: String) -> Result<String, String> {
    require_main_window(&window)?;
    let root = Path::new(&file_path).parent().ok_or_else(|| "Saved project path has no parent".to_string())?;
    state.bind(root)
}

#[command]
pub fn script_library_clear_active_project(window: WebviewWindow, state: State<'_, ScriptLibraryState>) -> Result<(), String> {
    require_main_window(&window)?;
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
pub fn script_library_rename(state: State<'_, ScriptLibraryState>, authority: String, script_id: String, expected_revision: String, name: String) -> Result<ScriptLibraryOperation, String> {
    script_library::rename(&state, &authority, &script_id, &expected_revision, &name)
}

#[command]
pub fn script_library_delete(state: State<'_, ScriptLibraryState>, authority: String, script_id: String, expected_revision: String) -> Result<ScriptLibraryOperation, String> {
    script_library::delete(&state, &authority, &script_id, &expected_revision)
}

#[command]
pub fn script_library_migrate_saved_projects(window: WebviewWindow, state: State<'_, ScriptLibraryState>, source_file_path: String, destination_file_path: String) -> Result<ScriptLibraryMigration, String> {
    require_main_window(&window)?;
    let source = Path::new(&source_file_path).parent().ok_or_else(|| "Source project path has no parent".to_string())?;
    let destination = Path::new(&destination_file_path).parent().ok_or_else(|| "Destination project path has no parent".to_string())?;
    state.migrate_active(source, destination)
}
