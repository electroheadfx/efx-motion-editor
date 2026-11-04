---
status: complete
phase: 58-rail-editing-regressions
source: [58-VERIFICATION.md]
started: 2026-11-03T17:56:00Z
updated: 2026-11-03T20:40:03.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Key Rail inspector takeover (select / double-click / Enter / Close)
expected: Select / double-click / Enter a normal Key Rail → the inspector shows Frames F{first}–F{last}, Keys n, Type Standard, Edit Rail, Close; each entry opens the reduced modal; Close restores the normal Scripts content.
result: pass

### 2. Reduced Cycle modal
expected: Only the Cycle stepper (prefilled 1) and Infinity switch; Create Cycle commits a gray Standard cycle; no tabs, rail type, frames-per-cycle, Motion, source-cycle, seed, or Regenerate controls appear.
result: pass

### 3. Rail-set anchor
expected: Modifier-selecting two or more rails whose first member is a Key Rail shows Edit Rail visibly disabled with "Select a single rail to edit it." and offers no bulk conversion.
result: pass

### 4. Cancel during the in-flight window and during committing
expected: Zero writes, no undo entry, the modal stays usable, and a later Create Cycle commits exactly once — both when cancelling while the authority request is in flight and when cancelling during committing.
result: pass

### 5. Single-key Law A drag on a Motion/Static/Reveal rail
expected: With exactly one loop referencing the cycle, an order-preserving single-key drag is accepted and the cycle re-derives; an order-breaking drag is rejected with the locked rigid-group copy and never shows "Source missing".
result: pass

### 6. Enter and Escape in the Cycle field
expected: Enter inside the Cycle field confirms exactly once (same as clicking Create Cycle); Escape cancels with zero writes.
result: pass

### 7. G-01 repro — surviving-cycle extent
expected: Convert a Motion rail to a Standard (grey) cycle, delete the end keys and change the Cycle count, then close and reopen the Studio. The cycle stops at the surviving source extent: deleted frames render empty (no cached paint), stale paint sheets are gone, and the repaired extent survives reopen. A genuinely dangling source id still presents "Source missing".
result: pass — retested 2026-11-03 after the G-02 contraction fix: the rail stops at the surviving source extent, deleted frames render empty with no cached paint, and the repaired extent survives reopen.

### 8. CR-01 — pasted Infinity rail tail
expected: Copy an Infinity rail whose visible span is not a whole multiple of its cycle length (e.g. keys at 10 and 14, cycle 5, next unowned key at 27), paste it elsewhere, commit, then reopen. The pasted rail renders the full copied visible duration (its 17-frame tail included) and survives the commit and reopen byte-identically; no tail frames are trimmed.
result: pass

### 9. WR-01 — lifecycle-gap key delete
expected: Reach a lifecycle gap (a rendered Group frame that later leaves visibleRanges) and press Delete on the real key now sitting on the gap frame: it deletes normally, with no impossible "Delete the Rail frame instead" instruction. Separately, Delete on a visible Group frame stays refused with the locked copy.
result: pass

### 10. CR-03 — partial-cycle group drag
expected: Select a partial source-cycle set (e.g. A and B of A..E) and drag the group to an order-preserving destination, then to an order-breaking one. The order-preserving drag is accepted and commits exactly once with the cycle still resolvable; the order-breaking drag is rejected with the locked rigid-group copy, never commits, and never shows "Source missing".
result: pass

## Summary

total: 10
passed: 10
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "G-02 — Deleting a key inside a Motion/interpolated rail must ripple the rail's keys, never leave a hole"
  status: resolved
  reason: "Fixed direct 2026-11-03; UAT passed."
  severity: blocker
- truth: "G-03 — Inserting a frame on a Motion rail must be allowed and interpolation-filled"
  status: resolved
  reason: "Fixed direct 2026-11-03; UAT passed."
  severity: blocker
- truth: "G-04 — Rail key drag (interior reposition and band ends)"
  status: resolved
  reason: "Fixed direct 2026-11-03; UAT passed."
  severity: blocker
- truth: "G-05 — + Key and paint on a Rail in-between must insert a source phase, not split the rail"
  status: resolved
  reason: "Fixed direct 2026-11-03; UAT passed."
  severity: blocker

## Gap Details

### G-02 — Deleting a key inside a Motion/interpolated rail must ripple the rail's keys, never leave a hole

**Reported:** 2026-11-03 (live UAT).

**Repro (user):**
1. Create a Motion rail on 5 frames (Cycle 1).
2. Delete the last key → the 5th frame empties, but the cycle still counts 5 source slots.
3. Edit Rail → Cycle 2 → the rail rebuilds with a hole at the deleted phase (end 10, frames 5..9 appended after the gap).
4. Deleting an **in-between** key behaves the same way: a gap appears inside the rail and the cycle does not shrink.

**Approved behavior (user, 2026-11-03):**
- A key/frame delete inside a Motion/interpolated rail removes that phase from the rail's source cycle and **shifts the following rail source keys left** (ripple) in the same accepted write, so the rail becomes a contiguous shorter cycle (5 keys → 4 keys; Cycle 2 → 8 contiguous frames).
- No hole may exist in a rail whose interior policy is `generate` (Motion + interpolation). Trailing and in-between deletes both contract.
- The deleted key record and any override at that phase are cleaned up; later overrides shift left with their phases.
- A shifted source key that would collide with an unrelated real key must fail closed (refuse the delete) rather than corrupt the timeline.
- The existing last-edge Delete Frame gap behavior is superseded for generate-mode rails; static/hold gap semantics stay unless the user says otherwise.

**Current mechanism:** a single selected key at a Group frame classifies as `group-frame` (`useRotoTimelineActions.ts:734-745`), and `proposePhysicPaintRotoDeleteGroupFrame` (`physicsPaintRotoGroupLifecycle.ts:614-689`) removes the phase from `visibleRanges` while keeping `sourceKeyIds`, `phaseOrigin`, and `originalEndExclusive`. The cycle length therefore never shrinks and `updateLoop` reappends the deleted phase as a gap.

**Fix (direct, 2026-11-03):** `proposePhysicPaintRotoDeleteGroupFrame` now contracts a generate-mode rail: the deleted phase leaves `sourceKeyIds`, later source keys ripple one frame left, overrides shift with their phases, and `originalEndExclusive`/`visibleRanges` follow the shorter cycle. Static/hold and reveal rails keep the legacy gap semantics; a shared source cycle or any foreign-key collision fails closed. Regression pins in `physicsPaintRotoPhysicalResolver.test.ts` (`58 G-02:`). UAT passed 2026-11-03.

### G-03 — Inserting a frame on a Motion rail must be allowed and interpolation-filled

**Reported:** 2026-11-03 (live UAT, same session).

**Repro:** with a Motion rail active, insert/create a frame → rejected with "Choose a valid timeline frame before inserting." (`useRotoTimelineActions.ts:160`, `:2069`, `:2078`, `:2088`).

**Approved behavior:** the insert should be accepted and the new frame filled by the rail's interpolation mode; the insert must not be blocked merely because the target frame is a linked rail frame.

**Fix (direct, 2026-11-03):** the insert-slot resolver now rebuilds a generate-mode rail instead of failing the Group-ownership guard — later source keys shift right and the cycle grows by one interpolated frame (`resolvePhysicPaintRotoRailInsertLoopClips`). Spaced source cycles (generated in-betweens, e.g. keys at 0/2/4) are supported, as are the same cycles for the G-02 delete contraction. Static rails take the same insert; non-canonical cycles still fail closed. Reveal rails and rails with painted overrides were added in the G-05 follow-up. Regression pins in `physicsPaintRotoPhysicalResolver.test.ts` (`58 G-02:`/`58 G-03:`). UAT passed 2026-11-03.

### G-04 — Rail key drag (interior reposition and band ends)

**Reported:** 2026-11-03 (live UAT, same session).

**Repro (user):** dragging any key of a Motion/Static/Reveal rail never starts. The user wants drag to move a source key inside the interpolated rail when there is room, and to shrink/grow the rail at its beginning and end directly by drag-and-drop (inserts remain the fallback when the target is occupied).

**Approved behavior (user, 2026-11-03):** rail source keys are draggable; a drag onto a free frame repositions only that phase and the rail's in-betweens redistribute; dragging the first or last source key outward/inward grows or shrinks the band at that end; occupied targets keep the existing insert path; order-breaking drags stay refused with the locked rigid-group copy.

**Fix (direct, 2026-11-03):** the cell drag gate no longer excludes Key Spacing proxies, so rail source keys can arm a drag. A single-key drag on a canonical lifecycle rail now free-repositions the moved phase — survivors keep their frames, so unrelated timeline keys are never rippled — and the band retimes from the new source span. Regression pins in `physicsPaintRotoPhysicalResolver.test.ts` (`58 G-05:`). UAT passed 2026-11-03.

### G-05 — + Key and paint on a Rail in-between must insert a source phase, not split the rail

**Reported:** 2026-11-03 (live UAT).

**Repro (user):**
1. With a Motion/Static/Reveal rail active, press `+ Key` (or paint) on an interpolated or empty frame inside the rail's first cycle.
2. The action creates a detached real key with its own rail; the PlayScript rail visually breaks into two segments around it.
3. Painting the same frame only writes the paint cache — no key marker appears.

**Approved behavior (user, 2026-11-03):** the action must add the key *inside* the rail — inter-rail frames included — and painting an in-between must auto-add the key. All rail kinds.

**Fix (direct, 2026-11-03):** `addEmptyKey` now detects a frame inside one canonical lifecycle rail and raises the paste-key intent with `railInsertGroupId`; the resolver inserts a real source key at that phase (later source keys shift right by one), extends every repeat (the rail's footprint grows by `repeat`, trailing content shifts by `repeat`), moves painted phase overrides with their phases, and replaces a destination-phase override with the new source key. `+ Key` on a repeat occurrence opens the key at the same phase in the first cycle; paint promotion only promotes the painted first-cycle frame (repeats keep the source-phase override route). The paint promotion gate now lets a rail in-between/gap promote to a real key instead of keeping a cache-only/override frame. **Insert (gap) now also accepts Reveal rails and rails with painted overrides** — the requested span grows and override phases move with the insert; an overridden rail without override-record authority still fails closed. Overlapping rails, shared source cycles, and malformed rails stay fail-closed. Regression pins in `physicsPaintRotoPhysicalResolver.test.ts` (`58 G-03:`/`58 G-06:`), `useRotoTimelineActions.test.ts`, and `physicPaint.test.ts`. UAT passed 2026-11-03.


