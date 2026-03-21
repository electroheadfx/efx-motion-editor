mod commands;
mod models;
mod services;

use commands::config;
use commands::export;
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
        .plugin(tauri_plugin_notification::init())
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

            // File submenu with project operations that emit events to frontend.
            // These menu items use native accelerators (CmdOrCtrl+N/O/S/W) which
            // intercept keydown at the Cocoa layer before reaching the webview.
            // The corresponding tinykeys bindings are removed from shortcuts.ts
            // since these menu accelerators handle them instead.
            let new_project_item =
                MenuItem::with_id(app, "new-project", "New Project", true, Some("CmdOrCtrl+N"))?;
            let open_project_item = MenuItem::with_id(
                app,
                "open-project",
                "Open Project...",
                true,
                Some("CmdOrCtrl+O"),
            )?;
            let save_project_item =
                MenuItem::with_id(app, "save-project", "Save", true, Some("CmdOrCtrl+S"))?;
            let export_item = MenuItem::with_id(
                app,
                "export",
                "Export...",
                true,
                Some("CmdOrCtrl+Shift+E"),
            )?;
            let close_project_item = MenuItem::with_id(
                app,
                "close-project",
                "Close Project",
                true,
                None::<&str>,
            )?;

            let file_submenu = SubmenuBuilder::new(app, "File")
                .item(&new_project_item)
                .item(&open_project_item)
                .separator()
                .item(&save_project_item)
                .separator()
                .item(&export_item)
                .separator()
                .item(&close_project_item)
                .build()?;

            let edit_submenu = SubmenuBuilder::new(app, "Edit")
                .item(&undo_item)
                .item(&redo_item)
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            // View submenu with zoom items. Zoom in/out use bare = / - keys
            // (handled by tinykeys in JS), so no native accelerator is set.
            // The menu items remain for discoverability via the View menu.
            let zoom_in_item =
                MenuItem::with_id(app, "zoom-in", "Zoom In (+/=)", true, None::<&str>)?;
            let zoom_out_item =
                MenuItem::with_id(app, "zoom-out", "Zoom Out (-)", true, None::<&str>)?;
            let fit_to_window_item = MenuItem::with_id(
                app,
                "fit-to-window",
                "Fit to Window",
                true,
                Some("CmdOrCtrl+0"),
            )?;

            let view_submenu = SubmenuBuilder::new(app, "View")
                .item(&zoom_in_item)
                .item(&zoom_out_item)
                .separator()
                .item(&fit_to_window_item)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_submenu)
                .item(&file_submenu)
                .item(&edit_submenu)
                .item(&view_submenu)
                .build()?;

            app.set_menu(menu)?;

            // Wire menu events: emit undo/redo to frontend instead of native handling
            let handle = app.handle().clone();
            app.on_menu_event(move |_app_handle, event| {
                if event.id() == "new-project" {
                    handle.emit("menu:new-project", ()).ok();
                } else if event.id() == "open-project" {
                    handle.emit("menu:open-project", ()).ok();
                } else if event.id() == "save-project" {
                    handle.emit("menu:save-project", ()).ok();
                } else if event.id() == "close-project" {
                    handle.emit("menu:close-project", ()).ok();
                } else if event.id() == "export" {
                    handle.emit("menu:export", ()).ok();
                } else if event.id() == "undo" {
                    handle.emit("menu:undo", ()).ok();
                } else if event.id() == "redo" {
                    handle.emit("menu:redo", ()).ok();
                } else if event.id() == "zoom-in" {
                    handle.emit("menu:zoom-in", ()).ok();
                } else if event.id() == "zoom-out" {
                    handle.emit("menu:zoom-out", ()).ok();
                } else if event.id() == "fit-to-window" {
                    handle.emit("menu:fit-to-window", ()).ok();
                }
            });

            Ok(())
        })
        .register_uri_scheme_protocol("efxasset", |_app, request| {
            // Custom protocol to serve local files without asset scope restrictions.
            // Fixes 403 errors caused by macOS Unicode normalization (NFC/NFD)
            // on paths with accented characters (e.g. "Téléchargements").
            //
            // Supports Range requests (HTTP 206) required by <video> elements
            // for seeking via AVFoundation on macOS.
            let uri = request.uri();
            let raw_path = uri.path();
            let path = percent_decode_str(raw_path)
                .decode_utf8_lossy()
                .to_string();

            let lower = path.to_lowercase();
            let mime = if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
                "image/jpeg"
            } else if lower.ends_with(".png") {
                "image/png"
            } else if lower.ends_with(".tiff") || lower.ends_with(".tif") {
                "image/tiff"
            } else if lower.ends_with(".heic") || lower.ends_with(".heif") {
                "image/heic"
            } else if lower.ends_with(".mp4") || lower.ends_with(".m4v") {
                "video/mp4"
            } else if lower.ends_with(".mov") {
                "video/quicktime"
            } else if lower.ends_with(".webm") {
                "video/webm"
            } else if lower.ends_with(".avi") {
                "video/x-msvideo"
            } else {
                "application/octet-stream"
            };

            let is_video = mime.starts_with("video/");

            // Get file metadata for Content-Length and Range support
            let metadata = match std::fs::metadata(&path) {
                Ok(m) => m,
                Err(_) => {
                    return tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap();
                }
            };
            let file_size = metadata.len();

            // Parse Range header for video seeking support
            let range_header = request
                .headers()
                .get("Range")
                .or_else(|| request.headers().get("range"))
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            if is_video {
                if let Some(range) = range_header {
                    // Parse "bytes=START-END" or "bytes=START-"
                    if let Some(range_spec) = range.strip_prefix("bytes=") {
                        let parts: Vec<&str> = range_spec.split('-').collect();
                        let start: u64 = parts[0].parse().unwrap_or(0);
                        let end: u64 = if parts.len() > 1 && !parts[1].is_empty() {
                            parts[1].parse().unwrap_or(file_size - 1)
                        } else {
                            file_size - 1
                        };
                        let end = end.min(file_size - 1);
                        let length = end - start + 1;

                        use std::io::{Read, Seek, SeekFrom};
                        let mut file = match std::fs::File::open(&path) {
                            Ok(f) => f,
                            Err(_) => {
                                return tauri::http::Response::builder()
                                    .status(404)
                                    .body(Vec::new())
                                    .unwrap();
                            }
                        };
                        file.seek(SeekFrom::Start(start)).ok();
                        let mut buf = vec![0u8; length as usize];
                        let _ = file.read_exact(&mut buf);

                        return tauri::http::Response::builder()
                            .header("Content-Type", mime)
                            .header("Accept-Ranges", "bytes")
                            .header(
                                "Content-Range",
                                format!("bytes {}-{}/{}", start, end, file_size),
                            )
                            .header("Content-Length", length.to_string())
                            .header("Access-Control-Allow-Origin", "*")
                            .status(206)
                            .body(buf)
                            .unwrap();
                    }
                }

                // No Range header — return full video with Accept-Ranges
                match std::fs::read(&path) {
                    Ok(data) => tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Accept-Ranges", "bytes")
                        .header("Content-Length", file_size.to_string())
                        .header("Access-Control-Allow-Origin", "*")
                        .status(200)
                        .body(data)
                        .unwrap(),
                    Err(_) => tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap(),
                }
            } else {
                // Image / other files — full read, no-cache
                match std::fs::read(&path) {
                    Ok(data) => tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .header("Cache-Control", "no-cache, no-store, must-revalidate")
                        .header("Pragma", "no-cache")
                        .status(200)
                        .body(data)
                        .unwrap(),
                    Err(_) => tauri::http::Response::builder()
                        .status(404)
                        .body(Vec::new())
                        .unwrap(),
                }
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
            config::config_get_theme,
            config::config_set_theme,
            config::config_get_canvas_bg,
            config::config_set_canvas_bg,
            config::config_get_sidebar_width,
            config::config_set_sidebar_width,
            config::config_get_panel_heights,
            config::config_set_panel_heights,
            config::config_get_loop_enabled,
            config::config_set_loop_enabled,
            config::config_get_export_folder,
            config::config_set_export_folder,
            config::config_get_export_naming_pattern,
            config::config_set_export_naming_pattern,
            config::config_get_video_quality,
            config::config_set_video_quality,
            export::export_create_dir,
            export::export_write_png,
            export::export_count_existing_frames,
            export::export_open_in_finder,
            export::export_check_ffmpeg,
            export::export_download_ffmpeg,
            export::export_encode_video,
            export::export_cleanup_pngs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
