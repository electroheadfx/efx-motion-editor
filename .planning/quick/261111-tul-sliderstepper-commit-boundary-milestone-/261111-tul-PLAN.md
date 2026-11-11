---
phase: 261111-tul-sliderstepper-commit-boundary-milestone-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/shared/SliderStepper.tsx
  - app/src/components/shared/SliderStepper.test.tsx
autonomous: true
requirements: [QUICK-261111-TUL]
user_setup: []

estimate:
  tokens: 52000
  raw_tokens: 52000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A typed blur or Enter calls `onCommit` exactly once with the parsed value; the blur that Enter triggers does not commit a second time, a later separate Enter-then-blur gesture commits again, and Escape commits nothing."
    - "A track drag emits `onChange` on pointerdown and every move with zero `onCommit`, then reports exactly one `onCommit` at pointerup (or pointercancel) carrying the last value the gesture computed — never the possibly-stale `value` prop — and reports nothing when the gesture computed no value."
    - "A ± press reports exactly one `onCommit` at press end with the last value the hold reached (repeat ticks commit nothing), a keyboard activation reports once right after its single step, and the follow-on pointerup/pointerleave route never commits twice."
    - "A disabled control, a preset-list end, and a gesture that never started report no `onCommit`; a cancelled press reports the value it actually reached."
    - "`onCommit` fires even when the committed value equals the `value` prop on all three boundaries, while `onChange` keeps its existing equality guard."
    - "With `onCommit` undefined, every existing emission, guard, coalescing bracket and rendered output is unchanged: the 32 baseline tests pass untouched and typecheck stays clean."
  artifacts:
    - path: "app/src/components/shared/SliderStepper.tsx"
      provides: "the optional `onCommit?: (value: number) => void` prop plus the three gesture commit boundaries and their gesture-value/dedupe refs (typed, track, stepper)"
    - path: "app/src/components/shared/SliderStepper.test.tsx"
      provides: "the `slider-stepper — onCommit gesture boundary (261111-tul)` describe pinning continuous onChange, one commit per release, Enter+blur dedupe, Escape silence, equal-value commits, stale-prop track commits, hold-repeat single commit, keyboard activation and disabled-control silence"
  key_links:
    - from: "app/src/components/shared/SliderStepper.test.tsx"
      to: "app/src/components/shared/SliderStepper.test.tsx.test.ts"
      via: "vitest collects only `src/**/*.test.ts`, so the import-only launcher is what executes the `.test.tsx` source; the launcher is not modified"
    - from: "app/src/components/shared/SliderStepper.tsx handleTrackPointerUp"
      to: "app/src/components/shared/SliderStepper.tsx emitTrackValue"
      via: "the gesture value is captured in `lastTrackValue` during pointerdown/move and read at release, so the commit payload never comes from the `value` prop"
    - from: "the typed onBlur / Enter handlers"
      to: "app/src/components/shared/SliderStepper.tsx commitInput"
      via: "`commitInput` returns the parsed value (or the displayed `value` when the text is unparseable) and the Enter-then-blur suppression ref makes the pair report one commit"
---

<objective>
Add the optional gesture commit boundary to the shared SliderStepper: `onCommit?: (value: number) => void` fires exactly once per gesture at the release boundaries (track pointerup/pointercancel, typed Enter, typed blur, ± press end, keyboard activation) while `onChange` stays continuous, with per-gesture dedupe so Enter-then-blur and pointerup-then-pointerleave never double-commit.

Purpose: Phase 61 UAT follow-up for milestone v2.1.0. A selection-scoped control needs "the gesture finished, adopt this value into the live brush" — a notification `onChange` cannot express, because `onChange` is a continuous value stream that deliberately suppresses equal values. `onCommit` gives the consumer one release-boundary handoff carrying the value the gesture actually reached (never the stale `value` prop), even when that value equals the current prop.

Output: the prop, three gesture boundaries and their refs in `SliderStepper.tsx`, plus a new `261111-tul` describe in `SliderStepper.test.tsx` pinning the boundary law. No consumer is wired in this quick; with `onCommit` absent, every existing path stays byte-identical.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Anchors verified at HEAD `8afee1949` on `gsd/phase-61-vector-painting-tool` (both target files are clean; the dirty tree carries only `packages/efx-watercolor/probe/vector-spine/result.json` and untracked `.red-evidence/**` directories):

- `app/src/components/shared/SliderStepper.tsx`
  - 28-88: `SliderStepperProps`. `onChange` is line 31. `commitOnRelease` 57-61, `commitOnInput` 62-69, `mixed` 70-77, `allowOutOfRangeEntry` 78-83.
  - 264-292: the destructure in the component signature (`onChange` at 266).
  - 293-307: the refs — `valueRef` 293, `delayTimer` 294, `repeatTimer` 295, `pressing` 296, `dragging` 297, `liveDraft` 303, `draftRef`/`draft` 306-307.
  - 337-356: `stepBy` — preset branch returns nothing today; both emit paths are guarded by `next !== value || mixed`.
  - 358-369: `handlePressStart` — guards `disabled || preset end`, then `startCoalescing()` + `stepBy` + the delayed repeat interval.
  - 371-376: `handlePressEnd` — early-returns when `!pressing.current`; otherwise `clearRepeat()` + `stopCoalescing()`. Wired to pointerup, pointercancel and pointerleave on both cells (550-552, 590-592).
  - 378-382: `handleClick` — `event.detail !== 0` returns (pointer presses already stepped), else `stepBy`.
  - 385-404: `valueFromPointer` returns `null` when the rect width is `<= 0`.
  - 406-413: `emitTrackValue` — `commitOnRelease` stores the draft and returns; otherwise the guarded `onChange`.
  - 415-438: track down/move/up. `onPointerCancel={handleTrackPointerUp}` is wired at 564. `pointerup` early-returns when `!dragging.current`.
  - 443-461: `commitOptions` / `commitInput` — `commitInput` returns nothing today, rewrites `element.value` to the formatted value (or the display on an unparseable entry) and clears `liveDraft`.
  - 466-472: `handleLiveInput` (commitOnInput path) — shares the same equality guard.
  - 517-535: the value input's `onFocus` (startCoalescing + onFocus), `onBlur` (commitInput + stopCoalescing + onBlur) and `onKeyDown` (Enter commits then blurs; Escape restores the display, clears the draft, blurs).
  - 541-596: the two cell buttons and the track vnodes with their handler wiring.
- `app/src/components/shared/SliderStepper.test.tsx`
  - 7-45: the DOM-free `HookRuntime` (useRef slots + useEffect deps/cleanup); `reset()` at 21-26 clears all slots; `vi.mock('preact/hooks', …)` at 49-52.
  - 54-65: `renderStepper` — defaults `value: 13`, `ariaLabel: 'Position'`, `onChange: vi.fn()`, props cast to the component's parameter type.
  - 67-88: `findAll` / `byClass`; the walk does not descend into function-component vnodes.
  - 90: file-level `beforeEach(() => runtime.reset())`.
  - 285-302 and 456-469: the two sibling describes each DECLARE THEIR OWN `trackOf` and `trackTarget(width = 100)` helpers (the file duplicates helpers per describe — do the same in the new describe).
  - 456-518: the commitOnRelease describe (release-time emission semantics the new tests extend).
  - 528-644: the commitOnInput describe (the typed blur/Enter/Escape contract the new tests extend). File ends at 645.
- `app/src/components/shared/SliderStepper.test.tsx.test.ts`: 4-line import-only launcher. It is the only file vitest collects for this component; leave it untouched.
- `app/src/components/shared/NumericStepper.tsx`: repeat constants 41-45 (`NUMERIC_STEPPER_REPEAT_DELAY_MS` 400, `NUMERIC_STEPPER_REPEAT_INTERVAL_MS` 60); `formatStepperValue` 125-138; `parseStepperInput` 154-156; `commitStepperInput` 205-226.
- `app/src/components/shared/NumericStepper.test.tsx`: 125-136 the `pointerDown(target, pointerId = 7)` / `pointerUp(target)` helper idiom for cell buttons — copy that shape into the new describe; 138-145 the fake-timer `beforeEach`/`afterEach` precedent for a hold-to-repeat test.
- `app/vitest.config.ts`: `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']`.
- `app/package.json`: `typecheck` = `tsc --noEmit`. `app/tsconfig.json` is `strict` with `noUnusedLocals` and `noUnusedParameters` — every new local must be used, and an UNUSED DESTRUCTURED `onCommit` would fail typecheck.
- Verify convention (grounded, cwd at the checkout root): `pnpm --filter efx-motion-editor run typecheck` and `pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts`. The positional argument is a vitest SUBSTRING FILTER, not a file: no `SliderStepper.test.ts` file exists or may be created; the filter resolves to the launcher and its imported `.test.tsx` source. Baseline recorded at HEAD: 1 file, 32 tests, all green; typecheck clean.
- Never run vitest in watch mode; never start the dev server (`pnpm dev`, `pnpm tauri dev`) — the user runs those.
- Working tree is dirty with unrelated paths (probe `result.json`, `.red-evidence/**`): stage only the two files in `files_modified`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Typed commit boundary — prop contract, blur/Enter dedupe, Escape silence</name>
  <files>
    app/src/components/shared/SliderStepper.tsx
    app/src/components/shared/SliderStepper.test.tsx
  </files>
  <behavior>
    Append one new describe, `slider-stepper — onCommit gesture boundary (261111-tul)`, at the end of `app/src/components/shared/SliderStepper.test.tsx`, with local `valueOf(tree)` / `plusOf(tree)` / `trackOf(tree)` / `trackTarget(width = 100)` helpers (duplicated per describe like the sibling blocks) and a `pointerDown`/`pointerUp` cell helper modelled on NumericStepper.test.tsx:125-136. Every test renders with an `onChange` spy AND an `onCommit` spy.
    - Test 1 (typed blur commits once): `renderStepper({ value: 13, min: 0, max: 100, step: 1 })`; call the value input's `onBlur` with `{ value: '21' }`; expect `onChange` called once with 21, `onCommit` called once with 21, and the element text rewritten to `'21'`.
    - Test 2 (Enter + blur dedupe, per gesture): call `onKeyDown({ key: 'Enter', currentTarget: element })` on `{ value: '21', blur: vi.fn() }`; expect `onChange` called once with 21, `onCommit` once with 21, and `element.blur` called. Then call `onBlur` with the same element: expect `onCommit` STILL once, while `onChange` fires a SECOND time with 21 — the shipped Enter+blur double parse is unchanged and only the commit is deduped. Repeat Enter-then-blur on the same element and expect `onCommit` twice total (and `onChange` four times) — the suppression is consumed per gesture, never sticky.
    - Test 3 (Escape commits nothing): call `onKeyDown({ key: 'Escape', currentTarget: element })` on `{ value: '99', blur: vi.fn() }`; expect the element restored to `'13'`, then call `onBlur` with the same element and expect `onChange` and `onCommit` never called.
    - Test 4 (unparseable entry reports the unchanged value): call `onBlur` with `{ value: 'abc' }`; expect `onChange` not called, `onCommit` called once with 13 (the displayed value), and the element restored to `'13'`.
    - Test 5 (equal-value typed commit): call `onBlur` with `{ value: '13' }`; expect `onChange` not called and `onCommit` called once with 13.
  </behavior>
  <action>
    RED FIRST, and it must be an assertion RED rather than a build failure. In `app/src/components/shared/SliderStepper.tsx` add ONLY the interface field — `onCommit?: (value: number) => void` immediately after `onChange` (line 31) — with a doc comment stating: `onChange` stays continuous, `onCommit` fires once per gesture at the release boundaries (track pointerup/cancel, typed Enter, typed blur, ± press end and keyboard activation), it fires even when the committed value equals `value` because selection commits bind to the live brush rather than the selection, it never fires for Escape, a disabled control, a preset-list end, or a gesture that computed no value, and an absent `onCommit` leaves every path byte-identical. Do NOT destructure `onCommit` in this step: `app/tsconfig.json` sets `noUnusedLocals`/`noUnusedParameters`, so an unused destructured prop would fail typecheck and turn RED into an invalid build failure. Then append the new describe with Tests 1-5 and run `pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts`: the new tests must fail on their `onCommit` assertions, and typecheck must be clean.

    GREEN. (a) Destructure `onCommit` in the component signature immediately after `onChange` (line 266). (b) Add a third ref beside `dragging` (line 297) — `suppressBlurCommit = useRef(false)` — documented as the Enter/Escape marker: Enter already committed, Escape must not commit, and the blur it triggers consumes and clears the marker. (c) Change `commitInput` (452-461) to return `number`: the parsed branch returns the committed value after the existing guarded `onChange`, formatted rewrite and `liveDraft` clear; the unparseable branch returns the displayed `value` after the existing display restore and draft clear. Keep every existing statement in that function unchanged and in the same order. (d) In the value input's `onBlur` (521-525) call `commitInput` first (unchanged), then read `suppressBlurCommit.current` into a local, set the ref back to false, and call `onCommit` with the returned value only when `onCommit` is present AND the marker was false; `stopCoalescing()` and `onBlur?.()` still run unconditionally and in that order. (e) In the `onKeyDown` Enter branch (527-529) capture `commitInput`'s return value, set `suppressBlurCommit.current = true`, call `onCommit` with that value when present, then blur as today. (f) In the Escape branch (530-534) leave the display restore and draft clear as they are, and set `suppressBlurCommit.current = true` before the existing blur so Escape never commits. (g) In `onFocus` (517-520) reset `suppressBlurCommit.current = false` before `startCoalescing()` so a marker orphaned by a blur that never fired cannot swallow the next gesture's commit.

    Decisions to encode in the comments: an unparseable typed commit reports the displayed/unchanged `value` (the box reverts, so the commit reports what the box says); a blur always reports the value the box now represents, including an unchanged one (the equal-value law); commitInput keeps running twice on Enter-then-blur exactly as today — only the `onCommit` emission is deduped.

    Guardrails: do not gate `commitInput`, `stopCoalescing`, `onBlur?.()` or any `onChange` on `onCommit`; add no emission and change no guard; leave the existing double parse untouched; do not touch the track or stepper handlers in this task beyond what is listed; never edit an existing test.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts</automated>
  </verify>
  <done>
    `SliderStepperProps` carries the documented optional `onCommit`, the typed boundaries report exactly one commit per gesture (blur, Enter), Enter-then-blur reports once while a second gesture reports again, Escape reports nothing, and unparseable or equal-value entries still report the displayed value. The baseline 32 tests pass unchanged and typecheck is clean.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Track commit boundary — one commit at release with the gesture's own value</name>
  <files>
    app/src/components/shared/SliderStepper.tsx
    app/src/components/shared/SliderStepper.test.tsx
  </files>
  <behavior>
    Add these tests to the same `261111-tul` describe.
    - Test 6 (continuous onChange, one commit at release, stale-prop law): `renderStepper({ value: 13, min: 0, max: 100, step: 1 })`; `onPointerDown({ clientX: 20, preventDefault, currentTarget: trackTarget() })` then `onPointerMove({ clientX: 40, currentTarget: trackTarget() })`; expect `onChange` called with 20 then 40 and `onCommit` never called; `onPointerUp()`; expect `onCommit` called ONCE with 40 — not 13 (the stale prop) and not 20 (the first move).
    - Test 7 (commitOnRelease stays orthogonal): `renderStepper({ value: 0.5, min: 0, max: 1, step: 0.01, commitOnRelease: true })`; down at 80, move at 60; expect `onChange` and `onCommit` never called while the pointer is down; `onPointerUp()`; expect `onChange` once and `onCommit` once with the SAME number.
    - Test 8 (cancel commits the value reached, late pointerup adds nothing): down at 30; expect `onChange` called with 30 and `onCommit` not called; `onPointerCancel()`; expect `onCommit` once with 30; then `onPointerUp()` and expect `onCommit` still once.
    - Test 9 (equal-value release commits; a gesture that computed no value does not): with `value: 40`, down at 40 (no `onChange`, the equality guard holds), then `onPointerUp()` and expect `onCommit` once with 40. In a second render, down with `trackTarget(0)` (zero width makes `valueFromPointer` return null) then `onPointerUp()`; expect that render's `onCommit` never called.
  </behavior>
  <action>
    RED FIRST: add Tests 6-9 and run the targeted suite; they must fail on the missing `onCommit` emissions while the existing track tests stay green.

    GREEN in `app/src/components/shared/SliderStepper.tsx`. (a) Add `lastTrackValue = useRef<number | null>(null)` beside the other gesture refs, documented as the live track gesture's last computed value — the release commits THIS, never the `value` prop, because the parent may not have re-rendered the last move into the prop. (b) In `handleTrackPointerDown` (415-422) reset `lastTrackValue.current = null` next to `dragging.current = true` so each gesture owns its value. (c) In `emitTrackValue` (406-413), immediately after the null guard, record `lastTrackValue.current = next` when `onCommit` is present — this covers both the `commitOnRelease` draft branch and the continuous `onChange` branch, so the boundary is identical with the knob on or off. (d) In `handleTrackPointerUp` (429-438), after the existing `commitOnRelease` block (which stays untouched, including its `onChange`) and before `stopCoalescing()`: read `lastTrackValue.current` into a local, set the ref back to null, and call `onCommit` with it only when `onCommit` is present and the local is not null. The existing `!dragging.current` early return stays first, so a stray release or a track that never started a gesture emits nothing.

    Decisions to encode in comments: `onPointerCancel` is wired to this same handler (line 564) and a cancelled drag commits the value it reached — the gesture already applied that value live through `onChange`, so the commit only mirrors a real change; a zero-width track or a release with no computed value commits nothing.

    Guardrails: no change to `startCoalescing`/`stopCoalescing`, to the `commitOnRelease` draft painting, to `valueFromPointer`, or to the equality guard; `lastTrackValue` writes must not influence `onChange` or the rendered `draft.value`; `onCommit` must never be read from or compared against the `value` prop.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts</automated>
  </verify>
  <done>
    A track drag commits exactly once at release with the last value the gesture computed (verified against a prop that never advanced), `pointercancel` follows the same rule, a no-value gesture commits nothing, and `onChange`/draft/coalescing behavior is unchanged whether or not `commitOnRelease` is set. Typecheck and the targeted suite pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Stepper commit boundary, hold-repeat single commit, and the full gate</name>
  <files>
    app/src/components/shared/SliderStepper.tsx
    app/src/components/shared/SliderStepper.test.tsx
  </files>
  <behavior>
    Add these tests to the same `261111-tul` describe.
    - Test 10 (one press, one commit; the second press-end route adds nothing): `renderStepper({ value: 13, min: 0, max: 100, step: 1 })`; `pointerDown(plus)`; expect `onChange` called with 14 and `onCommit` not called; `pointerUp(plus)`; expect `onCommit` once with 14; then call the cell's `onPointerLeave` and expect `onCommit` still once.
    - Test 11 (keyboard activation commits; a real click does not double): `plus.props.onClick({ detail: 0 })`; expect `onChange` with 14 and `onCommit` once with 14. In a second render, `onClick({ detail: 1 })`; expect neither spy called (the pointer path owns real clicks).
    - Test 12 (hold-to-repeat commits once at release): enable `vi.useFakeTimers()` inside a `try` and restore with `vi.useRealTimers()` in `finally`; `pointerDown(plus)`; advance `NUMERIC_STEPPER_REPEAT_DELAY_MS + NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 3`; expect `onChange` called more than once and `onCommit` never called during the ticks; `pointerUp(plus)`; expect `onCommit` exactly once with 14; capture both counts, advance `NUMERIC_STEPPER_REPEAT_INTERVAL_MS * 10`, and expect both counts unchanged.
    - Test 13 (disabled controls never commit): `renderStepper({ value: 13, disabled: true })`; `pointerDown` + `pointerUp` + `onClick({ detail: 0 })`; expect neither spy called. In a second render with `presets: [12, 24]` and `value: 24`, assert the plus cell renders `disabled: true`, then `pointerDown` + `pointerUp` + `onClick({ detail: 0 })`; expect neither spy called.
    - Test 14 (cancelled press commits the value reached): `pointerDown(plus)`; `onPointerCancel()`; expect `onCommit` once with 14; `pointerUp(plus)`; expect still once.
    - Test 15 (a step that lands on the current value still commits): `renderStepper({ value: 80, min: 1, max: 80, step: 1 })`; `pointerDown(plus)` (clamped to 80, so `onChange` stays silent); expect `onChange` not called and `onCommit` not called; `pointerUp(plus)`; expect `onCommit` once with 80.
  </behavior>
  <action>
    RED FIRST: add Tests 10-15, importing `NUMERIC_STEPPER_REPEAT_DELAY_MS` and `NUMERIC_STEPPER_REPEAT_INTERVAL_MS` from `./NumericStepper` for Test 12 (`vi` is already imported; use `try`/`finally` for the fake timers rather than adding `afterEach`), then run the targeted suite; they must fail on the missing `onCommit` emissions.

    GREEN in `app/src/components/shared/SliderStepper.tsx`. (a) Add `pressValue = useRef<number | null>(null)` beside the other gesture refs, documented as the last value a ± press gesture reached (repeat ticks included), committed once at press end. (b) Make `stepBy` (337-356) return `number | null`: the preset-end cleanup branch returns null after its existing `clearRepeat` / `pressing.current = false` / `stopCoalescing`; both emit branches return the computed `next` AFTER the existing guarded `onChange`, so the equality guard still governs `onChange` only. Change no branch logic or guard. (c) In `handlePressStart` (358-369) set `pressValue.current = null` as the FIRST statement so a disabled or preset-end press can never inherit a stale value; assign `pressValue.current = stepBy(direction)` for the initial step, and turn the repeat interval callback into a block that assigns the returned value to `pressValue.current` when it is not null (a null return means the preset end already ran its cleanup; keep the last reached value). (d) In `handlePressEnd` (371-376) read `pressValue.current` into a local and clear the ref BEFORE the existing `!pressing.current` early return; call `onCommit` with the local when `onCommit` is present and the local is not null; then keep the existing early return and the `pressing`/`clearRepeat`/`stopCoalescing` cleanup exactly as they are. This ordering gives one commit for the normal release, one for a cancel or the follow-on pointerleave (the ref is already null), and still one for a hold that hit the preset end and cleared `pressing` inside `stepBy`. (e) In `handleClick` (378-382) assign `stepBy`'s return value to a local after the existing guards and call `onCommit` with it when present and not null — keyboard/AT activation has no press lifecycle, so its single step commits immediately; `event.detail !== 0` still returns first, so a real mouse click never commits here.

    Decisions to encode in comments: one commit per press gesture including hold-to-repeat; a press that lands on the current value still commits (equal-value law); a disabled cell or a preset-list end commits nothing because `handlePressStart`/`handleClick` return before any step; a cancelled press commits the value it reached because the live `onChange` already applied it.

    Then run the full gate: typecheck, the targeted suite, and the whole `pnpm --filter efx-motion-editor exec vitest run`. Fix production code rather than weakening a failing assertion. The pre-existing 32 tests must pass untouched; stage only the two files in `files_modified`.
  </action>
  <verify>
    <automated>pnpm --filter efx-motion-editor run typecheck</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts</automated>
    <automated>pnpm --filter efx-motion-editor exec vitest run</automated>
  </verify>
  <done>
    Every ± boundary reports exactly one `onCommit` with the value the gesture reached — pointer press at release, keyboard activation after its step, hold-to-repeat once at release — while disabled cells and preset ends stay silent and real mouse clicks never double-commit. Typecheck, the targeted suite and the full suite are green with no existing test edited and no new file or test-config change.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| gesture event → commit payload | pointer/keyboard events supply the commit value; a stale or invented value would write the wrong number to the consuming brush |
| repeated event routes → one gesture | pointerup/pointercancel/pointerleave and Enter/blur all describe the same gesture; a double emission would double-apply an edit |
| disabled or cancelled gesture → commit | a control the user cannot use, or an interrupted gesture, must not report a value the user did not set |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-TUL-01 | Tampering | `handleTrackPointerUp` commit payload | medium | mitigate | The payload is `lastTrackValue`, recorded from the same `next` the gesture emitted; the `value` prop is never read for the commit, so an asynchronous parent re-render cannot corrupt it. Pinned by Test 6 (prop stays 13 while the commit is 40). |
| T-TUL-02 | Repudiation | Enter/blur and pointerup/pointerleave double routes | medium | mitigate | `suppressBlurCommit` is set by Enter/Escape and consumed exactly once by the next blur; `pressValue` is read and cleared before the early return, so the second press-end route finds null. Pinned by Tests 2, 10, 14. |
| T-TUL-03 | Tampering | disabled / preset-end / no-value gestures | medium | mitigate | `handlePressStart` resets `pressValue` before its guards and `handleClick` returns before `stepBy`, so a disabled cell commits nothing; `lastTrackValue` stays null when `valueFromPointer` returns null and `dragging` never starts. Pinned by Tests 9 and 13. |
| T-TUL-04 | Denial of service | hold-to-repeat commit fan-out | low | accept | Repeat ticks only update the gesture value ref; the single commit at release bounds consumer work to one call per hold. Pinned by Test 12. |
| T-TUL-SC | Tampering | package installs | high | mitigate | No package is added and no dependency edge changes; the change is one optional prop plus refs in an existing component. |
</threat_model>

<verification>
Automated:
- `pnpm --filter efx-motion-editor run typecheck`
- `pnpm --filter efx-motion-editor exec vitest run src/components/shared/SliderStepper.test.ts`
- `pnpm --filter efx-motion-editor exec vitest run` (Task 3 full gate; `vitest run` only, never watch)

Baseline recorded at HEAD `8afee1949`: the targeted command collects 1 file / 32 tests, all green; typecheck exits clean.

Scope checks:
- `git diff --stat` lists exactly `app/src/components/shared/SliderStepper.tsx` and `app/src/components/shared/SliderStepper.test.tsx`.
- No existing `it(...)` block is edited; the 32 baseline tests pass unchanged.
- No `SliderStepper.test.ts` file is created, `app/vitest.config.ts` is untouched, and `SliderStepper.test.tsx.test.ts` is untouched.
- No consumer file changes: the quick ships the optional prop only.
- With `onCommit` absent: no new `onChange` call, no guard or coalescing change, no render-output change (the baseline suite is the regression gate).

No native UAT row for this quick: it is an optional prop with no consumer wired, so nothing user-visible changes. The summary must report the quick as automated-ready, not as a shipped user-facing behavior.
</verification>

<success_criteria>
- `SliderStepperProps` exposes the documented optional `onCommit?: (value: number) => void`.
- The typed boundary commits once per gesture: blur commits, Enter commits and its blur is suppressed, a second gesture commits again, Escape commits nothing, and an unparseable entry commits the displayed value.
- The track boundary commits once at pointerup or pointercancel with the gesture's own last value (never the `value` prop), commits an equal value, and commits nothing when no value was computed.
- The stepper boundary commits once at press end (hold-to-repeat included) with the last reached value, commits once on keyboard activation, and commits nothing for a disabled cell or preset end.
- `onChange` semantics are unchanged everywhere; with `onCommit` undefined every existing test passes untouched.
- Typecheck, the targeted suite and the full `vitest run` are green; only the two declared files are modified.
</success_criteria>

<output>
Create .planning/quick/261111-tul-sliderstepper-commit-boundary-milestone-/261111-tul-SUMMARY.md when done.
</output>
