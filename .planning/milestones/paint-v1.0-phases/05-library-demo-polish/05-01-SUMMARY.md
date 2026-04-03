---
phase: 05-library-demo-polish
plan: 01
subsystem: library
tags: [tsup, typescript, esm, npm-package, color-conversion, noise, math]

# Dependency graph
requires:
  - phase: 04.1-physics-simulation-fix-load-render-fidelity
    provides: Working v3.html monolith with all physics, brush, and rendering code
provides:
  - "@efxlab/efx-physic-paint package.json with dual exports (index + preact sub-path)"
  - "tsup build config producing ESM-only dist/index.mjs and dist/preact.mjs"
  - "Complete types.ts rewritten from v3 code (EngineConfig, WetBuffers, PaintStroke, etc.)"
  - "util/color.ts with 7 color functions (hexRgb, rgbHex, rgb2hsl, hsl2rgb, rgb2ryb, ryb2rgb, mixSubtractive)"
  - "util/noise.ts with deterministic FBM noise (noise, fbm)"
  - "util/math.ts with 10 math functions (gauss, lerp, dist, distXY, clamp, curveBounds, polyBounds, pt2arr, ptsToArrs, lerpPt)"
  - "Paper texture and brush texture assets in public/img/"
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: [tsup 8.5.1, preact 10.29.0 (peerDep), vite 8.0.3, @preact/preset-vite 2.10.5]
  patterns: [ESM-only output, dual entry points, tsconfig.build.json for dts, peerDependency for framework]

key-files:
  created:
    - paint-rebelle-new/package.json
    - paint-rebelle-new/tsconfig.build.json
    - paint-rebelle-new/tsup.config.ts
    - paint-rebelle-new/vite.config.ts
    - paint-rebelle-new/src/index.ts
    - paint-rebelle-new/src/preact.tsx
    - paint-rebelle-new/src/util/color.ts
    - paint-rebelle-new/src/util/noise.ts
    - paint-rebelle-new/src/util/math.ts
    - paint-rebelle-new/.gitignore
  modified:
    - paint-rebelle-new/tsconfig.json
    - paint-rebelle-new/src/types.ts

key-decisions:
  - "Package exports use .d.ts (not .d.mts) to match tsup actual output"
  - "Added pnpm.onlyBuiltDependencies for esbuild postinstall script approval"
  - "curveBounds takes canvasW/canvasH params instead of v3 globals W/H for library portability"
  - "math.ts includes 10 functions (plan specified 9+) -- added pt2arr and ptsToArrs as pen point helpers"

patterns-established:
  - "Named exports only (no default exports) for all utility modules"
  - "JSDoc comments with v3.html line references for traceability"
  - "Explicit return types on all exported functions"
  - "util/ modules are pure functions with zero side effects"

requirements-completed: [LIB-01, LIB-02]

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 5 Plan 01: Package Scaffold + Types + Utilities Summary

**@efxlab/efx-physic-paint package scaffolded with tsup ESM build, complete v3-accurate types.ts, and 19 typed utility functions extracted from v3.html**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T15:57:56Z
- **Completed:** 2026-03-31T16:05:21Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Package manifest with dual exports (`.` for core, `./preact` for wrapper), ESM-only tsup build producing dist/index.mjs and dist/preact.mjs
- Complete types.ts rewritten from scratch per D-04 -- all v3-accurate types including WetBuffers (Float32Array), DryingLUT, DiffusionParams, PaintStroke, SerializedProject, EngineState
- 19 typed utility functions extracted across 3 modules: 7 color (RYB subtractive mixing pipeline), 2 noise (deterministic FBM), 10 math (including PenPoint interpolation)
- Paper textures (3 jpg) and brush texture (1 png) copied to public/img/ for demo app

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold package, install deps, configure build tooling, copy assets** - `edfe9d3` (feat)
2. **Task 2: Rewrite types.ts from scratch + extract all utility modules from v3** - `fc4fa21` (feat)

## Files Created/Modified
- `paint-rebelle-new/package.json` - @efxlab/efx-physic-paint manifest with exports field
- `paint-rebelle-new/tsconfig.json` - Updated with jsx/jsxImportSource for Preact
- `paint-rebelle-new/tsconfig.build.json` - Build-specific config for tsup dts generation
- `paint-rebelle-new/tsup.config.ts` - Two-entry ESM-only bundler config
- `paint-rebelle-new/vite.config.ts` - Demo dev server config (port 5173)
- `paint-rebelle-new/src/index.ts` - Library entry point (stub, re-exports types)
- `paint-rebelle-new/src/preact.tsx` - Preact wrapper entry (stub for plan 04)
- `paint-rebelle-new/src/types.ts` - Complete v3-accurate type definitions
- `paint-rebelle-new/src/util/color.ts` - 7 color conversion functions (hex, HSL, RYB, subtractive mix)
- `paint-rebelle-new/src/util/noise.ts` - Deterministic value noise + FBM
- `paint-rebelle-new/src/util/math.ts` - 10 math utilities (gauss, lerp, dist, bounds, PenPoint helpers)
- `paint-rebelle-new/.gitignore` - Excludes dist/ and node_modules/
- `paint-rebelle-new/public/img/paper_{1,2,3}.jpg` - Paper texture assets (512x512)
- `paint-rebelle-new/public/img/brush_texture.png` - Brush texture mask (512x512)

## Decisions Made
- **Package exports use .d.ts instead of .d.mts:** tsup with `outExtension: () => ({ js: '.mjs' })` produces `.d.ts` files, not `.d.mts`. Updated exports field to match actual output.
- **Added pnpm.onlyBuiltDependencies:** esbuild requires a postinstall script for platform-specific binary. Added config to package.json to approve it non-interactively.
- **curveBounds parameterized:** v3.html uses globals W/H for canvas bounds clamping. Library version takes canvasW/canvasH as parameters (defaulting to 1000/650) for portability.
- **10 math functions (exceeds plan's 9+):** Included pt2arr and ptsToArrs alongside the 8 specified functions, as they are used by brush stroke processing in upcoming plans.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] esbuild postinstall script approval**
- **Found during:** Task 1 (pnpm install)
- **Issue:** pnpm 10.x blocks postinstall scripts by default; esbuild needs its postinstall to install platform binary
- **Fix:** Added `pnpm.onlyBuiltDependencies: ["esbuild"]` to package.json
- **Files modified:** paint-rebelle-new/package.json
- **Verification:** pnpm install completes successfully, tsup build works
- **Committed in:** edfe9d3 (Task 1 commit)

**2. [Rule 1 - Bug] Package exports .d.mts vs .d.ts mismatch**
- **Found during:** Task 1 (build verification)
- **Issue:** Plan specified .d.mts in exports but tsup produces .d.ts files
- **Fix:** Updated package.json exports to reference .d.ts instead of .d.mts
- **Files modified:** paint-rebelle-new/package.json
- **Verification:** Build produces files matching exports field paths
- **Committed in:** edfe9d3 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct package operation. No scope creep.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| src/index.ts | 3 | `// EfxPaintEngine will be added in plan 03` | Intentional -- engine class not yet implemented |
| src/preact.tsx | 1 | `export {}` | Intentional -- Preact wrapper deferred to plan 04 |

These stubs do not prevent plan 01's goal (foundation scaffolding). They will be resolved in plans 03 and 04.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Package foundation complete with working build pipeline
- types.ts provides all type contracts for core module extraction (plan 02)
- Utility modules (color, noise, math) ready for import by core and brush modules
- Image assets available for demo app development (plan 04)

## Self-Check: PASSED

All 14 created/modified files verified present. Both task commits (edfe9d3, fc4fa21) verified in git log.

---
*Phase: 05-library-demo-polish*
*Completed: 2026-03-31*
