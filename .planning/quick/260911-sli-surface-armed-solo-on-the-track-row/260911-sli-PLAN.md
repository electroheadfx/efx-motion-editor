---
phase: quick-260911-sli
plan: 260911-sli
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
autonomous: true
requirements: [TML-04]
estimate:
  tokens: 25000
  raw_tokens: 25000
  tasks: 2
  confidence: medium
must_haves:
  truths:
    - "A track whose document solo flag is armed shows a visible solo indicator on its own row (a badge beside the name + the chip's pressed treatment) even while the ⋯ tools panel is closed."
    - "The row solo chip's pressed state (class / aria-pressed / title) reflects the track's own document `solo` flag — the same flag its click toggles and the same flag `participatingPaintTracks` filters the composite on — never the session-only playback arm signal."
    - "The session-only solo arm (playback pill 'Solo selected Rails', physicsPaintSoloArm) keeps its own pill visual and its playback frame-enumeration filter untouched; the track row no longer reflects it."
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx — `solo` prop on the row header; always-visible badge; chip bound to the prop
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx — passes `solo={track.solo}` for paint rows
    - app/src/components/physic-paint/physicsPaintStudio.css — `.physics-paint-track-row-solo-badge` styles in the armed accent family
    - app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts — doc-flag chip binding + badge cases; session arm no longer affects the row
  key_links:
    - "Row chip click → strip `handleToggleSolo(trackId, !track?.solo)` (PhysicsPaintWorkflowStrip.tsx:1637) → Studio `handleToggleSolo` → `setTrackSolo` writes document `solo` (efxPaintStore.ts:366) — the same flag `participatingPaintTracks` (efxPaintHideSolo.ts:37) filters the preview monitor composite and the playback flattened composite on. The chip's visual must read that flag."
    - "Badge reads `track.solo` from the column's `tracks` bundle (`InternalPaintTrack.solo`, efxPaintDocument.ts:79) — pure prop flow, no new store reads, no signals."
    - "The row must NOT read `isSoloArmed()` (physicsPaintSoloArm) — that session arm stays exclusive to the playback pill visual and the getFrames solo window (PhysicsPaintStudio.tsx:1723)."
---

<objective>
Surface an armed per-track solo on the track row itself.

Provenance — debug session `playback-shows-only-last-layer`, resolved 2026-09-11 (commit `d02e9330`): an armed document solo on the top paint track, settable only inside the track row's collapsed ⋯ panel, silently filtered the lower track out of BOTH surfaces (Studio preview monitor composite and playback flattened composite) and read as a compositing regression. `solo` is a persisted document field (efxPaintDocument.ts:79), so the invisible arming survived save/reopen. The compositor, decode paths, and quick 260911-g1g are all innocent. The user's verdict: "an armed solo must be visible on the track row itself (badge/highlight), not only inside the collapsed panel."

Two defects to fix, one surface:
1. No row-level visibility — the armed state exists only inside the collapsed ⋯ panel.
2. Wrong binding even there — the chip's armed visual reads `isSoloArmed()` (the session-only playback arm signal, a different feature) instead of the document `solo` flag its own click toggles; the row also never reflects `track.solo`, so a persisted-armed solo has no indicator anywhere.

Out of scope, do not touch: `physicsPaintSoloArm.ts` (session arm module), the playback pill's own armed visual, the getFrames solo filter seam, `participatingPaintTracks`, `resolvePhysicPaintTrackVisibility`, and the retired Studio surfaces of the debug session. No new dependencies.

Purpose: make the flag that filters the composite self-evident on the row.
Output: row badge + chip binding in PhysicsPaintTrackRow.tsx, prop flow in physicsPaintTrackHeaderColumn.tsx, badge styles in physicsPaintStudio.css, updated contract cases in physicsPaintTrackHeaderColumn.test.ts.

Native UAT (user-run, after execution): the new badge rows PLUS the pending 260911-g1g 3-track hide/solo scenario, folded here per the user — see <human_verification>. The executor leaves it explicitly pending and must not claim native UAT passed.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx
@app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx
@app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts
@app/src/components/physic-paint/view/physicsPaintSoloArm.ts
@.planning/debug/resolved/playback-shows-only-last-layer.md

Current code facts (verified 2026-09-11):
- `PhysicsPaintTrackRowHeader` (PhysicsPaintTrackRow.tsx:783) renders the standing controls (grip, eye, blend, label, more-button) and the tools panel `.physics-paint-track-row-tools` (solo/copy/trash), revealed only when `data-tools-open='true'` (physicsPaintStudio.css:4866-4898) — the chip is therefore invisible while collapsed.
- The chip (PhysicsPaintTrackRow.tsx:987-999) reads the imported `isSoloArmed()` (line 31 import; session signal) for class/aria/title and routes `onToggleSolo?.(trackId)`.
- The column maps tracks (physicsPaintTrackHeaderColumn.tsx:181-208) — `track.solo` is available but not passed.
- Test `physicsPaintTrackHeaderColumn.test.ts:629-661` pins the current (wrong) binding: "the armed state reflects the module-level solo arm (D-20)". This test is expected to change — the row's contract is now the document flag.

Guardrail — working tree state: ~10 files of uncommitted stall instrumentation (physicPaintStore.ts, PhysicsPaintStudio.tsx, physicsPaintPerformanceTrace.ts/.test.ts, frameLru.ts, projectStore.ts, physicPaintBridge.ts, physicsPaintBridgeTransport.ts, PhysicsPaintCanvasMount.runtime.test.ts, src-tauri commands/mod.rs + lib.rs + debug_capture.rs) MUST NOT be staged into this quick's commits. Stage only this quick's four files (plus GSD artifacts). The instrumentation stays uncommitted for the perf workstream.

Command conventions (proven in this repo):
- Targeted: `pnpm --filter efx-motion-editor exec vitest run <path>`
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` (long — run in the background, resume only on completion)
- Types: `pnpm --filter efx-motion-editor exec tsc --noEmit`
- Never run vitest in watch mode (project law).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Bind the row solo chip to the document flag and add the always-visible row badge (RED → GREEN)</name>
  <files>app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts, app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx, app/src/components/physic-paint/view/physicsPaintTrackHeaderColumn.tsx</files>
  <behavior>
    In `physicsPaintTrackHeaderColumn.test.ts`, rewrite the case "routes hide and solo toggles to onToggleVisible/onToggleSolo and reflects the solo arm state (TML-04 surface)" (lines 629-661) into the new contract, using the existing strip harness + `makeRegisteredFixture()`:
    - Fixture with default tracks (solo false): the row chip carries NO armed class, `aria-pressed` is false-string, and NO element with class `physics-paint-track-row-solo-badge` exists in the row.
    - Fixture with `trackA` spread as `solo: true` (and the document re-registered with that track): the row chip carries `physics-paint-track-row-solo-armed` and `aria-pressed` true-string, and the row contains the badge (`physics-paint-track-row-solo-badge`); clicking the chip still routes `onToggleSolo(fixture.trackA.id)`.
    - Session-arm regression contract: call `toggleSolo()` (from `./physicsPaintSoloArm`) — the chip's armed class and the badge do NOT appear on a solo-false row (the row no longer reflects the session arm); `disarmSolo()` in a `finally`.
    - Preserve the eye-toggle routing assertion from the old test.
    Pre-fix this MUST fail (no badge exists; the session-arm case asserts the old binding) — capture the failing run as the RED proof.
  </behavior>
  <action>
    RED first: rewrite the test as specified, run `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts`, and record the failure. Then implement:
    - `PhysicsPaintTrackRow.tsx`: add `readonly solo?: boolean` to `PhysicsPaintTrackRowHeaderProps` (default false in the destructure). Rebind the chip's class / `aria-pressed` / title to the prop. Remove the now-unused `isSoloArmed` import (verify no other use in the file). Render a badge AFTER the label span (still inside the standing-controls row, OUTSIDE `.physics-paint-track-row-tools`): `{solo ? <span class="physics-paint-track-row-solo-badge" aria-hidden="true" title={`Solo armed — other tracks are filtered from the preview and playback`}>S</span> : null}`. Extend the header `aria-label` to `Select track ${label}${solo ? ' (solo armed)' : ''}`.
    - `physicsPaintTrackHeaderColumn.tsx`: pass `solo={track.solo}` on the paint-row `PhysicsPaintTrackRowHeader` (line ~182). The Background row is untouched.
    - Do not import or read `physicsPaintSoloArm` anywhere in these two files after the change.
    Re-run the targeted file: all tests green. Commit: `test(260911-sli): pin doc-solo row badge and chip binding (RED)` then `fix(260911-sli): surface armed solo on the track row, bind the chip to the doc flag`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts</automated>
  </verify>
  <done>The chip's armed class / aria-pressed / title follow the row's document solo flag; the badge renders on solo-armed paint rows only; the session arm no longer affects the row; the eye and solo click routings are still asserted; the targeted file passes; the RED run for the new contract was recorded.</done>
</task>

<task type="auto">
  <name>Task 2: Badge styles + full gates</name>
  <files>app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    Add `.physics-paint-track-row-solo-badge` styles next to the existing solo chip block (~physicsPaintStudio.css:4783): a compact always-visible indicator chip in the armed accent family — border `#6f90ff`, background `#2f3a4d`, color `#ffffff`, 18px-ish height matching the chip family (18px), 5px radius, 10px / 800 weight, `flex: 0 0 auto`, small horizontal padding, non-interactive (no cursor pointer, no hover treatment). No new color literals outside the established accent family; no other selector changes.
  </behavior>
  <action>
    Add the CSS block. Then run the app suite and types: `pnpm --filter efx-motion-editor exec vitest run` (background, resume only on completion) and `pnpm --filter efx-motion-editor exec tsc --noEmit`. If any unrelated suite goes red, investigate rather than paper over — the quick must not absorb other threads' uncommitted instrumentation (do not stage those files). Commit: `style(260911-sli): solo badge chip styling`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>Badge styles exist in the accent family; the full app suite passes (0 failed) and `tsc --noEmit` is clean; no instrumentation file was staged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Presentational change over in-memory document state; no network, no I/O, no installs, no new runtime surface. The integrity surface is that the row indicator reflects the same flag the compositor filters on. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260911-sli-01 | Integrity | Row chip visual vs document flag | medium | mitigate | The rewritten contract test pins the chip's armed class/aria and the badge to the row's `solo` prop, and pins that the session arm no longer affects the row, so the two solos cannot re-conflate silently. |
| T-260911-sli-02 | Tampering | Scope discipline vs uncommitted instrumentation | medium | mitigate | Stage only the quick's four files; scope gate below; full-suite + tsc as the backstop. |
| T-260911-sli-SC | Tampering | npm/pnpm installs | low | accept | No dependency changes — no package-legitimacy gate required. |
</threat_model>

<verification>
- Targeted gates: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTrackHeaderColumn.test.ts` — green, including the new badge and binding cases.
- RED proof: task 1 recorded the pre-fix failing run in the quick SUMMARY.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — 0 failed (background; resume only on completion).
- Types: `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
- Scope gate: `git diff --name-only --cached` for this quick shows only the four listed files (plus GSD artifacts); the ~10 uncommitted instrumentation files remain unstaged and unmodified by this quick.
- Law check (by reading the diff): the chip's pressed state and the badge both read the row's `solo` prop; no `physicsPaintSoloArm` import remains in the two view files; `participatingPaintTracks` and `resolvePhysicPaintTrackVisibility` untouched.
</verification>

<human_verification>
Native UAT — OWED BY THE USER after execution; the executor must leave it pending, never claim it passed.

New rows (armed-solo visibility):
1. Open EFX Paint Studio with two paint tracks, both holding paint; confirm the composite shows both.
2. On the top track, open its ⋯ panel and click S (solo). Close the panel. Expected: a visible S badge sits on that track's row (panel closed), the lower track leaves the preview AND playback (the locked truth table), and the chip inside the reopened panel reads pressed.
3. Click S again: the badge disappears and the lower track returns everywhere.
4. Reopen the project after step 2 (solo armed, saved): the badge is still visible on the row — the persisted flag now explains itself. Report whether you want solo to persist across reopen (current behavior) or not; that is a separate decision.

Folded 260911-g1g rows (pending hide/solo UAT, 3-track scenario):
5. With at least three internal tracks: Track A visible (no solo), Track B hidden, Track C hidden + soloed. Expected: Track A renders normally in the Studio live surface, the canvas composite, and an exported frame; Track C never appears anywhere (hide is a hard off-switch).
6. With B and C still hidden, solo Track A: only Track A renders. Then unhide Track B: only Track A still renders (B is visible but not soloed). Track C still never appears (hide wins over solo).
7. Confirm Studio and the composite/export output match (WYSIWYG) at every step.
</human_verification>

<success_criteria>
- An armed track solo is visible on the track row itself (badge + chip treatment) with the ⋯ panel closed.
- The chip's pressed state tracks the document `solo` flag it controls; the session arm no longer influences the row.
- `physicsPaintSoloArm` and the pill behavior are untouched; compositor authorities untouched.
- Targeted + full suites green (never watch mode); `tsc --noEmit` clean; only the quick's files committed.
- Native UAT pending on the user: the four new rows + the g1g 3-track rows.
</success_criteria>

<output>
Create `.planning/quick/260911-sli-surface-armed-solo-on-the-track-row/260911-sli-SUMMARY.md` when done — include the RED run output for the new binding contract, post-fix targeted + full-suite results, and mark native UAT as pending.
</output>
