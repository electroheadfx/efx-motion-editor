# Quick Task 261028-k03c: Lift eraser UAT blockers, real footprint cursor, sidebar Brush tab, tip shapes — Context

**Gathered:** 2026-10-28
**Status:** Ready for planning
**Continues:** quick 261028-k03 (CLOSED, native UAT failed)

<domain>
## Task Boundary

Fix the four native-UAT findings on the Lift (eraser) tool and restore the Brush surface:

1. **Scripted Lift does nothing** on frames whose SNAP v5 durable-base section is empty.
   The preflight refuses an unknown pre-script base, the pointerdown gate stops the gesture,
   and `recordAquarelleOrdinaryDurableBase` refuses every pre-scripted frame
   (`script-already-present`). The pre-script base must be **recovered** from the displayed
   composite and a raw script bake, never assumed empty.
2. **Raster-only Lift is lost on frame leave/return.** Automatic settle captures race the
   erase transaction (`lease-or-settlement-rejected`, `changed:false`), and the lift path
   never arms the snapshot save (`markDirty`).
3. **Cursor preview is a CSS circle from the size slider**, not the engine footprint
   (radius, aspect, rotation, pressure). It must show the true size AND shape for pen and
   mouse, all tools.
4. **Tip/shape options are missing for Lift, and the sidebar Brush tab is gone** (retired in
   quick 261027-gh9). Restore the tab with the Brush response cloned from the top bar and the
   floating modal, plus a tip/shape selector for Brush and Lift. Default tip for new Brush
   and new Lift strokes: **Filbert**.

Tool id is `lift` ("Lift", Eraser); "drift" in voice transcription means Lift.

### Verified current state (do not re-derive)

- `planAquarelleLiftErase` (`PhysicsPaintStudio.tsx` ~5883-5918) refuses `scripted && !has(keyId)`.
  `recordAquarelleOrdinaryDurableBaseRef.current` (~6751-6803) refuses with
  `script-already-present` when the frame already has events.
- The debug capture `/private/tmp/efx-aquarelle-render-split.json` has no `lift-erase` event
  and 31 `durable-base-record` events with reason `script-already-present`.
- `runAquarelleLiftErase` raster branch (~6060-6196) punches, pins the merge base, calls
  `captureLivePixels`, refreshes the display, then writes the durable map — after the
  snapshot debounce, and without `markDirty()`.
- `AquarelleBrushCursor` (`AquarelleCanvasLayer.tsx` ~82-133) draws a circle from
  `aquarelleParams.value.size`; the engine's own cursor is disabled
  (`new WatercolorEngine(canvas, null, ...)` ~407).
- Engine footprint laws: `Engine.ts` ~1525-1544 (`sizeMult`, pen, brush, water, lift,
  `brushRadius`); engine cursor math ~1503-1521.
- `liftFS` (`shaders.ts` ~266) is a radial `uAmount * exp(-(d²/r²)²)` with only
  `uAspect, uRadius, uAmount, uPoint`. `stampFS` already carries `uTip, uTipAspect, uRound,
  uAxis, uGrain, uRough, uJitter` — the tip infrastructure exists.
- 15 preset tips in `packages/efx-watercolor/src/playground/brushes.ts`:
  round, detail, rigger, flat (0.26), hake (0.2), filbert (0.55), mop, dry, fan (0.5),
  sponge, spatter, sumi, dagger (0.38), stipple, chalk.
- `aquarelleSelectedTipId` defaults to `'chalk'` (`aquarelleRecordState.ts:94`).
- Every stroke already records `brushId` + `toolOverrides` (`aquarelleRecordState.ts:287-315`,
  `AquarelleCanvasLayer.tsx:444`); the bake resolves the brush from `payload.brushId`
  (`engineAdapter.ts:197`).
- The right panel tab list is `['color','settings','paper','memory']`
  (`PhysicsPaintRightPanel.tsx:205`); `RightPanelBrushTab.tsx` still exists but is unmounted.
  `RightPanelSettingsTab.tsx` contains only `<BrushResponsePanel />`.
- `BrushResponsePanel` exposes the 8 multipliers (tip, aspect, rotation, sizeCurve, scatter,
  capacity, grain, wetRound) through `setAquarelleMultiplier`.
- The top bar Lift cluster is Strength + "Select lifts" (`PhysicsPaintTopBar.tsx` ~205-245).

</domain>

<decisions>
## Implementation Decisions

### D1. Separate Lift tip selection (user, 2026-10-28)
- New signal `aquarelleLiftTipId` (default `'filbert'`); the Lift section picker never flips
  the active tool to Brush and never mutates the Brush selection.
- `aquarelleSelectedTipId` default changes `'chalk'` → `'filbert'` (new Brush strokes only;
  existing strokes keep their recorded `brushId`).
- Both selections are recorded per stroke: Brush already records `brushId`; Lift records its
  chosen tip in the same `brushId` field so live, bake and punch share one number.

### D2. Brush response has two views, one state (user: "Both tabs")
- Restore the sidebar **Brush** tab: brush catalog + `BrushResponsePanel` + tip/shape selector
  + a Lift section (Lift tip/shape, strength, Select lifts).
- The **Settings** tab keeps `BrushResponsePanel` (unchanged). Same signals and setters —
  no duplicated state.

### D3. Lift shape selector in both surfaces (user: "Both")
- Top-bar Lift cluster: Shape + Strength + Select lifts.
- Sidebar Brush tab → Lift section: Shape + Strength + Select lifts.
- One signal (`aquarelleLiftTipId`), always in sync.

### D4. Scripted base recovery (fail-closed)
- `planAquarelleLiftErase` returns `recoverBase: true` instead of refusing when
  `scripted && !has(keyId)`. Every other refusal stays (group, Script OFF with a script,
  no displayable pixels).
- Recovery: bake the script EXCLUDING the just-recorded lift event, decode P (displayed
  composite) and S (raw bake sheet), invert the pigment-alpha law per pixel, encode B as an
  opaque WebP transmittance sheet.
- Validate by recomposing S over B with `mergeRotoAlphaCanvases(..., 'pigment-alpha')`;
  require mean absolute error ≤ 3/255. On failure fall back to today's refusal and record a
  diagnostic. Never silently adopt a bad base.
- One-time cost per legacy key: seed the map, `markDirty()`, then all later lifts use the
  persisted base.
- Saturated pixels (`a ≥ 0.97`) write white — a lift erases there anyway.

### D5. Lift footprint is tip-shaped in the engine and in the punch
- Extend `liftFS` in place with the tip footprint (`uTip`, `uTipAspect`, `uRound`, `uAxis`);
  keep the lift radius law `(0.012 + 0.03·pr)·sizeMult`. Reuse the `stampFS` uniform pattern.
- `Engine.lift()` binds the same `this.brush` tip, aspect and angle the brush uses; the
  `onLiftDab` callback gains the angle so the cached-base preview matches.
- `buildLiftCoverage` and `collectLiftDabs` (`roto/aquarelleLiftErase.ts`) mirror the same
  shape/aspect/rotation/tip falloff; the punch stays WYSIWYG. Copy/Apply reproduces the shape.
- **Escalation:** a genuinely NEW vendor engine API or a new undo kind ⇒ STOP and propose a
  phase. Editing `liftFS`/`Engine.lift` in place is NOT a new API.

### D6. Cursor = engine footprint law
- `AquarelleBrushCursor` computes the radius from the same law the engine uses
  (`toEngineParams(size)` → `sizeMult` → per-tool radius) and the shape from the active tip
  (aspect, rotation, rect vs ellipse vs circle). Convert doc-height units to CSS px with the
  displayed canvas rect height.
- Hover pressure 0.4; during a stroke use the live pen pressure; speed term 0 for the preview
  (matches the engine's own `updateCursor`, which redraws on hover).
- Keep the DOM overlay (`pointer-events: none`), hide in select/move modes, keep the crosshair
  fallback below 8 CSS px. Lift uses the selected Lift tip shape.

### D7. Raster persistence
- Fence automatic settle captures for the same (track, frame) while
  `aquarelleLiftEraseInFlightRef` is true (skip with a diagnostic; later captures and other
  frames unaffected).
- Keep the merge-base pin before the commit await; restore on failure.
- Retry `captureLivePixels` once on `false` (stale revision/lease) before publishing a failure;
  record attempt/outcome in the `lift-erase` diagnostic stage.
- After the ack and the durable map write (including the `willPinBase` path), call
  `studioScriptSnapshot.markDirty()`.
- Leave/return must resolve the punched key payload, not a stale auto capture.

### D8. Truth table (agreed 2026-10-28)

| # | Frame state | Script | Durable base | Visible result | Authoritative store | Script entry | Apply outcome |
|---|---|---|---|---|---|---|---|
| 1 | cooked + script | ON | known bytes | punch base + record | key payload + base map | Lift event | re-bake over punched base |
| 2 | cooked + script | ON | known empty | record; base stays empty | key payload | Lift event | script erase only |
| 3 | cooked + script | ON | unknown (legacy) | recover base, validate ≤3/255, punch, record | recovered base + key payload | Lift event | re-bake over recovered base |
| 4 | cooked + script | ON | unknown, validation fails | refuse, nothing erased | — | none | unchanged |
| 5 | cooked + script | OFF | any | refuse at pointerdown | — | none | unchanged |
| 6 | raster-only | ON | unknown → pins | punch + record; fenced, retried, markDirty | key payload + base map | Lift event | punched base |
| 7 | raster-only | OFF | unknown → pins | punch; permanent; survives leave/return/reopen | key payload + base map | none | pixels authoritative |
| 8 | live sheet | ON/OFF | n/a | live engine erase, tip-shaped | live sheet → capture | ON only | replay tip-shaped |

### Footprint table (agreed)

| Tool | Radius law | Shape | Rotation |
|---|---|---|---|
| brush | `(b.size[0] + (b.size[1]-b.size[0])·pr^pressureSize) · clamp(1-speed·speedThin, 0.4, 1) · sizeMult · 0.8` | tip ellipse / rounded rect / tip mask | fixed / follow / random |
| water | brush × 1.3 × (1 + min(speed,2.5)·0.12) | same tip | same |
| pen | `(0.0016 + 0.0042·pr) · clamp(1.12 - speed·0.3, 0.55, 1.12) · sizeMult` | circle | none |
| lift | `(0.012 + 0.03·pr) · sizeMult` | tip aspect + rotation + tip mask | fixed / follow / random per tip |

### Claude's Discretion
- Exact component split (shared footprint helper vs. app-local duplicate) as long as one law
  source governs engine and cursor.
- Sidebar Brush tab layout and control ordering.
- Diagnostic stage field names beyond `base-recovery-start` / `base-recovery-ok|failed`.

</decisions>

<specifics>
## Specific Ideas

- Reuse the Apply single-frame bake: `applyAquarelleEventsToKey`
  (`roto/physicsPaintRotoPlayScriptController.ts` ~1852) — split a bake-only helper from the
  publish leg instead of duplicating the bake.
- Recovery math (from S, white = no pigment): `a = 1 - min(r,g,b)/255`, `C = (t - min)/a`,
  `B = (P - a·C)/(1 - a)` for `a < 0.97`; white where `a ≥ 0.97`; clamp 0..255.
- Encode B with `encodeRotoFrameFromCanvas` (durable-base payload format).
- `mergeRotoAlphaCanvases(..., 'pigment-alpha')` is the validation merge law.
- Keep the Lift strength param and "Select lifts"; shape joins them in both surfaces.
- Preserve: script-authoritative scripted lifts (delete restores script paint; Apply
  re-erases), permanent raster punch, per-stroke strength, Select lifts, stylus eraser end,
  Script OFF = pixels only, no engine-1.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261028-k03-lift-eraser-must-erase-live-scripted-and/261028-k03-SUMMARY.md`
  (addendum "261028-k03b Follow-up and Native UAT Outcome")
- `.planning/quick/261028-k03-lift-eraser-must-erase-live-scripted-and/261028-k03-CONTEXT.md`
- `.planning/quick/261028-k03-lift-eraser-must-erase-live-scripted-and/261028-k03-REVIEW.md`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`
- `app/src/components/physic-paint/roto/aquarelleLiftErase.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts`
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts`
- `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts`
- `app/src/components/physic-paint/view/aquarelleRecordState.ts`
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx`
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`
- `packages/efx-watercolor/src/playground/Engine.ts`
- `packages/efx-watercolor/src/playground/shaders.ts`
- `packages/efx-watercolor/src/playground/brushes.ts`
- `packages/efx-watercolor/src/playground/brushBridge.ts`
- `packages/efx-watercolor/src/adapter/engineAdapter.ts`

</canonical_refs>
