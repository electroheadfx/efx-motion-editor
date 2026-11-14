---
phase: quick-261018-odm
plan: 261018-odm
subsystem: physic-paint-roto-script
tags: [aquarelle, dual-engine, script-persistence, playback, rust-validator]
dependency_graph:
  requires: [56-08, 56-09, 56-11]
  provides: [ODM-01]
  affects: [script-library, play-script-controller, clipboard, schema]
tech_stack:
  added: []
  patterns: [dual-engine-envelope, dry-marker-stroke-entry, persisted-first-timeline]
key_files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
    - app/src-tauri/src/services/script_library.rs
    - app/src/types/physicPaint.ts
decisions:
  - "Envelope discriminator is the document-level engineId (locked): efx-physic-paint = engine-1, efx-watercolor = aquarelle."
  - "Aquarelle envelope pts stay in UV space (y-up 0..1); only the engine-1 PaintStroke bridge converts to pixel space."
  - "Dry events persist as distinguished stroke entries with engine.kind 'dry' — one payload union (D-16), never a second events array."
  - "aquarelleEventsFromScript is persisted-first; the in-memory record map is the same-session fallback only."
metrics:
  duration: ~12min
  completed_date: "2026-10-18"
status: complete
actuals:
  tokens: 16400
  tasks: 4
  commits: 4
  plan_head_before: ee564e0d11eee3df5c031b2c32c84edaf1ab1ffc
  plan_head_after: d1e57be70f88b7a818d5284257bdbe4f5fb4f06a
---

# Quick 261018-odm: Build watercolor script playback (extend) Summary

Dual-engine `.efx-roto-script.json` envelope: watercolor (aquarelle) Roto scripts now persist as `engineId: 'efx-watercolor'` with `AquarelleStrokePayload` engine slots and UV points, and Play Script Apply rebuilds the aquarelle timeline from the persisted document — producing washes, bleed, granulation, and tide lines instead of thin engine-1 brush lines. Engine-1 scripts stay byte-stable.

## Task Results

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Dual-engine script schema — aquarelle envelope variant + runtime timeline | `d894c120` | physicsPaintRotoScriptSchema.ts, physicsPaintRotoScriptSchema.test.ts, physicsPaintRotoScriptClipboard.ts |
| 2 | Save path serializes watercolor captures as the aquarelle variant | `5e7e5140` | physicsPaintRotoScriptClipboard.ts, physicsPaintRotoScriptLibrary.ts, physicPaint.ts |
| 3 | Playback rebuilds the aquarelle timeline from the persisted script | `f2363e42` | physicsPaintRotoPlayScriptController.ts, physicsPaintRotoPlayScriptController.bake.test.ts |
| 4 | Rust durable validator accepts the aquarelle script variant | `d1e57be7` | script_library.rs |

## What Was Built

1. **Schema (Task 1):** `ROTO_SCRIPT_ENGINE_ID_AQUARELLE`, `PersistedRotoScriptAquarelleV1`, `serializeAquarelleRotoScript` (UV pts, cuisson 0, Dry markers as distinguished stroke entries), dual-engine `parseRotoScript` dispatch, `persistedRotoScriptToRuntime` fills `engineId` + `aquarelleEvents` and pixel-space brushes via `aquarelleUvToEnginePixel`.

2. **Save path (Task 2):** `captureScriptForPersistence` attaches `aquarelleEvents` when every primary has a recorded `AquarelleStroke`; `saveActiveFrame` picks `serializeAquarelleRotoScript` when the timeline is present; clipboard forwards `engineId` + `aquarelleEvents`.

3. **Playback (Task 3):** `aquarelleEventsFromScript` returns `script.aquarelleEvents` when present (persisted-first), falling back to the in-memory record map for same-session captures. `bake.bake` receives the exact persisted event list.

4. **Rust validator (Task 4):** `validate_document` accepts both engineIds; `validate_envelope_stroke` allows empty pts for Dry markers; `validate_engine_payload` dispatches aquarelle stroke (`brush|water|pen|lift`) and Dry marker arms. Engine-1 arm unchanged.

## Test Counts

- **TypeScript:** 263 tests passed (schema 22, library 38, clipboard 49, bake 5, controller 149)
- **Rust:** 9 unit tests passed (5 pre-existing + 4 new dual-engine cases)

## Deviations from Plan

None — plan executed as written.

### Auto-fixed Issues

None.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- All 8 modified files exist on disk.
- All 4 task commits (`d894c120`, `5e7e5140`, `f2363e42`, `d1e57be7`) are ancestors of HEAD.
