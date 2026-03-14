---
phase: quick-7
plan: 01
subsystem: editor-shell
tags: [ux, selection, event-delegation]
dependency_graph:
  requires: [layerStore, uiStore, CanvasArea]
  provides: [outside-canvas-deselection]
  affects: [EditorShell, CanvasArea]
tech_stack:
  patterns: [event-delegation, data-attribute-marker, closest-traversal]
key_files:
  modified:
    - Application/src/components/layout/EditorShell.tsx
    - Application/src/components/layout/CanvasArea.tsx
decisions:
  - Used event delegation on shell root rather than stopPropagation on canvas
  - Used data-canvas-area attribute marker with closest() for canvas exclusion
  - Broad interactive element selector to cover all sidebar controls naturally
metrics:
  duration: 52s
  completed: "2026-03-14T10:35:39Z"
  tasks_completed: 1
  tasks_total: 1
---

# Quick Task 7: Add Deselect Layer When Clicking Outside Canvas

Event-delegated pointerdown handler on EditorShell root that deselects the active layer when clicking non-interactive chrome outside the canvas area.

## What Was Done

### Task 1: Add outside-canvas click deselection to EditorShell

**Commit:** 1220f56

**Changes:**
- **EditorShell.tsx**: Added `layerStore` import. Created `handleShellPointerDown` callback that checks three conditions before deselecting: (1) early return if nothing selected, (2) early return if click inside `[data-canvas-area]`, (3) early return if click on interactive element (`button`, `input`, `textarea`, `select`, `[role="button"]`, `[data-interactive]`, `[contenteditable]`). Otherwise calls `layerStore.setSelected(null)` and `uiStore.selectLayer(null)`. Bound handler to outermost shell div via `onPointerDown`.
- **CanvasArea.tsx**: Added `data-canvas-area` attribute to the outermost container div, marking the canvas region for exclusion from shell-level deselection.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles without errors (`npx tsc --noEmit` clean)
- Manual verification required: select layer, click toolbar/timeline background to deselect; click layer list item to change selection; click canvas to use existing TransformOverlay behavior; press Escape to deselect

## Self-Check: PASSED
