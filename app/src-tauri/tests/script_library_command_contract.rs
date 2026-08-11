use efx_motion_editor_lib::script_library_test_support::{
    validate_action_transaction_acknowledge_command,
    validate_action_transaction_prepare_command,
};
use serde_json::{json, Value};
use uuid::Uuid;

fn prepare_fixture(direction: &str, mode: &str) -> Value {
    let action_id = Uuid::new_v4().to_string();
    json!({
        "token": Uuid::new_v4().to_string(),
        "commandId": "history-command-9",
        "generation": 9,
        "operationId": format!("{direction}-operation"),
        "leaseToken": format!("{direction}-lease"),
        "direction": direction,
        "mode": mode,
        "authority": {
            "projectContextId": "project-context-1",
            "layerId": "layer-1",
            "launchOperationId": "launch-1",
            "actionId": action_id,
            "expectedActionPresent": direction != "undo",
            "expectedActionRevision": "action-rev-7",
            "expectedPhysicalRevision": "physical-before",
            "expectedPhysicalHash": "hash-before"
        },
        "impactDigest": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "retainedArtifact": {
            "commandId": "history-command-9",
            "generation": 9,
            "actionId": action_id,
            "managedPath": format!("scripts/{action_id}.efx-roto-script.json"),
            "originalRevision": "action-rev-7",
            "integritySha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
        },
        "target": {
            "physicalRevision": format!("physical-{direction}"),
            "physicalHash": format!("hash-{direction}"),
            "physicalDocument": {"revision": format!("physical-{direction}"), "realKeyRecords": [], "loopClips": []},
            "selectedGroupId": if mode == "delete-action-and-groups" { Value::Null } else { json!("group-1") },
            "cursorAppFrame": 18
        }
    })
}

fn acknowledge_fixture(prepare: &Value) -> Value {
    json!({
        "token": prepare["token"],
        "commandId": prepare["commandId"],
        "generation": prepare["generation"],
        "operationId": prepare["operationId"],
        "leaseToken": prepare["leaseToken"],
        "direction": prepare["direction"]
    })
}

#[test]
fn command_facade_accepts_exact_prepare_and_acknowledge_variants() {
    for direction in ["forward", "undo", "redo"] {
        let prepare = prepare_fixture(direction, "keep-groups");
        let parsed = validate_action_transaction_prepare_command(prepare.clone()).unwrap();
        assert_eq!(parsed["direction"], direction);
        assert_eq!(parsed["target"]["cursorAppFrame"], 18);

        let acknowledged = validate_action_transaction_acknowledge_command(acknowledge_fixture(&prepare)).unwrap();
        assert_eq!(acknowledged["token"], prepare["token"]);
        assert_eq!(acknowledged["direction"], direction);
    }
}

#[test]
fn command_facade_rejects_unknown_fields_modes_directions_and_missing_identity() {
    let mut unknown = prepare_fixture("forward", "keep-groups");
    unknown.as_object_mut().unwrap().insert("unexpected".into(), json!(true));
    assert!(validate_action_transaction_prepare_command(unknown).is_err());
    assert!(validate_action_transaction_prepare_command(prepare_fixture("sideways", "keep-groups")).is_err());
    assert!(validate_action_transaction_prepare_command(prepare_fixture("redo", "silent-cascade")).is_err());

    let prepare = prepare_fixture("forward", "delete-action-and-groups");
    let mut acknowledge = acknowledge_fixture(&prepare);
    acknowledge["commandId"] = json!("");
    assert!(validate_action_transaction_acknowledge_command(acknowledge).is_err());

    let mut unknown_ack = acknowledge_fixture(&prepare);
    unknown_ack.as_object_mut().unwrap().insert("unexpected".into(), json!(true));
    assert!(validate_action_transaction_acknowledge_command(unknown_ack).is_err());
}

#[test]
fn history_release_command_is_closed_to_owned_lifecycle_reasons() {
    let source = include_str!("../src/commands/script_library.rs");
    assert!(source.contains("ActionHistoryReleaseRequest"));
    assert!(source.contains("ActionHistoryReleaseReason"));
    for reason in ["Eviction", "RedoBranchTruncation", "SessionHistoryClear"] {
        assert!(source.contains(reason), "missing closed release reason {reason}");
    }
    assert!(source.contains("script_library_release_action_history"));
}

#[test]
fn invoke_handler_registers_every_action_transaction_command() {
    let source = include_str!("../src/lib.rs");
    for command in [
        "script_library_prepare_action_transaction",
        "script_library_commit_action_transaction",
        "script_library_action_transaction_status",
        "script_library_recover_action_transaction",
        "script_library_acknowledge_action_transaction",
        "script_library_release_action_history",
    ] {
        assert!(source.contains(command), "missing invoke registration for {command}");
    }
}
