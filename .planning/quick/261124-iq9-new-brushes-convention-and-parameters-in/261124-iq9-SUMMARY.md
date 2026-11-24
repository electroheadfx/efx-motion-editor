---
phase: quick/261124-iq9
plan: "01"
subsystem: studio-paint
tags: [brush-catalog, medium-taxonomy, param-visibility, preact-signals, vitest]

# Dependency graph
requires:
  - phase: quick/261027-gh9
    provides: watercolor-only preset catalog, chalk dry media, top-bar settings cluster
provides:
  - Two-medium taxonomy (watercolor | acrylic displayed as Gouache) with 12 brush presets in 2 groups
  - Removed medium/response ids resolve through presetFor's unknown-id fallback to round — no migration
  - Shared isAquarelleParamRowVisible selector gating Viscosity and Water for the acrylic paint context on BOTH the Paint panel and the top-bar Water slider
affects: [studio-paint, brush-library, medium-dropdown, top-bar]

# Actuals (#2632) — same estimateTokens scale as the plan estimate (chars/4 over the realized diff).
actuals:
  tokens: 40745
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared row-visibility selector drives every surface (panel row law + top-bar slider)"
    - "Retired catalog ids are accepted through the existing unknown-id fallback — no back-compat branch"
    - "Catalog-dependent test literals derive from BRUSH_PRESETS instead of hardcoding a preset value"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/src/playground/mediums.ts
    - packages/efx-watercolor/src/playground/brushes.ts
    - packages/efx-watercolor/src/playground/brushBridge.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - app/src/components/physic-paint/view/aquarelleParamVisibility.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - 30 package/app test files retargeted to the surviving catalog

key-decisions:
  - "Acrylic keeps its id and every parameter byte-for-byte; only the display name becomes Gouache"
  - "Viscosity/Water hide only in the paint branch — the Water tool keeps Viscosity under both media"
  - "No migration: removed response ids fall back to round through presetFor"
  - "Texture-parity expected aspect is derived from BRUSH_PRESETS, never a hardcoded preset constant"

patterns-established:
  - "Shared row-visibility selector: panel and top bar read one law, never two predicates"
  - "Retirement pins live in suites (null mediumById lookups, absent preset ids), never unscoped tree-wide greps"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Medium dropdown lists exactly Watercolor and Gouache; selecting Gouache paints the shipped opaque body-colour deposit"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#the Medium dropdown offers exactly Watercolor and Gouache"
        status: pass
    human_judgment: true
    rationale: "The painted look of the Gouache (acrylic) deposit is a visual property — unit pins only prove the record/catalog wiring"
  - id: D2
    description: "Brush tool + Gouache: no Water/Viscosity on the Paint panel (Pigment, Pickup, Dry speed, Feather) nor on the top bar (Brush size, Pigment, Edges, Grain)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#Gouache (the acrylic record) shows Pigment, Pickup, Dry speed and Feather only"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#the acrylic bar renders four sliders and no Water"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts#P-A"
        status: pass
    human_judgment: true
    rationale: "Live-surface UAT row 2: the artist verifies both visible surfaces in the running Studio"
  - id: D3
    description: "Brush tool + Watercolor unchanged: eight panel rows and the top bar's Water slider back between Pigment and Edges; painted look unchanged"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#the watercolor bar renders five labels"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts#P-W"
        status: pass
    human_judgment: true
    rationale: "Live-surface UAT row 3: paint/re-bake look parity needs the artist's eye"
  - id: D4
    description: "Water tool renders Viscosity under both media; the Eraser keeps Lift alone"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarelleParamVisibility.test.ts#Water tool keeps viscosity for both media"
        status: pass
    human_judgment: true
    rationale: "Live-surface UAT row 4: the running tool cluster is the acceptance surface"
  - id: D5
    description: "Brush library shows two headings only — Watercolor (11 cards) and Gouache (the renamed Bristle Round)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#renders the two grouped sections"
        status: pass
    human_judgment: true
    rationale: "Live-surface UAT row 5: rendered library layout"
  - id: D6
    description: "An older project whose stroke recorded a removed response renders through the round fallback with no error"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/brushBridge.test.ts#presetFor falls back to round for an unknown id"
        status: pass
    human_judgment: true
    rationale: "Live UAT row 6: opening a real old project exercises the full load/re-render path"
  - id: D7
    description: "Catalog narrowed to exactly 2 media and 12 presets in 2 groups; retired ids absent; isBristleResponse true only for bristle-round"
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/mediums.test.ts + brushes.test.ts (full package suite)"
        status: pass
      - kind: unit
        ref: "pnpm --dir packages/efx-watercolor exec vitest run"
        status: pass
    human_judgment: false

# Metrics
duration: ~61min
started: 2026-11-24T12:12:50Z
completed: 2026-11-24T13:13:45Z
status: complete

# Plan commit ledger (#3968) — measured, never narrated.
plan_head_before: 074bdafc3ed4f1ab7b60392953736b07eb6ed57e
plan_head_after: f5da7c094bb8cc3ed59f7bdef633ed98961fc6c2
---

# Quick 261124-iq9: New Brushes Convention and Parameters in Studio Summary

**Two media (Watercolor, Gouache) and twelve responses in two groups, with Viscosity/Water gated off the Gouache paint context on both the Paint panel and the top-bar Water slider through one shared selector**

## Performance

- **Duration:** ~61 min (ledger base → final task commit)
- **Started:** 2026-11-24T12:12:50Z
- **Completed:** 2026-11-24T13:13:45Z
- **Tasks:** 3/3
- **Files modified:** 36 (4 package sources, 2 app sources, 30 test files)

## Accomplishments

- Package catalog narrowed: `MediumId` is exactly `watercolor | acrylic` (acrylic displayed as **Gouache**, id and parameters byte-identical); `BRUSH_PRESETS` is exactly 12 — the 11 watercolor responses plus `bristle-round` renamed Gouache; gouache/pastel/graphite/chalk records and 11 presets deleted; `brushGroupOrder`/`brushGroupLabels` hold the two groups; `isBristleResponse` true only for `bristle-round`; `TIP_TO_PRESET` trimmed to surviving targets; `Engine.ts` default falls back to the shipped `round` preset.
- Matrix-2 visibility law: `isAquarelleParamRowVisible(tool, mediumId, key)` added; `ACRYLIC_HIDDEN` attached to the `viscosity` and `water` rows in the paint branch only; the top bar reads the same selector to gate the `physics-aquarelle-water` slider — so Brush + Gouache shows Pigment, Pickup, Dry speed, Feather and no Water anywhere, while the Water tool keeps Viscosity under both media.
- Retirement path is the shipped unknown-id fallback: `presetFor` resolves a removed response id to `round` — no migration, no back-compat branch, no hidden registration.
- Every app test repointed to a surviving vehicle (18 files) with retirement pins intact; full package suite, package check, package build, full app suite (466 files / 9861 tests) and both typechecks green; structural counts 12 presets / 2 medium records.

## Task Commits

Each task was committed atomically:

1. **Task 1: Package taxonomy + catalog — two media, twelve responses, the Gouache rename** — `8065a6a09` (refactor)
2. **Task 2: Matrix 2 — Viscosity and Water hidden for the Gouache (acrylic) context, in the panel AND the top bar** — `22ee47f2a` (feat)
3. **Task 3: App test sweep + closing gates — repoint every retired-id vehicle** — `f5da7c094` (test)

**Plan metadata:** none — the orchestrator owns the docs commit (`.planning` artifacts intentionally uncommitted).

## Files Created/Modified

- `packages/efx-watercolor/src/playground/mediums.ts` — two frozen records (Watercolor, Gouache/acrylic), narrowed `MediumId`
- `packages/efx-watercolor/src/playground/brushes.ts` — 12 presets in shipped order, two groups/labels, `isBristleResponse` narrowed, `bristle-round` name Gouache
- `packages/efx-watercolor/src/playground/brushBridge.ts` — four dead `TIP_TO_PRESET` entries removed; `presetFor` fallback untouched
- `packages/efx-watercolor/src/playground/Engine.ts` — default-brush initializer uses the round fallback (no bristle literals)
- `app/src/components/physic-paint/view/aquarelleParamVisibility.ts` — `BRISTLE_MEDIA = ['acrylic']`, acrylic-hidden constant on viscosity + water, exported `isAquarelleParamRowVisible`
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — Water slider wrapped in the shared selector's conditional (render-body read only)
- 30 test files — package pins rewritten (mediums, brushes, dryMedia, engineStartDwell, brushBridge, maskRegistry) and 18 app suites retargeted, plus the visibility/top-bar suites from Task 2

## Decisions Made

- Acrylic keeps its id and every parameter; only the display name changes to Gouache (emboss is not a usable 2.5D relief, so the "acrylic/oil" story was wrong).
- `hiddenForMedia` stays a paint-context law: the Water tool branch ignores it, so Viscosity keeps rendering under every medium.
- No migration; old recorded response ids resolve through `presetFor`'s shipped unknown-id fallback to `round` (accepted data loss).
- Test vehicles were repointed to `bristle-round` (and watercolor pairs round/flat) so each assertion keeps its original intent against the surviving catalog.

## Plan-Checker Advisories Applied

- The `AquarelleGlobalsPanel.test.ts` "Gouache keeps Refill and Feather" row test was folded into the new four-row Gouache truth (Pigment, Pickup, Dry speed, Feather; no Viscosity/Refill/Water/Flow/Bleed/Edges/Grain).
- `brushToolFamily.test.ts` pins the Brush tool's sections to exactly `['acrylic']` and `firstBrushPresetForTool('brush')` to `bristle-round`.
- Gate order honored: `pnpm --dir packages/efx-watercolor run build` ran BEFORE the app suite and app tsc (app tsc resolves the package through `dist/*.d.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `aquarelleStrokeSelection.test.ts` repointed to a resolvable response id (plan said "do not touch")**
- **Found during:** Task 3 (full app suite)
- **Issue:** The plan assumed this file only carries retired ids as recorded-script strings. In fact five call sites feed `brushId: 'chalk'` into `updateAquarelleStrokesInScript` / `beginAquarelleAppearanceEdit`, which validate against the catalog; with chalk deleted they return 0 writes / null edit ids and the suite fails. The full-app-suite gate cannot be green without fixing it.
- **Fix:** One replacement of every quoted `'chalk'` vehicle and its matching recorded-value assertions with `'bristle-round'` (17 occurrences; the null-returning inactive/no-port cases and the type-level patch are indifferent to the id).
- **Files modified:** `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts`
- **Verification:** The file's five previously failing cases pass; full app suite green.
- **Committed in:** `f5da7c094`

**2. [Rule 1 - Bug] Texture-parity expected aspect no longer hardcoded to the retired chalk response**
- **Found during:** Task 3 (full app suite)
- **Issue:** `aquarelleTextureParity.test.ts` asserted `live.aspect === 0.8 * 0.8`, the second factor being chalk's base aspect. With `bristle-round` (aspect 0.7) the derived expectation is 0.56, so the literal had to change — and hardcoding another preset value would go stale again.
- **Fix:** `RESPONSE_ASPECT = BRUSH_PRESETS.find(p => p.id === RESPONSE_ID)!.aspect`; assertion is `0.8 * RESPONSE_ASPECT`, derived from the table.
- **Files modified:** `app/src/components/physic-paint/engine/aquarelleTextureParity.test.ts`
- **Verification:** Parity case passes; full app suite green.
- **Committed in:** `f5da7c094`

---

**Total deviations:** 2 auto-fixed (2 Rule 1)
**Impact on plan:** No scope creep — both fixes are required for the closure gates to be green and preserve each test's original assertion intent.

## TDD Gate Compliance

- **Task 1** (`tdd="true"`): RED captured — the six rewritten package test files failed against the five-medium / twenty-three-preset table before the production edits; GREEN after. Committed as `8065a6a09`.
- **Task 2** (`tdd="true"`): RED **not captured** — the two test files were authored before the production edits, but the suite was first executed after both were in place. Reported truthfully: the visibility and top-bar suites pass, but the failure-first evidence for this task was not recorded.
- **Task 3** (no `tdd`): test-only sweep, no RED/GREEN cycle applicable.

## Issues Encountered

- `physicPaintBridge.test.ts` ("catalog pull — removes its one-shot listener when no receiver answers (bounded wait)") timed out once at 20 s in one full-suite run under parallel load, then passed in isolation (2.2 s) and in the next full run. Pre-existing fake-timer flake; no bridge code was touched by this quick.
- The package `dist` is stale after Task 1 while app vitest aliases the package to source; the build-before-app-gates order from the plan was required and followed.

## Known Stubs

None — no placeholder values, TODOs, skipped tests or unwired data sources were introduced.

## Threat Flags

None — the diff introduces no network, auth, file-access or schema surface; the project format is unchanged (hidden rows never remove keys).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated gates are all green: package targeted + full suite, package `check`, package `build`, app full suite (466 test files / 9861 passed, 2 skipped), app `tsc --noEmit`, structural counts 12 presets / 2 medium records; no diff under `packages/efx-watercolor/probe/**`, `.planning/spikes/**` or prior quick tasks.
- **Six live UAT rows stay PENDING (AUTOMATED-READY, artist-run):** (1) two-entry Medium dropdown and the Gouache opaque deposit; (2) Brush + Gouache hides Viscosity/Water on the panel AND the top bar; (3) Brush + Watercolor restores both with unchanged paint; (4) Water tool keeps Viscosity under both media; (5) library shows Watercolor (11) + Gouache (1) headings only; (6) an older project with a removed recorded response renders via the round fallback without error.
- `.planning/phases/64-medium-engine/64-BEADS-RECALL.md` carried a pre-existing unrelated modification and was intentionally left uncommitted/untouched; no `.planning` artifact was committed by the executor.

## Self-Check: PASSED

- `f5da7c094` (Task 3) — FOUND in HEAD history
- `22ee47f2a` (Task 2) — FOUND in HEAD history
- `8065a6a09` (Task 1) — FOUND in HEAD history
- No created files to verify (all changes are modifications)
- Ledger: `git rev-list --count 074bdafc3..HEAD` = 3
