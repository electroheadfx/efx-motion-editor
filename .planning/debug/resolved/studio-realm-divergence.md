---
status: resolved
trigger: |
  Follow-up to studio-blend-off-corruption (fix 8c324cb8, carrier-total payload equality — verified working, frame blending on/off now functions).

  User live retest 2026-10-05:
  - Frame blending on/off WORKS now (carrier-total fix confirmed).
  - Remaining failures:
    1. Delete (intermittent): "Group lifecycle physical document became stale before proposal staging."
       (logDiagnostic PhysicsPaintStudio.tsx:1197 → useRotoPhysicalEditCoordinator.ts:1114)
    2. Can't move from Track 1 to other tracks: "Roto physical edit failed (settlement-mismatch): Ignored mismatched physics paint physical edit result. Try the action again."
       (useRotoPhysicalEditCoordinator.ts:810 / :824 → consumeBridgeApplyResult PhysicsPaintStudio.tsx:2295 / :558 → usePhysicsPaintApplyResultController.ts:83 → usePhysicsPaintParentBridge.ts:298)
    3. Can't insert key in track 'Paint 2': "Roto physical edit result mismatch: Ignored mismatched physics paint physical edit result. Try the action again."
       (useRotoPhysicalEditCoordinator.ts:823 → same consumeBridgeApplyResult chain)
    4. Deleted all tracks and added one on Track 1 → can't switch on/off frame blending again.
  - User scoping: "its complex, mais restart make working back" — it's complex, but restart restores function.
    "delete fisrt time then after problemes happens (and more delete possible), when I restart app the delete work back one time until I restart" — delete works the first time after a restart, then problems appear; a restart restores one more working delete.
  - Verdict: "So it not perfect yet."
created: 2026-10-05
updated: 2026-10-05
resolved: 2026-10-05
resolution: |
  UAT APPROVED 2026-10-05 — the multi-track cluster is closed.

  Shipped across this session (all in `d35a8b4f`, `07688d1a`, and the closing commit):
  1. Carrier/revision non-invariance: the mirror reconstructs byte-shaped records
     (layer-wide digest map) and the wire content revision is the only change detector.
  2. Active-lane display clocks: the track-identity memos key on the live active-track
     id AND on `rotoPhysicalRevision` (the structural clock), so a track switch or a
     move/cut/paste repaints immediately instead of sitting in the 1s stroke throttle
     ("phantom keys" / "keys duplicated onto the destination" windows).
  3. Cached-frame reseed: `latestRotoFramesRef` reseeds on structural revision changes,
     not only on active-track switches — the stale frames were painting as green
     phantom cells beside just-landed keys.
  4. Cross-track drag semantics: a single-key grab COPIES (source rail intact), a
     whole-rail grab MOVES, and a same-track slide re-times. The copy half is narrowed
     to exactly the grabbed keys (the rail-atomic builder no longer drags the whole
     segment along), so copy and delete stay coherent.
  5. Row-grab: rails and keys on non-active rows are grabbable without activating the
     source track first; the drop destination auto-activates and the post-drag click is
     swallowed so it cannot flip the active track back.

  Gates at close: `tsc` clean (3 pre-existing `view/` baseline errors untouched);
  `vitest run` 4429 pass / 1 skipped / 101 todo, 1 pre-existing failed collect
  (`PhysicsPaintStudioView.test.ts` — `_setPaintMarkDirtyCallback`, baseline).
  Capture instrumentation (`physicalEditCapture.ts` + probes) removed at close.

goal: find_and_fix
---

# Debug Session: studio-realm-divergence

DATA_START

## Symptoms

### Expected behavior
After a restart, every physical edit keeps working for the whole session: delete key/rail, cross-track move, insert key, blend toggle — on the base track and on Studio-added tracks.

### Actual behavior
Frame blending on/off works now (fixed). But the session degrades: the first op(s) after restart work, then physical edits start failing until the app is restarted again. Four observed faces:

1. **Delete (intermittent):** `Group lifecycle physical document became stale before proposal staging.`
   `logDiagnostic (PhysicsPaintStudio.tsx:1197)` → `(anonymous function) (useRotoPhysicalEditCoordinator.ts:1114)`
2. **Cross-track move (Track 1 → other) fails:** `Roto physical edit failed (settlement-mismatch): Ignored mismatched physics paint physical edit result. Try the action again.`
   `useRotoPhysicalEditCoordinator.ts:810` → `:824` → `consumeBridgeApplyResult (PhysicsPaintStudio.tsx:2295)` → `consumeBridgeApplyResult (PhysicsPaintStudio.tsx:558)` → `usePhysicsPaintApplyResultController.ts:83` → `usePhysicsPaintParentBridge.ts:298`
3. **Insert key on 'Paint 2' fails:** `Roto physical edit result mismatch: Ignored mismatched physics paint physical edit result. Try the action again.`
   `useRotoPhysicalEditCoordinator.ts:823` → same `consumeBridgeApplyResult` chain
4. **Track churn regression:** delete every track, then add one → blend toggle on/off is dead again.

### User scoping (2026-10-05)
- "its complex, mais restart make working back" — the failure sequence is complex, but **restart restores function**.
- "delete fisrt time then after problemes happens (and more delete possible), when I restart app the delete work back one time until I restart" — delete works **once** after a restart, then breaks; a restart buys one more working delete.

### Interpretation
**Accumulating in-memory divergence.** Not persisted-document corruption (restart heals). Not four independent bugs (restart resets all of them together). One session-local state divergence that, once present, makes every later physical edit's child/parent settlement or record validation fail.

## Leading hypothesis (NOT prescriptive)
Child and parent physical realms diverge during the session. Once diverged, the child's in-flight request no longer correlates with the parent's result → `settlement-mismatch` / `result mismatch` (`Ignored mismatched physics paint physical edit result`) — and the child-side doc-vs-ports barrier reports `Group lifecycle physical document became stale before proposal staging.`

Prime suspect (carried from prior cycles, still unfixed): **cross-track move bypasses the coordinator** via `physicPaintStore.moveTrackItems`, called directly from `PhysicsPaintWorkflowStrip.tsx`. That path never goes through the coordinator's flush/staging/lease protocol, so it can mutate one realm only. The user's row 2 ("can't move from Track 1 to other tracks") is exactly that path — but note it now FAILS rather than silently diverging, so the bypass may be failing loudly and leaving the realms split.

Second suspect: **track lifecycle churn** (row 4 — delete all tracks, add one). Deleting tracks may leave lease/revision/identity state pointing at dead track ids, which then breaks the next track's blend toggle.

Third suspect: the settlement/result correlation itself (lines 810/823/824) may drop or mis-pair results after any rejected op, leaving a stale in-flight slot that every later op trips over.

## Prior fixes (landed and verified — do NOT revisit)
- `f3b08c78` — payload rebuilds preserve the raster carrier (`bytes` vs `media` projection). Move now works.
- `8c324cb8` — coordinator payload equality is carrier-total (`payloadContentEqual` via `buildPhysicPaintRotoPayloadContentToken`, 5 sites). Blend toggle works.
- Do not change the revision encoder, the transport, or the record-collection types.

## Instrumentation (uncommitted, intentional — extend, do not replace)
`app/src/lib/physicalEditCapture.ts` writes `/tmp/efx-physical-edit-studio.json` (child) and `/tmp/efx-physical-edit-main.json` (parent). Probe points already exist in `useRotoPhysicalEditCoordinator.ts` (execute guards, barriers, payload-send with child revision components), `PhysicsPaintStudio.tsx` (status ports, track CRUD, blend-toggle-click), `useRotoFramePersistenceCoordinator.ts` (live-pixel-delivery-dropped / live-pixel-local-skip), `physicPaintBridge.ts` (apply-received / apply-reject / apply-accepted / parent-revision-state).

## Guardrails (hard constraints)
- User runs the live app. Tauri/cross-webview: **live or on-disk evidence is the verdict; unit probes are not admissible.**
- Reuse the existing physical-edit coordinator and record-collection types. **No new transport.**
- **Fix live first, regression tests after.**
- **ONE root cause, ONE fix.** User retests.
- The `Group lifecycle physical document became stale before proposal staging.` log can fire on success too — correlate with actual user-visible behavior, not log presence.

DATA_END

## Findings (2026-10-05 cycle — in-session investigation)

### Live evidence captured (user's latest run, 10:44 local)
- Op 1 `delete-rails` on track `6b10fd18`: payload-send `expectedRevision physical-757-2e8b7e90` → parent `apply-accepted` `physical-371-1132b5e`. WORKED.
- Op 2 `delete-rails` ~5.5s later, activeTrack now `46d6f9dd`: `stale-doc-barrier` with **cursorMismatch as the ONLY failing comparison** — `docCursor 0` vs `signalCursor 2`; all other sub-checks matched (capacity/docRevision/records/interpolation/selectedKey). Concise: "Roto physical edit barriers failed. No state was changed." → this is row 1, live-confirmed.

### Code mapping (current file line numbers; user's stack was from an older build)
- Barrier: `useRotoPhysicalEditCoordinator.ts` ~1831-1865 — group-lifecycle ops require `currentDocument.cursorAppFrame === currentAppFrameForEdit` (probe at :1842).
- `currentAppFrame` = `ports.selection.getCurrentAppFrame()` = `launchContext?.startFrame ?? 0` (`PhysicsPaintStudio.tsx:755`).
- `currentDocument` = active track's physical doc: `getDocument: (layerId) => physicPaintStore.getRotoPhysicalDocument(layerId, studioActiveTrackId())` (`PhysicsPaintStudio.tsx:1468`).
- So op 2 failed because the active track's doc cursor (0) and the launch startFrame (2) had diverged after the track switch.

### Leading mechanism (child-internal, not a parent/child realm split)
Two cursor authorities with a single, skippable sync point:
1. The track-switch effect (`PhysicsPaintStudio.tsx` ~2617-2735) is the ONLY place the new track's doc cursor is reseeded to `currentFrame` — and it is **skipped when `crossTrackSelectionPendingRef` is armed** (line ~2703).
2. That ref is armed (`= true`) by EVERY frame-cell/rail click (`handleSelectTrackFrame` :3321 / `handleSelectTrackRail` :3337) — **including same-track clicks** — but it is only consumed by a *display-state-changing* run of the switch effect. A same-track selection click (e.g., selecting the key you are about to delete) arms it and it stays armed indefinitely.
3. The next track switch reached via the row-header route (`onSelectTrack`, which does not write selection) then consumes the stale ref and **skips the reseed** → new track's doc cursor stays at its stale value (0) while startFrame stays 2 → every group-lifecycle op (delete/paste/group paint) fails at the barrier until restart (restart re-hydrates startFrame from the active track's cursor). This matches "delete works once after restart, then problems; restart restores one more".
4. Secondary divergence path (same shape): `navigateToSyncedPhysicalFrame` writes the doc cursor to the target frame SYNCHRONOUSLY (:2530-2533) but the startFrame propagation (:2587) sits after `await flushPromise` — a flush failure, generation supersession, or a `beforeNavigation` failure aborts with the two cursors split.

### Rows 2/3 (settlement-mismatch) — not yet field-captured
`transitionPhysicalEditResult` was one opaque guard; a mismatch only logged "Ignored mismatched…" without saying which of the ~17 correlated fields differed. The user's `moveTrackItems` bypass (`PhysicsPaintWorkflowStrip.tsx:2474`, direct store call, still unfixed) remains a candidate parent for rows 2/3, but no capture from a failing move/insert run exists yet.

### Instrumentation extended (uncommitted, additive — existing probes untouched)
New capture types: `track-click` (route: frame-cell / rail / row-header + refArmedBefore), `track-switch-effect` (refArmed + docCursor vs currentFrame at switch commit), `track-reseed-applied`, `track-reseed-skipped`, `startframe-landed` (docCursorBefore vs incoming startFrame), `nav-aborted` (reason: flush-failed / superseded / before-navigation), `result-mismatch` (failedFields[] + paired pending/detail values), `track-deleted` / `track-delete-failed` (activeAfter, remaining track ids, docCursorAfter).
Verification: `npx tsc --noEmit` → only the 3 pre-existing tool-rail errors (untouched files); `npx vitest run` on coordinator + Studio suites → 236/236 pass.

## Findings (2026-10-05 round 2 — live capture re-read after user repro)

### The armed-ref skip is REFUTED for this failure
`/tmp/efx-physical-edit-studio.json` (09:07 UTC) holds exactly 2 events: `track-switch-effect` (`refArmed: false`, `currentFrame 0`, `docCursor 0`) then `track-reseed-applied` (`currentFrame 0`, `selectedKeyId null`). The reseed RAN and the cursors matched — yet delete still failed. So `crossTrackSelectionPendingRef` skipping the reseed is not this failure's cause.

### The split is deterministic, not a race
User's round-2 scoping: **delete rail/key works ONLY on Track 1 (base); every Paint n track fails, always** with `Group lifecycle physical document became stale before proposal staging.` A deterministic track-identity split is a routing bug, not a timing bug.

### Parent capture shows Paint n's selection state was never written
`/tmp/efx-physical-edit-main.json` `parent-revision-state` for Paint n (`c428c5c7`) at its first accepted `paste-key`: `docRevision: null`, `cursorAppFrame: null`, `selectedKeyId: null`. Track 1 (`46d6f9dd`) in the same capture has `docRevision: physical-1413-16cbceaa`, `cursorAppFrame: 0` then `18`. Paint n's document selection/cursor stayed at its uninitialized default while Track 1's was maintained.

### ROOT CAUSE (code + capture agree) — selection writes target the frozen launch track
`trackIdOfLaunch(lc)` = `lc.document.activeTrackId` (`PhysicsPaintStudio.tsx:471`) — the **launch snapshot's** active track. The file's own routing invariant says the snapshot is fallback-only:

> "the routing authority follows the DOCUMENT's current active track … The launch snapshot is only the fallback for legacy parsing tolerance." (`PhysicsPaintStudio.tsx:472-476`)

Six `setRotoPhysicalSelection` writes still passed `trackIdOfLaunch(launchContext)` as the trackId:

| Site | Was | Should be |
|---|---|---|
| `selectAllRotoKeys` (:784) | `trackIdOfLaunch(launchContext)` | `studioActiveTrackId()` |
| `handleSelectRotoKeyRail` modifier (:2236) | `trackIdOfLaunch(launchContext)` | `studioActiveTrackId()` |
| `handleSelectRotoKeyRail` plain (:2254) | `trackIdOfLaunch(launchContext)` | `studioActiveTrackId()` |
| `handleSelectRotoLoopClip` modifier (:2305) | `trackIdOfLaunch(launchContext)` | `studioActiveTrackId()` |
| `handleSelectRotoLoopClip` plain (:2347) | `trackIdOfLaunch(launchContext)` | `studioActiveTrackId()` |
| `handleSelectTrackRail` loop branch (:3427) | `trackIdOfLaunch(launchContext)` | `trackId` (the clicked row) |

Model site (already correct): `handleSelectTrackFrame:3396` passes the clicked `trackId`.

**Why Paint n fails and Track 1 works:** on Track 1 `trackIdOfLaunch` *is* Track 1, so the write lands. On Paint n the write lands on Track 1 (the launch track) and Paint n's store selection/cursor stay at whatever the switch reseed left — so at the next delete the stale-doc barrier's `currentDocument.selectedKeyId !== currentSelectedKeyIdForEdit` / `cursorAppFrame !== currentAppFrameForEdit` (`useRotoPhysicalEditCoordinator.ts:1864-1871`) sees store-vs-signal divergence on the Paint n document and rejects: `Group lifecycle physical document became stale before proposal staging.`

Note the barrier reads `getDocument(layerId)` scoped by `studioActiveTrackId()` (the LIVE active track) but compared it against a signal whose store writes were landing on the launch track — the two sides of the comparison were reading/writing different tracks.

### Fix (ONE change, user-approved 2026-10-05)
Retarget all six `setRotoPhysicalSelection` writes to the live active track (5× `studioActiveTrackId()`, 1× the clicked `trackId` in `handleSelectTrackRail`). No transport, no revision encoder, no record-collection type changes. Remaining `trackIdOfLaunch(launchContext)` uses are READS (interpolation settings :1077-1078, render source :3223, capacity :4827, frames ref init :536) — out of scope for this one fix.

### Regression test
`PhysicsPaintStudio.test.ts` had 2 source-contract tests pinning the DEFECT (`expect(...).toContain('setRotoPhysicalSelection(... trackIdOfLaunch(launchContext) ...')` in `handleSelectRotoLoopClip` and `selectAllRotoKeys`). Both now pin the fix (`studioActiveTrackId()`) and one asserts `not.toContain` the launch-track write.

Verification: `tsc --noEmit` clean (3 pre-existing `view/` errors only); `vitest run` coordinator + Studio suites → 236/236 pass.

## Findings (2026-10-05 round 3 — cross-track move poisons the session)

### Live symptom (user report after fix 1 landed)
"all worked, except when I tried to move/drag rail/key from a track to another: it kill next others operations. I need to restart studio."

### Root cause
`PhysicsPaintWorkflowStrip.tsx:2473` committed the move with a **direct `physicPaintStore.moveTrackItems` call** — the one mutation in the Studio that never ships through `applyPayload`. Capture confirmed the bypass signature: the drag left **zero** capture events, then `track-click row-header` (`onSelectTrack(toTrackId)`), then the next `paste-key` failed in `expandRotoPhysicalEditRecordRefs` ("no longer matches the parent document content") → `detailStagedRevision: invalid-physical-revision` → `transitionPhysicalEditResult` `failedFields: ['stagedRevision']`. Poison scoped to the touched track (Track 1 kept working); restart heals because both realms re-hydrate.

The 52.1 design comment names this exact contract: "the push fires ONLY on document-structure changes (`efxPaintVersion`). Physical edits (drag/paint) are excluded — they ship their result via the applyPayload bridge." `moveTrackItems` bumps `physicPaintStore.rotoPhysicalRevision`, never `efxPaintVersion`, so no document sync fired and the parent stayed pre-move.

### Why the approved "paste + delete-rails" decomposition was NOT used
User-approved plan was to re-route the move through the coordinator as `paste` + `delete-rails`. Two hard gaps made that a behaviour change, not a sync fix (surfaced to the user, who chose the alternative):

| `moveTrackItems` delete half (`_applyRotoTrackSelectionRemoval`) | `delete-rails` |
|---|---|
| exact key set + carried loops | whole key-rail segments only |
| any loop clip | **lifecycle Groups only** (`isLifecycleGroup`) |
| filter-only, no reselect | break-normalize + successor reselect |

So `delete-rails` cannot delete a plain Hold at all (the coordinator has no op that can), and moving one key of a multi-key rail would move the whole rail. Also `physicPaintBridge.ts:1600` recomputed `paste` without `targetTrackId`, so a cross-track Hold would mismatch the child's proposal.

### Fix landed (route B — user chose it)
`moveTrackItems` semantics are **byte-identical** (store method untouched). Three edits:

1. **`PhysicsPaintWorkflowStrip.tsx`** — `moveTrackItems` seam is now async; on success it calls `onSelectTrack(toTrackId)` then `await props.publishDocumentSync?.()` before resolving. New prop `publishDocumentSync?: () => Promise<void>`.
2. **`PhysicsPaintStudio.tsx`** — wires `publishDocumentSync: async () => { documentSyncDirty.value = true; await flushDocumentSyncRef.current(); }` into the `workflow` bundle (forces the serialize+push immediately instead of the 2s/idle debounce). `serializeRuntimeIntoDocument` already derives `track.rotoPhysical` from `physicPaintStore` (`efxPaintStore.ts:1491`), and the push guard keys on the content fingerprint, so the post-move document always goes out.
3. **`physicPaintBridge.ts`** — `applyPhysicPaintRotoPhysicalMap` now opens with `await awaitPendingPhysicPaintRuntimeMirror()` (it was exported and **never called**). This closes the race: the parent's mirror install is async and unacked, so a physical edit arriving right after a move validated against pre-move records. With the await, the queued mirror lands first. Cheap when nothing is pending.

The parent mirror is the designed channel — `mirrorRotoPhysicalDocument`'s own doc: "the parent's runtime is a passive mirror used by the save projection and the apply validation."

### Regression test
`PhysicsPaintWorkflowStrip.test.ts` — updated 2 source-contract pins to the async seam and added "ships the two moved tracks to the main window before the gesture resolves" pinning `publishDocumentSync` + the `await`. `usePhysicsPaintCrossTrackDrag.test.ts` — the `moveTrackItems` mock is async; 2 tests await one microtask (the outcome now settles after the ship step).

Verification: `tsc --noEmit` clean (3 pre-existing `view/` errors only); `vitest run` → 4429 passed, 1 pre-existing failing suite (`PhysicsPaintStudioView.test.ts`, `_setPaintMarkDirtyCallback is not a function`).

### Still open
- Regression test for the parent-side `awaitPendingPhysicPaintRuntimeMirror()` (deferred to post-UAT per "fix live first, regression tests after").
- Track-churn regression (delete all tracks + add one → blend toggle dead).
- The `copyTrackSelection`/`_applyRotoTrackSelectionRemoval` asymmetry (copy takes whole segments, delete removes the exact key set) is a pre-existing latent duplication in `moveTrackItems`; untouched here.

## Findings (2026-10-05 round 4 — paste timeout cluster, measured)

User retested rounds 2+3: the move works ("Work for some times"), then a new cluster appears. Both capture files on disk (`/tmp/efx-physical-edit-{studio,main}.json`) were read and correlated by `operationId` + ISO timestamp. **Measured facts, not theory:**

| quantity | value |
|---|---|
| parent `apply-received` after child `payload-send` | **+8 ms** (transport is fine) |
| parent `apply-accepted` after `apply-received` | **+3–4 ms** (the apply is fine) |
| child settle | **timeout at exactly 5000 ms**, 9/9 `paste` ops |
| `paste` operationId seen by parent | same id, 9/9 |
| `result-mismatch` `failedFields` | `['stagedRevision']`, `detStg='invalid-physical-revision'`, `detOk=false`, `detAcc=null` |
| real frame sizes (`recordSummaries.bytesLen`) | **10 892 / 12 434 / 15 330 bytes** |

Three defects, and one refutation:

1. **REFUTED — the payload-size theory.** The settlement used to echo `loopClips` (byte carriers), but at 10–15 KB frames that echo was ~34 KB per paste. Not a 5 s payload. The `loopClips` strip is kept because it is a real contract defect at HD scale (~10 MB frames), **not** because it explains these timeouts.
2. **Root cause (round 4) — a throw inside `finalizeAccepted` latches the pending slot.** `finalizeAccepted` calls `reference.reconcileCurrentFrame` for exactly the kinds `undo/redo/play-script/regenerate-group/insert-empty-segment/paste-key/paint-group-frame/delete-group-frame/delete-group/delete-rails/paste`. `move-key-rail` and `delete-key` are NOT in that list — and those are precisely the ops that settled fine. `reconcileCurrentFrame` → `getFrameBlobUrl(intendedFrame.bytes)` → `buildFrameBytesToken` → `bytes.subarray` on `undefined` (a frame whose byte carrier never materialized). The throw escapes `finalizeAccepted`, so `clearPendingOnce()` never runs, the global slot stays latched, and the 5 s timer then reports a **phantom** "timed out". Matches the user's `bytes.subarray` stack and the `paste`-only timeouts exactly.
3. **`invalid-physical-revision` is a fallback sentinel**, `physicPaintBridge.ts` `physicalEditResult`, thrown when the parent's revision recompute throws and the op already failed (`ok:false`, no `acceptedRevision`). The 4 late `result-mismatch` rows are that aftermath, not an independent root cause.
4. **The failure copy asserts a rollback that never runs.** `finalizeFailed` restores only when `restoreDeferred: true`, which **no caller passes**; `RotoPhysicalEditFailureOutput.restored` is documented LOG-only. So "The previous state was restored." on timeout/mismatch sent the user back to edit against a parent that had already committed.

### Fix landed — commit `373f182b`, two NAMED natures

- **nature (a) contract** — (i) the settlement return leg is a correlation contract, not a document channel: `loopClips` echo removed from the result, the type, and `isPhysicPaintRotoPhysicalEditApplyResult`'s `hasOnlyKeys` (a byte-echoing result is now REJECTED at the boundary). (ii) never roll the child back over a parent commit: `restore` is honored only on `parentDidNotCommit` (`transport` / `parent-rejection`); the timeout + settlement-mismatch copy no longer claims a restore and says the result is unknown.
- **nature (b) defensive guard** — `getFrameBlobUrl` guards missing/empty bytes and returns `''` (call sites map `''` → `null`), so `buildFrameBytesToken` can no longer `bytes.subarray` on `undefined`. Two scopes, deliberately not conflated: it **is** the root-cause fix for the latch/timeout cascade (the throw that latched the pending slot can no longer occur), and it is **containment only** for the missing bytes themselves — a frame whose carrier never materialized now yields a blank reference instead of a crash. Whether the bytes actually arrive is a separate question, answered by UAT row 5.

A second byte carrier remains and is a separate decision: `semanticDelta.clipboardPayload` carries `bytes` and `semanticDeltaEquals` reads it for correlation. Named in the proposal, not touched here.

## Findings (2026-10-05 round 5 — paste-path retest, first pass, measured)

Measured from `/tmp/efx-physical-edit-{studio,main}.json`, run 14:42:54–14:43:49.

| op | settle (`payload-send` → `settled`) |
|---|---|
| `delete-key-group` | 50 ms |
| `delete-key` ×2 | 26 / 27 ms |
| `move-key` | 37 ms |
| `paste-key` ×3 | **194 / 147 / 166 ms** |
| `paste-key` ×1 | no settle — `result-mismatch` 34 ms after send |

Before: `paste` timed out at exactly 5000 ms, 9/9. **The latch/timeout cascade is closed.** Three pastes settle under 200 ms, there is not one 5 s timeout in the capture, and no `bytes.subarray` `TypeError`.

### The Track 1 failure — aftermath, not a new root cause

The 4th `paste-key` (startFrame 3, track `46d6f9dd`, op `…5ad47fd4`):

```
detailError:           Roto physical record ref "670a5a5c-10e6-423d-9dcd-5db030a2473f" is unknown to the parent document.
detailOk:              false
failedFields:          ["stagedRevision"]              ← ONLY
detailStagedRevision:  invalid-physical-revision        ← the :1323 catch sentinel
pendingStagedRevision: physical-1391-a62debab
```

Every other correlated field matched (`expectedRevision`, `selectedKeyId`, `selectedAppFrame`, `cursorAppFrame`, break counts). Two named layers, in order:

1. **PRIMARY — parent-side record-ref rejection.** `physicPaintBridge.ts:607` refused the paste: the payload carries keyId `670a5a5c-…` and the parent document does not know it. This is the **record-validation / hydration family** the retest scope explicitly excludes — a sibling of `malformed real-key record`, not identical to it. Same family as row 5's concern (a byte carrier that never materialized), one at apply-validation time and one at reconcile time. **Not touched tonight.**
2. **AFTERMATH — the sentinel turns a failed op into a `stagedRevision` mismatch.** With `ok:false` the parent cannot recompute a staged revision, so `physicalEditResult`'s catch (`:1323`) emits `invalid-physical-revision` and the child's comparator flags `stagedRevision` → `settlement-mismatch`. Same shape as the already-documented `invalid-physical-revision` finding. **Do not chase the mismatch** — it is the sentinel talking, not a second defect. This shape (a failure-only field that can never match on failure) is fail-loud-correlation material for the proposal's §3.5 list.

Side note, cosmetic, deferred: `PHYSICAL_EDIT_RESULT_MISMATCH_MESSAGE` (`:126`, "Ignored mismatched … Try the action again.") was not rewritten and is what `finalizeFailed` passes as the `detail` (`:1491`). The user-facing status line carries the new honest copy; the console `failed (settlement-mismatch):` line carries the old one. Row 3 still passes — nothing claims a rollback — but the two strings disagree.

Also measured: main's capture has **no** `apply-received` / `apply-reject` for op `…5ad47fd4`, even though the child received a result carrying `:607`'s exact text. The parent-side reject path that fired does not hit those probes. Named, not chased.

## Findings (2026-10-05 round 6 — live rows 1–5, user-reported)

| row | verdict | evidence |
|---|---|---|
| 1 — paste settles, no timeout | **PASS** | rails and frames paste and settle; zero timeouts |
| 2 — no `bytes.subarray` `TypeError` | **PASS** | none reported, none in capture |
| 3 — honest failure copy | **PASS** (cosmetic gap stands) | nothing claimed "the previous state was restored" |
| 4 — delete / move after a paste | **PASS** | drag + delete work on Track 1, Paint 1, Paint 2 — including after a failed paste. **The global slot is released.** |
| 5 — pasted reference actually displays | **FAIL** | "the key is empty" — pasted keys are blank |

**Tonight's claim is VERIFIED**: the latch/timeout cascade is closed (rows 1–4). Row 5 is a separate, named defect and was never part of that claim.

### Row 5 — `missing-bytes hydration` (OPEN follow-up, per the row-5 verdict rule)

Measured axis, from the user's own steps: **the copy SOURCE decides it.**

| copy source | paste result |
|---|---|
| Track 1 (rail) | settles, pasted key **empty** (empty on Track 1 *and* on Paint 1/2) |
| Paint 2 (frame + rail) | settles, paint **correct** (to Paint 2 *and* to Paint 1) |

The user's read matches: "it's because those are frames copied from Track 1."

**User's hypothesis, untested:** "I think the problem happens if I drag from other track." If the keys on Track 1 arrived there via a cross-track drag, the drag is the carrier-loss point and `copy source = Track 1` is only the effect. Decisive untested row: a key **native** to Track 1 (painted there, never dragged) vs a key **dragged onto** Track 1 from Paint 2. Native good + dragged empty ⇒ the cross-track drag drops the raster carrier.

**Unifying candidate for the whole cluster (named, NOT fixed):** raster-carrier preservation (`bytes` vs `media`) across track operations. One family, three symptoms already measured —
- empty pasted keys (carrier missing → `getFrameBlobUrl` returns `''`),
- `Roto physical record ref "<keyId>" is unknown to the parent document.` (a `media` ref that cannot resolve),
- the named-out `malformed real-key record` (neither carrier present — exactly what the `clonePayloadAtFrame` comment at `useRotoPhysicalEditCoordinator.ts:651` describes).

The next single-root-cause cycle targets this family, one fix.

### New symptom (separate, named): copy a KEY greys Paste

Copy a key on Track 1 → the Paste control is greyed out and nothing pastes. Copy a rail → Paste is enabled and works. An enablement-gate defect, not the hydration family. Not folded in.

## Findings (2026-10-05 round 7 — characterization rows A–D, closes the paste-path cycle)

**Row 5 is a FALSE POSITIVE. `missing-bytes hydration` is DEAD.** Row C painted into `+Key` keys on **both** Paint 2 and Track 1: paint appears, persists on frame revisit, copies and pastes with paint, no errors, no empty keys — both tracks. The round-6 "empty keys" were `+Key`'s documented empty key (`ADD_KEY_SUCCESS_MESSAGE = 'Added an empty Roto key.'`, `useRotoTimelineActions.ts:1523`) copied before being painted into. **The guard was never hiding bytes.** The containment/root-cause split did its job: it stopped a guard from being recorded as a fix.

**The cross-track drag hypothesis is REFUTED (round 6 Block A).** A key dragged Paint 1 → Track 1 keeps its paint on Track 1 (A4 visible) and copies out of Track 1 with paint (A5 visible). The drag loses nothing.

**Row D is INCONCLUSIVE — the test design was confounded.** Row C's copies overwrote the clipboard before row D ran, so "paste the failing content onto Paint 2" did not actually re-paste the failing content. No evidence either way. My error.

**What remains, measured and real:** `Roto physical record ref "1b30213a-0334-4a6d-b391-0c50cdd0d9c7" no longer matches the parent document content.` — `physicPaintBridge.ts:609`, the branch where the ref **exists** but its **content** differs (vs `:607` "is unknown"). Two identical rejections at 15:24:43 and 15:25:43 — `paste-key` onto `46d6f9dd` (Track 1) at startFrame 14, `failedFields:["stagedRevision"]` (the sentinel aftermath), `detailOk:false`. Deterministic *then*; **not reproducible now**. A **transient cross-realm content divergence on one record ref**. This is the debug's actual subject.

Measured for the proposal's §5 sub-decision, while it was in front of us: `resultPayloadBytes` on successful settles ranged **2 317 → 433 712 bytes**. The 433 KB values are the `semanticDelta.clipboardPayload` byte carrier. Not a timeout cause (settles 79–187 ms) but real weight sitting on the correlation channel.

## Current Focus

- root_cause: THREE confirmed across the session, all in the settlement/selection path.
  1. (round 2) six `setRotoPhysicalSelection` writes targeted `trackIdOfLaunch(launchContext)` instead of the live active track.
  2. (round 3) the cross-track move committed via a direct `physicPaintStore.moveTrackItems` call — the one Studio mutation that never ships through `applyPayload`.
  3. (round 4) a throw in `finalizeAccepted` latched the global pending slot → phantom 5 s timeout; plus a settlement return leg that echoed byte carriers; plus failure copy asserting a rollback no caller performs.
- fix: ALL LANDED (1)+(2) in the working tree and carried by `373f182b`; (3) is `373f182b` itself.
- **SECOND ROOT CAUSE FOUND AND FIXED (2026-10-05, round 9) — the doc-sync mirror rewrote unchanged tracks.**
  Symptom: `set-interpolation-enabled` (row blend toggle) failed on Paint 1 with `Roto physical revision became stale before commit.` while Paint 2 and Track 1 passed. Measured: Paint 1's Studio revision `physical-2664-4929a2cd` vs parent `physical-2560-b1a641a6`; the working tracks matched to the character. Stable divergence, not a race.
  Mechanism: any structural write (`activeTrackId` on a track switch, solo, rename, reorder) bumps `efxPaintVersion` → document sync → `mirrorSyncedTrackDocuments`, which looped over **every** track and reinstalled `rotoPhysical`. The wire copy is the persisted shape (media refs, no pixels) while the runtime holds inline bytes, and `buildPhysicPaintRotoPhysicalRevision` is **not carrier-shape-invariant** — so a reinstall re-derived the revision to a token matching neither window. `preserveMirroredInlineBytes` could not restore every record, so the splice landed off-token. From then on `physicPaintBridge.ts:1821` rejected every edit on that track. The `contentRevision === track.rotoPhysical.revision` guard never fires across shapes, so this happened on every structural push.
  **Fix:** `mirroredRecordSetChanged` — install `rotoPhysical` ONLY when the track's record SET (keyId + appFrame identities) actually changed, which is what a cross-track move does. A track switch / solo / rename / reorder is now a no-op on physical state. The apply path owns record content; the sync owns structure.
  Also fixes (round 8): removed `compactRecordsForTransport` (content-token record refs) and corrected `PHYSICAL_EDIT_RESULT_MISMATCH_MESSAGE`.
  Gates: `tsc` clean but 3 pre-existing `view/` errors; full suite 4429 pass / 1 known-failing file (`PhysicsPaintStudioView` import error, pre-existing).
- **ROOT CAUSE FOUND AND FIXED (2026-10-05, round 8) — 52.1 (Part 2) content-token record refs.**
  `compactRecordsForTransport` sent unchanged real-key records as `{ keyId, appFrame, refToken }` instead of full payloads, and `expandRotoPhysicalEditRecordRefs` (`physicPaintBridge.ts:591-614`) re-resolved them against the parent store, requiring `buildPhysicPaintRotoPayloadContentToken(parent.payload) === entry.refToken`. The comment claimed `expectedRevision` "guarantees the parent holds exactly these bytes". **False** — `expectedRevision` does not cover record content, so once the realms drift the parent's token differs and the whole edit is rejected (`:607` unknown / `:609` content mismatch). That is both Track 1 errors, and plausibly the whole original cluster.
  **Fix:** deleted `compactRecordsForTransport`; every record now ships its full payload. The child staged against its own bytes, so its bytes are the authority. `expandRotoPhysicalEditRecordRefs` kept as a fail-loud boundary validator (and its type untouched). Do not re-compact until the revision hash covers record content.
  Also corrected `PHYSICAL_EDIT_RESULT_MISMATCH_MESSAGE` (it said "Ignored … Try the action again" — asserts an ignore that does not happen).
  Gates: `tsc` clean but the 3 pre-existing `view/` errors; targeted suites 287 pass / 1 skip.
  **Live UAT pending — user is to rebuild and work normally, no checklist.**
- next_action: **the paste-path cycle CLOSES — VERIFIED.** Rows 1–4 pass (settle 26–194 ms vs 5000 ms timeouts 9/9; slot released; no `bytes.subarray`; honest copy). Row 5 retracted as a false positive (round 7). The latch/timeout cascade is done.
  **The debug stays OPEN on one named defect:** `Roto physical record ref "<keyId>" no longer matches the parent document content.` (`physicPaintBridge.ts:609`) — a transient cross-realm content divergence on one record ref (`1b30213a-…`), measured twice then gone. Intermittent, not reproducible on demand.
  **Next cycle's opening move (needs the user's go — instrument, do not fix):** extend the capture so that on a `:609` rejection it dumps both realms' content hash for that `keyId` (Studio's expected vs parent's actual) plus the op that last wrote the record. Then the user works normally until it fires. Catch it in the act before naming a fix.
  **Carried, OPEN:** `Roto physical record ref "<keyId>" is unknown to the parent document.` (`:607`, seen once at round 5); `copy a key greys Paste` (enablement gate); `PHYSICAL_EDIT_RESULT_MISMATCH_MESSAGE` copy inconsistency (cosmetic); proposal §5 `semanticDelta.clipboardPayload` byte carrier (measured 433 KB). Earlier excluded list unchanged: `malformed real-key record`, `physical edit barriers failed`, `replay source snapshot does not match`, onion intermittency, Studio-added-track frame blending.
- specialist_hint: typescript (`tsc` clean but for 3 pre-existing `view/` errors; `vitest run` 4428 pass / 1 fail = the documented baseline `PhysicsPaintStudioView.test.ts` `_setPaintMarkDirtyCallback`)
- **explicitly NOT in scope tonight** — these are NOT covered by this diagnosis and must not be folded into it: `malformed real-key record`, `physical edit barriers failed`, `replay source snapshot does not match`. Onion intermittency and Studio-added-track frame blending are characterization only.
- still open (deferred, separate cycles): track-churn regression (delete all tracks + add one → blend toggle dead); post-UAT regression pin for `awaitPendingPhysicPaintRuntimeMirror()`; the `semanticDelta.clipboardPayload` byte-carrier decision.
- **separately queued (proposal only, not started):** `SPECS/phase-52.2-10-rescope-settlement-machine.md` — re-points 52.2 §10's async pilot from stroke finalization at the physical-edit settlement machine. Carries the 260921-c7x history (two-encoding revisions + non-finalizing mismatch branch, 5 native UAT rows never ran) as proof we keep fixing hats. Non-imposition law stands.
