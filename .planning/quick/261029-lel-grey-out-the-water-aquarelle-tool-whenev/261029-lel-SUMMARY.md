---
phase: 261029-lel
plan: 01
subsystem: ui
tags: [preact, signals, physics-paint, watercolor, vitest, source-pins]

# Dependency graph
requires:
  - "56 engine (WatercolorEngine wetPeak / wetUntil / fixTimer)"
  - "261029 Studio tool shortcuts (B / W / E / P dispatch)"
provides:
  - "Engine.hasStandingWater getter + pure isSheetWet/WET_THRESHOLD module (package)"
  - "aquarelleHasWetPaint host signal published from the live rAF tick while !painting"
  - "Left rail Water entry disabled + click-guarded + retitled while the sheet is dry"
  - "Four-tool row Water entry disabled + click-guarded (contract parity; not mounted in app source)"
  - "W shortcut silent no-op while the gate is closed (B / E / P untouched)"
  - "Water -> Brush fallback on the true -> false transition"
affects: [physics-paint-ui, watercolor-rail, studio-keyboard]

# Actuals (#2632) — same estimateTokens scale as the plan estimate (chars/4).
actuals:
  tokens: 7696         # chars/4 over the realized diff (30,783 chars, 12 files)
  tasks: 3
  commits: 3
  plan_head_before: 5e14096bb421d84c7056f2c2d8915ce4e7c11c4d
  plan_head_after: 5a35055cd30b9066f9d660c05c4f7b1cde6544e6

tech-stack:
  added: []
  patterns:
    - "Package-level pure predicate (wetState.ts) keeps the engine threshold in ONE place"
    - "Host UI signal published only from the live canvas layer's rAF tick, guarded by !painting"
    - "Stable module-level probe function in the keyboard state (never a peeked boolean)"
    - "Source-pin suites strip comments before negative scans"

key-files:
  created:
    - packages/efx-watercolor/src/playground/wetState.ts
    - packages/efx-watercolor/src/playground/wetState.test.ts
    - app/src/components/physic-paint/view/aquarelleWetPaintGate.ts
    - app/src/components/physic-paint/view/aquarelleWetPaintGate.test.ts
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
    - app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "The wet truth is Engine.hasStandingWater (wetPeak > WET_THRESHOLD, not fixing, before wetUntil()) — Engine.isAwake is explicitly rejected"
  - "Sampled once per live rAF tick in AquarelleCanvasLayer only while painting === false, so the gate can never flip mid-stroke"
  - "setAquarelleHasWetPaint is compare-then-write and drops an active Water tool to Brush on the true -> false transition only"
  - "clearAquarelleWetPaint (teardown) flips the gate without the tool fallback — a remount must not re-home the user's tool"
  - "The W shortcut carries a stable probe function (canSelectWater) in the keyboard state, never a boolean captured in a render body"

patterns-established:
  - "A gate fed by engine truth lives in its own module store, published from the live layer, consumed by rail + row + dispatch"
  - "Wiring literals pinned by source scan so a future edit cannot silently drop a surface from the gate"

requirements-completed:
  - WATER-GATE-ENGINE
  - WATER-GATE-SIGNAL
  - WATER-GATE-RAIL
  - WATER-GATE-ROW
  - WATER-GATE-SHORTCUT
  - WATER-FEASIBILITY-NOTE

# Metrics
duration: 9 min
completed: 2026-10-29
status: complete
---

# Quick 261029-lel Plan 01: Grey out the Water tool when the sheet has no wet paint

**One engine-backed `hasStandingWater` truth, published from the live rAF tick, greys the Water tool on the left rail, the four-tool row and the W shortcut — and nowhere else**

## Performance

- **Duration:** ~9 min (plan-load to full-suite gate)
- **Started:** 2026-10-29T14:30Z (approx.)
- **Completed:** 2026-10-29T14:35Z
- **Tasks:** 3/3
- **Files modified:** 12 (409 insertions, 22 deletions)

## Accomplishments

- The package now owns the "standing water" truth: `wetState.ts` (`WET_THRESHOLD` + pure `isSheetWet`) and `Engine.hasStandingWater` (`wetPeak` above threshold, not fixing, before `wetUntil()`); the local `WET_THRESHOLD` in `Engine.ts` was deleted so the constant has one home.
- A new `aquarelleHasWetPaint` host signal is published from the ONE place that holds the live engine — the `AquarelleCanvasLayer` rAF tick — guarded by `!painting`; it is also cleared on engine teardown.
- The left rail's Water entry is disabled, click-guarded and retitled `Water (W) — needs standing water` while the sheet is dry; the four-tool row applies the same contract (it is not mounted in app source — contract parity only); Brush / Pen / Eraser keep their exact prior `disabled` semantics.
- The W shortcut is a silent no-op while the gate is closed (the key is still consumed); B / E / P never consult the gate.
- When standing water disappears while Water is the active tool, the active tool falls back to Brush in the same compare-then-write transition.

## Locked signal decision (verbatim from the plan)

The wet signal is the NEW `Engine.hasStandingWater` getter backed by `wetPeak`/`wetUntil()`, with `fixTimer > 0` excluded; it is sampled once per live rAF tick in `AquarelleCanvasLayer` while `painting === false`; `isAwake()` is explicitly rejected as the wet truth.

`Engine.isAwake` stays what it always was — "does the simulation need frames" — and remains true during the Dry fix bake, the post-stroke min-awake window and an in-flight stroke. It is never used as the wet truth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `canSelectWater` first landed on the actions interface**
- **Found during:** Task 3 typecheck
- **Issue:** The member was added to `PhysicsPaintStudioKeyboardActions` instead of `PhysicsPaintStudioKeyboardState` (both interfaces declare adjacent members), so `tsc --noEmit` rejected every use.
- **Fix:** Moved the declaration (with its doc note) onto `PhysicsPaintStudioKeyboardState`; no behavior change, caught before the task commit.
- **Files modified:** app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts
- **Commit:** folded into 5a35055c

No other deviations — the rest of the plan executed exactly as written. No dependency was added or upgraded (package-legitimacy gate not triggered). No CSS change was needed: `.physics-paint-icon-button:disabled` / `.physics-paint-segmented-button:disabled` already supply the 45 % opacity / not-allowed look.

## Feasibility note — why Water cannot act on script/raster/cached pixels

Standing water is **engine-internal GPU state**, not recorded data. `wetPeak`, `wetUntil()` and the wet mask live in the live `WatercolorEngine` instance (the sim's velocity/pressure/pigment targets); the recorded payload carries strokes and Dry events only. Hence:

- **Script key** — navigating away clears the live sheet (`engine.clear()` → `resetPaintState`, `wetPeak = 0`). On arrival the engine is blank and the visible paint is the frame's cached raster base, produced by the bake. There is no fluid field to blend, and no replay has been performed to a mid-script tick. The gate therefore closes: greying Water is truthful, not a UI restriction.
- **Raster key** — the paint is baked pixels. There is no engine wet field at all, only the cached image; Water would paint clear water into a sheet that will never move pigment.
- **Cached pixels generally** — a cache capture is the settled (dry) look by construction; the settle capture fires when `isAwake` goes false, i.e. exactly when the wet field has died. Restoring a cache restores pixels, never the fluid state.

Making Water work on script keys or raster keys would need one of two capabilities that do not exist today: (a) a **script replay/seek to an arbitrary tick followed by wet-field seeding** — rebuilding the fluid state at that instant, which the engine can only do by re-simulating the whole script and then leaving the sheet wet, and which conflicts with the settle-capture law; or (b) a **wet-height/wetness payload carried in the script and package format**, re-seeded into the engine on load. Both are engine/format work with payload-versioning consequences, explicitly out of scope for this quick. The gate closes rather than promise blending that cannot happen.

## Tests run

| Gate | Command | Result |
|------|---------|--------|
| Package unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/wetState.test.ts` | 5 passed |
| Package suite | `pnpm --filter @efxlab/efx-watercolor exec vitest run` | 11 files, 159 passed / 4 skipped |
| Package types | `pnpm --filter @efxlab/efx-watercolor run check` | clean |
| Package dist | `pnpm --filter @efxlab/efx-watercolor build` | rebuilt (`dist/index.d.ts` carries `hasStandingWater` for the app typecheck) |
| Gate store + wiring | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleWetPaintGate.test.ts` | 10 passed |
| Tool row (launcher) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts` | 10 passed |
| Keyboard | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` | 145 passed |
| App types | `pnpm --filter efx-motion-editor run typecheck` | clean |
| Full app suite | `pnpm --filter efx-motion-editor exec vitest run` | 360 files, 6,316 passed / 1 skipped / 96 todo — exit 0 |

Automated-green is not UAT-green — the native rows below were confirmed live by the user on 2026-10-29.

## Native UAT — APPROVED (2026-10-29, native live Studio)

| # | Row | Result |
|---|-----|--------|
| UAT-1 | Brush stroke on a real/blank key → the left rail's Water button is **enabled** within a moment of pointer-up (wet window = the settle cap, `aquarelleVisibleSettleTicks(dry)` ticks ≈ 2.75 s at Dry 50 — check promptly after the stroke) | PASS |
| UAT-2 | Press F (Dry) on a wet sheet → Water **greyed** immediately; repeat leaving a stroke untouched until the automatic settle-cap dry → Water greys at that moment (active tool falls back to Brush if it was Water) | PASS |
| UAT-3 | Navigate to a key that owns a watercolor script → Water **greyed** (the live sheet was cleared; no wet field survived) | PASS |
| UAT-4 | Navigate to a raster-only key → Water **greyed** | PASS |
| UAT-5 | With Water greyed, pressing **W does nothing** (active tool unchanged); with Water enabled, W selects it | PASS |
| UAT-6 | **B / E / P** behave exactly as today (never gated); greyed styling is the existing 45 % opacity / not-allowed cursor on both button families | PASS |

## Known Stubs

None. The gate is fully wired (engine → store → three surfaces); no placeholder values, no unwired data source, no TODO.

## Threat Flags

None — no new network, auth, file or IPC surface. The only new state is an in-process boolean signal fed by private engine arithmetic (threat register dispositions unchanged).

## Next Phase Readiness
- UAT APPROVED (2026-10-29, native live Studio). All 6 rows passed — brush stroke enables Water; F / auto-dry greys it and falls back to Brush; script and raster keys grey it; W is a no-op while greyed; B / E / P unaffected. No follow-ups were requested during the pass.
- Water on script/raster/cached pixels remains out of scope: it needs script replay/seek with wet-field seeding or a wetness payload (engine/format work with payload-versioning consequences).
- Final gates: package 159 passed / 4 skipped, app 360 files / 6,316 passed, typecheck clean.
- No push was performed; the user owns remote operations.

## Self-Check: PASSED

All four created source/test files and the SUMMARY exist; commits 76e896f8 (Task 1), efd71f81 (Task 2) and 5a35055c (Task 3) are ancestors of HEAD.
