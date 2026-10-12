---
phase: quick-260919-sns
plan: 260919-sns
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/exportEngine.ts
  - app/src/lib/exportEngine.feedback.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 35000
  raw_tokens: 35000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "Clicking Export shows 'Preparing export...' on the next paint (~100 ms), even when the Studio flush takes seconds (Studio closed → the flush promise only resolves at its 5 s timeout; Studio busy → drain wait)."
    - "The flush still completes before frameMap is read (52.1 stale-document protection unchanged), and the frame enumeration / preload predicate / compositor / motion-blur paths are byte-for-byte untouched (D-08/D-09/D-10, WYSIWYG law)."
    - "Staged progress stays truthful end-to-end: Preparing covers flush + frameMap + preflight + directory creation + preload; Rendering covers the frame loop; video formats show Encoding after Rendering; PNG exports show Preparing → Rendering."
    - "A cancel landing during the preparation window is honored at the first checkpoint — never wiped by a later resetProgress (today's latent wipe is repaired by the same hoist)."
    - "The Export button disables at click time (isExporting includes 'preparing'), closing the double-click double-export window that was open during the invisible flush."
  artifacts:
    - app/src/lib/exportEngine.ts — the 'preparing' write hoisted above the flush await; the duplicate reset removed; the old site reduced to the frame-count update
    - app/src/lib/exportEngine.feedback.test.ts — the three feedback-contract cases (immediate preparing, truthful frame counts, cancel during the flush window)
  key_links:
    - "ExportView.tsx:41 onClick → startExport → folder guard → resetProgress + updateProgress('preparing') → await requestPhysicPaintFlush (physicPaintFlush.ts:43, 5 s timeout) → frameMap.peek() — the write MUST precede the first await."
    - "exportStore.progress signal → ExportProgress.tsx:19 (returns null on 'idle') — the modal can only render once status ≠ 'idle'; Preact re-renders during the flush await because the await returns control to the event loop."
    - "preloadCancelCheck interval (exportEngine.ts:216) + render-loop isCancelled (exportEngine.ts:243) — the first checkpoints that honor a cancel clicked during the now-visible preparation window."
---

<objective>
Fix the dead delay between the Export click and the first visible feedback.

Root cause (pinned 2026-09-19 by reading, not speculation — hypothesis (a) from the task brief, confirmed):

1. `startExport` (app/src/lib/exportEngine.ts:131) writes `status: 'preparing'` for the FIRST time at lines 183-188.
2. Before that write, three invisible legs run: `await requestPhysicPaintFlush()` (line 140 — main→Studio event round-trip with a 5000 ms timeout at app/src/lib/physicPaintFlush.ts:43; when the Studio window is closed no flush-result ever arrives, so EVERY export burns the full 5 s; when the Studio is open with queued work it waits for the drain), `frameMap.peek()` (line 142 — `frameMap` is a `computed`, app/src/lib/frameMap.ts:16, so `.peek()` forces synchronous materialization), and the `findUnresolvedExportLoop` preflight (line 172, synchronous).
3. `ExportProgress` (app/src/components/export/ExportProgress.tsx:19) returns `null` while `status === 'idle'`, so the modal cannot appear until line 184 runs — click → dead silence for the flush duration → modal.

Hypothesis (b) — status written but re-render starved by a sync block — is ruled out for the click→preparing gap: no write happens at all before the flush await. Everything after line 188 (directory IPC, `preloadExportImages`) is await-based and already yields.

Latent defect found while pinning: a `cancel()` landing during the invisible window is wiped by the `resetProgress()` at line 183 (it resets `cancelled` to false AFTER the flush resolves). The same hoist repairs it; test case 3 pins the repaired behavior.

Fix (smallest seam, semantics-preserving): move `resetProgress()` + `updateProgress({ status: 'preparing' })` to immediately after the cheap output-folder guard (line 136), BEFORE the flush await. The flush await yields to the event loop, so Preact's scheduled re-render and the browser paint happen during the flush — modal visible within ~100 ms of click. At the old site, delete the moved `resetProgress()` and reduce the update to `{ totalFrames, currentFrame }` (status is already 'preparing'; no redundant same-status rewrite per the idempotent-setter discipline).

Out of scope (do not touch): the flush itself (timeout, round-trip, 52.1 stale-document protection), frame enumeration, the preload predicate, the compositor/render path, motion-blur accumulation, D-08/D-09/D-10 behaviors, the ExportProgress modal markup, the folder-missing guard order (stays first — its error surface is byte-identical to today), the resume-path outputPath read at line 194 (pre-existing quirk, not this quick), and any shorten-the-timeout idea (that would be an export-semantics change).

Purpose: truthful immediate feedback — the flush IS preparation, so 'Preparing export...' over it is the honest stage.
Output: a RED-pinned feedback contract + the hoisted write + green export suites.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@app/src/lib/exportEngine.ts
@app/src/lib/physicPaintFlush.ts
@app/src/stores/exportStore.ts
@app/src/components/export/ExportProgress.tsx
@app/src/components/views/ExportView.tsx
@app/src/lib/exportEngine.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — pin the export feedback contract</name>
  <files>app/src/lib/exportEngine.feedback.test.ts</files>
  <behavior>
    New file `app/src/lib/exportEngine.feedback.test.ts`, node env, vitest run only, no jsdom, no config changes. Harness discipline: copy the ENTIRE mock block and canvas harness verbatim from app/src/lib/exportEngine.test.ts (the hoisted fm/sequences/activeSequenceId/projectWidth/projectHeight object; the `./ipc`, `./frameMap`, `../stores/sequenceStore`, `../stores/projectStore`, `../stores/audioStore`, `../stores/soloStore`, `./audioEngine`, `./exportSidecar`, `./audioExportMixer`, `@tauri-apps/api/window`, `../stores/paintStore` mocks; the `./exportRenderer` mock with `preloadExportImages: vi.fn(async () => {})`; the RecordingCanvasContext / TestCanvas classes and their `vi.stubGlobal('document', …)` wiring), then ADD one mock the existing file does not carry: `vi.mock('./physicPaintFlush', () => ({ requestPhysicPaintFlush: vi.fn(() => new Promise<boolean>((resolve) => { hoisted.flushResolve = resolve; })) }))` with `flushResolve: null as null | ((value: boolean) => void)` added to the hoisted object. The deferred MUST be a bare promise — no setTimeout inside it.

    Fixtures (beforeEach): `hoisted.fm = [{ kind: 'content', globalFrame: 0, sequenceId: 'seq-1', keyPhotoId: 'kp', imageId: '', localFrame: 0 }]` (the exact content-entry shape from exportEngine.loops.test.ts:303-310); `hoisted.sequences = [{ id: 'seq-1', name: 'Seq', kind: 'content', fps: 24, width: 4, height: 3, keyPhotos: [], layers: [] } as Sequence]`; `hoisted.flushResolve = null`; `_setPhysicPaintMarkDirtyCallback(() => {})`; `physicPaintStore.reset()`; `resetEfxPaintStore()`; `exportStore.resetProgress()`; `exportStore.outputFolder.value = '/tmp/efx-export-feedback'` (direct signal write — the established pattern from exportEngine.test.ts's beforeEach; never `setOutputFolder`, which would hit the mocked ipc surface).

    `describe('export feedback immediacy (260919-sns)')`:
    - "writes 'preparing' synchronously on click, before the flush resolves": call `const p = startExport()` WITHOUT awaiting; assert `exportStore.progress.peek().status` is `'preparing'` immediately (synchronously — no tick, no await). Then `hoisted.flushResolve!(true)`; `await p`; assert final status is `'complete'` (proves the pipeline still proceeds after the flush). RED today: the first assertion sees `'idle'`.
    - "keeps frame counts truthful once the frame map is known": same drive; after `await p` completes, assert `exportStore.progress.peek().totalFrames === hoisted.fm.length` (1) — pins that the moved write did not drop the frame-count update. RED today on its first 'preparing' assertion.
    - "honors a cancel clicked during the flush window at the first checkpoint": call `const p = startExport()`; assert status `'preparing'`; then `exportStore.cancel()`; then `hoisted.flushResolve!(true)`; `await p`; assert final status is `'cancelled'`. RED today for a second, independent reason: on current code the cancel lands during the invisible window and is then WIPED by the resetProgress at old line 183, so the export runs to `'complete'` — this case pins both the visibility and the repaired cancel survival.
  </behavior>
  <action>
    Write the test file exactly per `<behavior>` and run the targeted command to capture the RED proof: all three cases must fail against today's code (cases 1-2 on the `'idle'` vs `'preparing'` assertion; case 3 on `'complete'` vs `'cancelled'`). Do not weaken or delete a case to get a green run; the failing run is the expected RED and must be recorded verbatim (command + failure summary) in the SUMMARY. Leave every production file untouched — Task 2 owns the only production edit. Do not add fixtures beyond the one content entry / one content sequence listed; the preflight is a no-op on a layers-empty content sequence and must stay so. Commit: `test(260919-sns): RED — export click gives no feedback until the flush resolves`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/lib/exportEngine.feedback.test.ts</automated>
  </verify>
  <done>The new file carries the three cases; the run shows all three failing against the pre-fix source (RED proof captured verbatim in the SUMMARY: two 'idle'-vs-'preparing', one 'complete'-vs-'cancelled'); no production file was modified in this task.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — hoist the 'preparing' write above the flush await</name>
  <files>app/src/lib/exportEngine.ts</files>
  <action>
    In `startExport` (app/src/lib/exportEngine.ts), make exactly this reordering and nothing else:
    1. Immediately after the output-folder guard (the block ending at line 136) and BEFORE the `await requestPhysicPaintFlush()` statement (line 140, keep its 52.1 comment), insert: `exportStore.resetProgress();` then `exportStore.updateProgress({ status: 'preparing' });`. Two separate statements, matching the existing call style.
    2. At the old site (lines 183-188): delete the now-duplicate `exportStore.resetProgress();` line, and reduce the surviving update call to carry only `totalFrames: total` and `currentFrame: startFromFrame` — remove the `status: 'preparing'` field (already set above; a redundant same-status rewrite would be a needless notification per the idempotent-setter discipline). Keep the frame-count update at its current position, after the preflight and dimension computation — do not move it up next to `total`.
    Do not touch anything else in the file: the flush call, frameMap read, selectedSequenceOnly filter, empty-timeline guard, preflight, dimension math, directory creation, canvas/renderer creation, preload + its AbortController leg, the render loop, motion blur, the encoding/download branches, sidecar/audio/notification legs, the catch block, and resumeExport all stay byte-identical. Do not shorten the flush timeout, do not skip the flush when the Studio is closed, do not add any new cancel plumbing — the existing preload interval (line 216) and frame-0 render-loop check (line 243) are the checkpoints that honor an early cancel.

    Correctness invariants the executor must re-verify by reading the final file before running tests (state the verdicts in the SUMMARY): (a) the folder guard still runs before any progress write, so its error surface is unchanged; (b) the flush await still precedes the frameMap read — stale-document protection intact; (c) between the hoisted write and the frame-count update, the only exits are the empty-timeline and preflight error returns, which set status 'error' and return — so status is always still 'preparing' when the frame-count update runs; (d) no `isCancelled()` read exists between the two write sites, so moving the `cancelled` reset earlier is unobservable inside this export; (e) resumeExport reads `resumeFromFrame` before calling startExport, so the earlier reset cannot eat it; (f) the `outputPath` read at the resume-reuse branch keeps its pre-existing relative order after the reset (unchanged behavior, quirk untouched).

    Then run the Task 1 file green (all three cases flip), then the full export engine suite, then types. Commit: `fix(260919-sns): show 'Preparing export...' at click time, before the Studio flush`. No UAT claims — native UAT stays pending (see `<human_verification>`).
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-motion-editor exec vitest run src/lib/exportEngine.feedback.test.ts src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/exportEngine.paintEnumeration.test.ts && pnpm --filter efx-motion-editor exec tsc --noEmit</automated>
  </verify>
  <done>All three feedback cases pass; the three pre-existing export engine suites pass with zero regressions; `tsc --noEmit` is clean; the diff of exportEngine.ts shows only the two-site reordering (write hoisted, duplicate reset removed, frame-count update slimmed) with every other line untouched; the six correctness invariants are answered in the SUMMARY.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | Pure sequencing reorder of two store writes inside `startExport`; no IPC shape change, no filesystem surface change, no network, no package installs. The flush round-trip's timing, timeout, and payload are untouched. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-260919-sns-01 | Tampering | startExport ordering (exportEngine.ts:131-188) | medium | mitigate | The reorder is bounded by construction: the flush still precedes the frameMap read, and the six executor-verified invariants (Task 2 action a-f) plus the three RED-pinned cases fail if the guard order, flush order, cancel survival, or frame-count truthfulness drift. |
| T-260919-sns-02 | Denial of service | Export button re-entry during the flush window | low | mitigate | The hoist makes `isExporting` true at click time, so ExportView.tsx:42's `disabled` binding closes the double-click double-export window instead of opening a new one. |
| T-260919-sns-03 | Information disclosure | Progress surface content | low | accept | The modal shows the same fixed stage labels and frame counts as today; the hoist changes WHEN they appear, not what they carry. No new data reaches the UI. |
| T-260919-sns-SC | Tampering | pnpm installs | low | accept | No dependency changes in this plan — no package-legitimacy gate required. |
</threat_model>

<verification>
- RED proof: the SUMMARY carries the failing Task 1 command output (three failed cases: two 'idle'-vs-'preparing', one 'complete'-vs-'cancelled').
- Targeted gate: `pnpm --filter efx-motion-editor exec vitest run src/lib/exportEngine.feedback.test.ts` — green after Task 2.
- Export regression gate: `pnpm --filter efx-motion-editor exec vitest run src/lib/exportEngine.test.ts src/lib/exportEngine.loops.test.ts src/lib/exportEngine.paintEnumeration.test.ts` — 0 failures (the D-08/D-09/D-10 and WYSIWYG pins live here; they must not move).
- Types: `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` (long — background it if the runtime allows and resume only on completion) — 0 new failures; the known pre-existing red suites named in .planning/STATE.md Blockers (roto persistence x7, ipc base64 token, efxPaintPersistence base64) are attributed by name, never silently absorbed and never fixed here.
- Scope gate: `git diff --name-only` lists only this plan's two files plus `.planning/` artifacts.
- Law check (by reading the diff, not grep): exactly two regions of exportEngine.ts changed — the hoisted write after the folder guard and the slimmed frame-count update at the old site; the flush, frameMap read, preflight, preload predicate, render loop, and encoding paths are byte-identical.
</verification>

<human_verification>
Native UAT — OWED BY THE USER after execution; the executor must leave it pending and never claim it passed.
1. Studio window CLOSED: click Export on a paint project. Expected: 'Preparing export...' appears essentially instantly and stays through the preparation seconds (the flush burns its timeout here), then 'Rendering frame N of M'.
2. Studio window OPEN with fresh unflushed strokes: click Export. Expected: 'Preparing export...' visible during the drain, then Rendering.
3. Click Cancel while 'Preparing export...' is showing. Expected: the export cancels at the first checkpoint and the modal shows 'Export cancelled' (never runs on to completion).
4. PNG-sequence export: stages shown are Preparing → Rendering → complete. Video export: Preparing → Rendering → Encoding → complete.
5. WYSIWYG spot check: re-export a project exported before this fix and compare outputs — frames must be identical (D-05).
</human_verification>

<success_criteria>
- Click Export → 'Preparing export...' visible within ~100 ms, regardless of flush duration.
- Stage transitions are truthful end-to-end (Preparing → Rendering → Encoding for video; Preparing → Rendering for PNG).
- Cancel during preparation is honored, including the previously-wiped flush-window case.
- Zero regression across the three pre-existing export engine suites; types clean; scope gate clean; native UAT explicitly pending.
</success_criteria>

<output>
Create `.planning/quick/260919-sns-export-click-gives-no-feedback-for-sever/260919-sns-SUMMARY.md` when done (include the RED proof verbatim, the six invariant verdicts, the wide-gate results with pre-existing failures attributed, and the pending native UAT rows).
</output>
