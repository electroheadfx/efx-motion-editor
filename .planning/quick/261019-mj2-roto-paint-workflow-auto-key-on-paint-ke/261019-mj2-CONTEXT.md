# Quick 261019-mj2: Roto Paint Workflow — Context

**Gathered:** 2026-10-20
**Status:** Ready for execution (plan-checked; user-directed direct-paint revision)

<domain>
## Boundary

Physic Paint Studio Roto timeline only. This quick changes how a non-real
(empty or interpolated/generated) frame becomes paintable, how Insert/Delete
move keys, what + Key copies, and how runtime caches and the parent span stay
consistent. It does not add a new module, a new engine, or a new dependency.

</domain>

<decisions>
## Locked Decisions

### Direct paint (primary path)
- **D-01:** Painting on an empty or interpolated/generated frame starts the
  stroke IMMEDIATELY on the already-warm canvas. A blank real key is promoted
  in parallel at pointerdown. There is no first-stroke buffer, no replay API,
  and no pointer interception (`preventDefault`/`stopPropagation`/
  `setPointerCapture` are never called by the promotion path).
- **D-02:** The auto-created key is BLANK in both the empty and generated
  cases. For a generated frame, clear the generated display synchronously at
  promotion start (`clearPreviewBaseImage`, `resetBackground`, `engine.clear`,
  aquarelle sheet reset) so the stroke lands on the blank key, not on the
  interpolated pixels.
- **D-03:** Suppress the accepted-key reload (`loadCachedRotoReferenceFrame`)
  for the self-promotion. Set `cachedRotoRepaintBaseFrame` to the new blank
  cache frame and leave the engine canvas untouched. Do NOT call
  `lockInputForWarm` for a pointer self-promotion.
- **D-04:** The canvas input-lock exemption is scoped to `rotoInputDisabled`
  only. Static controls and the rest of the Studio stay locked while the
  physical edit is in flight.
- **D-05:** Engine-1 and Water color captures both await the promotion promise
  and attach to the created key. `pendingFirstPaintTargetRef` is revived for
  this. A failed promotion discards the completed stroke (and reverts an
  unvalidated acceptance) and surfaces an error; no silent blank key and no
  orphan paint.

### Fallback and + Key
- **D-06:** A centered "Create key" button is rendered inside the canvas only
  on non-real cells, never over a real key or during an in-flight edit. It
  creates a BLANK key at the current frame through the same promotion helper
  with visible preparation/warm progress, then painting starts. It ships in
  this quick as the fallback if direct paint fails live UAT.
- **D-07:** + Key (the existing key action) uses the NEAREST PREVIOUS REAL
  KEY's paint, never the displayed interpolated frame. Cached real-key bytes
  are preferred, durable record bytes are the fallback; if a previous key
  exists but bytes are unavailable, fail closed and do not create a blank key.
  No later keys move.

### Tool and mode coverage
- **D-08:** Brush module: promote only when
  `resolveEffectiveTool(settings.tool) === 'paint'`. Normal and Physics are
  per-stroke `physicsMode` values on the same paint tool, so both promote.
  Selected `move`, temporary Cmd-move, and temporary Alt-erase never promote.
- **D-09:** Water color: `aquarelleActiveTool` in `brush | water | pen`
  promotes. `lift` is erase-like and never promotes on a non-real cell. Dry is
  a separate action, not a pointer gesture.
- **D-10:** Erase and lift do NOT auto-create a key on an empty cell (there is
  nothing to erase/lift). The Create key button remains available regardless
  of the selected tool. Real keys never promote; all tools composite normally
  on them.

### Timeline semantics
- **D-11:** Insert is the exact opposite of Delete: shift every real key at or
  after the current frame one slot right; create NO key. The cursor/playhead
  stays on the inserted position. Occupied-real, empty, generated, and tail
  cells are insertable. A tail insert extends the child capacity AND the
  parent FX sequence span; never clamp or drop keys. Loop-referenced ripples
  stay fail-closed.
- **D-12:** Delete/Backspace keeps the D-06 left ripple (no behavior change).
- **D-13:** `insert-empty-segment` is retired from the Insert button; the
  app-wide reference gate runs after the history hook cleanup.

### Undo, cache, span
- **D-14:** One undo removes the auto-created key AND the first stroke; redo
  restores both. The history reservation is no-argument
  (`beginAutoKeyPaintGroup()`) and binds the next accepted command by the
  coordinator-minted `operationId`; never pass `pendingOperationId.peek()`.
- **D-15:** Runtime caches re-anchor atomically on key moves: snapshot source
  `_frames`/`_rotoCacheMetadata` by keyId BEFORE writing destinations, prune
  vacated frames, regenerate derived caches once, and keep
  `_frames ⊆ _rotoCacheMetadata`. Both publication doors use the same helper.
- **D-16:** Capacity is computed once by the resolver as
  `proposal.nextCapacity`; the child coordinator raises the child mirror, and
  the parent bridge owns the FX span extension and the parent mirror.

</decisions>

<specifics>
## Specific Ideas / Constraints

- The 52.1 failure was: auto-promotion ran inside the first stroke's path and
  the blank-key reload created cold surfaces, freezing a fast second stroke.
  The fix is not a faster warm gate; it is removing the reload and the warm
  lock for the self-promotion.
- The ~1s preparation is NOT key creation. It is `restoreFrame`'s
  `FRESH_FRAME_WARM_MS` gate and the physical +Key acceptance reload decoding
  the blank WebP. Key creation itself is metadata.
- Live UAT must prove the direct-paint first-stroke flow before the work is
  called complete. If it fails, the Create key button is already in scope.
- Do not revert to buffering/replaying the first stroke.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261019-mj2-roto-paint-workflow-auto-key-on-paint-ke/261019-mj2-PLAN.md` — the executable five-task plan and all UAT rows.
- `CLAUDE.md` — project rules (Preact signals, no server, pnpm, commits).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — paint gate, promotion, accepted-key handler, captures, input lock.
- `app/src/components/physic-paint/hooks/useRotoReferenceController.ts` — blank-key load cost.
- `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` — watercolor sheet/tool/frame scope.
- `app/src/components/physic-paint/view/physicsPaintTemporaryErase.ts` — `resolveEffectiveTool` / temporary Cmd-move and Alt-erase.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — `aquarelleActiveTool`.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — Insert/Delete candidate builders.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — Insert/+Key actions and target classification.
- `app/src/stores/physicPaintStore.ts` — capacity, runtime caches, publication.
- `app/src/lib/physicPaintBridge.ts` — canonical validation and parent span extension.

Do NOT tick `SPECS/v1.1.0-water-color/phase-55-issues/index.md`.

</canonical_refs>

<deferred>
## Deferred Ideas

- None. If direct paint fails live UAT, use the Create key fallback already in
  this quick; do not start a second quick for the same behavior.
- A future optimization may pre-warm blank keys on navigation, but it is out of
  scope and must not reintroduce the 1s gate in the direct-paint path.

</deferred>

---

*Quick: 261019-mj2*
*Context gathered: 2026-10-20*
