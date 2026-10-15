---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 05
subsystem: papers
tags: [watercolor, paper, paperPass, procedural, library, picker, display-state, tdd, change-token]

# Dependency graph
requires:
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 01
    provides: @efxlab/efx-watercolor package scaffold, seededRng from @efxlab/efx-paint-host
  - phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
    plan: 02
    provides: shared-panel Paper section mount point (56-02 shell)
provides:
  - 13-paper Studio library (10 procedural + 3 recovered real) with seeded byte-stable height maps (PAPER-01 / PAPER-04)
  - setPaperId / setPaperStrength / setPaperScale — display-class fond setters with change-token rotation (PAPER-03 / D-22)
  - paperPass accepts the library: procedural height fields + real jpgs through one encode/cache tail (PAPER-02 / D-21)
  - PaperPicker thumbnail grid popover + Strength/Scale SliderStepper rows in the shared panel (D-09..D-12)
affects: [56-06, 56-07, 56-09]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# commits: MEASURED via git rev-list --count plan_head_before..HEAD (#3968).
actuals:
  tokens: 28076
  tasks: 3
  commits: 5
plan_head_before: ae1a6de0f4f8187318be461360b031d2808be799
plan_head_after: dd58a8cde7ce06e2f57a2d6ab8e18dab50a71009

# Tech tracking
tech-stack:
  added:
    - "@efxlab/efx-watercolor workspace dependency in app (lean ./papers sub-export, ~300 B entry + shared chunk)"
  patterns:
    - "proceduralHeightMap(paperId, seed, width, height) — seeded tileable fBm tooth + mottle + fleck via seededRng (D-20 / T-56-13); same id+seed ⇒ identical Float32Array bytes"
    - "_writePaperDisplay is the ONE paper display write: fallback arm bumps documentRevision (change-token rotation) + track mirror clears both flattened memos; same-value sets are revision-stable no-ops"
    - "paperPass._finishPaperPassTile is the shared encode/cache tail — image probe and procedural height field land on the same conditioner/encoder/cache so the two paper sources cannot drift"
    - "PaperTexture / background metadata accept `paper/<id>` library ids alongside canvas1/2/3 aliases; engine BgMode calls guard library ids (deposit-role paper is engine-internal, display fond is paperPass)"

key-files:
  created:
    - packages/efx-watercolor/src/papers/procedural.ts
    - packages/efx-watercolor/src/papers/library.ts
    - packages/efx-watercolor/src/papers/encode.ts
    - packages/efx-watercolor/src/papers/index.ts
    - packages/efx-watercolor/src/papers/papers.test.ts
    - app/src/stores/physicPaintStore.paper.test.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx.test.ts
    - .planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-05-red-evidence.json
    - .planning/phases/56-efx-watercolor-engine-2-paint-aquarelle-clean-room/56-05-red-evidence-task2.json
  modified:
    - app/src/lib/paperPass.ts
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/rotoFrameDraw.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/types/physicPaint.ts
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/engine/usePhysicsPaintEngineActions.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoReferenceController.ts
    - packages/efx-physic-paint/src/types.ts
    - packages/efx-watercolor/package.json
    - packages/efx-watercolor/tsup.config.ts
    - app/package.json

key-decisions:
  - "Paper display id/strength/scale ARE the existing fond fields (background/texture, grainStrength, grainScale) — setPaperId/setPaperStrength/setPaperScale are named display-class setters over that arm, not a parallel field set. The fallback arm's inclusion in encodeCanonicalBackgroundFallback means a paper edit already rotates the document revision (and thus the layer change token) once setBackgroundFallback writes it."
  - "Procedural papers generate at full tile size (width×height) rather than tiling a smaller base — the cache key already carries w×h so a per-size generation is deterministic and avoids a second tiling transform on the height field."
  - "The app depends on @efxlab/efx-watercolor via a lean ./papers sub-export (~300 B + shared chunk) so the fluid engine/brushes never enter the main chunk."
  - "Engine BgMode never receives library paper ids — the engine's own paper draw is deposit-role (engine-internal); the display fond is paperPass. Library ids fall back to 'transparent' at the engine boundary by design."

# TDD Gate Compliance
| Task | RED | GREEN | Status |
|------|-----|-------|--------|
| 1 Procedural paper generation + 13-paper library | e693861b (RED_EVIDENCE_OK) | 2de1006f | complete |
| 2 paperPass wiring + fond display state | 95c1f9eb (RED_EVIDENCE_OK) | d512a7ad | complete |
| 3 Paper picker UI | n/a (type=auto, no tdd) | dd58a8cd | complete |

---

# Phase 56 Plan 05: Paper Pack and Paper Picker Summary

**One-liner:** 13-paper Studio library (seeded procedural height fields + 3 recovered real scans) wired through the composite-only paperPass seam, with fond display state (id/strength/scale) on the document, display-class change-token rotation, and the shared-panel PaperPicker grid.

## What Shipped

### Task 1 — Procedural paper generation + 13-paper library (PAPER-01, PAPER-04)

`packages/efx-watercolor/src/papers/` ships the Studio paper pack:

- **`library.ts`** — `PaperDefinition { id, name, group, defaultStrength, defaultScale, source }` and `PAPER_LIBRARY` (13 entries). Procedural group first (cold press, hot press, rough, khadi, washi, laid, canvas, toned sand, kraft, student — locked names and `paper/<kebab>` ids), then Real (`paper/real-1..3` pointing at `/img/paper_1.jpg` … `paper_3.jpg`). Stable order pinned (D-12 one library, never tabs).
- **`procedural.ts`** — clean-room tileable fBm tooth + mottle + fleck field generators, one recipe per paper. Every draw keys off `seededRng(strokeSeed, streamKey)` from `@efxlab/efx-paint-host` (D-20 / T-56-13). Same `(paperId, seed, width, height)` produces identical Float32Array bytes; distinct papers produce distinct fields.
- **`encode.ts`** — the pure PaperPassTile-shaped twin of `paperPass.encodePassTiles`: signed height model, valley floors at the paper tint (never black), peak lifts toward the tint, alpha 255 (straight-alpha D-02). No DOM.

`papers.test.ts` (19 cases) pins library shape, locked names/ids, real jpg sources, adjacency (unique ids), idempotent generation, and the encode contract.

### Task 2 — paperPass wiring + fond display state (PAPER-02, PAPER-03)

- **`setPaperId` / `setPaperStrength` / `setPaperScale`** on `physicPaintStore` funnel through one `_writePaperDisplay` helper: the document fallback arm (via `setBackgroundFallback`, which bumps `documentRevision` and therefore rotates the display-class change token — the PKG-06/BKG-09 lesson, D-22) plus the active track's paper mirror (which clears both flattened memos). Same-value sets are revision-stable no-ops. Strength clamps to [0, 1]; scale clamps to [GRAIN_SCALE_MIN, GRAIN_SCALE_MAX] and refuses 0 (never a divide-by-zero in the tile cache key). No setter touches any baked WebP cache path (PAPER-02 / D-21).
- **`paperPass`** accepts the 13-paper library: procedural papers generate seeded height fields (no image decode, no async resolve); real papers ride the shipped jpgs under their library ids. Both sources share one `_finishPaperPassTile` encode/cache tail (260925-dso one-conditioner law). `TILE_CACHE_ENTRY_LIMIT = 12` and `TILE_CACHE_BYTE_BUDGET = 64MB` unchanged — the 13-paper set stays inside the existing bounds.
- **Type widening** — `PaperTexture` / `PhysicPaintRotoBackgroundMode` / fallback validators accept `paper/<id>` library ids alongside the legacy canvas1/2/3 aliases. Engine `BgMode` calls guard library ids (deposit-role paper is engine-internal; the display fond is paperPass).

`physicPaintStore.paper.test.ts` (8 cases) pins the fond display-state contract; `paperPass.test.ts` (18 cases) stays green on the composite seam.

### Task 3 — PaperPicker UI (D-09..D-12)

`app/src/components/physic-paint/view/PaperPicker.tsx` is the shared-panel Paper section:

- Trigger: `Paper` label + current paper name as secondary text.
- Popover: 3-column grid of 64×64 cells with 8px gaps, sticky `Procedural` / `Real` group headers (D-12), `min(280px, …)` width. Active cell uses the reserved accent border; unselected cells use the subtle border token.
- Cells show the raw tile only (D-11): procedural = height-map lit relief canvas, real = the jpg. Loading and decode-failure share the `--color-bg-input` + name placeholder (UI-SPEC loading/error rows).
- Strength + Scale SliderStepper rows sit directly under the trigger, always reachable (D-10 / D-06).
- Zero engine/deposit/fluid imports in the picker module (comment-stripped source scan pinned).

Mounted into the 56-02 shared block; the Studio wires the ports to the paper setters.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Type widening for library paper ids**
- **Found during:** Task 2 GREEN
- **Issue:** `PaperTexture` / `PhysicPaintRotoBackgroundMode` were closed unions (`canvas1|2|3`); the 13-paper library ids (`paper/<id>`) could not ride the fond without widening.
- **Fix:** Widened the app-side types and the efx-physic-paint `BackgroundFallback.texture` mirror; guarded engine `setBgMode` calls so library ids never reach the engine's closed `BgMode`. Also fixed `backgroundColorForRotoMode`'s exhaustive switch (library ids take the shared warm paper tone).
- **Files modified:** `app/src/efx-paint/document/efxPaintDocument.ts`, `efxPaintDocumentParsers.ts`, `app/src/types/physicPaint.ts`, `app/src/stores/efxPaintStore.ts`, `packages/efx-physic-paint/src/types.ts`, plus the Studio/settings/top-bar call sites.
- **Commit:** d512a7ad

**2. [Rule 3 - Blocking] App → efx-watercolor workspace dependency**
- **Found during:** Task 2
- **Issue:** paperPass needed the library's `proceduralHeightMap`; app had no dependency on `@efxlab/efx-watercolor`.
- **Fix:** Added `workspace:*` dependency and a lean `./papers` sub-export (tsup entry + package.json exports) so the fluid engine/brushes never enter the main chunk.
- **Files modified:** `app/package.json`, `packages/efx-watercolor/package.json`, `packages/efx-watercolor/tsup.config.ts`
- **Commit:** d512a7ad

## Auth Gates

None.

## TDD Gate Compliance

See frontmatter table. Both behavior-adding tasks landed RED-first with `RED_EVIDENCE_OK` machine verdicts (`56-05-red-evidence.json`, `56-05-red-evidence-task2.json`); the GREEN commits follow each RED commit. Task 3 is `type="auto"` without `tdd="true"` and shipped with its standing pins.

## Known Stubs

None that block the plan goal. Two intentional presentation simplifications worth knowing:

| Item | File | Line | Reason |
|------|------|------|--------|
| Shared warm tint for library paper tones | `app/src/lib/rotoFrameDraw.ts` | `backgroundColorForRotoMode` default | Per-paper tint characterization is a look-UAT item; the paperPass tooth carries the per-paper character today |
| Engine BgMode fallback to `'transparent'` for library ids | `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` | `engineBgMode` | By design — library papers composite through paperPass (display fond), never the engine's deposit-role paper draw |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: tampering | `packages/efx-watercolor/src/papers/procedural.ts` | T-56-13 mitigated: seeded generation only (seededRng, no Math.random); papers.test.ts pins byte-stable height maps |
| threat_flag: denial-of-service | `app/src/lib/paperPass.ts` | T-56-14 mitigated: TILE_CACHE_ENTRY_LIMIT / TILE_CACHE_BYTE_BUDGET unchanged; 13 papers × sizes stays inside existing bounds |
| threat_flag: tampering | `app/src/stores/physicPaintStore.ts` | T-56-15 mitigated: every display edit rotates the flattened fond signature via `_rotateFlattenedMemoOnFondChange` and writes the fallback arm (change-token rotation) |

T-56-16 (paper jpg disclosure) accepted — assets already shipped. T-56-SC accepted — no package-manager install of external packages (workspace link only).

## Verification

```
pnpm --filter @efxlab/efx-watercolor exec vitest run src/papers/papers.test.ts
  → 19 passed

pnpm --filter efx-motion-editor exec vitest run src/lib/paperPass.test.ts src/stores/physicPaintStore.paper.test.ts src/components/physic-paint/view/PaperPicker.test.tsx.test.ts
  → 18 + 8 + 9 = 35 passed

pnpm --filter efx-motion-editor run typecheck
  → clean
```

Broader regression held green: `physicPaintStore.test.ts` 112/112, document suite 106/106, panelSplitShell 9/9, watercolor package 70/70.

## Self-Check: PASSED

