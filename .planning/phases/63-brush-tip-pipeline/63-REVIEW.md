---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-16T10:06:15Z
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
  info: 4
  total: 7
  necessity: 2
status: issues_found
---

# Phase 63: Code Review Report — CR-01 / WR-01 / WR-02 / IN-01 closure re-review

**Reviewed:** 2026-11-16T10:06:15Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Second gap-closure re-review of plan 63-16 against `b4cd2f584` (RED tests) and `4a9890b9c` (fix). Scope is exactly the four files listed; no structural pre-pass was provided. Both suites are green: 32 codec tests + 81 controller tests = 113/113.

Closure verdicts:

- **CR-01 — PARTIAL, remains Critical.** The disclosure notice is implemented correctly: placed after the empty-payload guard (`studioScriptSnapshotController.ts:910-926`), once per latch episode, and reset at every latch-clear site (`:721-725`, `:827-831`, `:964-967`, `:1132-1143`), with coherent tests. But the prior CR-01 remedy also required the notice to be surfaced at close time ("the close path should not silently accept a withheld flush", 63-REVIEW.md:64). That half is absent: the close hook cannot distinguish a withheld flush from a saved one and destroys the window, taking the only notice with it.
- **WR-01 — CLOSED.** The version word is read at `studioScriptSnapshotCodec.ts:633-635`; only v1/v2 map to `aqtl-retired`, all other `unsupported-version` cases keep `watercolor`. The boundary is pinned at `studioScriptSnapshotCodec.test.ts:408-423`, and the same offset helper proves the read is correct (v1/v2 must produce `aqtl-retired`). The short-body fallback is dead code (WR-14).
- **WR-02 — CLOSED.** The session scope set is built from the post-foreign-filter anchors (`studioScriptSnapshotController.ts:549-553`) and the session-base loop carries an explicit foreign rejection (`:558`); the retained loops were already filtered (`:519`, `:526`). No path was found that drops a base legitimately owned by this track (scope answer 4); the guard's only load-bearing configuration is untested (IN-12).
- **IN-01 — PARTIAL.** The same-binding successful restore now releases the latch and is pinned by a test, but the production reachability is unchanged: every restore is preceded by `bind()`, which already clears the latch. Re-reported as IN-01.

New this round: WR-13 (every purge action, not just the cleared-track one, destroys the unread snapshot and clears the latch), WR-14 (impossible-state guard in the version read), IN-10 (unbounded anchor `mutationId`), IN-11 (dead `deps.getIdentity`), IN-12 (the foreign-base guard is untested where it is load-bearing).

All other prior rows (CR-02, WR-03–WR-12, IN-02–IN-09) remain open in `63-REVIEW-DISPOSITION.md` and were not re-litigated here. IN-02 (dead rail-cleanup surface) and IN-03 (stale codec section comments at `studioScriptSnapshotCodec.ts:431`, `:439-441`) are still present in the reviewed files.

## Narrative Findings (AI reviewer)

### Scope answers

**Can any write path still reach `deps.write` for a latched binding?** Routine paths cannot. `commitSave` (`studioScriptSnapshotController.ts:944-947`) is the only `deps.write` caller and is fed only by `prepareSave`; all routine entry points — the debounce drain (`:986-1008`), the track-switch `saveNow` (`:1113-1120`) and the close `flushNow` (`:1030-1043`) — funnel through it, and a latched, non-`sessionOnly` prepare returns at `:917-926` before encode. No prepared payload can cross into a latch state either: nothing is prepared until the generation's restore settles (`:873`, `:837`), and every restore is preceded by `bind()`, which clears the latch and bumps the generation. The one remaining door is the deliberate `sessionOnly` bypass used by `persistAfterPurge` (`:1067`) — and that bypass is broader than the disclosure claims (WR-13).

**Can the notice be missed on the Studio close path?** Yes (CR-01). The close hook calls `event.preventDefault()`, awaits the flush, then `appWindow.destroy()` (`bridge/usePhysicsPaintParentBridge.ts:40-43`); a withheld flush resolves normally (`prepareSave` returns null), so the hook cannot tell it apart from a successful save. The first notice writes to the status capsule (`PhysicsPaintStudio.tsx:1436-1440`) milliseconds before the realm is destroyed; later closes in the same episode report nothing at all because `saveWithheldReported` suppresses it (`studioScriptSnapshotController.ts:921`). The 2 s `Promise.race` (`PhysicsPaintStudio.tsx:4233-4238`) can also resolve before `prepareSave` even runs, so in the slow-write case not even the first report fires.

**Is the AQTL version-word read safe for short bodies?** Yes. The read at `studioScriptSnapshotCodec.ts:633-635` is reachable only from the inner codec's `unsupported-version` throw, which is preceded by its 24-byte length rejection (`scriptTimelineCodec.ts:1078-1080`) and the magic check (`:1082-1086`). The body is always at least 24 bytes there, so the `-1` fallback is dead (WR-14). Even without the guard, an out-of-range `Uint8Array` index yields `undefined` rather than throwing, so there is no crash path either.

**Can the foreign-base guard drop a base that legitimately belongs to this track?** No provable path. `foreignIds` is built only from OTHER tracks' key records (`PhysicsPaintStudio.tsx:1387-1400`), while the scope set is this track's live key map, its post-filter anchors and its retained bases (`studioScriptSnapshotController.ts:549-553`). Every copy/paste path allocates fresh destination UUIDs (`roto/physicsPaintRotoRailSetCopy.ts:749`, `:757`, `:784`; a "prescribed" allocation replays the child's already-allocated fresh UUID, never the source id), so a keyId cannot legitimately live in two tracks. If id aliasing ever did occur, the guard's direction is fail-closed (the base is omitted, not misattributed) and the pre-existing stroke filter at `:493-504` would already have dropped the same key's strokes. Test gap: IN-12.

## Critical Issues

### CR-01: The withheld-save disclosure is destroyed with the window — the close path still silently accepts a withheld flush

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:917-926`, `:1030-1043`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4185-4245` (`:4193`, `:4233-4238`); `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts:39-46`

**Issue:** The notice exists, but it cannot survive the exit it is meant to cover. On close, the hook intercepts, awaits the flush, then destroys the window. A withheld flush (latched binding, non-empty content) resolves without error — `prepareSave` returns null at `:917-926` and `flushNow` resolves — so `usePhysicsPaintParentBridge.ts:43` runs `appWindow.destroy()` unconditionally. Consequences:

- First withheld close of an episode: `deps.report` writes to the Studio status capsule (`PhysicsPaintStudio.tsx:1436-1440`) and the realm is destroyed immediately after — the user never sees it.
- Any later close in the same episode: `saveWithheldReported` is already true (`:921`), so `prepareSave` returns null with no report at all.
- Slow-write close: the 2 s `Promise.race` (`PhysicsPaintStudio.tsx:4233-4238`) can resolve before `flushNow` reaches `prepareSave`, so not even the first report is attempted.
- Track switch is better only because the window stays open; it does not preserve the outgoing session's post-refusal edits.

Net effect: every script edit made after a refused restore is still silently lost on close. This is precisely the half of CR-01 the prior review said must be fixed: "The notice should also be surfaced at close time (the close path should not silently accept a withheld flush)" (`63-REVIEW.md:64`). The latch gate itself holds — no routine write reaches `deps.write` while latched — but the disclosure fails at the primary exit.

**Fix:** Make the withheld outcome observable and make close refuse. Track whether content was actually withheld (not `isDirty()`, which is true even for an empty post-refusal session and would trap the user in an unclosable Studio):

```ts
// controller
let withheldContentPending = false; // clear beside refusedRestore in bind(), reset(),
                                    // the restore success path, and the sessionOnly commit
// in prepareSave, inside the latch branch (after the empty-payload guard):
if (refusedRestore && !sessionOnly) {
  withheldContentPending = true;
  if (!saveWithheldReported) { saveWithheldReported = true; deps.report(STUDIO_SCRIPT_SNAPSHOT_SAVE_WITHHELD_MESSAGE); }
  return null;
}
// expose on the returned controller:
hasWithheldContent: () => withheldContentPending,
```

```ts
// PhysicsPaintStudio.tsx close flush step:
() => Promise.race([...]).then(() => {
  if (studioScriptSnapshot.hasWithheldContent()) {
    throw new Error(STUDIO_SCRIPT_SNAPSHOT_SAVE_WITHHELD_MESSAGE);
  }
}),
```

`runStudioFlush` rethrows (`PhysicsPaintStudio.tsx:4180-4184`) and the close hook's existing catch (`usePhysicsPaintParentBridge.ts:44-46`) skips `destroy()`, leaving the window open with the notice visible — the same mechanism the Draft step already uses (`:4209-4211`). `event.preventDefault()` has already run, so refusing the close is safe. Alternatively, change `flushNow` to return a `'withheld'` outcome and act on it; either way the close decision must not come from `isDirty()` alone.

## Warnings

### WR-13: Every purge action — including single-frame and raster purges — clears the refused-restore latch and replaces the unread snapshot session-only

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:917`, `:956-967`, `:1061-1081`; `app/src/components/physic-paint/PhysicsPaintStudio.tsx:7469-7504`

**Issue:** `persistAfterPurge` always flushes with `{ allowEmpty: true, sessionOnly: true }` (`:1067`). `sessionOnly` is the latch's only bypass (`:917`), and a successful commit clears both `refusedRestore` and `saveWithheldReported` (`:964-967`). Four Studio actions call it:

- `purgeMemoryScriptFrame(frame)` (`PhysicsPaintStudio.tsx:7474`) — one frame's script;
- `purgeMemoryRailScripts(frames)` (`:7484`) — a subset of frames;
- `finishRasterPurge(frames)` (`:7495`) — the Raster action's settle;
- `clearMemoryRailScripts()` (`:7502`) — the whole-track clear.

After a refused restore `retainedContent` is null (`bind` sets it null at `:720`; only a successful restore retains content at `:822-826`), so the session-only write replaces the authoritative file with the current session minus the purged entries, and then deletes the cache leg (`:1072-1080`). Any of the first three actions therefore permanently destroys the unread snapshot — a retired-format file is valid data, merely unreadable by this build — at a scope the user never asked for, and silently re-enables routine saves. The CR-01 notice names only "Clear this track's script" (`:622`), which is `clearMemoryRailScripts`; three other latch-clearing writes are hidden behind a message that says they do not exist.

Severity is Warning rather than Critical because the user did initiate a script-erasing action on this track, and the file was already unreadable by this build; the defect is the scope mismatch and the false disclosure, not an unsolicited action.

**Fix:** Acknowledge the unread leg only from the whole-track clear:

```ts
// controller
async function persistAfterPurge(options?: { acknowledgeUnread?: boolean }): Promise<void> {
  if (refusedRestore && !options?.acknowledgeUnread) return; // leave the unread leg intact
  // ...existing flushNow({ allowEmpty: true, sessionOnly: true })
}

// PhysicsPaintStudio.tsx — clearMemoryRailScripts() only:
void studioScriptSnapshot.persistAfterPurge({ acknowledgeUnread: true });
```

Partial purges stay in-memory while latched; the file is untouched, `isDirty()` stays true, and the notice remains truthful. If any other action is intended to acknowledge the loss, name it in the notice.

### WR-14: Impossible-state guard — the short-body fallback in the AQTL version read can never be taken

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:633-635`
**Category:** necessity

**Issue:** `watercolorBody.byteLength >= 6 ? watercolorBody[4]! | (watercolorBody[5]! << 8) : -1` guards a body shorter than 6 bytes. That state cannot occur: the ternary runs only in the `catch` for `ScriptTimelineCodecError` code `unsupported-version`, and the inner codec throws that code only after its `byteLength < 24` rejection (`scriptTimelineCodec.ts:1078-1080`) and the magic check (`:1082-1086`); the throw is at `:1089-1092`. At `:633` the body is always at least 24 bytes, so the `-1` branch is dead. The guard is also not needed for safety: an out-of-range `Uint8Array` index yields `undefined` rather than throwing.

**Fix:** Read the version word directly and record the invariant in a comment:

```ts
// The inner codec rejected bodies under 24 bytes and checked the magic before
// raising `unsupported-version`, so the version word is always present here.
const version = watercolorBody[4]! | (watercolorBody[5]! << 8);
```

The WR-01 boundary tests (`studioScriptSnapshotCodec.test.ts:408-423`) already cover the behavior, so removal is safe.

## Info

### IN-01: The "later successful restore" latch release still has no production call site

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:827-831` (with `app/src/components/physic-paint/PhysicsPaintStudio.tsx:5879-5880`, `:6507-6510`)
**Category:** necessity

**Issue:** The release is now pinned by a test, but production cannot reach it. `restore()` is called at exactly two sites, both immediately after `bind()` (`PhysicsPaintStudio.tsx:5879-5880`, `:6507-6510`), and `bind()` clears `refusedRestore` and `saveWithheldReported` (`:721-725`). By the time any production restore succeeds, the latch is already clear. The guard defends a legal public-API sequence that the application never performs.

**Fix:** Either keep the release as an explicitly documented public-API invariant (the comment should say the production path relies on `bind`, and the test is a seam pin), or remove it and let `bind`/`reset` own the release. This is a maintenance judgement, not a defect.

### IN-10: The anchor encoder accepts a `mutationId` above `0xffffffff` and silently truncates it

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:375-381`, `:389`

**Issue:** `encodeAnchorSection` validates `Number.isInteger` and `>= 0` but not `<= 0xffffffff`; `Writer.u32` is `DataView.setUint32` (`:230-233`), which truncates modulo 2^32. Two in-memory ids differing by 2^32 would encode as duplicates, and the decoder's duplicate check (`:419-421`) would then refuse the file — after a successful write replaced the authoritative leaf. The inner codec already bounds its ids (`scriptTimelineCodec.ts:235-243`); the anchor section is the asymmetric one. Practically unreachable because mutation ids come from the engine ledger, hence Info.

**Fix:** Mirror the inner codec:

```ts
if (!Number.isInteger(anchor.mutationId) || anchor.mutationId < 0 || anchor.mutationId > 0xffffffff) {
  fail('anchor', `invalid anchor mutationId ${String(anchor.mutationId)}`);
}
```

### IN-11: `deps.getIdentity` is dead wiring

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:122-124`

**Issue:** The dependency is declared and supplied (`PhysicsPaintStudio.tsx:1355`) but never read anywhere in the controller; `boundIdentity` is the only identity source. A dead interface member invites callers to believe it is consulted. (The `getIdentity` at `PhysicsPaintStudio.tsx:1498` belongs to a different factory, `createStudioScriptSnapshotTrackDelete`.)

**Fix:** Remove `getIdentity` from `StudioScriptSnapshotControllerDeps` and from the controller wiring, or use it as the documented fallback if that was the intent.

### IN-12: The explicit foreign-base guard is untested in the only configuration where it is load-bearing

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts:1852-1874` (with `studioScriptSnapshotController.ts:554-560`)

**Issue:** The WR-02 test supplies `getLiveKeyIds: () => new Map([[0, 'own-key']])`. With a non-null live map, the scope check at `:559` already rejects `foreign-key`, so the test passes with or without the new explicit guard at `:558`. The comment at `:556-557` says the guard exists for `liveKeyIds === null` (the scope check is disabled then), but no test covers that configuration. In production `getLiveKeyIds` returns a map whenever an identity is bound, so the guard's unique contribution is the aliasing case — which is exactly the case that must never silently misbehave.

**Fix:** Add a null-map variant of the WR-02 test:

```ts
const { controller, write, setSignature } = harness({
  getLiveKeyIds: () => null,
  getForeignKeyIds: () => new Set(['foreign-key']),
  getDurableBases: () => new Map([['own-key', null], ['foreign-key', null]]),
});
// ...same session strokes...
expect(writtenSnapshot(write).durableBases).toEqual([{ keyId: 'own-key', bytes: null }]);
```

---

_Reviewed: 2026-11-16T10:06:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
