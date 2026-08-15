---
status: resolved
trigger: |-
  Paint/Roto timeline horizontal viewport is incorrectly coupled to frame selection instead of being controlled by the horizontal scrollbar.

  ## Surface

  This bug concerns only the horizontal viewport of the Paint/Roto physical timeline inside Physics Paint Studio. Do not modify the Motion Editor timeline.

  ## Reproduction

  Use a timeline long enough to have several viewport-width ranges.

  Example with approximately 47 visible frames:

                           [ current visible window ]
  0          47           94          X           141

  1. Navigate far enough right so the visible Paint timeline window is approximately frames 94–141.
  2. Keep the current physical cursor on frame X somewhere inside that window.
  3. Attempt to move the horizontal scrollbar left to inspect frames 47–94 or 0–47.
  4. Observe whether the scrollbar can navigate those ranges independently.
  5. Restore the 94–141 window.
  6. Click the visible frame at the extreme left edge, approximately frame 94.

  ## Actual behavior

  - The horizontal scrollbar cannot reliably move the viewport to earlier ranges such as 47–94 or 0–47 independently of frame selection.
  - Clicking the frame at the extreme left edge changes the selected physical frame and also shifts the timeline window left by approximately one complete visible-window width.
  - In the example, clicking frame 94 changes the viewport from approximately 94–141 to 47–94.
  - The shift amount appears related to the current visible-frame count, approximately 47 frames at the observed window width.
  - Frame selection therefore acts as an implicit pagination/scroll command.

  ## Expected behavior

  The horizontal scrollbar is the sole authority for manual horizontal viewport position.

  - Dragging the horizontal scrollbar changes only the visible timeline range.
  - Scrolling must not change the selected physical frame, cursor, canvas content, Group selection, key selection, project document, or history.
  - The scrollbar can navigate continuously across the complete valid Paint timeline range, including 0–47, 47–94, 94–141, and later ranges.
  - Clicking any visible frame, including the extreme left or right cell, selects that exact physical frame and reconciles the canvas, but does not change scrollLeft, viewStart, or the visible range.
  - Selection is allowed to become offscreen when the user moves the scrollbar away from it.
  - No automatic centering, reveal, pagination, or cursor-follow behavior occurs as a side effect of an ordinary timeline frame click.
  - Explicit navigation commands such as Go to Group or linked Previous/Next are outside this debug unless evidence proves they share the same incorrect authority.
  - Do not persist the viewport in the canonical project document or add it to Undo/Redo history.

  ## Investigation requirements

  Build a tight deterministic reproduction before changing production code.

  Find the authoritative relationship among:

  - DOM scrollLeft / scrollWidth / clientWidth;
  - virtualized or paged timeline viewStart;
  - selected physical frame and cursor;
  - any cursor-reveal, edge-pagination, auto-centering, or ensure-visible logic;
  - effects or signals that derive viewport position from the selected frame;
  - scrollbar min/max range and total physical timeline extent;
  - pointer/click handlers on visible frame cells.

  Do not assume that 47 is a product constant. Derive the observed shift from the actual visible-frame count or viewport width and prove why an edge click moves by that amount.

  Rank and test falsifiable hypotheses, including:

  1. Frame selection calls an ensure-visible or recenter helper even though the clicked frame is already visible.
  2. The virtualized viewStart is derived from the selected frame rather than from scrollLeft.
  3. The scrollbar range is limited to a cursor-relative page instead of the full physical timeline.
  4. A left-edge click is misclassified as a previous-page gesture.
  5. A signal/effect writes scrollLeft after cursor or selection changes.
  6. DOM scrolling updates a temporary value that is overwritten on the next render by cursor-derived state.

  ## Required RED regressions

  Add tests at the real timeline interaction seam, not a shallow helper-only seam.

  1. Scrollbar independence:
     - establish a selected frame inside a later range;
     - scroll left without changing selection;
     - assert the visible range changes;
     - assert cursor, selected frame, canvas authority and canonical document remain unchanged.

  2. Left-edge click:
     - establish a nonzero scrollLeft/viewStart;
     - click the first visible frame;
     - assert that frame becomes selected;
     - assert scrollLeft/viewStart remains byte-identical.

  3. Right-edge click:
     - click the final fully visible frame;
     - assert selection changes without horizontal viewport movement.

  4. Full-range scrollbar:
     - scroll to frame-zero boundary;
     - scroll to an intermediate range;
     - scroll to the final legal boundary;
     - assert all ranges are reachable independently of selection.

  5. Responsive-width control:
     - repeat with at least two viewport widths or visible-frame counts;
     - prove no implementation depends on a hardcoded 47-frame page size.

  6. Timeline-content controls:
     - ordinary real keys;
     - interpolation/generated cells;
     - Motion and Static Groups;
     - intentional gaps and Delete Frame cells;
     - clicking each visible cell kind must not alter the horizontal viewport.

  7. No-history control:
     - scrolling and edge-cell selection must not create a physical edit history entry;
     - existing Undo/Redo behavior remains unchanged.

  ## Fix constraints

  - Establish one UI-only horizontal viewport authority owned by the scroll container/scroll state.
  - Keep physical cursor and selection authority independent.
  - Remove only the unintended ordinary-click auto-scroll coupling.
  - Do not change canonical frame positions, interpolation, Groups, breaks, Key Spacing, playback, preview, export, persistence, or history.
  - Do not introduce a second timeline, fixed-size pagination model, hardcoded visible-frame count, timing workaround, setTimeout, requestAnimationFrame correction loop, or effect that continually copies cursor state into scroll state.
  - Preserve explicit navigation behavior unless it is proven to use the same defective ordinary-click path.
  - A rejected or cancelled physical edit must not affect the viewport, and scrolling must never settle a physical edit.

  ## Native acceptance

  After RED → GREEN, focused tests, full automated gates and independent review, freeze one exact candidate for native UAT:

  1. From a later viewport, move the scrollbar to earlier ranges without changing the selected frame.
  2. Move the scrollbar back to later ranges; selection and canvas remain unchanged.
  3. Click the leftmost visible frame; viewport remains fixed.
  4. Click the rightmost visible frame; viewport remains fixed.
  5. Repeat on ordinary keys, generated cells, Motion Group cells, Static Group cells and gray gaps.
  6. Verify the scrollbar reaches frame 0 and the final legal timeline boundary.
  7. Resize the Studio window and repeat; no fixed 47-frame behavior.
  8. Confirm Group Rails, status dots, cursor, canvas, Undo/Redo and project content remain unchanged by scrolling.

  Do not mark the debug resolved or commit/archive before the frozen native UAT passes.
created: 2026-08-14T17:47:26Z
updated: 2026-08-15T05:02:33Z
---

## Current Focus

bug_class: bohrbug
hypothesis: Confirmed, repaired, and accepted. The required dense projection removes the cursor-derived extent, the strip boundary rejects malformed runtime projections within the canonical 600-frame product bound, and pre-indexed structural and Key Spacing lookups preserve bounded full-capacity rendering without coupling selection to viewport authority.
test: Automated RED/GREEN regressions, focused and full one-shot Vitest, typecheck, production builds, revert-and-reconfirm, exact-candidate independent review, and all eight frozen native UAT steps passed.
expecting: The Paint/Roto horizontal scrollbar exclusively controls the complete UI-only viewport; ordinary cell selection reconciles the selected physical frame without changing the viewport, project content, or edit history.
next_action: None. Native UAT passed against the frozen candidate; archive the resolved checkpoint and leave the approved implementation, tests, and planning changes uncommitted.
reasoning_checkpoint:
  hypothesis: "The optional/sparse compatibility branch caused selection-controlled viewport movement because it rebuilt the represented 120-frame DOM extent from `currentFrame`. After removing it, the boundary still needed a runtime density check and one structural index to prevent malformed extent input and repeated capacity × records/groups/cache work."
  confirming_evidence:
    - "Direct runtime RED reproduced 12 failures: only 120 cursor-centered frames existed, edge selection replaced represented frames, and the scrollbar could not reach full capacity."
    - "The canonical resolver emits exactly one real/generated/empty cell for every frame `0 .. capacity - 1`, useRotoTimelineModel exposes that projection independently of selection, and PhysicsPaintStudio always passes it to WorkflowStrip."
    - "WorkflowStrip ordinary click handlers do not write `scrollLeft`; the remaining cursor coupling is the optional-prop fallback that calls `buildPhysicsPaintRotoFrameCells(currentFrame)`."
    - "The dynamic full-projection candidate made all viewport regressions green, while independent review found the retained fallback, malformed projection boundary, and repeated per-cell structural lookup as remaining review items."
    - "The repaired structural index validates `cell.appFrame === index`, creates physical/cache/lifecycle maps once per input identity change, and deterministic 120/600 tests assert one lifecycle classification per cell."
  falsification_test: "The hypothesis is wrong if changing `currentFrame` can still change represented frame identities, lane width, `scrollWidth`, `scrollLeft`, or Group Rail window without a viewport input; if a malformed projection renders; or if 600 structural index creation calls its lifecycle classifier more than 600 times."
  fix_rationale: "The required canonical projection remains the only extent authority. A fail-closed index checks its density and reuses its own frame ordering while projection/cache/group and record-order/break indexes provide O(1) per-cell reads; the repeated-occurrence index separately rejects non-positive and non-finite cycle lengths before enumeration; no capacity prop, persisted viewport, timing correction, or second extent source is added."
  blind_spots: "Independent read-only review is clean. Native UAT remains required because automated tests cannot establish native scroll feel, browser reconciliation behavior, or all live-data identity churn."
  candidate_causes:
    - "code: The removed cursor-derived fallback was an alternate extent authority; unindexed per-cell lifecycle/cache derivation also repeated structural work at full capacity."
    - "data: Required TypeScript shape alone did not reject malformed JavaScript/runtime projections."
    - "environment: responsive client width changes the number of visible 18px cells and therefore the perceived jump, but does not create the underlying coupling."
  and_gate: "Yes for the remaining blocker: the legacy code branch and noncanonical test inputs jointly preserve cursor-derived behavior. No for the original production mechanism: before the candidate, production always derived the fixed page from currentFrame even with valid projection data."
  invariants:
    - "The physical projection is bounded and dense: frame index equals `appFrame` for every element from 0 through capacity - 1."
    - "Only native/custom scrollbar input and drag-only edge autoscroll may write ordinary horizontal viewport position."
    - "Ordinary cell selection may update cursor, key/Group selection, and canvas synchronization, but must not alter represented extent or viewport position."
    - "Scrolling must not navigate, execute/accept a physical edit, persist viewport state, or append Undo/Redo history."
    - "Motion Editor timeline code, interpolation semantics, Groups, breaks, playback, preview, export, persistence, and explicit navigation behavior remain unchanged."
  rejected_alternatives:
    - "Ensure-visible/recenter helper: no ordinary-click call exists."
    - "Edge pagination gesture: all cells share the same click path with no edge branch."
    - "Post-selection scrollLeft effect: effects read geometry for thumb presentation and do not write scrollLeft."
    - "Incorrect scrollbar ratio: thumb dragging already maps the complete DOM maxScroll; the DOM extent itself was cursor-relative."
    - "New capacity prop or persisted viewport signal: duplicates existing canonical projection authority and violates the UI-only viewport constraint."
  exact_minimal_change:
    - "Require `rotoPhysicalCells` in PhysicsPaintWorkflowStripProps and reject any element whose `appFrame !== index`."
    - "Build physical/cache/lifecycle maps plus record-order/break maps/sets per structural input change and use O(1) lookups in the cell loop."
    - "Keep ruler/lane/grid width, scrollbar extent, and Group Rail window derived solely from the indexed projection; retain no cursor-relative fallback."
    - "Update direct test helpers/fixtures to always provide dense projections and remove obsolete fixed-page source contracts."
  test_impact:
    - "Preserve and rerun the viewport interaction regressions for scrollbar independence, edge clicks, responsive widths, content kinds, and full range."
    - "Add expanded-capacity Motion/Static Group Rail geometry and endpoint coverage."
    - "Replace disconnected document/history assertions with a real navigation/coordinator regression proving no edit execution or history command."
    - "Run focused WorkflowStrip/Loop Clip Rail/navigation-history suites, typecheck, full one-shot Vitest, and production build."
  performance_plan: "Completed deterministically: 120- and 600-frame structural-index tests assert one lifecycle classification per cell (not a timing threshold), and 600-frame viewport tests assert the 10,800px extent and final legal boundary."

## Symptoms

expected: The Paint/Roto horizontal scrollbar alone controls the complete UI-only viewport range. Scrolling never changes physical selection, cursor, canvas, Group/key selection, document, or history; ordinary visible-cell clicks select exactly that frame without changing scrollLeft/viewStart.
actual: Manual scrolling cannot reliably inspect earlier ranges independently, and clicking the leftmost visible frame shifts the viewport left by roughly one visible-window width while changing selection.
errors: No console, runtime, or UI errors are observed.
reproduction: With a long Paint/Roto physical timeline, navigate to approximately frames 94–141, retain a selected frame inside that window, try scrolling to earlier ranges, restore the later range, then click the leftmost visible frame around 94 and observe the viewport jump to approximately 47–94.
started: Unknown; prior correct behavior is unconfirmed.

## Eliminated

- hypothesis: Ordinary frame selection calls an ensure-visible or recenter helper.
  evidence: handleRotoTimelineCellClick calls selection-clear/toggle callbacks and onNavigateToSyncedFrame only; the component contains no ordinary-click ensure-visible/recenter call, and Motion Editor ensureFrameVisible is a separate out-of-scope subsystem.
  timestamp: 2026-08-14T18:03:40Z

- hypothesis: A left-edge click is misclassified as a previous-page gesture.
  evidence: Every cell uses the same stable handleRotoTimelineCellClick path keyed by frame; there is no edge-position branch in click handling.
  timestamp: 2026-08-14T18:03:40Z

- hypothesis: A signal/effect writes scrollLeft after cursor or selection changes.
  evidence: The only scrollLeft writes are wheel input, custom scrollbar pointer input, and drag-only edge autoscroll; effects only call updateScrollbar, which reads DOM geometry and sets thumb presentation state.
  timestamp: 2026-08-14T18:03:40Z

- hypothesis: The custom scrollbar thumb range is cursor-relative because of incorrect ratio math.
  evidence: Pointer dragging maps the full custom-track range to scrollWidth - clientWidth. The cursor-relative constraint comes from the fixed 120-cell DOM content represented by scrollWidth, not the ratio calculation.
  timestamp: 2026-08-14T18:03:40Z

## Evidence

- timestamp: 2026-08-14T18:01:06Z
  checked: .planning/debug/knowledge-base.md for semantic/keyword matches to Paint/Roto viewport coupling, scrollLeft, viewStart, edge click, or pagination
  found: Existing entries concern unrelated hit-testing, Physics Paint cache deletion, stale ownership assertions, workflow labels, and break hydration; no prior resolution matches horizontal viewport authority.
  implication: No known-pattern shortcut is available; investigate the live Paint/Roto timeline seam directly.

- timestamp: 2026-08-14T18:01:06Z
  checked: common bug-pattern categories against the reported deterministic symptom
  found: State-management dual-source-of-truth/stale render and boundary/page-size logic are relevant candidates; there is no error or environment divergence evidence yet.
  implication: Treat selection-derived viewport state versus DOM scroll state as the leading category, but keep width/geometry and edge-boundary alternatives falsifiable.

- timestamp: 2026-08-14T18:01:43Z
  checked: project skill discovery and codebase-memory bootstrap
  found: Project-local skill indexes contain no debugging-specific rule beyond using real seams; the codebase-memory skill was invoked first, but its direct MCP graph tools are not exposed in this runtime. The startup hook confirms an indexed project graph and graph-augments fallback searches.
  implication: Continue with the indexed Repomix project reference and graph-augmented Grep/Read, while preserving graph-first ordering already satisfied by the codebase-memory invocation.

- timestamp: 2026-08-14T18:02:15Z
  checked: indexed source for Paint/Roto horizontal scroll writes and virtualization terms
  found: The Physics Paint surface defines updateScrollbar from timelineScrollRef DOM clientWidth/scrollLeft/scrollWidth, a custom thumb drag that writes el.scrollLeft across the full DOM maxScroll, and drag-only edge autoscroll. No Paint/Roto viewStart symbol appeared; the ensureFrameVisible helpers found belong to the separate Motion Editor timeline and are out of scope.
  implication: The custom scrollbar is capable of full-range DOM scrolling in isolation. The bug is more likely a later render/remount or selection-derived layout reset than a deliberately cursor-relative thumb range; Motion Editor ensure-visible logic must not be modified.

- timestamp: 2026-08-14T18:02:57Z
  checked: graph-augmented source localization for timelineScrollRef and updateScrollbar
  found: All Paint/Roto viewport code is in app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx. The same component owns the scroller ref, content ref, ResizeObserver, wheel-to-horizontal translation, custom thumb drag, physical cell rendering, and selection callbacks.
  implication: A real component-level interaction regression can exercise both viewport and selection authority without adding a helper-only seam; inspect this module before designing RED tests.

- timestamp: 2026-08-14T18:03:40Z
  checked: complete PhysicsPaintWorkflowStrip.tsx implementation and complete existing source-contract test
  found: buildPhysicsPaintRotoFrameCells(currentFrame) returns exactly 120 frames starting at max(0, currentFrame - 60); frameCells is memoized directly from props.currentFrame; all ruler ticks, Loop Rail visibleFrameWindow, cell DOM nodes, and drag validity derive from frameCells. Ordinary empty/generated/real/proxy plain clicks call onNavigateToSyncedFrame(frame). The DOM lane width remains fixed at 120 × 18px, and the scrollbar max range is computed only from that fixed cursor-relative lane.
  implication: Selection does not merely reveal within a stable full timeline. It replaces the timeline page itself, so the scrollbar cannot reach frames outside the current cursor-relative 120-cell window. Clicking a left-edge frame shifts the represented range left by the centering offset (60 cells), whose visual pixel/window effect varies with clientWidth; 47 is therefore an observed visible count, not a constant.

- timestamp: 2026-08-14T18:03:40Z
  checked: alternative hypotheses from the symptom report
  found: No ordinary-click branch writes scrollLeft, no effect copies currentFrame into scrollLeft, and custom-thumb math spans the full DOM scrollWidth. The failure occurs earlier: currentFrame controls which absolute frames exist inside that scrollWidth.
  implication: Eliminate direct ensure-visible, edge-gesture misclassification, post-click scrollLeft overwrite, and cursor-relative thumb-math hypotheses; confirm the cursor-derived virtual page at the real component seam before fixing.

- timestamp: 2026-08-14T18:04:34Z
  checked: existing WorkflowStrip and adjacent Physics Paint tests for a mounted interaction seam
  found: PhysicsPaintWorkflowStrip.test.ts is static/source-contract coverage only. PhysicsPaintLoopClipRail.test.tsx directly executes the strip with a custom hook runtime but does not mount DOM scroll geometry. No dedicated WorkflowStrip runtime interaction test exists.
  implication: Add a focused runtime test at the real component interface rather than weakening the regression to source text or the pure frame-cell helper.

- timestamp: 2026-08-14T18:05:45Z
  checked: app/vitest.config.ts and reusable test infrastructure
  found: Vitest includes only src/**/*.test.ts and defaults to Node; there is no Testing Library/jsdom dependency. app/src/test/preactHookRuntime.ts provides deterministic state/ref/memo/callback/effect execution and nearby Physics Paint tests attach DOM-like refs directly.
  implication: The compliant real-seam RED should be a .test.ts direct-component runtime that drives the actual WorkflowStrip cell callbacks and scroller ref with explicit geometry, not a new test-environment dependency or config hack.

- timestamp: 2026-08-14T18:16:47Z
  checked: Studio workflow wiring, useRotoTimelineModel, and projectPhysicPaintRotoPhysicalTimeline
  found: PhysicsPaintStudio passes rotoTimelineModel.physicalCells.value directly as rotoPhysicalCells. The physical resolver constructs that array for every frame from 0 through capacity - 1, and Studio obtains capacity from physicPaintStore.getRotoPhysicalCapacity. WorkflowStrip already treats currentPhysicalCells.length as authoritative capacity for Group drag clamping, but ignores the same complete extent when building frameCells and the lane width.
  implication: No new canonical extent or persisted viewport field is needed. The complete UI range already reaches the component; the defect is local presentation code replacing it with a fixed cursor-relative 120-cell page.

- timestamp: 2026-08-14T18:16:47Z
  checked: Physics Paint timeline CSS geometry
  found: The ruler min-width, Group Rail width, lane grid column/min-width, and roto-cells repeat count are all fixed at 2160px / 120 cells, matching the cursor-derived frameCells page rather than physical capacity.
  implication: The RED must cover both component frame identity and DOM scroll extent; fixing only buildPhysicsPaintRotoFrameCells or only scrollbar ratio math would leave the other half cursor-relative.

- timestamp: 2026-08-14T18:22:14Z
  checked: dedicated PhysicsPaintWorkflowStrip.viewport.test.ts runtime suite before production changes
  found: all 12 tests failed; the strip represented only 120 frames centered around currentFrame, edge clicks replaced the represented frame range, and the custom scrollbar could not expose the complete capacity.
  implication: TDD RED confirmed the root cause at the real workflow-strip interaction seam.

- timestamp: 2026-08-14T18:24:19Z
  checked: minimal production change against the dedicated runtime suite
  found: deriving frameCells and ruler/lane/cell-grid geometry from the complete contiguous physical projection made all 12 viewport regressions pass while preserving the legacy fallback for incomplete test/compatibility inputs.
  implication: selection no longer redefines the represented physical range; DOM scrollLeft remains the sole ordinary viewport authority.

- timestamp: 2026-08-14T18:25:09Z
  checked: focused WorkflowStrip and Loop Clip Rail regressions
  found: 99 WorkflowStrip tests and 38 Loop Clip Rail tests passed after updating stale fixed-extent source contracts.
  implication: cell interaction, Group Rail behavior, fixed pitch, and surrounding strip contracts remain intact.

- timestamp: 2026-08-14T18:27:02Z
  checked: final full automated acceptance and diff review
  found: TypeScript typecheck passed; full one-shot Vitest passed 121 files / 2099 tests with 3 files skipped, 1 test skipped, and 101 existing todos; production build test also passed. Diff review found no document/history writes, viewport persistence, timing workaround, correction loop, or Motion Editor timeline change.
  implication: the exact uncommitted candidate passed its automated gates but still required independent review before native UAT.

- timestamp: 2026-08-14T18:31:47Z
  checked: independent read-only review plus fresh focused vitest run
  found: 99 focused WorkflowStrip tests pass, but review found the production fallback still rebuilds a cursor-relative fixed 120-cell page for empty/sparse/noncontiguous physical projections; the no-history/document assertions are disconnected local objects; and complete-capacity rendering needs a 600-frame scroll-performance assessment. Group Rail geometry appears internally consistent but lacks expanded-capacity behavioral coverage.
  implication: the candidate is blocked from native UAT. Correct the fallback contract, strengthen boundary coverage, assess scroll performance, rerun full gates, and obtain a clean independent review before freezing a replacement candidate.

- timestamp: 2026-08-14T18:46:00Z
  checked: canonical physical timeline port, useRotoTimelineModel projection, PhysicsPaintStudio wiring, and direct WorkflowStrip test callers
  found: The canonical port defines `physicalCells` as the bounded `0 .. capacity - 1` real/generated/empty projection; useRotoTimelineModel creates that structural projection independently of current-frame selection; PhysicsPaintStudio always passes it to WorkflowStrip. Omitted and sparse projections occur in direct-component test fixtures, not the production Studio path.
  implication: Incomplete projections are not a supported production shape. The minimal correction is to make the projection prop required, derive represented frames only from it, remove the cursor-derived 120-cell compatibility branch, and update direct tests to use dense projections rather than adding a duplicate capacity prop.

- timestamp: 2026-08-14T18:46:00Z
  checked: navigation and accepted physical edit history boundaries
  found: Ordinary cell selection routes through physical frame navigation, which updates cursor/selection and canvas synchronization but does not execute or accept a physical edit. useRotoPhysicalEditHistory appends commands only from accepted coordinator outputs, accepted referenced actions, or completed paint mutations.
  implication: The current disconnected local history/document assertions are weak, but the architectural no-history claim can be verified at the real navigation/coordinator boundary rather than by inventing document state inside the strip test.

- timestamp: 2026-08-14T20:39:11Z
  checked: mandatory reasoning checkpoint inputs, complete WorkflowStrip edit sites, direct callers, fixed CSS defaults, and navigation coordinator boundary
  found: The only remaining cursor-derived extent code is the optional `rotoPhysicalCells` prop plus completeness/fallback branch. Production always supplies the canonical dense projection; omitted and sparse inputs are confined to the Loop Clip Rail test helper and one sparse fixture. Inline width/grid styles already own dynamic geometry, while fixed 120/2160 CSS declarations are obsolete fallbacks. The navigation coordinator request path invokes only its configured runtime navigation port and lifecycle callbacks, with no physical edit/history port.
  implication: Proceed with a deletion-justified minimal contract fix: require the projection, render it directly, remove obsolete CSS/source contracts, densify test callers, then add held-out high-capacity rail and real navigation-boundary coverage.

- timestamp: 2026-08-14T20:47:00Z
  checked: real Studio Workflow navigation chain and complete-capacity WorkflowStrip runtime seam
  found: The Workflow callback delegates through requestRotoFrameNavigationRef to useRotoNavigationCoordinator.requestNavigation, which invokes only the configured navigateToSyncedFrame runtime port. navigateToSyncedPhysicalFrame performs canvas reconciliation, physical selection publication, start-frame propagation, and frame sync, while the physical edit coordinator, document replacement ports, and rotoMoveHistory are configured outside that navigation boundary. The runtime harness can represent all 600 cells, expose the expected 10,800px lane, reach the final legal scroll boundary, and click frame 599 without adding synthetic history/document placeholders.
  implication: Replace the disconnected assertions with two complementary held-out controls: the real source boundary excludes edit/history authority, and the mounted WorkflowStrip seam proves scrolling and edge clicks preserve viewport/selection independence at maximum supported capacity.

- timestamp: 2026-08-14T20:49:00Z
  checked: focused one-shot Vitest after requiring the dense projection and adding held-out navigation/high-capacity coverage
  found: PhysicsPaintStudio.test.ts passed 57 tests, PhysicsPaintWorkflowStrip.test.ts passed 87 tests, PhysicsPaintWorkflowStrip.viewport.test.ts passed 13 tests, and PhysicsPaintLoopClipRail.test.tsx passed 39 tests; 196 focused tests passed in 815ms. The initial pnpm invocation failed with EACCES before Vitest started because `--dir` was used incorrectly; the corrected `pnpm -C app exec vitest run` command passed.
  implication: Required-prop compilation at the focused seams, 600-frame 10,800px viewport behavior, high-frame Motion/Static rail geometry, source contracts, and navigation/history separation are green; proceed to typecheck and broader gates.

- timestamp: 2026-08-14T20:52:24Z
  checked: typecheck, full one-shot Vitest, production build, scoped diff, mutation-tool availability, and revert-and-reconfirm guardrail
  found: TypeScript passed after one test-only cast correction. Full Vitest passed 121 files with 3 skipped and 2102 tests with 1 skipped/101 todo. The production build passed in 3.67s with existing Vite dynamic/static import warnings. No Stryker configuration exists. Scoped diff review confirms the deletions remove the RCA-confirmed duplicate 120-frame extent authority and fixed CSS defaults while adding dynamic projection geometry and held-out tests. Reversing only PhysicsPaintWorkflowStrip.tsx reproduced all 13 dedicated viewport failures; automatic restoration followed by rerun passed all 13.
  implication: All applicable automated fix-acceptance signals pass, mutation is explicitly skipped as unavailable, and the exact uncommitted candidate is automated-ready for independent read-only review while remaining nonterminal pending that review and later native UAT orchestration.

- timestamp: 2026-08-14T23:37:00Z
  checked: Independent review findings A/B against the exact uncommitted WorkflowStrip, presentation helper, direct runtime harness, and canonical Studio projection wiring
  found: Finding A was valid: each full-capacity cell render performed a lifecycle classification that filters Groups and scans records, while cold cache derivation searched cached frames; the fallback default `[]` could also invalidate that cache on ordinary rerenders. Finding B was valid: TypeScript required the prop but runtime callers could still pass sparse, duplicate, reordered, or non-zero-based arrays, allowing an invalid extent to render.
  implication: The strip boundary is the correct fail-closed presentation boundary because it consumes the projection as its sole horizontal extent; enforcement needs only `appFrame === index`, not another capacity/extent authority.

- timestamp: 2026-08-14T23:37:00Z
  checked: Focused repair and deterministic regressions
  found: `buildRotoTimelineStructuralIndex` now validates every projection entry and builds physical/cache/lifecycle indexes once per structural input change. Record order and interpolation-break membership are likewise prepared as a map/set, and the cell loop reads all targeted facts in O(1). Presentation helpers accept the pre-indexed cached-frame map without changing their array/set behavior. Runtime regressions reject sparse, duplicate, reordered, and non-zero-based arrays and assert exactly one lifecycle classification per cell at both 120 and 600 frames; all 19 viewport tests pass.
  implication: No malformed runtime projection can silently establish an alternate extent, and the full-capacity per-cell path no longer repeats group/record/cache scans.

- timestamp: 2026-08-14T23:37:00Z
  checked: Gates and working-tree scope after repair
  found: `pnpm run typecheck` passed. Focused `pnpm exec vitest run` for WorkflowStrip viewport/source-contract/presentation/Loop Clip Rail passed 4 files / 177 tests. Full `pnpm exec vitest run` passed 121 files, with 3 skipped; 2108 tests passed, 1 skipped, and 101 todo. The full suite's production Vite build test passed; it emitted existing sourcemap and dynamic/static import warnings only. `git diff --check` passed. No server or watch mode was started.
  implication: The focused repair is automated-ready for another independent read-only review, but this session remains investigating and native UAT is not complete.

- timestamp: 2026-08-14T23:48:00Z
  checked: remaining independent review finding against the complete current WorkflowStrip and selector path
  found: The finding is valid. `PhysicsPaintWorkflowStrip` calls `resolveRotoVisibleSpacingProxies` across the complete 600-cell projection. Its former implementation called `resolvePhysicPaintRotoSpacingProxy` once per cell; that function first resolves a frame then re-scans `context.ranges` and calls `sourceOffsets.indexOf`, producing a capacity × ranges/source-keys path despite the existing resolved-frame map.
  implication: The lifecycle structural index does not cover Key Spacing. Reuse the canonical `visibleFrameResolutions` contract and build the Group source-occurrence lookup once per loop-resolution-context identity.

- timestamp: 2026-08-14T23:48:00Z
  checked: Key Spacing repair and deterministic grouped scaling coverage
  found: `buildRotoSpacingProxySourceIndex` indexes every valid repeated source occurrence by app frame once per resolution-context identity. `resolveRotoVisibleSpacingProxies` now uses that index plus the canonical resolved frame map, so its per-cell work is keyed lookup and semantic validation only—no range scan or `sourceOffsets.indexOf`. The grouped 120/600 selector regression instruments `sourceOffsets.indexOf`, asserts zero calls while resolving every physical cell, and verifies the final repeated source occurrence; this would fail on the prior per-cell resolver. Focused one-shot Vitest passed 3 files / 119 tests.
  implication: Grouped full-capacity rendering no longer performs the reviewed cells-times-ranges/source-offset Key Spacing scan. Keep status investigating pending another independent read-only review and native UAT.

- timestamp: 2026-08-14T23:49:00Z
  checked: post-repair gates and working-tree scope
  found: `pnpm -C app run typecheck` passed. Focused one-shot Vitest passed 3 files / 119 tests. Full `pnpm -C app exec vitest run` passed 121 files with 3 skipped; 2110 tests passed, 1 skipped, and 101 todo. Its embedded production Vite build passed in 3.50s with existing sourcemap and dynamic/static-import warnings only. `git diff --check` passed. No watch mode or server was started.
  implication: The exact uncommitted repair is automated-ready for the requested next independent read-only review. The debug session remains investigating; native UAT is not frozen or complete.

- timestamp: 2026-08-14T21:51:49Z
  checked: reported malformed loop-range termination edge case in `buildRotoSpacingProxySourceIndex`
  found: The new repeated-occurrence loop advanced `appFrame` by `range.cycleLength` with no local positive-finite guard, so a runtime `0`, negative, `NaN`, or infinite value could fail to terminate or enumerate invalid occurrences. The prior resolver failed closed for this malformed range shape.
  implication: The source-index boundary now skips non-positive and non-finite cycle lengths before entering the repeated-occurrence loops. A selector regression directly proves all five malformed values produce neither indexed occurrences nor visible spacing proxies; the existing valid 120/600 repeated-occurrence regression remains unchanged and green.

- timestamp: 2026-08-14T21:51:49Z
  checked: restored candidate gates after the localized selector repair
  found: Focused `pnpm -C app exec vitest run src/components/physic-paint/roto/rotoTimelineSelectors.test.ts` passed 18 tests. `pnpm -C app run typecheck` passed. Full one-shot `pnpm -C app exec vitest run` passed 121 files with 3 skipped; 2115 tests passed, 1 skipped, and 101 todo; its embedded production Vite build passed. `pnpm run build` also passed for both packages. `git diff --check` passed. No server or watch mode was started.
  implication: The exact uncommitted candidate is again automated-ready for the final independent read-only review, while the debug session intentionally remains investigating and native UAT remains incomplete.

- timestamp: 2026-08-14T23:59:00Z
  checked: reported fail-closed boundary findings in the spacing source-occurrence index and WorkflowStrip projection boundary
  found: The spacing index previously validated only cycle length; non-finite `phaseOrigin`, `effectiveEnd`, `placementStart`, or source offsets could make the loop start/termination arithmetic non-finite. It now rejects the entire range before enumeration unless each endpoint/offset is finite, the step advances, and total occurrences remain within the authoritative 600-frame product capacity. The WorkflowStrip now rejects `[]` and arrays longer than `PHYSIC_PAINT_MAX_APPLY_FRAMES` before the existing `appFrame === index` validation, retaining the canonical projection as the only extent authority.
  implication: Invalid runtime input cannot loop indefinitely, create partial Key Spacing proxies, or establish an empty/unbounded alternate viewport extent. Valid 600-frame projections and canonical source-occurrence precedence remain unchanged.

- timestamp: 2026-08-14T23:59:00Z
  checked: focused and full automated gates after the two boundary repairs
  found: Focused `pnpm --dir app exec vitest run src/components/physic-paint/roto/rotoTimelineSelectors.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts` passed 49 tests. `pnpm --dir app run typecheck` passed. Full `pnpm --dir app exec vitest run` passed 121 files with 3 skipped; 2127 tests passed, 1 skipped, and 101 todo. `pnpm run build` passed for both packages. `git diff --check` passed. No server or watch mode was started.
  implication: The exact uncommitted candidate is automated-ready for the requested independent read-only review. The debug session remains investigating; native UAT is neither frozen nor claimed complete.

- timestamp: 2026-08-15T00:00:00Z
  checked: valid long finite Group handling in the spacing source-occurrence index
  found: The prior total-occurrence guard incorrectly rejected a finite Group with an effective end around 1200 solely because it had more than 600 source occurrences, despite the canonical viewport projection being 600 cells. The index now keeps the finite/non-progressing arithmetic guards, calculates the first occurrence inside `[0, domainEndExclusive)`, and enumerates only until the smaller of the effective end and supplied domain end. WorkflowStrip supplies its validated `frameCells.length`; default selector callers retain the canonical 600-frame bound.
  implication: Long valid Group ranges preserve canonical source precedence and spacing proxies for projected frames without creating index entries or repeated work beyond the requested domain.

- timestamp: 2026-08-15T00:00:00Z
  checked: regression loop and automated gates after the bounded-index repair
  found: The new selector regression was red before the repair (`sourceOccurrenceByAppFrame.get(10)` was undefined) and green after it. It uses capacity 600 and a finite effective range of 1205, proves proxies through frame 599, absence at frame 600, and default-selector equivalence. Focused one-shot Vitest passed 5 files / 233 tests; `pnpm --dir app typecheck` passed; full one-shot Vitest passed 121 files with 3 skipped and 2128 tests with 1 skipped/101 todo; `pnpm build` passed; `git diff --check` passed. Existing Vite sourcemap and dynamic/static import warnings remained warnings only. No server or watch mode was started.
  implication: The exact uncommitted candidate is automated-ready for independent read-only review. This debug session remains investigating; native UAT is not frozen, claimed, resolved, archived, or committed.

- timestamp: 2026-08-15T00:13:00Z
  checked: final fresh independent read-only acceptance review of the complete tracked diff, both untracked files, and relevant complete implementations
  found: REVIEW CLEAN. The reviewer confirmed the dense 1..600 projection is the sole horizontal extent authority; safe-integer source-occurrence indexing fails closed and remains projection-domain bounded; valid long Groups preserve spacing proxies and precedence; grouped 600-frame work has no per-cell range/source scan; memoized indexes, high-frame rails, scrolling/click behavior, navigation/history separation, and preserved feature surfaces have no concrete valid-input blocker.
  implication: Independent review is complete and clean. Freeze this exact uncommitted candidate for native UAT without committing, archiving, or resolving the session.

- timestamp: 2026-08-15T00:18:58+02:00
  checked: exact frozen-candidate git evidence and whitespace gate
  found: Base HEAD is `23b6a20d6d230995083dd85e9ab0e5ea6733e0b1`; tracked binary diff SHA-256 is `139c8e75ffbd47e385dd65328f6249a27e55431dd770147331f192aea4b385e3`; `git diff --check` passes. The complete candidate file blob manifest is recorded below, including the untracked viewport regression.
  implication: Any code-file or tracked-diff hash change invalidates this freeze and requires automated gates plus independent review again before native UAT.

- timestamp: 2026-08-15T05:02:33Z
  checked: all eight frozen native UAT acceptance steps using the user's explicit `all approved` report, followed by exact candidate identity revalidation
  found: Native UAT passed in full. Base HEAD remains `23b6a20d6d230995083dd85e9ab0e5ea6733e0b1`; tracked binary diff SHA-256 remains `139c8e75ffbd47e385dd65328f6249a27e55431dd770147331f192aea4b385e3`; `git diff --check` passes; the approved implementation and test candidate remains uncommitted.
  implication: The frozen candidate is accepted without qualification. The session may be marked resolved and archived without changing or committing the approved candidate.

## Resolution

root_cause: PhysicsPaintWorkflowStrip used currentFrame to select a fixed 120-cell absolute page and fixed 2160px lane, so ordinary frame selection replaced the scrollbar's represented range instead of leaving viewport authority with scrollLeft. The candidate also trusted malformed runtime projections and repeated group/record/cache scanning in the full-capacity cell path.
fix: Require and fail closed on a non-empty canonical dense physical projection within `PHYSIC_PAINT_MAX_APPLY_FRAMES` at the WorkflowStrip boundary; build structural physical/cache/lifecycle and record-order/break indexes per structural input change; reuse canonical resolved frame results with a per-context Group source-occurrence index for Key Spacing that rejects non-finite endpoints, placement, offsets, and non-progressing arithmetic, then enumerates valid occurrences only within the validated projection domain; derive represented frames and all horizontal geometry solely from that projection; remove the cursor-derived 120-frame fallback and fixed 2160px CSS defaults; densify direct test fixtures; and add 600-frame Group Rail/viewport plus real Studio navigation-history boundary regressions.
oracle_type: specified
resolved_at: 2026-08-15T05:02:33Z
cycles:
  investigation: 1
  fix: 7
native_uat:
  result: pass
  evidence: "User reported `all approved`, accepting all eight frozen native UAT steps against base HEAD `23b6a20d6d230995083dd85e9ab0e5ea6733e0b1` and tracked diff SHA-256 `139c8e75ffbd47e385dd65328f6249a27e55431dd770147331f192aea4b385e3`."
verification:
  target_test:
    result: pass
    detail: "19/19 dedicated WorkflowStrip viewport runtime regressions pass, including malformed-projection rejection, deterministic 120/600 lifecycle-index scaling, 600 frames, both responsive widths, both edge clicks, scrollbar boundaries, and all required cell kinds."
  mutation_check:
    result: skipped
    reason_if_skipped: "No Stryker package or configuration exists within the repository search depth."
    mutant_killed: null
  no_op_deletion:
    result: pass
    deletion_justified_by_rca: true
    detail: "Removed code was the confirmed duplicate cursor-derived 120-frame extent authority and obsolete fixed CSS fallback; replacement code derives complete geometry from the required canonical projection."
  adjacent_tests:
    result: pass
    suites_run:
      - "Focused grouped Key Spacing: 3 files / 119 tests"
      - "Focused source-occurrence/projection boundary guards: 2 files / 49 tests"
      - "Focused: 4 files / 177 tests"
      - "TypeScript: tsc --noEmit"
      - "Full Vitest: 121 passed files, 3 skipped; 2127 passed tests, 1 skipped, 101 todo; embedded production build passed"
      - "Workspace production build: passed"
  revert_and_reconfirm:
    result: pass
    bug_returned_on_revert: true
    fixed_on_reapply: true
    detail: "Reversing only PhysicsPaintWorkflowStrip.tsx made all 13 viewport regressions fail; automatic patch restoration made all 13 pass."
  guardrail_verdict: accepted
  environment_notes:
    - "600-frame dense projection renders a 10,800px extent and reaches the final legal scrollbar boundary in the deterministic component harness."
    - "Build emitted existing Vite dynamic/static import warnings only."
  remaining_gate: "None. Independent review and all eight frozen native UAT steps passed against the exact approved candidate."
files_changed:
  - app/src/components/physic-paint/roto/rotoTimelineSelectors.ts
  - app/src/components/physic-paint/roto/rotoTimelineSelectors.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/test/preactHookRuntime.ts

## Blameless Postmortem

why_not_caught: No mounted viewport interaction regression existed at the real WorkflowStrip seam, while source-contract fixtures tolerated a cursor-derived fallback that production did not need.
prevention_guard: Keep the dedicated dense-projection viewport suite, malformed-boundary guards, deterministic 120/600 structural scaling checks, full-range scrollbar assertions, and frozen-candidate native UAT fingerprint.

## Frozen Native UAT Candidate

status: approved
frozen_at: 2026-08-15T00:18:58+02:00
base_head: 23b6a20d6d230995083dd85e9ab0e5ea6733e0b1
tracked_diff_sha256: 139c8e75ffbd47e385dd65328f6249a27e55431dd770147331f192aea4b385e3
independent_review: REVIEW CLEAN
native_uat: PASS — all eight acceptance steps approved by the user
approved_at: 2026-08-15T05:02:33Z
commit_state: uncommitted by explicit constraint

### Candidate file blob manifest

- `a92a8e426c88aa963a8f46d355a40b28d3aaa3be`  `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`
- `56c9139d9fc5e3d0b66b5b38b1b55b12a229d247`  `app/src/components/physic-paint/physicsPaintStudio.css`
- `e12af2fadd4923cfd284d7450ef8f0531dbc2ef4`  `app/src/components/physic-paint/roto/rotoTimelineSelectors.test.ts`
- `8bca08f00c7819152dfe3375efa132eee49ef6e0`  `app/src/components/physic-paint/roto/rotoTimelineSelectors.ts`
- `877a7dbd1c0073ffa8e8d87155066a9f0c155f41`  `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx`
- `c6ecaeaecdac6588bb9cfb89e6e33d32ed5afa31`  `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts`
- `81d497215af65f61e032f26483b6d0c596b2d3bb`  `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
- `ca2e6c54893496c06f75a9e3c8cdd9e8670ee58b`  `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts`
- `610d8974109a7dbad3fcb036655237f0b133f506`  `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts`
- `a592c4b3284b893c3a18c3e3d72ed16f28d47c6b`  `app/src/test/preactHookRuntime.ts`

### Native acceptance steps

1. From a later Paint/Roto viewport, move the horizontal scrollbar to earlier ranges without changing the selected physical frame.
2. Move the scrollbar back to later ranges and confirm selection, cursor, and canvas remain unchanged.
3. Click the leftmost visible frame and confirm the exact frame is selected while the viewport remains fixed.
4. Click the rightmost fully visible frame and confirm the exact frame is selected while the viewport remains fixed.
5. Repeat cell selection on ordinary keys, generated interpolation cells, Motion Group cells, Static Group cells, and gray gap/Delete Frame cells; the viewport must remain fixed.
6. Confirm the scrollbar reaches frame 0 and the final legal boundary of a 600-frame timeline.
7. Resize the Studio window and repeat the navigation and edge-click checks; no fixed 47-frame/page behavior may appear.
8. Confirm Group Rails and endpoints, status dots, cursor, canvas, project content, and physical Undo/Redo history remain unchanged by scrolling; ordinary navigation may reconcile the selected frame but must not execute or accept a physical edit.

Any candidate hash change requires re-running focused/full automated gates and a new independent read-only review before native UAT.
