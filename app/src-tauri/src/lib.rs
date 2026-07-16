mod commands;
mod models;
mod services;

use commands::config;
use commands::export;
use commands::image;
use commands::project;
use commands::script_library;
use percent_encoding::percent_decode_str;
use serde_json::Value;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::Emitter;

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct PhysicsPaintRenderedFrame {
    #[serde(rename = "frameIndex")]
    frame_index: u32,
    #[serde(rename = "appFrame")]
    app_frame: u32,
    #[serde(rename = "dataUrl")]
    data_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u32>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct PhysicsPaintRotoCacheFrame {
    #[serde(flatten)]
    rendered: PhysicsPaintRenderedFrame,
    source: String,
    #[serde(rename = "nearestRealKeyFrame", skip_serializing_if = "Option::is_none")]
    nearest_real_key_frame: Option<u32>,
    #[serde(rename = "sourceFrame", skip_serializing_if = "Option::is_none")]
    source_frame: Option<u32>,
    #[serde(rename = "displayFrame", skip_serializing_if = "Option::is_none")]
    display_frame: Option<u32>,
    #[serde(rename = "fromSourceFrame", skip_serializing_if = "Option::is_none")]
    from_source_frame: Option<u32>,
    #[serde(rename = "toSourceFrame", skip_serializing_if = "Option::is_none")]
    to_source_frame: Option<u32>,
    #[serde(rename = "interpolationT", skip_serializing_if = "Option::is_none")]
    interpolation_t: Option<f64>,
    #[serde(rename = "backgroundOnly", skip_serializing_if = "Option::is_none")]
    background_only: Option<bool>,
    #[serde(rename = "onionDataUrl", skip_serializing_if = "Option::is_none")]
    onion_data_url: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct PhysicsPaintLaunchContext {
    #[serde(rename = "operationId")]
    operation_id: String,
    #[serde(rename = "layerId")]
    layer_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    project: Option<PhysicsPaintProjectContext>,
    #[serde(rename = "layerName", skip_serializing_if = "Option::is_none")]
    layer_name: Option<String>,
    #[serde(rename = "startFrame")]
    start_frame: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fps: Option<f64>,
    #[serde(rename = "requestedWorkflowMode", skip_serializing_if = "Option::is_none")]
    requested_workflow_mode: Option<String>,
    #[serde(rename = "workflowMode", skip_serializing_if = "Option::is_none")]
    workflow_mode: Option<String>,
    #[serde(rename = "playStartFrame", skip_serializing_if = "Option::is_none")]
    play_start_frame: Option<u32>,
    #[serde(rename = "playFrameCount", skip_serializing_if = "Option::is_none")]
    play_frame_count: Option<u32>,
    #[serde(rename = "editableSource", skip_serializing_if = "Option::is_none")]
    editable_source: Option<String>,
    #[serde(rename = "editableState", skip_serializing_if = "Option::is_none")]
    editable_state: Option<Value>,
    #[serde(rename = "selectedPlayScriptId", skip_serializing_if = "Option::is_none")]
    selected_play_script_id: Option<String>,
    #[serde(rename = "playCacheStatus", skip_serializing_if = "Option::is_none")]
    play_cache_status: Option<String>,
    #[serde(rename = "playMotion", skip_serializing_if = "Option::is_none")]
    play_motion: Option<Value>,
    #[serde(rename = "rotoBackground", skip_serializing_if = "Option::is_none")]
    roto_background: Option<Value>,
    #[serde(rename = "previewFrame", skip_serializing_if = "Option::is_none")]
    preview_frame: Option<u32>,
    #[serde(rename = "cachedPlayFrames", default, skip_serializing_if = "Vec::is_empty")]
    cached_play_frames: Vec<PhysicsPaintRenderedFrame>,
    #[serde(rename = "cachedRotoFrames", default, skip_serializing_if = "Vec::is_empty")]
    cached_roto_frames: Vec<PhysicsPaintRotoCacheFrame>,
    #[serde(rename = "rotoInterpolationSettings", skip_serializing_if = "Option::is_none")]
    roto_interpolation_settings: Option<Value>,
    #[serde(rename = "maxPlayFrameCount", skip_serializing_if = "Option::is_none")]
    max_play_frame_count: Option<u32>,
    #[serde(rename = "maxPlayFrameCountReason", skip_serializing_if = "Option::is_none")]
    max_play_frame_count_reason: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct PhysicsPaintProjectContext {
    name: String,
    saved: bool,
    #[serde(rename = "contextId")]
    context_id: String,
}

struct PhysicsPaintLaunchState(Mutex<Option<PhysicsPaintLaunchContext>>);

#[derive(serde::Serialize)]
struct PhysicsPaintWindowLaunchResult {
    label: String,
    #[serde(rename = "visibleBefore")]
    visible_before: bool,
    #[serde(rename = "minimizedBefore")]
    minimized_before: bool,
    visible: bool,
    minimized: bool,
}

#[tauri::command]
async fn get_physics_paint_launch_context(state: tauri::State<'_, PhysicsPaintLaunchState>) -> Result<Option<PhysicsPaintLaunchContext>, String> {
    state.0.lock()
        .map(|context| context.clone())
        .map_err(|error| format!("Could not read physics paint launch context: {error}"))
}

#[tauri::command]
async fn open_physics_paint_window(app: tauri::AppHandle, state: tauri::State<'_, PhysicsPaintLaunchState>, context: PhysicsPaintLaunchContext) -> Result<PhysicsPaintWindowLaunchResult, String> {
    use tauri::{Emitter, Manager};

    let label = "efx-physic-paint";
    println!(
        "[physics-paint] launch requested label={} layer={} frame={}",
        label, context.layer_id, context.start_frame
    );

    {
        let mut launch_context = state.0.lock().map_err(|error| format!("Could not store physics paint launch context: {error}"))?;
        *launch_context = Some(context.clone());
    }

    let url = physics_paint_url(&context);
    let window = if let Some(window) = app.get_webview_window(label) {
        window
    } else {
        tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(url.into()))
            .title("EFX Physics Paint")
            .inner_size(1280.0, 900.0)
            .min_inner_size(960.0, 640.0)
            .resizable(true)
            .visible(true)
            .focused(true)
            .center()
            .build()
            .map_err(|error| format!("Could not create physics paint window: {error}"))?
    };

    let visible_before = window.is_visible().map_err(|error| format!("Could not inspect physics paint window visibility: {error}"))?;
    let minimized_before = window.is_minimized().map_err(|error| format!("Could not inspect physics paint window minimized state: {error}"))?;
    println!(
        "[physics-paint] window ready label={} visible_before={} minimized_before={}",
        label, visible_before, minimized_before
    );

    if minimized_before {
        window.unminimize().map_err(|error| format!("Could not unminimize physics paint window: {error}"))?;
    }
    window.show().map_err(|error| format!("Could not show physics paint window: {error}"))?;
    window.center().map_err(|error| format!("Could not center physics paint window: {error}"))?;
    window.set_focus().map_err(|error| format!("Could not focus physics paint window: {error}"))?;
    window.emit("physic-paint:launch", &context).map_err(|error| format!("Could not send physics paint launch context: {error}"))?;

    let visible = window.is_visible().map_err(|error| format!("Could not verify physics paint window visibility: {error}"))?;
    let minimized = window.is_minimized().map_err(|error| format!("Could not verify physics paint window minimized state: {error}"))?;
    println!(
        "[physics-paint] launch completed label={} visible={} minimized={}",
        label, visible, minimized
    );
    if !visible || minimized {
        return Err(format!("Physics paint window was opened but is not visible (visible={visible}, minimized={minimized})"));
    }

    Ok(PhysicsPaintWindowLaunchResult {
        label: label.to_string(),
        visible_before,
        minimized_before,
        visible,
        minimized,
    })
}

fn physics_paint_url(context: &PhysicsPaintLaunchContext) -> String {
    let mut url = format!(
        "/physics-paint?operationId={}&layerId={}&startFrame={}",
        percent_encoding::utf8_percent_encode(&context.operation_id, percent_encoding::NON_ALPHANUMERIC),
        percent_encoding::utf8_percent_encode(&context.layer_id, percent_encoding::NON_ALPHANUMERIC),
        context.start_frame,
    );
    if let Some(project) = &context.project {
        url.push_str("&projectName=");
        url.push_str(&percent_encoding::utf8_percent_encode(&project.name, percent_encoding::NON_ALPHANUMERIC).to_string());
        url.push_str("&projectSaved=");
        url.push_str(if project.saved { "true" } else { "false" });
        url.push_str("&projectContextId=");
        url.push_str(&percent_encoding::utf8_percent_encode(&project.context_id, percent_encoding::NON_ALPHANUMERIC).to_string());
    }
    if let Some(layer_name) = &context.layer_name {
        url.push_str("&layerName=");
        url.push_str(&percent_encoding::utf8_percent_encode(layer_name, percent_encoding::NON_ALPHANUMERIC).to_string());
    }
    if let Some(width) = context.width {
        url.push_str("&width=");
        url.push_str(&width.to_string());
    }
    if let Some(height) = context.height {
        url.push_str("&height=");
        url.push_str(&height.to_string());
    }
    if let Some(fps) = context.fps {
        url.push_str("&fps=");
        url.push_str(&fps.to_string());
    }
    if let Some(workflow_mode) = &context.workflow_mode {
        url.push_str("&workflowMode=");
        url.push_str(&percent_encoding::utf8_percent_encode(workflow_mode, percent_encoding::NON_ALPHANUMERIC).to_string());
    }
    if let Some(play_start_frame) = context.play_start_frame {
        url.push_str("&playStartFrame=");
        url.push_str(&play_start_frame.to_string());
    }
    if let Some(play_frame_count) = context.play_frame_count {
        url.push_str("&playFrameCount=");
        url.push_str(&play_frame_count.to_string());
    }
    if let Some(editable_source) = &context.editable_source {
        url.push_str("&editableSource=");
        url.push_str(&percent_encoding::utf8_percent_encode(editable_source, percent_encoding::NON_ALPHANUMERIC).to_string());
    }
    url
}

#[cfg(target_os = "macos")]
use services::tablet;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(PhysicsPaintLaunchState(Mutex::new(None)))
        .manage(services::script_library::ScriptLibraryState::default())
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

            // Install native tablet pressure monitor (macOS only).
            // WebKit doesn't report real pen pressure via PointerEvent — this
            // bridges native NSEvent tablet data to the frontend.
            #[cfg(target_os = "macos")]
            tablet::install_tablet_monitor(app.handle().clone());

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
                        .header("Access-Control-Allow-Origin", "*")
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
                                    .header("Access-Control-Allow-Origin", "*")
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
                        .header("Access-Control-Allow-Origin", "*")
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
                        .header("Access-Control-Allow-Origin", "*")
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
            project::project_save_as_with_script_library,
            project::project_open,
            project::project_migrate_temp_images,
            project::path_exists,
            script_library::script_library_bind_saved_project,
            script_library::script_library_clear_active_project,
            script_library::script_library_scan,
            script_library::script_library_load,
            script_library::script_library_save,
            script_library::script_library_rename,
            script_library::script_library_delete,
            script_library::script_library_migrate_saved_projects,
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
            export::export_cleanup_file,
            get_physics_paint_launch_context,
            open_physics_paint_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn play_launch_context() -> PhysicsPaintLaunchContext {
        PhysicsPaintLaunchContext {
            operation_id: "op-1".into(),
            layer_id: "layer-1".into(),
            project: None,
            layer_name: Some("Layer".into()),
            start_frame: 12,
            width: Some(1000),
            height: Some(650),
            fps: Some(24.0),
            requested_workflow_mode: Some("play".into()),
            workflow_mode: Some("play".into()),
            play_start_frame: Some(12),
            play_frame_count: Some(5),
            editable_source: Some("play".into()),
            editable_state: Some(serde_json::json!({
                "version": 2,
                "width": 1000,
                "height": 650,
                "settings": {},
                "strokes": [{ "pts": [[1, 2, 0.5, 0, 0, 0, 0]] }]
            })),
            selected_play_script_id: Some("play-12-5".into()),
            play_cache_status: Some("cached".into()),
            play_motion: Some(serde_json::json!({ "strokeDeformation": 30, "strokePosition": 40 })),
            roto_background: None,
            preview_frame: Some(1),
            cached_play_frames: vec![PhysicsPaintRenderedFrame {
                frame_index: 1,
                app_frame: 13,
                data_url: "data:image/png;base64,ZmFrZQ==".into(),
                width: Some(1000),
                height: Some(650),
            }],
            cached_roto_frames: Vec::new(),
            roto_interpolation_settings: None,
            max_play_frame_count: None,
            max_play_frame_count_reason: None,
        }
    }

    #[test]
    fn physics_paint_url_excludes_large_editable_state() {
        let context = play_launch_context();

        let url = physics_paint_url(&context);

        assert!(url.starts_with("/physics-paint?operationId="));
        assert!(url.contains("layerId=layer%2D1"));
        assert!(url.contains("startFrame=12"));
        assert!(!url.contains("editableState"));
        assert!(!url.contains("strokes"));
        assert!(!url.contains("cachedPlayFrames"));
        assert!(!url.contains("data:image"));
    }

    #[test]
    fn physics_paint_launch_context_is_cloneable_for_fetch_after_mount() {
        let cloned = play_launch_context().clone();

        assert_eq!(cloned.workflow_mode.as_deref(), Some("play"));
        assert_eq!(cloned.selected_play_script_id.as_deref(), Some("play-12-5"));
        assert_eq!(cloned.play_cache_status.as_deref(), Some("cached"));
        assert_eq!(cloned.preview_frame, Some(1));
        assert_eq!(cloned.cached_play_frames.len(), 1);
        assert_eq!(cloned.cached_play_frames[0].app_frame, 13);
        assert!(cloned.editable_state.is_some());
    }

    #[test]
    fn physics_paint_launch_context_json_preserves_roto_source_display_identity() {
        let input = serde_json::json!({
            "operationId": "op-roto-on",
            "layerId": "layer-1",
            "startFrame": 17,
            "workflowMode": "roto",
            "editableSource": "roto",
            "cachedRotoFrames": [
                { "frameIndex": 0, "appFrame": 0, "sourceFrame": 0, "displayFrame": 0, "source": "real-key", "dataUrl": "data:image/png;base64,MA==" },
                { "frameIndex": 0, "appFrame": 3, "sourceFrame": 1, "displayFrame": 3, "source": "real-key", "dataUrl": "data:image/png;base64,MQ==" },
                { "frameIndex": 0, "appFrame": 6, "sourceFrame": 2, "displayFrame": 6, "source": "real-key", "dataUrl": "data:image/png;base64,Mg==" },
                { "frameIndex": 0, "appFrame": 9, "sourceFrame": 3, "displayFrame": 9, "source": "real-key", "dataUrl": "data:image/png;base64,Mw==" },
                { "frameIndex": 0, "appFrame": 17, "sourceFrame": 17, "displayFrame": 17, "source": "real-key", "dataUrl": "data:image/png;base64,MTc=" }
            ],
            "rotoInterpolationSettings": {
                "enabled": true,
                "inBetweenCount": 2,
                "mode": "duplicate",
                "deform": 0,
                "position": 0,
                "segmentSpacingOverrides": [
                    { "fromSourceFrame": 3, "toSourceFrame": 17, "inBetweenCount": 7 }
                ]
            }
        });

        let context: PhysicsPaintLaunchContext = serde_json::from_value(input).unwrap();
        let output = serde_json::to_value(context).unwrap();
        let frames = output["cachedRotoFrames"].as_array().unwrap();

        assert_eq!(frames.iter().map(|frame| frame["sourceFrame"].as_u64()).collect::<Vec<_>>(), vec![Some(0), Some(1), Some(2), Some(3), Some(17)]);
        assert_eq!(frames.iter().map(|frame| frame["displayFrame"].as_u64()).collect::<Vec<_>>(), vec![Some(0), Some(3), Some(6), Some(9), Some(17)]);
        assert_eq!(output["rotoInterpolationSettings"]["segmentSpacingOverrides"][0]["toSourceFrame"], 17);
    }

    #[test]
    fn physics_paint_launch_context_preserves_cached_roto_frames_after_mount() {
        let mut context = play_launch_context();
        context.workflow_mode = Some("roto".into());
        context.editable_source = Some("roto".into());
        context.editable_state = None;
        context.cached_play_frames = Vec::new();
        context.cached_roto_frames = vec![PhysicsPaintRotoCacheFrame {
            rendered: PhysicsPaintRenderedFrame {
                frame_index: 0,
                app_frame: 4,
                data_url: "data:image/png;base64,cm90bw==".into(),
                width: Some(1000),
                height: Some(650),
            },
            source: "real-key".into(),
            nearest_real_key_frame: None,
            source_frame: None,
            display_frame: None,
            from_source_frame: None,
            to_source_frame: None,
            interpolation_t: None,
            background_only: None,
            onion_data_url: None,
        }];

        let cloned = context.clone();

        assert_eq!(cloned.workflow_mode.as_deref(), Some("roto"));
        assert_eq!(cloned.cached_roto_frames.len(), 1);
        assert_eq!(cloned.cached_roto_frames[0].rendered.app_frame, 4);
        assert_eq!(cloned.cached_roto_frames[0].source, "real-key");
        assert!(cloned.editable_state.is_none());
    }

    #[test]
    fn physics_paint_launch_context_preserves_roto_background_round_trip() {
        let input = serde_json::json!({
            "operationId": "op-roto-paper",
            "layerId": "layer-1",
            "startFrame": 4,
            "workflowMode": "roto",
            "rotoBackground": {
                "background": "canvas2",
                "paperGrain": "canvas3",
                "grainStrength": 0.65,
                "color": "#f7f3ed"
            }
        });

        let context: PhysicsPaintLaunchContext = serde_json::from_value(input.clone()).unwrap();
        let output = serde_json::to_value(context).unwrap();

        assert_eq!(output.get("rotoBackground"), input.get("rotoBackground"));
    }
}
