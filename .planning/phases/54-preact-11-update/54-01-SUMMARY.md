---
phase: 54-preact-11-update
plan: 01
subsystem: testing
tags: [preact, preact-signals, compatibility-gate, throwaway-probe, paintVersion]

# Dependency graph
requires: []
provides:
  - "RUN-01 satisfied: two-leg throwaway probe green on preact@11.0.1 + @preact/signals@2.11.3 before any workspace pin moved"
  - "Named stop-if-red gate exercised (both legs green — no blocking decision)"
  - "Pairing witness SPECS/v1.1.0-water-color/watercolor-playground confirmed running (typecheck + build)"
affects: [54-02, 54-03, 54-04, 54-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 3187
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Throwaway standalone probe outside pnpm workspace (root pnpm.overrides cannot re-pin it)"

key-files:
  created:
    - scripts/preact11-probe/package.json (created then deleted, D-02)
    - scripts/preact11-probe/probe.mjs (created then deleted, D-02)
  modified: []

key-decisions:
  - "Pattern leg is the real gate (paintVersion bump+subscribe teardown); pairing leg is cheap confirmation — weight not inverted (D-01)"
  - "Probe pins exactly preact@11.0.1 + @preact/signals@2.11.3 (D-09); root overrides never applied (outside workspace)"
  - "Subscriber kept as PaintOverlay requestPreview idiom (effect body + dep array read) — NOT rewritten into cleanup-based correctness (D-11)"
  - "Probe deleted once both legs green (D-02); not promoted to a permanent test surface"
  - "Pairing leg witnessed as running (watercolor-playground `tsc -b` + `vite build` both exit 0), not declaration-only (T-54-02)"

patterns-established:
  - "Throwaway probe outside pnpm workspace: own package.json + own node_modules + probe-local .gitignore so no throwaway lockfile ships"

requirements-completed: [RUN-01]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Pattern leg green on preact@11.0.1 + @preact/signals@2.11.3: bump after mount re-runs subscriber, 1000 unchanged setter calls bump zero times, dispose-then-bump prints teardown-clean"
    requirement: "RUN-01"
    verification:
      - kind: other
        ref: "node scripts/preact11-probe/probe.mjs (exit 0, PROBE_PASS + teardown-clean; deleted on green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Pairing leg green: SPECS witness declares preact + @preact/signals and its typecheck/build entry runs"
    requirement: "RUN-01"
    verification:
      - kind: other
        ref: "pnpm run typecheck && pnpm run build in SPECS/v1.1.0-water-color/watercolor-playground (both exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Throwaway probe directory deleted after both legs green (D-02); workspace manifests byte-unchanged"
    requirement: "RUN-01"
    verification:
      - kind: other
        ref: "test ! -e scripts/preact11-probe && git diff 6a115220..HEAD -- package.json app/package.json packages/efx-physic-paint/package.json (empty)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-10-14
status: complete
plan_head_before: 6a115220882c914d0fc8c01f5ff3bb8de7337f9e
plan_head_after: d6eca4dbd789c221f3deab05d74eebccdd9b19a6
---

# Phase 54 Plan 01: Preact 11 Signals Compatibility Gate Summary

**Two-leg throwaway probe green on preact@11.0.1 + @preact/signals@2.11.3 (paintVersion teardown + pairing witness), then deleted per D-02 — RUN-01 satisfied before any workspace pin moved.**

## Performance

- **Duration:** 9 min
- **Tasks:** 2/2 completed
- **Commits:** 2

## Accomplishments

- Built the locked two-leg throwaway probe under `scripts/preact11-probe/` outside the pnpm workspace (`pnpm-workspace.yaml` lists only `app` and `packages/*`), so root `pnpm.overrides.preact: ^10.29.8` cannot force Preact 10 into it (D-01).
- Pinned exactly `preact@11.0.1` + `@preact/signals@2.11.3` (D-09) with its own `node_modules` install.
- Pattern leg (the real gate) mounted the real paintVersion shape from `54-PATTERNS.md`: compare-then-write store setter (`setRotoBackgroundMetadata` idiom) + Preact render-effect subscriber that reads the version signal `.value` in the effect body and lists that same read in the dep array (`PaintOverlay.tsx` requestPreview idiom). D-11 held — the subscriber was NOT rewritten into a cleanup-based correctness pattern.
- Pattern-leg assertions all green on Preact 11.0.1 + signals 2.11.3:
  1. A bump after mount re-runs the subscriber (`mount-runs=1` → `bump-clean runs=2`)
  2. 1000 unchanged setter calls bump the clock zero times and do not re-run the subscriber (`idempotent-clean`)
  3. Dispose-then-bump does NOT re-run the subscriber — the Preact 11 deferred-cleanup risk D-01 exists to de-risk (`teardown-clean runs=2 clock=2`)
- Pairing leg (cheap confirmation) used the gitignored live witness `SPECS/v1.1.0-water-color/watercolor-playground` as measurement only (never a copy-from source): its `package.json` declares `preact ^11.0.0` + `@preact/signals ^2.11.3`, its tree resolves `11.0.1` + `2.11.3`, and its existing smoke/build entries both ran green (`tsc -b` exit 0, `vite build` exit 0). Evidence is running, not declaration-only (T-54-02).
- Stop-if-red gate: both legs green, so the entire `scripts/preact11-probe/` directory was deleted (D-02). No probe file left behind; the probe is not a permanent test surface.
- Workspace manifests (`package.json`, `app/package.json`, `packages/efx-physic-paint/package.json`) are byte-unchanged versus the plan start — no pin moved, no vitest config added, no feature/UX/engine work.

## Deviations from Plan

None - plan executed exactly as written.

Implementation discretion used (allowed by CONTEXT.md / D-01): the probe mounts a compact in-file DOM shim so `preact.render` + `preact/test-utils.act` run under plain `node` with only the two D-09 packages installed (T-54-01: install only the exact D-09 pins). A probe-local `.gitignore` kept the throwaway `pnpm-lock.yaml` out of git so no throwaway lockfile ships.

## Known Stubs

None — the probe is throwaway and was deleted on green; no permanent stub remains in the tree.

## Threat Flags

None — the only registry pull was the locked D-09 pairing inside a directory deleted before the commit that closes the plan; the witness was read-only measurement.

## Self-Check: PASSED
