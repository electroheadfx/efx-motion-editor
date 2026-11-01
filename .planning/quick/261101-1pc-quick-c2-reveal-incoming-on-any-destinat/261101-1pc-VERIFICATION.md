---
phase: 261101-1pc-quick-c2-reveal-incoming-on-any-destinat
verified: 2026-11-01T01:21:33Z
uat_approved: 2026-11-01
status: passed
score: 7/7 must-haves verified
covered_files:
  [
    ".planning/quick/261101-1pc-quick-c2-reveal-incoming-on-any-destinat/261101-1pc-PLAN.md",
    ".planning/quick/261101-1pc-quick-c2-reveal-incoming-on-any-destinat/261101-1pc-SUMMARY.md",
    "app/src/components/physic-paint/PhysicsPaintStudio.test.ts",
    "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
    "app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts",
    "app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts",
    "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts",
    "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts",
    "app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts",
    "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx",
  ]
covered_digest: "v3:sha256:0d79b1ce02c0327f9b7f7210a8f3dd74abf038afce48bf87203fbbfa45fdbc78"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Motion rail + Reveal Motion run"
    expected: "One gray Standard Rail whose wash shows the placed photo, with the rail's animation surviving where the wash is transparent."
    why_human: "Live visual output of the reveal render over the destination picture — no automated test renders the new port against a real document reference."
  - test: "Static rail + Reveal Static run"
    expected: "Same Standard result, held frames."
    why_human: "Live visual output and held-frame behavior in the app."
  - test: "Standard rail + Reveal run"
    expected: "Stays Standard, keeps its cycle and repeat options."
    why_human: "Live rail presentation and cycle/repeat UI after the merge."
  - test: "No document reference"
    expected: "The dialog shows the reason and a Place a reference… action; confirming refuses and nothing changes; after placing the reference the same dialog runs."
    why_human: "End-to-end dialog + modal + refusal flow across the Studio and Photo Reference surfaces."
  - test: "Place a reference, then clear it while the dialog is open, then Run Script"
    expected: "The run refuses with the same reason and nothing changes."
    why_human: "Live mutation of the document reference while the dialog is open."
  - test: "Keep ON / Keep OFF"
    expected: "Keep ON: the reveal run's per-key slices are recorded and a per-key edit still works; Keep OFF: nothing is recorded and the destination picture and scripts survive."
    why_human: "Per-key edit and persistence behavior across a real document."
  - test: "One Undo"
    expected: "Restores the typed destination rail exactly (type, colour, source script and any reveal knobs)."
    why_human: "Undo history behavior in the running app."
  - test: "Save then reopen"
    expected: "The rail is still a gray Standard Rail with the same picture and blend."
    why_human: "Durable round-trip through the real project save/reopen path."
  - test: "Reveal destination (Quick B) unchanged"
    expected: "No Rail Type card, its own knobs seed, its own reference notice copy, blue until the merge commits."
    why_human: "Live dialogs and rail colour before/after commit."
  - test: "Regenerate and Replay on a merged rail"
    expected: "Both stay unavailable with the merged-rail reason; typed rails keep their own behaviour."
    why_human: "Live control availability and reason copy."
---

# Quick Task 261101-1pc: Quick C2 — Reveal incoming on any destination — Verification Report

**Phase Goal:** A Reveal run stacked onto a Motion, Static or Standard rail becomes one Standard Rail using the document's placed photo reference; refuse with a clear reason and offer Place a reference when none is placed; show the Reveal cards in the stack dialog.
**Verified:** 2026-11-01T01:21:33Z (HEAD `3052519a6`, base `7c36385b2`, 12 commits)
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A Reveal Motion/Static run on a Motion, Static or Standard rail renders through the DOCUMENT's placed photo reference and commits ONE Standard Rail atomically, with the destination's picture/animation/cycle/repeat surviving and each touched key = destination cached picture + run reveal sheet. | ✓ VERIFIED | `isRevealRun = !isRevealTarget && isRevealRunKind(...)` at `physicsPaintRotoPlayScriptController.ts:2562`; run lane 2788-2827 calls `bakeRevealStackRun` once for the whole span then reassigns `sheets`; merge goes through the unchanged C1 union (2829-2840) / composite (2841-2859) ports; one `ports.commit` (2869); `buildStandardStackedLoopClip` stores `target.mode` and keeps repeat/lifecycle (`physicsPaintRotoRunScriptStacking.ts:560-582`). Studio port 4250-4277 → `renderRevealTail` (3964-4014) → `renderRevealTailFrames`, which resolves `document.photoReference` per frame and fails closed (`physicPaintStore.ts:2187-2232`). Composite law behaviorally covered by `physicsPaintRotoScriptRebake.test.ts` (pigment-alpha over durable base). Tests: controller 6116-6219, 6221-6249; Studio 5219-5258. |
| 2 | With no document photo reference, the stack refuses with a clear reason naming the missing reference and pointing at Place a reference…, performs zero writes (no generation bump, authority, bake, commit), and re-validates at confirm time when the reference disappeared while open. | ✓ VERIFIED | Gate at controller 2557-2575 sits after the Quick B reveal-target block and BEFORE `const acceptedGeneration = ++generation` at 2595. Copy: `REVEAL_RUN_REFERENCE_MISSING_COPY` (92) and build-refusal copy (2565). `hasPhotoReference` is re-read at confirm, so removal while open refuses. Tests: 6287-6309 (port absent), 6311-6329 (no reference), 6407-6435 (removed before confirm) — each asserts phase `idle`, unchanged confirm-time `requestAuthority` count, zero bakeOptions, zero bake/tail/union/compose/commit/record. |
| 3 | The stack dialog's Rail Type card offers the 2×2 Motion/Static/Reveal Motion/Reveal Static grid; a Reveal type hides Color, keeps Motion wiggle, shows Colorize, Photo wiggle and Paint seed, hides the source-cycle card, and shows a read-only reference notice with a Place-a-reference action when none is placed. | ✓ VERIFIED | `STACK_RUN_KINDS` + stacking radio group in `PhysicsPaintPlayScriptCards.tsx:33-38, 162-173`; `stackRevealRun` in `PhysicsPaintPlayScriptDialog.tsx:83`; Color hidden (398), Colorize (407-408), Motion wiggle (412-414), Photo wiggle/Paint seed (352-353), source-cycle replaced by the notice branch (416-445). Plugin tests 2035-2170 pin the 4-radio matrix, card counts, both notice states, the single `requestPhotoReference` call, disabled-while-busy, and switch-back. |
| 4 | The run kind is a non-persisted dialog axis: the committed record's stored mode still comes from the destination, and the run's mode/motion/colorize pair/photo wiggle/paint seed shape only that run's bake. | ✓ VERIFIED | `setStackRunKind` derives `mode` compare-then-write (1269-1273); `renderMode = mode.peek()` for a reveal run (2617); `buildStandardStackedLoopClip` stores `target.mode`. Repo-wide grep: `stackRunKind` appears only in the controller/cards/dialog (+ tests) — never in a publication, model, serializer or parser. Test 6221-6249 runs `reveal-static` (bake mode `static`) on a progressive destination and asserts the committed rail keeps `progressive`. |
| 5 | Keep ON appends the run's slices and stages pre-run base pins; Keep OFF records nothing and never purges; one undo restores the typed rail; save/reopen keeps the Standard Rail with the same picture. | ✓ VERIFIED | Keep ON uses the unchanged `bakeStackedRailKey` (stages pins, `PhysicsPaintStudio.tsx:4071-4083`) with the reveal sheets; record port gets `recordMode: 'append'` and the run slices (2877-2889). Keep OFF uses `composeStackedRailKey` (4123-4147, read + composite only) and `recordMode 'none'` skips the record port. Tests: 6530-6622 (Keep ON: one commit, new record, pre-run clip unchanged, parser round-trip, Standard projection), 6485-6528 (Keep OFF: two compose calls with the reveal bytes, no union, no record). |
| 6 | A Reveal DESTINATION keeps Quick B byte-identically: its own render-only tail port, its rail-knob seeding and its copy, never the Rail Type grid or the new run-only port. | ✓ VERIFIED | `isRevealTarget` branch untouched at 2542-2555; `isRevealRun` is gated by `!isRevealTarget` (2562); reveal-target render branch 2753-2782 still calls `bakeRevealStackTail`; dialog hides RailTypeCard when `stackReveal` (319) and keeps Quick B's read-only notice (435-442). Test 6624-6658 supplies BOTH ports, asserts the tail runs once with the rail's own stored `static` mode even after a defensive `setStackRunKind('reveal-motion')`, the run port never, Keep ON still records, Standard commit, pre-run clip untouched. Dialog test 2151-2169 pins the Quick B composition. |
| 7 | No persisted schema or format change: the committed record round-trips through the existing parser and still presents as a gray Standard Rail. | ✓ VERIFIED | `git diff --name-only 7c36385b2..HEAD` lists only the 9 planned controller/Studio/hook/cards/dialog (+ tests) files — no model/serializer/parser/persisted-field file. Commit records stay provenance-absent (`buildStandardStackedLoopClip`). Test 6571-6621 rebuilds the revision, JSON round-trips the publication through `parsePhysicPaintRotoPhysicalDocument`, asserts `isPhysicPaintRotoLoopClip`, `parsePhysicPaintRotoLoopClips([committed])` deep-equal, projection `Standard Rail` / lifecycle `standard` / null dot / merged Regenerate reason. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | Run-kind axis + setter, run port + interface field, refusal before `acceptedGeneration`, reveal-run lane, render-mode/color/seed routing | ✓ VERIFIED | Type 79, helpers 82-89, port input 330-341, port field 482-485, interface 652-654, signal 693, `revealRunPortPresent` 1214, setter 1269-1273, reset 1532, seed 1552-1553, gate 2562-2575, lane 2788-2827, coverage helper 2735-2752, CR-01 2729, export 3400. Wired by hook + Studio. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `bakeRevealStackRun` implementation (document reference, run-only) + ports wiring | ✓ VERIFIED | 4250-4277: clears staged pins, refuses `empty-span`, one whole-span `renderRevealTail` render (`events: input.scriptEvents`, `canonicalStart: start`, `frameCount: input.frames.length`), maps to `{appFrame, bytes}`. Ports object 4425. No union helper, per-slice loop, purge, pin or durable-base write (pinned 5219-5258). |
| `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` | Conditional forwarding (absent port fails closed) | ✓ VERIFIED | 101-106 spreads the key only when `ports.bakeRevealStackRun` is supplied. Tests 350-371 forward verbatim + omit when absent. |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` | Four-option Rail Type grid bound to `stackRunKind` for a stack | ✓ VERIFIED | `STACK_RUN_KINDS` 33-38; `props.stacking` branch 162-173 binds value/getValue/onSelect to `stackRunKind`/`setStackRunKind`; creation and Reveal tab keep the two-option groups bound to `mode` (174-182, 156). |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | Reveal-run card composition + document-reference notice with Place a reference… | ✓ VERIFIED | `stackRevealRun` 83; notice 416-434 (placed copy / unplaced copy + one `physics-paint-play-script-heading-link` button, `disabled={busy}`, `requestPhotoReference`). No Color/Key Script/SourceCycle for a reveal run; reveal destination branch unchanged. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `setStackRunKind` | `mode` | Setter derives the single bake mode | ✓ WIRED | 1269-1273 compare-then-write both signals; bake uses `mode: renderMode` (2632), slices use `renderMode` (2710), `buildStandardStackedLoopClip` stores `target.mode`. Test 6066-6092 asserts the exact write sequence and the no-op on same kind. |
| `confirmStack` refusal | `hasPhotoReference` + `bakeRevealStackRun` presence | Both checks before `acceptedGeneration` | ✓ WIRED | Gate 2562-2575 precedes `++generation` 2595. Tests 6287-6435. |
| Reveal-run sheets | `bakeStackedRailKey` / `composeStackedRailKey` | `sheets` reassigned to the reveal bytes in destination slot order, then the existing C1 paths | ✓ WIRED | 2826-2827 then 2829-2859. Tests 6171-6183 (union slot-aligned reveal payloads), 6502-6514 (compose per reveal sheet). |
| `bakeRevealStackRun` | `renderRevealTail` → `renderRevealTailFrames` | ONE reveal seam shared with the Reveal tab and the Quick B tail; never the destination-event union | ✓ WIRED | Studio 4259-4271; `renderRevealTail` 3991-4013; store 2187-2232 resolves the document reference and fails closed. Source pin 5227-5233 asserts no `getAquarelleEventsForFrame(` / `hasAquarelleScriptForFrame(` / purge / pin / durable-base / direct commit. |
| Dialog `stackRevealRun` | `requestPhotoReference` | The same document-reference guard the Reveal tab uses | ✓ WIRED | Dialog 429 calls `playScript.requestPhotoReference()`; controller 1438-1440 → `ports.openPhotoReference?.()`; guard `revealReferencePlaced` 788-791 reads `hasPhotoReference` (document `photoReference` with non-empty `sourceFrameRefs`, Studio 4378-4382). Test 2117-2127 asserts exactly one call. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| Reveal-run reference notice (`PhysicsPaintPlayScriptDialog.tsx:416-434`) | `playScript.revealReferencePlaced` | `ports.hasPhotoReference()` → `getEfxPaintDocument(layerId).photoReference.sourceFrameRefs.length > 0`, re-derived on `photoReferenceRevision` | Yes | ✓ FLOWING |
| Rail Type grid (`PhysicsPaintPlayScriptCards.tsx:166-173`) | `playScript.stackRunKind` | User-controlled dialog signal seeded from the pinned destination's stored mode | Yes (state → render) | ✓ FLOWING |
| Stack composition gate (`PhysicsPaintPlayScriptDialog.tsx:79-83`) | `stackRailKind` | `runDestination.rail.railKind` of the pinned destination | Yes | ✓ FLOWING |
| Run render (`PhysicsPaintStudio.tsx:4250-4277`) | `input.scriptEvents` / `input.frames` | Controller's loaded script snapshot (`aquarelleEventsFromScript(snapshot)`) + `destinationAppFrames` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Controller + Studio + hook + dialog suites | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | 4 files passed; 664 tests passed (controller 259, Studio 303, hook 13, dialog 89); 0 failed | ✓ PASS |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 363 files (361 passed, 2 skipped); 6,844 passed; 1 skipped; 96 todo; 0 failed (exit 0). Baseline floor 6,818 passed → +26 pins | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` clean (no output) | ✓ PASS |
| Reveal-run end-to-end commit | named tests in controller suite (`commits ONE Standard Rail for a Reveal Motion run…`, `runs a Reveal Static run in static mode…`) | both pass: one commit, one run-port call, union slot-aligned, destination mode stored | ✓ PASS |
| Refusal zero-write ordering | named tests (`refuses a Reveal run when this build has no run-only port…`, `…with no document photo reference…`, `re-validates the document reference at confirm…`) | all pass: exact copy, phase `idle`, no confirm-time authority/bake/commit/record | ✓ PASS |
| Exact coverage abort | named tests (`…does not cover the span exactly`, `…duplicate and missing run frames`) | all pass: label-specific errors, zero union/compose/record/commit, pre-run clips unchanged | ✓ PASS |

**Refusal-ordering detail (informational):** the two pre-generation gates (port absent / no reference track / reference removed before confirm) bump no generation, request no authority, bake nothing and write nothing — proven. The *placed-but-not-yet-hydrated* reference case (`missing reference source`) can only be discovered by the renderer, so it refuses after the anchor bake and authority requests but still before the union, composite, recording and the single commit (no persisted write). That is the plan's designed placement and the re-review explicitly accepted it; it is counted in the "no commit/record/purge/pin" sense, not the "no authority/bake call" sense.

### Probe Execution

Not applicable — the plan declares no probes and `scripts/**/tests/probe-*.sh` does not exist in this repository; the success criteria do not mention probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| QUICK-261101-1PC | `261101-1pc-PLAN.md` | Quick C2 — Reveal incoming on any destination | ✓ SATISFIED (automated) | All 7 truths, 5 artifacts and 5 key links above. Note: quick-task IDs are not tracked in `.planning/REQUIREMENTS.md` (it maps roadmap phases only), so there are no orphaned roadmap requirements for this task. |

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintRotoPlayScriptController.test.ts` | QUICK-261101-1PC | 259 | 0 | none | Behavioral (multi-step port/commit/undo assertions) | ✓ |
| `PhysicsPaintStudio.test.ts` | QUICK-261101-1PC | 303 | 0 | none | Source-scan (positive + negative halves) | ✓ |
| `useRotoPlayScriptController.test.ts` | QUICK-261101-1PC | 13 | 0 | none | Behavioral (forward verbatim / omit) | ✓ |
| `PhysicsPaintPlayScriptDialog.test.ts` | QUICK-261101-1PC | 89 | 0 | none | Behavioral (rendered node-tree matrix) | ✓ |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0 (no expected-value generation from the system under test). **Insufficient assertions:** 0.

### Decision Coverage

No trackable decisions in CONTEXT.md (`check.decision-coverage-verify` → `skipped: true, reason: "no trackable decisions", total: 0`). No status impact.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX` markers in any of the 9 changed files | — | Clean |
| — | — | No `TODO`/`HACK`/`not yet implemented`/placeholder returns in the 5 production files | — | Clean (`AQUARELLE_PLACEHOLDER_MAX_BYTES` is a pre-existing, unrelated constant) |

### Residual Review Findings (informational, non-blocking)

These come from `261101-1pc-REVIEW.md`; none is a must-have failure and none affects the status:

1. **IN-R1** — the "build cannot render a Reveal run" copy and the two reference-gate predicates/notices are duplicated rather than shared (controller 2565 vs 2792; two notice blocks in the dialog). Maintenance risk only.
2. **IN-R2** — the Quick B reveal-destination tail still surfaces the seam wording (`Reveal tail render refused: missing reference source`) while the new run lane maps it to user copy. The divergence is deliberate (the tail path is plan-locked byte-identical).
3. **IN-R4** — "The photo reference is still loading. Wait a moment…" also covers a permanently failed hydration; wording could be broadened.

Resolved by HEAD `3052519a6`: IN-R5 (idle `status`/`progress` reset now asserted) and IN-R6 (the `stackRunKind` comment no longer overstates the "sole writer" invariant).

### Human Verification Required

Live visible UAT (the user's step — automated green is not UAT-complete):

#### 1. Motion rail + Reveal Motion run

**Test:** Put the playhead on a Motion rail, open Run Script, choose Reveal Motion, run.
**Expected:** One gray Standard Rail whose wash shows the placed photo, with the rail's animation surviving where the wash is transparent.
**Why human:** Visual output of the reveal render over the destination picture.

#### 2. Static rail + Reveal Static run

**Test:** Same flow on a Static rail with Reveal Static.
**Expected:** Same Standard result, held frames.
**Why human:** Live visual output.

#### 3. Standard rail + Reveal run

**Test:** Same flow on an already-Standard rail.
**Expected:** Stays Standard, keeps its cycle and repeat options.
**Why human:** Live rail presentation.

#### 4. No document reference

**Test:** Remove/never place a document photo reference, then choose a Reveal run.
**Expected:** The dialog shows the reason and a "Place a reference…" action; confirming refuses and nothing changes; after placing the reference the same dialog runs.
**Why human:** End-to-end dialog + modal flow.

#### 5. Reference removed while the dialog is open

**Test:** Place a reference, open the dialog, clear the reference, then Run Script.
**Expected:** Refuses with the same reason; nothing changes.
**Why human:** Live mutation of the reference during an open dialog.

#### 6. Keep ON / Keep OFF

**Test:** Run with Keep script ON, then with OFF.
**Expected:** ON records the run's per-key slices and a per-key edit still works; OFF records nothing and the destination picture and scripts survive.
**Why human:** Per-key edit and persistence behavior.

#### 7. One Undo

**Test:** Undo the reveal-run commit.
**Expected:** The typed destination rail returns exactly (type, colour, source script and any reveal knobs).
**Why human:** Undo history behavior.

#### 8. Save then reopen

**Test:** Save the project and reopen it.
**Expected:** The rail is still a gray Standard Rail with the same picture and blend.
**Why human:** Durable round-trip.

#### 9. Reveal destination (Quick B) unchanged

**Test:** Open Run Script on a Reveal rail.
**Expected:** No Rail Type card, its own knobs seed, its own reference notice copy, blue until the merge commits.
**Why human:** Live dialog and rail colour.

#### 10. Regenerate and Replay on a merged rail

**Test:** Try Regenerate/Replay on the merged Standard Rail, then on typed rails.
**Expected:** Unavailable on the merged rail with the merged-rail reason; typed rails keep their own behaviour.
**Why human:** Live control availability and copy.

### Gaps Summary

No gaps. Every must-have truth, artifact and key link is present, substantive, wired and backed by passing targeted and full-suite tests plus a clean typecheck. The schema tripwire is clean (no model/serializer/parser/persisted field in the 12-commit diff), the Quick B reveal-destination path and the C1 Standard projection are pinned unchanged, and no blocker or advisory-grade finding was raised by this pass.

The task remains **human_needed** only because the feature's visible pixel/perceptual outcomes are live-UAT rows: `human_needed` here is the UAT gate, not an uncertainty about the automated evidence.

---

_Verified: 2026-11-01T01:21:33Z_
_Verifier: Claude (gsd-verifier)_

## UAT result

Live UAT approved by the user on 2026-11-01: all 10 rows passed (Reveal Motion/Reveal Static on Motion/Static/Standard destinations, the reference refusal and Place-a-reference flow, Keep ON/OFF, Undo, save/reopen, Quick B reveal destination unchanged, Regenerate/Replay refusal). Quick C2 is CLOSED.
