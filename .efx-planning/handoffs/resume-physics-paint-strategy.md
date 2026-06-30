# Handoff — Resume Physics Paint Strategy Work

## Why this handoff exists

The strategy work started from `/Users/lmarques/Dev/efx-paint-rust`, but the real target project is `/Users/lmarques/Dev/efx-motion-editor`. Continue future planning and implementation from the EFX Motion editor repo so code search, git status, commits, and project context match the files being changed.

## Resume location

Start Claude Code from:

```bash
cd /Users/lmarques/Dev/efx-motion-editor
claude
```

## Main planning context

Load this decision map first:

```text
.efx-planning/decision-maps/physics-paint-strategy-decision-map.md
```

It replaces the failed `.planning/` GSD flow for this paint strategy. It tracks open decisions, dependencies, resolved answers, and links to research assets.

## Existing research assets

```text
.efx-planning/research/krita-roundtrip.md
```

Resolved decision so far:

- `v1-track`: run both tracks — Krita companion workflow now, future embedded renderer later.
- `krita-roundtrip`: use a project-folder exchange workflow, not Krita embedding.

## Current unblocked tickets

Start with one of these:

```text
paint-module-interface
krita-license-assets
```

Recommended next ticket:

```text
paint-module-interface
```

Reason: `roto-data-contract`, `brush-scope`, and later implementation stories depend on knowing the small EFX paint module interface.

## How to reload the work context

In a new Claude Code session launched from `/Users/lmarques/Dev/efx-motion-editor`, paste one of these:

### Continue next unblocked decision

```text
Invoke /decision-mapping with the map at .efx-planning/decision-maps/physics-paint-strategy-decision-map.md.
```

### Continue a specific ticket

```text
Invoke /decision-mapping with the map at .efx-planning/decision-maps/physics-paint-strategy-decision-map.md, ticket paint-module-interface.
```

or:

```text
Invoke /decision-mapping with the map at .efx-planning/decision-maps/physics-paint-strategy-decision-map.md, ticket krita-license-assets.
```

## Intended workflow from here

1. Resolve `paint-module-interface`.
2. Resolve `krita-license-assets`.
3. Resolve `roto-data-contract`.
4. Create a PRD for the Krita companion workflow.
5. Split the PRD into implementation issues/stories.
6. Use `/implement` on one issue at a time to create production code.

## Important repo context

Existing EFX Motion paint files to inspect during future tickets:

```text
packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
packages/efx-physic-paint/src/preact.tsx
packages/efx-physic-paint/src/types.ts
app/src/components/physic-paint/PhysicsPaintStudio.tsx
app/src/lib/physicPaintBridge.ts
app/src/lib/physicPaintPersistence.ts
app/src/stores/physicPaintStore.ts
app/src-tauri/src/services/project_io.rs
```

Existing stable specs that remain useful:

```text
SPECS/physics-paint-rust-realtime-renderer/context.md
SPECS/physics-paint-rust-realtime-renderer/minimal-rust-paint-lab.md
SPECS/physics-paint-rust-realtime-renderer/literature-map.md
SPECS/rust-paint-engine.md
```

## Do not resume the old path blindly

The previous GSD-managed standalone Rust/wgpu lab failed at brush/material implementation in Phase 2. Treat it as research evidence, not as the execution workflow. Prefer decision mapping, narrow research, and prototypes before implementation.
