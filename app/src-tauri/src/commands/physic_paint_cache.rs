use crate::services::physic_paint_cache::{
    publish_cache_generation, settle_cache_generation, CacheSettlementAction,
};
use serde::{Deserialize, Serialize};
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
    pub transaction_id: String,
    pub replaced_existing: bool,
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

#[tauri::command]
pub fn publish_physic_paint_cache_generation(
    project_dir: String,
    staging_basename: String,
) -> Result<PhysicPaintCachePublicationResult, String> {
    let project_dir = PathBuf::from(project_dir);
    let publication = publish_cache_generation(&project_dir, &staging_basename)?;
    Ok(PhysicPaintCachePublicationResult {
        accepted: true,
        transaction_id: publication.transaction_id,
        replaced_existing: publication.replaced_existing,
    })
}

#[tauri::command]
pub fn settle_physic_paint_cache_generation(
    project_dir: String,
    transaction_id: String,
    action: PhysicPaintCacheSettlementAction,
) -> Result<PhysicPaintCacheSettlementResult, String> {
    let project_dir = PathBuf::from(project_dir);
    let settlement = settle_cache_generation(
        &project_dir,
        &transaction_id,
        match action {
            PhysicPaintCacheSettlementAction::Commit => CacheSettlementAction::Commit,
            PhysicPaintCacheSettlementAction::Rollback => CacheSettlementAction::Rollback,
        },
    )?;
    Ok(PhysicPaintCacheSettlementResult {
        accepted: true,
        cleanup_status: if settlement.cleanup_deferred {
            PhysicPaintCacheCleanupStatus::Deferred
        } else {
            PhysicPaintCacheCleanupStatus::Complete
        },
        cleanup_diagnostic: settlement.cleanup_diagnostic,
    })
}
