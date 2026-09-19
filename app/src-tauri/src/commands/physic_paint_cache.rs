//! The machine-local derived-frame cache command surface (52.2-05, D-05/D-14).
//!
//! Every command here addresses the MACHINE cache root
//! (`<app_data_dir>/frame-cache/<projectId>`), never a package directory: the
//! root is resolved once from the app data dir and passed in explicitly, so no
//! code path derives one root from the other (T-52.2-17).
//!
//! The leg is BEST-EFFORT (D-14): a cache-side failure is reported as a typed
//! soft failure (`accepted: false` plus a `diagnostic`) and never raised, so no
//! cache error can fail or roll back an authoritative save.

use crate::services::physic_paint_cache::{
    discard_cache_staging_generation, hardlink_cache_frames, prepare_cache_staging_generation,
    publish_cache_generation, remove_cache_relative_entry, resolve_machine_cache_root,
    settle_cache_generation, stage_cache_frame, CacheSettlementAction,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::http::HeaderMap;
use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PhysicPaintCacheCleanupStatus {
    Complete,
    Deferred,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicPaintCachePublicationResult {
    pub accepted: bool,
    pub transaction_id: String,
    pub replaced_existing: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PhysicPaintCacheSettlementAction {
    Commit,
    Rollback,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicPaintCacheSettlementResult {
    pub accepted: bool,
    pub cleanup_status: PhysicPaintCacheCleanupStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleanup_diagnostic: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicPaintCacheHardlinkResult {
    pub accepted: bool,
    pub missing: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<String>,
}

/// Resolve the machine-local derived-frame cache root for one package identity
/// (D-05): `<app_data_dir>/frame-cache/<projectId>`. This is the ONLY place the
/// cache root is constructed — the renderer hands the result back to the
/// publish/settle/hardlink commands, which never construct it themselves.
#[tauri::command]
pub fn resolve_physic_paint_cache_root(
    app: tauri::AppHandle,
    project_id: String,
) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the app data directory: {error}"))?;
    Ok(resolve_machine_cache_root(&app_data_dir, &project_id)
        .to_string_lossy()
        .into_owned())
}

#[tauri::command]
pub fn publish_physic_paint_cache_generation(
    cache_root: String,
    staging_basename: String,
) -> Result<PhysicPaintCachePublicationResult, String> {
    let cache_root = PathBuf::from(cache_root);
    match publish_cache_generation(&cache_root, &staging_basename) {
        Ok(publication) => Ok(PhysicPaintCachePublicationResult {
            accepted: true,
            transaction_id: publication.transaction_id,
            replaced_existing: publication.replaced_existing,
            diagnostic: None,
        }),
        Err(diagnostic) => Ok(PhysicPaintCachePublicationResult {
            accepted: false,
            transaction_id: String::new(),
            replaced_existing: false,
            diagnostic: Some(diagnostic),
        }),
    }
}

#[tauri::command]
pub fn settle_physic_paint_cache_generation(
    cache_root: String,
    transaction_id: String,
    action: PhysicPaintCacheSettlementAction,
) -> Result<PhysicPaintCacheSettlementResult, String> {
    let cache_root = PathBuf::from(cache_root);
    match settle_cache_generation(
        &cache_root,
        &transaction_id,
        match action {
            PhysicPaintCacheSettlementAction::Commit => CacheSettlementAction::Commit,
            PhysicPaintCacheSettlementAction::Rollback => CacheSettlementAction::Rollback,
        },
    ) {
        Ok(settlement) => Ok(PhysicPaintCacheSettlementResult {
            accepted: true,
            cleanup_status: if settlement.cleanup_deferred {
                PhysicPaintCacheCleanupStatus::Deferred
            } else {
                PhysicPaintCacheCleanupStatus::Complete
            },
            cleanup_diagnostic: settlement.cleanup_diagnostic,
        }),
        Err(diagnostic) => Ok(PhysicPaintCacheSettlementResult {
            accepted: false,
            cleanup_status: PhysicPaintCacheCleanupStatus::Complete,
            cleanup_diagnostic: Some(diagnostic),
        }),
    }
}

#[tauri::command]
pub fn hardlink_physic_paint_cache_frames(
    cache_root: String,
    staging_basename: String,
    unchanged_paths: Vec<String>,
) -> Result<PhysicPaintCacheHardlinkResult, String> {
    let cache_root = PathBuf::from(cache_root);
    match hardlink_cache_frames(&cache_root, &staging_basename, &unchanged_paths) {
        Ok(hardlink) => Ok(PhysicPaintCacheHardlinkResult {
            accepted: true,
            missing: hardlink.missing,
            diagnostic: None,
        }),
        Err(diagnostic) => Ok(PhysicPaintCacheHardlinkResult {
            accepted: false,
            missing: Vec::new(),
            diagnostic: Some(diagnostic),
        }),
    }
}

// --- quick-260913-05k: the cache staging lifecycle -------------------------
//
// The renderer's plugin-fs `mkdir` on `<root>/.efx-paint-staging-<uuid>` was
// refused live (`allow-mkdir` scope) although the path lives under the
// statically granted appdata scope, so the staging lifecycle runs as app
// commands like the package legs'. Prepare and stage answer with the same
// typed soft failure (`accepted: false` + diagnostic) as the publish/settle/
// hardlink commands (D-14); discard and remove are best-effort cleanup whose
// failure the caller records and ignores.

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicPaintCacheStagingResult {
    pub accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<String>,
}

fn staging_result(result: Result<(), String>) -> PhysicPaintCacheStagingResult {
    match result {
        Ok(()) => PhysicPaintCacheStagingResult {
            accepted: true,
            diagnostic: None,
        },
        Err(diagnostic) => PhysicPaintCacheStagingResult {
            accepted: false,
            diagnostic: Some(diagnostic),
        },
    }
}

#[tauri::command]
pub fn prepare_physic_paint_cache_generation(
    cache_root: String,
    staging_basename: String,
) -> Result<PhysicPaintCacheStagingResult, String> {
    Ok(staging_result(prepare_cache_staging_generation(
        &PathBuf::from(cache_root),
        &staging_basename,
    )))
}

fn staging_header(headers: &HeaderMap, name: &str) -> Result<String, String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            format!("stage_physic_paint_cache_frame: missing or invalid {name} header")
        })
}

/// Write one derived-frame sidecar into the staging generation. The frame
/// bytes cross as the raw invoke body with the scalars in request headers —
/// never a JSON number array — mirroring `efx_paint_write_frame_media`.
#[tauri::command(async)]
pub fn stage_physic_paint_cache_frame(
    request: Request,
) -> Result<PhysicPaintCacheStagingResult, String> {
    let headers = request.headers();
    let cache_root = staging_header(headers, "cacheRoot")?;
    let staging_basename = staging_header(headers, "stagingBasename")?;
    let relative_path = staging_header(headers, "relativePath")?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => {
            return Err(
                "stage_physic_paint_cache_frame: expected a raw byte body".to_string(),
            )
        }
    };
    Ok(staging_result(stage_cache_frame(
        &PathBuf::from(cache_root),
        &staging_basename,
        &relative_path,
        &bytes,
    )))
}

/// Discard one cache staging generation left behind by a failed save.
/// Best-effort by contract: the caller swallows a failure exactly as it
/// swallowed the plugin-fs removal before, because canonical publication
/// state is determined only by the transaction's own result.
#[tauri::command]
pub fn discard_physic_paint_cache_staging(
    cache_root: String,
    staging_basename: String,
) -> Result<(), String> {
    discard_cache_staging_generation(&PathBuf::from(cache_root), &staging_basename)
}

/// Remove one machine-relative entry under the canonical `efx-paint/`
/// generation at commit time (track deletions; the empty-documents canonical
/// removal). Non-authoritative cleanup: the caller records a failure and
/// commits regardless.
#[tauri::command]
pub fn remove_physic_paint_cache_entry(
    cache_root: String,
    relative: String,
) -> Result<(), String> {
    remove_cache_relative_entry(&PathBuf::from(cache_root), &relative)
}
