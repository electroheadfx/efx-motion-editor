use crate::services::physic_paint_cache::publish_cache_generation;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

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
    pub cleanup_status: PhysicPaintCacheCleanupStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cleanup_diagnostic: Option<String>,
}

#[tauri::command]
pub fn publish_physic_paint_cache_generation(
    project_dir: String,
    staging_basename: String,
) -> Result<PhysicPaintCachePublicationResult, String> {
    let project_dir = PathBuf::from(project_dir);
    let publication = publish_cache_generation(&project_dir, &staging_basename)?;

    if !publication.replaced_existing {
        return Ok(PhysicPaintCachePublicationResult {
            accepted: true,
            cleanup_status: PhysicPaintCacheCleanupStatus::Complete,
            cleanup_diagnostic: None,
        });
    }

    let staging_path = project_dir.join("cache").join(staging_basename);
    match fs::remove_dir_all(staging_path) {
        Ok(()) => Ok(PhysicPaintCachePublicationResult {
            accepted: true,
            cleanup_status: PhysicPaintCacheCleanupStatus::Complete,
            cleanup_diagnostic: None,
        }),
        Err(error) => Ok(PhysicPaintCachePublicationResult {
            accepted: true,
            cleanup_status: PhysicPaintCacheCleanupStatus::Deferred,
            cleanup_diagnostic: Some(format!(
                "Published Physics Paint cache; old generation cleanup was deferred: {error}"
            )),
        }),
    }
}
