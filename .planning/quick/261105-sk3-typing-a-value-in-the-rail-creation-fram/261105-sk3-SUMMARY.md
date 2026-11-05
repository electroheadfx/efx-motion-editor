---
phase: 261105-sk3-typing-a-value-in-the-rail-creation-fram
plan: 01
subsystem: ui
tags: [preact, signals, numeric-stepper, slider-stepper, playscript, quick]

# Dependency graph
requires: []
provides:
  - "commitOnInput opt-in on the shared SliderStepper and NumericStepper (default off; live emit through the same commit law as blur; raw-text draft ownership)"
  - "Four rail-creation opt-ins: Paint Frames + Cycle, Reveal Frames + Cycle"
  - "Pin matrix for the live emit, raw draft, empty/unparseable input, clamp/grid/EU-comma law, and end-to-end controller-signal writes"
affects: [PhysicsPaintPlayScriptDialog, rail-creation-fields, shared-steppers]

# Actuals (#2632) — pairs with the plan's `estimate` (30,000 tokens / 3 tasks).
# Same estimateTokens scale (chars/4 over the realized diff), not a harness token count.
actuals:
  tokens: 8702
  tasks: 3
  commits: 3

plan_head_before: 1d1e16c754f8c387e3138873a4529d4c77c694f4
plan_head_after: 069c93fc026913f5777367fa3df48a8b75924334

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Default-off live-commit prop with a conditional onInput spread: the off path keeps the exact previous vnode prop set"
    - "Raw-draft ref owning the controlled input text while typing (Preact 11 dom.value equality guard)"
    - "One commitOptions() helper shared by the blur/Enter commit and the live input emit so they can never diverge"

key-files:
  created: []
  modified:
    - app/src/components/shared/SliderStepper.tsx
    - app/src/components/shared/SliderStepper.test.tsx
    - app/src/components/shared/NumericStepper.tsx
    - app/src/components/shared/NumericStepper.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx
    - app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts

key-decisions:
  - "commitOnInput is a default-off opt-in on both shared steppers; only the four rail-creation fields pass it"
  - "The live handler returns the raw draft as the input's value prop while typing; blur/Enter/Escape clear the draft and run the authoritative parse + clamp + formatted rewrite"
  - "The live emit uses the identical commitStepperInput option object as blur (shared commitOptions helper)"
  - "NumericStepper test harness useRef upgraded to a cursor-based persistent slot runtime so a re-render can observe the draft; no existing assertion changed"
  - "End-to-end dialog pins render the real stepper component from the card vnode and drive its real onInput handler (the harness keeps steppers opaque)"

patterns-established:
  - "Live-commit opt-in: parse/emit on every input event, never write element.value from the live handler, clear the draft on blur/Enter/Escape"
  - "Scope pins: source scan of the commitOnInput token plus per-surface props assertions keep the opt-in from leaking"

requirements-completed: [QUICK-261105-SK3]

coverage:
  - id: D1
    description: "Typing in the Motion/Static Frames field commits live: the controller count signal updates on each keystroke and the slider knob moves without TAB, Enter or blur."
    requirement: QUICK-261105-SK3
    verification:
      - kind: unit
        ref: "src/components/shared/SliderStepper.test.tsx.test.ts#commitOnInput live commit (261105-sk3)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#typing in Frames writes countText live in both Rail Types"
        status: pass
    human_judgment: true
    rationale: "The live knob motion and the Create outcome are visible runtime behavior the user must confirm in the packaged app (project rule: live visible UAT)."
  - id: D2
    description: "Typing in either rail-creation Cycle field commits live so Create reads the typed repeat without blur."
    requirement: QUICK-261105-SK3
    verification:
      - kind: unit
        ref: "src/components/shared/NumericStepper.test.tsx.test.ts#NumericStepper — commitOnInput live commit (261105-sk3)"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#typing in Cycle writes repeatText live in both Rail Types"
        status: pass
    human_judgment: true
    rationale: "The created rail's actual cycle is visible runtime behavior requiring the user's live UAT."
  - id: D3
    description: "The raw typed text stays in the box while typing (no mid-word clamp/reformat); empty or unparseable input never emits and never resets the committed value; blur/Enter keep the authoritative parse + clamp + rewrite."
    requirement: QUICK-261105-SK3
    verification:
      - kind: unit
        ref: "src/components/shared/SliderStepper.test.tsx.test.ts#keeps the raw draft across a clamp re-render"
        status: pass
      - kind: unit
        ref: "src/components/shared/NumericStepper.test.tsx.test.ts#emits nothing for empty or unparseable text"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every other stepper surface stays byte-identical (default off, no onInput prop) — Motion wiggle, the reduced Standard/Key Rail form, and all other consumers."
    requirement: QUICK-261105-SK3
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#the four Motion wiggle sliders stay blur-only"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts#the Standard / Key Rail reduced form stays blur-only"
        status: pass
      - kind: other
        ref: "grep -rl commitOnInput app/src (exactly six files) + grep -c commitOnInput={true} (4)"
        status: pass
    human_judgment: false

# Metrics
duration: ~20min
completed: 2026-11-05
status: complete
---

# Quick 261105-sk3: Typing a value in the rail-creation Frames/Cycle fields applies immediately

**Default-off live `commitOnInput` opt-in on SliderStepper and NumericStepper: every keystroke now emits through the exact blur commit law while the raw text keeps ownership of the box, wired to the four rail-creation Frames/Cycle fields.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-11-05T19:25Z (approx.)
- **Completed:** 2026-11-05T19:45:35Z
- **Tasks:** 3/3
- **Files modified:** 6 (all inside the plan's locked scope)

## Accomplishments

- `commitOnInput` added to the shared `SliderStepper` and `NumericStepper`, default off. When off, the value input vnode keeps today's exact prop set (no `onInput` at all).
- The live handler stores the raw text in a `liveDraft` ref FIRST, parses/commits through the shared `commitStepperInput` options (never assigning `element.value`), and lets the draft win over the controlled display — so a clamp or formatted rewrite can never land mid-word.
- Blur, Enter and Escape clear the draft and keep the authoritative parse + clamp + formatted rewrite; focus/blur coalescing is untouched (one undo entry per typed session).
- Exactly four call sites opt in: `PaintTimingCard` Frames + Cycle and `RevealTimingCard` Frames + Cycle (explicit `commitOnInput={true}` literals).
- The NumericStepper test harness `useRef` mock was upgraded to a cursor-based persistent slot runtime (required for the render-level draft pin); all pre-existing pins stayed green with no assertion weakened.

## Task Commits

Each task was committed atomically (code only):

1. **Task 1: SliderStepper opt-in + Paint Frames wiring + pins** - `32694c461` (feat)
2. **Task 2: NumericStepper opt-in + both Cycle fields + pins + harness upgrade** - `811be7aa3` (feat)
3. **Task 3: Reveal Frames opt-in + scope guards + close-out** - `069c93fc0` (feat)

**Commits measured:** `1d1e16c75..069c93fc0` → 3 commits.
**Plan metadata:** docs commit handled by the orchestrator (SUMMARY/STATE/PLAN not committed here).

## Files Created/Modified

- `app/src/components/shared/SliderStepper.tsx` — `commitOnInput` prop (doc-commented), `liveDraft` ref, shared `commitOptions()`, `handleLiveInput`, draft-aware `inputValue`, conditional `onInput` spread, draft clearing on blur/Enter/Escape.
- `app/src/components/shared/SliderStepper.test.tsx` — `HookRuntime.reset()` + `beforeEach`, and the 7-pin `commitOnInput live commit` matrix (default off, per-keystroke emit, clamped re-render, empty/unparseable, clamp/grid/comma, equality + mixed bypass, Escape).
- `app/src/components/shared/NumericStepper.tsx` — same opt-in contract mirrored (prop, ref, helper, handler, draft-aware value, conditional spread, clear points).
- `app/src/components/shared/NumericStepper.test.tsx` — hoisted persistent `useRef` slot runtime (cursor reset before each render, slots+cursor cleared in `beforeEach`) and the 6-pin live-commit matrix.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` — four explicit opt-ins with one-line quick comments (comments deliberately never repeat the literal prop string so the count gate stays unambiguous).
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` — end-to-end pins (Frames both rail types, Cycle both rail types, Reveal Cycle, Reveal Frames), scope pins (four motion sliders, reduced form), and a `stepperInput()` helper that renders the real stepper from the card vnode.

## Decisions Made

- One `commitOptions()` helper per component: the live emit and the blur commit pass byte-identical options (`step`, `presets`, `resolveStep`, `freeEntry`, and min/max gated by `allowOutOfRangeEntry` on SliderStepper).
- The draft is stored before parsing, so empty/unparseable text also stays visible; the emit is guarded by `next !== value` (plus the `mixed` bypass on SliderStepper).
- Kept the explicit literal `commitOnInput={true}` at each opted-in call site (rather than a shared constant) because the plan's scope gate counts that literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the module-level `TargetedInputEvent` type instead of `JSX.TargetedInputEvent`**
- **Found during:** Task 1 (SliderStepper typing)
- **Issue:** Preact 11's `JSX` namespace (`JSXInternal`) does not export event type aliases; `JSX.TargetedInputEvent` does not exist and would fail typecheck.
- **Fix:** Imported `TargetedInputEvent` from `preact` directly — matching the file's existing `TargetedMouseEvent`/`TargetedPointerEvent` imports. Same type (`JSX` import untouched).
- **Files modified:** `SliderStepper.tsx` (Task 1), `NumericStepper.tsx` (Task 2)
- **Verification:** typecheck clean
- **Committed in:** `32694c461`, `811be7aa3`

**2. [Rule 1 - Bug] End-to-end dialog pins drive the real stepper handler**
- **Found during:** Task 1 (dialog pin)
- **Issue:** The plan says to invoke `onInput` on the card's `byId('physics-play-script-count')` vnode, but that vnode is the `<SliderStepper ... />` element whose props are supplied by the card — it has no `onInput` prop (the handler is built inside SliderStepper), and the harness keeps steppers opaque.
- **Fix:** Added `stepperInput(vnode)`, which invokes the real component function with the card's real props (mocked hooks reset per invocation) and drives the real input's `onInput`. Same end-to-end guarantee, stronger evidence than a pass-through prop.
- **Files modified:** `PhysicsPaintPlayScriptDialog.test.ts`
- **Verification:** all four end-to-end pins write `countText`/`repeatText`/`revealCountText` with no blur
- **Committed in:** `32694c461`

---

**Total deviations:** 2 auto-fixed (1 blocking type availability, 1 test-harness mechanics)
**Impact on plan:** No production behavior change beyond the plan. No scope widening: controller, resolver, physical model, renderer and bridge show no diff.

## Verification Results

- Target suites: SliderStepper launcher **32 passed**, NumericStepper launcher **41 passed**, PlayScript dialog **121 passed**, PlayScript controller **284 passed** (4 files, 478 tests, 0 failed).
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` → **375 files passed / 2 skipped, 7347 tests passed, 1 skipped, 96 todo, 0 failed**.
- Typecheck: `tsc --noEmit` clean.
- Scope scan: `grep -c "commitOnInput={true}"` → **4**; `grep -rl commitOnInput app/src` → exactly the six expected files.
- Untouched-law tripwire: `git diff --quiet` on the controller, resolver, physical model, renderer and bridge → clean.

## Threat Model Close-out

- T-261105-SK3-01 (live emit divergence): mitigated — both paths share `commitOptions()`; clamp/grid/comma/freeEntry pins cover the law.
- T-261105-SK3-02 (controller signal integrity): mitigated — end-to-end card pins assert the real signal writes with no blur.
- T-261105-SK3-03 (draft vs controlled value): mitigated — clamp-then-re-render pins in both component suites.
- T-261105-SK3-04 (render/emit loop): mitigated — no render-body writes, equality guard, one render per keystroke.
- T-261105-SK3-05 (other surfaces): mitigated — default-off conditional spread + motion/reduced-form scope pins + source scan.
- T-261105-SK3-SC: no dependency installs.

## Known Stubs

None.

## Threat Flags

None — no new endpoints, auth paths, file access, or schema surface.

## User Setup Required

None.

## UAT Rows Handed to the User (live visible UAT)

**Result: UAT APPROVED 2026-11-05.**


- Create a Motion rail: type a frame count in Frames without pressing TAB — the knob moves on each keystroke and Create builds that exact count.
- Same for Static and Reveal; the Cycle field behaves the same and the created rail shows the typed cycle.
- Clear the Frames box and click Create: the last valid count is used (never 0/1), and the box restores the formatted value on blur.
- Type an out-of-range value: the box keeps what you typed while editing, the slider pins at the bound, and blur/Create use the clamped value. A comma decimal still commits through the step grid.
- Escape restores the formatted value; Enter commits and does not close the dialog.
- Motion wiggle sliders, the Standard reduced form and every other stepper still commit only on blur/Enter.

## Self-Check: PASSED

- All six modified files exist.
- All three task commits are ancestors of HEAD.
- Commits measured from the persisted ledger: 3.
