---
status: testing
phase: 58-rail-editing-regressions
source: [58-VERIFICATION.md]
started: 2026-11-03T15:30:00Z
updated: 2026-11-03T15:30:00Z
---

## Current Test

number: 1
name: Key Rail inspector takeover
expected: |
  In the Studio, selecting a normal Key Rail, double-clicking one, or focusing one
  and pressing Enter replaces the Scripts pane with the inspector showing exactly
  Frames, Keys, Type Standard, an Edit Rail action, and Close. Each entry surface
  opens the reduced modal; Close restores the normal Scripts content.
awaiting: user response

## Tests

### 1. Key Rail inspector takeover
expected: Select / double-click / Enter a normal Key Rail → inspector shows Frames, Keys, Type Standard, Edit Rail, Close; each entry opens the reduced modal; Close restores Scripts.
result: [pending]

### 2. Reduced Cycle modal
expected: Only the Cycle stepper (prefilled 1) and the Infinity switch — no tabs or source controls; Create Cycle commits a gray Standard cycle.
result: [pending]

### 3. Rail-set anchor
expected: Modifier-selecting multiple rails whose first member is a Key Rail shows Edit Rail visibly disabled with "Select a single rail to edit it." and offers no bulk conversion.
result: [pending]

### 4. Cancel during the in-flight window and during committing
expected: Zero writes, no undo entry, the modal stays usable, and a retry commits exactly once — both when cancelling while the authority request is in flight and when cancelling during committing.
result: [pending]

### 5. Single-key drag under Law A on a Motion/Static/Reveal rail
expected: With exactly one loop referencing the cycle, an order-preserving single-key drag is accepted and the cycle re-derives; an order-breaking drag is rejected with the locked rigid-group copy and never shows "Source missing".
result: [pending]

### 6. Enter in the Cycle field
expected: Enter inside the Cycle field confirms exactly once (same as clicking Create Cycle); Escape cancels with zero writes.
result: [pending]

### 7. CR-03 scope decision — partial-cycle group move
expected: Decide whether to fix the pre-existing `move-key-group` order-invariant hole before phase acceptance, or explicitly defer it. Today a partial-cycle group drag past later source keys is accepted and leaves the cycle unresolved ("Source missing", export blocked).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

### G-01 — Deleting end keys on a converted Standard rail leaves the cycle spanning the deleted frames, with cached paint

**Reported:** 2026-11-03 (live Studio UAT)

**Repro (user):**
1. Create a Motion rail and rasterize/convert it — it becomes a Standard (grey) rail.
2. Delete the 2 end keys.
3. The cycle does not stop at the last surviving key; it still covers the deleted keys' frames, and those frames show cached paint instead of being empty.
4. Close the Studio and reopen: the deleted key still has cache but renders as an empty frame — the cycle believes the rail end is the real end of the keys, but it is not.
5. Edit Rail → Cycle 1: the deleted keys are still there. Cycle 2: four empty keys appear, still with cached paint.
6. Remove the cycle, delete 2 more end keys, re-add Cycle 2: more empty frames appear with live cached paint.

**Surface:** `PhysicsPaintPlayScriptDialog` (Cycle/Infinity), the converted `PhysicPaintRotoLoopClip` lifecycle (`physicsPaintRotoPlayScriptController.ts:1851`), loop range derivation (`physicsPaintRotoPhysicalResolver.ts:5507`), and the per-key live/persisted pixel cache.

**Observed code invariants that must be reconciled with the report:**
- `delete-key`, `delete-key-rail`, `delete-key-group` all reject deleting any key referenced by a loop (`loop-source-key-delete-rejected`, resolver :4171/:4206/:4302) — so a loop-owned end key should not delete at all.
- A finite converted clip stores a lifecycle (`originalEndExclusive`, `visibleRanges`), and `derivePhysicPaintRotoLoopRanges` takes `naturalEnd` from that stored lifecycle (:5570-5577) rather than from the current key set — a frozen span is a plausible cause of a cycle that keeps covering frames whose keys no longer exist.
- `updateLoop` recomputes `cycleDuration` from the current derivation and refuses only when a `frameOverride` sits at/after the new end (:2263-2266) — it does not drop overrides or caches inside the shrunk span.

**Live evidence (project `v2.0.0-Test.mce`, layer `79b4e715…`, read 2026-11-03):**
- Track 1 `realKeyRecords` sit at frames `0,3,4,…,17` — the two deleted keys left a **keyless gap at frames 1–2**; deletion does not close the sequence.
- Track 1 carries `groupOverrideRecords` at frames `3,4,6,8,11,12` — the baked per-frame paint sheets that render as the "cache" the user sees. In the saved state each override still coincides with a real key; the reported state (override surviving its key) is the same mechanism one delete later.
- `loopClips` is `[]` in the saved state, so the cycle itself was removed before the save; the loop span behaviour is only observable live.

**Root-cause candidates (code-confirmed):**
1. **`groupOverrideRecords` are never pruned by the plain delete paths.** `physicsPaintRotoPhysicalResolver.ts` contains no `groupOverrideRecords` reference at all; only the Group-lifecycle proposer filters them (`physicsPaintRotoGroupLifecycle.ts:554`, via `cleanupKeyIds`). A single-key or group delete that removes a baked sheet's backing key therefore leaves the sheet — the frame renders cached paint with no key.
2. **Ownership parity gap.** `delete-key` (:4171) and `delete-key-group` (:4300) count only `sourceKeyIds` references, while `delete-key-rail` also treats `frameOverrides` keys as group-owned (:4212-4216). A single/group delete can therefore remove an override-backed identity that the Key Rail path would have refused.
3. **Frozen loop extent.** `derivePhysicPaintRotoLoopRanges` takes `naturalEnd` from the stored lifecycle (`:5570-5577`) and `updateLoop` only refuses overrides at/after the new end (`:2263-2266`); neither trims a cycle whose source keys were removed.

**Next:** gap-closure plan covering (a) override cleanup on every delete path, (b) ownership parity for `frameOverrides` keys, (c) resize/refuse semantics for a cycle whose source keys shrink.

