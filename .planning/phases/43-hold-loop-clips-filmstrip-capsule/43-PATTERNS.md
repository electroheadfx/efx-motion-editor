# Phase 43: Hold Loop Clips + Filmstrip Capsule - Pattern Map

**Mapped:** 2026-08-07
**Scope:** Correction refresh after native UAT Step 1 host failure
**Files analyzed:** 31 new, modified, retained, or removed files
**Analogs found:** 31 / 31

## Correction Boundary

This map supersedes the earlier Phase 43 pattern map wherever it assigned Loop Clip presentation or interaction ownership to the Motion Editor main timeline.

- **Retain unchanged:** canonical physical model, persistence, resolver algebra, store resolution, preview/export parity, physical-edit authority, accepted history, Play Script controller, and Play Script dialog.
- **Adapt into EFX Paint:** filmstrip capsule derivation, conditional range lane, capsule selection, occurrence details, local actions, and Loop Edit activation.
- **Remove from the main timeline:** `frameMap` projection, timeline Loop Clip types, canvas rendering/hit testing, timeline tooltip, and the loop-specific parent-to-child request protocol once callers are gone.

The dedicated Loop Clip lane is part of the existing EFX Paint/Roto strip. It is hidden when there are no Loop Clips, shares the physical timeline's horizontal coordinate system, and must not alter real-key cell navigation, selection, multi-selection, or drag behavior.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipLane.tsx` (new) | component | transform + event-driven | `PhysicsPaintWorkflowStrip.tsx` | exact host/data-flow match |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipPopover.tsx` (new) | component | event-driven + request-response | `PhysicsPaintStyledTooltip.tsx`, `UsagePopover.tsx`, local model logic from `TimelineCapsuleTooltip.tsx` | composite match |
| `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts` (new or relocated) | utility | transform | `physicsPaintWorkflowPresentation.ts`, pure portions of `loopCapsuleGeometry.ts` | exact role match |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | component | transform + event-driven | existing ruler/physical-lane composition in the same file | exact self-analog |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | component/coordinator | request-response | existing focused `useRotoTimelineModel` and `useRotoPlayScriptController` wiring | exact self-analog |
| `app/src/components/physic-paint/hooks/useRotoTimelineModel.ts` | hook/model adapter | transform | existing Loop Clip structural view in the same file | exact self-analog |
| `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` | hook/controller adapter | request-response | existing accepted Play Script commit path | exact self-analog |
| `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` | utility | transform | exhaustive pure helpers in the same file | exact self-analog |
| `app/src/components/physic-paint/physicsPaintStudio.css` | config/styles | transform | existing conditional strip/lane geometry rules | exact role match |
| `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` | component | request-response | existing typed `workflow` prop forwarding | exact self-analog |
| `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts` | hook/utility | transform | existing dependency-keyed identity memo | exact self-analog |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` | test | transform + event-driven | existing strip geometry, source-contract, and visible-window tests | exact match |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipLane.test.tsx` (new, or colocated equivalent) | test | transform + event-driven | `PhysicsPaintWorkflowStrip.test.ts` and relocated pure capsule assertions | composite match |
| `app/src/components/physic-paint/view/PhysicsPaintLoopClipPopover.test.tsx` (new, or colocated equivalent) | test | event-driven + request-response | `TimelineCapsuleTooltip.test.ts` pure assertions plus local controller tests | composite match |
| `app/src/components/physic-paint/hooks/useRotoTimelineModel.test.ts` | test | transform | existing Loop Clip lazy-resolution tests | exact self-analog |
| `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts` | test | event-driven | existing approved Roto selection reducer tests | exact retained regression |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | test | request-response | existing local Loop Clip operation suites | exact retained regression |
| `app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts` | test | event-driven | existing accepted-output Undo/Redo tests | exact retained regression |
| `app/src/lib/frameMap.ts` | utility removal | transform | no replacement; EFX uses `useRotoTimelineModel` directly | removal assignment |
| `app/src/types/timeline.ts` | model/type removal | transform | EFX physical types and resolution context | removal assignment |
| `app/src/components/timeline/TimelineRenderer.ts` | component removal | transform | `PhysicsPaintLoopClipLane.tsx` | host relocation |
| `app/src/components/timeline/TimelineInteraction.ts` | controller removal | event-driven | local EFX lane/popover event handlers | host relocation |
| `app/src/components/timeline/TimelineCanvas.tsx` | component removal | event-driven | no replacement mount in main timeline | removal assignment |
| `app/src/components/timeline/TimelineCapsuleTooltip.tsx` | component removal | event-driven + request-response | EFX-local popover and presentation modules | host relocation |
| `app/src/lib/physicPaintBridge.ts` | service removal (partial) | pub-sub + request-response | generic authority/apply bridge retained; loop-specific protocol has no replacement | partial removal |
| `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` | service removal (partial) | pub-sub | generic transports retained; loop-specific senders removed | partial removal |
| `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` | hook removal (partial) | event-driven | direct local controller calls | partial removal |
| `app/src/types/physicPaint.ts` | model/type removal (partial) | request-response | local controller intent/results | partial removal |
| `app/src/lib/frameMap.test.ts` | test removal (partial) | transform | EFX lane/model tests | replacement match |
| `app/src/components/timeline/TimelineRenderer.test.ts`, `TimelineInteraction.test.ts`, `TimelineCapsuleTooltip.test.ts` | test removal | transform + event-driven | EFX lane/popover tests | replacement match |
| `app/src/lib/physicPaintBridge.test.ts`, `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.test.ts`, `app/src/lib/physicPaintLoopOperationBridge.test.ts` | test removal (partial/full) | pub-sub + request-response | local controller tests; generic bridge tests retained | replacement match |

## Pattern Assignments

### `app/src/components/physic-paint/view/PhysicsPaintLoopClipLane.tsx`

**Role:** component  
**Data flow:** compact interval/resolution context -> visible frame-aligned presentation; pointer/keyboard events -> local selection and actions  
**Primary analog:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`

#### Imports pattern

Use Preact-native local state and existing physical-domain types. Do not import main-timeline stores, playback globals, `frameMap`, or timeline layout types.

**Source:** `PhysicsPaintWorkflowStrip.tsx` lines 1-5

```tsx
import {memo} from 'preact/compat';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'preact/hooks';
import {useSignal, type Signal} from '@preact/signals';
```

Prefer direct props, pure derivation, and local event handlers. A Signal is appropriate if lane selection/popover state must be updated by sibling controls or controller acknowledgements; do not mirror props into hook state through effects.

#### Host placement pattern

**Source:** `PhysicsPaintWorkflowStrip.tsx`, existing timeline scroller composition around the ruler and physical lane

```tsx
<div ref={timelineScrollRef} class="physics-paint-timeline-scroll" onScroll={updateScrollbar}>
  <div class="physics-paint-ruler" ... />
  <div ref={timelineContentRef} class="physics-paint-lane">
    <div class="physics-paint-roto-cells" role="row">
      ...
    </div>
  </div>
</div>
```

Insert the conditional lane in this same scroller, immediately after `.physics-paint-ruler` and before `.physics-paint-lane`:

```tsx
{hasLoopClips && (
  <PhysicsPaintLoopClipLane
    resolutionContext={rotoLoopResolutionContext}
    visibleWindow={visibleWindow}
    framePitch={18}
    ...
  />
)}
```

Do not mount it over `.physics-paint-roto-cells`. Separate DOM surfaces are the mechanism that keeps range-object selection from competing with physical-key interactions.

#### Lazy derivation pattern

**Source:** `PhysicsPaintWorkflowStrip.tsx`, visible-frame resolution derivation

```ts
const loopResolutionContext = props.rotoLoopResolutionContext ?? null;
const visibleFrameResolutions = useMemo(
  () => loopResolutionContext === null
    ? null
    : resolveRotoVisibleFrameResolutions(loopResolutionContext, frameCells),
  [loopResolutionContext, frameCells],
);
```

Apply the same bounded-window rule to capsules and repeated occurrence cells:

- Keep compact Loop Clip interval records.
- Derive only capsules/ghost cells intersecting the current visible frame window.
- Resolve occurrences by modulo arithmetic.
- Never materialize an Infinity list.
- Never generate repeated durable/cache assets.

#### Interaction separation pattern

**Source:** `PhysicsPaintWorkflowStrip.tsx`, real-key drag eligibility

```ts
const dragEligible =
  isPhysicalRealKey
  && !rotoDragLocked
  && frameInteraction?.dragEligible !== false;
```

The new lane must not change this expression or route capsule pointer events into cell handlers. Capsule body and compact badge are distinct keyboard-reachable controls:

- Body click: select Loop Clip and open local occurrence/details popover.
- Badge click: stop propagation and call local `openLoopEdit(loopId)`.
- Enter/Space: activate the focused body or badge.
- Escape: close the local popover/tooltip and return focus appropriately.
- Delete/Backspace: do not become Loop Clip shortcuts.

#### Visual content pattern

Adapt the pure algorithms from `app/src/components/timeline/loopCapsuleGeometry.ts`, not its main-timeline coordinate transform:

```ts
badgeTextForLoop(...)
zoomBandForFrameWidth(...)
isZeroEffectiveLoop(...)
visibleGhostCells(...)
truncationDiagonalFrame(...)
firstCycleCellFrames(...)
```

Render the locked semantics:

- First source cycle thumbnails.
- Zoom-adaptive linked repetitions.
- Compact finite or infinity badge.
- Requested/effective truncation.
- Amber truncation diagonal.
- Unresolved/error state.
- Zero-effective anchor flag.

Do not copy `loopCapsuleFrameToX(...headerWidth...)`; EFX coordinates are local to the 18px frame grid and have no main-timeline track header offset.

---

### `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts`

**Role:** utility/presentation model  
**Data flow:** Loop Clip intervals + viewport -> immutable presentation records  
**Primary analogs:** `physicsPaintWorkflowPresentation.ts` and pure portions of `loopCapsuleGeometry.ts`

#### Pure helper pattern

**Source:** `physicsPaintWorkflowPresentation.ts`, exhaustive resolution switch

```ts
export function getRotoResolutionCellTooltipKind(
  resolution: PhysicPaintRotoFrameResolution,
  existing: RotoCellSemanticTooltipKind,
): RotoCellSemanticTooltipKind {
  switch (resolution.kind) {
    case 'real':
      return 'real-key';
    case 'linked':
    case 'linked-unresolved':
    case 'empty':
      return existing;
    default: {
      const exhaustive: never = resolution;
      throw new Error(
        `Unhandled Roto frame resolution kind: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
```

Follow these constraints:

- No store or Signal reads inside presentation helpers.
- No DOM access.
- Immutable inputs and outputs.
- Exhaustive discriminated-union handling.
- Separate geometry/copy derivation from component lifecycle and controller calls.

#### Geometry adaptation pattern

Relocate or adapt from `loopCapsuleGeometry.ts`:

```ts
export function badgeTextForLoop(input: {
  cycleLength: number;
  repeat: number | 'infinity';
}): string

export function zoomBandForFrameWidth(
  frameWidth: number,
): 'high' | 'default' | 'low'

export function visibleGhostCells(
  interval: LoopCapsuleGeometryInterval,
  visibleStartFrame: number,
  visibleEndFrame: number,
): LoopCapsuleGhostCell[]
```

Rename timeline-specific types to EFX-owned types and derive x/width from local frame offsets:

```ts
const left = (frame - visibleStartFrame) * framePitch;
const width = frameCount * framePitch;
```

Keep requested and effective duration separate. Effective end remains resolver-authoritative; the presentation module must not duplicate boundary algebra.

---

### `app/src/components/physic-paint/view/PhysicsPaintLoopClipPopover.tsx`

**Role:** component  
**Data flow:** selected capsule/occurrence -> local details/actions -> accepted controller result  
**Primary analogs:** `PhysicsPaintStyledTooltip.tsx`, `UsagePopover.tsx`, and pure model/action ordering from `TimelineCapsuleTooltip.tsx`

#### Styled tooltip lifecycle

**Source:** `PhysicsPaintStyledTooltip.tsx`

Reuse:

- 1000ms delayed hover.
- Immediate keyboard-focus visibility.
- Escape dismissal.
- 8px viewport clamping.
- Fixed-position styled surface.
- Text nodes only; never inject unresolved IDs as HTML.

Use the existing `useStyledTooltip()` controller for informational hover/focus behavior where possible rather than adding a parallel global tooltip signal.

#### Actionable popover lifecycle

**Source:** `app/src/components/import/UsagePopover.tsx`

```ts
useEffect(() => {
  const handler = () => onClose();
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [onClose]);
```

```tsx
onMouseDown={(event: MouseEvent) => event.stopPropagation()}
```

Reuse the portal, outside-click, propagation isolation, and viewport-clamping pattern. Add focused Escape handling and focus return to the capsule body. Effects are justified here because they synchronize component visibility with document-level events.

#### Copy/action model to relocate

**Source:** `TimelineCapsuleTooltip.tsx` lines 15-21 and 54-90

```ts
export type TimelineCapsuleTooltipAction =
  | 'Edit source frame'
  | 'Duplicate linked loop'
  | 'Repair loop…'
  | 'Relink loop…'
  | 'Unlink loop'
  | 'Delete loop';
```

Relocate the pure copy/action selection logic into EFX-owned names. Preserve the locked action ordering and state-dependent options:

- Unresolved: Repair, Relink, Unlink, Delete.
- Zero-effective: Duplicate, Unlink, Delete.
- Occurrence: Edit source frame, Duplicate, Unlink, Delete.
- Truncated/default: Duplicate, Unlink, Delete.

#### Local operation routing

Do **not** copy these main-timeline dependencies from `TimelineCapsuleTooltip.tsx`:

```ts
sequenceStore
playbackEngine
requestPhysicPaintLoopOperation
window.prompt
```

Route actions through EFX-local ports:

```ts
interface PhysicsPaintLoopClipPopoverOps {
  editSourceFrame(sourceAppFrame: number): void;
  openLoopEdit(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
  duplicateLinkedLoop(loopId: string, destinationStart: number): Promise<RotoPlayScriptLoopOpResult>;
  unlinkLoop(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
  repairLoop(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
  relinkLoop(loopId: string, sourceKeyIds: readonly string[]): Promise<RotoPlayScriptLoopOpResult>;
}
```

`Delete loop` intentionally calls the same unlink-only controller operation as `Unlink loop`; source keys remain ordinary Roto keys.

On operation result:

- `ok: true`: close the popover after the accepted controller result.
- `ok: false`: keep it open and render `reason` locally.
- Do not close on dispatch alone.
- Do not optimistically remove or alter the capsule.

---

### `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`

**Role:** component host  
**Data flow:** reactive workflow model -> ruler, conditional Loop Clip lane, physical cells

#### Props pattern

The file already accepts:

```ts
rotoLoopResolutionContext?: PhysicPaintRotoLoopResolutionContext | null;
```

Pass focused action ports rather than the entire Studio/controller object. Suggested prop surface:

```ts
onOpenRotoLoopEdit?: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
onDuplicateRotoLinkedLoop?: (loopId: string, destinationStart: number) => Promise<RotoPlayScriptLoopOpResult>;
onUnlinkRotoLoop?: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
onRepairRotoLoop?: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
onRelinkRotoLoop?: (loopId: string, sourceKeyIds: readonly string[]) => Promise<RotoPlayScriptLoopOpResult>;
```

Use existing frame-navigation callbacks for `Edit source frame` instead of introducing playback globals.

#### Physical-cell contract to preserve

Keep the current plain/modifier behavior intact:

```ts
if (cellKeyId !== null && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
  current.onToggleRotoKeySelection?.(cellKeyId);
  return;
}
if (cellKeyId !== null && event.shiftKey && !event.metaKey && !event.ctrlKey) {
  current.onExtendRotoKeySelection?.(cellKeyId);
  return;
}
if (
  cellKeyId !== null
  && !event.metaKey
  && !event.ctrlKey
  && !event.shiftKey
  && current.rotoSelectedKeyIdSet.size >= 2
) {
  current.onCollapseRotoSelectionToKey?.(cellKeyId);
}
current.onNavigateToSyncedFrame(frame);
```

Do not make linked occurrence cells selectable or draggable as real keys. The existing additive linked badge/border may remain, but it is not the Loop Clip selection surface.

---

### `app/src/components/physic-paint/PhysicsPaintStudio.tsx`

**Role:** component/coordinator  
**Data flow:** canonical store/controller state -> focused workflow props; accepted controller actions -> parent authority

#### Timeline model wiring

Current analog:

```ts
const rotoTimelineModel = useRotoTimelineModel({
  cachedRotoFrames: latestRotoFramesRef.current,
  interpolationSettings: rotoLegacyInterpolationSettings,
  currentFrame,
  rotoKeyRecords,
  rotoInterpolationState,
  capacity: launchContext
    ? physicPaintStore.getRotoPhysicalCapacity(launchContext.layerId)
    : 1,
  selectedKeyId: selectedKeyId.value,
});
```

Add canonical Loop Clip inputs already supported by `useRotoTimelineModel`:

```ts
rotoLoopClips: launchContext
  ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId)
  : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
rotoParentEndExclusive: /* canonical parent boundary */,
```

Pass `rotoTimelineModel.loopResolutionContext.value` through the existing `workflow` view-model object. Do not derive a second copy from `frameMap` or sequence layout state.

#### Local action wiring

The existing controller is the action owner:

```ts
const rotoPlayScript = useRotoPlayScriptController({
  ...
  getRotoLoopClips: () => (
    launchContext
      ? physicPaintStore.getRotoPhysicalLoopClips(launchContext.layerId)
      : PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY
  ),
  executePhysicalEdit: physicalEditCoordinator.executePhysicalEdit,
  pendingOperationId: physicalEditCoordinator.pendingOperationId,
  acceptedOutput: physicalEditCoordinator.acceptedOutput,
  ...
}, bridgeMode);
```

Expose only its focused Loop Clip methods to the workflow/lane. Do not move operation validation or publication construction into the component.

#### Remove loop-specific bridge listeners

Remove these Studio calls when the main-timeline callers are removed:

```ts
usePhysicsPaintOpenLoopEditBridge((loopId) => {
  void rotoPlayScript.openLoopEdit(loopId);
});

usePhysicsPaintLoopOperationBridge(...);
```

Retain generic launch, project-context, authority, apply-result, save, and frame-sync bridge behavior.

#### Accepted-only pattern

Continue using the existing accepted acknowledgement helper:

```ts
async function dispatchAndWaitForAcceptedRotoPhysicalEdit<T extends {operationId: string}>(
  pendingOperationId: {
    peek: () => string | null;
    subscribe: (listener: (operationId: string | null) => void) => () => void;
  },
  acceptedOutput: {peek: () => T | null},
  dispatch: () => Promise<boolean>,
): Promise<T | null>
```

The lane/popover may react to the controller's final `RotoPlayScriptLoopOpResult`; it must not infer success from a sent request or a pending operation ID.

---

### `app/src/components/physic-paint/hooks/useRotoTimelineModel.ts`

**Role:** hook/model adapter  
**Data flow:** canonical physical records -> structural timeline and Loop Clip resolution context

This file already contains the correct data path and should be adapted only if a focused lane projection helper is needed.

```ts
rotoLoopClips?: readonly PhysicPaintRotoLoopClip[];
rotoParentEndExclusive?: number;
```

```ts
loopResolutionContext: Signal<PhysicPaintRotoLoopResolutionContext>;
getFrameResolution(appFrame: number): PhysicPaintRotoFrameResolution;
```

```ts
const physicalStructural = computed(() =>
  selectRotoPhysicalTimelineStructuralView({
    realKeyRecords: structuralInput.value.rotoKeyRecords ?? [],
    interpolation:
      structuralInput.value.rotoInterpolationState
      ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
    capacity: structuralInput.value.capacity ?? 1,
    loopClips: structuralInput.value.rotoLoopClips,
    parentEndExclusive: structuralInput.value.rotoParentEndExclusive,
  }),
);
```

Do not copy Loop Clip ranges into component-local state. Pass this computed authority directly to the strip.

---

### `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts`

**Role:** hook/controller adapter  
**Data flow:** UI intents -> authority request -> physical edit -> exact accepted output

Retain the accepted commit pattern:

```ts
const accepted = await dispatchAndWaitForAcceptedPlayScript(
  portsRef.current.pendingOperationId,
  portsRef.current.acceptedOutput,
  () => portsRef.current.executePhysicalEdit({
    operationKind: 'play-script',
    ...
    ...(publication.loopClips ? {loopClips: publication.loopClips} : {}),
  }),
);

if (!accepted || accepted.operationKind !== 'play-script') {
  return {
    ok: false,
    error: 'Play Script physical commit was rejected or timed out.',
  };
}
```

The generic authority request remains. The correction removes only the main-timeline-specific open/edit operation protocol, not the physical authority protocol.

---

### `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`

**Role:** retained controller  
**Data flow:** local request-response with parent-authoritative atomic commit

No replacement controller should be created. Reuse its existing API:

```ts
openLoopEdit(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
openSourceEdit(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
repairLoop(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
updateLoop(): Promise<boolean>;
unlinkLoop(loopId: string): Promise<RotoPlayScriptLoopOpResult>;
duplicateLinkedLoop(
  loopId: string,
  destinationStart: number,
): Promise<RotoPlayScriptLoopOpResult>;
relinkLoop(
  loopId: string,
  targetKeyIds: readonly string[],
): Promise<RotoPlayScriptLoopOpResult>;
```

All local operations already converge on:

```ts
async function runLoopOp(
  loopId: string,
  prepare: (
    loop: PhysicPaintRotoLoopClip,
    authority: PhysicPaintRotoAuthorityResult,
  ) => readonly PhysicPaintRotoLoopClip[] | string,
  statusLine: string,
): Promise<RotoPlayScriptLoopOpResult>
```

Core authority/commit/error pattern:

```ts
const authority = await ports.requestAuthority(...);
const prepared = prepare(loop, authority);
const publication = buildLoopOnlyPublication(...);
const result = await ports.commit(publication);
if (!result.ok) {
  throw new Error(
    result.error || 'Parent rejected the Loop Clip operation.',
  );
}
assertPublicationAck(publication, result);
return {ok: true, reason: null};
```

Unlink/delete data semantics are already canonical:

```ts
function unlinkLoop(loopId: string) {
  return runLoopOp(
    loopId,
    (loop) =>
      currentLoopClips().filter(
        (clip) => clip.loopId !== loop.loopId,
      ),
    'Loop Clip unlinked — source keys remain ordinary Roto keys.',
  );
}
```

Do not duplicate guards, revision checks, source validation, or publication logic in lane components.

---

### `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx`

**Role:** retained component shell

The existing prop boundary already supports the correction:

```ts
workflow: ComponentProps<typeof PhysicsPaintWorkflowStrip>;
```

```tsx
<PhysicsPaintWorkflowStrip {...workflow} />
```

Keep the new lane inside `PhysicsPaintWorkflowStrip`; do not add a sibling authoring surface or a second timeline host in `PhysicsPaintStudioView`.

---

### `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts`

**Role:** utility/hook  
**Data flow:** dependency-keyed immutable view-model construction

Use the existing identity memo pattern:

```ts
export function createIdentityMemo() {
  let lastDeps: readonly unknown[] | null = null;
  let lastValue: unknown = null;
  return {
    resolve<T>(nextDeps: readonly unknown[], build: () => T): T {
      ...
    },
  };
}
```

Add Loop Clip resolution context and action ports to the existing workflow memo dependencies. Do not synchronize them into duplicated state with `useEffect`.

---

### `app/src/components/physic-paint/physicsPaintStudio.css`

**Role:** styles/config  
**Data flow:** loop-presence modifier -> conditional vertical geometry

#### Base geometry must remain exact

```css
.physics-paint-studio {
  display: grid;
  grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px;
}
```

```css
.physics-paint-workflow-strip {
  height: 161px;
  overflow-x: auto;
  overflow-y: hidden;
}
```

Projects without Loop Clips must keep these rules and the existing rendered geometry exactly.

#### Conditional modifier pattern

Add a loop-present class or data attribute rather than changing the base rules:

```css
.physics-paint-studio.has-roto-loop-lane {
  grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 193px;
}

.physics-paint-workflow-strip.has-roto-loop-lane {
  height: 193px;
}

.physics-paint-loop-clip-lane {
  position: relative;
  min-width: 2160px;
  height: 32px;
}
```

Preserve the existing grid contracts:

```css
.physics-paint-ruler {
  height: 28px;
  min-width: 2160px;
}

.physics-paint-lane {
  grid-template-columns: 2160px;
  min-width: 2160px;
  height: 38px;
}

.physics-paint-roto-cells {
  grid-template-columns: repeat(120, 18px);
}

.physics-paint-roto-cell {
  height: 24px;
}
```

The capsule is 24px high with 4px top and bottom clearance inside the 32px lane. Keep existing semantic cell colors and additive linked occurrence treatment unchanged.

## Shared Patterns

### Canonical physical authority

**Sources:**

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`
- `app/src/stores/physicPaintStore.ts`

**Apply to:** lane presentation, popover details, controller operations, preview/export regressions

Rules:

1. Persist one compact Loop Clip record, not repeated frames.
2. Derive ranges through the canonical resolver.
3. Resolve linked occurrences lazily by source-cycle modulo.
4. Preserve verbatim unresolved references.
5. Treat Effective duration as derived from boundaries, never as a second persisted authority.
6. Keep the parent end and next-content truncation algebra centralized.

### Accepted-only mutations

**Sources:**

- `physicsPaintRotoPlayScriptController.ts` `runLoopOp`
- `useRotoPlayScriptController.ts` accepted commit handling
- `PhysicsPaintStudio.tsx` `dispatchAndWaitForAcceptedRotoPhysicalEdit`
- `physicsPaintRotoLoopHistory.test.ts`

**Apply to:** Duplicate, Unlink, Delete, Repair, Relink, Link/Create, Loop Edit update

Rules:

- No optimistic durable Loop Clip mutation.
- No local success based only on dispatch.
- Match the exact accepted operation/revision acknowledgement.
- Close an action popover only after accepted success.
- Keep the popover open and display the controller reason on rejection.
- Undo/Redo replays the whole physical snapshot atomically, including Loop Clips.

### Preact state boundary

**Sources:** project `CLAUDE.md`, `useRotoTimelineModel.ts`, `usePhysicsPaintStudioViewModel.ts`

**Apply to:** all new EFX components/hooks

Rules:

- Prefer computed/direct derivation for model projections.
- Prefer Signals for state shared beyond one component lifecycle.
- Use local hooks only for genuinely local DOM lifecycle concerns such as focus, measured placement, outside click, or document listeners.
- Do not copy Signal values into hook state through synchronization effects.
- Do not expand `PhysicsPaintStudio.tsx` with presentation algorithms; keep a focused lane component and pure presentation module.

### Tooltip and popover accessibility

**Sources:** `PhysicsPaintStyledTooltip.tsx`, `UsagePopover.tsx`

**Apply to:** capsule body, occurrence details, compact badge, action menu

Rules:

- Separate body and badge controls.
- Support pointer and keyboard activation.
- Show focus information immediately.
- Clamp to viewport.
- Escape closes.
- Outside click closes actionable popover.
- Return focus to the originating capsule control.
- Render unresolved IDs as text only.
- Do not register Delete/Backspace as lane operation shortcuts.

### Physical-cell isolation

**Sources:** `PhysicsPaintWorkflowStrip.tsx`, `physicsPaintRotoMultiSelection.test.ts`

**Apply to:** the lane host and CSS

Rules:

- Keep real-key selection state independent from Loop Clip range selection.
- Keep modifier selection and shift-range behavior unchanged.
- Keep drag eligibility restricted to physical real keys.
- Keep pending drag proposals visible until accepted.
- Keep rejection restoration behavior unchanged.
- Linked occurrence badges remain additive styling, not selection handles.

## Removal Assignments

### Main-timeline projection and types

#### `app/src/lib/frameMap.ts`

Remove:

- `loopCapsules` output/feed.
- Main-editor Loop Clip range projection.
- Calls to `deriveMainEditorLoopRanges` / `buildTimelineLoopCapsules`.

Do not replace this with a renamed adapter. The EFX lane consumes `useRotoTimelineModel.loopResolutionContext` directly.

#### `app/src/types/timeline.ts`

Remove main-timeline-only types and fields:

- `TimelineLoopCapsuleSourceCell`
- `TimelineLoopCapsule`
- `FxTrackLayout.loopCapsules`

Keep canonical physical Loop Clip and resolver types in the physical domain.

### Main-timeline rendering and interaction

#### `app/src/components/timeline/TimelineRenderer.ts`

Remove `drawLoopCapsules` and its invocation. The main timeline must not render a read-only remnant, summary, hit target, or navigation shortcut.

#### `app/src/components/timeline/TimelineInteraction.ts`

Remove:

- Capsule hit testing.
- Capsule hover/focus request publishing.
- Capsule selection state.
- Badge/body routing.
- Open/edit/delete keyboard handling.
- Loop-operation requests.

Do not leave invisible hit regions after drawing is removed.

#### `app/src/components/timeline/TimelineCanvas.tsx`

Remove:

```tsx
import {TimelineCapsuleTooltip} from './TimelineCapsuleTooltip';
```

and:

```tsx
<TimelineCapsuleTooltip />
```

#### `app/src/components/timeline/TimelineCapsuleTooltip.tsx`

Delete the main-timeline component after relocating only the host-neutral model/action ordering needed by the EFX popover. Do not retain its `sequenceStore`, `playbackEngine`, global request Signal, or bridge request construction.

### Loop-specific main-to-child protocol

#### `app/src/lib/physicPaintBridge.ts`

Remove after all callers are gone:

```ts
PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT
PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT
PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT
requestPhysicPaintLoopOperation(...)
openPhysicPaintLoopEdit(...)
```

Retain generic EFX Paint launch, project context, physical authority, apply-result, save, and frame-sync protocols.

#### `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts`

Remove only the loop-open and loop-operation request/result transport senders. Retain generic authority/apply transport.

#### `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts`

Remove:

```ts
usePhysicsPaintOpenLoopEditBridge(...)
usePhysicsPaintLoopOperationBridge(...)
```

Local lane actions call the existing local controller directly.

#### `app/src/types/physicPaint.ts`

Remove strict request/result envelopes and guards used only by the removed loop-specific protocol. Do not remove canonical Loop Clip records, physical publication types, authority types, or accepted apply-result types.

### Removal completion check

Before deleting protocol definitions, search for every identifier above and require zero non-test callers. After test cleanup, require zero repository references. Do not remove generic bridge infrastructure merely because it shares the same file.

## Regression Test Assignments

### Conditional no-loop geometry

**Primary analog:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`

Existing exact CSS assertions:

```ts
expect(
  getCssRuleBlock(styles, '.physics-paint-workflow-strip {'),
).toContain('height: 161px');

expect(
  getCssRuleBlock(styles, '.physics-paint-studio {'),
).toContain(
  'grid-template-rows: minmax(58px, auto) minmax(0, 1fr) 161px',
);
```

Add regressions proving:

1. Empty `resolutionContext.ranges` renders no Loop Clip lane element.
2. Empty state does not apply the loop-present modifier.
3. Base Studio and strip heights remain exactly 161px.
4. Existing ruler, physical lane, and custom scrollbar geometry remain unchanged.
5. Non-empty ranges render the lane and apply exactly 193px.
6. The lane is exactly 32px and appears between ruler and physical lane inside the same scroller.
7. Capsule height is exactly 24px with 4px vertical clearance.

Keep existing physical geometry assertions:

```ts
expect(lane).toContain('height: 38px');
expect(
  getCssRuleBlock(styles, '.physics-paint-roto-cells {'),
).toContain('repeat(120, 18px)');
expect(
  getCssRuleBlock(styles, '.physics-paint-roto-cell {'),
).toContain('height: 24px');
```

### Roto cell navigation, selection, and drag preservation

**Primary analogs:**

- `PhysicsPaintWorkflowStrip.test.ts`
- `physicsPaintRotoMultiSelection.test.ts`

Keep the source-contract assertion:

```ts
expect(map).toContain(
  'const dragEligible = isPhysicalRealKey && !rotoDragLocked && frameInteraction?.dragEligible !== false;',
);
```

Retain and run the approved reducer/interaction suites for:

- Plain cell navigation.
- Meta/Ctrl toggle ordering.
- Shift range extension.
- Never-empty sole selection.
- Multi-selection collapse.
- Current-key transfer.
- Real-key-only drag arming.
- Rigid group movement.
- Invalid release without commit.
- Rejected move focus restoration.
- Linked/unresolved occurrence cells remaining non-draggable.

Add a lane regression proving body/badge activation does not invoke physical-cell handlers underneath.

### Lazy resolution and compact Infinity behavior

**Primary analogs:**

- `PhysicsPaintWorkflowStrip.test.ts`
- `useRotoTimelineModel.test.ts`

Existing bounded query assertion:

```ts
expect(query).toHaveBeenCalledTimes(visibleWindow.length);
```

Existing model expectations:

```ts
expect(model.loopResolutionContext.value.ranges).toHaveLength(1);
expect(model.getFrameResolution(18)).toMatchObject({
  kind: 'linked',
  loopId: 'L1',
  sourceKeyId: 'key-3',
});
```

Add tests for:

- No-loop context yields `ranges: []`.
- Finite and Infinity capsules derive only visible repetitions.
- Modulo source selection is correct at distant frames.
- No repeated durable frame/cache records are created.
- Truncated and zero-effective presentation comes from effective range data.

### Local popover copy and action routing

**Primary analog:** relocate applicable pure assertions from `TimelineCapsuleTooltip.test.ts` into EFX-owned tests.

Test exact state-dependent copy/actions for:

- Normal finite loop.
- Infinity loop.
- Occurrence source index.
- Partial-cycle truncation.
- Complete-cycle truncation.
- Static/Hold versus Progressive.
- Zero-effective anchor.
- Unresolved missing IDs rendered verbatim as text.

Test routing:

- Badge calls `openLoopEdit` locally and not a bridge function.
- Edit source frame calls the EFX navigation port.
- Delete and Unlink call unlink-only controller semantics.
- Duplicate/Repair/Relink use existing controller ports.
- Rejected action leaves popover open and shows reason.
- Accepted action closes at the appropriate point.
- Escape and outside click close without executing an operation.
- Delete/Backspace do not execute an operation.

### Accepted-only Loop Clip operations

**Primary analog:** `physicsPaintRotoPlayScriptController.test.ts`, operation suites around lines 1134-1550

Reuse existing tests for:

- `openLoopEdit`
- Loop-only update commit
- `unlinkLoop`
- `duplicateLinkedLoop`
- `repairLoop`
- `relinkLoop`
- Rejected authority/commit paths
- Exact acknowledgement validation

Add the UI adapter assertion that no local visual success/closure occurs before the returned accepted result.

### Atomic Loop Clip history

**Primary analog:** `physicsPaintRotoLoopHistory.test.ts`

Existing accepted output pattern:

```ts
acceptedOutput.value = {
  before: source,
  after: target,
  acceptedRevision:
    buildPhysicPaintRotoPhysicalRevision(
      target.records,
      target.interpolation,
      target.loopClips,
    ),
  operationId: `replay-${replayNumber}`,
  operationKind: input.operationKind,
  historyProvenance: input.historyProvenance,
};
```

Existing loop-only Undo/Redo pattern:

```ts
expect(await test.history.undo()).toBe(true);
expect(test.getCurrent().loopClips[0].repeat).toBe(5);
expect(await test.history.redo()).toBe(true);
expect(test.getCurrent().loopClips[0].repeat).toBe(9);
```

Keep these tests unchanged and include them in the correction's focused regression run.

### Main-timeline caller removal

Replace stale positive tests with absence contracts:

- `frameMap.test.ts`: no `loopCapsules` projection/output.
- `TimelineRenderer.test.ts`: no Loop Clip drawing path.
- `TimelineInteraction.test.ts`: no capsule hit testing or loop operation request.
- `TimelineCanvas` source contract: no tooltip import/mount.
- Bridge tests: no loop-open retry delivery and no loop-operation request/result protocol.
- Repository identifier search: zero references to removed event constants, functions, hooks, timeline capsule types, and `TimelineCapsuleTooltip`.

Do not delete generic bridge tests for authority, apply-result, launch, project context, save, or frame synchronization.

## Retained Unchanged

The correction should not redesign or relocate these authorities:

| File/Area | Retained Pattern |
|---|---|
| `physicsPaintRotoPhysicalModel.ts` | Persisted Loop Clip records and physical document authority |
| `physicsPaintRotoPhysicalResolver.ts` | Range derivation, boundary algebra, lazy frame resolution, physical-edit validation |
| `physicPaintStore.ts` | Structural/render-source resolution, unresolved query, source-scoped cache identity |
| Persistence allowlists and revision fingerprinting | Additive canonical Loop Clip persistence and revision authority |
| Physical edit coordinator | Parent-authoritative accepted transaction path |
| Physical history | Atomic snapshots and Undo/Redo provenance |
| `physicsPaintRotoPlayScriptController.ts` | Local Loop/Source Edit and all Loop Clip mutations |
| `PhysicsPaintPlayScriptDialog.tsx` | Existing EFX Paint modal host for Loop Edit and Source Edit |
| `previewRenderer.ts` | Unresolved placeholder and canonical preview resolution |
| `exportEngine.ts` | Fail-fast unresolved preflight and preview/export parity |
| Generic Physics Paint bridges | Launch, project context, authority, apply-result, save, frame sync |

Changes to these files should be limited to regression imports/type fallout required by removal of the unintended main-timeline surface.

## No Analog Found

None. Every corrected surface has a close in-repository analog:

- Strip/lane composition in `PhysicsPaintWorkflowStrip.tsx`.
- Pure presentation in `physicsPaintWorkflowPresentation.ts` and `loopCapsuleGeometry.ts`.
- Styled focus/hover tooltip in `PhysicsPaintStyledTooltip.tsx`.
- Actionable portal/outside-click behavior in `UsagePopover.tsx`.
- Local operations in `physicsPaintRotoPlayScriptController.ts`.
- Accepted-only coordination and history in existing physical-edit modules and tests.

## Metadata

**Analog search scope:**

- `app/src/components/physic-paint/**`
- `app/src/components/timeline/**`
- `app/src/components/import/**`
- `app/src/lib/**`
- `app/src/stores/**`
- `app/src/types/**`
- Phase 43 planning authority files

**Selection priority:** same role and data flow, then existing EFX Paint ownership, then host-neutral pure logic from the stale timeline implementation.

**Discovery note:** the requested codebase-memory MCP tools were not available in this session. Discovery used the project skill indexes, repository text search, and direct file reads instead.

**Pattern extraction date:** 2026-08-07

**Planning authority:** `43-CONTEXT.md` correction decisions D-33 through D-40 supersede earlier main-timeline host assignments. `43-UI-SPEC.md` owns corrected geometry and interaction details. `43-UAT.md` is the failure evidence requiring this relocation.
