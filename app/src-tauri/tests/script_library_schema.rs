#![cfg(feature = "script-library-test-support")]

use efx_motion_editor_lib::script_library_test_support::{encode_webp, validate_document, validate_webp, FixtureLibrary};
use serde_json::{json, Value};
use std::fs;
use uuid::Uuid;

fn document(id: &str, webp_base64: &str) -> Value {
    json!({
        "kind": "efx-physics-paint-roto-script", "schemaVersion": 1, "id": id, "name": "Preset",
        "createdAt": "2026-07-16T12:00:00Z", "updatedAt": "2026-07-16T12:00:00Z",
        "source": { "projectName": "Project", "layerId": "layer-1", "layerName": "Ink", "sourceFrame": 2, "displayFrame": 4, "width": 1920, "height": 1080,
            "background": { "background": "transparent", "paperGrain": "canvas1", "grainStrength": 0.0 } },
        "thumbnail": { "mimeType": "image/webp", "width": 2, "height": 2, "quality": 0.8, "dataUrl": format!("data:image/webp;base64,{webp_base64}") },
        "brushes": [{ "primary": { "tool": "paint", "points": [{"x":1.0,"y":2.0,"p":0.5,"tx":0.0,"ty":0.0,"tw":0.0,"spd":0.0}], "color":"#112233",
            "params":{"size":12.0,"opacity":100.0,"pressure":100.0,"waterAmount":50.0,"dryAmount":50.0,"edgeDetail":50.0,"pickup":50.0,"eraseStrength":50.0,"antiAlias":1},
            "timestamp":1,"hasPenInput":true,"playFrame":0,"physicsMode":"local" },
            "continuations": [{ "tool":"paint","points":[],"color":"#112233","params":{"size":12.0,"opacity":100.0,"pressure":100.0,"waterAmount":50.0,"dryAmount":50.0,"edgeDetail":50.0,"pickup":50.0,"eraseStrength":50.0,"antiAlias":1},"timestamp":2,"diffusionFrames":3 }] }]
    })
}

fn webp() -> (Vec<u8>, String) {
    let encoded = encode_webp("schema", 2, 2, 0.8, &[255; 16]).unwrap();
    let base64 = encoded["webpBase64"].as_str().unwrap().to_string();
    let bytes = decode(&base64);
    (bytes, base64)
}

#[test]
fn validates_schema_parity_and_real_lossy_webp() {
    let (bytes, base64) = webp();
    assert_eq!(validate_webp(&bytes).unwrap(), (2, 2));
    let id = Uuid::new_v4().to_string();
    let mut value = document(&id, &base64);
    value["futureOptional"] = json!({"safe": true});
    assert!(validate_document(value.clone(), Some(&id)).is_ok());
    value["schemaVersion"] = json!(2);
    assert!(validate_document(value, Some(&id)).is_err());
}

#[test]
fn rejects_malformed_limits_dates_and_webp_metadata() {
    let (_, base64) = webp();
    let id = Uuid::new_v4().to_string();
    let mut value = document(&id, &base64);
    value["updatedAt"] = json!("2026-07-15T12:00:00Z");
    assert!(validate_document(value, Some(&id)).is_err());
    let mut value = document(&id, &base64);
    value["brushes"][0]["primary"]["timestamp"] = json!(9_007_199_254_740_992u64);
    assert!(validate_document(value, Some(&id)).is_err());
    let mut value = document(&id, &base64);
    value["thumbnail"]["width"] = json!(3);
    assert!(validate_document(value, Some(&id)).is_err());
    assert!(encode_webp("", 2, 2, 0.8, &[0; 16]).is_err());
    assert!(encode_webp("bad-size", 2, 2, 0.8, &[0; 15]).is_err());
    assert!(encode_webp("bad-quality", 2, 2, 0.5, &[0; 16]).is_err());
}

#[test]
fn scan_isolates_malformed_managed_documents() {
    let fixture = FixtureLibrary::new().unwrap();
    let (_, base64) = webp();
    let id = Uuid::new_v4().to_string();
    fixture.save(document(&id, &base64)).unwrap();
    fixture.write_managed_raw(&format!("{}.efx-roto-script.json", Uuid::new_v4()), "{bad json").unwrap();
    let scan = fixture.scan().unwrap();
    assert_eq!(scan.rows.len(), 1);
    assert_eq!(scan.skipped_invalid_count, 1);
    assert!(fs::read_dir(fixture.scripts_root()).unwrap().count() >= 2);
}

fn decode(input: &str) -> Vec<u8> {
    let mut output = Vec::new(); let mut buffer = 0u32; let mut bits = 0u8;
    for byte in input.bytes().take_while(|byte| *byte != b'=') {
        let value = match byte { b'A'..=b'Z' => byte-b'A', b'a'..=b'z' => byte-b'a'+26, b'0'..=b'9' => byte-b'0'+52, b'+' => 62, b'/' => 63, _ => 0 } as u32;
        buffer=(buffer<<6)|value; bits+=6; if bits>=8 { bits-=8; output.push((buffer>>bits) as u8); buffer&=(1<<bits)-1; }
    } output
}
