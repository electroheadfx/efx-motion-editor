use std::fs::{self, File};
use std::path::Path;

const CANONICAL_CACHE_BASENAME: &str = "physic-paint";
const STAGING_PREFIX: &str = ".physic-paint-staging-";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CachePublication {
    pub replaced_existing: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CacheSettlementAction {
    Commit,
    Rollback,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CacheSettlement {
    pub cleanup_deferred: bool,
    pub cleanup_diagnostic: Option<String>,
}

pub fn publish_cache_generation(
    project_dir: &Path,
    staging_basename: &str,
) -> Result<CachePublication, String> {
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (project_dir, staging_basename);
        return Err("Physics Paint cache publication is supported only on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        validate_staging_basename(staging_basename)?;
        let project_root = fs::canonicalize(project_dir).map_err(|error| {
            format!("Could not resolve Physics Paint project directory: {error}")
        })?;
        let cache_parent = fs::canonicalize(project_root.join("cache"))
            .map_err(|error| format!("Could not resolve Physics Paint cache parent: {error}"))?;
        if cache_parent.parent() != Some(project_root.as_path()) {
            return Err("Physics Paint cache parent escapes project authority".to_string());
        }

        let canonical_path = cache_parent.join(CANONICAL_CACHE_BASENAME);
        let staging_path = cache_parent.join(staging_basename);
        let resolved_staging = fs::canonicalize(&staging_path).map_err(|error| {
            format!("Could not resolve staged Physics Paint generation: {error}")
        })?;
        if resolved_staging.parent() != Some(cache_parent.as_path()) || !resolved_staging.is_dir() {
            return Err(
                "Physics Paint staging generation must be a direct sibling directory".to_string(),
            );
        }

        sync_directory_tree(&resolved_staging)?;

        if !canonical_path.exists() {
            fs::rename(&resolved_staging, &canonical_path).map_err(|error| {
                format!("Could not publish first Physics Paint cache generation: {error}")
            })?;
            return Ok(CachePublication {
                replaced_existing: false,
            });
        }

        let resolved_canonical = fs::canonicalize(&canonical_path)
            .map_err(|error| format!("Could not resolve canonical Physics Paint cache: {error}"))?;
        if resolved_canonical.parent() != Some(cache_parent.as_path())
            || !resolved_canonical.is_dir()
        {
            return Err("Canonical Physics Paint cache must be a contained directory".to_string());
        }

        atomic_exchange_directories(&resolved_staging, &resolved_canonical).map_err(|error| {
            format!("Could not atomically publish Physics Paint cache generation: {error}")
        })?;
        Ok(CachePublication {
            replaced_existing: true,
        })
    }
}

pub fn settle_cache_generation(
    project_dir: &Path,
    staging_basename: &str,
    action: CacheSettlementAction,
) -> Result<CacheSettlement, String> {
    validate_staging_basename(staging_basename)?;
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (project_dir, action);
        return Err("Physics Paint cache settlement is supported only on macOS".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let project_root = fs::canonicalize(project_dir).map_err(|error| {
            format!("Could not resolve Physics Paint project directory: {error}")
        })?;
        let cache_parent = fs::canonicalize(project_root.join("cache"))
            .map_err(|error| format!("Could not resolve Physics Paint cache parent: {error}"))?;
        if cache_parent.parent() != Some(project_root.as_path()) {
            return Err("Physics Paint cache parent escapes project authority".to_string());
        }
        let staging_path = cache_parent.join(staging_basename);
        let canonical_path = cache_parent.join(CANONICAL_CACHE_BASENAME);

        if !staging_path.exists() {
            if action == CacheSettlementAction::Rollback {
                let resolved_canonical = fs::canonicalize(&canonical_path).map_err(|error| {
                    format!("Could not resolve uncommitted Physics Paint cache generation: {error}")
                })?;
                if resolved_canonical.parent() != Some(cache_parent.as_path()) || !resolved_canonical.is_dir() {
                    return Err("Canonical Physics Paint cache must be a contained directory".to_string());
                }
                fs::remove_dir_all(&resolved_canonical).map_err(|error| {
                    format!("Could not remove uncommitted Physics Paint cache generation: {error}")
                })?;
            }
            return Ok(CacheSettlement {
                cleanup_deferred: false,
                cleanup_diagnostic: None,
            });
        }
        let resolved_staging = fs::canonicalize(&staging_path).map_err(|error| {
            format!("Could not resolve retained Physics Paint cache generation: {error}")
        })?;
        if resolved_staging.parent() != Some(cache_parent.as_path()) || !resolved_staging.is_dir() {
            return Err("Retained Physics Paint cache generation must be a direct sibling directory".to_string());
        }

        if action == CacheSettlementAction::Rollback {
            let resolved_canonical = fs::canonicalize(&canonical_path).map_err(|error| {
                format!("Could not resolve canonical Physics Paint cache: {error}")
            })?;
            if resolved_canonical.parent() != Some(cache_parent.as_path()) || !resolved_canonical.is_dir() {
                return Err("Canonical Physics Paint cache must be a contained directory".to_string());
            }
            atomic_exchange_directories(&resolved_staging, &resolved_canonical).map_err(|error| {
                format!("Could not roll back Physics Paint cache generation: {error}")
            })?;
        }

        match fs::remove_dir_all(&staging_path) {
            Ok(()) => Ok(CacheSettlement {
                cleanup_deferred: false,
                cleanup_diagnostic: None,
            }),
            Err(error) => Ok(CacheSettlement {
                cleanup_deferred: true,
                cleanup_diagnostic: Some(format!(
                    "Physics Paint cache settlement completed; obsolete generation cleanup was deferred: {error}"
                )),
            }),
        }
    }
}

fn validate_staging_basename(value: &str) -> Result<(), String> {
    let Some(token) = value.strip_prefix(STAGING_PREFIX) else {
        return Err("Invalid Physics Paint staging basename".to_string());
    };
    if token.is_empty()
        || value.len() > 160
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("Invalid Physics Paint staging basename".to_string());
    }
    Ok(())
}

fn sync_directory_tree(path: &Path) -> Result<(), String> {
    let entries = fs::read_dir(path)
        .map_err(|error| format!("Could not inspect staged Physics Paint generation: {error}"))?;
    for entry in entries {
        let entry = entry
            .map_err(|error| format!("Could not inspect staged Physics Paint entry: {error}"))?;
        let file_type = entry.file_type().map_err(|error| {
            format!("Could not inspect staged Physics Paint entry type: {error}")
        })?;
        if file_type.is_symlink() {
            return Err(
                "Staged Physics Paint generations cannot contain symbolic links".to_string(),
            );
        }
        if file_type.is_dir() {
            sync_directory_tree(&entry.path())?;
        } else if file_type.is_file() {
            File::open(entry.path())
                .and_then(|file| file.sync_all())
                .map_err(|error| {
                    format!("Could not synchronize staged Physics Paint file: {error}")
                })?;
        } else {
            return Err(
                "Staged Physics Paint generations can contain only files and directories"
                    .to_string(),
            );
        }
    }
    File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("Could not synchronize staged Physics Paint directory: {error}"))
}

#[cfg(target_os = "macos")]
fn atomic_exchange_directories(staging_path: &Path, canonical_path: &Path) -> std::io::Result<()> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let staging = CString::new(staging_path.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Physics Paint staging path contains an interior NUL byte",
        )
    })?;
    let canonical = CString::new(canonical_path.as_os_str().as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Physics Paint canonical path contains an interior NUL byte",
        )
    })?;

    // SAFETY: both C strings are validated, NUL-terminated path buffers. The
    // service constructs and contains both paths as direct siblings before
    // crossing this single FFI boundary. renameatx_np does not retain them.
    let result = unsafe {
        libc::renameatx_np(
            libc::AT_FDCWD,
            staging.as_ptr(),
            libc::AT_FDCWD,
            canonical.as_ptr(),
            libc::RENAME_SWAP,
        )
    };
    if result == 0 {
        Ok(())
    } else {
        Err(std::io::Error::last_os_error())
    }
}

#[cfg(not(target_os = "macos"))]
#[allow(dead_code)]
fn atomic_exchange_directories(
    _staging_path: &Path,
    _canonical_path: &Path,
) -> std::io::Result<()> {
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Physics Paint cache publication is supported only on macOS",
    ))
}
