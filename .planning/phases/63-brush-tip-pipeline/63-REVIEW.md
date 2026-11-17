---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-17T10:19:51Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts
  - app/src/components/physic-paint/performance/studioScriptSnapshotCodec.test.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
  - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts
findings:
  critical: 1
  warning: 2
  info: 8
  total: 11
  necessity: 1
status: issues_found
---

# Phase 63: Code Review Report — 63-18 close/purge gate + AQTL v4 rotation re-review

**Reviewed:** 2026-11-17T10:19:51Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Third gap-closure re-review, scoped to the four files above and to the commits since `6eb3a8689caa13e07fbe0f596e01afe508da7522`: `79721434f` (close refusal + whole-track purge gate), `cc598018c` (pins), and the `261116-inu` AQTL v4 rotation commits (`4f0af8c39`, `fa25fffef`, `7e7af2c50`). No structural pre-pass was supplied. Evidence is direct reading plus cross-file tracing into `scriptTimelineCodec.ts`, `PhysicsPaintStudio.tsx`, `aquarelleRecordState.ts`, `usePhysicsPaintParentBridge.ts`, and the Rust brush-library command. In-scope suites are green: 32 codec tests + 86 controller tests = 118/118 (`npx vitest run`, 2026-11-17).

Closure verdicts:

- **CR-01 — CLOSED for the case that was filed.** The first withheld close of a window now refuses: the new flush step (`PhysicsPaintStudio.tsx:4234-4240`) runs before the time-bounded `flushNow`, outside the 2 s race, re-reports the notice, and throws; `runStudioFlush` rethrows and the close hook's catch skips `destroy()` (`bridge/usePhysicsPaintParentBridge.ts:39-46`). `hasPending` also includes `hasWithheldContent()` (`PhysicsPaintStudio.tsx:4209-4211`), so the hook intercepts even when the script is "clean". Two residuals remain: the acknowledgement is per window rather than per latch episode (**CR-03**, Critical), and a track switch still drops post-refusal edits after a withheld `saveNow` followed by `resetAquarelleRecordState()` (`PhysicsPaintStudio.tsx:5883`, `:5894`) — disclosed by the pause notice and inherent to the CR-02 latch policy, not re-filed.
- **WR-13 — CLOSED.** Only the whole-track clear passes `acknowledgeRefusedRestore` (`PhysicsPaintStudio.tsx:7560`); the frame, rail-subset and raster purges omit it (`:7530`, `:7540`, `:7551`). The latch branch requires `sessionOnly && acknowledgesRefusal` (`studioScriptSnapshotController.ts:935-946`), and the latch is released only after a successful session-only commit (`:982-985`). Tests pin the partial-purge refusal and the acknowledged clear (`studioScriptSnapshotController.test.ts:1472-1506`). One latent ordering dependency in the post-flush cache delete is reported as IN-13.
- **WR-14 — OPEN.** The short-body fallback is still present at `studioScriptSnapshotCodec.ts:637-642`. It is unreachable code; per the necessity rubric an unreachable fallback is code quality, not necessity, so the new `necessity:` count excludes it (only IN-01 counts). Severity stays Warning.
- **IN-01 — OPEN.** The successful-restore latch release (`:846-847`) is still unreachable in production: `restore()` is called only at `PhysicsPaintStudio.tsx:5909` and `:6561`, both immediately after `bind()`, which clears the latch (`studioScriptSnapshotController.ts:739-740`).
- **IN-10 — OPEN.** No upper bound on anchor `mutationId` (`studioScriptSnapshotCodec.ts:376-381`, `:390`).
- **IN-11 — OPEN.** `deps.getIdentity` is still declared (`studioScriptSnapshotController.ts:124`) and never read; the `PhysicsPaintStudio.tsx:1504` occurrence belongs to `createStudioScriptSnapshotTrackDelete`.
- **IN-12 — OPEN.** Both foreign-base tests still supply a non-null `getLiveKeyIds` (`studioScriptSnapshotController.test.ts:2032`, `:2054`), so the explicit foreign guard is never the deciding check.

AQTL v3/v4 honesty and rotation bounds — **verified correct** (details in the scope answers). New findings this round: one Critical (CR-03), two Warnings (WR-14 unchanged; WR-15 cross-track base arm), and eight Info items (four new: IN-13 to IN-16; four continuing: IN-01, IN-10, IN-11, IN-12).

## Narrative Findings (AI reviewer)

### Scope answers

**Does the close path refuse a withheld flush?** Yes, once per window. The step's placement is correct: it precedes the aquarelle capture and the `Promise.race`-bounded `flushNow`, so a refusal leaves the realm intact with no partial write, and its throw is the same mechanism the Draft gate already uses. The problem is the memory of the refusal: `closeWithheldAcknowledgedRef` is a per-window boolean that no rebind resets (`PhysicsPaintStudio.tsx:4192`, `:4234-4240`; no other read or write of the ref exists in the file). A second refused-restore episode — on another track, after a normal track switch, in the same Studio window — closes silently and destroys that track's withheld edits (CR-03).

**Is the whole-track-clear gate complete?** Yes. `persistAfterPurge` forwards the acknowledgement only when the caller sets it (`studioScriptSnapshotController.ts:1092`), and the only caller that sets it is `clearMemoryRailScripts` (`PhysicsPaintStudio.tsx:7560`). A partially purged, latched binding stays latched and the file is untouched; the acknowledged clear replaces the snapshot session-only and releases the latch only after a successful write, so a failed write leaves the latch set (`:982-985`). Test-pinned both ways. The remaining weakness is the cleanup gate (IN-13).

**Is `hasWithheldContent()` a sound close gate?** Not in full. The stroke arm is sound for post-switch refusals because the track-switch reset clears the timeline before the incoming restore (`PhysicsPaintStudio.tsx:5894`, `:5908-5909`). The base arm is not track-scoped: `getDurableBases` is documented as "launch-scoped and spans tracks" (`studioScriptSnapshotController.ts:176-181`) and is wired to the unfiltered launch map (`PhysicsPaintStudio.tsx:1419-1429`, map declared `:1686`, reset per launch at `:1710-1717` and `:6535-6543`). A refused binding on track A therefore reports withheld content whenever any *other* track has a pinned base in the same launch — and the close refusal then instructs the user to clear track A's script, a destructive action taken for content that is not at risk (WR-15).

**Is the AQTL version-word read honest about retired versions?** Yes, behaviorally. The inner codec reads versions 3 and 4 only (`scriptTimelineCodec.ts:114-121`, `:1170-1172`); the snapshot codec maps exactly 1 and 2 to `aqtl-retired` and leaves every other `unsupported-version` tagged `watercolor` (`studioScriptSnapshotCodec.ts:631-646`). v3 bodies restore and re-encode as v4 (pinned at `scriptTimelineCodec.test.ts:1087-1123`; the snapshot path is pinned by `studioScriptSnapshotCodec.test.ts:388-425` and the v3 restore test in `studioScriptSnapshotController.test.ts:634-656`). SNAP containers 1-4 raise `snap-v4-retired`. The only honesty defect left is the dead `-1` fallback (WR-14), whose comment now correctly says v3 is not retired.

**Is the AQTL v4 rotation carrier correctly bounded and malformed input rejected?** Yes. Encode: the value must be an integer in -180..180 before any conversion, then written as `u8 presence + i16 hundredths` (max ±18000) (`scriptTimelineCodec.ts:769-788`). Decode: the presence byte must be 0/1; the i16 must be within ±18000; a value that is not a whole degree (e.g. 4550) is refused rather than decoded as 45.5 (`:1070-1099`). Pins cover 37 ↔ 3700, ±180, 18001/-18001, presence = 2, and 4550 (`scriptTimelineCodec.test.ts:951-1028`). A malformed v4 body surfaces as `corrupt:watercolor`, not an uncaught throw (`studioScriptSnapshotCodec.ts:622-654`). v3 reads no rotation byte and its strokes stay rotation-absent on re-encode. Residuals are diagnostics-only: the encoder's second-stage hundredths check is dead (IN-14), the header's `Math.round` wording is stale (IN-15), and an encode-side refusal is reported as an IO failure (IN-16).

**Can any in-app carrier still produce an out-of-law rotation?** No. The Studio slider is integer-stepped and bounded -180..180 (`PhysicsPaintTextureModal.tsx:293-301`), the Rust set-rotation command range-checks the value (`app/src-tauri/src/commands/brush_library.rs:485-491`), and the JSON script guard requires an integer in -180..180 (`roto/physicsPaintRotoScriptSchema.ts:614-623`). The catalog *read* path is the one unguarded door (IN-16).

## Critical Issues

### CR-03: Close refusal is acknowledged once per Studio window, not once per latch episode — a later refused track closes silently and destroys its withheld script

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4192`, `:4234-4240` (with `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:726-746`)

**Issue:** `closeWithheldAcknowledgedRef` is set on the first withheld close and is never reset. Nothing in the Studio resets it on a track switch, and the controller has no episode signal the Studio can consult; the ref's only occurrences in the file are its declaration and the close step. A reachable sequence:

1. Launch the Studio on track A whose snapshot was written by an older build (a SNAP 1-4 / AQTL 1-2 file) — this is exactly the retired-format case the latch exists for. Restore refuses, the binding latches.
2. Paint on A, close the Studio. The new step refuses once and reports; the window stays open (CR-01's fix, working).
3. Switch to track B, whose snapshot is likewise unreadable. `bind()` clears the latch and the restore refuses again, so B is latched with B's own withheld edits.
4. Paint on B and close. `hasWithheldContent()` is true, but `closeWithheldAcknowledgedRef.current` is still `true` from step 2. The step returns early, `flushNow` withholds the save (a routine save is latched), resolves successfully, and the close hook runs `appWindow.destroy()`.

B's post-refusal script is destroyed with no close-time refusal and without the notice being re-reported at the exit — the precise failure CR-01 was filed for. The only prior signal is the per-episode pause notice, which the destroyed realm takes with it. The current refusal message also never states that a second close discards the withheld edits, so the acknowledgement the flag encodes is not informed. There is no behavioral test for the close step: `PhysicsPaintStudio.test.ts:4025-4032` only asserts the source text contains the strings.

**Fix:** Tie the acknowledgement to the controller's latch episode instead of the window, and state the consequence in the refusal:

```ts
// controller — the episode identity the Studio can compare
let latchEpisode = 0;
function bind(identity: StudioScriptSnapshotIdentity | null): void {
  latchEpisode += 1;
  // ...existing resets...
}
function withheldEpisode(): number { return latchEpisode; }
// expose on the returned controller: withheldEpisode

// PhysicsPaintStudio.tsx
const closeWithheldAcknowledgedEpisodeRef = useRef(-1);
() => {
  if (!studioScriptSnapshot.hasWithheldContent()) return;
  const episode = studioScriptSnapshot.withheldEpisode();
  if (closeWithheldAcknowledgedEpisodeRef.current === episode) return;
  closeWithheldAcknowledgedEpisodeRef.current = episode;
  studioScriptSnapshot.reportSaveWithheld();
  throw new Error(
    'Studio script saving is paused for this track — closing again will discard the unsaved script.',
  );
},
```

Add a behavioral test (the close step is currently pinned only by source strings): refuse A, refuse B after a rebind, and assert the second episode produces a refusal, plus that a same-episode second close is accepted.

## Warnings

### WR-14: Dead fallback — the short-body branch in the AQTL version read can never be taken

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:637-642`

**Issue:** `watercolorBody.byteLength >= 6 ? watercolorBody[4]! | (watercolorBody[5]! << 8) : -1` still guards a body shorter than 6 bytes. That state cannot occur: the ternary runs only in the catch for `ScriptTimelineCodecError` with code `unsupported-version`, and the inner codec raises that code only after its 24-byte length rejection (`scriptTimelineCodec.ts:1158-1160`) and the magic check (`:1162-1166`); the throw is at `:1170-1172`. The `-1` branch is unreachable. This is dead code at a retirement boundary — maintainers reading the mapping are told short bodies are handled here when they are impossible. (Per the necessity rubric, unreachable code is code quality, not necessity; hence no `necessity:` marker and no count.)

**Fix:** Read the version word directly and record the invariant:

```ts
// The inner codec rejected bodies under 24 bytes and checked the magic before
// raising `unsupported-version`, so the version word is always present here.
const version = watercolorBody[4]! | (watercolorBody[5]! << 8);
```

The WR-01 boundary tests already cover the behavior, so removal is safe.

### WR-15: `hasWithheldContent()` counts another track's durable bases — a latched but empty binding refuses the close and names a destructive remedy

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:1153-1163`; wiring `app/src/components/physic-paint/PhysicsPaintStudio.tsx:1419-1429`, `:1686`

**Issue:** The base arm returns `(bases?.size ?? 0) > 0` for the whole launch-scoped map. That port is documented as spanning tracks ("The map is launch-scoped and spans tracks; a save writes only the keys this bound track owns", `studioScriptSnapshotController.ts:176-181`) and the wiring returns it unfiltered (`PhysicsPaintStudio.tsx:1419-1429`; every track's paint pins entries at `:3508-3516`, and the map is reset only per launch at `:1717` / `:6541`). Consequence: launch on track B and paint (or restore a snapshot) so the launch map holds B's bases; switch to track A, whose restore refuses; A's session is empty, yet `hasWithheldContent()` is `true`. The Studio then arms `hasPending`, and the close step reports "This track's unread script snapshot is being preserved… Clear this track's script to resume saving" and refuses the close — steering the user toward the destructive whole-track clear (`clearMemoryRailScripts` → `persistAfterPurge({ acknowledgeRefusedRestore: true })`) for content that does not exist on this track. The stroke arm is not affected because the track-switch reset empties the timeline before the incoming restore. The base arm has no test at all: `studioScriptSnapshotController.test.ts:1446-1460` exercises only the stroke path.

**Fix:** Scope the base arm to keys this track can own while keeping the unknown-identity fallback conservative:

```ts
const bases = deps.getDurableBases?.();
if (!bases || bases.size === 0) return false;
const liveIds = deps.getLiveKeyIds?.();
if (liveIds === null || liveIds === undefined) return true; // identity set unknown: stay conservative
const ownIds = new Set(liveIds.values());
for (const anchor of deps.getWatercolorKeyAnchors?.() ?? []) ownIds.add(anchor.keyId);
for (const keyId of bases.keys()) if (ownIds.has(keyId)) return true;
return false;
```

Add two variants of the `hasWithheldContent` test: true when this track's base exists, false when only another track's base exists.

## Info

### IN-01: The "later successful restore" latch release still has no production call site

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:846-847` (with `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5908-5909`, `:6558-6561`)
**Category:** necessity

**Issue:** The release is pinned by a test, but production cannot reach it. `restore()` is called at exactly two sites, both immediately after `bind()`, and `bind()` clears the latch (`studioScriptSnapshotController.ts:739-740`). By the time any production restore succeeds, the latch is already clear. The branch defends a legal public-API sequence the application never performs.

**Fix:** Either keep it as an explicitly documented public-API invariant (the comment should say production relies on `bind` and the test is a seam pin), or remove it and let `bind`/`reset` own the release. Maintenance judgement, not a defect.

### IN-10: The anchor encoder accepts a `mutationId` above `0xffffffff` and silently truncates it

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:376-381`, `:390` (`Writer.u32` at `:230-233`)

**Issue:** `encodeAnchorSection` validates `Number.isInteger` and `>= 0` but not `<= 0xffffffff`; `DataView.setUint32` truncates modulo 2^32. Two in-memory ids differing by 2^32 would encode as duplicates and the decoder's duplicate check (`:419-421`) would then refuse the file — after a successful write replaced the authoritative leaf. The inner codec already bounds its ids (`scriptTimelineCodec.ts:251-260`); the anchor section is the asymmetric one. Practically unreachable because mutation ids come from the engine ledger.

**Fix:**

```ts
if (!Number.isInteger(anchor.mutationId) || anchor.mutationId < 0 || anchor.mutationId > 0xffffffff) {
  fail('anchor', `invalid anchor mutationId ${String(anchor.mutationId)}`);
}
```

### IN-11: `deps.getIdentity` is dead wiring

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:124`

**Issue:** The dependency is declared and supplied (`PhysicsPaintStudio.tsx:1361`) but never read inside the controller; `boundIdentity` is the only identity source. A dead interface member invites callers to believe it is consulted.

**Fix:** Remove `getIdentity` from `StudioScriptSnapshotControllerDeps` and from the controller wiring, or use it as the documented fallback if that was the intent.

### IN-12: The explicit foreign-base guard is untested in the only configuration where it is load-bearing

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts:2032`, `:2054` (guard at `studioScriptSnapshotController.ts:503-505`, `:536`, `:543`, `:575`)

**Issue:** Both tests supply `getLiveKeyIds: () => new Map([[0, 'own-key']])`. With a non-null live map the scope check already rejects `foreign-key`, so the tests pass with or without the explicit `foreignIds?.has(...)` guard, which exists for the `liveKeyIds === null` case. No test covers that configuration.

**Fix:** Add a null-map variant:

```ts
const { controller, write, setSignature } = harness({
  getLiveKeyIds: () => null,
  getForeignKeyIds: () => new Set(['foreign-key']),
  getDurableBases: () => new Map([['own-key', null], ['foreign-key', null]]),
});
// ...same session strokes...
expect(writtenSnapshot(write).durableBases).toEqual([{ keyId: 'own-key', bytes: null }]);
```

### IN-13: `persistAfterPurge`'s cache delete relies on an implicit `isDirty()` invariant instead of the latch

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:1079-1107` (gate at `:1097`)

**Issue:** After a withheld flush the cache-leg delete is prevented only because `isDirty()` is true. That holds today because a refused restore leaves `lastSavedSignature` null (`bind()` sets it null at `:733` and nothing re-establishes it while latched). If a same-binding re-restore ever becomes a production path (the public-API sequence IN-01 defends — successful restore, save, then refused restore), a *partial* purge would take the withheld flush, pass a false `isDirty()`, and delete the app-cache leg of the unread snapshot without having written the session. Not reachable through the current application; recorded because the guard's correctness depends on an unrelated invariant.

**Fix:** Make the intent explicit:

```ts
if (refusedRestore || isDirty()) return;
```

### IN-14: Dead second-stage validation in the rotation encoder

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:781-786`

**Issue:** After the integer -180..180 check (`:773-780`), `hundredths = textureRotation * 100` is always an integer in -18000..18000 (IEEE-754 represents every integer product exactly within this range), so the `!Number.isInteger(hundredths)` / range branch can never fire. Harmless redundancy, but the reader is told a second failure mode exists.

**Fix:** Delete the second check or replace it with a comment recording the invariant; keep only the `writer.u8(1); writer.i16(hundredths);` write.

### IN-15: The AQTL header's rotation unit law describes code that does not exist

**File:** `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:38-42`; same wording at `scriptTimelineCodec.test.ts:891`

**Issue:** The header says the hundredths boundary is `Math.round(degrees*100)`, but the encoder validates an integer and multiplies (`:773-781`); no rounding occurs anywhere. The comment misstates the contract at the exact boundary it documents.

**Fix:** "…validated as an integer in -180..180 and multiplied by 100 here, `value/100` on read; every JSON carrier stays in integer DEGREES."

### IN-16: An AQTL encode refusal is reported as an IO failure, and the catalog field that can trigger it is not range-validated on read

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:544`; `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:953-957`

**Issue:** `encodeStudioScriptSnapshot` calls `encodeScriptTimelineBinary` without translating its `ScriptTimelineCodecError`. The only wrapping catch is in `prepareSave`, which classifies anything that is not a `StudioScriptSnapshotCodecError` as `io`, so a rotation outside the integer -180..180 law produces "could not be saved (io). Painting is unaffected." on every attempt while the script is never written; the close path then destroys the realm after a failed flush (a pre-existing behavior for save failures, but AQTL v4 adds a new trigger class). The trigger is external: `libraryRowFor` returns the catalog value raw (`app/src/stores/aquarelleBrushCatalog.ts:218-221`), and `read_catalog` deserializes the machine catalog without the ±180 range check the write command applies (`app/src-tauri/src/commands/brush_library.rs:196-202` versus `:490`). The in-app slider (`PhysicsPaintTextureModal.tsx:293-301`) and the JSON script guard are bounded, so no application path produces the value today.

**Fix:** Wrap the inner encoder so the section is named, then (optionally) validate the catalog rotation at load:

```ts
let watercolor: Uint8Array;
try {
  watercolor = encodeScriptTimelineBinary(input.watercolorEvents);
} catch (error) {
  const detail = error instanceof Error ? error.message : 'unknown failure';
  fail('watercolor', `watercolor section is invalid: ${detail}`);
}
```

---

_Reviewed: 2026-11-17T10:19:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
