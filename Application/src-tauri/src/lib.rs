mod commands;
mod models;
mod services;

use commands::image;
use commands::project;
use percent_encoding::percent_decode_str;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Build a custom menu that replaces the default macOS menu.
            // The default menu includes Edit > Undo (Cmd+Z) and Edit > Redo (Cmd+Shift+Z)
            // as native accelerators that intercept keydown events at the Cocoa layer
            // before they reach the WKWebView, preventing JS shortcuts from firing.

            // App submenu (standard macOS app menu)
            let app_submenu = SubmenuBuilder::new(app, &app.package_info().name)
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            // Edit submenu with custom Undo/Redo that emit events to frontend
            // instead of using native Cocoa undo system.
            // Use MenuItem::with_id for Undo/Redo so we can intercept them via on_menu_event.
            // Use PredefinedMenuItem for Cut/Copy/Paste/Select All since those native
            // operations work correctly in the webview.
            let undo_item =
                MenuItem::with_id(app, "undo", "Undo", true, Some("CmdOrCtrl+Z"))?;
            let redo_item =
                MenuItem::with_id(app, "redo", "Redo", true, Some("CmdOrCtrl+Shift+Z"))?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&undo_item)
                .item(&redo_item)
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&edit_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Wire menu events: emit undo/redo to frontend instead of native handling
            let handle = app.handle().clone();
            app.on_menu_event(move |_app_handle, event| {
                if event.id() == "undo" {
                    handle.emit("menu:undo", ()).ok();
                } else if event.id() == "redo" {
                    handle.emit("menu:redo", ()).ok();
                }
            });

            Ok(())
        })
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
