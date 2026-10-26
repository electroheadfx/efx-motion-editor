---
status: awaiting_human_verify
trigger: |
  I have problem with a debug we closed before called "strokes lost". Actually adding
  strokes to a key with some script, create issue with redraw. When I paint on existing
  paint, the stroke disapear, so I edit with move tool, I see the new stroke I click on
  it, it refresh with both the cache but the stroke size was decreased compared to what
  I paint with settings.
  - Note that A new issue appear when I select a track (I not use solo) at bottom I lost
    on canvas the final compositing, I need to select the top track to see the real final
    result. Solo is the purpose for that but I didn't activated it.
  For reference to the disparear stroke:
  - Original paint that I paint a big red stroke on it — red stroke disapear
  - now I edited the paint an selected the new stroke (red) but the width was decreased
created: 2026-10-26T23:55:00.000Z
updated: 2026-10-27T00:31:00.000Z
goal: find_and_fix
symptoms_prefilled: true
---

# Debug Session: studio-strokes-lost-redraw

DATA_START

## Symptoms

### Expected behavior

1. Painting a new stroke in Studio over existing paint must show the new stroke
   immediately, at the width selected in the brush settings, composited over the
   existing paint/script/cache — on any key (already scripted or plain rasterized)
   and with either engine (Brush / Watercolor).
2. The new stroke must stay editable (Move/Select) and the module must not
   auto-switch away from the brush the user painted with.
3. With NO Solo armed and NO hidden track, every visible track must participate in
   the Studio canvas composite regardless of which track is selected. Track
   selection must never change stacking or hide other tracks (D-04 / D-05).

### Actual behavior

1. **New stroke disappears.** Painting over existing paint in Studio: the new
   stroke vanishes from the canvas. Entering Move/Edit makes it appear; clicking
   the stroke refreshes the cache plus the stroke, but the stroke renders THINNER
   than the width used while painting (screenshots 23.40.27 / 23.40.56).
2. **Raster key behaves worse.** On a rasterized key with no script: the new paint
   disappears; clicking the key brings it back; the stroke is not editable
   (script lost); the module then auto-switches to Watercolor even though the user
   painted in Brush mode; only the last Watercolor stroke is editable and the red
   Brush stroke loses its stroke identity.
   Latest screenshot: rasterized key with maroon/red brush strokes, blue strokes,
   and one pale watercolor diagonal stroke — the red brush stroke is not editable.
3. **Track-selection composite loss.** Selecting a lower track (no Solo) makes the
   Studio canvas lose the final composite; selecting the top track shows the real
   final result. Reproduces with Watercolor and Brush, and when painting on a
   rasterized key of either engine.

### Error messages

None reported by the user. No console/log capture supplied yet.

### Timeline

The "new stroke loses existing/cached paint" regression predates today: it was
explicitly deferred at the close of the 2026-10-26 watercolor pigment-alpha
session. The user reports it is now more visible and has gained the thinner-width
and lost-stroke-identity behaviors. Exact first-bad build unknown.

### Reproduction

1. Studio, project with 2+ tracks carrying paint on the same frame; no Solo, no
   hidden tracks.
2. Paint a new stroke over existing paint (Brush or Watercolor, scripted key or
   plain rasterized key) -> the new stroke disappears.
3. Enter Move/Edit -> the stroke appears; click the stroke -> cache + stroke
   return, but the stroke is thinner than painted.
4. Raster key variant: paint a Brush stroke -> it disappears; click the key -> it
   returns; stroke not editable; module auto-switches to Watercolor; only the
   last Watercolor stroke stays editable.
5. Select a lower track in the Studio track list -> canvas loses the final
   composite; select the top track -> composite reads correctly.

### Evidence images

- /Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 23.40.27.png
  (original blue watercolor paint; the big red stroke is absent)
- /Users/lmarques/Desktop/Capture d’écran 2026-10-26 à 23.40.56.png
  (after Move + click: red stroke present but thinner than painted)
- Conversation screenshot (raster key): maroon/red brush strokes + blue strokes +
  one pale watercolor diagonal; the red brush stroke has lost its stroke identity.

## Scoping answers (user, 2026-10-26)

- Surface: Studio (Physic Paint) only.
- New-stroke loss occurs on keys WITH a script AND on plain rasterized keys
  without a script.
- Both engines affected (Brush and Watercolor).
- Track-selection composite loss: observed with watercolor and brush tracks, and
  when painting on a key rasterized from either engine.

## Prior sessions / known leads (verify — not prescriptive)

- `.planning/debug/resolved/watercolor-clears-cached-paint.md` — the earlier
  "strokes lost" session. Aquarelle capture encoded only the live sheet
  (`cachedBase: null`) and replaced the cache; fixed by merging the live sheet
  over a per-sheet session base. Its contract was later changed again (below).
- `.planning/debug/resolved/watercolor-composite-mismatch.md` — the 2026-10-26
  pigment-alpha session. Its CLOSURE explicitly defers this regression: prime
  suspect is the round-2 same-track capture merge (`mergeBlend: 'pigment-alpha'`
  in `physicsPaintRotoAlphaMerge.ts` + the white matte fill) changing the merge
  order on this exact path.
- `.planning/debug/resolved/studio-multi-track-only-active.md` — prior
  track-selection composite regression. Selection must not override stacking:
  the live overlay is substituted at the active track's ordered slot; the
  compositor draws document order in reverse (top row = top layer); opaque live
  overlays/mattes were the cover. This is the closest precedent for symptom 3.
- Quick 261025-awl (raster key action with confirmed script purge), 261024-mz5
  (Studio stroke multi-select/move), 261026-odd (compose watercolor script edits
  over their durable base; bind retained scripts to key identity; per-frame Move
  gate) — recent surfaces in the same area.
- `.planning/debug/play-script-update-strokes.md` (active session) — may overlap
  script-update stroke handling; check before fixing.

## Constraints

- Studio is the visible surface; do not change the main-editor compositing law
  unless a genuine parity defect is proven.
- D-04 hide/solo truth table is locked: no Solo -> every visible track
  participates. Selection must not gate participation (D-05 / T-48-16 intact).
- Stack law: top row = top layer; compositor draws document order in reverse.
- Watercolor storage stays opaque transmittance; pigment-alpha conversion happens
  only at display/composite seams (2026-10-26 law). Do not reintroduce per-layer
  multiply.
- `physicPaintStore.ts` keeps zero `getImageData|putImageData`.
- Preact + signals rules mandatory (no useState; identity-stable effect deps;
  idempotent setters; narrow signal reads).
- Use the existing test setup; `vitest run` only — never watch. Do not run the
  dev server (user runs it).
- Live visual verdict is user-run native UAT; automated gates prove only code
  contracts. Prefer app-written /tmp JSON captures over console reading for live
  evidence.

## Current Focus

hypothesis: |
  CONFIRMED — TWO ROOT CAUSES FIXED, ONE DOCUMENTED SUBSET LEFT, AWAITING LIVE UAT.

  (A) Selection composite loss (symptom 3). In Water color at rest the single
  z-0 program monitor EXCLUDED the active track and passed liveOverlay null,
  while the active track's aquarelle DOM stack (`.aquarelle-cached-base` z3 +
  `.aquarelle-live-canvas` z4) painted ABOVE that monitor INSIDE the same
  tracks group. Every track stacked above the selected track was therefore
  masked by the active sheet — selecting the top track coincidentally showed
  the true stack. Violates D-04/D-05. Fixed with a below/above slice sandwich.

  (B) Brush stroke loss + auto module switch on raster keys (symptom 2, and
  the Brush half of symptom 1). `resolveFrameScriptOwner` required
  `isBrushScriptFrameHydratable`, so a rasterized key's arrival-base Brush
  capture (`complete:false`) never owned the frame. A leftover aquarelle
  registry script became the SOLE owner → `applyFrameModuleState` switched the
  module to Water color (the engine surface goes opacity 0 and the new Brush
  stroke vanishes), and `brushMoveAvailable = owner === 'brush'` kept Move
  dead on the resulting 'both'. Fixed: completeness gates hydration only, and
  Move opens for 'brush' | 'both' (the composite moveAvailable keeps the dead
  case closed).

  (C) Watercolor "thinner after Move" (remaining subset of symptom 1). The
  Apply/Move re-bake replays the recorded event timeline and cooks to sleep;
  the live display cache was captured at the visible settle cap. Measured on
  frame 14 (32 events): live captured sheet ink 93.2 vs baked sheet ink 65.68
  = composed ink over an empty durable base. Compositing is correct; the two
  settle laws disagree. NOT changed this round — it needs a live UAT
  judgment between "capture what the user saw" and "Apply equals Play's
  fully-settled end frame"; both are one-line decisions at different seams.
test: |
  RED first: three new-law tests failed before implementation (partial
  ownership row resolved null; partial row + aquarelle script resolved
  'watercolor' instead of 'both'; `getFlattenedFrameSlice` did not exist).
  GREEN after: full app suite 6181 passed / 2 files skipped (6278 tests),
  `pnpm typecheck` clean. Static pins updated only where they intentionally
  encoded the old law (paperPass P4(f) seam count 2→4 for the slice getter;
  aquarelleLayerContract "no double composite" now pins the sandwich wiring
  and the z-order).
expecting (live UAT): |
  1. No Solo, no hidden track: selecting ANY track in Water color shows the
     full stack of visible tracks (previously only the top selection did).
  2. A Brush stroke painted on a rasterized key stays visible, the module
     stays Brush, and the stroke is movable/editable.
  3. Watercolor width after Move: still expected thinner until (C) is decided.
next_action: await user-run live Studio UAT of rows 1-2; open the (C) decision as the next round if the rebake still reads thinner.
reasoning_checkpoint: null
tdd_checkpoint: null

## Evidence

<!-- APPEND only -->

- timestamp: 2026-10-26T23:15:00.000Z
  checked: PhysicsPaintStudio.tsx:7480-7502 (programMonitor config) + physicsPaintStudio.css:6827-6884 + PhysicsPaintStudioView.tsx (tracks group)
  found: Water color passes `liveOverlay: null` and `excludeActive: true`, so the single z-0 monitor draws the participating set WITHOUT the active track. The active track's DOM stack renders INSIDE the same tracks group but above the monitor (`.aquarelle-cached-base` z3, `.aquarelle-live-canvas` z4). Any track stacked above the selected track is therefore occluded by the active sheet; selecting the top track makes the overlap empty, which is why only the top selection "showed the real final result".
  implication: RC-A confirmed. Selection changes the composite — a direct D-04/D-05 violation. A single monitor can never reproduce the stack while the active pixels live in a DOM layer above it; the composite must be split around the active track's DOM seat.

- timestamp: 2026-10-26T23:18:00.000Z
  checked: frameScriptOwnership.ts:56-63 + brushScriptRecordState.ts:captureEntry + frameModuleLock.ts:39-41 + PhysicsPaintStudio.tsx:2169-2266 (applyFrameModuleState)
  found: `storedBrush` required `isBrushScriptFrameHydratable`, which requires `complete`. A rasterized key's first capture inherits `complete:false` from the arrival base (`!arrivalBaseFrames.has(frame)`), so it never owns the frame. Leftover aquarelle registry script (the earlier raster session) then resolves 'watercolor' alone → `applyFrameModuleState` switches the module to Water color → engine surface opacity 0 → the just-painted Brush stroke disappears. On the mixed 'both' state `brushMoveAvailable` was false, so the stroke was also uneditable.
  implication: RC-B confirmed for the raster-key disappearance, the module auto-switch, and the lost stroke identity. The partial row IS the key's live Brush script; completeness must gate hydration only.

- timestamp: 2026-10-26T23:20:00.000Z
  checked: /tmp/efx-move-provenance.json (app-written capture, frame 14) + /tmp/efx-aquarelle-render-split.json
  found: Frame 14 resolve — cellKind real, cellKeyId == liveKeyId (a9be90b1), `entry: null`, `hasWatercolor: true`, `publishedOwner: "watercolor"`, `lockedModule: "brush"`, every move flag false. The aquarelle re-bake (22:55:51, 32 events) measured display ink 93.2 (cached frame, what the user saw) vs bake ink 65.68 == composed ink over a transparent durable base; publish 805cc.
  implication: The raster-key ownership half is live-confirmed. The "thinner after Move" is the re-bake settle law diverging from the visible-cap capture — NOT a compositing bug (the composite reconstructs the bake exactly). RC-C quantified; fix deferred to a UAT-judged round.

- timestamp: 2026-10-26T23:28:00.000Z
  checked: app/src/stores/physicPaintStore.test.ts (new getFlattenedFrameSlice test) + efxPaintCompositor.ts + efxPaintCompositeCache.ts
  found: RED-first evidence — `physicPaintStore.getFlattenedFrameSlice is not a function` before implementation; after: below slice = bottom track + Background (2 draws, background draw present), above slice = top track only (1 draw, no Background), full = 4; three distinct cache keys; the same exclusion set with the Background included keys apart (`bg:0` term); an active id outside the participating set fails open to the full composite.
  implication: The sandwich contract is pinned at the store seam: the Active track is in neither slice, the Background lives only in the below slice, and every variant has its own memo entry.

- timestamp: 2026-10-26T23:30:00.000Z
  checked: frameScriptOwnership.test.ts + frameModuleLock.test.ts (new-law tests) + full `pnpm vitest run` + `pnpm typecheck`
  found: RED before implementation (partial row → null; partial + aquarelle → 'watercolor'; 'both' Move closed); GREEN after — full app suite 6181 passed / 2 files skipped (6278), typecheck clean.
  implication: Both landed fixes are contract-pinned. Remaining UAT is native/visual only (live Studio rows 1-2, and row 3 documents the deferred settle-law decision).

## Eliminated

<!-- APPEND only -->

- timestamp: 2026-10-26T22:40:00.000Z
  ruled out: `.planning/debug/play-script-update-strokes.md` overlap.
  why: That session targeted the Play-script Update/animation-player stroke path and was resolved in June 2026; no shared code path with the Studio redraw/capture seams.

- timestamp: 2026-10-26T23:21:00.000Z
  ruled out: Brush completed-mutation staleness (a missing monitor repaint when a stroke finalizes).
  why: PhysicsPaintStudio.tsx:6237-6262 already bumps `physicPaintVersion` synchronously in the completed-mutation handler precisely so the monitor's live-overlay composite redraws in the same paint cycle; `physicsPaintProgramMonitor.test.ts` pins the redraw. No separate staleness fix was needed.

- timestamp: 2026-10-26T23:22:00.000Z
  ruled out: engine-1 → aquarelle fallback size projection (size 1-80 mapped verbatim into the 1-800 domain) as the cause of the in-session "thinner" symptom.
  why: `aquarelleEventsFromScript` is persisted-first and prefers the recorded aquarelle payload; the live session's registry holds the real params. The fallback gap is real for reopened projects without persisted events but is not this session's measurement (the 32-event re-bake used recorded payloads).

- timestamp: 2026-10-26T23:23:00.000Z
  ruled out: pigment-alpha double conversion at display as the "thinner" cause.
  why: The merge writes t' = a·C + (1−a)·t_base over a white fill (opaque storage); the display conversion reconstructs the same pigment composite. Measured display ink (93.2) matches the cached capture, and composed ink equals bake ink exactly — the divergence is only between the bake and the captured sheet.

## Resolution

status: awaiting_human_verify (2026-10-27)

root_cause: |
  Two independent defects were fixed. (A) The Water color program monitor
  excluded the active track from a single z-0 composite while the active
  track's aquarelle DOM stack (cached base z3 + live sheet z4) rendered above
  that monitor inside the same tracks group, so selecting any track below the
  top masked every track above it (D-04/D-05 violation). (B) Frame script
  ownership required hydratability, so a raster key's partial arrival-base
  Brush capture never owned the frame; a leftover aquarelle script became the
  sole owner, the module auto-switched to Water color after a Brush stroke,
  and Move stayed closed on the resulting 'both' state. A third defect is
  quantified but not changed: the watercolor Apply/Move re-bake cooks to
  sleep while the live cache was captured at the visible settle cap, so the
  re-baked stroke reads thinner (frame 14: ink 65.68 vs 93.2).

fix: |
  (A) Added `includeBackground`/`contentBeneath` options to
  `_resolveFlattenedFrame` and a public `getFlattenedFrameSlice(layerId,
  frame, activeTrackId, 'below'|'above')`: the participating stack is
  partitioned around the active track, the active track is excluded from both
  slices, the Background is drawn only in the below slice (with a `bg:0` key
  term), and the above slice converts single watercolor tracks to pigment
  alpha (content exists beneath). `PhysicsPaintProgramMonitor` gained a
  `slice` prop; `PhysicsPaintStudioView` renders a second monitor
  (`.physics-paint-program-monitor-above`, z5) inside the tracks group;
  `PhysicsPaintStudio` wires the below/above monitors only in Water color at
  rest (not during playback, cached playback, or a hidden active track, where
  the previous paths remain). `efxPaintCompositor` gained the
  `includeBackground` port gate.
  (B) `resolveFrameScriptOwner` no longer requires hydratability for the
  stored Brush leg (key identity + non-empty groups only; completeness stays
  hydration-gated), and `brushMoveAvailable` opens for 'brush' | 'both' —
  the composite `moveAvailable` still requires a hydratable store row or
  engine-held strokes, so a 'both' frame without movable strokes exposes no
  Move.

tests: |
  RED-first new-law tests: partial key-matched ownership → 'brush';
  partial + aquarelle → 'both'; 'both' opens Move; `getFlattenedFrameSlice`
  partition/background/cache-key/fail-open contract. Full app suite 6181
  passed / 2 files skipped (6278 tests), `pnpm typecheck` clean. Static pins
  updated where they described the replaced law (paperPass P4(f) 2→4 seam
  delegations; aquarelleLayerContract no-double-composite now pins the
  sandwich wiring + z-order).

open: |
  (C) Watercolor re-bake fidelity ("thinner after Move"). Decision needed at
  UAT: either capture/commit the fully settled sheet (cache = Apply = Play
  end frame, paint visibly settles lighter right after painting) or make the
  Apply/Move re-bake reproduce the visible settle cap (cache unchanged, Play
  matches the Studio look). Both are single-seam laws; changing either
  without the user's visual verdict risks re-opening the previous
  "denser than the paint" regression.

uat_pending: |
  1. Water color, 3 tracks, no Solo, no hidden track — select each track in
     turn; the canvas must show the same full composite for every selection.
  2. Rasterized key, Brush module — paint a Brush stroke over existing paint;
     the stroke stays visible, the module stays Brush, Move selects it.
  3. Watercolor Move width — expected to remain thinner until (C) is decided.

DATA_END
