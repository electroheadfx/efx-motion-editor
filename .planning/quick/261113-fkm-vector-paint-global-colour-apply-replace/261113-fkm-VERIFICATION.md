---
phase: 261113-fkm-vector-paint-global-colour-apply-replace
verified: 2026-11-13T10:28:59Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - ".planning/quick/261113-fkm-vector-paint-global-colour-apply-replace/261113-fkm-PLAN.md"
  - ".planning/quick/261113-fkm-vector-paint-global-colour-apply-replace/261113-fkm-SUMMARY.md"
  - "app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts"
  - "app/src/components/physic-paint/view/aquarelleRecordState.ts"
  - "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts"
covered_digest: "v4:sha256:a8dca6aa4d034b07613274db3dfd4157a8a5fb460768656d2a48577688ff33b9"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "A vector stroke carrying per-vertex colours: re-enter path edit, select NO vertex, open the Color tab and pick a new colour."
    expected: "The whole stroke takes that colour and the old per-vertex variation is gone."
    why_human: "Live picker-to-canvas visual result; the store write is test-pinned, the rendered wash is not exercised by vitest."
  - test: "Leave the path edit and re-enter it (or force a replay): the stroke keeps the new global colour. Save, close the project and reopen."
    expected: "No per-vertex colour comes back after the re-bake; the global colour still holds after the project round trip."
    why_human: "Engine replay/persistence behaviour on the native build; only the data composition (uniform profile → resolveStrokeColors null) is unit-pinned."
  - test: "In the same path edit, select one or two vertices and pick a different colour."
    expected: "Those vertices take a per-vertex colour again through the anchor-selection commit."
    why_human: "Live anchor-selection routing and rendered result; the branch is unchanged and source-inspected, not CI-observable."
  - test: "Undo ONCE right after the global colour apply; then redo."
    expected: "The previous per-vertex colours are back in one step; redo re-applies the global colour."
    why_human: "Native undo/redo ledger observation; the one-edit snapshot pair is wrapper-test-pinned, the ledger entry is not."
  - test: "A whole-stroke Size apply on a stroke that carries per-vertex size factors AND per-vertex colours."
    expected: "Both stay untouched — only the base size changes, scaling proportionally."
    why_human: "Visual width/colour result; the params-only no-clear law is test-pinned, the rendered taper is not."
  - test: "Apply a colour to a mixed selection (a coloured vector stroke plus a hand-painted stroke)."
    expected: "Both take the colour; the hand-painted stroke is otherwise unchanged."
    why_human: "Live mixed-selection gesture; the batch behaviour is test-pinned, the user flow is not."
---

# Quick 261113-fkm: Global colour replaces per-vertex colours — Verification Report

**Task Goal:** A global (whole-stroke) colour apply on a vector stroke replaces explicit per-vertex colours in the same edit/undo step, so the global colour sticks when the user re-enters path edit. Size behaviour is locked to scale proportionally (anchor width factors untouched — no code change). The anchor-selection per-vertex colour path must be unchanged.
**Verified:** 2026-11-13T10:28:59Z
**Status:** human_needed — all six code-level must-haves verified against the committed diff and green tests; the six native UAT rows are handed to the user and are NOT claimed here.
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | D-01: a whole-stroke colour apply on a vector stroke with explicit anchor `color` keys clears every one of them in the SAME edit; geometry, anchor order, `kind`, handles and `width` factors survive; the stroke, its timeline entry and the entry's `engine` take the new colour; `engine.anchors` carries no `color`. | ✓ VERIFIED | `withoutAnchorColor` destructures `color` away and returns the rest object (`aquarelleRecordState.ts:766-769`); the clear block maps the stored list, rebuilding only coloured anchors (`:890-904`); the rebuilt list reaches `nextStroke` through the one conditional spread (`:973`) and the ONE projection `toStudioStroke(nextStroke)` (`:978`), whose `engine.anchors` is `projectVectorPath` (`toStudioStroke.ts:187`). Test "a global colour clears every explicit anchor colour and re-projects the engine entry" (`aquarelleRecordState.appearanceColor.test.ts:132-167`) asserts every anchor has no own `color`, the bezier handles/`width: 1.8` survive, `entry.engine.anchors` deep-equals the colourless projection, and `entry.pts`/`cuisson`/`recordedOrder` are the pre-edit values. 6/6 green. |
| 2 | Anchors that carried no colour are untouched — objects (and, when nothing was cleared, the whole array) stay reference-identical, so the sparse profile stays byte-identical. A stroke with no anchors gains no `anchors` key and behaves exactly as before. | ✓ VERIFIED | `if (anchor.color === undefined) return anchor` keeps identity; the mapped array is assigned only `if (cleared)` (`aquarelleRecordState.ts:891-903`); the spread is keyed on array identity (`:973`), so `nextAnchors === stroke.anchors` writes nothing. Tests "keeps colourless anchors reference-identical" (`appearanceColor.test.ts:169-192`, `toBe` for anchors 1 and 2 and for the whole colourless array) and "a hand-painted stroke gains no anchors key" (`:194-209`, `hasOwnProperty('anchors')` false before and after). |
| 3 | A same-colour apply on a coloured-anchor stroke still counts as an edit: the batch returns 1, the target is replaced and the revision bumps once; previously it was silently dropped. | ✓ VERIFIED | The colour term alone leaves `changed` false on an equal colour (`aquarelleRecordState.ts:882-883`); the clear sets `changed = true` (`:898-903`). Test "a same-colour apply still stores the edit" (`appearanceColor.test.ts:211-227`) asserts return 1, revision + 1 and colours cleared. |
| 4 | D-02: a patch that carries no colour (Size/params, brush id, paint-seed flag, tool multipliers) never clears an anchor colour and never rebuilds the anchor list; anchor width factors and explicit colours survive a Size apply. | ✓ VERIFIED | The clear block is gated on `hasColor && nextAnchors !== undefined` (`aquarelleRecordState.ts:890-891`), so every non-colour patch keeps the array reference. Test "a params-only Size patch never clears anchor colours" (`appearanceColor.test.ts:229-249`) asserts `params.size` written, colour unchanged, `anchors` `toBe` the pre-edit array, both explicit colours present, and an identical params patch returns 0 with no second bump. No Size code path appears in the diff (exactly the helper, doc comment, clear block, target field and one spread). |
| 5 | The clear and the colour write are one undoable edit: `beginAquarelleAppearanceEdit`'s before/after snapshot pair restores the exact pre-edit stroke object (explicit anchor colours included) and the exact pre-edit timeline entry by reference. | ✓ VERIFIED | `beginAquarelleAppearanceEdit` captures `before`, calls the ONE batch, captures `after` and stores one edit (`aquarelleStrokeSelection.ts:1016-1024`, unchanged); `captureAquarelleStrokeRegistry` keeps stroke/entry objects by reference and `restoreAquarelleStrokeRegistry` re-sets them (`aquarelleRecordState.ts:591-615`). The wrapper test added in `8adfa44ce` (`aquarelleStrokeSelection.test.ts:721-758`) records a same-colour coloured-anchor stroke, gets a non-null edit id, asserts revision + 1 and a NEW stroke object with no anchor colours, then undo restores `toBe(beforeStroke)` (still carrying `#ff0000`) and `toBe(beforeEntry)`. Suite 101/101 green. |
| 6 | After a global colour apply the path-edit re-bake can no longer project per-vertex colours back over the global colour: the rebuilt path is a uniform colour profile, `resolveStrokeColors` returns null, and the engine replays the stroke in the one global colour. Re-adding per-vertex colours stays available only through the anchor-selection colour commit, whose routing is unchanged. | ✓ VERIFIED | The stored anchors carry no `color` after the apply (truth 1), and `updateAquarellePathInScript` re-derives only from the anchors it is handed and the stored stroke (`aquarelleRecordState.ts:1096-1138`, untouched — not in the diff). A uniform profile resolves to null pigment: `isUniformColorProfile` (`spine.ts:316-318`) and `resolveStrokeColors` (`engineAdapter.ts:169-179`) are untouched, with pre-existing tests pinning the null (`engineAdapter.test.ts:688-707`; spine suite 43 pass, adapter suite 33 pass/8 pre-existing GPU skips). The anchor-selection route `buildAnchorColorCommit` (`vectorPathHandles.ts:652-672`) and the Studio branch order (anchor selection → per-vertex commit → early return) are unchanged: `PhysicsPaintStudio.tsx` and `vectorPathHandles.ts` have no commit in `2bcec0649..8adfa44ce`. |

**Score:** 6/6 truths verified (0 present-but-behavior-unverified)

### Deferred Items

None. The whole D-01/D-02 write policy is scoped to this quick and complete at the data layer; no later milestone phase is claimed for any part of it.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` | Module-local `withoutAnchorColor` OUTSIDE the 261111-t74 source-pin region; extended batch doc comment; the anchor-clear block; `nextAnchors` target field/push/destructure; one conditional spread | ✓ VERIFIED | Helper at `:766-769` (above the doc comment at `:771-803`, i.e. outside the pin that slices from `export function updateAquarelleStrokesInScript(` at `:804` to `export function updateAquarelleCurveModeInScript(` at `:1004`); clear block `:884-904`; target type `:864`, push `:944`, destructure `:957`; spread `:970-973`. Region still has exactly one `bumpAquarelleStrokesRevision()` (`:984`), one `payloadTimeline[index] =` (`:982`), one `NEUTRAL_TOOL_OVERRIDES`, one `toolOverrides: nextOverrides`; Studio pin green. Diff is +53 lines, zero deletions, no other statement moved. |
| `app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts` | Batch-level pins: clears + engine re-projection; colourless anchors reference-identical; hand-painted no key; same-colour returns 1; params-only never clears; mixed batch one bump | ✓ VERIFIED | New 278-line file; all six concepts present (`:132-277`), 6/6 pass; fixtures carry no `paintSeedSalt` so revision counts are exact; assertions are value-level (`hasOwnProperty`, `toBe` identity, deep-equal projection). |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | `stroke()` helper gains optional `anchors`; one wrapper-level one-edit/undo pin | ✓ VERIFIED | Helper field `:155-156` and conditional spread `:171`; test `:721-758` inside the shipped `261024-p5q watercolor appearance edits` describe; whole file 101/101 pass. Production wrapper unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `aquarelleRecordState.ts` | `packages/efx-watercolor/src/payload/toStudioStroke.ts` | `toStudioStroke(nextStroke)` is the ONE projection; the rebuilt anchor list lands in `entry.engine.anchors` | ✓ WIRED | Call at `aquarelleRecordState.ts:978`; `engine.anchors` written only when `s.anchors !== undefined`, through `projectVectorPath` (`toStudioStroke.ts:187`); `projectVectorPath` writes `color` only when present (`vectorPath.ts:334`). Test asserts the entry carries the colourless projection, never a stale colour. |
| `aquarelleStrokeSelection.ts` | `aquarelleRecordState.ts` | `beginAquarelleAppearanceEdit` snapshots BEFORE the batch mutates and AFTER, one `storeAquarelleEdit` | ✓ WIRED | `aquarelleStrokeSelection.ts:1016-1024`; registry capture/restore keep objects by reference (`aquarelleRecordState.ts:591-615`); wrapper test proves one undo restores the pre-edit stroke (coloured anchors) and entry by reference. |
| `PhysicsPaintStudio.tsx` | `aquarelleStrokeSelection.ts` | `handleRightPanelColorCommit`: anchor-selection branch commits per-vertex and returns; no-selection fall-through calls `aquarelleAppearanceCommitRef.current?.(ids, { color })` → `handleAquarelleAppearanceStrokes` → `beginAquarelleAppearanceEdit` | ✓ WIRED | Branch `PhysicsPaintStudio.tsx:7477-7508` (anchor branch returns at `:7508`); fall-through at `:7510`; handler `:9196-9252` calls `beginAquarelleAppearanceEdit` at `:9217`; ref written at `:9267`. The file is NOT in the quick's diff, so the routing is provably unchanged. All other `applyAppearance` call sites send params/seed/brush/multipliers only (`PhysicsPaintStrokeSettingsDialog.tsx:1274,1300`; `aquarellePaintControls.ts:44-84`). |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts` | `packages/efx-watercolor/src/vector/spine.ts` | `resolveStrokeColors` returns null when `isUniformColorProfile(engine.anchors)` | ✓ WIRED | `engineAdapter.ts:173-175`; `isUniformColorProfile` true when every anchor has no colour (`spine.ts:316-318`); both untouched by the diff; pre-existing tests pin the null (`engineAdapter.test.ts:688-707`). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `updateAquarelleStrokesInScript` | `nextColor` | `patch.color` from the live Color tab (`handleRightPanelColorCommit`) | Yes — user gesture, no literal | ✓ FLOWING |
| `updateAquarelleStrokesInScript` | `nextAnchors` | The stroke's stored anchor list (`recordedStrokes`), rebuilt by removing only `color` | Yes — real stored geometry; identity preserved when nothing cleared | ✓ FLOWING |
| `toStudioStroke` → timeline entry | `entry.color`, `entry.engine.color`, `entry.engine.anchors` | The replacement stroke record | Yes — same store objects the tests read back | ✓ FLOWING |
| Engine replay | `resolveStrokeColors` | `entry.engine.anchors` (indexal) → `isUniformColorProfile` → null | Yes — null feeds the engine's configured base colour; no static fallback | ✓ FLOWING (pixel result is a human row) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| New batch pins (all six D-01/D-02 concepts) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts` | 1 file, 6 passed | ✓ PASS |
| Wrapper one-edit/undo pin + all shipped appearance/undo/filter/band tests | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | 1 file, 101 passed | ✓ PASS |
| 261111-t74 source pin (one bump, one replacement, one neutral constant, one overrides spread) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | 1 file, 413 passed | ✓ PASS |
| Path-write and AQTL colour-reopen regressions | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.path.test.ts src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts` | 2 files, 20 passed | ✓ PASS |
| Uniform-profile → null engine path (untouched link) | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/adapter/engineAdapter.test.ts src/vector/spine.test.ts` | 2 files, 68 passed, 8 pre-existing GPU skips | ✓ PASS |
| Typecheck | `pnpm --prefix app run typecheck` | `tsc --noEmit` clean, exit 0 | ✓ PASS |

### Probe Execution

N/A — the quick declares no probe, is not a migration/CLI/tooling task, and no `scripts/**/tests/probe-*.sh` exists in the repository.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| QUICK-261113-FKM | `261113-fkm-PLAN.md` | Global colour apply replaces per-vertex colours in the same edit (D-01); Size never clears anchors (D-02) | ✓ SATISFIED | All six truths verified against the committed diff; 540 targeted tests plus typecheck green; six native UAT rows handed to the user. |

`.planning/REQUIREMENTS.md` carries no `261113` row (quick-task ids live in the plan frontmatter), so no orphaned requirements apply.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers, no `TODO`/`HACK`/`PLACEHOLDER`, no `.skip`/`.only`, no stub returns or hardcoded empty data in the three changed files | — | None |

**Scope check:** `git diff --name-only 2bcec0649..8adfa44ce` lists exactly the three plan `files_modified` paths; `PhysicsPaintStudio.tsx`, `aquarelleStrokeSelection.ts`, `vectorPathHandles.ts`, `packages/efx-watercolor/**`, `app/package.json` and `pnpm-lock.yaml` have no commit in the range. No new stored field, no `AQUARELLE_SCHEMA_VERSION` / codec change, no new signal, effect, DOM or dependency.

### Human Verification Required

The six native rows below are handed to the user (SUMMARY UAT handoff). They are **not** claimed as verified by this report.

#### 1. Global colour clears the per-vertex variation

**Test:** A vector stroke carrying per-vertex colours: re-enter path edit, select NO vertex, open the Color tab and pick a new colour.
**Expected:** The whole stroke takes that colour and the old per-vertex variation is gone.
**Why human:** Live picker-to-canvas visual result.

#### 2. Re-entry / replay / reopen keeps the global colour

**Test:** Leave the path edit and re-enter it (or force a replay). Then save, close the project and reopen.
**Expected:** No per-vertex colour comes back after the re-bake; the global colour still holds after reopen.
**Why human:** Engine replay and persistence behaviour on the native build.

#### 3. Anchor-selection per-vertex colour still works

**Test:** In the same path edit, select one or two vertices and pick a different colour.
**Expected:** Those vertices take a per-vertex colour again through the anchor-selection commit.
**Why human:** Live anchor-selection routing and rendered result.

#### 4. One undo / redo

**Test:** Undo ONCE right after the global colour apply; then redo.
**Expected:** The previous per-vertex colours are back in one step; redo re-applies the global colour.
**Why human:** Native undo/redo ledger observation.

#### 5. Size leaves factors and colours untouched

**Test:** A whole-stroke Size apply on a stroke carrying per-vertex size factors AND per-vertex colours.
**Expected:** Both stay untouched — only the base size changes, scaling proportionally.
**Why human:** Visual width/colour result.

#### 6. Mixed selection

**Test:** Apply a colour to a mixed selection (a coloured vector stroke plus a hand-painted stroke).
**Expected:** Both take the colour; the hand-painted stroke is otherwise unchanged.
**Why human:** Live mixed-selection gesture.

### Gaps Summary

No gaps. The committed diff (`3fa8e0dda` RED test, `e7016945c` production write policy, `8adfa44ce` wrapper undo pin) is exactly the scoped change: `withoutAnchorColor` sits outside the 261111-t74 source-pin region, the clear is gated on a colour-carrying patch, identity is the write signal, and the rebuilt list reaches `engine.anchors` through the existing single projection. All six must-have truths are verified against the code and by executing the tests; all three artifacts exist, are substantive and wired; all four key links are connected; the out-of-scope production files (Studio routing, wrapper, handles, codec, package) have no commit in the range; typecheck and 540 targeted tests are green. The six native UAT rows are the only remaining evidence and are handed to the user rather than claimed.

---

_Verified: 2026-11-13T10:28:59Z_
_Verifier: Claude (gsd-verifier)_
