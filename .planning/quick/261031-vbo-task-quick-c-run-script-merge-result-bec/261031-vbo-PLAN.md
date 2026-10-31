---
phase: 261031-vbo-task-quick-c-run-script-merge-result-bec
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
autonomous: true
requirements: [QUICK-261031-VBO]
user_setup: []

estimate:
  tokens: 63000
  raw_tokens: 50000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Any destination rail (Motion, Static, Reveal, or already Standard) that receives a Motion or Static run commits ONE Standard Rail: the target's cached picture and cycle/repeat options survive, the run composites over them, and the same atomic commit drops scriptId, motion, overrideColor, railKind and every reveal knob (colorize, colorizeMix, photoWiggle)."
    - "A merged rail presents as 'Standard Rail' with a neutral gray line in both rail hosts, 'Type: Standard' in its tooltip, 'Standard' as its Rail Type, no typed identity and no lifecycle dot; typed rails keep their purple (#8b5cf6), cyan (#06b6d4) and blue (#69BBC8) lines and their Motion/Static/Reveal labels unchanged."
    - "Regenerate and Replay are unavailable on a merged rail with an explicit merged-rail reason; per-key script editing, normal key editing and cycle/repeat editing remain available."
    - "The incoming run's Rail Type (Motion/Static) shapes only that run's bake; it never converts the rail, and the required mode field keeps the destination's stored value."
    - "One undo restores the pre-merge typed rail exactly (provenance, motion, color, reveal knobs), and save then reopen keeps the Standard Rail, its picture and its blend."
    - "No persisted schema or format change: a provenance-free, railKind-free Loop Clip with the six lifecycle members round-trips through the existing parser and fingerprint."
  artifacts:
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts"
      provides: "buildStandardStackedLoopClip whitelist projection, isStandardMergedLoopClip, the three merged-rail copy constants"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      provides: "confirmStack commits the whitelist record; groupRegenerateReason merged gate placed before the lifecycle-shape check; reveal-knob omit helper deleted"
    - path: "app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts"
      provides: "'standard' lifecycle member, Standard labels/source label, merged status/regenerate/replay copy, no dot"
    - path: "app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts"
      provides: "RotoRailKind extended with 'standard', classifyLoopClipRailKind, 'Standard' rail label"
    - path: "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx"
      provides: "rail-kind-standard class on the active-lane rail"
    - path: "app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx"
      provides: "rail-kind-standard class and Standard aria label on non-active rows"
    - path: "app/src/components/physic-paint/physicsPaintStudio.css"
      provides: "gray Standard rail block mirroring the reveal block's specificity"
  key_links:
    - "confirmStack -> buildStandardStackedLoopClip: the publication carries a freshly built whitelist record, never a spread of the destination record."
    - "presentation -> classifyLoopClipRailKind: one classifier decides 'standard' for both the active lane (LoopClipRail) and the non-active rows (TrackRow)."
    - "controller regenerate gate -> STANDARD_RAIL_REGENERATE_REASON: the same constant the presentation renders, so the toolbar refusal and the tooltip never diverge."
    - "rail hosts -> CSS: .rail-kind-standard.mode-* out-specifies .selected/.unresolved, so the standard block must restate selected, unresolved and action-linked exactly like the reveal block."
---

<objective>
Make a Run Script stack produce a Standard Rail (Quick C1): any destination rail that receives a Motion or Static run becomes one flat Standard Rail — the target's cached frames and animation preserved, the run composited over them, and single-script provenance plus reveal identity dropped in the same atomic commit — presented honestly as a gray "Standard Rail" with Regenerate and Replay unavailable.

Purpose: live UAT showed the old merge silently converted the destination's type (a Motion rail + Static run became Static and lost the first rail's motion) while keeping a single-script provenance, so Regenerate could wipe the blend. The user locked the new model: a stack is a merge of results, not a rail type.

Output: a whitelist merge projection, a `standard` presentation lifecycle wired through the active lane and the non-active rows with a gray rail line, Regenerate/Replay gating, and intent pins for undo, cycle retention, Keep ON/OFF and save/reopen.

Scope note: this quick plans C1 only (Standard merge result + gray presentation + Motion/Static incoming type). Reveal incoming on a non-Reveal destination and the document-reference routing/refusal are C2 and must not be implemented here. No persisted schema/format change: a Standard Rail is a playscript Loop Clip with absent provenance, which the parser already accepts. The tracer below intentionally spans the merge -> presentation -> rail-color layers because a stack result is not observable until all three agree; each expansion task after it stays inside one subsystem.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-CONTEXT.md
@.planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-RESEARCH.md
@.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-CONTEXT.md
@.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-SUMMARY.md
@.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-CONTEXT.md
@.planning/quick/261031-qps-task-quick-b-follow-up-to-quick-261031-i/261031-qps-SUMMARY.md
@.planning/STATE.md

Locked decisions from CONTEXT.md (do not revisit): the merge result is a Standard Rail; the target's picture and cycle options survive; the run's type shapes only its own bake; provenance and reveal identity are dropped in the same atomic commit; the required `mode` field keeps the destination's stored value; gray line with typed colors unchanged; Regenerate and Replay unavailable with a merged-rail reason; Quick A/B collision, extend-only, repeat-unchanged, Keep and atomic-undo laws still hold; no persisted schema change (STOP and report if a stored field proves unavoidable).

Anchors (verified at HEAD):
- `physicsPaintRotoPlayScriptController.ts`: `stackRailKind` 1089-1092; `keepScript`/`seedKeepScript` 1097-1139; stack seeding 1408-1447; `isRegenerableLifecycleShape` 1538-1548; `groupRegenerateReason` 1585-1606 (busy guard first, then shape, then syncState, then provenance); `confirmStack` reveal gate 2392-2409; Keep 2x2 2411-2427; render mode/motion resolution 2437-2451; adoption site 2512-2525; slices/CR-01 2537-2545; reveal tail 2547-2588; union/pixel composite 2589-2616; recording 2620-2640; summary/complete 2641-2657; `omitStoredRevealKnobs` 3707-3718.
- `physicsPaintRotoRunScriptStacking.ts`: `RunScriptStackLifecycle` 119-122 (`Pick<...six lifecycle members>`), `RunScriptStackLifecyclePlan` 133-136, `RUN_SCRIPT_KEEP_SCRIPT_DEFAULT` 145, `RUN_SCRIPT_OVERWRITE_COPY` 148 (precedent for copy constants in this module).
- `physicsPaintLoopClipPresentation.ts`: lifecycle union 4-9; `PhysicsPaintGroupSynchronizationDot` 11; presentation fields 52-100; projection 111-233 (`modeLabel`/`groupTypeLabel` 130-135, `lifecycle` 136, dot 138, `railKind`/`isReveal` 146-147, `overrideColor` 148-150, `freshnessLine` 154, `replayDisabledReason` 155-157, `sourceLabel` 206, tooltip `Type:` line 186); `resolveGroupLifecycle` 296-308; `statusLabelFor` 310-318; `regenerateDisabledReasonFor` 320-328; `replayDisabledReasonFor` 338-352.
- `physicsPaintWorkflowPresentation.ts`: `RotoRailKind` 24, `classifyRotoRailKind` 27-29, `isRevealRotoRail` 32-34, `getRotoRailKindLabel` 37-39; imports the `PhysicPaintRotoLoopClip` type at line 3; does NOT import `physicsPaintLoopClipPresentation.ts` (no cycle when the presentation imports it back).
- `PhysicsPaintTrackRow.tsx`: `TrackRowLoopLine.railKind: RotoRailKind` 219; line build 326-338 (`railKind: classifyRotoRailKind(clip?.railKind)`); class template 671; aria 677.
- `PhysicsPaintLoopClipRail.tsx`: `isReveal`/`railColor` 195-207; class template 338.
- `physicsPaintStudio.css`: base/mode/hover/selected/unresolved 4299-4326; reveal block 4335-4373 (restates hover, selected, unresolved and action-linked for both modes); shared boundary treatment starts 4375.
- `PhysicsPaintPlayScriptCards.tsx`: `RailTypeCard` 135-161, stacking helper string 154-158.
- `physicsPaintRotoPhysicalModel.ts`: `PhysicPaintRotoLoopClip` 305-360 — required fields are only `loopId`, `placementStart`, `sourceKeyIds`, `repeat`, `mode`; `railKind`, `scriptId`, `motion`, `overrideColor`, `colorize`, `colorizeMix`, `photoWiggle`, `keyScriptEdits`, `paintSeedVariation` and the six lifecycle members are optional.

Project skills: apply `efx-preact-reactivity` (compare-then-write signal setters, identity-stable effect deps, dialog-gated seeds, no render-body signal writes) and `developing-preact` (Preact, not React — no useState, no useEffect defaults). This plan adds no new signal and no new effect; the existing `seedKeepScript` dialog gate and `stackRailKind` computed stay untouched.

Gates: `pnpm --filter efx-motion-editor exec vitest run` (never watch mode), `pnpm --filter efx-motion-editor run typecheck`. Full-suite baseline at HEAD: 363 files / 6,783 passed / 1 skipped / 96 todo. Never start the server.
</context>

<tasks>

<!-- planner-discipline-allow: omitStoredRevealKnobs -->
<task type="tracer" tdd="true">
  <name>Task 1: One stack run commits a Standard Rail and the active-lane rail paints it gray, end to end</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts, app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts, app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts, app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts, app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts, app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx, app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    - buildStandardStackedLoopClip({ target, mergedSourceKeyIds, lifecycle }) returns exactly loopId, placementStart, repeat, sourceKeyIds (a frozen copy), mode (the target's stored value, never the run's), the optional keyScriptEdits/paintSeedVariation flags only when the target carried true, and the target's six lifecycle members copied when present, overridden by the plan's lifecycle when non-null (a null plan must preserve, not drop, the target's lifecycle).
    - The built record has no own scriptId, motion, overrideColor, railKind, colorize, colorizeMix or photoWiggle property, even when the destination carried all of them.
    - A null lifecycle plan (no extension) preserves the destination's lifecycle members on the merged record.
    - isStandardMergedLoopClip is true only for a defined clip whose railKind is not 'reveal' and whose scriptId is absent; undefined and reveal clips are false.
    - projectPhysicsPaintLoopClipPresentation on a provenance-free playscript clip reports lifecycle 'standard', modeLabel 'Standard', groupTypeLabel 'Standard Rail', displayName 'Standard Rail at F<n>' when no name/source is supplied, sourceLabel 'Merged rail — multiple scripts', statusLabel 'Merged rail — multiple scripts.', synchronizationDot null, regenerateDisabledReason 'Regenerate unavailable — this rail merges multiple scripts.', replayDisabledReason 'Replay unavailable — this rail merges multiple scripts.', freshnessLine null, railKind 'standard', overrideColor null, and a tooltip line 'Type: Standard'.
    - A reveal clip keeps railKind 'reveal' and its existing lifecycle/copy; a clip with scriptId keeps its Motion/Static labels and its typed Regenerate reason.
    - An unresolved range still wins over the standard classification (lifecycle 'unresolved', red).
    - confirmStack publishes one updated Target whose committed record deep-equals the whitelist output for a Motion destination + Static run and for a Reveal destination, while the destination's frames, repeat and lifecycle extension are unchanged.
    - PhysicsPaintLoopClipRail emits the class rail-kind-standard for a merged presentation next to its existing mode-<mode> class, and the stylesheet carries a gray standard block.
  </behavior>
  <action>
Add the Standard merge projection to `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts` (pure module, already imported by the controller): export `STANDARD_RAIL_STATUS_COPY = 'Merged rail — multiple scripts.'`, `STANDARD_RAIL_REGENERATE_REASON = 'Regenerate unavailable — this rail merges multiple scripts.'`, `STANDARD_RAIL_REPLAY_REASON = 'Replay unavailable — this rail merges multiple scripts.'`, `isStandardMergedLoopClip(clip)` (false for undefined; false when `railKind === 'reveal'`; true when `scriptId === undefined`), and `buildStandardStackedLoopClip({ target, mergedSourceKeyIds, lifecycle }: { target: PhysicPaintRotoLoopClip; mergedSourceKeyIds: readonly string[]; lifecycle: RunScriptStackLifecycle | null })` returning an explicit object literal — loopId, placementStart, repeat, `sourceKeyIds: Object.freeze([...mergedSourceKeyIds])`, `mode: target.mode`, `...(target.keyScriptEdits === true ? { keyScriptEdits: true as const } : {})`, `...(target.paintSeedVariation === true ? { paintSeedVariation: true as const } : {})`, the target's six lifecycle members copied when present (`syncState`, `provenanceState`, `phaseOrigin`, `originalEndExclusive`, `visibleRanges`, `frameOverrides`), then `...(lifecycle ?? {})` so a non-null plan wins and a null plan preserves the target's lifecycle — with no spread of `target` anywhere. Document that the omitted fields are the provenance/reveal identity a merged rail must not carry and that `mode` is only a schema-required internal value.

Write the stacking test additions first (RED): the full whitelist keep/drop matrix, the absent-flag own-property absence, lifecycle reference passthrough, and the `isStandardMergedLoopClip` matrix.

In `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts` extend `RotoRailKind` to `'playscript' | 'reveal' | 'standard'`, keep `classifyRotoRailKind` for the stored field only (narrow its parameter/return to `Exclude<RotoRailKind, 'standard'>`), update `isRevealRotoRail` to compare `railKind === 'reveal'` directly (do not forward the widened union into the narrowed classifier), add `classifyLoopClipRailKind(clip: PhysicPaintRotoLoopClip | undefined): RotoRailKind` (undefined -> 'playscript'; `railKind === 'reveal'` -> 'reveal'; `isStandardMergedLoopClip` -> 'standard'; else 'playscript') importing `isStandardMergedLoopClip` from the stacking module, and make `getRotoRailKindLabel` return 'Standard' for 'standard', 'Reveal' for 'reveal', 'Play Script' otherwise (the TrackRow aria template already appends ' rail at frame N', so the label is 'Standard', not 'Standard Rail').

In `app/src/components/physic-paint/view/physicsPaintLoopClipPresentation.ts`: add `'standard'` to `PhysicsPaintGroupLifecycle` and exclude it from `PhysicsPaintGroupSynchronizationDot`; import `classifyLoopClipRailKind` and `type RotoRailKind` from `./physicsPaintWorkflowPresentation` plus the three copy constants from `../roto/physicsPaintRotoRunScriptStacking`; type the presentation `railKind` as `RotoRailKind`. In the projection compute `const railKind = classifyLoopClipRailKind(clip)`, `const isStandard = railKind === 'standard'`, `const isReveal = railKind === 'reveal'` (replacing the `clip?.railKind ?? 'playscript'` derivation at 146), and drive labels from `isStandard`: `modeLabel` -> 'Standard', `groupTypeLabel` -> 'Standard Rail', `sourceLabel` -> 'Merged rail — multiple scripts' (replacing the `'Source Script unavailable'` fallback), displayName fallback via `groupTypeLabel` (already correct), and `synchronizationDot` null when lifecycle is 'unresolved' OR 'standard'. Widen `modeLabel`/`groupTypeLabel` literal types to include the Standard members. Leave `mode`, `overrideColor`, `freshnessLine` and the tooltip order untouched (`Type: Standard` then follows from `modeLabel`). In `resolveGroupLifecycle`, classify right after the unresolved check and before the detached check: `if (classifyLoopClipRailKind(clip) === 'standard') return 'standard';`. Add `case 'standard': return STANDARD_RAIL_STATUS_COPY;` to `statusLabelFor`, `case 'standard': return STANDARD_RAIL_REGENERATE_REASON;` to `regenerateDisabledReasonFor`, `case 'standard': return STANDARD_RAIL_REPLAY_REASON;` to `replayDisabledReasonFor` (before the reference/script pre-checks so an undefined option falls through to the switch), and change the projection's `replayDisabledReason` to call it when `isReveal || lifecycle === 'standard'`. Update the presentation test table row named 'no source action' to the Standard expectation set, add a Standard-labels/tooltip/no-dot test, add a reveal-precedence assertion (`railKind: 'reveal'`, lifecycle 'unavailable') and a typed-rail regression assertion.

In `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` replace the `updatedTarget` literal at 2512-2525 with `buildStandardStackedLoopClip({ target: currentTarget, mergedSourceKeyIds, lifecycle })`, delete the `omitStoredRevealKnobs` helper at 3707-3718 and every reveal-knob spread. Keep `isRevealTarget`, `renderMode`, `motion`, `renderOverrideColor` and `renderPaintSeedVariation` exactly as they are: they feed the run's BAKE (the reveal tail and the aquarelle bake) and the applied summary, and the merged rail no longer stores them. Do NOT change the Keep 2x2, the collision/lifecycle law, the slice/CR-01 refusal, the reveal tail, the composite path, the recording ports or the commit count.

Update only the controller pins whose law intentionally changes: the Quick A color-adoption tests (the committed rail now has no own `overrideColor` property, while the dialog seeding and `useStackColor` assertions stay), the Quick A 'seeds the run from the rail settings...' test (the bake still uses the dialog's static mode and motion, the committed rail keeps `mode: 'progressive'`, `paintSeedVariation: true`, and carries no `motion`/`overrideColor`), the Quick B reveal-adoption test (committed rail has no colorize/colorizeMix/photoWiggle/scriptId/railKind/motion/overrideColor; the tail render call assertions stay), the Quick B reload test (`railKind` becomes absent, repeat and sourceKeyIds assertions stay), and the WR-12 acknowledgement test, which must be retargeted: the colorize pair is no longer persisted on a stack result, so mutate a KEPT field (`mode` and `keyScriptEdits`) and keep proving the ack rejects a mismatched loop clip. Add the end-to-end merge test: destination Static with a stored picture, dialog switched to Motion, confirm -> exactly one `ports.commit`, committed clip equals the whitelist output (no provenance/reveal fields, `mode: 'static'`, merged `sourceKeyIds`, target `repeat`), and the projection of the committed clip plus its range yields 'Standard Rail' with railKind 'standard'. Do not touch the harness or tests that pin laws C1 keeps.

In `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` add `const isStandard = presentation.railKind === 'standard';` next to `isReveal`, keep `railColor`/`railColorHover`/`revealUnresolved` reveal-only, and extend the class template at 338 with `rail-kind-standard` when `isStandard`. In `app/src/components/physic-paint/physicsPaintStudio.css` insert a Standard block immediately after the reveal block (before the shared boundary comment at 4375) mirroring its specificity for BOTH modes: base segment `background: #9CA3AF`, `:hover:not(.selected)` and `:focus-visible:not(.selected)` `background: #D1D5DB`, `.selected` `background: #f59e0b`, `.unresolved` `background: #ff6b6b`, and `.action-linked:not(.selected)` `background: #D1D5DB`, each selector shaped `.physics-paint-loop-clip-rail-target.rail-kind-standard.mode-progressive|.mode-static ... .physics-paint-loop-clip-rail-segment`. Typed color rules stay byte-identical. Pin the class in `PhysicsPaintLoopClipRail.test.tsx` (a provenance-free clip presents as Standard and the rendered target has the class, no dot, and the gray CSS rules read from the stylesheet) and add `scriptId` to that suite's typed fixtures where a test intends a Motion/Static rail.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>bash -lc "test \$(grep -c 'omitStoredRevealKnobs' app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts) -eq 0"</automated>
  </verify>
  <done>A stack run onto a Motion, Static or Reveal destination commits one whitelist Standard record (no scriptId/motion/overrideColor/railKind/colorize/colorizeMix/photoWiggle, stored mode, merged sourceKeyIds, target repeat and lifecycle) in exactly one commit; projectPhysicsPaintLoopClipPresentation reports lifecycle 'standard', 'Standard Rail', 'Type: Standard', the merged status/regenerate/replay copy, a null dot and railKind 'standard'; LoopClipRail emits rail-kind-standard and the stylesheet paints it gray for both modes with selected/unresolved/action-linked restated; revelation and typed rails keep their existing labels and colors; the four targeted suites pass.</done>
  <reversibility rating="reversible">Localized to the merge helper, the lifecycle union and the rail class; the product law itself was settled by the user in CONTEXT.md.</reversibility>
</task>

<task type="execute" tdd="true">
  <name>Task 2: Non-active rows show the same Standard rail and Regenerate refuses merged rails</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx, app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.ts, app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - A provenance-free non-reveal clip renders its non-active row line with rail-kind-standard, keeps its mode-<mode> class, and its aria label reads 'Standard rail at frame <n>'.
    - Typed non-active rows are unchanged: a clip with scriptId keeps 'Motion'/'Static' aria copy and no standard class; a reveal clip keeps rail-kind-reveal.
    - groupRegenerateReason returns STANDARD_RAIL_REGENERATE_REASON for a merged clip before the lifecycle-shape check, so a canonical merged rail AND an infinity (lifecycle-less) merged rail both refuse with the merged reason, with zero writes.
    - openSourceEdit — the dialog's Regenerate entry point — returns the same merged reason before its lifecycle-shape branch, so the UI refuses both canonical and infinity merged rails.
    - Delete-confirmation and delete-message copy for a merged rail says 'Standard Rail', never 'Motion/Static Rail'; the rail-set copy type includes 'Standard' for a merged member.
    - A typed rail's existing reasons are unchanged, including detached, unavailable (scriptId present but the library row missing), synchronized and the ambiguous source-sharing refusal.
  </behavior>
  <action>
In `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` replace `railKind: classifyRotoRailKind(clip?.railKind)` at 335 with `railKind: classifyLoopClipRailKind(clip)` and extend the rail class template at 671 so the extra rail-kind class is chosen in one place: `rail-kind-reveal` for reveal, `rail-kind-standard` for standard, none for playscript (aria needs no change — `getRotoRailKindLabel` now returns 'Standard'). Keep `mode-${line.mode}` and every other class/boundary/data attribute exactly as they are.

In `PhysicsPaintTrackRow.test.tsx` add `scriptId` to the fixtures in the shared-family-colors test so it keeps testing typed rails, then add a test seeding a provenance-free clip that asserts the rail target carries `rail-kind-standard` (and still `mode-progressive`), the aria label starts with 'Standard rail at frame ', and the stylesheet's standard rule contains `background: #9CA3AF` via the existing `cssRule` helper. Leave the no-in-line-dot test as is — it now also covers the merged rail.

In `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` import `isStandardMergedLoopClip` and `STANDARD_RAIL_REGENERATE_REASON` from the stacking module and insert, immediately after the busy/lock guard line and before the `isRegenerableLifecycleShape` check in `groupRegenerateReason` (1585-1606): `if (isStandardMergedLoopClip(group)) return STANDARD_RAIL_REGENERATE_REASON;`. This ordering is required so an infinity merged rail (no lifecycle members, hence not a regenerable shape) reports the merged reason instead of 'Rail source is unresolved', and so a merged rail never reports 'Script detached' through the inherited provenanceState. Also insert the same standard guard in `openSourceEdit` immediately after the loop-exists check and BEFORE `isRegenerableLifecycleShape(loop)` (~1692): `if (isStandardMergedLoopClip(loop)) return rejectLoopOp(STANDARD_RAIL_REGENERATE_REASON);` — the dialog's Regenerate trigger calls `openSourceEdit` (PhysicsPaintPlayScriptDialog.tsx:453), and without this a lifecycle-less merged clip falls to the 'no source-cycle provenance' branch. Do not change any other branch of that function, `openGroupRegenerate` or `repairLoop`; `openSourceEdit` gets only the standard guard above.

Add the controller pin: seed a canonical six-member clip with no scriptId and one infinity clip with no scriptId into the regenerate harness, then assert `openSourceEdit` returns `{ ok: false, reason: STANDARD_RAIL_REGENERATE_REASON }` for both and that no commit/write port was called; keep the existing reason matrix test green. Add `scriptId` to any lifecycleGroup fixture that must stay typed.

In `useRotoTimelineActions.ts` (delete-copy group branch ~945 and `railSetCopyType` ~1013) and `PhysicsPaintStudio.tsx` (delete message ~2961), derive Standard via `classifyLoopClipRailKind`/`isStandardMergedLoopClip` from the group clip instead of `mode`; extend `RailSetCopyMember`/`railSetCopyType` with 'Standard' and keep typed rails' Motion/Static/Key copy unchanged. Add pins in `useRotoTimelineActions.test.ts` and `PhysicsPaintStudio.test.ts`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>A merged rail is gray and labelled Standard on non-active rows exactly as in the active lane, typed and reveal rows are unchanged, Regenerate on any merged rail (canonical or infinity) refuses with 'Regenerate unavailable — this rail merges multiple scripts.' with zero writes, and delete/rail-set copy says Standard; the targeted suites pass.</done>
</task>

<task type="execute">
  <name>Task 3: Stack dialog copy and the merged-rail laws (one undo, reload, Keep, cycles) are pinned</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts, app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</files>
  <behavior>
    - The stack dialog's Rail Type helper reads 'This run merges into the rail — the result is one Standard Rail.' for every stack destination, and the non-stack Apply copy is unchanged.
    - confirmStack calls ports.commit exactly once for a stack run and the pre-run loop-clip collection is not mutated (the publication carries a fresh frozen record).
    - A committed merged clip round-trips: isPhysicPaintRotoLoopClip is true, parsePhysicPaintRotoLoopClips returns the same record, and projecting the parsed clip reports 'Standard Rail' (no schema change needed).
    - Keep ON appends the run's slices over the durable base and Keep OFF flattens (flag-on) or writes nothing (pixel-only), and both commit a Standard record.
    - The merged rail keeps the destination's repeat and cycle options and the lifecycle extension computed by planRunScriptStackLifecycle.
  </behavior>
  <action>
In `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` replace the stacking helper string at 154-158 with 'This run merges into the rail — the result is one Standard Rail.' (leave the non-stacking branch absent and the card title 'Rail Type' unchanged; C1 keeps the existing Motion/Static surface). Update the pin at `PhysicsPaintPlayScriptDialog.test.ts:1824` and extend it to assert the new copy appears for a stack destination and never for a plain Apply open.

In `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` add the merged-rail law pins using the existing `stackHarness`/`stackClip`/`commit` mocks (no harness changes): (a) one-undo — after a stack confirm assert `test.commit` was called exactly once and a deep snapshot of the pre-run loop clips taken before `confirm()` still equals the pre-run value (the publication must carry a new frozen record, not a mutated target); (b) reload — build the physical revision from the committed publication exactly like the Quick B reload test, parse it, and assert `isPhysicPaintRotoLoopClip(committed)` is true, `parsePhysicPaintRotoLoopClips([committed])` deep-equals `[committed]`, and the reopened clip projects to 'Standard Rail' with lifecycle 'standard'; (c) Keep ON/OFF — assert the recorded `recordMode` stays 'append' (ON) and 'replace' (flag-on OFF) / no port call (pixel-only OFF) while both committed clips are Standard; (d) cycles — assert the committed clip's `repeat` and the extended `originalEndExclusive`/`visibleRanges` equal the plan output, and add a no-extension case where the plan is null and the target's lifecycle members survive unchanged. Extend rather than duplicate existing pins that already cover a bullet.

Then run the full suite and typecheck and reconcile only intentional failures (a failure is intentional only when its assertion encoded the adoption law C1 reverses).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The dialog tells the user a stack produces one Standard Rail; one commit per stack run with the pre-run collection untouched; a merged clip round-trips through the existing parser and still presents as Standard; Keep ON/OFF and repeat/cycle retention are pinned; the three targeted suites and typecheck pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| run-script dialog -> publication commit | User-chosen Rail Type, Motion, color and Keep values cross into one atomic publication; any adopted value that survives as rail identity becomes a lie about the rail's provenance. |
| destination rail metadata -> merged record | The destination's provenance and reveal knobs are untrusted input to the merge; a spread would re-adopt them and let Regenerate overwrite the blend. |
| merged record -> persisted document | The whitelist record crosses into the saved Loop Clip collection; an extra field or a dropped lifecycle member would change the persisted format or orphan the undo snapshot. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261031-VBO-01 | Tampering | `confirmStack` merge projection / `buildStandardStackedLoopClip` | high | mitigate | Explicit whitelist object literal with no spread of the destination; the stacking test asserts every dropped field is absent and every kept field survives; the publication keeps `basePublication` records and only the run's touched frames carry new bytes, so cached pictures cannot be erased by the metadata swap. |
| T-261031-VBO-02 | Repudiation | one atomic commit / undo | high | mitigate | The merge stays inside the single existing `ports.commit`; the controller pin asserts exactly one commit and an unmutated pre-run collection, so the existing undo history entry restores the typed rail byte-identically. |
| T-261031-VBO-03 | Spoofing | presentation honesty | medium | mitigate | One classifier (`classifyLoopClipRailKind`) drives both hosts; 'standard' outranks detached/unavailable so a merged rail can never claim a script identity; typed rails (scriptId present) and reveal rails keep their existing lifecycle and colors, pinned by regression tests. |
| T-261031-VBO-04 | Denial of Service | Regenerate/Replay on a merged rail | medium | mitigate | `groupRegenerateReason` returns the merged reason before the lifecycle-shape, syncState and provenance branches (canonical and infinity), and no write path exists for a merged rail, so the affordance fails closed with zero writes instead of a partial regenerate; Replay carries the same reason in the tooltip. |
| T-261031-VBO-05 | Tampering | persisted Loop Clip format | medium | mitigate | No field is added, renamed or defaulted: Standard is stored as absent provenance/railKind, which the existing parser accepts; a reload pin parses the committed record back and asserts the projection still says Standard. |
| T-261031-VBO-SC | Tampering | pnpm dependency installs | high | accept | No dependency is added, upgraded or installed by this plan; no package-manager task exists, so the supply-chain surface is unchanged. |
</threat_model>

<verification>
1. Task 1 merge surface: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
2. Task 1 presentation surface: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintLoopClipPresentation.test.ts src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx.test.ts`
3. Task 1 helper-gone gate: `bash -lc "test \$(grep -c 'omitStoredRevealKnobs' app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts) -eq 0"` — baseline at HEAD is 2 occurrences (the definition at 3707-3718 plus the adoption spread at 2516), so the gate is red until the helper is deleted and every call site is gone.
4. Task 2 non-active rows + regenerate gate + Standard copy: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/hooks/useRotoTimelineActions.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts`
5. Task 3 dialog + laws: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.test.ts`
6. Full suite: `pnpm --filter efx-motion-editor exec vitest run` — baseline is 363 files / 6,783 passed / 1 skipped / 96 todo; new tests raise the file and pass counts and the run must end with 0 failed. Never run watch mode and never start the server.
7. Typecheck: `pnpm --filter efx-motion-editor run typecheck` reports no errors.
8. Schema tripwire: `git diff --stat` must not touch `physicsPaintRotoPhysicalModel.ts`, any serializer/parser, or any persisted rail field — Standard is expressed by ABSENT provenance, not by a new field. If an implementation proves a stored field unavoidable, STOP and report; do not improvise a schema.
9. Typed-rail regression: the presentation, LoopClipRail and TrackRow suites still assert `#8b5cf6`/`#06b6d4`/`#69BBC8`, `Type: Motion`/`Type: Static` and the reveal lifecycle for rails that carry scriptId/railKind.

UAT rows the user will run after execution (live visible UAT; automated-green is not done):
- Motion destination + Static run: the rail turns into a gray "Standard Rail"; row tooltip, rail tooltip and the Scripts panel all say Standard, never Motion/Static/Reveal.
- Static destination + Static run: same gray Standard result.
- Motion destination + Motion run: same gray Standard result (the first rail's motion is no longer advertised as a Motion rail).
- A Standard rail that receives another Motion or Static run stays Standard, stays gray, and keeps its cycle/repeat options.
- Keep ON: the destination's existing picture stays under the new run after the merge and after repeating the run; Keep OFF flattens it; nothing doubles.
- Cycle/repeat editing on the merged rail still works (Edit Rail, change repeat and cycle length).
- Regenerate and Replay are unavailable on the merged rail with the merged-rail reason; key editing and per-key script editing still work.
- One Undo restores the original typed rail exactly — type, color, source script and (for a reveal destination) its reveal knobs.
- Save then reopen: the rail is still a gray Standard Rail with the same picture and the same blend.
- Typed rails never show Standard: an unstacked Motion rail stays purple, a Static rail stays cyan, a Reveal rail stays blue, each with its own Regenerate behaviour.
</verification>

<success_criteria>
- Any destination rail that receives a Motion or Static run commits one Standard Rail in a single atomic commit: cached frames and cycle options preserved, the run composited over them, provenance and reveal identity dropped, stored `mode` retained internally, `keyScriptEdits`/`paintSeedVariation` retained.
- Both rail hosts present the merged rail as a gray 'Standard Rail' with Standard type copy, no lifecycle dot and no typed identity; typed and reveal rails are byte-identically unchanged in colour, label and lifecycle.
- Regenerate and Replay refuse merged rails with the merged-rail reason (canonical and infinity), with zero writes; key editing, per-key script editing and cycle/repeat editing remain.
- One undo restores the typed rail; save then reopen keeps the Standard Rail and its blend; the committed record parses and round-trips unmodified.
- No persisted schema or format change; typecheck clean; full suite green (0 failed) with the baseline counts as the floor.
- Three atomic commits, one per task, each green before the next begins; C2 (Reveal incoming on any destination, document-reference routing) is not implemented.
</success_criteria>

<output>
Create `.planning/quick/261031-vbo-task-quick-c-run-script-merge-result-bec/261031-vbo-SUMMARY.md` when done. Record the three task commits, the whitelist merge law and the dropped fields, the `standard` presentation lifecycle and the gray rail block, the regenerate/replay gate placement, the intentional test-law reversals (Quick A adoption pins, Quick B reveal-adoption pins, WR-12 ack retarget, presentation table row), the new law pins (one commit, reload round-trip, Keep ON/OFF, cycles), the UAT rows handed to the user, and an explicit statement that no persisted schema changed and that C2 was not started.
</output>
