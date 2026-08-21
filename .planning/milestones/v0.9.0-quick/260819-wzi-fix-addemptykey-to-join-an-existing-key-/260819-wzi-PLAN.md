# 260819-wzi — Fix addEmptyKey to join an existing Key Rail when destination is strictly INSIDE a segment span

**Type:** quick · **Status:** planned
**Source:** user-reported — since quick 260816-tv7, `addEmptyKey` always passes `startsNewSegment=true`, so adding a key inside a Key Rail spawns a spurious one-key rail instead of joining. Splitting is the Scissor tool's job.

## Contract

- Destination frame **strictly inside** a derived Key Rail segment span (`firstKeyFrame < dest < lastKeyFrame`, per `deriveKeyRailSegments`) → `startsNewSegment=false`: the new key connects; the rail re-derives over it. Example: keys 0/4/8, + Key at 6 → one rail 0/4/6/8.
- Destination in trailing empty space, an intentional gap, or any position NOT inside a segment span → `startsNewSegment=true` (unchanged 260816 broken-key contract; 43.4 SC-10 own-one-key-rail).
- Paint-on-empty, Insert, Motion/Static Group-owned frames: unchanged.
- One atomic history command; Undo/Redo round-trip; save/reopen parity; success copy unchanged.

## Where / why

- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
  - `addEmptyKey` (lines 2003–2028). Line 2019 hard-codes `createPhysicPaintRotoPasteKeyIntent(destinationAppFrame, emptyPayload, null, true)` — the trailing `true` is `startsNewSegment`. The fix replaces this constant with a computed predicate.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` — `deriveKeyRailSegments` (line 37) already exports the segment projection the contract references. Reuse it directly.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
  - Already imports `deriveKeyRailSegments` (line 53) and already builds the identical segment input at lines 1469–1479 (groupOwnedKeyIds from `loopClips.sourceKeyIds` + `frameOverrides`; orderedRealKeys sorted by appFrame; breaks from `incomingInterpolationBreakKeyIds`). Reuse that exact construction.
  - Action input already exposes `getRotoKeyRecords()` (records), `getIncomingInterpolationBreakKeyIds()` (breaks), `getRotoLoopClips()` (group-owned source).

Predicate: a destination is strictly inside a segment iff `segments.some(s => s.firstKeyFrame < destinationAppFrame && destinationAppFrame < s.lastKeyFrame)`. Inside → `startsNewSegment=false`; else `true`.

## Tests

Target: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`
- Existing `+ Key (addEmptyKey) port` describe at line 928. The empty-records case (line 972) asserts `nextIncomingInterpolationBreakKeyIds === [newKeyId]` — the trailing/broken guard to preserve.
- Harness (`createHarness`, line 113) supports `records`, `loopClips`, `incomingInterpolationBreakKeyIds`, `getRotoLoopClips` — sufficient for all three scenarios. Assert against the dispatched `proposal.nextIncomingInterpolationBreakKeyIds` and `nextRecords`.

Run: `pnpm vitest run app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts`

---

## Task 1 — RED tests (must fail before the fix)

File: `useRotoTimelineActions.test.ts`, inside the existing `+ Key (addEmptyKey) port` describe.

1. **Join inside segment (FAIL first):** `records: [realKeyRecord('k0',0), realKeyRecord('k4',4), realKeyRecord('k8',8)]`, no breaks → `addEmptyKey(6, blankPayload(6))`.
   - Assert `proposal.nextIncomingInterpolationBreakKeyIds` is `[]` (joins the 0/4/8 rail → 0/4/6/8, no break).
   - Assert `proposal.nextRecords` has length 4.
   - Currently `[newKeyId]` and length 4 — so this RED fails today (it currently breaks → second rail).

2. **Trailing space stays broken (guard):** same records 0/4/8 → `addEmptyKey(10, blankPayload(10))`.
   - Assert `nextIncomingInterpolationBreakKeyIds === [newKeyId]` (unchanged, own one-key rail).
   - Passes today; guards the trailing case.

3. **Inside a gap stays broken (guard):** records 0/4/8 with a break owning key 4 (`incomingInterpolationBreakKeyIds: ['k4']`) → segments `[0]` and `[4,8]`; destination frame 1 is NOT strictly inside either span → `addEmptyKey(1, blankPayload(1))`.
   - Assert `nextIncomingInterpolationBreakKeyIds === [newKeyId]` (own one-key rail, 43.4 SC-10).
   - Passes; guards the gap case.

Run the file: Task 1 case must fail; cases 2–3 pass.

## Task 2 — Implementation (tests green)

In `addEmptyKey` (`useRotoTimelineActions.ts`, line ~2003), replace the hard-coded `true` (line 2019) with a computed `startsNewSegment`:

- Build the segment input mirroring lines 1469–1479:
  - `groupOwnedKeyIds` from `input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY` (`clip.sourceKeyIds` + `clip.frameOverrides.map(o => o.keyId)`).
  - `orderedRealKeys` from `[...input.getRotoKeyRecords()].sort((a,b) => a.appFrame-b.appFrame || a.keyId.localeCompare(b.keyId))`.
  - `incomingInterpolationBreakKeyIds: new Set(input.getIncomingInterpolationBreakKeyIds?.() ?? [])`.
- `const startsNewSegment = !segments.some(s => s.firstKeyFrame < destinationAppFrame && destinationAppFrame < s.lastKeyFrame);`
- Pass `startsNewSegment` instead of `true`.

Do NOT touch the script-target promotion at line ~1952 (separate paste path). Do NOT change the resolver. Guard-free inside `runPhysicalAction`.

Verify all three Task 1 tests green via `npx vitest run`.

## Verification / acceptance

- `npx vitest run app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — all green (existing 260816 broken case at line 972 intact).
- One atomic commit: RED tests + fix.
- Native UAT deferred to user: + Key at 6 inside a 0/4/8 rail → single 0/4/6/8 rail; + Key at trailing frame or inside a gap → own one-key rail; Undo/Redo round-trip; save/reopen parity.

## Out of scope

- Paint-on-empty, Scissor splitting, Motion/Static Group-owned frames, script-target promotion, persistence format.
