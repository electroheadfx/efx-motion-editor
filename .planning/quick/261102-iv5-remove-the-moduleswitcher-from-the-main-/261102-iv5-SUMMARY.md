---
phase: 261102-iv5-remove-the-moduleswitcher-from-the-main-
plan: 01
subsystem: ui
tags: [toolbar, module-switcher, watercolor, krita, source-scan, v2.0.0]
requires:
  - phase: 56-efx-watercolor
    provides: single-engine Water color module and the shared activeModule signal
provides:
  - editor Toolbar with no module switcher and no Krita slot
  - ModuleSwitcher component and its two test files deleted
  - Studio stylesheet without dead .module-switcher rules
  - source-scan regression pin for the editor top bar
  - v2.0.0 docs stating ONE Water color engine and Krita neither implemented nor planned
affects: [v2.0.0 signed release, README, ROADMAP, milestone audit, REQUIREMENTS]
actuals:
  tokens: 2468
  tasks: 2
  commits: 2
plan_head_before: 9454ef349e82e75dc76594426132fb40886f60fa
plan_head_after: f21dcd3f10d1f82178387951248017b755d36203
tech-stack:
  added: []
  patterns:
    - "Comment-stripped source-scan pin for absent UI surfaces (PhysicsPaintTopBar.test.ts idiom)"
key-files:
  created:
    - app/src/components/layout/Toolbar.noModuleSwitcher.test.ts
  modified:
    - app/src/components/layout/Toolbar.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - README.md
    - .planning/ROADMAP.md
    - .planning/v2.0.0-MILESTONE-AUDIT.md
    - .planning/REQUIREMENTS.md
  deleted:
    - app/src/components/shared/ModuleSwitcher.tsx
    - app/src/components/shared/ModuleSwitcher.test.tsx
    - app/src/components/shared/ModuleSwitcher.test.tsx.test.ts
key-decisions:
  - "The editor top bar ships without a module switcher; the switcher belonged to the Studio, never the editor."
  - "Krita is neither implemented nor planned; the placeholder and its switcher slot are gone, and the product ships ONE Water color engine/module."
  - "activeModule / setActiveModule / frameModuleLock / Studio engine gates stay untouched — only the shared switcher component was deleted."
  - "No release artifact or version surface changed; the signed v2.0.0 release must be re-run."
patterns-established:
  - "Source-scan pin: strip comments, scan Toolbar.tsx + physicsPaintStudio.css, and existsSync the deleted component/tests so the switcher cannot return."
requirements-completed: [QUICK-261102-IV5]
coverage:
  - id: D1
    description: "The editor Toolbar imports and mounts no ModuleSwitcher, carries no module-switcher class, and names no Krita label."
    requirement: QUICK-261102-IV5
    verification:
      - kind: unit
        ref: "app/src/components/layout/Toolbar.noModuleSwitcher.test.ts#261102-iv5 editor Toolbar has no module switcher"
        status: pass
    human_judgment: false
  - id: D2
    description: "ModuleSwitcher.tsx and both of its test files are deleted; the Studio stylesheet has no .module-switcher rules and keeps the segmented family."
    requirement: QUICK-261102-IV5
    verification:
      - kind: unit
        ref: "app/src/components/layout/Toolbar.noModuleSwitcher.test.ts#the shared switcher component and both of its tests are gone"
        status: pass
    human_judgment: false
  - id: D3
    description: "README, ROADMAP, the v2.0.0 milestone audit, and REQUIREMENTS state ONE Water color engine/module, no module switcher, and Krita neither implemented nor planned."
    requirement: QUICK-261102-IV5
    verification:
      - kind: other
        ref: "for f in README.md .planning/ROADMAP.md .planning/v2.0.0-MILESTONE-AUDIT.md .planning/REQUIREMENTS.md; do grep -q \"neither implemented nor planned\" \"$f\" || exit 1; done && test -z \"$(grep -nE 'inert v2\\.1\\.0 slot|Krita is the v2\\.1\\.0 slot|Module switch \\(Water color / Krita\\)|ModuleSwitcher.*activeModule.*panels' README.md .planning/ROADMAP.md .planning/v2.0.0-MILESTONE-AUDIT.md .planning/REQUIREMENTS.md || true)\""
        status: pass
    human_judgment: false
  - id: D4
    description: "The packaged editor top bar shows no 'Water colorKrita' run, no orphan gap or divider, and ThemeSwitcher plus the rest of the toolbar are unchanged."
    verification: []
    human_judgment: true
    rationale: "Visual packaged-build confirmation is the user's live UAT step; the automated pin proves the source surface only."
duration: 3min
completed: 2026-11-02
status: complete
---

# Phase 261102-iv5 Plan 01: Remove the editor module switcher Summary

**The editor top bar now ships with no ModuleSwitcher and no Krita placeholder; a comment-stripped source pin guards the absence and all four v2.0.0 docs describe ONE Water color engine with Krita neither implemented nor planned.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-02T12:39:23Z
- **Completed:** 2026-11-02T12:42:37Z
- **Tasks:** 2
- **Files modified:** 10 (3 created/modified code, 3 deleted code, 4 docs)

## Accomplishments

- Removed the `ModuleSwitcher` import, mount, stale 56-02 comment, and orphan separator from `Toolbar.tsx`; `ThemeSwitcher` and the flex spacer are unchanged.
- Deleted `ModuleSwitcher.tsx` and both of its test files; no production import remains, so typecheck stays clean.
- Removed the dead `.module-switcher` block from `physicsPaintStudio.css` (64 lines) while keeping `.physics-paint-segmented-row` and the `.physics-paint-segmented-button` family used by PaperPicker.
- Added `Toolbar.noModuleSwitcher.test.ts`, a comment-stripped source-scan pin that fails if the import, mount, class token, Krita label, component files, or dead CSS return.
- Corrected README, ROADMAP, the v2.0.0 milestone audit, and REQUIREMENTS to one consistent single-engine claim: ONE Water color engine/module, no module switcher, Krita neither implemented nor planned.

## TDD Evidence (Task 1)

**RED** — created the pin first and ran it against the pre-fix tree:

- Command: `pnpm --dir app exec vitest run src/components/layout/Toolbar.noModuleSwitcher.test.ts`
- Result: `Tests 3 failed | 1 passed (4)` — the target assertions failed as planned:
  - `Toolbar.tsx imports and mounts no ModuleSwitcher`
  - `the shared switcher component and both of its tests are gone`
  - `the Studio stylesheet drops .module-switcher but keeps the segmented family`
- The fourth case (no Krita label in Toolbar) passed from the start and remains a guard.
- Semantic assessment: the failures are the planned absent-surface assertions, not setup or discovery faults.

**GREEN** — after the Toolbar edit, the three deletions, and the CSS cleanup:

- Same command: `4 passed (4)`.
- Targeted suites with the existing Studio no-switcher pins: `3 files / 46 tests passed`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the editor module switcher, delete the component, clean the dead CSS, and pin its absence** — `5c24b5df4` (refactor)
2. **Task 2: Correct the v2.0.0 docs to ONE Water color engine with no switcher and no Krita placeholder** — `f21dcd3f1` (docs)

**Plan metadata:** the SUMMARY/STATE/PLAN artifact commit is left to the orchestrator.

## Files Created/Modified

- `app/src/components/layout/Toolbar.tsx` — dropped the `ModuleSwitcher` import and the separator/comment/mount block; `ThemeSwitcher` and the flex spacer remain.
- `app/src/components/layout/Toolbar.noModuleSwitcher.test.ts` — new source-scan pin (Toolbar source, CSS selectors, deleted file existence).
- `app/src/components/shared/ModuleSwitcher.tsx` — deleted.
- `app/src/components/shared/ModuleSwitcher.test.tsx` — deleted.
- `app/src/components/shared/ModuleSwitcher.test.tsx.test.ts` — deleted.
- `app/src/components/physic-paint/physicsPaintStudio.css` — removed the `.module-switcher*` block; reworded the left-cluster comment to name the 15px brush-trigger margin; segmented family kept.
- `README.md` — v2.0.0 Studio row and release paragraph.
- `.planning/ROADMAP.md` — milestone goal shipped note, shipped shape, Krita planning sentence, Phase 56 checklist, Success Criterion 4 supersession.
- `.planning/v2.0.0-MILESTONE-AUDIT.md` — accepted-quirk reason, milestone goal shipped note, MOD requirement rows, integration row (moved to SUPERSEDED), E2E flow.
- `.planning/REQUIREMENTS.md` — Shared Studio heading, MOD-01/MOD-02/MOD-06, close-out table, KRT future section, out-of-scope row, traceability notes.

## Decisions Made

- The switcher was a Studio-scope idea that leaked into the editor; only the shared component and its editor mount were removed. `activeModule` / `setActiveModule` / `activeModule.test.ts`, `frameModuleLock.ts`, Studio engine gates, engine ids, and the defensive `'efx-krita'` refusal label are intentionally untouched.
- Documentation corrections are scoped to the four release-facing surfaces; historical phase artifacts under `.planning/phases/56-*` and the 56-02 plan-list title remain as written.
- No version surface, release artifact, or `efx-motion-release` skill change; the product version stays 2.0.0 pending the re-run of the signed release.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- The zsh glob form of an early `grep --include=*.ts` probe failed (`no matches found`); re-run with quoted include patterns, no code impact.
- `gsd_run` was not on PATH; the project-local `.claude/gsd-core/bin/gsd_run` was used.

## Gates

- Targeted: `pnpm --dir app exec vitest run src/components/layout/Toolbar.noModuleSwitcher.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts` — 3 files / 46 tests passed.
- Full app suite: `pnpm --dir app exec vitest run` — 366 passed | 2 skipped files; 7010 passed | 1 skipped | 96 todo tests.
- Typecheck: `pnpm --dir app run typecheck` — exit 0.
- Build: `pnpm build` — green; main chunk 1,586.33 kB (under the 2 MB ceiling).
- Documentation gate: exit 0; every doc carries "neither implemented nor planned" and the stale-claim grep is empty.
- The dev server was never started (project rule).

## Known Stubs

None.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or trust-boundary surface was introduced. The removal shrinks the shipped UI surface and the new pin guards reintroduction.

## Next Phase Readiness

- This is a v2.0.0 pre-publish fix. Re-run the signed release after merge; the product version stays 2.0.0.
- Live visual UAT remains the user's step: confirm the packaged editor top bar has no "Water colorKrita" run and no orphan gap, and that `ThemeSwitcher` and the rest of the toolbar are unchanged.

---
*Phase: 261102-iv5-remove-the-moduleswitcher-from-the-main-*
*Completed: 2026-11-02*

## Self-Check: PASSED

- Created: `app/src/components/layout/Toolbar.noModuleSwitcher.test.ts` — FOUND
- Deleted: `app/src/components/shared/ModuleSwitcher.tsx` — ABSENT
- Deleted: `app/src/components/shared/ModuleSwitcher.test.tsx` — ABSENT
- Deleted: `app/src/components/shared/ModuleSwitcher.test.tsx.test.ts` — ABSENT
- Summary: `261102-iv5-SUMMARY.md` — FOUND
- Commit `5c24b5df4` — FOUND (ancestor of HEAD)
- Commit `f21dcd3f1` — FOUND (ancestor of HEAD)
