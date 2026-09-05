# Quick Task 260905-ibd: Perf — stop per-frame WorkflowStrip action-row re-renders during scrub (G-52-9) — Research

**Researched:** 2026-09-05
**Domain:** Preact + @preact/signals render-scope narrowing
**Confidence:** HIGH (all claims verified against live source this session)

## Summary

The root-cause narrative in CONTEXT.md is correct: the workflow strip is the one heavy Studio
subtree not behind a 38-11 identity memo, its props literal is rebuilt per render, and the
~20 availability computeds in `useRotoTimelineActions` are plain `computed()` recreated per
Studio render, so the strip re-renders every rAF frame during scrub. The locked fix design
(useComputed stabilization + currentFrameSignal threading + action-row extraction with narrow
per-button subscribers) is the right shape, but verification surfaced **three gaps that change
the implementation**:

1. **The package name in the locked decision is wrong.** CONTEXT.md says `@preact/signals-react`;
   the project uses `@preact/signals` directly (v2.8.1). `useComputed` is a named export of
   `@preact/signals` and is already used in this codebase (PhysicsPaintStudio.tsx:1005,
   BackgroundAssetPickerView.tsx:62-63). `@preact/signals-react` is not installed.
2. **useComputed stabilization only keeps availability LIVE if every classifier input port is
   signal-tracked.** Several ports read plain render-scoped values (`getRotoKeyRecords` →
   `rotoKeyRecords` useMemo array, `getRotoInterpolationState` → plain object,
   `getSelectedKeyRail`/`getSelectedLoopClipIds`/`getRailSetMembers` → plain derived values,
   `getLaunchContext` → ref). With stable computeds, availability would go stale after a key
   add/delete or selection change — a direct violation of the HARD CONSTRAINT. These ports must
   be converted to signal-backed reads.
3. **`physicalActions` identity is not stable even with useComputed.** The bundle's useMemo
   (useRotoTimelineActions.ts:3318-3366) depends on the action runners, which are useCallbacks
   with `[input]` deps, and `input` is a fresh object literal each Studio render
   (PhysicsPaintStudio.tsx:1470). The memo-wrapped action-row would still re-render unless
   `input` is stabilized (memoized in the Studio) or the action-row receives individual
   signals + handlers rather than the whole bundle.

**Primary recommendation:** proceed with the locked design, but (a) import `useComputed` from
`@preact/signals`, (b) make every classifier input port signal-backed, and (c) stabilize the
hook's `input` object (or pass per-button signals/handlers to the extracted action-row). The
isolated-button-render test is **not feasible** with the current test infrastructure — no
renderer exists (no preact-render-to-string, no @testing-library/preact, no jsdom). Use the
established source-scan + mocked-`@preact/signals` harnesses instead.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Computed stabilization:** Use `useComputed` to stabilize the returned availability
  computeds' identity across renders. The returned object IS the tracked signal; re-evaluates
  when deps change. Classifier logic stays byte-identical.
- **Re-render test approach:** Pin test (a) via isolated button render: render the extracted
  action-row button component in isolation with a ReadonlySignal prop, flip the signal, assert
  render count via a spy. Fast, focused, no Studio harness.
- **Signal threading:** Pass `currentFrameSignal` as an explicit hook argument to
  `useRotoTimelineActions`; `getCurrentAppFrame` becomes `() => signal.value`. Explicit,
  testable, no hidden context.

### Claude's Discretion
- All other points in the fix design are locked by the spec: Studio-owned stable frame signal
  written in the setLaunchContext startFrame-change branch; action-row extraction into a
  memo-wrapped component with narrow per-button subscriber components reading ReadonlySignal
  props; frame-dependent handler props converted to stable useCallbacks reading
  `launchContextRef.current?.startFrame` at call time; strip's internal currentFrame mirror
  replaced by the Studio-owned signal prop. OUT OF SCOPE: rails grid and
  RotoTimelineCellButton memo untouched; no visual/DOM/class/tooltip/disabled-logic change; no
  full-strip memo wall unless action-row extraction proves insufficient (report, don't expand).

### Deferred Ideas (OUT OF SCOPE)
- None in CONTEXT.md.
</user_constraints>

## Root-Cause Verification (line-by-line)

All CONTEXT.md line numbers below are **corrected** to the live source. The narrative holds;
only the anchors moved.

| Claimed | Actual | Evidence |
|---------|--------|----------|
| setLaunchContext startFrame branch ~:485 | **:492** | `else if (next && next.startFrame !== current?.startFrame)` reseeds selection against the live track (PhysicsPaintStudio.tsx:492-509) |
| launchContextRef ~:375-376 | **:382-383** | `const launchContextRef = useRef<...>(launchContext); launchContextRef.current = launchContext;` |
| 38-11 identity memos ~:517-530 | **:530-538** | `layoutPropsMemo` … `canvasMountPropsMemo` via `useRef(createIdentityMemo()).current` |
| useRotoTimelineActions call ~:1446 | **:1470** | `const rotoTimelineActions = useRotoTimelineActions({` — the input is a fresh object literal each render |
| getCurrentAppFrame ~:1484 | **:1508** | `getCurrentAppFrame: () => currentFrame` — closes over render-scoped number; `currentFrame = launchContext?.startFrame ?? 0` at **:676** |
| workflow props literal ~:3856 | **:3915** | `workflow: {` inside `usePhysicsPaintStudioViewModel` |
| per-frame currentFrame ~:3908 | **:3968** | `currentFrame, isPlaying, ready: readyToApply, …` |
| Strip export ~:1203 | **:1412** | `export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps)` — unmemoized |
| Strip currentFrame mirror ~:1237-1238 | **:1446-1447** | `const currentFrameSignal = useSignal(props.currentFrame); if (currentFrameSignal.peek() !== props.currentFrame) currentFrameSignal.value = props.currentFrame;` — the sanctioned guarded echo (efx-preact-reactivity Rule 6) |
| Availability `.value` reads ~:1586-1654 | **:1829-1920** | `physicalInsertAvailable = physicalActions?.canInsertFrame.value ?? false;` … `canSelectAllRotoKeys = (physicalActions?.canSelectAllKeys.value ?? false) && …` — ~15 reads in the strip render body |
| Classifiers ~:1818-1854 | **:1818-1854** | Confirmed: plain `computed(() => …)` created per render (useRotoTimelineActions.ts:1818-1854) |

**Confirmed root cause chain:**
- Scrub → `scheduleRotoStartFramePropagation` (PhysicsPaintStudio.tsx:539-543) → rAF-capped
  `setLaunchContext({...current, startFrame: frame})` → Studio re-renders once per frame.
- Studio re-render → `useRotoTimelineActions` re-runs → ~20 new `computed()` instances →
  `physicalActions` useMemo (useRotoTimelineActions.ts:3318-3366) sees new identities →
  new bundle → workflow props literal rebuilt → unmemoized strip re-renders → strip reads the
  ~15 `.value`s → classifiers re-run on first read with the new frame.
- On reveal rails the baked keys are dense (1/frame), so `canDeleteFrame`/`canScissor`/
  `canAddEmptyKey` genuinely flip every frame — the visible refresh.

## Mechanism Verification

### useComputed — import path is `@preact/signals`, NOT `@preact/signals-react`
- `app/package.json:20` → `"@preact/signals": "^2.8.1"`. `@preact/signals-react` is **not
  installed** (no `app/node_modules/@preact/signals-react`).
- `app/node_modules/@preact/signals/dist/signals.d.ts:5` →
  `export declare function useComputed<T>(compute: () => T, options?: SignalOptions<T>): ReadonlySignal<T>;`
- Implementation (dist/signals.js): `useComputed = (i, r) => { const t = useRef(i); t.current = i; return useMemo(() => computed(() => t.current(), r), []); }` — **stable identity** (created once), re-evaluates when tracked deps change, reads the latest closure via ref.
- Already used in this codebase: PhysicsPaintStudio.tsx:1005 (`physicalMutationAvailable`),
  BackgroundAssetPickerView.tsx:62-63.
- The hook's import line (useRotoTimelineActions.ts:2) already imports from `@preact/signals`;
  adding `useComputed` is a one-line change.

### preact/compat memo pattern
- `import { memo } from 'preact/compat';` (PhysicsPaintToolRail.tsx:1);
  `export const PhysicsPaintToolRail = memo(PhysicsPaintToolRailImpl);` (:263). This is the
  pattern the extracted action-row should copy.

### Narrow-subscriber pattern to copy
- `PhysicsPaintHistoryActionButton` (PhysicsPaintToolRail.tsx:74-99) reads
  `historyAvailability?.value` (a `ReadonlySignal<PaintHistoryAvailability>` prop) in its own
  render body — only this leaf subscribes, not the whole rail.

### Test harnesses that exist (and the ones that don't)
- **No renderer exists.** No preact-render-to-string, no @testing-library/preact, no
  jsdom/happy-dom anywhere in `app/package.json` or the lockfile. `app/vitest.config.ts:5`
  includes only `src/**/*.test.ts`. The `.test.tsx` files (e.g.
  PhysicsPaintKeyRail.test.tsx) are **source-scan** tests (read the file, assert structure),
  not render tests.
- **Established pattern A — source-scan contract tests:** PhysicsPaintWorkflowStrip.test.ts,
  PhysicsPaintStudio.test.ts read the `.tsx` source and assert structure/strings.
- **Established pattern B — hook tests with mocked `@preact/signals`:**
  BackgroundAssetPickerView.test.ts:24-31 mocks `useSignal`/`useComputed` down to the real
  `signal`/`computed` core. useRotoTimelineActions.test.ts:4-7 instead mocks `preact/hooks`
  (`useCallback`/`useMemo` only).

## Design Gaps That Change the Implementation

### Gap 1 — useComputed only keeps availability LIVE if every classifier input is signal-tracked
The computeds re-evaluate **only** on signal-tracked deps. Several input ports read plain
render-scoped values, so with stable computeds the availability would go stale:

| Port | Closes over | Tracked? |
|------|-------------|----------|
| `getCurrentAppFrame` | `currentFrame` number (:676) | NO — fix makes it `currentFrameSignal.value` |
| `getRotoKeyRecords` | `rotoKeyRecords` useMemo array (:620) | NO |
| `getRotoInterpolationState` | `rotoInterpolationState` plain object (:625) | NO |
| `getSelectedKeyRail` | `effectiveSelectedRotoKeyRail` plain | NO |
| `getSelectedLoopClipIds` | `effectiveRotoLoopClipSelection` plain | NO |
| `getRailSetMembers` | `effectiveRailSetMembers` plain | NO |
| `getRotoSpacingSelection` | `rotoSpacingSelection.peek()` + store getters | NO (peek) |
| `getLaunchContext` | `launchContextRef.current` ref | NO |
| `getSelectedKeyId` / `getSelectedKeyIds` | `selectedKeyId.value` / `selectedKeyIds.value` | YES |
| `getPhysicalCells` | `rotoTimelineModel.physicalCells.value` | YES |
| `pendingOperationId` | `pendingOperationIdSignal` | YES |
| `getModel` | `rotoTimelineModel.view.value.model` | YES |
| `getCapacity` / `getParentEndExclusive` | store getters | YES (store reads signals) |

Concrete staleness scenario: user at empty frame 5, `canAddEmptyKey` true → click +Key → key
added at frame 5 → `rotoKeyRecords` changes but `canAddEmptyKey`'s tracked deps
(`pendingOperationId`, `currentFrameSignal`) do not → computed stays true → button stays
enabled. The runner `addKey` (useRotoKeyUtilities.ts:308-317) re-checks
`session.actionAvailability.value` at call time and rejects with a status message — no data
corruption, but a stale-button UX regression that violates the HARD CONSTRAINT
("Availability must stay LIVE"). **The planner must convert the non-signal ports to
signal-backed reads** (e.g., wrap `rotoKeyRecords`/`rotoInterpolationState`/selection values in
`useComputed`/`useSignal` in the Studio and have the ports read `.value`).

### Gap 2 — `physicalActions` identity is not stable even with useComputed
The bundle useMemo (useRotoTimelineActions.ts:3318-3366) deps include the action runners
(`insertRotoFrame` :1920, `deleteRotoFrame` :1955, `scissorKeyRail` :2046, `runPhysicalAction`
:1857, drag/push/rail-set runners), all `useCallback(..., [input])`. `input` is a fresh object
literal each Studio render (PhysicsPaintStudio.tsx:1470). So the runners re-create each render
→ `physicalActions` re-creates each render → a memo-wrapped action-row receiving
`rotoPhysicalActions` as a prop still re-renders. **The planner must stabilize `input`**
(memoize the input object in the Studio with stable deps — feasible once the ports are
signal-backed, since the closures then read stable signals) **or pass individual
signals + handlers to the action-row instead of the whole bundle.**

### Gap 3 — handler props depend on `rotoPhysicalActions` identity
`onPasteRotoFrame` (:1716-1723), `onCopyRotoFrame` (:1689-1705), `onCutRotoFrame`
(:1709-1715), `onDuplicateRotoKey` (:1682-1688) all list `rotoPhysicalActions` in their
useCallback deps → re-created each render. `onAddRotoKey = rotoKeyUtilities.addKey` (:1660)
and `onInsertRotoFrame`/`onDeleteRotoFrame`/`onScissorKeyRail` come from the bundle. For the
memo's shallow compare to skip, every handler prop must be identity-stable — which again
requires stabilizing `rotoPhysicalActions`/`input`.

### Gap 4 — the isolated-button-render test is not feasible as stated
No renderer exists (see Mechanism Verification). The CONTEXT.md decision "render the extracted
action-row button component in isolation … assert render count via a spy" requires a renderer
the project does not have. Adding one conflicts with the project memory "No test config hacks —
use existing test setup". **Adapt the test to the established harnesses:**
- (a) A source-scan contract test asserting the extracted action-row is `memo`-wrapped and its
  buttons read `ReadonlySignal` props (mirrors PhysicsPaintWorkflowStrip.test.ts style).
- (b) A hook-level test (mocked `@preact/signals`, BackgroundAssetPickerView.test.ts:24-31
  pattern) asserting the `useComputed`-stabilized computeds re-evaluate when
  `currentFrameSignal` changes and that `physicalActions` identity is stable across two hook
  calls with the same signal.

### Gap 5 — useRotoTimelineActions.test.ts harness breaks with useComputed
The harness mocks `preact/hooks` with **only** `useCallback` and `useMemo`
(useRotoTimelineActions.test.ts:4-7) — `useRef` is undefined. `useComputed` internally calls
`preact/hooks` `useRef`, so the hook would throw in this harness. The harness also calls
`useRotoTimelineActions(input)` at :178 — the new signature needs the `currentFrameSignal`
argument. **The harness must be updated** (mock `useComputed` → `computed` per the
BackgroundAssetPickerView pattern, and pass a `signal()` for the frame).

### Gap 6 — source-scan contract tests pin the strip's availability reads
PhysicsPaintWorkflowStrip.test.ts asserts the strip render body contains
`physicalActions?.deleteScopeLabel.value ?? 'Delete Frame'` (:173),
`physicalActions?.insertTooltipDescription.value ?? 'Insert key before'` (:464),
`buildGuardedActionTooltipCopy(physicalActions?.scissorTooltipDescription.value …)` (:534), and
drag reads `prepareRotoGroupDrag={physicalActions?.prepareRotoGroupDrag}` (:1754-1755),
`prepareKeyRailDrag={physicalActions?.prepareKeyRailDrag}` (:1816-1817), `!physicalActions`
(:1873). If the action-row is extracted, these reads move into the extracted component and the
tests must be updated in the same commit.

### Gap 7 — signal write location (Rule 6)
CONTEXT.md says the Studio-owned frame signal is "written in the setLaunchContext
startFrame-change branch" (:492, inside the `setLaunchContextState` updater). A signal write
inside a state updater is a render-phase write risk. The sanctioned form is the guarded echo
(`if (sig.peek() !== next) sig.value = next`). Cleaner: write in the three startFrame callers
that run in event/effect context — `scheduleRotoStartFramePropagation` (:539-543, the rAF
scrub path), `setCurrentAppFrame` (:1293-1297), `setLaunchContextStartFrame` (:1356). The
planner should pick one and keep the guarded-echo form.

### Gap 8 — stale-closure risk in the strip's inline handlers
The action-row buttons' `onClick` are inline arrows closing over render-scoped availability
booleans (e.g. `if (!canAddRotoKey) return; props.onAddRotoKey?.();` at :4326-4330). When the
action-row is memoized, these closures freeze. The narrow per-button subscribers must read the
availability signals live so the onClick guard is always fresh. The runners themselves
re-classify at call time (`insertRotoFrame` :1920-1953, `deleteRotoFrame` :1955-2044,
`scissorKeyRail` :2046+, `addKey` reads `session.actionAvailability.value` at call time), so a
stale button is rejected with a status message — no corruption, but the stale visual must not
ship.

## Call-Site and Reader Inventory

- **`useRotoTimelineActions` call sites:** exactly one production call —
  PhysicsPaintStudio.tsx:1470 — plus the test harness (useRotoTimelineActions.test.ts:178).
  The signature change (adding `currentFrameSignal`) is contained to these two.
- **Strip currentFrame mirror readers:** the internal `currentFrameSignal` is passed to
  `RotoPlaybackCurrentFrameOutput` (:4103) and `PhysicsPaintPlayheadBar` (:4293), both of which
  already accept `currentFrame: Signal<number>` (:720, :736). Replacing the mirror with a
  Studio-owned signal prop requires **no change** to these leaves. The strip keeps the number
  `currentFrame` prop (used at :1793, :1796-1799, :1810, :1824-1825, :1893-1895, :2432, :2984,
  :2996, :3112-3113, :4312-4316) and gains a `Signal<number>` prop.
- **`rotoPhysicalActions` is used beyond the action-row:** the strip's track-rename handler
  reads `props.rotoPhysicalActions?.publishStatus` (:1541-1556). The strip keeps the bundle
  prop; only the action-row extraction narrows.

## Test Strategy

- **Feasible:** hook-level test (mocked `@preact/signals`) asserting (1) `useComputed`-stabilized
  computeds re-evaluate when `currentFrameSignal` changes, (2) `physicalActions` identity is
  stable across renders with a stable signal, (3) `getCurrentAppFrame` reads the live signal.
  Copy the BackgroundAssetPickerView.test.ts:24-31 mock pattern.
- **Feasible:** source-scan contract test asserting the extracted action-row is `memo`-wrapped
  and its buttons read `ReadonlySignal` props (PhysicsPaintWorkflowStrip.test.ts style).
- **Not feasible as stated:** isolated button render with a render spy — no renderer exists.
  Do not add one (project memory: no test config hacks).
- **Must update in the same commit:** useRotoTimelineActions.test.ts harness (Gap 5) and the
  source-scan assertions in PhysicsPaintWorkflowStrip.test.ts (Gap 6).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The store getters (`getCapacity`, `getParentEndExclusive`, `getRotoLoopClips`, `getCurrentSettings`, `getStoreRotoFrames`, `getFailureStatus`) read signals internally and are therefore tracked when called inside a computed | Mechanism Verification | If any reads a plain value, that classifier goes stale under useComputed — the planner should audit each store getter for `.value` reads |
| A2 | `rotoKeyUtilities`/`rotoNavigation` are identity-stable across renders (so `onAddRotoKey` is stable) | Gap 3 | If unstable, `onAddRotoKey` also needs stabilization; verify `useRotoNavigationCoordinator`'s internal memoization |
| A3 | The `getCurrentAppFrame` input port can be overridden internally by the hook (or dropped) once `currentFrameSignal` is a hook argument | Signal threading | If the port must stay caller-provided, the Studio passes `getCurrentAppFrame: () => currentFrameSignal.value` and the hook signature need not change — planner should confirm which form the executor implements |

## Sources

### Primary (HIGH confidence — read this session)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — :382-383, :492-509, :530-538,
  :539-543, :620, :625, :676, :1293-1297, :1356, :1470, :1508, :1660, :1682-1723, :3915, :3968
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — :2, :1419, :1783-1854,
  :1920-1953, :1955-2044, :2046+, :2204, :3318-3366, :3669-3798
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — :210, :720, :736,
  :1412, :1446-1447, :1541-1556, :1829-1920, :4103, :4293, :4301, :4312-4316, :4326-4330
- `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` — :1, :74-99, :263
- `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` — :308-317
- `app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts` — :24-31
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — :4-7, :178
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — :173, :464, :534,
  :1754-1755, :1816-1817, :1873
- `app/node_modules/@preact/signals/dist/signals.d.ts:5` and `dist/signals.js` (useComputed impl)
- `app/package.json:20` (`@preact/signals` ^2.8.1), `app/vitest.config.ts:5`
- `.claude/skills/efx-preact-reactivity/SKILL.md` — Rules 3/5/6

### Secondary (MEDIUM confidence)
- None — all claims verified against live source this session.

## Metadata

**Confidence breakdown:**
- Root cause: HIGH — every anchor verified against live source; only line numbers moved.
- Mechanisms: HIGH — useComputed/memo/narrow-subscriber patterns confirmed in code.
- Design gaps: HIGH for Gaps 1-6 (direct code evidence); MEDIUM for Gap 7 (signal-write
  location is a judgment call) and A1/A2/A3 (store-getter tracking and hook stability not
  fully traced).

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 (stable codebase, no fast-moving deps)
