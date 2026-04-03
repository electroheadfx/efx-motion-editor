# Phase 5: Library & Demo Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 05-library-demo-polish
**Areas discussed:** Module extraction strategy, Library public API, Demo UI & sliders, Package & build setup

---

## Module Extraction Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror old engine/ structure | Reuse PaintEngine/BrushEngine/PhysicsEngine/ColorConverter split | |
| Functional split by concern | Split by what code does: core/, brush/, render/, util/ | ✓ |
| Minimal extraction | One big EfxPaintEngine class, extract only types and wrapper | |

**User's choice:** Functional split by concern
**Notes:** User preferred granular modules organized by function rather than OOP classes

### Orchestrator follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| EfxPaintEngine facade | Top-level class with simple API, consumers never touch internals | ✓ |
| No orchestrator — composable modules | Export each module separately, consumer wires them | |

**User's choice:** EfxPaintEngine facade

### Types.ts follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite from scratch | Build fresh from v3 code, old types reference v2 with wrong types | ✓ |
| Update existing types.ts | Keep structure, update to match v3 | |

**User's choice:** Rewrite from scratch

---

## Library Public API

### Wrapper architecture

User clarified before options were presented: wants vanilla core package with framework wrappers added incrementally (Preact first, then React, Solid, Svelte).

| Option | Description | Selected |
|--------|-------------|----------|
| Single package, sub-paths | Core is main import, wrappers as sub-path exports | ✓ |
| Separate packages per framework | Each wrapper its own npm package | |

**User's choice:** Single package with sub-path exports

### Phase 5 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Core + Preact only | Ship vanilla core + Preact wrapper, defer others | ✓ |
| Core + Preact + React | Also ship React wrapper | |
| Core only, all wrappers later | Defer even Preact wrapper | |

**User's choice:** Core + Preact only

### Asset loading

| Option | Description | Selected |
|--------|-------------|----------|
| Consumer provides URLs | Engine takes texture URLs in config, no bundled assets | ✓ |
| Bundle default textures | Ship paper/brush textures in npm package | |
| Both: bundled + override | Ship defaults, allow consumer override | |

**User's choice:** Consumer provides URLs

---

## Demo UI & Slider Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Match what v3 actually uses | Expose sliders for params v3 engine reads (~9) | ✓ |
| Full 24 sliders | Add all original Rebelle parameters | |
| You decide | Claude determines useful params | |

**User's choice:** Match what v3 actually uses
**Notes:** User clarified: only Paint and Erase tools currently in v3. UI should be external from core engine. Demo UI may be replaced — real UI comes from efx-motion-editor.

### Demo polish level

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal functional demo | Exercises library API, no styling effort | ✓ |
| Styled reference app | Clean presentable demo | |
| Skip demo entirely | Just ship library, test with v3.html | |

**User's choice:** Minimal functional demo

---

## Package & Build Setup

### Directory structure

| Option | Description | Selected |
|--------|-------------|----------|
| Repurpose paint-rebelle-new/ | Library in src/, demo in src/demo/, single package.json | ✓ |
| Fresh directory at root | New efx-physic-paint/ directory | |
| Monorepo with pnpm workspaces | packages/core/ + apps/demo/ | |

**User's choice:** Repurpose paint-rebelle-new/

### Build output

| Option | Description | Selected |
|--------|-------------|----------|
| ESM only | Modern output, .mjs + .d.ts via tsup | ✓ |
| CJS + ESM dual | Broader compatibility | |

**User's choice:** ESM only

### v3.html cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as reference | Leave v3.html untouched | |
| Delete after extraction | Remove, git history preserves | |

**User's choice:** Move to ./cleaning/ (gitignored folder, not deleted from disk)

---

## Claude's Discretion

- Internal module boundaries within the functional split
- tsup configuration details
- Vite config for demo dev server
- Dual-canvas handling in module extraction
- Preact wrapper props interface design

## Deferred Ideas

- React/Solid/Svelte wrappers — future phases
- Animated stroke playback — from Phase 4
- 24-slider Kontrol panel — not needed, only expose what engine uses
- npm registry publishing — v2 requirements
