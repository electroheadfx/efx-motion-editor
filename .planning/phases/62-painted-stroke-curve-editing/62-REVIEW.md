---
phase: 62-painted-stroke-curve-editing
reviewed: 2026-11-14T17:33:58Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx
  - app/src/components/physic-paint/engine/VectorPathOverlay.test.ts
  - app/src/components/physic-paint/engine/VectorPathOverlay.tsx
  - app/src/components/physic-paint/performance/scriptTimelineCodec.test.ts
  - app/src/components/physic-paint/performance/scriptTimelineCodec.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.test.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.test.ts
  - app/src/components/physic-paint/view/vectorPathCurveBracket.ts
  - app/src/components/physic-paint/view/vectorPathHandles.test.ts
  - app/src/components/physic-paint/view/vectorPathHandles.ts
  - app/src/components/physic-paint/view/vectorPathLatches.ts
  - packages/efx-watercolor/src/payload/codec.test.ts
  - packages/efx-watercolor/src/payload/codec.ts
  - packages/efx-watercolor/src/payload/toStudioStroke.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
  necessity: 0
status: issues_found
---

# Phase 62: Code Review Report

**Reviewed:** 2026-11-14T17:33:58Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Incremental adversarial review of the phase-62 diff since `c27dea58b`: the three follow-up commits `84f544d60` (vector provenance in the stroke list / AQTL flag bit 4 / read-only Vertex colour), `e6ba5b8b9` (canvas entrance into painted curves, select-then-move vertices), and `a07baf51b` (the settling-teardown bracket fix). Scope is the 22 source files touched by those commits; planning artifacts are excluded.

The prior report's **CR-01 and WR-01 are verified FIXED in `a07baf51b` and are not re-reported.** `endCurveBracket` now preserves the captured snapshot across an awaited settle, and `beginCurveWireframeBracket` takes over an in-flight teardown by inheriting the ORIGINAL pre-entry values (`curveBracketReleasing`), so a third entry can never capture a mid-teardown view. Double-entry, triple-entry, restore/no-restore and leave-Draft interleavings all terminate in the correct state; the new pins in `vectorPathCurveBracket.test.ts` hold.

Also verified sound and not re-reported: the entrance latch races (identity-stable `enterPaintedCurve`, unmount cleanup nulls the slot, single-flight arm, compare-then-write session/bracket writes, latch route rejects safely); select-then-move versus D-03 promotion; the AQTL bit-4 round trip (bit 4 writes no payload byte, unknown-bit rejection correctly moved to `0x20`, absent-vs-true preserved end to end through `decodeVectorBlock` → `toStudioStroke` → `restoreAquarelleRecordTimeline`); and every record-store edit seam (`updateAquarelleStrokesInScript`, `updateAquarelleCurveModeInScript`, `updateAquarellePathInScript`), which spread the source stroke and therefore preserve provenance. Deferred items from the previous report (WR-02..04, IN-01..03) were re-checked and deliberately not re-listed.

Seven findings: 1 BLOCKER, 3 WARNING, 3 INFO. The blocker is a new-field integration gap: the new `vectorDrawn` provenance is dropped by the script-copy seam, exactly the class of defect that `physicsPaintRotoDuplicateScript.curveMode.test.ts` was written to pin for `curveMode`. The necessity rubric (`.claude/gsd-core/references/necessity-review.md`) was read and applied: **zero necessity findings** — the defensive payload reads sit on a deserialization trust boundary, the guarded seams are test seams, and the one unreachable label is classified as an INFO code-quality item rather than necessity.

Tool status at review time: `npx tsc --noEmit` exit 0 and targeted `npx vitest run` exit 0.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: The script-copy seam drops `vectorDrawn`, so Duplicate / +Key / rail-key copies reclassify a drawn vector and permanently lose its provenance

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoDuplicateScript.ts:181-208`
**Severity:** BLOCKER
**Issue:** `aquarelleStrokeFromScriptEvent` reconstructs an `AquarelleStroke` field by field and carries `anchors` (line 205) and `curveMode` (line 208), but not the new `vectorDrawn` provenance added by `84f544d60`. Its own docstring (lines 163-180) states the governing law: "the vector path and its discriminator are part of the timeline, not of the pixels — a replay that dropped them would leave the duplicated key hand-painted and un-editable," and both terms follow `toStudioStroke`'s conditional-spread convention. `vectorDrawn` is the same kind of term and is dropped, so every copy made through this seam produces a recorded stroke whose payload has `anchors` but no `vectorDrawn`.

Consequences, all reachable from the shipped UI:
- The stroke list reclassifies the copy: `aquarelleStrokeSelection.ts:500-594` computes `vectorDrawn = vector && stroke.vectorDrawn === true`, and `strokeRowFilterValue` in `strokeSettingsModel.ts` then renders the row as `<tool>-vector` ("Brush-Vector") instead of `vector` ("Vector") and moves it out of the `vector` filter category into `<tool>-vector`.
- The loss is permanent: `scriptTimelineCodec.ts:612` sets `VECTOR_FLAG_DRAWN` only when `engine.vectorDrawn === true`, so the copied event persists without bit 4 and `restoreAquarelleRecordTimeline` cannot recover it on reopen.

Callers: `copyAquarelleScriptToFrame` (the Duplicate / record-only `+Key` route, entered from `PhysicsPaintStudio.tsx:3877`) and `physicsPaintRotoRailKeyScripts.ts:86` (rail-key scripts). The repo already pins this exact defect class for the sibling field: `physicsPaintRotoDuplicateScript.curveMode.test.ts:1-12` documents "the vector path survives but its evaluation mode does not" as a prior 61-30 bug.

**Fix:** Carry the provenance with the same conditional-spread convention the neighbouring fields use, and pin it:

```ts
...(engine.anchors !== undefined ? { anchors: engine.anchors } : {}),
...(engine.curveMode !== undefined ? { curveMode: engine.curveMode } : {}),
// 62-UAT: drawn provenance is part of the timeline too; absent stays absent
// so a hand-painted or converted event keeps its exact key set.
...(engine.vectorDrawn === true ? { vectorDrawn: true as const } : {}),
```

Add a `physicsPaintRotoDuplicateScript.vectorDrawn.test.ts` mirroring the curveMode suite: a drawn event projects `vectorDrawn: true`; a plain and a converted event project no `vectorDrawn` key.

### Warnings

#### WR-01: The Curve-tab entrance drops the promise from `enterPaintedCurve`, leaving any unexpected rejection unhandled

**File:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:1057`
**Severity:** WARNING
**Issue:** `void bundle?.enterPaintedCurve?.([target]);` is the only entrance that neither awaits nor catches the promise. `enterPaintedCurve` is `async` (`PhysicsPaintStudio.tsx:10317-10337`) and awaits `armDraftBase()`, whose body reaches store/composite reads and then `beginPaintedCurveSession` / `beginCurveWireframeBracket`. Expected refusals return `false` (the bake inside `ensureAquarelleDurableBaseRef.current` is wrapped in `try { … } catch { return false }` at `PhysicsPaintStudio.tsx:8038`), but any throw outside those catches — e.g. `aquarelleCompositeRef.current(appFrame)` at `PhysicsPaintStudio.tsx:7922`, which runs before the try — rejects the promise. The latch route (`vectorPathLatches.ts`, `requestPaintedCurveEntrance`) already guards the identical call with `.catch(console.error)`; this route does not, so such a failure surfaces only as an unhandled rejection with no user-visible error for the failed Edit press.

**Fix:** Match the latch route's guard:

```ts
if (curveEntry?.kind === 'painted') {
  void Promise.resolve(bundle?.enterPaintedCurve?.([target])).catch(console.error);
  return;
}
```

#### WR-02: The AQTL v2 format header was not updated for flag bit 4 and still claims bit 3 is the highest reserved flag

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:36-56`
**Severity:** WARNING
**Issue:** The header is the format's only written specification. It still enumerates the vector flags as "bit 0 … bit 1 … bit 2 … bit 3" (lines 37-40), and line 55 states "An older reader refuses bit 3 (reserved-flags check): fail closed" — after `84f544d60` added `VECTOR_FLAG_DRAWN = 1 << 4` (line 187) and widened the reserved mask to include it (lines 190-193). The header also never records the new bit's wire law: bit 4 carries **no payload byte** — the flag byte is the entire marker — which is why the encoded size is unchanged and why the bit must be decoded before any byte-consuming branch. Anyone implementing a second reader/writer from this header would treat bit 4 as reserved and refuse valid files, or write the bit and then look for a phantom byte.

**Fix:** Extend the vector-block paragraph: add "bit 4 = the stroke was CREATED by the vector pen (drawn provenance); it carries no payload byte — the flag IS the marker," and restate the fail-closed sentence as "An older reader refuses bit 3 or bit 4 (reserved-flags check): fail closed, exactly like every other unknown vector flag."

#### WR-03: The new persisted engine key `vectorDrawn` is undeclared in the `MceAquarelleVectorPath` dual-language mirror and its exact-keys pin

**File:** `app/src/types/project.ts:361-364`, `app/src-tauri/src/models/project.rs:505-509`, `app/src/lib/mceFieldContract.test.ts:284`
**Severity:** WARNING
**Issue:** `vectorDrawn` rides inside `MceEngineStrokePayload.engine` alongside `anchors` and `curveMode` (the carrier is opaque: `Record<string, unknown>` / `Option<Value>`), but neither the TS view interface nor the Rust mirror declares it, and the pin at `mceFieldContract.test.ts:284` still asserts exactly `['anchors', 'curveMode']`. The contract test's own header names the risk: "SILENT NON-DECLARATION: the payload works today and drops out of the dual-language contract the first time the models are regenerated." Phase 61 treated this as load-bearing — `261111-wd6` added `color` to the anchor pin when anchor colour landed. The save/load path does not lose the key today, so this is contract drift, not data loss.

**Fix:** Declare `vectorDrawn?: boolean` in `MceAquarelleVectorPath` (TS) and add `#[serde(rename = "vectorDrawn")] pub vector_drawn: Option<bool>` (Rust), then extend the pin to `['anchors', 'curveMode', 'vectorDrawn']` and extend the Phase-61 envelope round trip with a drawn fixture.

### Info

#### IN-01: `'lift-vector': 'Eraser-Vector'` is an unreachable filter label

**File:** `app/src/components/physic-paint/view/strokeSettingsModel.ts:330`
**Severity:** INFO
**Issue:** `ScriptStrokeFilterValue` (`scriptStrokeEdition.ts:56-105`) excludes `'lift-vector'`, `strokeRowFilterValue` returns `'lift'` for every lift row, and `resolveStrokeToolFilter` can never produce `'lift-vector'`. The entry exists only because the record key is typed as `` `${ScriptStrokeTool}-vector` ``; it can never render and advertises a category the filter model deliberately retired.
**Fix:** Narrow the record key type to `'vector' | \`${'brush' | 'water' | 'pen'}-vector\`` (or drop the entry and widen the type at the call sites).

#### IN-02: The Vertex colour reading omits the `anchorWidthTarget` guard its Vertex size and Corner siblings use

**File:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:732-748`
**Severity:** INFO
**Issue:** `anchorColorReading` gates only on `engineModule` and `selectedVectorAnchors !== null`, then reads `vectorAnchorSelection.value` — the OPEN edit's selection. Vertex size (lines 703-707) and Corner (lines 758-765) first resolve `anchorWidthTarget`, which requires `pathEditMutationId === String(ids[0])` (`strokeSettingsModel.ts:1033-1040`). During a selection swap between two strokes, before the dialog's exit effect closes the old edit, `selectedVectorAnchors` can name the newly selected stroke while `vectorAnchorSelection` still holds the previous stroke's indices, so the row can display a colour derived from mismatched anchors for one painted frame. Display-only and self-correcting; the row writes nothing.
**Fix:** Resolve the colour reading from the same guard: `anchorWidthTarget === null ? ANCHOR_COLOR_EMPTY_READING : readAnchorColorReading(...)`, mirroring `cornerReading`.

#### IN-03: The `requestAquarellePathEdit` doc claims any refusal leaves selection untouched, but the painted branch writes selection before an async entrance can refuse

**File:** `app/src/components/physic-paint/engine/AquarelleStrokeOverlay.tsx:52-59`
**Severity:** INFO
**Issue:** The comment states "No registered host — or any refusal — leaves the stroke and the selection untouched." The host-absence check at line 57 is indeed before the selection write at line 58, but `requestPaintedCurveEntrance` (line 59) is asynchronous: a later refusal (arm refused, eligibility re-check, session refusal) leaves the selection already changed. Behaviour is acceptable — selecting the double-clicked stroke is what the user asked for — but the comment overstates the invariant for future readers.
**Fix:** Reword to "No registered host leaves the stroke and the selection untouched; a refusal after dispatch may leave the stroke selected with no session open."

---

_Reviewed: 2026-11-14T17:33:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
