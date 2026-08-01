---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 11
subsystem: ui
tags: [physics-paint, preact, memo, signals, render-localization, performance, gap-closure]

requires:
  - phase: 38.1-studio-render-path-performance
    plan: 06
    provides: "run-2 UAT approval with two deferred follow-ups; this plan closes follow-up #1 (sidebar/tool-rail repaint on navigation)"
  - phase: 38.1-studio-render-path-performance
    plan: 07
    provides: "identity-memo idiom (store structural memo) mirrored component-scope by createIdentityMemo"
  - phase: 38.1-studio-render-path-performance
    plan: review-fix
    provides: "WR-02 rotoLegacyInterpolationSettings memo (b74ac80a) — the playWiggle source this plan reuses"
provides:
  - "createIdentityMemo() pure factory (single-entry last-winner identity cache, Object.is per-element comparison) — the component-scope twin of the 38.1-07 store structural memo"
  - "PhysicsPaintToolRail + PhysicsPaintRightPanel wrapped in preact/compat memo: a startFrame-only Studio render shallow-compares their props equal and skips both subtrees"
  - "Studio toolRail/rightPanel assemblies behind identity-memo resolve calls with single-line enumerated deps arrays excluding the frame cursor"
  - "WR-02 contract strengthened: rightPanel playWiggle reads through the memoized rotoLegacyInterpolationSettings — the per-render getRotoInterpolationSettings fresh clone is removed from the render path"
affects: [38-06 native UAT re-run, PhysicsPaintStudio]

tech-stack:
  added: []
  patterns:
    - "Component-scope identity memo (createIdentityMemo): per-instance single-entry last-winner cache held in a ref; deps enumerate exactly the referenced inputs, so any genuine input change recomputes while unrelated renders hit the cache"
    - "Stable props + preact/compat memo = skipped render: StudioView spreads the memoized objects; each prop value is referentially stable across startFrame-only renders, so the default shallow compare returns equal"
    - "Signals bypass memo (correctness): deps carry signal OBJECTS and primitives only — never .value reads — so ScriptsPanel signal updates and ToolRail history-availability updates keep flowing regardless of the parent memo"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx

key-decisions:
  - "createIdentityMemo returns { resolve } (method access) rather than a bare closure — the plan's grep gates pin toolRailPropsMemo.resolve / rightPanelPropsMemo.resolve call sites"
  - "Callbacks that must stay referentially stable reach navigation-fresh bindings through refs (launchContextRef, rotoFrameEditingRef) instead of hook deps — behavior byte-identical, identity stable across startFrame-only renders"
  - "Studio undo/redo depend on the history hook's stable inner callbacks (useCallback over the stable publishAvailability) rather than its per-render wrapper object"
  - "panelMotion/playWiggle is produced INSIDE the memo build from rotoLegacyInterpolationSettings (WR-02); the per-render rotoMotion fresh clone is deleted from the render path"
  - "Native visual confirmation (side panels no longer repaint on navigation) is deferred to the 38-06 re-run per D-15 — flag it explicitly in the 38-06 SUMMARY handoff"

requirements-completed: [38-NAV-RENDER-LOCALIZATION]

coverage:
  - id: D1
    description: "Identity-memo semantics proven: identical deps (fresh array, same element identities) return the identical value reference with build running ONCE; one changed dep produces a NEW reference with build re-running"
    requirement: 38-NAV-RENDER-LOCALIZATION
    verification:
      - kind: other
        ref: "node /tmp/38-11-memo-proof.mjs (ephemeral esbuild-bundle proof, 8/8 assertions green)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both exported components carry the preact/compat memo wrapper marker (displayName Memo(PhysicsPaintToolRailImpl) / Memo(PhysicsPaintRightPanelImpl)); two simulated Studio renders with frame-irrelevant identical deps return the SAME rightPanel reference"
    requirement: 38-NAV-RENDER-LOCALIZATION
    verification:
      - kind: other
        ref: "node /tmp/38-11-memo-proof.mjs (memo marker + two-simulated-renders assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deps contract: both resolve calls carry single-line deps arrays with enumerated-real-inputs comments and zero frame-cursor references; StudioView/CSS zero diff; whole-plan app diff limited to the four files_modified entries; zero test artifacts; typecheck clean"
    requirement: 38-NAV-RENDER-LOCALIZATION
    verification:
      - kind: other
        ref: "static grep gates + git diff sweeps (23b49b29..0ffae527) + pnpm --dir app typecheck"
        status: pass
    human_judgment: false
  - id: D4
    description: "Native visual confirmation: right color sidebar and left tool rail visibly no longer repaint on timeline navigation; everything else identical"
    requirement: 38-NAV-RENDER-LOCALIZATION
    verification: []
    human_judgment: true
    rationale: "D-15 discipline — zero test changes, no vitest; native confirmation ships inside the 38-06 UAT re-run and must be flagged in its SUMMARY handoff"

metrics:
  duration: 25min
  tasks: 2
  files: 4
  completed: 2026-07-28

status: complete
---

# Phase 38 Plan 11: Sidebar/Tool-Rail Render Localization on Timeline Navigation Summary

**Timeline navigation no longer repaints the right color sidebar or the left vertical tool rail: both subtrees are wrapped in `preact/compat` memo and fed referentially stable props assembled behind a new pure `createIdentityMemo()` factory, so the rAF-batched `startFrame` propagation (38.1 D-04) shallow-compares equal and Preact skips both subtrees — proven by an ephemeral bundle script and the enumerated-deps contract, with zero visual and zero behavior change.**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 4 (0 created in-repo; the proof script + bundle live in /tmp, ephemeral per plan)

## The Memo Mechanism

1. **Stable props:** `toolRailPropsMemo.resolve(deps, build)` / `rightPanelPropsMemo.resolve(deps, build)` (per-Studio instances held in refs — never module scope) cache the assembled props object. Deps are single-line arrays enumerating exactly the values each build references (38.1 onion-projection idiom) and contain no frame-derived input.
2. **Component memo:** `PhysicsPaintStudioView` spreads the memoized objects (`{...toolRail}` / `{...rightPanel}`); each individual prop value is referentially stable across startFrame-only renders, so `preact/compat` memo's default shallow compare returns equal and Preact skips the subtree.
3. **Signals bypass memo (correctness):** deps carry signal OBJECTS and primitives only — never `.value` reads. `PhysicsPaintToolRail` reads `historyAvailability.value` internally (read_first confirmation: line 96-100 of the rail — the badge/disabled derivation subscribes directly), so undo/redo availability updates bypass the memo. `PhysicsPaintScriptsPanel` reads `library.rows.value` etc. in its own render; the memo cannot freeze the sidebar by construction.

## Prop-Stability Audit Table

### toolRail

| Prop | Stability class |
|------|-----------------|
| activeTool, physicsMode, activePhysicsAction | primitives (`settings.*`) |
| historyAvailability | signal object (stable identity) |
| disabled | primitive (`!engine \|\| mutationLocked`) |
| onSelectTool, onPhysicsStart, onPhysicsStop | engine-actions `useMemo` callbacks (deps: engine/physicsMode — navigation-stable) |
| onUndo, onRedo | `useCallback` over the history hook's stable inner callbacks + stable `rotoScript` |
| onClearFrame | `useCallback` over `engine` + refs (`launchContextRef`, `rotoFrameEditingRef`) |
| onDryPaint | `useCallback` [engine, rotoScript] (already stable) |

### rightPanel

| Prop | Stability class |
|------|-----------------|
| activeTool, color, opacity, edgeDetail, pickup, spread, smoothing, eraseStrength, physicsMode | primitives (`settings.*`) |
| onion | state object (stable identity until `setOnion`) |
| onionDisabled, engineControlsDisabled, devExportEnabled, devExportBusy, applyStatus, applyMessage, error | primitives |
| playWiggle | built inside the memo build from memoized `rotoLegacyInterpolationSettings` (WR-02) |
| onColorChange, onEdgeDetailChange, onPickupChange, onSpreadChange, onSmoothingChange, onEraseStrengthChange | engine-actions `useMemo` callbacks |
| onOnionChange | `useCallback` [] |
| onPlayWiggleChange | `useCallback` [] over `launchContextRef` |
| onExportDebugProof, onSaveState, onLoadState | session-controller ref-stable (created once per mount) |
| scripts.library, scripts.playScript, scripts.rotoScript | controllerRef-stable controllers |
| scripts.playButtonRef | stable ref |
| scripts.loadAndApplyDisabledReason | primitive (string \| null \| undefined) |
| scripts.onSave/onActivateRow/onLoadAndApply/onDiscardScript/onCopyScript/onApplyScript/onRefresh | created inside the memo build, cached with the object |

## Task Commits

1. **Task 1 (tracer): createIdentityMemo + memo-wrapped ToolRail + stabilized rail props** — `3df07452`
2. **Task 2: memo-wrapped RightPanel + panelMotion WR-02 re-route + full assembly audit** — `0ffae527`

_Tracer feedback gate: plan frontmatter `autonomous: true`; the tracer `<verify>` re-ran green end-to-end (proof 5/5 + typecheck + static gates) after the tracer commit and before Task 2 expansion began, per the 38-01/02/04/05/09/10 precedent. Interactive confirmation is owned by the 38-06 re-run (D-15)._

## Ephemeral Proof Assertions (`node /tmp/38-11-memo-proof.mjs` — 8/8 green)

1. Identical deps (fresh array, same element identities) → identical value reference.
2. Build runs exactly once for identical deps (spy counter).
3. One changed dep → NEW value reference.
4. Build re-runs on a changed dep.
5. `PhysicsPaintToolRail` memo marker: `displayName=Memo(PhysicsPaintToolRailImpl)`.
6. `PhysicsPaintRightPanel` memo marker: `displayName=Memo(PhysicsPaintRightPanelImpl)`.
7. Two simulated Studio renders with frame-irrelevant identical deps → SAME rightPanel reference.
8. A changed frame-irrelevant dep → NEW rightPanel reference.

Bundle mechanics: esbuild resolved via `createRequire` from app package.json → `vite/package.json` → `esbuild`; format esm, jsx automatic (jsxImportSource preact), `.svg` dataurl loader. The script and its bundle live in /tmp — NOT repo artifacts, NOT test files (D-15-safe).

## WR-02 Contract

The rightPanel `playWiggle` input previously derived from a per-render `getRotoInterpolationSettings` call returning a fresh clone (`rotoMotion` → `panelMotion`, Studio line 1019-1020 pre-plan). It now reads through the existing `rotoLegacyInterpolationSettings` memo (b74ac80a — memoized on `[layerId, physicPaintVersion]`), and the `{ strokeDeformation, strokePosition }` projection is produced inside the memo build. No fresh per-render clone feeds the stabilized props; the `useRotoTimelineModel` WR-02 call site is untouched.

## D-15 Discipline

- Zero test files created, modified, renamed, or executed; no vitest invocation anywhere in this plan.
- The 3 known-red D-15 tests stay untouched (38-08 scope).
- `createPhysicsPaintPaneResizeDrag` named export is byte-identical — its existing test keeps importing it (the test was not run, D-15).
- `PhysicsPaintStudioView.tsx` and `physicsPaintStudio.css`: zero diff.
- Whole-plan app diff (23b49b29..0ffae527) limited to exactly the four `files_modified` entries.
- **38-06 handoff flag:** the 38-06 UAT re-run must natively confirm that the right color sidebar and the left tool rail no longer visibly repaint on timeline navigation, with everything else identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] undo/redo depended on the history hook's per-render wrapper object**
- **Found during:** Task 1 (callback stability audit)
- **Issue:** `useRotoPhysicalEditHistory` returns a fresh `{ observePaintMutation, ..., undo, redo }` wrapper per render, so Studio's `undo`/`redo` (`useCallback` deps `[rotoMoveHistory, rotoScript]`) were recreated every render — any identity memo over the rail props would miss on every Studio render, defeating the plan's render-skip truth.
- **Fix:** Depend on the hook's stable inner callbacks (`rotoMoveHistory.undo` / `.redo` — `useCallback` over the stable `publishAvailability`) via extracted locals. Wrapper body and behavior byte-identical.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Commit:** 3df07452

**2. [Rule 3 - Blocking] clearActiveSource coupled to navigation-fresh and per-render-fresh bindings**
- **Found during:** Task 1 (callback stability audit)
- **Issue:** `clearActiveSource` deps were `[engine, launchContext, rotoFrameEditing, rotoScript]` — `launchContext` identity changes on every navigation (startFrame propagation) and `rotoFrameEditing` is a fresh wrapper per render (its inner callbacks close over a per-render input literal). The callback changed identity on every navigation, which would re-render the rail on the exact hot path this plan freezes.
- **Fix:** Route through refs: `launchContextRef.current` for the truthiness guard and a new `rotoFrameEditingRef` (assigned per render) for `clearCurrentFrame()`. Live values read are identical at every call site; behavior byte-identical.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Commit:** 3df07452

**3. [Rule 3 - Blocking] updatePanelMotion was a per-render closure reading navigation-fresh launchContext**
- **Found during:** Task 2 (audit-first pass)
- **Issue:** The plan mandates wrapping per-render closures in `useCallback` before they join the assembly, but a plain `useCallback(..., [launchContext])` would still change identity on every navigation.
- **Fix:** `useCallback(..., [])` reading `launchContextRef.current` — identical live values, stable identity.
- **Files modified:** app/src/components/physic-paint/PhysicsPaintStudio.tsx
- **Commit:** 0ffae527

**4. [Rule 3 - Blocking] esbuild could not resolve `lucide-preact` in the ephemeral proof bundle**
- **Found during:** Task 2 (proof extension)
- **Issue:** With `platform: 'neutral'`, esbuild's `mainFields` defaults to empty; `lucide-preact` has no `exports` map (only `main`/`module`), so bundling `PhysicsPaintRightPanel` failed to resolve it.
- **Fix:** Added `mainFields: ['module', 'main']` to the proof script's build options (ephemeral script only — no repo change).
- **Files modified:** /tmp/38-11-memo-proof.mjs (ephemeral)
- **Commit:** n/a (not a repo artifact)

**5. [Rule 1 - Bug] createIdentityMemo first draft returned a bare closure**
- **Found during:** Task 1 (first proof run, pre-commit)
- **Issue:** The plan's grep gates pin `toolRailPropsMemo.resolve` / `rightPanelPropsMemo.resolve` method-access call sites; a bare `resolve` closure made the proof fail with `memo.resolve is not a function`.
- **Fix:** Factory returns `{ resolve }`. Caught and fixed before the tracer commit.
- **Files modified:** app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts
- **Commit:** 3df07452

---
**Total deviations:** 5 auto-fixed (3 Rule 3 blocking stability issues, 1 Rule 3 tooling resolution, 1 Rule 1 pre-commit API-shape bug)
**Impact on plan:** No scope creep; every fix was required for the plan's own render-skip truth and acceptance gates. Zero behavior change.

## Authentication Gates

None.

## Known Stubs

None — every prop flows the same live values as before; memoization only skips redundant parent-prop-driven re-renders.

## Threat Flags

None — render-path memoization only; no new network endpoints, auth paths, file access patterns, or trust-boundary schema changes. Threat register from the plan carries forward: T-38-11-01 mitigated by the enumerated-deps contract + ephemeral recompute proof; T-38-11-02 accepted (O(deps length) Object.is comparisons, ~13/36 elements).

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts
- FOUND: app/src/components/physic-paint/PhysicsPaintStudio.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
- FOUND: app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
- FOUND: /tmp/38-11-memo-proof.mjs (ephemeral, intentionally uncommitted)
- FOUND: commit 3df07452 (Task 1 tracer)
- FOUND: commit 0ffae527 (Task 2)
- Ephemeral proof 8/8 green; typecheck clean; whole-plan diff limited to the four files; zero test artifacts; no vitest invocation (D-15)

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-28*
