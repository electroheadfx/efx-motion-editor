---
phase: quick-261022-ljt
plan: 261022-ljt
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
autonomous: true
requirements:
  - LJT-01
  - LJT-02

estimate:
  tokens: 26000
  raw_tokens: 20000
  tasks: 2
  confidence: low            # no calibration samples for this quick-task class; one async seam + its regression pin

must_haves:
  truths:
    - "During a watercolor Play Script bake, the dialog footer progress bar and status line advance once per committed output frame and reach N/N before the dialog reports completion — the exact same `progress`/`status` signals and DOM surface brush mode already uses."
    - "Progress updates are generation- and dispose-guarded: a commit that lands after Cancel or after the dialog is disposed never moves the bar."
    - "The engine-1 (brush) path is unchanged: `renderRotoPlayScriptFrames` and its `onProgress` wiring are byte-identical."
    - "The progress callback never throws — a throw inside the bake commit turn would settle that turn `rejected` and fail the whole bake."
    - "Only the controller and its bake test change; the efx-watercolor bake package already exposes the per-frame commit seam and is not modified."
  artifacts:
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  key_links:
    - "AquarelleBakeOptions.onCommit (packages/efx-watercolor/src/bake/aquarelleBake.ts:91, invoked per committed frame at :547) -> controller onCommit -> progress/status signals (physicsPaintRotoPlayScriptController.ts:360-361) -> dialog <progress> + status span (PhysicsPaintPlayScriptDialog.tsx:653-656)."
    - "engine-1 renderer onProgress (physicsPaintRotoPlayScriptRenderer.ts:148 / :288) -> the SAME progress/status signals. Parity, not a second mechanism."
    - "cancel() (:1742) and dispose() (:1753-1755) bump `generation` / set `disposed` -> the new callback guard."
---

<objective>
Make a watercolor Play Script bake report progress on the same dialog surface brush mode already fills.

Requirements: LJT-01 watercolor Play progress parity; LJT-02 stale-generation/dispose guards and engine-1 non-regression.

Root cause (verified in the live tree on 2026-10-22, do not trust line numbers blindly after edits):
- `confirmGeneration` seeds `phase = 'rendering'`, `progress = { completed: 0, total: count }`, `status = 'Rendering 0 / N'` at `physicsPaintRotoPlayScriptController.ts:1478`, then branches at :1482.
- Brush (engine-1) path at :1484-1487 passes `onProgress`, so `renderRotoPlayScriptFrames` (:148 of the renderer) advances the bar every frame.
- The watercolor branch at :1483 calls `bakeAquarelleScript`, which builds `createAquarelleBake` options at :1248-1260 WITHOUT `onCommit`. The aquarelle bake has the seam (`AquarelleBakeOptions.onCommit`, aquarelleBake.ts:91; called once per committed frame at :547) but nobody consumes it, so the bar stays at 0 / N for the entire bake.
- The dialog already renders `playScript.progress.value` (PhysicsPaintPlayScriptDialog.tsx:653-656). No UI change is needed.

Purpose: the user sees a frozen 0 / N bar in watercolor Play while brush Play advances; the missing piece is one callback, not a new progress mechanism.

Output: a per-commit progress callback in the aquarelle bake branch that writes the SAME `progress`/`status` signals brush mode uses, generation/dispose-guarded, plus regression tests for the advancing bar and for late-commit suppression.

Scope fences: no UI edits; no new state, store, or bridge fields; no changes to `packages/efx-watercolor`; no change to the engine-1 renderer, `applyAquarelleEventsToKey`, Reveal (`confirmReveal` already wires `onProgress`), persistence, export, or commits beyond the plan's two files. Preact/`@preact/signals` only; vitest `run` only (never watch); pnpm, never npm. Do not run the dev server. Atomic local commits, no pushes.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

Verified in the live tree on 2026-10-22 (line numbers drift after edits):
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
  - 359-361: `phase`, `progress`, `status` signals. `progress` is `{ completed: number; total: number } | null`; the dialog hides the bar when null.
  - 1227-1292: `bakeAquarelleScript`. The `createBake` options object is at 1248-1260 (`frameCount: count`, `motion`); add `onCommit` there. `disposed` and `generation` are in scope; the post-bake stale check is at 1265.
  - 1478: seeds `progress = { completed: 0, total: count }` and `status = 'Rendering 0 / N'` BEFORE the branch — the aquarelle branch inherits the initial value and never advances it.
  - 1482-1487: engine-1 uses `onProgress`, aquarelle uses `bakeAquarelleScript`; this asymmetry is the whole bug.
  - 1701-1722: commit, then `phase = 'complete'`, `progress = { completed: count, total: count }`, `status = 'Play Script complete · N frames'`.
  - 1742: `cancel()` bumps `generation` and aborts. 1753-1768: `dispose()` sets `disposed = true`, bumps `generation`, and `flush()`es (does not abort) a live aquarelle bake — late commits are expected and MUST be guarded.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` 26 / 148 / 288: engine-1 `onProgress(completed, total)` contract (`frameIndex + 1`, `frameCount`). Reuse its semantics and status string exactly.
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` 84-115 (`AquarelleBakeOptions`), 91 (`onCommit?: (frame: AquarelleBakeFrame) => void`), 544-549 (`frames.push(value); onCommit?.(value); return true` inside the FIFO commit barrier in `bakeProgressive`). Frames commit in output order; a throw here settles the turn `rejected` (see `packages/efx-paint-host/src/bake/bakeHost.ts` around its commit handling) and the bake then returns `{ ok: false, reason: 'failed' }`.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` 653-656: `<progress max total value completed>` plus a `completed/total` status span, driven by `playScript.progress.value`. No change needed — this is the shared surface.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` 110-166 (`makeFakeBake`), 241-347 (aquarelle branch cases; `createAquarelleBake` is injected via `ports.createAquarelleBake`, so a test can capture its options), 310-347 (dispose mid-bake case with a controllable `bakeGate`).
- `app/vitest.config.ts` collects only `src/**/*.test.ts`; both touched files are `.test.ts`. `pnpm --filter efx-motion-editor exec` runs inside `app/`, so vitest positional filters are app-package-relative; paths in edits/greps are repo-root-relative.
- Typecheck baseline at plan time: `pnpm --filter efx-motion-editor run typecheck` fails with 16 pre-existing `error TS` lines, none of them in the two touched files. Capture the baseline BEFORE any edit.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Watercolor Play progress — bake commits drive the shared progress signal</name>
  <files>
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  </files>
  <behavior>
    RED first — write this test, run it against unchanged code (it must fail because `options.onCommit` is undefined), then implement.

    In `physicsPaintRotoPlayScriptController.bake.test.ts`, in the existing `describe('aquarelle bake consume branch (56-08)')`:
    - "aquarelle bake reports per-frame progress on the shared progress signal":
      - Inject `createAquarelleBake` as `vi.fn((_adapter, options) => { capturedOptions = options; return bake; })`; snapshot `engineId: 'efx-watercolor'`, `countText = '3'`, `framesToReturn` = 3 frames, keep the existing `bakeGate` unresolved.
      - Drive `openConfirmation()` then `confirm()`; drain the same three microtask turns the sibling cases use so `bake.bake()` is in flight.
      - Assert `capturedOptions?.onCommit` is a function.
      - Invoke it with `framesToReturn[0]` then `framesToReturn[1]`; assert `controller.progress.value` deep-equals `{ completed: 2, total: 3 }` and `controller.status.value` is `'Rendering 2 / 3'` WHILE the gate is still unresolved (this is the mid-bake proof).
      - Invoke it once more; assert `{ completed: 3, total: 3 }`.
      - Resolve the gate, await `confirm()`; assert the run completed (`ok === true`) and the final `progress.value` is `{ completed: 3, total: 3 }`.
    - Keep every existing case in the file green unchanged, including "engine-1 path is unchanged".
  </behavior>
  <action>
    Test first, then implement.

    TEST: extend `physicsPaintRotoPlayScriptController.bake.test.ts` only as described in the behavior block. Capture the options object inside the injected `createAquarelleBake`; invoke the captured `onCommit` directly (the real bake already has its own onCommit tests in `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` — do not duplicate them). Do not change the shared `makeFakeBake` semantics for existing cases.

    IMPLEMENT in `bakeAquarelleScript` (`physicsPaintRotoPlayScriptController.ts` ~1227-1292):
    - Declare `let committedFrames = 0;` immediately above `const bake = createBake(adapter, { ... })`.
    - Add to that options object, after `motion`:
      - `onCommit: () => { ... }` that:
        - returns early when `disposed || generation !== acceptedGeneration` (AQUA-07 flush-survives-navigation means commits legitimately continue after dispose — the guard is required, not optional);
        - increments `committedFrames = Math.min(count, committedFrames + 1)`;
        - writes `progress.value = { completed: committedFrames, total: count }`;
        - writes `status.value = ` + backtick + `Rendering ${committedFrames} / ${count}` + backtick — the EXACT string engine-1 emits at :1486.
      - A short comment: parity with engine-1's `onProgress`; this callback runs inside the bake commit turn, so it must never throw (a throw settles the turn `rejected` and fails the whole bake).
    - Use a monotonic counter, not `frame.eventIndex + 1`: `eventIndex` is an event index on the non-progressive bake path, whereas the counter matches engine-1's `frameIndex + 1` semantics on the Play path and is clamped to `count`.
    - Do NOT touch: the engine-1 branch, `renderRotoPlayScriptFrames`, the initial `progress` seeding at :1478, the completion writes at :1718-1721, `cancel`, `dispose`, `confirmReveal`, `applyAquarelleEventsToKey`, or the dialog. No new signal, store, bridge, or package changes.

    Before editing, capture the typecheck baseline: `pnpm --filter efx-motion-editor run typecheck > /tmp/ljt-typecheck-baseline.txt 2>&1` (expect 16 pre-existing `error TS` lines and none in the two touched files).
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts</automated>
    <automated>grep -q 'onCommit:' app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts && grep -q 'playScript.progress.value' app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/ljt-typecheck-task1.txt 2>&1; test "$(grep -c 'error TS' /tmp/ljt-typecheck-task1.txt)" -le "$(grep -c 'error TS' /tmp/ljt-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    With a watercolor Play Script in flight, committing bake frames advances the existing dialog progress bar and the `Rendering k / N` status line toward N/N, while the bake gate is still unresolved. The engine-1 branch and every pre-existing test in the file are unchanged and green. No new typecheck errors in the touched files.
  </done>
</task>

<task type="auto">
  <name>Task 2: Late commits never move the bar — cancel, dispose, and clamp guards</name>
  <files>
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts
  </files>
  <behavior>
    Add these cases to the same describe block; they pin the Task 1 guard and must pass without production changes (if one fails, fix only the callback guard in Task 1's file — never the bake package).

    - "a late aquarelle commit after cancel does not move progress": drive a bake to the in-flight state, commit twice (progress `{2,3}`), call `controller.cancel()` (phase is `'rendering'`, so `canCancel` is true and `generation` bumps), then invoke `onCommit` again; assert `progress.value` still deep-equals `{ completed: 2, total: 3 }`. Resolve the gate, await `confirm()`; assert `phase.value` is `'cancelled'`.
    - "a late aquarelle commit after dispose does not move progress": drive a bake to the in-flight state, commit once, call `controller.dispose()` (it sets `disposed`, bumps `generation`, and `flush()`es the fake bake, which resolves the held gate), immediately invoke `onCommit` once more BEFORE yielding to microtasks, and assert `progress.value` did not change. Then await the confirm promise and assert the existing dispose contract still holds (`fake.flushCalls > 0`; `fake.disposeCalls === 0`).
    - "committed frames clamp at the requested count": with `count = 2`, invoke `onCommit` four times while in flight; assert `progress.value.completed` never exceeds 2 and `total` stays 2; then resolve the gate and await `confirm()`.
  </behavior>
  <action>
    Extend `physicsPaintRotoPlayScriptController.bake.test.ts` with the three cases above. Reuse the existing harness, `bakeGate`, and captured-options pattern from Task 1; keep every existing case untouched. Await the confirm promise after every gate resolution so no test leaks a pending async path.

    If a guard case fails, adjust only the `onCommit` early return in `physicsPaintRotoPlayScriptController.ts` (it must check both `disposed` and `generation !== acceptedGeneration`, and clamp with `Math.min(count, ...)`). Do not weaken an existing test, do not change `cancel`/`dispose`, and do not modify `packages/efx-watercolor`.

    Then run the two controller suites plus the full app suite and the typecheck comparison; fix only defects inside the plan's two files.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/ljt-typecheck-task2.txt 2>&1; test "$(grep -c 'error TS' /tmp/ljt-typecheck-task2.txt)" -le "$(grep -c 'error TS' /tmp/ljt-typecheck-baseline.txt)"</automated>
  </verify>
  <done>
    Mid-bake progress advances; after Cancel or dispose a late commit leaves the bar untouched; completed never exceeds total; the engine-1 suite, the aquarelle bake suite, and the full app suite are green with no new typecheck errors.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Aquarelle bake host -> controller signals | A long `flush-survives-navigation` bake keeps committing after the dialog may have cancelled or disposed; every commit crosses into live Preact signals. |
| progress signal -> dialog DOM | The same `progress`/`status` signals feed the footer `<progress>` and status span; they are presentation-only and never reach the document, bridge, cache, or persistence. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ljt-01 | Tampering | `onCommit` progress callback | medium | mitigate | A throw inside the callback rejects the bake commit turn and converts a healthy bake into `{ ok: false, reason: 'failed' }`; the callback contains only guarded signal writes and a clamped counter, and the risk is stated in a code comment. |
| T-ljt-02 | Denial of service | late commits after cancel/dispose | low | mitigate | Early return on `disposed || generation !== acceptedGeneration`; `completed` is clamped to `count`, so a late or duplicated commit can never re-open or overrun the dialog's progress. |
| T-ljt-03 | Information disclosure | new progress writes | low | accept | Only frame counts already shown by the engine-1 path are written; no script content, points, color, or document state is added to the signal, and nothing is persisted. |
| T-ljt-SC | Tampering | npm/pnpm installs | high | mitigate | No package installs in this quick. If any install is added, the package-legitimacy gate and a blocking human checkpoint apply. |
</threat_model>

<verification>
Automated (run from the repo root; `pnpm --filter efx-motion-editor exec` runs inside `app/`, so vitest filters are app-package-relative):
- Targeted: `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` (background is fine; resume on the completion notice).
- Typecheck: compare `error TS` counts against `/tmp/ljt-typecheck-baseline.txt` captured before Task 1 edits, and require no error line mentioning `physicsPaintRotoPlayScriptController`.
- Source gates: the aquarelle branch passes an `onCommit`; the dialog still reads the shared `playScript.progress.value`; `packages/efx-watercolor` is untouched.

Live UAT (the user runs these in the Physic Paint Studio; the work is automated-ready, NOT done, until they pass):
1. Watercolor mode active, select a watercolor Play Script, Play Script with a multi-frame count: the footer bar fills 0/N -> N/N and the status reads `Rendering k / N` while the bake runs.
2. Brush (paint) mode Play Script: progress behavior is unchanged.
3. Cancel a watercolor bake mid-render: the dialog cancels and the bar does not jump or advance afterwards.

Do not drive the live UI via browser automation; the user performs these rows. Unit tests cannot see the WKWebView dialog, so rows 1-3 are the verdict.
</verification>

<success_criteria>
- Watercolor Play Script reports per-frame progress on the same `progress`/`status` signals and the same dialog DOM that brush mode uses.
- The aquarelle bake path consumes its existing `onCommit` seam; no parallel progress mechanism, state, or UI is introduced.
- Late commits after Cancel or dispose are ignored, and `completed` never exceeds `total`.
- The engine-1 path, Reveal, Apply, persistence, export, and the efx-watercolor package are untouched.
- Targeted and full suites green; no new typecheck errors; live UAT rows pass before "done" is claimed.
</success_criteria>

<output>
Create `.planning/quick/261022-ljt-fix-add-progression-to-play-script-in-wa/261022-ljt-SUMMARY.md` when done.
</output>
