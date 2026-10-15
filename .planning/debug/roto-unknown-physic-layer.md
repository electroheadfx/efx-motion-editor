---
status: diagnosed
trigger: |
  UAT result — Phase 55: BLOCKED, not approved.

  First physical-edit probes fail before A1-A4 are judgeable.

  Symptom: every Roto physical edit (delete key/rail, create key) fails with
    [PhysicsPaintStudio] physical edit: "Roto physical edit failed (parent-rejection): Unknown physics paint layer: 7bcc71b6-816d-4b26-8b86-20c37f39787a"
  Stack: useRotoPhysicalEditCoordinator.ts:810/828 → consumeBridgeApplyResult (PhysicsPaintStudio.tsx:2326) → usePhysicsPaintApplyResultController.ts:83 → usePhysicsPaintParentBridge.ts:298

  Scope check (measured): Phase 55 changed 0 lines in app/src/lib/physicPaintBridge.ts, useRotoPhysicalEditCoordinator.ts, usePhysicsPaintParentBridge.ts, and layerStore.ts. The only PhysicsPaintStudio.tsx diff is 18 lines of refusal-mapper wiring with zero layer-id handling. The parent lookup that rejects is at physicPaintBridge.ts:481-489 (layerStore.layers + overlayLayers match on source.layerId / layer.id).

  Assessment: NOT a host-split regression. This is a pre-existing physical-edit → parent-layer-registry bug that live UAT exposed. A1-A4 cannot be judged while physical edits are dead.

  Request: open a debug for the parent-rejection "Unknown physics paint layer" before UAT resumes. Do not weaken the A1-A4 row set; do not close the phase.
created: 2026-10-15
updated: 2026-10-15T(session-resume)
goal: find_and_fix
---

# Debug Session: roto-unknown-physic-layer

DATA_START

## Symptoms

### Expected behavior

Roto physical edits in the Physics Paint Studio — delete key, delete rail, create key — are applied against the parent layer and mutate document state. This is the precondition for judging Phase 55 UAT rows A1–A4.

### Actual behavior

Every Roto physical edit (delete key/rail, create key) fails before any state changes. The parent bridge rejects the apply with an unknown-layer lookup failure. A1–A4 are not judgeable while physical edits are dead.

### Error messages (verbatim)

```
[PhysicsPaintStudio] physical edit: "Roto physical edit failed (parent-rejection): Unknown physics paint layer: 7bcc71b6-816d-4b26-8b86-20c37f39787a"
```

Stack (as reported):
- `useRotoPhysicalEditCoordinator.ts:810/828`
- `consumeBridgeApplyResult` — `PhysicsPaintStudio.tsx:2326`
- `usePhysicsPaintApplyResultController.ts:83`
- `usePhysicsPaintParentBridge.ts:298`

### Timeline

Pre-existing. Exposed by the first Phase 55 live-UAT physical-edit probe on 2026-10-15. Not a Phase 55 regression — measured scope check:

- `app/src/lib/physicPaintBridge.ts` — 0 lines changed by Phase 55
- `useRotoPhysicalEditCoordinator.ts` — 0 lines changed by Phase 55
- `usePhysicsPaintParentBridge.ts` — 0 lines changed by Phase 55
- `layerStore.ts` — 0 lines changed by Phase 55
- `PhysicsPaintStudio.tsx` — 18 lines of refusal-mapper wiring, zero layer-id handling

### Reproduction

In the Physics Paint Studio, perform any Roto physical edit:
- delete key
- delete rail
- create key

Every one fails at the parent bridge. Payload carries `layerId: 7bcc71b6-816d-4b26-8b86-20c37f39787a`; the parent lookup finds no matching layer.

## Rejecting lookup (measured)

`app/src/lib/physicPaintBridge.ts:481-489`:

```ts
const targetLayer = [...layerStore.layers.peek(), ...layerStore.overlayLayers.peek()].find(layer => {
  if (layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') return false;
  const sourceLayerId = typeof layer.source.layerId === 'string' && layer.source.layerId.length > 0
    ? layer.source.layerId
    : layer.id;
  return sourceLayerId === payload.layerId || layer.id === payload.layerId;
});
if (!targetLayer) {
  return applyFailureResult(payload, `Unknown physics paint layer: ${payload.layerId}`);
}
```

The match is `source.layerId` OR `layer.id` against `payload.layerId`, restricted to `type === 'physic-paint'` with `source.type === 'physic-paint'`.

## Mandated first step (before any patch)

Targeted log or app-written capture at the rejection site: dump `payload.layerId` alongside the live `layerStore.layers` / `layerStore.overlayLayers` ids (and each candidate's `type` / `source.type` / `source.layerId`). The goal is to show WHICH side of the id match is stale — payload side (Studio realm id that the parent never learned) vs parent side (registry lost/renamed the layer, or the layer is filtered out by the `type` guard). This is a cross-realm id mismatch; measure it before proposing a fix.

Capture goes to `/tmp` via an app-written file (per the app-written-capture-files rule). Vitest is not admissible as a verdict here — Tauri/cross-webview path.

## Suggested cause (NOT prescriptive — one hypothesis to test)

A cross-realm layer-id mismatch: the Studio (child realm) sends a `layerId` the parent realm's `layerStore` never registered, or registered under a different id / type. Candidates worth disproving first, not assuming:

1. Parent `layerStore.layers` / `overlayLayers` lost the layer between Studio open and the edit (hydration / realm-bridge gap).
2. The layer is present but filtered out by `layer.type !== 'physic-paint'` or `layer.source.type !== 'physic-paint'` (e.g. a paint-only or overlay variant carries a different shape).
3. The payload's `layerId` is a Studio-local id (source.layerId) that the parent only knows as `layer.id`, or vice versa — one of the two match arms is dead for this layer.
4. Related prior work: `studio-track-physical-edits` (fix-applied 2026-10-05) touched the same parent-bridge / physical-edit path for a different error (`malformed real-key record`, `replay source snapshot`). Check whether that fix or a later change left the registry lookup narrower than the Studio's notion of a paint layer.

## Guardrails (hard constraints)

- User runs the live app. Tauri/cross-webview path: **live or on-disk evidence is the verdict; unit probes are not admissible.**
- Reuse the existing parent-bridge / layer-registry path. **No new transport.**
- **Fix live first, regression tests after.**
- **ONE root cause, ONE fix.** User retests.
- **Do not weaken the Phase 55 A1–A4 row set. Do not close Phase 55.** Phase 55 UAT stays BLOCKED and PENDING until this is fixed and the rows are re-run.

## Context notes

- Related resolved debug: `.planning/debug/studio-track-physical-edits.md` (status fix-applied, 2026-10-05) — same coordinator/bridge path, different error family. Read it before patching; do not reopen it.
- Phase 55 on-disk format cutover (StudioScriptEnvelope) and the four named Apply refusals landed in `PhysicsPaintStudio.tsx` as refusal-mapper wiring only. They are NOT implicated by the scope check, but the debugger should confirm the refusal mapper did not accidentally swallow or remap the unknown-layer failure into this surface.

DATA_END

## Current Focus

- bug_class: Bohrbug (deterministic — every physical edit fails with the same layerId)
- hypothesis: the parent `layerStore.layers` + `overlayLayers` lookup at `physicPaintBridge.ts:481-489` finds no candidate for `payload.layerId`. Three competing causes, not yet distinguished:
  1. (data/registry) the Layer object is absent from both lookup lists at apply time (deleted / never registered / sits in a non-active `kind === 'content'` sequence so `getOverlaySequences()` skips it).
  2. (code/type-guard) a Layer with matching id exists but is filtered out by the strict `layer.type === 'physic-paint' && layer.source.type === 'physic-paint'` guard (this lookup is STRICTER than the sibling lookups at :728/:1686/:2154, which match `candidate.id` first without a type guard).
  3. (data/id) payload.layerId is a Studio-side id the parent never registered (cross-realm id mismatch).
- test: app-written capture at the rejection site dumps payload.layerId + every live layer candidate (id, type, source.type, source.layerId) + sequence kind map + efxPaint document presence. File: `/tmp/efx-unknown-layer.json`.
- expecting: capture shows WHICH side is stale — payload id not present anywhere vs present-but-type-filtered vs present-in-skipped-content-sequence.
- next_action: PARKED (latent, not reproducing). User chose to resume Phase 55 A1-A4 UAT. No code change. Reopen only if the rejection returns — then instrument the hydrate path (sequence `kind` map at boot) rather than asking for another live capture, since the failure is session-scoped and clears on relaunch.
- leading_mechanism (UNPROVEN — failing run is gone, no capture exists): apply lookup at `physicPaintBridge.ts:481-489` is two lists (`layerStore.layers` = ACTIVE sequence only; `layerStore.overlayLayers` = sequences with `kind !== 'content'`) and demands `type === 'physic-paint' && source.type === 'physic-paint'` BEFORE any id compare. Launch uses `getEfxPaintDocument(layerId)`, a flat registry that ignores sequence kind/active-ness (`createPhysicPaintLaunchContext` at `:3932`). A physic-paint layer in a sequence that is both non-active and `kind === 'content'` launches fine and applies as `Unknown physics paint layer`.
- session-scope explanation (matches the observed repro): `projectStore.ts:592` does `kind: mceSeq.kind ?? 'content'` — a missing `kind` defaults to `'content'` on hydrate. Hydrate runs ONCE per app boot. A sequence persisted without `kind` therefore drops out of the apply lookup for the entire session and comes back clean after relaunch (save writes `kind` at `projectStore.ts:267`). This is the user's "cache problem" read and it fits "first Studio open failed several times, then `pnpm tauri dev` and it was fine" exactly.

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-10-15T(session-resume)
  checked: static map of the rejecting lookup vs sibling lookups in `physicPaintBridge.ts`
  found: >
    Rejection site :481-487 requires `layer.type === 'physic-paint' && layer.source.type === 'physic-paint'`
    BEFORE any id compare. Sibling lookups at :728, :1686, :2154 match `candidate.id === payload.layerId`
    FIRST with no type guard, OR (`type === 'physic-paint' && source.type === 'physic-paint' && source.layerId === id`).
    A layer whose id matches but whose type/source.type is not physic-paint would pass :728/:1686/:2154 and fail :481.
  implication: type-guard strictness is a live candidate cause; capture must dump type/source.type of every id-bearing candidate.

- timestamp: 2026-10-15T(session-resume)
  checked: `layerStore.layers` / `overlayLayers` composition (`app/src/stores/layerStore.ts`, `sequenceStore.getOverlaySequences`)
  found: >
    `layers` = active sequence's layers only. `overlayLayers` = every sequence with `kind !== 'content'`.
    A physic-paint layer living in a non-active `kind === 'content'` sequence is invisible to BOTH lists.
    Hydrate defaults missing kind to `'content'` (`projectStore.ts:592`).
  implication: sequence-kind map must be in the capture; a content-kind FX sequence is a candidate cause.

- timestamp: 2026-10-15T(session-resume)
  checked: launch vs apply registries
  found: >
    Launch (`createPhysicPaintLaunchContext`) requires `getEfxPaintDocument(layerId)` and writes physicPaintStore
    under `source.layerId`. Apply requires the separate `layerStore` Layer lookup. Launch can succeed while apply
    fails if the efxPaint document exists but the Layer object is not in the two lookup lists.
  implication: capture must also record whether `getEfxPaintDocument(payload.layerId)` exists.

- timestamp: 2026-10-15T(session-resume)
  checked: Phase 55 refusal-mapper surface (`PhysicsPaintStudio.tsx` buildRotoScriptApplyRefusalMessage path)
  found: >
    The refusal mapper owns script-apply refusal codes only. The observed error is the coordinator's
    parent-rejection path (`Roto physical edit failed (parent-rejection): ...`), a different surface.
  implication: Phase 55 refusal mapper is NOT remapping this failure; the unknown-layer string is the parent's own.

- timestamp: 2026-10-15T(session-resume)
  checked: knowledge base + resolved debug `physics-paint-delete-cache`
  found: >
    KB has no entry for "Unknown physics paint layer" as a bug. The delete-cache session used the same string
    as the DESIRED post-deletion rejection (a guard, not a defect).
  implication: no known-pattern shortcut; proceed to measurement.

- timestamp: 2026-10-15T(capture-wired)
  checked: measure-only capture installed at the rejection branch
  found: >
    NEW `app/src/lib/unknownPhysicLayerCapture.ts` writes `/tmp/efx-unknown-layer.json` via the established
    `exportWritePng` app-writes-/tmp path (same as lookDeltaCapture). Called only from
    `physicPaintBridge.ts` `!targetLayer` branch. Dumps: payload (layerId/kind/trackId/operationId/startFrame),
    layerStore.layers + overlayLayers (id, name, type, sourceType, sourceLayerId, inActiveSequence),
    every sequence (id, kind, isActive, layers), and efxPaint document presence
    (parentLayerId / activeTrackId / trackIds). Console.warn mirrors the report.
  implication: one live physical edit will distinguish the three candidate causes. No product patch landed.

- timestamp: 2026-10-15T(user-live-run-1)
  checked: user ran the live app after the probe was wired
  found: >
    `/tmp/efx-unknown-layer.json` was NEVER written. First test of that run failed with the verbatim
    rejection (`Unknown physics paint layer: 7bcc71b6-...`) on delete-key AND create-key; later tests
    in the same run applied cleanly. No product patch is in the tree (working tree = capture only:
    `unknownPhysicLayerCapture.ts` + 14 lines in `physicPaintBridge.ts`, all inside `if (!targetLayer)`,
    same `applyFailureResult` returned).
  implication: >
    The probe cannot change apply behavior, so the recovery was STATE, not code. The empty capture means
    the rejection branch did not fire in the later tests — NOT that the first failure did not happen.
    Caveat: if the failing test ran before the rebuilt bundle was live, the probe could not have written;
    treat the cold repro as the authoritative capture.

- timestamp: 2026-10-15T(mechanism-reading)
  checked: the two registries that can diverge
  found: >
    Apply lookup `physicPaintBridge.ts:481-489` searches `layerStore.layers` (ACTIVE sequence only) +
    `layerStore.overlayLayers` (`sequenceStore.getOverlaySequences()` = sequences with `kind !== 'content'`).
    Launch lookup is `getEfxPaintDocument(layerId)` — a flat registry keyed by layerId, no sequence filter.
    `projectStore.ts:592` defaults a missing sequence `kind` to `'content'` on hydrate.
  implication: >
    A physic-paint layer in a non-active `kind === 'content'` sequence is invisible to BOTH apply lists
    while still launching. This is the leading (unproven) mechanism for the first-test rejection.

- timestamp: 2026-10-15T(delete-key-triage)
  checked: user-reported "previous keys move 1 frame left on delete"
  found: >
    User clarified the concrete case: later keys move left. That is D-06, the documented delete contract
    in `useRotoPhysicalEditCoordinator.ts` (delete removes the identity and shifts every LATER survivor
    left). Phase 55 changed 0 lines in that file. User's "before Phase 55" baseline is the add-key
    absolute-position law (different operation), not delete.
  implication: >
    Not a regression; D-06 has always closed the gap leftward. Only a case where EARLIER keys move would
    violate the contract and warrant a new session.

- timestamp: 2026-10-15T(corrected-repro)
  checked: user's own account of the failing run
  found: >
    The failure was SESSION-SCOPED, not document-cold-path. First Studio open in one app session produced
    the verbatim rejection; the user reproduced it SEVERAL times inside that session. After relaunching with
    `pnpm tauri dev` and opening Studio again, it did not come back. A second cold repro with the probe
    live (create key + delete key) applied cleanly and wrote no capture. User's read: "I think it's a cache
    problem?" — the hydrate `kind ?? 'content'` default is a once-per-boot cache of exactly that shape.
  implication: >
    Earlier "cold repro" instructions were aimed at the wrong axis (document coldness). The real axis is
    app-boot state. No further live capture is useful while the bug is down; the failing session is gone
    and the probe never saw it. Mechanism stands as unproven-but-fitting. Parked per user decision to
    resume Phase 55 A1-A4 UAT.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: (empty until confirmed)
fix: (empty until applied)
verification: (empty until verified)
files_changed: []

