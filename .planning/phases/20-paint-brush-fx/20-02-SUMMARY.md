---
phase: 20-paint-brush-fx
plan: 02
subsystem: rendering
tags: [glsl, webgl2, spectral-mixing, kubelka-munk, simplex-noise, brush-fx, shaders]

# Dependency graph
requires: []
provides:
  - GLSL shader source strings for the brush FX rendering pipeline (brushFxShaders.ts)
  - Spectral pigment mixing via embedded spectral.glsl (38-band Kubelka-Munk)
  - Simplex 2D noise for procedural paper texture
  - Post-effect shaders for grain, edge darkening, bleed, and scatter
  - Build helper functions for shader concatenation
affects: [20-03, 20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: [spectral.glsl (embedded, MIT), ashima/webgl-noise simplex2D (embedded, MIT)]
  patterns: [shader-source-as-string-constants, build-helper-concatenation-for-glsl-includes]

key-files:
  created:
    - Application/src/lib/brushFxShaders.ts
  modified: []

key-decisions:
  - "Embedded spectral.glsl verbatim from canonical repo (296 lines) rather than hand-writing spectral math"
  - "Embedded ashima simplex noise verbatim rather than custom noise implementation"
  - "Used build helper functions (buildSpectralCompositeSrc, buildGrainPostSrc, etc.) for shader concatenation to avoid duplicating version/precision headers"
  - "Edge darken shader is self-contained (no noise dependency) while grain, bleed, and scatter require noise prepending"

patterns-established:
  - "Shader body constants (without version/precision) + build*() helpers for concatenated compilation"
  - "GLSL includes via string concatenation at compile time rather than runtime #include"

requirements-completed: [PAINT-06, PAINT-10]

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 20 Plan 02: GLSL Shader Sources Summary

**All GLSL shader source strings for the brush FX pipeline defined as TypeScript constants -- spectral.glsl 38-band Kubelka-Munk mixing, ashima simplex noise, and 5 post-effect shaders with build helpers**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T13:06:32Z
- **Completed:** 2026-03-25T13:13:34Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Embedded complete spectral.glsl (296 lines, MIT) from rvanwijnen/spectral.js for physically-correct Kubelka-Munk pigment mixing
- Embedded complete ashima/webgl-noise simplex 2D noise function for procedural paper texture
- Defined 10 exports: 3 vertex/stamp shaders, spectral GLSL constant, edge darken shader, simplex noise constant, and 4 build helper functions
- All shaders follow existing #version 300 es / precision highp float convention matching glBlur.ts and glslRuntime.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create brushFxShaders.ts with vertex, stamp, and spectral composite shaders** - `74f9629` (feat)
2. **Task 2: Add post-effect shaders (grain, edge darken, bleed) and simplex noise** - `60c02fa` (feat)

## Files Created/Modified
- `Application/src/lib/brushFxShaders.ts` - All GLSL shader source strings for the brush FX rendering pipeline (10 exports: BRUSH_FX_VERT_SRC, STAMP_VERT_SRC, STAMP_FRAG_SRC, SPECTRAL_GLSL, SIMPLEX_NOISE_GLSL, EDGE_DARKEN_POST_FRAG_SRC, buildSpectralCompositeSrc, buildGrainPostSrc, buildBleedPostSrc, buildScatterStampSrc)

## Decisions Made
- Embedded spectral.glsl verbatim (296 lines) from the canonical rvanwijnen/spectral.js repository rather than a subset. The latest v3 includes 2-color, 3-color, and 4-color mix overloads with tinting strength parameters -- all included for future flexibility.
- The plan referenced `spectral_linear_to_concentration` but the actual function in spectral.glsl v3 is `spectral_linear_to_reflectance`. Embedded the canonical source verbatim as required.
- Edge darken shader (EDGE_DARKEN_POST_FRAG_SRC) is exported as a complete shader string since it has no noise dependency, while grain/bleed/scatter bodies are kept as non-exported constants with build helpers for noise concatenation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed transcription typo in spectral.glsl R[19] line**
- **Found during:** Task 1
- **Issue:** `R[19] = vec3(...)` instead of `R[19] * vec3(...)` in spectral_reflectance_to_xyz
- **Fix:** Corrected `=` to `*` to match the canonical source
- **Files modified:** Application/src/lib/brushFxShaders.ts
- **Verification:** Compared against canonical source, confirmed correct operator
- **Committed in:** 74f9629 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Transcription error caught and fixed before commit. No scope creep.

## Issues Encountered
- TypeScript compilation check shows pre-existing errors from missing node_modules in worktree (no `pnpm install`). Verified no errors specific to brushFxShaders.ts by filtering tsc output.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All GLSL shader sources ready for import by brushFxRenderer.ts (plan 20-03)
- Build helpers handle version/precision concatenation cleanly
- spectral_mix(color1, color2, factor) overload available for the simple 2-color mixing case used in the composite shader

## Self-Check: PASSED

- FOUND: Application/src/lib/brushFxShaders.ts
- FOUND: commit 74f9629
- FOUND: commit 60c02fa
- FOUND: 20-02-SUMMARY.md

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
