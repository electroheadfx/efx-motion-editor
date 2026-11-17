---
phase: 64-medium-engine
plan: 04
subsystem: rendering
tags: [watercolor, webgl2, glsl, emboss, lighting, preact-signals, tdd, pixel-gate]

# Dependency graph
requires:
  - phase: 64-01
    provides: the committed neutral-identity pixel baseline and the medium-engine probe harness (paper, transparent and white exports digested)
  - phase: 64-02
    provides: the canonical `emboss` key in the aquarelle params bag and its ONE mapping into the engine params
  - phase: 64-03
    provides: the thickness deposit law (thickness = dab ink amount x emboss) and the probe `--emboss` knob
provides:
  - displayFS lit-thickness emboss term with the `- L.z` zero-gradient law, one `uFlat` gate and the mode-4 alpha exemption
  - Engine light state (`LightSettings`, `DEFAULT_LIGHT`, `setLight`/`getLight`) with the relief sampler bound at texture unit 7
  - the Emboss row completing the nine-row Paint-tab globals panel
  - the probe `--light <0..4>` knob and the `compare.mjs --differs-from` mode with committed-baseline-first resolution
  - byte-identity evidence: emboss 0 and light intensity 0 each reproduce the committed pre-milestone baseline; emboss 100 at intensity 1 changes all three exports; a repeat run is identical
affects: [64-05, 64-06, 64-07, 64-10, 64-12]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 13648
  tasks: 3
  commits: 4
plan_head_before: 15e8ba6083031c411b7a3ef931d0c5a4f9d59d6f
plan_head_after: 3f185b28bff8bfeb3d5045d9e0969333789a30e9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One document-texel central-difference normal lit by engine-held light state, shaded in exactly two places (rgb once for modes 0-3; mode 4 scales only the premultiplied pigment)"
    - "Light is render state: compared-then-written, clamped, never in the stroke payload, the params snapshot, the pigment, the thickness field or undo history"
    - "Pixel gates: identity against a committed baseline; visible change asserted positively through an all-digests-differ comparator mode"

key-files:
  created:
    - packages/efx-watercolor/src/playground/emboss.test.ts
    - .planning/phases/64-medium-engine/64-04-red-evidence-task1.json
  modified:
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/index.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/src/determinismContract.test.ts

key-decisions:
  - "DEFAULT_LIGHT is stored in degrees (129.8, 38.45, 1) and reconstructs normalize(vec3(-0.5, 0.6, 0.62)); only drawDisplay converts to radians"
  - "uReliefBump = 1.0, EMBOSS_GAIN = 2.0 and EMBOSS_SHADE_MAX = 1.5 are named constants; the bump is a fixed document-space scale, never zoom-dependent"
  - "The shade block skips texels with zero thickness (c > 0.0): no thickness casts no shade, and the identity laws hold"
  - "Mode 4 keeps its early return above `rgb *= shade;`, so alpha is derived from the unshaded reconstruction and only the premultiplied pigment is scaled"
  - "`--differs-from` prefers the committed baseline over /tmp so a gate proof cannot vanish with the temp directory; dimensions must agree, only the three digests must differ"
  - "The lit-emboss determinism row proves the light never enters the recorded stroke bag; the lit-vs-unlit pixel proof belongs to the probe matrix because the unit mock has no GPU"

patterns-established:
  - "Two-point shading: `rgb *= shade;` once after displayBasisGLSL for modes 0-3, and `pigment * alpha * shade` with an untouched alpha for mode 4"
  - "Light clamps: azimuth wraps ((x % 360) + 360) % 360, elevation 0..90, intensity 0..4, non-finite falls back to the default, compare-then-write then redraw"
  - "Comparator modes: baseline equality, same-session `--other`, committed-or-session `--differs-from`"

requirements-completed: [MED-15, MED-18]

coverage:
  - id: D1
    description: "Engine light state: LightSettings/DEFAULT_LIGHT exports, setLight clamps + idempotent write + redraw, getLight copy, and the four light uniforms set on every display draw with the relief sampler at unit 7"
    requirement: MED-15
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/emboss.test.ts#engine light state (MED-15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "displayFS lights the thickness field: one-texel central difference, - L.z zero-gradient identity, uFlat gates only the lit delta, mode-4 alpha untouched; emboss 0 and light intensity 0 are byte-identical to the pre-milestone baseline on paper/transparent/white, and a lit emboss changes all three"
    requirement: MED-15
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/emboss.test.ts#displayFS emboss block (MED-15)"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --emboss 0 && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --emboss 100 --light 0 && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate emboss-lit --emboss 100 && node packages/efx-watercolor/probe/medium-engine/compare.mjs emboss-lit --differs-from neutral-identity"
        status: pass
    human_judgment: false
  - id: D3
    description: "Emboss is the ninth globals row in the Paint tab and travels the canonical emboss key through the existing setter; Reset covers it and never writes size or lift"
    requirement: MED-18
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts#renders nine slider rows below the dropdown, Emboss last"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live body: raising Emboss makes a thick stroke read as raised (a lit lip at the edge is expected), and zooming or panning over it never shimmers or crawls"
    requirement: MED-15
    verification: []
    human_judgment: true
    rationale: "Visual judgment on the live WebGL sheet: no automated probe can see shimmer or crawl under zoom/pan, and the lit-lip look is a tuning call for the human UAT."

# Metrics
duration: ~1h 12m
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 04: Medium Engine — emboss lighting and the Emboss row Summary

**Paint thickness now reads as a lit emboss with engine-held light state, proven byte-identical at emboss 0 and light intensity 0 and visibly changed when lit**

## Performance

- **Duration:** ~1h 12m
- **Started:** 2026-11-17T14:42:52Z
- **Completed:** 2026-11-17T15:54:55Z
- **Tasks:** 3
- **Files modified:** 10 product/test files (plus the committed RED evidence record)

## Accomplishments

- `displayFS` derives a one-document-texel central-difference normal from the thickness field (`uRelief`, texture unit 7), lights it with `uLightAzimuth`/`uLightElevation`/`uLightIntensity`, and multiplies the reconstructed paint colour by `shade`, which is exactly 1.0 at a zero gradient or at intensity 0 because of the `dot(n, L) - L.z` subtraction. `uFlat` gates only the lit delta, so a region pick reads the unshaded sheet.
- Mode 4 (pigment alpha) derives alpha from the unshaded `toSRGB(rgb)` and scales only the premultiplied pigment, leaving the alpha channel byte-for-byte unchanged; modes 0-3 shade `rgb` once before the gouache mix.
- `Engine` owns the light state: `LightSettings` in degrees, `DEFAULT_LIGHT = { azimuth: 129.8, elevation: 38.45, intensity: 1 }` (reconstructs `normalize(vec3(-0.5, 0.6, 0.62))`), an idempotent `setLight` that wraps/clamps, falls back to the default on non-finite input, redraws only on a real change and never touches params, pigment, the thickness field or undo; `getLight` returns a copy. Both are exported from the package barrel.
- The Paint tab now carries the `Emboss` row after `Viscosity` (nine globals below the medium dropdown), writes the canonical `emboss` key through the existing `setAquarelleParam`, and Reset covers it through the one batch while never writing `size` or `lift`.
- Both byte-identity gates and the visible change are proven in real headless-WebGL2 Chrome against the committed baseline: emboss 0 equals it, emboss 100 at intensity 0 equals it, emboss 100 at the default intensity differs on all three exports, and a repeat run is byte-identical.
- The comparator gained `--differs-from` (committed baseline first, then same-session, then a named error) so later gates assert a visible change positively instead of through a negated command.

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine light state and the emboss term (RED)** - `fbd1e74f1` (test)
2. **Task 1: Engine light state and the emboss term (GREEN)** - `f1318eada` (feat)
3. **Task 2: The Emboss row completes the Paint tab** - `4ec7dd277` (feat)
4. **Task 3: Prove the byte-identity gates and the visible body** - `3f185b28b` (feat)

_Note: Task 1 was a TDD task, so it has the test → feat pair. No REFACTOR commit was needed._

## Files Created/Modified

- `packages/efx-watercolor/src/playground/emboss.test.ts` - 12 source-scan pins: the five thickness samples, the central-difference normal, the `- L.z` law, the unit-7 binding, the `uFlat` gate, the mode-4 unshaded alpha, the light setter's clamps/idempotence/sole-writer status, the document-space zoom law and the barrel exports
- `packages/efx-watercolor/src/playground/shaders.ts` - `uRelief` + four light uniforms, `EMBOSS_GAIN`/`EMBOSS_SHADE_MAX`, the shade block, `rgb *= shade;`, and the mode-4 branch moved above it with the unshaded alpha
- `packages/efx-watercolor/src/playground/Engine.ts` - `RELIEF_BUMP`, `LightSettings`/`DEFAULT_LIGHT`, the `light` field, `setLight`/`getLight`, and the drawDisplay bindings (unit 7 + four uniforms + one degrees-to-radians boundary)
- `packages/efx-watercolor/src/playground/index.ts` - barrel exports for `DEFAULT_LIGHT` and `LightSettings`
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` - the `Emboss` row appended to `GLOBAL_ROWS` (nine globals; Body slots in later)
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` - nine labels incl. Emboss, Reset covers emboss and never size/lift, order assertions updated
- `packages/efx-watercolor/probe/medium-engine/probe.ts` - `--light` knob applied via `engine.setLight({ intensity })` before the three exports; the report echoes it
- `packages/efx-watercolor/probe/medium-engine/run.mjs` - `--light <0..4>` parsing, page query and summary line
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` - `--differs-from` mode (committed baseline preferred, same-session fallback, named error otherwise); dimensions must agree; all three digests must differ
- `packages/efx-watercolor/src/determinismContract.test.ts` - one lit-emboss determinism row at intensity 0 and at `DEFAULT_LIGHT.intensity`
- `.planning/phases/64-medium-engine/64-04-red-evidence-task1.json` - the validated RED evidence record

## Decisions Made

- **Degrees at rest, radians at the GPU boundary.** `LightSettings` stores degrees; only `drawDisplay` converts, pinned by exactly two `Math.PI) / 180` occurrences in that method and no `radians(` in the shader.
- **Named shading constants.** `uReliefBump = 1.0`, `EMBOSS_GAIN = 2.0`, `EMBOSS_SHADE_MAX = 1.5`, recorded in the displayFS module comment; the bump never depends on zoom.
- **Zero thickness casts no shade.** The `c > 0.0` guard gives the centre sample a job while satisfying the plan's five-read cost note; a flat field still tilts to `(0, 0, 1)` and shades to exactly 1.0.
- **Mode 4 before the shade.** Moving the mode-4 early return above `rgb *= shade;` lets alpha come from the unshaded reconstruction while only `pigment * alpha` is scaled — the plan's acceptance criterion.
- **Comparator resolution order.** `--differs-from` prefers `baselines/<name>.json`, then `/tmp/medium-engine/<name>.json`, then a named error; documented once in the usage comment for 64-06 and 64-10.
- **What the unit row can honestly prove.** The mocked engine has no GPU, so the determinism row pins that the light never enters the recorded stroke bag at either intensity; the real lit-vs-unlit byte proof is the probe matrix.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED: `fbd1e74f1` `test(64-04): add failing test for the emboss term and light state` — 11/11 tests failed on their planned source pins; `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- GREEN: `f1318eada` `feat(64-04): light the thickness field with an engine-held light state` follows the RED commit.
- REFACTOR: not required.
- No gate violations.

## Probe matrix (headless Chrome, real WebGL2, 256x256, fixed seeded script)

| Gate | emboss | light intensity | digestPaper | digestTransparent | digestWhite | Comparison | Result |
|------|--------|-----------------|-------------|-------------------|-------------|------------|--------|
| neutral-identity | 0 | default (1) | d2bd637a | 291d4a11 | 6ba88334 | committed baseline (d1fd7ea3c) | PASS — all 6 fields equal |
| neutral-identity | 100 | 0 | d2bd637a | 291d4a11 | 6ba88334 | committed baseline (d1fd7ea3c) | PASS — all 6 fields equal |
| emboss-lit | 100 | default (1) | 21c55870 | 2f0e26da | 2ea31218 | `--differs-from neutral-identity` (resolved to the committed baseline) | PASS — all 3 digests differ |
| emboss-lit-repeat | 100 | default (1) | 21c55870 | 2f0e26da | 2ea31218 | `--other emboss-lit` (same session) | PASS — all 6 fields equal |

Negative checks of the new operand: a gate compared with `--differs-from` itself fails (3 digests equal), a name present in neither baselines nor /tmp errors with the named message, and an unknown flag exits 2.

## Issues Encountered

- **RED report format.** The first RED capture was rejected as `INVALID_RED` because `expect(source).toContain(...)` dumped multi-line shader sources into the TAP `actual:` field, and a regex literal with `\{` broke the YAML diagnostic. Resolved with one-line boolean message helpers (`expectContains`/`expectNotContains`/`expectMatches`) and `pnpm --silent` to keep the pnpm banner out of the report; the validated record is committed.
- **zsh `PIPESTATUS`.** Capturing a piped `tsc --noEmit` exit code through `${PIPESTATUS[0]}` returned empty under zsh; re-ran `tsc` with output redirected to a log and captured `$?` directly (exit 0, zero lines).
- **Comment/test collision.** The `setLight` doc comment originally said the thickness "deposit" is never touched, and the test slices the setter body and forbids the substring `deposit`; reworded the comment to "thickness field" without changing behaviour.

## Declared behaviours for the human UAT

- An edge is thinner than the core by construction, so **a lit lip at the stroke edge is expected** — tune the intensity, never treat it as a defect.
- **Thickness never changes colour, absorbance or hue**, only the lit term.
- **Pen strokes stay flat** (D-12).
- **Zoom/pan no-shimmer row:** with a thick, strongly embossed stroke on screen, zoom in and out and pan across the sheet; the lighting must not shimmer or crawl (the gradient is one document texel, pinned structurally by the source scan).
- **Visible body row:** raise Emboss on a thick stroke and confirm the paint reads as raised in the live sheet.

## Known Stubs

None — no hardcoded empty values, placeholder text, mock data sources or skipped tests were introduced.

## Next Phase Readiness

- 64-05 and 64-06 can rely on the shading law and the nine-row panel; 64-06 slots `Body` between `Viscosity` and `Emboss` as planned.
- 64-07 still owns wiring `engine.setLight(...)` through the adapter/app options — the engine surface is ready and tested.
- 64-10 and 64-06 can consume `compare.mjs --differs-from` as documented; the probe `--light` knob is available for any gate that needs a non-default intensity.
- The live body and no-shimmer rows are listed above for human UAT.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `emboss.test.ts`, `64-04-red-evidence-task1.json`, `compare.mjs`, `64-04-SUMMARY.md`
- Commits present and ancestors of HEAD: `fbd1e74f1`, `f1318eada`, `4ec7dd277`, `3f185b28b`
