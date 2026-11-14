---
phase: quick-261022-mne
plan: 261022-mne
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/view/physicsPaintSoloArm.ts
autonomous: true
requirements:
  - MNE-01
  - MNE-02
  - MNE-03

estimate:
  tokens: 26000
  raw_tokens: 18000
  tasks: 1
  confidence: low            # zero calibration samples for this quick class; one tightly-coupled edit + source pins

must_haves:
  truths:
    - "Arming Solo and then navigating frames — row-cell clicks, the strip's frame cells, transport previous/next, arrow keys, the ruler scrub — leaves the arm on and the Studio composite filtered to the active track on every frame."
    - "While armed, changing the selection (active track, key rail, loop rail, rail set, spacing proxy, Select All) never ends the arm; the focus follows the new active track (IFF D-04 unchanged)."
    - "A mutation lock — including the script navigation lock that beginOperation/endOperation flips on EVERY frame move — never ends the arm."
    - "The arm still ends on exactly four boundaries: a re-click of the pill, the Escape layer (one Escape, one layer), a launch replacement (new operationId/layerId), and the Studio unmount."
    - "Hide still wins over the arm and an unknown target still fails closed: no participation-path behavior changes in this quick."
    - "No persisted document state, revision term, cache-key term or export path changes; the arm remains session-only and monitor-only."
  artifacts:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/physicsPaintSoloArm.ts
  key_links:
    - "prepareNavigation calls beginOperation (mutationLocked true) and completeNavigation calls endOperation (mutationLocked false), so the previous mutationLock dep-array effect disarmed Solo on every frame navigation. The lock effect must keep push-disarm behavior and drop Solo entirely."
    - "The Studio-unmount disarm must live in its own `useEffect(() => () => { … }, [])`; keeping it in the mutationLocked effect's cleanup re-fires on every lock flip."
    - "clearRotoLoopSelection is the shared clear reached by frame-cell clicks (handleSelectTrackFrame), key/loop rail clicks and selection resets — its disarm was the second navigation-time trigger."
    - "physicsPaintStudioKeyboard.ts keeps the Escape disarm layer ahead of collapseRotoSelection; the collapse handler itself must no longer disarm, so a pointer-driven collapse cannot end the arm."
    - "Exactly two disarm call sites remain in PhysicsPaintStudio.tsx: the launch replacement and the unmount-only cleanup; the keyboard bundle passes the function and is not a call site."
---

<objective>
Fix the reported bug: "Solo track is not persistent: when I check Solo on, moving through frames turns it on and off; it should persist for the whole Studio session."

**Root cause (verified in the live tree, 2026-10-22).** The global Solo arm (261022-iff, `physicsPaintSoloArm.ts`) is a module signal, but `PhysicsPaintStudio.tsx` still carries the pre-IFF 43.6-06 law "any rail-selection change and any mutation-lock entry disarms Solo". Two paths fire on ordinary frame navigation:

1. `prepareNavigation` → `beginOperation` sets `rotoScript.mutationLocked` true; `completeNavigation` → `endOperation` clears it. The effect at the mutation-lock dep array runs a cleanup that calls the Solo disarm on every dep change — so every transport/arrow/cell/RULER navigation disarms the arm once (and the lock-entry branch disarms again).
2. `clearRotoLoopSelection()` calls the Solo disarm; it is reached by `handleSelectTrackFrame` — the click handler for every timeline frame cell — so clicking a frame cell disarms as well. Four further explicit disarms (Select All, plain loop-rail click, set collapse, track-rail click) contradict IFF D-04, which says selecting another track while armed moves the focus instead of ending the arm.

**Design decision (state it; do not reinterpret).** Solo is a session-scoped view focus: it stays armed until a re-click of the pill, the Escape layer, a launch replacement, or the Studio unmount. Frame navigation, playback, selection changes of any kind, active-track changes and mutation locks NEVER disarm it — selecting a different track simply moves the focus (the target is read from `activeTrackId` at composite time). This is the minimal behavior consistent with the IFF model and the user's "persist for the whole Studio session".

Purpose: the arm becomes stable for the whole Studio session, so an artist can solo a track and keep working across frames and rails without re-arming on every move.
Output: five automatic disarm calls removed, one unmount-only disarm added, the arm module doc updated, and source pins that fail before the fix and pin the new law afterwards.

**Scope fences:** no new dependencies; no dev-server runs; no pushes; atomic local commits; Preact + @preact/signals only (no useState); vitest `run` only (never watch); `pnpm --dir app typecheck` is a comparative gate against a baseline recorded before editing. Do NOT touch the participation truth table, the cache key, the compositor, the store, the monitor, the pill's label/disabled law, or the keyboard dispatcher — they are correct and out of scope.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/261022-iff-one-global-solo-button-1-replace-the-sol/261022-iff-PLAN.md
@.planning/quick/261022-iff-one-global-solo-button-1-replace-the-sol/261022-iff-SUMMARY.md

Read before editing (paths verified in the live tree on 2026-10-22):
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the eight current Solo disarm call sites: 683 (launch replacement), 938 (Select All), 1389 + 1392 (mutation-lock effect, entry and cleanup), 2712 (`clearRotoLoopSelection`), 2840 (plain loop-rail branch of `handleSelectRotoLoopClip`), 3841 (`collapseRotoSelection` set branch), 4063 (`handleSelectTrackRail` loop branch). Also line 4075 (the `handleSelectTrackRail` dep array) and 3808 (the keyboard bundle passes the function — keep).
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` (338-366, 876-896) — `beginOperation`/`endOperation` set `mutationLocked` around every `prepareNavigation`/`completeNavigation`, which is why the lock effect fires on frame moves.
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx` (541-567) — a paint row's frame-cell click routes to `handleSelectTrackFrame`; the strip wires the same handler at `PhysicsPaintWorkflowStrip.tsx` (4910).
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.ts` (256-262) — the Escape Solo layer, ahead of `collapseRotoSelection`; NO change.
- `app/src/components/physic-paint/view/physicsPaintSoloArm.ts` — the session arm module (doc update only).
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` (5-10 source loading; 428-437 rail-selection pins; 744-753 the collapse pin that currently asserts a disarm; 755-764 the IFF no-solo-window pins; 996-1003 the mutation-lock pins).
- `app/src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` (390-445) — the Escape-layer order pins; must stay green unchanged.
- Test collection: `app/vitest.config.ts` collects `src/**/*.test.ts`.
</context>

<tasks>

<!-- The implementation instructions below name disarm call sites and negative assertions verbatim; allow those literals. -->
<!-- planner-discipline-allow: LIT -->

<task type="auto" tdd="true">
  <name>Task 1: Keep the session Solo armed through frame navigation and selection changes</name>
  <files>
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    app/src/components/physic-paint/view/physicsPaintSoloArm.ts
  </files>
  <behavior>
    Step 0: record the typecheck baseline before editing:
    `pnpm --dir app typecheck > /tmp/mne-typecheck-baseline.txt 2>&1; grep -c 'error TS' /tmp/mne-typecheck-baseline.txt`

    RED first — add the pins below to `PhysicsPaintStudio.test.ts` BEFORE editing the Studio, and run the suite to see them fail:
    - The mutation-lock effect block (slice from `if (mutationLocked && !isPushCommitInFlight()) disarmPushTool();` through `}, [mutationLocked]);`) must contain no Solo disarm.
    - The `clearRotoLoopSelection` body (slice from `const clearRotoLoopSelection = useCallback(() => {` through `}, []);`) must contain no Solo disarm.
    - The `selectAllRotoKeys` body (slice through `}, [currentFrame, launchContext, rotoKeyRecords, publishOperationResult]);`), the `handleSelectRotoLoopClip` range (through `const handleOpenRotoLoopEdit`), the `handleSelectTrackFrame` range (through `const handleSelectTrackRail = useCallback(`) and the `handleSelectTrackRail` range (through `const navigateLinkedGroup = useCallback(`) must contain no Solo disarm.
    - `collapseRotoSelection` (slice `collapseRotoSelection: () => {` through `toggleShortcuts:`) must contain no Solo disarm; its set branch still contains `if (railSetSelection.value !== null) {\n          railSetSelection.value = null;\n          return;\n        }`.
    - The whole Studio source contains exactly two Solo disarm calls (launch replacement + unmount cleanup) and contains the exact unmount-only shape `useEffect(() => () => {\n    disarmSolo();\n  }, []);`.
    - `physicsPaintSoloArm.test.ts` stays green unchanged; `physicsPaintStudioKeyboard.test.ts` stays green unchanged (the Escape layer is still the user-initiated disarm).
    - After the source edits, the same pins pass and the full suite is green.
  </behavior>
  <action>
    Edit `app/src/components/physic-paint/PhysicsPaintStudio.tsx` at the eight call sites found by text search (line numbers shift; search, do not trust numbers):

    1. Mutation-lock effect (~1379-1394). Keep the push-tool behavior byte-identical. Delete the two Solo lines — the lock-entry disarm and the cleanup disarm — and replace the 43.6-06 comment with: Solo is never disarmed by a mutation lock, because frame navigation rides the same lock (`prepareNavigation` begins a script operation). The effect keeps `if (mutationLocked && !isPushCommitInFlight()) disarmPushTool();` and the cleanup `if (!isPushCommitInFlight()) disarmPushTool();`, deps `[mutationLocked]`. Immediately after it add the unmount-only session boundary as its own effect with an empty dep array and exactly this shape (the pin matches it):
       `useEffect(() => () => {`
       `    disarmSolo();`
       `  }, []);`
       Comment it: the arm survives the whole Studio session — frame navigation, playback, selection changes and mutation locks never end it; only a re-click, the Escape layer, a launch replacement, or this unmount do. Keep every comment inside the edited regions free of the disarm identifier (with or without parentheses): the slice pins assert its absence, and the count pin treats the parenthesized form as a call.

    2. `selectAllRotoKeys` (~938). Delete the 43.6-06 comment and its Solo disarm line. Select All is a selection change; the arm follows the active track.

    3. `clearRotoLoopSelection` (~2709-2716). Delete the 43.6-06 comment and its Solo disarm line. Keep the three selection clears and the empty dep array (an existing pin asserts `selectedLoopClipIds.value = [];\n    loopSelectionAnchorId.value = null;\n    selectedLoopClipId.value = null;`). Add a short comment: rail-selection clears never end the session Solo.

    4. `handleSelectRotoLoopClip`, plain branch (~2836-2840). Delete the 43.6-06 comment block and the Solo disarm line; keep `railSetSelection.value = null;` and the following selection logic.

    5. `collapseRotoSelection` (~3838-3843). Delete the Solo disarm and its 43.6-06 comment from the set-collapse branch; keep `railSetSelection.value = null;` and `return;`. The Escape layer in `physicsPaintStudioKeyboard.ts` already disarms before this handler runs; a pointer-driven collapse must not end the arm.

    6. `handleSelectTrackRail`, loop branch (~4063). Delete the Solo disarm line. Remove `disarmSolo` from that callback's dep array (~4075) — the function no longer references it.

    7. Keep the launch-replacement disarm in `setLaunchContext` (~683) and keep `disarmSolo` in the keyboard action bundle (~3808). Do not touch the import. After the edits the file has exactly two Solo disarm calls.

    8. `app/src/components/physic-paint/view/physicsPaintSoloArm.ts` — rewrite the module doc only (no behavior change): the arm is session-scoped and survives frame navigation, playback, selection changes of any kind, active-track changes and mutation locks; only a re-click, the Escape layer, a launch replacement, or the Studio unmount end it. Keep `isSoloArmed`, `toggleSolo`, `disarmSolo` and their contracts untouched.

    9. `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`. Update the existing collapse test (its title "collapses the set as its own Escape layer before key-selection collapse (D-04)" stays) to the new positive block shape and a no-disarm assertion, per the behavior block. Add the new persistence test with the slices and the count/unmount pins listed above. Use `not.toContain` on the sliced regions; keep the count assertion as `(studio.match(/disarmSolo\(\)/g) ?? []).length` equal to 2. Update the stale 43.6-06 comment in the test to cite 261022-mne.

    Preact rules: no new state, no new subscriptions, no effect that writes signals; the unmount cleanup is the only new effect and it has an empty, stable dep array. Do not reformat unrelated code.
  </action>
  <verify>
    <automated>pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/view/physicsPaintSoloArm.test.ts src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts</automated>
    <automated>test "$(grep -c 'disarmSolo()' app/src/components/physic-paint/PhysicsPaintStudio.tsx)" -eq 2</automated>
    <automated>grep -q 'frame navigation' app/src/components/physic-paint/view/physicsPaintSoloArm.ts</automated>
    <automated>pnpm --dir app typecheck > /tmp/mne-typecheck-task1.txt 2>&1; test "$(grep -c 'error TS' /tmp/mne-typecheck-task1.txt)" -le "$(grep -c 'error TS' /tmp/mne-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    The mutation-lock effect and the five selection/rail paths no longer end the session Solo; the only Studio-side disarm boundaries are the launch replacement, the Escape layer, the pill re-click and the new unmount-only effect. The arm module doc states the persistence law. The new pins fail before the edits and pass after; keyboard Escape-order, arm-lifecycle and program-monitor suites stay green; typecheck shows no new errors versus the recorded baseline.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| session arm → composite path | Local UI state only; it must never reach persisted state, export, or the main preview (unchanged by this quick). |
| Studio session lifetime | The arm must not silently outlive a Studio unmount nor be lost inside a live session; the boundary is the unmount-only effect. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mne-01 | Tampering | persisted document / export | high | mitigate | Only disarm call sites change; no document write, revision term, cache-key term or export path is touched. The launch replacement keeps disarming so a new launch never inherits a stale focus. |
| T-mne-02 | Repudiation / usability | armed Solo with an unclear exit | medium | mitigate | The capsule line `Solo - {active track name}.` and the pill `.active`/aria-pressed stay visible; re-click and Escape remain the documented exits (pinned by the keyboard suite). |
| T-mne-03 | Denial of service | a stale arm hiding every other track | low | accept | By design while armed: the arm is a visibility focus, hide still wins, and the target follows the active track; the capsule names the focused track. |
| T-mne-SC | Tampering | npm/pnpm installs | high | mitigate | No package installs in this quick; if an install is ever added, the package-legitimacy gate and a blocking human checkpoint apply. |
</threat_model>

<verification>
Automated (run from the repo root, after the task):
- `pnpm --dir app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts src/components/physic-paint/view/physicsPaintSoloArm.test.ts src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts`
- `pnpm --dir app typecheck` compared against `/tmp/mne-typecheck-baseline.txt` (no new errors).
- Source gates: exactly two Solo disarm calls in `PhysicsPaintStudio.tsx`; the arm module doc names frame navigation.

Live UAT (the user runs these; the work is automated-ready, not done, until they pass):
1. Two Paint tracks with content. Arm Solo on track A, then navigate frames by every route: click row cells on A, click row cells on B, transport previous/next, arrow keys, and a ruler scrub. Expected: the pill stays armed (tinted, aria-pressed true) for the whole run and only the active track's content shows on every frame — no on/off flicker.
2. With Solo still armed: click a Key Rail, a Loop Rail, a rail set, a spacing proxy, Select All, and the track B header. Expected: the pill stays armed throughout and the focus follows the active track; the capsule shows `Solo - {track name}.` for the newly active track.
3. Exit boundaries: press Escape once with a rail selected — Solo disarms first (one Escape, one layer), selection untouched. Re-arm, click the pill again — disarms. Close the Studio and reopen it — starts disarmed.
4. Hide the active (focused) track while armed — its content does not appear; show it again — it returns. A hidden non-focused track never appears.
</verification>

<success_criteria>
- Solo survives frame navigation (cell clicks, transport, arrow keys, scrub), playback, selection changes of any kind, active-track changes and mutation locks for the whole Studio session.
- Exactly two Solo disarm calls remain in `PhysicsPaintStudio.tsx`: launch replacement and the unmount-only cleanup; the Escape layer and the pill re-click remain the user-initiated exits.
- No persisted document state, cache-key term, compositor or export behavior changes.
- Targeted suites green; no new typecheck errors; all four live UAT rows pass before "done" is claimed.
</success_criteria>

<output>
Create `.planning/quick/261022-mne-solo-track-is-not-persistent-when-i-chec/261022-mne-SUMMARY.md` when done.
</output>
