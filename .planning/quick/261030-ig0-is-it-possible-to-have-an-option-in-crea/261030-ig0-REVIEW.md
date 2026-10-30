---
phase: quick-261030-ig0
reviewed: 2026-10-30T15:18:30Z
depth: quick
files_reviewed: 26
files_reviewed_list:
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
  - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoGroupParity.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/types/physicPaint.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Quick 261030-ig0 — Code Review Report

**Reviewed:** 2026-10-30T15:18:30Z
**Depth:** quick (config) — static read of the diff plus tracing of every persistence/comparator path the new members touch
**Files Reviewed:** 26
**Status:** issues_found

```yaml
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
```

## Summary

Scope: the opt-in `keyScriptEdits` flag and slot-keyed `keyScriptOverrides` collection on Roto Loop Clips, the `key-edit` dialog mode, the reveal single-key re-bake (`rebakeRevealRailKey` as the reveal branch's only committer), and the `discardKeyScriptOverrides` regenerate wire member.

What verifies clean against the five stated focus areas:

1. **Validator gating / byte identity — PASS.** `keyScriptOverrides` requires `keyScriptEdits === true`, is length-bounded by `sourceKeyIds`, strictly ascending, in-range, and closed-allowlisted (`physicsPaintRotoPhysicalModel.ts:897-927`, allowlist 533-541). Creation writes the flag only when true (`efxPaintStore.ts:1639-1641`), so a rail created with the toggle off stays byte-identical. The parser reconstructs and deep-freezes both members (`physicsPaintRotoPhysicalModel.ts:1107-1129`).
2. **Enumerating-site survival — PASS.** Clone (`useRotoPhysicalEditCoordinator.ts:713-727`), duplicate/paste (`physicsPaintRotoRailSetCopy.ts:476-487`, slots correctly NOT translated by `delta`), both history comparators (`useRotoPhysicalEditHistory.ts:456-460`, `585-591`), commit ack (`physicsPaintRotoPlayScriptController.ts:2942-2946`), and the bridge's canonicalize/`stableSerialize` path all carry the new members. The canonical-fingerprint exclusion is deliberate and mirrored by the Rust encoder staying untouched (`physicsPaintRotoPhysicalModel.ts:1583-1593`).
3. **Double-commit on reveal key-edit — PASS.** The reveal branch calls `ports.rebakeRevealKey`, then `finishKeyEdit` and returns; it never calls `ports.commit` (`physicsPaintRotoPlayScriptController.ts:1462-1491`). The store is the single committer and the Studio records the returned descriptor exactly once (`PhysicsPaintStudio.tsx:3986-3988`).
4. **Slot bounds after `sourceKeyIds` rewrites — PARTIAL.** Resize relies on the prefix law and correctly drops tail slots (`efxPaintStore.ts:2085-2112`); relink drops the whole collection (`physicsPaintRotoPlayScriptController.ts:1670-1672`); regenerate protects individually edited keys (`2124-2146`). The repair and legacy source-edit branches keep overrides by slot while re-baking the whole cycle from rail-level settings — see WR-01.
5. **Preact/signals discipline — PASS.** `setKeyScriptEdits` / `setDiscardKeyEdits` are compare-then-write (`physicsPaintRotoPlayScriptController.ts:738-747`); resets are guarded (`807`, `828`, `889`); the controller is created once with a ref-held `availabilityRevision` updated only inside an effect (`useRotoPlayScriptController.ts:33-52`); `keyEditOpen` is a signal in a ref written only from handlers (`PhysicsPaintScriptsPanel.tsx:85-86`, `155`).

One blocker: the reveal per-key override write is gated by a canonical revision that deliberately excludes the override members, so after the first key edit on a reveal rail the write is silently discarded while the UI, the document revision and the undo ledger all report success.

No source files were modified — review was read-only. The findings below are from direct code review; no structural pre-pass (`fallow`) block was provided.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Reveal key edits after the first are silently discarded — `rebakeRevealRailKey` reports success while the loop-clip write no-ops

**Files:**
- `app/src/stores/efxPaintStore.ts:1906-1935` (the records-first ordering and the loop write)
- `app/src/stores/physicPaintStore.ts:4639-4646` (the revision-gated no-op)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1583-1594` (exclusion of `keyScriptOverrides`, inclusion of `syncState`)
- `app/src/stores/efxPaintStore.ts:1924-1928` (the only canonical term that changes in `updatedClip`)

**Issue:** `rebakeRevealRailKey` writes the override collection through `replaceRotoPhysicalLoopClips`, whose guard returns `{ ok: true }` without writing when the recalculated canonical revision equals the current one (`physicPaintStore.ts:4646`). The new members are deliberately not canonical terms (`physicsPaintRotoPhysicalModel.ts:1583-1593`), so an override-only difference is invisible to that comparison.

The records-first ordering does not help, and the comment at `efxPaintStore.ts:1906-1908` describes the mechanism backwards. `replaceRotoPhysicalLoopClips` rebuilds the next revision from the **current** records (`physicPaintStore.ts:4639-4645`), i.e. after the records replacement already moved the current revision at `physicPaintStore.ts:4068-4075/4092-4093`. Both sides therefore become `f(newRecords, ·)`, and the records bump cancels out. The only canonical term that actually changes in `updatedClip` is `syncState` (`'synchronized' → 'modified'`, encoded at `physicsPaintRotoPhysicalModel.ts:1594`), and each rail can make that transition exactly once.

Consequences:

- **First key edit on a reveal rail:** `syncState` moves, the loop write lands, the override persists.
- **Every later key edit on the same rail:** `syncState` is already `'modified'`, the clip's canonical encoding is unchanged, `replaceRotoPhysicalLoopClips` no-ops. If the bake changed bytes, the records write lands but the override does not — the stored override now describes settings that were not baked (the "Edited" badge and the key-edit prefill lie). If the bake was byte-identical, nothing at all persists. In both cases `rebakeRevealRailKey` returns `{ ok: true }`, increments `documentRevision`, and mints a `reveal-key-edit` undo descriptor (`efxPaintStore.ts:1937-1954`), and `finishKeyEdit` announces "Key N re-baked" (`physicsPaintRotoPlayScriptController.ts:1563-1577`).

Reachable triggers for the byte-identical case: toggling `photoWiggle` on a key whose motion is all zeros (`computeAquarelleSheetPose` returns `null` for all-zero motion — `aquarelleFramePose.ts:24-44` — and the renderer returns the composite unchanged, `physicsPaintRotoPlayScriptRenderer.ts:361-373`), and an `overrideColor`-only change on a reveal rail (`overrideColor` is not an input to `renderRotoRevealFrames`, `efxPaintStore.ts:1865-1879`; the reveal bake tints from the wash, `physicsPaintRotoPlayScriptRenderer.ts:215-226`). Any second edit that only changes metadata lands in the stale/dropped branch.

Evidence that the guard is real and that this path violates the authors' own invariant: the reveal test's `injectOverrides` helper documents that "an override-ONLY clip write is dropped as a no-op by `replaceRotoPhysicalLoopClips`'s revision guard. Every real path changes a fingerprint term in the SAME write (replay/resize/regenerate all rewrite `sourceKeyIds`)" — `efxPaintStore.reveal.test.ts:1131-1139`. `rebakeRevealRailKey` deliberately does **not** rewrite `sourceKeyIds` (it preserves the target `keyId`, `efxPaintStore.ts:1892-1895`), so it never satisfies that invariant. Replay is safe only because `commitRevealBake` mints fresh key ids (`physicPaintStore.ts:2078`). The existing test performs exactly one rebake per rail (`efxPaintStore.reveal.test.ts:1297-1361`), so the second-edit path is unpinned.

**Fix:** make the metadata write unconditional rather than revision-gated. Concretely, one of:

```typescript
// physicPaintStore.ts — opt-out of the canonical no-op for metadata writes
replaceRotoPhysicalLoopClips(
  layerId: string,
  trackId: string,
  value: unknown,
  options?: { readonly persistNonCanonical?: boolean },
): { ok: true } | { ok: false; error: string } {
  // ... parse (fail-closed) unchanged ...
  if (!options?.persistNonCanonical
    && nextRevision === this.getRotoPhysicalContentRevision(layerId, trackId)) return { ok: true };
  // ... write ...
}
```

and call it from `rebakeRevealRailKey` with `{ persistNonCanonical: true }` (the parse already fails closed; re-writing an identical canonical collection is idempotent). Alternatively add a dedicated `writeRotoPhysicalLoopClipMetadata` mutation that always persists after the same parse. Add defence-in-depth after the write:

```typescript
const persisted = physicPaintStore.getRotoPhysicalLoopClips(layerId, rail.trackId)
  .find((clip) => clip.loopId === loopId);
if (!persisted || !sameKeyScriptOverrides(persisted.keyScriptOverrides, nextOverrides)) {
  return { ok: false, reason: 'loop-clip-failed' };
}
```

Also correct the inverted comment at `efxPaintStore.ts:1906-1908` and add a regression test with two consecutive `rebakeRevealRailKey` calls on the same rail (second edit on a different slot, plus a same-slot color-only edit), asserting both overrides persist.

## Warnings

### WR-01: Repair and legacy Source Edit keep per-key overrides while re-baking the cycle from rail-level settings

**Files:**
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2101-2113` (repair)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2187-2203` (legacy source edit)
- Contrast: `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2115-2146` (regenerate protects edited keys)

**Issue:** Both branches replace the clip's `sourceKeyIds` with a freshly regenerated cycle baked from the **rail-level** `motion` / `overrideColor` / `renderMode`, but keep the per-key overrides by slot via `keepAddressableKeyScriptOverrides`. The stored override therefore no longer describes the bytes at that slot: the "Edited" marker and the key-edit prefill report settings that were never applied to the current bake. The lifecycle source-edit path does the opposite — `protectedByKeyId` substitutes the accepted bytes for every overridden key precisely so the override stays truthful (`2124-2146`). Two source-edit paths, two different semantics for the same durable member.

**Fix:** apply the same protection to both branches (map each override slot of the edited clip to the accepted record and substitute it before the publication, as the regenerate branch does), or, if a repair is defined as "restore the whole cycle from rail settings", clear the collection explicitly in those branches (reuse `withoutKeyScriptOverrides` at `1600-1604`) so the metadata does not claim edits that were discarded. Pick one law and make all three branches agree.

### WR-02: `rebakeRevealRailKey` writes a stale rail snapshot captured before the async bake

**Files:**
- `app/src/stores/efxPaintStore.ts:1829` (rail snapshot)
- `app/src/stores/efxPaintStore.ts:1863-1884` (two awaits)
- `app/src/stores/efxPaintStore.ts:1924-1935` (stale clip spliced back into the freshly-read collection)

**Issue:** `rail` is captured before `_revealScriptLoader` and `renderRotoRevealFrames`, then `updatedClip` spreads that stale `rail.clip` into the collection re-read at `1929`. If the rail changes during the bake, the clip write reverts the concurrent rewrite (or writes a commit that no longer matches the store). The records re-check at `1889-1891` catches a replay (fresh key ids) but not a rewrite that keeps the target key; a shortened cycle can leave `sourceKeyIds` pointing at records that no longer exist — dangling references are explicitly legal to the loop-clip validator (`physicsPaintRotoPhysicalModel.ts:884-888`; the ref check at `physicPaintStore.ts:4621-4631` only covers `mode === 'static'`). Today `resizeRevealRail` / `replayRevealRail` have no UI call sites, so the realistic trigger is an undo/redo landing mid-bake; the hazard becomes reachable the moment those mutations are wired.

**Fix:** re-resolve the rail after the awaits and fail closed when the identity changed; build the update from the fresh clip:

```typescript
const currentRail = _findRevealRail(getDocument(layerId) ?? document, layerId, loopId);
if (!currentRail
  || currentRail.clip.syncState !== rail.clip.syncState
  || currentRail.clip.sourceKeyIds.length !== rail.clip.sourceKeyIds.length
  || currentRail.clip.sourceKeyIds[input.slot] !== input.targetKeyId) {
  return { ok: false, reason: 'bake-failed' };
}
```

## Info

### IN-01: `keyScriptOverridesEqual` is duplicated in two modules

**Files:**
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts:390-411`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2952-2972`

**Issue:** Two independent field-level comparators for the same durable shape. They agree today, but a future member added to one and not the other would make the settlement ack and the undo snapshot disagree — exactly the class of bug the members' comments warn about.
**Fix:** export one comparator (e.g., `physicPaintRotoKeyScriptOverridesEqual` from `physicsPaintRotoPhysicalModel.ts` next to the allowlist) and consume it from both modules.

### IN-02: `sameLoopClipCollections` is not the field-exact comparator its contract claims

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:2920-2949`

**Issue:** The comment says "Field-exact Loop Clip collection comparison", but the comparator omits `railKind`, `colorize` / `colorizeMix`, `syncState`, and the whole lifecycle block (`provenanceState`, `phaseOrigin`, `originalEndExclusive`, `visibleRanges`, `frameOverrides`). This change added `keyScriptEdits` and the override compare but left those gaps, so a colorize- or syncState-only divergence between the child's publication and the parent's accepted document is acknowledged as a match.
**Fix:** compare every persisted member (or canonicalize both sides and compare the serialized form) and update the comment; at minimum add `railKind`, the colorize pair, and `syncState`.

---

_Reviewed: 2026-10-30T15:18:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
