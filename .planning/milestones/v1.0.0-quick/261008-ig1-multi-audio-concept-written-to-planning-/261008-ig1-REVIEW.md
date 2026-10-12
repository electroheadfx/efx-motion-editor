---
phase: quick-261008-ig1-multi-audio-concept
reviewed: 2026-10-08T00:00:00Z
depth: quick
files_reviewed: 37
files_reviewed_list:
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/projectStore.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/physicsPaintAudioController.ts
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/soundBandGeometry.ts
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts
  - app/src/components/timeline/TimelineRenderer.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/documentSoundPeaks.ts
  - app/src/lib/documentSoundGates.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/frameMap.ts
  - app/src/lib/efxPaintAudioEngine.ts
  - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts
  - app/src-tauri/src/lib.rs
findings:
  critical: 0
  high: 1
  medium: 2
  low: 4
  info: 6
  total: 13
status: issues_found
---

# Phase Quick 261008-ig1: Code Review Report

**Reviewed:** 2026-10-08
**Depth:** quick (priority-checklist driven; full reads of the new/changed audio surfaces)
**Files Reviewed:** 37 in scope (20 primary source files deep-read; remainder cross-checked by diff/grep)
**Status:** issues_found

## Summary

The multi-audio core slice (commits `fa092b5e`, `be8d6375`, `6a9a2b16`) implements the two-identity law (`clip.id` placed / `clip.sourceId` imported file) correctly at every keying site audited: peaks cache, playback buffers, gallery dedupe, selection, transport, frameMap, canonical revision, and store doors. Parsing is fail-closed with no backward-compat shims. All five deferred-scope items are untouched. The Rust D-04 gate passes and deep-asserts a multi-clip list. Alt+drag duplication produces a fresh UUID with verbatim source identity and never mutates the original. New code is signals-only Preact with handler-written selection.

One HIGH finding: the two-step Remove arm is never disarmed by selection changes, so an armed Remove can delete a different clip than the one the user armed — and `audios` removal carries no undo descriptor by design. Two MEDIUMs: decode-error copy is unreachable when the list is non-empty and selection is null, and duplicate-clip-id integrity is not enforced anywhere in the fail-closed layer.

**Verification evidence:** 437 vitest tests across 16 in-scope test files pass (`app/node_modules/.bin/vitest run`); `cargo test --lib physics_paint_launch_context_round_trips_the_audios_list` → 1 passed, 0 failed.

---

## Priority Category Statements

1. **Identity overload (`id` vs `sourceId`):** NO FINDINGS. Audited all keying sites: `documentSoundPeaks.ts` buffers keyed `sound.id`, peaks keyed `sound.sourceId`, in-flight keyed `sound.id`; gallery re-register dedupes by sourceId (`projectStore.ts:729-786`); selection/transport/store doors keyed `clip.id`; `frameMap.ts` peaks read via `documentSound.sourceId`; `toDocumentSoundAudioTrack` carries `id=sound.id`, `audioAssetId=sourceId`. No buffer/transport keyed by sourceId; no peaks/gallery keyed by id.
2. **Preact reactivity violations:** NO FINDINGS in new code. No `useState`; selection written only in event handlers (band pointer-down, modal row click, dblclick, reveal request, gesture settle, `confirmRemove`); no render-body signal writes (the ghost-preview signal-in-ref idiom is sanctioned narrow-read pattern); effect deps identity-stable (reveal deps only `revealRequest.nonce` + `useCallback([])` `updateScrollbar`); peaks-ensure effect terminates (in-flight Set guard + cache-hit early return) and never writes a store it reads.
3. **Fail-closed parse regressions:** Functionally sound, one dead-code LOW below. `sound` member throws (`efxPaintDocumentParsers.ts`); `SOUND_KEYS`/`AUDIO_LIST_KEYS`/`DOCUMENT_KEYS` reject unknown members; absent `audios` → `[]` is the approved A2 normalization, not a shim.
4. **Scope leaks:** NO FINDINGS. `documentAudio` remains a 3-member singleton fed from `audios[0]` with the boundary comment at `physicPaintBridge.ts:3904-3908`; `efxPaintAudioMonitor.ts` untouched (git diff empty); no `.mce` expansion, no export-mixer/playback-mix retarget, no master/limiter lane.
5. **Rust D-04 gate:** PASSES and deep-asserts every member of a multi-clip list (see INFO-01). Verified by running the test.
6. **Alt+drag correctness:** Functionally correct; one LOW edge below. Fresh `crypto.randomUUID()` id, verbatim `sourceId`/`relativePath`, spread-copy (original never mutated), cmd/alt/shift exclusions run before the alt branch, trim handlers have no alt branch, settle routes `'duplicate'` to the clone-append door.
7. **General correctness:** Clamps verified (1-frame min span, `start >= 0`, parent-end floored for overhanging clips, replace-path outFrame clamp with inFrame follow). One HIGH (stale Remove arm) and supporting LOWs below.

---

## High

### HIGH-01: Stale two-step Remove arm survives selection changes — removes the WRONG clip, no undo

**File:** `app/src/components/physic-paint/view/physicsPaintAudioController.ts:344-354` (arm/confirm), `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx:287` (row click), `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4784+` (selection writers)
**Issue:** `requestRemove` arms a signal; `confirmRemove` removes **whatever clip is selected at confirm time**, not the clip that was armed:

```ts
const confirmRemove = () => {
  removeArmed.value = false;
  if (selectedId === null || !sound) return;
  const result = removeSound(layerId, selectedId);
  if (result.ok) selectedSoundId.value = null;
};
```

Nothing disarms on selection change: modal list row `onClick={() => onSelectSoundClip(clip.id)}` (PhysicsPaintAudioModalView.tsx:287) does not call `disarmRemove`; `withDisarm` wraps only Import/Replace; the Studio's selection writers (`onOpenDocumentSound`, band deselect, reveal, gesture settle) never call it either. The dialog is no-backdrop, so a band pointer-down in the strip also re-targets `soundSelection` while the modal is open. Repro: select clip A → click `Remove` (armed) → click clip B in the list (or press a band) → click `Confirm remove?` → **clip B is deleted**. Compounding: `setDocumentAudios` intentionally registers **no undo descriptor** (display-class member), so the wrong-clip deletion is unrecoverable.
**Fix:** Disarm on any selection change. Either (a) call `audioModalController.disarmRemove()` in every Studio/modal selection writer, or (b) — more robust — stamp the arm with the clip id and make `confirmRemove` fail closed unless `armedClipId === selectedId`:

```ts
const armedClipId = useSignal<string | null>(null);
const requestRemove = () => { if (sound) { removeArmed.value = true; armedClipId.value = sound.id; } };
const confirmRemove = () => {
  removeArmed.value = false;
  const armed = armedClipId.value; armedClipId.value = null;
  if (!sound || armed === null || armed !== selectedId) return;
  ...
};
```

---

## Medium

### MED-01: Decode-error copy invisible when list is non-empty and selection is null

**File:** `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx:254-331`
**Issue:** `errorText` (decode failure copy) is rendered only in the empty-state branch (`audios.length === 0`, lines 258-263) or the `sound !== null` branch (lines 327-331). When `audios.length > 0` and `sound === null`, the modal renders the list with **no error surface**. Reachable path: click ruler/band empty space → selection null (dialog is no-backdrop, selection persists) → `Import` → decode fails → `reportDecodeError()` → `decodeError` true but nothing renders. The user gets silent failure.
**Fix:** Render `errorText` unconditionally when `decodeError` is true (hoist it above the branch), e.g. place the error block after the list regardless of `sound`:

```tsx
{controller.decodeError && (
  <p className="audio-modal-error" role="alert">{errorText}</p>
)}
```

### MED-02: Duplicate clip `id` integrity unenforced in the fail-closed layer (judgment call)

**File:** `app/src/stores/efxPaintStore.ts:1388-1400` (`patchDocumentSound`), `efxPaintDocumentParsers.ts:523-529` (`parseDocumentAudios`)
**Issue:** *Judgment call.* The parser rejects unknown members but never checks that `audios[].id` values are unique — unlike duplicate track ids, which are rejected at `efxPaintDocumentParsers.ts:582-588`. `setDocumentAudios`/`addDocumentSound` likewise accept duplicate ids, and `patchDocumentSound` takes `Partial<DocumentSoundClip>`, which **includes `id`** — a patch could retarget a clip's identity. Probability is low (`crypto.randomUUID()` everywhere), but `id` is the linchpin for selection, transport, buffer keys, and per-clip store doors; a duplicate silently makes `audios.find` resolve the first match, so edits land on the wrong clip (same blast radius as HIGH-01).
**Fix:** (a) reject `id` in the patch path (strip or fail on `patch.id`), (b) add a uniqueness check in `parseDocumentAudios` mirroring the track-id check, and (c) optionally a duplicate-id guard in `addDocumentSound`.

---

## Low

### LOW-01: Dead `AUDIO_LIST_KEYS` tripwire — never throws, comment claim is false

**File:** `app/src/efx-paint/document/efxPaintDocumentParsers.ts:558-562`
**Issue:** The loop `for (const key of ['audios', 'sound'])` is unreachable: `hasOnlyKeys(obj, DOCUMENT_KEYS, ...)` at line 552 already rejects `sound` (it was removed from `DOCUMENT_KEYS`), so the tripwire can never fire. The accompanying comment ("fails loudly if the two sets ever diverge") is false — the loop hardcodes `['audios','sound']` and does not derive from the sets, so it would not detect divergence anyway.
**Fix:** Delete the dead loop, or rewrite it as a real invariant (e.g. assert `AUDIO_LIST_KEYS` and the parse entry agree) with an accurate comment.

### LOW-02: `audioModalTarget` value ('list' | clipId) is write-only

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4784+`
**Issue:** *Judgment call.* Only `target !== null` (open boolean) is ever read; the `'list'` vs clipId distinction never reaches the view. The "two entry points" distinction from the spec is realized solely via `selectedSoundId` side effects — so if a valid selection lingers when the header launcher opens the modal, it behaves exactly like a dblclick (opens on that clip) rather than list mode. May or may not match spec intent.
**Fix:** Either plumb the target into the view (force list mode when `target === 'list'` by not auto-resolving selection) or drop the string value and keep a boolean, updating the comment.

### LOW-03: Sub-cell alt+drag arms the duplicate but rounds to delta 0 — clone lands exactly on the original

**File:** `app/src/components/physic-paint/view/soundBandGeometry.ts:37-39` (`SOUND_STAIN_ARM_PX = 4`), gesture math in `PhysicsPaintWorkflowStrip.tsx`
**Issue:** *Judgment call.* Arm threshold is 4px but the cell pitch is 18px, so a 5–8px alt+drag arms `'duplicate'` while `deltaFrames = Math.round(dx / 18)` = 0. The clone is appended at the same `startFrame`, exactly overlapping the original; list-order z means the clone paints on top, making the original unclickable until the clone is moved. Not data loss (selection lands on the clone, original intact).
**Fix:** Either require `|deltaFrames| >= 1` (or `|dx| >= cellWidthPx / 2`) before committing a duplicate, or accept a zero-offset duplicate as intended and document it.

### LOW-04: Reveal effect parks on short content with no extent-retry dependency

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:3914-3929`
**Issue:** *Judgment call.* When `scrollWidth < (frame + 1) * cell`, the effect returns without flipping the handled-nonce and has no dependency on content extent — unlike the sibling timelineOpen effect, which deps on `rotoPhysicalCells.length` to retry when content grows. A reveal requested before the strip has laid out its full width stays parked until a new nonce arrives. A test pins the park as accepted behavior, so this may be deliberate.
**Fix:** If retry-on-extent is wanted, add the extent (e.g. `props.frameCount` or a width state) to the deps array so a parked nonce re-evaluates; otherwise note the accepted-park contract in the comment.

---

## Info

### INFO-01: Rust D-04 gate passes; note on what its teeth cover

**File:** `app/src-tauri/src/lib.rs:1059-1140+`
**Note:** `physics_paint_launch_context_round_trips_the_audios_list` verified running (`cargo test --lib` → 1 passed, 0 failed): deep-asserts all 13 members of two clips, distinct ids, shared sourceId. Because `PhysicsPaintLaunchContext.document` is `Option<Value>` (opaque JSON), serde cannot drop nested members — the gate's teeth are field-existence level today, and it will catch a future regression to a typed struct. Satisfies the specified requirement; no action needed.

### INFO-02: Scope checks all clean

**File:** `app/src/lib/physicPaintBridge.ts:3904-3922`, `app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts`
**Note:** `documentAudio` singleton fed from `audios[0]` with the required boundary comment present; `efxPaintAudioMonitor.ts` untouched by the quick (git diff empty), preparedTrackIds/clip leg unchanged; no `.mce`, export-mixer, playback-mix, or master-lane changes in the diff.

### INFO-03: Pre-existing code smells in a touched file (not introduced by this quick)

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4207` (`console.log`), `:633-638` (`as any`)
**Note:** Present before this quick's commits; flagged only for awareness, no action required in this task.

### INFO-04: Dead controller API — `volumeDraft` / `previewGainInput`

**File:** `app/src/components/physic-paint/view/physicsPaintAudioController.ts:92, 98, 266, 286-288, 412-415`
**Note:** The gain slider was replaced by a `NumericStepper` in the prior quick (261008-ful); grep shows no non-test callers of `previewGainInput` (production or view). `previewGain` is still consumed by the modal for the stepper's display value. Consider removing the draft plumbing (`volumeDraft`, `previewGainInput`, `previewGain`'s draft branch) in a follow-up.

### INFO-05: `handleConfirmAudioPicker` silently ignores non-ok apply results

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (picker confirm handler, ~4800s)
**Note:** If `applyReplacedSource`/`applyImportedSource` returns `{ok:false}` (e.g. `unknown-clip` after a mid-flight deselect), the failure is swallowed — no error copy, no `reportDecodeError`. Low likelihood given the modal gates, but the controller exposes `reportDecodeError`/`decodeError` as the sanctioned surface.

### INFO-06: Security — no findings

**Note:** No injection surfaces in scope (no SQL/shell/eval; paths are package-relative and guarded at save/load by per-clip `relativePath` checks in `efxPaintPersistence.ts`); no hardcoded secrets; fail-closed parsing rejects unexpected shapes; no auth surface. Explicitly: **no security vulnerabilities found.**

---

## Verification Evidence

- `app/node_modules/.bin/vitest run` over 16 in-scope test files: **437 tests passed** (never watch mode, per project rule).
- `cargo test --lib physics_paint_launch_context_round_trips_the_audios_list`: **1 passed; 0 failed; 61 filtered out**.
- Diff-scope check: no source files outside the 37-file list were modified by the three commits (test adaptations were mechanical `sound` → `audios` shape updates).

---

_Reviewed: 2026-10-08T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
