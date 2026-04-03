---
phase: 26-monorepo-scaffold
plan: 02
subsystem: infra
tags: [monorepo, pnpm, workspace, tsup, vite, paint-engine]

# Dependency graph
requires:
  - phase: 26-01
    provides: "app/ directory (renamed from Application/) and pnpm-lock.yaml at root"
provides:
  - "pnpm workspace with root config, workspace.yaml, and single lockfile"
  - "Paint package at packages/efx-physic-paint/ with workspace-ready package.json"
  - "workspace:* dependency wiring from app to paint package"
  - "Vite optimizeDeps.exclude for paint package"
  - "Archived paint v1.0 milestones at .planning/milestones/paint-v1.0-phases/"
affects: [26-03, 27, 28, 29]

# Tech tracking
tech-stack:
  added: [tsup, pnpm-workspace]
  patterns:
    - "pnpm --filter for workspace script orchestration"
    - "workspace:* protocol for local package dependencies"
    - "optimizeDeps.exclude for workspace packages in Vite"
    - "Root-level pnpm.overrides for dependency deduplication"

key-files:
  created:
    - "package.json (root workspace config)"
    - "pnpm-workspace.yaml"
    - "packages/efx-physic-paint/ (full source tree)"
    - ".planning/milestones/paint-v1.0-phases/"
  modified:
    - "app/package.json (workspace dep, removed overrides/packageManager)"
    - "app/vite.config.ts (optimizeDeps.exclude)"
    - "pnpm-lock.yaml (workspace resolution)"

key-decisions:
  - "Removed pnpm.onlyBuiltDependencies from paint package.json (already at root, caused WARN)"
  - "Consolidated all pnpm.overrides and packageManager at workspace root per D-06/D-08"

patterns-established:
  - "Root package.json owns overrides, packageManager, and filter-based scripts"
  - "Workspace packages exclude standalone demo deps (vite, @preact/preset-vite)"

requirements-completed: [MONO-01, MONO-03, MONO-04, MONO-06]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 26 Plan 02: Workspace Setup Summary

**pnpm workspace with root config, paint engine package at packages/efx-physic-paint, workspace:* dependency wiring, and Vite exclude**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T14:44:59Z
- **Completed:** 2026-04-03T14:49:06Z
- **Tasks:** 2
- **Files modified:** 135 (129 new paint + milestones, 6 config files)

## Accomplishments
- Copied efx-physic-paint into packages/ with only keeper files (src/, package.json, tsup.config.ts, tsconfig*, README, LICENSE)
- Archived paint v1.0 milestones (10 phases, 3 milestone-level docs) to .planning/milestones/paint-v1.0-phases/
- Created pnpm workspace with root package.json (overrides, packageManager, filter scripts) and pnpm-workspace.yaml
- Wired workspace:* dependency from app to paint package; Vite excludes paint from pre-bundling
- Verified: pnpm install --frozen-lockfile passes, symlink resolves, tsup build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Copy paint package, archive milestones, and clean up** - `43b111f` (feat)
2. **Task 2: Create workspace root config, wire dependency, and configure Vite** - `a91a9d2` (feat)

## Files Created/Modified
- `package.json` - Root workspace config with private:true, packageManager, pnpm.overrides, filter scripts
- `pnpm-workspace.yaml` - Workspace definition (app, packages/*)
- `packages/efx-physic-paint/` - Full paint engine source (brush, core, engine, render, animation, util)
- `packages/efx-physic-paint/package.json` - Updated for monorepo: repository, dev:watch, removed demo deps
- `.planning/milestones/paint-v1.0-phases/` - Archived 10 phase dirs + 3 milestone docs
- `app/package.json` - Added workspace:* dep, removed pnpm overrides and packageManager
- `app/vite.config.ts` - Added @efxlab/efx-physic-paint to optimizeDeps.exclude
- `pnpm-lock.yaml` - Regenerated with workspace resolution

## Decisions Made
- Removed pnpm.onlyBuiltDependencies from paint package.json since it's already at root (eliminates pnpm WARN)
- Followed plan for all other decisions (D-03 through D-08)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed redundant pnpm.onlyBuiltDependencies from paint package.json**
- **Found during:** Task 2 (workspace build verification)
- **Issue:** pnpm warned that package-level onlyBuiltDependencies has no effect in a workspace
- **Fix:** Removed the pnpm section from packages/efx-physic-paint/package.json
- **Files modified:** packages/efx-physic-paint/package.json
- **Verification:** Build succeeds without warning
- **Committed in:** a91a9d2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor cleanup, no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all workspace wiring is fully functional.

## Next Phase Readiness
- Workspace fully operational: pnpm install resolves, paint builds, symlink works
- Ready for Plan 03 (validation: tsc --noEmit, import check, Vite dev start)
- Paint package dist/ is gitignored (packages/*/dist/ in .gitignore from Plan 01)

---
*Phase: 26-monorepo-scaffold*
*Completed: 2026-04-03*
