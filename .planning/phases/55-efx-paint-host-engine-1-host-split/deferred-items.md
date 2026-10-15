# Deferred items — Phase 55-efx-paint-host-engine-1-host-split

## 55-05

**1. Pre-existing Rust capability pin failure (out of scope)**
- **Found during:** 55-05 GREEN verification (Rust script-library suite)
- **Test:** `app/src-tauri/tests/script_library_filesystem.rs` → `capability_split_denies_standalone_filesystem_authority`
- **Cause:** `capabilities/physics-paint.json` contains `"dialog:allow-open"` (landed in 49-04 image-library bridge). The pin forbids the substring `dialog:` in the standalone capability.
- **Status:** open — pre-existing, not introduced by 55-05's envelope cutover. Do not fold into another phase; fix in a dedicated capability cleanup.
