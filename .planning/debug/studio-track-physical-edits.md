---
status: fix-applied
trigger: |
  — cluster Studio, tracks ajoutées dans le Studio

  Debug: Studio physical edits fail on tracks added in the Studio.
  Symptom: in the Physics Paint Studio with several tracks, tracks added there reject physical edits:
  - Creating paint keys on such a track (add and insert) fails with: "Roto physical edit barriers failed. No state was changed."
  - Deleting keys works on track 1, then deleting on track "Paint 1" refuses, the rails can no longer be moved, with: "Roto physical record validation failed: PhysicPaintRotoRealKeyRecordCollection: malformed real-key record." and "Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay source snapshot does not match the original accepted command."
  - Onion skinning across multiple tracks is intermittent (works sometimes, not others).
  - Frame blending cannot be disabled on a new track, and frame-blending values cannot be set there.
  Timeline: noticed now while testing the finished quicks; edits on pre-existing tracks work until a second track is touched.
  Reproduction: in the Studio, add a second track, then (a) add/insert key on it, (b) delete keys on track 1 then delete on the new track, (c) move rails, (d) toggle/set frame blending on the new track, (e) observe onion across both tracks.
  Suggestion (not prescriptive): one suspected cause — a track added in the Studio yields a malformed real-key record and/or a stale replay source snapshot, and every later physical edit validates against it. First step before any patch: run the repro as a truth table {track created in the main app vs track created in the Studio} × {add/insert key, delete key, move rail, frame blending toggle/set, onion} × edit order (track 1 first, then the other), and report the matrix. Onion and frame blending are characterization rows only — split them into separate work if and only if they survive the root-cause fix.
  Context note: as of 2026-09-11 frame-blend mode is coerced to duplicate at every store entry and its UI section was removed; the per-track row blend button owns interpolation on/off. If a frame-blending control is visible again today, that is newer than this note — name the exact control meant before touching code.
  Guardrails: I run the live app — this is a Tauri/cross-webview path, so live or on-disk evidence is the verdict and unit probes are not admissible. Reuse the existing physical-edit coordinator and record-collection types; no new transport. Fix live first, regression tests after. ONE root cause, ONE fix, I retest.
created: 2026-10-04
updated: 2026-10-05
goal: find_and_fix
---

# Debug Session: studio-track-physical-edits

DATA_START

## Symptoms

### Expected behavior
Physical edits in the Physics Paint Studio work on every track, including tracks added inside the Studio. This covers: add/insert paint key, delete key, move rails, frame-blending toggle/set, onion skinning across tracks.

### Actual behavior
In the Physics Paint Studio with several tracks, tracks added there reject physical edits:

1. **Add/insert key on a Studio-added track fails** with:
   `Roto physical edit barriers failed. No state was changed.`
2. **Delete-key cascade then hard lock**: deleting keys works on track 1, then deleting on track "Paint 1" refuses. After that the rails can no longer be moved. Errors:
   - `Roto physical record validation failed: PhysicPaintRotoRealKeyRecordCollection: malformed real-key record.`
   - `Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay source snapshot does not match the original accepted command.`
3. **Onion skinning across multiple tracks is intermittent** (works sometimes, not others).
4. **Frame blending cannot be disabled on a new track, and frame-blending values cannot be set there.**

### Error messages (verbatim)
- `Roto physical edit barriers failed. No state was changed.`
- `Roto physical record validation failed: PhysicPaintRotoRealKeyRecordCollection: malformed real-key record.`
- `Roto physical edit failed (parent-rejection): Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay source snapshot does not match the original accepted command.`

### Timeline
Noticed now while testing the finished quicks. Edits on pre-existing tracks work until a second track is touched.

### Reproduction
In the Studio, add a second track, then:
- (a) add/insert key on it
- (b) delete keys on track 1 then delete on the new track
- (c) move rails
- (d) toggle/set frame blending on the new track
- (e) observe onion across both tracks

## Mandated first step (before any patch)

Run the repro as a truth table and report the matrix:

`{track created in the main app vs track created in the Studio}` × `{add/insert key, delete key, move rail, frame blending toggle/set, onion}` × `edit order (track 1 first, then the other)`

Onion and frame blending are **characterization rows only** — split them into separate work if and only if they survive the root-cause fix.

## Suggested cause (NOT prescriptive — one hypothesis to test)
A track added in the Studio yields a malformed real-key record and/or a stale replay source snapshot, and every later physical edit validates against it.

## Context note (2026-09-11 — verify before touching frame-blending code)
As of 2026-09-11 frame-blend mode is coerced to `duplicate` at every store entry and its UI section was removed; the per-track row blend button owns interpolation on/off. If a frame-blending control is visible again today, that is newer than this note — **name the exact control meant before touching code.**

## Guardrails (hard constraints)
- User runs the live app. This is a Tauri/cross-webview path: **live or on-disk evidence is the verdict; unit probes are not admissible.**
- Reuse the existing physical-edit coordinator and record-collection types. **No new transport.**
- **Fix live first, regression tests after.**
- **ONE root cause, ONE fix.** User retests.

DATA_END

## Current Focus

- hypothesis: **CONFIRMED (cluster A) — fix applied, TDD RED→GREEN, awaiting live retest.**
- fix: carrier-preserving payload rebuilds (spread the payload, never hardcode `bytes`) at 7 sites + parent-side no-bytes filter:
  - `useRotoPhysicalEditCoordinator.ts` `clonePayloadAtFrame` / `cloneRecords` / `recordsToApplyPayloadRecords` / `buildReplayRecords`
  - `physicsPaintRotoPhysicalResolver.ts` `clonePayloadAtFrame` + group-override mover
  - `physicsPaintRotoPlayScriptController.ts` `clonePhysicalPayload`
  - `physicPaintBridge.ts` `applyPreparedPhysicPaintPayload`: `prepareRotoPhysicalRealKeyFrames` now receives only records with inline bytes (reference-only records heal at the launch door per missing-content doctrine)
  - Observability: the previously silent interpolation pre-staging barrier (coordinator ~1990) now logs which sub-check failed.
- TDD: RED test `stages and sends an edit when the collection holds a reference-only record` failed with the verbatim live error (`Roto physical record validation failed: PhysicPaintRotoRealKeyRecordCollection: malformed real-key record.`); GREEN after fix.
- verification: `vitest run` targeted suites 568 passed / 1 skipped (coordinator 76, resolver 190, playScript 149, bridge 168); `tsc --noEmit` clean except the 3 pre-existing `view/` errors; `PhysicsPaintStudioView.test.ts` fails identically at HEAD baseline (pre-existing `_setPaintMarkDirtyCallback` wiring error, unrelated).
- next_action: user live retest of rows (a)-(c) + frame-blending row; onion/frame-blending remain characterization rows — split only if they survive. Cluster B below is the NEXT cycle if cross-track-move rows still fail.
- specialist_hint: typescript
- second open cause (cluster B, NOT fixed this cycle per ONE-root-cause guardrail): cross-track move goes through `physicPaintStore.moveTrackItems` called directly from `PhysicsPaintWorkflowStrip.tsx` (bypasses the coordinator, produces no capture events) and leaves child/parent realms structurally diverged → subsequent edits fail at `expandRotoPhysicalEditRecordRefs` → settlement mismatch → later `revision became stale before commit`.

## Truth table (live captures, 2026-10-04 — VERDICT)

Files: `/tmp/efx-physical-edit-studio.json`, `/tmp/efx-physical-edit-main.json`.

| Track | Origin | Ops | Result |
|---|---|---|---|
| Track 1 (`46d6f9dd`) | default (createEfxPaintDocument) | set-interpolation | PASS (payload-send + apply-accepted ×2; one transient barrier at 20:57:28 then success) |
| Paint 1 (`e6adda97`) | Studio-added, pre-existing | set-interpolation ×5, spacing-on-set ×2, move-group ×6, delete-key ×1 | ALL FAIL — 5× undiagnosed pre-staging barrier, 9× `malformed real-key record` (all on record `ae0c3774` @ appFrame 0: current payload = media-only, staged payload = `bytes: undefined`), 1× group-lifecycle stale |
| Paint 2 (`c81807c5`) | Studio-added, fresh | paste-key, move-key-rail ×4, insert-empty-segment, set-interpolation, spacing-on-set ×2, delete-rails | 12/12 PASS (21:04:08–21:04:55) |
| Paint 2 AFTER cross-track round trip (→ Track 1 → back) | same | move-key-rail ×6, delete-rails | ALL FAIL — 6× settlement-mismatch (payload-send but parent never ran `applyPhysicPaintRotoPhysicalMap`), 1× parent `Roto physical revision became stale before commit` (expected `physical-762-d35d2e60`) |

**Refutation:** "track created in the Studio = malformed" is false — fresh Studio track passed 12/12. Failure correlates with (A) holding a reference-only record in the collection, and (B) a cross-track round trip having occurred.

## Root cause (cluster A — primary, this cycle)

`clonePayloadAtFrame` (coordinator:597), `cloneRecords` (coordinator:610), `recordsToApplyPayloadRecords` (coordinator:970), the replay-record rebuild (coordinator:~2460), resolver `clonePayloadAtFrame` (resolver:482), resolver group-override mover (resolver:136-147), and playScript `clonePhysicalPayload` (playScriptController:1818) all rebuild payloads as `{frameIndex, appFrame, bytes: payload.bytes, width?, height?}` — dropping `media`. A reference-only record (legal per 52.2-02 D-07 / quick-260913-52r G) is thereby rebuilt with NEITHER carrier; `isPhysicPaintRotoRealKeyPayload` (`hasBytes === hasMedia` → false) rejects it → `malformed real-key record` → blanket barrier "No state was changed."

Post-fix gate: parent-side `prepareRotoPhysicalRealKeyFrames` (rotoCanvasFrames:93) throws on records without webp bytes; must skip no-bytes records in `applyPreparedPhysicPaintPayload` (bridge:626-628) per missing-content doctrine.

Observability gap: 5 set-interpolation barriers fail at coordinator:1973-1993 with no `logDiagnostic` — add a diagnostic line there.

## Evidence

- timestamp: 2026-10-04T (session resume) — all three verbatim errors mapped end-to-end: coordinator barrier/parse (`useRotoPhysicalEditCoordinator.ts` record-validation catch), transport, parent bridge reject (`physicPaintBridge.ts` `applyPhysicPaintRotoPhysicalMap`, replay-snapshot check ~line 1730, lease validation ~1668).
- timestamp: 2026-10-04 — track-creation paths: `efxPaintStore.addTrack` (mounts per-track runtime, `rotoPhysical: null`); the ONLY production caller is the Studio `handleAddTrack` (`PhysicsPaintStudio.tsx`). The truth table's "created in main app" axis is therefore the default track from `createEfxPaintDocument` vs a Studio-added track.
- timestamp: 2026-10-04 — capture instrumentation wired (measure-only, app-written /tmp per feedback_app_written_capture_files):
  - NEW `app/src/lib/physicalEditCapture.ts` → `/tmp/efx-physical-edit-studio.json` + `/tmp/efx-physical-edit-main.json`.
  - `useRotoPhysicalEditCoordinator.ts`: execute-enter / execute-rejected-* guards, barrier-staged-records-null, record-validation-failed (staged+current shape summaries), payload-send (payload.trackId vs lease trackId), edit-failed.
  - `PhysicsPaintStudio.tsx`: concise-message + diagnostic status ports with activeTrackId; track-added / track-add-failed.
  - `physicPaintBridge.ts`: apply-received, apply-reject (payload vs lease vs parent activeTrackId), replay-snapshot-mismatch (live vs expected record summaries), apply-accepted.
  - `tsc --noEmit`: no errors in touched files (3 pre-existing errors in `view/` tool-type files only).
- timestamp: 2026-10-04 — truth table built from both capture files (matrix above). All 9 `record-validation-failed` events share record `ae0c3774-2602-4b57-a0b9-b36b9325dec3` @ appFrame 0: current = `{frameIndex,appFrame,media,width,height}` (hasMedia), staged = `{frameIndex,appFrame,bytes,width,height}` with `bytes` undefined (hasBytes false, hasMedia false → validator rejects).
- timestamp: 2026-10-05 — root cause narrowed to cluster A (carrier-dropping payload rebuilds, seven sites) + named cluster B (cross-track `moveTrackItems` bypass, separate cause, deferred per ONE-root-cause guardrail).
- timestamp: 2026-10-05 — TDD RED: new test `stages and sends an edit when the collection holds a reference-only record` failed with the verbatim live diagnostic `Roto physical record validation failed: PhysicPaintRotoRealKeyRecordCollection: malformed real-key record.`
- timestamp: 2026-10-05 — fix applied at the 7 rebuild sites + bridge no-bytes filter + interpolation-barrier diagnostics. GREEN: 568 passed / 1 skipped across coordinator/resolver/playScript/bridge suites; `tsc --noEmit` clean apart from the 3 pre-existing `view/` errors; `PhysicsPaintStudioView.test.ts` failure reproduced at HEAD baseline (pre-existing, unrelated). Live retest pending (user).
