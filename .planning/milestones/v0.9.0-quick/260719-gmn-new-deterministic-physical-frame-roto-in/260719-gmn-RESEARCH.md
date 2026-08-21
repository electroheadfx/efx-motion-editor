# Quick Task 260719-gmn: Deterministic Physical-Frame Roto Timing - Research

**Researched:** 2026-07-19
**Domain:** Physics Paint Roto timing, identity-preserving timeline edits, atomic parent acknowledgement
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions

- Real Roto keys have stable identity and exactly one coordinate: source frame, stored frame, and displayed physical frame are the same value. All key-owned paint, strokes, cache, thumbnail, background, and script metadata move with the identity. [VERIFIED: user prompt]
- Automatic interpolation persists only enabled/disabled state. Generated frames are derived from physical gaps with `max(0, rightFrame - leftFrame - 1)`. Adjacent keys are valid, there is no leading/trailing interpolation, and toggling interpolation cannot move keys. [VERIFIED: user prompt]
- Remove global `inBetweenCount`, minimum-spacing validation, source/display projection, segment spacing overrides, moved-key spacing overrides, stale-spacing restoration, and every production reader/writer of those timing concepts. [VERIFIED: user prompt]
- Insert Frame shifts the selected real key and every later real key by `+1`, creates no key, preserves selected identity, validates capacity, commits atomically as one history entry, and rolls back on failed parent acknowledgement. [VERIFIED: user prompt]
- Delete Frame removes the selected key and physical slot, shifts later keys by `-1`, shares toolbar/keyboard transaction paths, preserves survivor identity/payload, selects deterministically, and is one atomic Undo/Redo action. [VERIFIED: user prompt]
- Drag becomes ripple cut-and-insert. Empty/generated cells are physical destinations; occupied real keys expose before/after boundaries and are never overwritten. Preview and commit use one resolver, and moved/destination keys are tracked by identity. [VERIFIED: user prompt]
- Force Spacing is an explicit action, not a live timing input. `N` means intervals of `N + 1`; the first ordered real key remains anchored; `N = 0` makes keys adjacent; the operation is capacity-safe and one atomic history entry. [VERIFIED: user prompt]
- Insert/Delete/Drag/Force Spacing use one reusable validated batch frame-mapping transaction: validate the complete final map, stage locally once, publish once, await acknowledgement, and restore frames, payload, caches, selection, and history on failure. [VERIFIED: user prompt]
- Reopen, playback, onion, preview, cache publication, and export consume physical positions and derived gaps. [VERIFIED: user prompt]
- The UI keeps the interpolation toggle, replaces the count input with a concise Force Spacing input/action, keeps Insert/Delete and Delete/Backspace, and distinguishes empty/generated targets from occupied-key before/after boundaries using existing visual conventions. [VERIFIED: user prompt]
- Production-first sequencing is mandatory: no regression tests and no Vitest in this quick; typecheck/build first, then native UAT; tests only after explicit UAT approval. [VERIFIED: user prompt]

### Authoritative Examples

- Keys `1,2,5`, interpolation ON: generated frames are only `3,4`. [VERIFIED: user prompt]
- Insert examples: `1,2,3 -> 2,3,4 -> 2,4,5`. [VERIFIED: user prompt]
- Move key `5` two frames right from `2,4,5`: `2,4,7`. [VERIFIED: user prompt]
- Reorder key `3` after key `8` from `1,3,5,8`: `1,4,7,8`; the final key remains the old frame-8 identity. [VERIFIED: user prompt]
- Delete key `7` from `1,4,7,8`: survivors are `1,4,7`, with the final key retaining the old frame-8 identity. [VERIFIED: user prompt]
- Force Spacing `2`: `1,2,5 -> 1,4,7`; Force Spacing `0` makes ordered keys adjacent. [VERIFIED: user prompt]

### Deferred Ideas (OUT OF SCOPE)

- Multi-selection UI and group movement are not implemented in this quick, although the transaction model must not block them. [VERIFIED: user prompt]
- Deterministic regression tests are deferred until after native UAT approval. [VERIFIED: user prompt]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUICK-260719-GMN | Replace the projected/spacing-based Roto model with one deterministic physical-frame model and atomic identity-preserving edits. | The schema, store, transaction, parent-authority, history, UI, persistence, and downstream-consumer changes below define the complete implementation boundary. [VERIFIED: codebase + user prompt] |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation at `.claude/gsd-core`. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Do not run the development server. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Use `pnpm`; if tests are later authorized, run Vitest non-interactively rather than watch mode. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Preserve Preact-native architecture. Prefer Signals or direct derivation for shared/derived reactive state, and use hooks/effects only for genuine component or external lifecycle concerns. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]
- Reuse nearby abstractions and avoid unrelated hook-to-Signal refactors. [VERIFIED: `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md`]

## Summary

The current Roto implementation has two timing coordinates for a real key: its canonical `sourceFrame` and its projected `displayFrame`. A global `inBetweenCount` plus per-segment overrides expands canonical keys into display cells; the store rewrites real-key display metadata during regeneration, and Studio, persistence, hydration, onion, drag, history, and script paths compensate for that projection. The codebase has no explicit stable real-key ID; identity is currently inferred from a mutable frame number. [VERIFIED: `app/src/types/physicPaint.ts`, `app/src/stores/physicPaintStore.ts`, `app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts`]

The clean replacement is an identity-bearing real-key record whose only coordinate is `appFrame`, an enabled-only interpolation setting, and a runtime-only generated cache derived from adjacent physical gaps. Insert, Delete, ripple Drag, and Force Spacing should produce a complete `keyId -> appFrame` final map, then pass through one generalized version of the existing move save-barrier, complete snapshot, optimistic replacement, operation-bound settlement, rollback, and accepted-only history seams. [VERIFIED: codebase + user prompt]

Preview and export already ask the store for a Roto frame at a physical frame number; playback already iterates `appFrame` values. Their main requirement is therefore not a parallel rewrite but verification that the store and session now expose direct physical frames with no projection fallback. [VERIFIED: `app/src/lib/previewRenderer.ts`, `app/src/lib/exportRenderer.ts`, `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts`, `app/src/lib/frameMap.ts`]

**Primary recommendation:** Introduce stable `keyId`, make `appFrame` the sole durable real-key coordinate, delete the source/display spacing model, and generalize the approved single-key move transaction into one complete identity-based physical batch transaction for all four timeline operations. [VERIFIED: codebase + user prompt]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Physical key ordering and gap derivation | Client domain model | Client store | Pure deterministic functions should own ordering, generated-cell derivation, and operation resolution; the store materializes the result. [VERIFIED: codebase + user prompt] |
| Gesture and Force Spacing intent | Browser / Client UI | Client domain model | WorkflowStrip collects intent only; it must not reconstruct timing or mutate keys. [VERIFIED: `PhysicsPaintWorkflowStrip.tsx`] |
| Atomic local staging and rollback | Client orchestration | Client history | Studio already owns the live-pixel barrier, latest-state reread, complete local snapshots, selection restoration, and rollback. [VERIFIED: `PhysicsPaintStudio.tsx`, `useRotoKeyMoveHistory.ts`] |
| Durable validation and acknowledgement | Parent application boundary | Client orchestration | The parent bridge owns layer capacity, project identity, revision checks, payload validation, idempotency, and apply results. [VERIFIED: `app/src/lib/physicPaintBridge.ts`] |
| Real/generated cache materialization | Client store | Persistence | `physicPaintStore` is the single regeneration point; persistence should store real keys and enabled state, not projected/generated timing truth. [VERIFIED: `physicPaintStore.ts`, `physicPaintPersistence.ts`] |
| Playback, onion, preview, export | Client renderers | Client store | These consumers should look up physical `appFrame` data and never infer source/display ownership. [VERIFIED: codebase] |

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Direction |
|-------------------|---------|---------|-----------|
| Preact | 10.28.4 | Studio and timeline UI | Keep existing function components and focused lifecycle hooks; do not add React compatibility state machinery. [VERIFIED: installed package tree] |
| `@preact/signals` | 2.8.1 | Shared reactive store/version state | Continue using existing Signals for store/version subscriptions and direct derivation for physical timeline views. [VERIFIED: installed package tree + codebase] |
| TypeScript | 5.9.3 | Discriminated frame/payload contracts | Use discriminated real/generated frame types so generated-only provenance cannot leak onto durable real keys. [VERIFIED: installed package tree + codebase] |
| Vite | 5.4.21 | Production web build | Existing production build remains the gate. [VERIFIED: installed package tree] |
| Tauri API | 2.10.1 | Standalone/parent transport boundary | Keep the existing operation/result transport and generalize its Roto authority validation. [VERIFIED: installed package tree + codebase] |

### Supporting

| Existing abstraction | Purpose | Required use |
|----------------------|---------|--------------|
| `physicPaintStore.replaceRotoKeyFrames()` | Full real-key replacement plus one regeneration | Retain as the single store apply boundary, but make it consume identity-bearing physical keys. [VERIFIED: codebase] |
| `useRotoApplyLifecycle()` | Operation-bound success/rejection/timeout settlement | Reuse unchanged in principle for every physical batch operation. [VERIFIED: codebase] |
| `useRotoPersistenceIntegration()` | Optimistic replacement and one parent payload | Generalize from move-specific naming/inputs to physical batch transactions. [VERIFIED: codebase] |
| `useRotoKeyMoveHistory()` | Complete snapshots, accepted-only commands, paint barriers | Generalize to physical-frame edit history for Insert/Delete/Drag/Force Spacing. [VERIFIED: codebase] |
| WorkflowStrip Pointer Events gesture | Threshold, capture, cancellation, hit testing, edge scrolling | Preserve mechanics; replace only destination semantics and resolver inputs. [VERIFIED: codebase] |

**Installation:** No package installation is required. [VERIFIED: codebase]

## Target Data Model

Use a discriminated real-key type rather than adding more optional provenance fields to the existing broad cache record. [VERIFIED: codebase + user prompt]

```ts
// Source: recommended replacement for app/src/types/physicPaint.ts
export interface PhysicPaintRotoRealKeyFrame extends PhysicPaintRenderedFrame {
  source: 'real-key';
  keyId: string;
  appFrame: number; // sole source/stored/display coordinate
  backgroundOnly?: boolean;
  onionDataUrl?: string;
}

export interface PhysicPaintRotoGeneratedFrame extends PhysicPaintRenderedFrame {
  source: 'generated-interpolation';
  appFrame: number;
  // Runtime-derived render cache only; no source/display coordinate fields.
}

export interface PhysicPaintRotoInterpolationSettings {
  enabled: boolean;
}

export interface PhysicPaintRotoScriptMotionSettings {
  deform: number;
  position: number;
}
```

- Require `keyId` for every real key in launch, bridge, store, authority, history, and persisted metadata. Existing code already uses `crypto.randomUUID()` for operation identity, so the same native API is consistent for newly created real keys. [VERIFIED: `app/src/lib/physicPaintBridge.ts`]
- Generate a key ID exactly once at real-key creation. Editing, moving, saving, reopening, Undo/Redo, script application, Copy/Paste, and Duplicate preserve that ID; operations that create a genuinely new key allocate a new ID. [VERIFIED: user prompt + codebase]
- Keep `deform` and `position` available to the Script motion controls, but move them out of interpolation timing into a dedicated settings contract. The current script renderer consumes them as motion parameters, while timeline actions force interpolation mode to `duplicate`; no production UI exposes a selectable interpolation mode. [VERIFIED: `PhysicsPaintStudio.tsx`, `physicsPaintRotoPlayScriptRenderer.ts`, `useRotoTimelineActions.ts`]
- Remove durable generated frames and generated provenance from `.mce` truth. Persist real-key PNG/metadata, Roto background, enabled state, and separate script-motion settings; regenerate all interior cells on load and after a real-key mutation. [VERIFIED: codebase + user prompt]

## Architecture Patterns

### System Architecture Diagram

```text
Toolbar / keyboard / drag / Force Spacing action
                       |
                       v
            Physical intent resolver
     (ordered keys + key IDs + layer end)
              / invalid       \ valid
             v                 v
       no mutation       complete final key map
                              |
                              v
                 flush live pixels / reread latest
                              |
                              v
                  capture complete before snapshot
                              |
                              v
              stage all frame-owned maps atomically
                              |
                              v
       one replace-roto-key-frames parent payload
                              |
              +---------------+---------------+
              |                               |
         accepted                         reject/timeout/
              |                           transport failure
              v                               v
   regenerate derived cache once       restore complete snapshot
   update selection by key ID          keep history cursor unchanged
   record one history command
              |
              v
 physical store lookup -> playback / onion / preview / export

Interpolation toggle -> persist {enabled} -> regenerate/clear derived cache
                     -> never invoke a key mapping resolver
```

### Recommended Project Structure

```text
app/src/components/physic-paint/
├── roto/
│   ├── rotoPhysicalFrameModel.ts          # ordered real keys, physical gaps, drop targets
│   ├── physicsPaintRotoKeyController.ts   # complete batch mapping builders/validation
│   ├── physicsPaintRotoSession.ts         # selection by key ID + physical frame
│   └── rotoTimelineSelectors.ts           # direct real/generated/empty physical cells
├── hooks/
│   ├── useRotoPersistenceIntegration.ts   # generalized batch publish/settlement
│   └── useRotoKeyMoveHistory.ts           # generalized/renamed physical edit history
├── view/PhysicsPaintWorkflowStrip.tsx     # gesture and explicit Force Spacing action
└── PhysicsPaintStudio.tsx                 # barrier, stage, rollback, finalization
```

Delete `rotoSourceDisplayModel.ts`; do not preserve it as a compatibility adapter. Simplify or absorb `physicsPaintRotoWorkflow.ts` so there is only one physical timeline model. [VERIFIED: user prompt + codebase]

### Pattern 1: Deterministic Gap Derivation

```ts
// Source: recommended replacement for rotoSourceDisplayModel.ts
export function derivePhysicalTimeline(
  realKeys: readonly PhysicPaintRotoRealKeyFrame[],
  interpolationEnabled: boolean,
): Array<PhysicPaintRotoRealKeyFrame | PhysicPaintRotoGeneratedFrame> {
  const ordered = [...realKeys].sort((a, b) => a.appFrame - b.appFrame);
  const result: Array<PhysicPaintRotoRealKeyFrame | PhysicPaintRotoGeneratedFrame> = [];

  for (let index = 0; index < ordered.length; index += 1) {
    const left = ordered[index];
    result.push(left);
    const right = ordered[index + 1];
    if (!interpolationEnabled || !right) continue;
    for (let frame = left.appFrame + 1; frame < right.appFrame; frame += 1) {
      result.push(renderDuplicateFromLeftKey(left, frame));
    }
  }
  return result;
}
```

This yields zero generated cells for adjacent keys, no leading/trailing cells, and exactly `right.appFrame - left.appFrame - 1` interior cells. [VERIFIED: user prompt]

### Pattern 2: Complete Identity-Based Batch Mapping

```ts
// Source: recommended generalization of physicsPaintRotoKeyController.ts
export interface RotoPhysicalFrameMapping {
  keyId: string;
  fromFrame: number;
  toFrame: number;
}

export interface RotoPhysicalBatchTransaction {
  operation: 'insert-frame' | 'delete-frame' | 'drag-ripple' | 'force-spacing';
  mappings: RotoPhysicalFrameMapping[]; // complete final map, not changed keys only
  removedKeyIds: string[];
  realKeyFrames: PhysicPaintRotoRealKeyFrame[];
  selectedKeyId: string | null;
  selectedFrame: number;
}
```

Build the final ordered identity map first, validate unique IDs, unique integer frames, and `0 <= frame < layerEndExclusive`, then clone complete real-key payloads with only `appFrame` changed. Never mutate frame-keyed Maps sequentially; rebuild each Map/Set from the before snapshot and the complete mapping. [VERIFIED: codebase + user prompt]

### Pattern 3: Operation Semantics

- **Insert:** keep all IDs; map keys with `appFrame >= selected.appFrame` to `+1`; selected ID remains selected at its new frame. [VERIFIED: user prompt]
- **Delete:** remove the selected ID; map every later survivor to `-1`; select the next surviving physical key, otherwise the previous key, otherwise no key. [VERIFIED: user prompt]
- **Force Spacing:** sort by current physical frame, anchor the first key, and map ordered index `i` to `anchor + i * (N + 1)`. [VERIFIED: user prompt]
- **Drag to empty/generated frame:** cut the source slot first, then insert the moved identity at the requested final physical frame; shift all keys at/after the insertion frame by `+1`. [VERIFIED: user prompt]
- **Drag before/after occupied key:** track the target by `keyId`; after the cut, resolve that identity's new frame and insert before it or after it. This produces `1,3,5,8 -> 1,4,7,8` when key `3` is inserted after the old frame-8 key. [VERIFIED: user prompt]

### Pattern 4: One Acknowledged Mutation Coordinator

The current generic key utility path applies locally and starts persistence without awaiting the result, while the move path registers an operation, stages a full replacement, publishes once, and rolls back through matching settlement. Replace the split: every physical edit must use the acknowledged move-style coordinator. [VERIFIED: `useRotoKeyUtilities.ts`, `useRotoPersistenceIntegration.ts`, `useRotoApplyLifecycle.ts`]

The parent authority contract should become layer-wide rather than Play-Script-range-specific: return project context, `layerEndExclusive`, complete real keys, and a revision. The replacement payload should include operation kind, complete mappings, removed IDs, expected revision, and complete candidate real keys. The parent validates intent and durable payload by `keyId`, not by old frame number. [VERIFIED: `app/src/lib/physicPaintBridge.ts` + user prompt]

### Anti-Patterns to Avoid

- Do not retain `sourceFrame === appFrame` and `displayFrame === appFrame` as redundant compatibility fields; that preserves two-coordinate APIs and invites regression. [VERIFIED: user prompt]
- Do not store generated count or per-segment spacing anywhere; calculate gaps from adjacent physical frames every time. [VERIFIED: user prompt]
- Do not create separate Insert/Delete/Drag/Force persistence or history implementations. [VERIFIED: codebase + user prompt]
- Do not let WorkflowStrip independently decide legal timing; it emits a target intent and renders the pure Studio/domain resolver result. [VERIFIED: previous quick architecture]
- Do not use a new `useEffect` chain to synchronize projected state. The target model is directly derivable from real keys plus one enabled flag. [VERIFIED: `CLAUDE.md` + user prompt]

## Complete Production Integration Inventory

### Direct legacy timing readers/writers

| Area | Files | Required action |
|------|-------|-----------------|
| Shared contracts and validators | `app/src/types/physicPaint.ts`, `app/src/types/project.ts` | Add stable real-key identity; reduce interpolation settings to `enabled`; split script motion settings; remove source/display/spacing/generated provenance fields and validators. [VERIFIED: codebase] |
| Projection and timeline model | `rotoSourceDisplayModel.ts`, `physicsPaintRotoWorkflow.ts`, `rotoTimelineSelectors.ts` | Delete source/display expansion and replace it with ordered physical keys plus interior gap derivation. [VERIFIED: codebase] |
| Store and serialization | `app/src/stores/physicPaintStore.ts` | Key real metadata by physical frame while retaining `keyId`; derive generated runtime frames directly from adjacent real keys; stop resetting display frames; serialize only durable real keys and enabled state. [VERIFIED: codebase] |
| Key operations | `physicsPaintRotoKeyController.ts`, `physicsPaintRotoSession.ts`, `rotoKeyTransactions.ts`, `useRotoKeyUtilities.ts`, `rotoCoordinatorPorts.ts` | Replace blank-key Insert and non-ripple move with complete identity mappings; route all four physical edits through one acknowledged transaction. [VERIFIED: codebase] |
| Studio orchestration | `PhysicsPaintStudio.tsx`, `useRotoPersistenceIntegration.ts`, `useRotoApplyLifecycle.ts`, `useRotoKeyMoveHistory.ts` | Generalize move-only save barrier, snapshots, local remap, settlement, rollback, and history; selection becomes `selectedKeyId + selectedFrame`. [VERIFIED: codebase] |
| Interpolation toggle/action | `useRotoInterpolationController.ts`, `useRotoTimelineActions.ts`, `PhysicsPaintWorkflowStrip.tsx`, `physicsPaintStudio.css` | Toggle only enabled state and never resync/move the current frame; replace count input with explicit `N >= 0` Force Spacing action and occupied before/after target visuals. [VERIFIED: codebase + user prompt] |
| Live cache/edit buffers | `useRotoFramePersistenceCoordinator.ts`, `useRotoFrameEditingController.ts`, `rotoLivePixelCacheTransactions.ts`, `rotoSaveTransactions.ts`, `rotoCanvasFrames.ts`, `rotoCacheTransactions.ts` | Remove source/display fallbacks; preserve/allocate `keyId`; remap editable, preview, captured, dirty, overlay, reference, and repaint-base state from one before snapshot. [VERIFIED: codebase] |
| Hydration and persistence | `rotoLaunchHydration.ts`, `app/src/lib/physicPaintPersistence.ts` | Hydrate real keys by `appFrame` and `keyId`; stop finding PNGs through `sourceFrame`; do not hydrate generated frames as durable truth. [VERIFIED: codebase] |
| Parent bridge/authority | `app/src/lib/physicPaintBridge.ts` | Validate complete physical maps, IDs, range, revision, survivors, removals, and unchanged durable payload; remove Play-Script-only source-range assumptions. [VERIFIED: codebase] |
| Onion/reference | `rotoOnionPreview.ts`, `useRotoReferenceController.ts` | Traverse or look up direct physical real keys; remove projected display-owner/source fallback. [VERIFIED: codebase] |
| Script paths | `useRotoPlayScriptController.ts`, `physicsPaintRotoPlayScriptController.ts`, `physicsPaintRotoPlayScriptRenderer.ts`, `useRotoScriptClipboardController.ts`, `physicsPaintRotoScriptClipboard.ts`, `physicsPaintRotoScriptLibrary.ts`, `PhysicsPaintScriptsPanel.tsx` | Allocate/preserve key IDs for generated real keys, use physical starts, and consume separated script-motion settings rather than interpolation timing fields. [VERIFIED: codebase] |
| Diagnostics | `physicsPaintPerformanceTrace.ts` | Keep frame timing metrics, but rename source-frame terminology where it means the sole physical frame. [VERIFIED: codebase] |

### Indirect consumers to verify, not redesign

| Consumer | Current seam | Required verification |
|----------|--------------|-----------------------|
| Cached playback | `useRotoCachedPlayback.ts`, `useRotoNavigationCoordinator.ts` iterate `appFrame` and call a supplied frame lookup. | Ensure playback frame numbers are direct physical cells and generated interior cells come only from the store. [VERIFIED: codebase] |
| Main preview | `Preview.tsx` subscribes to `physicPaintVersion`; `previewRenderer.ts` calls `physicPaintStore.getRotoFrame(layerId, frame)`. | Store lookup must no longer translate display to source. [VERIFIED: codebase] |
| Export | `exportRenderer.ts` reuses `PreviewRenderer` frame collection/rendering. | Preview/store parity automatically gives export parity; verify no stale generated frames are preloaded. [VERIFIED: codebase] |
| Timeline length | `frameMap.ts` uses the maximum `appFrame` returned by `getRotoCacheFrames()`. | Ensure cache frames expose physical positions only and no projected duplicates. [VERIFIED: codebase] |
| Missing-frame background | `rotoFrameDraw.ts` already classifies leading/interior/trailing spans from physical real-key numbers. | Retain interior background support while ensuring paint interpolation itself has no leading/trailing generation. [VERIFIED: codebase] |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive timing synchronization | Effects copying source keys into projected display state | Pure physical selectors plus existing Signals/version subscriptions | The target view is fully derived and does not need lifecycle synchronization. [VERIFIED: `CLAUDE.md` + user prompt] |
| Per-operation settlement | Separate promises/timeouts for Insert, Delete, Drag, Force | Generalized `useRotoApplyLifecycle()` registration/settlement | Existing lifecycle already handles matching acceptance, rejection, timeout, replacement, and disposal. [VERIFIED: codebase] |
| Per-operation Undo/Redo | Four command stacks | Generalized complete-snapshot history with operation label | Existing move history already preserves paint ordering and only advances after acknowledgement. [VERIFIED: codebase] |
| Incremental in-place frame shifting | Sequential `Map.delete/set` loops | Rebuild all frame-owned maps from the before snapshot and complete mapping | Sequential ripple edits can overwrite payload when destination keys still occupy intermediate frames. [VERIFIED: codebase + user prompt] |
| Durable generated-cache reconciliation | Persisting generated frames and provenance | Regenerate from real keys and enabled state | Generated data is deterministic and stale durable copies recreate the old dual-truth problem. [VERIFIED: user prompt] |

**Key insight:** The difficult part is not interpolation arithmetic; it is preserving identity and every key-owned payload through a simultaneous map, parent acknowledgement, rollback, and history. Reuse the existing complete replacement/lifecycle seams and delete compensating projection logic instead of layering a physical model on top of it. [VERIFIED: codebase + user prompt]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `.mce` Physics Paint outputs currently persist old `roto_interpolation_settings`, real/generated cache metadata, and source/display provenance. [VERIFIED: `types/project.ts`, `physicPaintPersistence.ts`, `physicPaintStore.ts`] | Clean schema replacement. Per project policy, do not add legacy migration/compatibility code; old projects without required real-key IDs are outside the new format. [VERIFIED: project memory + user prompt] |
| Live service config | No external service configuration owns Roto timing; active standalone/parent launch context and in-memory stores can contain the old shape until restart/relaunch. [VERIFIED: codebase] | Require native app restart/relaunch after the code/schema change; launch hydration must construct only the new shape. [VERIFIED: codebase] |
| OS-registered state | None; no launchd/systemd/task registration embeds Roto timing fields. [VERIFIED: codebase search] | None. |
| Secrets/env vars | None; no secret or environment variable names encode Roto timing concepts. [VERIFIED: codebase search] | None. |
| Build artifacts | `app/dist` and Tauri bundles can contain old compiled timing logic. [VERIFIED: Vite/Tauri build configuration] | Rebuild after implementation; no installed-package migration is required. [VERIFIED: codebase] |

## Common Pitfalls

### 1. Identity created during normalization
**What goes wrong:** A moved or reopened key receives a new ID and history/selection treats it as replacement. [VERIFIED: user prompt]
**Avoidance:** Allocate `keyId` only on genuine key creation; every normalizer and transaction spreads the complete frame and preserves it. [VERIFIED: codebase + user prompt]

### 2. Sequential ripple overwrite
**What goes wrong:** Moving `3` after `8` mutates frame-keyed maps in place and overwrites payload at `4`, `7`, or `8`. [VERIFIED: user prompt]
**Avoidance:** Resolve the complete final map, then rebuild every map/set from the immutable before snapshot. [VERIFIED: codebase + user prompt]

### 3. Parent validation still keyed by frame
**What goes wrong:** The parent mistakes a moved survivor for a deleted/new key or permits unrelated payload changes. [VERIFIED: current bridge behavior]
**Avoidance:** Compare survivors by `keyId`; permit coordinate changes from the declared complete mapping and deletion only from `removedKeyIds`; compare all other durable fields. [VERIFIED: codebase + user prompt]

### 4. Partial rollback
**What goes wrong:** PNG frames roll back but editable state, onion, background-only flags, previews, dirty sets, reference URLs, selection, or history do not. [VERIFIED: existing snapshot inventory]
**Avoidance:** Generalize the current move snapshot and restore it under the original launch/layer identity before changing the history cursor. [VERIFIED: codebase]

### 5. Preview/commit drift
**What goes wrong:** WorkflowStrip previews a raw cell while commit resolves a different target after cut or target-key movement. [VERIFIED: previous quick UAT history]
**Avoidance:** Preview and commit call the same pure resolver; occupied destinations carry target `keyId` plus before/after, while empty/generated destinations carry the requested final physical frame. [VERIFIED: codebase + user prompt]

### 6. Interpolation toggle mutates navigation
**What goes wrong:** The existing controller can update `startFrame` and send frame sync after recalculating projection. [VERIFIED: `useRotoInterpolationController.ts`]
**Avoidance:** Toggle only `{ enabled }`, regenerate or clear runtime generated cache, and retain selected key ID/frame exactly. [VERIFIED: user prompt]

### 7. Script motion settings accidentally removed
**What goes wrong:** Deleting the old interpolation settings object also deletes Script `deform`/`position` controls. [VERIFIED: codebase]
**Avoidance:** Move those values into a dedicated Script motion contract and update script/clipboard consumers in the same schema wave. [VERIFIED: codebase]

### 8. Stale generated data survives reopen/export
**What goes wrong:** Persistence reloads generated metadata or export preloads stale projected frames. [VERIFIED: current persistence behavior]
**Avoidance:** Persist real keys only, regenerate once on hydration, and make preview/export consume the regenerated physical store. [VERIFIED: codebase + user prompt]

### 9. Capacity checked only from the source frame
**What goes wrong:** Force Spacing or a rightward insertion passes the current Play-Script `frameCount` check but maps a key beyond the actual layer end. [VERIFIED: current bridge authority behavior]
**Avoidance:** Parent-validate every final frame against one layer-wide `layerEndExclusive` after verifying revision and project context. [VERIFIED: codebase + user prompt]

### 10. Legacy fields remain in a low-traffic path
**What goes wrong:** Reopen, onion, Copy/Apply, Play Script, or live-pixel publication reintroduces source/display metadata. [VERIFIED: codebase search]
**Avoidance:** End implementation with a production-only grep gate for `inBetweenCount`, `segmentSpacingOverrides`, `sourceFrame`, `displayFrame`, `fromSourceFrame`, `toSourceFrame`, `nearestRealKeyFrame`, and `interpolationT`, then manually classify any non-Roto/general uses. [VERIFIED: codebase]

## Implementation Task Decomposition

### Wave 1: Schema and deterministic store
1. Replace shared frame/settings contracts, validators, launch/project output types, and defaults; introduce stable real-key IDs and separate Script motion settings. [VERIFIED: codebase + user prompt]
2. Replace `rotoSourceDisplayModel.ts` with the physical model and simplify workflow/selectors. [VERIFIED: codebase]
3. Rewrite store regeneration, lookup, serialization, and hydration around physical `appFrame`; generated/support cache is runtime-derived and regenerated once. [VERIFIED: codebase + user prompt]

### Wave 2: One physical batch transaction
1. Replace operation-specific spacing logic with pure Insert/Delete/Drag/Force resolvers that return a complete identity map. [VERIFIED: codebase + user prompt]
2. Generalize move persistence, settlement, and history; route generic key utility ports through the acknowledged coordinator. [VERIFIED: codebase]
3. Generalize parent authority and replacement validation to IDs, complete maps, removals, full-range capacity, and revision. [VERIFIED: codebase + user prompt]

### Wave 3: Studio and UI integration
1. Replace source/display Studio helpers with selected identity/physical frame and simultaneous remapping of all key-owned local state. [VERIFIED: codebase]
2. Preserve the existing drag gesture mechanics, but emit physical or before/after identity targets and show the shared resolver result. [VERIFIED: codebase + user prompt]
3. Replace the live count input with explicit Force Spacing input/action; keep the toggle independent; unify toolbar and keyboard Delete. [VERIFIED: user prompt]

### Wave 4: Downstream cleanup and production gate
1. Update live persistence, launch hydration, onion/reference, scripts/clipboard/library, diagnostics, and all bridge payload creators. [VERIFIED: codebase]
2. Verify playback, preview, export, timeline length, and missing-frame background through direct store lookups. [VERIFIED: codebase]
3. Run the production legacy-field grep, typecheck, and build; then hand off for native UAT without adding/running regression tests. [VERIFIED: user prompt]

## Code Examples

### Collision-safe local remap

```ts
// Source: recommended generalization of PhysicsPaintStudio move ownership mapping
function remapFrameMap<T>(
  before: ReadonlyMap<number, T>,
  mappings: readonly RotoPhysicalFrameMapping[],
): Map<number, T> {
  const destinationBySource = new Map(mappings.map((m) => [m.fromFrame, m.toFrame]));
  const next = new Map<number, T>();
  for (const [frame, value] of before) {
    next.set(destinationBySource.get(frame) ?? frame, value);
  }
  return next;
}
```

Apply the same immutable rebuild pattern to editable states, previews, captured frames, dirty frames, live overlay counts, cached references, and repaint-base ownership. [VERIFIED: existing Studio snapshot state]

### Force Spacing mapping

```ts
// Source: user-locked semantics
function forceSpacing(keys: readonly RotoRealKey[], spacing: number) {
  const ordered = [...keys].sort((a, b) => a.appFrame - b.appFrame);
  const anchor = ordered[0]?.appFrame ?? 0;
  const interval = spacing + 1;
  return ordered.map((key, index) => ({
    keyId: key.keyId,
    fromFrame: key.appFrame,
    toFrame: anchor + index * interval,
  }));
}
```

## State of the Art

| Old production approach | Target approach | Impact |
|-------------------------|-----------------|--------|
| Canonical source frames projected to display frames | One durable/displayed physical `appFrame` | Removes coordinate translation and selection ambiguity. [VERIFIED: codebase + user prompt] |
| Global count plus segment overrides | Gap count derived from adjacent physical keys | Adjacent keys and arbitrary gaps are deterministic. [VERIFIED: user prompt] |
| Frame number used as key identity | Stable `keyId` plus mutable physical coordinate | Ripple edits preserve payload and target identity. [VERIFIED: user prompt] |
| Non-ripple move-specific transaction/history | General physical batch transaction/history | Insert/Delete/Drag/Force share atomicity and future multi-selection seam. [VERIFIED: codebase + user prompt] |
| Generated metadata persisted as project truth | Runtime generated cache rebuilt from real keys | Reopen, preview, and export cannot restore stale timing. [VERIFIED: codebase + user prompt] |
| Play-Script-specific authority range checks | Layer-wide complete-map authority validation | All physical edits are capacity-safe and stale-revision-safe. [VERIFIED: codebase + user prompt] |

**Deprecated/outdated:** `rotoSourceDisplayModel.ts`, `inBetweenCount`, `segmentSpacingOverrides`, source/display frame fallbacks, minimum spacing, moved-key spacing reconstruction, and move-only history naming/semantics. [VERIFIED: user prompt]

## Assumptions Log

All architectural decisions in this research are either locked by the user or derived from inspected production code. No `[ASSUMED]` claims are used. [VERIFIED: research record]

## Open Questions

None blocking. Use the prescriptive choices above: UUID key IDs, complete layer-wide mappings, enabled-only interpolation persistence, separate Script motion settings, runtime-only generated cache, and no compatibility adapter. [VERIFIED: codebase + user prompt]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Typecheck/build | Yes | 24.15.0 | None needed. [VERIFIED: local CLI] |
| pnpm | Workspace commands | Yes | 10.27.0 | None needed. [VERIFIED: local CLI] |
| TypeScript | Typecheck | Yes | 5.9.3 | None needed. [VERIFIED: installed package tree] |
| Vite | Production build | Yes | 5.4.21 | None needed. [VERIFIED: installed package tree] |
| Rust/Cargo | Native Tauri UAT build path | Yes | rustc 1.93.1 / cargo 1.93.1 | Native UAT remains user-run. [VERIFIED: local CLI] |

**Missing dependencies with no fallback:** None. [VERIFIED: local environment]

## Validation Architecture

The repository has Vitest 2.1.9 configured for `src/**/*.test.ts`, but the user explicitly deferred test creation and execution until native UAT approves the production architecture. This quick therefore uses production static/build gates plus manual native UAT only. [VERIFIED: `app/vitest.config.ts`, `app/package.json`, user prompt]

### Production Gates

```bash
pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck
pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app build
```

`typecheck` runs `tsc --noEmit`; `build` runs `tsc --noEmit && vite build`. [VERIFIED: `app/package.json`]

### Requirement Validation Map

| Behavior | Validation in this quick | Gate |
|----------|--------------------------|------|
| Schema and all production callers compile without legacy timing fields | Automated static/build | Typecheck + build. [VERIFIED: user prompt] |
| Insert/Delete/Drag/Force preserve identity/payload and roll back on failed acknowledgement | Native procedural UAT after gates | User approval required. [VERIFIED: user prompt] |
| Preview and commit resolve identical drag targets | Native procedural UAT | User approval required. [VERIFIED: user prompt] |
| Reopen, playback, onion, preview, export use physical positions | Native procedural UAT | User approval required. [VERIFIED: user prompt] |
| Regression suite | Deferred | No test files and no Vitest run before explicit approval. [VERIFIED: user prompt] |

### Sampling Rate

- **Per implementation task:** run the app typecheck command. [VERIFIED: project scripts]
- **Per completed wave:** run typecheck; use the full build after cross-wave integration. [VERIFIED: project scripts]
- **Quick gate:** both production commands green before native UAT. [VERIFIED: user prompt]

### Wave 0 Gaps

No test Wave 0 is authorized in this quick. Deterministic unit coverage for physical gap derivation and operation mappings is deliberately postponed until explicit native UAT approval. [VERIFIED: user prompt]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Local editor operation; no authentication feature in this scope. [VERIFIED: codebase] |
| V3 Session Management | No | Launch operation identity is mutation ownership, not an authenticated session. [VERIFIED: codebase] |
| V4 Access Control | No | No user/role authorization boundary is introduced. [VERIFIED: codebase] |
| V5 Input Validation | Yes | Strict discriminated payload validation, unique key IDs/frames, integer/range checks, complete-map checks, expected project context, and revision validation. [VERIFIED: codebase + recommended architecture] |
| V6 Cryptography | No | No cryptographic protocol is introduced; native UUIDs are identifiers, not security tokens. [VERIFIED: codebase] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered or partial `postMessage`/Tauri replacement payload | Tampering | Validate the complete identity map and candidate frame set before store mutation. [VERIFIED: existing bridge validation pattern] |
| Replayed operation ID with different content | Spoofing/Tampering | Preserve existing operation fingerprint/idempotency rejection. [VERIFIED: `physicPaintBridge.ts`] |
| Stale authority after live-pixel flush or concurrent parent change | Tampering | Require matching project context, layer ID, and expected Roto revision immediately before apply. [VERIFIED: existing authority pattern] |
| Duplicate IDs or physical frames | Integrity failure | Reject before local staging and revalidate at the parent boundary. [VERIFIED: user prompt] |

## Sources

### Primary (HIGH confidence)

- `/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md` - project tooling and Preact constraints.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts` - current timing, cache, payload, authority, and validator contracts.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts` - source/display projection, generated-cache regeneration, serialization, hydration, and full replacement.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoSourceDisplayModel.ts` - current projected timing model.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoKeyController.ts` - current Insert/Delete/move transaction behavior.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx` - save barrier, local state ownership, move commit, rollback, and history wiring.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts` - single replacement publication.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoApplyLifecycle.ts` - acknowledgement settlement.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoKeyMoveHistory.ts` - complete move snapshots and paint barriers.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts` - parent validation, authority, revision, idempotency, and apply results.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintPersistence.ts` - durable PNG/cache metadata behavior.
- `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/previewRenderer.ts`, `exportRenderer.ts`, `frameMap.ts` - physical-frame downstream rendering.
- `/Users/lmarques/Dev/efx-motion-editor/.planning/quick/260718-m2f-add-single-real-physics-paint-roto-key-d/260718-m2f-SUMMARY.md` and `260718-m2f-VERIFICATION.md` - approved move lifecycle and UAT corrections to preserve.

### Secondary / Tertiary

None. This is codebase-specific architecture research; no external library or web claims were needed. [VERIFIED: research scope]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from installed package tree and project scripts.
- Architecture: HIGH - derived from locked decisions and inspected production seams.
- Integration inventory: HIGH - production-only legacy-field search plus direct reads of store, bridge, persistence, UI, playback, preview, and export paths.
- Pitfalls: HIGH - based on existing move rollback/history implementation and prior native UAT corrections.

**Research date:** 2026-07-19
**Valid until:** 2026-07-26 (fast-moving active Roto subsystem)
