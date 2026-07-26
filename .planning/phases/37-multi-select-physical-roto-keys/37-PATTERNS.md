# Phase 37: Multi-Select Physical Roto Keys - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 11 (10 modified in place + 1 new test file, post-UAT only per D-18)
**Analogs found:** 11 / 11

**Nature of this phase:** pure extension. Every file to be modified IS its own analog — the work is additive at five existing seams (resolver intent union, operation-kind allowlists, history ordinary-kind guard, Studio selection Signals, strip gestures/visuals). The excerpts below are the exact code each new addition must copy.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | service (pure resolver) | transform | itself (existing intent/builders/finalizer) | exact |
| `app/src/types/physicPaint.ts` | types + validators | request-response (wire validation) | itself (`isPhysicPaintRotoPhysicalEditOperationKind`) | exact |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | hook (action bundle) | request-response (acknowledged txn) | itself (prepare/commit drag, deleteRotoFrame, applyForceSpacing) | exact |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | hook (history store) | CRUD (accepted-only snapshots) | itself (`isOrdinaryOperationKind`) | exact |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | controller component | event-driven (Signals) | itself (`selectedKeyId` signal ownership) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | view component | event-driven (pointer/click gestures) | itself (guarded icons, drag session, cell classes) | exact |
| `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` | presentation utility | transform (pure view-model projection) | itself (tooltip vocab, drag preview view model) | exact |
| `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` | utility (key dispatcher) | event-driven | itself (Backspace/Delete guarded branch) | exact |
| `app/src/components/physic-paint/physicsPaintStudio.css` | styles | presentation | itself (`.current` z-index/outline technique) | exact |
| `app/src/lib/physicPaintBridge.ts` | service (parent bridge) | request-response (apply + ack) | itself (`replace-roto-physical-map` apply path) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` (NEW, post-UAT) | test | transform assertions | `app/src/components/physic-paint/roto/rotoTimelineSelectors.test.ts` | role-match |

## Pattern Assignments

### `physicsPaintRotoPhysicalResolver.ts` (pure resolver, transform)

**Analog:** itself. Add `move-key-group` / `delete-key-group` intents + scoped `force-spacing` input by mirroring the existing closed union and builder shape. Never fork the resolver.

**Closed intent union + parallel operation-kind union** (lines 102-137) — new variants go here; the two unions grow 1:1:
```typescript
export type PhysicPaintRotoPhysicalEditIntent =
  | { readonly kind: 'insert-slot'; readonly selectedKeyId: string }
  | { readonly kind: 'delete-key'; readonly selectedKeyId: string }
  | {
      readonly kind: 'move-key';
      readonly movedKeyId: string;
      readonly target: PhysicPaintRotoPhysicalEditTarget;
    }
  | {
      readonly kind: 'force-spacing';
      readonly emptyFrames: number;
      readonly selectedKeyId: string | null;
    }
  | { readonly kind: 'duplicate-key'; readonly sourceKeyId: string; readonly newKeyId: string }
  | { readonly kind: 'paste-key'; /* ... */ };
// Phase 37 adds: move-key-group (movedKeyIds + grabbedKeyId + target),
// delete-key-group (keyIds), and scopeKeyIds?: readonly string[] | null on force-spacing.

export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot' | 'delete-key' | 'move-key' | 'force-spacing' | 'duplicate-key' | 'paste-key';
```

**Group-delete builder mirrors `buildDeleteCandidate`** (lines 707-748) — survivor rule (successor-then-previous) and left-ripple loop generalize to a removal set:
```typescript
function buildDeleteCandidate(identities: ValidatedIdentities, selectedKeyId: string): Candidate {
  const selectedFrame = identities.framesByKeyId.get(selectedKeyId) as number;
  const mapping = new Map<string, number>();
  const expectedKeyIds = new Set<string>();
  let successorKeyId: string | null = null;
  let previousKeyId: string | null = null;

  for (const identity of identities.ordered) {
    if (identity.keyId === selectedKeyId) continue;
    expectedKeyIds.add(identity.keyId);
    if (identity.appFrame > selectedFrame) {
      mapping.set(identity.keyId, identity.appFrame - 1);
      roleByKeyId.set(identity.keyId, 'ripple-left');
      if (successorKeyId === null && identity.appFrame > selectedFrame) {
        successorKeyId = identity.keyId;
      }
    } else {
      mapping.set(identity.keyId, identity.appFrame);
    }
    if (identity.appFrame < selectedFrame) previousKeyId = identity.keyId;
  }

  const nextSelected = successorKeyId ?? previousKeyId;
  return { mapping, expectedKeyIds, removedKeyId: selectedKeyId, selectedKeyId: nextSelected,
    operationKind: 'delete-key', changed: true, roleByKeyId, drag: null };
}
```
Group variant: survivor shifts left by the COUNT of removed selected keys below it; `nextSelected` falls back to `null` for delete-to-empty (GDel-2). `removedKeyId` (singular, proposal line 239) must generalize to a removed set.

**Group-move builder mirrors `buildMoveCandidate`** (lines 859-933) — two paths split by target kind (D-29 split that D-09 extends):
- Whole-cell (`physical-cell`): range/capacity check (867-873), occupied-by-other-real-key reject (882-889), then `cutAndInsert` — group variant cuts ALL selected, ripples unselected survivors left by count of selected sources below them, shifts each selected key by `delta = target.appFrame - grabbed.originalFrame`, atomic-rejects on any collision (GD-1/GD-2).
- `before-key`/`after-key` (894-927): `removeMovedIdentityWithoutClosingSource` leaves gaps open, resolve `targetFrame` post-removal, `insertionFrame = targetFrame | targetFrame + 1`, capacity check, `openAndInsert` — group variant inserts selected keys in ascending destination order, one slot-opening per insertion rippling ONLY unselected keys (GD-3).

**Scoped force-spacing mirrors `buildForceSpacingCandidate`** (lines 1094-1152) — validation order (spacing integer → empty-key-set → unknown identity), first-key anchor formula:
```typescript
const firstAppFrame = identities.ordered[0].appFrame;
const step = emptyFrames + 1;
for (let i = 0; i < identities.ordered.length; i += 1) {
  const identity = identities.ordered[i];
  const next = firstAppFrame + i * step;
  mapping.set(identity.keyId, next);
  if (next !== identity.appFrame) roleByKeyId.set(identity.keyId, 'reanchored');
}
```
Scoped variant: iterate the ORDERED SELECTED subset only; anchor = earliest selected key's CURRENT frame; unselected keys keep frames and act as hard walls (reject on destination == unselected frame, GFS-2). `scopeKeyIds == null` keeps this exact code path (GFS-3). Wire kind stays `force-spacing`.

**Drag presentation metadata** (lines 194-199) — `movedKeyId` is singular today; add `movedKeyIds: readonly string[]` + `grabbedKeyId`, keep `movedKeyId` = grabbed:
```typescript
export interface PhysicPaintRotoPhysicalDragPresentation {
  readonly targetKind: 'physical-cell' | 'before-key' | 'after-key';
  readonly targetKeyId: string | null;
  readonly resolvedInsertionAppFrame: number;
  readonly movedKeyId: string;
}
```

**Failure type** (lines 278-282) — extend with OPTIONAL structured conflict fields (Pitfall 1: blocked-target preview needs cell-level data; keep optional so existing constructors at `fail()` line 564-571 are untouched):
```typescript
export interface PhysicPaintRotoPhysicalEditFailure {
  readonly code: PhysicPaintRotoPhysicalEditFailureCode;
  readonly operationKind: PhysicPaintRotoPhysicalEditOperationKind | null;
  readonly text: string;
  // Phase 37 (optional): conflictingAppFrames?: readonly number[];
}
```

**All group candidates feed the existing `finalizeProposal`** (line 1245) unchanged — coverage/uniqueness/capacity/ordering proofs are reused, not duplicated.

---

### `app/src/types/physicPaint.ts` (wire validators)

**Analog:** itself. Extend the closed allowlist — never loosen it (Security: forged-kind tampering).

**Operation-kind allowlist** (lines 194-206) — add the two group kinds here:
```typescript
function isPhysicPaintRotoPhysicalEditOperationKind(value: unknown): value is PhysicPaintRotoPhysicalEditOperationKind {
  return value === 'insert-slot'
    || value === 'delete-key'
    || value === 'move-key'
    || value === 'force-spacing'
    || value === 'duplicate-key'
    || value === 'paste-key'
    || value === 'play-script'
    || value === 'set-interpolation-enabled'
    || value === 'set-interpolation-mode'
    || value === 'undo'
    || value === 'redo';
}
```
Note this wire union is WIDER than the resolver union (includes play-script/undo/redo); `PhysicPaintRotoPhysicalEditOperationKind` type declaration must gain `'move-key-group' | 'delete-key-group'` in lockstep. Used by payload validators at lines 300/337. Verify empty `records` array passes record validation (GDel-2 anchor, research A3).

---

### `useRotoTimelineActions.ts` (action bundle hook)

**Analog:** itself. Group prepare/commit/delete/spacing copy the exact existing shapes.

**Single-action seam `runPhysicalAction`** — all group ops route through it exactly like `deleteRotoFrame` (lines 297-305):
```typescript
const deleteRotoFrame = useCallback((): Promise<boolean> => {
  const selectedKeyId = ensureSelectedKeyId(input);
  return runPhysicalAction({
    intent: { kind: 'delete-key', selectedKeyId },
    operationKind: 'delete-key',
    requiredKeyId: selectedKeyId,
    successMessage: DELETE_SUCCESS_MESSAGE,
  });
}, [runPhysicalAction, input]);
```
Group delete variant passes the selection set (from the controller, not recomputed here) with `intent: { kind: 'delete-key-group', keyIds }`.

**Drag prepare seam** (lines 374-424) — group variant keeps every guard in this exact order (launch → ports present → pending in-flight → bounded keyId → identity uniqueness → resolve → no-change reject → target signature → frozen publication):
```typescript
const preparation = resolvePhysicPaintRotoPhysicalEdit({
  identities,
  intent: { kind: 'move-key', movedKeyId, target },
  capacity,
  interpolationEnabled: interpolation.enabled,
});
if (!resolution.ok) return { ok: false, reason: resolution.failure.text || '...' };
if (!proposal.status.changed) return { ok: false, reason: 'This move would not change the timeline.' };
// ...
return { ok: true, publication: Object.freeze({
  proposal, proposalVersion,
  expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
  movedKeyId, targetSignature,
}) as RotoDragPublication };
```
Group variant: `prepareRotoKeyGroupDrag(grabbedKeyId, selectedKeyIds, target)`; preparation result must ALSO pass through `conflictingAppFrames` for the blocked preview.

**Drag commit seam** (lines 426-441) — publication passed to the coordinator UNCHANGED (no mapping recomputation at commit); kind check widens for the group kind:
```typescript
if (publication.proposal.status.operationKind !== 'move-key') return false;
const drag = publication.proposal.drag;
if (!drag || drag.movedKeyId !== publication.movedKeyId) return false;
return input.executePhysicalEdit({
  proposal: publication.proposal,
  expectedLaunch: publication.expectedLaunch,
  operationKind: 'move-key',
  selectedKeyId: publication.proposal.selectedKeyId,
  selectedAppFrame: publication.proposal.selectedAppFrame,
});
```

**Force-spacing apply** (lines 447-501) — scoped variant: when selection size >= 2 pass `scopeKeyIds` in the same intent; guard order (parse → launch → ports → pending) and action-time snapshot comment (467-469) stay verbatim; `operationKind: 'force-spacing'` unchanged.

---

### `useRotoPhysicalEditHistory.ts` (history store)

**Analog:** itself — one-line-union extension only.

**Ordinary-kind guard** (lines 124-133) — add both group kinds so they record one accepted-only snapshot command:
```typescript
function isOrdinaryOperationKind(
  kind: PhysicPaintRotoPhysicalEditOperationKind,
): kind is RotoPhysicalEditOrdinaryOperationKind {
  return kind === 'insert-slot'
    || kind === 'delete-key'
    || kind === 'move-key'
    || kind === 'force-spacing'
    || kind === 'duplicate-key'
    || kind === 'paste-key';
    // Phase 37: || kind === 'move-key-group' || kind === 'delete-key-group'
}
```
(Scoped force-spacing needs nothing — it keeps kind `force-spacing`.) Snapshot equality semantics (`snapshotRecordsEqual`, 135-156) must hold for the empty-map after snapshot (GDel-2). Do NOT hand-write history entries (D-13: exactly one Undo/Redo action per group op flows through the existing accepted-only effect at line 290).

---

### `PhysicsPaintStudio.tsx` (controller, Signals)

**Analog:** itself — new selection Signals sit beside the existing one; never in the view, never across the bridge.

**Selection signal ownership + launch-reset** (lines 59-74):
```typescript
const selectedKeyId = useSignal<string | null>(launchContext?.rotoPhysical?.selectedKeyId ?? null);
// ...
if (next?.operationId !== current?.operationId || next?.layerId !== current?.layerId) {
  selectedKeyId.value = next?.rotoPhysical?.selectedKeyId ?? null;
}
```
Phase 37 adds `selectedKeyIds = useSignal<readonly string[]>([])` and `selectionAnchorKeyId = useSignal<string | null>(null)` here; launch replacement resets them exactly like `selectedKeyId` (lines 66-71). Invariant: non-empty `selectedKeyIds` always contains `selectedKeyId` (D-02). Only the single `selectedKeyId` persists via `physicPaintStore.setRotoPhysicalSelection` (line 70) — the multi-selection set NEVER persists and never crosses the bridge.

**Post-acceptance selection rule (D-17):** hook into the same place undo/redo aftermath reads `accepted.after.selectedKeyId` (lines 803-808 pattern): group move → set unchanged, current = grabbed; scoped force-spacing → set unchanged; group delete → collapse to proposal survivor; every other accepted op → collapse to single `selectedKeyId`.

**Keyboard wiring** (line 830): `deleteRotoKey: rotoPhysicalActions.deleteRotoFrame` in the dispatcher actions object — group-aware delete replaces this action's body; Escape-collapse and Cmd/Ctrl+A actions are added to the same `PhysicsPaintStudioKeyboardActions` object.

---

### `PhysicsPaintWorkflowStrip.tsx` (view, gestures)

**Analog:** itself. All new gesture/visual code copies these exact blocks.

**Guarded icon action (Select All copies Delete verbatim)** (lines 1152-1179) — placement: immediately AFTER this Delete block at the END of the key-utilities pill (before the Key spacing form at 1182), per Pitfall 7:
```tsx
<span class="physics-paint-roto-key-icon-action" onPointerEnter={deleteKeyTooltip.onPointerEnter} onPointerLeave={deleteKeyTooltip.onPointerLeave}>
  <button
    type="button"
    class="physics-paint-roto-key-icon-button destructive"
    aria-label="Delete key"
    aria-disabled={!canDeleteRotoKey ? 'true' : undefined}
    aria-describedby={!canDeleteRotoKey && deleteRotoKeyDisabledReason ? 'roto-key-action-reason-delete' : undefined}
    onFocus={deleteKeyTooltip.onFocus}
    onBlur={deleteKeyTooltip.onBlur}
    onClick={() => {
      deleteKeyTooltip.hide();
      if (!canDeleteRotoKey) return;
      props.onDeleteRotoFrame?.();
    }}
    onKeyDown={(event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !canDeleteRotoKey) event.preventDefault();
    }}
  >
    <Trash2 size={18} aria-hidden="true" />
    <span class="physics-paint-roto-key-icon-label">Delete</span>
  </button>
  {!canDeleteRotoKey && deleteRotoKeyDisabledReason ? (
    <span id="roto-key-action-reason-delete" class="physics-paint-sr-only">{deleteRotoKeyDisabledReason}</span>
  ) : null}
  <PhysicsPaintStyledTooltip visible={deleteKeyTooltip.visible}>
    {buildGuardedActionTooltipCopy('Delete key', deleteRotoKeyDisabledReason)}
  </PhysicsPaintStyledTooltip>
</span>
```
Never native `disabled` (36.15 D-28). Select All icon: `ListChecks` or `SquareCheckBig` from lucide-preact (both present in 0.577.0).

**Click suppression + navigate** (lines 440-450) — modifier branches go BEFORE the navigate fallback; pass the mouse event into this handler (Pitfall 6):
```typescript
function handleRotoCellClick(frame: number, vm: RotoCellViewModel) {
  if (suppressNextRotoClickRef.current) {
    suppressNextRotoClickRef.current = false;
    return;
  }
  if (vm.baseMeaning === 'generated' || vm.isEditableTarget === false) {
    props.onNavigateToSyncedFrame(frame);
    return;
  }
  props.onNavigateToSyncedFrame(frame);
}
```

**Drag session Escape authority** (lines 776-791) — do NOT register a second window-level Escape listener for selection-collapse (Pitfall 4); this capture-phase listener with `stopImmediatePropagation` already wins during gestures:
```typescript
const handleEscape = (keyEvent: KeyboardEvent) => {
  if (keyEvent.key !== 'Escape' || rotoDragGestureRef.current !== session || !session.started) return;
  keyEvent.preventDefault();
  keyEvent.stopImmediatePropagation();
  cleanup();
  clearSuppressionSoon();
  restoreSourceFocus();
};
// ...
window.addEventListener('keydown', handleEscape, true);
```
Escape-collapse lives in the keyboard dispatcher instead (see below). The whole `RotoDragGestureSession` (threshold, pointer capture, edge-scroll, validity-key at 794-797) is reused VERBATIM for group drag — only the preparation call and collapse-on-grab-of-unselected-key change.

**Cell class assembly** (line 989) — add `selected` (from a prop keyId set, not derived in view) and `roto-drag-target-blocked` (driven by `conflictingAppFrames` from the preparation result) to this exact template-string pattern:
```typescript
const cellClass = `physics-paint-roto-cell ${fillClass} ... ${vm.overlays.includes('current') ? 'current' : ''} ${dragEligible ? 'roto-drag-eligible' : ''} ${isDragMoved ? 'roto-drag-moved' : ''} ...`;
```

**`cssEscape` for every new keyId selector** (lines 225, 641, 747) — grabbed-key/survivor focus-follow queries must reuse it:
```typescript
const selector = `[data-roto-key-id="${cssEscape(session.movedKeyId)}"]`;
```

---

### `physicsPaintWorkflowPresentation.ts` (presentation utility)

**Analog:** itself.

**Tooltip vocabulary** (lines 229-241) — extend the closed kind union + copy record with `'selected'` (composes with semantic base per 37-UI-SPEC):
```typescript
export type RotoCellSemanticTooltipKind = 'real-key' | 'generated' | 'cached' | 'background-only' | 'empty';
export const ROTO_CELL_STATE_TOOLTIP_COPY: Record<RotoCellSemanticTooltipKind, string> = {
  'real-key': 'Real key',
  generated: 'Generated — render-only',
  cached: 'Cached',
  'background-only': 'Background only',
  empty: 'Empty',
};
```

**Drag preview view model** (lines 405-483) — generalize the single-moved-key role assignment (438-447) so role `'moved'` applies to the full moved set, `'shifted'` to unselected rippled keys, target/vacated/generated unchanged. It is a PURE re-projection of `proposal.cells` + `proposal.changes` — the view never re-derives legality (Pitfall 2). Group variant must also expose blocked cells from `conflictingAppFrames`:
```typescript
if (cell.keyId === movedKeyId) {
  role = 'moved';
} else if (targetKeyId !== null && cell.keyId === targetKeyId) {
  role = 'target';
} else if (changesByKeyId.has(cell.keyId)) {
  role = 'shifted';
}
```

---

### `physicsPaintStudioKeyboard.ts` (dispatcher)

**Analog:** itself — add branches in `dispatchPhysicsPaintStudioKeyDown`, reusing the existing guards.

**Guarded action branch pattern** (lines 90-102) — Backspace/Delete is the model: target guard first, `preventDefault`, then action. The new `Escape` collapse branch and `meta && key === 'a'` Select-All branch follow this shape:
```typescript
if (
  (event.key === 'Backspace' || event.key === 'Delete')
  && !event.repeat
  && !event.metaKey
  && !event.ctrlKey
  && !event.altKey
  && !event.shiftKey
) {
  if (!actions.deleteRotoKey || !isPhysicsPaintRotoDeleteTarget(event.target)) return;
  event.preventDefault();
  actions.deleteRotoKey();
  return;
}
```
- Cmd/Ctrl+A (Pitfall 5): require focus inside the strip (e.g. `target.closest('.physics-paint-workflow-strip')`), `event.preventDefault()`, respect `state.mutationLocked`, route to the same Select All action as the icon. `isPhysicsPaintShortcutTarget` (20-26) already excludes inputs/textareas/contenteditable — LOG keeps native select-all.
- Escape: new `collapseRotoSelection?: () => void` action in `PhysicsPaintStudioKeyboardActions` (lines 9-18); only fires when no drag gesture is active (strip's capture listener wins otherwise).
- Backspace/Delete body becomes group-aware at the controller action level; dispatcher branch itself is unchanged.

---

### `physicsPaintStudio.css` (styles)

**Analog:** itself — `.selected` mirrors the `.current` z-index/outline technique (lines 2216-2226); blocked-target uses the destructive family distinct from valid D-23 treatments:
```css
.physics-paint-roto-cell.current {
  /* Lift the selected cell above its abutting right neighbor so the orange
     selection outline renders on all four sides instead of being painted
     over at the right edge (36.15-09, UAT Gap E-3). The 18px pitch and band
     geometry are unchanged. */
  z-index: 1;
  border-color: #f5a623;
  outline: 2px solid rgba(245, 166, 35, 0.9);
  outline-offset: 1px;
  box-shadow: 0 0 0 1px rgba(245, 166, 35, 0.65), 0 0 10px rgba(245, 166, 35, 0.38);
}
```
Phase 37 additions (planner discretion on exact values within 37-UI-SPEC):
```css
.physics-paint-roto-cell.selected {
  z-index: 1; /* same abutting-neighbor fix; geometry unchanged */
  outline: 2px solid #F2F5F7; /* cool neutral, subordinate to .current orange */
  outline-offset: 1px;
}
.physics-paint-roto-cell.roto-drag-target-blocked {
  opacity: 0.42;
  filter: saturate(0.35);
  outline: 1px dotted rgba(255, 176, 184, 0.85);
  outline-offset: 1px;
}
```
`.current` must keep the STRONGEST treatment (D-04); `.selected` renders alongside it. Cannot-drop cursor goes on the grabbed key during blocked previews (`.roto-drag-source` cursor pattern at 2233-2234).

---

### `app/src/lib/physicPaintBridge.ts` (parent bridge)

**Analog:** itself — generic ordinary path; no structural change expected.

**Apply seam** (lines 118, 203-204):
```typescript
if (payload.kind === 'replace-roto-physical-map' && !isPhysicPaintRotoPhysicalEditApplyPayload(payload)) { /* reject */ }
// ...
} else if (payload.kind === 'replace-roto-physical-map') {
  result = applyPhysicPaintRotoPhysicalMap(payload);
}
```
The parent is kind-agnostic for ordinary kinds — once `isPhysicPaintRotoPhysicalEditOperationKind` admits the group kinds, the existing revalidate-then-one-store-replacement path (apply at ~line 500) handles them. Static check + UAT must confirm the parent accepts an EMPTY `records` array (GDel-2, research A3).

---

### `physicsPaintRotoPhysicalResolver.test.ts` (NEW test — post-UAT only, D-18)

**Analog:** `app/src/components/physic-paint/roto/rotoTimelineSelectors.test.ts` (role-match: same directory, pure-function test style).

**Test scaffold pattern** (lines 1-28 of analog):
```typescript
import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { saveRotoRealKeyTransaction } from './physicsPaintRotoKeyController';
import { selectProjectedRealCachedRotoFrames, selectRealCachedRotoFrames, selectRotoTimelineView } from './rotoTimelineSelectors';

function frame(appFrame: number, sourceFrame: number, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return { frameIndex: appFrame, appFrame, sourceFrame, displayFrame: appFrame, source,
    dataUrl: `data:image/png;base64,${source}-${appFrame}` };
}

describe('rotoTimelineSelectors', () => {
  it('normalizes cached real keys ...', () => {
    expect(selectRealCachedRotoFrames([/* ... */])).toEqual([/* ... */]);
  });
```
Resolver test: tiny identity factory (`{ keyId, appFrame }`), call `resolvePhysicPaintRotoPhysicalEdit`, assert `proposal.assignments` / failure `code`. One `it` per locked mapping: GD-1, GD-2, GD-3, GDel-1, GDel-2, GFS-1, GFS-2, GFS-3 (baseline A@1, B@3, C@5, D@10). Run with `pnpm --dir app vitest run <file>` — NEVER watch mode. Do NOT absorb 36.14's deferred broader resolver coverage.

## Shared Patterns

### Closed discriminated unions with 1:1 intent-kind/operation-kind growth
**Source:** `physicsPaintRotoPhysicalResolver.ts:102-137`, `types/physicPaint.ts:194-206`, `useRotoPhysicalEditHistory.ts:124-133`
**Apply to:** resolver, types, history, bridge — FOUR allowlists must gain `move-key-group`/`delete-key-group` in lockstep (scoped force-spacing needs no new kind). A kind missing from any one of them fails closed at that seam.

### Acknowledged transaction seam (one per group op)
**Source:** `useRotoTimelineActions.ts:297-305, 374-441` + `useRotoPhysicalEditCoordinator.ts` (`executePhysicalEdit`)
**Apply to:** group drag, group delete, scoped force-spacing
Every group op = one `resolvePhysicPaintRotoPhysicalEdit` → one frozen proposal → one `executePhysicalEdit` → exact parent ack → one accepted-only history snapshot. No parallel transaction path (D-19). Commit never recomputes the mapping.

### Guarded (focusable, aria-disabled) actions
**Source:** `PhysicsPaintWorkflowStrip.tsx:1152-1179` + `buildGuardedActionTooltipCopy`
**Apply to:** Select All icon; disabled state of group-aware Delete/Force Spacing
`aria-disabled="true"` + focusable + sr-only verbatim reason + styled tooltip. Never native `disabled`.

### Fail-closed validation order
**Source:** `buildForceSpacingCandidate` (1099-1123), `buildMoveCandidate` (867-927), `prepareRotoKeyDrag` (374-396)
**Apply to:** all new builders and action-level guards
Validate cheap shape errors → existence → identity conflicts → capacity, in that order, returning typed failures with concise status-capsule text (e.g. `Move rejected — key in the way`); full detail to LOG (D-26).

### Preact/Signals contract
**Source:** `PhysicsPaintStudio.tsx:59-74`; CLAUDE.md
**Apply to:** all new state
Selection Signals at the controller boundary; view receives props and emits intents; no `useEffect` copying resolver/store state into view state; no selection state derived from frames (keyId-only, D-05).

### Test execution
**Source:** `app/vitest.config.ts` (include `src/**/*.test.ts`); CLAUDE.md
**Apply to:** post-UAT regression files only
`pnpm --dir app vitest run` (never watch). D-18 forbids creating/modifying/running ANY test before explicit native UAT approval — pre-UAT plans gate on bounded static checks only.

## No Analog Found

None. Every file extends an existing, fully-read seam. The only genuinely new file (resolver test) has a strong role-match analog in the same directory.

## Metadata

**Analog search scope:** `app/src/components/physic-paint/{roto,hooks,view}/`, `app/src/components/physic-paint/`, `app/src/types/`, `app/src/lib/`
**Files scanned:** 11 production modules + 1 test analog (all line-verified)
**Pattern extraction date:** 2026-07-26
**Known stale references to avoid (research Pitfalls 7/8):** `useRotoKeyMoveHistory.ts` → use `useRotoPhysicalEditHistory.ts`; `useRotoApplyLifecycle.ts` → use `useRotoPhysicalEditCoordinator.ts`; Copy Script is NOT in the bottom action row (36.15 Plan 08 moved it to the right-panel Scripts toolbar) — Select All anchors after Delete at the end of the key-utilities pill.
