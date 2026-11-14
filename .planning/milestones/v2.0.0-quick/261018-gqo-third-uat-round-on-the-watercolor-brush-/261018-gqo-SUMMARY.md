---
phase: quick-261018-gqo
plan: 261018-gqo
subsystem: ui
tags: [preact, signals, watercolor, paper-picker, studio, physics-paint, css]

# Dependency graph
requires:
  - phase: 56
    provides: watercolor Studio Paper/Paint/Brush tabs, PAPER_LIBRARY, paperThumb, top-bar write-through pair
provides:
  - Oracle TEXTURE-picker landscape paper cards (112x64, 2 columns, name below)
  - Oracle ten-paper named catalog (Title Case) with Scan 1/2/3 real-scan labels
  - Shared vertical spacing rhythm (rule headers + 10px slider row gap)
  - Light gray unselected brush-card border
  - Top bar Modes+settings as one centered group (Engine ready left)
affects: [phase-56-watercolor, physic-paint-studio-ui, paper-catalog]

actuals:
  tokens: 6752
  tasks: 3
  commits: 5
  plan_head_before: 04ac4415e2545b771a4584d697445b6aea946a54
  plan_head_after: 4d6ed5c2f623ec26a29a25a88970fc13986318f6

tech-stack:
  added: []
  patterns:
    - "Oracle-look geometry ported app-side via named constants (CARD_WIDTH/THUMB_HEIGHT) with pin retarget in the same commit"
    - "Display-name truth lives in packages/efx-watercolor PAPER_LIBRARY; app rebuild required because the app resolves package dist/"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/BrushResponsePanel.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - packages/efx-watercolor/src/papers/library.ts
    - packages/efx-watercolor/src/papers/papers.test.ts

key-decisions:
  - "Landscape cards use CARD_WIDTH=112 / THUMB_HEIGHT=64 / GRID_GAP=8 (oracle SWATCH_W/H); the old UI-SPEC 64x64 lock is overridden by the live oracle-look instruction."
  - "Procedural display names are the oracle Title Case table (Cold Press .. Student). Real scans relabel to Scan 1/2/3 — never paper-type names and never the PAPER N placeholder read."
  - "Grain strength remains the single paper-strength control under the Texture rule (grainStrength -> engine.paperTexture); no second store, no parallel Texture slider."
  - "Top-bar write-through pair unchanged; only DOM grouping and CSS (slider min-width 142px -> 112px) so Modes+settings fit as one centered group."

patterns-established:
  - "Section-header spacing is one shared .rule-section-header margin rule, never per-call inline padding."

requirements-completed: [M1-72, M2-74, M3-75, M4-BORDER, M5-77, PAPER-04]

coverage:
  - id: M1-72
    description: "Paper cards are large landscape thumbs (~2:1) in 2 columns with the name below, matching the oracle TEXTURE picker"
    requirement: M1-72
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PaperPicker.test.tsx#uses the oracle landscape card constants"
        status: pass
    human_judgment: true
    rationale: "Card geometry is a visual match against UAT image 72 vs 73; pins only lock the constants."
  - id: M2-74
    description: "Titles, section blocks, and slider rows have consistent vertical breathing room across Paper / Paint / Brush tabs"
    requirement: M2-74
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#CSS gives rule headers margin and module sections a 10px row gap"
        status: pass
    human_judgment: true
    rationale: "Spacing rhythm is judged from UAT images 74 and 76; CSS pins cannot prove optical balance."
  - id: M3-75
    description: "Named paper catalog is the oracle's ten papers with live texture thumbs; no PAPER 1 / PAPER 2 placeholder cells; PAPER-04 scans + Transparent/White intact"
    requirement: M3-75
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PaperPicker.test.tsx#named catalog carries the oracle ten papers"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/papers/papers.test.ts#no library label reads as a PAPER N placeholder"
        status: pass
    human_judgment: true
    rationale: "Live texture thumbs and catalog look are judged from UAT image 75."
  - id: M4-BORDER
    description: "Watercolor brush card thumbs use a light gray border (not the dark sidebar border)"
    requirement: M4-BORDER
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#unselected card border is a light gray"
        status: pass
    human_judgment: true
    rationale: "Border contrast on the dark Studio chrome is a visual call."
  - id: M5-77
    description: "Top bar: Engine ready left; Modes + Brush size + Opacity (+ Water/Edges/Grain) form ONE centered group with no overlap"
    requirement: M5-77
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#ModuleSwitcher sits inside the primary cluster"
        status: pass
    human_judgment: true
    rationale: "Overlap at the UAT window width is judged from image 77."
  - id: PAPER-04
    description: "paper_1/2/3.jpg stay usable as recovered real scans with real jpg texture and the same large-card chrome"
    requirement: PAPER-04
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/papers/papers.test.ts#real group lists paper/real-1..3 pointing at the recovered jpg assets"
        status: pass
    human_judgment: true
    rationale: "Scan thumbs must still read as real jpg texture in the Studio Paper tab."

# Metrics
duration: 8min
completed: 2026-10-18
status: complete
---

# Quick 261018-gqo: Third UAT round on the watercolor/brush Studio UI Summary

**Oracle TEXTURE-picker paper cards, ten named papers without PAPER N placeholders, shared spacing rhythm, light gray brush borders, and a single centered top-bar Modes+settings group — five atomic UAT commits.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-18T10:16:33Z
- **Completed:** 2026-10-18T10:24:57Z
- **Tasks:** 3 completed (5 atomic commits, one per UAT move)
- **Files modified:** 12

## Accomplishments

- Paper tab cards are oracle-landscape (112x64, 2 columns, name below) with thumbs cached at the new size.
- Named catalog is the oracle's ten papers (Cold Press .. Student); PAPER 1 / PAPER 2 placeholder read is gone; PAPER-04 scans are Scan 1/2/3 and Transparent/White still lead Real.
- Vertical rhythm is one shared rule-header margin + 10px slider-row gap across Paper / Paint / Brush tabs.
- Unselected watercolor brush cards use a light gray border; selected accent unchanged.
- Top bar: Engine ready pinned left alone; Modes + Brush size + Opacity (+ Water/Edges/Grain) form one non-overlapping centered group; write-through handlers untouched.

## Task Commits

Each UAT move was committed atomically (five commits, not squashed):

1. **Move 1: landscape paper cards** - `3698c13e` (feat)
2. **Move 3: oracle paper catalog data** - `6f2ba81a` (feat)
3. **Move 2: spacing / padding pass** - `fc00c046` (feat)
4. **Move 4: light gray brush thumb border** - `0dbe72ba` (feat)
5. **Move 5: top bar centered Modes+settings group** - `4d6ed5c2` (feat)

**Plan metadata:** skipped (orchestrator owns the docs commit)

## Files Created/Modified

- `app/src/components/physic-paint/view/PaperPicker.tsx` - landscape card constants (CARD_WIDTH/THUMB_HEIGHT), 2-column grids, thumb warm at new size
- `app/src/components/physic-paint/view/PaperPicker.test.tsx` - geometry + oracle-catalog / no-placeholder pins
- `packages/efx-watercolor/src/papers/library.ts` - oracle Title Case names; Scan 1/2/3 real labels
- `packages/efx-watercolor/src/papers/papers.test.ts` - name pins + PAPER N placeholder negative scan
- `app/src/components/physic-paint/physicsPaintStudio.css` - rule-header margin, module-section row gap, top-bar grouping comment + slider min-width 112px
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` - option-group class for row gap
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` - spacing-rhythm pins
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx` - option-group class for row gap
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` - unselected border `#c8c8c8`
- `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` - light-gray border pin
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` - ModuleSwitcher moved into the primary cluster
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts` - one-group centering pins

## Decisions Made

- **Scan labels are Scan 1/2/3** (not `paper 1` and not a paper-type name). The plan forbids both the PAPER N placeholder read and invented paper-type names for the recovered jpg scans; "Scan N" is the scan identity.
- **GRID_GAP stays 8** (plan allowed 8 or the oracle's 6). Pinned with the landscape constants.
- **Grain strength label kept** under the Texture rule (Q6 names stay Grain strength + Grain scale). No parallel Texture slider — grainStrength -> engine.paperTexture remains the only paper-strength seam.
- **Slider min-width 142px -> 112px** so the watercolor cluster (Modes + 5 sliders) fits at the UAT width without wrap or absolute positioning.

## Deviations from Plan

None that changed scope. One operational note:

**1. [Rule 3 - Blocking] Rebuild `@efxlab/efx-watercolor` after `library.ts` name change**
- **Found during:** Task 1 (move 3)
- **Issue:** The app resolves `@efxlab/efx-watercolor/papers` through the package `dist/` build (`exports` -> `./dist/papers.mjs`), so the Title Case names did not reach PaperPicker until the package was rebuilt. Source-level `papers.test.ts` passed while the app pin failed.
- **Fix:** `pnpm --filter @efxlab/efx-watercolor build` (existing tsup script). `dist/` is gitignored (`packages/*/dist/`) so no extra files entered the commits.
- **Verification:** PaperPicker oracle-catalog pin green; full app suite green.

---

**Total deviations:** 1 operational (Rule 3 rebuild), 0 scope changes
**Impact on plan:** None on scope. All five UAT moves landed as the locked atomic commits.

## Issues Encountered

- Plan verify commands used `app/src/...` paths with `--filter efx-motion-editor exec vitest`; vitest's root is `app/`, so those filters matched nothing. Ran with `src/...` paths (and the package suite via `--filter @efxlab/efx-watercolor`). Same tests, correct invocation.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes. Thumb cache stays a paint-once Map keyed by (id, size); no toDataURL/toBlob; no new packages.

## Next Phase Readiness

Ready for native UAT of images 72-77. Automated pins are green (`pnpm --filter efx-motion-editor exec vitest run` = 305 files / 5269 passed; `@efxlab/efx-watercolor` = 114 passed). Scope fence held: no SPECS/ diff, no package.json/lockfile diff, no phase-55 index ticks.

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/view/PaperPicker.tsx`
- FOUND: `packages/efx-watercolor/src/papers/library.ts`
- FOUND: `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`
- FOUND: `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`
- FOUND: `app/src/components/physic-paint/physicsPaintStudio.css`
- FOUND: `3698c13e` (ancestor of HEAD)
- FOUND: `6f2ba81a` (ancestor of HEAD)
- FOUND: `fc00c046` (ancestor of HEAD)
- FOUND: `0dbe72ba` (ancestor of HEAD)
- FOUND: `4d6ed5c2` (ancestor of HEAD)
