# Phase 26: Monorepo Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 26-monorepo-scaffold
**Areas discussed:** Application/ rename, Paint .planning/ archive, Workspace script design, Workspace config

---

## Application/ → app/ rename

| Option | Description | Selected |
|--------|-------------|----------|
| app/ | Matches spec note and common monorepo convention. Short and clean. | ✓ |
| apps/editor/ | Nested apps/ folder for multiple apps in the future. More structure upfront. | |
| Keep Application/ | No rename — avoids git history risk. | |

**User's choice:** app/
**Notes:** None

### Git history preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Isolated commit | Single git mv commit ensures git log --follow works. MONO-05 requires this. | ✓ |
| Combined with workspace setup | Fewer commits but may lose history at rename boundary. | |

**User's choice:** Yes, isolated commit
**Notes:** None

---

## Paint .planning/ archive

| Option | Description | Selected |
|--------|-------------|----------|
| Archive to milestones/ | Copy paint's .planning/milestones/ into editor's .planning/milestones/paint-v1.0-phases/ as reference. Then delete from package. | ✓ |
| Delete entirely | Standalone repo's git history preserves it. Clean package directory. | |
| Keep in package | Leave paint's .planning/ inside packages/efx-physic-paint/. Risk: GSD confusion. | |

**User's choice:** Archive to milestones/
**Notes:** None

---

## Workspace script design

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal pnpm filter | dev, build, dev:paint using pnpm --filter. No build orchestrator. Matches spec. | ✓ |
| Add Turborepo | turbo.json for build caching. Overkill for 2 packages. | |
| Parallel dev scripts | Root dev runs both editor and paint concurrently. Single command. | |

**User's choice:** Minimal pnpm filter
**Notes:** None

### pnpm overrides location

| Option | Description | Selected |
|--------|-------------|----------|
| Move to root | MONO-06 requires this. Workspace overrides apply globally. | ✓ |
| Keep in app/ | Overrides only affect editor. But MONO-06 says root. | |

**User's choice:** Move to root
**Notes:** None

---

## Workspace config

### Workspace paths

| Option | Description | Selected |
|--------|-------------|----------|
| "app" + "packages/*" | Standard monorepo convention. Extensible via glob. | ✓ |
| "app" + explicit paint path | No glob, must update yaml when adding packages. | |
| Just "packages/*" | Move app/ into packages/ too. Unusual. | |

**User's choice:** "app" + "packages/*"
**Notes:** User asked for Claude's recommendation first. Claude recommended this option for extensibility and convention alignment.

### packageManager field

| Option | Description | Selected |
|--------|-------------|----------|
| Exact version + sha | Full corepack integrity check. Copy from current config. | ✓ |
| Simplified version only | Just version without sha hash. Loses integrity check. | |

**User's choice:** Yes, exact version + sha
**Notes:** None

---

## Claude's Discretion

- Vite optimizeDeps.exclude configuration
- .gitignore updates for monorepo structure
- Root tsconfig setup if needed
- Paint package file cleanup details

## Deferred Ideas

None — discussion stayed within phase scope
