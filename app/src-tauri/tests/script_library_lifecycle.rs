#![cfg(feature = "script-library-test-support")]

use efx_motion_editor_lib::script_library_test_support::{encode_webp, FixtureLibrary};
use serde_json::{json, Value};
use std::fs;
use uuid::Uuid;

fn document(id: &str, name: &str) -> Value {
    let encoded = encode_webp("lifecycle", 1, 1, 0.8, &[255; 4]).unwrap();
    json!({"kind":"efx-physics-paint-roto-script","schemaVersion":1,"id":id,"name":name,"createdAt":"2026-07-16T12:00:00Z","updatedAt":"2026-07-16T12:00:00Z",
    "source":{"projectName":"P","layerId":"l","layerName":"L","sourceFrame":0,"displayFrame":0,"width":1,"height":1,"background":{"background":"white","paperGrain":"canvas1","grainStrength":0.0}},
    "thumbnail":{"mimeType":"image/webp","width":1,"height":1,"quality":0.8,"dataUrl":format!("data:image/webp;base64,{}",encoded["webpBase64"].as_str().unwrap())},
    "brushes":[{"primary":{"tool":"paint","points":[{"x":0,"y":0,"p":1,"tx":0,"ty":0,"tw":0,"spd":0}],"color":"#000000","params":{"size":1,"opacity":100,"pressure":100,"waterAmount":0,"dryAmount":0,"edgeDetail":0,"pickup":0,"eraseStrength":0,"antiAlias":0},"timestamp":0},"continuations":[]}]})
}

#[test]
fn save_as_copies_and_preserves_source() {
    let fixture = FixtureLibrary::new().unwrap();
    let id = Uuid::new_v4().to_string();
    fixture.save(document(&id, "Source")).unwrap();
    let source_path = fixture.scripts_root().join(format!("{id}.efx-roto-script.json"));
    let source_before = fs::read(&source_path).unwrap();
    let (destination, migration) = fixture.migrate_to("destination").unwrap();
    assert_eq!(migration.copied, 1);
    assert_eq!(fs::read(source_path).unwrap(), source_before);
    assert!(destination.join("scripts").join(format!("{id}.efx-roto-script.json")).exists());
}

#[test]
fn save_as_deduplicates_identical_and_remaps_different_collisions() {
    let fixture = FixtureLibrary::new().unwrap();
    let id = Uuid::new_v4().to_string();
    fixture.save(document(&id, "Source")).unwrap();
    let (destination, first) = fixture.migrate_to("destination-dedupe").unwrap();
    assert_eq!(first.copied, 1);
    let second = efx_motion_editor_lib::script_library_test_support::FixtureLibrary::new().unwrap();
    let other_id = Uuid::new_v4().to_string();
    second.save(document(&other_id, "Other")).unwrap();
    assert!(destination.join("scripts").exists());

    let destination_collision = fixture.project_root().parent().unwrap().join("destination-remap");
    fs::create_dir_all(destination_collision.join("scripts")).unwrap();
    fs::write(destination_collision.join("scripts").join(format!("{id}.efx-roto-script.json")), serde_json::to_vec_pretty(&document(&id, "Different")).unwrap()).unwrap();
    fs::write(destination_collision.join("scripts").join("malformed.efx-roto-script.json"), "{bad").unwrap();
    fs::write(destination_collision.join("keep.txt"), "keep").unwrap();
    let (_, migration) = fixture.migrate_to("destination-remap").unwrap();
    assert_eq!(migration.remapped, 1);
    assert_eq!(fs::read_to_string(destination_collision.join("keep.txt")).unwrap(), "keep");
    assert!(destination_collision.join("scripts").join("malformed.efx-roto-script.json").exists());
    let managed = fs::read_dir(destination_collision.join("scripts")).unwrap().filter_map(Result::ok).filter(|entry| entry.file_name().to_string_lossy().ends_with(".efx-roto-script.json")).count();
    assert!(managed >= 3);
}
