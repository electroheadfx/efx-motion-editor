---
status: awaiting_human_verify
trigger: |
  Follow-up to debug session studio-track-physical-edits (fix f3b08c78, carrier preservation — verified landed, move now works).

  User live retest 2026-10-05 + scoping answers:
  - Rail delete no work on all tracks except the base (Track 1), then after some operation sometimes it no work too on Track 1. Difficult to reproduce.
  - This error happens when it works or not: "Group lifecycle physical document became stale before proposal staging." (useRotoPhysicalEditCoordinator.ts:1098)
  - IMPORTANT FLASH NOTE: "Seem its frame blending which causing the bugs (per track) when I try to off it. I need to quit the app for restore studio functions."
  - Frame blending on/off does not work on new tracks — works only on the base default track.
  - Cannot change frame blending value, or active/unactive frame blending, once the corruption has happened.
  - "Missing source on 1 track(s)" warning: user reports it seems fixed / no longer seen. Drop it.
  - Control identity (CONFIRMED): the per-track row blend button — the 2026-09-11 owner of interpolation on/off.
created: 2026-10-05
updated: 2026-10-05
goal: find_and_fix
---

# Debug Session: studio-blend-off-corruption

DATA_START

## Symptoms

### Expected behavior
The per-track row blend button toggles interpolation on/off for its own track, on every track (base default and Studio-added). Toggling it must not damage the track's state — subsequent physical edits (rail move, rail delete, key delete, further blend changes) must keep working.

### Actual behavior
1. **Blend on/off does not work on new tracks** — only the base default track responds. On Studio-added tracks the toggle has no effect.
2. **Trying to turn frame blending OFF on a track corrupts that track's state** (user flash note). After that:
   - Rail delete fails: `Group lifecycle physical document became stale before proposal staging.`
     stack: `logDiagnostic (PhysicsPaintStudio.tsx:1197)` → `(anonymous function) (useRotoPhysicalEditCoordinator.ts:1098)`
   - Frame blending value / on-off can no longer be changed at all
   - Other physical edits break or lock up
3. **Rail delete** does not work on any track except the base (Track 1). After some operations it sometimes stops working on Track 1 too. Hard to reproduce.
4. **The `Group lifecycle physical document became stale before proposal staging.` error is logged even when the operation succeeds** — it is noisy, not a reliable pass/fail signal.
5. **Quitting the app restores Studio functions** (move, delete come back). So this is in-session runtime state corruption, not persisted document corruption.

### Error messages (verbatim)
- `Group lifecycle physical document became stale before proposal staging.`
  (`logDiagnostic (PhysicsPaintStudio.tsx:1197)` → `useRotoPhysicalEditCoordinator.ts:1098`)

### Timeline
Follow-up to studio-track-physical-edits. The carrier fix (f3b08c78) landed and worked — cross-track move now succeeds. These remaining issues surfaced during the live retest on 2026-10-05.

### Reproduction (working hypothesis from user's flash note)
1. Open the Physics Paint Studio on a project with a base default track (Track 1).
2. Add a new track in the Studio (e.g. Paint 1 / Paint 2).
3. On the new track, use the **per-track row blend button** to try to turn frame blending **OFF**.
4. Observe: the toggle has no effect on the new track.
5. Try rail delete / further blend changes on that track — they fail.
6. Quit and reopen the app — functions return.

### Control identity (CONFIRMED by user today)
**Per-track row blend button** — the 2026-09-11 owner of interpolation on/off. (That note said frame-blend mode is coerced to `duplicate` at every store entry and its UI section was removed; the row blend button owns interpolation on/off. The button is the control the user means.)

## Leading hypothesis (NOT prescriptive — test it)
Turning the per-track row blend button OFF on a non-default track writes a bad or divergent interpolation/blend state (possibly a stale revision, a wrong carrier, or a child/parent realm split). The write either is rejected and leaves the document "stale", or is applied to only one realm. Every later physical edit on that track then validates against the corrupted state and is rejected (`Group lifecycle physical document became stale before proposal staging.`). App restart clears the in-memory divergence, which is why functions return.

Secondary shape to test: blend OFF on the base default track works and does not corrupt; blend OFF on a Studio-added track both fails AND corrupts. If that asymmetry holds, the bug is in the non-default-track path of the blend toggle (track identity / lease / revision selection).

## Prior-session context (do not re-fix)
- `f3b08c78` preserved the raster carrier across payload rebuilds. Move now works. Do NOT revisit the `bytes`-vs-`media` carrier projection.
- Cluster B observation from that run (NOT fixed, possibly related): cross-track move bypasses the coordinator via `physicPaintStore.moveTrackItems` (called directly from `PhysicsPaintWorkflowStrip.tsx`), leaving child/parent realms diverged. The blend-button trigger may be a second entry point into the same divergence. Check both, but fix ONE root cause.
- Capture instrumentation is already wired and uncommitted (intentional): `app/src/lib/physicalEditCapture.ts` (new) writes `/tmp/efx-physical-edit-studio.json` + `/tmp/efx-physical-edit-main.json`; capture points in `useRotoPhysicalEditCoordinator.ts`, `PhysicsPaintStudio.tsx`, `physicPaintBridge.ts`. Extend it rather than replacing it.

## Guardrails (hard constraints)
- User runs the live app. This is a Tauri/cross-webview path: **live or on-disk evidence is the verdict; unit probes are not admissible.**
- Reuse the existing physical-edit coordinator and record-collection types. **No new transport.**
- **Fix live first, regression tests after.**
- **ONE root cause, ONE fix.** User retests.
- The `Group lifecycle physical document became stale before proposal staging.` log fires on success too — do not treat its presence as proof of failure. Correlate with actual user-visible behavior.

DATA_END

## Evidence (round 1 — on-disk captures from the user's 2026-10-05 live run, read 2026-10-05)

Sources: `/tmp/efx-physical-edit-studio.json` (124 events, 06:19–06:25) and `/tmp/efx-physical-edit-main.json` (40 events). Two tracks: `46d6f9dd` = base Track 1, `c81807c5` = Studio-added track.

Timeline facts (all times UTC from capture):

1. 06:19:11–06:20:54 — every op on base `46d6f9dd` (move/paste/delete-rails) is received AND accepted by the parent. Revisions chain cleanly: child's `expectedRevision` each send equals the parent's previously accepted `stagedRevision`.
2. 06:19:24 — first op on `c81807c5` (delete-rails) fails CHILD-side before send: `Group lifecycle physical document became stale before proposal staging.` (child-internal doc-vs-ports barrier; nothing sent to parent).
3. **06:22:17 — the ONLY blend-toggle attempt captured** (`execute-enter set-interpolation-enabled` on `c81807c5`, activeTrackId already switched to `c81807c5`). It fails the interpolation gate: `Roto interpolation barrier: staged records do not equal current records (carrier or content mismatch).` → "No state was changed." **This is the "blend does not work" event.**
4. **06:22:24 — base-track corruption manifests.** First `delete-rails` on base sends `expectedRevision physical-6097-d83ee1d8` but the last ACCEPTED staged revision (06:20:54) was `physical-6097-baafbe74`. Same record count (16, both `6097-` class), different hash → **child's base-track physical content changed between 06:20:54 and 06:22:24 with NO payload-send in between** — the only captured event in that window is the blend attempt at 06:22:17. Parent rejects: `Roto physical revision became stale before commit.` — every base op from then on (06:22:24, :28, :33, :34, 06:24:59) fails the same way.
5. 06:22:30/31 and 06:25:12/15 — four child sends never produce a parent `apply-received`; the child logs `settlement mismatch (result mismatch)` instead. Consistent with early parent-side rejection or cross-talked results AFTER divergence (e.g. compacted record refs failing parent expansion against parent-stale bytes).
6. 06:25:12/15 — move-key-rail on `c81807c5` passes child staging by then (payload-send happens) but settlement-mismatches; no parent receive.

Matches user report: "rail delete works on no track except base, then base breaks too after some operation" (base broke right after the blend attempt), "blend does not work on new tracks", "cannot change blend once corruption happened", "quit restores".

## Code trace (round 1)

- Button: `PhysicsPaintStudio.tsx` `handleToggleBlend` — **switches the document's active track (`setActiveTrackId`) synchronously**, then stages `records = getRotoRealKeyRecords(layerId, buttonTrackId)` from the click handler and calls `executePhysicalEdit('set-interpolation-enabled')`.
- Coordinator (`useRotoPhysicalEditCoordinator.ts`) always: (a) runs `flushPendingStrokeFinalizations()` + `await flushLivePixels()` BEFORE staging, (b) reads all staging state via active-track-scoped ports (`studioActiveTrackId()`), (c) gates interpolation ops on `recordsEqual(stagedInput.records, currentPostFlushRecords)` plus selection identity/frame equality.
- Live-pixel delivery (`useRotoFramePersistenceCoordinator.ts` `queueParentPayload`): at DELIVERY time re-resolves `trackId = getActiveTrackId()` and silently `return`s (drops the parent `apply-canvas`) if the keyId/revision doesn't match the CURRENT active track. `upsertCachedFrame` likewise re-resolves the active track and skips local commits on revision mismatch. **A pending delivery for the previously-active track is silently dropped the moment the blend button switches tracks** → child keeps painted bytes, parent never receives them → same count, different hash → "revision became stale before commit" forever (in-memory; quit resets both realms → functions return).
- The staged-records barrier (06:22:17): staged list is captured pre-flush in the click handler; the coordinator's mandatory flush can mutate the very records on the target track (or the active track can re-resolve mid-flight), so `recordsEqual` fails → toggle never commits.

## Instrumentation extended (uncommitted, intentional — extends the existing capture, no new transport)

- `useRotoFramePersistenceCoordinator.ts`: `live-pixel-delivery-dropped` (the silent parent-delivery drop: identity track vs resolved active track, hasRecord, revisions) and `live-pixel-local-skip` (active-track re-resolution skipping a local commit).
- `PhysicsPaintStudio.tsx` `handleToggleBlend`: `blend-toggle-click` (button track, active track before, record count, current enabled, pending op) and `blend-toggle-focus-switched` (active track after).
- `useRotoPhysicalEditCoordinator.ts`: `interpolation-barrier` (staged vs current record counts + shape summaries, selection, enabled) and `stale-doc-barrier` (per-sub-check booleans: capacity/docRevision/records/interpolation/selectedKey/cursor + both revisions + both selections); `payload-send` now carries child-side revision components (interpolation, loopClips, breaks, overrides, selection, cursor).
- `physicPaintBridge.ts`: `parent-revision-state` on EVERY physical-map apply — parent's revision + component counts + payload's components, so a reject attributes to the exact diverging field.

## Evidence (round 2 — fresh capture with new probes, 2026-10-05 06:51 UTC, decisive)

Sources: `/tmp/efx-physical-edit-studio.json` (44 events, 06:51:04–06:51:36) + `/tmp/efx-physical-edit-main.json` (6 events). New probes present → capture valid.

Timeline:

1. 06:51:04 — `insert-empty-segment` (add-key) on base `46d6f9dd`: payload-send → parent accepted ("Roto physical edit applied."). The sent payload's record `71d08341` is **media-carrier only** (`payloadKeys: [frameIndex, appFrame, media, width, height]`, `hasBytes: false`) — the child runtime holds reference-only records mid-session.
2. 06:51:21/23/24 — three blend-toggle attempts on base: all fail the interpolation barrier. `stagedRecordCount == currentRecordCount == 17`, `summaries_identical=True` (full stagedRecords vs currentRecords probe lists byte-for-byte equal), selections equal (null==null), `targetEnabled(true) != currentEnabled(false)`, `pendingOperationId: null`, `activeTrackBefore == activeTrackAfter` (NO focus switch). Base set: **1 of 17 records media-only** (`71d08341`), 16 bytes.
3. 06:51:31 — add-key on Studio track `c81807c5` accepted. Its payload holds **2 media-only records** (`06297b1e`, `e3460287`) out of 5.
4. 06:51:34/35/36 — three blend attempts on `c81807c5`: all fail identically — counts 5==5, summaries identical, selection `6fa29311`==`6fa29311`, `targetEnabled(false) != currentEnabled(true)`. 2 of 5 records media-only.
5. Zero `live-pixel-delivery-dropped` events (face (a) not exercised — no paint in this run; not the cause of THESE failures). Zero flush mutations. **Base-default-is-special refuted: base fails the same way.**

### ROOT CAUSE (proven — code + capture agree)

`useRotoPhysicalEditCoordinator.ts:446`:
```ts
function payloadBytesEqual(left: unknown, right: unknown): boolean {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;
  ...
}
```
A 52.2-02 D-07 reference-only record carries `media` and `bytes === undefined`. At every payload comparison, `payloadBytesEqual(undefined, undefined)` returns **false** — so `recordsEqual` (line 681, bytes-only compare at 693) reports "mismatch" for **byte-for-byte identical** staged/current record lists as soon as the collection holds ≥1 media-carrier record.

Consequences (all symptoms, one defect):
- **Interpolation barrier** (line 1996 `recordsEqual(interpolationInput.records, currentRecords)`) → blend toggle permanently rejected on ANY track with a media record → "staged records do not equal current records (carrier or content mismatch)". Fresh capture: all 6 attempts, summaries identical, media present.
- **Stale-doc barrier** (line 1822, only for rail-delete/paste/group ops) → `Group lifecycle physical document became stale before proposal staging.` — fires whenever the doc holds a media record, even when staged==current.
- `applyPayloadRecordsEqual` (line 700) — same flaw; Play Script proposal gates (917/922) and paste semantic-delta equality (532/548/789) latent.
- **Restart heals** because `materializeRuntimeRotoMediaBytes` re-attaches bytes to media records at the launch door; a docSync mirror round-trip (`mirrorSyncedTrackDocuments` → `mirrorRotoPhysicalDocument`, no revision bump) re-installs reference-only form mid-session → corruption returns. Matches user: "added a key → nothing works on Track 1 or new tracks" (both add-keys in this capture succeeded; the mirror after accept re-installs persisted form).

Contrast: the resolver's `payloadEqualsAtFrame` (`physicsPaintRotoPhysicalResolver.ts:489-508`) already compares **carrier-total** via `buildPhysicPaintRotoPayloadContentToken` — "the content token is total over both payload shapes" — and the coordinator already imports that token (line 69, used at 986/990). The coordinator's `payloadBytesEqual` is the only payload comparison left bytes-only. Per D-07 a payload carries EXACTLY ONE carrier, so token equality is unambiguous.

## Current Focus

- root_cause: CONFIRMED (round 2) — the coordinator's payload equality was bytes-only (`payloadBytesEqual` returned false for media-carrier records), so `recordsEqual`/`applyPayloadRecordsEqual` failed unconditionally on any track holding a reference-only record, killing the interpolation gate (blend toggle) and the stale-doc gate (rail delete) with identical staged/current state. Face (a) (live-pixel delivery drop on focus switch) not exercised in round 2 and not needed to explain these failures.
- fix: LANDED 2026-10-05 (user-approved, TDD). `payloadContentEqual` (carrier-total, via `buildPhysicPaintRotoPayloadContentToken`) replaced `payloadBytesEqual` at all 5 sites — `recordsEqual`, `applyPayloadRecordsEqual`, `semanticDeltaEquals` (paste-key-group 544, paste-key 560), `railSetCopyKeyRailMemberEqual` (801) — `payloadBytesEqual` and the now-unused `buildFrameBytesToken` import deleted. No revision-encoder change, no transport change, no new types.
- next_action: user LIVE re-verify in the running app: (1) per-track row blend toggle ON/OFF on a base track AND a Studio-added track holding media records (add a key first so a reference-only record exists), (2) rail delete on those tracks, (3) further blend changes after a rail delete. Then report back to close or reopen.
- specialist_hint: typescript (tdd_mode gate active — specialist dispatch skipped; failing test written before fix)

## Resolution

root_cause: The physical-edit coordinator's payload equality was bytes-only (`payloadBytesEqual`: non-Uint8Array → false), while 52.2-02 D-07 lets a record carry `media` with `bytes === undefined`. A docSync mirror round-trip re-installs reference-only form mid-session (restart heals via launch materialization), so `recordsEqual`/`applyPayloadRecordsEqual` reported "mismatch" for byte-identical staged/current lists on any track holding ≥1 media record — permanently rejecting the blend toggle (interpolation barrier, "staged records do not equal current records") and rail delete/paste/group (stale-doc barrier, "Group lifecycle physical document became stale before proposal staging.").

fix: ONE change, as approved — added `payloadContentEqual` = `buildPhysicPaintRotoPayloadContentToken(left) === buildPhysicPaintRotoPayloadContentToken(right)` (the resolver's established carrier-total oracle) and replaced all 5 `payloadBytesEqual` sites; deleted `payloadBytesEqual` + the unused `buildFrameBytesToken` import. Bytes-vs-bytes: token-identical (zero behavior change). Media-vs-media: digest equality (the fix).

verification (TDD, automated only — live UAT pending):
- RED first: new test "stages and sends a blend toggle when the collection holds a reference-only record" failed pre-fix with the exact root-cause diagnostic (probe confirmed `staged records do not equal current records`, not a sibling gate). Sibling "stages and sends a rail delete when the document holds a reference-only record" (stale-doc barrier, same `recordsEqual`) added; both tests verified RED under the old bytes-only behavior and GREEN after the fix (temporarily reverted equality body to confirm).
- `vitest run` (never watch): 4428 passed, 1 skipped, 101 todo; 1 pre-existing suite failure — `view/PhysicsPaintStudioView.test.ts` (`_setPaintMarkDirtyCallback is not a function`, collection-time import wiring) — verified failing on a CLEAN tree (stash/verify/pop), unrelated to this fix. Coordinator file alone: 78/78 passed.
- `tsc --noEmit`: only the 3 pre-existing `view/` errors (physicsPaintTemporaryErase.ts ×1, PhysicsPaintToolRail.tsx ×2).

files_changed: [app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts, app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts]
commit_note: fix code intentionally left UNCOMMITTED — it shares `useRotoPhysicalEditCoordinator.ts` with the session's capture instrumentation, which the guardrail requires to stay uncommitted; committing the fix would bundle it. Capture instrumentation untouched: `app/src/lib/physicalEditCapture.ts` + capture points (PhysicsPaintStudio.tsx, useRotoFramePersistenceCoordinator.ts, physicPaintBridge.ts, coordinator probes).

prevention: why not caught — no gate compared payload equality across carrier shapes; the resolver had the carrier-total oracle but the coordinator kept a local bytes-only copy. guard: the 2 new regression tests in `useRotoPhysicalEditCoordinator.test.ts` pin both gates (interpolation + stale-doc) against reference-only collections.
