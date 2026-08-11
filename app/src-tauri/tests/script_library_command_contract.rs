use serde::Deserialize;
use serde_json::json;
use std::collections::BTreeSet;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
enum Direction {
    Forward,
    Undo,
    Redo,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
enum DeleteMode {
    KeepGroups,
    DeleteActionAndGroups,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DirectionCommand {
    command_id: String,
    generation: u64,
    operation_id: String,
    lease_token: String,
    direction: Direction,
    mode: DeleteMode,
    authority: Authority,
    target: TargetPayload,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Authority {
    project_context_id: String,
    layer_id: String,
    launch_operation_id: String,
    action_id: String,
    expected_action_revision: String,
    expected_physical_revision: String,
    expected_physical_hash: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TargetPayload {
    physical_revision: String,
    physical_hash: String,
    selected_group_id: Option<String>,
    cursor_app_frame: u32,
}

#[derive(Default)]
struct CommandFacade {
    seen: BTreeSet<(String, u64, String, &'static str)>,
}

impl CommandFacade {
    fn validate_and_accept(&mut self, value: serde_json::Value) -> Result<DirectionCommand, &'static str> {
        let command: DirectionCommand = serde_json::from_value(value).map_err(|_| "closed command payload rejected")?;
        if command.command_id.is_empty()
            || command.generation == 0
            || command.operation_id.is_empty()
            || command.lease_token.is_empty()
            || command.authority.project_context_id.is_empty()
            || command.authority.layer_id.is_empty()
            || command.authority.launch_operation_id.is_empty()
            || command.authority.action_id.is_empty()
            || command.authority.expected_action_revision.is_empty()
            || command.authority.expected_physical_revision.is_empty()
            || command.authority.expected_physical_hash.is_empty()
            || command.target.physical_revision.is_empty()
            || command.target.physical_hash.is_empty()
        {
            return Err("missing exact authority or target fact");
        }
        let direction = match command.direction {
            Direction::Forward => "forward",
            Direction::Undo => "undo",
            Direction::Redo => "redo",
        };
        let replay_key = (command.command_id.clone(), command.generation, command.lease_token.clone(), direction);
        if !self.seen.insert(replay_key) {
            return Err("replayed direction token generation");
        }
        Ok(command)
    }
}

fn fixture(direction: &str, mode: &str) -> serde_json::Value {
    json!({
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
            "actionId": "123e4567-e89b-42d3-a456-426614174000",
            "expectedActionRevision": "action-rev-7",
            "expectedPhysicalRevision": "physical-before",
            "expectedPhysicalHash": "hash-before"
        },
        "target": {
            "physicalRevision": format!("physical-{direction}"),
            "physicalHash": format!("hash-{direction}"),
            "selectedGroupId": if mode == "delete-action-and-groups" { serde_json::Value::Null } else { json!("group-1") },
            "cursorAppFrame": 18
        }
    })
}

#[test]
fn command_facade_accepts_closed_forward_undo_redo_payloads() {
    let mut facade = CommandFacade::default();
    for direction in ["forward", "undo", "redo"] {
        let command = facade.validate_and_accept(fixture(direction, "keep-groups")).unwrap();
        assert_eq!(command.target.cursor_app_frame, 18);
        assert!(command.target.selected_group_id.is_some());
        assert_eq!(command.mode, DeleteMode::KeepGroups);
    }
}

#[test]
fn command_facade_rejects_unknown_fields_modes_directions_and_replay() {
    let mut facade = CommandFacade::default();
    let accepted = fixture("forward", "delete-action-and-groups");
    let command = facade.validate_and_accept(accepted.clone()).unwrap();
    assert_eq!(command.direction, Direction::Forward);
    assert_eq!(command.mode, DeleteMode::DeleteActionAndGroups);
    assert!(command.target.selected_group_id.is_none());
    assert_eq!(facade.validate_and_accept(accepted).unwrap_err(), "replayed direction token generation");

    let mut unknown = fixture("undo", "keep-groups");
    unknown.as_object_mut().unwrap().insert("unexpected".into(), json!(true));
    assert!(facade.validate_and_accept(unknown).is_err());
    assert!(facade.validate_and_accept(fixture("sideways", "keep-groups")).is_err());
    assert!(facade.validate_and_accept(fixture("redo", "silent-cascade")).is_err());
}

#[test]
fn command_facade_requires_exact_authority_and_direction_specific_target() {
    let mut facade = CommandFacade::default();
    let mut missing_hash = fixture("undo", "keep-groups");
    missing_hash["authority"]["expectedPhysicalHash"] = json!("");
    assert_eq!(facade.validate_and_accept(missing_hash).unwrap_err(), "missing exact authority or target fact");

    let undo = facade.validate_and_accept(fixture("undo", "keep-groups")).unwrap();
    assert_eq!(undo.target.physical_revision, "physical-undo");
    assert_eq!(undo.target.physical_hash, "hash-undo");
}
