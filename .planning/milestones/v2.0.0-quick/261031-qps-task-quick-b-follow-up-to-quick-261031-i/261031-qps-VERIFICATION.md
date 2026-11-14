---
phase: 261031-qps-task-quick-b-follow-up-to-quick-261031-i
verified: 2026-10-31T20:29:28Z
status: human_needed
score: 6/7 must-haves verified
covered_files: [".planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-PLAN.md", ".planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts", "app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.test.ts", "app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts", "app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts", "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts", "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx", "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts", "app/src/stores/physicPaintStore.test.ts", "app/src/stores/physicPaintStore.ts"]
covered_digest: "v3:sha256:f4a04fbe9615723e62e473b7cd29e08c1a3371fb00821508cbf2503c4027f977"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Pixel-only Keep ON appends over the pinned pre-run picture with no doubling after re-bake, save/reopen and repeat"
    test: "Run the same script twice with Keep ON on a pixel-only Paint rail; save, reopen, run again"
    expected: "The original picture stays under the accumulated strokes; no stroke doubles after any repeat or reopen"
    why_human: "Switch/seed, append mode, authority pin order and no-flag-write are each pinned, but no test executes a second stack run across a snapshot round-trip"
human_verification:
  - test: "Pixel-only Paint rail: Run Script Keep ON (default), repeat; save, reopen, repeat"
    expected: "Original picture preserved; nothing doubles"
    why_human: "Cross-run/reopen pixel outcome"
  - test: "Same rail with Keep OFF, then run again"
    expected: "Run lands over the current picture; no script recorded or replayed"
    why_human: "Visual persistence of the flatten law"
  - test: "Stack on an unscripted raster key, edit the new strokes, reopen and repeat"
    expected: "Original raster remains beneath; unprovable base refuses and erases nothing"
    why_human: "Visual non-destruction"
  - test: "Run Script over a span containing a frame override"
    expected: "Run applies; override keys keep the source key's base"
    why_human: "Visual confirmation of no composite doubling"
  - test: "Reveal rail: Run Script with Colorize / Photo wiggle / Paint seed; repeat; save, reopen; undo once"
    expected: "Same placed photo / new wash, knobs adopted, Rail Type hidden, no doubling, one undo restores"
    why_human: "Same-photo rendering and undo are live/visual"
  - test: "Reveal rail with no reference; Reveal rail beside plain-paper keys"
    expected: "Clear refusal with zero writes; plain-paper bytes never on a reveal frame"
    why_human: "Refusal copy and visual exclusion"
  - test: "Quick A UAT rows 1-9 plus Reveal row 8 and the Reveal part of row 9"
    expected: "All accepted stacking laws still hold"
    why_human: "Live UAT is the user's step"
---

# Quick 261031-qps: Run Script stacking, part B — Verification Report

**Goal:** Pixel-only Paint Keep script over one durable-base authority, legal frame overrides in span, Reveal stacking through the placed photo reference.
**Status:** human_needed (live UAT pending) · **Re-verification:** Yes — final digest refresh. HEAD `7293b26fe`; `git log --since="2026-10-31T20:26:55Z" -- app/src` is empty, so source and tests are unchanged. The only delta is docs-only in `261031-qps-SUMMARY.md` (final commit count 11, `plan_head_after: 7293b26fe`, remediation row 11 `7293b26fe`). The digest below therefore changes only through the SUMMARY.md hash.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Pixel-only Keep visible/seeded ON; ON appends over the pinned pre-run picture; no doubling; flag never written | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `controller.ts:1102-1110` (visible/effective, no flag gate), `:1122-1139` (seeds ON via `RUN_SCRIPT_KEEP_SCRIPT_DEFAULT`), `:2420-2427` (append/none/replace), `:2589-2598`; `PhysicsPaintStudio.tsx:4030-4111` (authority resolution + `slice(0)` pre-run pin), `:4247-4288` (pin lands only after commit); tests `controller.test.ts:4572`, `:4610`; cross-run/reopen no-doubling untested |
| 2 | Keep OFF flattens, records/purges/pins nothing | ✓ VERIFIED | `controller.ts:2425-2427` (`recordMode: 'none'`), `:2599-2615`; `PhysicsPaintStudio.tsx:4116-4146` (composite over current picture, no pin), `:4253-4255` (none records nothing); test `:4610` |
| 3 | One authority, locked order, source-key occurrence/override, persist vs session pins | ✓ VERIFIED | `aquarelleScriptBaseAuthority.ts:74-98` (reveal → persisted → session → pin-if-no-strokes → fail closed); consumed `PhysicsPaintStudio.tsx:3460`, `:4054`, `:6985`; source-key mapping `:3501`, `:3511`; 18-case matrix `authority.test.ts:57-252` |
| 4 | Frame override in span legal, base = source key | ✓ VERIFIED | `physicsPaintRotoRunScriptStacking.ts:388-404` (override path, no refusal); zero `frameOverrideRefusal` producers remain (only a negative assertion in `stacking.test.ts:545`); tests `stacking.test.ts:255`, `controller.test.ts:4820` |
| 5 | Reveal stacks; render-only photo tail; exact coverage; no-reference refusal; no plain paper | ✓ VERIFIED | `controller.ts:2396-2408` (no-reference refusal before any write), `:2547-2588` (tail render + exact coverage + missing-frame abort), `:2574-2586`; `physicPaintStore.ts:2187-2232` (reference walk per span frame, no record/break writes); tests `controller.test.ts:4901`, `:4968`, `:5027`, `:5056`, `:5088` |
| 6 | Reveal cards: Colorize/Photo wiggle/Paint seed, Rail Type hidden, knobs adopted, reference read-only | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:68`, `:304`, `:336-337`, `:352`, `:378-400`; adoption `controller.test.ts:4901` (knobs asserted `:5041-5056` range, target carries no `keyScriptEdits`) |
| 7 | No persisted schema change; unprovable base refuses with no erase | ✓ VERIFIED | `git diff --stat 04c28d1e1..HEAD -- app/src` touches exactly 16 source/test files and no SNAP v5 serializer/validator, Loop Clip record type or persisted rail field module; `durableBaseKind` is runtime-only; refusals `controller.ts:2544-2546`, `PhysicsPaintStudio.tsx:2071-2080` |

**Score:** 6/7 (1 present, behavior-unverified).

## Deferred Items

None — no later phase covers this quick task.

## Advisory (New Scope, Unevidenced)

None.

## Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `aquarelleScriptBaseAuthority.ts` | ✓ VERIFIED (ℹ️ Info: 99 lines vs 110 planning estimate) | Complete pure resolver; `verify.artifacts` returns 5/6 solely on `Only 99 lines, need 110`. No stub indicator: every documented branch is implemented, the 18-case matrix passes, and three production seams consume it. Line shortfall is a plan-estimate miss, not missing behavior. |
| `aquarelleScriptBaseAuthority.test.ts` | ✓ VERIFIED | 267 lines, 18 tests |
| `PhysicsPaintStudio.tsx` | ✓ VERIFIED | prepare/publish/ensure/stacking/reveal ports |
| `physicsPaintRotoPlayScriptController.ts` | ✓ VERIFIED | Keep 2x2, override legality, reveal confirm |
| `PhysicsPaintPlayScriptDialog.tsx` | ✓ VERIFIED | Reveal composition |
| `physicPaintStore.ts` | ✓ VERIFIED | `renderRevealTailFrames`, no record/break writes |

## Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `prepareRotoScriptTargetRef` | `resolveScriptBase` | `PhysicsPaintStudio.tsx:3460` | WIRED |
| `ensureAquarelleDurableBaseRef` | `resolveScriptBase` | `PhysicsPaintStudio.tsx:6985-6988` (strokes-only probe `:6987`) | WIRED |
| Publish closure | durable-base dispatch | `PhysicsPaintStudio.tsx:1993-2081` | WIRED |
| `confirmStack` Keep ON | `ports.bakeStackedRailKey` | `controller.ts:2589-2598`; pins staged `Studio:4066-4078`, landed post-commit `:4247-4288` | WIRED |
| `confirmStack` reveal branch | `bakeRevealStackTail` → `withRecordBytes` → single `commit` | `controller.ts:2547-2588` | WIRED |
| `stackRailKind` | dialog card composition | `controller.ts:1089-1092`; `dialog.tsx:68`, `:304-337` | WIRED |

`verify.key-links` returns exit 1 for all six with "Source file not found (from: must be a relative file path; describe components/endpoints in via:)" — the verb cannot resolve symbolic component names, so manual verification was used and is WIRED for every link.

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `bakeStackedRailKey` | base bytes | persisted/session maps or live payload pin | Yes | ✓ FLOWING |
| `bakeRevealStackTail` | frame bytes | `renderRotoRevealFrames` + reference walk, fail closed | Yes | ✓ FLOWING |
| Publish closure | `publishBytes` | base composite / known-empty bake / reveal render | Yes | ✓ FLOWING |
| Dialog | `stackReveal` | pinned destination rail kind | Yes | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Targeted Quick B suites (authority, stacking, controller, Studio, dialog, hook, store, clipboard, scripts panel, renderer) | `pnpm --filter efx-motion-editor exec vitest run <10 files>` | 10 files, 977 passed, 0 failed | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | exit 0, clean | ✓ PASS |
| `durableBaseKeyId` removed from `app/src` | `grep -rn ... | wc -l` | 0 | ✓ PASS |
| `confirmStack` never writes `keyScriptEdits` | Task 2 scoped `node -e` gate | exit 0 | ✓ PASS |
| Debt markers in phase-modified sources | `grep -rn -E "TBD\|FIXME\|XXX"` | none | ✓ PASS |
| Full suite | not re-run | Source and tests are byte-identical to the 6,783-pass HEAD; only `261031-qps-SUMMARY.md` (planning doc, inert to the suite) changed. Full-suite basis stands. | ✓ (regression basis) |

## Probe Execution

N/A — no probes declared or implied.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| QUICK-261031-QPS | `261031-qps-PLAN.md` | Run Script stacking, part B | ✓ SATISFIED | Seven truths assessed; targeted suites + typecheck green. Quick-task IDs are tracked in the quick dir, not `.planning/REQUIREMENTS.md` |

## Decision Coverage

No trackable decisions in CONTEXT.md (gate skipped: `no trackable decisions`).

## Test Quality Audit

| Check | Result |
|---|---|
| Disabled tests on requirements | 0 |
| Circular patterns (system-under-test writing expected values) | 0 |
| Assertion level | Behavioral (controller/Studio/store flows), value-level on the authority matrix |
| Expected-value provenance | Valid (independently written expectations; no captured-from-engine fixtures) |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `aquarelleScriptBaseAuthority.ts` | — | 99 lines vs `min_lines: 110` planning estimate | ℹ️ Info | `verify.artifacts` flags the line count; the module is complete, fully tested and wired — no stub |
| — | — | No `TBD` / `FIXME` / `XXX` / `TODO` markers in any phase-modified source | — | Debt-marker gate clean |

## Human Verification Required

1. **Pixel-only Keep ON repeat/reopen** — run the same script twice with Keep ON, save/reopen, run again. Expected: original picture preserved, nothing doubles. Why human: no test executes a second stack run across a snapshot round-trip.
2. **Pixel-only Keep OFF** — run, then run again. Expected: run lands over the current picture; no script recorded or replayed.
3. **Raster key stack then edit** — edit the stacked strokes, reopen and repeat. Expected: original raster remains; unprovable base refuses and erases nothing.
4. **Override in span** — Run Script over a span containing a frame override. Expected: run applies; override keys keep the source key's base.
5. **Reveal stack** — set Colorize / Photo wiggle / Paint seed, repeat, save/reopen, undo once. Expected: same placed photo/new wash, knobs adopted, Rail Type hidden, one undo restores.
6. **Reveal refusals** — no photo reference, and a Reveal rail beside plain-paper keys. Expected: clear refusal with zero writes; no plain-paper bytes on reveal frames.
7. **Quick A regression** — UAT rows 1-9 plus Reveal row 8 and the Reveal part of row 9.

## Gaps Summary

No blocking gaps. One behavior-dependent clause — cross-run no-doubling on a pixel-only Keep ON rail — has no end-to-end test; the live UAT rows remain the user's step. Hence `human_needed`, not `passed`.

---

_Verified: 2026-10-31T20:29:28Z · Verifier: Claude (gsd-verifier)_
