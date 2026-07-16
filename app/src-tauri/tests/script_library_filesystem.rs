#![cfg(feature = "script-library-test-support")]

use efx_motion_editor_lib::script_library_test_support::{encode_webp, FixtureLibrary};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

fn document(id: &str, name: &str) -> Value {
    let encoded = encode_webp("filesystem", 1, 1, 0.8, &[255; 4]).unwrap();
    json!({"kind":"efx-physics-paint-roto-script","schemaVersion":1,"id":id,"name":name,"createdAt":"2026-07-16T12:00:00Z","updatedAt":"2026-07-16T12:00:00Z",
    "source":{"projectName":"P","layerId":"l","layerName":"L","sourceFrame":0,"displayFrame":0,"width":1,"height":1,"background":{"background":"white","paperGrain":"canvas1","grainStrength":0.0}},
    "thumbnail":{"mimeType":"image/webp","width":1,"height":1,"quality":0.8,"dataUrl":format!("data:image/webp;base64,{}",encoded["webpBase64"].as_str().unwrap())},
    "brushes":[{"primary":{"tool":"paint","points":[{"x":0,"y":0,"p":1,"tx":0,"ty":0,"tw":0,"spd":0}],"color":"#000000","params":{"size":1,"opacity":100,"pressure":100,"waterAmount":0,"dryAmount":0,"edgeDetail":0,"pickup":0,"eraseStrength":0,"antiAlias":0},"timestamp":0},"continuations":[]}]})
}

#[test]
fn contains_operations_and_enforces_revision_conflicts() {
    let fixture = FixtureLibrary::new().unwrap();
    let id = Uuid::new_v4().to_string();
    let saved = fixture.save(document(&id, "One")).unwrap();
    let row = saved.scan.rows.iter().find(|row| row.id == id).unwrap();
    assert!(fixture.stale_scan().is_err());
    assert!(fixture.rename(&id, "stale", "Two").is_err());
    let renamed = fixture.rename(&id, &row.revision, "Two").unwrap();
    let row = renamed.scan.rows.iter().find(|row| row.id == id).unwrap();
    assert_eq!(row.name, "Two");
    assert!(fixture.delete(&id, "stale").is_err());
    fixture.delete(&id, &row.revision).unwrap();
    assert!(fixture.scan().unwrap().rows.is_empty());
    assert!(!fixture.project_root().join("scripts/index.json").exists());
}

#[test]
fn rejects_invalid_ids_and_leaves_unrelated_files_untouched() {
    let fixture = FixtureLibrary::new().unwrap();
    assert!(fixture.load("../escape").is_err());
    assert!(fixture.load("/tmp/escape").is_err());
    let unrelated = fixture.write_managed_raw("notes.txt", "keep").unwrap();
    let id = Uuid::new_v4().to_string();
    fixture.save(document(&id, "One")).unwrap();
    let row = fixture.scan().unwrap().rows[0].clone();
    fixture.delete(&id, &row.revision).unwrap();
    assert_eq!(fs::read_to_string(unrelated).unwrap(), "keep");
    assert!(!fixture.project_root().join("project.mce").exists());
}

#[test]
fn capability_split_denies_standalone_filesystem_authority() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let main = fs::read_to_string(root.join("capabilities/default.json")).unwrap();
    let standalone = fs::read_to_string(root.join("capabilities/physics-paint.json")).unwrap();
    assert!(main.contains("dialog") || main.contains("fs"));
    for forbidden in ["fs:", "dialog:", "path:", "script_library", "project_save"] {
        assert!(!standalone.contains(forbidden), "standalone capability exposed {forbidden}");
    }
    assert!(standalone.contains("core:event") && standalone.contains("core:window"));
}
