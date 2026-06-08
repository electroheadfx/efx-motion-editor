---
phase: 34-standalone-demo-shell
plan: 02
subsystem: ui
tags: [vite, preact, hmr, standalone-demo, efx-physic-paint]

requires:
  - phase: 34-standalone-demo-shell
    provides: RUN-01 workspace command contract and package-local demo script foundation
provides:
  - Package-local Vite/Preact standalone demo shell for @efxlab/efx-physic-paint
  - Browser HMR path that aliases the public Preact subpath to package source
  - Visible standalone identity and mount-failure errors for local runtime validation
  - Ported interactive controls/settings and paper texture assets from the original paint demo
  - User-verified root pnpm dev:paint runtime behavior
affects: [phase-35-interactive-physics-paint-controls, standalone-physics-paint, editor-integration-boundary]

tech-stack:
  added: []
  patterns:
    - Demo-local Vite config with source alias for public package subpath HMR
    - Standalone Preact shell isolated from app/Tauri/editor runtime imports
    - User-run dev server verification per project CLAUDE.md

key-files:
  created:
    - packages/efx-physic-paint/demo/vite.config.ts
    - packages/efx-physic-paint/demo/index.html
    - packages/efx-physic-paint/demo/src/App.tsx
    - packages/efx-physic-paint/demo/src/Toolbar.tsx
    - packages/efx-physic-paint/demo/src/main.tsx
    - packages/efx-physic-paint/demo/src/styles.css
    - packages/efx-physic-paint/demo/public/img/paper_1.jpg
    - packages/efx-physic-paint/demo/public/img/paper_2.jpg
    - packages/efx-physic-paint/demo/public/img/paper_3.jpg
  modified:
    - .gitignore
    - packages/efx-physic-paint/demo/vite.config.ts

key-decisions:
  - "Kept the standalone demo package-local and isolated from EFX Motion Editor/Tauri runtime while using the public @efxlab/efx-physic-paint/preact subpath."
  - "Accepted the user-requested enhancement to port original paint demo controls/settings and paper assets so the standalone shell is immediately useful for interactive validation."
  - "Did not run pnpm dev:paint in automation because project CLAUDE.md requires the user to run servers; recorded the user's manual confirmation instead."

patterns-established:
  - "Demo HMR pattern: Vite aliases @efxlab/efx-physic-paint/preact to ../src/preact.tsx so package source changes update without a separate library watch build."
  - "Standalone verification pattern: automation runs build/type checks; browser dev-server UAT remains user-run and explicitly recorded."

requirements-completed: [RUN-02]

duration: continuation after checkpoint
completed: 2026-06-08
---

# Phase 34 Plan 02: Standalone Demo Shell Summary

**Package-local Vite/Preact standalone physics paint demo with public-wrapper HMR, visible standalone identity, and user-verified browser runtime behavior.**

## Performance

- **Duration:** Continuation after human-verification checkpoint
- **Started:** Prior executor completed implementation before checkpoint
- **Completed:** 2026-06-08T11:50:08Z
- **Tasks:** 3/3 complete
- **Files modified:** 10 implementation files plus this summary

## Accomplishments

- Added the package-local Vite config and HTML entry for `packages/efx-physic-paint/demo`, with the public `@efxlab/efx-physic-paint/preact` subpath aliased to package source for HMR.
- Built a standalone Preact demo shell that renders the real public `EfxPaintCanvas`, identifies itself as outside the editor runtime, and exposes visible mount-failure errors.
- Added `.gitignore` coverage for generated demo build output so `vite build` artifacts do not pollute the working tree.
- Ported the original paint demo controls/settings and paper texture assets after user request, making the standalone demo useful for interactive validation rather than a bare canvas only.
- Recorded the manual checkpoint as passed: the user ran `pnpm dev:paint`, verified the standalone demo, and confirmed HMR/manual verification with response `work`.

## Task Commits

Each completed implementation step was committed atomically before this continuation:

1. **Task 1: Add demo-local Vite config and HTML entry** - `034e121` (`feat(34-02): add standalone demo Vite entry`)
2. **Task 2: Build the standalone Preact canvas shell** - `d444bba` (`feat(34-02): build standalone Preact paint shell`)
3. **Task 2 deviation: Ignore generated demo build output** - `f2d6e7b` (`chore(34-02): ignore demo build output`)
4. **User-requested enhancement: Port original paint demo controls/settings and paper assets** - `5b6db0c` (`feat(34-02): port original paint demo controls`)

**Plan metadata:** committed by this continuation after writing `34-02-SUMMARY.md`.

## Files Created/Modified

- `packages/efx-physic-paint/demo/vite.config.ts` - Package-local Vite config with Preact plugin and HMR source alias for the public Preact subpath.
- `packages/efx-physic-paint/demo/index.html` - Standalone demo HTML entry with `#app` root and `/src/main.tsx` module script.
- `packages/efx-physic-paint/demo/src/main.tsx` - Preact mount entry for the standalone demo.
- `packages/efx-physic-paint/demo/src/App.tsx` - Standalone demo application shell and interactive paint-demo wiring.
- `packages/efx-physic-paint/demo/src/Toolbar.tsx` - Ported controls/settings UI for interactive standalone paint testing.
- `packages/efx-physic-paint/demo/src/styles.css` - Plain CSS for demo shell, canvas, toolbar/settings, and error layout.
- `packages/efx-physic-paint/demo/public/img/paper_1.jpg` - Ported paper texture asset.
- `packages/efx-physic-paint/demo/public/img/paper_2.jpg` - Ported paper texture asset.
- `packages/efx-physic-paint/demo/public/img/paper_3.jpg` - Ported paper texture asset.
- `.gitignore` - Added generated demo build output ignore rule.
- `.planning/phases/34-standalone-demo-shell/34-02-SUMMARY.md` - This execution summary.

## Verification

- `pnpm --filter @efxlab/efx-physic-paint demo:build` passed.
- `pnpm --filter @efxlab/efx-physic-paint check` passed.
- Human checkpoint passed: user confirmed `pnpm dev:paint` standalone runtime and HMR/manual verification with `work`.

## Decisions Made

- The demo stays package-local and continues to prove the public Preact wrapper without importing EFX Motion Editor/Tauri runtime code.
- The user-requested controls/settings and paper assets were included as an enhancement to make runtime validation practical in the standalone surface.
- Automation did not start `pnpm dev:paint`, honoring `CLAUDE.md`; browser dev-server verification was performed by the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ignored generated demo build output**
- **Found during:** Task 2 verification
- **Issue:** `pnpm --filter @efxlab/efx-physic-paint demo:build` generates demo build output that should not remain as untracked working-tree noise.
- **Fix:** Added generated demo build output to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** Subsequent build completed without leaving the generated demo output as a commit candidate.
- **Committed in:** `f2d6e7b`

### User-requested Enhancements

**1. Ported original paint demo controls/settings and paper assets**
- **Found during:** Post-Task 2 user request before checkpoint completion
- **Request:** The standalone demo needed the original paint demo controls/settings and paper textures rather than only the minimal shell.
- **Implementation:** Added/updated `App.tsx`, `Toolbar.tsx`, `main.tsx`, `styles.css`, and `demo/public/img/paper_*.jpg` while keeping the demo standalone and package-local.
- **Verification:** `demo:build` and package `check` passed; user manually verified the dev server/HMR flow.
- **Committed in:** `5b6db0c`

---

**Total deviations:** 1 auto-fixed blocking issue, 1 user-requested enhancement
**Impact on plan:** The standalone boundary and RUN-02 goal remain intact. The enhancement expands the demo's usefulness for interactive validation without integrating it into the editor runtime.

## Issues Encountered

- No unresolved implementation blockers in this continuation.
- The working tree contained unrelated pre-existing `.planning` deletions from phases 26 and 33. They were intentionally not staged or committed.

## User Setup Required

None. The user already performed the manual checkpoint by running `pnpm dev:paint` and confirmed it worked.

## Known Stubs

None identified for the RUN-02 objective. The demo is a standalone validation shell, not the final editor integration path.

## Threat Flags

None. The implementation did not add network endpoints, auth paths, file access patterns, schema changes, or new trust-boundary surfaces beyond the planned Vite demo/browser DOM/runtime boundary.

## Next Phase Readiness

- RUN-02 is complete and manually verified.
- Phase 35 can build interactive physics paint controls on top of the package-local standalone demo surface.
- The editor integration boundary remains explicit: this demo validates the standalone package before any EFX Motion Editor/Tauri integration.

## Self-Check: PASSED

- Confirmed `34-02-SUMMARY.md` was created.
- Confirmed prior task commits are present in recent history: `034e121`, `d444bba`, `f2d6e7b`, `5b6db0c`.
- Confirmed automated verification commands passed in this continuation.
- Confirmed unrelated pre-existing `.planning` deletions were not staged for this summary commit.

---
*Phase: 34-standalone-demo-shell*
*Completed: 2026-06-08*
