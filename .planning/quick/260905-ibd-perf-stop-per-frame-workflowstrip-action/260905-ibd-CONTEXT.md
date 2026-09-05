# Quick Task 260905-ibd: Perf: stop per-frame WorkflowStrip action-row re-renders during scrub (G-52-9) - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning

<domain>
## Task Boundary

Perf: stop per-frame WorkflowStrip action-row re-renders during scrub (G-52-9)

Phase 52 native UAT passed the scrub acceptance bar (G-52-7/8 fixed; scrub is fluid again).
Residual perf finding, pre-dating Phase 52 and unmasked by the fix: during a scrub the bottom
workflow strip's action buttons visibly refresh every frame. Verified root cause:

- Scrub is rAF-capped by design (38.1): each animation frame runs
  setLaunchContext({...current, startFrame: frame}) via scheduleRotoStartFramePropagation
  (PhysicsPaintStudio.tsx:531-535), re-rendering the Studio root once per frame. KEEP this.
- Every heavy Studio subtree is behind a 38-11 identity memo (toolRailPropsMemo,
  topBarPropsMemo, rightPanelPropsMemo, canvasStackPropsMemo — PhysicsPaintStudio.tsx:517-530)
  EXCEPT the workflow strip: PhysicsPaintWorkflowStrip
  (app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1203, ~4465 lines) is
  exported unmemoized and its props literal is rebuilt inline per render
  (PhysicsPaintStudio.tsx:3856 "workflow: {", with the per-frame `currentFrame` at :3908).
- useRotoTimelineActions is called in the Studio body (PhysicsPaintStudio.tsx:1446) and its
  ~20 availability classifiers are plain computed() (useRotoTimelineActions.ts:1818-1854):
  new instances per Studio render, each re-running its classifier on first read.
  Its frame getter (PhysicsPaintStudio.tsx:1484 `getCurrentAppFrame: () => currentFrame`)
  closes over the render-scoped number and is NOT signal-tracked.
- On reveal rails the baked keys are dense (1 per frame), so scrubbing crosses a key boundary
  nearly every frame: canDeleteFrame/canScissor/canAddEmptyKey/etc. genuinely FLIP every
  frame — that is the visible real-time refresh the user reported.

HARD CONSTRAINT — availability is genuinely frame-dependent. Do NOT freeze or gate the
buttons during scrub (a stale enabled/disabled state on release would be a regression:
+Key joins a rail strictly inside a segment span, Delete scope label follows the target kind,
Scissor splits mid-interpolation). Availability must stay LIVE; only its RENDER SCOPE narrows.

</domain>

<decisions>
## Implementation Decisions

### Computed stabilization
- Use **useComputed** from @preact/signals (the codebase's actual import — @preact/signals-react
  is not installed; app/package.json:20 pins @preact/signals ^2.8.1, and useComputed is already
  used in PhysicsPaintStudio.tsx:1005 and BackgroundAssetPickerView.tsx:62-63) to stabilize the
  returned availability computeds' identity across renders. The returned object IS the tracked
  signal; re-evaluates when deps change. Classifier logic stays byte-identical.

### Re-render test approach
- Pin test (a) via the **established source-scan + mocked-signal harnesses** (re-scoped
  2026-09-05). The isolated button render with a render-count spy is NOT feasible: the
  project's vitest setup has no DOM renderer (no preact-render-to-string, no
  @testing-library/preact, no jsdom/happy-dom in app/package.json or the lockfile;
  app/vitest.config.ts includes only `src/**/*.test.ts`), and the project memory rule
  "No test config hacks — use existing test setup" forbids adding a one-off renderer.
  Pinned verification instead: (a) a source-scan contract test asserting the extracted
  action-row is memo-wrapped and its buttons read ReadonlySignal props in narrow
  subscribers; (b) a hook-level test (mocked @preact/signals, BackgroundAssetPickerView
  pattern) asserting the useComputed-stabilized computeds re-evaluate when
  currentFrameSignal changes and that the bundle identity is stable across renders.

### Signal threading
- Pass **currentFrameSignal as an explicit hook argument** to useRotoTimelineActions;
  getCurrentAppFrame becomes `() => signal.value`. Explicit, testable, no hidden context.

### Claude's Discretion
- All other points in the fix design are locked by the spec: Studio-owned stable frame
  signal written in the setLaunchContext startFrame-change branch; action-row extraction
  into a memo-wrapped component with narrow per-button subscriber components reading
  ReadonlySignal props; frame-dependent handler props converted to stable useCallbacks
  reading launchContextRef.current?.startFrame at call time; strip's internal currentFrame
  mirror replaced by the Studio-owned signal prop. OUT OF SCOPE: rails grid and
  RotoTimelineCellButton memo untouched; no visual/DOM/class/tooltip/disabled-logic change;
  no full-strip memo wall unless action-row extraction proves insufficient (report, don't
  expand).

</decisions>

<specifics>
## Specific Ideas

- Consult the efx-preact-reactivity skill sections 3/5/6 before touching any reactivity code.
- Per-instance scoping for every new signal/memo (never module scope — two Studio windows
  must not share).
- Strip body must not write signals during render beyond the sanctioned guarded echo.
- Stale-closure pitfall: after the fix, scrub to frame N, release, immediately click +Key /
  Delete / Scissor / Paste — the action must land exactly on frame N.

</specifics>

<canonical_refs>
## Canonical References

- efx-preact-reactivity skill (sections 3/5/6) — mandatory reactivity rules
- PhysicsPaintToolRail.tsx:263 (memo pattern), :74-99 (PhysicsPaintHistoryActionButton
  narrow-subscriber pattern)
- PhysicsPaintStudio.tsx:485 (setLaunchContext startFrame branch), :375-376
  (launchContextRef), :517-530 (38-11 identity memos), :1470 (useRotoTimelineActions call),
  :1508 (getCurrentAppFrame), :3856/:3908 (workflow props literal)
- useRotoTimelineActions.ts:1818-1854 (availability classifiers)
- PhysicsPaintWorkflowStrip.tsx:1203 (export), :1237-1238 (currentFrame mirror),
  :1586-1654 (availability .value reads)

</canonical_refs>
