mod commands;
mod models;
mod services;

use commands::image;
use commands::project;
use percent_encoding::percent_decode_str;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .register_uri_scheme_protocol("efxasset", |_app, request| {
            // Custom protocol to serve local files without asset scope restrictions.
            // Fixes 403 errors caused by macOS Unicode normalization (NFC/NFD)
            // on paths with accented characters (e.g. "Téléchargements").
            let uri = request.uri();
            let raw_path = uri.path();
            let path = percent_decode_str(raw_path)
                .decode_utf8_lossy()
                .to_string();

            match std::fs::read(&path) {
                Ok(data) => {
                    let mime = if path.ends_with(".jpg") || path.ends_with(".jpeg") {
                        "image/jpeg"
                    } else if path.ends_with(".png") {
                        "image/png"
                    } else if path.ends_with(".tiff") || path.ends_with(".tif") {
                        "image/tiff"
                    } else {
                        "application/octet-stream"
                    };
                    tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Cache-Control", "no-cache, no-store, must-revalidate")
                        .header("Pragma", "no-cache")
                        .status(200)
                        .body(data)
                        .unwrap()
                }
                Err(_) => tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .invoke_handler(tauri::generate_handler![
            project::project_get_default,
            project::project_create,
            project::project_save,
            project::project_open,
            project::project_migrate_temp_images,
            project::path_exists,
            image::image_get_info,
            image::import_images,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
