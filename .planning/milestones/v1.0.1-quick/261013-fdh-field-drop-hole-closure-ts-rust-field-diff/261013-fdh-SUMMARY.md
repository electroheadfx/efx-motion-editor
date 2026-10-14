---
phase: quick-261013-fdh
plan: 261013-fdh
subsystem: mce-format
tags: [field-drop-hole, dual-language, serde, contract-test, n1, n2, n3, n4, mbl-01, tdd]

# Dependency graph
requires:
  - phase: quick-261012-d6q
    provides: the dual-language law (a .mce field must be declared in BOTH TS and Rust) and the video disk-reference shape
  - phase: v1.0.1 milestone audit run 2
    provides: findings N1-N4 (four .mce field drop-holes) and the missing-field-diff-contract root cause
provides:
  - "N1: `video_asset_id` declared on Rust `MceLayerSource` — the layer→asset identity survives save→open, no duplicate gallery row per reopen"
  - "N2: `motion_blur` declared on Rust `MceProject` + new `MceMotionBlur` struct in both languages — motion-blur prefs survive reopen (MBL-01)"
  - "N3: `source_overrides` declared on Rust `MceKeyframeValues` — FX source-property overrides survive reopen"
  - "N4: `Sequence.visible` emitted and hydrated by `projectStore` (TS-side omission) — FX hide/show survives reopen"
  - "TS↔Rust field-diff contract test (app/src/lib/mceFieldContract.test.ts) — the enforcement that stops this class"
  - "MBL-01 requirement row in .planning/REQUIREMENTS.md"
affects: [mce-format, projectStore, imageStore, video-gallery, motion-blur, keyframes, v1.0.1-release]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 4020
  tasks: 4
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-language declaration: a .mce key exists in the TS interface AND the Rust struct, or serde drops it on open — the contract test parses both surfaces and diffs wire keys per member"
    - "Serde rename awareness: `#[serde(rename = \"x\")]` maps a Rust field to its wire key before the diff, so `format_version`/`project_id`/`efx_paint` compare as `formatVersion`/`projectId`/`efxPaint`"
    - "One allowlisted one-language field with its reason, never a blanket exception"

key-files:
  created:
    - app/src/lib/mceFieldContract.test.ts
    - app/src/stores/projectStore.fieldDropHoles.test.ts
  modified:
    - app/src-tauri/src/models/project.rs
    - app/src-tauri/src/services/project_io.rs
    - app/src-tauri/src/commands/project.rs
    - app/src/types/project.ts
    - app/src/stores/projectStore.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "One FIX commit for all four holes (N1-N4) — they share one root cause and one fix shape (declare the missing key), so splitting them would be four commits of ceremony"
  - "The structural pin is the point of the pass: the round-trip pins prove these four values survive, the contract test makes the NEXT undeclared key fail the build"
  - "The contract diffs the TS *interfaces* against the Rust *structs*, not the `buildMceProject` call sites — the interface IS the emit contract (buildMceProject is typed to return `MceProject`), and it catches the declared-but-not-emitted direction too"
  - "`MceSequence.fps` is the single allowlisted one-language field (Rust-only, `#[serde(default)]`, TS retired it in 53.1-01). Its reason rides the allowlist entry"
  - "N4 was a TS-side omission (`Sequence.visible` existed in the store but `buildMceProject` never wrote it), not a serde drop-hole — fixed by emitting AND hydrating the key explicitly (`visible != null` guard preserves the absent = visible law)"
  - "Green tests = done. No live UAT gate: these are schema/data bugs with deterministic round-trip proof (per the live-evidence policy, schema bugs close on pins)"

patterns-established:
  - "mceFieldContract.test.ts is the standing enforcement of the 261012-d6q dual-language law — any new .mce key added to one language only fails this test with the member and key named"
  - "A .mce field fix carries two pins: the Rust save→open round-trip (the serde boundary) and the TS buildMceProject→hydrateFromMce round-trip (the emit+hydrate boundary). Together they cover save → serde → hydrate"

requirements-completed: [MBL-01]
uat_status: pinned (deterministic — no live UAT gate for schema bugs)
uat_date: 2026-10-13

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "N1: Rust MceLayerSource declares video_asset_id; save→open keeps the id, hydrate never falls back to a fresh UUID"
    requirement: "VID-02 (integration half)"
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_save_and_open_roundtrip"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.fieldDropHoles.test.ts#N1"
        status: pass
  - id: D2
    description: "N2: Rust MceProject declares motion_blur (MceMotionBlur struct in both languages); prefs survive save→close→reopen"
    requirement: "MBL-01"
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_save_and_open_roundtrip"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.fieldDropHoles.test.ts#N2"
        status: pass
  - id: D3
    description: "N3: Rust MceKeyframeValues declares source_overrides; FX source-property overrides survive save→open"
    requirement: "53.1 D-07/I-5 composition"
    verification:
      - kind: unit
        ref: "app/src-tauri/src/services/project_io.rs#test_save_and_open_roundtrip"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.fieldDropHoles.test.ts#N3"
        status: pass
  - id: D4
    description: "N4: buildMceProject emits Sequence.visible and hydrateFromMce reads it back (absent = visible preserved)"
    requirement: "53.1 FX hide/show persistence"
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.fieldDropHoles.test.ts#N4"
        status: pass
      - kind: unit
        ref: "app/src/stores/projectStore.fieldDropHoles.test.ts#N4-absent"
        status: pass
  - id: D5
    description: "Structural pin: TS↔Rust field-diff contract parses both declaration surfaces, diffs wire keys per .mce member both directions, allowlists only MceSequence.fps"
    requirement: "261012-d6q dual-language law enforcement"
    verification:
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#agrees-on-every-wire-key"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#same-set-of-mce-members"
        status: pass
      - kind: unit
        ref: "app/src/lib/mceFieldContract.test.ts#self-test-of-the-diff"
        status: pass

# Gates
gates:
  cargo_lib: 68/68
  vitest: 269 files / 4915 passed / 1 skipped / 96 todo
audit_acknowledged:
  milestone: v1.0.1
  at: 2026-10-14
  status: unknown
---
