---
phase: quick-261008-ful
plan: 261008-ful
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/physicPaintBridge.ts
  - app/src/components/sidebar/PhysicPaintProperties.tsx
  - app/src/components/sidebar/PhysicPaintProperties.test.ts
  - app/src/components/layer/LayerList.tsx
  - app/src/components/layer/LayerList.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
autonomous: true
requirements: [QUICK-261008-FUL]

estimate:
  tokens: 30000
  raw_tokens: 15000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Double-click on a physic-paint layer row in the main-app LayerList opens the Studio at the current frame through the ONE shared launch path (same payload as the sidebar's Roto paint button); single-click select, grip reorder, eye toggle, and delete behave exactly as before, and double-click on image/video rows has no new behavior."
    - "The open payload (current frame, project canvas w/h, fps, workflowLabel from fxTrackLayouts) is assembled in exactly ONE place — both launchers compose it from the same helper, so the two surfaces can never drift."
    - "In the audio modal, field 4 Gain is a NumericStepper (step 5, clamped -100..+100, per-step commit through commitGain); the native range slider is gone (replaced, not supplemented); the signed readout copy (Gain, signed value, 0 = unity) and fields 1-3, 5-7 are unchanged."
    - "documentAudio model and persistence untouched — the diff for feature 2 is confined to the modal view plus its new test; a set gain survives close/reopen of Studio via the existing setSound chain."
    - "New/retargeted source-contract pins pass, typecheck clean (noUnusedLocals), full vitest run has no NEW failures, and the quick lands as two atomic commits (one per feature)."
  artifacts:
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/sidebar/PhysicPaintProperties.tsx
    - app/src/components/layer/LayerList.tsx
    - app/src/components/layer/LayerList.test.ts
    - app/src/components/sidebar/PhysicPaintProperties.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
  key_links:
    - "LayerRow onDblClick → validContext-equivalent guards → openPhysicPaintForLayer → openPhysicPaintCanvas (validation, media materialization, geometry mirror, window hide/show all stay in the bridge)"
    - "PhysicPaintProperties.handleOpenCanvas → the same openPhysicPaintForLayer (single payload-assembly site: timelineStore/sequenceStore/fxTrackLayouts/projectStore peeks)"
    - "NumericStepper onChange → commitGain → patchSound → setSound (existing persistence chain; isValidGain backstop keeps prior value on invalid input)"
    - "the retargeted PhysicPaintProperties.test.ts payload pin reads physicPaintBridge.ts — it is what keeps the sidebar and LayerList launchers welded to one payload"
---

<objective>
Two small UX features, one atomic commit each: (1) double-click a physic-paint layer row in the main-app LayerList to open the Studio via the existing launch path, (2) the audio modal's Gain field becomes the shared NumericStepper instead of a native range slider.

Purpose: both are one-surface entry-point upgrades the user has already UAT-shaped; neither may grow new UI, new copy, or a second path into the Studio/audio model.
Output: a single shared launch helper in physicPaintBridge.ts consumed by both launchers, a gated LayerRow double-click, the Gain stepper swap with updated contract comment, and house-style source-contract tests for both features — two commits.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.planning/quick/261006-dfy-quick-physics-paint-layer-row-in-the-mai/261006-dfy-SUMMARY.md

Key files (read before implementing):
- app/src/components/layer/LayerList.tsx — THE surface for feature 1. Pre-fix landmarks: LayerRow div with onClick={handleSelect} (:124), SortableJS configured with handle: '.layer-drag-handle' (:26), eye/delete buttons stop propagation; NO double-click handler exists; typeLabel/typeColor have no physic-paint branch (renders as generic 'Layer').
- app/src/components/sidebar/PhysicPaintProperties.tsx — the payload source of truth: handleOpenCanvas (:71-106) peeks timelineStore.currentFrame, finds the parent sequence, derives workflowLabel from fxTrackLayouts via parentSequence, peeks projectStore width/height/fps, calls openPhysicPaintCanvas; validContext (:36) = layer.type + layer.source.type + integer frame >= 0; the `opening` re-entrancy guard and status messages live here and must survive the refactor.
- app/src/lib/physicPaintBridge.ts — openPhysicPaintCanvas (:4032) owns validateOpenRequest (:4089: layer/source-type check, frame >= 0 finite, non-empty workflowLabel), media materialization, canonical launch context, geometry mirror, window hide/show. Already imports sequenceStore/timelineStore/projectStore (:68-70) and {resolveSequenceTimelineRange, trackLayouts} from ./frameMap (:73) — add fxTrackLayouts there. PhysicPaintOpenRequest at :166.
- app/src/components/sidebar/PhysicPaintProperties.test.ts — nine source-contract pins (readFileSync of the sibling .tsx). Eight stay byte-for-byte; the payload pin ('passes the current frame, project canvas size, and derived workflow label…') slices const handleOpenCanvas → const deleteCurrentRotoFrame and MUST be retargeted to the new bridge helper (Task 1). Slice anchors that must survive: 'const handleOpenCanvas', 'const deleteCurrentRotoFrame', 'const handleApplyResult', 'window.addEventListener'.
- app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx — feature 2 surface. Imports NumericStepper already (:3); field 4 Gain = labels row (Gain + signed <output> readout) then the range input (:329-354); fades field 5-6 show the exact NumericStepper usage precedent (:362-369); controller destructure at :171-176 includes previewGain, previewGainInput, commitGain; header field-order contract comment item 4 at :30; file uses useRef/useEffect only — no useState.
- app/src/components/shared/NumericStepper.tsx — props contract: value, onChange (called once per committed step), step, min, max, ariaLabel, disabled/ariaDisabled, class. Classic constant-step: presses move ±step, typed commits snap to the step grid, press gestures bracketed by startCoalescing/stopCoalescing.
- app/src/components/physic-paint/view/physicsPaintAudioController.ts — READ-ONLY: previewGain = volumeDraft ?? sound?.gain ?? 0 (:339), commitGain clears draft, disarms Remove, validates via isValidGain (integer, -100..100) then patchSound({gain}) (:232-237); commitFadeIn/Out are the per-step-commit precedent. The model/persistence chain must not change.
- app/vitest.config.ts — include glob is src/**/*.test.ts only; new tests MUST be .test.ts (never .test.tsx), no config changes.
- app/tsconfig.json — noUnusedLocals/noUnusedParameters true: a destructured-but-unused previewGainInput fails typecheck after the slider swap.

Grounding (verified 2026-10-08): the SequenceList Layers button is unconditional (app/src/components/sequence/SequenceList.tsx:344-349) and handleLayerView sets the active sequence first (:228-233), so the layer view CAN open on an FX sequence — LayerList reads layerStore.layers = active-sequence layers (app/src/stores/layerStore.ts:8-11), hence a physic-paint row can render there today; no new dependency is introduced anywhere in this quick.

Constraints honored: one atomic commit per feature (Task 1 = commit 1, Task 2 = commit 2); no new UI surfaces, labels, or copy beyond the Gain control swap; LayerRow keeps single-click select, grip drag-reorder, eye, delete, and gains NO rename-on-double-click; modal stays a thin shell over the signals-only controller (no useState, no render-body signal writes — efx-preact-reactivity rules); the documentAudio model and persistence are untouched (UI-only swap); PATH FORM (repo-root-relative paths in this plan body); pnpm, vitest run only (never watch), no dev server (user runs it), native visual UAT stays with the user (no Chrome DevTools MCP).
</context>

<!-- planner-discipline-allow: openPhysicPaintCanvas( -->
<!-- planner-discipline-allow: fxRenameEdit -->
<!-- planner-discipline-allow: type="range" -->
<!-- planner-discipline-allow: native range -->

<tasks>

<task type="auto">
  <name>Task 1: LayerRow double-click opens Studio via ONE shared launch path</name>
  <files>app/src/lib/physicPaintBridge.ts, app/src/components/sidebar/PhysicPaintProperties.tsx, app/src/components/layer/LayerList.tsx, app/src/components/sidebar/PhysicPaintProperties.test.ts, app/src/components/layer/LayerList.test.ts</files>
  <reversibility rating="reversible">All edits are additive handler/plumbing plus a test retarget; reverting the commit restores the previous sidebar path and drops the LayerRow gesture with zero persistence impact.</reversibility>
  <action>Two invariants drive this task: the payload is assembled in exactly ONE place, and LayerRow gains a strictly gated double-click. Extract first, then wire, then pin.

(1) Single launch path — app/src/lib/physicPaintBridge.ts: add an exported async helper openPhysicPaintForLayer(layer: Layer | null | undefined): Promise&lt;Result&lt;PhysicPaintLaunchContext&gt;&gt;, doc-commented as THE single Studio launch path for every caller (sidebar row, LayerList double-click, future launchers). It composes the request field-for-field exactly as PhysicPaintProperties.handleOpenCanvas does today, all peeks at call time: frame from timelineStore.currentFrame.peek(); the parent sequence via sequenceStore.sequences.peek() finding the sequence whose layers contain the layer id; workflowLabel from that sequence's layout — fxTrackLayouts.peek().find(layout => layout.sequenceId === parentSequence.id)?.headerLabel (add fxTrackLayouts to the existing ./frameMap import line alongside trackLayouts); canvas { width: projectStore.width.peek(), height: projectStore.height.peek() }; fps: projectStore.fps.peek(). Then return openPhysicPaintCanvas({ layer, frame, canvas, fps, workflowLabel }). The helper ONLY composes the request — validation, media materialization, geometry mirror, and window hide/show stay inside openPhysicPaintCanvas; no second window mechanism is created anywhere.

(2) Sidebar routes through it — app/src/components/sidebar/PhysicPaintProperties.tsx: handleOpenCanvas keeps its `!validContext || opening` guard, setOpening/statusMessage/errorMessage flow, and logging, but replaces the inline payload assembly and direct bridge call with a single awaited openPhysicPaintForLayer(layer). Drop the now-unused local currentFrame (noUnusedLocals) — adjust the console.info so it no longer references it — and swap the openPhysicPaintCanvas import for the helper (PHYSIC_PAINT_APPLY_RESULT_EVENT import stays). Everything else in the file byte-untouched.

(3) LayerRow double-click — app/src/components/layer/LayerList.tsx: add handleRowDoubleClick bound as onDblClick on the LayerRow div alongside the existing onClick. Handler order: event.stopPropagation(); return unless layer.type === 'physic-paint' AND layer.source.type === 'physic-paint' (the sidebar validContext layer half); read frame = timelineStore.currentFrame.peek() and return unless Number.isInteger(frame) && frame >= 0 (the validContext frame half — the bridge re-validates as backstop); a component-local useRef busy flag mirrors the sidebar's `opening` guard (set true around the await, false in finally — no useState, no signal writes anywhere, per efx-preact-reactivity); await openPhysicPaintForLayer(layer) and console.info the Result when it is not ok (failure is silent in the UI — no new labels or surfaces). Existing onClick select, eye, delete, and the SortableJS grip config stay byte-untouched; no rename handler of any kind is introduced. New imports: timelineStore and the bridge helper.

(4) Pins. In app/src/components/sidebar/PhysicPaintProperties.test.ts, retarget ONLY the payload case: it currently slices handleOpenCanvas; instead readFileSync app/src/lib/physicPaintBridge.ts as a second source, slice from the openPhysicPaintForLayer signature through its openPhysicPaintCanvas(...) call, and assert the timelineStore.currentFrame.peek / width+height projectStore peeks / projectStore.fps.peek / workflowLabel: fxLayout?.headerLabel / openPhysicPaintCanvas( composition; in the sidebar source assert openPhysicPaintForLayer(layer) IS present and a direct expect(source).not.toContain('openPhysicPaintCanvas(') holds (single-path pin). The other eight cases stay byte-for-byte — their slice anchors must keep working. Then create app/src/components/layer/LayerList.test.ts in the house source-contract style (readFileSync of the sibling .tsx): a describe block pinning — onDblClick bound to the new handler on the row div; a slice of that handler (indexOf anchor pair) containing the physic-paint type guard, the layer.source guard, the frame guard, stopPropagation, and openPhysicPaintForLayer(layer); the region-scoped negative expect(handlerSlice).not.toContain('openPhysicPaintCanvas('); expect(source).not.toContain('fxRenameEdit'); and unchanged-behavior pins expect(source).toContain('onClick={handleSelect}') and expect(source).toContain("handle: '.layer-drag-handle'"). Vitest collects only src/**/*.test.ts — never author a .test.tsx, add no test config, and fix live first is NOT in effect here: write the pins in this same task so the commit is one atomic unit.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/layer/LayerList.test.ts src/components/sidebar/PhysicPaintProperties.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>The bridge exports openPhysicPaintForLayer as the only payload-assembly site (frame, canvas w/h, fps, workflowLabel peeks live there, nowhere else); PhysicPaintProperties.handleOpenCanvas delegates to it with guard/status behavior intact; LayerRow double-click on a physic-paint row calls the helper under all three guards while non-physic-paint rows return before any launch and select/grip/eye/delete are untouched; PhysicPaintProperties.test.ts payload case now reads the bridge helper and all nine sidebar cases pass; LayerList.test.ts pins pass; typecheck clean; exactly one atomic commit containing these five files.</done>
</task>

<task type="auto">
  <name>Task 2: Audio modal Gain slider → NumericStepper (per-step commit)</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts</files>
  <reversibility rating="reversible">A UI-only control swap in one view plus its test; the documentAudio model, controller, and persistence are untouched, so reverting restores the slider with no data implications.</reversibility>
  <action>UI-only swap — the controller, documentAudio model, and persistence stay byte-untouched (commitGain/isValidGain already enforce integer -100..100, so any odd input keeps the prior accepted value). Read .claude/skills/efx-preact-reactivity/SKILL.md first: no useState, no render-body signal writes — this file remains a thin shell.

(1) Field 4 in app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx: DELETE the native range input block (the min -100 / max 100 / step 1 element with its onInput/onPointerUp/onKeyUp/onBlur handlers, currently between the labels row and the field 5-6 comment) and render the shared NumericStepper in its exact place inside the same physics-paint-audio-row div — replaced, never supplemented, so no slider remains beside the stepper. Props: value={previewGain}, step={5}, min={-100}, max={100}, onChange={(value) => commitGain(value)} (per-step commit: every press and every typed blur/Enter commit lands through the existing commitGain validation — the live-drag draft path is gone with the slider), ariaLabel={AUDIO_GAIN_LABEL}, disabled={controlsDisabled}, ariaDisabled={controlsDisabled}, class="physics-paint-audio-field-stepper" (the fades precedent class, already styled in physicsPaintStudio.css:4596). KEEP the labels row exactly as-is — the Gain label plus the signed <output> readout (copy contract: `Gain`, signed value, 0 = unity — never reformat it).

(2) Destructuring: drop previewGainInput from the controller destructure at the top of the render (its only call site is the deleted slider; noUnusedLocals would fail typecheck otherwise). The controller keeps exporting it — controller file untouched.

(3) Contract comments, same edit: the header field-order comment item 4 `Gain — native range -100..100 step 1 + signed readout (release-commit)` becomes `Gain — NumericStepper step 5, -100..100 (per-step commit) + signed readout`, and the inline JSX comment above field 4 gets the same wording. Field-order numbering (1-7) and every other copy string in the file stay verbatim.

(4) New pin file app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts, house source-contract style (readFileSync of the sibling .tsx): slice the Gain field region (from the `{/* 4.` JSX comment anchor to the `{/* 5-6.` anchor) and pin NumericStepper present with step={5}, min={-100}, max={100}, value={previewGain}, and commitGain in onChange; file-wide expect(source).not.toContain('type="range"') and expect(source).not.toContain('native range') (the slider and the stale contract wording are both gone); positives expect(source).toContain('NumericStepper step 5') (updated contract comment) and the signed-readout ternary literal copied from the current source (the `+` prefix readout survives). No test config changes, .test.ts only — one atomic commit with the view edit.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Field 4 is a NumericStepper only (step 5, clamped -100..+100, each press/typed commit routed to commitGain) with the signed Gain readout and contract copy intact; the range slider element and the stale 'native range' contract wording are gone; fades, trims, toggles, Remove confirm, and main-app-audio toggle are byte-untouched; git diff for this commit touches only the modal view and its new test (controller/stores/persistence untouched); new pins + controller tests + typecheck green; exactly one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user gesture (LayerRow double-click) → physicPaintBridge / Tauri Studio window launch | an untrusted sidebar gesture crosses into the bridge that hides the main window and opens the standalone Studio |
| audio modal control → documentAudio persistence | a UI control change sits directly on top of the persisted sound model — a bad value or stray write corrupts the document |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|----------|-----------------|
| T-261008-FUL-01 | Tampering | extracting payload assembly from handleOpenCanvas could silently change the sidebar launch payload | high | mitigate | the helper is a field-for-field move of the existing peeks; the retargeted PhysicPaintProperties.test.ts payload pin reads the bridge source and asserts frame/canvas/fps/workflowLabel composition plus the single-path negative; full suite run before commit |
| T-261008-FUL-02 | Tampering | LayerRow double-click disrupting single-click select, grip drag-reorder, eye, or delete | medium | mitigate | the handler only adds onDblClick with stopPropagation, returns before side effects on non-physic-paint rows; onClick/Sortable config byte-untouched and pinned in LayerList.test.ts; UAT row 1 covers every surviving gesture live |
| T-261008-FUL-03 | Denial of Service | repeated double-clicks racing multiple Studio window opens | low | mitigate | component-local useRef busy flag mirrors the sidebar's `opening` guard (no new signal/state); openPhysicPaintCanvas's validateOpenRequest remains the backstop that rejects bad layer/frame requests |
| T-261008-FUL-04 | Tampering | Gain stepper writing out-of-range or fractional values into the persisted sound model | medium | mitigate | NumericStepper clamps to min -100 / max 100 and snaps to integer step 5; commitGain → isValidGain (integer, -100..100) rejects anything else and keeps the prior accepted value; controller and persistence files untouched (diff audit in Task 2 done) |
| T-261008-FUL-SC | Tampering | npm installs | high | mitigate | no new package installs in this plan — zero install surface |

</threat_model>

<verification>
- Per-task automated gates (vitest run only — NEVER watch, per CLAUDE.md):
  - Task 1: pnpm --filter efx-motion-editor exec vitest run src/components/layer/LayerList.test.ts src/components/sidebar/PhysicPaintProperties.test.ts
  - Task 2: pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts
  - pnpm --filter efx-motion-editor run typecheck after each task (clean)
- Full suite: pnpm --filter efx-motion-editor exec vitest run — no NEW failures versus the pre-quick baseline (any pre-existing failure is out of scope and must be noted, not fixed)
- Diff boundaries: commit 1 touches exactly the five Task 1 files; commit 2 touches exactly the two Task 2 files; app/src/components/physic-paint/view/physicsPaintAudioController.ts, the stores, and persistence code are byte-untouched across both commits (git diff --stat audit)
- Native visual UAT by the user (no Chrome DevTools MCP), from the quick's live rows:

  | # | Row | Pass condition |
  |---|-----|----------------|
  | 1 | LayerRow double-click | Double-click a physic-paint layer row → Studio opens at the current frame; single-click select, grip reorder, eye toggle, and delete all still work; double-click on image/video rows produces no new behavior |
  | 2 | Audio modal Gain | Gain shows as a value with −/+ moving 5 per press, clamped −100..+100; set a value, close Studio, reopen → the value persists; Fades and toggles unchanged |

- Nothing claimed done before the user's native UAT rows pass (automated-ready ≠ done).
</verification>

<success_criteria>
- Live (user UAT): both rows pass natively — Studio opens from the layer row at the current frame with all existing row gestures intact, and the Gain stepper commits/persists −100..+100 in steps of 5
- Automated: new LayerList + audio-modal pins, the retargeted payload pin, the untouched sidebar pins, controller tests, and typecheck all green; full suite has no NEW failures
- Guardrails held: one payload-assembly site, no second launch path, no rename-on-double-click, slider fully replaced (not supplemented), copy contract (Gain, signed value, 0 = unity) intact, no new UI surfaces/labels/copy, documentAudio model and persistence untouched
- Two atomic commits landed, one per feature; nothing claimed done before live UAT passes
</success_criteria>

<output>
Create .planning/quick/261008-ful-2-small-ux-features-one-atomic-commit-ea/261008-ful-SUMMARY.md when done
</output>
