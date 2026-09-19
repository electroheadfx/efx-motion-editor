//! 52.2-01: the package frame-media write/read leg (D-02, D-07, D-13).
//!
//! These integration tests run against real temp package directories and pin
//! the two guards as separate, separately-asserted surfaces:
//!
//! * the MEDIA lock — exactly `frames/<layerId>/<keyId>.webp`;
//! * the save transaction's BOUND-path guard — `project.mce`,
//!   `layers/<layerId>.json`, `frames/<layerId>/<keyId>.webp`.
//!
//! The fixture digest below is the SHA-256 of `FIXTURE_FRAME_BYTES`, so every
//! digest assertion in this file is anchored to a constant slice.

use efx_motion_editor_lib::efx_paint_media::{
    digest_bytes, digest_file, read_frame_media, resolve_package_bound_path,
    resolve_package_media_path, resolve_package_media_write_path, safe_frame_media_relative_path,
    validate_package_staging_basename, write_frame_media, EfxPaintMediaError,
    EfxPaintMediaRejection,
};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const FIXTURE_FRAME_BYTES: &[u8] =
    b"RIFF\x1e\x00\x00\x00WEBPVP8L\x12\x00\x00\x00efx-paint-media-fixture-1";
const FIXTURE_FRAME_DIGEST: &str =
    "d4576083f9b1190198e560278f43032b400d2adf4d1dcb882d6176650e8f77e5";

fn fixture_package(tag: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock must follow unix epoch")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "efx-paint-package-{tag}-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(&root).expect("fixture package directory");
    root
}

fn staging_basename() -> String {
    format!(".efx-paint-package-staging-{}", Uuid::new_v4())
}

fn rejection(error: EfxPaintMediaError) -> EfxPaintMediaRejection {
    match error {
        EfxPaintMediaError::Rejected(rejection) => rejection,
        other => panic!("expected a typed rejection, got {other:?}"),
    }
}

fn canonical_media_path(package: &Path) -> PathBuf {
    package.join("frames/L1/K1.webp")
}

#[test]
fn write_lands_a_real_file_and_returns_its_sha256() {
    let package = fixture_package("write");

    let result =
        write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("media write");

    assert_eq!(result.relative_path, "frames/L1/K1.webp");
    assert_eq!(result.digest, FIXTURE_FRAME_DIGEST);
    assert_eq!(result.byte_length, FIXTURE_FRAME_BYTES.len() as u64);
    assert_eq!(
        fs::read(canonical_media_path(&package)).expect("canonical media file"),
        FIXTURE_FRAME_BYTES
    );
    assert!(
        result.digest.len() == 64 && result.digest.bytes().all(|byte| byte.is_ascii_hexdigit()),
        "the digest must be 64 lower-case hex characters: {}",
        result.digest
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn staged_write_targets_the_staging_root_and_returns_the_canonical_path() {
    let package = fixture_package("staged");
    let basename = staging_basename();

    let result = write_frame_media(&package, Some(&basename), "L1", "K1", FIXTURE_FRAME_BYTES)
        .expect("staged media write");

    assert_eq!(
        result.relative_path, "frames/L1/K1.webp",
        "a staged write still reports the canonical relative path"
    );
    assert_eq!(result.digest, FIXTURE_FRAME_DIGEST);
    assert_eq!(
        fs::read(package.join(&basename).join("frames/L1/K1.webp")).expect("staged media file"),
        FIXTURE_FRAME_BYTES
    );
    assert!(
        !canonical_media_path(&package).exists(),
        "the canonical tree must stay untouched by a staged write"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn staged_write_leaves_an_existing_canonical_file_byte_identical() {
    let package = fixture_package("staged-existing");
    write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("canonical write");

    write_frame_media(&package, Some(&staging_basename()), "L1", "K1", FIXTURE_FRAME_BYTES)
        .expect("staged write");

    assert_eq!(
        fs::read(canonical_media_path(&package)).expect("canonical media file"),
        FIXTURE_FRAME_BYTES
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn invalid_staging_basename_is_refused_and_nothing_is_written() {
    let package = fixture_package("invalid-staging");
    let crafted = [
        ".efx-paint-package-staging-../evil",
        ".efx-paint-package-staging-",
        ".efx-paint-package-staging-child/path",
        "/tmp/.efx-paint-package-staging-abs",
        ".efx-paint-staging-legacy",
        "",
    ];
    for basename in crafted {
        assert!(
            validate_package_staging_basename(basename).is_err(),
            "expected rejection: {basename}"
        );
        let result = write_frame_media(&package, Some(basename), "L1", "K1", FIXTURE_FRAME_BYTES);
        assert!(result.is_err(), "expected refusal: {basename}");
    }
    assert!(
        validate_package_staging_basename(&staging_basename()).is_ok(),
        "a UUID-bodied staging basename must stay accepted"
    );
    assert!(
        !package.join("frames").exists(),
        "a refused staged write must not create the frames tree"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn media_lock_accepts_the_frames_tree_and_refuses_non_media_paths() {
    let package = fixture_package("media-lock");
    write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("media write");

    let accepted =
        resolve_package_media_path(&package, "frames/L1/K1.webp").expect("media path accepted");
    assert!(accepted.ends_with("frames/L1/K1.webp"));

    assert_eq!(
        rejection(
            resolve_package_media_path(&package, "layers/L1.json")
                .expect_err("layer sub-files are not media")
        ),
        EfxPaintMediaRejection::UnsupportedPackagePath
    );
    assert_eq!(
        rejection(
            resolve_package_media_path(&package, "project.mce").expect_err("the manifest is not media")
        ),
        EfxPaintMediaRejection::UnsupportedPackagePath
    );
    assert_eq!(
        rejection(
            resolve_package_media_path(&package, "frames/L1/K1.png")
                .expect_err("non-webp frame refused")
        ),
        EfxPaintMediaRejection::WrongExtension
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn bound_path_guard_accepts_the_package_file_set() {
    let package = fixture_package("bound-accept");
    let canonical_root = fs::canonicalize(&package).expect("canonical package root");

    for relative in ["project.mce", "layers/L1.json", "frames/L1/K1.webp"] {
        let resolved = resolve_package_bound_path(&package, relative)
            .unwrap_or_else(|error| panic!("expected acceptance: {relative} ({error:?})"));
        assert!(
            resolved.starts_with(&canonical_root),
            "a bound path can never leave the package: {relative}"
        );
    }
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn bound_path_guard_refuses_paths_outside_the_package_file_set() {
    let package = fixture_package("bound-refuse");
    let refused = [
        "images/a.webp",
        "cache/efx-paint/a.webp",
        "scripts/x.json",
        "paint/L1/frame-000001.json",
        "../escape",
        "/absolute/path",
        "frames\\L1\\K1.webp",
        "frames/L1/K1.png",
        "frames/L1/K1.webp/extra",
        "",
    ];
    for relative in refused {
        assert!(
            resolve_package_bound_path(&package, relative).is_err(),
            "expected refusal: {relative}"
        );
    }
    assert_eq!(
        rejection(
            resolve_package_bound_path(&package, "images/a.webp").expect_err("images refused")
        ),
        EfxPaintMediaRejection::UnsupportedPackagePath
    );
    assert_eq!(
        rejection(
            resolve_package_bound_path(&package, "frames/L1/K1.png")
                .expect_err("non-webp frame refused")
        ),
        EfxPaintMediaRejection::WrongExtension,
        "the bound-path guard delegates frames/ back to the media lock"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn second_write_replaces_the_previous_payload_atomically() {
    let package = fixture_package("overwrite");
    write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("first write");
    let second = b"RIFF\x1e\x00\x00\x00WEBPVP8L\x12\x00\x00\x00efx-paint-media-fixture-2";

    write_frame_media(&package, None, "L1", "K1", second).expect("second write");

    assert_eq!(
        fs::read(canonical_media_path(&package)).expect("media file"),
        second
    );
    let entries: Vec<String> = fs::read_dir(package.join("frames/L1"))
        .expect("media directory")
        .map(|entry| {
            entry
                .expect("valid media entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    assert_eq!(
        entries,
        vec!["K1.webp".to_string()],
        "an atomic replacement must leave no temp sibling behind"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn escaping_ids_are_refused_and_leave_no_file() {
    let package = fixture_package("escape");
    let crafted = [
        ("../L1", "K1"),
        ("L1", "K1/K2"),
        ("L1", ".."),
        (".", "K1"),
        ("", "K1"),
        ("L1", "K1\\K2"),
        ("L1\u{0}", "K1"),
    ];
    for (layer_id, key_id) in crafted {
        let result = write_frame_media(&package, None, layer_id, key_id, FIXTURE_FRAME_BYTES);
        assert_eq!(
            rejection(result.expect_err("expected refusal")),
            EfxPaintMediaRejection::UnsafeId,
            "expected UnsafeId for {layer_id:?}/{key_id:?}"
        );
    }
    assert!(safe_frame_media_relative_path("L1", "K1").is_ok());
    assert!(
        !package.join("frames").exists(),
        "a refused write must not create the frames tree"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn read_returns_the_written_bytes_and_digest() {
    let package = fixture_package("read");
    let write =
        write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("media write");

    let read = read_frame_media(&package, &write.relative_path).expect("media read");

    assert_eq!(read.bytes, FIXTURE_FRAME_BYTES);
    assert_eq!(read.digest, write.digest);
    assert_eq!(read.digest, FIXTURE_FRAME_DIGEST);
    assert_eq!(read.relative_path, "frames/L1/K1.webp");
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn read_refuses_non_media_paths() {
    let package = fixture_package("read-refuse");

    assert_eq!(
        rejection(
            read_frame_media(&package, "frames/L1/K1.png").expect_err("non-webp frame refused")
        ),
        EfxPaintMediaRejection::WrongExtension
    );
    assert_eq!(
        rejection(
            read_frame_media(&package, "layers/L1.json").expect_err("layer sub-files are not media")
        ),
        EfxPaintMediaRejection::UnsupportedPackagePath
    );
    assert_eq!(
        rejection(read_frame_media(&package, "../escape.webp").expect_err("escape refused")),
        EfxPaintMediaRejection::PathEscape
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn digest_bytes_matches_the_fixed_fixture_slice() {
    assert_eq!(digest_bytes(FIXTURE_FRAME_BYTES), FIXTURE_FRAME_DIGEST);
    assert_eq!(digest_bytes(b"other"), {
        // A second, independent constant keeps the helper honest about hashing
        // the exact bytes it is handed.
        let other = b"other";
        assert_ne!(digest_bytes(other), FIXTURE_FRAME_DIGEST);
        digest_bytes(other)
    });
}

#[test]
fn digest_file_matches_digest_bytes_for_a_written_media_file() {
    let package = fixture_package("digest-file");
    write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("media write");

    let digest = digest_file(&canonical_media_path(&package)).expect("file digest");

    assert_eq!(digest, digest_bytes(FIXTURE_FRAME_BYTES));
    assert_eq!(digest, FIXTURE_FRAME_DIGEST);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn lib_registers_both_frame_media_commands() {
    let source = include_str!("../src/lib.rs");
    assert!(source.contains("efx_paint_write_frame_media"));
    assert!(source.contains("efx_paint_read_frame_media"));
}

#[test]
fn write_command_consumes_raw_request_bytes() {
    let source = include_str!("../src/commands/efx_paint_media.rs");
    assert!(
        source.contains("InvokeBody::Raw(bytes)"),
        "the write command must take the frame bytes as a raw body, never a JSON number array"
    );
}

#[test]
fn media_write_path_stays_inside_the_staging_root() {
    let package = fixture_package("write-path");
    let basename = staging_basename();

    let resolved = resolve_package_media_write_path(&package, "frames/L1/K1.webp")
        .expect("canonical media write path");

    assert!(resolved.starts_with(fs::canonicalize(&package).expect("canonical package root")));
    assert!(package.join("frames/L1").is_dir(), "the write side creates the key directory");

    let staged_root = package.join(&basename);
    fs::create_dir_all(&staged_root).expect("staging root fixture");
    let staged = resolve_package_media_write_path(&staged_root, "frames/L1/K1.webp")
        .expect("staged media write path");
    assert!(staged.starts_with(fs::canonicalize(&staged_root).expect("canonical staging root")));
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn read_reports_missing_for_an_absent_frame() {
    let package = fixture_package("read-missing");

    assert_eq!(
        rejection(
            read_frame_media(&package, "frames/L1/K1.webp").expect_err("an absent frame is refused")
        ),
        EfxPaintMediaRejection::Missing,
        "an absent frame is the Phase 49 slate path, never a refusal class"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[test]
fn read_digest_follows_the_bytes_on_disk_not_the_write_result() {
    let package = fixture_package("read-disk-digest");
    let write =
        write_frame_media(&package, None, "L1", "K1", FIXTURE_FRAME_BYTES).expect("media write");
    let replaced = b"RIFF\x1e\x00\x00\x00WEBPVP8L\x12\x00\x00\x00efx-paint-media-replaced-2";
    fs::write(canonical_media_path(&package), replaced).expect("replaced payload");

    let read = read_frame_media(&package, "frames/L1/K1.webp").expect("media read");

    assert_ne!(
        read.digest, write.digest,
        "the read-side digest must be computed from disk, never cached from the write"
    );
    assert_eq!(read.digest, digest_bytes(replaced));
    assert_eq!(read.bytes, replaced);
    fs::remove_dir_all(package).expect("fixture cleanup");
}

#[cfg(unix)]
#[test]
fn read_refuses_a_symlink_that_escapes_the_package() {
    use std::os::unix::fs::symlink;

    let package = fixture_package("read-symlink-escape");
    let outside = package.with_extension("outside.webp");
    fs::write(&outside, FIXTURE_FRAME_BYTES).expect("outside fixture file");
    fs::create_dir_all(package.join("frames/L1")).expect("media directory");
    symlink(&outside, canonical_media_path(&package)).expect("escaping symlink");

    assert_eq!(
        rejection(read_frame_media(&package, "frames/L1/K1.webp").expect_err("symlink refused")),
        EfxPaintMediaRejection::PathEscape,
        "a symlink resolving outside the package must never be read (T-52.2-02)"
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
    fs::remove_file(outside).expect("outside fixture cleanup");
}

#[test]
fn read_refuses_a_directory_at_the_media_path() {
    let package = fixture_package("read-directory");
    fs::create_dir_all(canonical_media_path(&package)).expect("directory at the media path");

    assert_eq!(
        rejection(read_frame_media(&package, "frames/L1/K1.webp").expect_err("directory refused")),
        EfxPaintMediaRejection::NotARegularFile
    );
    fs::remove_dir_all(package).expect("fixture cleanup");
}
