---
phase: 40-macos-icon-regeneration-build-hygiene
plan: 02
subsystem: infra
tags: [vite, vitest, tauri, build-hygiene, chunk-budget, customLogger]

requires:
  - phase: 40-macos-icon-regeneration-build-hygiene (plan 01)
    provides: phase context, research baseline (entry chunk 969.22 kB, 12 mixed-import warnings), pattern map for the build seam
provides:
  - build.chunkSizeWarningLimit: 1100 with the four-point D-11 rationale comment in app/vite.config.ts
  - resolved-limit assertion (configResolved capture → toBe(1100)) in app/src/viteBuild.test.ts
  - module-scoped `warnings` capture array + createLogger() customLogger wrap (D-12 infrastructure consumed by plan 40-03 non-return assertions)
  - PhysicsPaintStudio-*.js prefix-based chunk-separation pin (D-15, second intentional separation)
  - chunk-size-warning absence assertion at the 1100 budget
affects: [40-macos-icon-regeneration-build-hygiene (plan 40-03 triage + non-return assertions)]

actuals:
  tokens: 704
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Resolved-config assertion via configResolved capture plugin (asserts the resolved value, not source text)"
    - "Unfiltered warning capture via createLogger() customLogger wrap; filtering lives only in assertions"
    - "Prefix-based chunk separation pins (never content-hash filenames, never exact chunk counts)"

key-files:
  created: []
  modified:
    - app/vite.config.ts
    - app/src/viteBuild.test.ts

key-decisions:
  - "customLogger replaces logLevel:'silent' in the programmatic build call — a custom logger ignores log-level gating, so the wrap sees every warn call (verified in research)"
  - "Warning capture delegates to the original warn so build output stays visible in test logs; capture itself is unfiltered"
  - "Tracer feedback gate applied in autonomous form: plan frontmatter is autonomous:true under an orchestrator-driven sequential executor, so the tracer verify was re-run end-to-end (green) before the expansion task instead of stopping for a human checkpoint"

patterns-established:
  - "Resolved-limit capture: createInputCapturePlugin records config.build.chunkSizeWarningLimit in configResolved (enforce:'post'), assertion targets the resolved value"
  - "warnings: string[] module-scope capture array named exactly `warnings`, pushed as String(msg) unfiltered — plan 40-03 consumes it for module-path-absence non-return assertions (D-13)"

requirements-completed: [BUILD-01, BUILD-03]

coverage:
  - id: D1
    description: "chunkSizeWarningLimit: 1100 set with the four-point D-11 rationale comment directly above it, and the resolved value asserted at exactly 1100 (BUILD-01)"
    requirement: BUILD-01
    verification:
      - kind: integration
        ref: "app/src/viteBuild.test.ts#production vite build > resolved chunkSizeWarningLimit is exactly the documented 1100 desktop budget"
        status: pass
      - kind: other
        ref: "red-then-green evidence: assertion observed failing at resolved 500 before the config edit, green after"
        status: pass
    human_judgment: false
  - id: D2
    description: "Build seam captures all warnings via customLogger (no subprocess/stderr), retains HTML-entry and non-empty-asset assertions, pins both intentional chunk separations by stable prefix, and proves no chunk-size warning at the 1100 budget (BUILD-03 seam infrastructure)"
    requirement: BUILD-03
    verification:
      - kind: integration
        ref: "app/src/viteBuild.test.ts#production vite build (10 tests, incl. PhysicsPaintStudio separation pin and chunk-size-warning absence)"
        status: pass
      - kind: integration
        ref: "pnpm --dir app exec vitest run — full suite 96 passed / 3 skipped, 1017 tests passed"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-04
status: complete
---

# Phase 40 Plan 02: Desktop Build Budget + Build-Seam Regression Infrastructure Summary

**Desktop chunk budget pinned at exactly 1100 with resolved-config proof (red at 500 → green at 1100), plus customLogger warning capture and the PhysicsPaintStudio chunk-separation pin in the production build seam.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-04T14:07:41Z
- **Completed:** 2026-08-04T14:15:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `chunkSizeWarningLimit: 1100` set in `app/vite.config.ts` with the four-point D-11 rationale comment directly above it as the sole documentation (BUILD-01)
- Resolved-limit assertion proves the budget end-to-end: `configResolved` capture plugin records `config.build.chunkSizeWarningLimit`; the test failed at the resolved default 500 before the config edit and passes at exactly 1100 after (D-14)
- Warning capture infrastructure (D-12): module-scoped `warnings` array + `createLogger()` customLogger wrap passed to the programmatic `build()` call, replacing `logLevel: 'silent'` — ready for plan 40-03's non-return assertions
- Second intentional chunk separation pinned by stable prefix: `PhysicsPaintStudio-*.js` alongside the existing `src/project-*.js` pin (D-15); no content-hash filenames, no exact chunk counts
- No chunk-size warning is emitted at the 1100 budget — asserted against the captured warning set

## Task Commits

Each task was committed atomically on `gsd/phase-40-exec`:

1. **Task 1: End-to-end budget proof — resolved-limit assertion red at 500, then green at exactly 1100** - `a0458e72` (feat)
2. **Task 2: Warning capture (customLogger) + PhysicsPaintStudio chunk-separation pin** - `8ebc0a21` (test)

## Files Created/Modified
- `app/vite.config.ts` — build block gains `chunkSizeWarningLimit: 1100` + the D-11 rationale comment (6 added lines; no other config touched)
- `app/src/viteBuild.test.ts` — `captured.chunkLimit` capture field, resolved-limit assertion, `warnings` capture array + customLogger wrap, `PhysicsPaintStudio-*.js` separation pin, chunk-size-warning absence assertion

## Red-then-green evidence (per plan output spec)

**RED run** (test extension only, config untouched) — `pnpm --dir app exec vitest run src/viteBuild.test.ts`:

```
× production vite build > resolved chunkSizeWarningLimit is exactly the documented 1100 desktop budget
  → chunkSizeWarningLimit must resolve to the documented 1100 desktop budget: expected 500 to be 1100 // Object.is equality

- Expected
+ Received

- 1100
+ 500

Test Files  1 failed (1)
     Tests  1 failed | 7 passed (8)
```

The failure at resolved value **500** proves the assertion reads the resolved config via `configResolved`, not source text.

**GREEN run** (after the config edit):

```
✓ src/viteBuild.test.ts (8 tests) 4052ms
Test Files  1 passed (1)
     Tests  8 passed (8)
```

**Final run after Task 2** (full seam): `✓ src/viteBuild.test.ts (10 tests)` — 10 passed.

**Full app suite**: `pnpm --dir app exec vitest run` → Test Files 96 passed | 3 skipped (99); Tests 1017 passed | 1 skipped | 101 todo (1119).

## Exact comment wording placed above the key (verification target, Pitfall 5)

```typescript
    // Desktop chunk budget (D-11): this is a packaged Tauri desktop app
    // loading local assets, so network-first web heuristics do not apply.
    // Vite's 500 kB default is a generic web threshold; 1100 is a monitored
    // desktop entry-bundle budget, not a performance claim, and it must not
    // be raised again without measurement.
    chunkSizeWarningLimit: 1100,
```

All four required D-11 phrases verified present via grep: `packaged Tauri desktop app`, `500 kB default`, `monitored`, `not a performance claim`, plus `must not be raised again without measurement`.

## Decisions Made
- customLogger replaces `logLevel: 'silent'` (per D-12): a custom logger ignores log-level gating, so the warn wrap sees every warning; capture delegates to the original warn to keep build output visible.
- The wrapped warn pushes `String(msg)` unfiltered — filtering exists only inside assertions (T-40-05 mitigation).
- The two new assertions live in their own `it` blocks so every pre-existing assertion stayed byte-identical.
- Tracer gate: plan is `autonomous: true` under an orchestrator-driven sequential executor; the tracer's verify was re-run end-to-end (green) before Task 2 instead of halting for an interactive checkpoint.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Full-suite noise from the fresh worktree (environmental, not a code issue):** the first `pnpm --dir app exec vitest run` reported 7 failed test *files* (all under `src/components/physic-paint/**`) with "Failed to resolve entry for package @efxlab/efx-physic-paint" — the workspace package's `dist/` (gitignored, `packages/*/dist/`) is not built in a fresh worktree, and those suites resolve the bare specifier via node resolution instead of the app's vite aliases. Building the package once (`pnpm --dir packages/efx-physic-paint build`, tsup — no installs, no tracked-file changes) made the full suite green: 96 passed / 3 skipped. The plan's own acceptance target (`src/viteBuild.test.ts`) was green throughout, before and after the package build.
- **Tooling note (no implementation impact):** the plan's acceptance grep `grep -n 'PhysicsPaintStudio-\[^/\]\*\\.js'` is calibrated for GNU grep BRE; this machine's `grep` is ugrep 7.5.0, whose BRE handling of the `\*\\` portion misfires (rc=1). The substance of the criterion — the prefix-based separation pin present in the test — was verified with `grep -nF 'PhysicsPaintStudio-[^/]*\.js'` (line 156) and `grep -n 'PhysicsPaintStudio-\['`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 40-03 can consume the module-scoped `warnings` capture array for its D-13 non-return assertions (module-path absence) and the D-07 baseline evidence.
- The 12 mixed-import warnings remain visible in the build seam output by design (delegated warn) until the D-08-gated triage in plan 40-03; no total-warning-count assertion was added.
- Note for 40-03/estimators: the entry chunk measured 1,074.93 kB in this worktree's build (research baseline recorded 969.22 kB) — still under the 1100 budget, but headroom is now ~25 kB, not 130 kB. Worth rechecking the baseline during triage.

## Self-Check: PASSED

- FOUND: app/vite.config.ts, app/src/viteBuild.test.ts, 40-02-SUMMARY.md
- FOUND: commits a0458e72 (Task 1), 8ebc0a21 (Task 2)

---
*Phase: 40-macos-icon-regeneration-build-hygiene*
*Completed: 2026-08-04*
