---
phase: 64-medium-engine
plan: 07
subsystem: rendering
tags: [watercolor, emboss-light, render-path, bake-adapter, content-signature, preact-signals, tdd]

# Dependency graph
requires:
  - phase: 64-04
    provides: the engine light state (`LightSettings`, `DEFAULT_LIGHT`) and the idempotent `setLight` clamp law
  - phase: 64-05
    provides: the durable per-document `light` member on the paint-layer record and its ONE `setDocumentLight` mutation
provides:
  - the adapter `light?: LightSettings` option, applied once before the first `applyStroke` (one pass-through, never a clamp)
  - `light` on `bakeAquarelleEventsToFrame`, `applyAquarelleEventsToKey` and `RotoRevealRenderInput`, forwarded into every adapter they create
  - the live sheet's per-frame light apply inside `applyLiveConfig`, through an identity-stable `getLight` getter ref
  - the Studio's `documentLight()` render-time resolution and `handleDocumentLightChange` (one `setDocumentLight` write + one ledger descriptor, ready for 64-09's controls)
  - the content signature's `lightSignature` term (absent and explicit-default both canonicalize to `'default'`)
  - the snapshot controller's render-setting contract comment plus its two-direction executable row
affects: [64-09, 64-10, 64-12]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 17409
  tasks: 2
  commits: 4
plan_head_before: 99c07187cf6e063e36828f4a8b30734f22c37552
plan_head_after: a4931014358bcd9bd7dcbd21a370c908c0c7a7cd

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-time resolution, never a copied prop: every bake calls `documentLight()` at its own call site, which reads `launchContextRef.current?.layerId` and `getEfxPaintDocument(layerId)?.light` at call time — a memo cache hit holding a previous render's closure still resolves the current document"
    - "Getter-ref seam through the canvas stack: the Studio hands `getAquarelleLight` as a getter (never a value, never in a memo dependency list); the mount mirrors it into a ref per render and forwards a closure; `AquarelleCanvasLayer` reads `getLightRef.current` inside both `applyLiveConfig` calls, so the per-frame apply sees the current document with zero re-mounts"
    - "Pass-through light on the bake adapter: `createAquarelleEngineAdapter` calls `engine.setLight({ ...options.light })` exactly once, before the first stroke, and never clamps — the engine setter owns every band"
    - "Signature canonicalization: `lightSignature(undefined) === lightSignature(DEFAULT_LIGHT) === 'default'`, so a missing light and an explicit default never alternate between two signatures for identical pixels"

key-files:
  created:
    - app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts
    - .planning/phases/64-medium-engine/64-07-red-evidence-task1.json
    - .planning/phases/64-medium-engine/64-07-red-evidence-task2.json
    - .planning/phases/64-medium-engine/deferred-items.md
  modified:
    - packages/efx-watercolor/src/adapter/engineAdapter.ts
    - packages/efx-watercolor/src/adapter/engineAdapter.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx
    - app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx
    - app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts
    - app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts

key-decisions:
  - "`lightSignature` lives exported in `engine/physicsPaintStudioSettings.ts`, not as a local in the Studio: the plan's behavioral RED row must import and call it, and `PhysicsPaintStudio.tsx` is source-pinned text only in the node vitest env (never imported)"
  - "An explicit `DEFAULT_LIGHT` canonicalizes to the same `'default'` token as an absent light (equality against the package's `DEFAULT_LIGHT`), satisfying 'a missing light and the default light never alternate between two signatures for the same pixels'"
  - "`handleDocumentLightChange` is declared now but marked `void` until 64-09 threads it into `rightPanelProps`: the plan forbids adding the key early (the panel's prop interface arrives with 64-09), and `noUnusedLocals` would otherwise fail the typecheck"
  - "The signature stays a single-expression template literal: `${aquarelleStrokesRevision.peek()}|${lightSignature(documentLight())}`, so the existing memo-stability and same-value-write contracts are untouched"

patterns-established:
  - "A persisted render setting is applied on every render path at call time (live per frame, each bake at adapter creation), never copied into a stroke, a params bag or a prop value"
  - "Render settings join the content signature through a canonical formatter, so a same-value write produces a null descriptor and an unchanged signature"

requirements-completed: [MED-17]

coverage:
  - id: D1
    description: "The adapter applies an optional light exactly once, before the first stroke; an adapter created without one never calls `setLight`; an out-of-band light reaches the engine unmodified (the engine setter owns the clamp)"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#applies a provided light exactly once, before the first stroke"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#never calls setLight when no light is provided"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#passes an out-of-band light through unmodified (the engine setter owns the clamp)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both bake helpers (`bakeAquarelleEventsToFrame`, `applyAquarelleEventsToKey`) and `RotoRevealRenderInput` accept the light and forward it into the adapter they create; all three Studio bake call sites and both store render calls carry the document light"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#RESOLVE: the Studio reads the ACTIVE layer document and passes it everywhere"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#STORE: both reveal render entry points carry the document light"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts + pnpm --filter @efxlab/efx-watercolor build"
        status: pass
    human_judgment: false
  - id: D3
    description: "The live sheet applies the layer document's light inside `applyLiveConfig` on mount and per frame, from a getter ref (prop `getLight`, mirrored per render, both `applyLiveConfig` call sites), with no light signal and no light copy"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#LIVE: the sheet applies the light inside applyLiveConfig, from a getter ref"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#MOUNT: the canvas mount forwards the light getter through a ref"
        status: pass
    human_judgment: false
  - id: D4
    description: "The light never enters a stroke payload or the per-stroke params bag: no construction site in the Studio, the store or the stroke seams mentions it"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#NO LEAK: no stroke payload or params-bag construction site mentions the light"
        status: pass
    human_judgment: false
  - id: D5
    description: "A light change rotates the Studio content signature and a same-value write does not — proven both in source pins and behaviorally through the snapshot controller, whose contract comment now names render-setting changes"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts#64-07: a render-setting change rotates the signature; the same signature twice does not"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#SIGNATURE: the Studio content fingerprint carries the light term"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#SIGNATURE BEHAVIOR: two triples differ; the same triple twice is one"
        status: pass
    human_judgment: false
  - id: D6
    description: "No retyped defaults: absent light and explicit `DEFAULT_LIGHT` both produce the `'default'` signature token and a document without a light leaves the engine default in force (no `setLight` call, byte-identical to the 64-01 baseline on that path)"
    requirement: MED-17
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts#SIGNATURE BEHAVIOR (undefined and DEFAULT_LIGHT both 'default')"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/adapter/engineAdapter.test.ts#never calls setLight when no light is provided"
        status: pass
    human_judgment: false
  - id: D7
    description: "Live UAT: a light slider gesture repaints the sheet without waiting for a stroke, produces one ledger entry per gesture, every Play/Apply bake uses the new light, and two paint layers keep independent lights"
    requirement: MED-17
    verification: []
    human_judgment: true
    rationale: "The wiring is pinned (D1-D6), but the controls land in 64-09 and only a live Studio session can prove the visible repaint, the single-undo gesture and per-layer independence — the node vitest env cannot mount the canvas."

# Metrics
duration: ~2h10m
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 07: Medium Engine — The document light on every render path Summary

**The paint-layer document's emboss light now reaches the live sheet every frame and every Play/Apply/stroke-edit bake at adapter creation, and rotates the content signature, while never entering a stroke payload**

## Performance

- **Duration:** ~2h10m
- **Started:** 2026-11-17T14:42:53Z
- **Completed:** 2026-11-17T16:53:00Z
- **Tasks:** 2
- **Files modified:** 13 product/test files (plus two committed RED evidence records)

## Accomplishments

- `createAquarelleEngineAdapter` gained `light?: LightSettings`, applied inside the existing creation block immediately after the paper and `paperTexture` writes: `engine.setLight({ ...options.light })`, exactly once, before the first `applyStroke`, with the value passed through unmodified — no hand clamp, no manufactured default, no adapter `setLight` member.
- `bakeAquarelleEventsToFrame` and `applyAquarelleEventsToKey` accept `light` and forward it through `createDefaultAquarelleAdapter(size, paper?, light?)`; `RotoRevealRenderInput` carries it into the reveal renderer's adapter creation. Both are plain pass-throughs.
- `AquarelleCanvasLayer` gained the `getLight?: () => LightSettings | undefined` prop following the `getPaperId` getter idiom — ref mirrored every render, never a memo dependency — and `applyLiveConfig(engine, getLight?)` reads it and calls `engine.setLight(light)` only when a value exists, so both the mount call and the per-frame call cover it; 64-04's compare-then-write makes the per-frame cost three numeric comparisons.
- `PhysicsPaintCanvasMount` forwards the getter through a ref (the Studio has no direct `<AquarelleCanvasLayer>` seam), and the Studio passes `getAquarelleLight: documentLight` inside its existing stable memo object without touching the deps array.
- The Studio resolves the light at render time through `documentLight()` — `launchContextRef.current?.layerId` then `getEfxPaintDocument(layerId)?.light` — feeding the apply-to-key call and both bake calls; `physicPaintStore` passes `light: document.light` to both `renderRotoRevealFrames` calls; the resolution is always by layer id at the call site, never project-wide.
- `handleDocumentLightChange(patch)` performs the ONE write: `setDocumentLight(layerId, patch)` and, when the result carries a descriptor, `rotoMoveHistory.recordBackgroundEdit(result.descriptor)` — ready for 64-09 to thread into the panel.
- The content signature became `` `${aquarelleStrokesRevision.peek()}|${lightSignature(documentLight())}` `` with `lightSignature` exported from `engine/physicsPaintStudioSettings.ts`; absent and explicit-default light both canonicalize to `'default'`, so pixels never alternate between two signatures for the same light. The snapshot controller's contract comment now names render-setting changes, and its new row proves both directions (a change is dirty, the same signature twice is not).

## Task Commits

Each task was committed atomically:

1. **Task 1: Carry the light into the adapter and both bake entry points (RED)** - `bf8c89341` (test)
2. **Task 1: Carry the light into the adapter and both bake entry points (GREEN)** - `f775ea234` (feat)
3. **Task 2: Resolve the light at render time (RED)** - `b52003233` (test)
4. **Task 2: Resolve the light at render time (GREEN)** - `a49310143` (feat)

_Note: Both tasks were TDD tasks, so each has the test → feat pair. No REFACTOR commit was needed._

## Files Created/Modified

- `packages/efx-watercolor/src/adapter/engineAdapter.ts` - the `light?: LightSettings` option and its one `engine.setLight({ ...options.light })` write after the paper block
- `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` - the 64-07 describe with a recording stub engine (`vi.doMock` + `resetModules` per test): applied once before `scriptBegin`, never when absent, out-of-band passed through unmodified
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` - `light?: LightSettings` on both bake inputs, `createDefaultAquarelleAdapter` third parameter forwarded beside `paperPreset`/`paperStrength`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` - `light` on `RotoRevealRenderInput`, passed into `createAquarelleEngineAdapter`
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` - the `getLight` prop, its ref + per-render mirror, `applyLiveConfig(engine, getLight?)`'s `const light = getLight?.(); if (light) engine.setLight(light);`, and both call sites
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` - the `getAquarelleLight` prop/ref/mirror and the forwarding `getLight` closure (unplanned file — see Deviations)
- `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts` - the exported `lightSignature` canonicalizer importing `DEFAULT_LIGHT` (unplanned file — see Deviations)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `documentLight()`, `handleDocumentLightChange` (+ its temporary `void` marker), `light: documentLight()` at all three bake call sites, `getAquarelleLight: documentLight` in the canvas memo object, the signature light term, and the `setDocumentLight`/`lightSignature` imports
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - the two source pins updated to the light-bearing signature expression and the extended mount type import
- `app/src/stores/physicPaintStore.ts` - `light: document.light` in `commitRevealBake` and `renderRevealTailFrames`
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts` - the `getContentSignature` contract comment extended to render-setting changes
- `app/src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts` - the two-direction signature row through the existing harness
- `app/src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts` - 8 source-pin tests (LIVE, MOUNT, RESOLVE ×2, STORE, SIGNATURE, SIGNATURE BEHAVIOR, NO LEAK) plus the behavioral signature row
- `.planning/phases/64-medium-engine/64-07-red-evidence-task1.json` / `...-task2.json` - the validated RED evidence records
- `.planning/phases/64-medium-engine/deferred-items.md` - the out-of-scope `bakeAquarelleScript` discovery

## Decisions Made

- **`lightSignature` in the settings module, not a Studio local.** The plan says "a small local `lightSignature`", but the behavioral RED row must import and call the function; the Studio is source-pinned text only (the app's vitest is a node env and never imports the component). `engine/physicsPaintStudioSettings.ts` is already imported by both the Studio and its tests, so the canonicalizer lives there and the Studio imports it.
- **Explicit `DEFAULT_LIGHT` maps to `'default'`.** Comparing all three fields against the package's `DEFAULT_LIGHT` satisfies the plan's requirement that a missing light and the default light never alternate between two signatures for the same pixels.
- **The `void handleDocumentLightChange;` marker is temporary.** The plan requires the handler now but forbids threading it into `rightPanelProps` (64-09 owns the panel and its prop interface); `noUnusedLocals` would otherwise fail. Repo precedent: `void volumePercent;` (AudioProperties.tsx:74) and `void railId;` (railMotionIdentity.ts:411).
- **The canvas getter travels through the mount, not the Studio.** `<AquarelleCanvasLayer>` is rendered by `PhysicsPaintCanvasMount`, so the getter seam lives in the mount; the Studio's memo object gains the getter without a deps-array change (a getter is identity-stable here because it reads refs/current state at call time).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `lightSignature` exported from `engine/physicsPaintStudioSettings.ts` instead of a Studio-local function**
- **Found during:** Task 2
- **Issue:** The plan names "a small local `lightSignature`" in the Studio, but the same task's RED requirements demand a behavioral row that calls the function; `PhysicsPaintStudio.tsx` cannot be imported by the node-env vitest suite (source pins only), so a module-local function would make the behavioral row impossible.
- **Fix:** Exported `lightSignature(light: PaintDocumentLight | undefined): string` from the existing settings module, importing `DEFAULT_LIGHT` as the one canonical default; the Studio imports it into the signature expression.
- **Files modified:** `app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** `aquarelleLightRenderPaths.test.ts#SIGNATURE BEHAVIOR` (both directions + default canonicalization) and `physicsPaintStudioSettings.test.ts` (14 tests) green.
- **Committed in:** `a49310143` (part of Task 2 commit)

**2. [Rule 3 - Blocking] The light getter threads through `PhysicsPaintCanvasMount.tsx`**
- **Found during:** Task 2
- **Issue:** The plan says to pass `getLight={documentLight}` into the `<AquarelleCanvasLayer>` mount props in the Studio, but the Studio has no direct layer mount — `PhysicsPaintCanvasMount` renders `AquarelleCanvasLayer`, and no seam existed to hand the getter across.
- **Fix:** Added `getAquarelleLight?: () => LightSettings | undefined` to the mount, mirrored into a ref on every render, forwarded as `getLight={() => getAquarelleLightRef.current?.()}`; the Studio passes `getAquarelleLight: documentLight` in its existing memo object (deps unchanged).
- **Files modified:** `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`, `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** `aquarelleLightRenderPaths.test.ts#MOUNT` and `#RESOLVE` green; `tsc --noEmit` exit 0.
- **Committed in:** `a49310143`

**3. [Rule 3 - Blocking] `void handleDocumentLightChange;` keeps the typecheck green until 64-09**
- **Found during:** Task 2
- **Issue:** The plan mandates adding `handleDocumentLightChange` while forbidding its use in `rightPanelProps` early ("the panel that consumes them and its prop interface arrive together in 64-09"); with `noUnusedLocals: true` the handler failed TS6133.
- **Fix:** Added `void handleDocumentLightChange;` with a comment naming 64-09 as the consumer, following the repo's existing `void`-marker precedent.
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- **Verification:** `tsc --noEmit` exit 0.
- **Committed in:** `a49310143`

**4. [Rule 1 - Bug] Two Studio source pins updated for the required source changes**
- **Found during:** Task 2 verification
- **Issue:** `PhysicsPaintStudio.test.ts` pinned the pre-light signature expression (line ~4061) and the old mount type import line (line ~6560); the plan's required signature term and `LightSettings` import broke both pins.
- **Fix:** Updated both pins to the new exact source (light-bearing signature expression; `import type { AquarelleStroke, LightSettings, VectorAnchor } from '@efxlab/efx-watercolor';`).
- **Files modified:** `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- **Verification:** the full 433-test Studio suite green.
- **Committed in:** `a49310143`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** All four were necessary to make the plan's own requirements executable and type-safe; no scope creep. Two files outside the plan's `files_modified` were touched (`PhysicsPaintCanvasMount.tsx`, `physicsPaintStudioSettings.ts`) plus the Studio's pin test.

## TDD Gate Compliance

- RED: `bf8c89341` `test(64-07): add failing adapter-light tests for the bake seams` — `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target "applies a provided light exactly once, before the first stroke", exit 1).
- GREEN: `f775ea234` `feat(64-07): apply the document light in every bake adapter` follows the RED commit.
- RED: `b52003233` `test(64-07): add failing render-path light tests and the signature contract row` — `RED_EVIDENCE_OK` (target "LIVE: the sheet applies the light inside applyLiveConfig, from a getter ref", exit 1).
- GREEN: `a49310143` `feat(64-07): resolve the document light at render time and rotate the content signature` follows.
- REFACTOR: not required.
- No gate violations.

## Verify chain (passed end to end)

`pnpm --filter @efxlab/efx-watercolor exec vitest run src/adapter/engineAdapter.test.ts` (30 passed, 8 pre-existing GPU pins skipped) && `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts` (9 passed) && `pnpm --filter @efxlab/efx-watercolor build` (exit 0) && `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/aquarelleLightRenderPaths.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/snapshot/studioScriptSnapshotController.test.ts` (534 passed) && `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.test.ts` (132 passed) && `pnpm --filter efx-motion-editor exec tsc --noEmit` (exit 0) && `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/` (17 files / 266 tests passed).

## Issues Encountered

- **RED TAP size.** The first Task 2 test version used `expect(layer).toContain(...)`; on failure vitest dumps the entire ~10k-line source as "actual", producing a 2.1 MB TAP that the RED classifier rejects. Rewrote every pin as a boolean assertion (`expect(has(layer, '...')).toBe(true)`, `expect(count(...)).toBe(2)`) — identical semantics, 14 KB TAP, `RED_EVIDENCE_OK`.
- **Behavioral import at RED.** A static named import of `lightSignature` from a module without the export kills the whole test file before collection; used a namespace import (`import * as studioSettings from './physicsPaintStudioSettings'`) with a typed cast so the file collects and only the behavioral row fails at RED.
- **Typecheck before the marker.** `handleDocumentLightChange` tripped TS6133 under `noUnusedLocals`; resolved with the `void` marker (Deviation 3).

## Out-of-scope discovery (deferred, not fixed)

`bakeAquarelleScript` (`physicsPaintRotoPlayScriptController.ts:2677`, call sites at 3154/3530/3815) creates its adapter through the optional `ports.createAquarelleAdapter` factory, whose signature carries only `(size, paper)`. That Play-Script bake path therefore still renders with the engine default light. Threading it needs a port-signature change plus a cache-key decision (the staged cache must include the light or serve stale pixels) — an interface/architecture change (Rule 4), and no 64 plan covers it. Recorded in `deferred-items.md` and the broken-windows ledger; no code change made.

## UAT rows handed to the human (the node vitest env cannot mount the canvas)

1. **A light slider gesture repaints the live sheet without a stroke** — drag azimuth/elevation/intensity (controls arrive in 64-09) and watch the settled wash re-shade before any new paint.
2. **One ledger entry per gesture** — a slider drag is a single undo step; undo restores the previous light (the descriptor path is pinned; the gesture is 64-09's).
3. **Every Play and Apply bake uses the current light** — after a light change, Play reveals and Apply/stroke-edit re-bakes must match the live sheet.
4. **Two paint layers keep independent lights** — switching layers re-shades the sheet to that layer's own document light (the backstop truth; resolution is by layer id at every call site).

## Known Stubs

None — no hardcoded empty values, placeholder text, mock data sources or skipped tests were introduced. (`void handleDocumentLightChange;` is a deliberate unused-reference marker for 64-09, not a stub; `bakeAquarelleScript` is a pre-existing path, recorded above as deferred.)

## Next Phase Readiness

- 64-09 can import/thread `handleDocumentLightChange` into `rightPanelProps` (drop the `void` marker in the same commit) and render the three controls; every render seam is already in place.
- 64-10/64-12 can rely on the signature term: any light-dependent cache keyed on the Studio content signature now misses after a light change.
- The `bakeAquarelleScript` gap is documented for a later quick/phase; it is the only render path that still uses the engine default light.

---

*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created files present: `aquarelleLightRenderPaths.test.ts`, `64-07-red-evidence-task1.json`, `64-07-red-evidence-task2.json`, `deferred-items.md`, `64-07-SUMMARY.md`
- Commits present and ancestors of HEAD: `bf8c89341`, `f775ea234`, `b52003233`, `a49310143`
