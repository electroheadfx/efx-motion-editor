---
phase: 34-standalone-demo-shell
plan: 01
plan_name: Workspace command contract
subsystem: standalone-demo-shell
tags:
  - workspace-scripts
  - efx-physic-paint
  - vite
  - preact
dependency_graph:
  requires:
    - RUN-01
    - RUN-02
  provides:
    - root dev:paint delegates to package demo:dev
    - package-local demo:dev and demo:build scripts
    - demo-only Vite dependency metadata
  affects:
    - package.json
    - packages/efx-physic-paint/package.json
    - pnpm-lock.yaml
tech_stack:
  added:
    - vite@5.4.21
    - '@preact/preset-vite@^2.10.5'
  patterns:
    - pnpm workspace filter delegation
    - package-local demo scripts separate from library scripts
key_files:
  created:
    - .planning/phases/34-standalone-demo-shell/34-01-SUMMARY.md
  modified:
    - package.json
    - packages/efx-physic-paint/package.json
    - pnpm-lock.yaml
decisions:
  - Root pnpm dev:paint now delegates to @efxlab/efx-physic-paint demo:dev instead of the tsup watch script.
  - Demo launch/build scripts are package-local and do not alter package exports, files, build, dev:watch, or check boundaries.
metrics:
  tasks_completed: 2
  files_changed: 4
  started: 2026-06-08T11:00:00Z
  completed: 2026-06-08T11:09:55Z
  duration_minutes: 10
---

# Phase 34 Plan 01: Workspace Command Contract Summary

Repo-root `pnpm dev:paint` now targets the standalone `@efxlab/efx-physic-paint` Vite demo command while preserving the package's separate library build/check workflow.

## Tasks Completed

| Task | Name | Status | Commit | Key Files |
|------|------|--------|--------|-----------|
| 1 | Retarget root standalone paint command | Complete | 99dd8ad | package.json |
| 2 | Add package-local demo scripts and approved dev dependencies | Complete | 90d3e3d | packages/efx-physic-paint/package.json, pnpm-lock.yaml |

## What Changed

- Updated root `package.json` so `scripts.dev:paint` is exactly `pnpm --filter @efxlab/efx-physic-paint demo:dev`.
- Added package-local `demo:dev` and `demo:build` scripts using `demo/vite.config.ts`.
- Added approved demo-only dev dependency metadata for `vite@5.4.21` and `@preact/preset-vite@^2.10.5` with pnpm lockfile updates.
- Preserved library script boundaries: `build` remains `tsup`, `dev:watch` remains `tsup --watch`, and `check` remains `tsc --noEmit`.
- Preserved publish boundaries: no demo path was added to `exports` or `files`.

## Verification

| Check | Result |
|-------|--------|
| Root `dev:paint` static Node assertion | Passed |
| Package script/export/files static Node assertion | Passed |
| `pnpm --filter @efxlab/efx-physic-paint check` | Passed |
| No dev server run | Passed; project CLAUDE.md requires user-run servers |

## Deviations from Plan

None - plan executed as written.

## Auth Gates

None.

## Known Stubs

None found in files created or modified by this plan.

## Threat Flags

None. Changes are limited to existing package-manager and local developer script surfaces covered by the plan threat model.

## Commits

- `99dd8ad` - `feat(34-01): retarget standalone paint command`
- `90d3e3d` - `feat(34-01): add paint demo scripts`

## Deferred Issues

None.

## Self-Check: PASSED

- Found summary file: `/Users/lmarques/Dev/efx-motion-editor/.planning/phases/34-standalone-demo-shell/34-01-SUMMARY.md`
- Found task commit: `99dd8ad`
- Found task commit: `90d3e3d`
