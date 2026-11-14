---
phase: quick-261028-k03
verified: 2026-10-28T14:55:44Z
status: human_needed
score: 3/7 must-haves verified
covered_files: [".planning/quick/261028-k03-lift-eraser-must-erase-live-scripted-and/261028-k03-PLAN.md",".planning/quick/261028-k03-lift-eraser-must-erase-live-scripted-and/261028-k03-SUMMARY.md","app/src/components/physic-paint/PhysicsPaintStudio.test.ts","app/src/components/physic-paint/PhysicsPaintStudio.tsx","app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx","app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx","app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts","app/src/components/physic-paint/engine/aquarelleLiftEngineContract.test.ts","app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts","app/src/components/physic-paint/roto/aquarelleLiftErase.test.ts","app/src/components/physic-paint/roto/aquarelleLiftErase.ts","app/src/components/physic-paint/roto/aquarelleLiftEraseContract.test.ts","packages/efx-watercolor/src/engine/deposit.ts","packages/efx-watercolor/src/engine/fluid.test.ts","packages/efx-watercolor/src/playground/Engine.ts"]
covered_digest: "v3:sha256:4ea25b29d5b3e9317129164d3bfbb9f4497aa98415daf2c7811f33c47eb4a013"
behavior_unverified: 4
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/7
  gaps_closed:
    - "Stale per-stroke tool: `liveStrokeTool` cached from `Engine.onStrokeTool` leaked across strokes (the engine emits only on a change), so a brush after a forced-tool stroke was recorded as lift and ran the destructive punch, and a genuine Lift could miss it. Removed in 234655ad."
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Lift on a live sheet also erases pigment baked into the fixed layer by an explicit Dry, and one paint Undo restores it (truth 1)."
    test: "Live sheet, Script ON: paint, press Dry, Lift over the dried pigment; then press Undo once."
    expected: "The dried area lightens under the Lift gesture and the single Undo restores it."
    why_human: "The GPU lift pass and the fixed-pool undo restore have no behavioral test; the oracle test covers deposit.ts, not the renderer (UAT row 1)."
  - truth: "On a committed frame a Lift stroke lightens the displayed cached paint immediately, survives navigation/Studio reopen, and a later Apply does not resurrect it (truth 2)."
    test: "Cooked + script frame, Script ON: Lift; navigate away and back; reopen Studio; press Apply."
    expected: "The displayed paint lightens with no manual Apply and stays erased everywhere; Apply does not restore it."
    why_human: "The punch math is unit-tested and the pipeline is source-pinned, but no test drives captureLivePixels, the cache merge or the display refresh (UAT row 4)."
  - truth: "With Script ON the Lift is recorded, no durable base (including one pinned by that stroke) retains pre-erase pigment, and a re-bake does not resurrect it (truth 3)."
    test: "Cooked/raster-only, Script ON: Lift; delete the Lift event and Apply again; reopen the project and Apply."
    expected: "The Lift event exists; after deleting it only script-layer paint returns; the punched base stays punched."
    why_human: "The durable rewrite is source-pinned (single D^K set) and the punch is unit-tested, but no test exercises the durable-base to bake integration (UAT rows 4, 6)."
  - truth: "A raster-only erase commits through the physical-edit transaction and is declared permanent in the status capsule (truth 5)."
    test: "Raster-only frame, Script OFF: Lift, navigate away and back, reopen."
    expected: "The pixels stay lightened and the capsule shows 'Lifted — erased pixels are permanent (no undo).'"
    why_human: "The commit, the display reconcile and the capsule text are source-pinned only (UAT rows 7-8)."
human_verification:
  - test: "UAT row 1 — live sheet, Script ON: paint, Dry, Lift the dried area, press Undo once."
    expected: "Dried pigment lightens under Lift; one Undo restores it; every other tool still leaves dried pigment permanent."
    why_human: "The engine's GPU fixed-layer lift and the fixed-pool undo snapshot are source-pinned; the passing oracle test covers deposit.ts, not the renderer."
  - test: "UAT row 4 — cooked + script, Script ON: Lift, navigate away and back, reopen Studio, Apply."
    expected: "Display lightens immediately; erased pixels stay erased; Apply does not resurrect."
    why_human: "captureLivePixels, the pigment-alpha merge and the display refresh are not exercised by any test."
  - test: "UAT row 6 — raster-only, Script ON: Lift; delete the Lift event and Apply again."
    expected: "Only script-layer paint returns; the punched base stays punched; reopen + Apply shows no resurrection."
    why_human: "The durable-base to re-bake integration is only source-pinned."
  - test: "UAT rows 7-8 — raster-only, Script OFF: Lift, navigate away and back, reopen."
    expected: "The erase persists and the capsule declares the erase permanent (no undo)."
    why_human: "Commit, display reconcile and capsule copy are source-pinned only."
  - test: "Stylus parity regression (the fixed gap): flip the pen to the hardware eraser, erase, then paint a normal brush stroke; separately select Lift after a forced-tool stroke."
    expected: "The brush stroke is recorded as brush (no punch, no eraser replay), and the genuine Lift still records as lift and punches."
    why_human: "The per-stroke tool now comes from Engine.onStrokeEnd(tool); only a source pin exists — live hardware behaviour needs the pen."
---

# Phase quick-261028-k03: Lift three-state erase — Verification Report

**Phase Goal:** Lift (eraser) must erase live, scripted, and raster-only paint — settle the three-state truth table first. D1: Engine.lift also erases fixed pigment with a fixed-pool undo snapshot. D2: a committed-frame lift punches the displayed composite and the durable pre-script base in transmittance space, commits through captureLivePixels({baseCanvas, mergeBlend:'pigment-alpha'}), records when Script is ON, never resurrects on Apply. D3: Script OFF with an existing script is refused at pointerdown. D4: raster erase is permanent and declared; no new undo kind.
**Verified:** 2026-10-28T14:55:44Z
**Status:** human_needed
**Re-verification:** Yes — previous gap fixed in 234655ad

## Previous Gap — RESOLVED

The only blocker from the previous report is fixed in `234655ad` and verified structurally:

- `AquarelleCanvasLayer.tsx` contains **no** `onStrokeTool` usage (grep returns only `onStrokeEnd`), so the cross-stroke cache that leaked is gone.
- The layer now records from the engine's per-stroke argument: `onStrokeEnd(tool)` at `AquarelleCanvasLayer.tsx:409`, `tool: (tool ?? toolForSelection()) as AquarelleTool` at `:425`.
- The engine passes the tool resolved for THAT stroke: `this.callbacks.onStrokeEnd?.(s.tool)` at `Engine.ts:1599` (stroke-local `s.tool` set at pointerdown resolution, `Engine.ts:1415-1424`; callback type at `:38`). The fallback to the selection only covers test doubles.
- The lifecycle pin exists and passes: `records the ENGINE-resolved tool per stroke, never a stale carried value` — `aquarelleLiftEraseContract.test.ts:91-98` asserts `onStrokeEnd(tool)`, the record literal, and the ABSENCE of `onStrokeTool`.

Consequence: a brush after a stylus-eraser stroke can no longer be recorded as lift (no destructive punch on an ordinary gesture), and a genuine Lift can no longer be recorded as the stale tool (the punch path is reached whenever `stroke.tool === 'lift'`, `PhysicsPaintStudio.tsx:6104`). Runtime confirmation of the pen behavior remains a UAT row.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lift also erases `fixed` pigment (explicit Dry); one Undo restores it; other tools leave dried pigment permanent | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `Engine.ts:1876` `history.protect(1, …, this.fixed.views)` before the draw; `:1889-1890` full `amount`, then `g.draw(this.fixed, rect)`; oracle `deposit.ts:201-222`; `fluid.test.ts:346-366` passes 16/16. GPU pass + undo restore not behaviorally tested — Human item 1. |
| 2 | A committed-frame Lift lightens the displayed cached paint immediately and survives navigation/reopen/Apply | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Pipeline `PhysicsPaintStudio.tsx:5900-6086` (flush `:5948`, punch `:5968`, capture `:6020-6029`, refresh `:6051-6064`); per-stroke tool fixed (`AquarelleCanvasLayer.tsx:409,425`; `Engine.ts:1599`). No test drives the commit/display — Human item 2. |
| 3 | Script ON: Lift recorded; no durable base (incl. stroke-pinned) keeps pre-erase pigment; no resurrection on Apply | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Preflight booleans `:5872-5874`; durable gate `:5979` (`scripted || willPinBase || has`); `willPinBase ? punched.bytes : durable` `:5985`; one `set(` `:6046-6048` (Studio count 4); record `:6158`. Base→bake integration unexercised — Human item 3. |
| 4 | Script OFF with an existing script: refused at pointerdown; no live erase, no record, no commit; exact capsule copy | ✓ VERIFIED | Pointerdown capture gate `AquarelleCanvasLayer.tsx:603-611` before `cancelAutoFix(:612)`; same preflight `PhysicsPaintStudio.tsx:5877`; copy `:257`; plumbing `PhysicsPaintCanvasMount.tsx:52,183-184`; contract pin passes. |
| 5 | Raster-only erase commits through the physical-edit transaction and is declared permanent (no undo) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Capture `:6020-6029` (`cachedBase: null`, `baseCanvas: punched.canvas`, `mergeBlend: 'pigment-alpha'`); declaration `:6067-6070`. Commit/display not exercised — Human item 4. |
| 6 | Group frames and scripted keys with an unknown pre-script base fail closed; nothing written | ✓ VERIFIED | `PhysicsPaintStudio.tsx:5870` empty→normal; `:5871` non-ordinary-key refusal; `:5891` unknown-base refusal; the pointerdown gate runs the same preflight (`:7030-7036`) so no engine erase and no record. |
| 7 | Stored sheets stay opaque transmittance; erase lightens in linear light; no alpha holes | ✓ VERIFIED | `aquarelleLiftErase.ts:257-283` writes RGB only (alpha untouched), `:236-246` sRGB↔linear, `t^K`; `aquarelleLiftErase.test.ts` 24/24 pass incl. the sRGB-64 linear-light negative control. |

**Score:** 3/7 truths verified (4 present, behavior-unverified); 0 failed.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/src/playground/Engine.ts` | lift multiplies `fixed` after ink/wet; fixed-pool protect before the fixed draw | ✓ VERIFIED | `:1869-1893`; protect `:1876` precedes draw `:1890`; full amount at `:1889`; `amount * 0.8` only on wet `:1888`. |
| `packages/efx-watercolor/src/engine/deposit.ts` | oracle `liftAt` subtracts fixed pigment | ✓ VERIFIED | `:201-222`; early-out `m + f <= 0`; fixed colour mass scaled. |
| `packages/efx-watercolor/src/engine/fluid.test.ts` | law pin: lift removes fixed pigment after Dry | ✓ VERIFIED | `:346-366`; 16/16 pass. |
| `app/.../engine/aquarelleLiftEngineContract.test.ts` | source pins for fixed draw, protect, full amount, oracle | ✓ VERIFIED | 4/4 pass. |
| `app/.../roto/aquarelleLiftErase.ts` | `collectLiftDabs`, `buildLiftCoverage` → `{coverage, coverageRect}`, punch helpers, awaited codec | ✓ VERIFIED | `:109`, `:174`, `:257`, `:292`, `:367`. |
| `app/.../roto/aquarelleLiftErase.test.ts` | constants, `t^K`, multiplication, alpha, y-flip, rect, awaited encode | ✓ VERIFIED | 24/24 pass. |
| `app/.../engine/AquarelleCanvasLayer.tsx` | pointerdown capture gate before `cancelAutoFix`; per-stroke engine tool | ✓ VERIFIED | `:409,425` record; `:603-611` gate; no `onStrokeTool`. |
| `app/.../engine/PhysicsPaintCanvasMount.tsx` | message-string plumbing with refs | ✓ VERIFIED | `:52-53,86-87,104-105,183-184`; 12/12 tests pass. |
| `app/.../PhysicsPaintStudio.tsx` | preflight, eager snapshot, flush, punch, three-copy sync, refresh, exact copy | ✓ VERIFIED | `:257-262`, `:5860-5895`, `:5900-6086`, `:6104-6167`, `:7030-7041`. |
| `app/.../roto/aquarelleLiftEraseContract.test.ts` | pipeline pins incl. the lifecycle pin | ✓ VERIFIED | 13/13 pass; new pin `:91-98`. |
| `app/.../PhysicsPaintStudio.test.ts` | durable-base set count 3 → 4 | ✓ VERIFIED | Studio count is 4; `delete(` stays 2; 277/277 pass. |
| `app/.../hooks/useRotoFramePersistenceCoordinator.ts` | `baseCanvas`/`mergeBlend` seam; track-scoped flush | ✓ VERIFIED | `:609,613,693-695`; `flushLivePixels(appFrame?, trackId?)` `:836`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| recorded tick-grid points + params | `collectLiftDabs` → coverage → `t^K` | footprint law | ✓ WIRED | `PhysicsPaintStudio.tsx:5954` → `aquarelleLiftErase.ts:109-283`. |
| punched base canvas (D^K) | `captureLivePixels({baseCanvas, mergeBlend:'pigment-alpha'})` → cache → display | physical-edit transaction | ✓ WIRED | `PhysicsPaintStudio.tsx:6020-6029`; seam `useRotoFramePersistenceCoordinator.ts:693-695`. |
| punched durable bytes (B^K) | `aquarelleDurableBaseByKeyRef` entry | one `set(` after the ack | ✓ WIRED | `PhysicsPaintStudio.tsx:6046-6048`; gate `:5979`. |
| Script toggle + `hasAquarelleScriptForFrame` | pointerdown gate | `getAquarelleLiftBlocked` returns refusal copy | ✓ WIRED | `:7030-7036` → mount `:183` → layer `:605-610`. |
| `aquarelleMergeBaseRef` | next capture's base | replaced with D^K pre-await, restored on failure | ✓ WIRED | `:6012-6018`, restore `:6031`, `:6081`. |
| in-flight settle capture | erase punch's base read | `flushLivePixels(frame, trackId)` awaited first | ✓ WIRED | `:5948`; `flushLivePixels(appFrame?, trackId?)` `useRotoFramePersistenceCoordinator.ts:836`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `runAquarelleLiftErase` | `base.bytes` | session merge base / `findCachedRotoDisplayFrameRef`, post-flush | Yes (real cache bytes) | ✓ FLOWING |
| `punchTransmittanceBytes` | `punched.bytes`/`canvas` | real decode→punch→encode | Yes | ✓ FLOWING |
| display refresh | cached base URL | `loadCachedRotoReferenceFrame` + `physicPaintVersion` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| lift erases fixed pigment (law oracle) | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/engine/fluid.test.ts` | 16/16 pass | ✓ PASS |
| punch module + all lift pins | `pnpm exec vitest run` on the five lift app suites | 72/72 pass | ✓ PASS |
| Studio pins (incl. durable set count) | `pnpm exec vitest run .../PhysicsPaintStudio.test.ts` | 277/277 pass | ✓ PASS |
| typecheck | `pnpm run typecheck` (`tsc --noEmit`) | clean | ✓ PASS |

The six lift-related app suites total 349/349 (72 + 277) — matching the SUMMARY. These prove the pins and the pure module; they do not prove the GPU pass, the commit, or the display (see Human Verification).

### Probe Execution

Not applicable — no probe scripts declared or present for this quick.

### Requirements Coverage

No requirement IDs declared (`requirements: []`); the must_haves are the contract.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `aquarelleLiftErase.ts` | 273 | dead guard `typeof k === 'number'` (`!(k < 1)` already covers NaN) | ℹ️ Info | Cosmetic only. |

No `TBD`/`FIXME`/`XXX` markers in any file changed by this phase (13 files scanned). The previous blocker anti-pattern (`liveStrokeTool` stale ref) is gone.

### Human Verification Required

1. **UAT row 1 — live + Dry + Undo.** Paint, Dry, Lift the dried area; one Undo restores it.
   - Expected: dried pigment lightens; one Undo restores; other tools leave dried pigment permanent.
   - Why human: GPU fixed-layer lift and fixed-pool undo are source-pinned only.

2. **UAT row 4 — cooked + script, Script ON.** Lift, navigate away/back, reopen Studio, Apply.
   - Expected: display lightens immediately; the erase survives; Apply does not resurrect.
   - Why human: no test exercises `captureLivePixels`, the merge or the display refresh.

3. **UAT row 6 — raster-only, Script ON.** Lift; delete the Lift event and Apply again; reopen and Apply.
   - Expected: only script-layer paint returns; the punched base stays punched.
   - Why human: durable-base to bake integration is source-pinned only.

4. **UAT rows 7-8 — raster-only, Script OFF.** Lift, navigate away/back, reopen.
   - Expected: erase persists; capsule shows `Lifted — erased pixels are permanent (no undo).`
   - Why human: commit/display/capsule behavior not exercised by tests.

5. **Stylus parity regression (the fixed gap).** Flip the pen to the hardware eraser, erase, then paint a normal brush stroke; separately select Lift after a forced-tool stroke.
   - Expected: the brush stroke records as brush (no punch, no eraser replay); the genuine Lift still records and punches.
   - Why human: the per-stroke tool comes from `onStrokeEnd(tool)`; only a source pin exists — live hardware behavior needs the pen.

### Gaps Summary

No blocking gaps remain. The previous blocker (stale per-stroke tool) is fully resolved in `234655ad`: the layer no longer reads `onStrokeTool`, records the engine-resolved tool passed to `onStrokeEnd(tool)`, and the contract suite pins both facts. The engine half (D1), the pure punch module, the pointerdown refusals, the durable/transaction plumbing and the display-refresh wiring are present, wired and green (349/349 lift-related app tests, 16/16 oracle, typecheck clean). The four remaining truths assert GPU/commit/display behavior that no automated test exercises, so they are routed to native UAT rows 1, 4, 6, 7-8 plus the stylus-parity regression check — no automated claim of visual correctness is made.

---

_Verified: 2026-10-28T14:55:44Z_
_Verifier: Claude (gsd-verifier)_
