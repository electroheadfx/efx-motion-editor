use efx_motion_editor_lib::physic_paint_cache::publish_cache_generation;
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
    fs::write(path.join("nested").join(format!("{generation}-frame-a.png")), generation)
        .expect("frame a write");
    fs::write(path.join("nested").join(format!("{generation}-frame-b.png")), generation)
        .expect("frame b write");
}

fn generation_file_names(path: &Path) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    for entry in fs::read_dir(path).expect("generation must remain reachable") {
        let entry = entry.expect("valid generation entry");
        if entry.file_type().expect("entry type").is_dir() {
            for nested in fs::read_dir(entry.path()).expect("nested generation directory") {
                names.insert(
                    nested
                        .expect("valid nested entry")
                        .file_name()
                        .to_string_lossy()
                        .into_owned(),
                );
            }
        } else {
            names.insert(entry.file_name().to_string_lossy().into_owned());
        }
    }
    names
}

fn assert_generation(path: &Path, generation: &str) {
    assert_eq!(
        generation_file_names(path),
        BTreeSet::from([
            format!("{generation}-frame-a.png"),
            format!("{generation}-frame-b.png"),
            format!("{generation}-manifest"),
        ])
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

    let result = publish_cache_generation(&project, STAGING_BASENAME).expect("replacement publication");

    assert!(result.replaced_existing);
    assert_generation(&canonical_dir(&project), "new");
    assert_generation(&staging_dir(&project), "old");
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
                .filter_map(|name| name.split('-').next())
                .collect::<BTreeSet<_>>();
            assert_eq!(generations.len(), 1, "reader observed mixed generation entries: {names:?}");
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

        assert!(result.is_err(), "invalid staging basename must reject: {invalid}");
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
