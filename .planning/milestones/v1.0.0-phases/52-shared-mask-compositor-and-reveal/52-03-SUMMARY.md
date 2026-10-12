---
phase: 52-shared-mask-compositor-and-reveal
plan: 03
subsystem: ui
tags: [reveal, rail-surface, override-color, tooltip-freshness, replay-disabled-reason, preact-signals]

# Dependency graph
requires:
  - phase: 52-shared-mask-compositor-and-reveal (52-01)
    provides: reveal rail (railKind 'reveal' on PhysicPaintRotoLoopClip), bake, undo-by-reference
  - phase: 52-shared-mask-compositor-and-reveal (52-02)
    provides: mode-free PhotoReferenceTrack schema (D-15)
provides:
  - Reveal rail line color (emerald #10b981 motion / teal #14b8a6 static) via the Loop Clip overrideColor mechanism (D-22)
  - Reveal rail tooltip freshness line (D-23): 'baked from current script & reference' vs 'stale — script or reference changed since bake, Replay to refresh'
  - Reveal rail Replay disabled reason (D-24): 'Replay unavailable — no reference placed.' / 'Replay unavailable — script deleted.'
affects: [52-04, 52-05, verify-work]

# Actuals (#2632) — pairs with the plan's `estimate` (15000 tokens, low confidence).
actuals:
  tokens: 5500    # chars/4 over the realized diff (21882 chars)
  tasks: 2        # tasks completed
  commits: 2      # commits made (one per task)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OverrideColor-driven rail line: the rail target sets --rail-color/--rail-color-hover CSS variables from the presentation's overrideColor; reveal rules win over the playscript mode rules by specificity (one color system, not two)"
    - "Freshness honesty: a reveal bake is fresh ONLY when synchronized AND the script exists AND the reference is placed — a stale bake is never presented as fresh (D-23 prohibition)"
    - "Fail-closed Replay: the disabled reason mirrors regenerateDisabledReasonFor; the red unresolved state stays EXCLUSIVELY for the fail-closed cases (D-24)"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts

key-decisions:
  - "The reveal rail's variant color is the DEFAULT overrideColor in the presentation (emerald motion / teal static when the clip's overrideColor is null), overridable per rail via the existing 43-06 mechanism — no second color system."
  - "The rail line color rides CSS variables set on the rail target from the presentation's overrideColor; reveal-specific rules win over the playscript mode rules by specificity, keeping the existing mode/selected/unresolved rules byte-identical."
  - "The freshness line is appended AFTER the Status line in the same tooltipLines array (no new rendering path); the Replay disabled reason rides the same array so the rail target surfaces it on hover."
  - "The presentation gains referencePlaced/scriptExists options (the reference and script-library state it cannot see on its own); the Studio caller passes them from the document and the script library."

patterns-established:
  - "Pattern 1: OverrideColor-driven rail line — the presentation carries the effective overrideColor (variant default for reveal rails), the rail target sets CSS variables, and the CSS uses them with the playscript colors as fallbacks."
  - "Pattern 2: Freshness honesty — fresh only when synchronized AND script exists AND reference placed; a stale bake is never presented as fresh (D-23 prohibition)."
  - "Pattern 3: Fail-closed Replay — the disabled reason mirrors regenerateDisabledReasonFor; the red unresolved state stays EXCLUSIVELY for the fail-closed cases (D-24)."

requirements-completed: [RVL-04]

coverage:
  - id: D1
    description: "The reveal rail renders with the green-family line color — emerald #10b981 for reveal/motion, teal #14b8a6 for reveal/static — inheriting the Loop Clip overrideColor mechanism (D-22); the variant color is the default overrideColor, overridable per rail"
    requirement: RVL-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#defaults the reveal rail line color to the variant color (D-22)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#honors a per-rail overrideColor over the variant default (D-22)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The reveal rail carries the 20x4px lifecycle status dot (existing synchronizationDot path) and a tooltip freshness line appended after the Status line (D-23); a stale bake is never presented as fresh"
    requirement: RVL-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#appends the freshness line after the Status line (D-23)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#never presents a stale reveal bake as fresh (D-23 prohibition)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The reveal rail's Replay reuses the Loop Clip Regenerate control pattern with a regenerateDisabledReason-style disabled reason when it cannot run (no placed reference / script deleted); the red unresolved state stays EXCLUSIVELY for the fail-closed cases (D-24)"
    requirement: RVL-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#computes the Replay disabled reason for the fail-closed cases (D-24)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts#leaves Replay enabled for fresh and stale-but-replayable reveal rails (D-24)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-09-02
status: complete
---

# Phase 52 Plan 3: Reveal Rail Surface — Color, Status Dot, Tooltip Freshness, and Replay Control Summary

**The reveal rail's locked visual identity on the existing Loop Clip rail surface: green-family line color (emerald motion / teal static) via the overrideColor mechanism, the 20x4px lifecycle status dot, a tooltip freshness line, and a Replay control reusing the Regenerate pattern with a fail-closed disabled reason**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-02T14:55:00Z
- **Completed:** 2026-09-02T15:10:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- The reveal rail renders with the green-family line color (D-22): emerald `#10b981` for `reveal/motion`, teal `#14b8a6` for `reveal/static`, with hover shades emerald-300 `#6ee7b7` / teal-300 `#5eead4` per the UI-SPEC. The variant color is the DEFAULT `overrideColor` in the presentation — a reveal rail with `overrideColor: null` renders the variant color, overridable per rail via the existing 43-06 mechanism. No second color system: the rail target sets `--rail-color`/`--rail-color-hover` CSS variables from the presentation's `overrideColor`, and reveal-specific rules win over the playscript mode rules by specificity while the existing mode/selected/unresolved rules stay byte-identical.
- The reveal rail carries the existing 20x4px lifecycle status dot (D-23) — the `presentation.synchronizationDot` path, no new dot.
- The tooltip freshness line (D-23) is appended AFTER the `Status:` line in the same `tooltipLines` array (no new rendering path): "baked from current script & reference" when fresh, "stale — script or reference changed since bake, Replay to refresh" when stale. The freshness honestly reflects the bake state — fresh ONLY when synchronized AND the script exists AND the reference is placed, so a stale bake is never presented as fresh (D-23 prohibition).
- The Replay control reuses the Loop Clip Regenerate pattern (D-24): the presentation computes a `regenerateDisabledReason`-style `replayDisabledReason` mirroring `regenerateDisabledReasonFor` — "Replay unavailable — no reference placed." (D-12) and "Replay unavailable — script deleted." (D-13) — surfaced on the rail target via the same tooltipLines array and the accessible name. No new custom button. The red unresolved state stays EXCLUSIVELY for the fail-closed cases: a reveal rail with a Replay disabled reason paints the shared unresolved red, never a normal pending state.
- The presentation projection gains `railKind`, `overrideColor`, `freshnessLine`, and `replayDisabledReason` plus the `referencePlaced`/`scriptExists` options; the Studio caller passes the reference and script-library state the presentation cannot see on its own.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reveal rail color + status dot + tooltip freshness (D-22/D-23)** - `9f03179a` (feat)
2. **Task 2: Replay control reusing the Loop Clip Regenerate pattern (D-24)** - `69c2bf00` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` - Added `railKind`/`overrideColor`/`freshnessLine`/`replayDisabledReason` to the presentation; the reveal rail's variant color is the DEFAULT overrideColor (emerald/teal), the freshness line is appended after the Status line, and `replayDisabledReasonFor` mirrors `regenerateDisabledReasonFor`; added the `referencePlaced`/`scriptExists` options and the reveal color/freshness/disabled-reason constants.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` - Added the `rail-kind-reveal` class, the `--rail-color`/`--rail-color-hover` CSS variables from the presentation's overrideColor, and the `unresolved` class for reveal rails with a Replay disabled reason (fail-closed cases only).
- `app/src/components/physic-paint/physicsPaintStudio.css` - Added the reveal rail green-family rules (emerald/teal base + hover, shared selected/unresolved colors) that win over the playscript mode rules by specificity; the existing playscript rules are byte-identical.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - The `loopPresentations` memo now passes `referencePlaced` (from the document's photoReference) and `scriptExists` (from the script library rows) to the presentation projection.
- `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` - 7 new tests: variant color default, per-rail overrideColor, freshness line placement, freshness honesty (D-23 prohibition), Replay disabled reason for the fail-closed cases, Replay enabled for fresh/stale rails, and playscript rails free of the reveal surface.

## Decisions Made

- The reveal rail's variant color is the DEFAULT overrideColor in the presentation (emerald motion / teal static when the clip's overrideColor is null), overridable per rail via the existing 43-06 mechanism — no second color system (D-22).
- The rail line color rides CSS variables set on the rail target from the presentation's overrideColor; reveal-specific rules win over the playscript mode rules by specificity, keeping the existing mode/selected/unresolved rules byte-identical (the existing tests assert the exact `background: #06b6d4`-style substrings, so the playscript rules were NOT rewritten to use variables).
- The freshness line is appended AFTER the Status line in the same tooltipLines array (no new rendering path); the Replay disabled reason rides the same array so the rail target surfaces it on hover (D-23/D-24).
- The presentation gains `referencePlaced`/`scriptExists` options — the reference and script-library state it cannot see on its own; the Studio caller passes them from the document and the script library.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The presentation cannot compute the Replay disabled reason without the reference/script state**
- **Found during:** Task 2 (Replay control)
- **Issue:** The plan says the disabled reason is computed in `physicsPaintLoopClipPresentation.ts`, but the projection only receives `range` + `clip` — it cannot see whether the photo reference is placed (document-level) or whether the library script still exists (library-level). The reveal rail's clip always carries a `scriptId`, so the lifecycle alone cannot distinguish "no reference placed" from "script deleted".
- **Fix:** Added `referencePlaced`/`scriptExists` options to `PhysicsPaintLoopClipPresentationOptions` and updated the Studio caller (`loopPresentations` memo) to pass them from `getEfxPaintDocument(layerId)?.photoReference` and the script library rows.
- **Files modified:** `physicsPaintLoopClipPresentation.ts`, `PhysicsPaintStudio.tsx`
- **Verification:** Full suite green (3350 passed); typecheck clean.
- **Committed in:** 9f03179a (Task 1 commit — the options are shared by the freshness line) and 69c2bf00 (Task 2 commit)

**2. [Rule 3 - Blocking] The CSS-variable rewrite of the playscript rail rules broke existing color assertions**
- **Found during:** Task 1 (color)
- **Issue:** The first color approach rewrote the playscript mode/hover rules to `background: var(--rail-color, #06b6d4)`-style fallbacks. Existing tests assert the exact `background: #06b6d4` substring (e.g. `PhysicsPaintLoopClipRail.test.tsx:1636`), which fails because the rule text is now `background: var(--rail-color, #06b6d4)`.
- **Fix:** Kept the existing playscript rules byte-identical and added reveal-specific rules (`.rail-kind-reveal.mode-progressive/.mode-static` base + hover + selected + unresolved + action-linked) that win over the playscript mode rules by specificity. The rail target sets `--rail-color`/`--rail-color-hover` only for reveal rails, so playscript rail behavior is unchanged.
- **Files modified:** `physicsPaintStudio.css`, `PhysicsPaintLoopClipRail.tsx`
- **Verification:** Full suite green (3350 passed); typecheck clean.
- **Committed in:** 9f03179a (Task 1 commit)

**3. [Plan verify command path] The plan's verify command path is wrong relative to the vitest root**
- **Found during:** Task 1 verification
- **Issue:** The plan's `<verify>` command `pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` fails with "No test files found" — the vitest root is `app/` and the filter must be relative to it.
- **Fix:** Used the correct equivalent `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts` (22 tests pass).
- **Verification:** Reveal test file green; full suite green.
- **Committed in:** n/a (command-only deviation)

---

**Total deviations:** 3 (2 auto-fixed Rule 3 blocking issues, 1 command-path deviation)
**Impact on plan:** All auto-fixes were necessary consequences of the reveal rail surface — no scope creep. The command-path deviation is a plan-authoring artifact, not a code issue.

## Issues Encountered

- The plan's verify command path (`app/src/...`) is wrong relative to the vitest root (`app/`); the correct equivalent (`src/...`) passes. Same deviation as 52-02.
- The first color approach (rewriting the playscript rail rules to CSS-variable fallbacks) broke existing tests that assert exact color substrings; switched to reveal-specific rules that win by specificity, keeping the playscript rules byte-identical.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The reveal rail surface is proven: green-family line color via the overrideColor mechanism, the lifecycle status dot, the tooltip freshness line, and the Replay disabled reason surfaced on the rail target.
- Ready for the horizontal expansion plans (52-04..52-05): the "Reveal with script…" modal entry and the RVL-05 token allow-list leak contract.
- The `replayDisabledReason` is computed and surfaced; the actual Replay action wiring (the dialog's Regenerate button → `replayRevealRail`) lands in a later plan.

## Self-Check: PASSED

- FOUND: `.planning/phases/52-shared-mask-compositor-and-reveal/52-03-SUMMARY.md`
- FOUND: `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts`
- FOUND: commit `9f03179a` (Task 1)
- FOUND: commit `69c2bf00` (Task 2)

---
*Phase: 52-shared-mask-compositor-and-reveal*
*Completed: 2026-09-02*
