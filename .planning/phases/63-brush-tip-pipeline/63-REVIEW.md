---
phase: 63-brush-tip-pipeline
reviewed: 2026-11-16T09:52:13Z
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
  info: 3
  total: 6
  necessity: 0
status: issues_found
---

# Phase 63: Code Review Report — 63-16 gap closure

**Reviewed:** 2026-11-16T09:52:13Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Gap-closure re-review of plan 63-16 (`b4bc2a572..7c996c2ae`), which closes the previous round's CR-02 (a refused snapshot restore must never be overwritten by a routine save) and WR-12 (a pre-v3 AQTL body must be named as a retirement, not reported as corruption). Scope is exactly the four files changed by that plan; the working tree matches `7c996c2ae` for all four. Both test suites are green (32 codec tests, 75 controller tests; 107/107).

The two mechanisms themselves are present and behave as their pins describe. The latch is set on both refusal arms (`studioScriptSnapshotController.ts:738`, `:752`), never by `missing`, gate-checked in `prepareSave` before the authority read and upstream of `deps.write` (`:859`), and released only by `bind`/`reset` (`:701`, `:1102`), the success path (`:807`), or a successful `sessionOnly` commit (`:929`). No routine write path reaches `deps.write` while latched — `commitSave` is the only caller of `deps.write`, and it is only fed by `prepareSave`. The WR-12 mapping correctly separates the inner `unsupported-version` code from generic watercolor corruption (`studioScriptSnapshotCodec.ts:620-635`), and the named notice maps through `corrupt:aqtl-retired` (`studioScriptSnapshotController.ts:613-615`). No security defect was found in the reviewed files (length-before-allocation guards, fatal UTF-8 decoding, no dynamic evaluation, no secrets).

What the fix does not address is the consequence of withholding: on the exact retirement scenario WR-12 exists for, every script edit made after the refusal is silently unpersisted and there is no non-destructive way to resume saving (CR-01). Two further defects are new or newly visible in this scope: the retirement classification is broader than the retirement it names (WR-01), and the durable-base scope guard in the same file still lets another track's session base through (WR-02).

## Critical Issues

### CR-01: The latch silently discards every script edit made after a refused restore, and the only release is a destructive purge

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:736-740`, `:750-754`, `:855-859`, `:1023-1029` (with `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4193`, `:4233-4238`)

**Issue:** A refused read or a decode failure latches the binding, and the latch is not released by any non-destructive user action in production:

- `bind()`/`reset()` clear it (`:701`, `:1102`), but a track switch resets the session stores, so the withheld work is gone before the release; returning to the track merely re-reads the same file and re-latches if it is still refused/retired.
- The success-path release (`:807`) is unreachable without a same-binding retry restore, which production never performs (see IN-01).
- `persistAfterPurge()` (`:1029`) is the only practical release, and every one of its four call sites (`PhysicsPaintStudio.tsx:7474`, `:7484`, `:7495`, `:7502`) first removes script from the session. Clearing the latch therefore requires deleting the very work the user wants saved.

Because the gate returns `null` before any encode or write, nothing is reported at save time and `isDirty()` keeps returning true (`:1084-1087`). The Studio close pipeline sees the dirty binding, runs `flushNow()` (`PhysicsPaintStudio.tsx:4234`), which no-ops inside `prepareSave`, runs the remaining flush steps, and closes the window. The user has been told only "could not be restored (refused). The frame pixels are unchanged." — never that script saving is disabled. Net effect: paint new script after any transient `io` read failure, any `refused` read, any corrupted leaf, or any retired container/AQTL body, and that work is silently lost at track switch or close. This is worst for the scenario 63-16 was written for: a retired AQTL body now shows the friendly "not loaded" notice, which reads as "you may continue painting", while every subsequent stroke is never persisted and the only escape destroys it. This is a data-loss path, not merely a UX gap.

**Fix:** Disclose the withholding with its own pinned, report-once notice, parallel to `restoreFailureReported`, and state the exit in it. Minimal change inside the controller:

```ts
let saveWithheldReported = false; // reset in bind() and reset() beside refusedRestore

// in prepareSave:
if (refusedRestore && !sessionOnly) {
  if (!saveWithheldReported) {
    saveWithheldReported = true;
    deps.report(STUDIO_SCRIPT_SNAPSHOT_SAVE_WITHHELD_MESSAGE);
  }
  return null;
}
```

with a pinned message such as "This track's unread script snapshot is being preserved, so new script edits are not being saved. Clear this track's script to resume saving." The CR-02 pin that asserts "exactly one report (the restore notice)" across withheld saves must be updated: the correct contract is "no save-failure report per withheld save; one save-paused notice per binding". The notice should also be surfaced at close time (the close path should not silently accept a withheld flush), and if a non-destructive acknowledgement is out of scope, the retirement notice itself must say that saving is paused until the track's script is cleared. Report this as a follow-up even if the reporting change is deferred; silent loss is not acceptable for CR-02's chosen trade-off.

## Warnings

### WR-01: `aqtl-retired` is broader than the retirement it names — every AQTL version other than 3 is reported as an "older format"

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:620-629` (inner code: `app/src/components/physic-paint/performance/scriptTimelineCodec.ts:1088-1092`)

**Issue:** The new branch maps the inner `ScriptTimelineCodecError` code `unsupported-version` wholesale to `aqtl-retired`. The inner codec raises that code for **any** version word other than 3 (`if (version !== SCRIPT_TIMELINE_BINARY_VERSION) fail('unsupported-version', ...)`), read little-endian at offset 4. So:

- a future AQTL **v4** body would be reported as "saved in an older format" / "predates the texture format", which is factually backwards and hides a forward-compatibility problem;
- a bit-flipped version word in an otherwise valid v3 body (e.g. `3 -> 7`) is reported as a deliberate retirement with the reassuring "frame pixels are unchanged", steering the user away from the actual corruption;
- v0 is likewise labelled "older".

The WR-12 requirement was specifically a v1/v2 body. The current test pins 1 and 2 only, so the over-broad classification is unpinned and undetected.

**Fix:** Branch on the actual version word before classifying as retirement:

```ts
if (error instanceof ScriptTimelineCodecError && error.code === 'unsupported-version') {
  const version = watercolorBody.byteLength >= 6
    ? watercolorBody[4]! | (watercolorBody[5]! << 8) // little-endian u16 at offset 4
    : -1;
  if (version === 1 || version === 2) {
    fail('aqtl-retired', 'AQTL body predates the texture format');
  }
}
```

Keep the generic `watercolor` diagnosis for every other version, and add codec pins for v0, v4 and a corrupted v3 version word so the boundary is fixed.

### WR-02: A foreign track's session durable base can still be written under this track's snapshot

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:540-555` (with the anchor list built at `:464-478` and the foreign filter at `:486-505`)

**Issue:** `mergeStudioScriptSnapshotContent` filters foreign-key strokes out of `watercolorEvents`/`watercolorKeyAnchors` (the filtered pair is `finalWatercolorEvents`/`finalWatercolorKeyAnchors`), and the retained-base loops exclude `foreignIds` (`:519`, `:526`). The session-base scope guard, however, is built from the **unfiltered** `watercolorKeyAnchors` parameter:

```ts
const scopedKeyIds = new Set<string>([
  ...liveKeyIdValues,
  ...watercolorKeyAnchors.map((anchor) => anchor.keyId), // pre-foreign-filter list
  ...retainedBaseIds,
]);
```

and the session loop (`:550-554`) has no `foreignIds` check. When one of another track's live keys appears in a session stroke anchor (exactly the desynced-session shape the foreign filter at `:480-505` exists to catch) and the launch map — which is documented as spanning tracks — holds that key's base, the foreign base passes the scope guard and is written into this track's snapshot. That is the cross-track overwrite class the filter was added to prevent, left open on the base path.

**Fix:** Scope from the filtered list and skip foreign ids explicitly in the session loop:

```ts
...finalWatercolorKeyAnchors.map((anchor) => anchor.keyId),
// ...
for (const [keyId, bytes] of sessionDurableBases) {
  if (keyId.length === 0) continue;
  if (foreignIds?.has(keyId)) continue;
  if (liveKeyIds !== null && liveKeyIds !== undefined && !scopedKeyIds.has(keyId)) continue;
  mergedBases.set(keyId, bytes);
}
```

Add a pin: a foreign session anchor plus a session base for that key must not appear in the written snapshot.

## Info

### IN-01: The "later successful restore" latch release is unreachable in production and untested

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:805-807`

**Issue:** `refusedRestore = false` on the restore success path is documented as one of the latch's release sites, and 63-16-SUMMARY calls the lifecycle "symmetric and proven", but every production `restore()` call is immediately preceded by a `bind()` that already cleared the latch (`PhysicsPaintStudio.tsx:5879-5880` on track switch, `:6507-6510` on launch replacement). No production path retries a restore on an unchanged binding, and no test pins release-on-restore without an intervening bind. The nearest test performs two restores on one binding to prove once-per-binding reporting, which production never does. The release is harmless today, but the documentation overstates the proven contract.

**Fix:** Either delete the line and correct the header/JSDoc to "cleared only by bind/reset or a successful explicit purge", or add the same-binding retry call site the line is meant to serve. Do not describe it as proven until one of the two is true.

### IN-02: The rail-cleanup surface is dead code; the durable marker can never become true

**File:** `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts:262-285`, `:1045-1073`, `:1117-1123`

**Issue:** `studioScriptSnapshotRailCleanupRevision` (exported signal, `:285`) has zero readers outside its own increment. `markRailCleanupDone()`, `isRailCleanupDone()` and `dropRetainedForFrames()` have no production callers, and `PhysicsPaintStudio.test.ts:3252-3254` actively pins that the Studio must not call `markRailCleanupDone` or `dropRetainedForFrames` ("No purge: a script is content. The render must follow it instead."). Consequently `railCleanupDone` is always `false` when encoded, the `SNP1` marker byte is write-only, and the comment at `:280-284` describes a signature change that cannot occur. The surface is a leftover from quick-261026-odd.

**Fix:** Remove `markRailCleanupDone`/`isRailCleanupDone`/`dropRetainedForFrames`/`studioScriptSnapshotRailCleanupRevision` and the marker plumbing (or wire them), and update the controller header. If the marker is retained for format stability, say so explicitly and drop the dead API.

### IN-03: Stale codec section comments

**File:** `app/src/components/physic-paint/performance/studioScriptSnapshotCodec.ts:431`, `:439-441`

**Issue:** The separator reads "Durable-base section v1" and the JSDoc reads "The v4 durable-base section", while the section's own version is 2 (`:104`) inside a v5 container (`:60`). Both comments predate the current format and contradict the constants a reader will check.

**Fix:** Rename to "Durable-base section v2" and "The v5 durable-base section (section version 2)"; the JSDoc block at `:84-103` is the authoritative description and needs no change.

---

_Reviewed: 2026-11-16T09:52:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
