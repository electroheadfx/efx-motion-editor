---
phase: quick-261023-bji
plan: 261023-bji
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
autonomous: true
requirements:
  - BJI-01
  - BJI-02
  - BJI-03

estimate:
  tokens: 30000
  raw_tokens: 20000
  tasks: 1
  confidence: low            # zero calibration samples for this quick class; one tightly-coupled presentation slice plus pins

must_haves:
  truths:
    - "With the session Solo armed, every non-target Paint row in the Studio timeline renders with the SAME disabled-track fade as a hidden track (opacity 0.4 + grayscale 0.9), so it reads instantly as not participating in the solo."
    - "The solo target — the active track, rendered as the rich lane — is never dimmed by Solo; only its own eye/hidden state can fade it (existing `physics-paint-lane-hidden` law unchanged)."
    - "The fixed Background row stays at full brightness while Solo is armed, because a Paint solo leaves the Background participating (`backgroundParticipates` ignores the solo target)."
    - "The dimming follows the active-track selection live while armed (selecting another track moves the bright row), and disarming restores every row's full brightness immediately."
    - "The treatment is presentation-only: no document write, no revision/cache-key term, no compositor/export change, and no new signal or effect."
    - "The pinned header column is unchanged: a hidden track's header does not dim today, so exact parity means the solo-muted header must not dim either."
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  key_links:
    - "`isSoloArmed()` is already read in the strip component body (PhysicsPaintWorkflowStrip.tsx line 2568) — that read subscribes the strip to arm/disarm, so passing its value as a row prop re-renders the rows with no new subscription. Do NOT call `isSoloArmed()` inside PhysicsPaintTrackRow (the row is presentational and must stay a leaf)."
    - "The strip renders the active track as `renderActiveLane()` and every OTHER track through `PhysicsPaintTrackRow` (line 5125-5150); the session Solo target is always `props.activeTrackId` (`PhysicsPaintProgramMonitor.tsx` line 150). Therefore every `PhysicsPaintTrackRow` instance is, by construction, a non-target track: the strip passes the dim prop unconditionally there and NOT to the Background row instance."
    - "`participatingPaintTracks(document, soloTrackId)` (`app/src/efx-paint/compositor/efxPaintHideSolo.ts`) is the participation truth table; `backgroundParticipates` is governed only by `document.background.visible`, so the Bg row must not dim."
    - "`PhysicsPaintTrackRow`'s `rowClass` (line 518-523) is the single class-composition point; the existing hidden fade lives in the CSS rule `.physics-paint-track-row-hidden` (physicsPaintStudio.css line 5561). The new selector joins that same rule so the two treatments cannot drift."
    - "`PhysicsPaintTrackRow.test.tsx` is collected only through the existing launcher `PhysicsPaintTrackRow.test.tsx.test.ts` (vitest collects `src/**/*.test.ts`); every verify command must target the launcher."
---

<objective>
Make the Studio timeline show the session Solo focus: when the Solo pill is armed, every non-target Paint track row wears the exact disabled-track grey, so only the soloed (selected/active) track reads as audible.

**Current state (verified in the live tree, 2026-10-23).** One solo concept exists in Studio: the session arm in `app/src/components/physic-paint/view/physicsPaintSoloArm.ts`. The strip already reads it (`const soloArmed = isSoloArmed();`, PhysicsPaintWorkflowStrip.tsx line 2568) and the Program Monitor already filters the composite through it (`soloTrackId = isSoloArmed() ? props.activeTrackId : null`, PhysicsPaintProgramMonitor.tsx line 150). The timeline itself gives no cue: non-target rows look identical to participating rows. The persisted per-track `track.solo` field is inert and no row S chip exists (retired 261022-iff).

**Target treatment (state it; do not reinterpret).** The disabled-track visual is `.physics-paint-track-row-hidden` in `physicsPaintStudio.css` (line 5561): `opacity: 0.4; filter: grayscale(0.9)`. The Solo treatment must be literally that pair, applied to every non-target Paint row while the arm is on. Three parity laws:
1. The solo target is the active track, which renders as the rich lane — it is never dimmed by Solo (its own hidden state keeps the existing `physics-paint-lane-hidden` behavior).
2. The fixed Background row never dims: a Paint solo leaves the Background participating (`backgroundParticipates` ignores the solo target). Dimming it would be a lie.
3. The pinned header column never dims: a hidden (`visible === false`) track's header stays full-brightness today, so "exactly like disabled" excludes the header.

Purpose: the artist can see at a glance which track is soloed without reading the pill or the capsule.
Output: one presentational prop (`soloDimmed`) on the row, one strip wiring line, one grouped CSS selector sharing the hidden fade, and regression pins (strip-level behavior + row-level class/CSS parity).

**Scope fences:** no change to `physicsPaintSoloArm.ts`, the Solo pill, the Program Monitor, the participation truth table, the store, the compositor, document/persistence, the header column, or the Background row. No new dependencies; no dev-server runs; no pushes; atomic local commits; Preact + @preact/signals only (no useState, no new signal, no effect); vitest `run` only (never watch); typecheck compared against a baseline recorded before editing.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/261022-iff-one-global-solo-button-1-replace-the-sol/261022-iff-PLAN.md
@.planning/quick/261022-mne-solo-track-is-not-persistent-when-i-chec/261022-mne-PLAN.md

Read before editing (paths verified in the live tree on 2026-10-23):
- `app/src/components/physic-paint/view/physicsPaintSoloArm.ts` — the session arm (`isSoloArmed` returns `armed.value`; `toggleSolo`/`disarmSolo`). Reference only; NO edit.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — line 2568 `const soloArmed = isSoloArmed();` (the subscription), the row render block 5123-5172 (active lane in place, `PhysicsPaintTrackRow` for every other Paint track, then the Background row instance), and the Sonar-cap pill at ~1259 (reference only).
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — props interface ~93-168 (`visible` at 107), destructuring ~495-517, `rowClass` 518-523.
- `app/src/components/physic-paint/PhysicsPaintProgramMonitor.tsx` line 150 — proves the solo target is `props.activeTrackId`.
- `app/src/efx-paint/compositor/efxPaintHideSolo.ts` — participation truth table (`participatingPaintTracks` lines 37-52; `backgroundParticipates` lines 54-61).
- `app/src/components/physic-paint/physicsPaintStudio.css` — `.physics-paint-track-row-hidden` 5557-5564, `.physics-paint-lane-hidden` 5566-5569.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` — harness `createWorkflowHarness` 182-266 (re-reads the strip on each `render()`), `makeMultiTrackDocument` 695-701, hidden-fade tests 1000-1035, imports at 42-48.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx` — `materialize` 102-123, `hasClass` 141-143, `cssRule` 150-156, `render` 160-167. Its only collectible entry point is the launcher `PhysicsPaintTrackRow.test.tsx.test.ts`.
- Test collection: `app/vitest.config.ts` includes `src/**/*.test.ts` only.
</context>

<tasks>

<!-- The implementation instructions below name the new class literal verbatim and the negative class assertions; allow those literals. -->
<!-- planner-discipline-allow: LIT -->

<task type="auto" tdd="true">
  <name>Task 1: Dim every non-target Paint row while the session Solo is armed, with the disabled-track fade verbatim</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
    app/src/components/physic-paint/physicsPaintStudio.css
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
    app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx
  </files>
  <behavior>
    Step 0: record the typecheck baseline before editing:
    `pnpm --dir app typecheck > /tmp/bji-typecheck-baseline.txt 2>&1; grep -c 'error TS' /tmp/bji-typecheck-baseline.txt`

    RED first — write these tests BEFORE touching production code, then run the two suites and confirm they fail for the expected reason (no solo-dimmed class, no solo-dimmed CSS selector):
    - In `PhysicsPaintWorkflowStrip.viewport.test.ts`, import `disarmSolo`, `isSoloArmed`, `toggleSolo` from `./physicsPaintSoloArm`; inside `describe('47-01 multi-track row slice')` add `afterEach(() => { disarmSolo(); });` so an armed session can never leak across tests. Add one test that builds a two-track document (`makeMultiTrackDocument(layerId, 'track-b')`), sets `activeTrackId` to `trackB.id`, calls `toggleSolo()`, then `harness.render()`. Assert: the non-active row (trackA) class contains `physics-paint-track-row-solo-dimmed`; the active lane (trackB) class contains `physics-paint-lane` and NOT `physics-paint-track-row-solo-dimmed` nor `physics-paint-lane-hidden`; the Background row class does NOT contain `physics-paint-track-row-solo-dimmed`; the dimmed row still renders its full cell lane (`harness.rowCells(trackA.id).length` greater than 0). Then `disarmSolo()`, `harness.render()` again, and assert the trackA row no longer carries the class.
    - In `PhysicsPaintTrackRow.test.tsx`, add a describe pinning the row itself: `render({ soloDimmed: true })` root carries `physics-paint-track-row-solo-dimmed` and a plain `render()` does not (cast the materialized root to the file's `TestVNode` before `hasClass`); and `cssRule('.physics-paint-track-row-solo-dimmed {')` contains exactly `opacity: 0.4` and `filter: grayscale(0.9)` — the hidden-track pair.
  </behavior>
  <action>
    Implement the presentation slice end-to-end:

    1. `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` — add `readonly soloDimmed?: boolean;` to `PhysicsPaintTrackRowProps` right after `visible` (line ~107), documented as: true while the session Solo is armed; the row is by construction a non-target track (the solo target renders as the active lane), so the strip dims every instance of this row; the Background instance is deliberately never given the prop because a Paint solo leaves the Background participating. Destructure with default `soloDimmed = false` beside `visible = true` (~line 500). In the `rowClass` array (518-523) add `soloDimmed ? 'physics-paint-track-row-solo-dimmed' : ''` next to the existing `physics-paint-track-row-hidden` entry.

    2. `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — in the non-active row JSX (5129-5149), pass `soloDimmed={soloArmed}` immediately after `visible={track.visible}`, with a short comment: 261023-bji — this row is always a non-target track (the Solo focus is the active track, rendered by `renderActiveLane`); the arm value already subscribes this component at line 2568, so no new signal/effect. Do NOT pass the prop to the Background row instance (5152-5169). Do not change the active-lane rendering or the pill.

    3. `app/src/components/physic-paint/physicsPaintStudio.css` — extend the existing hidden-track rule (5557-5564) so `.physics-paint-track-row-hidden` and `.physics-paint-track-row-solo-dimmed` share ONE rule with `opacity: 0.4; filter: grayscale(0.9);`. Update the comment: a hidden Paint track and a session-Solo non-target track wear the exact same fade; the Background row is excluded because a Paint solo leaves it participating. Leave `.physics-paint-lane-hidden` untouched.

    Preact rules: no new state, no new signal, no effect, no store call, no render-body writes. `soloArmed` is already a subscribing read; the row stays presentational and hook-free. Do not reformat unrelated code.

    4. GREEN gate — re-run the two suites (they must pass), then the typecheck comparison against `/tmp/bji-typecheck-baseline.txt` (error count must not increase).
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts</automated>
    <automated>pnpm --dir app typecheck > /tmp/bji-typecheck-task1.txt 2>&1; test "$(grep -c 'error TS' /tmp/bji-typecheck-task1.txt)" -le "$(grep -c 'error TS' /tmp/bji-typecheck-baseline.txt)"</automated>
    <automated>grep -q "physics-paint-track-row-solo-dimmed" app/src/components/physic-paint/physicsPaintStudio.css</automated>
  </verify>
  <done>
    With the session Solo armed, every non-target Paint row carries `physics-paint-track-row-solo-dimmed` and renders the exact hidden-track fade (opacity 0.4 + grayscale 0.9, one shared CSS rule); the active lane and the Background row stay bright; disarming clears the class on the next render. The strip re-renders from the existing `isSoloArmed()` read with no new subscription. Both suites green, no new typecheck errors versus the recorded baseline.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| session arm → row presentation | Studio-only UI state crosses into a CSS class; it must never reach the document, persistence, revision/cache keys, or export. |
| dimmed row → interaction | A dimmed non-target row stays clickable (selection moves the solo focus); the visual must not imply or cause edit-locking. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-bji-01 | Tampering | document / persistence / compositor | high | mitigate | Presentation-only prop and class; no store call, no document write, no revision or cache-key term. The arm module, participation truth table and Program Monitor are untouched. |
| T-bji-02 | Repudiation / usability | dimmed row interaction | medium | mitigate | Dimming mirrors the existing hidden-row treatment, which keeps every cell/rail clickable; the strip test asserts cells remain rendered. Selecting a dimmed row moves the focus (existing `setActiveTrackId` path, unchanged). |
| T-bji-03 | Information disclosure | Background row | low | accept | No secret data; a Paint solo intentionally leaves the Background visible, so the Bg row correctly stays bright. |
| T-bji-SC | Tampering | npm/pnpm installs | high | mitigate | No package installs in this quick; if an install is ever added, the package-legitimacy gate and a blocking human checkpoint apply. |
</threat_model>

<verification>
Automated (run from the repo root, after the task):
- `pnpm --dir app exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx.test.ts`
- `pnpm --dir app typecheck` compared against `/tmp/bji-typecheck-baseline.txt` (no new errors).
- `grep -q "physics-paint-track-row-solo-dimmed" app/src/components/physic-paint/physicsPaintStudio.css`

Live UAT (the user runs these; the work is automated-ready, not done, until they pass):
1. Two Paint tracks with content. Arm Solo on track B. Expected: track A's row fades to the SAME grey as a hidden track (eye off), while track B and the Bg row stay bright.
2. While armed, click track A's row/header. Expected: track A becomes bright (it is now the solo focus) and track B fades; the pill stays armed.
3. Disarm Solo. Expected: every row restores full brightness immediately, with no flicker or leftover grey.
4. With Solo armed, hide a non-target track with the eye, then show it. Expected: the same grey in both states (no double-fade artifact), and the hide/show behavior itself is unchanged.
5. Single-track document. Expected: no row dims (the only track is the target); nothing changes.
</verification>

<success_criteria>
- Non-target Paint rows wear the exact disabled-track fade while the session Solo is armed; the solo target (active lane) and the fixed Background row never dim from Solo.
- The treatment follows selection live and clears on disarm, using the existing `isSoloArmed()` subscription — no new state, effect, or store write.
- Header column, arm module, monitor, compositor and document format are untouched.
- Targeted suites green; no new typecheck errors; all five live UAT rows pass before "done" is claimed.
</success_criteria>

<output>
Create `.planning/quick/261023-bji-feat-when-i-solo-track-in-studio-i-want-/261023-bji-SUMMARY.md` when done.
</output>
