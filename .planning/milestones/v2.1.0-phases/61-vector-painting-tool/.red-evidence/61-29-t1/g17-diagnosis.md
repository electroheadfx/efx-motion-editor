# G-17 diagnosis — a committed path edit never reaches the rendered paint

Plan 61-29 Task 1. The four probes were walked IN ORDER before any production edit.
Probes 1, 2 and 4 were observed at runtime with a throwaway vitest probe (kept at
`probe.txt` in this directory, deleted from the tree after capture); probe 3 is a
code-path reading of the shipped Studio seam, cited by file and line.

Probe fixtures: PRE anchors `[auto(0.2,0.5), auto(0.5,0.5), auto(0.8,0.5)]`,
NEXT anchors `[auto(0.2,0.6), auto(0.5,0.62), auto(0.8,0.58)]`, stroke recorded
through `recordAquarelleStroke` with `playFrame: 601` and pre-edit sampled points.

---

## Probe 1 — `updateAquarellePathInScript` (the write itself)

**Method:** record a vector stroke whose `points` are the spine sampled from the
PRE anchors, call `updateAquarellePathInScript(id, NEXT_ANCHORS)`, then compare
`getRecordedAquarelleStroke(id).points` with `sampleVectorPath(NEXT_ANCHORS).points`
mapped into the recorded shape.

**Observed fact (runtime, probe.txt):**

- The write was accepted: it returned `1` and the revision delta was `1`.
- The stored anchors MOVED: `stored.anchors[1] = {x: 0.5, y: 0.62, kind: 'auto'}`.
- The stored points did NOT move:
  - pre-edit length `302`, post-write length `302`, while
    `sampleVectorPath(NEXT_ANCHORS).points.length = 304`;
  - `stored.points[0] = {x: 0.2, y: 0.5, p: 1, ...}` vs sampled
    `{x: 0.2, y: 0.6, p: 1, ...}`;
  - `stored.points[last] = {x: 0.8, y: 0.5, ...}` vs sampled `{x: 0.8, y: 0.58, ...}`;
  - `stored points EQUAL pre-edit points: true`;
  - `stored points EQUAL sampled NEXT spine: false`.

**Conclusion:** the write replaces `anchors` (and optionally `renderMode`) but
carries the OLD `points` through the `{ ...stroke }` spread. The record now holds
a spine that disagrees with its own path. This is the broken layer.

## Probe 2 — commit -> rebake -> `applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))`

**Method:** after the same write, read the stroke's event out of
`getAquarelleEventsForFrame(601)` and compare the entry's `pts` with its
`engine.anchors`.

**Observed fact (runtime, probe.txt):**

- One event on the frame. `entry.pts.length = 302`;
  `entry.pts[0] = {x: 0.2, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0, tick: 0}` — the
  PRE-edit coordinates (the projection adds only `tick`).
- The entry's opaque copy DID move: `entry.engine.anchors[1] = {x: 0.5, y: 0.62}`.
- The two halves DISAGREE: `pts[0].y (0.5) !== anchors[0].y (0.6)`.
- `entry.pts EQUAL sampled NEXT spine: false`.

**Conclusion:** the rebake and the apply are faithful — they project whatever the
recorded stroke holds through `toStudioStroke`, which maps `s.points` into `pts`.
Because probe 1 left the old points on the stroke, every apply deposits the old
geometry. The commit/rebake layer is NOT an independent cause; it propagates the
stale record.

## Probe 3 — the defer route (Draft / wireframe)

**Method:** read the shipped commit seam and its settle replay.

- `PhysicsPaintStudio.tsx:10169` — `commitAquarelleVectorPathEdit` calls
  `beginAquarellePathEdit(mutationId, anchors)` (which calls the write above)
  BEFORE branching.
- `PhysicsPaintStudio.tsx:10177-10183` — with `draft || wireframe` the commit
  records the edit, arms `setDraftPixelsDirty(true)` and returns the edit id; no
  engine apply happens.
- `PhysicsPaintStudio.tsx:5410` / `:5451` — the later `settleDraftScript` calls
  `rotoScript.applyAquarelleTimeline(getAquarelleEventsForFrame(playFrame))` — the
  SAME payload-timeline entries.
- `PhysicsPaintStudio.tsx:8682-8693` — `bakeAquarelleVectorCommit` takes the same
  defer branch and otherwise applies the same `getAquarelleEventsForFrame`.
- `61-18` additionally refuses a wireframe settle while the wireframe view is on
  (`wireframeMode.peek()` guard at `:5415`).

**Observed fact:** the defer route owns no separate geometry source. Every path out
of it replays `getAquarelleEventsForFrame(playFrame)`, so it can only re-deposit the
projection probe 2 already showed to be stale. It cannot be the cause; it is a
second consumer of the same stale projection.

## Probe 4 — the three silent early returns in `commitAquarelleVectorPathEdit`

**Method:** the guards at `PhysicsPaintStudio.tsx:10161-10163` are
`isPhysicalMutationLocked()`, `rotoScript.applying.peek() ||
rotoScript.mutationLocked.peek()`, and `isAquarelleScriptEditInFlight()`. Each
returns `null` BEFORE any write, so a refused gesture would leave no undo entry and
no revision bump. Exercise the same write law through the selection wrapper the
commit calls at `:10169` (`beginAquarellePathEdit`).

**Observed fact (runtime, probe.txt):**

- `beginAquarellePathEdit(id, NEXT_ANCHORS + 0.02)` returned edit id `1`
  (non-null); the revision delta was `1`; the stored anchor moved to `y = 0.64`.
- The user's reported symptom is likewise a committed, undoable gesture whose paint
  does not follow — a guard refusal would instead have produced no edit at all.

**Conclusion:** the repro's write is ACCEPTED; the three early returns did not fire
and cannot explain a committed edit whose paint is stale.

---

## Verdict

The only broken layer is **probe 1**: `updateAquarellePathInScript` regenerates the
payload entry from a stroke that still carries the pre-edit `points`, and
`toStudioStroke` projects `points` into `pts` — the geometry every replay deposits.
`engine.anchors` already carries the new path, so the entry's two halves disagree;
a forced Shift+R replays the old `pts` and reproduces the PRE-edit geometry exactly
as reported. Probes 2-4 are propagation and are ruled out as independent causes.

The fix belongs in `updateAquarellePathInScript`: re-derive `points` from the
anchors it just stored, in the same six-field shape `buildVectorStroke` stamps.
