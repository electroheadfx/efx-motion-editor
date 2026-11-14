---
phase: quick-261017-e7n
plan: 261017-e7n
subsystem: physic-paint
tags: [procedural-paper, fond-tile, paper-grain, projectPaperRaster, studio-settings, routing-fix, vitest]

# Dependency graph
requires:
  - phase: 56-05
    provides: "PAPER-01/PAPER-04 — paper/* as first-class PhysicPaintRotoBackgroundMode, isProceduralPaperTexture, proceduralHeightMap, real-scan library ids"
  - phase: quick-261017-dc2
    provides: "document parser accepts paper/* and never writes empty-string backgrounds (1876f4b3)"
provides:
  - "getProjectPaperCanvas / subscribeProjectPaperCanvas synthesize a 256x256 procedural relief tile for paper/* ids (fond tooth visible, not flat #f4efe3)"
  - "enginePaperGrainKey locked policy — setPaperGrain receives the id for procedural paper/*, canvas1/2/3 for paper/real-1..3, '' for transparent/white/photo"
  - "pin tests locking fond routing, grain-key policy, and the paper/* settings/fallback reopen reflection"
affects: [physic-paint, studio-fond, paper-display, paper-grain, aquarelle-deposit]

actuals:
  tokens: 5391
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "one shared draw tail for image papers and procedural tiles (drawProjectPaperRaster) — branch only the texture source"
    - "PaperPicker relief formula kept identical + cited (PaperPicker.tsx is I-04/I-05 scope — no shared helper extraction across the DO-NOT-TOUCH fence)"
    - "single enginePaperGrainKey mapper shared by both setPaperGrain call sites (locked key policy in one place)"

key-files:
  created: []
  modified:
    - app/src/lib/projectPaperRaster.ts
    - app/src/lib/projectPaperRaster.test.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts

key-decisions:
  - "proceduralHeightMap is the renderer — never jpeg conversion (locked answer to 'maybe it need to convert in jpeg?')"
  - "Locked grain-key policy: procedural paper/* -> the id (never ''); paper/real-1..3 -> canvas1/2/3; transparent/white/photo -> ''"
  - "engineBgMode collapse of paper/* to 'transparent' stays byte-untouched (BgMode enum has no paper/* arm; paper reaches the engine via setPaper, not setBgMode)"
  - "Unknown paper/* ids stay fail-soft null through proceduralHeightMap's null return -> existing flat-color arm (T-261017-E7N-01)"
  - "Q5a untouched: real scans keep aquarelle deposit grain on the cold preset (AquarelleCanvasLayer paperPresetForStudioId fallback)"

patterns-established:
  - "Procedural and image papers share one fond draw path — only the texture source branches (procedural tile vs decoded jpg)"

requirements-completed: []

coverage:
  - id: D1
    description: "Procedural paper/* ids render a cached 256x256 relief fond tile through getProjectPaperCanvas / subscribeProjectPaperCanvas (tooth visible, not flat fill)"
    verification:
      - kind: unit
        ref: "app/src/lib/projectPaperRaster.test.ts#I-07 procedural fond tile"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both engine apply helpers call setPaperGrain with a real key for every paper/* id (procedural -> the id; real scans -> canvas1/2/3) and still '' for transparent/white"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#I-07 paper/* engine grain key + reopen reflection"
        status: pass
    human_judgment: false
  - id: D3
    description: "Save -> close -> reopen keeps the same paper/* id in the settings mirror and the fond (fallback + metadata round-trip pinned)"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts#save → reopen keeps the paper/* id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live PHYSIC PAINT STUDIO paper selection — Cold Press tooth visible in the editor fond, persists across frames and reopen, real scans + transparent/white unchanged"
    verification: []
    human_judgment: true
    rationale: "Cross-webview / Tauri live fond rendering — vitest stubs canvas and cannot judge the visible tooth; the user runs the 7 UAT rows in the live app"

# Metrics
duration: 7min
completed: 2026-10-17
status: complete
---

# Quick 261017-e7n: I-07 procedural paper must show in the editor fond — Summary

**Procedural PAPER_LIBRARY selections now synthesize a height-map relief tile into the editor fond and route a real grain key into the physics engine — a routing fix, no jpeg conversion.**

## Accomplishments

- `getProjectPaperCanvas` / `subscribeProjectPaperCanvas` branch on `isProceduralPaperTexture` and build a cached 256x256 grayscale relief tile from `proceduralHeightMap` (PaperPicker relief formula — h as luminance, one-sided slope). The tile feeds the existing `drawProjectPaperRaster` tail, so image papers and procedural papers share one draw path and `grainScale` is honoured unchanged.
- Unknown `paper/*` ids return null through `proceduralHeightMap`'s fail-soft (deterministic flat-color arm — T-261017-E7N-01). `paper/real-1..3` stay on the jpg URL path. `PAPER_TEXTURE_URLS` gains no procedural keys.
- `enginePaperGrainKey` implements the locked policy at both `setPaperGrain` call sites (`applyRotoBackgroundMetadataToEngine`, `applyBackgroundFallbackToEngine`): procedural `paper/*` -> the id (never `''`); `paper/real-1..3` -> `canvas1/2/3` (56-05 PAPER-04 / D-12); `transparent`/`white`/`photo` -> `''`.
- `engineBgMode` collapse of `paper/*` to `'transparent'` left byte-untouched. Q5a left untouched (aquarelle `paperPresetForStudioId` stays `'cold'` for real scans).
- Save/reopen reflection pinned: `backgroundModeToFallback` -> `reflectFallbackToBackgroundMode` -> `applyBackgroundFallbackToSettings` round-trips `paper/cold-press` verbatim (already legal post-1876f4b3).

## Deviations from Plan

None — plan executed exactly as written.

## TDD

Tests written first against the current source; the procedural non-null legs and the `paper/*` grain-key legs failed as expected (messages recorded in the commit body of `117cd92b`). Implementation landed with zero assertion edits.

## Known Stubs

None.

## Verification

- `pnpm vitest run src/lib/projectPaperRaster.test.ts` — 12 passed (6 I-07 + 6 existing, byte-untouched).
- `pnpm vitest run src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts` — 21 passed (5 I-07 + 16 existing, byte-untouched).
- Non-regression: `paperPass.test.ts` + `physicsPaintRotoBackgroundValidatorParity.test.ts` — 23 passed.
- Full `pnpm vitest run` from `app/` — **297 test files passed | 2 skipped; 5168 tests passed | 1 skipped | 96 todo**. New suites confirmed listed and ran (`.test.ts`, not `.test.tsx`).
- Guardrail audit: `git diff app/src/types/physicPaint.ts` empty; `git diff packages/` empty; `git diff app/package.json app/vitest.config.ts` empty; `git diff SPECS/` empty; `git diff app/src/lib/paperPass.ts` empty; diff confined to the four plan files.

## Live UAT rows (user-run — status stays automated-ready until these pass)

1. Open PHYSIC PAINT STUDIO. Open the Paper tab.
2. Select **Cold Press** (procedural) → paper tooth is **visible in the editor canvas** (not black, not plain transparent).
3. Paint a stroke on frame A, navigate to frame B → tooth still there (document fond, all frames).
4. Save the project, close Studio, reopen → Cold Press still selected and still shows.
5. Select a **real** scan (`paper/real-1..3`) → the jpg shows in the fond; engine grain stays on `cold` (Q5a).
6. Select **Transparent** / **White** → those arms still work.
7. Console stays clean of `invalid background metadata`.

## Self-Check: PASSED

- FOUND: `app/src/lib/projectPaperRaster.ts`
- FOUND: `app/src/lib/projectPaperRaster.test.ts`
- FOUND: `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts`
- FOUND: `app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts`
- FOUND: commit `117cd92b` (`fix(i-07): render procedural paper tooth in the editor fond and route engine grain keys`)
