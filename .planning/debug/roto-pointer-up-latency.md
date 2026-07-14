---
status: resolved
trigger: "Investigate and optimize a Physics Paint Roto interaction-latency regression introduced or exposed by automatic pixel-cache commits."
created: 2026-07-14T09:47:24Z
updated: 2026-07-14T23:50:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "Confirmed and native-validated: the canvas stack's capture-phase edit intent ran before every engine pointer-down. On an already-dirty Roto frame it repeatedly called resetBackground(), whose redrawAll() synchronously flushed pending finalizations and replayed allActions, forcing stroke N-1 to raster when stroke N began and later applying the queued stroke again."
test: "Native UAT passed: paint several strokes less than 500 ms apart; all remain queued previews during activity, then rasterize after inactivity without earlier strokes rendering or reapplying."
expecting: "The cached-reference/background transition runs only on the first edit intent that changes a clean frame to dirty; later strokes keep the existing live session and pending finalization queue untouched."
next_action: "Resolved. Keep the focused controller regression and existing durable Roto/engine gates. Undo remains separate deferred scope."
reasoning_checkpoint:
  hypothesis: "pointerup omits terminal samples because only pointermove calls getCoalescedEvents/extractPenPoint before rawPts is captured; therefore release-only curve samples never reach queued preview or raster."
  confirming_evidence:
    - "Source trace shows onPointerMove drains coalesced events while onPointerUp immediately clears preview and captures existing rawPts."
    - "Focused production-seam RED run failed 6/10: ordered pointerup drain, valid endpoint, rapid loop, short flick, stale-release case, and frozen immutable ownership; move ordering and invalid/duplicate rejection expectations were already green."
  falsification_test: "If shared pointerup consumption does not make the exact terminal sequence assertions green, omitted release samples are not the mechanism or the production seam is incomplete."
  fix_rationale: "Consuming the browser's remaining chronological samples before the existing minimum threshold restores the missing source geometry; narrow finite/bounds/timestamp validation prevents invalid closing chords without heuristic distance caps that would drop legitimate flicks."
  blind_spots: "Synthetic tests cannot prove native handwriting feel or browser-specific coalescing payloads; native input-fidelity UAT remains required. Undo is known broken but explicitly outside this change."
reasoning_checkpoint:
  hypothesis: "The remaining pointer-up delay is caused by distributed synchronous work in ordered raster layers and local-fluid ticks; scheduling those exact stages as retained FIFO continuations removes the long indivisible main-thread turn without changing algorithms or output."
  confirming_evidence:
    - "Three native profiles measured finalization/apply up to ~788ms and pointerdown delay up to 2289ms."
    - "Raster layers measured ~340ms (~43%) and local fluid ~323ms (~41%), with three complete ticks at ~106-109ms each; cost is distributed across separable boundaries rather than one ~800ms primitive."
    - "Individual grain readbacks were mostly 4-10ms (max ~18-19ms), while emboss readback was ~105-117ms and velocity solve ~74-77ms; initial implementation can yield around, not inside, these primitives."
  falsification_test: "A deterministic seeded sync-versus-resumable parity test differs in pixels/RNG order, or native-safe continuation cannot retain all raster geometry/offscreen/RNG and fluid tick/channel/solver state without recomputation."
  fix_rationale: "The minimal fix stages only the two measured dominant distributed regions, preserves their original internal order and shared-buffer FIFO ownership, and uses input-pending state rather than arbitrary delay or unrelated cache/worker changes."
  blind_spots: "Automated browser mocks cannot prove native latency magnitude; after all gates pass, rapid stylus/mouse UAT on rich frames remains required. Emboss and one fluid tick can still form ~100ms turns, but profiling does not justify splitting them initially."

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "After pointer-up finalizes a visible brush mutation and detaches the minimum immutable revision-bound pixel state, the painting path returns immediately so another brush can begin while older cache work remains pending. Expensive conversion, encoding, persistence, interpolation refresh, bridge synchronization, project dirtying, and nonessential store/UI refreshes happen outside the pointer interaction critical path."
actual: "Beginning the next brush after mouse or stylus release is strongly and frequently delayed. Consecutive brushes cannot be painted naturally because completed-brush automatic cache work appears to block interaction."
errors: "No explicit error message; this is a user-visible interaction-latency regression rather than primarily a cache-correctness failure."
reproduction: "In Physics Paint Roto, paint a brush, release the pointer, and immediately attempt another brush. Repeat rapidly and on a complex/rich painted real key. The post-release delay is frequent and noticeable."
started: "Introduced or exposed by the automatic live pixel-cache commits completed on 2026-07-14."

## Required Behavior and Invariants

- Completed paint mutations eventually update the flattened alpha-only real-key cache.
- Do not reintroduce manual Save current or save-on-leave rendering.
- Do not replay or simulate the brush a second time and do not persist editable Roto brush JSON.
- Generated interpolation frames remain render-only and real keys remain authoritative.
- Existing cached-base repaint remains additive: existing flattened cached base plus current live overlay becomes the committed real-key cache.
- Existing per-brush Undo remains available while cache work is pending; after Undo the cache eventually matches visible pixels.
- Editable engine state remains active-session memory only and Play canvas persistence is unchanged.
- Automatic capture orchestration remains in the extracted Roto controller transaction; PhysicsPaintStudio stays a thin wiring boundary.
- Cache ordering uses a monotonic revision per durable source frame; stale work cannot overwrite newer paint, Undo, Clear, or Undo-to-empty.
- Different source frames progress independently; do not serialize all frames through a global queue.
- Pending work remains bound to its original durable source frame across navigation and preserves distant/custom-spaced real-key identity.
- Deferred work must consume an immutable snapshot bound to source frame, mutation revision, and exact visible flattened pixels; it must not later read a mutable canvas that may contain newer paint.
- Rapid same-frame mutations may coalesce or discard obsolete work when safe; avoid an unbounded queue of obsolete full-frame encodes.
- Normal painting and safe frame navigation remain non-blocking.
- A consumer that requires the newest cache, such as close/apply/export or engine disposal, uses one explicit flush/await boundary rather than blocking every brush.
- Derived consumers eventually observe the latest accepted cache, and generated interpolation refreshes from the latest accepted real-key revision rather than every obsolete intermediate capture.
- Do not change interpolation semantics, timeline UI, or Play canvas behavior and do not hide latency with an arbitrary debounce timer.
- Stop and report if a revision-safe immutable snapshot requires a new engine API; describe the smallest API addition instead of broadening scope.

## Investigation Contract

Trace and time, where applicable:

- pointer-up handling and readiness for the next pointer-down;
- engine mutation and Undo-history finalization;
- rendered-pixel readback, canvas copying, getImageData, drawImage, base-plus-overlay flattening;
- toDataURL, toBlob, asynchronous blob conversion, and PNG encoding;
- cache transaction/revision allocation and immutable snapshot handoff;
- durable cache writes, version/dirty notifications, and project serialization;
- interpolation invalidation/regeneration and derived consumer refresh;
- launch-context and parent bridge synchronization;
- Preact/Signals updates, component rerenders, and duplicated pixel capture/rendering.

Separate evidence for synchronous pointer-up critical-path work from background completion time. Do not claim a fixed millisecond target unless reliably measurable in the existing test environment.

## Mandatory RED Tests

1. A second brush can begin while the first brush cache encoding or persistence promise remains pending.
2. Rapid consecutive brushes on one real key produce a final cache matching the latest visible flattened result.
3. An older same-frame asynchronous capture cannot overwrite a newer brush revision.
4. Existing cached-base repaint remains additive after optimization.
5. Existing per-brush Undo works while cache work is pending.
6. Undo followed by stale older paint completion cannot restore undone pixels.
7. Clear or Undo-to-empty wins over older pending non-empty captures.
8. Navigation during pending capture keeps the result bound to its original durable source frame.
9. A distant/custom-spaced real key retains identity and spacing while cache work is pending.
10. Generated interpolation refreshes from the latest accepted real-key cache instead of every obsolete intermediate capture.
11. Close/apply or another engine-disposal boundary flushes the latest required revision without losing the final brush.
12. Play canvas behavior remains unchanged.

Use behavior-oriented tests and a controllable delayed encoder/cache adapter where practical; source-string tests are not primary proof.

## Native UAT

The user will validate rapid consecutive brushes, complex frames, additive cached-key repaint, immediate Undo, immediate navigation with frame binding, return-to-frame cache correctness, distant custom-spaced keys, eventual onion/preview/interpolation/export freshness, and unchanged Play canvas behavior.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- Cache encoding and PNG conversion as the residual blocker: PNG total is median 8ms and max 15ms after the asynchronous `toBlob` change.
- Immutable snapshot handoff as the residual blocker: median 13ms, p95 15ms, max 16ms.
- Live-alpha background comparison and wet display rendering: median 6ms and 5ms respectively.
- Undo snapshot copies as the dominant cost: measured copy stages are approximately 1ms each.
- Interpolation/store notifications in duplicate mode as the dominant cost: approximately 0-1ms.
- Snapshot workers, background subtraction, fixed delays, cache coalescing, and additional encoding work as the next optimization branch.
- Scheduling only between complete brush jobs as a sufficient guarantee: it can admit input between jobs, but cannot preempt the measured synchronous work once `applyStrokeToEngine()` starts.

## Stage Classification

### Existing finalization transaction

1. `onPointerUp()` immediately records the immutable stroke/action and appends a `DeferredStrokeFinalization`; this is small, immediately required to accept the completed brush, preserve FIFO identity, and keep N brushes as N actions.
2. `pushUndoSnapshot()` captures dry, wet, drying, opacity, and saved-wet state before each brush. It is synchronous but measured small. It is required before applying that brush so Undo during pending work has an exact pre-brush state.
3. `applyStrokeToEngine()` is synchronous and currently uninterruptible as a whole. Native apply timing accounts for essentially all finalization CPU.
4. `notifyCompletedMutation()` and Roto cache work happen only after the brush is fully applied; measured downstream costs are not the selected branch.

### `applyStrokeToEngine()` paint stages

| Stage | Current behavior | Classification | Candidate boundary |
|---|---|---|---|
| `prepareWetLayerForStroke()` normal mode -> `forceDryAll()` | Full-canvas `getImageData`, pixel scan/transfer, `putImageData` | Synchronous/uninterruptible primitive; duplicated before each non-local paint brush; required before that brush because old wet paint must be baked in sequential order | Safe yield only before/after today. To interrupt within it, expose resumable row/tile state while retaining one source `ImageData` and exact scan order |
| `prepareWetLayerForStroke()` local mode | Full-canvas dry readback and scan; bakes wet pixels outside keep radius, clears wet/drying state | Synchronous/uninterruptible primitive; required before local deposit; potentially duplicated full-canvas work | Safe yield before/after. Incremental seam can scan deterministic contiguous ranges, then perform one final `putImageData` |
| smooth/resample/ribbon/deform setup | CPU geometry and deterministic/random deformation setup | Synchronous; likely bounded by point/layer count; immediately required to construct brush raster | Safe boundary after geometry only if all random-dependent geometry/layer inputs are captured so yielding cannot alter RNG order |
| layer rasterization (`fillPolyGrain`/`fillFlat`) | Roughly 37 layers in single-color path; grain layers allocate/read/modify/write bounded offscreen canvases | Synchronous per layer; repeated within a brush; immediately required for final brush pixels; separable between completed layers if layer index, deformed polygon, RNG progression, and offscreen canvas persist | Strongest cooperative intra-brush candidate, but each `fillPolyGrain` remains uninterruptible and may itself need row/tile continuation |
| bristle traces | Iterates bristles and curve, uses `Math.random`, mutates offscreen canvas | Synchronous; immediately required; separable between bristles only with persisted bristle definitions/index and unchanged random call order | Yield between bristles after deterministic state capture; do not recompute |
| paper emboss | Bounded `getImageData`, nested pixel loop, `putImageData` | Synchronous/uninterruptible primitive; immediately required for exact pixels | Yield before/after today; resumable row/tile loop if this primitive is long |
| transfer to wet layer | Bounded offscreen readback plus nested per-pixel deposit/subtractive mixing into shared wet buffers | Synchronous/uninterruptible primitive; immediately required before following brush because later brushes read/mix this state | Yield before/after today; resumable deterministic row/tile continuation is possible, but no later brush may overtake it |
| edge feathering | Repeated bounded passes over shared wet buffers | Synchronous; immediately required before saved-wet accumulation and local physics/dry | Safe between complete passes if continuation preserves pass order; individual pass may need tiling if long |
| saved-wet accumulation | Full-canvas scan updating saved wet buffers and last-stroke mask | Synchronous/uninterruptible loop; required before local physics/drying and Undo-correct final state | Resumable contiguous index ranges are safe; no following brush may start until complete |
| local fluid physics | Allocates local grids; mask blur; 1-10 ordered solver ticks; each tick performs velocity solve, six advections, and writeback | Synchronous; ticks are safely separable in principle; required for final brush physics semantics before completion | Yield only between completed ticks initially. If one tick is too long, add resumable solver substage/row continuation, preserving iteration and channel order |
| final `forceDryAll()` in non-local paint | Full-canvas transfer and clear | Synchronous/uninterruptible primitive; immediately required for visible/final sequential pixels | Same resumable seam as pre-stroke drying |
| local `startNaturalDrying()` | Starts 10fps timer after local brush finalization | Deferred; not on measured apply CPU; required after the brush reaches committed wet state | Start only after job completion; timer must not race a partially applied job |
| last-stroke bounds | Point scan and assignment | Small synchronous bookkeeping; required for later “Last” physics | Keep at job completion |

### Pickup, erase, and drying dependencies

- Color pickup performs a full dry-canvas snapshot, then samples/mixes colors per curve segment. The snapshot and segment sequence are synchronous and immediately required because pickup depends on the exact preceding canvas state. Segment rendering is naturally stageable, but segments must remain ordered and cannot be interleaved with another brush.
- Erase creates and rasterizes a bounded mask, reads mask and dry pixels, applies a nested per-pixel erase to wet and dry state, writes the bounded result, then calls full-canvas `forceDryAll()`. The mask/layer and pixel phases have safe boundaries; their inner loops need continuation state if individually long.
- `forceDryAll()` and `dryStep()` combine canvas readback, ordered pixel transfer, shared wet-buffer mutation, and canvas writeback. They are not safely interruptible with the current API. A resumable implementation may process deterministic contiguous ranges while retaining the same `ImageData`, then publish with one `putImageData`; natural drying must be paused while a stroke job owns these buffers.
- Grain/emboss and bristle randomness forbid recomputation after a yield. Continuation must retain generated geometry/state and preserve the exact number and order of random calls.

### Visibility and flush boundaries

- Immediate visible feedback does not require completed rasterization: the render loop already draws queued stroke outlines and the active preview while finalization is pending.
- Exact completed pixels, mutation notification/cache capture, and removal of a queued outline require that brush job to finish.
- Undo must synchronously or asynchronously flush all earlier FIFO jobs through the requested action boundary before restoring one pre-brush snapshot; it must not create fewer than N Undo steps.
- Clear invalidates queued and active continuation generations and prevents any stale continuation from publishing.
- Navigation/frame rebinding, save/export/getCanvas/renderAllStrokes, close/apply, and engine disposal require explicit finalization flush or cancellation semantics. Current `destroy()` drops pending jobs, so the app-level close cache flush is insufficient for a future incremental engine unless engine finalization is flushed first.
- Play/animation replay remains synchronous and unchanged for the first implementation slice; the input-priority scheduler applies only to interactive queued finalization.

### Stop-condition verdict

The native measurement proves `applyStrokeToEngine()` is a long synchronous transaction, but existing instrumentation does not identify whether one primitive call consumes most of the ~800ms. Therefore cooperative scheduling between complete brush jobs alone is **not sufficient**: it improves admission between jobs but cannot prevent input dispatched during an active job from waiting up to that job's duration. The implementation must begin by measuring primitive boundaries. If one primitive is near the full duration, stop and introduce a resumable/incremental engine API for that primitive; do not add a speculative worker. If cost is distributed across many bounded calls, a staged finalization job can yield between those calls without changing raster algorithms.

## Implementation / RED-Test Plan

1. Add behavior-first RED tests around an injectable scheduler/pending-input probe: pointerdown is accepted and previewed while an earlier finalized brush remains queued; no fixed timeout controls yielding.
2. Add a deterministic reference harness that runs the same seeded brush sequence through current sequential finalization and the staged path, asserting identical final dry/wet/display pixels, strict FIFO order, and N completed mutations/N Undo snapshots.
3. Add RED coverage for N rapid brushes -> N Undo operations; Undo invoked with pending work flushes through the target brush and restores exact prior pixels.
4. Add RED coverage that Clear invalidates queued/active continuations and stale work cannot publish or notify.
5. Add RED coverage for source-frame binding across navigation, distant/custom-spaced keys, close/disposal flush, additive cached-base repaint, and unchanged Play path.
6. Add scheduler fairness RED coverage: bounded work per turn, input-priority yield when `isInputPending()`/scheduler state requests it, FIFO resume, and forced progress after a bounded number of input-priority turns so finalization cannot starve.
7. Instrument internal primitive durations without changing behavior. Apply the critical stop condition to the longest call.
8. If distributed: introduce an internal `StrokeFinalizationJob` state machine with `step(budgetContext)` and explicit phases matching the table. Process one safe phase/layer/pass/tick or bounded contiguous pixel range per turn, check pending input only at safe boundaries, and retain all mutable/RNG state.
9. If concentrated: first refactor only the dominant primitive (`forceDryAll`, transfer, emboss/grain, erase loop, or local solver) to a resumable cursor API used by the same job state machine. Keep exact loop order and publish semantics. No worker in this phase.
10. Define explicit `flushPendingStrokeFinalizations()` semantics for Undo, navigation/load, save/export/capture, close/apply, and destroy. Flush remains ordered and may run to completion at those explicit boundaries; ordinary pointer interaction never forces it.

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-07-14T15:21:00Z
  checked: "Continuation initialization and project skill discovery"
  found: "The required debug/reference files were loaded, no project-local SKILL.md files were found under .claude/skills or .agents/skills, and the configured agent-skills query returned an unusable 'Unhandled node type: string'. The codebase-memory skill was invoked first as required, but its graph MCP functions are not exposed in this runtime tool inventory."
  implication: "Proceed with focused native Grep/Read discovery while preserving the existing working tree; do not infer missing graph results."

- timestamp: 2026-07-14T09:50:04Z
  checked: "Knowledge base and repository history"
  found: "No prior knowledge-base entry overlaps this latency symptom. The current branch is clean except for this debug session, and automatic Roto pixel caching was introduced across commits a6635b87 through a305c84b."
  implication: "Use differential debugging against that focused commit series; there is no known-pattern diagnosis to assume."

- timestamp: 2026-07-14T09:50:04Z
  checked: "Common bug pattern quick map"
  found: "The symptom maps primarily to Async/Timing and State Management: awaited work on the interaction path, same-frame races, stale completion, or duplicated reactive notifications."
  implication: "Tests must distinguish promise blocking from synchronous pre-promise capture and preserve monotonic revision ordering."

- timestamp: 2026-07-14T09:50:04Z
  checked: "Automatic cache commit file set"
  found: "The feature touched PhysicsPaintStudio, PhysicsPaintCanvasMount, useRotoFramePersistenceCoordinator, rotoLivePixelCacheTransactions, EfxPaintEngine, preact engine wiring, and physicPaintRotoDurableCore tests."
  implication: "These files define the complete mutation-to-cache path and the most likely test seam."

- timestamp: 2026-07-14T09:50:04Z
  checked: "Completed-mutation call chain"
  found: "EfxPaintEngine finalizes a stroke, synchronously calls notifyCompletedMutation, and PhysicsPaintStudio synchronously calls copyLiveAlphaCanvas before launching captureLivePixels without await. copyLiveAlphaCanvas renders the full wet layer and copies dry/display surfaces into an immutable canvas."
  implication: "The immutable canvas detachment is on the callback stack; all later conversion work must be proven separately because ignoring the returned promise does not defer code executed before its first await."

- timestamp: 2026-07-14T09:50:04Z
  checked: "Live pixel transaction and conversion implementations"
  found: "capture() immediately invokes produce() before awaiting it. For uncached/empty-base paint, produce calls buildRotoFrameFromCanvas, whose outputCanvas.toDataURL('image/png') performs synchronous PNG encoding. Cached-base merge suspends for image loading but later also calls output.toDataURL synchronously."
  implication: "Every automatic non-additive brush PNG encode is synchronously inside the completed-mutation callback despite `void captureLivePixels(...)`; additive repaint moves encoding later but still blocks the main thread when the image load resumes."

- timestamp: 2026-07-14T09:50:04Z
  checked: "Existing transaction tests"
  found: "Existing tests prove latest same-frame revision wins, different frames progress independently, and removal invalidates stale captures, but no test asserts that expensive production/encoding is outside the interactive call stack."
  implication: "A focused RED behavior test can lock down the missing non-blocking boundary without replacing existing ordering coverage."

- timestamp: 2026-07-14T10:18:44Z
  checked: "Graph-assisted symbol and test discovery"
  found: "The indexed graph identifies createRotoLivePixelCacheTransactions as the cache transaction seam and physicPaintStore regeneration functions as derived-work sinks. Existing focused tests are in rotoLivePixelCacheTransactions.test.ts, while bridge/store work is in separate modules."
  implication: "The transaction interface is the smallest public seam for the first TDD slice: prove caller-stack release independently from downstream persistence and interpolation details."

- timestamp: 2026-07-14T10:19:49Z
  checked: "Complete capture-to-commit implementation"
  found: "capture() allocates a revision then immediately evaluates input.produce() on the caller stack. The coordinator's producer performs buildRotoFrameFromCanvas/toDataURL for uncached paint; accepted commit then synchronously upserts the store, regenerates interpolation when enabled, bumps the Signal/dirty callback, updates launch context, and queues parent delivery only afterward."
  implication: "H1 is directly testable at the transaction seam. Downstream store/interpolation work is real but runs only after asynchronous production resolves; parent bridge delivery is promise-queued and is not the initial pointer-up blocker."

- timestamp: 2026-07-14T10:25:56Z
  checked: "TDD test design against the real encoding seam"
  found: "A producer-only scheduling test would be too shallow because it could pass while the real encoder still uses synchronous toDataURL. The RED test now calls the intended async frame encoder through capture with controllable delayed toBlob callbacks and checks caller return plus latest-revision commit."
  implication: "The test binds the transaction scheduling and browser encoding behaviors together at the production interface, preventing a false-green fix that merely wraps synchronous encoding in an already-started Promise."

- timestamp: 2026-07-14T10:49:54Z
  checked: "RED-GREEN implementation and complete app regression suite"
  found: "The RED test failed because the async encoder seam did not exist. Production now releases capture work across a task boundary, discards obsolete same-frame revisions before producer/encoding starts, encodes fresh and additive merged canvases with toBlob, preserves revision checks before commit, and exposes a close-only flush that waits for cache plus parent delivery. Focused tests pass 13/13, relevant Roto/Studio tests pass 108 with 1 existing skip, full app tests pass 753 with 1 skip and 101 todos, TypeScript passes, and git diff --check passes."
  implication: "Automated evidence satisfies the non-blocking transaction, bounded/coalesced queue, stale completion, additive merge, frame binding, generated interpolation, close flush, and Play regression contracts. Native interaction responsiveness remains the final acceptance boundary."

- timestamp: 2026-07-14T11:59:10Z
  checked: "Residual-latency source trace and behavior-neutral profiling implementation"
  found: "The engine now emits optional mutation-correlated timings for pointer-up CPU, finalization queue wait, Undo dry readback, live/saved wet-buffer copies, stroke application/finalization, completed-mutation listener, live-alpha wet render/allocation/readback/comparison/write/copy stages with separated versus background-subtraction branch, and next-pointerdown dispatch delay. The app profiler separately records snapshot handoff, cache task wait/producer/accepted commit, toBlob/FileReader/total encode elapsed time, real-key insertion, interpolation regeneration, visual/dirty notification, and bridge queue/delivery. Profiling is development-only, disabled by default, bounded to 600 samples, non-reactive, and exposes only clear and summary methods. No optimization branch was implemented."
  implication: "Native data can now distinguish synchronous main-thread blocking, scheduled/grace waiting, asynchronous elapsed work, and stages sharing the mutation ID of a delayed next pointerdown. The next code change must be selected from that evidence rather than speculation."

- timestamp: 2026-07-14T11:59:10Z
  checked: "Profiler automated regression gates"
  found: "Focused app/store profiling tests pass 78/78; focused engine boundary tests pass 4/4; mounted Studio and durable Roto tests pass 94 with 1 existing skip; full app suite passes 759 with 1 skip and 101 todos; app and package TypeScript checks pass; package build succeeds; git diff --check passes. Existing non-Tauri launch-listener warnings remain non-failing."
  implication: "The measurement layer is automated-ready and behavior-neutral; native profiling is now the required checkpoint before any worker, snapshot, Undo/finalization, or interpolation optimization."

- timestamp: 2026-07-14T15:12:47Z
  checked: "Native interpolation-on rapid handwriting profile (writing 'hello' twice)"
  found: "Stroke-finalization sync CPU median 775ms, p95 995ms, max 1181ms; stroke-apply sync CPU median 773ms, p95 993ms, max 1179ms; finalization queue wait median 5896ms; next-pointerdown dispatch delay median 1085ms, p95 4116ms, max 6783ms. Snapshot handoff, live-alpha compare/wet render, PNG, Undo copies, and interpolation/store notifications were all small."
  implication: "The selected residual branch is synchronous engine rasterization/drying inside applyStrokeToEngine. Cache, encoding, snapshot, worker, interpolation, and bridge optimization are ruled out unless contradictory evidence appears."

- timestamp: 2026-07-14T15:12:47Z
  checked: "Read-only applyStrokeToEngine and primitive call graph"
  found: "A queued brush is finalized as one synchronous call containing pre-stroke full-canvas drying, bounded multi-layer rasterization, grain/emboss read-modify-write, wet transfer, full-canvas saved-wet accumulation, optional local fluid solver ticks, and final full-canvas drying. Erase similarly performs bounded mask/pixel work then full-canvas drying. Color pickup adds a full dry-canvas snapshot and ordered segment rendering."
  implication: "There are safe boundaries between several stages/layers/passes/ticks, but current functions do not expose continuation state. Exact output requires retained geometry/RNG state and strict FIFO completion before another brush mutates shared wet/dry buffers."

- timestamp: 2026-07-14T15:12:47Z
  checked: "Undo, Clear, replay, navigation/export, and disposal dependencies"
  found: "Each finalization pushes a complete pre-brush dry/wet/saved snapshot before applying. Undo currently flushes all pending jobs then pops one snapshot/action; Clear cancels pending jobs; save/getCanvas/export/replay flush synchronously; destroy currently discards pending jobs. Queued outlines already provide immediate provisional feedback."
  implication: "The scheduler must preserve one job/snapshot/action per brush, make Clear invalidate active continuations, and add explicit engine flush semantics before close/navigation/disposal. Interactive scheduling can change without changing Play replay."

- timestamp: 2026-07-14T18:06:00Z
  checked: "Authorized native primitive checkpoint and current implementation seam"
  found: "Three profiles show raster layers (~340ms) and local fluid (~323ms) account for ~84% of finalization; individual raster layer operations are bounded, and local fluid already has an explicit ordered tick loop. The engine still uses fixed 600/80/16ms timers, shifts a whole job before one synchronous apply, and destroy drops pending work."
  implication: "Replace timer/debounce scheduling with pending-input-aware task turns, retain the active FIFO job until completion, expose paint-layer and fluid-tick continuations, and make destroy/explicit flush complete pending accepted brushes."

- timestamp: 2026-07-14T18:06:00Z
  checked: "Project skill and structural discovery"
  found: "TDD, diagnosing-bugs, implement, and project reference skills were loaded; no package-local CONTEXT.md or ADR was found. Codebase-memory graph functions are not exposed as callable tools in this runtime, though hook context confirmed DeferredStrokeFinalization and notifyCompletedMutation symbols."
  implication: "Use the existing seven-test RED loop and focused Read/Grep source inspection; preserve behavior-first public tests and the current uncommitted tree."

## Evidence/Test Stage Completion

### Files and contracts

- Added `packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts` with seven intentional RED behavior contracts covering input acceptance during pending work, FIFO and deterministic pixels, N brushes/N Undo plus pending Undo, Clear invalidation, source-frame binding, disposal flush, and starvation prevention.
- Reused existing durable app/package tests for cached-base additive merge, frame ownership/navigation, close delivery, and Play behavior instead of duplicating those invariants. Updated the shared durable-test async flush helper to account for the intentional cache task handoff.
- Completed primitive instrumentation in `brush/paint.ts`, `brush/erase.ts`, `core/wet-layer.ts`, `core/drying.ts`, `core/fluids.ts`, and `engine/EfxPaintEngine.ts`; `types.ts` carries the optional observer type.

### Intentional RED result

Command: `pnpm --dir app exec vitest run --root packages/efx-physic-paint src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts`

Result: 1 file RED, 7/7 tests failed with `Missing cooperative finalization test seam: production can only run applyStrokeToEngine as one synchronous transaction.` This proves there is no resumable cooperative finalization driver/seam yet; no scheduler implementation was added.

### Instrumentation stages

- Pre-stroke: `paint-pre-stroke-local-full-frame-readback`, `paint-pre-stroke-local-pixel-loop`, `paint-pre-stroke-local-full-frame-writeback`, plus `paint-pre-stroke-force-dry-{full-frame-readback,pixel-loop,full-frame-writeback}`.
- Paint raster: `paint-raster-geometry`, `paint-raster-layers`, grain readback/pixel/writeback/draw-image, `paint-raster-bristles`, emboss readback/pixel/writeback, and `paint-raster-paper-emboss`.
- Wet/saved stages: transfer readback/pixel loop, `paint-wet-transfer-composition`, edge-feather passes, and `paint-saved-wet-full-frame-scan`.
- Physics: local allocation, initial copy, mask build/blur, per-tick height equalization, edge darkening, velocity solve, channel allocation/copy/advection/writeback, per-tick total, and `paint-local-fluid-total`.
- Final drying: `paint-final-force-dry-*`; erase geometry/mask raster/mask and dry readback/pixel loop/writeback plus `erase-final-force-dry-*`; pickup full-frame readback and color sampling; natural `dry-step-*` readback/pixel/writeback.
- Every primitive sample is emitted through the existing `PaintPerformanceSample` listener with the active mutation ID. When disabled, only the existing listener null-check is performed and observers are not passed.

### Automated gates

- App suite: 74 files, 71 passed and 3 skipped; 759 passed, 1 skipped, 101 todo.
- Durable Roto focused suite: 51 passed, 1 skipped.
- Engine profiler boundary: 5/5 passed.
- Package TypeScript: passed. App TypeScript: passed. Package build: passed. `git diff --check`: passed.
- Package Play suite currently has 19 passed and 2 pre-existing unrelated failures in Play-frame annotation expectations; app Play lifecycle coverage remains green in the full app suite.

### Native primitive checkpoint

1. In the native development WebView console run: `localStorage.setItem('efx.physicsPaint.profile', '1'); window.__EFX_PHYSICS_PAINT_PROFILE__.clear()`.
2. Clear the current Roto frame, keep interpolation enabled, then rapidly handwrite `hello` twice with consecutive brushes on a representative rich/complex real key; include at least one paint brush with local Physics, one pickup-enabled brush, and one erase stroke so all branches emit.
3. Run: `window.__EFX_PHYSICS_PAINT_PROFILE__.summary()` and capture the full stage table, especially median/p95/max and correlated input-delay counts.
4. Disable profiling with: `localStorage.removeItem('efx.physicsPaint.profile')`.

Status: implementation complete and awaiting native UAT. Paint raster work advances one retained layer/group per cooperative turn, local fluid advances one complete tick per turn, erase remains synchronous but FIFO-ordered, and synchronous wrappers remain for replay/load/non-interactive boundaries.

- timestamp: 2026-07-14T18:52:00Z
  checked: "Cooperative finalization implementation and RED-to-GREEN verification"
  found: "Paint rasterization now retains geometry, offscreen canvases, and RNG state across one-layer/group turns; local fluids retain solver state across complete ticks; EfxPaintEngine owns only the FIFO head, yields via postTask/MessageChannel when input is pending, forces progress after four input-priority yields, flushes explicit semantic boundaries and disposal, and invalidates stale generations on Clear. The former seven missing-factory tests were replaced with production-seam behavior contracts and deterministic raster/fluid parity tests."
  implication: "Automated implementation gates are complete. Native rapid-stroke UAT is the remaining acceptance boundary; keep this session open and uncommitted."

- timestamp: 2026-07-14T17:14:13Z
  checked: "Native UAT of the first cooperative scheduler policy"
  found: "Interaction was somewhat better, but fast handwriting preview broke into straight/cut segments. Next-pointerdown dispatch measured 248ms median and 525ms max; continuation primitives were bounded (raster 1ms median/6ms max, local fluid 10ms median/11ms max), queue wait was only 24ms, while asynchronous finalization still spanned 220-542ms."
  implication: "Primitive splitting is validated; the remaining regression is scheduler policy. Forced progress during drawing and chained postTask/MessageChannel turns compete with pointermove and preview rAF."

- timestamp: 2026-07-14T17:14:13Z
  checked: "Frame-paced scheduler correction RED-to-GREEN"
  found: "Production-seam contracts were expanded from 7 to 12. The new contracts were RED under the task-chain scheduler, then GREEN after moving normal progress into the existing render rAF: execution rechecks drawing, performs zero work while drawing, preserves the active continuation on pointerdown, advances exactly one safe step after preview/cursor rendering per eligible frame, resumes FIFO on the first eligible frame, retains jobs through prolonged drawing, and keeps synchronous lifecycle flush. Focused scheduler/parity tests pass 20/20; durable Roto passes 51 with 1 skip; full app passes 759 with 1 skip and 101 todos; package/app TypeScript, package build, and git diff --check pass."
  implication: "The measured correction is automated-ready. Native UAT must now verify continuous fast handwriting preview and acceptable post-release frame-paced drain without changing exact pixels or lifecycle behavior."

- timestamp: 2026-07-14T17:41:54Z
  checked: "Exact pointer-input to raster flow and point ownership"
  found: "onPointerMove drains getCoalescedEvents() in provided order through extractPenPoint, filters points closer than 1.5 canvas pixels, and stores mutable rawPts for active preview. onPointerUp does not inspect coalesced events or the release event; it clears preview, checks the existing rawPts minimum of three, clones rawPts once to points, then gives value copies to allActions while DeferredStrokeFinalization owns points. Queued preview and both synchronous/cooperative final raster read pending.points. PenPoint carries x/y, pressure, tilt, twist, and speed, but no timestamp."
  implication: "The source-level hypothesis is confirmed: terminal samples delivered only with pointerup are omitted before immutable capture. A narrow release-staleness rule must therefore compare PointerEvent.timeStamp while consuming events, without changing PenPoint or raster semantics."

- timestamp: 2026-07-14T17:41:54Z
  checked: "Known unrelated native regression"
  found: "The user reports native Undo is currently broken."
  implication: "Record Undo as an explicit unresolved follow-up and do not modify Undo during this terminal input-fidelity task."

- timestamp: 2026-07-14T17:44:22Z
  checked: "Focused pointer-input production-seam RED run"
  found: "EfxPaintEngine.pointerInput.test.ts ran 10 tests: 6 failed and 4 passed. Failures directly showed pointerup coalesced samples and valid release endpoints were absent, rapid loops/short flicks could be discarded below the existing three-point threshold, and the queued finalization sequence was not frozen. Near-duplicate, non-finite, out-of-canvas release expectations and pointermove order were already compatible with existing behavior because pointerup ignored release entirely."
  implication: "The feedback loop is deterministic and red-capable at the real handlers. Implement only terminal sample consumption and immutable capture, preserving the existing threshold and raster behavior."

- timestamp: 2026-07-14T17:47:12Z
  checked: "Pointer terminal-fidelity RED-to-GREEN implementation and automated gates"
  found: "A shared consumePointerSamples helper now uses extractPenPoint for pointerdown, pointermove, pointerup coalesced samples, and the release event. It preserves provided order and PenPoint pressure/tilt/twist/speed, accepts finite in-canvas samples whose event timeStamp is not older than the last accepted sample, and retains the existing 1.5px meaningful-distance filter. Pointerup drains coalesced samples first and release last. One frozen captured point sequence feeds DeferredStrokeFinalization/queued preview/final raster, while allActions receives a separate frozen value-identical copy. The existing minimum of three accepted points is unchanged."
  implication: "Terminal input capture is automated-ready without changing smoothing, raster, physics, scheduler, cache, or lifecycle semantics. Native handwriting UAT is the remaining acceptance boundary."

- timestamp: 2026-07-14T17:47:12Z
  checked: "Automated verification counts and warnings"
  found: "Pointer RED was 6 failed/4 passed; GREEN is 10/10. Focused pointer+scheduler+raster/fluid parity+profiler suite passes 30/30. Mounted Studio/durable Roto passes 94 with 1 skip. Full app vitest run passes 759 with 1 skip and 101 todos across 71 passed/3 skipped files. Package and app TypeScript pass, package build passes, and git diff --check passes. Existing non-failing Tauri launch-listener and missing sourcemap warnings remain."
  implication: "No automated regression was detected. Do not claim resolved until the user confirms fast native terminal handwriting fidelity."

- timestamp: 2026-07-14T20:48:30Z
  checked: "Native multi-stroke preview feedback and tablet dynamics trace"
  found: "Native UAT still showed that separate rapid strokes could not be drawn freely because one finalization step ran on every non-drawing frame; active drawing also retained only the newest three queued outlines, visibly cutting older unfinished strokes. Long continuous strokes avoided the scheduler contention but appeared pressure-flat. Source tracing found speed was calculated from performance.now() for every coalesced sample, the latest native tablet value could overwrite every event in a batch, and BrushOpts.pressure was stored but unused by paint raster geometry."
  implication: "Adopt the user's explicit 500ms inactivity gate as input batching policy, keep every pending outline visible during the gate, derive speed from PointerEvent timestamps, preserve real per-event pen dynamics when available, and apply the existing pressure multiplier to preview and final paint width without changing opacity."

- timestamp: 2026-07-14T20:48:30Z
  checked: "Idle-gate and tablet-dynamics RED-to-GREEN verification"
  found: "Focused RED produced six failures: work began before 500ms idle, new input did not reset the idle window, queued preview was capped, coalesced speed used callback timing, native fallback flattened real event dynamics, and paint pressure multiplier had no implementation. GREEN now passes 30 focused tests and 36 complete engine contracts. Mounted Studio/Roto passes 169 with 1 skip; full app passes 759 with 1 skip and 101 todos; package/app TypeScript, package build, and git diff --check pass."
  implication: "The 500ms inactivity policy and tablet dynamics are automated-ready. Native UAT must validate multi-stroke freedom, delayed FIFO catch-up, queued-preview continuity, and pressure/tilt/speed feel. Undo remains explicitly deferred."

- timestamp: 2026-07-14T21:13:00Z
  checked: "Failed native 500ms and pressure UAT"
  found: "The user observed immediate-looking work after release and broken pressure. Complete call tracing proved automatic Roto capture does not flush engine finalization and the built runtime contains the 500ms gate. The remaining waiting-path work was render(): every animation frame recomputed smooth/resample/ribbon geometry for every queued stroke. Pressure tracing found the Studio exposes no pressure control or setBrushPressure call, while the engine default is 70; applying that dormant value reduced all tablet widths."
  implication: "Keep the explicit idle gate, but precompute immutable queued preview geometry once at pointerup and draw only that cached polygon while waiting. Remove the hidden multiplier and preserve the established latest-native-pressure plus PointerEvent-position bridge contract."

- timestamp: 2026-07-14T21:13:00Z
  checked: "Cached queued preview and raw-pressure RED-to-GREEN correction"
  found: "Production-seam RED failed because queued finalizations had no cached preview geometry and no cached draw path. GREEN precomputes frozen preview polygons once, reuses them every frame, and removes pressureMultiplier/getEffectivePressure from paint/preview while retaining raw per-point pressure, tilt, twist, and event-timestamp speed. Complete engine contracts pass 37/37; mounted Studio/Roto passes 169 with 1 skip; full app passes 759 with 1 skip and 101 todos; package/app TypeScript, package build, and git diff --check pass."
  implication: "The failed native hypotheses have been corrected narrowly. Native retest remains mandatory before any resolved claim."

- timestamp: 2026-07-14T21:28:00Z
  checked: "Repeated native report that raster still starts immediately"
  found: "The idle timestamp was written at pointerup entry, not after the handler's handoff work. Pointerup then built the full smoothed/resampled/ribbon queued preview before returning. If that synchronous work or event backlog lasted near 500ms, the first eligible render frame saw an expired window and started finalization immediately."
  implication: "The artist-visible idle interval must be anchored after all release handoff work, and release must not build preview geometry. Use the frozen points as a cheap queued centerline preview."

- timestamp: 2026-07-14T21:28:00Z
  checked: "Post-handoff idle clock and cheap queued-preview RED-to-GREEN correction"
  found: "RED proved no post-handoff timestamp API existed and queued drawing still depended on prebuilt geometry. GREEN adds lastStrokeHandoffTime set immediately before scheduling, gates on max(last pointer activity, last handoff), removes smooth/resample/ribbon from pointerup, and draws queued frozen points as a dashed open polyline. Focused interaction tests pass 32/32; complete engine contracts pass 38/38; mounted Studio/Roto passes 169 with 1 skip; full app passes 759 with 1 skip and 101 todos; package/app TypeScript, package build, and git diff --check pass."
  implication: "Automated behavior now matches a full artist-visible 500ms delay after release returns. Native verification remains required."

- timestamp: 2026-07-14T22:04:00Z
  checked: "Exact two-stroke real-handler sequence and idle boundary race"
  found: "A production-seam test drove stroke 1 down/move/up, a render frame, stroke 2 down/move/up, and more render frames. It proved stroke 2 calls neither flushPendingStrokeFinalizations nor runStrokeFinalizationTurn; both jobs remain queued until the timer expires. Two missing activity signals explained native early starts: non-drawing pointermove updated only the cursor, and the rAF callback did not check browser input already queued but not dispatched."
  implication: "The second stroke does not force the first to render. Count pen hover as interaction and reject the finalization turn whenever navigator.scheduling.isInputPending reports queued input."

- timestamp: 2026-07-14T22:04:00Z
  checked: "Hover-aware idle reset and pending-input RED-to-GREEN correction"
  found: "Hover RED showed stroke 1 began 400ms after hover because the idle clock was unchanged. Queued-input RED showed finalization began at the exact 500ms boundary despite an undispatched pointer event. GREEN updates lastPointerInputTime for every canvas pointermove before the drawing guard and checks isInputPending({includeContinuous:true}) before any turn. Complete engine contracts pass 41/41; mounted Studio/Roto passes 169 with 1 skip; full app passes 759 with 1 skip and 101 todos; package/app TypeScript, package build, and git diff --check pass."
  implication: "Series batching is now tied to true pen inactivity rather than only completed down/up handlers. Native verification remains required."

- timestamp: 2026-07-14T22:21:00Z
  checked: "Screenshot of apparent pre-500ms render blended with queued outline"
  found: "The screenshot shows completed paint pixels and the dashed queued centerline for the same stroke simultaneously. The scheduler and real-handler tests prove the raster starts only after the idle gate; the apparent double render is preview ownership. getQueuedStrokePreviews returned the FIFO head through raster, post-raster, and fluid phases, even though raster transfer had already published wet pixels before post-raster began."
  implication: "The active outline must remain through prepare/raster to cover incremental offscreen work, then disappear immediately when raster.step() completes and phase becomes post-raster. Later queued jobs retain their outlines."

- timestamp: 2026-07-14T22:21:00Z
  checked: "Active outline/raster ownership RED-to-GREEN correction"
  found: "RED reproduced the screenshot: an active post-raster job remained in the queued-preview list. GREEN filters only active.pending once its phase is post-raster/fluid/complete; prepare/raster and later queued jobs remain visible. Complete engine contracts pass 42/42; mounted Studio/Roto passes 169 with 1 skip; the final isolated full app rerun passes 759 with 1 skip and 101 todos. Package/app TypeScript, package build, and git diff --check pass."
  implication: "Visual state now has one owner per active stroke: outline before pixel publication, raster after publication. Native screenshot comparison remains required."

- timestamp: 2026-07-14T22:52:00Z
  checked: "Four-stroke trackpad native profile and exaggerated visual"
  found: "The profile contains exactly four paint-wet-transfer-composition calls, four emboss passes, four local-fluid totals, and twelve local-fluid ticks for four strokes. paint-raster-layers count 156 equals about 39 intentional layers per stroke. Therefore strokes are not replayed or applied several times; the strong visual is one normal layered render per stroke. Critical stroke-finalization-queue-wait samples were absent because 600 primitive samples evicted them, so the log cannot determine first-pixel timing."
  implication: "Stop using visual thickness as evidence of duplicate transactions. Preserve interaction-critical timing independently of primitive sample volume and emit a first-raster-publication event."

- timestamp: 2026-07-14T22:52:00Z
  checked: "Critical native timeline retention and first-publication instrumentation"
  found: "The profiler now preferentially retains pointer-up, queue-wait, first-raster-publication, finalization, and input-delay samples within the 600-sample cap and exposes the latest 40 as recentCriticalSamples. EfxPaintEngine emits stroke-first-raster-publication when raster.step() first completes, measured from pending.queuedAt. Profiler and engine RED tests are GREEN; complete engine contracts pass 43/43; focused Studio/profiler passes 97 with 1 skip; final isolated full app rerun passes 759 with 1 skip and 101 todos. Package/app TypeScript, package build, and git diff --check pass."
  implication: "A two-stroke native trace can now conclusively decide the remaining timing question without overflow."

- timestamp: 2026-07-14T23:05:00Z
  checked: "Two-stroke critical timeline and cross-stroke visual strengthening"
  found: "Mutation 9 waited 2905ms before finalization and first published raster pixels at 4475ms; mutation 10 waited 2913ms and first published at 3197ms. Thus neither stroke rasterized before 500ms. Four-stroke evidence already proved one transfer per stroke. Source tracing showed the visible strengthening occurs when prepareWetLayerForStroke for stroke 2 bakes distant wet pixels from stroke 1 into dryCanvas using wet.alpha/800, while compositeWetLayer displayed the same high-opacity pixels using wet.alpha/3000*300."
  implication: "This is cross-surface alpha mismatch, not duplicate rendering or scheduler failure. Make local wet-to-dry baking visually identical to the live compositor."

- timestamp: 2026-07-14T23:05:00Z
  checked: "Wet-display to local dry-bake pixel parity RED-to-GREEN"
  found: "A one-pixel production-seam RED reproduced the native jump exactly: wet alpha 800 at opacity 1 displayed RGBA [120,30,60,80], then local pre-stroke baking wrote [120,30,60,255]. GREEN extracts wetDisplayAlpha from compositeWetLayer and uses it in prepareWetLayerForStroke; the baked RGBA now equals the displayed RGBA and wet buffers clear once. Complete engine contracts pass 44/44; focused Studio/profiler passes 97 with 1 skip; full app passes 759 with 1 skip and 101 todos; package/app TypeScript, package build, and git diff --check pass."
  implication: "Finalizing a later stroke can no longer strengthen an earlier distant stroke merely by moving it from wet overlay to dry canvas."

- timestamp: 2026-07-14T23:50:00Z
  checked: "Native rapid-stroke UAT after guarding the clean-to-dirty Roto transition"
  found: "The user confirmed the reported sequence now works: multiple strokes painted less than 500ms apart remain queued instead of earlier strokes rasterizing on the next pointer-down, and prior strokes no longer reapply during finalization."
  implication: "The capture-phase beginFrameEdit resetBackground/redrawAll path was the actual bypass. Native acceptance is approved; close this debug as resolved."

- timestamp: 2026-07-14T23:50:00Z
  checked: "Post-UAT regression and durable gates"
  found: "The behavior-level controller regression passes, focused controller tests pass 4/4, mounted durable Roto passes 51 with 1 existing skip, app TypeScript passes, the physics-paint package builds, and git diff --check passes."
  implication: "The confirmed fix is protected without retaining the discarded speculative timer or visual-batch implementation."

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "PhysicsPaintCanvasStack dispatches onInputIntent in pointer-down capture. beginFrameEdit() therefore ran before every engine pointer-down. Even after the current Roto frame was already dirty, markCurrentFrameDirty() cleared the reference and called engine.resetBackground(). resetBackground() calls redrawAll(), which flushes pending stroke finalizations and replays all recorded actions. Starting stroke 2 forced stroke 1 to raster before the 500 ms idle gate; starting stroke 3 forced stroke 2; the queued jobs then finalized later, producing the visible reapplication."
fix: "useRotoFrameEditingController now checks the synchronous dirty-frame set before marking the frame dirty. Reference clearing and resetBackground() run only for the first clean-to-dirty transition. Subsequent rapid edit intents still update live-overlay bookkeeping and stop playback, but do not flush or replay pending strokes. Speculative timer and visual-batch changes were removed."
verification: "Native UAT passed the reported rapid-stroke sequence: strokes painted under 500 ms no longer raster early or reapply over time. A behavior-level controller regression calls beginFrameEdit() twice and proves one reference/background transition with two dirty bookkeeping updates. Focused controller tests pass 4/4; mounted durable Roto passes 51 with 1 skip; app TypeScript, package build, and git diff --check pass. Undo remains deferred."
files_changed: [".planning/debug/roto-pointer-up-latency.md", "app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts", "app/src/components/physic-paint/hooks/useRotoFrameEditingController.test.ts", "packages/efx-physic-paint/src/brush/paint.ts", "packages/efx-physic-paint/src/brush/stroke.ts", "packages/efx-physic-paint/src/brush/erase.ts", "packages/efx-physic-paint/src/core/wet-layer.ts", "packages/efx-physic-paint/src/core/drying.ts", "packages/efx-physic-paint/src/core/fluids.ts", "packages/efx-physic-paint/src/render/canvas.ts", "packages/efx-physic-paint/src/engine/EfxPaintEngine.ts", "packages/efx-physic-paint/src/engine/EfxPaintEngine.pointerInput.test.ts", "packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts", "packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts", "packages/efx-physic-paint/src/types.ts", "app/src/lib/physicPaintRotoDurableCore.test.ts"]
