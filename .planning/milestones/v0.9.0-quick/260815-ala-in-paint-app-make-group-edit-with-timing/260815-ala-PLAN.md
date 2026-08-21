---
phase: quick-260815-ala-in-paint-app-make-group-edit-with-timing
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
autonomous: false
requirements:
  - QUICK-260815-ALA
estimate:
  tokens: 14000
  raw_tokens: 14000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Opening the Paint app Create Group timing surface starts with Frames = 3 and Max unchecked, including when the remembered Group Type is Motion or Static."
    - "Max is a checkbox beside the Frames input, using the same native checkbox interaction and visual treatment as Infinity; checking it disables the Frames input without erasing the last valid finite value, and unchecking it restores that value."
    - "When Max is checked, generation and the requested/effective timing readout use the current available capacity; when unchecked, strict positive-integer validation remains authoritative."
    - "Edit Group and Edit Source Cycle continue to show their accepted source-cycle frame count rather than replacing it with the create-flow default; locked Edit Group source fields remain locked."
  artifacts:
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      provides: "Signal-owned Max state, finite-count preservation, capacity-backed parsing, and the finite 3-frame create default"
    - path: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
      provides: "Frames + Max checkbox row matching the Repeat + Infinity interaction pattern"
    - path: "app/src/components/physic-paint/physicsPaintStudio.css"
      provides: "Shared timing-row checkbox layout and styling for Max and Infinity"
    - path: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts"
      provides: "Controller regression coverage for default, toggle preservation, capacity resolution, and edit-mode prefills"
    - path: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts"
      provides: "Dialog regression coverage for checkbox identity, wiring, disabled state, styling contract, and loop-edit locking"
  key_links:
    - from: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
      to: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      via: "Max checkbox reads the controller Max Signal and invokes only the controller setMax boundary, mirroring Infinity/setInfinity"
      pattern: "setMax"
    - from: "app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts"
      to: "parsedCount, destinationRange, loopReadout, and confirm"
      via: "one computed count authority resolves Max to capacity or parses the preserved finite draft"
      pattern: "parsedCount"
    - from: "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
      to: "app/src/components/physic-paint/physicsPaintStudio.css"
      via: "Frames and Repeat rows share the existing checkbox sizing, accent color, spacing, and label interaction pattern"
      pattern: "physics-paint-play-script-.*-toggle"
---

<objective>
Make the Paint app Group Timing control open at a finite 3-frame value and replace text-entry `Max` with an unchecked native checkbox that behaves and looks like the existing Infinity checkbox.

Purpose: The current controller opens Create Group with `countText = 'Max'`, accepts `Max` as a magic input token, and presents only Repeat as a checkbox-assisted field. The requested interaction makes the common finite value explicit while retaining capacity-filling behavior as a discoverable checkbox. The change must stay inside the established Signals controller and existing dialog/CSS pattern; do not add a second state abstraction or Preact effect synchronization.

Output: Tested controller state semantics, the Frames + Max checkbox UI, and a native visual acceptance checkpoint.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/Users/lmarques/Dev/efx-motion-editor/CLAUDE.md
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
@app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
@app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx
@app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts
@app/src/components/physic-paint/physicsPaintStudio.css
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: RED — pin the 3-frame default and Max checkbox contract end to end</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts</files>
  <behavior>
    - Controller: initial and fresh apply-mode opens expose finite `countText = '3'` with Max off; remembered Motion/Static mode does not change that open-time default.
    - Controller: checking Max preserves the last valid finite count, resolves parsed count/destination/readout/confirm to current capacity, and suppresses finite-count validation while enabled; unchecking restores the preserved value, including after an invalid disabled-field draft.
    - Controller: entering Static uses a 3-frame first-time cycle default while retaining repeat 1 and Infinity off, so the mode transition cannot reintroduce the old 1-frame cycle.
    - Controller: loop-edit and source-edit prefills retain the accepted sourceKeyIds length and leave Max off; their existing repeat/Infinity semantics remain unchanged.
    - Dialog: Timing renders an identifiable Max checkbox beside Frames and an identifiable Infinity checkbox beside Repeat in both Group Types; Max invokes only `setMax`, disables Frames while checked, retains its finite text, and is disabled whenever the Frames source field is locked or the controller is busy.
    - Dialog: helper copy accepts a positive integer rather than advertising a magic `Max` string.
  </behavior>
  <action>Write failing tests before production changes. Extend the existing controller harness assertions and dialog fake controller with the Max Signal, last-finite-count Signal, and `setMax` spy expected by the new public controller contract. Replace tests that encode the old `Max` string default or Static 1-frame cycle with the requested 3-frame finite default. Add focused controller tests parallel to the existing Infinity preservation test, proving Max uses capacity through the real `parsedCount`, `destinationRange`, `loopReadout`, and `confirm` paths rather than through dialog-local substitution. Add edit-mode guards proving `prefillEditMode` preserves actual source-cycle lengths and clears Max. In the dialog suite, stop locating “the checkbox” generically because the Timing card will contain two; locate each control by stable id/label and assert Max/Infinity wiring independently. Add layout/class assertions that Max uses the same row/toggle pattern as Infinity without introducing a new component abstraction. Run only the two targeted files and confirm the new assertions fail for the missing Max contract while unrelated existing assertions remain green.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts</automated>
  </verify>
  <done>The two suites encode all default, toggle, capacity, edit-prefill, accessibility identity, and styling-pattern expectations; the new tests fail against the old production behavior for the expected reasons.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — implement Max as controller-owned checkbox state and reuse the Infinity visual pattern</name>
  <files>app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts, app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    - A fresh Create Group dialog shows Frames `3`, Max unchecked, Repeat `1`, and Infinity unchecked.
    - Checking Max disables only the Frames input and makes all existing downstream count consumers use current capacity.
    - Unchecking Max restores the last valid finite Frames draft; invalid disabled drafts do not replace that saved value.
    - Edit Group keeps its source-cycle count locked; Edit Source Cycle keeps its source-cycle count editable; neither is silently converted to Max.
    - Max and Infinity are distinct accessible checkboxes with matching native appearance and label-click behavior.
  </behavior>
  <action>Implement the controller change with Preact Signals, following `infinity`, `lastFiniteRepeat`, and `setInfinity` directly rather than adding hooks or synchronization effects. Add Max state, a preserved last-valid finite count initialized to `3`, and a `setMax(enabled)` controller method. Make `parsedCount` select current capacity when Max is enabled and otherwise run strict integer parsing; remove acceptance and error/help references for the `Max` text token so the checkbox is the sole Max interaction. Initialize the create/apply count to `3` and Max off, reset both on each fresh `openConfirmation`, and make the first Static default use cycle 3 with repeat 1 and Infinity off. In `prefillEditMode`, set the exact source-cycle length and explicitly leave Max off so accepted edit data wins over create defaults. Preserve every existing capacity, authority-revalidation, generation, loop, and history path by keeping `parsedCount` as their single input.

In the dialog, wrap Frames in a row structurally matching Repeat, add a native checkbox with a stable id such as `physics-play-script-max`, bind it to the Max Signal, and call only `playScript.setMax(checked)`. Disable the Frames input when busy, source-locked, or Max is enabled; disable Max when busy or source-locked. Keep loop-edit locking semantics exact. Update helper copy to positive-integer wording. Reuse/rename the existing row and toggle CSS selectors so both Max and Infinity receive the same 15px accent checkbox, 10px row gap, 7px label gap, cursor, and nowrap behavior; do not introduce a component or unrelated restyling. Ensure generic checkbox tests are made explicit so the added control cannot accidentally redirect Infinity assertions.</action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts</automated>
  </verify>
  <done>Both targeted suites pass; Create Group opens at finite 3/Max off, Max owns capacity selection through the controller, finite value preservation matches Infinity, edit prefills remain authoritative, and the dialog presents two independently tested matching checkboxes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Verify the Group Timing defaults and matching Max/Infinity interaction in the native Paint app</name>
  <what-built>The Paint app Group Timing card now opens at Frames 3 with Max unchecked, and Max uses the same checkbox interaction and visual pattern as Infinity.</what-built>
  <how-to-verify>
    In the native Paint app session you run on your side:
    1. Open Create Group. Confirm Timing shows Frames `3`, Max unchecked, Repeat `1`, and Infinity unchecked.
    2. Confirm Max and Infinity have matching checkbox size, accent color, spacing, label alignment, hover/click target, and keyboard toggle behavior.
    3. Type `5` in Frames, check Max, and confirm Frames becomes disabled while still displaying `5`; uncheck Max and confirm `5` is restored and editable.
    4. Check Max and create a Group where more than 3 frames are available; confirm the generated range fills the available capacity shown by the dialog and the summary/range agree.
    5. Open Edit Group for an existing Group and confirm its real cycle frame count is preserved and locked, while Repeat/Infinity remain editable. Open Edit Source Cycle and confirm its real source-cycle count is preserved rather than reset to 3.
    6. Switch between Motion and Static on a fresh Create Group and confirm the Timing default remains 3 frames rather than changing to the former 1-frame Static cycle.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any mismatch in value, toggle behavior, lock state, generated range, or checkbox appearance.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Dialog input → Signals controller | User-entered frame text and checkbox events cross into generation state and timing calculations. |
| Signals controller → physical publication | Resolved frame count controls staged rendering size and the canonical Group publication range. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QUICK-260815-ALA-01 | Tampering | `setMax` / `parsedCount` | medium | mitigate | Keep capacity resolution inside the controller’s computed count authority; re-use existing confirm-time authority and capacity revalidation, and test that dialog code cannot mutate Max bookkeeping directly. |
| T-QUICK-260815-ALA-02 | Denial of Service | Max-backed frame generation | low | mitigate | Resolve Max only to the already-authorized available capacity and preserve the existing pre-commit capacity comparison; add targeted tests through the real confirm path. |
| T-QUICK-260815-ALA-03 | Spoofing | Max versus Infinity checkbox identity | low | mitigate | Give each checkbox a stable distinct id/label and test each handler independently so UI automation and keyboard users cannot activate the wrong timing control. |
</threat_model>

<verification>
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` passes without watch mode.
- Native visual UAT confirms 3-frame defaults, matching Max/Infinity styling, finite-value restoration, capacity-backed generation, and preserved edit-mode source counts.
- No dev server is started by the executor; the user owns the native app session.
</verification>

<success_criteria>
- Create Group Timing defaults to finite Frames 3 with Max unchecked for Motion and Static.
- Max is no longer entered as text; it is a distinct accessible checkbox matching Infinity in interaction and appearance.
- Max on/off preserves finite input and drives the existing count consumers through one controller-owned computed authority.
- Existing Group and Source Cycle edits preserve accepted source-cycle counts and lock states.
- Both targeted Vitest suites pass and native UAT is approved.
</success_criteria>

## Source Coverage Audit

| SOURCE | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | — | Paint Group Timing defaults to 3 frames and exposes Max as an unchecked checkbox matching Infinity | 01 | COVERED | Tasks 1–3 cover state, UI, styling, automated proof, and native UAT. |
| REQ | QUICK-260815-ALA | Atomic quick-task delivery | 01 | COVERED | All implementation and verification are confined to one plan. |
| RESEARCH | — | No research artifact | 01 | COVERED | Quick mode explicitly forbids a research phase; existing code patterns provide sufficient evidence. |
| CONTEXT | — | Match existing Infinity behavior/style; preserve Preact-native project conventions; do not run the server; use `vitest run` | 01 | COVERED | Tasks reuse Signals/setter boundaries and existing CSS, while verification uses `pnpm vitest run` only. |

<output>
Create `.planning/quick/260815-ala-in-paint-app-make-group-edit-with-timing/260815-ala-SUMMARY.md` when done.
</output>
