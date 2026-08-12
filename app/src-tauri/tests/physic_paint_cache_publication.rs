use efx_motion_editor_lib::physic_paint_cache::publish_cache_generation;
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

const STAGING_BASENAME: &str = ".physic-paint-staging-test";

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
    project_dir.join("cache/physic-paint")
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
        .map(|entry| {
            entry
                .expect("valid generation entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
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

#[test]
fn first_publication_moves_the_complete_staged_generation_to_canonical() {
    let project = fixture_dir("first");
    write_generation(&staging_dir(&project), "new");

    let result = publish_cache_generation(&project, STAGING_BASENAME).expect("first publication");

    assert!(!result.replaced_existing);
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

    publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("replacement publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
        PhysicPaintCacheSettlementAction::Rollback,
    )
    .expect("rollback settlement");

    assert_generation(&canonical_dir(&project), "old");
    assert!(!staging_dir(&project).exists());
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn rollback_removes_an_uncommitted_first_generation() {
    let project = fixture_dir("rollback-first");
    write_generation(&staging_dir(&project), "new");

    publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("first publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
        PhysicPaintCacheSettlementAction::Rollback,
    )
    .expect("rollback settlement");

    assert!(!canonical_dir(&project).exists());
    assert!(!staging_dir(&project).exists());
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn rollback_replay_after_commit_is_rejected_without_mutating_canonical() {
    let project = fixture_dir("rollback-replay");
    write_generation(&staging_dir(&project), "new");

    publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
        PhysicPaintCacheSettlementAction::Commit,
    )
    .expect("commit settlement");

    let replay = settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
        PhysicPaintCacheSettlementAction::Rollback,
    );

    assert!(replay.is_err(), "a settled publication must not be replayable");
    assert_generation(&canonical_dir(&project), "new");
    fs::remove_dir_all(project).expect("fixture cleanup");
}

#[cfg(target_os = "macos")]
#[test]
fn delayed_rollback_cannot_delete_a_newer_canonical_generation() {
    let project = fixture_dir("delayed-rollback");
    let first_staging = ".physic-paint-staging-first";
    let second_staging = ".physic-paint-staging-second";
    write_generation(&project.join("cache").join(first_staging), "g1");

    publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        first_staging.to_string(),
    )
    .expect("first publication");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        first_staging.to_string(),
        PhysicPaintCacheSettlementAction::Commit,
    )
    .expect("first commit");

    write_generation(&project.join("cache").join(second_staging), "g2");
    publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        second_staging.to_string(),
    )
    .expect("second publication");

    let delayed = settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        first_staging.to_string(),
        PhysicPaintCacheSettlementAction::Rollback,
    );

    assert!(delayed.is_err(), "an older publication cannot settle a newer one");
    assert_generation(&canonical_dir(&project), "g2");
    settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        second_staging.to_string(),
        PhysicPaintCacheSettlementAction::Rollback,
    )
    .expect("second rollback");
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
        publish_cache_generation(&project, STAGING_BASENAME).expect("atomic replacement");
        fs::remove_dir_all(staging_dir(&project)).expect("remove exchanged old generation");
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
    fs::set_permissions(
        canonical_dir(&project),
        fs::Permissions::from_mode(0o555),
    )
    .expect("deny old-generation cleanup");

    let publication = publish_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
    )
    .expect("publication remains accepted");
    let result = settle_physic_paint_cache_generation(
        project.to_string_lossy().into_owned(),
        STAGING_BASENAME.to_string(),
        PhysicPaintCacheSettlementAction::Commit,
    )
    .expect("commit remains accepted");

    assert!(publication.accepted);
    assert!(result.accepted);
    assert_eq!(result.cleanup_status, PhysicPaintCacheCleanupStatus::Deferred);
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
        "physic-paint-staging-test",
        ".physic-paint-staging-",
        ".physic-paint-staging-../escape",
        ".physic-paint-staging-child/path",
        "/tmp/.physic-paint-staging-absolute",
        ".physic-paint-staging-child\\path",
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
