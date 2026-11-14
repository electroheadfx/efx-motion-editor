---
phase: 261031-qps
reviewed: 2026-10-31T19:58:32Z
depth: quick
files_reviewed: 16
files_reviewed_list:
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts
  - app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/stores/physicPaintStore.test.ts
  - app/src/stores/physicPaintStore.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Quick 261031-qps: Code Review Report

**Reviewed:** 2026-10-31T19:58:32Z
**Depth:** quick
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Quick B ("Run Script stacking part B") moves the durable-base decision into the pure `aquarelleScriptBaseAuthority.resolveScriptBase` (reveal axis → persisted SNAP v5 → session → pin-only-without-recorded-strokes → fail closed), adds the pixel-only Keep-script 2x2, and makes reveal rails legal stack destinations via a render-only tail port that must cover exactly the touched frames before the single commit.

Laws 1, 2, 4 (coverage half) and 5 are correctly implemented and pinned by tests: the authority order is exact and fail-closed (`aquarelleScriptBaseAuthority.ts:74-98`), no stack path adopts or writes `keyScriptEdits` (`physicsPaintRotoPlayScriptController.ts:2418-2427` reads it only), the reveal tail port is render-only and refuses before any write (`PhysicsPaintStudio.tsx:4140-4203`), the controller validates extra/duplicate/missing frames and throws with no commit (`:2565-2578`), and no persisted schema field was added (`durableBaseKeyId` is fully deleted; `durableBaseKind` is runtime-only).

One BLOCKER remains in the commit path: when a stack run's bake reports no anchors, `slices` is empty and every non-destructive branch is skipped, so the raw staged bake commits over the destination keys' existing paint with no pin, no refusal, and no recording. Two WARNINGS concern side effects on refused runs and a masked optional recording port. Two INFO items note a missing frame-identity check on the reveal apply dispatch and a test that pins a weaker part of law 4 than the store test does.

Quick-mode pattern scans (hardcoded secrets, dangerous functions, debug artifacts, empty catch blocks, commented-out code) returned no hits across the 16 changed files.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Stack run with zero anchors commits the raw bake over existing key paint (no pin, no refusal, no recording)

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2580` (union guard) and `:2590` (composite guard); commit at `:2609`
**Severity:** BLOCKER

**Issue:** `sliceRailKeyScripts` returns `[]` when the bake reports no anchors (`app/src/components/physic-paint/roto/physicsPaintRotoRailKeyScripts.ts:58`: `if (anchors.length === 0 || frames.length === 0) return [];`). Anchors are reported only for real brush strokes — Dry events are filtered out of the bake's stroke list (`packages/efx-watercolor/src/bake/aquarelleBake.ts:462`) and the anchor report maps `strokes` only (`:898-905`) — while a Dry-only persisted script is schema-legal (`app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:377` skips Dry markers when counting brushes, and `strokes.length >= 1` is satisfied by the markers alone). The same shape occurs for any baked script whose non-Dry stroke list ends up empty.

With `slices.length === 0`:

- Pixel-only rail with Keep ON: `useUnion` is true but the guard `} else if (useUnion && unionBake !== undefined && slices.length > 0) {` skips the union re-bake, and the composite branch requires `recordMode === 'none'` (it is `'append'`), so neither branch runs. `publication` keeps the raw `basePublication` frames (`frame.bytes` from the plain bake).
- Pixel-only rail with Keep OFF: `useUnion` is false and the composite guard also requires `slices.length > 0`, so it is skipped too. No pin, no composite.

The controller then calls the single `ports.commit(publication)` at `:2609` with the raw staged bake, overwriting every touched destination key's existing picture, with no durable-base pin, no refusal, and no `recordRailKeyScripts` call (`recordMode !== 'none'` but `slices.length === 0` still calls the port at `:2623` with an empty slice list, which records nothing). This is silent user-paint erasure — exactly the failure the authority was introduced to prevent. The reveal path is already safe (explicit throw at `:2543-2545`), but the pixel-only paths are not.

**Fix:** Fail closed before the commit whenever a stack run produced no per-key slices, and never commit the raw bake for a stack destination:

```ts
// after `const slices = sliceRailKeyScripts(...)`
if (!isRevealTarget && slices.length === 0) {
  throw new Error('This run produced no per-key strokes, so the rail was not changed. Nothing changed.');
}
```

(Alternatively, make `bakeStackedRailKey` compose from `keyIds` even with empty slices — but failing closed matches the reveal path and the "zero writes on refusal" contract.) Add a controller test that a Dry-only script stack run on a pixel-only rail with Keep ON and with Keep OFF both abort with no `commit` and no `recordRailKeyScripts`.

### Warnings

#### WR-01: Refused or cancelled stack runs leave fresh durable-base pins behind

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:4046-4050` (pins before bake), `:3408-3424` (`pinScriptBase` → `markDirty()`), refusals at `:4062` and `:4073`; controller abort path `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2580-2611` and `:2642-2648`
**Severity:** WARNING

**Issue:** `bakeStackedRailKey` resolves every key first (good), but then pins all `persistPin` resolutions *before* baking (`:4046-4050`), and `pinScriptBase` writes `aquarelleDurableBaseByKeyRef.current`, deletes the recovered marker, emits a split event, and calls `studioScriptSnapshot.markDirty()`. If the bake then refuses (`:4062` `bake-failed`, `:4073` `composite-failed`), or the user cancels after the union port returned but before `ports.commit`, those pins persist for a run that never committed — contradicting the module's own "Callers that receive `ok: false` perform ZERO writes" contract (`aquarelleScriptBaseAuthority.ts:28-30`) and the controller test intent that a refused run writes nothing. The pinned bytes equal the picture at pin time, so this is not direct erasure, but it persists a dirty snapshot and changes the base the next run will composite over.

**Fix:** Snapshot the touched keys' prior `aquarelleDurableBaseByKeyRef` entries and `aquarelleRecoveredBaseKeyIdsRef` membership before pinning, and restore them on every refusal return and on the controller's pre-commit abort path (or move the pin writes into `recordRailKeyScripts`, after the commit succeeds). Add a test asserting the map and the dirty flag are unchanged on a refused bake.

#### WR-02: `recordRailKeyScripts` is always forwarded, masking the controller's presence gate and allowing silent unrecorded Keep-ON runs

**File:** `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts:77`, controller `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:317` (optional port) and `:2623` (`ports.recordRailKeyScripts?.({...})`)
**Severity:** WARNING

**Issue:** The hook forwards `recordRailKeyScripts: (input) => portsRef.current.recordRailKeyScripts?.(input)` unconditionally, while the three bake ports right below it (`:81-93`) are conditionally forwarded *specifically* "so the controller's presence gate stays honest." Because the controller's port type is optional (`:317`) and the call site is `?.`, a host that does not supply the recording port still gets a non-undefined wrapper that resolves to `undefined`; the Keep-ON run commits successfully and silently skips both the union append and the `replace`. The next union rebuild then starts from the durable-base pin plus only the new slices, so the earlier strokes are dropped even though the run reported success. Today's Studio wiring provides the port (`PhysicsPaintStudio.tsx:4331`), but the hook contract advertises optionality that it silently defeats.

**Fix:** Mirror the bake-port pattern:

```ts
...(ports.recordRailKeyScripts
  ? { recordRailKeyScripts: (input: RailKeyScriptRecordInput) => portsRef.current.recordRailKeyScripts!(input) }
  : {}),
```

and fail closed in the controller when `recordMode !== 'none'` and the port is absent (`throw new Error('This build cannot record key scripts. Nothing changed.')`) before the commit, so an unrecorded Keep-ON run can never be reported as complete.

### Info

#### IN-01: Reveal apply dispatch trusts `rendered.frames[0]` without the frame-identity check the stack path enforces

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx:2005-2017`; compare `:4193`
**Severity:** Info

**Issue:** The publish path's reveal branch calls `renderRevealTail({ canonicalStart: frame.appFrame, frameCount: 1, ... })` and then uses `rendered.frames[0]` after only checking existence (`:2005-2007`). The stack slow path enforces identity (`:4193`: `if (!frame || frame.appFrame !== slice.frame) return { kind: 'refused', reason: 'reveal-frame-missing' };`). If `renderRevealTail` ever returns a frame for a different appFrame (clamping, off-by-one in span scheduling), the apply path would publish another frame's bytes onto this key.

**Fix:** Add `if (!revealFrame || revealFrame.appFrame !== frame.appFrame)` with reason `reveal-frame-missing` to the same refusal branch, and pin it with a source assertion alongside the existing reveal-tail pin.

#### IN-02: Reveal-tail source pin does not assert the absence of a leading interpolation-break write (law 4)

**File:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts:5122-5160`; coverage today via `app/src/stores/physicPaintStore.test.ts:3982-3985`
**Severity:** Info

**Issue:** The source pin asserts no purge / no base pin / no stroke record / no cached frame writes, the empty-span refusal, both render paths, and the `reveal-frame-missing` refusal — but it does not assert that the port avoids the `commitRevealBake` leading-interpolation-break behavior, which is the other half of "render-only" in law 4. That half is currently covered indirectly by the store test's document-identity assertion (`expect(getEfxPaintDocument(LAYER)).toBe(documentBefore)` after a render), so the law is not unguarded, but the Studio pin alone would pass if the seam were swapped to a write path that preserved document identity by accident.

**Fix:** Add `expect(revealPort).not.toContain('incomingInterpolationBreak');` (and, if the seam is refactored, `expect(revealPort).not.toContain('commitRevealBake')`) to the existing pin.

---

_Reviewed: 2026-10-31T19:58:32Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
