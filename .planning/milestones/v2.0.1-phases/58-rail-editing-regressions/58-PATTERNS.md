# Phase 58: Rail editing regressions - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 11 (10 modified, 1 new test)
**Analogs found:** 11 / 11
**Source:** `58-CONTEXT.md` (D-01..D-17), `REQUIREMENTS.md` (RAIL-01..07), `ROADMAP.md` Phase 58 code anchors. No RESEARCH.md exists for this phase.

> **Scope law (do not cross):** no `.mce` field added or changed, no new module, no document/store/schema change, no other gesture guard widened. Every new file listed below is either a test or a modification of an existing rail/resolver/controller/panel file.

---

## File Classification

| New/Modified File | Action | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` | modify | service (pure resolver) | transform | its own intent-guard block `:4453-4476` + `countLoopsReferencingSourceKey` `:905-914` | exact (self) |
| `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` | modify | utility (pure record builder) | transform | `buildStandardStackedLoopClip` `:560-582` | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | modify | controller | request-response | `runLoopOp` `:2006-2041`, `openLoopEdit` `:1710-1723`, `updateLoop` `:2043-2126` | exact |
| `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts` | modify | utility (pure presentation) | transform | `buildSelectedKeyRailCopy` `:90-103` in-file; `projectPhysicsPaintLoopClipPresentation` for the facts shape | exact |
| `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` | modify | component | request-response | loop-clip inspector takeover `:133-173` | exact |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | modify | component | request-response | `dialogMode` branch `:61-72`, header `:304-334`, footer `:512-574` | exact |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` | modify | component | request-response | `PaintTimingCard` `:479-562` (the Cycle stepper + Infinity switch pair) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` | modify | component | event-driven | `PhysicsPaintLoopClipRail.tsx` double-click `:274-310` | role-match (timer lives in a stateful rail target) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | modify | orchestration component | request-response | `handleOpenRotoLoopEdit` `:4788-4794`, `selectedLoopClip` `:4831-4833`, right-panel memo `:7038-7132` | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` | modify | test | — | its own `describe('D-11 rigid linked-key guard')` `:277-328` | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoKeyRailCycle.test.ts` | create | test | — | `physicsPaintRotoLoopGuards.test.ts` harness `:68-179`, history harness `:876-948` | role-match |

Files explicitly **not** touched (verified): `view/PhysicsPaintWorkflowStrip.tsx` (drag dispatch already calls `prepareRotoKeyDrag`, `:4372-4374` — no UI change), `view/PhysicsPaintRightPanel.tsx` (`<PhysicsPaintScriptsPanel {...scripts} />` at `:542` spreads new props automatically — only the prop *type* comes from the panel), `view/PhysicsPaintLoopClipRail.tsx` (already renders Standard via `rail-kind-standard`), `physicsPaintStudio.css` (`.rail-kind-standard` already exists at `:4935-4942`).

---

## Pattern Assignments

### `roto/physicsPaintRotoPhysicalResolver.ts` (service, transform) — RAIL-06 / D-12

**Analog:** itself. This is a one-token change plus a comment rewrite. Nothing else in the file moves.

**The exact guard to relax** (`:4463-4467`):

```ts
    // D-11: a linked source key never moves alone — the cycle's internal
    // spacing IS the loop rhythm; only a rigid whole-cycle group drag moves it.
    if (countLoopsReferencingSourceKey(loopClips, intent.movedKeyId) > 0) {
      return fail('loop-source-key-move-rejected', operationKind, LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT);
    }
```

Phase 58 (Law A) becomes `> 1`. The predicate is unchanged (`:905-914`):

```ts
/** Count every loop whose source cycle references the given keyId. */
function countLoopsReferencingSourceKey(
  loopClips: readonly PhysicPaintRotoLoopClip[],
  keyId: string,
): number {
  let count = 0;
  for (const clip of loopClips) {
    if (clip.sourceKeyIds.includes(keyId)) count += 1;
  }
  return count;
}
```

**Locked copy stays verbatim** (`:862-864`) — used unchanged by the `>= 2` case:

```ts
const LOOP_SOURCE_KEY_MOVE_REJECTED_TEXT =
  'Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it.';
```

**Guards deliberately NOT widened** (D-14/D-15 — copy these line numbers into the plan as "do not touch"):

| Guard | Line | Stays |
|---|---|---|
| `delete-key` D-07 | `:4171-4174` | `> 0` |
| `delete-key-rail` | `:4206-4209` | `> 0` |
| `delete-key-group` | `:4299-4304` | `> 0` |
| `duplicate-key` ripple | `:4341-4347` | unchanged |
| `force-spacing` (linked scopes + closed guard) | `:4478-4504` | unchanged |
| `move-key-rail` Group-ownership guard | `:4540-4547` | unchanged |

**Why D-13 needs zero further work** — `buildMoveCandidate` (`:1610-1690`) never sets `nextLoopClips`, so a single-key move already returns `proposal.nextLoopClips === null`. The existing test asserts it (`physicsPaintRotoLoopGuards.test.ts:294`: `expect(proposal.nextLoopClips).toBeNull()`). `placementStart` therefore cannot follow a partial-source move; `computeSourceAttachedLoopPlacementFollow` (`:926-986`) is only wired for full-cycle / spacing paths (`:1950`, `:3274`, `:4912`). **Do not add a loop-follow path here.**

---

### `roto/physicsPaintRotoRunScriptStacking.ts` (utility, transform) — RAIL-03

**Analog:** `buildStandardStackedLoopClip` `:560-582` — the strict-whitelist provenance-free record writer. The new writer is the same literal shape with a fresh `loopId` and the Key Rail segment as the source.

**The writer to mirror, verbatim** (`:560-582`):

```ts
export function buildStandardStackedLoopClip(input: {
  readonly target: PhysicPaintRotoLoopClip;
  readonly mergedSourceKeyIds: readonly string[];
  readonly lifecycle: RunScriptStackLifecycle | null;
}): PhysicPaintRotoLoopClip {
  const { target, mergedSourceKeyIds, lifecycle } = input;
  return {
    loopId: target.loopId,
    placementStart: target.placementStart,
    repeat: target.repeat,
    sourceKeyIds: Object.freeze([...mergedSourceKeyIds]),
    mode: target.mode,
    ...(target.keyScriptEdits === true ? { keyScriptEdits: true as const } : {}),
    ...(target.paintSeedVariation === true ? { paintSeedVariation: true as const } : {}),
    ...(target.syncState === undefined ? {} : { syncState: target.syncState }),
    ...(target.provenanceState === undefined ? {} : { provenanceState: target.provenanceState }),
    ...(target.phaseOrigin === undefined ? {} : { phaseOrigin: target.phaseOrigin }),
    ...(target.originalEndExclusive === undefined ? {} : { originalEndExclusive: target.originalEndExclusive }),
    ...(target.visibleRanges === undefined ? {} : { visibleRanges: target.visibleRanges }),
    ...(target.frameOverrides === undefined ? {} : { frameOverrides: target.frameOverrides }),
    ...(lifecycle ?? {}),
  };
}
```

**Hard rules this excerpt encodes** (D-03, RAIL-03):
- Strict whitelist literal — **never spread a source record**.
- Drop `scriptId`, `motion`, `overrideColor`, `railKind`, `colorize`, `colorizeMix`, `photoWiggle` — *absent*, never `undefined`-valued (`isStandardMergedLoopClip` at `:536-540` tests `clip.scriptId === undefined`, not falsiness).
- `sourceKeyIds` from the segment in frame order; `placementStart` = `segment.firstKeyFrame`.
- `repeat` finite; for D-08 (single key) `repeat: 1`.
- `mode` must still be written (`'progressive' | 'static'` is required by the parser at `physicsPaintRotoPhysicalModel.ts:874`) — it is internal playback only and never presented.

**The discriminator you are targeting** (`:536-540`):

```ts
export function isStandardMergedLoopClip(clip: PhysicPaintRotoLoopClip | undefined): boolean {
  if (clip === undefined) return false;
  if (clip.railKind === 'reveal') return false;
  return clip.scriptId === undefined;
}
```

**Lifecycle for the fresh clip:** with `repeat: 1` and no existing lifecycle, either omit all six lifecycle members (parser synthesizes none for infinity only; `buildDefaultPhysicPaintRotoGroupLifecycle` `:905-924` derives `phaseOrigin = placementStart`, `originalEndExclusive = placementStart + sourceKeyIds.length * repeat`) or emit them explicitly via the existing default shape. **Do not invent a new lifecycle formula** — `resolvePhysicPaintRotoLoopClipLifecycle` (`:958-981`) is the single authority. Note the resolver's cycle length is *span-based* (`first→last source key + 1`, `:5539-5541`), not key-count — a gapped segment (D-09) has `cycleLength > sourceKeyIds.length`. Mirror `planRunScriptStackLifecycle` (`:434-494`) if an explicit lifecycle is needed: `originalEndExclusive = phaseOrigin + newCycleLength * repeat` with `newCycleLength` taken from the resolver.

---

### `roto/physicsPaintRotoPlayScriptController.ts` (controller, request-response) — RAIL-01/02/03/04/05

**Analog:** `runLoopOp` `:2006-2041` — the one atomic loop-op path. Use it as the template for a *creation* path; it is loop-id-bound today, so key-rail entry needs the anchor passed explicitly.

**Guards + prefill the new entry point reuses** (`:1643-1664`, `:1666-1698`):

```ts
  function loopOpGuard(): string | null {
    if (disposed) return 'The Play Script controller is disposed.';
    if (ports.getOperationLocked() || isBusyPhase(phase.peek())) return 'Finish the current Roto operation.';
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) return 'Save the project first.';
    return null;
  }
```

**The atomic publication pattern** (`:2006-2041`) — this is the exact body to clone for create:

```ts
  async function runLoopOp(
    loopId: string,
    prepare: (loop: PhysicPaintRotoLoopClip, authority: PhysicPaintRotoAuthorityResult) => readonly PhysicPaintRotoLoopClip[] | string,
    statusLine: string,
  ): Promise<RotoPlayScriptLoopOpResult> {
    const guard = loopOpGuard();
    if (guard) return { ok: false, reason: guard };
    const loop = currentLoopClips().find((clip) => clip.loopId === loopId);
    if (!loop) return rejectLoopOp(`Loop Clip "${loopId}" no longer exists.`);
    const context = ports.getLaunchContext()!;
    ports.stopPlayback();
    phase.value = 'preparing'; status.value = statusLine; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('loop-op'), loop.placementStart);
      if (!authority.ok) throw new Error(authority.error ?? 'Parent authority is unavailable.');
      const prepared = prepare(loop, authority);
      if (typeof prepared === 'string') return rejectLoopOp(prepared);
      const publication = buildLoopOnlyPublication({
        authority,
        anchor: loop.placementStart,
        loopClips: prepared,
        expectedLaunch: { operationId: context.operationId, layerId: context.layerId },
        rotoBackground: { ...ports.getBackgroundMetadata() },
      });
      phase.value = 'committing'; status.value = statusLine;
      const result = await ports.commit(publication);
      if (!result.ok) throw new Error(result.error || 'Parent rejected the Loop Clip operation.');
      assertPublicationAck(publication, result);
      phase.value = 'complete'; status.value = statusLine;
      ports.log(statusLine);
      return { ok: true, reason: null };
    } catch (cause) {
      fail(cause);
      return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
    }
  }
```

**Loop-only publication — the zero-write contract** (`:1966-2004`, key lines):

```ts
      semanticDelta: {
        kind: 'play-script',
        // Empty affected range convention: the op changes loop state only.
        affectedStartAppFrame: anchor,
        affectedEndAppFrame: anchor - 1,
        expectedLayerCapacity: authority.physicalCapacity,
        expectedLayerEndExclusive: authority.layerEndExclusive,
        proposedRecords: records.map(toPhysicalEditRecord),
        freshKeyIds: [],
        loopOnly: true,
      },
```

`loopOnly: true` + `affectedEndAppFrame = anchor - 1` is the existing "loop state only, no records touched" convention. **Reuse it — do not add a new semantic-delta kind** (no coordinator change, no `.mce` change, one commit = one undo step).

**Cancel = zero writes, by construction** (D-11, RAIL-04): nothing is written until `ports.commit`. `closeConfirmation()` (used by `updateLoop` `:2052`) must stay the cancel path; a conversion entry must not touch `loopEditTargetId`, `countText`, or any store before confirm. Mirror the no-phantom-history guard at `:2052`:

```ts
    if (draftRepeat === target.repeat) { closeConfirmation(); return true; } // no phantom history entry
```

**Dialog-mode plumbing** (`:114`, `:1667-1698`, `:1710-1723`):

```ts
export type RotoPlayScriptDialogMode = 'apply' | 'loop-edit' | 'source-edit';
```

Add the reduced Standard mode here (e.g. `'standard-edit' | 'key-rail-create'`) rather than building a second dialog (CONTEXT "Established Patterns"). `prefillEditMode` is the shared prefill: it writes `loopPreflightSnapshot`, `canonicalStart`, `loopEditTargetId`, `countText`, `repeatText`/`infinity`. For the reduced form only the last three matter, plus the D-11 prefill law:

```ts
    if (loop.repeat === 'infinity') {
      infinity.value = true; // repeatText keeps the preserved finite draft (Pitfall 7)
    } else {
      infinity.value = false;
      repeatText.value = String(loop.repeat);
      lastFiniteRepeat.value = String(loop.repeat);
    }
```

First conversion prefills `repeatText = '1'`, `infinity = false` (D-11).

**Loop-id minting** — reuse the existing factory, no new id scheme (`:2158-2165`):

```ts
        const duplicate: PhysicPaintRotoLoopClip = {
          ...loop,
          loopId: createPhysicPaintRotoKeyId(),
          placementStart: destinationStart,
          sourceKeyIds: Object.freeze([...loop.sourceKeyIds]),
        };
```

**Confirm routing** (`:2196-2203`) — add the reduced-mode branch beside the existing ones:

```ts
  async function confirm(): Promise<boolean> {
    if (runDestination.peek().kind === 'stack') return confirmStack();
    if (dialogMode.peek() === 'loop-edit') return updateLoop();
    if (railTab.peek() === 'reveal') return confirmReveal();
    return confirmGeneration();
  }
```

**Standard short-circuit for Regenerate** (`:1768-1775`) — already correct, do not change; a converted Key Rail is a Standard rail and inherits `STANDARD_RAIL_REGENERATE_REASON`:

```ts
  function groupRegenerateReason(group: PhysicPaintRotoLoopClip, document: PhysicPaintRotoPhysicalDocument | null): string | null {
    if (ports.library.busy.peek() || ports.getOperationLocked() || isBusyPhase(phase.peek())) return 'Finish the current Rail operation.';
    if (isStandardMergedLoopClip(group)) return STANDARD_RAIL_REGENERATE_REASON;
    ...
```

**Loop lookup helper** (`:1336-1338`) — the read path for "does this segment already have a loop":

```ts
  function currentLoopClips(): readonly PhysicPaintRotoLoopClip[] {
    return ports.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  }
```

---

### `view/physicsPaintKeyRailPresentation.ts` (utility, transform) — RAIL-01/RAIL-02 fact list

**Analog:** the in-file Selected copy builders `:74-103`, and `projectPhysicsPaintLoopClipPresentation` for the "facts, never math" shape.

**The segment type the inspector projects from** (`:1-15`) — this is the entire input contract; no new derivation:

```ts
export interface KeyRailSegment {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
}
```

**The copy-builder pattern to extend** (`:90-103`):

```ts
export function buildSelectedKeyRailCopy(
  segment: KeyRailSegment,
  availability: SelectedKeyRailCopyAvailability = {},
  setSentence: string | null = null,
): string {
  const dragCopy = availability.dragUnavailableReason ?? 'Drag to move.';
  const deleteCopy = availability.deleteUnavailableReason
    ?? (segment.keyIds.length === 1
      ? 'Delete removes this rail.'
      : 'Delete removes all keys in this rail.');
  return `${buildKeyRailIdentityCopy(segment, true)} ${dragCopy} ${deleteCopy}${setSentence ?? ''}`;
}
```

**Prescribed projection for the new inspector presentation** (pure, frozen, no signal reads, no store access — same discipline as `:17-29` `freezeSegment`):

```ts
export interface SelectedKeyRailInspectorPresentation {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
  readonly framesLabel: string;   // `F${firstKeyFrame}–F${lastKeyFrame}`
  readonly keysLabel: string;     // `${keyIds.length}` (or `1 key`)
  readonly typeLabel: 'Standard'; // D-10 — the rail kind it becomes
  readonly editDisabledReason: string | null; // D-03 multi-select reason
}
```

Rules to hold: D-04 allows **only** Frames / Keys / Type. D-03 supplies `editDisabledReason` when the rail set has 2+ members — reuse `SelectedKeyRailCopyAvailability`'s optional-reason idiom (`:85-88`), never a boolean + separate string. Follow the "facts only, never math" discipline documented at `physicsPaintLoopClipPresentation.ts:403-411` (capsule-never-math): `framesLabel` is `firstKeyFrame`..`lastKeyFrame` verbatim; the cycle length the *modal* will use comes from the resolver, not from this projection.

Extend this module rather than adding a new presentation file: it already owns "Selected Key Rail copy" and is imported by `PhysicsPaintKeyRail.tsx:17-22`.

---

### `view/PhysicsPaintScriptsPanel.tsx` (component, request-response) — RAIL-01 / D-01 / D-03

**Analog:** the loop-clip takeover at `:133-173`. Copy its structure exactly; the Key Rail branch is a sibling early-return *before* the toolbar branch.

**The takeover to mirror** (`:133-145`):

```tsx
  if (selectedLoopClip) {
    return (
      <div class="physics-paint-scripts-panel physics-paint-loop-clip-panel" role="tabpanel" aria-label={`Selected Rail — ${selectedLoopClip.displayName}`}>
        <div class="physics-paint-loop-clip-inspector-top-actions">
          <IconButton buttonRef={playButtonRef} label={`Edit Rail — ${selectedLoopClip.displayName}`} title={`Edit Rail — ${selectedLoopClip.displayName}`} onClick={() => { void onOpenLoopEdit(selectedLoopClip.loopId); }} className="physics-paint-loop-clip-nav-compact-button primary labeled" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><Pencil size={16} aria-hidden="true" /><span class="physics-paint-roto-key-icon-label">Edit Rail</span></IconButton>
          ...
          <IconButton label={`Close Rail inspector — ${selectedLoopClip.displayName}`} title={`Close Rail inspector — ${selectedLoopClip.displayName}`} onClick={onCloseLoopClip} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><X size={16} aria-hidden="true" /></IconButton>
        </div>
        <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
        <dl class="physics-paint-loop-clip-inspector">
          <div><dt>Name</dt><dd title={selectedLoopClip.displayName}>{selectedLoopClip.displayName}</dd></div>
          ...
        </dl>
```

**Prop additions** to `PhysicsPaintScriptsPanelProps` (`:12-31`) — mirror the loop pair:

```ts
  selectedLoopClip?: PhysicsPaintLoopClipPresentation | null;
  onOpenLoopEdit: (loopId: string) => Promise<unknown>;
  onCloseLoopClip: () => void;
```
becomes (add):
```ts
  selectedKeyRail?: SelectedKeyRailInspectorPresentation | null;
  onOpenKeyRailEdit?: (firstKeyId: string) => Promise<unknown>;
  onCloseKeyRail?: () => void;
```

**Disabled-with-reason pattern** — the `IconButton` local component `:453-489` already implements the exact contract (D-03 "visible and disabled with a reason"): `aria-disabled` + `aria-describedby` → a `.physics-paint-sr-only` node + the tooltip reads `` `unavailable: ${reason}` ``.

```tsx
        aria-disabled={isDisabled ? 'true' : undefined}
        aria-describedby={isDisabled && reason ? props.descriptionId : undefined}
        ...
      {isDisabled && reason ? (
        <span id={props.descriptionId} class="physics-paint-sr-only">{reason}</span>
      ) : null}
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="right-edge" avoidRowOverlap>
        {isDisabled && reason ? `unavailable: ${reason}` : props.title}
      </PhysicsPaintStyledTooltip>
```

Use a `useId()` per reason (the file's existing idiom `:82-88`) — do not hand-roll ids.

**Precedence note:** the Key Rail branch must be placed before the `selectedLoopClip` branch or after it, but never both — rail selection is exclusive (a key selection clears the rail selection in Studio `:1153-1155`). Recommend: `if (selectedKeyRail) return (...)` placed **before** `if (selectedLoopClip)`, matching "key selection wins" in the store law.

---

### `view/PhysicsPaintPlayScriptDialog.tsx` (component, request-response) — RAIL-02 / D-05 / D-06

**Analog:** the existing `dialogMode` derivation and the loop-edit composition.

**Mode derivation block to extend** (`:61-72`):

```tsx
  const dialogMode = playScript.dialogMode.value;
  const loopEdit = dialogMode === 'loop-edit';
  const sourceEdit = dialogMode === 'source-edit';
  const editTarget = playScript.loopEditTarget.value;
  const standardEditTarget = loopEdit && editTarget !== null && isStandardMergedLoopClip(editTarget);
```

Add a `reducedForm` flag (any Standard-editing mode). It must gate, in one place:
1. `surfaceTall = loopEdit || sourceEdit || stackCollision !== null` (`:141`) — a reduced surface is compact, so exclude it.
2. The Rail Type / Motion / Color / Source-cycle / Key-script / Paint-seed blocks (`:395-455`) — none render.
3. The tabs row (`applySurface` `:86`, `:336-357`) — never renders.

**Header composition** (`:304-334`) — keep it, swap the title/range:

```tsx
            <strong id="physics-play-script-title">{regenerateImpact
              ? `Regenerate “${regenerateImpact.groupName}”?`
              : loopEdit
                ? 'Edit Rail'
                : sourceEdit
                  ? 'Edit Source Cycle'
                  : 'Run Script'}</strong>
          </div>
          <div class="physics-paint-play-script-header-meta">
            ...
                : loopEdit && editTarget
                  ? <span class="physics-paint-play-script-header-range">{`F${editTarget.placementStart} · Cycle ${editTarget.sourceKeyIds.length}f`}</span>
```

Claude's-discretion item: the reduced form may keep the range readout with the *segment* span (`F{first}–F{last}`) instead of the loop's `placementStart · Cycle Nf`.

**Footer labels** (`:557-572`) — the primary-button pattern already carries the D-06 wording switch, extend it:

```tsx
                  {loopEdit
                    ? standardEditTarget
                      ? 'Update Rail'
                      : playScript.mode.value === 'static' ? 'Update Static' : 'Update Motion'
                    : sourceEdit
                      ? 'Regenerate source cycle'
                      : (<><Play size={11} aria-hidden="true" />Run Script</>)}
```

`'Update Rail'` for Standard is **already shipped** — reuse it verbatim for the existing-Standard path, and add `'Create Cycle'` for the first Key Rail conversion (D-06).

**Focus management** (`:149-163`) — the reduced form focuses the Cycle input, so reuse `repeatInputRef` rather than adding a ref:

```tsx
      else if (dialogMode === 'loop-edit') {
        if (restoreRegenerateTriggerFocus.current) { ... } else repeatInputRef.current?.focus();
      }
```

**Escape / Enter** (`:269-290`) — unchanged; `playScript.cancel()` already produces the zero-write cancel.

---

### `view/PhysicsPaintPlayScriptCards.tsx` (component, request-response) — RAIL-02 / D-05 / D-07

**Analog:** `PaintTimingCard` `:479-562` — specifically its second field column, which is *already* the literal Cycle + Infinity pair the reduced form needs.

**The two controls to extract/reuse** (`:532-558`):

```tsx
        <div class="physics-paint-play-script-field physics-paint-play-script-cycle-field">
          <SliderStepper
            id="physics-play-script-repeat"
            class="physics-paint-play-script-compact-stepper"
            inputRef={props.repeatInputRef}
            label="Cycle"
            ariaLabel="Cycle"
            value={cycleValue}
            onChange={(value) => { if (!props.stacking) props.playScript.repeatText.value = String(value); }}
            min={1}
            sliderMax={16}
            step={1}
            disabled={props.busy || props.stacking || props.playScript.infinity.value}
            ariaInvalid={!props.stacking && Boolean(props.playScript.repeatError.value)}
            ariaDescribedBy={!props.stacking && props.playScript.repeatError.value ? 'physics-play-script-repeat-error' : undefined}
          />
          <div class="physics-paint-play-script-timing-foot">
            {dialogSwitch({
              id: 'physics-play-script-infinity',
              label: 'Infinity',
              checked: cycleInfinity,
              disabled: props.busy || props.stacking,
              onClick: () => { if (!props.stacking) props.playScript.setInfinity(!props.playScript.infinity.value); },
            })}
          </div>
          {!props.stacking && props.playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{props.playScript.repeatError.value}</span> : null}
        </div>
```

**`dialogSwitch` helper** (`:68-95`) — the accessible switch (role/aria-checked/track+knob) the Infinity control uses. Do not hand-roll a checkbox.

**Never write in a render body.** `SliderStepper.onChange` and `dialogSwitch.onClick` are event handlers — the `playScript.setInfinity` / `repeatText.value` writes belong there (efx-preact-reactivity rule 6). `setInfinity` is compare-then-write (rule 3) — keep it that way.

**Prescribed shape:** a `ReducedCycleCard` (or `StandardCycleCard`) in this file rendering exactly `Timing` → Cycle field + Infinity foot, with ids kept stable (`physics-play-script-repeat`, `physics-play-script-infinity`, error id `physics-play-script-repeat-error`) so the dialog's `aria-describedby` and tests keep working. D-07: the *same* card serves a converted Key Rail and a later-edited Standard clip — one component, two entry points.

---

### `view/PhysicsPaintKeyRail.tsx` (component, event-driven) — D-02 / RAIL-01

**Analog:** `PhysicsPaintLoopClipRail.tsx:274-310` — the pending-single-click + fast-double-click intent detector, and `:322-329` the keyboard Enter equivalent.

**The double-click detector to mirror** (`PhysicsPaintLoopClipRail.tsx:274-292`):

```tsx
    const previousTimestamp = lastClickTimestampRef.current;
    const elapsed = previousTimestamp === null
      ? Number.POSITIVE_INFINITY
      : event.timeStamp - previousTimestamp;
    const hasPendingSingleClick = pendingSingleClickRef.current !== null;
    if (gesture === 'plain' && (hasPendingSingleClick || (elapsed >= 0 && elapsed <= LOOP_CLIP_FAST_DOUBLE_CLICK_MS))) {
      event.preventDefault();
      clearClickSequence();
      props.onSelectLoopClip(range.loopId, 'plain');
      void props.onOpenLoopEdit(range.loopId);
      return;
    }
```

**Current Key Rail click handler** to extend (`PhysicsPaintKeyRail.tsx:229-251`) — today it selects synchronously and has **no** double-click handler:

```tsx
  const handleClick = (event: RailMouseEvent) => {
    event.stopPropagation();
    if (isMoveMember && props.onRailSetDragClickSuppressed?.()) return;
    if (drag.consumeClickSuppression()) return;
    tooltip.hide();
    focusRailTargetOnPointerSelection(event);
    const gesture: PhysicsPaintRotoSpacingSelectionGesture = event.shiftKey && (event.metaKey || event.ctrlKey)
      ? 'union'
      : event.shiftKey
        ? 'range'
        : event.metaKey || event.ctrlKey
          ? 'toggle'
          : 'plain';
    props.onSelectKeyRail(selection(), gesture);
  };
```

Two viable shapes, both role-match:
- **A (recommended, smallest):** keep the synchronous select and add a timestamp ref + a second-plain-click check that calls `props.onOpenKeyRailCycleEdit(segment.firstKeyId)` — no first-click delay, so the existing 43.6 gesture timing and `drag.consumeClickSuppression()` semantics are untouched. Guard with `gesture === 'plain'`, `!isMoveMember`, and `props.busy`.
- **B:** copy the loop rail's pending-timer wholesale. This changes single-click select timing for Key Rails — CONTEXT explicitly notes key rails currently select synchronously, so prefer A.

**Keyboard parity** (`PhysicsPaintLoopClipRail.tsx:322-329`) — Enter opens the editor on the loop rail; mirror it in `handleKeyDown` (`PhysicsPaintKeyRail.tsx:252-269`) where Enter is currently unhandled (only Escape/Space are):

```tsx
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.stopPropagation();
    event.preventDefault();
    tooltip.hide();
    clearClickSequence();
    props.onSelectLoopClip(range.loopId, 'plain');
    if (event.key === 'Enter') void props.onOpenLoopEdit(range.loopId);
```

**New props** on `PhysicsPaintKeyRailProps` (`:58-106`) and passed through `PhysicsPaintKeyRailTargetProps` (`:125-151`) → `PhysicsPaintKeyRail` map (`:358-385`): `onOpenKeyRailCycleEdit?: (firstKeyId: string) => void`. Follow the existing optional-prop + `?? {}` style so the pre-58 call sites keep compiling.

**Do not touch** the drag routing: `isMoveMember` gating (`:175`, `:294-298`) is the 260820-lwd law and stays exact.

---

### `PhysicsPaintStudio.tsx` (orchestration, request-response) — D-01/02 wiring

**Analog:** `handleOpenRotoLoopEdit` + `selectedLoopClip` + the right-panel memo. Three insertion points.

**1. Entry point beside `handleOpenRotoLoopEdit`** (`:4788-4794`):

```tsx
  const handleOpenRotoLoopEdit = useCallback(
    (loopId: string) => {
      selectedLoopClipId.value = loopId;
      return rotoPlayScript.openLoopEdit(loopId);
    },
    [rotoPlayScript],
  );
```

Add `handleOpenRotoKeyRailCycleEdit = useCallback((firstKeyId: string) => { selectedRotoKeyRail.value = { firstKeyId, keyIds: ... }; return rotoPlayScript.openKeyRailCycleEdit(firstKeyId); }, [rotoPlayScript, ...])` — mirroring the "select then open" order so the panel is already on the inspector when the modal closes.

**2. Presentation derived from `effectiveSelectedRotoKeyRail`** (`:1149-1155`) — the reconciled, render-safe selection (never the raw signal):

```tsx
  const effectiveSelectedRotoKeyRail = reconcileRotoKeyRailSelection(
    selectedRotoKeyRail.value,
    ...,
  );
  if (selectedRotoKeyRail.peek() !== null
    && (effectiveSelectedRotoKeyRail === null || selectedKeyId.value !== null || selectedKeyIds.value.length > 0)) {
    selectedRotoKeyRail.value = null;
  }
```

Build `selectedKeyRailPresentation` the same way `selectedLoopClip` is built (`:4831-4833`):

```tsx
  const selectedLoopClip = selectedLoopClipId.value === null
    ? null
    : loopPresentations.get(selectedLoopClipId.value) ?? null;
```
→
```tsx
  const selectedKeyRail = effectiveSelectedRotoKeyRail === null
    ? null
    : projectSelectedKeyRailInspector(effectiveSelectedRotoKeyRail, { setSize: effectiveRailSetSelection?.members.length ?? 0 });
```

The segment for the selection comes from the same derived segments the strip uses (`deriveKeyRailSegments`); `RotoKeyRailSelection` (`useRotoTimelineActions.ts:655-658`) carries `firstKeyId` + `keyIds` but **not** the frames — resolve `firstKeyFrame`/`lastKeyFrame` from the derived segments (the loop-rail presentation map at `:4798-4817` is the precedent for building a `Map` once per render and reading it by id).

**3. Right-panel memo** (`:7038` deps, `:7109-7130` value) — add `selectedKeyRail` to the dep array (positionally, beside `selectedLoopClip`) and to the `scripts` object:

```tsx
      scripts: {
        library: rotoScriptLibrary,
        playScript: rotoPlayScript,
        rotoScript,
        playButtonRef,
        selectedLoopClip,
        linkedGroupNavigation: ...,
        onOpenLoopEdit: handleOpenRotoLoopEdit,
        onCloseLoopClip: handleCloseRotoLoopClip,
        ...
      },
```

Add beside them: `selectedKeyRail`, `onOpenKeyRailEdit: handleOpenRotoKeyRailCycleEdit`, `onCloseKeyRail: handleCloseRotoKeyRail`. **`rightPanelPropsMemo.resolve` only re-runs on listed dep identity changes** — a missing dep here is the classic stale-panel bug; put the new derived object in the array.

`PhysicsPaintRightPanel.tsx:57` types `scripts: PhysicsPaintScriptsPanelProps` and `:542` spreads `<PhysicsPaintScriptsPanel {...scripts} />` — **no edit required there**, only the panel's own prop type (above).

---

### `roto/physicsPaintRotoLoopGuards.test.ts` (test) — RAIL-07 / D-17

**Analog:** its own D-11 `describe` block. The single-reference case is the one that must change *deliberately*; the `>= 2` cases must stay green untouched.

**Current single-loop rejection test to convert** (`:278-285`):

```ts
describe('D-11 rigid linked-key guard', () => {
  it('rejects a single-key move on a linked source key with the locked copy', () => {
    const resolution = resolveEdit({
      records: SOURCE_RECORDS(),
      intent: { kind: 'move-key', movedKeyId: 'C', target: { kind: 'physical-cell', appFrame: 22 } },
      loopClips: [loop(10, 5)],
    });
    expectFailure(resolution, 'loop-source-key-move-rejected', 'move-key', D11_TEXT);
  });
```

Rewrite as the **Law A boundary pair**: one loop → accepted (`expectOk`, `mapping.get('C') === 22`, `nextLoopClips` null); two loops (`[loop(10, 5, 'L1'), loop(100, 5, 'L2')]`) → the identical `expectFailure(..., 'loop-source-key-move-rejected', 'move-key', D11_TEXT)`. Keep `D11_TEXT` verbatim (`:72`) — D-16 forbids rewording.

**Fixtures/harness to reuse as-is** (`:68-179`): `SOURCE_RECORDS()` (A..E @ 10..14), `ORDINARY_RECORDS()`, `loop(placementStart, repeat, loopId, sourceKeyIds)`, `resolveEdit()`, `expectFailure()`, `expectOk()`. No new fixtures needed.

**Force Spacing tests stay byte-identical** (`:297-313`) — D-14 keeps the existing guard; they are the pin proving Law A did not leak.

---

### `roto/physicsPaintRotoKeyRailCycle.test.ts` (test, create) — RAIL-03/05/07

**Analog:** `physicsPaintRotoLoopGuards.test.ts` — its pure resolver harness (`:123-179`) plus its **real history harness** (`:876-948`), which is the only way to pin "exactly one undo step" without touching the store.

**History harness pattern to copy** (`:876-928`): `useRotoPhysicalEditHistory({ identity, availability, coordinator, recordsPort, getLiveSourceSnapshot, undoPaint, redoPaint })` driven by `acceptedOutput`/`pendingOperationId` signals, with `vi.mock('preact/hooks', ...)` shims at `:4-9`.

**Assertion pattern for the one-command law** (`:957-974`):

```ts
    test.accept(before, after, 'clear-linked-1', 'paste-key');
    expect(test.availability.value).toEqual({ undo: 1, redo: 0 });
    ...
    expect(await test.history.undo()).toBe(true);
    ...
    expect(test.availability.value).toEqual({ undo: 0, redo: 1 });
    expect(await test.history.redo()).toBe(true);
    ...
    expect(test.executePhysicalEdit.mock.calls.map(([input]) => input.operationKind)).toEqual(['undo', 'redo']);
```

**Coverage the new spec must pin** (D-17):
1. **Record shape** — `buildKeyRailStandardLoopClip(...)` output satisfies `isPhysicPaintRotoLoopClip` and `isStandardMergedLoopClip`, with `sourceKeyIds === segment.keyIds` in frame order, `placementStart === segment.firstKeyFrame`, and **absent** (not `undefined`-valued) `scriptId`/`railKind`/`motion`. Assert absence via `expect('scriptId' in record).toBe(false)` — `toHaveProperty(x, undefined)` would pass on a present-undefined field.
2. **Gapped segment** (D-09) — keys at 10, 12, 15 → resolver `cycleLength` 6, not 3 (`derivePhysicPaintRotoLoopRanges`, cycle length `sourcePositions[last] - sourcePositions[0] + 1`, `resolver:5539-5541`).
3. **Single-key segment** (D-08) — one key → convertible, 1-frame cycle.
4. **Law A boundary** — exactly one referencing loop accepts; two reject (may live here or in the guards spec, not both).
5. **Undo/redo both directions** — one accepted command restores the pre-conversion loop collection on undo and re-applies on redo; `availability` goes `{1,0}` → `{0,1}` → `{1,0}`.
6. **Cancel performs zero writes** — no `acceptedOutput`, `availability` still `{0,0}`, `commit` never called.

Test file naming: repo collects **only `.test.ts`** (a `.test.tsx` verify target exits 0 while running nothing). This spec is pure resolver + hook — `.test.ts` is correct.

---

## Shared Patterns

### Physical-edit resolution law (applies to every write path in this phase)
**Source:** `physicsPaintRotoPhysicalResolver.ts` intent dispatch + `useRotoTimelineActions.ts:2425-2455`
**Apply to:** the Law A change, and any conversion that routes through the resolver.

```ts
    const resolution: PhysicPaintRotoPhysicalEditResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities,
      intent,
      parentEndExclusive: input.getParentEndExclusive(),
      capacity,
      interpolationEnabled: interpolation.enabled,
      loopClips: input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
    });
    if (!resolution.ok) {
      return { ok: false, reason: resolution.failure.text || 'The Roto key move is invalid.' };
    }
```
No direct store writes; the caller only reads `resolution.proposal` and hands it to `executePhysicalEdit`. The `> 0 → > 1` change is entirely inside the resolver — `prepareRotoKeyDrag` / `commitRotoKeyDrag` need **no** edit (CONTEXT confirms).

### One atomic history command per physical operation
**Source:** `useRotoPhysicalEditHistory.ts:153-164` (`RotoPhysicalEditCommand`), `physicsPaintRotoLoopGuards.test.ts:957-974`
**Apply to:** the Key Rail → Standard conversion.

```ts
interface RotoPhysicalEditCommand<EngineState> {
  readonly kind: 'physical';
  readonly operationId: string;
  readonly operationKind: RotoPhysicalEditOrdinaryOperationKind;
  readonly trackId: string;
  readonly before: RotoPhysicalEditSnapshot<EngineState>;
  readonly after: RotoPhysicalEditSnapshot<EngineState>;
  readonly acceptedRevision: string;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}
```
One `ports.commit` = one command. Never publish two commits for "convert then select".

### Loop-only publication (zero records touched, no new semantic kind)
**Source:** `physicsPaintRotoPlayScriptController.ts:1966-2004`
**Apply to:** the conversion commit and the later Standard edit.

`semanticDelta.kind: 'play-script'` + `loopOnly: true` + `affectedEndAppFrame = anchor - 1` + `proposedRecords` mirroring the accepted records verbatim + `freshKeyIds: []`. Reused as-is — no coordinator/`.mce` change.

### Standard rail classification (no new field)
**Source:** `physicsPaintRotoRunScriptStacking.ts:536-540` (`isStandardMergedLoopClip`), `physicsPaintWorkflowPresentation.ts:48-52` (`classifyLoopClipRailKind`), `physicsPaintStudio.css:4935-4942` (`.rail-kind-standard`)
**Apply to:** presentation, dialog gating, Regenerate/Replay refusal.

```ts
export function classifyLoopClipRailKind(clip: PhysicPaintRotoLoopClip | undefined): RotoRailKind {
  if (clip === undefined) return 'playscript';
  if (clip.railKind === 'reveal') return 'reveal';
  return isStandardMergedLoopClip(clip) ? 'standard' : 'playscript';
}
```
The gray pill exists; D-10 means **zero CSS work** this phase.

### Rail selection is session-only signal state, reconciled every render
**Source:** `PhysicsPaintStudio.tsx:453-463` (`reconcileRotoKeyRailSelection`), `:1149-1155`
**Apply to:** the new `selectedKeyRail` presentation.

Read `effectiveSelectedRotoKeyRail` (reconciled), never the raw `selectedRotoKeyRail.value`, in the right-panel memo. The same block already clears the rail selection when a key selection appears — that is the exclusivity guarantee the panel branches rely on.

### Preact signals discipline (efx-preact-reactivity, mandatory)
**Source:** `.claude/skills/efx-preact-reactivity/SKILL.md`
**Apply to:** every component/controller edit above.

- No `useState` for shared/derived state — the reducer/signals model in Studio + controllers is the convention (`useState` appears only for pointer-drag locality, e.g. `PhysicsPaintPlayScriptDialog.tsx:176-177` — that is the sanctioned local-locality case).
- Store setters compare-then-write (`setInfinity`, `setKeyScriptEdits`, `setPaintSeedVariation` are the in-file precedents).
- No signal writes in a render body (the only exception is the guarded compare-then-write echo, `Studio:1153-1155`).
- Effect deps identity-stable — the right-panel memo is dep-array-driven; new derived objects must be in the array or memoized (`useMemo`) as `loopPresentations` is at `:4798-4817`.
- No `useEffect` for selection (memory: "apply selection in the click handler") — the double-click handler must call `onSelectKeyRail` then `onOpenKeyRailCycleEdit` inline.

### Drag routing split (do not regress)
**Source:** `PhysicsPaintKeyRail.tsx:172-175`, `PhysicsPaintLoopClipRail.tsx:179-182`
**Apply to:** the Key Rail double-click addition.

```tsx
  const isMoveMember = props.railSetMoveMemberKeyRailIds?.includes(segment.firstKeyId) ?? false;
```
Gate on move-membership flags, never `isSetMember` / `effectiveRailSetMembers` (260820-lwd). A move member's pointer-down already belongs to the batch session (`:294-298`) — the double-click path must not intercept it.

### Tests run with `vitest run` from `app/`
Two relevant specs, both `.test.ts`. Never watch mode. Resolver specs are pure — no DOM, no store, no Tauri IPC (the `physicsPaintRotoLoopClips.test.ts` package-IO mocking is only for persistence tests, which this phase does not touch).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| — | — | — | None. Every file in this phase has an exact or role-match analog. The one genuinely new capability (creating a loop clip where none exists) is a parameter change on `runLoopOp`'s existing body, not a new pattern: only the anchor and the "no existing `loopId` lookup" differ. |

**Closest-partial note for the planner:** there is **no** intent kind and **no** factory for creating a loop clip (`physicsPaintRotoPhysicalResolver.ts:171-188` has no create-loop member). Two sanctioned routes, both one atomic command:
1. **Publication route (recommended by CONTEXT):** build the next loop collection in the controller and publish through `buildLoopOnlyPublication` + `ports.commit`. No resolver, coordinator, or schema change; rides the existing `'play-script'` loop-only semantic delta.
2. **New intent route:** add an `intent.kind` member + factory + guard branch. Larger blast radius (operation-kind union, coordinator plumbing, semantic-delta validators) for identical behavior.

Choose (1) unless a test proves a resolver-level guard is required.

---

## Metadata

**Analog search scope:** `app/src/components/physic-paint/{roto,view,hooks}` + `app/src/components/physic-paint/PhysicsPaintStudio.tsx` + `physicsPaintStudio.css`
**Files read for extraction:** 19 (all verified git-tracked via `git ls-files`)
**Pattern extraction date:** 2026-11-03
**Downstream:** `gsd-planner` — reference the file + line ranges in each plan action.
