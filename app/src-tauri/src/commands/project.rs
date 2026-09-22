use crate::models::project::{MceProject, ProjectData};
use crate::services::efx_paint_media::{
    read_package_layer_file, write_package_layer_file, EfxPaintMediaError,
};
use crate::services::physic_paint_cache::{
    bind_package_transaction, discard_package_staging_generation, publish_package_transaction,
    recover_cache_transaction, recover_package_transaction, settle_package_transaction,
    PackagePublication, PackageRecovery, PackageSettlement, PackageSettlementAction,
};
use crate::services::project_io;
use crate::services::script_library::ScriptLibraryState;
use tauri::command;
use tauri::Manager;

/// Legacy command -- kept for backward compatibility
#[command]
pub fn project_get_default() -> ProjectData {
    ProjectData {
        name: "Untitled Project".into(),
        fps: 24,
        width: 1920,
        height: 1080,
    }
}

/// Create a new project: makes directory structure, returns initial MceProject.
/// Also registers the project directory with the asset protocol scope so
/// thumbnails display correctly for projects outside $APPDATA.
#[command]
pub fn project_create(
    app: tauri::AppHandle,
    name: String,
    fps: u32,
    dir_path: String,
    width: u32,
    height: u32,
) -> Result<MceProject, String> {
    // 260918-ovi (T-260918-ovi-01, ASVS V5): defense-in-depth clamp. The
    // renderer's NumericStepper.clampToStep is the primary bound at emission
    // time; this clamp ensures no caller — IPC or otherwise — can construct a
    // project whose canvas allocations exceed the 1920 long edge.
    let width = width.clamp(1, 1920);
    let height = height.clamp(1, 1920);

    // Create project directory structure FIRST so we can canonicalize
    project_io::create_project_dir(&dir_path)?;

    // Canonicalize then register with asset protocol scope.
    // This resolves macOS Unicode normalization differences (NFC vs NFD)
    // that cause 403 errors on paths with accented characters (e.g. "Téléchargements").
    let canonical =
        std::fs::canonicalize(&dir_path).unwrap_or_else(|_| std::path::PathBuf::from(&dir_path));
    let scope = app.asset_protocol_scope();
    scope
        .allow_directory(&canonical, true)
        .map_err(|e| format!("Failed to register asset scope: {e}"))?;

    let now = chrono::Utc::now().to_rfc3339();
    Ok(MceProject {
        version: 1,
        name,
        fps,
        width,
        height,
        created_at: now.clone(),
        modified_at: now,
        sequences: vec![],
        images: vec![],
        audio_tracks: vec![],
        efx_paint_documents: std::collections::HashMap::new(),
        // A brand-new project carries no package keys yet: the first save
        // stamps `formatVersion` + `projectId` + `efxPaint` (52.2-07).
        format_version: None,
        project_id: None,
        efx_paint: std::collections::HashMap::new(),
    })
}

/// Save project to .mce file (atomic write).
///
/// 52.2-05 (D-10): the manifest is written at the path it is HANDED — during a
/// package save that path is inside the package staging root — and it carries
/// no cache transaction id: the authoritative package transaction binds the
/// manifest like every other file, and the machine-local cache leg is
/// best-effort (D-14), so no project write binds a cache generation any more.
#[command]
pub fn project_save(project: MceProject, file_path: String) -> Result<(), String> {
    let project_root = std::path::Path::new(&file_path)
        .parent()
        .ok_or_else(|| "Invalid file path: no parent directory".to_string())?
        .to_str()
        .ok_or_else(|| "Invalid file path: non-UTF8 characters".to_string())?;

    project_io::save_project(&project, &file_path, project_root)
}

/// One bound file as the renderer reads it (camelCase; the marker's on-disk
/// entry shape is Rust-owned and snake_case).
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundPackageFile {
    pub path: String,
    pub sha256: String,
    pub had_original: bool,
}

/// The binding the renderer drives the rest of the transaction with: one
/// transaction identity and one order-independent aggregate digest over the
/// path-sorted entry list.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundPackageFileSet {
    pub transaction_id: String,
    pub aggregate_digest: String,
    pub entries: Vec<BoundPackageFile>,
}

/// Bind the authoritative package transaction (52.2-05, D-10): the caller has
/// staged every changed authoritative file (manifest, `layers/*.json`,
/// `frames/*.webp`) under `<package>/<staging-basename>/` and hands the
/// package-relative list. The staging root is DERIVED in Rust from the package
/// root (T-52.2-14: the renderer never supplies a destination root) and every
/// path passes the plan-01 bound-path guard.
#[command]
pub fn bind_efx_paint_package_transaction(
    package_root: String,
    staging_basename: String,
    paths: Vec<String>,
) -> Result<BoundPackageFileSet, String> {
    let binding = bind_package_transaction(
        std::path::Path::new(&package_root),
        &staging_basename,
        &paths,
    )?;
    Ok(BoundPackageFileSet {
        transaction_id: binding.transaction_id,
        aggregate_digest: binding.aggregate_digest,
        entries: binding
            .entries
            .into_iter()
            .map(|entry| BoundPackageFile {
                path: entry.path,
                sha256: entry.sha256,
                had_original: entry.had_original,
            })
            .collect(),
    })
}

/// Publish every bound file into its canonical path through the transaction
/// (per-file atomic exchange; the previous bytes are retained for rollback).
#[command]
pub fn publish_efx_paint_package_transaction(
    package_root: String,
    transaction_id: String,
) -> Result<PackagePublication, String> {
    publish_package_transaction(std::path::Path::new(&package_root), &transaction_id)
}

/// Settle the package transaction: commit only on a full digest match, rollback
/// restores the pre-save package.
#[command]
pub fn settle_efx_paint_package_transaction(
    package_root: String,
    transaction_id: String,
    action: PackageSettlementAction,
) -> Result<PackageSettlement, String> {
    settle_package_transaction(
        std::path::Path::new(&package_root),
        &transaction_id,
        action,
    )
}

/// Resolve a package left mid-transaction by a crash (52.2-05): roll forward
/// only when every bound file already matches, otherwise back to the pre-save
/// package.
#[command]
pub fn recover_efx_paint_package_transaction(
    package_root: String,
) -> Result<PackageRecovery, String> {
    let settlement = recover_package_transaction(std::path::Path::new(&package_root))?;
    Ok(match settlement {
        Some(settlement) => PackageRecovery {
            recovered: true,
            cleanup_deferred: settlement.cleanup_deferred,
            cleanup_diagnostic: settlement.cleanup_diagnostic,
        },
        None => PackageRecovery {
            recovered: false,
            cleanup_deferred: false,
            cleanup_diagnostic: None,
        },
    })
}

/// Write one layer sub-file into the package staging generation
/// (quick-260913-05k). The renderer used to drive this through the fs plugin,
/// whose scope covers appdata only — an app-defined command carries no
/// capability, so the package path needs none. The destination root is derived
/// in Rust from the package root; the caller supplies only the validated
/// staging basename and the package-relative `layers/<layerId>.json`.
#[command(async)]
pub fn write_efx_paint_package_layer_file(
    package_dir: String,
    staging_basename: String,
    layer_file: String,
    contents: String,
) -> Result<(), EfxPaintMediaError> {
    write_package_layer_file(
        std::path::Path::new(&package_dir),
        &staging_basename,
        &layer_file,
        contents.as_bytes(),
    )?;
    Ok(())
}

/// Read one layer sub-file back as text (quick-260913-05k). The text — never a
/// raw response body, which degrades to a JSON number array on macOS — is
/// parsed by the caller through the fail-closed on-disk door.
#[command(async)]
pub fn read_efx_paint_package_layer_file(
    package_dir: String,
    layer_file: String,
) -> Result<String, EfxPaintMediaError> {
    read_package_layer_file(std::path::Path::new(&package_dir), &layer_file)
}

/// Discard a package staging generation left behind by a failed save
/// (quick-260913-05k). Best-effort by contract: the caller swallows a failure
/// exactly as it swallowed the plugin-fs removal before, and canonical
/// publication state is determined only by the transaction's own result.
#[command]
pub fn discard_efx_paint_package_staging(
    package_dir: String,
    staging_basename: String,
) -> Result<(), String> {
    discard_package_staging_generation(
        std::path::Path::new(&package_dir),
        &staging_basename,
    )
}

/// Save As: the destination file set is staged, published and settled through
/// the package transaction, and the active-path migration runs BETWEEN the
/// publish and the settle — so a failure anywhere (T-52.2-18) leaves the
/// previous destination byte-identical (or absent, when it was new) and the
/// active path unmigrated, through ONE mechanism: the transaction's rollback.
///
/// The renderer may hand the staged file set it already wrote (plan 07: the
/// full package). When it does not, the manifest alone is the bound set and
/// the staging basename is minted here — never a caller-supplied destination
/// root, which is derived from the destination path.
#[command]
pub fn project_save_as_with_script_library(
    window: tauri::WebviewWindow,
    state: tauri::State<'_, ScriptLibraryState>,
    project: MceProject,
    source_file_path: String,
    destination_file_path: String,
    staging_basename: Option<String>,
    staged_paths: Option<Vec<String>>,
) -> Result<crate::services::script_library::ScriptLibraryMigration, String> {
    use crate::services::efx_paint_media::PACKAGE_STAGING_PREFIX;

    if window.label() != "main" {
        return Err("Save As is owned by the main window".to_string());
    }
    let source_root = std::path::Path::new(&source_file_path)
        .parent()
        .ok_or_else(|| "Source project path has no parent".to_string())?;
    let destination_root = std::path::Path::new(&destination_file_path)
        .parent()
        .ok_or_else(|| "Destination project path has no parent".to_string())?;
    let staging_basename =
        staging_basename.unwrap_or_else(|| format!("{PACKAGE_STAGING_PREFIX}{}", uuid::Uuid::new_v4()));
    let staging_root = destination_root.join(&staging_basename);
    std::fs::create_dir_all(&staging_root)
        .map_err(|error| format!("Could not create the Save As staging root: {error}"))?;

    // The manifest is a staged participant like every other authoritative file.
    let staged_manifest = staging_root.join("project.mce");
    project_io::save_project(
        &project,
        staged_manifest.to_string_lossy().as_ref(),
        staging_root.to_string_lossy().as_ref(),
    )?;

    let mut paths = staged_paths.unwrap_or_default();
    if !paths.iter().any(|path| path == "project.mce") {
        paths.push("project.mce".to_string());
    }
    let binding = bind_package_transaction(destination_root, &staging_basename, &paths)?;
    publish_package_transaction(destination_root, &binding.transaction_id)?;

    match state.migrate_active(source_root, destination_root) {
        Ok(migration) => {
            settle_package_transaction(
                destination_root,
                &binding.transaction_id,
                PackageSettlementAction::Commit,
            )?;
            Ok(migration)
        }
        Err(error) => {
            match settle_package_transaction(
                destination_root,
                &binding.transaction_id,
                PackageSettlementAction::Rollback,
            ) {
                Ok(_) => Err(format!(
                    "Save As script migration failed; destination project was restored: {error}"
                )),
                Err(rollback_error) => Err(format!(
                    "Save As script migration failed: {error}. Destination rollback also failed: {rollback_error}"
                )),
            }
        }
    }
}

/// The machine-local derived-frame cache root for a package (D-05):
/// `<app_data_dir>/frame-cache/<projectId>`, with `projectId` read from the
/// package manifest. `None` when the manifest or the app data dir is
/// unavailable: the cache leg is disposable (D-14), so a miss here is skipped
/// rather than raised — the derived frames are re-derived on demand.
fn machine_cache_root_for_package(
    app: &tauri::AppHandle,
    file_path: &str,
) -> Option<std::path::PathBuf> {
    let app_data_dir = app.path().app_data_dir().ok()?;
    let manifest = std::fs::read_to_string(file_path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&manifest).ok()?;
    let project_id = value.get("projectId")?.as_str()?;
    Some(crate::services::physic_paint_cache::resolve_machine_cache_root(
        &app_data_dir,
        project_id,
    ))
}

/// Open project from .mce file.
/// Also registers the project directory with the asset protocol scope.
#[command]
pub fn project_open(app: tauri::AppHandle, file_path: String) -> Result<MceProject, String> {
    let project_root = std::path::Path::new(&file_path)
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;

    // Canonicalize then register with asset protocol scope.
    // This resolves macOS Unicode normalization differences (NFC vs NFD)
    // that cause 403 errors on paths with accented characters.
    let canonical =
        std::fs::canonicalize(project_root).unwrap_or_else(|_| project_root.to_path_buf());
    // 52.2-05 (D-10): a package left mid-transaction by a crash is resolved
    // before anything reads it — roll forward only when every bound file
    // matches, otherwise back to the pre-save package.
    recover_package_transaction(&canonical)?;
    // The cache generation lives in the MACHINE-LOCAL root (D-05), keyed by the
    // manifest's project id; a missing manifest or app data dir skips the leg.
    if let Some(cache_root) = machine_cache_root_for_package(&app, &file_path) {
        recover_cache_transaction(&cache_root)?;
    }

    let scope = app.asset_protocol_scope();
    scope
        .allow_directory(&canonical, true)
        .map_err(|e| format!("Failed to register asset scope: {e}"))?;

    project_io::open_project(&file_path)
}

/// Check if a file path exists on disk.
/// Uses std::path::Path directly -- not restricted by Tauri FS scope.
#[command]
pub fn path_exists(file_path: String) -> bool {
    std::path::Path::new(&file_path).exists()
}

/// Move images and .thumbs from temp dir to real project dir
#[command]
pub fn project_migrate_temp_images(
    temp_dir: String,
    project_dir: String,
) -> Result<Vec<String>, String> {
    project_io::migrate_temp_images(&temp_dir, &project_dir)
}
