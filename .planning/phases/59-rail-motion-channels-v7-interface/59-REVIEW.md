---
phase: 59-rail-motion-channels-v7-interface
reviewed: 2026-11-07T11:36:22Z
depth: deep
files_reviewed: 23
files_reviewed_list:
  - app/src-tauri/src/services/script_library.rs
  - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
  - app/src/components/physic-paint/roto/railMotionCommands.test.ts
  - app/src/components/physic-paint/roto/railMotionCommands.ts
  - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/TimelineMotionChannels.test.ts
  - app/src/components/physic-paint/view/TimelineMotionChannels.tsx
  - app/src/components/physic-paint/view/timelineRailDesign.ts
  - app/src/lib/__fixtures__/railMotionCanonical.golden.json
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/railMotionCanonicalParity.test.ts
  - app/src/stores/efxPaintStore.reveal.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
  - app/src/stores/physicPaintStore.ts
  - app/src/stores/trackIsolation.test.ts
  - app/src/types/physicPaint.ts
findings:
  critical: 1
  warning: 2
  info: 5
  total: 8
  necessity: 1
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-11-07T11:36:22Z
**Depth:** deep
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Deep review of the four Phase 59 gap-closure plans (59-22..59-25) executed after base `64aed4368`, spanning the rail-motion command/model layer, the rail-set copy/paste planner, the reveal-bake store transactions, the timeline row/layout surface, the golden-fixture parity suite, and the Rust canonical encoder.

All four targeted fixes are verified sound in their intended paths:

- **59-22 (CR-01/WR-06):** `commitRevealBake` reads `currentLoopClips` once, refuses a duplicate pending template before any render side effect, and reconciles the baked records against the pre-creation snapshot; the copy planner's loop member now carries required `sourceEntries`, materializes cross-track sources with the same `destinationStart + offset` law as the same-track path, and fails closed on any unresolvable source id (`loop-source-outside-pasted-set`).
- **59-23 (WR-01):** the add-channel `+` row renders while the Motion block renders and is gated by `resolveMotionCommandAvailability`; the disabled state is reachable (all four display lanes keyed) and the measured layout height and outline rect agree (123 px).
- **59-24 (WR-02/WR-05):** `mergedDrop` is gone from cut/clear results while move retains its production consumer, and the code-unit comparator matches Rust `str::cmp` for the accepted ASCII id charset; the sixth golden document (`rail-motion-ordering`) pins mixed-case ordering in both languages.
- **59-25 (WR-03/WR-04):** easing/wiggle fan out per axis with each axis' own resolved value and no `pairedValue`, and the lane curve sampler receives the real `railId`.

Gates run during this review: 10 touched vitest suites → 650 passed, 1 skipped; `cargo test --lib rail_motion` → 8 passed including `rail_motion_canonical_parity`; `cargo test --lib canonical_physical` → 5 passed; `pnpm exec tsc --noEmit` → clean.

One BLOCKER remains outside the gap-closure diffs but inside the reviewed files: the canonical number encoder diverges between TypeScript and Rust for exponent-notation magnitudes, and Phase 59 made an unbounded domain (scale/rotation) reachable from the shipped Motion inspector. Two WARNINGs cover a non-ASCII id assumption in the canonical law and a cross-track paste extent gap introduced by 59-22.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Canonical number encoding diverges for exponent-notation magnitudes; an in-domain scale/rotation value can never settle

**File:** `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts:16-18`, `app/src-tauri/src/services/script_library.rs:1282-1284` (reachability: `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:220-239`, `app/src/components/shared/NumericStepper.tsx:216-222`, `app/src/components/physic-paint/roto/railMotionCommands.ts:956-959`, `app/src/components/physic-paint/roto/railMotionModel.ts:168-187`)

**Issue:** The two canonical encoders format numbers differently at the edges of the double range:

- TypeScript: `encodeCanonicalNumber` emits `` `n${String(value)};` ``. ECMAScript `String(number)` switches to exponent notation for `|value| >= 1e21` and `|value| < 1e-6` (`String(1e21) === '1e+21'`, `String(1e-7) === '1e-7'`).
- Rust: `canonical_number` emits `format!("n{value};")`. `f64`'s `Display` never uses exponent notation (`1e21` → `1000000000000000000000`, `1e-7` → `0.0000001`).

The hashes then differ twice over: different source text, and different length/hash inputs (TS `source.length` UTF-16 units vs Rust `source.len()` bytes — equal only for ASCII, which exponent notation produces here, so the text divergence alone is decisive).

This used to be theoretical because the comment at `script_library.rs:1251-1257` asserts the document only carries "bounded integers plus the [0,1] grain strength float". Phase 59's D-09 domains break that premise: scale is any finite `> 0` and rotation is any finite number (no upper bound), and `railMotionValueIsValid` (`railMotionModel.ts:168-187`) / `rail_motion_value_is_valid` (`script_library.rs:1567-1578`) both accept them. The shipped Motion inspector is a free-entry `NumericStepper` with no `min`/`max` (`PhysicsPaintScriptsPanel.tsx:220-239`); `commitStepperInput` only clamps when bounds exist and returns `Number(next.toFixed(3))` (`NumericStepper.tsx:216-222`). `(1e23).toFixed(3)` is `'1e+23'`, so typing `1e23` into the Scale field (percent unit) yields model value `1e21`, which passes `railMotionValueIsValid('scale', 1e21)` and is written by `writeRailMotionChannelValueAtCursor` (`railMotionCommands.ts:956-967`). Rotation has the same path with the raw model value. The command reports success (the UI shows no rejection), then every prepare fails at the Rust hash gate (`script_library.rs:1244-1247`) with "Target physical hash does not match the canonical physical document". Because the offending value stays in the in-memory document, later prepares keep failing — the document is wedged unsavable with a generic error. The six golden fixture documents only carry small values, so `rail_motion_canonical_parity` stays green and cannot catch this.

**Fix:** Make the TypeScript encoder print plain decimal notation unconditionally, expanding `String(value)`'s exponent form by string surgery (no float arithmetic, preserving the shortest-roundtrip digits), and pin both sides with fixture entries:

```ts
function plainDecimal(value: number): string {
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/i.exec(text);
  if (match === null) return text;
  const [, sign, intPart, fracPart = '', exponentText] = match;
  const digits = intPart + fracPart;
  const pointIndex = intPart.length + Number(exponentText);
  const plain = pointIndex <= 0
    ? `0.${'0'.repeat(-pointIndex)}${digits}`
    : pointIndex >= digits.length
      ? `${digits}${'0'.repeat(pointIndex - digits.length)}`
      : `${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
  return `${sign}${plain}`;
}

export function encodeCanonicalNumber(value: number): string {
  return `n${plainDecimal(Object.is(value, -0) ? 0 : value)};`;
}
```

Then add fixture documents carrying `1e21` and `1e-7` (e.g. a rail-motion scale/rotation key) so the parity test fails today and passes after the fix, and update the stale comment at `script_library.rs:1251-1257`. If expanding exponent form is rejected, the alternative is bounding scale/rotation, but that contradicts D-09's unbounded rotation.

## Warnings

### WR-01: The canonical ordering/encoding law assumes ASCII ids but no boundary enforces it

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:1591-1603`, `app/src/efx-paint/document/efxPaintCanonicalEncoder.ts:12-14,28-35`, `app/src-tauri/src/services/script_library.rs:1260-1262,1580-1589,1600-1604`

**Issue:** `compareCanonicalIds` documents "the accepted rail/key ids are ASCII, and for ASCII UTF-16 code-unit order is identical to UTF-8 byte order". Nothing verifies that premise. For a non-ASCII id the two encoders disagree on every axis at once:

- ordering: UTF-16 code-unit order is not UTF-8 byte order (e.g. `'é'` U+00E9 sorts after `'z'` in UTF-8 bytes but before it in UTF-16 units; astral characters compare as surrogate pairs);
- length prefixes: `s${value.length}:` counts UTF-16 units while `canonical_string` uses `value.len()` bytes;
- hashing: FNV over `charCodeAt` vs over `bytes()`, and `source.length` vs `source.len()` in the `length-hash` token;
- id limits: `RAIL_MOTION_ID_MAX_LENGTH = 128` counts UTF-16 units (`railMotionModel.ts:115,132`) while `rail_motion_bounded_id` uses `chars().count() <= 128` (`script_library.rs:1580-1589`), and the paste payload path accepts up to 256 units (`railMotionCommands.ts:62-64`, `types/physicPaint.ts:1553-1584`).

App-minted ids are `crypto.randomUUID()` values, so this is reachable only from foreign/doctored documents or crafted paste payloads — but the "ASCII" doc comment is the only defense. The failure mode is fail-closed at the prepare hash gate (no silent corruption), which is why this is a WARNING rather than a BLOCKER.

**Fix:** Enforce the declared charset at both trust boundaries — the TS parsers/payload validators and `rail_motion_bounded_id` — with an explicit ASCII check (e.g. `/^[\x20-\x7E]+$/`, or stricter `[A-Za-z0-9_-]`), and update the `compareCanonicalIds` comment to state the enforced condition rather than an assumption. Add a rejection test for a non-ASCII `railId`/`keyId` in both the payload validator and the Rust parser.

### WR-02: Cross-track Loop Clip materialized source frames are outside the paste extent/occupancy model

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:650-671,693-709,859-869,965-999`

**Issue:** `computePastedExtent` enumerates only key-rail entry destinations and loop end-exclusives. For `crossTrack`, the 59-22 materialization creates fresh real-key records at `destinationStart + (entry.sourceAppFrame - firstSourceFrame)` (lines 980-988), and those frames never enter `PastedExtent.keyDestinations`. Consequences:

- `findDuplicateAnchor` (`:693-709`) can accept an anchor whose loop-materialized frames collide with occupied frames, because its occupancy test only sees key-rail destinations. A later anchor that would fit is never considered once a colliding early anchor passes the key-rail test.
- `proposeRails`' conflict/capacity checks (`:859-869`) likewise miss the loop-materialized frames, so the plan is accepted and the collision surfaces only when the store validates the records (`replaceRotoPhysicalRecords` → duplicate `appFrame` / capacity / negative frame), reported through the generic `'apply-failed'` status instead of a specific rejection.
- Lower bound: `extent.loopEndExclusives.some((end) => end > document.capacity)` has no `>= 0` counterpart for loop placements. With `placementMode: 'paste'`, an anchor that sits after the loop's `placementStart` produces `destinationStart < 0` while the end stays positive, and the loop-materialized keys land on negative frames — again caught only by the records port.

No corruption results (the transaction validates before mutating), but the paste/duplicate can fail with a misleading reason or skip a fitting destination. The same-shape bug existed for same-track loops; 59-22 extends it cross-track and shares the materialization law, so this gap-closure did not close it.

**Fix:** Extend `PastedExtent` to include every materialized loop key frame — for both branches, map `member.sourceEntries` (cross-track) or resolved source records (same-track) through the same offset law — and use the union in `findDuplicateAnchor` and in the `proposeRails` conflict/lower-bound/capacity checks. Add a cross-track duplicate test where an occupied destination key lies between the loop placement start and its first materialized source frame, plus a negative-`destinationStart` paste test.

## Info

### IN-01: Impossible-state guard in the grouped easing/wiggle fan-out (necessity)

**Category:** necessity

**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:464-466`

**Issue:** `if (axisKey === null) continue;` guards "the record carries no channel entry for that axis at all". That state cannot occur for store-originated records: D-12 is enforced by the parser (`railMotionModel.ts:267-279`), `applyAnimateEdit` seeds both axes together (`:580-587`), `applyAddChannelEdit` adds both together (`:706-716`), and `applySetKeyEdit` only mutates a channel that already exists (`:607-609`), so a position record carrying the addressed axis necessarily carries the sibling. The guard's silent-skip behavior is also the wrong failure mode if the invariant ever broke: the command would report success after editing one axis, violating the "grouped edit is symmetric" law the function exists to uphold. Kept at Info rather than Warning because the helper is a pure function in an exported command module that can be called with externally constructed records, so the defensive branch is defensible; the proof rests on every producer enforcing D-12.

**Fix:** Either delete the branch (the invariant is producer-enforced) or make the impossible state loud — `if (axisKey === null) return failure(failureReason);` — so a violated invariant cannot masquerade as a successful single-axis edit.

### IN-02: `localeCompare` survives in two non-canonical ordering sites

**File:** `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts:309,1104`

**Issue:** 59-24 replaced collation ordering with code-unit ordering in the canonical encoder, but `orderMembers` (`:303-311`) and `orderedBreaks` (`:1104`) still call `localeCompare`. Neither currently changes a revision — fresh identities are random UUIDs, so member order is not persisted, and `buildPhysicPaintRotoPhysicalRevision` re-sorts incoming breaks internally with `compareCanonicalIds` (`physicsPaintRotoPhysicalModel.ts:1718-1721`) — but both are the same hazard the 59-24 fix removed, one refactor away from producing a two-revision document again.

**Fix:** Route both through the shared code-unit comparator (export `compareCanonicalIds`, or add a small `compareCodeUnits` helper next to it) and pin them with a mixed-case id test.

### IN-03: Narrowing payload type erases the new required `sourceEntries` field

**File:** `app/src/stores/physicPaintStore.ts:6099-6155` (loop arm at `:6106`, loop passthrough at `:6112-6114`, cast at `:6149-6154`)

**Issue:** `_narrowRailSetCopyPayloadToKeyIds` now operates on payloads whose loop members carry required `sourceEntries` (59-22), but its local generic's loop arm is still `{ kind: 'loop'; placementStart: number; loopId: string }`. Loop members are pushed through unchanged (correct today — a loop must keep its full source set), and the final `as T` hides the drift, so a future narrowing implementation could construct a loop member without `sourceEntries` and still typecheck.

**Fix:** Reference `RotoRailSetCopyMember` (or add `sourceEntries` to the local loop arm) and drop the `as T` where the generic can be satisfied structurally.

### IN-04: `addMotionChannel` still lacks a try/catch around the throwing reducer (carried forward)

**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:191-211`

**Issue:** Unchanged from the previous review. `applyRailMotionEditToCollection` throws on invalid canonical input (`railMotionModel.ts:210-277`), and `addMotionChannel` calls it outside any try/catch. Today the duplicate check at `:197-200` plus the reducer's grouped-axis no-op at `railMotionModel.ts:697` keep the throw unreachable from valid state, so this is defensive, not an active bug.

**Fix:** Wrap the call in `try/catch` returning `failure('This Motion channel could not be added.')`, mirroring `applyAxisMotionKeyEdits` (`:456-479`), so a malformed record surfaces a sentence instead of an uncaught exception in the event handler.

### IN-05: Dead exports `resolveRecordChannels` and `describeRailMotionOrphan` (carried forward)

**File:** `app/src/components/physic-paint/roto/railMotionCommands.ts:686`, `app/src/components/physic-paint/roto/railMotionIdentity.ts:197`

**Issue:** Unchanged from the previous review. `resolveRecordChannels` has no caller anywhere in `app/src`; `describeRailMotionOrphan` is referenced only by `railMotionIdentity.test.ts`. Both are production exports with no production consumer.

**Fix:** Delete them, or wire them into the surface that was meant to use them; if they are intentionally test-only API, document that ownership.

---

_Reviewed: 2026-11-07T11:36:22Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
