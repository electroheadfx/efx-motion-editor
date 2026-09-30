---
phase: quick-260930-ni6
plan: 260930-ni6
type: tdd
status: complete
tasks: 3
commits: 5
plan_head_before: c10d9a3d
date: 2026-09-30
subsystem: physic-paint
tags: [physics-paint, defaults, settings, engine-mirror, tdd]

requires:
  - plan: 260930-detail
    provides: "edgeDetail default 4→50 + the shapeDetail.test.ts default pin (folded into this rebase)"
  - plan: 260930-continuity
    provides: "TICK_FLOOR law; battery harnesses locked at Spread 50 as fixed measurement conditions"
provides:
  - "Fresh-open defaults: Shape detail 20, Spread 60, Brush smoothing Soft, Blending 0 (app factory + engine mirror)"
  - "Permanent engine-mirror drift detector in physicsPaintStudioSettings.test.ts"
  - "Pickup slider label renamed to Blending (label string only)"
affects: [260925-b7c, 260930-continuity, 260930-detail]

actuals:
  tokens: 3250    # chars/4 over the realized diff (12,990 bytes)
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns: ["source-read test pins via new URL(..., import.meta.url) for default/mirror contracts"]

key-files:
  created: [.planning/quick/260930-ni6-defaults-260930-panel-defaults-rename-sc/260930-ni6-RED-EVIDENCE.json]
  modified:
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.test.ts
    - packages/efx-physic-paint/src/brush/shapeDetail.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts

key-decisions:
  - "Engine antiAlias default 0→1 included in Task 2 (plan's documented discretion): there is NO launch-time push — setSmoothing merely forwards to engine.setAntiAlias on user change — so the engine initial antiAlias IS the smoothing channel; without it the Soft selection would be cosmetic"
  - "Pre-existing stale edgeDetail: 4 pin in physicsPaintStudioSettings.test.ts folded into Task 1's RED (expected-20/got-50 failure), never fixed silently"

requirements-completed: [QUICK-260930-NI6]
---

# 260930-ni6 SUMMARY — Physics Paint panel defaults + Blending rename

**AUTOMATED-READY — NOT done.** All automated gates are green, but acceptance
is the user's live native UAT (the 4 rows below). Nothing is declared done
until that UAT passes.

## What landed — four default values (two mirrors each) + one label

| Value | Before → After | App factory | Engine initial state |
|-------|----------------|-------------|----------------------|
| Shape detail (edgeDetail) | 50 → **20** | `physicsPaintStudioSettings.ts:32` | `EfxPaintEngine.ts:610` |
| Spread (localSpreadStrength) | 50 → **60** | `physicsPaintStudioSettings.ts:36` | `EfxPaintEngine.ts:619` |
| Brush smoothing (antiAlias) | 0 → **1 (Soft)** | `physicsPaintStudioSettings.ts:35` (smoothing) | `EfxPaintEngine.ts:613` |
| Blending (pickup) | **0 — unchanged** | `physicsPaintStudioSettings.ts:33` | `EfxPaintEngine.ts:611` |
| Pickup slider label | "Color blending" → **"Blending"** | `PhysicsPaintRightPanel.tsx:664` (label prop only) | n/a |

**Engine-mirror rationale for antiAlias (plan-sanctioned discretion):** the
brief anchored smoothing at the app file only, but there is NO launch-time
push from app settings to the engine (`setSmoothing→setAntiAlias`,
`setSpread`, `setEdgeDetail` fire only on user change in
`usePhysicsPaintEngineActions.ts`). The engine initial `antiAlias` IS the
smoothing channel for a fresh session — without `antiAlias: 1` the panel
would say Soft while strokes render feather 0 (cosmetic Soft, dead Spread).
antiAlias is a default value, not a law.

## TDD evidence

**RED 1 (`a2b7e79a`, zero production edits)** — evidence:
`260930-ni6-RED-EVIDENCE.json` (verdict `RED_EVIDENCE_OK`, validated via
`gsd_run check tdd-red-evidence`):

- `shapeDetail.test.ts` pin retitled `default-50` → `default-20`:
  `expect(engineSrc).toContain('edgeDetail: 20')` **FAILED** — engine source
  held `edgeDetail: 50` (EfxPaintEngine.ts:610). 1 failed | 9 passed (10).
- `physicsPaintStudioSettings.test.ts` defaults contract rebased
  `edgeDetail: 4` → `20`: `toMatchObject` **FAILED** with the NEW contract —
  `- "edgeDetail": 20, + "edgeDetail": 50` (not the old stale expected-4
  failure). 1 failed | 14 passed (15).

**GREEN 1 (`288f7571`)** — the two default sites flipped to 20; both files
green (10/10 + 15/15).

**RED 2 (`247d5dc4`, test file only)** — both new pins failed as required:

- defaults contract: `- smoothing 1, spread 60 / + smoothing 0, spread 50`.
- NEW engine-mirror source pin (reads EfxPaintEngine.ts via `new URL`,
  sliced between `// Initialize engine state` and `// Bind event handlers`):
  `toContain('antiAlias: 1')` **FAILED** (engine had 0);
  `localSpreadStrength: 60` absent (50). `edgeDetail: 20` already held from
  Task 1, exactly as the plan predicts. 2 failed | 14 passed (16).

**GREEN 2 (`01ad76ef`)** — four values flipped (app smoothing/spread,
engine antiAlias/localSpreadStrength); settings test 16/16.

**Task 3 (`9014c4db`)** — label prop renamed, source-read pin
(`label="Blending"` + `id="physics-pickup"`) added; panel tests **17/17**
(16 existing + 1 new).

## Gates (all green)

- Full target set: settings 16/16 + panel 17/17 (app); shapeDetail 10/10 +
  spreadScale + physicsSettledFootprint + productionAaSettleMeasurement
  (25 passed | 3 skipped — pre-existing skips, zero edits to any of them).
- **Typecheck** `pnpm --filter efx-motion-editor typecheck`: 0 errors.
- **Scope guard** (`git diff --name-only c10d9a3d..HEAD` — 7 files, exactly
  the 6 planned sources + the RED-EVIDENCE record):
  `spreadScale.ts` / `spreadScale.test.ts` / `paint.ts` / `erase.ts` /
  `stroke.ts` / `util/math.ts` / the two battery harnesses /
  `package.json` / `pnpm-lock.yaml` / `ROADMAP.md`: **zero edits**.
- **`spreadCurveFor` byte-untouched** (260925-b7c law); `depositRoom` /
  `physicsTicks` / deform code untouched; engine null-fallback
  `pending.opts.edgeDetail ?? 50` (EfxPaintEngine.ts:2287) untouched.
- **Stored data untouched**: no migration, no persisted-value rewrite;
  roto-script `edgeDetail: 50` fixture literals
  (clipboard/schema/launch/palette/panel tests) all unchanged — verified by
  grep after GREEN: only the two default sites moved.
- **Battery contract**: `physicsSettledFootprint.test.ts` and
  `productionAaSettleMeasurement.test.ts` re-ran green with zero edits —
  their Spread-50 inputs remain fixed measurement conditions
  (260930-continuity); never re-mirrored.
- **Pickup stays 0** on both sides (`EfxPaintEngine.ts:611`,
  `physicsPaintStudioSettings.ts:33`); the rename touched only the `label`
  prop string — `id="physics-pickup"`, `value={pickup}`, `onChange`,
  `min`/`max` all untouched (static JSX prop; no signal/store/effect surface,
  per efx-preact-reactivity).

## Commits (5, measured `git rev-list --count c10d9a3d..HEAD`)

- `a2b7e79a` test: rebase shape-detail default pin to 20 (RED)
- `288f7571` feat: shape detail default 50 to 20 (GREEN)
- `247d5dc4` test: rebase spread/smoothing defaults + engine-mirror pin (RED)
- `01ad76ef` feat: spread default 60 + brush smoothing Soft (GREEN)
- `9014c4db` feat: rename pickup slider label to Blending

## Deviations from Plan

None material. One documented discretion the plan itself authorized: the
engine-mirror `antiAlias: 0→1` (scope note in Task 2's behavior block —
without it, Soft would be cosmetic). The engine-mirror pin slices the
initial-state block between the two marker comments rather than matching
whole-file substrings, so it pins the INIT state (not any later
`setAntiAlias` site).

## Native UAT rows — PENDING (user-side, nothing declared done before they pass)

| # | Row | Status |
|---|-----|--------|
| 1 | Fresh Studio opens with Shape detail 20, Blending 0, Spread 60, Brush smoothing Soft | pending |
| 2 | Label reads "Blending" | pending |
| 3 | Existing saved strokes render unchanged | pending |
| 4 | Spread 60–65 looks identical to before (new default lands inside the approved range) | pending |

## Known Stubs

None.

## Self-Check: PASSED

All 6 planned source files found; all 5 commit hashes present in history
(`a2b7e79a`, `288f7571`, `247d5dc4`, `01ad76ef`, `9014c4db`); SUMMARY.md
written at the plan-specified path with `status: complete` frontmatter.
