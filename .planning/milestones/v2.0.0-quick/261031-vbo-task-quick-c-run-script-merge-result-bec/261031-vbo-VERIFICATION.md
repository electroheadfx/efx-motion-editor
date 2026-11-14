---
phase: 261031-vbo-task-quick-c-run-script-merge-result-bec
verified: 2026-10-31T23:50:51Z
uat_approved: 2026-11-01
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-PLAN.md"
  - ".planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-SUMMARY.md"
  - "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
  - "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts"
  - "app/src/components/physic-paint/hooks/useRotoTimelineActions.ts"
  - "app/src/components/physic-paint/physicsPaintStudio.css"
  - "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts"
  - "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx"
  - "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts"
  - "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts"
  - "app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts"
  - "app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts"
covered_digest: "v3:sha256:4898a30793b33317795f10132abc081054e6bdc2a0a18bb1a5ccab93c2196314"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Motion destination + Static run: stack a Static script onto a Motion rail in the running app."
    expected: "The rail becomes one gray Standard Rail; row tooltip, rail tooltip ('Type: Standard') and the Scripts panel all say Standard, never Motion/Static/Reveal."
    why_human: "Live visible color and labels in the running Studio cannot be observed by unit tests."
  - test: "Static destination + Static run: stack a Static script onto a Static rail."
    expected: "Same gray Standard result, same Standard labels everywhere."
    why_human: "Live visible rendering."
  - test: "Motion destination + Motion run: stack a Motion script onto a Motion rail."
    expected: "Same gray Standard result; the first rail's motion is no longer advertised as a Motion rail."
    why_human: "Live visible rendering and tooltip copy."
  - test: "Stack again on an existing Standard Rail: apply another Motion or Static run to a previously merged rail."
    expected: "It stays Standard and gray and keeps its cycle/repeat options."
    why_human: "Live repeated-merge flow."
  - test: "Keep ON and Keep OFF on a merged rail: run the stack with Keep ON, then repeat the run; then repeat with Keep OFF."
    expected: "Keep ON keeps the destination's existing picture under the new run after the merge and after repeating, nothing doubles; Keep OFF flattens it."
    why_human: "Composited pixels can only be judged visually."
  - test: "Cycle/repeat editing on the merged rail: open Edit Rail, change repeat and cycle length."
    expected: "Both edits still work on a Standard Rail and survive."
    why_human: "Live dialog interaction and resulting rail span."
  - test: "Regenerate and Replay on the merged rail: open the rail actions and a scripted rail's actions."
    expected: "Both are unavailable with the merged-rail reason ('this rail merges multiple scripts'); key editing and per-key script editing still work."
    why_human: "Live disabled-state and tooltip presentation."
  - test: "One Undo after a merge: run a stack, then press Undo once."
    expected: "The original typed rail is restored exactly, including type, color, source script and (for a reveal destination) its reveal knobs."
    why_human: "Live undo through the app history and the restored visual identity."
  - test: "Save then reopen: persist the project after a merge and reopen it."
    expected: "The rail is still a gray Standard Rail with the same picture and the same blend."
    why_human: "Native save/reopen and pixel identity in the packaged app."
  - test: "Typed-rail regression: inspect an unstacked Motion rail, a Static rail and a Reveal rail."
    expected: "Motion stays purple, Static stays cyan, Reveal stays blue, each with its own Regenerate behaviour; none shows Standard."
    why_human: "Live color and action behavior."
---

# Phase 261031-vbo: Quick C1 — Run Script merge result becomes a Standard Rail

**Phase Goal:** A Run Script stack on a Physic Paint Roto rail produces ONE Standard Rail. The destination's cached frames and cycle/repeat options survive, the incoming Motion/Static run composites over them, and the same atomic commit drops single-script provenance (`scriptId`, `motion`, `overrideColor`), `railKind` and every reveal knob (`colorize`, `colorizeMix`, `photoWiggle`). The merged rail presents with a neutral gray line, "Standard Rail" labels, no lifecycle dot, and Regenerate/Replay refuse with a merged-rail reason. The required `mode` field keeps the destination's stored value internally and is never presented as a rail type. One undo restores the original typed rail exactly. No persisted schema/format change.

**Verified:** 2026-10-31T23:50:51Z at HEAD `6ba13731637e17aaedacd123ccc640f60e6f5819`
**Status:** human_needed (all automatable checks pass; live visible UAT is the user's step)
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Any destination rail (Motion, Static, Reveal, or already Standard) receiving a Motion or Static run commits ONE Standard Rail: cached picture and cycle/repeat options survive, the run composites over them, and the same atomic commit drops `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix`, `photoWiggle`. | VERIFIED | `buildStandardStackedLoopClip` is an explicit whitelist projection (stacking module lines 560-594) that copies loopId, placementStart, repeat, a frozen sourceKeyIds copy, the destination's stored `mode`, optional flags, the six lifecycle members, then the lifecycle plan. `confirmStack` adopts it at controller line 2532 and performs exactly one `ports.commit(publication)` at line 2636; publication records are seeded from the full authority so untouched destination frames survive. Tests: stacking whitelist keep/drop matrix (`physicsPaintRotoRunScriptStacking.test.ts` 870-1048); controller merge test (`physicsPaintRotoPlayScriptController.test.ts` 5464-5564) asserts one commit, no own provenance/reveal properties, destination `mode`, repeat, lifecycle; reveal-destination merge 4975-5013; null-plan lifecycle preservation 5566-5599; Keep ON/OFF Standard commits at 4461/4654/4696. |
| 2 | A merged rail presents as "Standard Rail" with a neutral gray line in both rail hosts, "Type: Standard" in its tooltip, "Standard" as its Rail Type, no typed identity and no lifecycle dot; typed rails keep their purple (#8b5cf6), cyan (#06b6d4) and blue (#69BBC8) lines and Motion/Static/Reveal labels unchanged. | VERIFIED | One classifier `classifyLoopClipRailKind` (workflow presentation line 48) feeds both hosts: presentation line 145 and TrackRow line 337. Presentation sets `modeLabel` Standard (148), `groupTypeLabel` Standard Rail (151), no dot (159), source label "Merged rail — multiple scripts" (227), status copy (342), merged reasons (353, 373). LoopClipRail emits `rail-kind-standard` (341) next to `mode-*`; TrackRow emits it (673) and its aria label becomes "Standard rail at frame N" via `getRotoRailKindLabel`. CSS gray block 4408-4431 restates both modes, hover/focus, selected (#f59e0b), unresolved (#ff6b6b) and action-linked, mirroring the reveal block; ghost/set rows also styled (3694, 3735, 3776). Tests: presentation Standard suite (467-569), rail class/CSS pins, TrackRow class/aria pins, typed-color and typed-label regression pins. |
| 3 | Regenerate and Replay are unavailable on a merged rail with an explicit merged-rail reason; per-key script editing, normal key editing and cycle/repeat editing remain available. | VERIFIED | `groupRegenerateReason` returns `STANDARD_RAIL_REGENERATE_REASON` immediately after the busy guard, before `isRegenerableLifecycleShape` (controller 1590); `openSourceEdit` refuses with the same constant (1704). The dialog disables Regenerate Rail with that title/aria reason (dialog 460-462) and keeps the primary action as "Update Rail" (479-480). Replay reason is set on the presentation (174, 373) and surfaced by the tooltip. `updateLoop` still spreads the clip and only changes repeat/lifecycle, so cycle/repeat editing remains. Tests: regenerate refusal canonical and infinity cases (controller 3653+), dialog merged edit target (1173-1219), status/regenerate/replay copy pins. |
| 4 | The incoming run's Rail Type (Motion/Static) shapes only that run's bake; it never converts the rail, and the required `mode` field keeps the destination's stored value. | VERIFIED | `renderMode`, `motion`, `renderOverrideColor` and `renderPaintSeedVariation` remain bake/summary inputs only; the committed record takes `mode: target.mode` from the destination. Tests: "seeds the run from the rail settings and bakes the dialog settings" (controller 5447-5462) asserts static bake from a progressive destination while the committed clip keeps `mode: 'progressive'`, `paintSeedVariation: true`, and no own `motion`/`overrideColor`; merge test asserts destination `mode: 'static'`; stacking stored-mode test. |
| 5 | One undo restores the pre-merge typed rail exactly (provenance, motion, color, reveal knobs), and save then reopen keeps the Standard Rail, its picture and its blend. | VERIFIED | Merge test pins one commit, a fresh committed record (`committed !== target`), and a deep pre-run snapshot proving the destination loop collection is byte-identically untouched (controller 5464-5513). The real history hook restores loop-clip + record publications byte-identically in the regeneration/repair/relink tests (3451-3470, 2675-2700, 2735-2755). Reload: the committed publication is serialized, parsed by the existing parser, and reopened with the same Standard record, Standard Rail presentation, repeat, source cycle and repeat resolution (5464+ reload pin; reveal reload 5048-5078). Live Undo is UAT row 8. |
| 6 | No persisted schema or format change: a provenance-free, railKind-free Loop Clip with the six lifecycle members round-trips through the existing parser and fingerprint. | VERIFIED | Independent schema tripwire below: the 22-file diff touches no model, serializer, parser or persisted rail field. Round-trip tests: `isPhysicPaintRotoLoopClip(committed)` true, `parsePhysicPaintRotoLoopClips([committed])` deep-equals `[committed]`, reopened document clip equals the committed record (controller 5464+, 5048-5085). `PhysicPaintRotoLoopClip` requires only loopId/placementStart/sourceKeyIds/repeat/mode; Standard is expressed by absent provenance. |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` | Whitelist projection, classifier, three copy constants | VERIFIED | Exists, substantive (73 added lines), wired: constants at 158-164, `isStandardMergedLoopClip` 536, `buildStandardStackedLoopClip` 560. Imported by the controller (51-54) and the presentation layer (workflow presentation line 4, presentation 4-6). |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | confirmStack commits the whitelist record; merged Regenerate gate before lifecycle-shape; reveal-knob omit helper deleted | VERIFIED | `buildStandardStackedLoopClip` at 2532, one `ports.commit` at 2636, gate at 1590, Source Edit gate 1704, `omitStoredRevealKnobs` 0 occurrences repo-wide. |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` | 'standard' lifecycle, Standard labels/source, merged status/regenerate/replay copy, no dot | VERIFIED | Lifecycle member and labels at 81/145-159; source label 227; status 342; regenerate 353; replay early return 373; dot excluded 159. |
| `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` | RotoRailKind extended with 'standard', classifyLoopClipRailKind, 'Standard' label | VERIFIED | Kind union and classifier at 48-51; imported by both hosts; `getRotoRailKindLabel` returns Standard (asserted by TrackRow aria test). |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` | rail-kind-standard class on the active-lane rail | VERIFIED | `isStandard` at 198; class appended at 341; rail target renders presentation fields. |
| `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` | rail-kind-standard class and Standard aria label on non-active rows | VERIFIED | Classifier at 337; class at 673; aria label at 679 combines `getRotoRailKindLabel` with " rail at frame N". |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Gray Standard block mirroring the reveal block's specificity | VERIFIED | Gray base #9CA3AF, hover/focus #D1D5DB, selected #f59e0b, unresolved #ff6b6b, action-linked #D1D5DB, both modes, 4408-4431; ghost variants 3694/3735/3776; typed rules untouched (additive diff). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `confirmStack` | `buildStandardStackedLoopClip` | Explicit call, never a spread of the destination | WIRED | Controller 2532; merge tests deep-equal the whitelist output and assert own-property absence for the dropped fields. |
| Presentation | `classifyLoopClipRailKind` | One classifier drives both hosts | WIRED | Presentation 145 and TrackRow 337 call the same function; reveal precedence and unresolved precedence tested. |
| Controller regenerate gate | `STANDARD_RAIL_REGENERATE_REASON` | Same constant rendered by the presentation and the dialog | WIRED | Import at controller 54 used at 1590/1704; dialog imports the same constant (6) for its disabled title. |
| Rail hosts | CSS | `.rail-kind-standard.mode-*` out-specifies selected/unresolved, so the block restates both | WIRED | Rail 341 and TrackRow 673 emit the class; CSS restates selected, unresolved and action-linked for both modes at 4408-4431; behavioral class/CSS pins in both host suites. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `PhysicsPaintLoopClipRail.tsx` | `presentation` | `projectPhysicsPaintLoopClipPresentation(range, clip, ...)` over the committed authority clip and derived range | Yes — committed publication loopClips and records | FLOWING |
| `PhysicsPaintTrackRow.tsx` | `line.railKind` / line presentation | `classifyLoopClipRailKind(clip)` over the authority loop clip | Yes — authority-derived clip | FLOWING |
| `physicsPaintLoopClipPresentation.ts` | Standard labels/copy/disabled reasons | Classifier plus the shared copy constants | Yes — pure projection of stored clip and range | FLOWING |
| `PhysicsPaintPlayScriptDialog.tsx` | `standardEditTarget` | `isStandardMergedLoopClip(editTarget)` from the selected authority clip | Yes — selected clip | FLOWING |

No static returns, hardcoded literals, mock data sources or hollow props on these paths. The "Merged rail — multiple scripts" string is intentional user-facing copy, not placeholder data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Schema tripwire | `git diff f67b27d30..HEAD --stat` and `--name-only` filtered for model/serializer/parser/schema/persist | 22 files, all UI/controller/test/CSS; zero model, serializer, parser or persisted-field files | PASS |
| Reveal-knob omit helper gone | `grep -rn omitStoredRevealKnobs app/src` | 0 occurrences | PASS |
| Targeted suites (merge, controller, presentation, hosts, dialog, panel, strip, timeline actions) | `pnpm --filter efx-motion-editor exec vitest run` on the 10 affected suites | 1,110 tests passed, 0 failed | PASS |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 363 files (361 passed, 2 skipped), 6,818 passed, 1 skipped, 96 todo, 0 failed | PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | No errors | PASS |

Targeted suites: `physicsPaintRotoRunScriptStacking.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`, `physicsPaintLoopClipPresentation.test.ts`, `physicsPaintWorkflowPresentation.test.ts`, `PhysicsPaintPlayScriptDialog.test.ts`, `PhysicsPaintScriptsPanel.test.ts`, `PhysicsPaintTrackRow.test.tsx.test.ts`, `PhysicsPaintLoopClipRail.test.tsx.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`, `useRotoTimelineActions.test.ts`.

### Probe Execution

Not applicable — no probe scripts are declared or implied by this quick task, and it is not a migration or CLI/tooling phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| QUICK-261031-VBO | `261031-vbo-PLAN.md` | Quick C1 — Run Script merge result becomes a Standard Rail | SATISFIED (automated) | All six truths verified above; live UAT pending. |

`.planning/REQUIREMENTS.md` does not map quick-task ids, so there is no orphaned requirement for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No TBD/FIXME/XXX debt markers in any file changed by `f67b27d30..HEAD`; no placeholder/empty-return stubs on the merge, presentation or host paths | None | None |

### Schema Tripwire (independent check)

`git diff f67b27d30..HEAD --name-only` lists 22 files: `PhysicsPaintStudio.tsx` + test, `useRotoTimelineActions.ts` + test, `physicsPaintStudio.css`, the play-script controller + test, the stacking module + test, LoopClipRail + test, PlayScriptCards, PlayScriptDialog + test, ScriptsPanel test, TrackRow + test, WorkflowStrip + test, LoopClip presentation + test, Workflow presentation + test. Filtering the list for `physicalModel|serializ|parser|schema|fingerprint|persist` returns no matches. `physicsPaintRotoPhysicalModel.ts` is untouched, no new stored field exists, and Standard is expressed purely by absent optional provenance — exactly as the plan requires.

### Scope Boundary

Plan-declared C2 scope (Reveal incoming on a non-Reveal destination, document-reference routing/refusal) is intentionally absent and is not a gap. Two non-blocking observations: the stack dialog's "one Standard Rail" helper is not shown for a Reveal destination because `RailTypeCard` is hidden in that stack mode (the merge still produces Standard, pinned at controller 4975-5013); and `replayRevealRail` has no production UI consumer, so the merged Replay reason is exposed through the presentation tooltip rather than an active button. Neither contradicts a PLAN truth.

### Human Verification Required

1. **Motion destination + Static run** — stack a Static script onto a Motion rail. Expected: one gray Standard Rail; row tooltip, rail tooltip ("Type: Standard") and Scripts panel all say Standard, never Motion/Static/Reveal.
2. **Static destination + Static run** — same gray Standard result and labels.
3. **Motion destination + Motion run** — same gray Standard result; the first rail's motion is no longer advertised as a Motion rail.
4. **Stack again on a Standard Rail** — apply another Motion or Static run to a merged rail; it stays Standard and gray and keeps its cycle/repeat options.
5. **Keep ON / Keep OFF** — Keep ON keeps the destination picture under the run after the merge and after repeating, nothing doubles; Keep OFF flattens.
6. **Cycle/repeat editing** — Edit Rail, change repeat and cycle length on the merged rail; both still work.
7. **Regenerate and Replay** — both unavailable with the merged-rail reason; key editing and per-key script editing still work.
8. **One Undo** — restores the original typed rail exactly (type, color, source script, reveal knobs for a reveal destination).
9. **Save then reopen** — still a gray Standard Rail with the same picture and blend.
10. **Typed-rail regression** — unstacked Motion stays purple, Static stays cyan, Reveal stays blue, each with its own Regenerate behavior; none shows Standard.

### Gaps Summary

No gaps. Every PLAN truth, artifact and key link is present, substantive, wired and backed by passing tests at HEAD; the schema tripwire is clean and the full suite and typecheck pass. The only remaining step is the live visible UAT above, which is the user's step per project convention.

---

_Verified: 2026-10-31T23:50:51Z_
_Verifier: Claude (gsd-verifier)_

## UAT result

Live UAT approved by the user on 2026-11-01 after the post-UAT picture-merge fix `28411564c` (run sheet composites over the destination's current cached picture; Keep OFF never purges). Rows 1–10 above passed live; Quick C1 is CLOSED.
