# Phase 38: Multi-Copy/Paste and Tooltip Polish - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 14 modified + 4 test files (post-UAT only, per D-15)
**Analogs found:** 14 / 14 (every file extends an existing seam; no greenfield files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/types/physicPaint.ts` | config (shared types/guards) | request-response (bridge envelope validation) | itself — existing `duplicate-key`/`paste-key` literal + validator sites | exact (in-place extension) |
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | service (pure resolver) | transform (identities + intent → immutable proposal) | itself — `buildPasteCandidate` + `createPhysicPaintRotoPasteKeyIntent` | exact (clone `paste-key` branch) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` | hook (transaction coordinator) | event-driven (execute → stage → acknowledge → settle) | itself — `semanticDeltaEquals` + semantic staging path | exact (in-place extension) |
| `app/src/lib/physicPaintBridge.ts` | service (parent bridge) | request-response (validate → mutate → acknowledge) | itself — `:652-663` semantic-validation branch | exact (in-place extension) |
| `app/src/components/physic-paint/hooks/useRotoKeyUtilities.ts` | hook (controller boundary) | request-response (copy/paste routes) | itself — `copyKey`/`pasteKey` + `copiedKeyRef` | exact (in-place extension) |
| `app/src/components/physic-paint/roto/physicsPaintRotoSession.ts` | model (session signals) | CRUD (clipboard slot, action availability) | itself — `RotoSessionCopiedKey` + `copiedKey` signal | exact (widen slot to discriminated union) |
| `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.ts` | utility (pure reducer) | transform (post-acceptance selection aftermath) | itself — `resolvePostAcceptanceRotoSelection` branches | exact (add one branch) |
| `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` | hook (physical action routes) | request-response (intent → runPhysicalAction) | itself — `pasteKey` route + `prepareRotoKeyGroupDrag` reject-copy mapping | exact (clone both patterns) |
| `app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx` | component (presentational + controller) | event-driven (hover/focus/Escape visibility) | itself — whole file (only styled tooltip in the app) | exact (sole analog, extended) |
| `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` | utility (pure selectors) | transform (inputs → display strings) | itself — `getRotoStatusCapsuleViewModel` | exact (delete baseline, keep `ambient` slot) |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | component (composition/view) | event-driven (props/signals → mounts, intents out) | itself — capsule wiring, action-row guarded icons, cell button | exact (in-place extension) |
| `app/src/components/physic-paint/physicsPaintStudio.css` | config (styles) | — | itself — `.physics-paint-styled-tooltip` block | exact (rework one block + add notch) |
| `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` | hook (accepted-only history) | event-driven (subscribe acceptedOutput) | itself — literal propagation via `Exclude<...>` | exact (verify only, no edit) |
| Test files (post-UAT): `physicsPaintRotoPhysicalResolver.test.ts`, `physicsPaintRotoMultiSelection.test.ts`, `physicsPaintWorkflowPresentation.test.ts`, new tooltip placement describe | test | batch (vitest run) | existing locked-mapping style (`GD-1..`, `GFS-1..`) in the same files | exact |

## Pattern Assignments

### 1. `app/src/types/physicPaint.ts` (shared types — add `paste-key-group` literal)

**Analog:** itself — the existing `paste-key` sites. Four locations must all learn the new literal (fail-closed everywhere).

**Operation-kind union** (lines 53-66):
```typescript
export type PhysicPaintRotoPhysicalEditOperationKind =
  | 'insert-slot'
  | 'delete-key'
  | 'delete-key-group'
  | 'move-key'
  | 'move-key-group'
  | 'force-spacing'
  | 'duplicate-key'
  | 'paste-key'
  | 'play-script'
  // ... + interpolation kinds + 'undo' | 'redo'
// Phase 38 adds: | 'paste-key-group'
```

**Semantic delta union** (lines 73-94) — clone the `paste-key` member shape, entries array instead of single payload:
```typescript
| {
    readonly kind: 'paste-key';
    readonly destinationAppFrame: number;
    readonly destinationKeyId: string | null;
    readonly newKeyId: string | null;
    readonly clipboardPayload: PhysicPaintRotoPhysicalEditRecord['payload'];
  }
// Phase 38: | { readonly kind: 'paste-key-group'; readonly destinationAppFrame: number;
//             readonly entries: readonly { payload; sourceAppFrame; sourceKeyId; newKeyId }[] }
```

**Fail-closed delta validator pattern** (lines 233-260) — `hasOnlyKeys` strictness, per-branch checks:
```typescript
export function isPhysicPaintRotoPhysicalEditSemanticDelta(value: unknown): value is PhysicPaintRotoPhysicalEditSemanticDelta {
  if (!isRecord(value)) return false;
  if (value.kind === 'paste-key') {
    if (!hasOnlyKeys(value, ['kind', 'destinationAppFrame', 'destinationKeyId', 'newKeyId', 'clipboardPayload'])) return false;
    if (!isNonNegativeInteger(value.destinationAppFrame)) return false;
    if (value.destinationKeyId !== null && !isBoundedPhysicalKeyId(value.destinationKeyId)) return false;
    // ...
    return isPhysicPaintRotoPhysicalEditPayload(value.clipboardPayload);
  }
  return false; // unknown kinds fail closed — new branch must be added before this line
}
```

**Semantic-op routing set** (lines 262-272) — add `'paste-key-group'` alongside:
```typescript
if (operationKind === 'duplicate-key' || operationKind === 'paste-key' || operationKind === 'play-script') {
  if (semanticDelta === undefined) return allowMissingOnFailure;
  return isPhysicPaintRotoPhysicalEditSemanticDelta(semanticDelta) && semanticDelta.kind === operationKind;
}
return semanticDelta === undefined; // mapping-only kinds must NOT carry a delta
```

Also: `isPhysicPaintRotoPhysicalEditOperationKind` (lines 199-213) literal chain.

---

### 2. `physicsPaintRotoPhysicalResolver.ts` (pure resolver — new intent + factory + candidate + dispatch branch)

**Analog:** itself. Four in-file patterns to clone.

**Intent union member** (lines 111-144) — frozen literal-object members:
```typescript
| {
    readonly kind: 'paste-key';
    readonly destinationAppFrame: number;
    readonly destinationKeyId: string | null;
    readonly newKeyId: string | null;
    readonly clipboardPayload: PhysicPaintRotoRealKeyPayload;
  };
// Phase 38 adds a 'paste-key-group' member carrying frozen entries
```

**Intent factory** (lines 437-453) — validates inputs, throws on malformed, allocates fresh keyIds ONCE, freezes everything:
```typescript
export function createPhysicPaintRotoPasteKeyIntent(
  destinationAppFrame: number,
  clipboardPayload: PhysicPaintRotoRealKeyPayload,
  destinationKeyId: string | null,
): Extract<PhysicPaintRotoPhysicalEditIntent, { kind: 'paste-key' }> {
  if (!isNonNegativeInteger(destinationAppFrame)) throw new Error('Paste requires a nonnegative destination frame.');
  if (destinationKeyId !== null && !isBoundedKeyId(destinationKeyId)) throw new Error('Paste destination identity is malformed.');
  if (!isPhysicPaintRotoRealKeyPayload(clipboardPayload)) throw new Error('Paste clipboard payload is malformed.');
  const newKeyId = destinationKeyId === null ? createPhysicPaintRotoKeyId() : null;
  return Object.freeze({
    kind: 'paste-key',
    destinationAppFrame,
    destinationKeyId,
    newKeyId,
    clipboardPayload: clonePayloadAtFrame(clipboardPayload, clipboardPayload.appFrame),
  });
}
```

**Candidate builder** (`buildPasteCandidate`, lines 917-968) — produces complete immutable `nextRecords` + frozen `semanticDelta`; uses `clonePayloadAtFrame` for payload retargeting, sorts by appFrame, sets `selectedKeyId` to the fresh key:
```typescript
function buildPasteCandidate(identities, records, intent): Candidate {
  const nextRecords = records.map((record) => { /* identity-preserving replace branch */ });
  if (intent.destinationKeyId === null) {
    nextRecords.push(Object.freeze({
      kind: 'real-key' as const,
      keyId: intent.newKeyId as string,
      appFrame: intent.destinationAppFrame,
      payload: clonePayloadAtFrame(intent.clipboardPayload, intent.destinationAppFrame),
    }) as PhysicPaintRotoRealKeyRecord);
  }
  nextRecords.sort((left, right) => left.appFrame - right.appFrame);
  // ... returns { mapping, expectedKeyIds, removedKeyId: null, selectedKeyId,
  //               operationKind: 'paste-key', changed, nextRecords: Object.freeze(nextRecords),
  //               semanticDelta: Object.freeze({ kind: 'paste-key', ... }) }
}
```

Group variant differs (per D-04/D-05/D-06): `anchor = min(entries.sourceAppFrame)`; `dest_i = destinationAppFrame + (sourceAppFrame_i - anchor)`; every `dest_i` must be in-range, under capacity, and NOT equal to any existing record's appFrame — atomic reject via existing failure codes (`duplicate-destination-frame`, `over-capacity`, `out-of-range-frame`); N fresh records pushed, no existing record changes; `selectedKeyId` = earliest pasted key's fresh keyId.

**Shared semantic validator input type** (lines 455-463) — widen the operationKind union:
```typescript
export interface PhysicPaintRotoPhysicalEditSemanticDeltaValidationInput {
  readonly operationKind: 'duplicate-key' | 'paste-key';  // + 'paste-key-group'
  readonly currentRecords: unknown;
  readonly nextRecords: unknown;
  readonly semanticDelta: unknown;
  // ...
}
```

**Dispatch** (research-verified lines 2043-2255): exhaustive `if` chain ending in `return fail('malformed-target', ... 'Unknown physical edit intent kind.')`. Add the group branch alongside `paste-key`, before the mapping-only branches.

---

### 3. `useRotoPhysicalEditCoordinator.ts` (coordinator — equality + routing + staging)

**Analog:** itself. Three extension points.

**Hand-written semantic delta equality** (lines 141-169) — Pitfall 1 site; a new kind that falls through returns `false` and every group paste silently rolls back. Clone per-kind field comparison:
```typescript
function semanticDeltaEquals(left, right): boolean {
  if (!left || !right) return !left && !right;
  if (left.kind !== right.kind) return false;
  if (left.kind === 'duplicate-key' && right.kind === 'duplicate-key') {
    return left.sourceKeyId === right.sourceKeyId && left.newKeyId === right.newKeyId;
  }
  if (left.kind !== 'paste-key' || right.kind !== 'paste-key') return false;
  return left.destinationAppFrame === right.destinationAppFrame
    && left.destinationKeyId === right.destinationKeyId
    && left.newKeyId === right.newKeyId
    && leftPayload.frameIndex === rightPayload.frameIndex
    && leftPayload.appFrame === rightPayload.appFrame
    && leftPayload.dataUrl === rightPayload.dataUrl
    && leftPayload.width === rightPayload.width
    && leftPayload.height === rightPayload.height;
}
```

**Ordinary routing** (line 746):
```typescript
const isSemanticOrdinary = input.operationKind === 'duplicate-key' || input.operationKind === 'paste-key';
// + 'paste-key-group'
```

**Staging with revalidation** (lines 892-908) — the coordinator re-runs the SAME shared validator before staging; this is the three-boundary pattern (resolver → coordinator → bridge) that must stay intact:
```typescript
if (isSemanticOrdinary && proposal?.semanticDelta) {
  const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
    operationKind: input.operationKind,
    currentRecords,
    nextRecords: stagedRecords,
    semanticDelta: proposal.semanticDelta,
    capacity,
    selectedKeyId: input.selectedKeyId,
    selectedAppFrame: input.selectedAppFrame,
  });
  if (!semanticValidation.ok) {
    portsRef.current.status.setConciseMessage(PHYSICAL_EDIT_BARRIER_MESSAGE);
    portsRef.current.status.logDiagnostic(`Roto physical edit semantic validation failed: ${semanticValidation.error}`);
    clearPendingOnce();
    return false;
  }
}
```

Also payload retargeting per record (~lines 1097-1105): the group branch retargets each entry's payload to its computed destination via `clonePayloadAtFrame`.

---

### 4. `app/src/lib/physicPaintBridge.ts` (parent bridge — third validation boundary)

**Analog:** itself, lines 652-663. Parent revalidates the SAME delta against authoritative records before mutation — never trusts child-supplied records:
```typescript
const stagedRevision = buildPhysicPaintRotoPhysicalRevision(proposedRecords, stagedInterpolation);
if (payload.operationKind === 'duplicate-key' || payload.operationKind === 'paste-key') {
  const semanticValidation = validatePhysicPaintRotoPhysicalEditSemanticDelta({
    operationKind: payload.operationKind,
    currentRecords,
    nextRecords: proposedRecords,
    semanticDelta: payload.semanticDelta,
    capacity,
    selectedKeyId: payload.selectedKeyId,
    selectedAppFrame: payload.selectedAppFrame,
  });
  if (!semanticValidation.ok) return reject(semanticValidation.error, stagedRevision);
}
// Phase 38: include 'paste-key-group' in the condition
```

---

### 5. `useRotoKeyUtilities.ts` (controller boundary — clipboard slot + copy/paste routes)

**Analog:** itself. Clipboard slot + mirroring + route shape.

**Single clipboard slot + session mirror** (lines 47, 73-78, 127):
```typescript
const copiedKeyRef = useRef<RotoSessionCopiedKey | null>(null);
// ...
const resetSession = useCallback((options?: { clearClipboard?: boolean }) => {
  if (options?.clearClipboard !== false) {
    copiedKeyRef.current = null;   // D-02: ONE slot, cleared by the same path
  }
  setSessionVersion((version) => version + 1);
}, []);
// inside runSessionResult success path (line 127):
copiedKeyRef.current = sourceSession.copiedKey.value;
```

**Route skeleton** (copy at lines 170-178, paste at 180-206) — guard → read availability → run → uniform error handling:
```typescript
const copyKey = useCallback(() => {
  if (blocked) return;
  const actionState = session.actionAvailability.value;
  if (!actionState.currentIsRealKey) {
    input.setApplyMessage(actionState.disabledReason ?? 'Key utilities require a real Roto key. Generated in-betweens are render-only.');
    return;
  }
  void runSessionResult(session.copyKey());   // 1-key path stays byte-identical (Pitfall 7)
}, [blocked, input, runSessionResult, session]);

const pasteKey = useCallback(() => {
  if (blocked) return;
  const actionState = session.actionAvailability.value;
  if (!actionState.canPaste) { input.setApplyMessage(actionState.pasteDisabledReason ?? 'Copy a real Roto key before pasting.'); return; }
  const copiedKey = session.copiedKey.value;
  if (!copiedKey) { input.setApplyMessage('Copy a real Roto key before pasting.'); return; }
  const clipboardPayload = toClipboardPayload(copiedKey);
  setKeyActionInFlight(true);
  void input.physicalKeyUtilities.pasteKey(input.currentFrame, clipboardPayload, input.currentKeyId)
    .catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      input.setApplyStatus('error');
      input.setApplyMessage('Could not paste the copied Roto paint.');
      input.setLastError(detail);
    })
    .finally(() => { setKeyActionInFlight(false); });
}, [blocked, input, session]);
```

Group branches activate only at `selectedKeyIds.length >= 2` (mirrors `deleteRotoFrame`'s established size branch, research-verified lines 363-371). Group copy snapshots from `physicPaintStore.getRotoRealKeyRecords(layerId)` — NOT the session's frame-indexed cache (Pitfall 6).

**Frozen payload materialization** (lines 246-255):
```typescript
function toClipboardPayload(copiedKey: RotoSessionCopiedKey): PhysicPaintRotoRealKeyPayload {
  const frame = copiedKey.cachedFrame;
  return Object.freeze({
    frameIndex: frame.frameIndex,
    appFrame: copiedKey.frame,
    dataUrl: frame.dataUrl,
    ...(frame.width !== undefined ? { width: frame.width } : {}),
    ...(frame.height !== undefined ? { height: frame.height } : {}),
  }) as PhysicPaintRotoRealKeyPayload;
}
```

---

### 6. `physicsPaintRotoSession.ts` (session model — widen slot to discriminated union)

**Analog:** itself. Current slot shape + copy implementation + availability derivation.

**Slot type + signal + availability** (lines 13-16, 59, 79, 91-100):
```typescript
export interface RotoSessionCopiedKey {
  frame: number;
  cachedFrame: PhysicPaintRotoCacheFrame;
}
// ...
copiedKey: Signal<RotoSessionCopiedKey | null>;   // widen to single|group discriminated union
// ...
const copiedKey = signal<RotoSessionCopiedKey | null>(input.copiedKey ? normalizeCopiedKey(input.copiedKey, input.canvasSize) : null);
const actionAvailability = computed(() => deriveRotoKeyUtilityActionState({
  // ...
  hasCopiedRotoKey: copiedKey.value !== null,   // stays shape-agnostic (D-02)
  // ...
}));
```

**Single-key copy implementation — must stay byte-identical** (lines 143-152):
```typescript
function copyKey(): RotoSessionActionResult {
  const appFrame = currentFrame.peek();
  const sourcePayload = realKeyFrames.peek().find((frame) => frame.appFrame === appFrame);
  if (!sourcePayload) return failed('copyKey', actionAvailability.peek().disabledReason ?? 'Select a real Roto key to copy.');
  const normalized = normalizeRealKeyFrame(sourcePayload, appFrame, input.canvasSize);
  copiedKey.value = { frame: appFrame, cachedFrame: normalized };
  const message = `Copied key ${appFrame}.`;
  feedback.value = message;
  return { action: 'copyKey', ok: true, message, effects: [] };
}
```

**Failed-action feedback pattern** (lines 177-180): `feedback.value = message; return { action, ok: false, message, effects: [] };`

---

### 7. `physicsPaintRotoMultiSelection.ts` (pure reducer — post-acceptance aftermath branch)

**Analog:** itself, `resolvePostAcceptanceRotoSelection` (lines 141-155). Pitfall 2 site — without a new branch the pasted group collapses to one key:
```typescript
export function resolvePostAcceptanceRotoSelection(input: {
  readonly operationKind: string;   // plain string by design — no type error without the branch
  readonly acceptedSelectedKeyId: string | null;
  readonly state: RotoKeySelectionState;
  readonly currentKeyId: string | null;
}): RotoKeySelectionState {
  const { operationKind, acceptedSelectedKeyId, state } = input;
  if (operationKind === 'move-key-group') {
    return { selectedKeyIds: state.selectedKeyIds, anchorKeyId: acceptedSelectedKeyId };
  }
  if (operationKind === 'force-spacing') {
    return state;
  }
  return collapseRotoKeySelection(acceptedSelectedKeyId);   // default: collapse — group paste needs its own branch
}
// Phase 38: add a 'paste-key-group' branch returning the fresh pasted keyIds as the set
// (earliest pasted key current), per UI-SPEC adopted discretion.
```

---

### 8. `useRotoTimelineActions.ts` (physical action routes — group paste route + reject copy)

**Analog:** itself. Two patterns.

**Route shape** (`pasteKey`, lines 394-422) — validate inputs → build intent via factory → `runPhysicalAction` with operationKind + success message; factory throw → concise status + `false`:
```typescript
const pasteKey = useCallback((
  destinationAppFrame: number,
  clipboardPayload: PhysicPaintRotoRealKeyPayload,
  destinationKeyId: string | null,
): Promise<boolean> => {
  if (!Number.isInteger(destinationAppFrame) || destinationAppFrame < 0) {
    input.publishStatus?.('Select a valid Roto frame before pasting.');
    return Promise.resolve(false);
  }
  try {
    return runPhysicalAction({
      intent: createPhysicPaintRotoPasteKeyIntent(destinationAppFrame, clipboardPayload, destinationKeyId),
      operationKind: 'paste-key',
      requiredKeyId: destinationKeyId,
      successMessage: PASTE_SUCCESS_MESSAGE,
    });
  } catch {
    input.publishStatus?.('The copied Roto paint is unavailable.');
    return Promise.resolve(false);
  }
}, [input, runPhysicalAction]);
```

**Failure-code → concise UI copy mapping** (`prepareRotoKeyGroupDrag`, lines 572-583) — the established code→capsule-copy vocabulary the group paste reject reasons (UI-SPEC locked strings) must reuse:
```typescript
const failureCode = resolution.failure.code;
const reason = failureCode === 'duplicate-destination-frame'
  ? 'Move rejected — key in the way'
  : failureCode === 'over-capacity' || failureCode === 'out-of-range-frame'
    ? 'Move rejected — not enough room'
    : resolution.failure.text || 'The Roto key group move is invalid.';
return {
  ok: false,
  reason,
  conflictingAppFrames: resolution.failure.conflictingAppFrames,
  detail: resolution.failure.text,   // full detail to LOG only (36.14 D-26)
};
// Phase 38 maps the same codes to: 'Paste rejected — key in the way' / 'Paste rejected — not enough room'
```

Keep the `paste-key` route byte-identical — `addEmptyKey` (lines 424-446) and script-target promotion reuse it (Pitfall 7). Single paste is replace-style; group paste is all-empty-or-reject — policies must not leak across.

---

### 9. `PhysicsPaintStyledTooltip.tsx` (component — viewport placement, notch, multiline)

**Analog:** itself (sole styled tooltip; ~17 mounts across `PhysicsPaintWorkflowStrip` and `PhysicsPaintScriptsPanel`).

**Visibility controller — DO NOT CHANGE** (`useStyledTooltip`, lines 28-90). D-14 preserves its exact contract: 1000ms hover timer, instant focus show, Escape listener registered only while visible (Pitfall 8 — keeps Phase 37 Escape-collapse ordering), idempotent cleanup with `mountedRef`:
```typescript
export function useStyledTooltip(delayMs: number = STYLED_TOOLTIP_DELAY_MS): StyledTooltipController {
  const [visible, setVisible] = useState(false);
  // ...
  function show() {
    if (!mountedRef.current) return;
    setVisible(true);
    if (typeof window === 'undefined' || escapeHandlerRef.current !== null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    escapeHandlerRef.current = handleKeyDown;
    window.addEventListener('keydown', handleKeyDown);   // registered ONLY while visible
  }
  function onPointerEnter() { clearTimer(); timerRef.current = setTimeout(show, delayMs); }
  function onFocus() { clearTimer(); show(); }
  // onPointerLeave / onBlur → hide() (clears timer + removes Escape listener)
}
```

**Presentational pill — the rework surface** (lines 110-118). Content stays Preact text children only (T-36.15-01); `id`/`aria-describedby` wiring must move with the content if portal-mounted:
```typescript
export function PhysicsPaintStyledTooltip(props: PhysicsPaintStyledTooltipProps) {
  if (!props.visible) return null;
  const placementClass = props.placement === 'below' ? ' physics-paint-styled-tooltip--below' : '';
  return (
    <span id={props.id} role="tooltip" class={`physics-paint-styled-tooltip${placementClass}`}>
      {props.children}
    </span>
  );
}
```

**New shared placement utility** (no existing analog — this is the one genuinely new function; RESEARCH.md Pattern 8 is the spec): `computeTooltipPlacement(anchorRect, region, pillSize) → { direction, left, top, notchOffset }`. Key rules, all from locked decisions:
- Read anchor's `getBoundingClientRect()` at SHOW time (viewport coordinates absorb strip horizontal scroll — Pitfall 3).
- Region → opposite side: `bottom→above`, `top→below`, `right-edge→left`, `left-edge→right` (D-11); flip if the preferred side lacks room; clamp to viewport with 8px margin (UI-SPEC).
- Notch offset = anchor center − pill left, recomputed AFTER clamping (Pitfall 4 — notch tracks the control, not the pill center).
- Containing-block check before choosing `position: fixed` vs `createPortal(document.body)` from `preact/compat` (no ancestor may have `transform`/`filter`/`perspective`; portal if any doubt).

**Region hints per mount** (verified inventory): header mounts (capsule ~`:970`, interpolation ~`:1009`, close ~`:1028`) → `top`; bottom action row (`:1139-1348`) and per-cell tooltips (`RotoTimelineCellButton :315`) → `bottom`; Scripts panel right-sidebar mounts (`PhysicsPaintScriptsPanel.tsx:103,131,159`) → `right-edge`.

---

### 10. `physicsPaintWorkflowPresentation.ts` (pure selector — delete baseline, idle context via `ambient`)

**Analog:** itself, `getRotoStatusCapsuleViewModel` (lines 194-213) + `ROTO_STATUS_CAPSULE_BASELINE` (line 170).

**Priority grammar — keep; only the final fallback changes** (lines 194-219):
```typescript
export function getRotoStatusCapsuleViewModel(input: RotoStatusCapsuleInput = {}): string {
  const pendingOperation = trimCapsuleLine(input.pendingOperation);
  if (pendingOperation !== null) return pendingOperation;
  const savingIndicator = trimCapsuleLine(input.savingIndicator);
  if (savingIndicator !== null) return savingIndicator;
  let winnerText: string | null = null;
  let winnerRecency = Number.NEGATIVE_INFINITY;
  (input.feedback ?? []).forEach((candidate, index) => {
    const text = trimCapsuleLine(candidate.text);
    if (text === null) return;
    const recency = candidate.recency ?? index;
    if (winnerText === null || recency >= winnerRecency) { winnerText = text; winnerRecency = recency; }
  });
  if (winnerText !== null) return winnerText;
  const ambient = trimCapsuleLine(input.ambient);
  return ambient ?? ROTO_STATUS_CAPSULE_BASELINE;   // D-08: delete constant + fallback → `return ambient ?? '';`
}
```

Selector purity rules to preserve (documented at lines 155-168): never reads stores/signals/props directly; every returned line renders as Preact text children (T-36.15-08); the strip supplies already-resolved strings. The `ambient` input slot already exists — D-09 feeds it; no signature change needed.

---

### 11. `PhysicsPaintWorkflowStrip.tsx` (composition — capsule ambient feed, tooltip mounts, copy wiring)

**Analog:** itself. Four patterns.

**Capsule wiring** (lines 451-459) — add the `ambient` slot fed from `currentSemanticCell` (already computed at line 351):
```typescript
const currentSemanticCell = physicalCellByAppFrame.get(props.currentFrame) ?? null;   // line 351 — kind: 'real' | 'generated' | 'empty'
// ...
const capsuleText = getRotoStatusCapsuleViewModel({
  pendingOperation: rotoDragFeedback ?? (keyUtilitiesDisabledByBusyState ? getRotoKeyBusyStatus(props.currentFrame) : null),
  savingIndicator: props.statusMessage ?? null,
  feedback: [
    { text: props.rotoCachedPlaybackStatus ?? null, recency: 2 },
    { text: scriptStatus, recency: 1 },
    { text: generatedGuardStatus, recency: 0 },
  ],
  // Phase 38: ambient: <current-cell context line> — UI-SPEC locked mapping:
  //   real → `Real Roto key · Frame {n}`; generated → `Generated frame · Frame {n}`; empty → `Empty frame · Frame {n}`
});
```

**Capsule mount with styled tooltip** (lines 961-971) — `placement="below"` prop is replaced by the shared region-hint computation (D-12); `role="status"` + `aria-live="polite"` preserved:
```tsx
<div class="physics-paint-status-capsule" role="status" aria-live="polite"
  onPointerEnter={capsuleTooltip.onPointerEnter} onPointerLeave={capsuleTooltip.onPointerLeave}>
  <Info size={16} aria-hidden="true" />
  <span class="physics-paint-status-capsule-text">{capsuleText}</span>
  <PhysicsPaintStyledTooltip visible={capsuleTooltip.visible} placement="below">{capsuleText}</PhysicsPaintStyledTooltip>
</div>
```

**Per-cell tooltip child-component pattern** (`RotoTimelineCellButton`, lines 284-318) — hooks cannot run inside the 120-cell map, so each cell owns one `useStyledTooltip`; tooltip hides on activation:
```tsx
function RotoTimelineCellButton(props: RotoTimelineCellButtonProps) {
  const tooltip = useStyledTooltip();
  return (
    <span class="physics-paint-roto-cell-anchor"
      onPointerEnter={tooltip.onPointerEnter} onPointerLeave={tooltip.onPointerLeave}>
      <button /* ... */ onFocus={tooltip.onFocus} onBlur={tooltip.onBlur}
        onClick={(event) => { tooltip.hide(); props.onCellClick(event as unknown as MouseEvent); }}>
        <span>{props.frame}</span>
      </button>
      <PhysicsPaintStyledTooltip visible={tooltip.visible}>{props.tooltipCopy}</PhysicsPaintStyledTooltip>
    </span>
  );
}
```

**Guarded action-row icon pattern** (Copy button, lines 1199-1226) — `aria-disabled` (never native `disabled`, 36.15 D-28 guarded-focusable), `aria-describedby` → sr-only reason span, tooltip hides before action:
```tsx
<span class="physics-paint-roto-key-icon-action" onPointerEnter={copyKeyTooltip.onPointerEnter} onPointerLeave={copyKeyTooltip.onPointerLeave}>
  <button type="button" class="physics-paint-roto-key-icon-button" aria-label="Copy key"
    aria-disabled={!canCopyRotoKey ? 'true' : undefined}
    aria-describedby={!canCopyRotoKey && copyRotoKeyDisabledReason ? 'roto-key-action-reason-copy' : undefined}
    onFocus={copyKeyTooltip.onFocus} onBlur={copyKeyTooltip.onBlur}
    onClick={() => { copyKeyTooltip.hide(); if (!canCopyRotoKey) return; props.onCopyRotoFrame?.(); }}
    onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !canCopyRotoKey) event.preventDefault(); }}>
    <ClipboardCopy size={18} aria-hidden="true" />
    <span class="physics-paint-roto-key-icon-label">Copy</span>
  </button>
  {!canCopyRotoKey && copyRotoKeyDisabledReason ? (
    <span id="roto-key-action-reason-copy" class="physics-paint-sr-only">{copyRotoKeyDisabledReason}</span>
  ) : null}
  <PhysicsPaintStyledTooltip visible={copyKeyTooltip.visible}>
    {buildGuardedActionTooltipCopy('Copy key', copyRotoKeyDisabledReason)}
  </PhysicsPaintStyledTooltip>
</span>
```

Copy wiring extension: `onCopyRotoFrame` routes to `useRotoKeyUtilities.copyKey`, which branches on selection size (1 → `session.copyKey()`; 2+ → group freeze). The strip forwards ONE intent; availability/guard copy stays controller-owned.

---

### 12. `physicsPaintStudio.css` (styles — tooltip block rework + notch)

**Analog:** itself, lines 1717-1744. Current block to replace:
```css
.physics-paint-styled-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  max-width: 220px;
  padding: 3px 8px;
  border: 1px solid #5d6670;
  border-radius: 999px;
  background: #20262d;
  color: #eef4f8;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;          /* D-14 removes */
  overflow: hidden;
  text-overflow: ellipsis;      /* D-14 removes */
  pointer-events: none;
}
/* Gap B workaround — superseded by D-12 viewport positioning */
.physics-paint-styled-tooltip--below { bottom: auto; top: calc(100% + 6px); }
```

Locked replacements (38-UI-SPEC): `max-width: 280px; max-height: 96px; white-space: normal; overflow: hidden;` (no scroll, no ellipsis — overflow is a copy defect). Keep `#20262d` fill, `border-radius: 999px`, `10px/600/1.2` font. Notch: 10px base × 6px height triangle (CSS borders or `clip-path`) in the same `#20262d` fill, one modifier class per direction (`--above`/`--below`/`--left`/`--right`), positioned on the control-facing edge with a dynamic offset custom property so it tracks the anchor when clamped. Direction classes replace the single `--below` modifier.

---

### 13. `useRotoPhysicalEditHistory.ts` (accepted-only history — verify only, NO edit)

**Analog:** itself. Literal propagation is automatic (lines 78-81) — one accepted output = one command = one Undo/Redo (D-07 by construction):
```typescript
type RotoPhysicalEditOrdinaryOperationKind = Exclude<
  PhysicPaintRotoPhysicalEditOperationKind,   // picks up 'paste-key-group' from types owner #1
  'undo' | 'redo'
>;
```

Anti-pattern guard: do NOT loop `executePhysicalEdit` per pasted key — N calls = N history entries + N bridge round-trips. One intent, one proposal, one transaction.

---

### 14. Test files (post-UAT wave ONLY, per D-15)

**Analogs (locked-mapping style):**
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` — extend with `paste-key-group` accept (anchor + offsets + fresh keyIds + zero ripple), atomic reject (occupied / over-capacity / out-of-range), semantic-delta validation describes.
- `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts` — extend with the `paste-key-group` aftermath branch.
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts` — lines 159-225 currently assert the deleted baseline; update AFTER UAT (Pitfall 5: knowingly red between production change and UAT is expected, not a bug).
- New tooltip placement describe (pure function tests: direction per region, flip, clamp, notch offset) in a view test file.

Run: `pnpm --dir app vitest run <file>` (never watch mode).

## Shared Patterns

### Three-boundary semantic validation (split-authority defense)
**Source:** resolver `validatePhysicPaintRotoPhysicalEditSemanticDelta` (`physicsPaintRotoPhysicalResolver.ts:474+`), re-run by coordinator (`useRotoPhysicalEditCoordinator.ts:892-908`) and parent bridge (`physicPaintBridge.ts:652-663`).
**Apply to:** the `paste-key-group` seam end-to-end. The SAME complete declared delta is independently proven at every trust boundary; exact parent acknowledgement is the sole history input. Never route group paste around the coordinator (MemPalace split-authority regression family); never publish through anything but `replace-roto-physical-map`.

### Fail-closed validation vocabulary
**Source:** `app/src/types/physicPaint.ts:199-272`, resolver intent factories (`:431-453`).
**Apply to:** all new types/resolver code. `hasOnlyKeys`/`hasExactKeys` rejects unknown members; factories throw on malformed input; unknown intent kinds hit `fail('malformed-target', ...)`; existing failure codes (`duplicate-destination-frame`, `over-capacity`, `out-of-range-frame`) are reused — no new code vocabulary.

### Concise capsule + LOG detail split (36.14 D-26)
**Source:** `useRotoTimelineActions.ts:572-583` (copy mapping), coordinator `portsRef.current.status.setConciseMessage(...)` + `logDiagnostic(...)` (`:903-904`).
**Apply to:** all user-facing reject/feedback strings. Capsule gets fixed concise strings (UI-SPEC locked); resolver internals and failure detail go to LOG only.

### Immutable frozen records and payloads
**Source:** `Object.freeze` on intents/records/deltas throughout the resolver (`:434, 446-452, 925-938, 960-966`); `clonePayloadAtFrame` for payload retargeting; frozen clipboard payloads in `useRotoKeyUtilities.ts:246-255`.
**Apply to:** group clipboard entries (frozen at copy time), group intent entries (frozen with fresh keyIds allocated once in the factory), all resolver outputs.

### Guarded focusable action controls (36.15 D-28)
**Source:** `PhysicsPaintWorkflowStrip.tsx:1199-1226`.
**Apply to:** any new/extended action buttons. `aria-disabled` + sr-only reason + `aria-describedby`; keyboard guard prevents activation; tooltip shows guard reason on hover/focus; never native `disabled`/`title`.

### Preact-native state boundaries (CLAUDE.md)
**Source:** session signals (`physicsPaintRotoSession.ts:72-100`), strip render-time derivation (`PhysicsPaintWorkflowStrip.tsx:442-459` comment: "no new controller state, no effect copying props into local state").
**Apply to:** all new code. Signals/computed for shared reactive state; pure selectors for display strings; no `useEffect` reacting to internal state; tooltip visibility controller already exists — do not add a second one.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `computeTooltipPlacement` utility (new function inside `PhysicsPaintStyledTooltip.tsx` or sibling view utility) | utility | transform (rect → fixed coordinates) | No anchored-overlay positioning code exists in the codebase — tooltips were in-strip absolute. RESEARCH.md Pattern 8 + 38-UI-SPEC locked values are the spec. Deliberately hand-rolled (~40 lines: 4 directions + flip + 8px clamp); floating-ui rejected by the locked no-new-dependency boundary. |

This is the ONLY genuinely new code shape in the phase. Everything else clones an existing branch.

## Metadata

**Analog search scope:** `app/src/components/physic-paint/**` (roto, hooks, view), `app/src/types/physicPaint.ts`, `app/src/lib/physicPaintBridge.ts`
**Files scanned:** 14 production files (all read in full or at verified targeted ranges on `main`, 2026-07-27)
**Pattern extraction date:** 2026-07-27
**Note:** Phase 38 is a pure extension phase — every modification site was pre-identified and verified by 38-RESEARCH.md; analog selection was exact-match by construction (each file is its own analog). Line numbers cited against `main` at 2026-07-27; re-verify if cited files advance.
