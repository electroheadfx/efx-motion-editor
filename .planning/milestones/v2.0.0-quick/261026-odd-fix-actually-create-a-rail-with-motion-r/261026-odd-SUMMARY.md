---
phase: quick-261026-odd
plan: 261026-odd
subsystem: ui
tags: [preact, signals, physics-paint-studio, tool-rail, move-tool, frame-script-owner, tdd, source-pins]

# Dependency graph
requires:
  - phase: quick-261025-awl
    provides: frameScriptOwner signal, compare-then-write setter and the Raster / module-lock ownership funnel
  - phase: quick-261004-dn5
    provides: the Move rail item, the Cmd tap / held-Cmd arm and the engine-ledger gate this quick replaces
provides:
  - brushMoveAvailable computed — the ONE Move enable gate derived from frameScriptOwner
  - Activation guard in the selectTool funnel plus a force-exit effect for an already-active Move
  - Owner republish on accepted physical edits and successful Reveal rail creation
  - Retired engine-ledger strokeScriptInMemory gate and its history-listener writer
affects: [physic-paint-studio, tool-rail, roto-play-script, reveal-rail, move-tool]

# Actuals (#2632) — same chars/4 scale as the plan estimate (estimate: 26000 tokens).
actuals:
  tokens: 5860
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One derived gate: a computed over the canonical owner signal feeds the rail, the Cmd tap, the held-Cmd arm and the selectTool funnel"
    - "Exit-side law as a signal effect with identity-stable primitive deps; mutationLocked keeps it alive so a refused exit retries when the lock clears"
    - "Owner republish inside the accepted transition (and immediately after createReveal returns ok) instead of waiting for a frame navigation"

key-files:
  created: []
  modified:
    - app/src/components/shared/frameModuleLock.ts
    - app/src/components/shared/frameModuleLock.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "The Move gate derives from frameScriptOwner ('brush' or 'both'); the engine stroke count is retired as an enable source, so the gate matches the Raster button and the module lock (D-01)."
  - "Motion/Static/Reveal rails bake pixels only and carry no stroke script, so their keys are greyed and Move is refused on every activation path, not just the icon (D-02/D-03)."
  - "The activation guard sits before the no-engine / physical-lock early return in the ONE selectTool funnel so rail clicks, Cmd taps, held-Cmd and programmatic reselects cannot bypass the greyed icon."
  - "The exit-side effect writes only through selectTool and early-returns unless the active module is brush and the tool is exactly 'move'; once the tool leaves Move it returns without writing (no loop)."
  - "Accepted physical edits and successful Reveal creation republish the current key's owner in the same transition because bakes replace key identities and drop their session scripts."

patterns-established:
  - "Derived boolean gate over the canonical ownership signal rather than a second engine-ledger signal"
  - "Same-transition owner republish at every accepted key-identity-changing seam"

requirements-completed: []

coverage:
  - id: D1
    description: "Move enables only for a Brush-owned key ('brush' or 'both'); null and 'watercolor' report false"
    verification:
      - kind: unit
        ref: "app/src/components/shared/frameModuleLock.test.ts#brushMoveAvailable opens only for a Brush-owned key"
        status: pass
      - kind: unit
        ref: "app/src/components/shared/frameModuleLock.test.ts#tracks owner transitions in one effect and notifies only on a value change"
        status: pass
    human_judgment: false
  - id: D2
    description: "Move cannot be activated from any path while the current key's Brush script is empty"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts#the Studio derives the Move gate from the frame owner, never the engine ledger"
        status: pass
      - kind: manual_procedural
        ref: "native UAT rows 1-3 — Move greyed and Cmd inert on Motion/Static/Reveal baked keys"
        status: unknown
    human_judgment: true
    rationale: "Only the user's native Studio run can confirm the live activation feel (click, Cmd tap, held Cmd) on baked rails."
  - id: D3
    description: "A closed Move gate never renders the active highlight"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts#the rail highlights the move item, dispatches its selection and gates it on the key's Brush script"
        status: pass
      - kind: manual_procedural
        ref: "native UAT row 1 — no blue active highlight on a baked key"
        status: unknown
    human_judgment: true
    rationale: "The greyed-versus-blue visual is a native-rendered check."
  - id: D4
    description: "An active Move exits when the current key's script empties (bake, delete, navigation), retrying after a mutation lock clears"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
      - kind: manual_procedural
        ref: "native UAT rows 5-6 — navigation to a pixel-only key and a Play Script apply replace the key"
        status: unknown
    human_judgment: true
    rationale: "Exit behavior restores the live brush cursor and labels; only a native run confirms it."
  - id: D5
    description: "A re-created engine never resurrects Move on a scriptless key"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
    human_judgment: false
  - id: D6
    description: "Accepted physical edits and Reveal creation republish the current key's owner in the same transition"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#applies the empty-script Move law to activation and exits a stale Move"
        status: pass
      - kind: manual_procedural
        ref: "native UAT rows 6-7 — apply and raster close the gate without navigating"
        status: unknown
    human_judgment: true
    rationale: "The same-step gate closure is a live visual check."
  - id: D7
    description: "The engine-ledger gate and its history-listener writer are retired"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts#the Studio derives the Move gate from the frame owner, never the engine ledger"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-26
status: complete
commits: 2
plan_head_before: d30c84f626eac47a546497c5ad8285609c7787af
plan_head_after: a74bf8cc6a47a171f20cbcde9fc6041310f5955b
---

# Quick 261026-odd: Empty-script Move gate Summary

**Move now derives from the current key's Brush script ownership: greyed and unactivatable on Motion/Static/Reveal baked keys, and an already-active Move exits in the same transition**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-10-26T16:42:00Z
- **Completed:** 2026-10-26T16:47:00Z
- **Tasks:** 2/2
- **Files modified:** 6 (140 insertions, 49 deletions)
- **Commits:** 2 task commits (docs artifacts left uncommitted for the orchestrator)

## Accomplishments

- `frameModuleLock.ts` now exports `brushMoveAvailable`, a computed that opens only for `'brush'` (follow-up 2026-10-26: `'both'` is the unsupported mixed state and stays closed) and closes for `null`/`'watercolor'` — the ONE Move enable gate shared by the rail, the Cmd tap, the held-Cmd arm and every programmatic activation. The compare-then-write owner setter is untouched.
- `PhysicsPaintToolRail` takes `moveAvailable`, derives `moveDisabled`, and suppresses the `active` class on a blocked Move (`moveBlocked`), so a disabled Move can never render blue.
- The ONE `selectTool` funnel refuses `'move'` on a scriptless Brush key as its FIRST statement, before the no-engine / physical-lock early return, so no shortcut or programmatic reselect can bypass the greyed icon.
- A force-exit effect leaves Move through `selectTool(lastNonMoveToolRef.current, …)` when `brushMoveAvailable` closes, restoring labels and cursor; `mutationLocked` in the outer deps makes a mid-operation refusal retry when the lock clears.
- The engine re-create path branches on the gate: it re-applies Move only while open, otherwise restores the last non-Move tool in the engine and in settings — a fresh engine can never resurrect Move on a scriptless key.
- Accepted physical edits call `applyFrameModuleState(currentFrame)` as the first accepted-transition statement, and successful Reveal creation republishes `launchContextRef.current?.startFrame ?? 0` right after `createRevealRail` returns ok.
- The engine-ledger `strokeScriptInMemory` signal and its history-listener writer are gone; the listener keeps only `reconcilePaintBarriers` and `notifySourceRevision`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive the one Move gate from the frame's script owner** — `cce9a2ed` (feat)
2. **Task 2: Gate Move on the current key at every activation boundary and exit a stale Move** — `a74bf8cc` (fix)

**Plan metadata:** not committed by the executor (docs commit is the orchestrator's).

## TDD Gate Compliance

Both tasks were `tdd="true"`. RED evidence:

- **Task 1 RED:** `frameModuleLock.test.ts` — 2 failed | 8 passed; both new tests failed with `TypeError: Cannot read properties of undefined (reading 'value')` at `brushMoveAvailable.value` because the computed did not exist yet. GREEN: 10/10 pass, plus the ownership resolver suite 11/11.
- **Task 2 RED:** `PhysicsPaintStudio.test.ts` + `physicsPaintTemporaryMove.test.ts` — 6 failed | 318 passed; the updated pins failed because the Studio still carried `strokeScriptInMemory`, the rail still gated on it, and the activation/exit/republish seams did not exist. GREEN: 345/345 across the four gate suites; `pnpm --filter efx-motion-editor run typecheck` clean; full app suite `337 passed | 2 skipped` files, `6122 passed | 1 skipped | 96 todo`.

## Files Created/Modified

- `app/src/components/shared/frameModuleLock.ts` — imports `computed`; adds the documented `brushMoveAvailable` computed after `clearFrameScriptOwner()`; every existing export untouched.
- `app/src/components/shared/frameModuleLock.test.ts` — imports `brushMoveAvailable`; adds the truth-table test (null/watercolor false, brush/both true) and the value-change effect test (`[false, true, false]`).
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — `moveAvailable` prop and destructure; `const moveDisabled = !moveAvailable.value;`; `moveBlocked` suppresses `active`; `disabled={disabled || moveBlocked}`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — imports `brushMoveAvailable`; retires `strokeScriptInMemory` and its writer; gates the Cmd tap and `isMoveAvailable`; adds the selectTool guard, the force-exit effect, the two owner republishes and the gated engine re-create branch; memo passes `moveAvailable: brushMoveAvailable`.
- `app/src/components/physic-paint/view/physicsPaintTemporaryMove.test.ts` — header pins renamed; rail gate pins updated; the engine-ledger writer test replaced by the owner-derived-gate test; memo pins now `brushMoveAvailable` / `moveAvailable: brushMoveAvailable,`.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — the two `strokeScriptInMemory.peek()` pins retargeted; new activation-boundary / stale-exit / republish `it`.

## Decisions Made

- Followed the quick contract D-01..D-05 without reopening: the key's stroke-script ownership is the only truth; Motion/Static/Reveal keys are scriptless by design; the law applies to activation and exit, not only the icon; Preact signals idioms only; pnpm + `vitest run`, no dev server.
- No new owner resolver, script store, framework state, memo family or CSS change — the single `frameScriptOwner` signal and the existing `.active` / `:disabled` classes carry the entire rule.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

**Follow-up (2026-10-26, native UAT): Water color keys leaked into Brush ownership.** The first UAT pass showed Move still active on a wash-only key, with the Move overlay drawing eight invisible thin strokes.

- **Root cause:** Water color strokes are enqueued into engine-1 as invisible *guide proxies* that share the aquarelle stroke's `mutationId` (the aquarelle engine reads them; engine-1 only draws their line). Any Brush-store capture that ran while the module was not Water color — navigation, Apply settle, track switch, Move entry, or the Memory-tab read — projected those guides into the per-frame Brush store. The key then resolved `brush`/`both`: the Brush module stayed unlocked and Move opened on strokes the artist never made.
- **Fix:** `flushBrushScriptFrame` now drops guide groups (identified by the recorded aquarelle registry, live and restored ids match by construction). `restoreBrushScriptFrames` and the snapshot restore drop them from persisted rows and from the retained file content. `purgeAquarelleGuideGroups(frame)` repairs an already-captured frame, called by the owner funnel before resolution. `brushMoveAvailable` is now `owner === 'brush'` — a mixed `'both'` key stays closed.
- **Pins:** `brushScriptRecordState.test.ts` (flush drop, guide-only no-entry, restore filter, live purge) and the owner-funnel source pin in `PhysicsPaintStudio.test.ts`; `frameModuleLock.test.ts` now asserts `'both'` stays closed.

**Follow-up 2 (2026-10-26, second native pass): phantom handles on a derived rail cell.** The key at frame 6 of a Motion/Static/Reveal rail (a derived cell over a soloed/masked neighbor) still showed four phantom Move handles. The registry-based filter could not identify guides on a frame whose aquarelle script is not in the session, and Move was gated only on the owner signal, not on the cell kind.

- **Fix:** `aquarelleStrokeToPaintStroke` now stamps every Water color guide proxy with `guideProxy: true` on the engine-1 `PaintStroke`; capture, restore, purge and the Move overlay refuse it by that marker (registry match stays as the second belt). `moveAvailable` is a Studio computed combining `brushMoveAvailable` with `currentCell.kind === 'real'`, wired through the rail, Cmd tap, held-Cmd arm, `selectTool` guard, force-exit effect and engine re-create — a derived or empty cell has no Move by construction. Selecting a non-key cell drops any stale brush capture (`dropNonKeyCellBrushScript`) and releases the owner, so scripts are strictly per real key and per track, never a blend borrowed from the display.

**Follow-up 3 (2026-10-26, third native pass): restored guide rows lost their marker.** The Move overlay still listed thin "invisible" strokes on a wash key. Root cause: guide proxies could enter the store through capture seams that bypassed the flush filter (the Duplicate `captureBrushScript` path and `adoptBrushScriptFrameAsComplete`), and the binary snapshot codec never encodes `guideProxy` — every save/restore silently turned a persisted guide row into an ordinary Brush stroke. The overlay's liveness gate then found the matching engine strokes and drew handles that Move could never legitimately own.

- **Fix (single funnel):** `captureEntry` now filters guide groups for EVERY store write (flush, adopt, restore, remap); an empty or guide-only capture stores no entry. `adoptBrushScriptFrameAsComplete` normalizes through `normalizeBrushScriptGroups`, so Duplicate from a mixed ledger never carries guides.
- **Fix (persistence):** `prepareSave` runs `withoutAquarelleGuideFrames` over the merged content before encoding, so a guide row can never be written into a snapshot again, including rows retained from an older file.
- **Fix (Duplicate):** the Studio's `captureBrushScript` uses `normalizeBrushScriptGroups(engine.getStrokes())` — guide proxies are render input and must never be applied as a visible Brush script on the destination.
- **Diagnostic (DEV ONLY):** `performance/moveProvenanceCapture.ts` writes `/tmp/efx-move-provenance.json` on Move entry and on `window.__EFX_MOVE_PROVENANCE__()`. Each listed group reports `guideProxy`, `classifiedGuide`, the aquarelle `registryMatch`, engine presence/serial, plus frame, cell kind, owner, module, tool, moveAvailable, snapshot track vs active track, every store frame's guide/real counts, and the aquarelle events of the frame. `build` names the diagnostic revision (`quick-261026-odd-diag-1`).
- **Pins:** `brushScriptRecordState.test.ts` (single-funnel guide-only capture stores nothing; adopt refuses a guide-only ledger), `brushScriptHydration.test.ts` (an empty capture refuses with `no-entry`).

**Follow-up 4 (2026-10-26, fourth native pass): the snapshot restored a replaced key's script by frame.** The probe proved the frame-12 handles were eight ordinary engine-1 brush strokes (colors/sizes, `guideProxy: false`, no aquarelle registry match) restored as a COMPLETE Paint-4 frame-12 script and hydrated into the engine. Mechanism: in-session scripts follow the physical KEY identity (`remapBrushScriptsForRecords` drops a replaced key's entry), but the snapshot persisted brush frames by FRAME NUMBER only. A Motion/Static/Reveal bake that replaced the key at frame 12 dropped the session entry while the retained file row survived (the retained-union undo design), and the next restore re-seeded that row onto whatever real key now occupied frame 12. The rail key is pixel-only, so its "script" was phantom content.

- **Fix (format v2):** `StudioScriptSnapshotBrushFrame` carries the owning `keyId`. The codec encodes it in brush v2 and still decodes v1 (rows decode as unknown identity). Live captures stamp the key through `configureBrushScriptKeyProvider` (bound snapshot identity: layer + track); restores seed the DECODED identity and never bless a row with the current key's id.
- **Fix (restore/save law):** `withoutForeignKeyFrames` drops a v2 row whose `keyId` differs from the live key at its frame, drops a legacy (keyId-less) row on a Play Script / Reveal rail frame (`getPixelOnlyFrames`), and keeps a row whose frame has no live key (retained-union undo preservation). The same filter runs on restore and on the merged content before encode, so the stale row is cleaned from the file on the next save.
- **Fix (Reveal creation):** a successful Reveal bake purges both stores across its baked span — those keys were just replaced with pixel-only content.
- **Diagnostic:** the report now carries `cellKeyId`, `cellInsideRail`, `store.keyId`, and per store frame `keyId`/`liveKeyId`/`pixelOnly`.
- **Pins:** codec v2 round-trip + v1 compatibility; controller v2 key-mismatch drop, legacy rail-frame drop and legacy ordinary-key keep; store key-provider stamping and decoded-identity restore.

**Follow-up 5 (2026-10-26, fifth native pass): a rail frame resolves as a REAL key.** The remaining phantoms sat on rail-owned frames: the physical cell projection resolves a real key BEFORE Loop Clip ranges (D-26), and a rail bakes INTO key records, so `currentCell.kind === 'real'` was true on every baked key and the cell-kind gate never saw the rail. The replaced key's retained script therefore kept `frameScriptOwner = 'brush'` and Move opened with phantom handles; a move then rebaked from that phantom script and erased the baked pixels.

- **Fix (Move gate):** `moveAvailable` now also requires the current frame to lie OUTSIDE every Loop Clip range (Play Script / Motion / Static / Reveal), via the pure `isRotoLoopRailFrame(ranges, frame)` in `view/frameScriptOwnership.ts`, reading the timeline model's `loopResolutionContext`.
- **Fix (owner funnel):** `applyFrameModuleState` treats rail frames as pixel-only by law: it purges the frame's retained brush script (`purgeBrushScriptFrame`, so a frame-leave flush and a later hydration both refuse it) and never publishes an owner. The frame-change effect purges on arrival to a rail frame too.
- **Diagnostic:** every owner resolve now writes `/tmp/efx-move-provenance.json` in DEV (no Move click needed); build stamp is `quick-261026-odd-diag-3-rail`.
- **Pins:** `frameScriptOwnership.test.ts` rail-interval boundaries (inclusive start, half-open end, gaps, no ranges); the two Studio source pins updated to the new gate and funnel shapes.
- **Test evidence:** full `vitest run` green and `tsc --noEmit` clean.

**Follow-up 6 (2026-10-26, sixth native pass): Follow-up 5 was the wrong law; the remaining handles are Water color.** The diag-3 report for the reported frame reads `cellInsideRail: true`, `moveAvailable: false`, `owner: 'watercolor'`, `module: 'watercolor'`, `store.hasEntry: false`, `engine.strokeCount: 0`, and `aquarelle.hasScript: true` with exactly 4 events at `playFrame: 6` (mutationIds 36/37/93/106; colors #1469e8, #6aa6df, #103c65, #e64474). The four labelled handle boxes are therefore the **Water color selection overlay** over recorded aquarelle strokes — not Brush Move handles. The visible render shows only the pink wash (#e64474); the other three recorded strokes paint nothing visible.

- **Reverted (Follow-up 5):** rail membership must NOT refuse Move and must NOT purge scripts — the user needs to paint on rail frames again ("NO it can't refuse… I need to paint again on them"). The `isRotoLoopRailFrame` gate, the rail purge, and the rail owner refusal were removed. The key-identity Move guard (a retained script stamped for a different key) stays.
- **Measured cause (open):** `AquarelleCanvasLayer` wipes the sheet on every frame change and does NOT replay the recorded timeline on arrival; the frame's render comes from the baked pixel cache, while the selection handles come from the restored aquarelle registry. A cache that predates later strokes therefore shows handles with no paint.
- **Diagnostic extension:** the provenance report now records each aquarelle event's document-UV `boundsUv`, `load`, `water`, `brushId`, `points`, `paramsSize`, `playFrame` — separating off-canvas strokes from not-replayed strokes from foreign (remapped) strokes.
**Follow-up 7 (2026-10-26, final pass): purge at the bake, keep rails paintable.** User decision: rails must stay editable ("if I need to paint again on them"), so rail membership must never be a gate; the phantom handles are scripts left over from before the rail bake replaced the pixels.

- Decoded the project snapshot from disk (`test.mce/scripts/<layer>/<track>-v1.snap`): frame 6 holds four real Water color strokes, all on-canvas (UV bounds 0.09–0.90), while the render is the rail's content (the visible pink C matches frame 0's size-182 stroke, not any frame-6 stroke). The handles were truthful; the render was rail-owned — a script/render mismatch, not strokes leaking between keys.
- **Fix (bake purge):** an accepted `play-script` edit (Play Script / Motion / Static) purges both script stores across `affectedStart..affectedEnd`; Reveal creation purges its baked span. `loopOnly` edits are exempt.
- **Fix (durability):** the same frames are dropped from the snapshot's retained union (`dropRetainedForFrames`) so a routine save / later restore cannot re-seed the purged scripts. A new script painted on a rail frame afterwards is real content and is never touched.
- **Fix (one-time migration):** pre-fix projects are cleaned at launch from the CARRIED document's rail spans, once per project/layer/track (localStorage marker; unknown physical state defers to the next launch rather than marking clean).
- **Pins:** `railScriptCleanup.test.ts` (finite/infinity/capacity spans, unknown document, per-track marker, unreadable storage = done); controller `dropRetainedForFrames` union test; Studio source pins for the bake, Reveal and migration purges.
- **Test evidence:** full `vitest run` green (338 files, 6142 passed, 2 skipped) and `tsc --noEmit` clean.

**Follow-up 8 (2026-10-26, post-cleanup): override scripts are content; purge retired.** The durable cleanup ran and deleted the Paint-4 scripts on frames 6–15 — including the frame-override scripts at 11 and 15, which the user reported as real content. Disk evidence: the loop clip carries `frameOverrides` at 11 and 15 (post-bake edits), while the migration treated the raw span 6–15 as generated. The frame-15 script is **unrecoverable**: the applied script library row holds only the four frame-4 source strokes, and no pre-cleanup snapshot copy exists. Its baked WebP pixels are intact.

- **Purge retired:** removed the launch migration, the store-authoritative retry, the accepted Play Script / Motion / Static bake purge, the Reveal creation purge, the `railScriptCleanup` module and its test, and every retained-union drop. No automatic mass deletion remains; manual Clear/Delete are unchanged.
- **Script/render split — REVERTED after native UAT:** retargeting the Apply/move publish to the displayed override key made the stroke-only re-bake overwrite the rail's cached paint and erase it. The publish is back to `frame.keyId` (the edit is refused rather than destructive). The proper fix must COMPOSITE the re-baked script layer over the frame's pixel-only base, not swap the publish target.
- **NO MOVE/EDIT enforced frame-scoped:** Water color's Select toggle, Cmd tap/held-Cmd and the auto-disarm now read `watercolorMoveAvailable = currentCell.kind === 'real' && hasAquarelleScriptForFrame(currentCell.appFrame)` instead of the session-wide `aquarelleLiveStrokeCount`. Painting the first stroke creates the script and re-enables Select; navigating to a scriptless key disarms it. Brush Move keeps the owner + cell-kind + key-identity gate.
- **Pins:** Studio pins now require the displayed-key publish and the frame-scoped Water color gate, and contain inverted `not.toContain` guards for the retired purge paths. `railScriptCleanup.test.ts` deleted with its module.
- **Test evidence:** full `vitest run` green (337 files, 6138 passed, 1 skipped) and `tsc --noEmit` clean.
- **UAT outcome:** the no-script gate passed its structural checks (frame 6's report shows `hasAquarelleScriptForFrame` true only for the newly painted script; `overlayArmed.heldArm` true). The render fix FAILED native UAT: painting on a cached rail frame records the script without a visible render, and selecting/moving that stroke replaced the cached paint with the stroke-only bake. That regression is reverted; the remaining render/merge defect requires a debug session (script layer must composite over the pixel-only base).

## User Setup Required

None — no external service configuration or dependency was added.

## Native UAT (user-driven — executor never started the dev server)

**Status: pending** — reopen the Studio so the frame-scoped gate and displayed-key publish load. The app writes `/tmp/efx-build-check.json` at engine-ready and `/tmp/efx-move-provenance.json` on every owner resolve; both must read `quick-261026-odd-diag-6-render-target` before any result is trusted. The report names `cellInsideRail`, `cellKeyId`, and each group's engine/store/registry provenance.

| # | Action | Expected | Status |
|---|--------|----------|--------|
| 1 | Create a rail with Motion from Play Script, then select one of its baked keys | The Move icon is greyed; clicking it does nothing; no blue active highlight appears | pending |
| 2 | Create a rail with Static, select a baked key, press Cmd | Cmd is inert: the tool does not enter Move, and holding Cmd does not arm the Move overlay | pending |
| 3 | Create a rail with Reveal, select a baked key | Move is greyed on every baked key of the rail; Reveal playback itself is unchanged | pending |
| 4 | Paint a real Brush key, then click Move and press Cmd | Move is enabled and both entries work exactly as today (select, drag, handles) | pending |
| 5 | From Move on that scripted key, navigate to a pixel-only baked key | The tool exits Move to the previous Paint (or Erase) tool; labels and the brush cursor are restored | pending |
| 6 | From Move on a scripted key, run a Play Script Motion/Static apply that replaces the key | On the accepted edit the tool leaves Move without needing a frame navigation | pending |
| 7 | Raster a scripted key from the timeline header | After the raster, Move is greyed on that key in the same step | pending |
| 8 | Water color mode on an aquarelle key | The Water color rail's Select toggle behaves exactly as before; the Brush Move gate does not alter it | pending |
| 9 | Select a Water color key whose wash is visible and whose key was previously visited (the reported repro) | Move is greyed, the Brush module slot is locked, and the Move overlay shows no invisible guide strokes | pending |
| 10 | Open the Memory tab on that Water color key | The per-frame Brush row stays empty; only the Water color row lists the wash strokes | pending |
| 11 | Select a derived Motion/Static/Reveal rail cell with a soloed/masked neighbor track under it | Move is greyed, no phantom handles render, and the cell stays non-editable as a script | pending |
| 12 | Switch between a scripted real key on one track and a cell on another, toggling solo/hide | Handles appear only on the active real key; no script crosses keys or tracks | pending |
| 13 | On a key with no Water color script, click the rail Select toggle and press Cmd | Select is greyed and Cmd is inert; painting a stroke then re-enables Select; deleting the last stroke disarms it | pending |
| 14 | On a Loop/Group frame with a frame override, paint a Water color stroke, then Select-move it | The moved wash re-renders on the canvas; no guides remain over the old paint (the reported phantom) | pending |

## Known Stubs

None — no stub, placeholder, skipped test, or unrun `<verify>` was left behind.

## Threat Flags

None — no new security-relevant surface beyond the plan's `<threat_model>`. The four STRIDE mitigations (owner-derived gate, selectTool activation guard, non-looping force-exit effect, active-highlight suppression) are implemented and source-pinned; no package was added.

## Next Phase Readiness

- Automated work is complete and typechecked; the law is ready for the user's native live UAT rows above.
- No blocker: playback and mid-drag scrubs still do not republish the owner by design (accepted scope); the gate follows explicit selection and the accepted-edit / Reveal seams.

---

## Self-Check: PASSED

- All 6 modified source/test files exist on disk.
- Both task commits are ancestors of HEAD (`cce9a2ed`, `a74bf8cc`).
- Working tree contains only the untracked quick task directory; no docs artifact was committed.

---

*Quick: 261026-odd*
*Completed: 2026-10-26*
