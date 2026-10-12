---
phase: quick-260924-ffd
plan: 260924-ffd
type: tdd
wave: 1
depends_on: []
files_modified:
  - app/src/components/shared/NumericStepper.tsx
  - app/src/components/shared/NumericStepper.test.tsx
  - app/src/components/shared/NumericInput.tsx
  - app/src/lib/fpsPresets.ts
  - app/src/components/views/SettingsView.tsx
  - app/src/components/project/NewProjectDialog.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
autonomous: true
requirements: []
estimate:
  tokens: 60000
  raw_tokens: 30000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A stepper given only value/onChange/ariaLabel (no step, no presets) emits exactly ±1 on every press and displays integers — no decimal point, no trailing .0."
    - "In preset mode over [6,12,15,24,25,50,60], from 24: + gives 25 then 50, − gives 15 then 12; at 60 the + button and at 6 the − button are visibly disabled (locked decision) — no wrap, never 24.5 or 30; no decimals ever."
    - "Typed commit in preset mode snaps nearest, ties-low: \"30\"→25, \"5\"→6, \"999\"→60, \"24.5\"→24; an off-list live value displays as-is until the first +/− which snaps to the nearest neighbour in direction of travel."
    - "All three fps surfaces (Settings, New Project, Studio strip) render the same preset stepper over one shared FPS_PRESETS list; PROJECT fps writes only projectStore.fps (or the New Project local seed, default 24 per locked decision), STUDIO playback fps writes only the playback hook — neither tier ever writes the other's store (regression guard)."
    - "Explicit decimal steps unchanged: step={0.01} still emits ±0.01 with decimal display; paper grain scale still resolves its 0.5/0.1 bands with free comma-tolerant entry (260923-bcm behaviour, 260924-d6l pins, preserved verbatim)."
    - "Garbage typed input on a classic field rejects and reverts to the pre-edit value (locked decision — pinned, already implemented); a hold that reaches a preset end runs cleanup inside stepBy so module-global coalescing never strands (one undo entry, no cross-action merge)."
  artifacts:
    - app/src/lib/fpsPresets.ts
    - app/src/components/shared/NumericStepper.tsx
    - app/src/components/shared/NumericInput.tsx
    - app/src/components/shared/NumericStepper.test.tsx
    - app/src/components/views/SettingsView.tsx
    - app/src/components/project/NewProjectDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - .planning/quick/260924-ffd-numeric-stepper-contract-integer-1-defau/260924-ffd-RED-EVIDENCE.json
  key_links:
    - "NumericStepper stepBy has a presets branch that precedes resolveStep/step arithmetic, runs end-of-hold cleanup when no further entry exists, and computes per-button end-disabled at render AND in the handlers"
    - "commitStepperInput in preset mode does parse → finite check → nearest-entry snap (ties low) → clamp to list ends; classic path keeps the T-52.2-08 clamp+round contract byte-for-byte"
    - "NumericInput passes presets through and branches its 4-px drag-scrub: list indexing in preset mode, step arithmetic (default step 1) in classic mode"
    - "SettingsView + NewProjectDialog + PhysicsPaintWorkflowStrip all import the single FPS_PRESETS constant (no inline [15,24] or per-site literals remain)"
    - "The playback-fps chain (PhysicsPaintWorkflowStrip → onPlaybackFpsChange → PhysicsPaintStudio.setRotoPlaybackFps → useRotoCachedPlayback.updateFps) never references projectStore, and projectStore.setFps has no caller in physic-paint"
---

<objective>
Rewrite the shared NumericStepper/NumericInput contract to: (1) a classic default where omitting constraints yields exactly ±1 integer stepping, (2) a new first-class `presets?: readonly number[]` mode for fps (next/previous entry, ends clamp with visibly disabled buttons, typed nearest-ties-low snap, direction-of-travel snap from off-list values, no decimals), (3) explicit decimal steps and paper grain scale untouched — then convert all three fps surfaces (Settings, New Project, Studio strip) to one shared FPS_PRESETS list under the two-tier fps law (PROJECT = authoritative output cadence, STUDIO = preview only, never cross-writing), superseding D-24 (fps step 0.5 → OBSOLETE).

Purpose: today's contract forces every caller to declare `step`, the fps field carries an arbitrary 0.5 increment with [15,24] button rows on the project tier — the control cannot express "a fixed menu of legal values with obvious bounds". The redesign makes the classic default honest (no constraints = ±1), gives fps a first-class preset mode shared by all three surfaces, and pins the two-tier isolation so preview fps can never corrupt the exported cadence.

Output: RED-first contract pins (D-24 pins rewritten, not kept green) committed before production edits, FPS_PRESETS in app/src/lib/fpsPresets.ts, preset mode + optional step in the shared components, three converted fps call sites, full-suite green ready for the 8-row native UAT.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/quick/260924-ffd-numeric-stepper-contract-integer-1-defau/260924-ffd-CONTEXT.md
@.planning/quick/260924-ffd-numeric-stepper-contract-integer-1-defau/260924-ffd-RESEARCH.md

Grounding notes (verified at planning time — trust these, do not re-derive):

- Harness: vitest collects only `src/**/*.test.ts`; the stepper suite lives in `NumericStepper.test.tsx` and runs through the existing launcher `NumericStepper.test.tsx.test.ts` (plain re-import — no new launcher). Node environment, no jsdom; hooks stubbed; vnodes driven by direct invocation via the suite's existing `renderStepper`, `button`, `input`, `pointerDown` helpers. Run: `pnpm --filter efx-motion-editor exec vitest run <files>` (never watch); types: `pnpm --filter efx-motion-editor run typecheck`.
- NumericStepper.tsx (all line refs from RESEARCH [VERIFIED]): `step: number` required at :47 → make optional, default 1 in destructuring. `formatStepperValue` :88-94 (`decimals = precision ?? (step >= 1 ? 0 : 3)` — preset mode must force 0). `clampToStep` :97-103 stays byte-identical for classic/explicit. `parseStepperInput` :110-112 comma-tolerant, untouched. `commitStepperInput` :128-141 returns null on non-finite; `commitInput` :267-275 on null reverts `element.value = display` without calling onChange — reject+revert already exists, needs a strengthening pin. `stepBy` :231-237 is the single funnel (press/hold/keyboard). Hold-to-repeat :239-258: 400ms delay / 60ms interval, `startCoalescing()`/`stopCoalescing()` bracketed.
- NumericInput.tsx: drag-scrub :39-53 (`currentVal + steps * step` then `Math.round(newVal / step) * step`, 4 px threshold, min/max clamp, coalescing brackets); props passthrough :76-84 — must gain `presets`.
- D-24 test pins to REWRITE (NumericStepper.test.tsx): `'moves by exactly 0.5 when the field step is 0.5 (the fps field)'` :156-170 (retarget to a generic subunit-step pin, drop fps framing); comment `/** The Studio workflow strip keeps the fps field on a 0.5 step (D-24). */` :453; `'keeps the Studio fps field on a 0.5 step…'` :542-549 (replace: strip fps element declares presets, NOT step={0.5}); sweep assertion :529-540 must accept `step={` OR `presets={` and its failure message (:538) must drop "D-24: fps 0.5". Sweep list `SWEPT_COMPONENT_PATHS` :444-451 with `toHaveLength(6)` :506 grows 6→8 (add SettingsView + NewProjectDialog) — do this in the SAME GREEN commit as the call-site change (Pitfall 2).
- PRESERVE VERBATIM: clamp-at-ends-when-held :136-154, short-press :172-180, repeat lifecycle :182-207, typed out-of-range clamp :241-247 (KEEP, plus ADD pre-edit revert assertion), always-two-buttons :255-268, component disabled :270-281 — these ARE T-52.2-08. d6l constraint-injection pins :302-427 untouched. Grain pins in PhysicsPaintTopBar.test.ts untouched.
- Call sites: SettingsView.tsx:30-48 `{[15, 24].map…}` → preset stepper on `projectStore.fps` / `projectStore.setFps`. NewProjectDialog.tsx:47 `useState(24)` (default 24 = locked decision, already correct), :167-198 pills → same stepper on local state, seeds `createProject(name, fps, …)` :103. PhysicsPaintWorkflowStrip.tsx:1191-1198 `value={props.playbackFps || props.projectFps || 1}`, `step={0.5} min={1} max={60}` → `presets={FPS_PRESETS}` with min/max becoming list ends 6/60 (off-list display-as-is until first press is contract-covered; leave the `|| 1` fallback — research recommendation).
- Two-tier wiring (already isolated, pin don't refactor): strip onChange :1109-1113 → `onPlaybackFpsChange` → PhysicsPaintStudio.tsx:1953-1956 `setRotoPlaybackFps` = `rotoCachedPlayback.updateFps` — no projectStore reference. Hook clamp `MIN_ROTO_PLAYBACK_FPS = 1` stays 1 (superset safety clamp, A3 — presets never emit below 6; do NOT rewrite useRotoCachedPlayback.test.ts:144-147). projectStore `setFps` :784-787.
- Isolation pin cheapest solid form: source-scan test asserting (a) `projectStore` never appears in PhysicsPaintWorkflowStrip.ts / useRotoCachedPlayback.ts / the setRotoPlaybackFps chain, (b) `projectStore.setFps` has no caller under `src/components/physic-paint/`.
- Pitfalls (research, source-grounded): P1 mid-hold end-button disable can strand module-global coalescing — when `stepBy` detects at-end in preset mode, run press-end cleanup immediately (`clearRepeat(); stopCoalescing(); pressing.current = false`). P2 sweep fails the instant fps drops step={0.5} — rewrite sweep in SAME commit as call-site change. P3 force decimals=0 when presets present. P4 never snap off-list values on render — only in stepBy (direction) and commit (nearest). P5 commit order: parse → finite → nearest ties-low → clamp ends. P6 NumericInput must default step to 1 before the arithmetic formula.
- Commit style: `test(260924-ffd): … — RED` then `feat(260924-ffd): …` / `fix(260924-ffd): …`. RED-evidence JSON pattern: same as 260924-d6l. No package installs; no server starts — user runs live UAT. Preact + @preact/signals only (efx-preact-reactivity rules); no useState additions (NewProjectDialog already uses local fps state — keep as-is, do not convert).
- Call-site tests that exist and may pin old shapes: SettingsView.test.tsx, NewProjectDialog.test.tsx, PhysicsPaintWorkflowStrip.test.ts (each with a `.tsx.test.ts`/`.test.ts` launcher where applicable) — run them; update only assertions pinning the old button-row/step-0.5 shape to the new contract; record any additionally edited file in the summary.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — rewrite D-24 pins and add the new-contract pins</name>
  <files>app/src/components/shared/NumericStepper.test.tsx</files>
  <behavior>
    - Pin 1 (classic default): a stepper rendered with only value/onChange/ariaLabel (no step, no presets) emits exactly 1 on + and −1 on − from an integer base; display format is integer (no "." in formatStepperValue output for the default).
    - Pin 2 (preset walk): stepper with presets=[6,12,15,24,25,50,60] at 24: + → 25, + → 50; − → 15, − → 12; from 60 + emits nothing (button visibly disabled: disabled flag true at render AND handler refuses), from 6 − same; never 24.5/30; integer display forced.
    - Pin 3 (typed commit nearest ties-low): blur-commit "30" → 25, "5" → 6, "999" → 60, "24.5" → 24; an off-list value 30 displays as-is after render, then first + snaps to 50 and first − snaps to 25 (direction of travel).
    - Pin 4 (two-tier isolation, source-scan): PhysicsPaintWorkflowStrip.ts and useRotoCachedPlayback.ts contain no `projectStore` reference; no file under src/components/physic-paint/ calls `projectStore.setFps`; SettingsView/NewProjectDialog fps controls bind to `projectStore.setFps` / local fps state only.
    - Pin 5 (D-24 rewrite): the strip fps element declares `presets={` and does NOT declare `step={0.5}` — RED at birth while the call site still carries step 0.5; the old "keeps 0.5 (D-24)" test and its :453 comment are gone.
    - Pin 6 (garbage revert strengthening): the existing unparseable-typed test additionally asserts `element.value` reverted to the pre-edit display text.
    - Preserve: step={0.01} ±0.01 decimal pin and grain d6l pins stay green throughout (never rewritten to preset semantics); generic subunit-step pin (rewritten from the fps 0.5 test) passes at birth.
    - Hold-end coalescing: a preset-mode hold that runs to the list end stops coalescing (a subsequent independent pushAction creates its own undo entry).
  </behavior>
  <action>Create a new describe block plus the D-24 rewrites in NumericStepper.test.tsx before touching any production file, reusing the suite's helpers and fake timers. Rewrite (not keep green): the fps-0.5 press test → generic explicit-subunit-step pin with no fps framing; the :453 comment and :542-549 test → new contract pin 5; the sweep assertion (:529-540) to accept `step={` OR `presets={` with an updated failure message that does not mention D-24 (list growth 6→8 waits for Task 2's call-site commit). Add pins 1-4, 6 and the hold-end coalescing pin per the behavior block; assertions strict `toBe`. For pin 4, read the named files with node:fs inside the test (source-scan, no imports of stores). Do not modify any production file in this task. Run the suite, record the honest verdict to `.planning/quick/260924-ffd-numeric-stepper-contract-integer-1-defau/260924-ffd-RED-EVIDENCE.json` (`RED_EVIDENCE_OK` when failing pins name the locus; never manufacture red by weakening a passing assertion), commit pins + evidence as the first change.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/shared/NumericStepper.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts</automated>
  </verify>
  <done>All new/rewritten pins exist through the launcher; RED-EVIDENCE.json records failing-pin output (classic-default, preset walk, typed snap, disabled ends, strip-presets, isolation — expected red; subunit/grain pins green); no production file touched; committed first.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — preset mode + classic default in the shared components, FPS_PRESETS, three fps call sites</name>
  <files>app/src/lib/fpsPresets.ts, app/src/components/shared/NumericStepper.tsx, app/src/components/shared/NumericInput.tsx, app/src/components/views/SettingsView.tsx, app/src/components/project/NewProjectDialog.tsx, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx, app/src/components/shared/NumericStepper.test.tsx</files>
  <behavior>
    - Classic default: `step` optional (default 1); no step/presets → exactly ±1 presses, integer display; passing an explicit sub-unit step (0.01/0.5) behaves exactly as today (T-52.2-08 clamp+round, hold-to-repeat, coalescing brackets byte-identical).
    - Preset mode: stepBy walks the list (off-list base snaps to nearest neighbour in direction of travel; base = typed text if parseable else value, existing behavior); ends clamp with per-direction disabled computed at render AND checked in handlePressStart/handlers; end-of-hold cleanup runs inside stepBy when no further entry exists (clearRepeat + stopCoalescing + pressing=false) so coalescing never strands; formatStepperValue forces decimals=0 when presets present; commitStepperInput preset branch: parse → finite → nearest-entry integer-distance snap ties-low → clamp to list ends; garbage → null → revert (classic path unchanged).
    - FPS_PRESETS = [6, 12, 15, 24, 25, 50, 60] as const in app/src/lib/fpsPresets.ts (least-coupled location per discretion; precedent COLOR_GRADE_PRESETS in fxPresets.ts); all three surfaces import it — no inline [15,24] literals remain.
    - SettingsView Frame Rate row → preset stepper bound to projectStore.fps/setFps; NewProjectDialog pills → same stepper on existing local fps state, default 24 (locked decision); strip fps field → presets + min/max 6/60 replacing step={0.5}/min=1/max=60.
    - NumericInput: presets passthrough; drag-scrub in preset mode moves N entries per 4-px threshold clamped at ends; classic mode uses default step 1 in the arithmetic (never NaN).
    - Sweep: SWEPT_COMPONENT_PATHS grows 6→8 (SettingsView + NewProjectDialog added) with the length assertion updated visibly — same commit as the call-site change (Pitfall 2).
    - Invariants: paper grain (resolveStep + freeEntry sole consumer), comma parsing, declared min/max/step of every non-fps field, MIN_ROTO_PLAYBACK_FPS=1 hook clamp, timeline has no fps control — all unchanged.
  </behavior>
  <action>This is one atomic contract cutover (single-plan constraint; splitting would strand red pins across tasks): (1) create app/src/lib/fpsPresets.ts exporting FPS_PRESETS as const. (2) NumericStepper.tsx: make `step` optional with default 1; add `presets?: readonly number[]` to props and to commit options; implement the preset branch in stepBy (before resolveStep/step arithmetic) with direction-of-travel snap, ends detection, and the Pitfall-1 end-of-hold cleanup; per-direction disabled at render checked in handlers (reuse the app's existing disabled-button styling pattern — locked decision: visibly disabled, not silent no-op); force decimals=0 in formatStepperValue when presets present; add the nearest-ties-low branch to commitStepperInput (order per Pitfall 5); update the header docs to state the three-tier contract (classic default / presets / explicit decimal opt-in) with D-24 marked obsolete. (3) NumericInput.tsx: presets passthrough + preset drag branch + default-step-1 guard in the classic formula. (4) Convert the three call sites per behavior; import FPS_PRESETS everywhere. (5) NumericStepper.test.tsx: grow the sweep list 6→8 and update its length assertion. (6) Run the call-site test files; update only assertions that pinned the old button-row / step-0.5 shape, never weakening the Task 1 pins; record any additionally edited file. No new component, no package installs, no changes to non-fps declared constraints, no changes to useRotoCachedPlayback's MIN clamp.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/shared/NumericStepper.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/views/SettingsView.test.tsx.test.ts src/components/project/NewProjectDialog.test.tsx.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>All Task 1 pins green; grain/subunit pins still green; sweep covers 8 files; the three fps surfaces import FPS_PRESETS; typecheck clean; committed.</done>
</task>

<task type="auto">
  <name>Task 3: Full-suite regression sweep and native-UAT handoff</name>
  <files>app/src/components/shared/NumericStepper.test.tsx</files>
  <action>Run the whole vitest suite once to confirm no other suite objected to the contract change (other suites read the shared stepper and the converted call sites; the d6l grain pins and T-52.2-08 clamp/hold/coalesce tests must be green). Fix a failure only when it asserted the pre-contract behavior this quick intentionally changes (e.g. old D-24 fps-0.5 expectations elsewhere) — rewrite that assertion to the new contract in the same style as the Task 1 rewrites; never weaken the new pins or the grain pins. Do not expand scope. Do not start any server — leave the app ready for the user's live checks and surface the 8 native UAT rows in the return message. Record any file edited beyond the frontmatter list in the summary.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Entire suite green; typecheck green; all contract pins passing; the 8 UAT rows listed for the user; automated-ready — not claimed done until live UAT passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| typed field text → commit path | User-typed strings flow through parse → finite check → snap/clamp → onChange; unparseable input must reject+revert, never reach stores |
| call-site props → shared stepper | Each surface injects constraints (step or presets); the shared component must treat each mode as explicit, never ambient |
| preview tier → persisted project state | Studio playback fps changes must never cross into projectStore.fps (export cadence integrity) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ffd-01 | Tampering | commitStepperInput / typed input | medium | mitigate | Single funnel: parse → finite → mode-specific snap/clamp; garbage → null → display revert (pinned Task 1 pin 6); typed text rendered only as the input element's value/display — never injected as HTML |
| T-ffd-02 | Tampering | two-tier fps isolation | high | mitigate | Source-scan pin 4 (no projectStore in playback chain, no setFps caller in physic-paint); UAT rows for both directions; export-cadence UAT row |
| T-ffd-03 | Repudiation | coalesced undo after preset-end hold | medium | mitigate | End-of-hold cleanup inside stepBy (Pitfall 1) + hold-end coalescing pin; T-52.2-08 brackets otherwise untouched |
| T-ffd-04 | Denial of Service | hold-to-repeat timers | low | accept | Existing 400/60ms mechanics unchanged; repeat lifecycle tests preserved verbatim |
| T-ffd-SC | Tampering | npm installs | high | mitigate | No package installs in this plan — package-legitimacy gate not applicable; zero new dependencies |
</threat_model>

<verification>
1. `pnpm --filter efx-motion-editor exec vitest run src/components/shared/NumericStepper.test.tsx.test.ts src/components/physic-paint/view/PhysicsPaintTopBar.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts src/components/views/SettingsView.test.tsx.test.ts src/components/project/NewProjectDialog.test.tsx.test.ts` — all contract pins + grain pins green.
2. `pnpm --filter efx-motion-editor exec vitest run` — full suite green.
3. `pnpm --filter efx-motion-editor run typecheck` — clean.
4. Native UAT (user, after GREEN; user runs the app — do not start a server) — 8 rows:
   - Row 1: preset stepping stops at ends — Studio strip fps at 60: + visibly disabled, no-op; at 6: − visibly disabled; from 24: + → 25 → 50, − → 15 → 12; never 24.5/30/decimals.
   - Row 2: two-tier isolation — change Studio playback fps, Settings fps unchanged (and vice versa).
   - Row 3: Settings Frame Rate = preset stepper over the 7 values bound to project fps; New Project dialog = same stepper with 24 pre-selected (locked decision), seeds the project.
   - Row 4: classic integer field (no constraints) steps 1, 2, 3 with integer display.
   - Row 5: Sidebar Scale 0.01 unchanged (±0.01, decimal display) and paper grain rows unchanged (260923-bcm: bands 1.0→1.5, typed "2,2" → 2.2, free entry in bounds).
   - Row 6: export cadence follows PROJECT fps, not Studio preview fps.
   - Row 7: hold a preset + button across the end, release, then perform an unrelated edit — undo must not swallow it (coalescing never stranded; hold collapses to one undo entry).
   - Row 8: garbage typed commit ("abc") on a classic field reverts to the pre-edit value; usable off-step numeric input still snaps (T-52.2-08).
</verification>

<success_criteria>
- RED-first: all new/rewritten pins committed before any production edit, with an honest RED-EVIDENCE.json; D-24 pins rewritten, not kept green.
- Classic default (no constraints) = exactly ±1 integer; preset mode over exactly [6,12,15,24,25,50,60] with visibly disabled ends, nearest-ties-low typed snap, direction-of-travel press snap; FPS_PRESETS single-sourced by all three surfaces.
- Two-tier isolation proven by source-scan pin and UAT rows; project tier default 24 in New Project (locked decision); garbage reject+revert pinned (locked decision).
- Explicit decimal steps, paper grain (resolveStep + freeEntry sole consumer), T-52.2-08 clamp/hold/coalesce, comma parsing, non-fps declared min/max/step, MIN_ROTO_PLAYBACK_FPS=1 — all unchanged.
- Full vitest suite + typecheck green; user's 8 native UAT rows completed.
</success_criteria>

<output>
Create `.planning/quick/260924-ffd-numeric-stepper-contract-integer-1-defau/260924-ffd-SUMMARY.md` when done
</output>
