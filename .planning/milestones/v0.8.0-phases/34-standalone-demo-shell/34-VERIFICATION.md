---
phase: 34-standalone-demo-shell
verified: 2026-06-08T12:10:03Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 34: Standalone Demo Shell Verification Report

**Phase Goal:** Users can launch and iterate on a standalone physics paint demo without coupling it to the EFX Motion Editor runtime.
**Verified:** 2026-06-08T12:10:03Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can start the standalone physics paint demo from the repository root with a documented pnpm command. | VERIFIED | Root `package.json` has `scripts.dev:paint = "pnpm --filter @efxlab/efx-physic-paint demo:dev"`; README documents `pnpm dev:paint`; user manually verified `pnpm dev:paint` and replied "work". |
| 2 | User can edit the package-local Vite/Preact demo and see browser HMR while keeping the library build path separate. | VERIFIED | Package `demo:dev` uses `vite --config demo/vite.config.ts`; Vite aliases public package subpaths to package source for HMR; library `build`, `dev:watch`, and `check` remain separate; user manually confirmed runtime/HMR with "work". |
| 3 | User can follow package README instructions that match the actual root and package scripts. | VERIFIED | README commands match root/package scripts for `dev:paint`, `demo:dev`, `demo:build`, `build`, and `check`; automated script contract check passed. |
| 4 | User can identify that this demo runs `packages/efx-physic-paint` standalone, not as an editor paint-layer integration. | VERIFIED | Demo renders `@efxlab/efx-physic-paint standalone demo` and `Vite demo / public Preact API / no editor runtime`; README states the standalone demo is not an editor paint-layer integration; demo files avoid app/Tauri/editor imports. |
| 5 | RUN-01: Repo-root `pnpm dev:paint` delegates to the standalone `@efxlab/efx-physic-paint` browser demo. | VERIFIED | `package.json` line 7 delegates to package `demo:dev`; package script line 58 starts Vite demo. |
| 6 | RUN-02: Package demo launch scripts are separate from package build/check scripts. | VERIFIED | `packages/efx-physic-paint/package.json` keeps `build: tsup`, `dev:watch: tsup --watch`, `check: tsc --noEmit`, plus separate `demo:dev` and `demo:build`; `exports` and `files` do not include demo. |
| 7 | RUN-03: Package README instructions match actual root and package scripts. | VERIFIED | README documents the correct root and filtered pnpm commands and the workflow boundaries; README no longer uses stale `paperPath` or `onEngine` Preact example props. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Root `dev:paint` script | VERIFIED | Contains exact delegation: `pnpm --filter @efxlab/efx-physic-paint demo:dev`. |
| `packages/efx-physic-paint/package.json` | Package-local demo scripts, Vite deps, separate library scripts | VERIFIED | Contains `demo:dev`, `demo:build`, `vite`, `@preact/preset-vite`; build/check scripts remain unchanged; demo not exported or published. |
| `packages/efx-physic-paint/demo/vite.config.ts` | Demo-local Vite config with Preact plugin and source aliases | VERIFIED | Uses `preact()` and aliases `@efxlab/efx-physic-paint/preact` to `../src/preact.tsx`; also aliases animation public subpath to source. |
| `packages/efx-physic-paint/demo/index.html` | Standalone HTML entry | VERIFIED | Contains `#app` root and `/src/main.tsx` module script. |
| `packages/efx-physic-paint/demo/src/main.tsx` | Preact mount entry with visible root mount failure | VERIFIED | Renders `<App />` into `#app`; appends `.demo-error` text if root is missing. |
| `packages/efx-physic-paint/demo/src/App.tsx` | Standalone app shell rendering public wrapper | VERIFIED | Imports `EfxPaintCanvas` from public Preact subpath, renders standalone title/status, mounts canvas, displays canvas-wrapper mount error, and wires `Toolbar`. |
| `packages/efx-physic-paint/demo/src/Toolbar.tsx` | Ported demo controls/settings | VERIFIED | Provides paint/erase, color, size, opacity, paper/background, physics, animation, save/load, undo/clear controls wired to engine methods; code review issues are fixed by clamping FPS/frame inputs and validating loaded JSON. |
| `packages/efx-physic-paint/demo/src/styles.css` | Plain CSS for shell, status, canvas, toolbar, errors | VERIFIED | Contains required shell/status/canvas/error and toolbar selectors; no Tailwind/app CSS imports. |
| `packages/efx-physic-paint/demo/public/img/paper_1.jpg` | Paper texture asset | VERIFIED | File exists. |
| `packages/efx-physic-paint/demo/public/img/paper_2.jpg` | Paper texture asset | VERIFIED | File exists. |
| `packages/efx-physic-paint/demo/public/img/paper_3.jpg` | Paper texture asset | VERIFIED | File exists. |
| `packages/efx-physic-paint/README.md` | Accurate standalone demo and command documentation | VERIFIED | Documents current scripts, standalone boundary, public Preact example, and build/check separation. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json scripts.dev:paint` | `packages/efx-physic-paint/package.json scripts.demo:dev` | `pnpm --filter @efxlab/efx-physic-paint demo:dev` | WIRED | Exact root script delegation found and package script exists. |
| `packages/efx-physic-paint/package.json scripts.demo:build` | `packages/efx-physic-paint/demo/vite.config.ts` | `vite build --config demo/vite.config.ts` | WIRED | Exact package script found; `demo:build` executed successfully. |
| `packages/efx-physic-paint/demo/src/main.tsx` | `packages/efx-physic-paint/demo/src/App.tsx` | Preact render import/use | WIRED | `main.tsx` imports `App` and renders it into `#app`. |
| `packages/efx-physic-paint/demo/src/App.tsx` | `@efxlab/efx-physic-paint/preact` | public subpath import | WIRED | `App.tsx` imports and renders `EfxPaintCanvas` from the public subpath. |
| `packages/efx-physic-paint/demo/src/App.tsx` | `@efxlab/efx-physic-paint/animation` | public subpath import | WIRED | Review warning fixed: `AnimationPlayer` imports from public animation subpath, with Vite source alias present. |
| `packages/efx-physic-paint/demo/vite.config.ts` | `packages/efx-physic-paint/src/preact.tsx` | `resolve.alias` | WIRED | Alias maps public Preact subpath to source for demo HMR. |
| `packages/efx-physic-paint/demo/vite.config.ts` | `packages/efx-physic-paint/src/animation/index.ts` | `resolve.alias` | WIRED | Alias maps public animation subpath to source for demo HMR. |
| `packages/efx-physic-paint/README.md` | Actual root/package scripts | documented commands | WIRED | README command coverage matches scripts verified by Node checks. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `demo/src/App.tsx` | `engine` | `EfxPaintCanvas.onEngineReady` after `EfxPaintEngine.init()` in `src/preact.tsx` | Yes | FLOWING — toolbar renders only after real engine instance is provided. |
| `demo/src/App.tsx` | `animFrame`, `animTotal`, `isPlaying` | `AnimationPlayer.play()` callbacks and toolbar play/stop handlers | Yes | FLOWING — state is updated by real animation player callbacks and rendered in toolbar. |
| `demo/src/Toolbar.tsx` | Tool/settings state | User inputs call real `EfxPaintEngine` setters | Yes | FLOWING — controls call `engine.setTool`, `setBrushSize`, `setBrushOpacity`, `setPhysicsMode`, etc. |
| `demo/src/Toolbar.tsx` | `loadError` | JSON file parsing and project shape validation | Yes | FLOWING — invalid load errors render as `.toolbar-error`; valid projects call `engine.load`. |
| `README.md` | Documented commands | Root and package `package.json` scripts | Yes | FLOWING — docs match actual executable script values. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package TypeScript check | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor --filter @efxlab/efx-physic-paint check` | `tsc --noEmit` exited 0 | PASS |
| Library build remains separate | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor --filter @efxlab/efx-physic-paint build` | `tsup` built `index`, `preact`, and `animation` entries; exited 0 | PASS |
| Standalone demo build | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor --filter @efxlab/efx-physic-paint demo:build` | Vite built demo; exited 0 | PASS |
| Runtime dev server launch/HMR | User-run `pnpm dev:paint` | User manually verified and replied `work`; verifier did not run server per project instruction | PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| N/A | N/A | No phase-declared probe scripts found or required for this phase. | SKIPPED |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RUN-01 | 34-01, 34-03 | User can start standalone physics paint from the repo root with a documented pnpm command. | SATISFIED | Root `dev:paint` delegates to package `demo:dev`; README documents `pnpm dev:paint`; user verified runtime command. |
| RUN-02 | 34-01, 34-02, 34-03 | User can iterate on the standalone demo with Vite/Preact HMR while the library build remains separate. | SATISFIED | Package-local Vite demo scripts/config exist; source aliases support HMR; build/check scripts remain separate; `demo:build`, `build`, and `check` passed. |
| RUN-03 | 34-03 | User can follow README instructions that match the actual package scripts. | SATISFIED | README documents commands matching `package.json` and package scripts, including workflow boundaries. |

No orphaned Phase 34 requirements were found in `.planning/REQUIREMENTS.md`; RUN-01, RUN-02, and RUN-03 are all accounted for by PLAN frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/efx-physic-paint/README.md` | 39, 69-70 | `console.log` in documentation examples | INFO | Documentation example output only; not implementation behavior and not a blocker. |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, placeholder UI, empty returns, or console-only implementation handlers were found in phase implementation files. The prior `34-REVIEW.md` critical/warning findings are fixed in actual code: FPS/frame inputs are clamped, malformed project loads are validated with visible error state, and animation imports use the public subpath.

### Human Verification Required

None. The only browser-runtime behavior requiring human verification was already supplied in the verification context: the user ran `pnpm dev:paint` after demo controls/settings were ported and replied `work`. No dev server was started by the verifier.

### Gaps Summary

No blocking gaps found. Phase 34 achieves the roadmap goal: the standalone package demo is launchable from the repo root, editable through package-local Vite/Preact HMR without coupling to the editor runtime, and documented with commands that match actual scripts.

---

_Verified: 2026-06-08T12:10:03Z_
_Verifier: Claude (gsd-verifier)_
