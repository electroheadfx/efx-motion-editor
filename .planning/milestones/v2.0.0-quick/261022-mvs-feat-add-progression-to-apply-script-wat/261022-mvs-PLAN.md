---
phase: quick-261022-mvs
plan: 261022-mvs
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/efx-watercolor/src/bake/aquarelleBake.ts
  - packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
  - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
autonomous: true
requirements:
  - MVS-01
  - MVS-02

estimate:
  tokens: 32000
  raw_tokens: 24500
  tasks: 2
  confidence: low            # no calibration samples for this quick-task class; one package seam + one app wiring seam

must_haves:
  truths:
    - "Applying a watercolor (aquarelle) Roto script shows the shared Apply pill at 0/N, advances it once per fully fed stroke (Dry events excluded), and reaches N/N with `Applying k/N` before the terminal `Applied` status — the same pill and string brush-mode Apply already uses."
    - "During a single-frame Apply bake the aquarelle engine yields to the host between strokes so each progress step can paint; the baked frame bytes, capture count, and stepped tick sequence are identical to a bake without the callback."
    - "A progress callback that lands after dispose or after a launch replacement never writes `applyProgress` or the status line."
    - "Brush-mode Apply, Play Script (aquarelle and engine-1), `frameCount: 1`, the visible settle cap, paper, and Dry event ordering are unchanged."
  artifacts:
    - packages/efx-watercolor/src/bake/aquarelleBake.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  key_links:
    - "AquarelleBakeOptions.onStrokeFed (new, fires in bakeProgressive per fully fed stroke) -> applyAquarelleEventsToKey input -> RotoScriptClipboardControllerPorts.applyAquarelleEvents.onProgress -> applyProgressState/status -> PhysicsPaintApplyProgressPill (app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx:422-440). No view change."
    - "Controller total = non-dry aquarelle events; bake total = stroke events. Both exclude Dry (D-15), so the initial 0/N and the reported denominator agree."
    - "The stale guards mirror brush-mode publishApplyStatus/finishApply (physicsPaintRotoScriptClipboard.ts:598-650) and the Play quick 261022-ljt guard (disposed plus generation mismatch)."
---

<objective>
Add visible progression to the watercolor Apply path so it matches brush mode.

Answer to the user's question, verified in the live tree on 2026-10-22: brush mode (engine-1) already has Apply progress. Only the aquarelle branch lacks it.

Root cause (line numbers drift after edits — verify before editing):
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` 761-776: the aquarelle branch sets `status = 'Applying'`, awaits one `ports.applyAquarelleEvents` call, then writes `Applied`/`Failed`. It never touches `applyProgressState`.
- Same file 778-779 and 822-845: the brush branch seeds `applyProgressState = { completed: 0, total: brushes.length }`, advances it per consumed mutation, and writes `Applying ${completed}/${total}`. `finishApply` (602-650) clears the signal.
- Same file 913-934 and 948-963: launch replacement bumps `launchGeneration`; dispose sets `disposalRequested` and later `disposed`. AQUA-07 keeps the aquarelle bake running across navigation, so late progress is expected and must be ignored.
- `packages/efx-watercolor/src/bake/aquarelleBake.ts` 586-588: Apply passes `frameCount: 1`, so `bakeProgressive` runs exactly one frame and `onCommit` (the seam the Play quick 261022-ljt uses) fires only once. Apply progress needs a per-stroke seam instead.
- Same file 426-556: for a single frame, every stroke is fed inside ONE synchronous adapter turn (469-496 timed feed, 497-502 fallback feed). Signal writes from that turn cannot paint. Progression therefore requires (a) a per-stroke callback and (b) one host yield between strokes, gated on a listener and on single-frame replay so Play and every other bake consumer keep their current scheduling.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` 1812-1851: `applyAquarelleEventsToKey` builds the bake with `frameCount: 1`; it is the only caller and must forward the new callback.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` 1268-1310: the `applyAquarelleEvents` port binding. `app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts:20` already forwards the whole input object — no edit there.
- The pill (`PhysicsPaintStudioView.tsx` 422-440) renders only from `rotoScript.applyProgress`; populating that signal is the entire UI requirement.

Purpose: a watercolor Apply currently shows a frozen `Applying` label for the whole bake. This plan gives it the same 0/N to N/N pill brush mode has, without changing the pixels the bake produces.

Output: an additive `onStrokeFed` option in the aquarelle bake (with a single-frame host yield), forwarded through `applyAquarelleEventsToKey` and the clipboard port, consumed by a guarded aquarelle branch that drives `applyProgressState` and the exact brush-mode status string, plus regression tests in both packages.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md

Verified in the live tree on 2026-10-22 (line numbers drift after edits):
- `packages/efx-watercolor/src/bake/aquarelleBake.ts`
  - 84-115: `AquarelleBakeOptions` (`onCommit`, `paper`, `frameCount`, `motion`). Add the new option here.
  - 256-568: `bakeProgressive`. `strokes` (276-279) is the non-Dry event list. `timed` (303-360) is the recorded-timeline path; `schedule` (281, 361-363) is the point-weight fallback. `fedCounts` (424) already tracks per-stroke feed progress in the timed path.
  - 469-496: timed feed loop. A stroke is fully fed when `pointCount` reaches `entry.stroke.pts.length`; `fedCounts.set` is the completion point. Beware `pointCount <= 0` also covers a stroke whose window has not opened yet (`beginTick === windowEnd`) — only zero-point strokes count there.
  - 497-502: fallback feed passes the cumulative `frameStrokes` list to `renderPartialStrokes`; completion is `entry.pointCount >= entry.stroke.pts.length`.
  - 507-517: end-frame settle/fix. Do not touch.
  - 586-588: `frameCount` selects `bakeProgressive`; without it the per-stroke path runs and must stay silent.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts`
  - 106-126: `RotoScriptClipboardControllerPorts`; `applyAquarelleEvents` input is at 120-123.
  - 240-242: `applyProgressState`, `applying`, `applyProgress`.
  - 715-820: `applyScript`; 722 captures `acceptedLaunchGeneration`; 761-776 is the aquarelle branch to change.
  - 598-650: `publishApplyStatus`/`finishApply` — the guard and clear conventions to mirror.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` 1812-1851: `applyAquarelleEventsToKey`. `frameCount: 1` is a deliberate law (261019 comment) and must not change.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` 1268-1310: the port implementation to extend with the callback.
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` 378-380 and 422-440: the pill, rendered from `rotoScript.applyProgress` only.
- Tests: `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` 19-183 (mock canvas, fake adapter, `pixelEncoder`), 478-535 (`makeTimelineAdapter`, `timedStroke`), 566-660 (progressive replay cases). `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts` 37-78 (harness), 112-230 (clipboard cases). The clipboard suite has NO aquarelle apply case today — this plan adds the first ones.
- `app/vitest.config.ts` collects only `src/**/*.test.ts`; the touched app test is `.test.ts`. `pnpm --filter efx-motion-editor exec` runs inside `app/`, so vitest positional filters are app-package-relative; edit/grep paths stay repo-root-relative. The watercolor package runs its own vitest via `pnpm --filter @efxlab/efx-watercolor exec vitest run`.

Scope fences:
- No view/UI edits; the pill and its label are already shared.
- No new signal, store, bridge, cache, or persistence field.
- No change to `frameCount: 1`, the settle-cap law, paper, Dry ordering, the non-progressive bake path, `renderRotoPlayScriptFrames`, Reveal, or export.
- Preact signals only; no new hooks/effects; writes happen in callbacks, never in a render body.
- Tests use `vitest run` only; never watch. pnpm only. Do not run the dev server. Atomic local commits, no pushes.

Known baseline: `pnpm --filter efx-motion-editor run typecheck` has pre-existing `error TS` lines (16 at the 261022-ljt plan time). Capture `/tmp/mvs-typecheck-baseline.txt` BEFORE any edit and compare counts, not zero.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Aquarelle bake reports per-stroke progress during progressive replay</name>
  <files>
    packages/efx-watercolor/src/bake/aquarelleBake.ts
    packages/efx-watercolor/src/bake/aquarelleBake.test.ts
  </files>
  <behavior>
    RED first — add these cases to `aquarelleBake.test.ts`, run them against unchanged code, confirm they fail because `options.onStrokeFed` is never called, then implement.

    New describe block `261022 per-stroke progress (Apply parity)`:
    - "reports one cumulative step per fully fed stroke and excludes Dry": two `timedStroke` entries with one `createDryEvent` between them in recorded order, `frameCount: 1`, `encodeWebp: pixelEncoder`, and a collector for `onStrokeFed`. Assert the collected pairs deep-equal `[[1, 2], [2, 2]]` and the bake resolves `ok: true`. This is the Apply shape.
    - "reports on the point-weight fallback when recorded timing is unusable": a stroke with `timestamp: 0` (so `buildRecordedTimeline` returns null) and `frameCount: 1`. Assert one report `[1, 1]` and `ok: true`.
    - "does not report without frameCount": a stroke with default timing and no `frameCount`. Assert the collector stayed empty and the bake still resolves `ok: true` (per-stroke path stays silent).
    - "yielding between strokes leaves the image and the tick sequence unchanged": run the same two-stroke `frameCount: 1` script twice on fresh `makeTimelineAdapter(0)` adapters, once with a listener and once without. Assert both `result.ok`, both have exactly one frame, the frame bytes deep-equal, and `log.stepsByFrame` deep-equals. Do not add a throwing-listener case; the never-throw contract is documented in the JSDoc and enforced by the Task 2 guarded publisher.
  </behavior>
  <action>
    Test first, then implement in `aquarelleBake.ts` only; do not touch the non-progressive `bake` path, the host, or any other package file.

    1. Extend `AquarelleBakeOptions` with `onStrokeFed?: (completed: number, total: number) => void`. JSDoc must state: fires only during progressive replay when `frameCount` is set; once per fully fed stroke, cumulative from 1 to the stroke-event count; Dry events are not counted; it runs inside the bake turn so a throw would fail the bake and the consumer must only perform guarded writes; when `frameCount` is 1 the bake yields to the host between strokes so the UI can paint, and the resulting image and tick sequence are unchanged.

    2. Inside `bakeProgressive` only, declare per-call state after `strokes` is built: the listener, a `fedStrokes` Set keyed by stroke identity, a `fedStrokeCount` counter, and `strokeTotal = strokes.length`. Do not use `options.onCommit` and do not reuse `eventIndex` or `strokeIndex` — they do not represent Apply progress.

    3. Add a module-level yield helper: resolve on the next host macrotask via `MessageChannel` when available (post a message, close both ports in the handler, then resolve), otherwise fall back to `setTimeout` with 0 ms. Do not use `requestAnimationFrame`: WebKit stops it for hidden windows and Apply must never hang.

    4. Add a local `reportFed(stroke)` async helper: skip if already in the Set; otherwise add it, increment the counter, call `onStrokeFed(fedStrokeCount, strokeTotal)`, then, only when a listener exists AND `frameSpan === 1` AND `fedStrokeCount` is less than `strokeTotal`, await the yield helper. Make the single-frame `framePromise` work function async so the await is legal; keep `captureFrame()` as the returned value and keep all adapter calls in the same order.

    5. Timed path (469-496): after `fedCounts.set(entry.stroke, pointCount)`, when `pointCount` is at least the stroke's point count, await `reportFed(entry.stroke)`. In the `pointCount <= 0` branch, await `reportFed` ONLY when `entry.stroke.pts.length` is 0 (a not-yet-opened window must not count). Do not reorder any `stepTick`, Dry, or `renderPartialStrokes` call.

    6. Fallback path (497-502): after `adapter.renderPartialStrokes(frameStrokes)`, iterate `frameStrokes` in order and await `reportFed(entry.stroke)` for each entry whose `pointCount` is at least the stroke's point count. Keep the subsequent `stepTick` loop after the reports.

    7. Do not catch listener exceptions in the package; the JSDoc contract plus the guarded controller callback keep the bake healthy. No change to `settleCapped`, `fix`, `FIX_SETTLE_TICKS`, `SETTLE_MAX_TICKS`, paper setup, Dry maps, motion aliasing, or capture.

    Before editing, capture the app typecheck baseline to `/tmp/mvs-typecheck-baseline.txt` as described in context.
  </action>
  <verify>
    <automated>pnpm --filter @efxlab/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts</automated>
    <automated>pnpm --filter @efxlab/efx-watercolor run check</automated>
    <automated>pnpm --filter @efxlab/efx-watercolor exec vitest run</automated>
  </verify>
  <done>
    With `frameCount: 1` and a listener, `onStrokeFed` fires exactly once per stroke event in recorded order with cumulative counts and a total that excludes Dry; the fallback path reports; a bake without `frameCount` reports nothing; and enabling the listener changes neither the committed bytes nor the stepped tick sequence. The full watercolor package suite and its typecheck are green.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Watercolor Apply drives the shared progress pill and status</name>
  <files>
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts
    app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
  </files>
  <behavior>
    RED first — extend `physicsPaintRotoScriptClipboard.test.ts`, run against unchanged code, confirm the aquarelle progress assertions fail, then implement.

    Harness: add an optional `overrides: Partial<RotoScriptClipboardControllerPorts>` second parameter to `harness` and spread it into `createRotoScriptClipboardController`. Build every case from `harness([], { applyAquarelleEvents })` — an empty engine keeps `prepareLaunchReplacement` and `dispose` from draining uncompleted engine strokes, which would hang the guard tests. Import the port type, `createDryEvent`, and `toStudioStroke as aquarelleToStudioStroke` from `@efxlab/efx-watercolor/payload`. Build a persisted runtime aquarelle script with non-empty `brushes` (the replacement gate), `engineId: 'efx-watercolor'`, and `aquarelleEvents` = stroke, Dry, stroke.

    New describe block `261022 aquarelle Apply progress`:
    - "advances the pill per stroke and clears it on Applied": inject an `applyAquarelleEvents` fake backed by a deferred. `replaceClipboardFromPersisted(script)`, start `applyScript()`, drain microtasks. Assert the fake received an `onProgress` function, `applyProgress.value` deep-equals `{ completed: 0, total: 2 }`, and `status.value` is `Applying 0/2`. Invoke `onProgress(1, 2)`; assert `{ completed: 1, total: 2 }` and `Applying 1/2` WHILE the deferred is unresolved. Invoke `onProgress(2, 2)`, resolve the deferred with true, await the apply; assert it resolves true, `applyProgress.value` is null, and `status.value` is `Applied`. This pins that Dry is not in the total.
    - "clamps an over-count and ignores a non-finite count": while in flight, invoke `onProgress(5, 2)` then `onProgress(Number.NaN, 2)`; assert the pill stays at `{ completed: 2, total: 2 }` after the first call and does not change after the second. Resolve and await.
    - "a late callback after launch replacement does not move progress": start the apply, await `prepareLaunchReplacement()`, invoke `onProgress(1, 2)`; assert the pill still reads `{ completed: 0, total: 2 }`. Call `completeLaunchReplacement()`; assert null. Resolve and await the apply.
    - "a late callback after dispose does not move progress or resurrect status": start the apply, call `dispose()` (do not await yet), invoke `onProgress(1, 2)`; assert the pill still reads `{ completed: 0, total: 2 }`. Resolve the port with true, then await both the apply and the dispose promise; assert `applyProgress.value` is null and `status.value` is null (the terminal `Applied` write must be suppressed after disposal).
    - Keep every pre-existing case green untouched, especially the brush burst progress cases.
  </behavior>
  <action>
    Test first, then implement. Four production files; no other file changes (`useRotoScriptClipboardController` already forwards the whole input object).

    1. `physicsPaintRotoScriptClipboard.ts`, port type 120-123: add optional `onProgress?: (completed: number, total: number) => void` to the `applyAquarelleEvents` input.

    2. `physicsPaintRotoPlayScriptController.ts`, `applyAquarelleEventsToKey` 1812-1851: add optional `onStrokeFed?: (completed: number, total: number) => void` to the input type and forward it into the `defaultCreateAquarelleBake` options as `onStrokeFed: input.onStrokeFed`. Change nothing else — `frameCount: 1`, the publish closure, dispose/flush stay as-is.

    3. `PhysicsPaintStudio.tsx` 1268-1310: destructure `onProgress` from the port input and pass `onStrokeFed: onProgress` into `applyAquarelleEventsToKey`. Keep the size/paper/publish code identical.

    4. `physicsPaintRotoScriptClipboard.ts`, aquarelle branch 761-776:
       - Add a module-level helper counting non-Dry events in an aquarelle timeline (the file already imports `isAquarelleDryEvent`).
       - Compute `aquarelleStrokeTotal`; when it is above 0, seed `applyProgressState = { completed: 0, total: aquarelleStrokeTotal }` and `status = Applying 0/N`; otherwise keep the existing `Applying` status and leave the pill hidden.
       - Declare `let progressSettled = false` and a guarded publisher. The publisher returns early when `progressSettled`, `disposed`, `disposalRequested`, or `launchGeneration !== acceptedLaunchGeneration` (captured at line 722). Otherwise it clamps: non-finite completed becomes 0; completed is truncated into 0..total; a non-positive or non-finite total falls back to `aquarelleStrokeTotal`. Then it writes the same shapes brush mode writes: `applyProgressState = { completed, total }` and `status = Applying k/N` with no spaces around the slash.
       - Pass the publisher as `onProgress` in the `ports.applyAquarelleEvents` call.
       - Guard the terminal writes: write the success/failure `status` (and `error` on failure) only when `!disposalRequested` and `launchGeneration === acceptedLaunchGeneration`. Keep `endOperation(engine)` exactly once per path.
       - Add a `finally` that sets `progressSettled = true` and clears `applyProgressState` to null. The clear is unconditional so a stale pill can never survive the operation; brush-mode `finishApply` does the same.
       - Do not alter `target` validation, `beginOperation`, the brush path, `prepareLaunchReplacement`, `completeLaunchReplacement`, or `dispose`.

    Reactivity rules: callback-only signal writes, no new hooks or effects, no render-body writes, narrow reads stay as they are.

    If the aquarelle port fake is invoked synchronously with an already-resolved promise, drain microtasks before asserting; if a guard case fails, fix only the publisher guard — never weaken an existing test and never change the bake package in this task.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor run typecheck > /tmp/mvs-typecheck-task2.txt; test "$(grep -c 'error TS' /tmp/mvs-typecheck-task2.txt)" -le "$(grep -c 'error TS' /tmp/mvs-typecheck-baseline.txt)"</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    A watercolor Apply seeds 0/N, advances k/N per fully fed stroke with the brush-mode status string, clamps runaway counts, clears the pill on completion, and shows `Applied`. Late callbacks after launch replacement or dispose neither move the pill nor restore a status line. The clipboard suite, both Play Script suites, the full app suite, and the typecheck comparison are green with no new errors.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Aquarelle bake -> controller signals | The flush-survives-navigation bake keeps feeding strokes after the Studio may have disposed or replaced its launch; each completion crosses into live Preact signals. |
| Clipboard port -> bake | The controller-supplied callback runs inside the bake turn; a throw would turn a healthy bake into a failure. |
| Apply bake -> host task queue | The new single-frame yield crosses into the host event loop between strokes; it must never stall a hidden Studio. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mvs-01 | Tampering | `AquarelleBakeOptions.onStrokeFed` | medium | mitigate | A throw inside the turn fails the whole Apply; the JSDoc states the never-throw contract, and the only consumer is the guarded controller publisher (signal writes and numeric clamps only, no allocation-dependent work). |
| T-mvs-02 | Denial of service | late progress after dispose/launch replacement | low | mitigate | `progressSettled`, `disposed`, `disposalRequested`, and `launchGeneration` early returns; completed clamped to total; the `finally` clear prevents a stale pill. |
| T-mvs-03 | Denial of service | new paint yield in the bake turn | low | mitigate | Yield on a `MessageChannel` macrotask (never `requestAnimationFrame`, which stops in hidden WKWebView windows), only when a listener exists and `frameSpan` is 1, at most once per stroke, with a `setTimeout` fallback. |
| T-mvs-04 | Information disclosure | new progress writes | low | accept | Only stroke counts already shown by the brush pill are written; no script content, points, color, or document state enters the signal and nothing is persisted. |
| T-mvs-SC | Tampering | npm/pnpm installs | high | mitigate | No package installs in this quick. Any install would require the package-legitimacy audit and a blocking human checkpoint. |
</threat_model>

<verification>
Automated (run from the repo root; `pnpm --filter efx-motion-editor exec` runs inside `app/`, so its vitest filters are app-package-relative):
- Package seam: `pnpm --filter @efxlab/efx-watercolor exec vitest run src/bake/aquarelleBake.test.ts` and the full package suite plus `pnpm --filter @efxlab/efx-watercolor run check`.
- App: the clipboard suite, both Play Script suites, the full app suite, and the typecheck count comparison against `/tmp/mvs-typecheck-baseline.txt` captured before Task 1.
- Source review gates: `frameCount: 1` still present in `applyAquarelleEventsToKey`; the view still reads `rotoScript.applyProgress` with no edit; no new signal or effect.

Live UAT (the user runs these in the Physic Paint Studio; the work is automated-ready, NOT done, until they pass):
1. Watercolor mode, copy a multi-stroke paint script, Apply it to another key: the pill appears at 0/N, visibly advances k/N while the wash bakes, then clears and the status reads `Applied`. The applied wash must look the same as before this change.
2. Brush (engine-1) Apply: progress behavior and result are unchanged.
3. Watercolor Play Script and brush Play Script: progress and pixels are unchanged (Play still advances per rendered frame).
4. Apply a watercolor script, then navigate or close the Studio while it runs: after returning, no Apply pill or `Applying` status from the old run is shown.

Do not drive the live UI via browser automation; the user performs these rows. Unit tests cannot see the WKWebView pill, so rows 1-4 are the verdict.
</verification>

<success_criteria>
- Watercolor Apply reports the same `Applying k/N` progress and pill as brush-mode Apply, with Dry events excluded from the total and completed clamped to it.
- The per-stroke seam is additive: `frameCount: 1`, the settle cap, paper, Dry ordering, the non-progressive path, Play, and brush Apply are untouched, and bytes plus tick sequence match a run without the callback.
- Late callbacks after dispose or launch replacement cannot move progress or restore a status line.
- Targeted and full suites in both packages are green; no new typecheck errors; live UAT rows pass before "done" is claimed.
</success_criteria>

<output>
Create `.planning/quick/261022-mvs-feat-add-progression-to-apply-script-wat/261022-mvs-SUMMARY.md` when done.
</output>
