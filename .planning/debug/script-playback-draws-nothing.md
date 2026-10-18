---
status: awaiting_human_verify
trigger: script-playback-draws-nothing — watercolor script saves correctly but playback draws nothing on the canvas. Timeline advances, canvas stays empty. Engine-1 brush mode save/play worked before. Tried mouse and pen.
created: 2026-10-18
updated: 2026-10-18
---

# Debug Session: script-playback-draws-nothing

## Symptoms

- **Expected behavior:** a saved watercolor script plays back and draws the strokes on the canvas.
- **Actual behavior:** the timeline advances but the canvas stays empty. Nothing draws.
- **Errors:** none reported in console. Studio log is clean.
- **Timeline:** the script saves correctly (3 strokes, valid data), but playback renders nothing. Engine-1 brush mode save/play worked before this watercolor work.
- **Reproduction:** paint watercolor strokes in the Water color module → Save Action → click Play in the Actions tab → timeline advances, canvas stays empty. Tried both mouse and pen.

## Architecture (pre-mapped — do not re-derive)

- **Two paint engines:** engine-1 (`EfxPaintEngine`) for brush/physics mode; aquarelle (watercolor module) for watercolor. The save path goes through `engine.getStrokes()` which returns engine-1 `PaintStroke[]`.
- **Script schema:** `physicsPaintRotoScriptSchema.ts` serializes to `StudioScriptEnvelope<PhysicStrokePayload>` with `engineId: 'efx-physic-paint'`. The `engine` slot carries tool/color/params/hasPenInput.
- **Playback:** `applyStrokeToEngine` in `EfxPaintEngine.ts` replays strokes. `strokeHasPenInput` at line 3036 falls back to `p !== 0.5` when `hasPenInput` is undefined.
- **Aquarelle display layer:** `AquarelleCanvasLayer` — frame-scoped, MODE.transparent opaque transmittance composited with MULTIPLY over the fond.
- **Preact + @preact/signals.** No useState. Identity-stable effect deps.
- **frame/export guard:** `physicPaintStore.ts` must contain ZERO `getImageData|putImageData`.

## Saved script data (verified valid)

- 3 strokes, 20+16+11 points, `p: 0.5` (pressure fix 67434c23 in effect), `hasPenInput: false`
- Color `#dd20df`, coords normalized (x: 0.16–0.65, y: 0.17–0.81), engine.params = defaults (size: 50, opacity: 50, etc.)
- `engine.tool: paint`, `brushId: 'efx-physic-paint'`, `engineId: 'efx-physic-paint'`

## Current Focus

- hypothesis: CONFIRMED — coordinate-space mismatch at the aquarelle→engine-1 bridge. Aquarelle records document UV (x,y ∈ 0..1, y-UP). Engine-1 `PaintStroke.points` are canvas pixels (x ∈ 0..width, y ∈ 0..height, y-DOWN). `handleAquarelleStrokeEnd` copies UV points verbatim into the `PaintStroke` it enqueues, so the saved script stores 0.16–0.81 as if they were pixels and `renderRotoPlayScriptFrames` draws a sub-pixel blob at the top-left corner of the 1080×1080 canvas → invisible.
- status: fixing
- next_action: extract `aquarelleStrokeToEnginePaintStroke` helper (UV→pixel + y-flip), wire it into `handleAquarelleStrokeEnd`, pin with a RED→GREEN test.
- reasoning_checkpoint:
  hypothesis: "handleAquarelleStrokeEnd bridges aquarelle document-UV points (y-up, 0..1) into an engine-1 PaintStroke whose points are canvas pixels (y-down, 0..W/H), so the saved script carries sub-pixel coordinates and the engine-1 replay draws at the top-left origin — nothing visible."
  confirming_evidence:
    - "Saved script pts x:0.16–0.65 y:0.17–0.81 on a 1080×1080 document — normalized UV, not pixels."
    - "AquarelleEngine.toUv returns (cx-view.x)/view.w with cy flipped (canvasSize[1]-...): doc UV, y-up. Documented 'doc uv, y up' on onStrokeSample."
    - "EfxPaintEngine pointer capture: cursorX=(clientX-left)*(width/rect.width) — canvas pixels, y-down (screen space)."
    - "PhysicsPaintStudio.tsx:4024 copies `x: p.x, y: p.y` verbatim from AquarelleStroke into the PaintStroke — no scale, no y-flip."
    - "renderRotoPlayScriptFrames → renderProgressiveAlphaFrame → applyStrokeToEngine consumes those points as pixels (curveBounds(points, brushR, this.width, this.height))."
  falsification_test: "If a saved ENGINE-1 brush-mode script replayed correctly after the same Play flow, the shared replay path is fine and the fault is in the watercolor-specific bridge. If converting the saved UV points to pixels makes the stroke appear at the painted location, the hypothesis holds. If engine-1 replay draws correctly even with UV coords (e.g. it normalizes), the hypothesis is wrong."
  fix_rationale: "Convert at the single boundary where aquarelle UV meets engine-1 pixels (the stroke-end bridge). The .efx-roto-script format is the engine-1 PaintStroke format (engineId 'efx-physic-paint') and must carry pixels so the existing engine-1 save/play machinery works unchanged — same contract as native brush-mode strokes."
  blind_spots: "Have not live-verified the painted position after the fix (user UAT required). Pen-pressure semantics at the bridge (aquarelle mouse reports p=-1; serialize clamps to 0.5) are pre-existing and orthogonal — not touched. The aquarelle bake path (engineId 'efx-watercolor' → bakeAquarelleScript) is unreachable for persisted scripts because serializeRotoScript hardcodes engineId and parseRotoScript refuses any other — that is a separate architectural gap, not this bug."
  candidate_causes:
    - "code: bridge copies UV points into a pixel-space PaintStroke (coordinate-space mismatch)"
    - "display: aquarelle layer / excludeActive hides replay output (different category — checked and not the cause of the empty bake; see Eliminated)"
    - "data: saved points are corrupt/zero-length (refuted — 20+16+11 valid points persisted)"
  and_gate: "no — the coordinate mismatch alone is sufficient to produce the empty render; the display-side paths were checked and are not contributing."

## Hypotheses

- H1: the aquarelle display layer (opaque transmittance) covers the engine-1 replayed strokes.
- H2: the Play button click handler doesn't actually replay the strokes (or replays to a canvas that isn't displayed).
- H3: the display composite isn't refreshed after replay (paintVersion not bumped, or the render effect doesn't re-run).
- H4 (CONFIRMED): coordinate-space mismatch — aquarelle doc-UV points bridged into engine-1's pixel-space PaintStroke unconverted.

## Constraints

- Ride existing machinery — no new cache system.
- Live evidence over unit probes (cross-webkit/canvas issues).
- Preact + @preact/signals rules mandatory.
- `physicPaintStore.ts` stays free of `getImageData|putImageData`.

## Evidence

- timestamp: 2026-10-18
  checked: Saved script JSON (05ea4afa…efx-roto-script.json)
  found: 3 strokes with pts x∈0.16–0.65, y∈0.17–0.81 on a source doc of width=1080 height=1080. Values are normalized UV fractions, not pixel coordinates. `engine.params.size=50` (a pixel brush radius of 25) cannot paint a 0.5-pixel-wide path visibly.
  implication: Either the recorder wrote UV into a pixel slot, or the replay scales. Replay does not scale → recorder is wrong.

- timestamp: 2026-10-18
  checked: packages/efx-watercolor/src/playground/Engine.ts — toUv / pushSample / onStrokeSample contract
  found: `toUv` returns `[(cx-view.x)/view.w, (cy-view.y)/view.h]` with `cy = canvasSize[1] - (clientY-r.top)*dpr`. Both axes normalized 0..1; y is UP. Explicit doc comment: "Studio record seam: one pointer sample entered the stroke (doc uv, y up)".
  implication: AquarelleStroke.points are document UV, y-up. This is the input to the bridge.

- timestamp: 2026-10-18
  checked: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts — pointer capture and applyStrokeToEngine
  found: `this.cursorX = (e.clientX - r.left) * (this.width / r.width)` (line 3183) — canvas pixels, y-down. `applyStrokeToEngine` → `renderPaintStroke(points, …, this.width, this.height, …)` and `curveBounds(points, brushR, this.width, this.height)` treat points as pixels.
  implication: PaintStroke.points are canvas pixels. Feeding 0..1 values places the whole stroke inside the top-left pixel.

- timestamp: 2026-10-18
  checked: app/src/components/physic-paint/PhysicsPaintStudio.tsx:4019-4045 (handleAquarelleStrokeEnd)
  found: `points: stroke.points.map((p) => ({ x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, spd: 0 }))` — raw copy, no `* width`, no y-flip. Then `mutationEngine.enqueueRecordedStroke({ primary: paintStroke })`.
  implication: THE DEFECT. The bridge crosses the UV↔pixel boundary without converting.

- timestamp: 2026-10-18
  checked: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:1465 and physicsPaintRotoScriptSchema.ts
  found: `snapshot.engineId === 'efx-watercolor'` routes to `bakeAquarelleScript`, else `renderRotoPlayScriptFrames` (engine-1). But `serializeRotoScript` hardcodes `engineId: ROTO_SCRIPT_ENGINE_ID` ('efx-physic-paint') and `isPersistedRotoScriptV1` requires it; `parseRotoScript` REFUSES any other engineId (engine-mismatch). `persistedRotoScriptToRuntime` never sets engineId. Also `aquarelleEventsFromScript` prefers session-local `getRecordedAquarelleStroke(mutationId)` which is empty after reload.
  implication: Persisted watercolor scripts ALWAYS replay through engine-1. So the engine-1 bridge must carry pixel coordinates — fixing the bridge is the correct and only reachable fix. (The aquarelle bake route is unreachable for persisted scripts; logged as a follow-up architecture gap, not this bug.)

- timestamp: 2026-10-18
  checked: PhysicsPaintCanvasMount.tsx (aquarelleActive → engine surface opacity 0), PhysicsPaintProgramMonitor.tsx (isPlaying → getFlattenedFrame including active track)
  found: During playback `isPlaying=true` draws `getFlattenedFrame` (full composite, active track included) — the baked rail frames ARE the visible surface. The aquarelle live layer is multiply-transparent (white = no-op) and frame-scoped, so it cannot black out the monitor. When NOT playing and `activeModule==='watercolor'`, `excludeActive` hides the active track from the monitor (correct — the live sheet supplies it).
  implication: H1 (aquarelle covers replay) ELIMINATED as the cause of the empty playback. The frames themselves are empty because of the coordinate bug.

- timestamp: 2026-10-18
  checked: Play button wiring (PhysicsPaintScriptsPanel.tsx:169) → playScript.openConfirmation → generate flow (physicsPaintRotoPlayScriptController.ts:1450-1470)
  found: Play = "Create Rail…" → loadSnapshot → renderRotoPlayScriptFrames(script, frameCount, …, size=getSize()). Staged frames are committed as real keys. "Timeline advances" = the rail plays.
  implication: H2 (Play doesn't replay) ELIMINATED — the replay does run; it just paints at the wrong coordinates.

## Eliminated

- hypothesis: H1 — aquarelle display layer covers the engine-1 replayed strokes during playback
  evidence: Program monitor uses getFlattenedFrame (including active track) whenever isPlaying; the aquarelle sheet is MODE.transparent multiply (white = untouched) and clears per edit frame. Baked rail frames are the playback surface — the aquarelle layer cannot hide them. Also the frames themselves are empty (coordinate bug), so there is nothing to cover.
  timestamp: 2026-10-18

- hypothesis: H2 — the Play button doesn't actually replay strokes
  evidence: Play → playScript.openConfirmation → loadSnapshot → renderRotoPlayScriptFrames → engine.renderProgressiveAlphaFrame → applyStrokeToEngine. The pipeline runs end-to-end (3 brushes loaded, "3 brushes" shown in the Actions list). The replay happens; the coordinates are wrong.
  timestamp: 2026-10-18

- hypothesis: H3 — display composite not refreshed after replay (paintVersion)
  evidence: renderRotoPlayScriptFrames encodes staged frames via encodeRotoFrameFromCanvas and commits them as real keys; the monitor redraws on physicPaintVersion/efxPaintVersion bumps. No missing bump on this path. Symptom is an empty raster, not a stale one.
  timestamp: 2026-10-18

- hypothesis: saved stroke data is corrupt (0 points / all-zero)
  evidence: 20+16+11 points persisted with valid normalized coordinates, color, and params. Schema validation (isPersistedRotoScriptV1) passed — the row loads and shows "3 brushes".
  timestamp: 2026-10-18

## Resolution

root_cause: Coordinate-space mismatch at the aquarelle→engine-1 stroke bridge. `handleAquarelleStrokeEnd` (PhysicsPaintStudio.tsx) copies AquarelleStroke points verbatim into an engine-1 `PaintStroke`, but the two point spaces differ: aquarelle records document UV (x,y ∈ 0..1, y-UP, per WatercolorEngine.toUv), while engine-1 `PaintStroke.points` are canvas pixels (x ∈ 0..width, y ∈ 0..height, y-DOWN, per EfxPaintEngine pointer capture). The saved .efx-roto-script therefore stores 0.16–0.81 as if they were pixels; `renderRotoPlayScriptFrames` → `applyStrokeToEngine` draws them inside the top-left pixel of the 1080×1080 canvas, and the baked rail frames come out visually empty.
fix: Extracted `aquarelleStrokeToPaintStroke` / `aquarelleUvToEnginePixel` (app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts) — the ONE aquarelle→engine-1 point crossing: `x = uv.x * width`, `y = (1 - uv.y) * height` (scale + y-flip), plus the existing AQUA-04 → engine-1 param mapping. `handleAquarelleStrokeEnd` now routes through it instead of copying points verbatim.
verification: |
  Fix-Acceptance Guardrail — verdict: accepted
  - Signal 1 (repro test RED→GREEN): `aquarelleStrokeBridge.test.ts` 9/9 green. Mutation check — restoring the verbatim `x: p.x, y: p.y` copy in PhysicsPaintStudio.tsx makes 2 contract pins fail ("routes handleAquarelleStrokeEnd through the conversion helper", "never copies aquarelle UV points into the engine-1 stroke verbatim"); restored fix returns 9/9 green. Bug demonstrably returns on revert.
  - Signal 2 (focused tests): app `engine/ + roto/` = 53 files / 1109 tests green (includes physicsPaintRotoScriptClipboard 49, physicsPaintRotoPlayScriptController 149). efx-physic-paint package 46 files / 376 green. efx-watercolor package 8 files / 114 green.
  - Signal 3 (full suite): app vitest run = 305 passed / 2 skipped, 5276 tests passed / 12 skipped / 96 todo. The single failing suite (src/viteBuild.test.ts, RollupError "Could not resolve entry module ./src/project.ts?project") is PRE-EXISTING — fails identically with the change stashed.
  - Signal 4 (typecheck): `tsc --noEmit` error count 17 before and after — zero new errors, none in touched files (all 17 are pre-existing in AquarelleCanvasLayer.tsx, PaperPicker.tsx, various tests).
  - Signal 5 (constraint audit): physicPaintStore.ts contains ZERO getImageData|putImageData (grep count 0). New modules are pure functions — zero useState, no signals, no effects. Diff is additive conversion at an existing seam (not deletion-only, not a config/flag change).
  - Oracle type: `derived` (contract/model — points must land in engine-1 pixel space, derived from the two engines' documented coordinate contracts) + `specified` boundary neighbours (uv 0/1 flip endpoints, N-1/N+1 interior points, non-square canvas).
  - Blind spot remaining: painted-position accuracy is self-checked numerically (0.1687,0.1775 → 182.2,888.3 px) but NOT live-verified on screen — human UAT required per CHECKPOINT below.
files_changed:
  - app/src/components/physic-paint/engine/aquarelleStrokeBridge.ts (new)
  - app/src/components/physic-paint/engine/aquarelleStrokeBridge.test.ts (new)
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx (handleAquarelleStrokeEnd routes through the bridge)
guardrail_verdict: accepted
