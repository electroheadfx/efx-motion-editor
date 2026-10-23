//! quick-261023-l35: the Studio script snapshot commands.
//! quick-261023-o3n: an OPTIONAL `authority` header selects the `.mce` package
//! leg. The renderer sends only the opaque `scriptLibraryAuthority` capability
//! — NEVER a package path. The capability is exchanged for the canonical
//! package root by `ScriptLibraryState::resolve_authority_root`; an absent
//! header keeps the l35 app-cache leg (unsaved project), and a present-but-
//! invalid or stale capability is `refused` on both read and write with no
//! fallback, so a forged or stale token can never select a path.
//!
//! Both commands follow the `efx_paint_media.rs` shape: `#[tauri::command(async)]`
//! with a `Request`, the key scalars in request headers, and the snapshot bytes
//! as the raw invoke body — never a JSON array of integers.
//!
//! The cache root is resolved ONCE here from `app.path().app_data_dir()` and
//! handed to the service, so the service itself stays unit-testable against a
//! temp directory and the renderer never names a filesystem path. The read leg
//! returns base64 for the same reason `efx_paint_read_frame_media` does: a raw
//! response body degrades to a JSON number array on macOS.

use crate::commands::frame_codec::encode_base64;
use crate::services::efx_paint_media::EfxPaintMediaIoError;
use crate::services::script_library::ScriptLibraryState;
use crate::services::studio_script_snapshot::{
    delete_snapshot_legs, read_snapshot_preferring_package, snapshot_root,
    write_snapshot_preferring_package, SnapshotDeleteScope, StudioScriptSnapshotError,
};
use serde::Serialize;
use std::path::PathBuf;
use tauri::http::HeaderMap;
use tauri::ipc::{InvokeBody, Request};
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioScriptSnapshotWriteResponse {
    pub byte_length: u64,
    pub digest: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioScriptSnapshotReadResponse {
    pub byte_length: u64,
    pub digest: String,
    /// Base64-encoded SNAP v1 container. Never a raw response body.
    pub bytes_base64: String,
}

/// quick-261023-ors: what a successful delete removed on each leg.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioScriptSnapshotDeleteResponse {
    pub cache_removed: bool,
    pub package_removed: bool,
}

fn io_error(message: impl Into<String>) -> StudioScriptSnapshotError {
    StudioScriptSnapshotError::Io(EfxPaintMediaIoError::new(message))
}

fn header(headers: &HeaderMap, name: &str) -> Result<String, StudioScriptSnapshotError> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            io_error(format!(
                "studio_script_snapshot: missing or invalid {name} header"
            ))
        })
}

fn snapshot_root_for(
    app: &tauri::AppHandle,
) -> Result<std::path::PathBuf, StudioScriptSnapshotError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| io_error(format!("Could not resolve the app data directory: {error}")))?;
    Ok(snapshot_root(&app_data_dir))
}

/// Resolve the OPTIONAL package root from the request's opaque capability.
///
/// Absent header → `Ok(None)`: the unsaved-project / l35 cache leg. A present
/// header that is not valid UTF-8, is empty, or is not the ACTIVE binding is
/// `Refused` — never a guessed path, and the resolver's message is never
/// surfaced.
fn optional_authority_root(
    state: &ScriptLibraryState,
    headers: &HeaderMap,
) -> Result<Option<PathBuf>, StudioScriptSnapshotError> {
    let Some(value) = headers.get("authority") else {
        return Ok(None);
    };
    let authority = value
        .to_str()
        .map_err(|_| StudioScriptSnapshotError::Refused)?;
    if authority.is_empty() {
        return Err(StudioScriptSnapshotError::Refused);
    }
    state
        .resolve_authority_root(authority)
        .map(Some)
        .map_err(|_| StudioScriptSnapshotError::Refused)
}

/// quick-261023-ors: parse the delete scope. ONLY `cache` and `both` are
/// accepted; a missing, empty or foreign value is `Refused` before any path is
/// resolved, so a crafted scope can never widen a delete.
fn parse_delete_scope(headers: &HeaderMap) -> Result<SnapshotDeleteScope, StudioScriptSnapshotError> {
    match headers
        .get("scope")
        .and_then(|value| value.to_str().ok())
    {
        Some("cache") => Ok(SnapshotDeleteScope::Cache),
        Some("both") => Ok(SnapshotDeleteScope::Both),
        _ => Err(StudioScriptSnapshotError::Refused),
    }
}

/// Writes one key's script snapshot atomically. A bound authority writes the
/// `.mce` package copy; no authority writes the machine cache — never both.
#[tauri::command(async)]
pub fn studio_script_snapshot_write(
    app: tauri::AppHandle,
    state: tauri::State<'_, ScriptLibraryState>,
    request: Request,
) -> Result<StudioScriptSnapshotWriteResponse, StudioScriptSnapshotError> {
    let headers = request.headers();
    let project_id = header(headers, "projectId")?;
    let layer_id = header(headers, "layerId")?;
    let track_id = header(headers, "trackId")?;
    let package_root = optional_authority_root(&state, headers)?;
    let root = snapshot_root_for(&app)?;
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => {
            return Err(io_error(
                "studio_script_snapshot_write: expected a raw byte body",
            ))
        }
    };
    let result = write_snapshot_preferring_package(
        &root,
        package_root.as_deref(),
        &project_id,
        &layer_id,
        &track_id,
        &bytes,
    )?;
    Ok(StudioScriptSnapshotWriteResponse {
        byte_length: result.byte_length,
        digest: result.digest,
    })
}

/// Reads one key's script snapshot back. An absent snapshot maps to the
/// `missing` label — the renderer treats that as the silent no-op first session.
/// Package copy first; the cache is consulted only when the package copy is
/// missing (a corrupt/foreign package copy fails closed).
#[tauri::command(async)]
pub fn studio_script_snapshot_read(
    app: tauri::AppHandle,
    state: tauri::State<'_, ScriptLibraryState>,
    request: Request,
) -> Result<StudioScriptSnapshotReadResponse, StudioScriptSnapshotError> {
    let headers = request.headers();
    let project_id = header(headers, "projectId")?;
    let layer_id = header(headers, "layerId")?;
    let track_id = header(headers, "trackId")?;
    let package_root = optional_authority_root(&state, headers)?;
    let root = snapshot_root_for(&app)?;
    let outcome = read_snapshot_preferring_package(
        &root,
        package_root.as_deref(),
        &project_id,
        &layer_id,
        &track_id,
    )?;
    Ok(StudioScriptSnapshotReadResponse {
        byte_length: outcome.snapshot.byte_length,
        digest: outcome.snapshot.digest,
        bytes_base64: encode_base64(&outcome.snapshot.bytes),
    })
}

/// Deletes one key's script snapshot legs (quick-261023-ors).
///
/// `scope: cache` removes only the app-cache fallback — the purge's cleanup
/// after it rewrote the authoritative package copy. `scope: both` removes the
/// cache leg and, when a live authority resolves, the package leg too — the
/// rail-deletion cascade. A stale or forged authority is `refused` before any
/// path is resolved; an absent authority with `scope: both` deletes only the
/// cache (the unsaved-project case). Every key component passes the key law
/// before any join, and only the exact `<trackId>-v1.snap` leaf is removed.
#[tauri::command(async)]
pub fn studio_script_snapshot_delete(
    app: tauri::AppHandle,
    state: tauri::State<'_, ScriptLibraryState>,
    request: Request,
) -> Result<StudioScriptSnapshotDeleteResponse, StudioScriptSnapshotError> {
    let headers = request.headers();
    let project_id = header(headers, "projectId")?;
    let layer_id = header(headers, "layerId")?;
    let track_id = header(headers, "trackId")?;
    let scope = parse_delete_scope(headers)?;
    let package_root = optional_authority_root(&state, headers)?;
    let root = snapshot_root_for(&app)?;
    let outcome = delete_snapshot_legs(
        &root,
        package_root.as_deref(),
        &project_id,
        &layer_id,
        &track_id,
        scope,
    )?;
    Ok(StudioScriptSnapshotDeleteResponse {
        cache_removed: outcome.cache_removed,
        package_removed: outcome.package_removed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tauri::http::HeaderValue;

    fn fixture_root(tag: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "efx-studio-snapshot-command-{tag}-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("fixture root");
        root
    }

    #[test]
    fn absent_authority_header_takes_the_cache_leg() {
        let state = crate::services::script_library::ScriptLibraryState::default();
        let headers = HeaderMap::new();
        assert_eq!(optional_authority_root(&state, &headers).expect("absent"), None);
    }

    #[test]
    fn a_bound_authority_resolves_to_the_canonical_package_root() {
        let root = fixture_root("bound");
        let state = crate::services::script_library::ScriptLibraryState::default();
        let authority = state.bind(&root).expect("bind");
        let mut headers = HeaderMap::new();
        headers.insert("authority", HeaderValue::from_str(&authority).expect("header"));
        assert_eq!(
            optional_authority_root(&state, &headers).expect("bound"),
            Some(fs::canonicalize(&root).expect("canonical root"))
        );
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    #[test]
    fn delete_scope_accepts_only_cache_and_both() {
        let mut headers = HeaderMap::new();
        assert_eq!(
            parse_delete_scope(&headers).unwrap_err(),
            StudioScriptSnapshotError::Refused
        );
        headers.insert("scope", HeaderValue::from_static("cache"));
        assert_eq!(
            parse_delete_scope(&headers).expect("cache scope"),
            SnapshotDeleteScope::Cache
        );
        headers.insert("scope", HeaderValue::from_static("both"));
        assert_eq!(
            parse_delete_scope(&headers).expect("both scope"),
            SnapshotDeleteScope::Both
        );
        for crafted in ["", "package", "BOTH", "cache ", "all"] {
            let mut bad = HeaderMap::new();
            bad.insert("scope", HeaderValue::from_str(crafted).expect("header"));
            assert_eq!(
                parse_delete_scope(&bad).unwrap_err(),
                StudioScriptSnapshotError::Refused,
                "expected scope refusal: {crafted:?}"
            );
        }
    }

    #[test]
    fn a_stale_authority_is_refused_before_the_delete_resolves_a_package() {
        let root = fixture_root("delete-stale");
        let state = crate::services::script_library::ScriptLibraryState::default();
        let authority = state.bind(&root).expect("bind");
        state.clear().expect("clear");
        let mut headers = HeaderMap::new();
        headers.insert("scope", HeaderValue::from_static("both"));
        headers.insert(
            "authority",
            HeaderValue::from_str(&authority).expect("header"),
        );
        assert_eq!(
            optional_authority_root(&state, &headers).unwrap_err(),
            StudioScriptSnapshotError::Refused
        );
        fs::remove_dir_all(root).expect("fixture cleanup");
    }

    #[test]
    fn a_present_but_unresolvable_authority_is_refused_on_both_legs() {
        let state = crate::services::script_library::ScriptLibraryState::default();
        let mut stale = HeaderMap::new();
        stale.insert("authority", HeaderValue::from_static("stale-token"));
        assert_eq!(
            optional_authority_root(&state, &stale).unwrap_err(),
            StudioScriptSnapshotError::Refused
        );

        let mut empty = HeaderMap::new();
        empty.insert("authority", HeaderValue::from_static(""));
        assert_eq!(
            optional_authority_root(&state, &empty).unwrap_err(),
            StudioScriptSnapshotError::Refused
        );

        let mut invalid_utf8 = HeaderMap::new();
        invalid_utf8.insert("authority", HeaderValue::from_bytes(b"\xff\xfe").expect("raw header"));
        assert_eq!(
            optional_authority_root(&state, &invalid_utf8).unwrap_err(),
            StudioScriptSnapshotError::Refused
        );

        // An authority bound in a previous project lifecycle is stale after clear.
        let root = fixture_root("stale");
        let authority = state.bind(&root).expect("bind");
        state.clear().expect("clear");
        let mut cleared = HeaderMap::new();
        cleared.insert(
            "authority",
            HeaderValue::from_str(&authority).expect("header"),
        );
        assert_eq!(
            optional_authority_root(&state, &cleared).unwrap_err(),
            StudioScriptSnapshotError::Refused
        );
        fs::remove_dir_all(root).expect("fixture cleanup");
    }
}
