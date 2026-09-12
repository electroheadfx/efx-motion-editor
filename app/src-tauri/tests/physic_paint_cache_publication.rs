//! Transaction tests for `services/physic_paint_cache.rs` (52.2-05).
//!
//! Two transactions live in that module, so both are tested here:
//!
//! * the AUTHORITATIVE package transaction — manifest + `layers/*.json` +
//!   changed `frames/*.webp` staged inside the package, per-file atomic
//!   publish, digest-bound commit/rollback and open-time recovery;
//! * the DISPOSABLE machine-local cache generation (the directory swap the
//!   module was originally built for), which no longer binds a project write.
//!
//! The cache leg's project binding is gone (52.2-05 Task 1 clause (f)): a
//! cache marker found at open is always rolled back, and the authoritative
//! package transaction never consults it.

use efx_motion_editor_lib::efx_paint_media::{digest_bytes, PACKAGE_STAGING_PREFIX};
use efx_motion_editor_lib::physic_paint_cache::{
    bind_package_transaction, publish_cache_generation, publish_package_transaction,
    recover_cache_transaction, recover_package_transaction, settle_cache_generation,
    settle_package_transaction, CacheSettlementAction, PackageBinding,
    PackageSettlementAction,
};
use efx_motion_editor_lib::physic_paint_cache_command::{
    publish_physic_paint_cache_generation, settle_physic_paint_cache_generation,
    PhysicPaintCacheCleanupStatus, PhysicPaintCacheSettlementAction,
};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const STAGING_BASENAME: &str = ".efx-paint-staging-test";
const TRANSACTION_MARKER: &str = "cache/.physic-paint-transaction.json";
const PACKAGE_STAGING_BASENAME: &str = ".efx-paint-package-staging-test-generation";
const PACKAGE_MARKER: &str = ".efx-paint-package-transaction.json";

fn fixture_dir(tag: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock must follow unix epoch")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "efx-physic-paint-cache-{tag}-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(root.join("cache")).expect("fixture cache directory");
    root
}

fn canonical_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("cache/efx-paint")
}

fn staging_dir(project_dir: &Path) -> PathBuf {
    project_dir.join("cache").join(STAGING_BASENAME)
}

fn write_generation(path: &Path, generation: &str) {
    fs::create_dir_all(path.join("nested")).expect("generation directory");
    fs::write(path.join(format!("{generation}-manifest")), generation).expect("manifest write");
    fs::write(path.join(format!("{generation}-frame-a.png")), generation).expect("frame a write");
    fs::write(path.join(format!("{generation}-frame-b.png")), generation).expect("frame b write");
    fs::write(path.join("nested/frame.png"), generation).expect("nested frame write");
}

fn generation_file_names(path: &Path) -> BTreeSet<String> {
    fs::read_dir(path)
        .expect("generation must remain reachable")
        .filter_map(|entry| {
            let name = entry
                .expect("valid generation entry")
                .file_name()
                .to_string_lossy()
                .into_owned();
            (!name.starts_with(".physic-paint-transaction-")).then_some(name)
        })
        .collect()
}

fn assert_generation(path: &Path, generation: &str) {
    assert_eq!(
        generation_file_names(path),
        BTreeSet::from([
            format!("{generation}-frame-a.png"),
            format!("{generation}-frame-b.png"),
            format!("{generation}-manifest"),
            "nested".to_string(),
        ])
    );
    assert_eq!(
        fs::read_to_string(path.join("nested/frame.png")).expect("nested frame remains readable"),
        generation
    );
}

fn assert_transaction_settled(project: &Path) {
    assert!(!project.join(TRANSACTION_MARKER).exists());
}

// --- 52.2-05 package transaction fixtures --------------------------------

fn package_fixture(tag: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock must follow unix epoch")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "efx-package-transaction-{tag}-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(&root).expect("fixture package directory");
    root
}

fn package_staging(package: &Path) -> PathBuf {
    package.join(PACKAGE_STAGING_BASENAME)
}

fn stage_file(package: &Path, relative: &str, bytes: &[u8]) -> PathBuf {
    let path = package_staging(package).join(relative);
    fs::create_dir_all(path.parent().expect("staged parent")).expect("staged parent directory");
    fs::write(&path, bytes).expect("staged file write");
    path
}

fn canonical_file(package: &Path, relative: &str) -> PathBuf {
    package.join(relative)
}

fn write_canonical(package: &Path, relative: &str, bytes: &[u8]) {
    let path = canonical_file(package, relative);
    fs::create_dir_all(path.parent().expect("canonical parent"))
        .expect("canonical parent directory");
    fs::write(&path, bytes).expect("canonical file write");
}

fn bound_paths(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|path| (*path).to_string()).collect()
}

fn assert_package_settled(package: &Path) {
    assert!(
        !package.join(PACKAGE_MARKER).exists(),
        "the package transaction marker must be gone"
    );
    assert!(
        !package_staging(package).exists(),
        "the package staging generation must be gone"
    );
}

/// Write `project.mce`-shaped marker JSON by hand: a marker on disk is
/// untrusted input (T-52.2-14), so the tests must be able to forge one.
fn write_raw_marker(package: &Path, transaction_id: &str, phase: &str, entries: &[(&str, &str, bool)]) {
    let entries = entries
        .iter()
        .map(|(path, sha256, had_original)| {
            format!(
                "{{\"path\":\"{path}\",\"sha256\":\"{sha256}\",\"had_original\":{had_original}}}"
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    let marker = format!(
        "{{\"version\":1,\"transaction_id\":\"{transaction_id}\",\"staging_basename\":\"{PACKAGE_STAGING_BASENAME}\",\"phase\":\"{phase}\",\"expected_files\":[{entries}]}}"
    );
    fs::write(package.join(PACKAGE_MARKER), marker).expect("forged marker write");
}

fn write_binding_marker(package: &Path, binding: &PackageBinding, phase: &str) {
    let entries = binding
        .entries
        .iter()
        .map(|entry| (entry.path.as_str(), entry.sha256.as_str(), entry.had_original))
        .collect::<Vec<_>>();
    write_raw_marker(package, &binding.transaction_id, phase, &entries);
}

#[test]
fn first_publication_moves_the_complete_staged_generation_to_canonical() {
    let project = fixture_dir("first");
    write_generation(&staging_dir(&project), "new");

    let result = publish_cache_generation(&project, STAGING_BASENAME).expect("first publication");

    assert!(!result.replaced_existing);
    assert!(Uuid::parse_str(&result.transaction_id).is_ok());
    assert_generation(&canonical_dir(&project), "new");
    assert!(!staging_dir(&project).exists());
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn replacement_atomically_exchanges_complete_generations() {
    let project = fixture_dir("exchange");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");

    let result =
        publish_cache_generation(&project, STAGING_BASENAME).expect("replacement publication");

    assert!(result.replaced_existing);
    assert_generation(&canonical_dir(&project), "new");
    assert_generation(&staging_dir(&project), "old");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn rollback_restores_the_previous_canonical_generation() {
    let project = fixture_dir("rollback-existing");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");

    let publication = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("replacement publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        publication.transaction_id,
        PhysicPaintCacheSettlementAction::Rollback,
    )
    .expect("rollback settlement");

    assert_generation(&canonical_dir(&project), "old");
    assert!(!staging_dir(&project).exists());
    assert_transaction_settled(&project);
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn rollback_removes_an_uncommitted_first_generation() {
    let project = fixture_dir("rollback-first");
    write_generation(&staging_dir(&project), "new");

    let publication = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("first publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        publication.transaction_id,
        PhysicPaintCacheSettlementAction::Rollback,
    )
    .expect("rollback settlement");

    assert!(!canonical_dir(&project).exists());
    assert!(!staging_dir(&project).exists());
    assert_transaction_settled(&project);
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn rollback_replay_after_commit_is_rejected_without_mutating_canonical() {
    let project = fixture_dir("rollback-replay");
    write_generation(&staging_dir(&project), "new");

    let publication = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        publication.transaction_id.clone(),
        PhysicPaintCacheSettlementAction::Commit,
    )
    .expect("commit settlement");

    let replay = settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        publication.transaction_id,
        PhysicPaintCacheSettlementAction::Rollback,
    );

    assert!(
        replay.is_err(),
        "a settled publication must not be replayable"
    );
    assert_generation(&canonical_dir(&project), "new");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn delayed_rollback_cannot_delete_a_newer_canonical_generation() {
    let project = fixture_dir("delayed-rollback");
    let first_staging = ".efx-paint-staging-first";
    let second_staging = ".efx-paint-staging-second";
    write_generation(&project.join("cache").join(first_staging), "g1");

    let first = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        first_staging.to_string(),
    )
    .expect("first publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        first.transaction_id.clone(),
        PhysicPaintCacheSettlementAction::Commit,
    )
    .expect("first commit");

    write_generation(&project.join("cache").join(second_staging), "g2");
    let second = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        second_staging.to_string(),
    )
    .expect("second publication");

    let delayed = settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        first.transaction_id,
        PhysicPaintCacheSettlementAction::Rollback,
    );

    assert!(
        delayed.is_err(),
        "an older publication cannot settle a newer one"
    );
    assert_generation(&canonical_dir(&project), "g2");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        second.transaction_id,
        PhysicPaintCacheSettlementAction::Rollback,
    )
    .expect("second rollback");
    assert_generation(&canonical_dir(&project), "g1");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn rollback_request_after_publication_never_consults_the_package() {
    // 52.2-05 Task 1 clause (f): the cache generation no longer binds a
    // project write, so a Rollback after publication always restores the
    // previous generation — no durable-bytes comparison can commit it.
    let project = fixture_dir("rollback-after-publication");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");
    let publication = publish_cache_generation(&project, STAGING_BASENAME).expect("publication");
    // A durable project file sitting next to the cache has no say any more.
    fs::write(project.join("project.mce"), b"accepted-project").expect("project file");

    settle_cache_generation(
        &project,
        &publication.transaction_id,
        CacheSettlementAction::Rollback,
    )
    .expect("rollback");

    assert_generation(&canonical_dir(&project), "old");
    assert!(!staging_dir(&project).exists());
    assert_transaction_settled(&project);
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn wrong_transaction_id_is_rejected_without_mutating_authority() {
    let project = fixture_dir("wrong-id");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");
    let publication = publish_cache_generation(&project, STAGING_BASENAME).expect("publication");

    let result = settle_cache_generation(
        &project,
        &Uuid::new_v4().to_string(),
        CacheSettlementAction::Rollback,
    );

    assert!(result.is_err());
    assert_generation(&canonical_dir(&project), "new");
    settle_cache_generation(
        &project,
        &publication.transaction_id,
        CacheSettlementAction::Rollback,
    )
    .expect("authoritative rollback");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn recovery_always_rolls_back_an_uncommitted_generation() {
    // Re-derivation is always safe (D-05/D-14), so an uncommitted cache
    // generation found at open must never be rolled forward: committing a
    // generation derived from an uncommitted save could publish wrong pixels.
    let project = fixture_dir("recover-cache");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");
    let publication = publish_cache_generation(&project, STAGING_BASENAME).expect("publication");

    let recovered = recover_cache_transaction(&project)
        .expect("recovery")
        .expect("active transaction");

    assert!(!recovered.cleanup_deferred);
    assert!(Uuid::parse_str(&publication.transaction_id).is_ok());
    assert_generation(&canonical_dir(&project), "old");
    assert!(!staging_dir(&project).exists());
    assert_transaction_settled(&project);
    assert!(recover_cache_transaction(&project)
        .expect("repeated recovery")
        .is_none());
    assert_generation(&canonical_dir(&project), "old");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn recovery_removes_an_interrupted_uncommitted_first_generation() {
    let project = fixture_dir("recover-first");
    write_generation(&staging_dir(&project), "new");
    publish_cache_generation(&project, STAGING_BASENAME).expect("publication");

    recover_cache_transaction(&project).expect("recovery");

    assert!(!canonical_dir(&project).exists());
    assert_transaction_settled(&project);
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn failed_exchange_leaves_the_old_canonical_generation_unchanged() {
    use std::os::unix::fs::PermissionsExt;

    let project = fixture_dir("exchange-failure");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");
    let cache_parent = project.join("cache");
    let original_mode = fs::metadata(&cache_parent)
        .expect("cache metadata")
        .permissions()
        .mode();
    fs::set_permissions(&cache_parent, fs::Permissions::from_mode(0o555))
        .expect("deny directory exchange");

    let result = publish_cache_generation(&project, STAGING_BASENAME);

    fs::set_permissions(&cache_parent, fs::Permissions::from_mode(original_mode))
        .expect("restore fixture permissions");
    assert!(result.is_err(), "exchange must fail before publication");
    assert_generation(&canonical_dir(&project), "old");
    assert_generation(&staging_dir(&project), "new");
    assert_transaction_settled(&project);
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn repeated_exchanges_never_make_canonical_absent_or_mix_directory_entries() {
    let project = fixture_dir("concurrent");
    write_generation(&canonical_dir(&project), "g0");
    let running = Arc::new(AtomicBool::new(true));
    let reader_running = Arc::clone(&running);
    let reader_project = project.clone();
    let reader = thread::spawn(move || {
        while reader_running.load(Ordering::Acquire) {
            let names = generation_file_names(&canonical_dir(&reader_project));
            let generations = names
                .iter()
                .filter(|name| name.starts_with('g'))
                .filter_map(|name| name.split('-').next())
                .collect::<BTreeSet<_>>();
            assert_eq!(
                generations.len(),
                1,
                "reader observed mixed generation entries: {names:?}"
            );
        }
    });

    for index in 1..=24 {
        let generation = format!("g{index}");
        write_generation(&staging_dir(&project), &generation);
        let publication =
            publish_cache_generation(&project, STAGING_BASENAME).expect("atomic replacement");
        settle_cache_generation(
            &project,
            &publication.transaction_id,
            CacheSettlementAction::Commit,
        )
        .expect("commit generation");
    }

    running.store(false, Ordering::Release);
    reader.join().expect("reader invariant");
    assert_generation(&canonical_dir(&project), "g24");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn command_accepts_publication_when_old_generation_cleanup_is_deferred() {
    use std::os::unix::fs::PermissionsExt;

    let project = fixture_dir("cleanup-deferred");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");
    let original_mode = fs::metadata(canonical_dir(&project))
        .expect("canonical metadata")
        .permissions()
        .mode();
    fs::set_permissions(canonical_dir(&project), fs::Permissions::from_mode(0o555))
        .expect("deny old-generation cleanup");

    let publication = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("publication remains accepted");
    let result = settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        publication.transaction_id,
        PhysicPaintCacheSettlementAction::Commit,
    )
    .expect("commit remains accepted");

    assert!(publication.accepted);
    assert!(result.accepted);
    assert_eq!(
        result.cleanup_status,
        PhysicPaintCacheCleanupStatus::Deferred
    );
    assert!(result.cleanup_diagnostic.is_some());
    assert_generation(&canonical_dir(&project), "new");
    assert_generation(&staging_dir(&project), "old");
    fs::set_permissions(
        staging_dir(&project),
        fs::Permissions::from_mode(original_mode),
    )
    .expect("restore fixture permissions");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[test]
fn invoke_handler_registers_publish_and_settle_commands() {
    let source = include_str!("../src/lib.rs");
    assert!(source.contains("physic_paint_cache_commands::publish_physic_paint_cache_generation"));
    assert!(source.contains("physic_paint_cache_commands::settle_physic_paint_cache_generation"));
}

#[test]
fn invalid_staging_authority_rejects_before_any_mutation() {
    let invalid_names = [
        "efx-paint-staging-test",
        ".efx-paint-staging-",
        ".efx-paint-staging-../escape",
        ".efx-paint-staging-child/path",
        "/tmp/.efx-paint-staging-absolute",
        ".efx-paint-staging-child\\path",
    ];

    for (index, invalid) in invalid_names.into_iter().enumerate() {
        let project = fixture_dir(&format!("invalid-{index}"));
        write_generation(&canonical_dir(&project), "old");

        let result = publish_cache_generation(&project, invalid);

        assert!(
            result.is_err(),
            "invalid staging basename must reject: {invalid}"
        );
        assert_generation(&canonical_dir(&project), "old");
        fs::remove_dir_all(project).expect("fixture cleanup");
    }
}

#[cfg(not(target_os = "macos"))]
#[test]
fn unsupported_platform_rejects_without_touching_canonical_authority() {
    let project = fixture_dir("unsupported");
    write_generation(&canonical_dir(&project), "old");
    write_generation(&staging_dir(&project), "new");

    let result = publish_cache_generation(&project, STAGING_BASENAME);

    assert!(result.is_err());
    assert_generation(&canonical_dir(&project), "old");
    assert_generation(&staging_dir(&project), "new");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

// --- 52.2-05 package transaction cases -----------------------------------
//
// The authoritative transaction is NOT platform-gated: every case below runs
// wherever the suite runs, unlike the macOS-only directory-swap cases above.

#[test]
fn package_bind_hashes_the_staged_bytes_and_records_original_presence() {
    let package = package_fixture("bind");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");

    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json"]),
    )
    .expect("package bind");

    assert!(Uuid::parse_str(&binding.transaction_id).is_ok());
    assert_eq!(binding.entries.len(), 2);
    // The entry list is path-sorted, never discovery order.
    assert_eq!(binding.entries[0].path, "layers/L1.json");
    assert!(!binding.entries[0].had_original);
    assert_eq!(binding.entries[0].sha256, digest_bytes(b"{\"layer\":\"L1\"}"));
    assert_eq!(binding.entries[1].path, "project.mce");
    assert!(binding.entries[1].had_original);
    // The digest is the STAGED bytes: exactly what publish will land.
    assert_eq!(binding.entries[1].sha256, digest_bytes(b"new-manifest"));
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_aggregate_digest_is_independent_of_discovery_order() {
    let package = package_fixture("order");
    stage_file(&package, "project.mce", b"manifest");
    stage_file(&package, "layers/L1.json", b"layer-one");
    stage_file(&package, "frames/L1/K1.webp", b"frame-one");

    let forward = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json", "frames/L1/K1.webp"]),
    )
    .expect("forward bind");
    let reordered = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["frames/L1/K1.webp", "project.mce", "layers/L1.json"]),
    )
    .expect("reordered bind");

    assert_eq!(
        forward.aggregate_digest, reordered.aggregate_digest,
        "the same file set must bind the same digest regardless of discovery order"
    );
    assert_eq!(forward.entries, reordered.entries);
    assert_eq!(
        forward.transaction_id, reordered.transaction_id,
        "an identical re-bind is a no-op on the already-bound transaction"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_rebind_with_a_different_set_is_refused_without_rebasing() {
    let package = package_fixture("rebind");
    stage_file(&package, "project.mce", b"manifest");
    stage_file(&package, "layers/L1.json", b"layer-one");
    let first = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json"]),
    )
    .expect("first bind");
    stage_file(&package, "frames/L1/K1.webp", b"frame-one");

    let refusal = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "frames/L1/K1.webp"]),
    )
    .expect_err("a different set must never silently rebase");

    assert!(
        refusal.contains("frames/L1/K1.webp"),
        "the refusal must name the differing path: {refusal}"
    );
    // The original binding is untouched and still the active transaction.
    assert_eq!(first.entries.len(), 2);
    assert!(recover_package_transaction(&package)
        .expect("recovery")
        .is_some());
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_bind_refuses_every_path_outside_the_bound_file_set() {
    let package = package_fixture("guard");
    for relative in [
        "images/a.webp",
        "cache/efx-paint/a.webp",
        "efx-paint/frame-0001.webp",
        "scripts/x.json",
        "paint/L1/frame-000001.json",
    ] {
        stage_file(&package, relative, b"staged-anyway");
    }
    stage_file(&package, "frames/L1/K1.png", b"staged-png");

    for relative in [
        "images/a.webp",
        "cache/efx-paint/a.webp",
        "efx-paint/frame-0001.webp",
        "scripts/x.json",
        "paint/L1/frame-000001.json",
        "frames/L1/K1.png",
    ] {
        let refusal = bind_package_transaction(
            &package,
            PACKAGE_STAGING_BASENAME,
            &bound_paths(&[relative]),
        )
        .expect_err(&format!("expected refusal: {relative}"));
        assert!(
            refusal.contains(relative),
            "the refusal must name the path: {refusal}"
        );
        assert!(
            !package.join(PACKAGE_MARKER).exists(),
            "a refused bind must not write a marker"
        );
    }

    // The typed plan-01 taxonomy is surfaced by label.
    let unsupported = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["images/a.webp"]),
    )
    .expect_err("images/ is not in the bound file set");
    assert!(
        unsupported.contains("unsupportedPackagePath"),
        "{unsupported}"
    );
    let wrong_extension = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["frames/L1/K1.png"]),
    )
    .expect_err("the frames/ lock accepts only .webp");
    assert!(wrong_extension.contains("wrongExtension"), "{wrong_extension}");

    // `..`, absolute paths and Windows separators never reach the staging tree.
    for relative in ["../escape", "/absolute/path", "frames\\L1\\K1.webp", ""] {
        assert!(
            bind_package_transaction(
                &package,
                PACKAGE_STAGING_BASENAME,
                &bound_paths(&[relative])
            )
            .is_err(),
            "expected refusal: {relative}"
        );
    }
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_bind_refuses_an_unvalidated_staging_basename_before_writing() {
    for (index, basename) in [
        ".efx-paint-package-staging-",
        ".efx-paint-package-staging-../escape",
        "/tmp/.efx-paint-package-staging-absolute",
        ".efx-paint-staging-legacy",
        ".efx-paint-package-staging-child/path",
        "",
    ]
    .into_iter()
    .enumerate()
    {
        let package = package_fixture(&format!("basename-{index}"));
        stage_file(&package, "project.mce", b"manifest");

        assert!(
            bind_package_transaction(&package, basename, &bound_paths(&["project.mce"])).is_err(),
            "expected refusal: {basename}"
        );
        assert!(!package.join(PACKAGE_MARKER).exists());
        fs::remove_dir_all(package).expect("fixture cleanup");
    }
}

#[test]
fn package_bind_refuses_an_empty_duplicated_or_unstaged_set() {
    let package = package_fixture("set-shape");
    stage_file(&package, "project.mce", b"manifest");

    assert!(
        bind_package_transaction(&package, PACKAGE_STAGING_BASENAME, &Vec::<String>::new()).is_err(),
        "an empty set cannot be bound"
    );
    assert!(
        bind_package_transaction(
            &package,
            PACKAGE_STAGING_BASENAME,
            &bound_paths(&["project.mce", "project.mce"])
        )
        .is_err(),
        "a duplicate path cannot be bound"
    );
    assert!(
        bind_package_transaction(
            &package,
            PACKAGE_STAGING_BASENAME,
            &bound_paths(&["layers/L1.json"])
        )
        .is_err(),
        "a bound path with no staged file cannot be bound"
    );
    assert!(
        bind_package_transaction(
            &package,
            &format!("{PACKAGE_STAGING_PREFIX}{}", Uuid::new_v4()),
            &bound_paths(&["project.mce"])
        )
        .is_err(),
        "an absent staging root cannot be bound"
    );
    assert!(!package.join(PACKAGE_MARKER).exists());
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_bind_leaves_every_canonical_path_at_its_pre_save_bytes() {
    let package = package_fixture("untouched");
    write_canonical(&package, "project.mce", b"old-manifest");
    write_canonical(&package, "frames/L1/K1.webp", b"old-frame");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");
    stage_file(&package, "frames/L1/K1.webp", b"new-frame");

    bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json", "frames/L1/K1.webp"]),
    )
    .expect("package bind");

    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("manifest readable"),
        b"old-manifest"
    );
    assert_eq!(
        fs::read(canonical_file(&package, "frames/L1/K1.webp")).expect("media readable"),
        b"old-frame"
    );
    assert!(
        !canonical_file(&package, "layers/L1.json").exists(),
        "a not-yet-published new file must stay absent"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_publish_moves_every_staged_file_to_its_canonical_path() {
    let package = package_fixture("publish");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");
    stage_file(&package, "frames/L1/K1.webp", b"new-frame");

    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json", "frames/L1/K1.webp"]),
    )
    .expect("package bind");
    let publication =
        publish_package_transaction(&package, &binding.transaction_id).expect("package publish");

    assert_eq!(publication.published, 3);
    for entry in &binding.entries {
        let canonical = canonical_file(&package, &entry.path);
        assert_eq!(
            digest_bytes(&fs::read(&canonical).expect("published canonical file")),
            entry.sha256,
            "{} must land with its recorded bytes",
            entry.path
        );
    }
    // The previous manifest bytes are retained at the staged path: that
    // retention IS the rollback copy every settle/recovery path reads.
    assert_eq!(
        fs::read(package_staging(&package).join("project.mce"))
            .expect("retained previous manifest"),
        b"old-manifest"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_commit_refuses_a_drifted_bound_file_and_names_the_path() {
    let package = package_fixture("commit-drift");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");
    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json"]),
    )
    .expect("package bind");
    publish_package_transaction(&package, &binding.transaction_id).expect("package publish");
    fs::write(canonical_file(&package, "project.mce"), b"drifted-after-publish")
        .expect("drift the manifest");

    let refusal = settle_package_transaction(
        &package,
        &binding.transaction_id,
        PackageSettlementAction::Commit,
    )
    .expect_err("commit must refuse a drifted bound file");
    assert!(
        refusal.contains("project.mce"),
        "the refusal must name the drifted path: {refusal}"
    );
    assert!(
        package.join(PACKAGE_MARKER).exists(),
        "a refused commit leaves the transaction active"
    );

    // The drift is an external write: rollback must not fight it.
    settle_package_transaction(
        &package,
        &binding.transaction_id,
        PackageSettlementAction::Rollback,
    )
    .expect("rollback after a refused commit");
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("drifted manifest readable"),
        b"drifted-after-publish"
    );
    assert_package_settled(&package);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_rollback_restores_every_bound_file_and_removes_new_ones() {
    let package = package_fixture("rollback");
    write_canonical(&package, "project.mce", b"old-manifest");
    write_canonical(&package, "frames/L1/K1.webp", b"old-frame");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "frames/L1/K1.webp", b"new-frame");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");

    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json", "frames/L1/K1.webp"]),
    )
    .expect("package bind");
    publish_package_transaction(&package, &binding.transaction_id).expect("package publish");
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("published manifest"),
        b"new-manifest"
    );

    let settlement = settle_package_transaction(
        &package,
        &binding.transaction_id,
        PackageSettlementAction::Rollback,
    )
    .expect("package rollback");

    assert!(!settlement.cleanup_deferred, "cleanup must be immediate");
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("restored manifest"),
        b"old-manifest"
    );
    assert_eq!(
        fs::read(canonical_file(&package, "frames/L1/K1.webp")).expect("restored media"),
        b"old-frame"
    );
    assert!(
        !canonical_file(&package, "layers/L1.json").exists(),
        "a file the transaction created must be removed"
    );
    assert_package_settled(&package);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_commit_covers_a_heterogeneous_set_and_refuses_on_any_drift() {
    let package = package_fixture("heterogeneous");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");
    stage_file(&package, "frames/L1/K1.webp", b"frame-one");
    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["layers/L1.json", "frames/L1/K1.webp"]),
    )
    .expect("package bind");
    publish_package_transaction(&package, &binding.transaction_id).expect("package publish");
    assert_eq!(
        fs::read(canonical_file(&package, "layers/L1.json")).expect("published layer"),
        b"{\"layer\":\"L1\"}"
    );

    fs::write(canonical_file(&package, "frames/L1/K1.webp"), b"drifted-frame")
        .expect("drift the media file");
    let refusal = settle_package_transaction(
        &package,
        &binding.transaction_id,
        PackageSettlementAction::Commit,
    )
    .expect_err("commit refuses when ANY bound file drifted");
    assert!(refusal.contains("frames/L1/K1.webp"), "{refusal}");

    settle_package_transaction(
        &package,
        &binding.transaction_id,
        PackageSettlementAction::Rollback,
    )
    .expect("rollback");
    assert!(
        !canonical_file(&package, "layers/L1.json").exists(),
        "the created layer file is removed"
    );
    assert_eq!(
        fs::read(canonical_file(&package, "frames/L1/K1.webp")).expect("drifted media readable"),
        b"drifted-frame"
    );
    assert_package_settled(&package);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_recovery_restores_the_pre_save_package_after_a_partial_publish() {
    let package = package_fixture("recovery-partial");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");
    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json"]),
    )
    .expect("package bind");
    publish_package_transaction(&package, &binding.transaction_id).expect("package publish");

    // Drive the crash-shaped partial state through the public API: one entry
    // back at its pre-save bytes with its staged copy restored (a kill before
    // its per-file publish), the other still published, the marker on disk.
    fs::write(canonical_file(&package, "project.mce"), b"old-manifest").expect("pre-save manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    assert!(package.join(PACKAGE_MARKER).exists(), "the marker survives");

    let recovered = recover_package_transaction(&package)
        .expect("recovery")
        .expect("active transaction");

    assert!(!recovered.cleanup_deferred);
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("pre-save manifest readable"),
        b"old-manifest"
    );
    assert!(
        !canonical_file(&package, "layers/L1.json").exists(),
        "a file that did not exist before must be gone"
    );
    assert_package_settled(&package);
    assert!(recover_package_transaction(&package)
        .expect("repeated recovery")
        .is_none());
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_recovery_rolls_forward_when_every_bound_file_matches() {
    let package = package_fixture("recovery-forward");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    stage_file(&package, "layers/L1.json", b"{\"layer\":\"L1\"}");
    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce", "layers/L1.json"]),
    )
    .expect("package bind");
    publish_package_transaction(&package, &binding.transaction_id).expect("package publish");

    // A kill between the last per-file publish and the commit marker removal
    // resolves to the COMMITTED package: every bound file already matches.
    let recovered = recover_package_transaction(&package)
        .expect("recovery")
        .expect("active transaction");

    assert!(!recovered.cleanup_deferred);
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("published manifest"),
        b"new-manifest"
    );
    assert_eq!(
        fs::read(canonical_file(&package, "layers/L1.json")).expect("published layer"),
        b"{\"layer\":\"L1\"}"
    );
    assert_package_settled(&package);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_rollback_reentry_converges_after_an_interrupted_rollback() {
    let package = package_fixture("rollback-reentry");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce"]),
    )
    .expect("package bind");
    publish_package_transaction(&package, &binding.transaction_id).expect("package publish");

    // Drive the interrupted ROLLBACK state through the public API: the
    // canonical file is already back at its pre-save bytes, and the marker is
    // left in its rolling-back phase by a killed process.
    fs::write(canonical_file(&package, "project.mce"), b"old-manifest").expect("restored manifest");
    write_binding_marker(&package, &binding, "rolling_back");

    settle_package_transaction(
        &package,
        &binding.transaction_id,
        PackageSettlementAction::Rollback,
    )
    .expect("a re-entered rollback converges");

    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("pre-save manifest readable"),
        b"old-manifest"
    );
    assert_package_settled(&package);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_marker_on_disk_is_untrusted_input() {
    let package = package_fixture("marker-trust");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    let binding = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce"]),
    )
    .expect("package bind");

    // An upper-case digest is not 64 lower-case hex: the marker is refused.
    let upper = binding.entries[0].sha256.to_uppercase();
    assert_ne!(upper, binding.entries[0].sha256);
    write_raw_marker(
        &package,
        &binding.transaction_id,
        "published",
        &[("project.mce", &upper, true)],
    );
    assert!(
        recover_package_transaction(&package).is_err(),
        "an upper-case digest must be refused"
    );

    // A truncated digest is refused too.
    let short = &binding.entries[0].sha256[..63];
    write_raw_marker(
        &package,
        &binding.transaction_id,
        "published",
        &[("project.mce", short, true)],
    );
    assert!(
        recover_package_transaction(&package).is_err(),
        "a truncated digest must be refused"
    );

    // A doctored marker cannot redirect a write outside the package.
    write_raw_marker(
        &package,
        &binding.transaction_id,
        "published",
        &[("../../escape", &binding.entries[0].sha256, false)],
    );
    assert!(
        recover_package_transaction(&package).is_err(),
        "a marker path outside the bound set must be refused"
    );
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("manifest readable"),
        b"old-manifest"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn package_bind_recovers_a_stale_generation_before_refusing() {
    let package = package_fixture("stale-generation");
    write_canonical(&package, "project.mce", b"old-manifest");
    stage_file(&package, "project.mce", b"new-manifest");
    let first = bind_package_transaction(
        &package,
        PACKAGE_STAGING_BASENAME,
        &bound_paths(&["project.mce"]),
    )
    .expect("first bind");

    let second_basename = ".efx-paint-package-staging-second-generation";
    let second_root = package.join(second_basename);
    fs::create_dir_all(second_root.join("layers")).expect("second staging layers");
    fs::write(second_root.join("layers/L1.json"), b"{\"layer\":\"L1\"}")
        .expect("second staged layer");

    let refusal =
        bind_package_transaction(&package, second_basename, &bound_paths(&["layers/L1.json"]))
            .expect_err("a stale generation is recovered, never silently replaced");
    assert!(
        refusal.contains(PACKAGE_STAGING_BASENAME),
        "the refusal must name the recovered generation: {refusal}"
    );

    // The stale generation was rolled back (nothing had been published) and a
    // retry now binds cleanly.
    assert!(!package_staging(&package).exists());
    assert!(!package.join(PACKAGE_MARKER).exists());
    assert_eq!(
        fs::read(canonical_file(&package, "project.mce")).expect("manifest readable"),
        b"old-manifest"
    );
    let retry =
        bind_package_transaction(&package, second_basename, &bound_paths(&["layers/L1.json"]))
            .expect("retry after recovery");
    assert_ne!(retry.transaction_id, first.transaction_id);
    assert_eq!(retry.entries.len(), 1);
    fs::remove_dir_all(package).expect("fixture cleanup");
}
