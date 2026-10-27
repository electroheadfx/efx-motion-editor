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
updated: 2026-10-27T10:44:00.000Z
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
  ROUND 4 — ALL THREE FAULTS FIXED (working tree, gates + guardrail green);
  awaiting ONE live UAT.

  BUG 2 STATUS: FIXED (working tree, gates green). The app consumed a stale
  `packages/efx-watercolor/dist/index.mjs` (built 16:59, before the
  pigment-alpha commit 99fc8378 at 23:24) through the package exports, so the
  live compositor sheet still used MODE.transparent and covered the z3 base.
  The alias to source landed in `app/vite.config.ts` (root + all five public
  subpaths, subpaths first for Vite's prefix match). RED-first guard: 2 new
  tests in `app/src/viteBuild.test.ts` failed before / pass after (13/13).

  BUG 1 STATUS: FIXED. The launch `aquarelleDurableBaseByKeyRef` map was
  never persisted; on reopen a scripted ordinary key left `durableBaseBytes`
  undefined and publish failed closed (`durable-base-unknown`). Landed design
  (option B, smallest trusted): persist the durable base per keyId in a new
  SNAP v4 durable-base section; restore seeds the launch map at snapshot
  restore (session wins per keyId); merge is scoped by live key ids + merged
  anchors + retained bases; a retained base for a live key missing from the
  session is DROPPED (raster-clear safety); a deleted key's base is retained
  for undo; absent stays fail-closed. The pre-publish restore pins the launch
  key so the post-publish reset effect cannot wipe the seeded map. Tradeoffs:
  +~100-300 KB per scripted key in the snapshot and pre-v4 keys (painted
  before this build) still cannot Move after reopen until recreated —
  declared consequence.

  BUG 3 STATUS: FIXED. `fitCanvas` captures dpr/size/view and `toUv` maps the
  live rect through them; the Studio never re-fit on a later CSS-box or DPR
  change, so paint landed ~200 px off until Studio reopened. The live layer
  now observes the canvas box (ResizeObserver) and DPR (re-armed matchMedia)
  and calls the engine's public `resize()`, which re-captures all three
  inputs.

hypothesis_round4: |
  ROUND 4 — three distinct faults, each localized to one seam:

  (1) MOVE AFTER REOPEN = durable-base persistence gap. The launch-scoped
  `aquarelleDurableBaseByKeyRef` map is empty after a reopen; a scripted
  ordinary key fails the gated fallback (it requires zero events) and leaves
  `durableBaseBytes` undefined (UNKNOWN), so the publish port correctly
  fails closed (`durable-base-unknown`) and Move reports "Apply Script could
  not paint the aquarelle wash." Live proof: /tmp/efx-aquarelle-render-split.json
  (key fef0e1ef, appFrame 0, four refusals, events 18/19). The base was never
  persisted; re-baking without it would double-composite the committed script.

  (2) PREVIOUS STROKES HIDDEN WHILE PAINTING = STALE VENDORED ENGINE BUILD.
  The app resolves `@efxlab/efx-watercolor` via its package `exports` to
  `packages/efx-watercolor/dist/index.mjs`; Vite aliases only efx-paint-host
  and efx-physic-paint to source. That dist was built 2026-10-26 16:59:51,
  BEFORE 99fc8378 (23:24), so it still calls `drawDisplay(..., MODE.transparent)`
  and has no pigment-alpha code. Once a stroke exists the live canvas flips
  `opacity:1` with an OPAQUE transmittance sheet and covers the z3 cached
  base and the z0 monitor; leaving the key destroys the engine and reveals
  the DOM base again. Capture was proven sound (base 263806 B merged with the
  live sheet, 100% retention), so no paint is lost.

  (3) ~200 PX OFFSET = captured geometry. `fitCanvas()` stores dpr +
  canvasSize + view at construction (Engine.ts:307-331); `toUv` maps the live
  rect through those captured values (Engine.ts:1377-1381). The Studio never
  calls `engine.resize()` on a rect/DPR change. Lower priority; fix only if a
  deterministic testable seam exists, otherwise return one precise probe.

test: |
  RED-first:
  - Bug 2: a config/consumer contract test proving the app consumes the
    watercolor SOURCE entry (pigment-era engine), not the stale dist; it must
    fail before the alias is added.
  - Bug 1: codec + controller + record-state tests proving the durable base
    is persisted per key in the snapshot and restored into the launch map on
    reopen; a reopened scripted key's publish target must carry bytes.
  - Bug 3: an engine pointer-mapping test when the rect/DPR change, if the
    harness can drive it; otherwise a single live probe request.

expecting: |
  With the fresh engine the live aquarelle canvas is transparent where no
  pigment exists (MODE 4 alpha ~= 1 - min(transmittance)), so the committed
  base stays visible under the new stroke with no double composite. With the
  durable base restored per key, Move after reopen re-bakes over the same
  pre-script base and never erases scriptless cached paint; absent base stays
  fail-closed. Storage remains opaque transmittance; display remains pigment
  alpha; SNAP v3 key anchors untouched.

next_action: |
  Human verification only: restart the dev app, then (1) delete a key and
  create a new key/rail at the same frame — the new key must render empty
  immediately with no leave/return (UAT Round 5), then (2) run the ONE minimal
  UAT flow in "UAT Round 4 verification (pending)" at the end of this file. On
  "confirmed fixed", archive the session and append the knowledge-base entry;
  on any failure, append the live evidence and reopen.

reasoning_checkpoint:
  hypothesis: "The restore/save layer seeds watercolor strokes by frame number, so a deleted key's five retained strokes re-seed into the new key at frame 0; those stale events also block the ordinary durable base, which fails the publish and leaves the blank cached frame plus six overlay guides."
  confirming_evidence:
    - "Persisted Paint 2 SNAP v2: six watercolor strokes at playFrame 0 (917/920/921/922/923 recorded on the deleted key + 1259 new), zero brush frames; two more at playFrame 1 (1073/1074)."
    - "Live layer revision 2067: exactly one real key on Paint 2 at appFrame 0 (keyId fef0e1ef-...), zero keys on Paint 4 and Paint 1."
    - "Code: recordAquarelleOrdinaryDurableBaseRef refuses when getAquarelleEventsForFrame(appFrame).length > 0 (script-already-present); the display's dirty refusal emits 'Cache restored at frame N.' (useRotoReferenceController.ts:256)."
    - "RED-first tests reproduced the law: five stale strokes seeded before the fix; legacy/unproven rows and known-empty key maps also seeded."
  falsification_test: "If the persisted events had carried the live keyId (fef0e1ef) at playFrame 0, or if the pre-fix restore with the known-empty key map had seeded nothing, the frame-scoping hypothesis would be wrong."
  fix_rationale: "Identity, not frame numbers: every recorded stroke stamps its owning keyId (record state), SNAP v3 persists the anchors, and restore seeds a stroke only when anchor(mutationId) == liveKeyIds(playFrame). Brush rows follow the same equality. A deleted key's content stays in the retained file for undo but is never seeded."
  blind_spots: "No native UAT yet. Pre-fix (v2/unanchored) watercolor events are deliberately retained but never re-seed — a declared one-time consequence (Paint 2's six events are corrupted; Paint 4/Paint 1 currently have zero keys). The round-1 white-matte fix (8b0fe106) is untouched and its tests still pass."
  candidate_causes:
    - "code: frame-only pruning/union had no key identity (aquarelle + brush seed paths, retained merge)"
    - "data: the persisted snapshot retained five strokes from a deleted key at the same frame number"
    - "config/environment: ruled out — launch order (registerDocument before restore) and the live key map were verified correct"
  and_gate: "yes — the failure required BOTH a data condition (stale retained events in the file) and a code condition (frame-only seeding without identity). Both are addressed at the seed seam; the save path now records proof for future restores."
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

- timestamp: 2026-10-27T07:20:00.000Z
  checked: Persisted Paint 2 Studio snapshot (SNAP v2) decoded event-by-event + the live layer JSON `/Users/lmarques/Desktop/efx-motion-editor-project-test/test.mce/layers/7bcc71b6-816d-4b26-8b86-20c37f39787a.json` (revision 2067) + launch ordering in `usePhysicsPaintLaunchIntegration.ts`.
  found: Paint 2's snapshot holds SIX watercolor stroke events at playFrame 0 — mutationIds 917 / 920 / 921 / 922 / 923 (recorded 2026-10-26 23:33–23:34 UTC on the key the user later deleted) plus 1259 (brushId 'rigger', 27 points, recorded 2026-10-27T06:21:03.933Z) — and two events at playFrame 1 (1073/1074). Zero brush frames. The live layer has exactly ONE real key on Paint 2 at appFrame 0 (keyId fef0e1ef-4415-48df-995e-7821f88cd131); Paint 4 and Paint 1 have zero keys. `registerDocument` (line 214) runs BEFORE `restoreStudioScriptSnapshot` (line 249), so an empty/one-key set at restore is genuinely known, not a launch race.
  implication: The six guides are five deleted-key strokes seeded into the new key plus the new stroke (5 + 1 = 6). The defect is missing key identity in the seed/save layer — exactly the user's "IDs are not unique per frame" intuition, but the mutationIds themselves are unique; the FRAME is what was treated as identity.

- timestamp: 2026-10-27T07:30:00.000Z
  checked: `PhysicsPaintStudio.tsx:6991-7012` (recordAquarelleOrdinaryDurableBaseRef) + `useRotoReferenceController.ts:245-262` (message source) + `studioScriptSnapshotController.ts` pre-fix restore/merge paths + `aquarelleRecordState.ts` record/purge/remap paths.
  found: With stale events present, `getAquarelleEventsForFrame(0).length > 0`, so the ordinary durable base is refused ('script-already-present') and never pinned; the publish then fails closed, leaving the blank placeholder. The display falls back to cached bytes and the dirty-refusal branch emits "Cache restored at frame 0." (line 256). Pre-fix, `restore()` pruned watercolor events by `playFrame` membership only, and `mergeStudioScriptSnapshotContent` unioned events by mutationId with no identity; brush restore treated an empty key Map as "unknown" and kept legacy no-keyId rows.
  implication: Both halves of the symptom are one root cause: stale seeded events (guides) also block the durable base (washed-out blank frame + cache message). The fix must make every path key-scoped — record, save, restore, retain — and keep UNKNOWN (null) distinct from KNOWN-EMPTY (Map).

- timestamp: 2026-10-27T07:40:00.000Z
  checked: RED run of the three targeted test files before implementation.
  found: `Test Files 3 failed (3)` / `Tests 16 failed | 64 passed (80)`. Failures were exactly the new laws: missing `getAquarelleStrokeKeyAnchors` export, `decoded.watercolorKeyAnchors` undefined, five stale strokes seeding, legacy brush row seeding, and the heavy-fixture byte length (v3 header).
  implication: The defect is reproducible as a contract (not just a live screenshot); the tests that will pin the fix fail for the right reason.

- timestamp: 2026-10-27T07:45:00.000Z
  checked: GREEN run — the three targeted files, then 12 related files (snapshot, codec, record-state delete/move/reorder/transform/purge/restore, brush record state, PhysicsPaintStudio source contracts, duplicate-script port).
  found: 3 files / 80 tests passed; then 12 files / 541 tests passed.
  implication: SNAP v3 anchors, key-scoped watercolor seed, key-scoped brush seed, retained-union anchors, purge/reset/remap anchor lifecycle, and the Studio record/copy stamps are all contract-green. No unrelated regressions in the touched surfaces.

- timestamp: 2026-10-27T07:58:00.000Z
  checked: Full app suite + `pnpm typecheck`.
  found: 340 test files passed | 2 skipped (342); 6197 passed | 1 skipped | 96 todo (6294); `tsc --noEmit` clean.
  implication: Automated gates are green. Only the native visible UAT row remains; the session stays `awaiting_human_verify` until the user confirms it.

- timestamp: 2026-10-27T13:05:00.000Z
  checked: `app/vite.config.ts:157-161` resolve.alias; `packages/efx-watercolor/package.json` exports; root `package.json` build script; `packages/efx-watercolor/dist/index.mjs` vs source.
  found: Vite aliases `@efxlab/efx-paint-host` (+/animation) and `@efxlab/efx-physic-paint` (+/preact) to source, but NOT `@efxlab/efx-watercolor`; that package resolves through exports to `dist/index.mjs`. Dist mtime 2026-10-26 16:59:51; it still contains `drawDisplay(null, this.view, rect, false, this.compositorLayer ? MODE.transparent : MODE.screen)` and zero `MODE.pigment` / `uMode == 4` pigment-alpha code. Source files mtime 23:20:56; the pigment display fix is commit 99fc8378 at 23:24:39. The root build script only builds `@efxlab/efx-physic-paint` then the app — it never rebuilds efx-watercolor.
  implication: ROUND-4 BUG 2 root cause. With the compositor layer on, the live aquarelle canvas renders the OPAQUE transmittance sheet; `aquarelleLivePaint` flips `opacity:1` on the first stroke and covers `.aquarelle-cached-base` (z3) and the z0 monitor. Leaving/reopening destroys the engine and reveals the DOM base, restoring every stroke. The SOURCE shader (MODE 4) is correct: unpainted transmittance ~white -> alpha ~0.

- timestamp: 2026-10-27T13:08:00.000Z
  checked: /tmp/efx-aquarelle-render-split.json (`coordinator-produce`, `script-bake-result`, `script-move-result`) and the alpha-proof dumps /tmp/efx-aquarelle-probe-capture-alpha-proof-base.png / -produced.png.
  found: Capture preserved the committed base: usedMerge=true blend=pigment-alpha, baseDigest 4067e:6221f287 (263806 B, key fef0e1ef), producedDigest 465f8:5e8a6673 (288248 B), committed=true, opaque 100% / retention 100%; the produced sheet holds the 18 blue scribbles plus the new light-blue wash. Separately, four `script-bake-result` events report {appFrame:0, targetKeyId:"fef0e1ef-...", ok:false, reason:"durable-base-unknown"} and four `script-move-result` report {playFrame:0, ok:false, events:18|19, error:"Apply Script could not paint the aquarelle wash."}
  implication: Bug 2 is display-only — no data is lost. Bug 1 is the durable-base contract refusing the re-bake, not event loss or a compositor fault.

- timestamp: 2026-10-27T13:10:00.000Z
  checked: `PhysicsPaintStudio.tsx:3346-3453` (prepareRotoScriptTargetRef), `:1898-1930` (publish fail-closed), `:3379-3415` (launch-map lookup), `:6991-7012` (recordAquarelleOrdinaryDurableBaseRef), `physicsPaintRotoScriptClipboard.ts:58,1070`, `physicsPaintRotoScriptRebake.ts`.
  found: An ordinary key takes its base from `aquarelleDurableBaseByKeyRef.current.get(keyId)`; the map is a launch-scoped ref pinned only at first recorded stroke, at promotion, or by a fallback gated to a frame with ZERO events. On reopen the map is empty and a scripted key stays `undefined` (UNKNOWN), so publish refuses. `null` means KNOWN EMPTY and is allowed. Nothing in the snapshot save/restore carries the base.
  implication: Root cause of Bug 1 is persistence/restore of a per-key durable base — not the publish contract. The contract (absent = fail closed) must stay; any reconstruction from the committed sheet would double-composite the script.

- timestamp: 2026-10-27T13:12:00.000Z
  checked: `packages/efx-watercolor/src/playground/Engine.ts:306-331` (fitCanvas), `:1359-1362` (resize), `:1377-1381` (toUv); `AquarelleCanvasLayer.tsx` attach/refit usage.
  found: fitCanvas captures dpr, canvasSize and view at construction; toUv reads the live getBoundingClientRect but maps through the captured canvasSize/view. The Studio creates the engine with width/height refs and never calls resize/fitCanvas on a later rect/DPR change (no ResizeObserver / matchMedia refit).
  implication: A layout shift or DPR change after mount yields a constant pointer offset until the engine is recreated (quit/reopen Studio). Testability is limited in jsdom; decide between a targeted engine-level test and a single live probe.

- timestamp: 2026-10-27T07:15:00.000Z
  checked: Bug 1 RED run of the three targeted files after the SNAP v4 durable-base tests were written (codec, controller, PhysicsPaintStudio source contracts), before implementation.
  found: `Test Files 3 failed (3)` / `Tests 18 failed | 357 passed (375)`. The failures were exactly the new laws: v4 round-trip/byte-stability/v3-empty decode and the five refusals; restore-seed, session-wins, raster-drop, deleted-key-retain, cross-track-exclusion and base-only-save controller laws; and the Studio seed/deps contract. Two new invariant tests (input-order sort determinism, trailing-bytes refusal) pass trivially by construction — accepted as guards.
  implication: The durable-base gap is reproducible as a contract, not just the /tmp refusal trace; the tests driving the fix fail for the right reason.

- timestamp: 2026-10-27T07:22:00.000Z
  checked: Bug 1 implementation + GREEN. Codec SNAP v4 durable-base section; controller deps/content/merge/restore/encode/empty-guard; Studio wiring (`getDurableBases`, `seedDurableBases`, launch-key guard, restore-start reset).
  found: Targeted GREEN 3 files / 375 tests pass. Related snapshot + aquarelle record-state + clipboard/rebake suites: 7 files / 188 tests pass. `pnpm typecheck` clean.
  implication: The restored base now rides the same identity law as the strokes: per KEY, session wins, raster-clear drops a vanished live key's base, absent remains fail-closed. Snapshot restore seeds the launch map BEFORE launchContext publishes; the launch-key guard prevents the reset effect from wiping it.

- timestamp: 2026-10-27T07:25:00.000Z
  checked: Fix-acceptance guardrail for Bug 1.
  found: Signal 1 target tests pass (375/375). Signal 2 mutation check SKIPPED — no Stryker configuration exists in the repo (`app/stryker.conf.*`, `stryker.conf.*`, package.json all absent). Signal 3 no-op/deletion: diff is +971/−72 overall; the implementation deletions are the v3 header comment, the version constants and the old 3-field merge return, each replaced by a superset; the old unconditional reset effect was replaced by a launch-key-guarded one plus the restore-start reset (RCA-justified against the pre-publish seed). No weakened assertions. Signal 4 adjacent: 188 related tests + full physic-paint suite 180 files / 3965 tests + typecheck, all pass. Signal 5 revert-and-reconfirm: `git stash` of the three implementation files → 18 failed | 357 passed (the same RED set); `git stash pop` → 375/375.
  implication: guardrail_verdict accepted; the fix is minimal, additive and provably the change that greens the tests.

- timestamp: 2026-10-27T07:27:00.000Z
  checked: Bug 3 fix + guardrail. RED-first contract test added to `aquarelleLayerContract.test.ts` ('REFIT: a live rect or DPR change re-fits the captured pointer geometry').
  found: RED: 1 failed | 17 passed (no `ResizeObserver` in the layer). Implemented ResizeObserver + re-armed `matchMedia('(resolution: Xdppx)')` in the engine mount; both call the engine's public `resize()` (→ `fitCanvas` re-captures dpr + box size + view) only when the box or DPR actually drifts; observer and media listener are removed in the engine cleanup. GREEN 18/18. Revert check: stash of `AquarelleCanvasLayer.tsx` → 1 failed | 17 passed; pop → green. `pnpm typecheck` clean; full physic-paint suite 180 files / 3965 tests pass.
  implication: The only way the captured pointer geometry can drift (CSS-box resize or DPR change without remount) now self-heals; pointer mapping stays 1:1 with the pen. Live trigger still needs the UAT row (resize the Studio window, then paint).

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

- timestamp: 2026-10-27T07:22:00.000Z
  ruled out: mutationId collisions / non-unique ids across frames or tracks (the user's stated guess).
  why: The persisted ids are unique (917/920/921/922/923 vs 1259 and 1073/1074) and the registry keys are per mutationId. The collision is at the FRAME/SESSION level: the snapshot restore/save layer treated `playFrame` as ownership, so a deleted key's events re-seeded whatever key occupied that frame number.

- timestamp: 2026-10-27T07:23:00.000Z
  ruled out: cross-track or cross-frame guide leakage (Paint 2 events appearing on Paint 4 / Paint 1).
  why: Paint 4 and Paint 1 have zero real keys and the six stale events live only in Paint 2's per-track snapshot (`projectId/layerId/trackId` keyed). The phantom guides were all on Paint 2 at frame 0.

- timestamp: 2026-10-27T07:24:00.000Z
  ruled out: the round-1 white-matte fix (8b0fe106) causing the round-2 wash loss.
  why: The wash loss is upstream of compositing: stale seeded events refuse the durable base and the publish fails closed, so the frame is blank before any raster reaches the compositor. The strip removal is untouched by this fix; its two RED-first tests still pass in the green run.

- timestamp: 2026-10-27T13:15:00.000Z
  ruled out: the cached-base URL being cleared by painting or by Move (Bug 2).
  why: Every `setCachedRotoReferenceUrl(null)` call is on navigation/frame change, cross-track switch, frame removal, or reset; the dirty-reference clear is watercolor-guarded (`if (activeModule.value === 'watercolor') return`). The base DOM layer keeps its URL through painting; the live canvas simply covers it.

- timestamp: 2026-10-27T13:16:00.000Z
  ruled out: a stacking inversion in the active-track stack (Bug 2).
  why: `.aquarelle-cached-base` is z3, `.aquarelle-live-canvas` z4 and the program monitor z0, all inside the isolated tracks group; the base is below the live sheet by design. The cover is the live sheet's opaque pixels, not z-order.

- timestamp: 2026-10-27T13:17:00.000Z
  ruled out: the aquarelle capture merge dropping the committed strokes (Bug 2).
  why: `coordinator-produce` merged the 263806 B base with the live sheet (opaque 100%, retention 100%) and committed 288248 B; both proof dumps show all 18 previous scribbles. Only the live DISPLAY was wrong.

- timestamp: 2026-10-27T13:18:00.000Z
  ruled out: Move losing or corrupting the watercolor events (Bug 1).
  why: `script-move-result` reports events:18|19 and `script-bake-result` reports reason:"durable-base-unknown"; the refusal happens before any bake, so the timeline is intact and the defect is only the missing base.

## Resolution

status: awaiting_human_verify (round-4 fixes landed 2026-10-27)

root_cause: |
  ROUND 4 — three independent faults at three seams:

  (1) MOVE AFTER REOPEN = durable-base persistence gap. The launch-scoped
  `aquarelleDurableBaseByKeyRef` map is pinned only at the first recorded
  stroke, at promotion, or by a fallback gated to a frame with zero events.
  After a reopen the map is empty, so a scripted ordinary key leaves
  `durableBaseBytes` undefined (UNKNOWN) and the publish port correctly fails
  closed (`durable-base-unknown`) — "Apply Script could not paint the
  aquarelle wash." The base was never saved; rebuilding it from the committed
  sheet would double-composite the script.

  (2) PREVIOUS STROKES HIDDEN WHILE PAINTING = stale vendored engine build.
  The app resolved `@efxlab/efx-watercolor` via package `exports` to
  `packages/efx-watercolor/dist/index.mjs` (built 2026-10-26 16:59:51, BEFORE
  pigment-alpha commit 99fc8378 at 23:24). That dist still renders the OPAQUE
  transmittance sheet on the compositor layer; the first stroke flips
  `aquarelleLivePaint` to opacity 1 and covers the z3 cached base and the z0
  monitor. Capture was already sound (base 263806 B, merge retention 100%),
  so no paint was lost — only the live display was wrong.

  (3) ~200 PX OFFSET = captured pointer geometry. `fitCanvas` stores dpr +
  canvasSize + view at construction; `toUv` maps the live rect through those
  captured values. A canvas CSS-box change (Studio window/panel resize) or a
  DPR change (window moved across displays) without a canvas remount left the
  capture stale, so every pointer mapped offset until Studio was recreated.

fix: |
  ROUND 4:
  - Bug 2 (`app/vite.config.ts`): alias `@efxlab/efx-watercolor` (root + all
    five public subpaths, subpaths first for Vite prefix matching) to
    `packages/efx-watercolor/src`, the same source-resolution law already
    used for efx-paint-host and efx-physic-paint. The app never consumes the
    stale dist again.
  - Bug 1 (`studioScriptSnapshotCodec.ts`, `studioScriptSnapshotController.ts`,
    `PhysicsPaintStudio.tsx`): SNAP v4 appends a durable-base section
    (u16 version=1, u16 reserved, u32 count, count × state/keyId/bytes,
    sorted by keyId; fail-closed on duplicate, empty keyId, zero-byte bytes,
    unknown state, over-count and trailing bytes; v1–v3 decode to []). The
    controller gains `getDurableBases` / `seedDurableBases`; restore fills the
    launch map BEFORE the launch context publishes (session wins per keyId);
    merge is scoped by live key ids + merged anchors + retained base ids, a
    retained base for a LIVE key missing from the session is dropped
    (raster-clear safety), a deleted key's base is kept (undo), and the
    empty-save guard counts bases. The Studio pins the incoming launch key and
    resets the map at restore start; a launch-key-guarded effect keeps the
    seeded map instead of wiping it after publish.
  - Bug 3 (`AquarelleCanvasLayer.tsx`): the live layer observes the canvas
    box (ResizeObserver) and DPR (re-armed `matchMedia('(resolution: …)')`)
    and calls the engine's public `resize()` — which re-runs `fitCanvas` and
    recaptures all three mapped inputs — only when the box or DPR drifts.
    Observer and media listener are removed with the engine.

  Storage stays opaque transmittance; display stays pigment alpha; one paper
  multiply on the tracks group; SNAP v3 key anchors and the round-1
  white-matte fix (8b0fe106) are untouched. Prior rounds remain as landed:
  round 1 (strip removal), round 2 (key identity at every script seam),
  round 3 (one-row UAT pass).

files_changed:
  - app/vite.config.ts
  - app/src/viteBuild.test.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
  - app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts

verification:
  target_test:        { result: pass }
  mutation_check:     { result: skipped, reason_if_skipped: "no Stryker configuration in the repo", mutant_killed: false }
  no_op_deletion:     { result: pass, deletion_justified_by_rca: true }
  adjacent_tests:     { result: pass, suites_run: ["snapshot/aquarelle record-state/clipboard/rebake 7 files 188 tests", "full physic-paint 180 files 3965 tests", "pnpm typecheck"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  guardrail_verdict:  accepted
  rejected_signal:    null

tests: |
  RED-first:
  - Bug 2: alias/source-resolution + bundled pigment-shader marker → 2 failed
    before / 13/13 after.
  - Bug 1: codec v4 (round-trip bytes+null byte-stable, input-order sort,
    decoded copies, v3 → [], duplicate/empty/zero-byte/state/over-count/
    trailing refusals, encode-time refusals), controller (seed all restored
    bases, routine save persists restored + newly pinned, session wins,
    raster-clear drop, deleted-key retain, cross-track exclusion, base-only
    save passes the empty guard, v3 seeds none, corrupt snapshot never seeds)
    and the Studio source contract → 18 failed | 357 passed before /
    375 passed after.
  - Bug 3: REFIT contract → 1 failed | 17 passed before / 18/18 after.

  GREEN: targeted 3 files 375/375; related 7 files 188/188; full physic-paint
  180 files 3965/3965; `pnpm typecheck` clean. Revert-and-reconfirm: Bug 1
  stash → 18 failed | 357 passed; Bug 3 stash → 1 failed | 17 passed; both
  green on reapply.

open: |
  Declared consequences: (a) pre-v4 scripted keys (painted before this
  build) carry no durable base, so a Move right after reopen still fails
  closed until the key is recreated and painted once under this build;
  (b) the snapshot grows by the base raster (~100-300 KB per scripted key)
  and is rewritten on script saves — accepted, no Rust/package-format change.
  The round-2 "thinner after Move" fidelity note (open item C) is unchanged
  and out of round-4 scope.

uat_pending: |
  ONE flow — see "UAT Round 4 verification (pending)" at the end of this file.

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

## UAT Round 2 (2026-10-27) — FAILED: phantom guides after key purge

uat_setup: |
  The user deleted ALL keys, then on the empty project/frame created a new key
  and painted ONE watercolor stroke in Studio. Tracks Paint 2, Paint 4 and
  Paint 1 still exist. Status bar reads "Cache restored at frame 0."

actual: |
  - The new watercolor stroke's wash DISAPPEARED from the canvas.
  - SIX phantom guide strokes appear, each inside a dashed selection box and
    labeled "#1 : 6/6", "#2 : 5/6", "#3 : 4/6", "#4 : 3/6", "#5 : 2/6",
    "#6 : 1/6". They read like retained watercolor guide proxies / stack rows
    (five old + the new one).
  - The user sees this as the whole script/track management being broken and
    cannot continue UAT until scripts are fixed.

screenshot: /Users/lmarques/.claude/image-cache/7bb1a5d7-af0d-41bf-95c3-afbd38a2878a/18.png

user_verdict: |
  "All is broken after fail test width cache, stack of tracks etc ... I deleted
  all keys, on empty project, I created a key and a stroke paint watercolor and
  look what happen: my stroke new paint disapeared, I see plenty of strokes
  phantoms. I think The scripts system management with tracks is totally
  broken, this release is corrupted and far from ready. Its a total fail. I
  can't continue more test until the scripts are fixed. Maybe ID are not unique
  per track and per frame, I dont know. advice me"

debugger_lead: |
  This is the retained-script / guide-ledger layer, not the compositor. Six
  guides after ONE new stroke plus a "Cache restored" status point at stale
  scripts seeded into a new key. Prime suspects:
  1. `studioScriptSnapshotController.withoutForeignKeyFrames`: when
     `liveKeyIds.size === 0` it returns ALL retained frames, and a legacy row
     with no keyId is KEPT on any normal frame even when the live key changed.
     A deleted key's script can therefore resurrect on a new key at the same
     frame number.
  2. `mergeStudioScriptSnapshotContent` unions `watercolorEvents` by
     mutationId only — no keyId/track/frame scoping for non-dry events. Five
     retained strokes + one new = six guides.
  3. The restore path ("Cache restored at frame 0") may seed the retained
     script into the new key even though key identity changed.
  4. The engine/record guide ledger may keep old guides after key deletion; the
     new wash is not rendered (ownership/module or retained-script ownership).
  Verify with app-written /tmp evidence first: snapshot events (mutationIds,
  key/frame anchors), live key IDs per track/frame, frameScriptOwner, engine
  guide count, and the seed/restore call path. Then scope every script entry to
  its owning key identity (track+frame+keyId), purge on key deletion, and make
  a new key incapable of inheriting a deleted key's strokes. RED tests:
  delete all keys -> retained registry empty; new key + one watercolor stroke
  -> exactly one guide + the wash, zero retained strokes; the same frame number
  on another track/frame never collides.

## UAT Round 3 (2026-10-27) — ONE minimal row

declared_consequence: |
  Pre-fix watercolor events (SNAP v1/v2, no key anchor) are retained in the
  file but NEVER re-seed. That is deliberate: without an anchor they cannot
  prove which key owned them. The six Paint 2 events are the corrupted set;
  Paint 4 / Paint 1 currently have zero keys, so no visible script is lost.
  From this build on, every newly recorded stroke is anchored and restores
  normally.

uat_row: |
  Relaunch the app (the user runs it), open Studio on Paint 2 frame 0 with the
  empty session, create ONE new key and paint ONE watercolor stroke.

  PASS: exactly ONE guide is listed, its wash stays visible on the canvas,
  the status line does NOT read "Cache restored at frame 0.", and closing /
  reopening the Studio (or relaunching) restores that same single stroke +
  wash (SNAP v3 anchor).
  FAIL: any phantom guide (report its "#N : M/M" label), or the wash
  disappears again.

## UAT Round 4 (2026-10-27) — post-fix editing failures

context: |
  The phantom-guide/key-identity round is not re-reported (no phantom guides
  mentioned), but three editing blockers appeared. They are a different layer:
  aquarelle durable-base persistence, live display base, and engine geometry.

bug_1_move_after_reopen: |
  Paint many strokes on a key, leave or quit Studio, return and select a stroke
  to move it. Move errors: "Apply Script could not paint the aquarelle wash."
  The stroke cannot be moved.
  Lead: the Apply port (`PhysicsPaintStudio.tsx:1817` ->
  `applyAquarelleEventsToKey`) fail-closes when `target.durableBaseBytes` is
  undefined (reopened ordinary scripted key => `durable-base-unknown`,
  `PhysicsPaintStudio.tsx:1940-1960`) and returns false; the clipboard shows
  the generic message at `physicsPaintRotoScriptClipboard.ts:1070`. The prior
  sessions deferred durable-base persistence (options A/B). Move after reopen
  requires persisting/restoring the durable base per key (or an equivalent
  reconstruction) without erasing scriptless cached paint.

bug_2_previous_strokes_hidden: |
  While adding a new stroke, all previous strokes disappear and only the last
  stroke is shown. After leaving the key and returning, all strokes + the new
  one are back, but they still cannot be moved (bug 1).
  Lead: the aquarelle live sheet starts blank on a new session; the committed
  strokes live in the cached base (`.aquarelle-cached-base`, z3) while the live
  sheet (`z4`) accumulates only the current session. The cached base is mounted
  from `cachedRotoReferenceUrl` (`PhysicsPaintStudioView.tsx:238`,
  `PhysicsPaintCanvasMount.tsx:229`) and the live canvas gets `opacity:1` once
  `aquarelleLivePaint` is true. Verify whether the base URL is null/cleared on
  a real key or the live canvas covers it; the known caveat in
  `watercolor-clears-cached-paint.md` says pre-existing paint is not visible
  during the module session. Fix: show the current key's committed base under
  the live sheet without double-compositing or an opaque cover.

bug_3_paint_offset: |
  Sometimes painting at any destination position renders the paint ~200 px away
  from the pen; quitting Studio fixes it.
  Lead: the vendored engine captures `dpr` + canvas backing size + view in
  `fitCanvas()` at construction (`packages/efx-watercolor/src/playground/Engine.ts:307-331`).
  `toUv` reads the live `getBoundingClientRect()` but maps through the captured
  `canvasSize`/`view` (Engine.ts:1377-1381). If the Studio canvas rect or the
  DPR changes after mount (layout shift, window/display change), the pointer
  mapping is stale by a constant offset. Check whether the Studio ever calls a
  resize/fit on canvas geometry or DPR changes, and reproduce with a live
  pointer-mapping probe.

user_verdict: |
  "now I have 3 bugs: ... I want edit it, I move the selected stroke it out
  errors: 'Apply Script could not paint the aquarelle wash.' The stroke can't
  to be moved ... When I want add a new stroke paint: all the previous stroke
  disapear and show only the last stroke, when I left the key and back to it I
  have all the strokes back + the new, but I can't move them. ... Sometimes
  when I paint the any destination position, my paint draw far to 200 pixels
  from my pen, its like a offset, for fix I need to quit studio."

## UAT Round 5 (2026-10-27) — delete/create stale cache

uat: |
  After the parent-layer lookup fix (`f2af1714`), the user deleted a key
  successfully. Creating a new rail/key at the same frame 0 then showed the OLD
  cache on the canvas; leaving and returning to the new key refreshed it to
  empty. The user reports this refresh lag on every operation.

root_cause: |
  The physical-edit settlement reconcile
  (`useRotoPhysicalEditCoordinator.ts`) ran only for an allowlist of operation
  kinds. Ordinary `delete-key` was not in the list, so the deleted key's cached
  reference URL stayed on screen until navigation. The add-key path is
  `paste-key` (listed) but started from the stale reference state left by the
  delete.

fix: |
  Reconcile the current frame after EVERY accepted physical edit. The
  reference loader is dirty-aware and the auto-key promotion branch still
  preserves the live first stroke; the reconcile remains visual-only and never
  gates settlement. Added a RED-first pin: an accepted ordinary delete-key
  triggers `reconcileCurrentFrame` once with the cursor frame.

gates: |
  Physical-edit coordinator suite 86/86; `pnpm typecheck` clean.

uat_pending: |
  1. Restart the app. Delete a key; create a new key/rail at the same frame.
     The canvas must show the empty new key immediately — no leave/return.
  2. Then resume the Round 4 flow: previous strokes visible while painting,
     Move after reopen without the wash error, and ink under the pen after a
     window resize/display move.

## UAT Round 6 (2026-10-27) — track 2 overwrote track 1 (cross-track capture)

user_verdict: |
  "I paint on track 1: tested paint, edit, raster, added new paint etc, all work
  perfect. After I added a track 2 under track 1 in background I painted with
  water color, seem water color from track 1 has not the right transparence,
  but le plus grave c'est que il a perdu tout le script et le cache du track 1,
  le key du track 2 a littéralement écrasé la key du track 1 : cache + script,
  and now I have the same of track 2 to the track 1 (only the cache), on track 2
  I have the original paint cache + script que je peux editer. c'est incroyable.
  Tu a fixé pas mal de bug mais celui là interdit l'utilisation d'autre track !"

root_cause: |
  In-place Studio track switch (add track / row click) captures the OUTGOING
  live aquarelle sheet AFTER `setActiveTrackId` has already moved the document.
  The capture chain resolved its target from the LIVE active track:
  `handleAquarelleCaptureFrame` -> `captureLivePixels` (`getActiveTrackId`) ->
  `upsertCachedFrame` (re-resolved again at commit). So the outgoing track's
  sheet + its pinned merge base were committed onto the INCOMING track's key —
  track 2's composite replaced track 1's key payload. The same commit then
  wrote `confirmedFramesRef` / edit-buffer entries after the switch had reset
  them, seeding the incoming track's reference buffer with the outgoing
  composite (track 1 displayed track 2's cache). The merge-base pin was per
  frame only, and two tracks share frame numbers.

fix: |
  1. `flushCapture(trackId?)` is threaded end-to-end: AquarelleCanvasLayer ->
     PhysicsPaintCanvasMount -> Studio -> `captureLivePixels` (new optional
     `trackId`) -> `upsertCachedFrame` (new optional `expectedTrackId`).
  2. The switch effect passes the OUTGOING track id (captured before
     `lastEditStateTrackIdRef` is overwritten).
  3. `upsertCachedFrame` writes `confirmedFramesRef` / `editBuffer` only when
     the capture's track is still the live active track; the parent key write
     always targets the capture's track.
  4. The aquarelle merge-base pin is keyed by (appFrame, trackId).

verification: |
  RED-first contract pins in `aquarelleLayerContract.test.ts` (outgoing track
  carried through the flush, explicit capture/commit track, live-buffer guard)
  and updated Studio/contract anchors. Suites: PhysicsPaintStudio 288/288,
  aquarelleLayerContract 19/19, coordinator 30/30, aquarelleStrokeBridge 13/13
  (350 total). `pnpm typecheck` clean.

uat_pending: |
  1. Restart the app. On track 1, paint/edit/raster as before.
  2. Add track 2 under track 1; paint watercolor on track 2.
  3. Select track 1. PASS: track 1 keeps ITS OWN cache and ITS OWN editable
     script; track 2 is unchanged. Then switch 1 -> 2 -> 1 twice; no cache or
     script crosses.

## UAT Round 7 (2026-10-27) — watercolor script lost on restore (unanchored strokes)

user_verdict: |
  "I do severals paint on a frame, moved, edited, deleted, keeping all paints.
  After I leave the key go to another key under this track, and I go back to the
  first key, and editable seem removed, I lost all script."
  Answers: watercolor; the painted pixels remain visible; a Studio close/reopen
  does NOT bring the script back.

on_disk_evidence: |
  Decoded the real project snapshots with the real codec
  (`.../test.mce/scripts/7bcc71b6-.../<trackId>-v1.snap`):
  - Paint 4 (00a78810, written 2026-10-27T09:46): **83 watercolor strokes,
    only 2 key anchors**; the two anchors name key 0ad41207, which is not a
    live key. Durable base for that key = known-empty. Brush rows reference
    two other keys.
  - Paint 2 (3298f2eb, 09:28): 0 watercolor events, one brush row on a key
    that the saved document no longer holds.
  - The saved document (09:46) holds only Paint 2 key 8b638835; Paint 4 /
    Paint 1 have no keys.
  The restore law seeds a watercolor stroke only when its file anchor equals
  the live key at its playFrame; every UNANCHORED stroke is dropped. That is
  why the script vanished on the first restore (track switch) and stays gone
  after reopen.

root_cause: |
  A stroke's anchor is stamped at stroke END from
  `resolveStudioScriptKeyIdForFrame(identityRef, launch.startFrame)`. On a
  fresh frame whose key does not exist yet (auto-promotion happens later, at
  the first capture), that lookup returns undefined and the stroke is
  recorded with NO anchor. Nothing repaired it afterwards: the save wrote
  the unanchored event, and every restore dropped it. An identity/active-track
  lag could produce the same null anchor.

fix: |
  1. `anchorUnownedAquarelleStrokesForFrame(frame, keyId)` (record state):
     when an auto-key promotion lands a key, every UNANCHORED stroke of that
     frame is bound to it. Already-anchored strokes are never retargeted.
  2. Save-time safety net `backfillSessionWatercolorAnchors` in the snapshot
     controller: a session stroke with no anchor whose frame has a live key
     in the bound track is anchored at prepare time. Frames without a live
     key are never backfilled (deleted-key safety).
  3. Record-time anchor resolves from the LIVE ACTIVE track (the paint
     target), not the possibly-lagging snapshot binding.

verification: |
  New pins: `aquarelleRecordState.anchor.test.ts` (3), two controller save
  tests (backfill with/without a live key), Studio source contract for the
  promotion backfill + active-track resolution. Suites: 368 passed across
  anchor + snapshot + Studio + aquarelle contract. `pnpm typecheck` clean.

declared_consequence: |
  Strokes already saved WITHOUT an anchor cannot be re-seeded safely — an
  unanchored stroke is indistinguishable from a deleted key's stroke, and
  re-seeding those is the phantom-guides regression. Existing lost strokes
  must be repainted once; every stroke painted under this build carries an
  anchor and restores.

DATA_END

## UAT Round 4 verification (pending) — ONE minimal flow

setup: |
  Restart the dev app once (Vite must re-resolve `@efxlab/efx-watercolor`
  from SOURCE after the alias change), then open Studio on a Water color
  layer/track with at least one real key. Paint under THIS build so the key
  gets a persisted durable base (pre-v4 keys have none by design).

steps: |
  1. Frame 0: paint several watercolor strokes on the key. While painting a
     NEW stroke, the previous strokes of the SAME key must stay visible under
     it (Bug 2 — no opaque cover, no vanish).
  2. Leave the key (navigate away and back) or quit and reopen Studio, then
     return to frame 0. Every stroke must still be there.
  3. Select one of those strokes and Move it a few pixels, then confirm.
     Expected: the wash re-bakes cleanly — NO "Apply Script could not paint
     the aquarelle wash." — and the moved stroke sits over the same
     pre-script paint; the other strokes are unchanged (Bug 1).
  4. Resize the Studio window (or move it to another display), then paint a
     new stroke at a known spot. Expected: the ink starts under the pen — no
     ~200 px offset (Bug 3).
  5. Quit and reopen Studio once more; frame 0 still shows every stroke over
     its intact base.

report: |
  "confirmed fixed" only if all five rows pass. Otherwise report WHICH step
  failed, with a screenshot and the app-written evidence file, and the
  session reopens on that evidence.

## UAT Round 8 — document/session track desync (2026-10-27)

symptom: |
  After the round-6/7 build: the second track's key blended with the first
  track's key, the first track's key lost its watercolor look (thin lines),
  and every key appeared to lose its script.

on_disk_evidence: |
  Project test.mce, 10:07 run. Paint 2's snapshot (track 3298f2eb, written
  10:07:56) decoded to 26 watercolor events: Paint 2's 19 blue strokes
  (#1e7fdc, size 12, anchored to Paint 2's live key 14b76751) PLUS Paint 4's
  7 green strokes (#3eb76a, size 53/80, anchored to Paint 4's live key
  99167e22). Paint 4's snapshot was never written this session (still 09:46;
  83 events anchored to the deleted key 0ad41207, so the key-identity restore
  law drops them). Key webps: Paint 4's key 99167e22 (10:07:53) = green wash
  plus thin blue/green lines (a blend of both tracks); Paint 2's key 14b76751
  (10:08:04) = thin blue guide-looking lines. Stroke timestamps: blue
  09:06:04-09:06:30Z, green 09:06:53-09:07:13Z.

root_cause: |
  The live document activeTrackId and the paint SESSION (sheet + timeline +
  snapshot binding) desynced: the document, anchors and captures followed
  track B while the session stayed on track A. Consequences:
  - Record-time anchors (round 7) resolved from the live document -> B's key.
  - The first capture's auto-promotion created B's key while the sheet was
    still A's -> the blended key webp.
  - The save-time backfill (round 7) could bind foreign strokes to the bound
    track; A's snapshot then wrote both tracks' strokes (the 26-event file).
  - B's own snapshot was never written (the session never committed to B), so
    B's latest script existed only inside A's file.
  The switch effect's only trigger was the display-state string; a split where
  the display state was already recorded could leave the session behind.

fix: |
  1. `aquarelleSessionTrackIdRef` — the track whose sheet/timeline/binding is
     mounted. Set at the launch bind and at the switch commit. Stroke-end
     anchors, capture defaults and the promotion guard resolve against it,
     never the live document id.
  2. The switch effect now commits when ANY of the local session ref, the
     session pin or the snapshot binding differs from the document track —
     not only when the display-state string changed. The outgoing flush/save
     target the session pin; resets and bind/restore run on every commit.
  3. Auto-key promotion refuses to run when the document track differs from
     the session track (no key on the wrong track, no cross-track backfill).
  4. Snapshot save law: a stroke anchored to ANOTHER track's LIVE key is
     dropped from this track's snapshot — session AND retained file content
     (self-heals an already-mixed file; this track's deleted-key anchors still
     survive for undo). Foreign durable bases are dropped too.
  5. `session-track-mismatch` probe events at stroke-end / capture / promotion.

verification: |
  Controller pins (3): a session stroke anchored to another track's live key
  is never written; foreign retained rows are cleaned on the next save while
  deleted-key rows survive; a foreign durable base is dropped. Studio source
  contract (UAT round 8) pins every seam to the session ref and the widened
  commit trigger. Suites: 372 targeted; full physic-paint folder rerun;
  `pnpm typecheck` clean.

declared_consequence: |
  The thin/guide-looking Paint 2 key and the blended Paint 4 key are captured
  PIXELS and cannot be un-blended. The SCRIPTS are recoverable: the 7 green
  strokes sit in Paint 2's file with Paint 4's key anchors. Repaired candidate
  snapshots were built and verified to seed 19 blue strokes into Paint 2 and
  7 green strokes into Paint 4 (copies at /tmp/261027-round8-*.snap);
  installation requires the app closed and user approval. Any key whose pixels
  are wrong must be re-baked (Apply) or recreated by the user.

user_decision (2026-10-27T10:26Z): start a FRESH project; no snapshot repair
installed. The project files were not modified. Backups and repaired
candidates remain in /tmp (261027-round8-paint2-corrupt.snap,
261027-round8-paint4-old.snap, 261027-round8-paint2-repaired.snap,
261027-round8-paint4-repaired.snap).

## UAT Round 9 — live-vs-rebake paper divergence (2026-10-27)

symptom: |
  Fresh project, two watercolor tracks. The under track's paint appeared to
  merge with the top track's paint; after moving a stroke on each key the top
  text lost its watercolor bloom and the under wash went pale.

on_disk_evidence: |
  The probe (/tmp/efx-aquarelle-render-split.json, 09:24-09:31Z) proves the
  tracks did NOT cross: the top key's snapshot holds only its own 9 strokes
  (2 blue #103c65 + 7 red #c71448, brushId 'rigger', size 15), the under key's
  only its own 1 stroke (brushId 'round', size 66), each anchored to its own
  track's key. The two `session-track-mismatch` entries are the navigation
  flush of the OUTGOING sheet before the switch effect commits (target = the
  session track — the round-8 fix working, not a cross-write).
  The real defect is the re-bake density: top capture ink 31.54 -> bake 10.4;
  under capture ink 65.46 -> bake 19.94 (bakeFrame 174744 B vs capture
  345118 B). Live and re-bake use DIFFERENT PAPER: the live sheet resolves
  'paper/toned-sand' through paperPresetForStudioId -> 'toned' with the engine
  default grain strength (1); the bake adapter coerced any Studio id
  containing '/' to 'cold' and applied grainStrength 0.35.

fix: |
  1. `resolveBakePaperPreset(paper, hostPreset)` (efx-watercolor adapter): a
     vendor preset id wins; a Studio id uses the host-resolved preset passed
     as options.paperPreset; only an unidentified id falls back to the
     default. The old `paper.paperId.includes('/') ? 'cold'` coercion is gone.
  2. The live sheet now applies the Studio grain STRENGTH
     (`getPaperGrainStrength` -> engine.paperTexture), the same value the bake
     applies — F3's law was only half-wired on the live side.

verification: |
  Package pins (3): Studio id -> host preset (not cold); vendor id wins; host
  fallback / default fallback. App contract (F3) pins the live strength wiring
  through mount + Studio. Suites: package 137 (4 GPU-skip), app targeted 309,
  full physic-paint folder rerun; `pnpm typecheck` clean.

status: |
  awaiting live UAT — restart required (the app resolves @efxlab/efx-watercolor
  from source). Test: on paper/toned-sand, paint a wash, Move a stroke, compare
  the bloom before/after; the re-bake must keep the live density. If it still
  thins, the next seam is the bake's deposit simulation (live coalesced pointer
  samples vs the recorded 60 Hz grid), not the paper.
