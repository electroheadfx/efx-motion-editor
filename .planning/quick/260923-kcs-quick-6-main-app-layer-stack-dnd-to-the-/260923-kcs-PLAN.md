---
phase: quick-260923-kcs
plan: 260923-kcs
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/fxReorder.ts
  - app/src/lib/fxReorder.test.ts
  - app/src/lib/frameMap.ts
  - app/src/lib/frameMap.test.ts
  - app/src/components/timeline/TimelineInteraction.ts
  - app/src/components/timeline/TimelineInteraction.test.ts
  - app/src/components/timeline/TimelineCanvas.tsx
  - app/src/components/timeline/AddFxMenu.tsx
  - app/src/stores/sequenceStore.ts
  - app/src/stores/sequenceStore.test.ts
  - app/src/stores/timelineStore.ts
autonomous: true
requirements: []
estimate:
  tokens: 30000
  raw_tokens: 15000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A DnD gesture whose pointer lands past the last FX/Layer stack row commits a reorder that places the dragged stack in the final bottom slot in one gesture."
    - "Every stack's displayed header label equals that stack's own stored name, before and after ANY reorder — no positional renumbering exists anywhere in the stack headers."
    - "Every sequence created from the + Layer menu lands at the TOP of the stack and carries the smallest unused 'Layer N' name; existing stacks keep their names when a new one is added."
    - "Double-clicking a stack name opens an inline editor on that name; the committed name survives a subsequent reorder and a save/reopen round-trip."
    - "FX header click-selection, the visibility dot toggle, layer deletion, and the LeftPanel LayerList delete/select controls behave exactly as before this quick."
  artifacts:
    - app/src/lib/fxReorder.ts
    - app/src/lib/fxReorder.test.ts
    - app/src/lib/frameMap.ts
    - app/src/lib/frameMap.test.ts
    - app/src/components/timeline/TimelineInteraction.ts
    - app/src/components/timeline/TimelineInteraction.test.ts
    - app/src/components/timeline/TimelineCanvas.tsx
    - app/src/components/timeline/AddFxMenu.tsx
    - app/src/stores/sequenceStore.ts
    - app/src/stores/sequenceStore.test.ts
    - app/src/stores/timelineStore.ts
  key_links:
    - "resolveFxReorderToIndex(dropIndex, fromIndex, trackCount) exported from fxReorder.ts ↔ TimelineInteraction pointerup FX-reorder commit site (replaces the inline length-1 clamp + adjust math)"
    - "fxTrackLayouts.headerLabel ↔ sequenceStore sequence.name as the single identity source (positional PPaint ordinal removed)"
    - "nextFreeLayerName(sequences) ↔ AddFxMenu handlers ↔ createFxSequence/createContentOverlaySequence position:'top' ↔ fxTrackLayouts array order (top of stack = first non-content sequence)"
    - "timelineStore.fxRenameEdit signal ↔ TimelineInteraction dblclick header hit-test ↔ TimelineCanvas inline input commit ↔ sequenceStore.rename"
---

<objective>
Fix the main-app timeline Layer/FX stack (SPECS/pre-53-small-quicks.md §7): (1) one-gesture DnD drop under the last row commits the reorder, (2) stack names are identity-stable through any reorder (kill the positional PPaint #N renumbering), (3) + Layer inserts at the TOP of the stack with the next free `Layer N` index instead of appending at the bottom with colliding fixed names, (4) inline double-click rename on the stack name — no dialog.

Purpose: today the FX reorder commit clamps the drop index to `length-1` BEFORE the removal-adjustment, so a downward drag can never land on the final bottom slot (max reachable toIndex when moving down = length-2) — the user must shuffle in multiple moves. Displayed headers renumber positionally (`PPaint #${++physicPaintOrdinal}` in frameMap, recomputed every render), so dragging stack 1 under 3 makes 1 show as 3, 2 as 1, 3 as 2 — names appear to reshuffle on every DnD. + Layer (TimelinePanel's AddLayerMenu/AddFxMenu) calls `createFxSequence` which pushes to the array END = bottom of the stack, with fixed names ('Paint', 'Physic Paint', 'Film Grain', …) that collide on repeat adds. FX sequences have no rename UI anywhere (SequenceList's inline rename filters `kind === 'content'`). Guardrails: naming law = identity not position; inline double-click only (no rename dialog); layer deletion and selection semantics untouched.

Output: RED-first failing pins committed before any production edit (drop-under-last commits; reorder never changes a stack's name; dbl-click rename persists; top-insert + next-free naming; rename rejects control chars), the GREEN wiring across fxReorder/frameMap/sequenceStore/AddFxMenu/TimelineInteraction/TimelineCanvas/timelineStore, and automated-ready status — native UAT (5 rows) remains the user's after GREEN.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

Grounding notes (verified at planning time — trust these, do not re-derive):

- SURFACE = timeline FX/Layer stack (canvas headers + the `Layer` menu), NOT the LeftPanel LayerList. Evidence: (a) the drop-under-last-row math bug is `TimelineInteraction.ts` pointerup FX-reorder commit (:1084-1097): `clampedDrop = Math.max(0, Math.min(dropFxIdx, fxTracks.length - 1))` (:1089) then `if (toIndex > fromIndex) toIndex -= 1` (:1091-1093) then `sequenceStore.reorderFxSequences(fromIndex, toIndex)` (:1096) — max downward toIndex = length-2, so a one-gesture drop past the last row is impossible; `fxDropIndexFromY` (:196-204) already returns up to `fxCount` (past-end insertion point) and the commit-site re-clamp destroys it. (b) The DnD auto-rename mechanism is `frameMap.ts:317` `let physicPaintOrdinal = 0` + `:332` `headerLabel: primaryLayer?.type === 'physic-paint' ? \`PPaint #${++physicPaintOrdinal}\` : seq.name` — recomputed from array order every render; dragging [A,B,C] to [B,C,A] relabels A #1→#3, B #2→#1, C #3→#2 — byte-for-byte the spec's "1 become 3, 2 become 1, 3 become 2". LayerList has NO rename-on-reorder mechanism (reorderLayers is a pure splice), and layerStore.add pushes to array end which displays at the TOP of LayerList (reversed) — so "+ Layer appends at bottom" is false for LayerList and true for the FX stack. (c) "+ Layer" = TimelinePanel.tsx:220-221 comment `{/* Add Layer */}` rendering `app/src/components/timeline/AddFxMenu.tsx` (exported as AddLayerMenu; button label "Layer" :169); LeftPanel's separate `app/src/components/layer/AddLayerMenu.tsx` is `+ Add` and is OUT of scope.
- Drop math fix (pure, unit-testable): insertion-point semantics — clamp dropIndex to [0, trackCount] (NOT length-1), then `toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex`, clamp to [0, trackCount-1]; caller skips when toIndex === fromIndex. Pins: resolveFxReorderToIndex(3,0,3)===2 (one-gesture bottom from top), (3,1,3)===2, (2,0,3)===1, (0,2,3)===0, (1,1,3)===1, (99,0,3)===2, (-1,0,3)===0.
- Identity labels: set `headerLabel: seq.name` unconditionally in fxTrackLayouts and DELETE the `physicPaintOrdinal` counter (:317, :332). Keep the `physicPaintVersion.value;` subscription at :316 (repaint dependency — harmless). `getTimelineFxHeaderLabel` (TimelineRenderer.ts:70-72, headerLabel ?? sequenceName) and the ghost-name draw keep working unchanged; TimelineRenderer.test.ts:35 passes its own object and is unaffected. `workflowLabel: 'PPaint #N'` in physicPaintBridge/launch context is a SEPARATE concept — do not touch.
- Existing test to REWRITE in GREEN (it pins the old positional law): `frameMap.test.ts:358-420` "renumbers only Physics Paint FX tracks after mixed-order reorder and deletion without changing sequence names" — expectations `headerLabel: 'PPaint #1'` etc. become `headerLabel === sequenceName` for every row in all three array arrangements. In RED, leave this test as-is (it passes at base) and ADD a new identity-pin describe; only in GREEN update its expectations.
- Naming + position: mirror `efxPaintStore._nextPaintTrackNumber` (:139-148 — smallest positive int not taken, regex-scoped `/^Paint (\d+)$/`). New exported helper in sequenceStore: `nextFreeLayerName(sequences)` using `/^Layer (\d+)$/`, returns `Layer ${n}` — [] → 'Layer 1'; [Layer 1, Layer 2, Layer 3] → 'Layer 4'; [Layer 1, Layer 3] → 'Layer 2'; ignores 'Film Grain'/'Sequence 3'. `createFxSequence` (:241-272, push-end at :255) gains `opts.position?: 'end' | 'top'` default `'end'` (ShaderBrowser.tsx:569 passes no opts → stays append, untouched). 'top' = insert at `all.findIndex(s => s.kind !== 'content')`, or `all.length` when none (FX-display order = non-content array order per fxTrackLayouts :320-323; inserting before first non-content puts it at the top of the rendered stack regardless of interleaved content sequences). `createContentOverlaySequence` (:274-301, push-end at :291): its ONLY callers are ImportedView's + Layer content-overlay/isolation branches — change it to insert top unconditionally (same index rule), no opts. Content-overlay names stay the filename (filename is unique identity; the colliding-names defect is the fixed menu strings).
- + Layer menu wiring: AddFxMenu `handleAddFxLayer` (:58-82), `handleAddPaintLayer` (:104-135, literal 'Paint'), `handleAddPhysicPaintLayer` (:137-161, literal 'Physic Paint') — each computes `const stackName = nextFreeLayerName(sequenceStore.sequences.peek())` and uses it for BOTH layer.name and the createFxSequence first arg, passing `{ position: 'top', inFrame, outFrame }` / `{ position: 'top' }`. `handleAddFxLayer` drops its `name: string` parameter (menu call sites :225, :232, :239, :246, :253, :264 pass type+blend only: `handleAddFxLayer('generator-grain', 'screen')` etc.; blend-less calls like `handleAddFxLayer('generator-vignette')` unchanged). Type identity stays visible via the menu color dot, layer.type, and the properties panel. Post-create selection (`layerStore.setSelected`, `uiStore.selectLayer`) stays EXACTLY as-is (selection guardrail). `handleAddContentLayer` (:84-92) untouched.
- Inline rename (FX name is drawn ON CANVAS at TimelineRenderer.drawFxTrack :635+ / name fillText ~:666 — needs a DOM overlay input, not an in-DOM span): mirror SequenceList's commit semantics (`startRename` :173-177, `commitRename` :179-186 trim + nonempty + changed → `sequenceStore.rename(seq.id, trimmed)`; input Enter→commit / Escape→cancel / onBlur→commit :316-333) but implement with signals only (project law — no useState). Pattern: `timelineStore.ts` signals (:11-18) gain `fxRenameEdit = signal<{ sequenceId: string; original: string; value: string; x: number; y: number; width: number; height: number } | null>(null)` exported on the store object. TimelineInteraction `attach`/`detach` (:85-111) register/remove `dblclick` alongside the existing listeners, matching the existing handler binding style of `handlePointerDown`. Dblclick handler: same hit-test family as the header pointerdown branch (:574-599) — `isInFxArea` (:176-184), `fxTrackIndexFromY` (:186-194), `localX >= 18 && localX < TRACK_HEADER_WIDTH` (x<18 is the visibility dot — rename starts only on the name area; the two pre-dblclick click cycles each start/end a reorder drag with fxReorderMoved=false → no reorder, selection idempotent → selection semantics unchanged). Compute viewport rect from `RULER_HEIGHT + fxIdx * FX_TRACK_HEIGHT - scrollY`, width `TRACK_HEADER_WIDTH - 18`, height `FX_TRACK_HEIGHT`; set the signal with `sequenceName` as original. TimelineCanvas renders an absolutely-positioned `<input>` when the signal is non-null (position relative to the canvas wrapper; RULER_HEIGHT=24, FX_TRACK_HEIGHT=28, TRACK_HEADER_WIDTH=80 exported from TimelineRenderer.ts:7-12): autoFocus, value from signal, onInput updates `value` (idempotent signal replace), Enter/blur → commit (trim; if nonempty && !== original → `sequenceStore.rename(sequenceId, trimmed)`; then clear signal), Escape → clear only. Redraw comes free: TimelineCanvas's effect subscribes `fxTrackLayouts.value` → rename mutates sequences → computed recomputes → redraw.
- Rename hardening (ASVS V5): `sequenceStore.rename` (:387-407) currently accepts any string. Add fail-closed control-char rejection with a LOCAL regex (duplicate of efxPaintStore.TRACK_NAME_CONTROL_CHAR :136 — `[\x00-\x1f\x7f]` — do NOT import from efxPaintStore, avoid cross-store coupling): if the raw name matches, return BEFORE snapshot/markDirty/pushAction (name unchanged, no undo entry). Empty/whitespace handling of existing callers (SequenceList trims + guards) stays unchanged — only add the control-char rejection. No length cap (canvas `truncateText` handles display; single-user local app — accepted).
- Persistence already exists: projectStore save serializes `name` for layers (:322-324) and sequences, load restores `ml.name`/`mceSeq` name (:506-510) — SequenceList renames persist today, so a renamed FX sequence's `seq.name` round-trips with NO projectStore change.
- Store reorder is already identity-safe: `reorderFxSequences` (:324-350) is a pure splice that never touches `name` — the reshuffle was display-only (frameMap). The store-level rename→reorder→name-unchanged test passes at base: include it as a CONTROL leg (green at base AND after GREEN), matching the sibling plan's control-test pattern.
- RED evidence + commits: sibling precedent `.planning/quick/260923-fhn-…/260923-fhn-RED-EVIDENCE.json` + `gsd_run check tdd-red-evidence <record.json>` → `RED_EVIDENCE_OK`. Commit scopes: `test(quick-260923-kcs): …` for the RED commit, `feat(quick-260923-kcs): …` for GREEN (fhn: f335be71 → cfa928f2; i17 same shape).
- Tests: vitest collects ONLY `src/**/*.test.ts` (vitest.config.ts:5 — a .tsx target exits 0 running nothing; never author .test.tsx). Run `pnpm --filter efx-motion-editor exec vitest run <files>` (paths relative to the app package, e.g. `src/lib/fxReorder.test.ts`). Types: `pnpm --filter efx-motion-editor run typecheck` (script = `tsc --noEmit`). Do NOT start the dev server (CLAUDE.md). pnpm, not npm.
- Source-shape pins in TimelineInteraction.test.ts / TimelineCanvas (both already readFileSync'd at :4-5) must quote the EXACT literals the GREEN code will contain: `addEventListener('dblclick'`, `resolveFxReorderToIndex(`, `fxRenameEdit`, `sequenceStore.rename(`, and NOT-contain `Math.min(dropFxIdx, fxTracks.length - 1)`.
- OUT OF SCOPE (do not touch): LeftPanel LayerList + layer/AddLayerMenu (no rename UI there — not requested), SequenceList, StrokeList positional labels, `Sequence ${sequences.length + 1}` naming, ShaderBrowser createFxSequence naming/position, physicPaintBridge `workflowLabel` PPaint labels, layer deletion code (`layerStore.remove` / `removeLayerFromSequence`), the pointerdown selection branch, the visibility-dot toggle.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — pin one-gesture bottom drop, identity labels, top-insert + next-free naming, inline dbl-click rename</name>
  <files>app/src/lib/fxReorder.test.ts, app/src/lib/frameMap.test.ts, app/src/stores/sequenceStore.test.ts, app/src/components/timeline/TimelineInteraction.test.ts</files>
  <behavior>
    - fxReorder.test.ts (RED — module does not exist, import fails): `resolveFxReorderToIndex(3, 0, 3) === 2` — a drop past the last row (dropIndex=trackCount) from the top commits the dragged stack into the FINAL bottom slot (one gesture, spec defect 1); `resolveFxReorderToIndex(3, 1, 3) === 2` — same from the middle; `resolveFxReorderToIndex(2, 0, 3) === 1` — drop onto the boundary above the last row lands one above the end; `resolveFxReorderToIndex(0, 2, 3) === 0` — upward drop to top; `resolveFxReorderToIndex(1, 1, 3) === 1` — drop on own index is identity (caller no-ops); `resolveFxReorderToIndex(99, 0, 3) === 2` and `resolveFxReorderToIndex(-1, 0, 3) === 0` — out-of-range inputs clamp.
    - frameMap.test.ts NEW describe (RED at base): seed two physic-paint FX sequences 'Physics A'/'Physics B' plus one grain sequence; assert every fxTrackLayouts row has `headerLabel === sequenceName`; REVERSE the sequences array; assert each sequenceId STILL carries its own name as headerLabel (at base the physic rows renumber to PPaint #1/#2 → fails); DELETE the first physic sequence; assert the survivor's headerLabel is unchanged (at base it shifts PPaint #2→#1 → fails).
    - sequenceStore.test.ts (RED at base): `nextFreeLayerName([]) === 'Layer 1'`; `nextFreeLayerName` over names ['Layer 1','Layer 2','Layer 3'] === 'Layer 4' (spec example); over ['Layer 1','Layer 3'] === 'Layer 2' (first FREE, not max+1 — mirrors _nextPaintTrackNumber); over ['Film Grain','Sequence 3'] === 'Layer 1' (non-matching names do not consume indices). RED: helper does not exist.
    - sequenceStore.test.ts (RED at base): `createFxSequence(..., { position: 'top' })` with an existing FX sequence present → `getOverlaySequences()[0]` is the NEW sequence (top of stack); at base the opts.position key is ignored and it appends last → fails.
    - sequenceStore.test.ts (RED at base): with an existing FX sequence, `createContentOverlaySequence(...)` → the new overlay is `getOverlaySequences()[0]`; at base it appends last → fails.
    - sequenceStore.test.ts (RED at base): `rename(id, 'bad\x07name')` leaves `sequences` name unchanged (control-char rejection is fail-closed, no undo entry pushed); at base rename accepts it → fails.
    - sequenceStore.test.ts CONTROL (passes at base AND after GREEN): `rename(id, 'Renamed')` then `reorderFxSequences(...)` → the renamed sequence still reads 'Renamed' (store-level reorder never touches name — pins the identity law at the store boundary).
    - TimelineInteraction.test.ts source-shape (RED at base, both files already readFileSync'd): interaction source CONTAINS `addEventListener('dblclick'`, `resolveFxReorderToIndex(`, `fxRenameEdit`, `sequenceStore.rename(`; interaction source NOT contains `Math.min(dropFxIdx, fxTracks.length - 1)`; canvas source (TimelineCanvas.tsx) CONTAINS `fxRenameEdit` and `sequenceStore.rename(`. At base: no dblclick listener, no resolver, no rename call, old clamp still present, canvas has no rename wiring → all fail.
  </behavior>
  <action>Create the four test files/additions ONLY — no production edits in this task. Author fxReorder.test.ts as a fresh file importing `resolveFxReorderToIndex` from './fxReorder'. Append new describes to frameMap.test.ts (do NOT modify the existing renumber test at :358 yet — it must stay green at base), sequenceStore.test.ts (use the file's existing store-reset/fixtures style; create FX sequences via `sequenceStore.createFxSequence` with real Layer-shaped records like the existing factory tests), and TimelineInteraction.test.ts (extend the existing readFileSync source-shape style; the `interaction` and `canvas` constants already exist at :4-5). Write every pin listed in <behavior> with the EXACT literals quoted there — Task 2/3 GREEN code must contain those same literals. Run the RED command, capture the failure output as RED evidence (sibling pattern: `.planning/quick/260923-kcs-…/260923-kcs-RED-EVIDENCE.json`, validate with `gsd_run check tdd-red-evidence`), and commit ONLY the test files as `test(quick-260923-kcs): pin layer-stack bottom drop, identity names, top insert, inline rename`.
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/fxReorder.test.ts src/lib/frameMap.test.ts src/stores/sequenceStore.test.ts src/components/timeline/TimelineInteraction.test.ts</automated>
  </verify>
  <done>RED commit exists containing only test files; every new pin fails at base with the expected assertion/import error (fxReorder module missing, PPaint renumber mismatches, append-end mismatches, rename-accepts-control-char, missing source tokens); the pre-existing frameMap renumber test still passes at base; `gsd_run check tdd-red-evidence` reports RED_EVIDENCE_OK.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — one-gesture bottom drop, identity header labels, top-insert + next-free Layer N naming, rename control-char guard</name>
  <files>app/src/lib/fxReorder.ts, app/src/components/timeline/TimelineInteraction.ts, app/src/lib/frameMap.ts, app/src/lib/frameMap.test.ts, app/src/stores/sequenceStore.ts, app/src/components/timeline/AddFxMenu.tsx</files>
  <behavior>
    - resolveFxReorderToIndex implements insertion-point semantics: clamp dropIndex to [0, trackCount]; toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex; clamp to [0, trackCount-1] — satisfies every numeric pin from Task 1.
    - fxTrackLayouts.headerLabel === seq.name for every non-content sequence, in ANY array order, before/after reorder and deletion — the positional PPaint ordinal no longer exists (grep `physicPaintOrdinal` in frameMap.ts returns nothing).
    - nextFreeLayerName returns the first unused `Layer N` per the Task 1 cases; createFxSequence honors position:'top' by inserting before the first non-content sequence (or at array end when none); createContentOverlaySequence always inserts top; ShaderBrowser's opts-less createFxSequence call still appends (default 'end').
    - Every AddFxMenu FX/paint/physic creation uses nextFreeLayerName for layer.name AND sequence name, passes position:'top' (preserving isolation inFrame/outFrame opts), and still calls layerStore.setSelected + uiStore.selectLayer after create.
    - sequenceStore.rename rejects names matching the local control-char regex by returning before any state change (sequences value, dirty flag, and undo stack all untouched).
    - The existing frameMap renumber test (:358-420) is REWRITTEN to the identity law (headerLabel === sequenceName in all three arrangements) and passes; all Task 1 pins pass; no OTHER pre-existing test regresses.
  </behavior>
  <action>Implement in dependency order. (1) Create `app/src/lib/fxReorder.ts` exporting `resolveFxReorderToIndex(dropIndex: number, fromIndex: number, trackCount: number): number` exactly per the clamp/adjust/clamp semantics above (zero imports — pure). (2) In TimelineInteraction.ts pointerup FX-reorder block (:1084-1097), replace the inline `clampedDrop`/`toIndex -= 1` math with `const toIndex = resolveFxReorderToIndex(dropFxIdx, fromIndex, fxTracks.length); if (toIndex !== fromIndex) { sequenceStore.reorderFxSequences(fromIndex, toIndex); }` — import the resolver; delete the `Math.min(dropFxIdx, fxTracks.length - 1)` expression entirely (the source-shape pin NOT-contains must hold). Leave fxDropIndexFromY, the move-time setFxDragState, selection, and visibility branches untouched. (3) In frameMap.ts fxTrackLayouts: delete `let physicPaintOrdinal = 0` (:317) and change :332 to `headerLabel: seq.name,` — KEEP the `physicPaintVersion.value;` subscription (:316). (4) Rewrite frameMap.test.ts:358-420 expectations: every row's headerLabel equals its sequenceName in all three array arrangements; retitle the test to the identity law (e.g. "keeps Physics Paint FX header labels identity-stable across reorder and deletion"). (5) In sequenceStore.ts: export `nextFreeLayerName(sequences: ReadonlyArray<{name: string}>): string` (regex `/^Layer (\d+)$/`, first free positive int, `Layer ${n}`); add a module-local `const SEQUENCE_NAME_CONTROL_CHAR = /[\x00-\x1f\x7f]/;` and at the TOP of `rename` add `if (SEQUENCE_NAME_CONTROL_CHAR.test(name)) return;` before `const before = snapshot()` (fail-closed, no dirty, no undo entry); extend `createFxSequence` opts with `position?: 'end' | 'top'` defaulting `'end'` and replace the push at :255 with: build `seq` as today, then if position==='top' compute `const idx = sequences.value.findIndex(s => s.kind !== 'content'); sequences.value = idx === -1 ? [...sequences.value, seq] : [...sequences.value.slice(0, idx), seq, ...sequences.value.slice(idx)];` else keep `[...sequences.value, seq]`; in `createContentOverlaySequence` apply the SAME top-insert unconditionally (replace the push at :291; its only callers are the + Layer content flow). Keep markDirty/pushAction/undo structure identical in both creators. (6) In AddFxMenu.tsx: import `nextFreeLayerName` from sequenceStore; in `handleAddFxLayer`, `handleAddPaintLayer`, `handleAddPhysicPaintLayer` compute `const stackName = nextFreeLayerName(sequenceStore.sequences.peek());` use it as fxLayer/paintLayer/physicPaintLayer `.name` and as the createFxSequence first argument, and pass `{ position: 'top', inFrame: isolatedInFrame, outFrame: isolatedOutFrame }` / `{ position: 'top' }` (isolation behavior preserved); remove the `name: string` parameter from `handleAddFxLayer` and update its six menu call sites to pass type + optional blend only; DO NOT touch handleAddContentLayer, the menu markup, or the post-create selection calls. Do not modify ShaderBrowser. Run the GREEN command + typecheck; commit as `feat(quick-260923-kcs): identity stack names, one-gesture bottom drop, top insert with next free index`.
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/fxReorder.test.ts src/lib/frameMap.test.ts src/stores/sequenceStore.test.ts src/components/timeline/TimelineInteraction.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All four test files pass: resolver pins green, frameMap identity pins green, rewritten renumber test green, next-free/top-insert/control-char/rename-reorder pins green, source-shape pins (resolver used, old clamp absent) green. Typecheck passes. `grep -c physicPaintOrdinal app/src/lib/frameMap.ts` filtered of comments is 0. ShaderBrowser still compiles against the defaulted opts. No file outside the task's `<files>` is modified.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: GREEN — inline double-click rename on the FX stack header (canvas overlay input)</name>
  <files>app/src/stores/timelineStore.ts, app/src/components/timeline/TimelineInteraction.ts, app/src/components/timeline/TimelineCanvas.tsx</files>
  <behavior>
    - Double-clicking the name area of an FX header (x >= 18 and x < TRACK_HEADER_WIDTH within an FX row) opens an inline text input positioned over that header — no modal, no dialog, no route change.
    - Enter or blur commits: trimmed non-empty value different from `original` → sequenceStore.rename(sequenceId, trimmed); the timeline header redraws showing the new name (fxTrackLayouts recompute).
    - Escape cancels: signal cleared, sequenceStore.rename never called, name unchanged.
    - Double-click on the visibility dot (x < 18) or outside the header name area does NOT open the editor.
    - The editor's committed name is the Task 2 identity name — it survives a subsequent reorderFxSequences and a save/reopen (seq.name round-trip already in projectStore) — and control-char input is rejected fail-closed by sequenceStore.rename.
    - Click-selection on pointerdown and the visibility-dot toggle behave exactly as before (the two pre-dblclick click cycles are idempotent: each starts/ends a reorder drag with fxReorderMoved=false → no reorder commit).
  </behavior>
  <action>Wire the rename signal → hit-test → overlay input path with signals only. (1) timelineStore.ts: add `const fxRenameEdit = signal<{ sequenceId: string; original: string; value: string; x: number; y: number; width: number; height: number } | null>(null);` alongside the existing signals (:11-18) and export it on the `timelineStore` object. (2) TimelineInteraction.ts: in `attach` (:85-96) add `canvas.addEventListener('dblclick', this.handleDoubleClick);` and the matching removal in `detach` — bind with the SAME style used for handlePointerDown (if those are class-property arrow functions, make handleDoubleClick an arrow property too). Implement `private handleDoubleClick = (e: MouseEvent) => { … }`: primary button only; reuse `isInFxArea(e.clientY)` + `fxTrackIndexFromY(e.clientY)` bounds; compute `localX = e.clientX - rect.left`; when `localX >= 18 && localX < TRACK_HEADER_WIDTH` and the index is valid, read `fxTrackLayouts.peek()[fxIdx]`, compute viewport coordinates `y = RULER_HEIGHT + fxIdx * FX_TRACK_HEIGHT - renderer.getScrollY()`, `x = 18`, `width = TRACK_HEADER_WIDTH - 18`, `height = FX_TRACK_HEIGHT`, then `timelineStore.fxRenameEdit.value = { sequenceId, original: sequenceName, value: sequenceName, x, y, width, height }` and `e.preventDefault()`; otherwise do nothing (dot area / outside header). This must satisfy the source-shape pins: the file contains `addEventListener('dblclick'`, `fxRenameEdit`, and (from the commit path) `sequenceStore.rename(` — if the commit lives only in TimelineCanvas, ALSO reference `sequenceStore.rename` nowhere it isn't; keep the Task 1 pins' exact literals: interaction contains all three tokens, canvas contains `fxRenameEdit` AND `sequenceStore.rename(`. (3) TimelineCanvas.tsx: in the component's return, when `timelineStore.fxRenameEdit.value` is non-null render an `<input type="text">` absolutely positioned inside the same positioned ancestor as the canvas at `left: edit.x, top: edit.y, width: edit.width, height: edit.height` (match the header's font size ~9px, system-ui, background/border consistent with the timeline header palette), `autoFocus`, `value={edit.value}`, `onInput` → replace the signal object's `value` (fresh object, idempotent), `onKeyDown`: Enter → commit, Escape → set signal to null (no rename), `onBlur` → commit. Commit = `const trimmed = edit.value.trim(); if (trimmed && trimmed !== edit.original) sequenceStore.rename(edit.sequenceId, trimmed); timelineStore.fxRenameEdit.value = null;`. Do not add any dialog/modal component, do not use useState/useEffect for this state, and do not touch the pointerdown selection or visibility-dot branches. Redraw is automatic via the existing effect subscribing `fxTrackLayouts.value`. Run the verify command + typecheck; commit as `feat(quick-260923-kcs): inline double-click rename on FX stack headers`.
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/timeline/TimelineInteraction.test.ts src/lib/fxReorder.test.ts src/lib/frameMap.test.ts src/stores/sequenceStore.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All Task 1 source-shape pins pass (interaction contains `addEventListener('dblclick'`, `fxRenameEdit`, `sequenceStore.rename(`; canvas contains `fxRenameEdit` and `sequenceStore.rename(`; old clamp absent) together with all resolver/frameMap/store pins; typecheck passes; the rename flow is signal-driven (fxRenameEdit) with Enter/Escape/blur commit semantics mirroring SequenceList; no dialog/modal code exists in TimelineCanvas or TimelineInteraction; files outside `<files>` for this task are unmodified except none.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User keystrokes → sequenceStore.rename → project JSON on disk | The inline rename input is untrusted text that becomes a persisted sequence name |
| Pointer events → TimelineInteraction (canvas) | Untrusted coordinates drive hit-testing and reorder commits |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-kcs-01 | Tampering | sequenceStore.rename / FX inline rename input | medium | mitigate | Fail-closed control-char rejection (`[\x00-\x1f\x7f]`) in `sequenceStore.rename` before snapshot/dirty/undo (ASVS V5 pattern, mirrors efxPaintStore TRACK_NAME_CONTROL_CHAR); UI additionally trims and rejects empty/no-change commits |
| T-kcs-02 | Tampering | persisted sequence name rendered in canvas + sidebar | low | accept | Names are rendered only via canvas `fillText` and Preact text children (auto-escaped) — no HTML interpolation or path use; single-user local desktop app |
| T-kcs-03 | Repudiation | rename and reorder mutations | low | accept | Both already push timestamped undo/redo actions through the existing pushAction machinery; control-char rejections intentionally leave no undo entry (nothing changed) |
| T-kcs-04 | DoS | extremely long double-click rename input | low | accept | Local single-user input; display is bounded by the renderer's existing `truncateText` on the header; no length cap added (pre-existing SequenceList behavior unchanged) |
| T-kcs-05 | Elevation of Privilege | n/a — no auth or privilege boundary in this quick | low | accept | Renderer-only change within the already-privileged local app window |
| T-kcs-SC | Tampering | npm/pip/cargo installs | high | mitigate | NO package installs and NO new dependencies in this quick — pure TS refactors of existing files; if any install is ever introduced, stop and run the package-legitimacy gate with a blocking human checkpoint |
</threat_model>

<verification>
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` (all green, zero regressions).
- Typecheck: `pnpm --filter efx-motion-editor run typecheck`.
- RED evidence validated before GREEN: `gsd_run check tdd-red-evidence` on the Task 1 record → RED_EVIDENCE_OK.
- Source laws: `physicPaintOrdinal` absent from frameMap.ts; `Math.min(dropFxIdx, fxTracks.length - 1)` absent from TimelineInteraction.ts; `resolveFxReorderToIndex(` present; `addEventListener('dblclick'` present; ShaderBrowser createFxSequence call unchanged.
- Automated-ready only — native UAT (5 rows) is the user's after GREEN: (1) three stacks [1][2][3] → drag 1 under 3 in ONE gesture → [2][3][1] with names still Layer 2 / Layer 3 / Layer 1; (2) drag back to any order → names never reshuffle; (3) + Layer → lands on top, named with the next free index; (4) double-click a name → edit → sticks across reorder + save/reopen; (5) delete and select regression unchanged.
</verification>

<success_criteria>
- Every must_have truth is demonstrably true: one-gesture bottom drop (resolver pins + live UAT row 1), identity labels (frameMap pins + UAT row 2), top insert + next free index (store/menu pins + UAT row 3), inline rename persistence (source pins + store control + UAT row 4), unchanged delete/select (no touched files in those paths + UAT row 5).
- All four RED-pinned test files green, full vitest suite green, typecheck green.
- GREEN commits land as `feat(quick-260923-kcs): …` after a clean `test(quick-260923-kcs): …` RED commit; no files outside the declared `files_modified` list change.
</success_criteria>

<output>
Create `.planning/quick/260923-kcs-quick-6-main-app-layer-stack-dnd-to-the-/260923-kcs-SUMMARY.md` when done.
</output>
