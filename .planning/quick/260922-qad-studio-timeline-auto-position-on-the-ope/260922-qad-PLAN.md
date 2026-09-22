---
phase: quick-260922-qad
plan: 260922-qad
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
autonomous: true
requirements: []
estimate:
  tokens: 30000
  raw_tokens: 30000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "Opening the Studio while the main-app playhead sits on a distant frame (e.g. 111) leaves that frame's cell inside the Studio timeline viewport with no manual scroll — the viewport is auto-positioned on the opened frame."
    - "Opening on frame 1 (startFrame 0) keeps the viewport at scrollLeft 0 with frame 1 visible — the clamp never scrolls to a negative offset."
    - "Positioning writes ONLY the timeline scroller's horizontal scrollLeft (plus the scrollbar-thumb state derived from it): no navigation intent, no selection write, no playhead move, no document/store mutation fires from the positioning path."
    - "The positioning is one-shot per Studio open: in-session navigation and manual scrolling are never overridden — the viewport does not snap back after the user scrolls."
    - "A launch context that arrives after mount (null → N) still positions exactly once, and content that has not yet grown to cover frame N at first effect time positions as soon as it does."
    - "Manual scroll after open stays free (native UAT row 3) — no effect re-arms on scroll."
  artifacts:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts — the RED behavioural legs (MUST end in .test.ts)
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx — the optional `timelineOpenFrame` prop and the one-shot positioning effect
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx — the workflow wiring `timelineOpenFrame: launchContext?.startFrame ?? null`
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts — the source pin that the wiring exists
  key_links:
    - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx — `timelineScrollRef` (the `.physics-paint-timeline-scroll` container) and `ROTO_CELL_WIDTH_PX = 18` (line 479 at planning time) are the ONLY write surface: `scroller.scrollLeft = <clamped target>` plus `updateScrollbar()` (the useCallback at line ~3200, identity-stable `[]` deps)."
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:4507 (planning time) — the `workflow` object already carries `currentFrame`; the new `timelineOpenFrame: launchContext?.startFrame ?? null` rides the SAME object straight through the pass-through view model (`usePhysicsPaintStudioViewModel.ts` returns props unchanged) into the strip."
    - "app/src/components/physic-paint/PhysicsPaintStudio.tsx:427 + bridge/physicsPaintLaunchContext.ts:100 + app/src-tauri/src/lib.rs:176-192 — every open boots the child with `?context=` in the URL (the Rust reuse path NAVIGATES the window to the fresh launch URL), so `parsePhysicsPaintLaunchContext(window.location)` yields `startFrame` = the main-app playhead at first render; the bridge event/fetch paths cover the late-arrival case the null → N leg pins."
    - "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts — `createScroller` clamps scrollLeft to [0, scrollWidth − clientWidth] exactly like the browser; `render()` assigns the scroller ref BEFORE effects can be flushed (`runtime.flushEffects()`), and `CELL_WIDTH_PX = 18` matches production."
    - "app/vitest.config.ts include is `src/**/*.test.ts` — a `.test.tsx` target exits 0 running nothing. Every test this plan touches MUST stay `.test.ts`."
    - "`startFrame` mutates in-session (PhysicsPaintStudio.tsx:606/:1431/:1500 navigation propagation) — that is exactly why the effect is one-shot on a ref guard and never keyed to re-position on later `timelineOpenFrame` changes."
---

<objective>
**Defect.** Open a layer in Studio with the playhead on a distant frame (e.g. 111): Studio's timeline viewport is not positioned on that frame — frame 1 happens to sit in view (scroll starts at/left of 0), far frames do not, and the user must scroll manually to find the opened frame.

**Expected.** On Studio open, the timeline viewport is positioned on the opened frame (the main-app playhead carried in `launchContext.startFrame`) so the target frame is visible without scrolling.

**Guardrails (non-negotiable).** Viewport only: never move the playhead, the selection, or any document state. Manual scroll after open stays free — no snap-back, no re-positioning on in-session navigation.

**Mechanism (live observation at planning time).** Every open boots a fresh child document with the launch context (including `startFrame`) seeded from the URL; the strip owns the horizontal scroller (`timelineScrollRef`) and has no open-positioning today. The fix is one optional prop (`timelineOpenFrame`) plus one one-shot effect in the strip, wired from `launchContext?.startFrame ?? null`.

**RED first.** Task 1 writes the behavioural legs and records the raw RED (frame 111 out of view at scrollLeft 0) against the inert prop surface; Task 2 adds the effect and wiring and turns them green.

Coverage note (task-detail audit): the defect → legs (i)/(v) + wiring; the expected behaviour → legs (i)/(ii) + UAT rows 1-2; the RED-first pin → Task 1; the viewport-only guardrail → leg (iii) + effect constraints; free manual scroll → leg (iv) + UAT row 3. Nothing in the task detail is deferred.

Purpose: the artist lands on the frame they opened from instead of hunting it.
Output: the one-shot viewport positioning, its RED-first behavioural legs, the Studio wiring pin, and 3 PENDING native UAT rows.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
@app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
@app/src/components/physic-paint/PhysicsPaintStudio.tsx

Repo rules that bind this plan: `vitest run` only, NEVER watch mode (CLAUDE.md); Preact + @preact/signals only, never `useState` for this; every effect needs written deps and a written termination condition; read `.claude/skills/efx-preact-reactivity/SKILL.md` before touching the strip's effects. Line numbers cited here were observed live at planning time — re-locate by symbol name if they drifted.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — pin "opening at frame N puts frame N inside the viewport" (inert prop surface + behavioural legs)</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
  </files>
  <behavior>
    All legs mount the strip through the existing `createWorkflowHarness` and assert on the clamped `scroller.scrollLeft` (the scroll-position equivalent the task detail allows). Eligibility for positioning: launch frame present AND `scroller.scrollWidth >= (frame + 1) * 18`. Positioning target (deterministic): `frame * 18 + 9 - clientWidth / 2`, clamped to `[0, scrollWidth - clientWidth]`.
    Harness fixture unless stated: `capacity 240`, `visibleFrameCount 47` (clientWidth 846, maxScroll 3474), `openFrame` passed through as `timelineOpenFrame`.

    - Leg (i) — THE RED: `openFrame: 111` → render + flushEffects → `scroller.scrollLeft === 1584` and frame 111's cell `[1998, 2016]` intersects `[scrollLeft, scrollLeft + 846]`. Today (no effect) scrollLeft is 0 → this assertion fails naming frame 111 out of view.
    - Leg (ii) — control, frame 1: `openFrame: 0` → scrollLeft stays 0 (negative target clamped), frame 0 in view.
    - Leg (iii) — control, viewport-only: with `openFrame: 111`, after positioning every navigation/selection mock (`onNavigateToSyncedFrame`, `onGoToFirstFrame`, `onGoToPreviousFrame`, `onGoToNextFrame`, `onGoToLastFrame`, `onSelectRotoSpacingProxy`, `onClearRotoKeySelection`, `onSelectRotoLoopClip`) has call count 0.
    - Leg (iv) — RED, one-shot + free scroll: position at 111 (scrollLeft 1584); then `setOpenFrame(50)` + navigate the harness currentFrame to 50 → render + flush → scrollLeft STILL 1584 (no re-position on navigation); then manual `scrollToFrame(5)` (scrollLeft 90) → render + flush → scrollLeft STILL 90 (no snap-back).
    - Leg (v) — RED, late content: `capacity 50`, `openFrame 111` → render + flush → scrollLeft stays 0 (scrollWidth 900 < 2016, not eligible); `setCapacity(240)` → render + flush → scrollLeft 1584 (positions once content covers the frame).
    - Leg (vi) — control, no launch: `openFrame` undefined while `currentFrame: 111` → render + flush → scrollLeft stays 0 (never positions without a launch frame).
  </behavior>
  <action>
    STEP A (inert surface): in `PhysicsPaintWorkflowStrip.tsx`, add ONE optional prop to `PhysicsPaintWorkflowStripProps`: `timelineOpenFrame?: number | null`, documented as "the launch startFrame at Studio open — one-shot viewport positioning target; null/absent = no launch context". No consumer, no effect — the strip's runtime behaviour is byte-identical. This is the inert surface the RED test compiles against (mirrors the 260922-jss STEP A discipline: the surface may exist, the behaviour must not yet).

    STEP B (harness, test-only): in `PhysicsPaintWorkflowStrip.viewport.test.ts`, extend `WorkflowHarnessOptions` with `openFrame?: number | null`, pass it into the strip invocation as `timelineOpenFrame: options.openFrame` (absent option stays `undefined`). Make the harness's `capacity` a mutable local with a `setCapacity(next)` helper (render reads it fresh — this is what leg (v) uses to grow content), and an `openFrame` mutable local with `setOpenFrame(next)` (leg iv). Expose `flushEffects: () => runtimeHolder.current?.flushEffects()` so tests run queued effects AFTER `render()` has assigned the scroller ref. All existing legs must stay untouched and green: `openFrame` unset means `timelineOpenFrame` undefined, and no existing test flushes effects.

    STEP C (the RED legs): add one `describe` block ("Studio open positions the timeline viewport on the opened frame") with legs (i)–(vi) exactly as specified in <behavior>, each doing `render()` then `flushEffects()` before asserting. Use a small local `frameInView(scroller, frame)` predicate (`frameLeft = frame * 18`, intersects `[scrollLeft, scrollLeft + clientWidth]`) alongside the exact-value assertion in leg (i).

    Run the targeted command and RECORD THE RAW OUTPUT in the task notes: legs (i), (iv) and (v) must fail as ASSERTION failures (scrollLeft 0 where 1584 is expected / frame 111 not in view), while (ii), (iii) and (vi) pass as controls. A missing-prop or TypeScript-load error is NOT an acceptable RED — the prop exists from STEP A; the failure must be the behavioural assertion proving the viewport never moved. Commit as one RED commit (`test(260922-qad): pin Studio open viewport positioning — RED`).

    HARD CONSTRAINTS in this task: no effect, no signal, no scroll write, no Studio wiring. The three failing legs must fail for the missing BEHAVIOUR, not a missing symbol.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts</automated>
  </verify>
  <done>
    - The new describe block exists in the `.test.ts` viewport file with all six legs.
    - Raw RED recorded: (i)/(iv)/(v) fail on scroll-position assertions (expected 1584, actual 0), (ii)/(iii)/(vi) green in the same run.
    - `PhysicsPaintWorkflowStrip.tsx` differs from base ONLY by the documented optional prop (no effect yet).
    - Every pre-existing viewport test stays green.
  </done>
</task>

<task type="auto">
  <name>Task 2: GREEN — the one-shot positioning effect + Studio wiring</name>
  <files>
    app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.tsx
    app/src/components/physic-paint/PhysicsPaintStudio.test.ts
  </files>
  <action>
    STEP A (the effect): in `PhysicsPaintWorkflowStrip.tsx`, add a one-shot effect placed AFTER `updateScrollbar` is defined (around the `ensureActiveRowVisible` block). Shape contract:

    - A `useRef(false)` guard (`timelineOpenPositionedRef`). First statement of the effect: when the guard is true, return — TERMINATION CONDITION to be written in a comment: the guard flips true exactly once, on the first successful positioning; nothing else in the strip writes it, no re-arm exists, so the effect can never move the viewport again this mount.
    - Read `props.timelineOpenFrame`. When null/undefined, or not a non-negative integer, return WITHOUT flipping the guard (a launch may still arrive; leg vi stays parked).
    - `const scroller = timelineScrollRef.current`; if absent, return without flipping the guard.
    - Readiness gate: `scroller.scrollWidth < (frame + 1) * ROTO_CELL_WIDTH_PX` → return WITHOUT flipping the guard (content not yet covering the frame; the cells-length dep below retries). This is what makes leg (v) position only after growth.
    - Compute `target = frame * ROTO_CELL_WIDTH_PX + ROTO_CELL_WIDTH_PX / 2 - scroller.clientWidth / 2`, clamp to `[0, Math.max(0, scroller.scrollWidth - scroller.clientWidth)]`, assign `scroller.scrollLeft`, call `updateScrollbar()`, THEN flip the guard.
    - Deps: `[props.timelineOpenFrame, props.rotoPhysicalCells.length, updateScrollbar]` — value deps for the launch frame and content extent, identity-stable callback for the scrollbar.

    HARD CONSTRAINTS: the effect body may touch ONLY `scroller.scrollLeft` and `updateScrollbar()`. No `onNavigateToSyncedFrame`, no selection/clear callbacks, no store call, no `setLaunchContext`, no `scrollIntoView`, no focus move, no vertical `scrollTop`, no timer/rAF/signal, no `useState`. It must not read `props.currentFrame` for the target — the target is `timelineOpenFrame` at the one-shot moment only. `ensureActiveRowVisible` and every other scroll path stay byte-identical.

    STEP B (wiring): in `PhysicsPaintStudio.tsx`, add to the `workflow` object (next to `currentFrame` at line ~4507): `timelineOpenFrame: launchContext?.startFrame ?? null`. Nothing else changes — `currentFrame`, propagation and navigation keep their existing wiring.

    STEP C (wiring pin): in `PhysicsPaintStudio.test.ts`, add ONE source assertion against the already-read `studio` source string: it contains `timelineOpenFrame: launchContext?.startFrame ?? null` (the file's established `readFileSync` source-pin idiom). Behaviour of the effect itself is proven by Task 1's legs — do not re-pin it textually.

    STEP D (GREEN): run the targeted viewport suite — all six legs green. Run the Studio test suite — green including the new pin. Run the full suite and `tsc --noEmit`. Commit as one GREEN commit (`fix(260922-qad): position the Studio timeline viewport on the opened frame`).

    Re-check the guardrails against the diff before committing: `git diff` must show zero writes to selection/playhead/store in the effect, and the viewport suite must contain the zero-call leg (iii) green.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts</automated>
  </verify>
  <done>
    - All six viewport legs green: frame 111 positioned at scrollLeft 1584 and in view; frame 1 clamp holds; zero navigation/selection calls; one-shot survives navigation and manual scroll; late content growth still positions once; no-launch never positions.
    - The strip effect writes only `scroller.scrollLeft` + `updateScrollbar()`, with the termination condition documented at the guard.
    - The Studio passes `timelineOpenFrame: launchContext?.startFrame ?? null` and the source pin fails if that line is removed.
    - Full suite green, `tsc --noEmit` clean, diff confined to the four planned files.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| launch context → strip viewport (unchanged transport) | The plan only reads the already-applied `startFrame` inside the child; no bridge, event, URL or Rust surface changes. |
| viewport effect → timeline interaction state | The only risk is the positioning path reaching selection/playhead/document state; bounded by structure (scrollLeft + updateScrollbar only) and pinned by leg (iii). |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|----------|-----------------|
| T-qad-01 | Tampering | the positioning effect writing selection/playhead/document state | medium | mitigate | Effect body is structurally limited to `scroller.scrollLeft` + `updateScrollbar()`; behavioural leg (iii) asserts zero navigation/selection mock calls during positioning; guardrail restated in Task 2 constraints. |
| T-qad-02 | Denial of service | snap-back loop overriding the user's manual scroll | medium | mitigate | One-shot `useRef` guard with a written termination condition (flips exactly once, never re-arms); legs (iv) pin no re-position on navigation and no reset after manual scroll; no timer/rAF/signal added. |
| T-qad-03 | Information disclosure / Repudiation | none — no new IO, event, log or dependency | low | accept | Viewport-only change: no Rust, no IPC pair, no package IO, no permanent log, no package installs (T-qad-SC satisfied by absence). |
| T-qad-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package is installed, no dependency and no lockfile change. No legitimacy checkpoint required. |
</threat_model>

<verification>
Quick-level checks, all required before the SUMMARY is written:

1. `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — green. Targeted runs use PACKAGE-relative paths (`src/...`): the `exec` cwd is `<repo>/app`.
2. `pnpm --filter efx-motion-editor exec vitest run` — full suite green; every failure pre-existing at the plan base is named and attributed, never absorbed.
3. `pnpm --filter efx-motion-editor exec tsc --noEmit` — clean.
4. `git diff --name-only` against the plan base contains ONLY the four planned `app/src/**` files and the `.planning/quick/260922-qad-…/` artifacts: no `app/src-tauri/**`, no lockfile, no `vitest.config.*`, no package.json.
5. RED evidence recorded in the SUMMARY: exact command, raw failing assertions of legs (i)/(iv)/(v) at the base commit, the three green controls in the same run, and a one-line statement of what each leg now guards. No RED verdict taken after the effect lands.
6. Guardrail re-verified in the diff, not assumed: the effect's only writes are `scroller.scrollLeft` and `updateScrollbar()`; leg (iii)'s zero-call assertion is green.
7. Native UAT rows carried into the SUMMARY as PENDING — never claimed. The rows: (1) main app, playhead on frame 111 → open Studio → frame 111 visible in the Studio timeline without scrolling; (2) playhead on frame 1 → open Studio → frame 1 visible; (3) regression — after open, scrolling the Studio timeline still works and does not snap back.
</verification>

<success_criteria>
- Opening the Studio at a distant frame lands the viewport on that frame — proven behaviourally at the strip seam (exact scrollLeft + in-view predicate) and owed to native UAT rows 1-2 on device.
- Positioning is viewport-only: zero playhead, selection or document writes from the path, pinned by the zero-call leg.
- One-shot semantics hold: navigation never re-positions, manual scroll never snaps back (legs iv, native UAT row 3).
- Frame 1 and the no-launch case never scroll (clamped/absent controls).
- TypeScript only: no Rust, no IPC/event-pair change, no new dependency, no config change, no permanent log.
</success_criteria>

<output>
Create `.planning/quick/260922-qad-studio-timeline-auto-position-on-the-ope/260922-qad-SUMMARY.md` when done, carrying the recorded RED evidence and the 3 PENDING native UAT rows.
</output>
