---
status: resolved
trigger: "Studio script snapshot loses its data after rail/key deletion"
created: 2026-10-24T13:14:41Z
updated: 2026-10-24T13:22:11Z
---

## Current Focus

hypothesis: "CONFIRMED, two contributing mechanisms. (1) RESTORE-SETTLEMENT RACE: bind() starts a new generation whose session is empty; saveNow()/flushNow() were not gated, so a save prepared while the rebind restore was in flight encoded an EMPTY payload under the incoming identity (RED test wrote a SNAP1 header with zero events under track-1) and overwrote the surviving rail's good file; the later restore then set lastSavedSignature to the restored signature, so the empty file was never repaired. (2) DESTRUCTIVE SAVE-TIME PRUNE: prepareSave() pruned stroke events and brush frames to the live real-key set at SAVE time, so deleting a key permanently removed its script from the file (and an all-pruned payload is exactly the 162-byte header+IDs shape observed). The 261023-g4p apply-time brush prune additionally removes the entry from the session, so the next save persisted its absence."
test: "Deterministic controller suite: bind -> restore in flight (deferred read) -> empty store -> saveNow/flushNow assert NO write -> restore resolves -> a mutation writes the RESTORED payload; refused and missing restore + dirty save write nothing; key-deleted entries are not pruned at save; restore-pruned and apply-pruned entries survive in the snapshot; explicit purge stays destructive."
expecting: "RED on HEAD (empty payload written while restore is in flight; deleted-key entries pruned at save); GREEN after the settlement gate, the empty-payload guard and the retained-content union."
next_action: "Closed — fix applied and all offline gates green. Live UAT pending (user runs the app)."
tdd_checkpoint: "RED confirmed 2026-10-24T13:19Z (6 failed / 1 guard passed); GREEN 2026-10-24T13:21Z (38/38)."

## Symptoms

expected: "A rail's per-rail script snapshot retains its data through key deletion and rail deletion; the surviving rail still reports its brush script and the Memory tab still counts its strokes/points/bytes."
actual: "After deleting a key (with a script key plus another rail selected), then deleting the rail/track, the right-panel Memory tab shows 'Scripts total · Brush: 0 strokes · 0 points · 0 B' and the surviving rail reports 'No brush script on this key'. The surviving snapshot file was overwritten from 16,512 bytes to 162 bytes (header + IDs, zero events/frames)."
errors: "None — silent data loss; no error message or exception."
started: "2026-10-24, during the rail/key deletion repro on project /Users/lmarques/Desktop/efx-motion-editor-project-test/test.mce."
reproduction: "1. Open the project, enter the Studio on the physic-paint layer, edit a rail script. 2. With a key that has a script selected AND another rail also selected, press Delete (key removed first; rail remains). 3. Delete the rail (track) afterwards. 4. Observe the Memory tab showing 0 strokes / 0 points / 0 B and the surviving rail reporting no brush script. User is unsure whether key delete or rail delete triggers it."

## Proven Evidence

The following facts are user-supplied and proven; do not re-derive, verify only if cheap.

- timestamp: 2026-10-24T13:14:41Z
  checked: "Surviving snapshot file test.mce/scripts/7bcc71b6-816d-4b26-8b86-20c37f39787a/c4868e73-2d89-43b9-9073-b9295c42ff2c-v1.snap"
  found: "It was 16,512 bytes before the test; now 162 bytes, mtime 14:59:55, while the project was written at 15:00:29. A 162-byte SNAP1 file is header + projectId/layerId/trackId and ZERO events/frames: an empty payload was written over a good snapshot."
  implication: "The surviving track's snapshot was overwritten with an empty payload, not merely deleted. IDs in file: projectId 745f62e3-ee81-42d5-a287-995e31be28a5, layerId 7bcc71b6-816d-4b26-8b86-20c37f39787a, trackId c4868e73-2d89-43b9-9073-b9295c42ff2c."

- timestamp: 2026-10-24T13:14:41Z
  checked: "Current project state (user inspection)"
  found: "3 tracks (Paint 3 / Paint 1 / Paint 2), ALL with 0 keys and 0 loop clips; scriptMotion is the default {deformation:0,position:0}."
  implication: "The loss is not explained by remaining keys; the snapshot itself lost its content during the deletion sequence."

- timestamp: 2026-10-24T13:14:41Z
  checked: "Scripts library and app data"
  found: "The five Scripts-library presets are intact (test-Layer 1-16/15 strokes, 1-1/3, 1-3/7, 1-0/5, 1-17/12). The rail cascade never touches them. No backup copy exists in app data; there is no studio-script-snapshots dir under ~/Library/Application Support/com.efxlab.motion-editor."
  implication: "Source library scripts are intact; only the applied per-rail script timeline is lost. The 16 KB snapshot content is NOT recoverable; no backup leg exists."

- timestamp: 2026-10-24T13:14:41Z
  checked: "Prior quick .planning/quick/261023-ors-*/261023-ors-SUMMARY.md"
  found: "The deleted rail's snapshot being removed is BY DESIGN (commitDeleteTrack -> registered cascade -> remove(scope 'both')). The bug is the surviving track's snapshot being overwritten empty, not that deletion."
  implication: "Do not change the rail-delete cascade's intended snapshot removal."

- timestamp: 2026-10-24T13:14:41Z
  checked: "Suspected cross-track switch and controller paths (from user's prior reading)"
  found: "PhysicsPaintStudio.tsx ~3935-3990: saveNow(outgoing) -> resetBrushScriptStore/resetAquarelleRecordState -> bind(incoming) -> void restore() (NOT awaited). studioScriptSnapshotController.ts: bind() ~240-260, restore() ~262-330, prepareSave() ~317+, markDirty() ~405+. restore() sets restoringCount while seeding, but a save prepared while the session store is empty can still encode an empty payload under the incoming identity. A REFUSED restore leaves lastSavedSignature null, making a later empty save even easier."
  implication: "Main hypothesis is an empty-save race across the rebind; verify in code and reproduce deterministically in the controller test."

## Fix Direction (user-approved)

1. Guard saves: never prepare/write a snapshot before the restore for the CURRENT binding generation has settled; never allow an empty payload to overwrite a non-empty snapshot unless an explicit purge/delete requested it.
2. Make pruning non-destructive at save time: keep deleted-key script entries in the authoritative snapshot; prune only at restore/apply time (so a deleted key's script cannot reappear in the session, but undo/restore can recover it). Explicit purge actions remain the destructive path.
3. Add a deterministic regression test for the exact sequence: bind -> restore in flight (deferred read) -> reset/empty store -> dirty save attempted -> assert NO write; then restore resolves -> assert the restored payload is what gets written. Also test refused/missing restore + dirty save.
4. Do NOT add a confirmation modal or refusal to key deletion. Do not change the rail-delete cascade's intended snapshot removal.

## Files to Read

- app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
- app/src/components/physic-paint/snapshot/studioScriptSnapshotTrackDelete.ts
- app/src/components/physic-paint/PhysicsPaintStudio.tsx (1040-1180 snapshot wiring; 3935-3990 track switch; 4245-4310 restore; 5100-5170 memory/purge ports)
- app/src/stores/efxPaintStore.ts (commitDeleteTrack ~485)
- app/src/components/physic-paint/hooks/useRotoTimelineActions.ts (deleteRotoFrame ~1974)
- app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts (delete-key-rail ~4190)
- .planning/quick/261023-ors-*/261023-ors-SUMMARY.md (approved cascade intent)
- Tests: studioScriptSnapshotController.test.ts, studioScriptSnapshotTrackDelete.test.ts, app/src/stores/trackDeleteLaws.test.ts

## Constraints

- Do NOT run the dev server or the Tauri app; the user runs it.
- pnpm only (never npm). Vitest via `vitest run` only (never watch).
- workflow.use_worktrees=false: execute sequentially on the current branch.
- Do not modify the user's project directly. If a live repro is needed, first copy it: `cp -R test.mce test.mce.bak` — and ask before deleting anything.
- Keep .planning artifacts in English.
- Out of scope: preact 11.0.2 (verified unrelated), the 261024-i51 baseline fixes (test/type-only), export solo semantics, performance work.
- The 16 KB snapshot content is NOT recoverable; no backup leg exists. Distinguish "source library scripts (intact)" from "applied per-rail script timeline (lost)".
- A first launch earlier today showed "Unknown physics paint layer" plus an empty Studio session; a full relaunch fixed it. That was a stale split-session state (parent realm reset while the Studio webview survived) and is NOT this bug.

## Acceptance Criteria

- RED->GREEN regression test proves the race and the fix.
- No save can be prepared before the current generation's restore settles.
- No empty payload overwrites a non-empty snapshot without an explicit purge/delete intent.
- Deleting a key no longer permanently removes its script from the snapshot; restore prunes it from the session, and undo can recover it.
- Full gates green:
  - `pnpm --filter efx-motion-editor run typecheck`
  - `pnpm --filter @efxlab/efx-physic-paint run check`
  - `pnpm --filter efx-motion-editor exec vitest run`
- Final report: root cause, the fix, what remains unrecoverable, and any follow-up (e.g. snapshot compaction/cleanup of entries for deleted keys).

## Eliminated

- "The loss is a deliberate rail-delete cascade" — refuted: the cascade removes ONLY the committed (layerId, trackId) key before the runtime teardown; the surviving rail's file was overwritten, not deleted. `studioScriptSnapshotTrackDelete.test.ts` stays untouched and green.
- "The source Scripts library was lost" — refuted by the proven evidence (five presets intact); only the applied per-rail timeline was lost.
- "Key deletion itself deletes the script store entry" — partially refuted: watercolor events stay in the store; the g4p apply-time prune removes BRUSH entries from the session by design. Save-time pruning was dropping the watercolor events from the file.

## Evidence

- timestamp: 2026-10-24T13:19:00Z
  checked: "RED run of the new studio-snapshot-empty-save controller suite on HEAD (before the fix)."
  found: "6 failed | 1 passed | 31 skipped. The first failure is the exact mechanism: after bind + restore (deferred read, still in flight) the empty store was encoded and write() received a SNAP1 buffer — header + block headers only, zero events — under identity {project-1, layer-1, track-1}."
  implication: "The rebind window can write an empty payload under the incoming identity. The other failures: refused/missing dirty saves wrote empty; key-deleted entries were pruned at save; restore-pruned and apply-pruned entries were dropped from the snapshot."
- timestamp: 2026-10-24T13:21:00Z
  checked: "GREEN run of studioScriptSnapshotController.test.ts after the controller fix."
  found: "38/38 passed (including the 7 new regression cells and the explicit-purge guard)."
  implication: "Settlement gate, empty-payload guard, retained-content union and the explicit-purge destructive path all hold."
- timestamp: 2026-10-24T13:22:00Z
  checked: "Full offline gates."
  found: "`pnpm --filter efx-motion-editor run typecheck` clean; `pnpm --filter @efxlab/efx-physic-paint run check` clean; `pnpm --filter efx-motion-editor exec vitest run` — 327 test files passed, 2 skipped; 5841 tests passed, 1 skipped, 96 todo."
  implication: "No regression in the existing suites; the app and package typechecks are clean."

## Resolution

- root_cause: >
  Two contributing mechanisms, both proven offline. (1) Restore-settlement
  race: `bind()` starts a new generation whose session stores are empty (the
  track-switch effect binds the incoming key and starts `restore()` without
  awaiting it). `saveNow()` and `flushNow()` were not gated on that
  generation's restore, and `markDirty()`'s `restoringCount` guard only
  covered the debounced path. A save prepared inside the window encoded the
  empty session under the INCOMING identity — the RED test reproduces a SNAP1
  buffer with zero events — overwriting the surviving rail's good file. When
  the restore then resolved, it seeded the store and set
  `lastSavedSignature` to the restored signature, so the empty file was never
  repaired. (2) Destructive save-time pruning: `prepareSave()` pruned
  watercolor events and brush frames to the live real-key frame set at SAVE
  time. Deleting a key therefore erased that key's script from the
  authoritative file; when every event was pruned, the payload became exactly
  the observed 162-byte header+IDs container. The 261023-g4p apply-time
  fail-closed brush prune removed the same entries from the session first, so
  even a correct save of the session would have persisted their absence.
- fix: >
  All in `studioScriptSnapshotController.ts`; no Studio wiring or store law
  changed. (1) `restoreSettledGeneration` is cleared by `bind()`/`reset()`
  and set in `restore()`'s `finally` for the current generation (including
  missing/refused/corrupt outcomes). `prepareSave()` returns null until it
  matches the current generation, so no save can be prepared across a rebind.
  (2) `prepareSave()` refuses a routine empty payload: an empty session
  proves nothing about the file. Only `persistAfterPurge()` passes
  `allowEmpty` + `sessionOnly` (the explicit, confirmed purge). (3) The
  controller retains the RAW decoded content per binding (and updates it after
  every successful write); routine saves now write the UNION of the session
  and that retained content. The session wins for every identity it still
  owns (edited strokes, recaptured frames), while entries removed by the
  restore-time prune or the g4p apply-time prune survive in the file. The
  explicit purge writes the session alone and replaces the retained
  baseline, so purged entries cannot be resurrected. (4) Save-time pruning is
  gone; restore-time pruning still seeds the session without the
  non-live-frame entries, so a deleted key's script cannot reappear in the
  session. The rail-delete cascade and the no-confirmation key-delete UX are
  untouched.
- verification: >
  RED first on HEAD: the new suite failed 6/7 (guard cell passed); the first
  failure shows `saveNow` during the in-flight restore writing a zero-event
  SNAP1 buffer under the incoming key. GREEN after the fix: controller suite
  38/38. Existing save-prune assertions were retargeted to the new law
  (deleted-key entries persist; saves still require a settled restore).
  Full gates: app typecheck clean, `@efxlab/efx-physic-paint` check clean,
  full app Vitest suite 327 files / 5841 tests passed. Live UAT pending — the
  user runs the app; the exact repro is the 2026-10-24 sequence on
  test.mce.
- residual: >
  The session, and therefore the Memory tab, still reflects the g4p
  fail-closed session law: after a key deletion the deleted key's BRUSH entry
  is pruned from the session (watercolor entries stay), while the
  authoritative snapshot keeps both via the retained union. A future restore
  in which the key is live again re-seeds them; within the same session the
  deleted key's script is intentionally absent from the UI. Follow-ups: (a)
  snapshot compaction of entries whose keys are permanently gone — a
  retained-only entry is not shown in the Memory tab, so the explicit purge
  has no UI handle on it; (b) a script painted and then deleted before its
  first successful save (narrow <800 ms debounce window after the last save)
  is still not recoverable, because retention only holds restored/written
  content; (c) the empty-payload guard leaves `isDirty()` true when a
  routine empty save is withheld, so the close flush waits its budget without
  writing (harmless).
- unrecoverable: >
  The original 16,512-byte snapshot of track
  c4868e73-2d89-43b9-9073-b9295c42ff2c was already overwritten to 162 bytes
  before this fix; there is no backup leg and the content cannot be
  reconstructed. The five Scripts-library presets were never at risk.
- files_changed:
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
