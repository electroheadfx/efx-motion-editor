---
phase: 261101-o2m-add-a-draft-mode-to-the-move-edit-stroke
reviewed: 2026-11-01T18:21:57Z
depth: quick
files_reviewed: 13
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
  - app/src/components/physic-paint/view/scriptStrokeEdition.ts
  - app/src/components/physic-paint/view/strokeSettingsModel.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
  - app/src/lib/autoSave.ts
  - app/src/lib/exportEngine.ts
  - app/src/lib/physicPaintDraftMode.ts
  - app/src/main.tsx
  - app/src/stores/projectStore.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 261101-o2m: Code Review Report

**Reviewed:** 2026-11-01T18:21:57Z
**Depth:** quick
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Reviewed the session-only Draft mode added to the Move/Edit Stroke settings dialog across the Studio realm
(`PhysicsPaintStudio.tsx`, the snapshot controller, the stroke-edition signals, the settings dialog) and the main
realm (`physicPaintDraftMode.ts`, `autoSave.ts`, `projectStore.ts`, `exportEngine.ts`, `main.tsx`).

The core design holds up: the cross-realm payload is validated, `setDraftMode(false)` refuses over dirty pixels, the
single `prepareSave` deferral covers every snapshot writer, the heartbeat is a narrow lifecycle effect (not a render
body), handler reads go through `.peek()`, the dirty flag clears before the mode flips, and the five intended exits
(dialog close, frame change, play, export, save) all route through `settleDraftScript`. No hardcoded secrets,
`eval`, or debug artifacts were found.

The one blocking defect is the **track-switch path**, which is not one of the five exits: an in-place track change
during a dirty Draft captures the frozen sheet into the outgoing key and then wipes the outgoing Draft script because
the outgoing `saveNow()` is deferred to a no-op. The remaining findings are races around the close/settle edges, one
persistent display-only preference, unhandled promise rejections, and a fragile init ordering.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Track switch during a dirty Draft writes the frozen sheet to the outgoing key and drops the outgoing Draft script

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5370-5407` (with `:5385`, `:5396`, `:5407`), entry points
`:6218`, `:6228`, `:6565`, `:6580`, `:9728`, `:9779`; `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:797-800`,
`:1021-1027`; `app/src/components/physic-paint/view/aquarelleRecordState.ts:1555-1572`

**Issue:** The in-place track-switch commit effect has no Draft handling. With `draftMode === true` and
`draftPixelsDirty === true` (any Draft move/appearance/transform/delete), a track change runs this sequence:

1. `aquarelleFlushCaptureRef.current?.(outgoingTrackId)` (`:5385`) snapshots the **live engine sheet** — which under
   Draft is the frozen pre-Draft render — and commits it to the outgoing key's frame cache. That is precisely the
   "new script against the frozen pixel sidecar" pair the Draft gate exists to prevent; this capture path has no
   Draft check (`AquarelleCanvasLayer.tsx:675-685`).
2. `void studioScriptSnapshot.saveNow()` (`:5396`) is expected to persist the outgoing script before the reset (the
   comment at `:5380-5384` says exactly that), but `saveNow()` is `prepareSave()` (`studioScriptSnapshotController.ts:1021-1027`)
   and `prepareSave` returns `null` while `deps.shouldDeferSave()` is true (`:800`). The save is silently skipped, no
   retry is armed, and the deferred `markDirty()` call is also gated (`:921`).
3. `resetAquarelleRecordState()` (`:5407`, defined at `aquarelleRecordState.ts:1555-1572`) then clears every session
   script buffer for every frame, and `rotoEditBuffer.resetForLaunch()` clears the undo buffer, so the Draft edits
   cannot be recovered.

The result is data loss of the committed Draft script plus a stale pixel sidecar, from a normal user action (row
click, cross-track frame click, rail click, add/duplicate track, blend toggle). The controller's own comment scopes
the accepted loss to "a crash mid-Draft"; this is not a crash. Note the design intends these switches to be safe:
`handleSelectTrackFrame` even navigates afterwards, and if that navigation's settle wins the race the pixels are
corrected but the outgoing script is still unsaved because the reset has already run.

**Fix:** Make the track switch a sixth gated exit at every entry point (or centrally in the commit path):

```ts
// in onSelectTrack / handleSelectTrackFrame / handleSelectTrackRail /
// handleAddTrack / handleDuplicateTrack / handleToggleBlend
const switchTrack = async (trackId: string) => {
  if (draftMode.peek() || draftPixelsDirty.peek()) {
    const settled = await settleDraftScript();
    if (!settled) return;          // fail closed: stay on the outgoing track
  }
  setActiveTrackId(layerId, trackId);
};
```

and add a defense in the commit effect so the destructive tail can never run dirty:

```ts
if (sessionNeedsCommit) {
  if (draftMode.peek() || draftPixelsDirty.peek()) return; // never capture/reset dirty pixels
  ...
}
```

`aquarelleFlushCapture` should additionally refuse when `draftMode.peek() || draftPixelsDirty.peek()` (same guard as
`:5607`), so no future caller can commit a frozen sheet.

### Warnings

### WR-01: The Studio-close Draft refusal is silent, so the close button appears dead

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:3996-3998`; `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:39-45`

**Issue:** The close flush throws `Draft recompute pending — turn Draft off before closing the Studio.`, but
`usePhysicsPaintCloseFlush` catches it and only calls `console.error('[PhysicsPaintStudio] Could not flush pending
Roto pixels before close', error)`. `event.preventDefault()` has already run, so the window simply does not close and
the user sees a dead close button with no explanation. Combined with WR-02 (Draft left ON with the sheet closed),
the only exit message the user would need is the one being swallowed.

**Fix:** Surface the refusal: call `setLastError(message)` / `setApplyStatus('error')` with the thrown message before
rethrowing, and render it in the Studio (status capsule or a persistent banner). The window must still stay open.

### WR-02: Deleting the last stroke auto-closes the sheet before the delete marks pixels dirty, and its own close settle is refused

**File:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts:760-767`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:8259-8261`, `:8276-8282`, `:5128-5133`; `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:531-545`

**Issue:** `beginAquarelleDeleteEdit` mutates the script and immediately calls `setAquarelleSelectMode(false)` when the
frame's last stroke is gone (`aquarelleStrokeSelection.ts:767`). That closes the settings sheet, and the dialog's close
effect calls `bundle.settleDraft()`. At that moment the delete handler has already run `setAquarelleDeleteInFlight(true)`
(`:8261`, the same shared flag as `isAquarelleScriptEditInFlight`), so `settleDraftScript` hits
`if (... || isAquarelleScriptEditInFlight()) return Promise.resolve(false)` (`:5128-5133`) — a silent refusal with no
message and no retry. The delete's Draft branch then runs `setDraftPixelsDirty(true)` (`:8278`) after its await.

Net state: `draftMode === true`, `draftPixelsDirty === true`, the settings sheet is closed (so the Draft switch is
unreachable), autosave and the snapshot writer stay deferred, and the Studio close is refused (WR-01). Recovery exists
(frame navigation, play, save, or re-entering Move/Edit with an empty list — `keepOpenOnEmpty` keeps the strip
reachable), but nothing tells the user that.

**Fix:** Mark the draft pixels dirty inside the Draft delete before the script commit/auto-close (so no close race can
observe a clean flag), and make the dialog-close settle retry once the in-flight flag clears, or defer the auto-close
until the delete settles:

```ts
// in the dialog close effect
if (wasOpen && !open) {
  void bundle?.settleDraft?.().then((ok) => { if (!ok) scheduleRetrySettle(); });
}
```

### WR-03: Stale `draftMode.peek()` reads across the durable-base await can end with Draft OFF and pixels dirty

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:8256/8271/8278` (delete), `:8355/8372/8382` (move), `:8456/8458/8467` (appearance), `:8550/8552/8570` (transform)

**Issue:** Each handler reads `const draft = draftMode.peek()` and then awaits
`ensureAquarelleDurableBaseRef.current(playFrame)` (which can take a real bake). During that window an exit can run
`settleDraftScript()`: the handler holds no in-flight flag on the Draft path, so the settle succeeds, writes
`setDraftPixelsDirty(false)` and `setDraftMode(false)`. The handler then resumes, applies the script edit, and — using
the stale `draft === true` — calls `setDraftPixelsDirty(true)` and returns without re-rendering. The final state is
`draftMode === false` with stale canvas pixels and `draftPixelsDirty === true`, which violates the stated invariant
(`draftMode === false ⇒ clean pixels`, asserted at `scriptStrokeEdition.ts:157-161`), keeps `shouldDeferSave` true and
the cross-realm heartbeat active, so autosave and snapshot writes stay blocked with no visible cause. The same class of
race applies to the delete handler at `:8256-8278`. (`handleAquarelleStepStroke` `:8629` and
`handleAquarellePlaceStroke` `:8693` read with no preceding await and are not affected.)

**Fix:** Re-read the mode after the await and fall through to the Live path when it turned off:

```ts
await ensureAquarelleDurableBaseRef.current(playFrame);
const draft = draftMode.peek();   // read AFTER the await
...
if (draft) { ... setDraftPixelsDirty(true); return true; }
setAquarelleScriptEditInFlight(true);
// Live reset + apply
```

### WR-04: The cache-eye hidden state is never reset, so the committed sheet can stay invisible for the session

**File:** `app/src/components/physic-paint/view/scriptStrokeEdition.ts:171-177`; `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:957-960`; `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx:194-204`

**Issue:** `frozenCacheVisible` defaults to `true` and is only written by the strip's eye button. Nothing resets it when
the sheet closes, when Move/Edit exits, on a track or frame change, or on a launch replacement. A user who hides the
committed sheet and then closes the sheet leaves the `.aquarelle-cached-base-hidden` class in place: the frame's
committed pixels are invisible for the rest of the session, with no visible control to restore them unless they reopen
the watercolor Move/Edit sheet and press the eye. The signal is documented as display-only, so this is not data loss —
it is a persistent, confusing display defect.

**Fix:** Reset it at the surface-exit choke point (the same place D-07 resets Draft, `aquarelleStrokeSelection.ts:345`)
or in the dialog close effect, and consider scoping it to an active Draft session:

```ts
if (on && !was) { setDraftMode(false); setFrozenCacheVisible(true); }
```

### WR-05: Unhandled promise rejections on the new async seams

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:10104`, `:10107`, `:5185`; `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:537`, `:925`, `:934`

**Issue:** The project rule is "no unhandled rejections", but:
- `publishStudioDraftMode()` awaits `import('@tauri-apps/api/event')` and `emitTo(...)`, both of which can reject; the
  heartbeat effect calls it with bare `void` (`:10104`, `:10107`), so a failing transport produces an unhandled
  rejection every 5 s.
- `void bundle?.settleDraft?.()` (`:537` dialog close, `:925` OFF click) and `void settleDraftScript().then(...)`
  (`:5185` play wrapper) have no rejection handler. `settleDraftScript` has a `finally` but no `catch`, so a throwing
  `ensureAquarelleDurableBaseRef`/`applyAquarelleTimeline` escapes.
- `void bundle.armDraft().then((armed) => { if (armed) setDraftMode(true); })` (`:934`) has no rejection handler.

**Fix:** Make `publishStudioDraftMode` never reject (wrap the import/emit in `try/catch`, log once), and attach
`.catch` at each call site that surfaces the error through `setLastError`/`setApplyMessage`:

```ts
void publishStudioDraftMode(active).catch((error) => console.warn('[Draft] publish failed', error));
void bundle.settleDraft?.().catch((error) => setLastError(String(error)));
```

### WR-06: `main.tsx` awaits the new bridge mid-chain; one failure kills every later bridge install and `mountShortcuts()`

**File:** `app/src/main.tsx:107-143` (new call at `:115`)

**Issue:** `await installPhysicPaintDraftModeListener();` was inserted before `mountShortcuts()` and the nine existing
bridge installs. `installPhysicPaintDraftModeListener` awaits `import('@tauri-apps/api/event')` and two `listen()`
calls; if any rejects, the whole `.then(async () => { ... })` chain rejects (nothing catches it) and every subsequent
`await` never runs: no keyboard shortcuts and no apply / efx-paint-document / script-library / roto-authority /
state-save / image-library / image-import / project-context / seek-frame listener. One new bridge should not be able to
disable the entire main realm.

**Fix:** Move the Draft install to the end of the chain, or isolate it:

```ts
await installPhysicPaintDraftModeListener().catch((error) => {
  console.error('[main] Draft gate listener install failed', error);
});
```

### Info

### IN-01: `handleRebakeScript` re-renders under Draft; Trash does not reconcile `draftPixelsDirty`

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5621-5651` (rebake), `:5040-5079` (Trash)

**Issue:** `handleRebakeScript` (rail button and Shift+R) has no Draft gate: it resets the sheet and applies the
timeline, so the "frozen" sheet is re-rendered while `draftMode` stays ON and `draftPixelsDirty` may stay true — the
UI law and the state disagree, and saves stay deferred until some other exit. `clearActiveSource` (Trash/C) purges the
frame's script and resets the sheet without clearing or re-evaluating `draftPixelsDirty`; an empty script then leaves a
stale dirty flag blocking persistence.

**Fix:** Route the rebake through `settleDraftScript()` first (or refuse while dirty, like the close exit), and after a
Trash set `setDraftPixelsDirty(false)` when no script remains for the frame.

### IN-02: An uncancellable `armDraft()` can turn Draft ON after the sheet has closed

**File:** `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx:934-936`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5094-5120`

**Issue:** The ON click awaits `armDraft()` and then writes `setDraftMode(true)` with no check that the sheet is still
open or that the switch was not cancelled. Closing the sheet while the arm is in flight resolves `armed === true`
afterwards, leaving Draft ON with no visible switch (autosave and the snapshot writer are then deferred until the next
Move/Edit entry resets Draft via D-07 or another exit runs).

**Fix:** Capture the arm generation/open state before awaiting and only apply the result if it is still current:

```ts
const armed = await bundle.armDraft();
if (armed && surfaceStillActive()) setDraftMode(true);
```

### IN-03: The 20 s staleness belt is the main realm's only stale-pixel protection

**File:** `app/src/lib/physicPaintDraftMode.ts:72-80`, `:138-148`; `app/src/lib/autoSave.ts:42-46`, `:97`

**Issue:** Residual risk, not a proven failure. A Studio whose event loop is blocked (a large durable-base bake or a
full-script replay) stops heartbeating while it is still alive and still holds dirty pixels; after
`PHYSIC_PAINT_DRAFT_STALE_MS` (20 s) the main realm clears the gate and autosave resumes with `skipPaintFlush`, which is
exactly the mismatched-write window the gate exists to close. The design accepts this ceiling deliberately, so this is
recorded as a documented residual rather than a defect.

**Fix:** Keep the ceiling, but consider publishing the heartbeat from a channel that a blocked JS thread cannot stall
(e.g. a Rust-side timer while the Studio window exists), or requiring an explicit "safe to save" ack before the main
realm releases rather than inferring release from silence.

---

_Reviewed: 2026-11-01T18:21:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
