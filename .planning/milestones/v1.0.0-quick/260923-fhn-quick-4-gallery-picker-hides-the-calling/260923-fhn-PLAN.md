---
phase: quick-260923-fhn
plan: 260923-fhn
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 30000
  raw_tokens: 15000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "While the gallery (background or reference) picker is open, no parent modal is visible on screen, whether one or two parents were open."
    - "Closing or cancelling the picker restores exactly the parent modal(s) that were open before, with their state intact."
    - "Nesting one level deep works: Apply Script Reveal hides while its image-reference picker is open, and the picker itself stays visible."
    - "Import semantics, gallery contents, and which modal opens which picker are unchanged."
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  key_links:
    - "PhysicsPaintStudioView picker-open flag gates the referenceDialog, scriptPickerDialog, and playScriptDialog render lines"
---

<objective>
Make the gallery picker hide the calling modal(s) for the duration of import/selection, and restore them when the picker closes — including one level of nesting (image-reference picker opened from Apply Script Reveal).

Purpose: Opening a gallery import from photo-reference or Apply Script Reveal currently leaves every open modal stacked on top of the picker (modals are fixed z-70/72; the picker is absolute z-20 inside the canvas region), so they fight for space. Visibility must be coordinated at the render seam.

Diagnosis verdict (light diagnose, done at planning time): modal visibility is coordinated by **independent boolean signals** — `referenceDialogOpen`, `scriptPickerIntent`, the PlayScript controller's `confirmationOpen`, and each `useBackgroundAssetPickerController`'s own `open` — not by a state machine. `PhysicsPaintStudioView` renders all five surfaces unconditionally side-by-side; nothing hides parents when a picker opens. XState exists in this repo only in `pilot/finalizationMachine.ts` / `pilot/finalizationQueue.ts` (stroke finalization) and does NOT own this UI — per the quick's guardrail, no second orchestration style is introduced. The root is **not structural** (no modal-stack machine is required), so the STOP-and-report clause does not trigger.

Output: a single derived picker-open visibility gate at the view seam, a RED-first behavioural test pinning it, and updated source-shape pins.
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

- Render seam: `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` lines ~323-342 render the five surfaces independently: backgroundPicker and referencePicker overlays (323-324), `<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />` (338), `{referenceDialog ? <PhysicsPaintPhotoReferenceDialog {...referenceDialog} /> : null}` (340), `{scriptPickerDialog?.open ? <PhysicsPaintScriptPickerDialog {...scriptPickerDialog} /> : null}` (342). The component body has no hooks — it is a plain function invokable in a node test harness.
- The view receives `backgroundPicker` and `referencePicker` controller props (each exposes an `open` signal) alongside the parent dialog props. The gate is computed in this one file: `pickerOpen = Boolean(backgroundPicker?.open || referencePicker?.open)`.
- Parent signal owners live in `PhysicsPaintStudio.tsx` (`referenceDialogOpen` :422, `scriptPickerIntent` :429, PlayScript controller `confirmationOpen`); openers: `onImportSource` on the photo-reference dialog → `referencePicker.openPicker()` (:4470), `onImportBackground` → `backgroundPicker.openPicker()` (:4559), Reveal "Place a reference…" → `playScript.requestPhotoReference()` → `ports.openPhotoReference` → `referenceDialogOpen.value = true` (:2074). Do NOT touch opener wiring or import confirm/cancel handlers (`handleConfirmReferencePicker` :4428, `handleCancelReferencePicker` :4464) — guardrail: visibility orchestration only.
- CSS: modal roots are fixed, z-70 (PlayScript also has a z-72 rule); `.physics-paint-background-picker` is absolute inset-0 z-20 inside the canvas region. No `.physics-paint-studio > …` direct-child selectors target the modal roots — gating in JSX is CSS-safe. Keep the picker overlay render order/pins untouched.
- Exact source-shape pins in `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` that constrain the edit: :2046 pins the literal `{referenceDialog ? <PhysicsPaintPhotoReferenceDialog {...referenceDialog} /> : null}` and WILL break when line 340 is gated — update that pin in the same task. :900 (`<MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />`) and :1999 (`<PhysicsPaintScriptPickerDialog {...scriptPickerDialog} />`) must keep passing (substring survives gating). Picker overlay pins :1423/:1428/:1433 and :1541/:1544 must remain untouched.
- Tests: vitest collects only `src/**/*.test.ts` (not .tsx); node environment, no jsdom. Run with `pnpm --filter efx-motion-editor exec vitest run <files>` (never watch). Types: `pnpm --filter efx-motion-editor run typecheck`. Existing idioms: node-harness component invocation with vnode walkers as in `PhysicsPaintPlayScriptDialog.test.ts`; source-shape pins via `readFileSync` as in `PhysicsPaintStudio.test.ts`.
- Preact + @preact/signals only — no useState; no backward-compat/migration code. Consult `efx-preact-reactivity` skill rules if touching signals (this plan prefers a plain derived local const in the render, not a new signal).
- Design decision (Claude's discretion): gate by conditional render (`? : null`), matching the existing style on lines 340/342. Unmounting the parent while the picker is open is acceptable — the photo-reference dialog already unmounts on `open=false` (drag offset resets) and PlayScript's focus-restore effect already handles close; parents' own boolean signals are never cleared, so they return with prior intent intact.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — pin parent-modal visibility at the PhysicsPaintStudioView seam</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts</files>
  <behavior>
    - Test 1 (currently RED): invoke `PhysicsPaintStudioView` as a plain function with fake props where `backgroundPicker.open === true` and a parent is open (`referenceDialog` set, `scriptPickerDialog.open === true`, `playScriptDialog` present) — the resulting vnode tree must contain NO `PhysicsPaintPhotoReferenceDialog`, NO `PhysicsPaintScriptPickerDialog`, and NO `PhysicsPaintPlayScriptDialog` nodes; the `BackgroundAssetPickerView` overlay must still be present.
    - Test 2 (currently RED): same props with `referencePicker.open === true` instead — parents still absent (covers the reference-picker nesting path used by Apply Script Reveal).
    - Test 3 (currently RED): picker `open === false`, parents open — all parent modal nodes ARE present (restoration pin).
    - Test 4 (currently RED): both `backgroundPicker.open` and `referencePicker.open` true with both parent modals open — neither parent present (UAT row 3 at the seam).
    - Note: views are plain functions with no hooks in `PhysicsPaintStudioView`'s body, so direct invocation works under the node harness; walk vnodes with the existing `findOne`/`findAll` idiom from `PhysicsPaintPlayScriptDialog.test.ts`. Use `.test.ts` only.
  </behavior>
  <action>Create `app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` as a RED behavioural pin before any production edit. Build minimal props objects matching the component's props interface (referenceDialog, scriptPickerDialog, playScriptDialog, backgroundPicker, referencePicker, plus whatever required props the signature mandates — stub the rest). Invoke the component, walk the returned vnode tree, and assert presence/absence of the parent modal components by tag name or root class (`physics-paint-photo-reference-dialog`, `physics-paint-script-picker-dialog`, `physics-paint-play-script-dialog`) and presence of the picker overlay. Do not modify any production file in this task. Run the test and confirm all four assertions fail for the right reason (parents currently present while picker open) — that failure is the RED state; commit it.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStudioView.test.ts</automated>
  </verify>
  <done>Test file exists; Tests 1/2/4 fail because parent modals render while a picker is open, Test 3 passes or fails only on scaffolding (adjust scaffolding until the ONLY failures are the visibility assertions); committed as the RED pin.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — derive pickerOpen and gate the three parent modal render lines</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx, app/src/components/physic-paint/PhysicsPaintStudio.test.ts</files>
  <behavior>
    - Behaviour: while `backgroundPicker?.open || referencePicker?.open`, the view returns no photo-reference dialog, no script-picker dialog, and no PlayScript dialog vnodes; the picker overlay still renders.
    - Behaviour: when neither picker is open, all previously-conditional parents render exactly as before (gate adds no behavioural change on the closed path).
    - Behaviour: opener booleans (`referenceDialogOpen`, `scriptPickerIntent`, `confirmationOpen`) are untouched — parents reappear with prior state when the picker closes.
  </behavior>
  <action>In `PhysicsPaintStudioView.tsx`, compute a single derived local const `pickerOpen = Boolean(backgroundPicker?.open || referencePicker?.open)` (plain render-time derivation, not a new signal — no render-body signal writes) and extend the three parent render conditions to also require `!pickerOpen`: the PlayScript dialog line (currently unconditional), the referenceDialog conditional, and the scriptPickerDialog conditional. Do not reorder or otherwise alter the backgroundPicker/referencePicker overlay lines — picker overlay ordering pins must keep passing. Do not change import confirm/cancel handlers, opener wiring, z-index/CSS, gallery contents, or which modal opens which picker (visibility orchestration only — guardrail). Then update the broken exact-string pin at `PhysicsPaintStudio.test.ts:2046` to the new gated expression (edit only that pin; leave :900, :1999, :1861, :1423-1433, :1541-1544 untouched). Per D-implicit from the quick: no XState, no second orchestration style, no timing hacks. No backward-compat code.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStudioView.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All four visibility assertions in the new test pass (GREEN); the full existing `PhysicsPaintStudio.test.ts` suite passes with only the :2046 pin updated; `tsc --noEmit` clean; committed.</done>
</task>

<task type="auto">
  <name>Task 3: Full-suite regression sweep before native UAT</name>
  <files>app/src/components/physic-paint/view/PhysicsPaintStudioView.test.ts</files>
  <action>Run the whole vitest suite once to confirm no other source-shape pin or behaviour test broke (other suites read `PhysicsPaintStudioView.tsx` or depend on parent-dialog presence). If an unexpected pin fails, fix the pin ONLY if it asserted the old uncoordinated rendering; never weaken the new visibility test. Do not expand scope. Leave the app ready for the user's native UAT (no server start — user runs live checks themselves).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>Entire suite green; typecheck green; automated-ready for native UAT.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| render props → view | Studio passes controller/dialog props into the view; the gate reads only their `open` state — no untrusted input crosses here |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-fhn-01 | Tampering | PhysicsPaintStudioView parent render gates | low | mitigate | Gate derived from existing controller `open` signals only; no mutation of opener/import handlers (guardrail: visibility orchestration only) |
| T-fhn-02 | Denial of Service | parent unmount while picker open | low | accept | Photo-reference and PlayScript already handle close/unmount (drag-offset reset, focus-restore effect); parents' booleans never cleared, so state returns on close |
| T-fhn-03 | Elevation of Privilege | npm/pip/cargo installs | high | mitigate | No package installs in this plan — package-legitimacy gate not applicable; zero new dependencies |
</threat_model>

<verification>
1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` — visibility behaviour pin passes.
2. `pnpm --filter efx-motion-editor exec vitest run` — full suite green (only `PhysicsPaintStudio.test.ts:2046` pin updated).
3. `pnpm --filter efx-motion-editor run typecheck` — clean.
4. Native UAT (user, after GREEN) — 4 rows:
   - Row 1: photo-reference modal → gallery import → only gallery visible, photo-reference hidden → pick an image → photo-reference returns with the pick applied.
   - Row 2: Apply Script Reveal → image-reference picker → parent (PlayScript) hidden while picker open → pick → parent returns with pick applied.
   - Row 3: both parent modals open at once → gallery import → neither parent visible during the pick → both return afterwards.
   - Row 4 (regression): cancelling a picker restores the parent modal(s) too.
</verification>

<success_criteria>
- Failing RED pin existed before the fix and now passes for the visibility behaviour only.
- No parent modal renders while any gallery picker is open; parents restore on picker close/cancel, one nesting level deep.
- Import semantics, gallery contents, opener wiring, and picker overlay stacking unchanged.
- Full vitest suite + typecheck green; user's 4 native UAT rows passed.
</success_criteria>

<output>
Create `.planning/quick/260923-fhn-quick-4-gallery-picker-hides-the-calling/260923-fhn-SUMMARY.md` when done
</output>
