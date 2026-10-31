---
phase: 261031-i54-run-script-stack-a-script-onto-an-existi
verified: 2026-10-31T16:45:04Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - .planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-PLAN.md
  - .planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-SUMMARY.md
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts
covered_digest: "v3:sha256:17c87c3a91bf342ea0da576c43a7227726f80a094e7036b00e064735e2d04fbb"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/6 must-haves verified
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Keep script ON for flag-off (unscripted) Paint rails, together with the durable-base authority seam"
    addressed_in: "Quick B (user-authorized split; named in 261031-i54-CONTEXT.md and 261031-i54-PLAN.md)"
    evidence: "Quick A law: flag-off stack targets render the switch OFF and disabled with a replace reason; the union path is unreachable without persisted keyScriptEdits (controller test 'keeps the union branch unreachable on a flag-off rail', 4475-4493)"
  - truth: "Reveal rail stacking (extension through the placed photo reference, per-key recording on Reveal rails)"
    addressed_in: "Quick B"
    evidence: "Quick A refuses a Reveal rail target without opening the dialog (controller test 4587-4594; stacking refuse 230-232); no Reveal stacking code exists"
  - truth: "Frame-override bases (stacking over a frame override)"
    addressed_in: "Quick B"
    evidence: "Quick A refuses a frame override inside the written span with zero writes (controller test 4562-4585; stacking test 496-518)"
human_verification:
  - test: "Run Script with the playhead inside an existing Paint rail"
    expected: "Stacks onto that rail: no second Loop Clip appears, the rail's span grows only as far as the run reaches, and frames before the run keep their pixels."
    why_human: "Live Studio bake/repaint behavior across the real renderer cannot be exercised by the DOM/controller unit suites."
  - test: "Run Script with the playhead outside every rail"
    expected: "Bakes a new rail exactly as today, with no stack surface."
    why_human: "The byte-identical create path is pinned in unit tests, but the live visible result must be confirmed in the app."
  - test: "Run Script on a generated/interpolated frame inside a rail, then on one outside every rail"
    expected: "Inside a rail it is allowed and re-anchors to the source-cycle start; outside every rail the existing generated-interpolation refusal still appears."
    why_human: "Selection/interpolation state in the live Studio is broader than the test harness."
  - test: "Extend a repeated rail"
    expected: "The effective span grows by repeat x cycle growth, the repeat count is unchanged, and earlier occurrences still resolve."
    why_human: "Repeated-rail resolution on the live canvas and timeline is a visual/user-flow check."
  - test: "Cross another rail's start and resolve with Cancel / Truncate / Overwrite"
    expected: "Cancel writes nothing; Truncate clips at the boundary and leaves the other rail untouched; Overwrite removes the other rail, its keys stay as ordinary keys, and one undo restores it exactly."
    why_human: "Undo/redo across the real history stack and the visible rail removal must be confirmed live."
  - test: "Repeat overflow at the parent end"
    expected: "Only Truncate / Cancel are offered; the rail is never silently shortened, and the lifecycle-only copy names the parent-range cap."
    why_human: "Message clarity and the visible outcome are human checks."
  - test: "Keep script ON on a flag-on rail: stack a second script, repeat, then save/reopen"
    expected: "The original strokes remain under the new ones with no doubling; stacking is repeatable with no drift."
    why_human: "Save/reopen persistence and the rendered union can only be confirmed in the live app."
  - test: "Keep script OFF on a scripted rail"
    expected: "Replaces the touched span's pixels and records while frames outside keep theirs."
    why_human: "Visible pixel replacement versus preserved surrounding frames is a visual check."
  - test: "Flag-off (unscripted) rail target"
    expected: "Keep script renders OFF and disabled with the reason that this run replaces the touched span; no ON-checked control ever executes replace."
    why_human: "The disabled affordance and its reason are user-facing presentation."
  - test: "Max on a stack destination"
    expected: "Fills the free span before the next boundary, not the physical capacity."
    why_human: "The dialog interaction in the live Studio must confirm the value shown and the resulting span."
  - test: "Source cycle card on a stack destination"
    expected: "The creation-only Source cycle card never appears for a stack destination."
    why_human: "Visual dialog composition is confirmed by the DOM test; final layout/visibility should be seen live."
---

# Quick 261031-i54: Run Script — stack a script onto an existing Paint rail (Quick A) Verification Report

**Phase Goal:** Run Script — stack a script onto an existing Paint rail (Quick A: playhead targeting, extend-only cycle growth, Keep script ON for flag-on rails / OFF replace, collision Cancel/Truncate/Overwrite-removal, atomic undo). Quick B (flag-off Keep ON + base authority, Reveal stacking) is explicitly out of scope.
**Verified:** 2026-10-31T16:45:04Z
**Status:** human_needed
**Re-verification:** Yes — freshness re-run at HEAD `8bf9931a5`. Since the previous verifier pass (`2026-10-31T16:38:52Z`, status `human_needed`) the only commit is `8bf9931a5 docs(quick-261031-i54): close Run Script Quick A automated-ready`; `git log --since=2026-10-31T16:38:52Z -- app/` is empty, so every must-have was re-confirmed against the same final source, and the fingerprint above was regenerated to clear the `stale` status (the prior digest predated the SUMMARY).

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | Playhead inside exactly one Paint rail's effective span (real key, generated frame, empty frame, repeated occurrence) targets that rail: writes source-cycle keys at phaseOrigin + cycleOffset, creates no new Loop Clip and never materializes an occurrence; outside every rail the create path is byte-identical. | ✓ VERIFIED | `physicsPaintRotoRunScriptStacking.ts` `toRunScriptRailViews` (161-207) + `resolveRunScriptDestination` (216-246: fragment membership, `offset % cycleLength`, `runStartAppFrame = phaseOrigin + cycleOffset`, create/refuse precedence). Controller `stackContext` re-derives live from the canonical resolver via `ports.getSelection` + `getLoopEditSnapshot`/`getPhysicalDocument` + `getRotoLoopClips` (`physicsPaintRotoPlayScriptController.ts:782-818`, derivation 801-806, destination 810), pinned surface 836-846, `runDestination` 848-854, authority asked at the source-cycle start 1255. Tests: stacking 183-235; controller 4207-4225 (live before open + re-resolve on revision), 4241-4284 (repeated occurrence: no new clip, run start F13, originalEndExclusive 22), 4286-4298 (create path unchanged), 4674-4691 (fragment gap = create). |
| 2 | Overlapping membership, a Reveal rail target, or a frame override inside the written span fails closed with a clear reason and zero writes; a generated frame outside a rail keeps today's generated-interpolation refusal. | ✓ VERIFIED | Overlap/reveal refusals in `resolveRunScriptDestination` (225-232); frame-override refusal from `clip.frameOverrides` app frames read directly (CR-01, stacking 185-188, 368-383) and controller `confirmStack` 2176-2182 (zero writes before authority); generated-interpolation refusal kept for non-stack destinations (`disabledReason` 575-579); refusals never open the dialog (1231-1240). Tests: stacking 211-235, 496-518; controller 4227-4239 (generated outside), 4562-4585 (override in span: zero commit/record), 4587-4594 (Reveal refused before authority), 5120-5152 (override added while open refused). |
| 3 | Extend-only: a run past the cycle end appends contiguous source-cycle keys and grows the lifecycle (`originalEndExclusive`, `visibleRanges`); repeat unchanged; infinity stays lifecycle-less; cycle never shrinks; a finite repeat whose extend-only span (cycle length × repeat) crosses the parent end goes through explicit Truncate / Cancel, never a silent cap. | ✓ VERIFIED | `planRunScriptStackExtension` (max-only growth, 252-271); `planRunScriptStackLifecycle` (unclamped `requestedRailEndExclusive = phaseOrigin + newCycleLength * repeat` at 411, explicit `cap` 413-416, `Math.max(previousEnd, …)` 416, infinity → `lifecycle: null` 405-410). Controller `stackCollision.lifecycleOverflow` 941-963 and offer filtering 983-994; confirm applies lifecycle at 2353-2365 and caps only on explicit Truncate 2189-2252. Tests: stacking 238-271, 358-404, 547-725 (including the no-capacity test 587, infinity 634/646, never-shrink 568/613); controller 4241-4284 (repeat 2, end 22), 4540-4560 (parent-end offers cancel/truncate and caps), 4932-4949 (lifecycle-only readout), 5189-5241 (Truncate cap), 5243-5289 (never shrinks a longer stored end). |
| 4 | Keep script renders only for stack destinations and only when the union port exists; defaults ON for a persisted `keyScriptEdits` rail. ON appends slices and re-bakes the raw union over the known-empty base; OFF replaces pixels and purges/replaces records. A flag-off rail renders OFF + disabled with the replace reason (flag-off Keep ON is Quick B); executed mode always matches the visible switch; `keyScriptEdits` is never flipped. | ✓ VERIFIED | Controller gating 1021-1054 (`keepScriptVisible`/`keepScriptEffective`/`keepScriptDisabledReason`, seed 1036-1048, compare-then-write setter 1050-1054); `confirmStack` `useUnion` 2170-2175, union bytes replace staged records + `proposedRecords` 2378-2399, `recordMode: useUnion ? 'append' : 'replace'` 2409. Studio `bakeStackedRailKey` raw union (recorded events + this run, no composite, null → refuse) `PhysicsPaintStudio.tsx:3896-3912`; mode-aware `recordRailKeyScripts` replace purges + pins known-empty, append records only 3917-3943; ports wired 4025, 4036-4038. Tests: controller 4344-4374 (replace, no `keyScriptEdits` in target), 4376-4400 (gating/flag-off reason), 4402-4452 (one union bake per key, append mode, raw union bytes committed, flag stays true), 4454-4473 (bake refusal aborts with zero writes), 4475-4493 (flag-off union unreachable); Studio pins 5001-5041; dialog 1572-1603. |
| 5 | Crossing another rail's start offers Cancel / Truncate (default) / Overwrite; Overwrite removes the victim Loop Clip in the same atomic commit (keys survive as ordinary keys) and one undo restores it; crossing the parent end (including the repeat-extended lifecycle span) offers Truncate / Cancel only. | ✓ VERIFIED | Boundary rank + offer table in `resolveRunScriptStackBoundary` (135-147, 319-385); controller `victimHasFrameOverrides`/`overwriteChoiceValid`/`collisionOffers` 967-994; stale Overwrite refused before bake 2194-2202; single `ports.commit(publication)` at 2401 with the victim filtered out of `loopClips` (2366-2368) and the target lifecycle applied (2353-2365), canonical ack 2404; the hook turns one publication into exactly one `executePhysicalEdit` (`useRotoPlayScriptController.ts:104-171`). Tests: stacking 302-546; controller 4495-4538 (victim removed in the same commit, keys survive as ordinary keys, record reaches F25), 4540-4560 (parent-end only cancel/truncate), 4693-4724 (stale Overwrite refused), 4726-4759 (victim with overrides filters Overwrite), 4761-4811 (covering rail, Truncate refuses with zero free span), 4856-4877 (double confirm ignored, one commit). One-command history semantics pinned at controller test 1030-1160; dialog ordering/default 1604-1668. |
| 6 | Dialog shows the resolved span, source-cycle offset and resulting extension/truncation; Max and the Frames stepper bound resolve to `stackMaxCount` (free span before the collision boundary), never physical capacity; frames default to the script's natural duration for stack targets only (creation keeps 3); the Source cycle card never renders on a stack destination. | ✓ VERIFIED | `buildRunScriptStackReadout` (468-492) + controller `stackMaxCount` 899-904, `framesMax` 1017, natural-duration seeding 1310-1313, `identicalSourceCycle` suppressed for a stack 736-741, repeat locked 1019. Dialog: stack readout `physics-play-script-stack-readout` 700-706, Keep switch + reason 707-718, collision card 740-790, header `Max {framesMax}` 482, Frames bound/allowOutOfRange 646-650, Source cycle card gated by `identicalCycle` 264/875, creation cards hidden. Tests: dialog 1506-1770 (readout, framesMax bound, Keep switch, collision copy, creation cards hidden, tabs hidden); controller 4300-4315 (Max = 49 free span, confirms F11-F59), 4317-4342 (typed count above free span raises collision instead of clamping), 4241-4256 (stack natural-duration seed), 4286-4298 (creation stays 3), 4596-4619 (Source cycle card never surfaces). |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases (Quick B, user-authorized split).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Keep script ON for flag-off (unscripted) Paint rails + the durable-base authority seam | Quick B | Quick A law: flag-off stack targets render the switch OFF and disabled with a replace reason; the union path is unreachable without persisted `keyScriptEdits` (controller test 4475-4493) |
| 2 | Reveal rail stacking (extension through the placed photo reference, per-key recording) | Quick B | Quick A refuses a Reveal rail target without opening the dialog (controller test 4587-4594; stacking 230-232); no Reveal stacking code exists |
| 3 | Frame-override bases (stacking over a frame override) | Quick B | Quick A refuses a frame override inside the written span with zero writes (controller test 4562-4585; stacking test 496-518) |

### Advisory (New Scope, Unevidenced)

New-scope findings from the anti-pattern scan with no deterministic evidence — reported, not blocking.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| — | None | — | No new-scope finding raised |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | --------- | ------ | ------- |
| `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` | Pure destination resolution, extend-only growth, collision/override boundary, lifecycle and readout | ✓ VERIFIED | 492 lines (min 180); `verify.artifacts` 4/4 passed; exports destination, extension, merge, boundary, lifecycle, readout and overwrite copy; no stubs or debt markers. |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | Live-port stack destination, runStart re-anchoring, Max/keep gating, confirmStack publication | ✓ VERIFIED | 3561 lines (min 2700); `stackContext`/`runDestination` 782-854; `liveRailForTarget` 871-874; boundary/collision 876-994; Keep gating 1021-1054; `confirmStack` 2141-2434; CR-07 canonical ack 3520-3540. |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | Stack readout, Keep script switch, collision choice surface | ✓ VERIFIED | 983 lines (min 880); stack readout `physics-play-script-stack-readout`, Keep switch + reason, collision card with Cancel/Truncate(default)/Overwrite + rendered removal copy (774-790), `Max {framesMax}`, creation cards and tabs hidden. |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | `bakeStackedRailKey` union re-bake port and mode-aware `recordRailKeyScripts` | ✓ VERIFIED | 10043 lines (min 10020); union port 3896-3912 (raw union, no composite, null → refuse); mode-aware recorder 3917-3943 (one known-empty pin site, replace only); ports wired 4025, 4036-4038 including `physicalRevision` 3990. |

**Artifacts:** 4/4 verified (`verify.artifacts` exit 0, `all_passed: true`).

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Controller `runDestination` | Canonical loop resolver | live ports → `derivePhysicPaintRotoLoopRanges` | ✓ WIRED | `physicsPaintRotoPlayScriptController.ts:782-818` reads `getSelection`, `getLoopEditSnapshot`/`getPhysicalDocument`, `getRotoLoopClips`, builds the canonical context at 801, then `resolveRunScriptDestination` at 810 — no controller-local membership math and no second boundary authority. |
| Controller `confirmStack` | Studio `bakeStackedRailKey` | one port call per touched key → staged frame bytes | ✓ WIRED | Controller 2174, 2378-2399 replaces staged record bytes and `proposedRecords` with the returned union bytes; Studio port 3896-3912 bakes `getAquarelleEventsForFrame + this run`, refusing on null. Test: 4402-4452. |
| Controller `confirmStack` | Studio `recordRailKeyScripts` | `recordMode: useUnion ? 'append' : 'replace'` | ✓ WIRED | Controller 2409; Studio replace branch purges + pins `aquarelleDurableBaseByKeyRef` null, append branch records only (3917-3943); reveal creation is pinned to replace (4025). Tests: controller 4344-4374, 4402-4493; Studio pins 5001-5041. |
| Controller `confirmStack` | ONE commit | publication carrying target lifecycle + merged source keys + victim removal | ✓ WIRED | Single `ports.commit(publication)` at 2401 (no second commit path inside `confirmStack`); publication built 2361-2374 with `updatedTarget` lifecycle and `nextClips` filtered of the victim; the hook commit issues one `executePhysicalEdit` and waits one settlement (`useRotoPlayScriptController.ts:104-171`). Tests: controller 4528-4537, 4856-4877. |

**Wiring:** 4/4 connections verified (the `verify.key-links` verb parsed 0 links because the PLAN key_links are free-form strings; each link was verified manually against source and tests).

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `runDestination` / stack surface | selection, identities, loop clips | live ports `getSelection` + `getLoopEditSnapshot`/`getPhysicalDocument` + `getRotoLoopClips` | Yes — canonical derivation, no static fallback; malformed derivation degrades to create | ✓ FLOWING |
| Dialog stack readout / Max / collision | `stackReadout`, `stackMaxCount`, `framesMax`, `stackCollision`, `collisionOffers`, `keepScript*` | controller computeds fed by the live surface | Yes — pure functions over live rails/boundary | ✓ FLOWING |
| Committed run records (Keep script ON) | `records[].payload.bytes` | `bakeStackedRailKey` → recorded events + this run's strokes → `bakeAquarelleEventsToFrame` | Yes — raw union bytes from the real bake, no composite or mock | ✓ FLOWING |
| Availability revision | `physicalRevision` | Studio's scalar `rotoPhysicalRevision` signal | Yes — no document parse in the render body (WR-13) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Pure stacking truths (destination, boundary, lifecycle, readout) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts` | 49 passed | ✓ PASS |
| Controller stack flow (two-start, pin, live guards, Keep, collision, ack) | `... vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | 222 passed | ✓ PASS |
| Dialog stack surface | `... vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | 72 passed | ✓ PASS |
| Studio ports | `... vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | 298 passed | ✓ PASS |
| Hook availability revision | `... vitest run src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts` | 6 passed | ✓ PASS |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` (run once, not watch) | 360 files passed (2 skipped); 6725 tests passed, 1 skipped, 96 todo; exit 0 | ✓ PASS |
| Type safety | `pnpm --filter efx-motion-editor run typecheck` | exit 0 (`tsc --noEmit`) | ✓ PASS |
| Rename tripwire (no quoted `Create Rail` in app/src) | `grep -rn --include='*.ts' --include='*.tsx' -E "['\"]Create Rail['\"]" app/src` | no matches | ✓ PASS |
| Persisted format + Quick B scope guards | `git diff --name-only 8142f03d1^..HEAD` | no `packages/`/codec/payload files; no `aquarelleScriptBaseAuthority`; `aquarelleBaseRecovery`/`physicsPaintRotoScriptClipboard` untouched; Studio diff only the union port, mode-aware recorder, scalar revision port | ✓ PASS |

Combined targeted run: 5 files, 647 tests passed (2.20s). Full suite: 6,725 passed (12.68s).

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No probe scripts declared in the PLAN and none conventional for this UI/controller quick task | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261031-I54 | `261031-i54-PLAN.md` | Run Script stacking Quick A (playhead targeting, extend-only growth, Keep script ON/OFF replace, collision choices, atomic commit) | ✓ SATISFIED | All six must-have truths verified; 4/4 artifacts pass; 4/4 key links wired; Quick B scope untouched. No REQUIREMENTS.md row exists for this quick task (the PLAN frontmatter is the source). |

**Coverage:** 1/1 requirement satisfied, 0 orphaned.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `physicsPaintRotoRunScriptStacking.test.ts` | QUICK-261031-I54 | 49 | 0 | none | Value/Behavioral (`toEqual`, exact span/offset/offer assertions) | ✓ PASS |
| `physicsPaintRotoPlayScriptController.test.ts` | QUICK-261031-I54 | 222 | 0 | none | Behavioral (multi-step confirm/collision/commit flows, exact publications) | ✓ PASS |
| `PhysicsPaintPlayScriptDialog.test.ts` | QUICK-261031-I54 | 72 | 0 | none | Value/Behavioral (rendered tree, IDs, copy, handler calls) | ✓ PASS |
| `PhysicsPaintStudio.test.ts` | QUICK-261031-I54 | 298 | 0 | none | Source-pin / Behavioral (exact branch bodies and ports) | ✓ PASS |
| `useRotoPlayScriptController.test.ts` | QUICK-261031-I54 | 6 | 0 | none | Behavioral (revision bump without document parse) | ✓ PASS |

**Disabled tests on requirements:** 0.
**Circular patterns detected:** 0 (no fixture-writing scripts in the linked tests).
**Insufficient assertions:** 0. Coverage note (not a blocker): the positive stack natural-duration assertion at controller 4241-4256 uses a natural duration of 3, which coincides with the creation default; the stack-only law is pinned by the code at controller:1310-1313 together with the creation counter-case at 4286-4290 (natural 9 still seeds 3).
**Remediated-blocker coverage present:** CR-01 (stacking 108-137; controller 4562), CR-02 (dialog 1670-1686), CR-03 (stacking 138-155, 373-388; controller 4674), CR-04 (controller 4693), CR-05 (controller 4726), CR-06 (stacking 389-404; controller 4761), CR-07 (controller 4953, 4991), WR-02 (controller 5055, 5087, 5120; `stackTargetUnchanged` 1075-1085), WR-05 (stacking 598, 613, 634; controller 5189, 5243), WR-12 (controller 5017), WR-13 (hook test 293-310), WR-14 (controller 5154).

### Decision Coverage

No trackable decisions in CONTEXT.md (gate: skipped, `no trackable decisions`).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No `TBD`/`FIXME`/`XXX` debt markers in any i54-modified file | — | — |
| — | — | No placeholder/coming-soon/empty-handler stubs in the new stacking module or the stack paths (grep for `return null`/`return {}`/`return []` in the module returns nothing) | — | — |

**Anti-patterns:** 0 found (0 blockers, 0 warnings, 0 advisories).

## Human Verification Required

The plan explicitly hands over live, user-run UAT rows. All automated checks pass; these remain.

### 1. Stack onto an existing Paint rail
**Test:** Put the playhead inside a Paint rail and run a script.
**Expected:** The run stacks onto that rail — no second Loop Clip, the span grows only as far as the run reaches, and earlier frames keep their pixels.
**Why human:** Live bake/repaint across the real renderer.

### 2. Create path outside every rail
**Test:** Put the playhead outside every rail and run a script.
**Expected:** A new rail is created exactly as today.
**Why human:** Confirm the visible create result is unchanged.

### 3. Generated frames inside vs outside a rail
**Test:** Run on a generated/interpolated frame inside a rail, then on one outside every rail.
**Expected:** Allowed inside (re-anchored to the source-cycle start); refused outside with the existing generated-interpolation reason.
**Why human:** Live selection/interpolation state.

### 4. Repeated-rail extension
**Test:** Extend a repeated rail.
**Expected:** Effective span grows by repeat × cycle growth, repeat count unchanged, earlier occurrences still resolve.
**Why human:** Visual timeline/canvas resolution.

### 5. Collision choices and undo
**Test:** Cross another rail's start; try Cancel, then Truncate, then Overwrite; undo the Overwrite.
**Expected:** Cancel writes nothing; Truncate clips at the boundary and leaves the other rail untouched; Overwrite removes the other rail (its keys stay ordinary keys) and one undo restores it exactly.
**Why human:** Undo/redo across the real history stack and visible rail removal.

### 6. Parent-end repeat overflow
**Test:** Force the repeat-extended lifecycle span past the parent end.
**Expected:** Only Truncate / Cancel are offered; the rail is never silently shortened; the lifecycle-only copy names the parent-range cap.
**Why human:** Message clarity and visible outcome.

### 7. Keep script ON persistence
**Test:** On a flag-on rail, stack a second script, repeat, then save/reopen.
**Expected:** Original strokes remain under the new ones with no doubling; repeat stacking stays stable.
**Why human:** Save/reopen persistence and the rendered union.

### 8. Keep script OFF replacement
**Test:** Turn Keep script OFF on a scripted rail and run.
**Expected:** The touched span's pixels and records are replaced; frames outside keep theirs.
**Why human:** Visible pixel comparison.

### 9. Flag-off rail switch
**Test:** Target an unscripted (flag-off) rail.
**Expected:** Keep script is OFF and disabled with the reason that this run replaces the touched span; no ON-checked control executes replace.
**Why human:** Disabled affordance and copy are user-facing.

### 10. Max free span
**Test:** Use Max on a stack destination.
**Expected:** It fills the free span before the next boundary, not the physical capacity.
**Why human:** Live dialog interaction and resulting span.

### 11. Source cycle card absence
**Test:** Open Run Script on a stack destination.
**Expected:** The creation-only Source cycle card never appears.
**Why human:** Final visual layout/visibility.

## Gaps Summary

**No gaps found.** The Quick A goal is implemented and behaviorally verified against HEAD `8bf9931a5`: destination resolution uses the one canonical derivation from live ports; refusals fail closed with zero writes; growth is extend-only with lifecycle growth, unchanged repeat, lifecycle-less infinity clips and explicit Truncate capping; Keep script is wired through the raw-union port and mode-aware recorder with `keyScriptEdits` never flipped; collision offers and the single atomic commit (including victim removal and one-command undo semantics) are in place; and the dialog exposes the stack readout, free-span Max, natural-duration default and collision surface while hiding creation-only controls.

Remediation gate: CR-01..CR-07 and WR-02/05/12/13/14 are all present in source with the named regression tests above.

Scope discipline holds: no persisted format/schema file changed (`git diff --name-only 8142f03d1^..HEAD` touches no `packages/`, codec or payload file), no Quick B artifact exists (`aquarelleScriptBaseAuthority` absent; `aquarelleBaseRecovery.ts` and `physicsPaintRotoScriptClipboard.ts` untouched), and the Studio diff adds only the union port, the mode-aware recorder and the scalar revision port. Only documentation changed after the previous verifier pass; the code is identical to the previously verified tree, and the fingerprint above is regenerated so the report is not stale.

Status is `human_needed` solely because the plan's 11 live UAT rows are user-run and have not been recorded.

---

_Verified: 2026-10-31T16:45:04Z_
_Verifier: Claude (gsd-verifier)_
