---
phase: quick-261006-dfy
plan: 261006-dfy
subsystem: sidebar
tags: [physic-paint, sidebar, layer-row, display-name, dblclick, accent-token, source-contract]

# Dependency graph
requires: []
provides:
  - "Physics paint sidebar row display-name law: layer.name.trim() with 'Physics paint N' ordinal fallback; layer.id never renders (display-only, persistence untouched)"
  - "Row-body double-click → handleOpenCanvas launch split from the name label (stopPropagation-only leg)"
  - "Row accent via existing var(--color-accent) token as left border; no new color literal, no new chrome"
affects: [sidebar-layer-row, physic-paint-studio-entry, layer-identity-display]

# Actuals (#2632)
actuals:
  tokens: 1695
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordinal fallback derived as a pure render-body read of sequenceStore.sequences.value (no new state, no useState, no render-body signal write)"

key-files:
  created: []
  modified:
    - app/src/components/sidebar/PhysicPaintProperties.tsx
    - app/src/components/sidebar/PhysicPaintProperties.test.ts

key-decisions:
  - "Display-only identity: layer.id / source.layerId / physicPaintStore keys / APPLY_RESULT payloads untouched; every handler keeps reading layer.id exactly as before (threat T-261006-DFY-01)"
  - "Accent applied as the card's 2px left border — the same var(--color-accent) token and left-bar pattern SequenceList uses — because the card had no colored identity element and no new dot/chrome was allowed (discretion choice surfaced as UAT row 4)"
  - "No inline-rename trigger existed on this card at execution time (grounding held), so nothing was relocated; TimelineInteraction.ts byte-untouched (260923-kcs)"
  - "Output-status block ('Rendered Output' heading + both branches + hasOutput) removed wholesale; transient statusMessage/errorMessage under Standalone Canvas kept as the open/apply outcome channel (T-261006-DFY-04 accepted)"

requirements-completed: [QUICK-261006-DFY]

coverage:
  - id: D1
    description: "Source contract: display name with fallback and no raw layer id render (Layer ID row / title={layer.id} gone)"
    requirement: QUICK-261006-DFY
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/PhysicPaintProperties.test.ts#Physics paint layer row surface (261006-dfy) — display name with fallback, never the raw layer id"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/PhysicPaintProperties.test.ts (9 tests green: 5 existing + 4 new)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Source contract: Rendered Output block removed; Standalone Canvas feedback and Delete Roto kept"
    requirement: QUICK-261006-DFY
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/PhysicPaintProperties.test.ts#removes the output-status block"
        status: pass
    human_judgment: false
  - id: D3
    description: "Source contract: row-body double-click routes to handleOpenCanvas, name-label handler never calls it (region-scoped negative)"
    requirement: QUICK-261006-DFY
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/PhysicPaintProperties.test.ts#splits double-click: body opens the Studio, name label never does"
        status: pass
    human_judgment: false
  - id: D4
    description: "Source contract: card borderLeft uses var(--color-accent); #2D5BE3 literal never enters the component"
    requirement: QUICK-261006-DFY
    verification:
      - kind: unit
        ref: "app/src/components/sidebar/PhysicPaintProperties.test.ts#accents the row with the existing token, no literal hex"
        status: pass
    human_judgment: false
  - id: D5
    description: "Four new pins fail against the pre-fix source (base 1c55a78e) — verified by slicing the pre-fix .tsx through each pin's assertions"
    requirement: QUICK-261006-DFY
    verification:
      - kind: manual
        ref: "node check against git show 1c55a78e:...PhysicPaintProperties.tsx — all four it() cases fail pre-fix (case d fails on its positive borderLeft assertion; the #2D5BE3 negative is a within-case guard that pre-fix trivially satisfies)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Native UAT: row shows display name (blank → 'Physics paint N', no UUID anywhere incl. hover), output block gone with open/delete feedback still live, body dblclick opens Studio while name dblclick does not and timeline FX rename still works, row carries the menu's accent-blue left bar"
    requirement: QUICK-261006-DFY
    verification: []
    human_judgment: true
    rationale: "Native sidebar visuals and window-launch gestures cannot be judged by source-contract tests — vitest only pins source strings; the user runs the native UAT (no Chrome DevTools MCP)"

# Metrics
duration: 14min
completed: 2026-10-06
status: complete
---

# Phase quick-261006-dfy: Physics paint layer row in the main sidebar Summary

**The physics paint row in the main app left sidebar now shows a display name ('Paint 1' / 'Physics paint N' fallback) instead of a raw UUID, has dropped its Rendered Output status block, launches the Studio on a row-body double-click (name label excluded), and carries the + Layer menu's existing `var(--color-accent)` blue as a left border — four bounded changes in one component plus four source-contract pins, persistence untouched.**

## Accomplishments

- **Task 1 (live fix first, per the quick's locked order):** four edits in app/src/components/sidebar/PhysicPaintProperties.tsx — (1) deleted the 'Layer ID' row (the file's only `layer.id` JSX render); the Layer row now shows `layer.name.trim()` with a `Physics paint ${ordinal}` fallback where the ordinal is the 1-based index among the parent sequence's `physic-paint` layers, derived as a pure render-body read of `sequenceStore.sequences.value` (title attribute uses the same displayName, so hover leaks nothing); (2) removed the whole 'Rendered Output' section and the `hasOutput` derivation, keeping `physicPaintVersion.value`, `hasCurrentRotoFrame`, and the transient status/error feedback under Standalone Canvas; (3) added `handleRowBodyDoubleClick` (stopPropagation → `handleOpenCanvas()`, guard not duplicated) on the card and `handleNameLabelDoubleClick` (stopPropagation + preventDefault only) on the name label; (4) card inline `borderLeft: '2px solid var(--color-accent)'` — same token as the AddFxMenu Physic Paint swatch (index.css:25), same left-bar pattern as SequenceList's active row, no new hex/CSS var/element.
- **Task 2 (regression pins after the fix):** one new `describe('Physics paint layer row surface (261006-dfy)')` with four cases in the suite's house style (readFileSync sibling source): display-name/no-id, block removed, double-click split (region-scoped negative on the name-handler slice), accent token. The five existing cases are byte-for-byte untouched; all four new cases verified failing against the pre-fix source at base `1c55a78e`.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/PhysicPaintProperties.test.ts` → 9 passed (5 existing + 4 new), green.
- `pnpm --filter efx-motion-editor run typecheck` → clean (exit 0).
- `pnpm --filter efx-motion-editor exec vitest run` (full app suite) → 235/238 files green, 4434 tests passed; 1 pre-existing module-load failure (see Deferred), 2 skipped files — no NEW failures.
- Diff boundary: `git diff 1c55a78e..HEAD --name-only` → only `app/src/components/sidebar/PhysicPaintProperties.tsx` (+26/−29) and `app/src/components/sidebar/PhysicPaintProperties.test.ts` (+36). LayerList.tsx, AddFxMenu.tsx, TimelineInteraction.ts, timelineStore, sequenceStore, LeftPanel.tsx, the bridge untouched.
- Persistence audit: `grep -n "layer.id" PhysicPaintProperties.tsx` → 8 hits, all handler/store/lookup/comment uses (sourceLayerId, parent-sequence find, ordinal findIndex, console.info, updateLayerVisual ×2); zero JSX text renders remain.
- Native visual UAT: **PENDING — user** (see coverage D6).

## Deviations from Plan

### Auto-fixed Issues

None — the plan executed as written (Rules 1-4 not triggered).

### Environment note (not a plan deviation)

The worktree shipped without `node_modules`; `pnpm install --frozen-lockfile` (lockfile unchanged, no new packages — threat T-261006-DFY-SC honored) and `pnpm --filter @efxlab/efx-physic-paint build` (workspace package `dist`, gitignored) were required before vitest/typecheck could run. No package.json/lockfile diff.

## Auth gates

None.

## Known Stubs

None.

## Deferred Issues

1. **`app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — suite fails at module load** with `TypeError: _setPaintMarkDirtyCallback is not a function` (paintStore ↔ projectStore circular init). Pre-existing, declared out of scope by the plan and already logged by 261006-bdk (WINDOWS.md entry 90, its deferred-items.md); this quick touched no imports or store wiring. Not re-logged.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes. T-261006-DFY-01 (persistence) mitigated by display-only law + persistence audit; -02 (dblclick bubbling) mitigated by stopPropagation legs; -03 (UUID disclosure) resolved by removing the id row; -04 accepted with Standalone Canvas feedback retained.

## Self-Check: PASSED

- FOUND: app/src/components/sidebar/PhysicPaintProperties.tsx
- FOUND: app/src/components/sidebar/PhysicPaintProperties.test.ts
- FOUND: commit 46ce9219 (task 1)
- FOUND: commit 3a4ed3c9 (task 2)
- FOUND: 261006-dfy-SUMMARY.md (this file)
