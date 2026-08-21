---
quick_task: 260718-fp9
status: complete
subsystem: physics-paint-labels
tags: [physics-paint, timeline, standalone, accessibility, native-uat]
commits:
  - 9c491f26
  - faa2ebe1
  - b1ad99c4
---

# Quick Task 260718-fp9 Completion Summary

Physics Paint tracks now display presentation-only `PPaint #n` labels derived from their current top-to-bottom timeline order. Reordering or deleting tracks dynamically renumbers the remaining Physics Paint labels, while intervening non-Physics-Paint tracks retain their normal sequence names.

The standalone EFX Paint workflow header receives the selected track's current derived label through a separate `workflowLabel` launch-context field. Persisted sequence and layer names, `layerName` script provenance, IDs, source types, Roto caches, scripts, interpolation, playback, and project data remain unchanged.

## Implementation

- Added the derived `headerLabel` to FX timeline layout projection.
- Routed normal timeline headers and reorder ghosts through the same derived label.
- Resolved the selected Physics Paint layer's current parent layout when opening EFX Paint.
- Transported the optional presentation label through TypeScript validation, browser context parsing, native Rust serde, and native URL construction.
- Rendered the supplied label in the standalone workflow strip with a non-ordinal `PPaint` fallback for incomplete direct-launch contexts.
- Preserved the existing `Selected Physics Paint mode` accessible label.

## UAT History

The first native UAT failed after the initial fixed rename because every Physics Paint surface displayed `PPaint #1`. The correction changed numbering to the user-approved current timeline-order model.

Renewed native UAT was approved on 2026-07-18 for:

- consecutive `PPaint #1`, `PPaint #2`, and `PPaint #3` timeline labels;
- dynamic renumbering after reorder and deletion;
- standalone headers matching the selected timeline track;
- unchanged Roto controls, terminology, caches, scripts, and project behavior.

## Regression Coverage

Focused existing coverage now protects:

- mixed FX ordering and Physics-Paint-only ordinal counting;
- reorder and deletion renumbering without persisted-name changes;
- renderer consumption and reorder-ghost parity;
- selected-layer workflow-label launch propagation while preserving `layerName`;
- encoded and flat standalone launch-context parsing;
- standalone supplied-label rendering and non-ordinal fallback;
- native Rust URL encoding and launch-context clone preservation.

## Final Automated Gates

- Focused app Vitest: **6 files passed; 57 tests passed, 1 skipped**.
- Focused native Rust tests: **2 passed**.
- Full app Vitest: **85 files passed, 3 skipped; 787 tests passed, 2 skipped, 101 todo**.
- App TypeScript check: passed.
- Native Rust `cargo check`: passed.
- `git diff --check`: passed.
- Development server: not run.

Existing non-failing warnings remain for missing third-party Motion Canvas sourcemaps and unavailable Tauri listeners inside the Vitest environment.

## Commits

- `9c491f26` — `fix(quick-260718-fp9): rename Physics Paint workflow label`
- `faa2ebe1` — `fix(quick-260718-fp9): derive Physics Paint track labels`
- `b1ad99c4` — `test(quick-260718-fp9): cover Physics Paint track labels`

Quick task `260718-fp9` is complete, native-approved, and regression-covered.
