---
phase: 42-playscript-application-modes-color-override
plan: 05
subsystem: ui
tags: [preact, signals, playscript, roto, dialog, radiogroup, css-grid]

# Dependency graph
requires:
  - phase: 42-playscript-application-modes-color-override (42-02/42-03)
    provides: controller/renderer two-mode generation with overrideColor input seam; dialog mode radiogroup, Motion sliders, loop readout, E5 surface
provides:
  - getBrushColor controller port — override color resolves live from Studio settings.color at confirm time, snapshotted per generation (D-08R/D-18)
  - revised Play Script dialog: D-16 card grid (Mode → Timing | Color → Motion wiggle → summary bar), two-state live brush-color control, Frames per cycle label with Max→1 normalization, fixed footer with progress
  - Studio wiring: brushColor live prop via playScriptDialogPropsMemo (settings.color dep) + getBrushColor port closure
  - dialog-scoped CSS: card chrome, summary bar, chip/hex/note; dead picker/swatch rules removed
affects: [42-04 Task 2 UAT (revised nine-step script targets this surface), phase-43 loop clips]

# Actuals (#2632) — pairs with the plan's `estimate` (90000 tokens) to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 18758
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Port-resolved live value with confirm-time snapshot (getBrushColor mirrors getMotion): read-only observe + snapshot, never dialog-side copies"
    - "APG radiogroup reuse: one segmented-control implementation shared by Mode and Color groups with per-group select handlers"
    - "Two-column card grid inside the existing light-surface token system; summary bar as full-width grid child before a fixed footer"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "Override color resolves ONLY via the getBrushColor port at confirm time; the dialog-side overrideColor signal was deleted (D-08R/D-10 — color never stored, enabled state remembered)"
  - "Malformed port values fall back to no override (Original-colors behavior) via a strict #rrggbb normalize guard (T-42-05-01)"
  - "Max→1 normalization on Static / Hold switch lives in the dialog's selectMode path so both click and arrow-key routes apply it; the controller D-15 first-time defaults are unaffected"
  - "MemoizedPhysicsPaintPlayScriptDialog left byte-identical — memo() infers props, and the Studio source-contract test pins its exact content"

patterns-established:
  - "Confirm-time snapshot of a live port value: later source changes never retroactively alter generated frames or the success-only summary"
  - "Segmented-control CSS shared across radiogroups (.physics-paint-play-script-mode-group/-option) rather than per-group duplicates"

requirements-completed: [PLAY-02, PLAY-03, PLAY-04]

# Coverage metadata (#1602) — deterministic UAT routing for verify-work.
coverage:
  - id: D1
    description: "Controller getBrushColor port: confirm-time live resolution, Original-colors null path, malformed-value fallback, first-open compose, no-retroactive snapshot"
    requirement: PLAY-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#resolves the override color from the getBrushColor port AT CONFIRM TIME"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#falls back to no override (Original-colors behavior) when the port returns a malformed color"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#keeps the confirm-time snapshot hex in the applied summary even when the port value changes afterwards"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dialog card grid + two-state live color control: structure, APG color radiogroup, live chip/hex from brushColor prop, Frames per cycle + Max→1, Reset defaults heading link, summary bar, E5 surface"
    requirement: PLAY-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#renders Mode first, Timing and Color as sibling cards, Motion wiggle with a heading Reset defaults, then the summary bar before the footer"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#checking 'Custom color' sets overrideEnabled and renders the CURRENT brushColor prop as chip + hex + note"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#normalizes 'Max' to '1' when switching to Static / Hold"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cycle-only generation and 42-02 renderer contract preserved; renderer byte-untouched; Repeat never multiplies frameCount"
    requirement: PLAY-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts#generates exactly the cycle value regardless of repeat or infinity"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts (15 tests)"
        status: pass
      - kind: other
        ref: "git diff --exit-code app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts (empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visual UAT of the revised dialog (card grid, live chip sync with right-panel picks, overflow contract at minimum window size)"
    requirement: PLAY-03
    verification: []
    human_judgment: true
    rationale: "Native visual/interaction verification is the user's domain (42-04 Task 2 UAT script rewritten for this surface); automated vnode tests cannot judge layout, overflow, or live visual sync"

# Metrics
duration: 29min
completed: 2026-08-06
status: complete
---

# Phase 42 Plan 05: PlayScript Dialog Revision — Card Grid and Live Brush-Color Control Summary

**Approved playscript-proposal UI adopted: D-16 card grid dialog with a two-state live brush-color control resolving through a confirm-time getBrushColor port snapshot, inline picker fully removed, cycle-only generation and the 42-02 renderer contract byte-preserved**

## Performance

- **Duration:** 29 min
- **Started:** 2026-08-06T08:24:39Z
- **Completed:** 2026-08-06T08:54:16Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Controller `getBrushColor` port: override color resolves live from Studio `settings.color` at confirm time, defensively normalized (`#rrggbb` strict, malformed → Original-colors fallback, T-42-05-01); the confirm-time snapshot never retroactively changes on later brush picks (D-08R/D-18)
- Dialog rebuilt to the approved card grid: Mode (full width) → Timing | Color side by side → Motion wiggle with `Reset defaults` heading link → Requested/Effective summary bar (`loopReadout` verbatim, tabular-nums, top-border separation); progress + Cancel/Generate in a fixed footer
- Two-state APG color radiogroup `Original colors` | `Custom color`: Original disables the override; Custom renders the live `brushColor` prop as chip + hex + `Picked from the app's brush color panel` — no dialog-side color copy, no picker, no pick-guard, no new store/event/DOM query
- `Frames per cycle` label in Static / Hold with `Max`→`1` normalization on mode switch (click and arrow keys); Repeat + Infinity render in the Timing card in both modes as loop intent only — generation count remains the frame field alone (D-02/D-14)
- Inline picker removed end-to-end: `InlineColorPicker` import/mount, pick-guard state, `overrideColor` signal, picker-guard tests, and dead CSS (swatch/override-row/picker-well/motion-reset) all deleted; `InlineColorPicker.tsx` itself untouched
- Full wave gate green: 1163 app tests passed, 17 package animation tests passed, typecheck clean, renderer diff empty

## Task Commits

Each task was committed atomically (TDD: RED test gate → GREEN implementation):

1. **Task 1 RED: port-driven brush-color override tests** — `ac3bf96a` (test)
2. **Task 1 GREEN: controller getBrushColor port** — `0e2ddc40` (feat)
3. **Task 2 RED: rewritten dialog tests for card grid + live color control** — `06b49d7d` (test)
4. **Task 2 GREEN: dialog card grid + two-state color control + Studio wiring + scoped CSS** — `4ac1ea5f` (feat)

**Plan metadata:** recorded in the final docs commit (SUMMARY/STATE/ROADMAP/REQUIREMENTS)

## Files Created/Modified
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `getBrushColor` port; `resolveOverrideColor()` single resolution path + `normalizeBrushColor` guard; `overrideColor` signal removed
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — port-driven confirm/summary/snapshot/malformed-fallback cases; legacy-signal case converted to a no-signal contract
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` — forwards `getBrushColor` via portsRef (getMotion pattern)
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts` — port factory + proxy assertion for `getBrushColor`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — card grid, color radiogroup + live chip/hex panes, label logic + Max→1 normalization, summary bar, fixed footer; picker removed
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` — rewritten (a)–(j) cases; picker-guard cases deleted
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `getBrushColor: () => settings.color` port; `brushColor` prop with `settings.color` memo dep
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — dialog memo deps assertion updated for the deliberate `settings.color` dep
- `app/src/components/physic-paint/physicsPaintStudio.css` — card grid/chrome, summary bar, chip/hex/note, footer; dead picker/swatch rules removed (`.physics-paint-play-script-*` scope only)

## Decisions Made
- `overrideColor` signal deleted in Task 2 (Task 1 kept it for typecheck continuity per plan); the port is the only resolution path and the color is never stored (D-10)
- Max→1 normalization placed in the dialog's shared `selectMode` so click and arrow-key routes behave identically; controller D-15 first-time defaults remain the session-defaults authority
- Summary bar styled 12px secondary per the plan's action spec (UI-SPEC typography table lists the readout under Body 16px — plan-level spec followed; flagged as a doc inconsistency below)
- `MemoizedPhysicsPaintPlayScriptDialog` unchanged: `memo()` infers props and the Studio source-contract test pins its exact content — the `brushColor` prop flows without edits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated Studio source-contract test for the new memo dep**
- **Found during:** Task 2 (Studio wiring)
- **Issue:** `PhysicsPaintStudio.test.ts` asserted the exact deps string `[rotoPlayScript, playButtonRef]`; the plan-mandated `settings.color` dep broke that exact-substring assertion
- **Fix:** Updated the assertion to `[rotoPlayScript, playButtonRef, settings.color]` plus a `brushColor: settings.color` presence check, with a comment recording that the dep is deliberate while frame-only invalidators stay excluded
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.test.ts
- **Verification:** PhysicsPaintStudio.test.ts (25 tests) green
- **Committed in:** `4ac1ea5f` (part of Task 2 commit)

**2. [Rule 3 - Blocking] Hook test port factory gained getBrushColor**
- **Found during:** Task 1 (GREEN typecheck gate)
- **Issue:** Adding the required port to `RotoPlayScriptControllerPorts` made the hook test's `ports()` factory fail the typecheck gate
- **Fix:** Added `getBrushColor` to the factory and a proxy assertion mirroring `getMotion`
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPlayScriptController.test.ts
- **Verification:** useRotoPlayScriptController.test.ts green; `pnpm --dir app typecheck` exits 0
- **Committed in:** `0e2ddc40` (part of Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking, test-harness alignment for the new port/dep)
**Impact on plan:** No scope creep — both fixes are mechanical alignments of existing source-contract/harness tests with the plan-mandated port and prop wiring.

## Issues Encountered
- UI-SPEC typography table lists the summary-bar readout as Body 16px while the plan action specifies 12px secondary. Followed the plan (execution authority); the summary bar renders at 12px/400/tabular-nums with top-border separation. Documented here for a future UI-SPEC touch-up — no runtime impact.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED
- FOUND: app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
- FOUND: app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
- FOUND: commit ac3bf96a (Task 1 RED)
- FOUND: commit 0e2ddc40 (Task 1 GREEN)
- FOUND: commit 06b49d7d (Task 2 RED)
- FOUND: commit 4ac1ea5f (Task 2 GREEN)
- Renderer byte-untouched verified (git diff --exit-code empty)
- Full app suite (1163 passed), package animation tests (17 passed), typecheck — all exit 0

## Next Phase Readiness
- 42-04 Task 2 (native UAT, wave 6) can run its revised nine-step script against this surface: color toggle + live chip/hex sync, card grid, summary bar, overflow contract at minimum window size
- Dialog trigger guards unchanged (D-17): Scripts-panel toolbar action remains the sole entry point; no auto-open, no demo trigger
- No blockers

---
*Phase: 42-playscript-application-modes-color-override*
*Completed: 2026-08-06*
