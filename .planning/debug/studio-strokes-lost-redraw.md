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
updated: 2026-10-27T10:05:00.000Z
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
  CONFIRMED (byte + pixel evidence) — UAT round 1's wrong watercolor alpha is
  the legacy white-matte strip running at the two compositor READ seams:
  `_decodeWebpToBitmap` (physicPaintStore.ts) and
  `registerRotoAlphaCanvasFrameFromBytes` (rotoCanvasFrames.ts).

  Paint 2's real frame-0 key is an OPAQUE TRANSMITTANCE sheet: RGB WebP, all
  alpha 255, pure-white corners, 75.2% of pixels near-white (>=240) — exactly
  the round-2 merge output (white fill + pigment-alpha script over it). The
  strip turns every near-white pixel transparent at decode/registration,
  which destroys the `isFullyOpaqueRaster` signature that
  `transmittanceSourceToPigmentAlpha` uses to convert a sheet into pigment
  alpha. Every store-composited surface then draws the raw sheet opaque:
  white covers the tracks beneath, and the pigment reads dense/dark. That is
  the middle selection (Brush module -> getFlattenedFrameExcluding, exclude
  Paint 4, Paint 2 + Paint 1 from the store) and the main editor (full
  flatten).

  The top selection is correct because the active Paint 2 is a DOM reference
  Image (`AquarelleCachedBaseLayer`, `new Image()` decode — no strip), and
  the below slice contains only the two real-alpha tracks (Paint 4 alpha,
  Paint 1 max alpha 126), which are not fully opaque and stay untouched.

  The 2026-10-22 strip is superseded by the 2026-10-26 round-2 pigment-alpha
  law: the conversion predicate sees contentTrackCount = 3 here, so matte
  repair is the conversion's job; the one-track fast path relies on the
  single fond multiply. The strip stays only in the merge base load
  (`physicsPaintRotoAlphaMerge.loadCachedRotoBaseImage`, visually neutral
  over its white fill) and the engine preview-base repair (active paint
  base, not implicated).

test: |
  RED first: (1) store decode — an opaque white-cornered transmittance sheet
  returned by decodeWebpFrame must reach createImageBitmap with all alphas
  255 and white corners intact; (2) registration — the registered canvas must
  still answer `isFullyOpaqueRaster` true for the same sheet. Both fail while
  the strip runs. GREEN after removing the two calls.

expecting: |
  With both strips removed, the store composite converts Paint 2 to pigment
  alpha in every selection path, so the middle selection and the editor match
  the top selection's soft wash over the blue; Paint 4/Paint 1 (real alpha)
  stay byte-identical.

next_action: write the two RED tests, run them to confirm they fail, remove the strip calls, re-run focused tests + pnpm typecheck, commit atomically, return UAT rows.
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

- timestamp: 2026-10-27T09:35:00.000Z
  checked: The three real frame-0 keys in the UAT project (/Users/lmarques/Desktop/efx-motion-editor-project-test/test.mce/frames/7bcc71b6-816d-4b26-8b86-20c37f39787a/), decoded to raw RGBA; SHA-256 matched against project.mce; key mtimes (00:34:14 / 00:35:13 / 00:35:41) precede the UAT screenshots (00:41-00:46).
  found: Paint 2 key 3024e2eb (1080x1080) is RGB (no alpha channel): after decode, alpha 255 on 100% of pixels, corners pure white 255,255,255, 75.2% of pixels >=240 near-white (mean RGB over pigment pixels ~192,127,102, e.g. red blob). This is the round-2 stored transmittance sheet (white fill merged under the pigment-alpha script). Paint 4 key b04ad486 is RGBA with transparent corners (real alpha; blue stroke ~81,118,133). Paint 1 key 71e25ebd is RGBA with max alpha 126 (real soft alpha; tan wash).
  implication: Paint 2's stored raster carries the EXACT white-matte corruption signature, but it is not corruption — it is the legitimate option-B storage format. Any repair that treats it as a legacy matte is destructive.

- timestamp: 2026-10-27T09:38:00.000Z
  checked: Screen model on the Paint-2-alone screenshot (uat-P2_alone-canvas.png, 778x778 Studio canvas): compare each pixel against the raw key multiplied once by the paper fond RGB [213,194,157] / 255.
  found: Median per-channel |difference| 4.0, mean 4.87, 88.6% of pixels within 10. The alone view shows the raw opaque transmittance over the paper. Alignment and the one-fond-multiply model are validated.
  implication: We can convert any UAT canvas patch back to the underlying key value it displayed, and distinguish raw transmittance from converted pigment per surface.

- timestamp: 2026-10-27T09:45:00.000Z
  checked: Pixel comparison of the three UAT surfaces (top 15.png, middle 16.png, editor 17.png, 778x778 / 724x724 canvases) against the track-alone captures, restricted to the blue-zigzag mask and the red-watercolor mask.
  found: Lost-blue pixels (blue present in Paint 4 alone, gone in the surface) = 1806 (8.5% of the 21334-pixel blue set); at those pixels Paint 4 alone is 99.5% blue and Paint 2 alone is tan. Red-intersect-blue region (11410 px): top [108.8, 80.1, 87.3] (dark converted pigment blend) vs middle [190.5, 120.1, 95.4] ~= editor [189.9, 120.4, 96.5] ~= Paint 2 alone [192.3, 127.5, 101.9]. Strong red region (8829 px): middle/editor are 100% red, top is [112.7, 74.1, 80.6]. Red pixel counts: top 48128, middle 49911, editor 51571.
  implication: Middle and editor draw Paint 2's RAW opaque transmittance over the blue (white matte + dense pigment, blue erased); the top draws the CONVERTED pigment over the blue (soft wash, blue visible through it). The failing surfaces map exactly to the store composite; the passing surface maps to the DOM reference path.

- timestamp: 2026-10-27T09:50:00.000Z
  checked: Seam inventory for the strip and the conversion — grep of `stripOpaqueWhiteMatte*`, read of physicPaintStore.ts:1529-1575 and rotoCanvasFrames.ts:16-46, efxPaintPigmentAlpha.ts, rasterAlpha.ts, physicsPaintRotoAlphaMerge.ts, EfxPaintEngine.ts:3502-3569.
  found: The store's `_decodeWebpToBitmap` runs `stripOpaqueWhiteMatte(imageData.data, width, height)` before createImageBitmap (line 1551), and `registerRotoAlphaCanvasFrameFromBytes` runs `stripOpaqueWhiteMatteFromCanvas(canvas)` before registering the launch-hydration canvas (line 41). `_preResolveTrackContent` consumes the registry canvas when present, else `_compositorDecode`. So every store-composited track is stripped. `transmittanceSourceToPigmentAlpha` then probes `isFullyOpaqueRaster` and returns null for the stripped raster. The predicate converts when contentTrackCount > 1 (3 here). The DOM reference Image never passes through either strip. Merge base load and engine preview-base repair are separate, visually neutral seams.
  implication: Root cause pinned to two destructive calls. Removing them restores the discriminator; no compositing law changes (D-04, draw order, fond multiply, conversion predicate all untouched).

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

- timestamp: 2026-10-27T09:55:00.000Z
  ruled out: the UAT-round-1 lead "Paint 2 is a mixed-engine track, so its raster is not fully opaque and the pigment-alpha discriminator skips it".
  why: The byte probe shows Paint 2's real key is a single merged RGBA raster whose decoded alpha is 255 on 100% of pixels (white corners, 75.2% near-white). It IS fully opaque before the strip. The strip runs first at decode/registration and removes 75.2% of the alpha mass, which is what makes the discriminator return false. The mixed-engine framing is irrelevant: the stored key is already a pigment composite over white.

- timestamp: 2026-10-27T09:56:00.000Z
  ruled out: the store-vs-DOM raster-source divergence itself ("Real Roto key" vs "Cache loaded" consumes different bytes).
  why: "Cache loaded at frame N. Add paint to update this key." is the reference loader's apply message after loading cached bytes; "Real Roto key · Frame N" is the idle capsule for a real cell. Both selections resolve the same real key; the store always reads it through the same decode/registry seam. The difference is the strip, not the bytes.

## Resolution

status: awaiting_human_verify (round-1 fix landed 2026-10-27)

root_cause: |
  UAT round 1's wrong watercolor alpha (middle selection + main editor) was
  the legacy white-matte strip running at the two compositor READ seams:
  `stripOpaqueWhiteMatte` in `_decodeWebpToBitmap` (physicPaintStore.ts) and
  `stripOpaqueWhiteMatteFromCanvas` in
  `registerRotoAlphaCanvasFrameFromBytes` (rotoCanvasFrames.ts).

  Paint 2's real frame-0 key is an OPAQUE TRANSMITTANCE sheet BY DESIGN:
  RGB, alpha 255 on 100% of pixels, pure-white corners, 75.2% near-white —
  the round-2 white-fill merge output. The strip zeroed every >=240 pixel
  before the bitmap/canvas entered the compositor, so `isFullyOpaqueRaster`
  no longer matched and `transmittanceSourceToPigmentAlpha` skipped the
  conversion. The raw sheet then entered every store-composited surface
  opaque: white covered the tracks beneath it and the pigment read
  dense/dark. That is the middle selection (Brush module -> excludeActive,
  Paint 2 + Paint 1 from the store) and the main editor (full flatten).

  The top selection was correct because the active Paint 2 renders as a DOM
  reference Image (`AquarelleCachedBaseLayer`, `new Image()` — no strip) and
  the below slice contains only the two real-alpha tracks (Paint 4 alpha,
  Paint 1 max alpha 126), which the probe leaves untouched.

  The 2026-10-22 strip is superseded by the 2026-10-26 round-2 law: with more
  than one content track (three here) matte repair belongs to the pigment
  conversion; the one-track fast path relies on the single fond multiply.

fix: |
  Removed `stripOpaqueWhiteMatte(imageData.data, width, height)` from
  `_decodeWebpToBitmap` and `stripOpaqueWhiteMatteFromCanvas(canvas)` from
  `registerRotoAlphaCanvasFrameFromBytes`, plus their imports. Kept the strip
  function and its unit tests, the merge base load
  (`physicsPaintRotoAlphaMerge.ts:101`, visually neutral over the white fill)
  and the engine preview-base repair
  (`EfxPaintEngine.repairPreviewBaseMatte`, active paint base only).

  No compositing law changed: D-04 participation, document-order
  bottom-to-top drawing, the one-fond multiply, the below/above slice
  sandwich and `shouldConvertTransmittanceTracks` are untouched.

tests: |
  RED-first — both failed on the strip before the edit:
  - `physicPaintStore.test.ts` "261027 UAT: the compositor decode preserves
    an opaque transmittance sheet — the pigment-alpha discriminator must
    still see it" (ImageData reaches createImageBitmap with all alpha 255,
    white corners and the pigment pixel intact).
  - `rotoCanvasFrames.test.ts` "registers the decoded sheet untouched so
    isFullyOpaqueRaster still recognises it" (pixel-backed probe canvas).

  GREEN: focused 5 files / 160 tests; full app suite 340 files passed
  (+2 skipped), 6183 passed / 1 skipped / 96 todo (6280);
  `pnpm typecheck` clean.

open: |
  (C) Watercolor re-bake fidelity ("thinner after Move") is unchanged and
  still needs the settle-law decision.
  Round-1 flicker: this fix does not change decode or reference-load timing.
  The leading explanation remains the async store decode (null tick + version
  bump) and reference-URL load/unload while the selection path switches.
  UAT should report whether it persists.

uat_pending: |
  1. Water color, 3 tracks, no Solo/hide: select Paint 2, Paint 4 and Paint 1
     in turn, then open the main editor. The tan watercolor wash must read
     soft (pigment alpha) on every surface, with the blue zigzag visible
     through/under it exactly as in the previous top-selection view.
  2. The middle selection must no longer read dense/dark; it must match the
     top-selection composite.
  3. The main editor must match the Studio composite.
  4. No white-cover regression on a lone watercolor track over paper/video.
  5. No regression on a watercolor interpolation frame between two real keys.
  6. Flicker: report whether caches still appear/disappear before settling.

## UAT Round 1 (2026-10-27) — FAILED

uat_setup: |
  Three tracks, frame 0, no Solo, no hidden track:
  - Paint 2 (TOP): tan brush strokes + two red/pink watercolor blobs.
  - Paint 4 (MIDDLE): blue brush zigzag.
  - Paint 1 (BOTTOM): broad tan watercolor wash/leg.

uat_results: |
  - Select TOP (Paint 2): composite CORRECT. Status reads "Real Roto key · Frame 0".
  - Select MIDDLE (Paint 4): composite WRONG. Watercolor reads too opaque; the
    blue brush is obscured where the wash crosses it. Status reads "Cache loaded
    at frame 0. Add paint to update this key."
  - Main editor: WRONG in the same way as the middle selection.
  - Before settling, ALL selections (top/middle/editor) flickered with caches
    appearing/disappearing depending on the selected track. After closing the
    Studio the composite stabilized to top = good, middle = wrong, editor = wrong.

user_verdict: |
  "5. and 6. show not the right watercolor transparence in compositing (its a
  bug which was solved in a debug but which is back with tracks compositing)."
  "When I close studio, its stabilized to the composite with 4. good, 5. wrong
  and 6. wrong."
  Frustration: the compositing/stack behavior is not following basic sense.

screenshots:
  - /Users/lmarques/Desktop/canvas-from-top.png    (correct composite)
  - /Users/lmarques/Desktop/canvas-from-middle.png (wrong watercolor alpha)
  - /Users/lmarques/Desktop/from editor.png        (wrong watercolor alpha)
  - Track-alone captures: Paint 2 (tan brush + red watercolor), Paint 4 (blue
    brush), Paint 1 (tan watercolor wash), frame 0.

debugger_lead: |
  The good top-selection path renders the active track PER LAYER in the DOM
  (brush overlay + aquarelle layers). The wrong paths (middle selection + editor)
  go through the store's flattened raster. Prime suspect: the pigment-alpha
  conversion discriminator probes a TRACK RASTER for full opacity; a mixed-engine
  track (Paint 2 = brush + watercolor) is not fully opaque, so its watercolor
  sheet is NOT converted and stays opaque transmittance. The above slice also
  only converts "single watercolor tracks", so a mixed track above the active
  one is not converted there either. Verify live (track raster probe + pixel
  readback) before changing any law; also explain the selection-dependent cache
  flicker before stabilization.

DATA_END
