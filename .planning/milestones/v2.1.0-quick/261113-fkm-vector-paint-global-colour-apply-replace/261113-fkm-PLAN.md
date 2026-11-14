---
phase: 261113-fkm-vector-paint-global-colour-apply-replace
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/aquarelleRecordState.ts
  - app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts
  - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
autonomous: true
requirements: [QUICK-261113-FKM]
user_setup: []

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-01: a whole-stroke colour apply on a vector stroke that carries explicit anchor `color` keys clears every one of those keys in the SAME edit. The stroke keeps its geometry, anchor order, `kind`, handles and `width` factors; the stroke, its timeline entry and the entry's `engine` all take the new global colour; `engine.anchors` carries no `color`."
    - "Anchors that carried no colour are untouched by that apply — the anchor objects (and, when nothing was cleared, the whole array) stay reference-identical, so the sparse profile stays byte-identical. A stroke with no anchors gains no `anchors` key and behaves exactly as before."
    - "An apply whose colour equals the stroke's current colour still counts as an edit when the stroke carries explicit anchor colours: the batch returns 1 (not 0), the target is replaced and the revision bumps once. Today that edit is silently dropped."
    - "D-02: a patch that carries no colour (Size/params, brush id, paint-seed flag, tool multipliers) never clears an anchor colour and never rebuilds the anchor list. Anchor width factors and explicit colours survive a Size apply."
    - "The clear and the colour write are one undoable edit: `beginAquarelleAppearanceEdit`'s existing before/after snapshot pair restores the exact pre-edit stroke object — explicit anchor colours included — and the exact pre-edit timeline entry by reference."
    - "After a global colour apply the path-edit re-bake can no longer project per-vertex colours back over the global colour: the rebuilt path is a uniform colour profile, so `resolveStrokeColors` returns null and the engine replays the stroke in the one global colour. Re-adding per-vertex colours stays available only through the anchor-selection colour commit, whose routing is unchanged."
  artifacts:
    - path: "app/src/components/physic-paint/view/aquarelleRecordState.ts"
      provides: "The ONE appearance batch clears explicit anchor colours whenever the patch carries a colour (module-local `withoutAnchorColor` helper placed OUTSIDE the 261111-t74 source-pin region), sets `changed` on a colour-only clear, and writes the rebuilt anchor list through ONE conditional spread keyed on array identity; the batch doc comment states the write policy."
    - path: "app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts"
      provides: "Batch-level pins: clears explicit colours and re-projects the engine entry; colourless anchors reference-identical; hand-painted stroke gains no anchors key; same-colour apply still returns 1; params-only (Size) apply never clears; mixed batch writes both targets with one revision bump."
    - path: "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts"
      provides: "The wrapper-level one-edit/undo pin: a same-colour whole-stroke apply returns an edit id, bumps once, and `restoreAquarelleEditSnapshot(..., 'undo')` restores the pre-edit stroke object (coloured anchors) and entry by reference; the local `stroke()` helper gains an optional `anchors` field."
  key_links:
    - from: "app/src/components/physic-paint/view/aquarelleRecordState.ts"
      to: "packages/efx-watercolor/src/payload/toStudioStroke.ts"
      via: "`toStudioStroke(nextStroke)` is the ONE projection: the rebuilt anchor list (colour keys dropped, everything else preserved) lands in `entry.engine.anchors`, so the payload never carries a stale per-vertex colour."
    - from: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
      to: "app/src/components/physic-paint/view/aquarelleRecordState.ts"
      via: "`beginAquarelleAppearanceEdit` captures `captureAquarelleStrokeRegistry()` BEFORE `updateAquarelleStrokesInScript` mutates and the `after` snapshot after, so the cleared anchor colours live inside one before/after pair (one undo, one ledger record)."
    - from: "app/src/components/physic-paint/PhysicsPaintStudio.tsx"
      to: "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts"
      via: "`handleRightPanelColorCommit`'s no-anchor-selection fall-through calls `aquarelleAppearanceCommitRef.current?.(ids, { color })`; the anchor-selection branch still commits per-vertex colour through `buildAnchorColorCommit` and returns before the batch. This routing is NOT changed."
    - from: "packages/efx-watercolor/src/adapter/engineAdapter.ts"
      to: "packages/efx-watercolor/src/vector/spine.ts"
      via: "`resolveStrokeColors` returns null when `isUniformColorProfile(engine.anchors)` is true — so a colour-cleared path replays byte-identically to a never-coloured one, and no per-vertex pigment is fed to the engine."
---

<objective>
Make a whole-stroke (global) colour apply on a vector stroke REPLACE the explicit per-vertex colours, in the same edit, so the global colour sticks when the user re-enters path edit.

Purpose: quick 261111-wd6 (VEC-04) introduced a sparse explicit anchor `color` that wins over the stroke colour. A whole-stroke colour apply today writes only the stroke colour (`updateAquarelleStrokesInScript` never touches `stroke.anchors`), so a stroke that carries per-vertex colours keeps rendering — and keeps re-baking — its old per-vertex colours over the new global colour. The user's decision (D-01) is that a global colour IS a replacement: the explicit per-anchor colours are superseded and must be dropped in the SAME edit. The complementary decision (D-02) is that Size is a multiplier channel, not a colour channel: a whole-stroke Size apply keeps anchor `width` factors untouched and takes NO code change.

Output: one write-policy change inside the ONE appearance batch (`updateAquarelleStrokesInScript`): when the patch carries `color`, each target's anchor list is rebuilt with every explicit `color` key removed (anchors and array kept by reference when nothing was cleared), `changed` becomes true even when the incoming colour equals the stroke's current colour, and the rebuilt list reaches `engine.anchors` through the existing `toStudioStroke` projection. No new field, no format-version bump, no UI, no signal, no Studio change: `beginAquarelleAppearanceEdit` already wraps the batch in one snapshot pair, and `handleRightPanelColorCommit`'s anchor-selection branch still owns per-vertex colour writes.

Scope boundary: the WRITE POLICY of a whole-stroke colour apply only. Do NOT add a global/local mode switch, do NOT add UI, do NOT touch `updateAquarellePathInScript`, `buildAnchorColorCommit`, `anchorColorCommitIsNoOp`, the Studio's colour routing, `projectVectorPath`, `normaliseAquarelleAnchors`, `anchorsEqual`, the codec, `AQUARELLE_SCHEMA_VERSION`, or any Size behaviour. Do not delete the `anchors` key (geometry must survive — only the `color` keys go). Do not re-project the mapped anchors through `projectVectorPath` (it would clone every anchor and destroy the untouched-reference law). `vitest run` only, never watch; never run the dev server.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Anchors verified at HEAD `2bcec0649` on `dev`; working tree clean. This quick touches a pure data-write path — no Preact component, hook, effect or signal is added or read in a render body, so `efx-preact-reactivity` has no firing rule here; the store-side compare-then-write and one-bump laws are preserved.

`app/src/components/physic-paint/view/aquarelleRecordState.ts`
- 725-756 `AquarelleStrokeAppearancePatch` (`color?`, `params?`, `paintSeedVariation?`, `brushId?`, `toolOverrides?`). Unchanged.
- 758-778 the batch doc comment (261024-p5q / 261031-cf9). Extend it with the new colour policy.
- 779-933 `updateAquarelleStrokesInScript` — the ONE whole-stroke appearance batch. Validation of the whole patch runs before any target is resolved (791-828); every target resolves its next params/color/brush/overrides and computes a per-target `changed` flag (841-898); `if (!changed) continue;` at 888 drops a no-op; the write loop (901-930) builds `const nextStroke: AquarelleStroke = { ...stroke, params, color, brushId, ...(toolOverrides) }` (913-921), regenerates through `toStudioStroke(nextStroke)` (925), and replaces the entry at the SAME index (929). ONE `bumpAquarelleStrokesRevision()` (931).
- 856-857 is the colour term: `const nextColor = hasColor ? patch.color : stroke.color;` then `if (hasColor && nextColor !== stroke.color) changed = true;`. This is where a same-colour global apply is dropped today.
- 951-1015 `updateAquarelleCurveModeInScript` and 1043+ `updateAquarellePathInScript` — untouched. The path write re-derives the spine from anchors and re-projects them; that is why a stale anchor colour survives a re-bake.

`app/src/components/physic-paint/view/aquarelleStrokeSelection.ts`
- 1007-1025 `beginAquarelleAppearanceEdit`: `clearAquarelleStrokeDrag()`, in-flight guard, `before = captureAquarelleSnapshot()`, `updateAquarelleStrokesInScript(...) === 0 → null`, `bumpAquarellePaintSeedSalts(ids)` (skips salt-less strokes and returns 0 without a bump), `after = captureAquarelleSnapshot()`, `storeAquarelleEdit({ before, after })`. Unchanged by this plan.
- 809-820 `captureAquarelleSnapshot` → `captureAquarelleStrokeRegistry()` captures the recorded stroke OBJECTS by reference (aquarelleRecordState.ts 591-599), and 858-866 `applySnapshotContent` restores them via `restoreAquarelleStrokeRegistry`. That is the existing undo machinery the new clear inherits for free.
- 652-661 `aquarelleScriptStrokeEditionPort` / 725-743 `commitAquarelleSelectionAppearance` and 675-689 the selection edit port — untouched.

`app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- 7469-7511 `handleRightPanelColorCommit`: with anchors selected on the OPEN path edit it commits `buildAnchorColorCommit` through `aquarellePathEditCommitRef` and RETURNS (no-op returns early since 261112-hfk); with no anchor selection it falls through to `aquarelleAppearanceCommitRef.current?.(ids, { color })`. That fall-through is the ONLY colour-carrying appearance patch in the app (verified by grep: `handleAquarelleAppearanceStrokes` is the only `applyAppearance` implementation with a colour; the paint-control seam sends params/brush/multipliers only). Routing is NOT edited.
- 9196-9245 `handleAquarelleAppearanceStrokes` — guards, `beginAquarelleAppearanceEdit`, Draft path, reset + re-apply timeline, failure restore. Untouched.

`packages/efx-watercolor/src/payload/toStudioStroke.ts`
- 125-140 `AquarelleStroke` (`anchors?: readonly AquarelleAnchor[]`, `curveMode?`).
- 146-191 `toStudioStroke`: 187 writes `engine.anchors` ONLY when `s.anchors !== undefined`, through `projectVectorPath`.
- `packages/efx-watercolor/src/payload/vectorPath.ts` 326-338 `projectVectorPath` keeps a `color` key whenever present (no default elision) and writes `width` only when it differs from 1; 269-279 `normaliseAquarelleAnchors`; 294-314 `anchorsEqual` compares the colour too (so a colour-only path edit is not dropped).
- `packages/efx-watercolor/src/vector/spine.ts` 316-318 `isUniformColorProfile` — true when no anchor carries a colour.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` 169-179 `resolveStrokeColors` returns null for a uniform profile (no anchors, empty, or all colourless), so the engine deposit path is unchanged.

Tests
- `app/src/components/physic-paint/view/aquarelleRecordState.test.ts` and `.path.test.ts` (node environment, `beforeEach(resetAquarelleRecordState)`), `.reopenAnchorColor.test.ts` (the AQTL v2 colour round trip), `.anchor.test.ts` (anchor binding) — the sibling fixtures this plan's new file mirrors.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` 595-780 `261024-p5q watercolor appearance edits` (the shipped batch tests + the undo test at 693-727); its `point()` / `stroke()` helpers at 142-172 (the `stroke()` helper takes no `anchors` today); `entryIndexOf` / `strokeEntryAt` at 194-209; `type AquarelleAnchor` is already imported.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` 7838-7892 the 261111-t74 source pin: `writeRegion()` slices `aquarelleRecordState.ts` from `export function updateAquarelleStrokesInScript(` to `export function updateAquarelleCurveModeInScript(` and asserts exactly one `bumpAquarelleStrokesRevision()`, exactly one `payloadTimeline[index] =`, exactly one `NEUTRAL_TOOL_OVERRIDES`, exactly one `toolOverrides: nextOverrides`, and that the replacement is a fresh object (`const nextStroke: AquarelleStroke = {`, `...stroke,`). The new helper and the conditional anchor spread must not disturb any of those counts — so place the helper ABOVE the function's doc comment (outside the pinned region).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: A whole-stroke colour apply replaces per-vertex colours in the one batch</name>
  <files>
    app/src/components/physic-paint/view/aquarelleRecordState.ts
    app/src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts
  </files>
  <behavior>
    - A colour apply on a vector stroke carrying two explicit anchor colours returns 1, writes the new colour into the stroke, its entry and the entry's `engine`, and leaves NO `color` key on any anchor; anchor count, order, `kind`, handles and `width` factors are preserved; `entry.pts`, `cuisson` and `recordedOrder` are the pre-edit values.
    - Anchors that carried no colour are the SAME objects after the apply (`toBe`); a colour apply on a stroke whose anchors carry no colour leaves the anchor ARRAY `toBe` the pre-edit array.
    - A colour apply on a hand-painted stroke (no `anchors` key) returns 1, updates both entry colour slots, and the stored stroke still has no `anchors` own key.
    - A same-colour apply (patch colour === stroke colour) on a stroke with explicit anchor colours returns 1, not 0; the revision bumps exactly once and the colours are cleared.
    - A params-only Size patch on a coloured-anchor stroke returns 1 for a real size change but leaves the stroke colour, the anchor array reference and every explicit anchor colour untouched; an identical params patch stays a 0 no-op.
    - A mixed batch (one coloured-anchor vector stroke + one hand-painted stroke) returns 2 with exactly one revision bump; both take the colour, only the vector's anchors changed.
  </behavior>
  <action>
`aquarelleRecordState.ts` — three edits, all inside the appearance batch's own scope. The whole policy is D-01: a colour apply REPLACES per-vertex colour.

(1) Add a module-local pure helper immediately ABOVE the `updateAquarelleStrokesInScript` doc comment (between the `AquarelleStrokeAppearancePatch` interface at 756 and the comment block at 758). Placement is load-bearing: the 261111-t74 Studio source pin slices the file from `export function updateAquarelleStrokesInScript(` to `export function updateAquarelleCurveModeInScript(`, and a helper inside that region would join the pinned text. Signature: one `AquarelleAnchor` in, `AquarelleAnchor` out; destructure `color` into a discarded `_color` binding and return the rest object — the shipped `withoutWidth` sparse-delete idiom (`vectorPathHandles.ts` 611-615), including the underscore name that keeps the unused binding legal. Doc comment: 261113-fkm — the inherited form of an anchor; a whole-stroke colour apply OWNS the stroke colour, so every explicit per-vertex colour is superseded and dropped in the SAME write; only anchors that carried a colour may reach this function.

(2) In the per-target resolution loop, right after the colour term at 856-857 (before `targetBrushId` / the overrides block), compute the target's anchor list: start `let nextAnchors` from `stroke.anchors`; when `hasColor` is true and the list is defined, map it — an anchor with `color === undefined` is returned as-is (the sparse no-colour case), an anchor with a colour is rebuilt through `withoutAnchorColor`; track whether anything was cleared and, only then, assign the mapped array and set `changed = true`. This is what makes a same-colour apply count: the colour term alone leaves `changed` false, the clear flips it. A `hasColor`-false patch must never enter this block — D-02: Size/params, brush, paint-seed flag and multiplier patches keep every anchor colour and keep the array reference. Do NOT pass the result through `projectVectorPath`: the store's anchors are already the projected canonical form (every path write goes through it), and a re-projection would clone every anchor, breaking the untouched-reference law.

(3) Extend the `targets` element type (831-839) and its pushed object (889-897) with `nextAnchors`, destructure it in the write loop (901-909), and add ONE conditional spread to `nextStroke` after the existing `toolOverrides` spread (913-921): when `nextAnchors === stroke.anchors` add nothing, otherwise add `{ anchors: nextAnchors }`. Identity is the signal — an untouched list is neither rewritten nor cloned, and a stroke with no anchors never gains the key. Keep exactly ONE `bumpAquarelleStrokesRevision()` and ONE `payloadTimeline[index] =` in the region (the Studio pin counts both). Do not touch `toStudioStroke`'s call, the params/brush/overrides logic, or any other function in the file.

Extend the batch doc comment (758-778) with the new law: a patch carrying `color` is a WHOLE-STROKE colour and supersedes every explicit per-anchor colour, in the same write and therefore the same undo entry; a patch without a colour never touches the anchor list; the colour is never written INTO an anchor — only removed from it, so no canonicalisation or validation surface is added.

`aquarelleRecordState.appearanceColor.test.ts` — create the new file (`// @vitest-environment node`, header comment naming 261113-fkm and the D-01/D-02 laws, `beforeEach(resetAquarelleRecordState)`). Imports: `beforeEach, describe, expect, it` from vitest; `type AquarelleAnchor`, `type AquarellePayloadEvent`, `type AquarellePoint`, `type AquarelleStroke`, `isAquarelleDryEvent` from `@efxlab/efx-watercolor/payload`; `aquarelleStrokesRevision`, `getRecordedAquarellePayloadTimeline`, `getRecordedAquarelleStroke`, `recordAquarelleStroke`, `resetAquarelleRecordState`, `updateAquarelleStrokesInScript` from `./aquarelleRecordState`. Local fixtures in the sibling files' shape: `point(x, y)` returning `{ x, y, p: 1, tx: 0, ty: 0, tw: 0 }`; `stroke(mutationId, overrides)` returning `{ tool: 'brush', color: '#103c65', params: { size: 12 }, brushId: 'round', points: [point(0.05, 0.05), point(0.95, 0.95)], mutationId, timestamp: mutationId, playFrame: 900, ...overrides }` with an optional `anchors` field spread only when provided; a MIXED anchor list of four anchors — index 0 `{ x: 0.1, y: 0.5, kind: 'auto', color: '#ff0000' }`, index 1 `{ x: 0.35, y: 0.3, kind: 'auto' }` (the colourless anchor whose identity is asserted), index 2 `{ x: 0.6, y: 0.7, kind: 'bezier', in: { x: 0.5, y: 0.6 }, out: { x: 0.7, y: 0.8 }, width: 1.8 }` (handles + width survive), index 3 `{ x: 0.9, y: 0.4, kind: 'auto', color: '#103c65' }`; and `a COLOURLESS_ANCHORS` list with no colour on any anchor. Local `entryIndexOf` / `strokeEntryAt` helpers matching the shipped appearance tests. Do NOT give any fixture a `paintSeedSalt` param — the wrapper's seed re-roll must stay a no-op so revision counts are exact.

Write these tests (one concept each): (a) "a global colour clears every explicit anchor colour and re-projects the engine entry" — assert the new colour on stroke/entry/engine, anchors length and order, every anchor has no own `color` key (`Object.prototype.hasOwnProperty.call(anchor, 'color')` false), the bezier anchor's handles and `width: 1.8`, `entry.engine.anchors` deep-equal to the colourless projection, `entry.pts` / `cuisson` / `recordedOrder` equal to the pre-edit entry; (b) "keeps colourless anchors reference-identical" — the index-1 and index-2 anchors are `toBe` the pre-edit objects; then a second apply on a colourless-anchor stroke leaves `getRecordedAquarelleStroke(id)!.anchors` `toBe` the pre-edit array; (c) "a hand-painted stroke gains no anchors key" — colour apply returns 1, both entry colour slots updated, `hasOwnProperty('anchors')` false; (d) "a same-colour apply still stores the edit" — record a stroke whose `color` equals the patch colour with coloured anchors, expect 1 and `aquarelleStrokesRevision.value` + 1, colours cleared; (e) "a params-only Size patch never clears anchor colours" — `{ params: { size: 20 } }` returns 1, stroke colour and the anchor array reference unchanged, both explicit colours still present, and the identical params patch returns 0; (f) "a mixed batch writes both targets once" — vector + hand-painted, `updateAquarelleStrokesInScript([a, b], { color: '#2f6f3f' })` returns 2 with exactly +1 revision and only the vector's anchors changed.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
    <automated>pnpm --prefix app run typecheck</automated>
  </verify>
  <done>
    The new test file is green and proves the D-01 write policy at the batch layer: a colour apply drops every explicit anchor `color` while preserving geometry, handles, width factors and the reference identity of colourless anchors; the stroke/entry/engine take the new colour; a same-colour apply is no longer dropped; a params-only patch (D-02) never clears an anchor colour; a hand-painted stroke gains no key. The 261111-t74 Studio source pin and typecheck are green.
  </done>
</task>

<task type="auto">
  <name>Task 2: One undo restores the per-vertex colours (wrapper-level pin)</name>
  <files>
    app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
  </files>
  <action>
TEST-ONLY task: no production file changes. Because it adds no behaviour it must NOT produce a fabricated `feat` commit; record `is-behavior-adding: false` (and that the behavioural TDD gate therefore did not apply) in the SUMMARY, following the 61-14 precedent.

In `aquarelleStrokeSelection.test.ts`: (1) extend the local `stroke()` helper (146-172) with an optional `anchors?: readonly AquarelleAnchor[]` field, spread into the returned object only when provided (the shipped anchorless fixtures must keep their exact key set). (2) Inside the existing `261024-p5q watercolor appearance edits` describe (starts 595), after the shipped undo test (693-727), add ONE test: "a same-colour whole-stroke apply clears per-vertex colours as one undoable edit". Record id `9720` with `playFrame: 709`, `color: '#103c65'` and a coloured anchor fixture (at least two anchors: one with `color: '#ff0000'`, one colourless — do NOT add a `paintSeedSalt` param, so the wrapper's seed re-roll stays a no-op and the revision assertion is exact). Capture the pre-edit stroke object, the pre-edit timeline entry and `aquarelleStrokesRevision.value`. Then `const editId = beginAquarelleAppearanceEdit([9720], { color: '#103c65' })`: expect a non-null id (the same-colour case is an edit only because the anchor clear marks it changed), expect the revision + 1, expect the stored stroke to be a NEW object (`not.toBe(beforeStroke)`) whose anchors carry no colour, and expect the stroke/entry/engine colours to be `#103c65`. Then `restoreAquarelleEditSnapshot(editId!, 'undo')` returns non-null; `getRecordedAquarelleStroke(9720)` must be `toBe(beforeStroke)` — the exact pre-edit object, still carrying both explicit anchor colours — and `strokeEntryAt(getRecordedAquarellePayloadTimeline(), 9720)` must be `toBe(beforeEntry)`. Comment that this proves the clear rides the SAME batch that `beginAquarelleAppearanceEdit`'s before/after registry snapshot pair wraps, so ONE undo restores the per-vertex colours (D-01). Do not touch any other test in the file, and do not change `aquarelleStrokeSelection.ts`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts</automated>
    <automated>pnpm --prefix app run typecheck</automated>
  </verify>
  <done>
    The new wrapper test is green: a same-colour whole-stroke colour apply returns an edit id, bumps the revision once, clears the explicit anchor colours, and a single undo restores the exact pre-edit stroke object (coloured anchors) and timeline entry by reference. The whole file — including every shipped appearance, undo, filter and band test — stays green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| appearance patch → record store | An in-process UI patch (a colour string from the Color tab) crosses into the ONE batch. This change adds only key REMOVAL from an anchor list the store already owns; it writes no patch value into an anchor. |
| record store → persisted AQTL / `.mce` | The rebuilt anchors leave the store only through `toStudioStroke` → `projectVectorPath`. No wire field is added and `AQUARELLE_SCHEMA_VERSION` does not move; a cleared profile is the already-supported absent-colour state. |
| payload entry → re-bake engine | `resolveStrokeColors` turns a uniform colour profile into null, so the engine replays the stroke as one colour — the same path a never-coloured vector stroke already takes. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261113-fkm-01 | Tampering | Anchor clear in `updateAquarelleStrokesInScript` | low | mitigate | The clear walks the typed array the store already holds (every path write goes through `normaliseAquarelleAnchors`/`projectVectorPath`); it maps by identity and rebuilds only anchors with an own `color` key, never parsing raw input. A stroke with no anchors takes the shipped path unchanged. |
| T-261113-fkm-02 | Repudiation | Undo of the cleared colours | medium | mitigate | The clear lives inside the ONE batch that `beginAquarelleAppearanceEdit` wraps; `captureAquarelleStrokeRegistry` keeps the pre-edit stroke objects by reference and `applySnapshotContent` restores them, so one undo returns the per-vertex colours. Task 2 pins this at the wrapper layer. |
| T-261113-fkm-03 | Tampering | Data loss on a malformed or absent anchor list | low | mitigate | An absent list writes nothing (identity check keeps the key absent); an empty list clears nothing and the target is skipped unless the colour itself changed. The `anchors` key is never deleted, so geometry can never be dropped by a colour apply. |
| T-261113-fkm-SC | Tampering | npm/pip/cargo installs | high | mitigate | Not applicable — no package is added, upgraded or installed and no dependency edge changes. |
</threat_model>

<verification>
Automated (cwd = repo root; `vitest run` only, never watch):
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.appearanceColor.test.ts` (new batch pins)
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` (the one-edit/undo pin plus every shipped appearance, filter, band and delete test)
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` (the 261111-t74 write-region pin: exactly one bump, one timeline write, one neutral constant, one `toolOverrides` spread)
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.path.test.ts` (regression: the anchor write path is untouched)
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleRecordState.reopenAnchorColor.test.ts` (regression: the AQTL v2 colour round trip is untouched)
- `pnpm --prefix app run typecheck`

Scope checks (diff-scoped observations, not pre-baked counts):
- `git diff --name-only` lists exactly the three paths in `files_modified`; `PhysicsPaintStudio.tsx`, `aquarelleStrokeSelection.ts`, `vectorPathHandles.ts`, `packages/efx-watercolor/**`, `app/package.json` and `pnpm-lock.yaml` are unchanged.
- `git diff -U0 app/src/components/physic-paint/view/aquarelleRecordState.ts` shows exactly: the `withoutAnchorColor` helper above the doc comment, the doc-comment extension, the anchor-clear block in the target loop, the `nextAnchors` target field/push, and the one conditional `anchors` spread in `nextStroke`. No other statement moves.
- The file still contains one `bumpAquarelleStrokesRevision()` call inside the `updateAquarelleStrokesInScript` region and one `payloadTimeline[index] =` — check by reading the diff, not by a bare count gate.
- No new stored field, no codec or `AQUARELLE_SCHEMA_VERSION` edit, no new signal, no new effect, no DOM, no new dependency.

Native UAT rows (the user's side — do not claim these from CI):
1. A vector stroke carrying per-vertex colours: re-enter path edit, select NO vertex, open the Color tab and pick a new colour. The whole stroke takes that colour and the old per-vertex variation is gone.
2. Leave the path edit and re-enter it (or force a replay): the stroke keeps the new global colour — no per-vertex colour comes back. Save, close the project and reopen: the global colour still holds and no per-vertex colour returns.
3. In the same path edit, select one or two vertices and pick a different colour: those vertices take a per-vertex colour again (the anchor-selection path is the user's "except if I ask").
4. Undo ONCE right after the global colour apply: the previous per-vertex colours are back in one step; redo re-applies the global colour.
5. A whole-stroke Size apply on a stroke that carries per-vertex size factors AND per-vertex colours leaves both untouched — only the base size changes.
6. Apply a colour to a mixed selection (a coloured vector stroke plus a hand-painted stroke): both take the colour; the hand-painted stroke is otherwise unchanged.
</verification>

<success_criteria>
- A whole-stroke colour apply clears every explicit anchor `color` in the SAME edit (D-01), keeps the path's geometry/handles/width factors, and the new colour renders and survives a path-edit re-bake.
- Colourless anchors stay reference-identical; a hand-painted stroke gains no `anchors` key; a stroke with no anchors behaves exactly as before.
- A same-colour apply on a coloured-anchor stroke is an edit (returns 1, one revision bump), not a dropped no-op.
- A non-colour patch (Size/params, brush, seed flag, multipliers) never clears an anchor colour (D-02); no Size code path changed.
- One undo restores the pre-edit stroke object and its explicit anchor colours by reference through the existing snapshot pair.
- No new stored field, no format-version change, no UI, no Studio routing change, no dependency; every automated command above is green and the six native UAT rows are handed to the user rather than claimed.
</success_criteria>

<output>
Create `.planning/quick/261113-fkm-vector-paint-global-colour-apply-replace/261113-fkm-SUMMARY.md` when done
</output>
