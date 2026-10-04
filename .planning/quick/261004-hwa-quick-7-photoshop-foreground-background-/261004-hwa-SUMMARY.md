---
phase: quick-261004-hwa
plan: 261004-hwa
subsystem: paint-ui
tags: [paint, color-swatch, shortcuts, preact-signals, photoshop-parity]

# Dependency graph
requires: []
provides:
  - "Session-only foreground/background swatch signals + swap/promote actions in paintStore"
  - "Photoshop-style two-square swatch rendered at the bottom of the left sidebar (paint context)"
  - "Sidebar InlineColorPicker picks now write the stacked-on-top (foreground) swatch"
  - "Bare X shortcut swaps fg/bg, gated by shouldSuppressShortcut → isFullscreen → isPaintEditMode"
affects: [paint, sidebar, keyboard-shortcuts]

# Actuals (#2632) — chars/4 over the realized diff
actuals:
  tokens: 3424
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-only swatch signals (foregroundColor / backgroundColorSwatch) — never persisted"
    - "brushColor as the single sync point: swap/promote write it, picker/hex/FX follow"

key-files:
  created:
    - app/src/components/sidebar/ForegroundBackgroundSwatch.tsx
    - app/src/stores/paintStore.fgBg.test.ts
  modified:
    - app/src/stores/paintStore.ts
    - app/src/components/layout/LeftPanel.tsx
    - app/src/components/layout/CanvasArea.tsx
    - app/src/lib/shortcuts.ts

key-decisions:
  - "Extracted setBrushColor's FX-refresh block into a shared _refreshFxForActiveFrame() helper so swap/promote mirror the proven refresh path without persisting (no saveBrushColor outside setBrushColor)"
  - "Back-swatch click ensures the inline picker is OPEN (never toggles it closed) so the promoted color is immediately editable — interpreting the plan's 'opens/toggles' in favor of its stated intent"
  - "Double-swap test asserts brushColor tracks the foreground slot rather than the pre-session brushColor, because brushColor starts from persisted prefs (#5B8BD4) while the fg slot defaults to #000000 per spec"
  - "Footer uses flex-shrink-0 with no auto margin so the PROPERTIES section (flex-grow, basis 0) absorbs the leftover height — no overflow clipping in the fixed-height sidebar"

patterns-established:
  - "PS-style fg/bg two-slot color model in EFX Paint: front = picker target, X = swap, back click = promote"

requirements-completed: [QUICK-261004-HWA]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Two-square Photoshop-style swatch (front black, back white) at the bottom of the left sidebar in paint context"
    requirement: QUICK-261004-HWA
    verification:
      - kind: unit
        ref: "app/src/stores/paintStore.fgBg.test.ts — 'starts with a black foreground and white background after reset'"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT: open a paint session, confirm swatch footer placement/PS layout"
        status: unknown
    human_judgment: true
    rationale: Visual placement and PS layout fidelity require live native UAT (no Chrome DevTools MCP per project rule)
  - id: D2
    description: "Sidebar InlineColorPicker picks write the foreground swatch; active color and picker target follow swap/promote"
    requirement: QUICK-261004-HWA
    verification:
      - kind: unit
        ref: "app/src/stores/paintStore.fgBg.test.ts — swap/promote/brushColor sync tests (8/8 pass)"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT: pick a color, confirm front swatch + hex labels update"
        status: unknown
    human_judgment: true
    rationale: End-to-end picker→swatch wiring is DOM behavior verified in live UAT
  - id: D3
    description: "Bare X in paint edit mode swaps fg/bg; suppressed in inputs, fullscreen, and outside paint mode"
    requirement: QUICK-261004-HWA
    verification:
      - kind: unit
        ref: "app/src/stores/paintStore.fgBg.test.ts — double-swap re-points brushColor (8/8 pass); grep gate: exactly one 'x': entry in shortcuts.ts"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT: press X in paint mode (swaps), in an input (typing works), outside paint mode (no-op)"
        status: unknown
    human_judgment: true
    rationale: Keystroke gating across live contexts (inputs, fullscreen) needs native UAT
  - id: D4
    description: "Clicking the back swatch promotes it to front and opens the picker for the promoted color"
    requirement: QUICK-261004-HWA
    verification:
      - kind: unit
        ref: "app/src/stores/paintStore.fgBg.test.ts — 'setActiveFromBackground promotes background to front...'"
        status: pass
      - kind: manual_procedural
        ref: "Native UAT: click back square, confirm promote + picker opens"
        status: unknown
    human_judgment: true
    rationale: Click routing and picker-open behavior is live DOM behavior
  - id: D5
    description: "No new picker and no new persistence — swatch state is session-only"
    requirement: QUICK-261004-HWA
    verification:
      - kind: unit
        ref: "app/src/stores/paintStore.fgBg.test.ts — 'swatch actions never persist; only setBrushColor writes brushColor preferences'"
        status: pass
      - kind: integration
        ref: "tsc --noEmit clean; full vitest run 4429 passed / 0 failed"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-10-04
status: complete
---

# Phase quick-261004-hwa: Photoshop Foreground/Background Swatch Summary

**Session-only PS-style fg/bg swatch (front black / back white) in the left sidebar footer, with picker→front sync, back-click promote, and a paint-edit-gated bare-X swap — 8/8 store tests + full suite green.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-04T11:32:05Z
- **Completed:** 2026-10-04T11:40Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- fg/bg swatch state in paintStore: `foregroundColor`/`backgroundColorSwatch` signals, `setForeground`/`swapFgBg`/`setActiveFromBackground` actions that re-point `brushColor` (single sync point for picker + hex labels + FX refresh) without ever persisting; `reset()` restores defaults
- `ForegroundBackgroundSwatch` component mounted as the LeftPanel footer under the exact paint-context gate that shows PaintProperties; front click toggles the existing inline picker, back click promotes + ensures the picker is open
- Bare `x` tinykeys binding following the `p` pen-tool pattern (suppress → fullscreen → isPaintEditMode gates); exactly one `x` entry in the shortcut map

## Task Commits

Each task was committed atomically:

1. **Task 1: paintStore fg/bg swatch state** - `050ce10e` (test) → `a4f9ee44` (feat)
2. **Task 2: swatch component + sidebar placement + picker sync** - `30d06f3e` (feat)
3. **Task 3: X key swap shortcut** - `126db86d` (feat)

**Plan head before:** `f268d6c7` — 4 commits measured (`git rev-list --count f268d6c7..HEAD`)

## Files Created/Modified
- `app/src/stores/paintStore.ts` — fg/bg signals + 3 actions; shared `_refreshFxForActiveFrame()` helper extracted from `setBrushColor`; `reset()` restores swatch defaults
- `app/src/stores/paintStore.fgBg.test.ts` — 8 tests: defaults, swap, double-swap, promote, picker isolation, no-persistence invariant, reset
- `app/src/components/sidebar/ForegroundBackgroundSwatch.tsx` — PS-layout overlapping squares (front top-left, back bottom-right), 1px border, tooltips
- `app/src/components/layout/LeftPanel.tsx` — swatch footer below PROPERTIES, paint-context gated
- `app/src/components/layout/CanvasArea.tsx` — InlineColorPicker onChange additionally calls `setForeground(color)` (live stroke update untouched)
- `app/src/lib/shortcuts.ts` — bare `'x'` binding → `paintStore.swapFgBg()`

## Decisions Made
- **brushColor is the sync point** — swap/promote assign `brushColor` directly (mirroring `setBrushColor`'s proven FX-refresh path, minus persistence), so picker/hex/FX consumers follow one write, as the plan's key_links prescribed.
- **Ensure-open on back-click** — the plan said the back square "opens/toggles" the picker; implemented as open-if-closed so the promoted color is *always* immediately editable (plan's stated intent wins over the toggle reading).
- **Double-swap assertion** — asserts `brushColor === foregroundColor` after two swaps rather than the pre-session `brushColor` value: after reset, `brushColor` is the persisted brush pref (`#5B8BD4`) while the fg slot is spec'd to default to `#000000`, so "returns to original brushColor" is unachievable under the plan's own must-haves. All original *swatch* colors still round-trip.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's double-swap test expectation contradicted its own defaults**
- **Found during:** Task 1 (RED phase)
- **Issue:** Plan asked the double-swap test to return "original brushColor", but must_have #1 fixes fg at `#000000` while `brushColor` initializes from persisted prefs (`#5B8BD4`) — the two differ at session start, so the assertion could never pass as written.
- **Fix:** Test asserts round-trip of both swatch signals plus the real invariant (`brushColor` tracks the active front slot after every swap). Store implementation unchanged — it follows must_have #3 literally.
- **Files modified:** app/src/stores/paintStore.fgBg.test.ts
- **Verification:** 8/8 pass
- **Committed in:** `a4f9ee44`

### Interpretation Notes (not bugs)

- Tests the plan scheduled for Tasks 2/3 (setForeground-doesn't-clobber, double-swap) were front-loaded into Task 1's RED commit so the whole store contract failed together — same coverage, earlier.
- Back-click "opens/toggles" resolved to "ensure open" (see Decisions).

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Test assertion only; all must_haves implemented as specified, no scope change.

## Issues Encountered
- Fresh worktree had no `node_modules`: ran `pnpm install --frozen-lockfile` (lockfile-identical, zero new packages — threat T-261004-hwa-SC respected) and built the `@efxlab/efx-physic-paint` workspace package so `tsc --noEmit` resolves its types. Environment setup only, no code impact.

## Verification Results
- `vitest run src/stores/paintStore.fgBg.test.ts` → **8/8 pass**
- `tsc --noEmit` → **clean**
- grep gate → exactly **1** `'x':` binding in shortcuts.ts
- Full suite `vitest run` → **236 files passed, 4429 tests passed** (0 failures; 2 skipped/101 todo pre-existing)
- **Native visual UAT pending (user):** swatch placement + PS layout, picker→front sync, X swap in/out of paint mode + typing X in inputs, back-click promote. No Chrome DevTools MCP used (project rule).

## User Setup Required
None — no external service configuration.

## Next Phase Readiness
Ready for native UAT of the 5 must_have rows. No blockers. No stubs, no TODOs left behind.

---
*Phase: quick-261004-hwa*
*Completed: 2026-10-04*

## Self-Check: PASSED

- All 6 files_created/modified exist on disk
- All 4 task commits found in git history (050ce10e, a4f9ee44, 30d06f3e, 126db86d)
- SUMMARY frontmatter carries `status: complete`
- No stubs / TODOs / placeholder values left in the diff
