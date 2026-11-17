---
phase: 64-medium-engine
plan: 12
subsystem: ui
tags: [brush-groups, medium-engine, preact-signals, vitest, tdd]

requires:
  - phase: 64-02
    provides: the five medium records and the one-write applyAquarelleMedium handler
  - phase: 64-11
    provides: the compile-time group tags and brushGroupOf/BRUSH_PRESETS
provides:
  - the group-aware pickAquarelleBrush (outgoing group read before the live pick, incoming group resolved from the one preset table)
  - the Paint-tab agreement contract (selected medium id + the ten globals + size/lift)
  - the one-seam source audit (one tip-pick caller, two medium-handler callers, texture isolation)
affects: [brush-library UAT, medium dropdown parity, multi-group project replay]

actuals:
  tokens: 5483
  tasks: 2
  commits: 3
  plan_head_before: 38b938c29f1baa158ac3ffa7c871a6dbb147c0a8
  plan_head_after: 05e05ba73a01722a072a7d708f33b04a54a9698b

tech-stack:
  added: []
  patterns:
    - "Read the outgoing axis BEFORE a mutating seam call: the pick rewrites aquarelleSelectedTipId, so the outgoing group is peeked first"
    - "One identity table, no second mapping: the group value IS the medium id, resolved through BRUSH_PRESETS plus brushGroupOf"
    - "The live-bag handler is the only medium writer: one spread assignment plus the id, never a per-key setter, never a selection patch"
    - "Source-pin audit as an inventory: exact file lists plus per-file occurrence counts instead of bare totals"

key-files:
  created:
    - app/src/components/physic-paint/view/brushGroupMedium.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarellePaintControls.ts

key-decisions:
  - "The outgoing group is resolved from aquarelleSelectedTipId.peek() before selectAquarelleTip runs; a null or non-preset selection reads as DEFAULT_MEDIUM_ID, matching the untagged-preset law."
  - "A non-preset id resolves to no group at all, so a catalog or unknown tip can never acquire a medium (D-04; T-64-32 accepted by construction)."
  - "The medium write sits between the live pick and the selection commit, so the forwarded toolOverrides bag is still the post-pick bag and the patch stays { brushId, toolOverrides } with no params key."
  - "Task 2's agreement/audit contract was framed inside Task 1's RED file because both tasks own the same test file and the RED gate validates the run as a unit; Task 2's commit then strengthens the agreement assertions and adds the per-file occurrence counts."

patterns-established:
  - "Group-change guard at the pick seam: equal groups write nothing, so manual global tweaks survive (MED-13)"
  - "Audit inventories pin the exact expected file list, then count occurrences per file, so a future second pathway fails loudly"

requirements-completed: [MED-28]

coverage:
  - id: D1
    description: "A cross-group pick applies the group's record through applyAquarelleMedium in exactly one live-bag write, moves the medium id once, and still commits exactly one selection patch."
    requirement: MED-28
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#a cross-group pick applies the group medium (64-12 MED-28) > applies the pastel record once and still commits one selection patch"
        status: pass
    human_judgment: false
  - id: D2
    description: "A same-group pick writes neither the bag nor the id and keeps a manual tweak; a non-preset id has no group, writes no medium, still updates the live surface and returns the door refusal instead of throwing; size and lift survive every cross-group pick."
    requirement: MED-28
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#a cross-group pick applies the group medium (64-12 MED-28) > writes nothing inside the group and keeps a manual tweak"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#a cross-group pick applies the group medium (64-12 MED-28) > gives a non-preset id no group, no medium write, and the door refusal"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#a cross-group pick applies the group medium (64-12 MED-28) > keeps size and lift across every cross-group pick"
        status: pass
    human_judgment: false
  - id: D3
    description: "The committed selection patch is exactly { brushId, toolOverrides }, forwards the post-pick bag, carries no params key, and leaves the recorded stroke byte-identical."
    requirement: MED-28
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#a cross-group pick applies the group medium (64-12 MED-28) > forwards the post-pick bag and no params key in the committed patch"
        status: pass
    human_judgment: false
  - id: D4
    description: "After a cross-group pick the selected medium id equals the group and the ten globals deep-equal the record with the bag keeping its twelve keys; a texture selection changes neither; every preset group maps to a real medium record; the source audit pins one tip-pick caller, two medium-handler callers and the texture strip's isolation."
    requirement: MED-28
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#the Paint tab agrees after a cross-group pick (64-12 MED-28) > moves the selected medium id and the ten globals with the group"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#the Paint tab agrees after a cross-group pick (64-12 MED-28) > changes neither the medium id nor the bag when a texture is selected"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#the Paint tab agrees after a cross-group pick (64-12 MED-28) > maps every preset group to a real medium record"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#the seam audit (64-12 MED-28) > keeps one tip-pick caller and two medium-handler callers"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#the seam audit (64-12 MED-28) > routes every response surface through the one pick seam"
      - kind: unit
        ref: "app/src/components/physic-paint/view/brushGroupMedium.test.ts#the seam audit (64-12 MED-28) > keeps the texture strip orthogonal to the seam and the medium handler"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 12: Group-to-Medium Pick Summary

**The pick seam now reads the response group and applies its medium only when the group changes — one live-bag write through applyAquarelleMedium, a same-group pick that leaves manual tweaks alone, and a source audit that keeps every response surface on the one path.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-17T16:10:25Z
- **Completed:** 2026-11-17T16:17:02Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `pickAquarelleBrush` peeks `aquarelleSelectedTipId` for the outgoing group BEFORE `selectAquarelleTip` runs (the pick rewrites the id), resolves the incoming group from `BRUSH_PRESETS` via `brushGroupOf`, and calls `applyAquarelleMedium` only on a real group change.
- A same-group pick writes neither the live bag nor the medium id, so a manual global tweak made between two picks survives (MED-13); a null/no-preset selection reads as `DEFAULT_MEDIUM_ID`.
- A non-preset id (unknown or catalog tip) resolves to no group, writes no medium, still updates the live surface, and returns the selection door's refusal instead of throwing (T-64-32 accepted by construction).
- The committed selection patch stays exactly `{ brushId, toolOverrides }` with no `params` key, and the forwarded bag is the post-pick live bag — a card pick can never rewrite a recorded stroke (MED-11).
- The Paint tab agrees after a cross-group pick: the selected medium id equals the group, the ten globals deep-equal the record, the bag keeps its twelve keys, and `size`/`lift` keep their prior values; a texture selection changes neither.
- The audit pins one `selectAquarelleTip` caller (the seam) and two `applyAquarelleMedium` callers (the seam and the Paint-tab dropdown), one occurrence each beside its definition; the brush library, top-bar menu and BrushesDocker route through the seam; the texture strip references neither.
- The taxonomy cross-check proves every preset group is a real `MEDIUM_IDS` member with a record through `mediumById`, so a future preset cannot name a group with no medium.

## Task Commits

Each task was committed atomically (TDD: test then feat; Task 2 test-only):

1. **Task 1 RED: frame the group-aware pick contract** - `da0d7c971` (test)
2. **Task 1 GREEN: cross-group pick applies the medium** - `9e94742ea` (feat)
3. **Task 2: Paint-tab agreement + one-seam audit** - `05e05ba73` (test)

**Plan metadata:** committed separately after this SUMMARY (docs: complete plan).

## TDD Evidence

- **Task 1 RED** — `brushGroupMedium.test.ts`: 13 tests, 6 failing on the planned assertions (bag writes 0 vs 1, medium id `watercolor` vs `pastel`, pastel `dry` 50 vs 80, final id after the size/lift sequence, graphite agreement, and the audit's missing seam caller). `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`), JUnit format, target `a cross-group pick ... applies the pastel record once and still commits one selection patch`, exit 1, 13 tests / 7 pass / 6 fail, no load or fixture fault.
- **GREEN** — the four Task 1 verify suites: 56/56 passed; the five Task 2 verify files: 80/80 passed (including `BrushesDocker.test.tsx` through its import launcher); `tsc --noEmit` clean.
- **Final combined verification** — 8 files, 123/123 tests passed; `tsc --noEmit` exit 0.

## Files Created/Modified

- `app/src/components/physic-paint/view/aquarellePaintControls.ts` — `groupOfPreset` helper, the outgoing/incoming group resolution around `selectAquarelleTip`, the guarded `applyAquarelleMedium` call, and the contract comments
- `app/src/components/physic-paint/view/brushGroupMedium.test.ts` — 13 tests: 7 behavior, 3 agreement/taxonomy, 3 seam-audit pins

## Decisions Made

- Outgoing group read before the live pick (peek), no-preset fallback to `DEFAULT_MEDIUM_ID` — a fresh session or an untagged preset reads neutral.
- The group value is the medium id; no second mapping table and no group on catalog/unknown tips.
- The medium write sits between the live pick and the selection commit so the forwarded bag is still the post-pick bag.
- The audit pins exact file inventories plus per-file occurrence counts, so a second pathway fails loudly.

## Deviations from Plan

### Task sequencing (no behavioral scope change)

**1. Task 2's agreement/audit contract was framed in Task 1's RED file**
- **Found during:** Task 1 RED authoring
- **Issue:** Both tasks own `brushGroupMedium.test.ts`, and the RED gate validates a run as a unit; the file was written once with the full failing surface (13 tests, 6 failures), including the agreement and audit contract.
- **Fix:** Task 2's commit carries the plan's exact agreement form (ten-key deep-equal to the record, twelve-key bag, prior `size`/`lift` values) and the per-file occurrence counts for the two handlers, rather than introducing the whole block.
- **Files modified:** `app/src/components/physic-paint/view/brushGroupMedium.test.ts`
- **Verification:** 80/80 across the five Task 2 verify files; `tsc --noEmit` clean
- **Committed in:** `05e05ba73`

---

**Total deviations:** 1 sequencing note, no auto-fix rules triggered.
**Impact on plan:** None behavioral. Every Task 1 and Task 2 acceptance criterion is pinned and passing.

## Issues Encountered

None. No authentication gates, no checkpoints, no package installs, no typecheck or lint failures.

## User Setup Required

None - no external service configuration required.

## Threat Surface

No new security-relevant surface: the change is one pure resolver over the shipped preset table and one call to the existing live-bag handler. T-64-30 is mitigated by the one-write/zero-write counts and the `size`/`lift` pins; T-64-31 by the exact patch-shape assertion and the byte-identical recorded stroke; T-64-32 stays accepted because a non-preset id has no group by construction. T-64-SC is not applicable (no dependency added).

## Next Phase Readiness

- This is the last plan of the phase (12 of 12). The UAT rows it makes runnable: five brush-library sections with the existing responses in their groups; an acrylic pick giving a thick waterless stroke and a watercolor pick a wash; two picks inside one group preserving a manual tweak; a graphite pick tooth-gated; a texture surviving a group switch; and a multi-group project replaying each stroke with its own look.
- Row ledger coverage: MED-28.adjacency and MED-28.ordering (outgoing group read before the pick), MED-28.empty (non-preset id has no group), MED-28.idempotency (same-group pick writes nothing), MED-28.concurrency (the patch carries no params).
- No blockers.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `brushGroupMedium.test.ts`, `64-12-SUMMARY.md`
- Implementation file present: `aquarellePaintControls.ts` (group-aware pick)
- Commits present on HEAD: `da0d7c971`, `9e94742ea`, `05e05ba73`
- Measured ledger: 3 commits between `38b938c29` and `05e05ba73`
