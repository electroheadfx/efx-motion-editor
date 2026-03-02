mod commands;
mod models;

use commands::image;
use commands::project;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            project::project_get_default,
            image::image_get_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
