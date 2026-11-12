# Phase 61 UAT quicks — per-stroke brush, paint routing, Paint-tab removal, per-vertex color/size

Branch: `gsd/phase-61-vector-painting-tool`, milestone v2.1.0.

Already landed (do not redo):
- `cb49cc728` — Ribbon removed from `packages/efx-watercolor` (payload, engine branch, shaders, preset, adapter, probe).
- `842b1b9cc` — render mode removed from the app and AQTL format; the decoder skips the legacy byte.
- `b27035712` — renderMode dropped from the `.mce` Rust model.

Run the quicks in order. Quick 3 depends on 1+2; quick 4 depends on 3. Quick 5 is the per-vertex feature.

Reminder: after editing `packages/efx-watercolor`, run `pnpm build` there — the app resolves `dist`.

---

## Quick 1 — selection edit port + brush patch fields

```
Milestone v2.1.0, Phase 61 UAT follow-up. Branch gsd/phase-61-vector-painting-tool.

Goal: data plumbing so the selected strokes can receive a brush change in one undoable edit.

- app/src/components/physic-paint/view/aquarelleStrokeSelection.ts: add a plain module-level
  selection edit port (same pattern as scriptStrokeEdition.ts:555-591):
  setAquarelleSelectionEditPort(port|null), where the port exposes
  applyAppearance(ids, patch). Add aquarelleSelectionEditActive() =
  scriptSelectMode.peek() && selected ids non-empty, and
  commitAquarelleSelectionAppearance(patch) that peeks the ids and forwards to the
  port (false when there is no port or no selection). Peek-only reads.
- Extend BOTH structurally identical patch types with brushId?: string and
  toolOverrides?: Partial<AquarelleToolOverrides>:
  ScriptStrokeAppearancePatch (view/strokeSettingsModel.ts) and
  AquarelleStrokeAppearancePatch (view/aquarelleRecordState.ts).
- updateAquarelleStrokesInScript (aquarelleRecordState.ts): validate the whole patch
  before touching any target — brushId non-empty and resolvable through findTip or
  BRUSH_PRESETS, every supplied override finite. Write
  { ...stroke, brushId?, toolOverrides: { ...stroke.toolOverrides, ...patch.toolOverrides } }.
  Keep the toStudioStroke reprojection, same timeline index, ONE revision bump.
- PhysicsPaintStudio.tsx: register the port beside
  aquarelleAppearanceCommitRef.current = handleAquarelleAppearanceStrokes (~9218),
  forwarding to that same handler so one patch = one undo entry and one re-bake.

Guardrails: no renderMode; no per-vertex color; never mutate a stroke in place; one
undo entry per batch; vitest run only, never watch.
Verify: cd app && pnpm typecheck; record-state + Studio suites green; new tests for
brushId validation, override merge, and the single revision bump.
```

---

## Quick 2 — SliderStepper commit boundary

```
Milestone v2.1.0, Phase 61 UAT follow-up.

Goal: an optional commit boundary on app/src/components/shared/SliderStepper.tsx.

- Add optional onCommit?(value: number). onChange stays continuous (live moves).
  onCommit fires ONCE per gesture at the release boundaries: track pointerup,
  typed Enter, typed blur, and each ± stepper press.
- Dedupe: Enter followed by blur must not double-commit. The track pointerup must
  read the gesture's draft value, not a stale prop. Fire the commit even when the
  value equals the value prop (selection commits bind to the live brush, not the
  selection).
- Absent onCommit must leave every existing control byte-identical.

Guardrails: no new test config; vitest run only.
Verify: cd app && pnpm typecheck; vitest run src/components/shared/SliderStepper.test.ts.
Tests: continuous move calls onChange only; release calls onCommit once; Enter+blur
commits once; stepper buttons commit.
```

---

## Quick 3 — brush picks and paint controls edit the selection

```
Milestone v2.1.0, Phase 61 UAT follow-up. Depends on quicks 1 and 2.

Goal: selecting a stroke (hand-painted or vector) and picking a brush / moving a paint
slider changes THAT stroke, while the live brush still updates as today.

- New app/src/components/physic-paint/view/aquarellePaintControls.ts:
  - pickAquarelleBrush(presetId): call selectAquarelleTip(presetId) (live brush,
    unchanged), then commitAquarelleSelectionAppearance({ brushId: presetId,
    toolOverrides: aquarelleToolOverrides.peek() }) addressed to the non-lift
    selected strokes.
  - commitAquarelleSelectionParam(key, value) and
    commitAquarelleSelectionMultiplier(field, value): selection-only commits used by
    the slider release boundaries.
- Route every brush pick through pickAquarelleBrush (keep setAquarelleLiftTipId for the
  eraser branch): view/PhysicsPaintBrushMenu.tsx (~187), view/WatercolorBrushLibrary.tsx
  (~84), view/BrushesDocker.tsx (~88, ~215; custom tip results too).
  WatercolorBrushLibrary.BrushCard must NOT call setAquarelleSelectMode(false) when a
  selection is armed — setScriptSelectMode(false) clears the selection.
- Wire SliderStepper onCommit:
  - top bar size/pigment/water/edges/grain (view/PhysicsPaintTopBar.tsx TopBarSlider);
  - sidebar Paint tab size pair (view/PhysicsPaintRightPanel.tsx ~454) and the seven
    rows + Reset in view/AquarelleGlobalsPanel.tsx (Reset = ONE 7-key patch);
  - BrushResponsePanel.tsx rows (commit one multiplier field).

Guardrails: the live brush writes stay exactly as today; no selection ⇒ no-op; one
undo entry per release/pick; eraser (lift) strokes are excluded from brush picks; no
renderMode; vitest run only.
Verify: app typecheck; brush menu/library/docker, top bar and Studio suites green.
```

---

## Quick 4 — remove the Stroke Settings Paint tab

```
Milestone v2.1.0, Phase 61 UAT follow-up. Depends on quick 3.

Goal: the Stroke Settings dialog is Geometry | Stack only; paint editing lives in the
sidebar Paint/Brush tabs and the top bar (quick 3).

- view/PhysicsPaintStrokeSettingsDialog.tsx: StrokeSettingsTab becomes
  'geometry' | 'stack'; remove the paint entry from STROKE_SETTINGS_TABS,
  paintTabAvailable and the paint→geometry fallback; delete the whole Paint block
  (its Render and Advanced sections are already ribbon-pruned). Move the Curve row
  (CURVE_MODE_OPTIONS + bundle.applyCurveMode) into the Geometry tab. Mount
  AnchorWidthControl in the Geometry tab under the transform rows, using the existing
  anchorWidthAvailable gate and the same commit; keep the list-view mount.
- view/strokeSettingsModel.ts: prune Paint-only helpers/bundle members that become
  unused. Keep applyCurveMode, numericFields/WATERCOLOR_SETTINGS_FIELDS and
  anchorWidthSizeReading (the Size field feeds the list and Geometry readouts).
- Tests: update tab-row and Paint-tab suites; pin that the dialog no longer renders
  stroke-settings-paint and that Curve + Anchor width mount in Geometry.

Guardrails: per-stroke size/color/wet editing must stay reachable from the sidebar and
top bar; do not change anchor-width semantics; no renderMode; vitest run only.
Verify: full physic-paint suite green; app typecheck.
```

---

## Quick 5 — per-vertex color and size

```
Milestone v2.1.0, Phase 61 UAT follow-up. This REVISES the old VEC-04 "width is the
only per-vertex property" law under the user's explicit direction. Scope: per-vertex
COLOR is new; per-vertex SIZE already exists as the anchor width factor — expose it as
the vertex size, do not invent a second size channel.

Data:
- packages/efx-watercolor/src/vector/spine.ts: VectorAnchor gains optional `color?:
  string` (hex, validated like a stroke colour). Absent means the stroke colour.
  Keep it sparse: projectVectorPath drops an absent/unset colour and a colour equal
  to the stroke colour is stored only if the user set it.
- payload/vectorPath.ts: validate/round-trip the new anchor key; anchorsEqual
  compares it; the AQTL anchor record gains u8 colorPresent + u16 byte length +
  UTF-8 bytes (WRITTEN LAST per anchor). Update the codec header comment.
- app/src/types/project.ts and app/src-tauri/src/models/project.rs: add `color:
  Option<String>` / `color?: string` to the anchor shape.

Engine + replay:
- Extend the vector path projection (packages/efx-watercolor/src/vector/spine.ts —
  the same arc-length station list used by sampleVectorWidths) with the per-sample
  colour: interpolate between the neighbouring anchor colours (RGB lerp) so the
  colour is smooth along the path, never a hard step at a sample boundary.
- adapter/engineAdapter.ts: for a vector stroke, feed the per-sample colour to the
  engine through the EXISTING pigment seam (no second deposit path). A stroke with
  no per-vertex colour keeps today's single-pigment bytes exactly.
- Bake and live replay must stay byte-identical for a colourless path and
  deterministic for a coloured one. Add determinism + reopen + export-parity pins.

UI:
- Vector path edit: when one or more anchors are selected, the sidebar Color tab
  commits the chosen colour to THOSE anchors (one undo entry), not the whole stroke.
  No anchor selection ⇒ the existing whole-stroke colour law is unchanged.
- Per-vertex size stays the Anchor width control; label/reading should read as the
  vertex size (keep the 0.2–2.0 factor and the real-px readout).

Guardrails: one undo entry per gesture; no renderMode; existing projects and
colourless strokes keep their exact bytes; vitest run only.
Verify: package check + tests; app typecheck; full physic-paint suite; codec and
export-parity tests green. If the engine colour interpolation cannot meet the
determinism/export pins inside quick scope, STOP and escalate to /gsd-plan-phase
instead of forcing it.
```

---

## After the quicks

Live UAT (user runs the app): no Ribbon card or Render row anywhere; select a
hand-painted stroke and pick another brush in the top bar / Brush tab → that stroke
re-renders; select a vector → same, anchors intact; move Water/Pigment/Size in the top
bar and sidebar Paint tab → the selected stroke updates on release; select two vertices,
give them different colours → the stroke blends between them; Stroke Settings shows
Geometry + Stack only, with Curve and Anchor width in Geometry; saved spline vectors
still open.
