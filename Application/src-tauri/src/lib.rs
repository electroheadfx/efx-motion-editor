mod commands;
mod models;
mod services;

use commands::image;
use commands::project;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            project::project_get_default,
            image::image_get_info,
            image::import_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
