---
status: resolved
trigger: |
  Studio: new paint no longer composites over the committed cache (watercolor track).
  Paint a new stroke on a key whose paint already exists. Navigate away from the frame
  and back: only the NEW stroke is visible; the committed paint is gone. The old strokes
  are still in the SCRIPT (their selection outlines are visible), so nothing was deleted.
  An explicit re-render of the key brings the old paint back composited with the new one.
  Artist's read: for RASTER keys (no script) the new paint no longer composites with the
  cache. Heavy regression.
  Repro project: /Users/lmarques/Desktop/efx-motion-editor-project-test/v2.1.0-phase-60-2.mce
created: 2026-11-24
updated: 2026-11-24
---

# Debug Session: paint-loses-cached-base

## Symptoms

- **Expected behavior:** painting a new stroke on a key whose paint already exists keeps the
  committed paint visible when leaving and returning to the frame; the new stroke composites
  over the committed cached image.
- **Actual behavior:** after leaving and returning, ONLY the new stroke is visible. The
  committed paint is gone. The old strokes still exist in the SCRIPT (their selection
  outlines are visible), so nothing was deleted. An explicit re-render of the key restores
  the old paint composited with the new one.
- **Errors:** none reported.
- **Timeline:** regression — recent. Bisect candidates named by the user: 5f8347430 (key
  opens on its cache), 4d01b37b8 (adopt a re-render's exact sheet), c7722cb1f + 36f16d74c
  (261123-pee dry-first captures / capture settles), 833168894 + 2c60ec199 (64-25
  coverage/alpha merge), 75fdac1a6 (cacheable-script predicate).
- **Reproduction:** open the repro project in Studio, watercolor track; paint a stroke on a
  raster key that already has cached paint; navigate away from the frame and back; only the
  new stroke shows; explicit re-render brings the old paint back composited.

## Laws that must hold (do not change)

- **KEY = CACHE:** a key opens on its committed cached image (the underlay); recorded
  strokes are never replayed on open.
- **LIVE OVER COMMITTED:** the capture merge stores `t' = t_sheet x t_base^(1 - cover)`.
- A frame this session already captured restores that sheet on return; the sheet must then
  carry the committed base in its own ink / cover channels, which is why the underlay is
  hidden. If it does not, the base disappears.
- Constraints: no change to KEY = CACHE, the merge formula, or the underlay double-count
  rule. One fix, minimal diff, with a pin test at the seam changed. No format change, no UI
  text change, no new user-facing surface. Root-cause the regression; do not paper over it
  by re-enabling a replay.

## Suspect seams (pre-mapped — verify, do not assume)

Source root is `app/src/components/physic-paint/` (not `app/src/components/`).

1. `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:1285`
   `restoreCachedSheet` → `aquarelleSheetSeeded = true`; `syncUnderlay` (:941-943) then
   sets `url = null`. A remembered sheet that lost its base hides the underlay with
   nothing under the ink.
2. `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10321` `else if
   (aquarelleSheetSeeded.value) cachedBase = null` at capture time — one base-less seeded
   sheet poisons every later capture of that frame, since the merge never re-reads the
   cache.
3. Base resolution for the FIRST capture: `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10346-10368` — display
   frame if usable, else `aquarelleKeyPayloadRef` (:8078, rejects loop-placeholder /
   `<= AQUARELLE_PLACEHOLDER_MAX_BYTES`). A raster key whose display frame is a placeholder
   and whose payload read fails leaves `cachedBase = null`, and the sheet is still
   remembered.
4. Prior art: `.planning/debug/resolved/watercolor-clears-cached-paint.md` introduced the
   per-sheet session base + MULTIPLY merge (`captureLivePixels` +
   `mergeCachedRotoAlphaFrame` with `mergeBlend: 'multiply'`). Also see
   `resolved/watercolor-composite-mismatch.md` (pigment-alpha seams, paper-pass gate) and
   `paint-cache-empty-frame-on-key.md` (frame-leave capture ordering).

## Evidence requirement (before any fix)

Use the DEV probe
`app/src/components/physic-paint/performance/aquarelleRenderSplitCapture.ts` (writes
`/tmp/efx-aquarelle-render-split.json`). Reproduce once: paint on a raster key, leave,
return, re-render. Report the per-frame sequence: `layer-capture` (frame-leave, hasPaint),
`studio-capture-entry` (accepted / ink-gate), `capture-base` (sessionBase.fresh,
pinnedAppFrame), `capture-enqueue` (basePresent, identityKey), `capture-work-result`.

Decisive data: `basePresent` on the FIRST accepted capture of the frame, and
`aquarelleSheetSeeded` at that moment; and whether the returned sheet came from
`restoreCachedSheet` or from `adoptSheet`. If insufficient, add ONE read-only probe line
(same file, same convention) naming the branch taken (pendingFirstPaint / seeded /
fresh-pin) and whether `displayUsable` and `payloadBase` were true. Remove before shipping.

Live evidence is required; a vitest-only verdict is not acceptable for this cross-webview
render bug. Ordering: validate a native fix live BEFORE writing the pin test (tdd_mode
stays on; the pin test still lands with the fix, just after live confirmation).

Environment: the user runs the dev server themselves — do NOT start it.

## UAT (live, 4 rows)

1. Raster key: paint, leave, return — the raster base is visible under the new stroke.
2. Scripted key: paint, leave, return — old + new visible, no double-darkening.
3. Explicit re-render matches the live result.
4. Close/reopen the Studio — unchanged.

## Evidence

- timestamp: 2026-11-24
  checked: /tmp/efx-aquarelle-render-split.json (build debug-watercolor-loop-render-split-9,
    240-event rolling window, t=13624→108401) — every `capture-base` event for appFrame 11
  found: all 12 capture-base events: pendingFirstPaintTarget=false, fresh=false,
    pinnedAppFrame=11, basePresent=false. Display digests over the window: a22e:c51e3634
    (41518 B, captured sheet ink 4.96) until the 19609 re-render → 600de:b4e5a988
    (393438 B, ink 36.27) → 5feb0:92db0fb9 after the 22384 commit.
  implication: branch 2 (`aquarelleSheetSeeded.value === true`) fired for every frame-11
    capture in the window; branch 1 excluded by pendingFirstPaintTarget=false.

- timestamp: 2026-11-24
  checked: AquarelleCanvasLayer.tsx:1270-1299 (frame-change tick) and
    PhysicsPaintStudio.tsx:10699-10702 (handleAquarelleSheetSessionEnd)
  found: on EVERY frame change the tick calls onSheetSessionEnd (:1288, outside the
    hasPaint gate) → aquarelleMergeBaseRef is nulled; then engine.clear() and
    restoreCachedSheet for the incoming frame. The frame-leave capture runs BEFORE this
    (:1271), so only it may reuse the outgoing session's pin.
  implication: the first capture of a visit always starts with a null pin and would log
    fresh=true if branch 3 ran. Post-return frame-11 captures (e.g. return at 13990 →
    studio entry 14416 → capture-base 14417; also 16256/23163/23726) log fresh=false ⇒
    branch 3 did not run ⇒ branch 2 confirmed. The only fresh=false non-seeded-looking
    captures are the frame-leave captures themselves (22426 after 22398), which reuse the
    seeded branch's own {base:null} pin — same branch.

- timestamp: 2026-11-24
  checked: the only setters of `aquarelleSheetSeeded` (grep): restoreCachedSheet
    (AquarelleCanvasLayer.tsx:922) and adoptSheet (:1235); resetSheet (:1224) and unmount
    cleanup (:1361) clear it.
  found: the return at 13990 predates any re-render bake (first script-bake 19609); the
    restored sheet captured at 14417 has ink 4.96 — the strokes-only live sheet — while
    the bake of the same 18-event script is ink 36.27. After the explicit re-render
    (19609-19624 → adoptSheet via onAdoptSheetReadyRef, PhysicsPaintStudio.tsx:10719-10725),
    captures log sheet ink 35.62 (22289) and the sheet DOES carry the paint.
  implication: seed source for the failing captures = restoreCachedSheet ('restore').
    The 2026-11-21 doc on aquarelleSheetSeeded ("seeded by replaying the frame script")
    describes only the adopt path today. The new probe names the source directly.

- timestamp: 2026-11-24
  checked: physicsPaintStore.ts:5965 (content-addressed no-op return),
    useRotoFramePersistenceCoordinator.ts:183-185 and :579,
    rotoLivePixelCacheTransactions.ts:206, plus route-result/commit events.
  found: produced digest equals the stored display digest at every rejected frame-11
    capture (a22e at 13721 vs display a22e; 5feb0 at 23163 vs display 5feb0).
    updateRotoPhysicalRealKeyPayload returns {ok:true, changed:false} on byte-identical
    content; route folds `!update.ok || !update.changed` into
    'lease-or-settlement-rejected'; upsertCachedFrame returns false; commit logs
    committed:false; queue rejects 'commit-rejected'; settle outcome 'rejected'.
    `mutationId: null` is merely the capture job's absent mutation id (probe :739-744),
    not part of the predicate.
  implication: the 19 rejections are benign content-addressed no-ops — proof the
    base-less sheet was ALREADY committed before the window (t<13624), plus a retry
    storm and a misleading reason string. Not an independent data-loss defect;
    downstream of the same base-null state.

- timestamp: 2026-11-24
  checked: the window start (t=13624); the first in-window frame-11 capture (13650)
    already produces the stored a22e.
  found: no capture-base event before 13624 is inside the 240-event rolling window.
  implication: HYPOTHESIS (unproven): the first loss was an earlier leave→return seeded
    capture that committed the strokes-only sheet over this key's bake. The mechanism is
    proven; the exact first-loss commit is not observed.

- timestamp: 2026-11-24
  checked: aquarelleScriptBaseAuthority.ts (full), PhysicsPaintStudio.tsx:10089-10178
    (ordinary durable-base recorder), :3686-3696 (promotion base), durable-base probe
    events.
  found: resolveScriptBase returns known-empty only via a recorded entry with
    bytes===null (:63-67, :86-89), or via step 4 when the key has NO recorded strokes and
    the payload is absent (:92-96). Frame 11 has an 18-event script, so step 4 would
    yield UNKNOWN — its known-empty comes from a recorded null base: 'known-empty' at the
    key's first recorded stroke when neither key payload nor display held pixels and the
    sheet had no paint (:10136-10154), or 'promotion-blank' (:3686-3696). The frame-11
    record predates the window; only frame 10's record is present (t=99487,
    'pre-script-key-record', baseInk 19.5).
  implication: known-empty is CORRECT for frame 11 — the key's pre-script base is proven
    empty and the 18-event script is its whole content. Hence the 19609 bake publishes
    the raw bake (36.27 ink, 600de) with no composite; that is why an explicit re-render
    restores the old paint. The 41 KB a22e payload is a strokes-only flatten, not a base.

- timestamp: 2026-11-24
  checked: frame-10 control, t=101357-101670 (same repro run).
  found: capture-base 101453 fresh=true, basePresent=true, display 54748:fa3bffc3
    (345928 B, matching the recorded pre-script base baseInk 19.5), usedMerge=true,
    produced 59054:0bb092aa, committed at 101614 (physical-4275-88bcccdc). The frame-leave
    capture 101670 (from the 101644 leave 10→12) ran BEFORE the session-end (tick order
    :1271 vs :1288), reused the pin (fresh=false), produced the same 59054 and was
    rejected as a content no-op.
  implication: the healthy path pins a usable display base and multiplies
    (usedMerge=true); the frame-11 path never resolves a base. The earlier ordering
    question is resolved: capture-before-session-end is by design, not a pin leak.

- timestamp: 2026-11-24
  checked: hasCacheableScript gate (AquarelleCanvasLayer.tsx:919); sheet cache write/read
    only for frames with a cacheable script (:1277, :1299).
  found: a key with NO script cannot set seeded via restore (restoreCachedSheet returns
    false at the gate) — it would take branch 3.
  implication: HYPOTHESIS (unproven): the artist's raster-key remark is either a key that
    does carry a script (lift/promote leaves one) or a second path. Do not generalize the
    root cause to scriptless raster keys until the live probe classifies that row.

- timestamp: 2026-11-24
  checked: working-tree diff (this pass, uncommitted).
  found: AquarelleCanvasLayer.tsx exports `aquarelleSheetSeedSource` ('restore' | 'adopt' |
    null), set in restoreCachedSheet (:922-923) and adoptSheet (:1235-1236), cleared in
    resetSheet and unmount cleanup. PhysicsPaintStudio.tsx `capture-base` extra now
    carries `branch`, `displayUsable`, `payloadBase`, `seedSource`; the availability read
    (probeBaseAvailability) is DEV-gated, so production does zero extra reads.
  implication: the next live repro names the branch and seed source directly; no more
    inference from fresh/basePresent alone.

## Resolution

- **root_cause:** The frame-leave SHEET CACHE parked `engine.captureSheet()` for every
  painted frame. That snapshot is the LIVE sheet alone — the committed base is a
  display-only underlay that never enters a sheet (Engine.ts `setUnderlay` vs
  `captureSheet`), and the engine has no raster-into-sheet API. So a sheet painted over a
  blank-underlay start is strokes-only. On the return, `restoreCachedSheet`
  (AquarelleCanvasLayer.tsx:916-924) uploaded it and set `aquarelleSheetSeeded = true`,
  whose documented premise ("the sheet carries the committed base in its own ink/cover
  channels") holds only for the re-render `adoptSheet` path. Two consequences: `syncUnderlay`
  (:941-943) unbound the underlay so the committed paint vanished from the DISPLAY, and the
  capture's seeded branch (PhysicsPaintStudio.tsx:10338) set `cachedBase = null`, so the
  strokes-only sheet was COMMITTED over the key's cache — permanent loss until an explicit
  re-render. Regression provenance: 5f8347430 ("a key opens on its cache — never replay")
  replaced the replay seed (`seedAquarelleEngine`, whose sheet held the whole committed
  script) with the raw sheet-cache restore, silently carrying the old `seeded = true`.
- **fix:** `AquarelleCanvasLayer.tsx:1273` — park a frame-leave sheet only when
  `aquarelleSheetSeeded.value` is true, i.e. only a sheet that was itself seeded from a
  base-carrying one (an adopt bake, or a previous base-carrying restore). By induction the
  cache can now only hold base-carrying sheets, so `seeded = true` on restore is sound. A
  blank-underlay visit parks nothing: the return opens on the committed cache with the
  underlay bound and the capture merges over it. KEY = CACHE, the merge formula and the
  underlay double-count rule are untouched; no replay was re-enabled.
- **files_changed:** `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx`,
  `app/src/components/physic-paint/engine/aquarelleLayerContract.test.ts`
- **pin:** `aquarelleLayerContract.test.ts` — "SHEET CACHE: only a BASE-CARRYING sheet is
  parked for the return (2026-11-24)" plus the updated IN-02 predicate pin.
- **verification:** live UAT approved by the user 2026-11-24 (paint on frame 11, leave,
  return — the committed base composites under the new stroke). Post-fix probe capture
  (/tmp/efx-aquarelle-render-split.json, 01:41:02) shows `seedSource:"adopt"` captures
  (base-carrying, correct) and later `seedSource:"restore"` captures that follow an adopt —
  the only restores that remain possible. 2 committed / 9 rejected (no-op) settles, no
  strokes-only overwrite. Gates: `tsc --noEmit` 0; 756/756 across the physic-paint engine
  suites + PhysicsPaintStudio.test.ts. The read-only DEV probe was removed before handoff.

## Current Focus (superseded — kept for the record)

hypothesis: The LIVE-SEED branch (PhysicsPaintStudio.tsx:10338-10348) trusts
  `aquarelleSheetSeeded` for a sheet that does NOT carry the committed base.
  `restoreCachedSheet` (AquarelleCanvasLayer.tsx:916-924) sets that flag when the
  per-frame SHEET CACHE returns this session's captured sheet — and `engine.captureSheet()`
  is the live sheet only (strokes over a white matte; the committed base is a
  LIVE-COMPOSITOR-ONLY underlay that never enters a sheet, Engine.ts:4265-4270).
  `syncUnderlay` (:941-943) then unbinds the underlay, and the next capture commits the
  strokes-only sheet with `cachedBase = null`, overwriting the key's committed paint.
  The flag's doc premise ("seeded by replaying the frame script") only holds for
  `adoptSheet` (:1232-1241, re-render). Provenance: a3a842d85 introduced the flag +
  LIVE-SEED branch; 979ef3ac9 and 5f8347430 reused it for the sheet-cache restore.
test: one live repro with the new DEV probe fields active (`branch`, `displayUsable`,
  `payloadBase`, `seedSource` on `capture-base`): paint a stroke on the key whose paint
  already exists (appFrame 11 in the repro project), navigate away, return, then explicit
  re-render.
expecting: every capture after the return logs `branch:"seeded"`,
  `seedSource:"restore"`, `displayUsable:true` (the display frame carries real bytes),
  while the captured sheet's ink stays far below the re-render bake's ink (current
  window: 4.96 vs 36.27). If instead the first post-return capture logs
  `branch:"fresh-pin"` with `displayUsable:false` and `payloadBase:false`, the
  seeded-trust hypothesis is WRONG and the base resolver itself is starving.
next_action: ask the user to run the live repro (the user runs the dev server) and hand
  back /tmp/efx-aquarelle-render-split.json; read the `capture-base` events' new fields,
  confirm or falsify, then write the reasoning checkpoint before any fix.
reasoning_checkpoint: not applicable this pass — evidence only, no fix applied; a full
  checkpoint is written before fix_and_verify.
