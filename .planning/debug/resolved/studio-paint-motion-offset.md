---
status: resolved
trigger: "Fix the Studio paint offset on rails whose Motion Position is non-identity. When a rail's Position has been changed by a Motion channel, painting on one of that rail's keys commits the stroke offset from the paint cursor by the rail's position delta. v2.1.0-beta2 release blocker introduced by the Phase 59 rail-motion work."
created: 2026-11-09T00:00:00Z
updated: 2026-11-09T18:35:00Z
---

## Current Focus

hypothesis: CONFIRMED by static trace. The committed stroke is NOT double-transformed. The engine maps pointers through the LIVE `getBoundingClientRect` of the CSS-translated sheet, so for a Position (translation) rail the committed content point equals the physical pointer. The brush ring is the only visible paint cursor (the OS cursor is `cursor: none`), and it rendered in an UNTRANSFORMED sibling seat at layout `canvasBounds`; cursorX/Y are content coordinates, so the ring displayed at physical pointer minus the rail delta—making the correctly-placed stroke read as offset.
test: done — seam traced pointer → canvas → content space; derived delta per step (see Evidence)
expecting: with the seat carrying the rail-edit chain, ring display point == committed content point display point == physical pointer under translation
next_action: none — resolved. Live native UAT passed 2026-11-09; regression pin landed; typecheck, pin and full vitest run green.

## Symptoms

expected: The newly painted stroke lands under the paint cursor in the visible canvas, exactly as on a rail with identity Motion.
actual: The committed stroke is offset from the paint cursor by the active rail's non-identity Motion Position delta.
errors: None reported — no crash, no console error.
reproduction: Animate a rail's Position via a Motion channel so it is no longer at its default/centred position, then paint a mark on one of that rail's keys in Studio; the stroke commits offset from the cursor.
started: Introduced by the Phase 59 rail-motion work; blocks the v2.1.0-beta2 release.

## Constraints

- Do not change motion evaluation, key evaluation, compositor rendering, or the selection/transform overlay.
- Identity motion must stay pixel-identical: no new rounding, no scale change, no behaviour change for rails without Motion.
- The compositor's forward motion transform stays unchanged; the fix belongs at the pointer→content (input) conversion.
- Measure before editing and state the measured delta plus the exact seam before proposing a fix.
- Validate live on the native build before adding a regression pin.

## Suspected Cause

The paint pointer is mapped to the visible (already transformed) canvas space, so the stroke is recorded in that space and then transformed a second time by the compositor.

## Eliminated

- **Engine pointer->content double transform (the prefilled suspicion).** The live paint surface maps pointers through `WatercolorEngine.toUv`, which subtracts the LIVE `canvas.getBoundingClientRect()` (`packages/efx-watercolor/src/playground/Engine.ts:1440`). The 59-12 mirror is a CSS `transform` on an ANCESTOR of that canvas (`.physics-paint-tracks-group[data-rail-edit='1'] > .demo-canvas-shell`, physicsPaintStudio.css:9504), so for a pure Position (translation) rail the rect shifts with the sheet and `clientX - rect.left` returns the untransformed CONTENT coordinate. Recording that content point and drawing it back through the same transform lands it under the physical pointer: no second application. `fitCanvas` only reads `rect.width/height`, which a translation never changes (AquarelleCanvasLayer.tsx:639 refit guard), so no stale view either.
- **Capture/bake path.** `captureLivePixels` merges the engine framebuffer (content space) over the key payload (content space) at `size` = working canvas (PhysicsPaintStudio.tsx:9475). No transform enters the commit. `toStudioStroke` converts engine UV -> canvas pixels only (`aquarelleStrokeBridge.ts`), no motion term.

## Evidence

- 59-12 added the edit-view mirror (`buildRailMotionEditCss`, PhysicsPaintReferenceTransform.ts:165; applied to the shell at PhysicsPaintStudioView.tsx:319) and at the same commit switched `canvasBounds` to LAYOUT metrics so the fond/monitor/overlays would not follow the rail (PhysicsPaintStudioView.tsx:220-235). That froze every seat-anchored overlay, including the two cursor overlays.
- The brush ring seat is a SIBLING of `.physics-paint-tracks-group` (PhysicsPaintStudioView.tsx:418-426), positioned at `canvasBounds` (layout) with the ring placed at `cursorX/cursorY` — which are CONTENT coordinates (`clientX - rect.left` of the transformed layer, AquarelleCanvasLayer.tsx:905-927). Displayed ring = layout + content = physical pointer - rail delta.
- The picker visor (`AquarellePickerVisor.tsx`) uses the same signals and the same untransformed seat origin: same delta.
- The rail-motion gizmo is NOT affected the same way: `getRailMotionBounds` folds `transform.x` into its own content-space geometry (`PhysicsPaintReferenceTransform.ts:139-176`), so it already renders at the displayed position.
- Identity check: `railMotionEditTransform` is null for identity transforms (PhysicsPaintStudio.tsx:10007-10018), so `railEditCss` is null and the identity path never takes the new branch.
- Measured delta (project->display): `translateX * paperTextureScale * displayScale` on screen; the debug geometry is exact in `buildRailMotionEditCss` (displayed px, origin 0 0 on the same layout box as the seat).
- Seam confirmation (static, decisive): `AquarelleCanvasLayer.tsx:905-927` writes `cursorX/Y = clientX/Y - live rect.left/top`; `Engine.toUv` (Engine.ts:1440) subtracts the SAME live rect. Under a pure Position translation both cancel the mirror, so committed content == physical pointer and the record path needs no inverse. The ring rendered at `layout + content`, i.e. physical pointer − rail delta: the visible paint cursor is the only thing displaced.
- Fix sites were the ONLY content-coordinate readouts outside the transformed subtree: brush-ring seat (PhysicsPaintStudioView.tsx) and picker visor (`AquarellePickerVisor.tsx` reads `cursorX/Y` directly). Both seats share the shell's layout box (canvasBounds) and origin, so `buildRailMotionEditCss` applies verbatim with `transform-origin: 0 0`.

## Resolution

root_cause: The committed stroke was already placed correctly: the engine maps pointers with the LIVE `getBoundingClientRect` of the rail-edit–translated sheet, so a pure Position translation cancels and content lands under the physical pointer. The paint cursor the user measures against (the brush ring; the OS cursor is hidden) rendered in an UNTRANSFORMED sibling seat at layout bounds while cursorX/Y are content coordinates — the ring lagged the stroke by exactly the rail Position delta. The picker visor shared the same defect.
fix: Applied the shell's existing `buildRailMotionEditCss` chain to the brush-ring seat and to a new picker-visor seat (same layout box, `transform-origin: 0 0`); identity rail (railEditCss null) renders byte-identical markup and takes no new branch. No engine, motion-evaluation, key-evaluation, compositor, or selection-overlay change.
verification: Static seam trace (above); LIVE NATIVE UAT PASSED 2026-11-09 (non-identity Motion Position rail: ring sits on the pointer, stroke lands under the ring, identity rail unchanged, picker visor tip on the sampled pixel); regression pin `physicsPaintRailEditCursorSeat.test.ts` 5/5; `tsc --noEmit` clean; full `vitest run` 408 files passed / 2 skipped, 8412 tests passed.
files_changed: app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx; app/src/components/physic-paint/view/PhysicsPaintReferenceTransform.ts; app/src/components/physic-paint/view/physicsPaintRailEditCursorSeat.test.ts; app/src/components/physic-paint/physicsPaintStudio.css

prevention: why not caught — no gate existed for this class. The 59-12 suites pinned the rail-edit CSS string (`buildRailMotionEditCss`) and the engine's pointer→content conversion separately, but nothing pinned where the two CONTENT-coordinate cursor overlays seat that readout, and the vitest harness cannot mount the hookful canvas stack (Tauri/engine deps). Guard: `physicsPaintRailEditCursorSeat.test.ts` pins identity → no transform (byte-identical seat style), non-identity → the shell chain + `transform-origin: 0 0`, and source-wires BOTH seats through the shared `buildRailMotionEditSeatStyle` helper so an inline fork cannot return.
