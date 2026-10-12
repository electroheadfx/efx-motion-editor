---
phase: 260924-ffd-numeric-stepper-contract-integer-1-defau
reviewed: 2026-09-24T12:40:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/project/NewProjectDialog.test.tsx
  - app/src/components/project/NewProjectDialog.tsx
  - app/src/components/shared/NumericInput.tsx
  - app/src/components/shared/NumericStepper.test.tsx
  - app/src/components/shared/NumericStepper.tsx
  - app/src/components/views/SettingsView.tsx
  - app/src/lib/fpsPresets.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 260924-ffd: Code Review Report

**Reviewed:** 2026-09-24T12:40:00Z
**Depth:** quick
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Anti-pattern grep sweep over all 8 files was clean (no secrets, no eval/dangerous calls, no debug artifacts, no empty catches, no `as any`). Full reads of the changed files plus cross-file checks against `lib/history.ts` (coalescing is a module-global boolean, not a counter), the feature commit `fa0a2623`, and all `presets=` call sites. The three-tier contract (classic ±1 default / fps presets / grain exception) is implemented coherently and the stated guardrails are verifiable: T-52.2-08 clamp/hold/coalesce pins present, grain `resolveStep`/`freeEntry` untouched and pinned to its sole call site, two-tier fps law enforced by source-scan pins (Studio strip contains no `projectStore` reference; Settings binds `projectStore.setFps`; New Project seeds via `createProject` only). No critical issues found. Five warnings: dialog-level Enter/Escape collision with the stepper's field-key contract, a drag path with no `pointercancel` cleanup (stuck global blur bypass + listener stacking), hold-lifecycle cleanup gaps outside the preset-end case (the Pitfall-1 fix is incomplete), a latent direction-of-travel bug in NumericInput's new preset scrub (no caller yet), and the Studio fps `<label>` whose implicit labeled control is the minus button. One notable non-finding: `min`/`max` passed alongside `presets` at the strip are dead (list ends are the only clamp) but currently coincide with 6/60, so no behavioral divergence today.

## Warnings

### WR-01: Enter/Escape inside the stepper fields bubble into the New Project dialog's global key handler — Enter creates the project, Escape closes the dialog

**File:** `app/src/components/project/NewProjectDialog.tsx:127-130` (handler) with `app/src/components/shared/NumericStepper.tsx:427-435` (field handler, no `stopPropagation`)
**Issue:** The dialog root div runs `handleKeyDown`: any bubbled Enter with `!isCreating` calls `handleCreate()`, any bubbled Escape calls `onClose()`. The stepper's own key handler claims Enter (commit + blur) and Escape (revert + blur) but does not stop propagation, so the SAME keypress executes both contracts: Enter in the fps field commits 24 → 25 AND immediately starts project creation once a folder is chosen; Escape in the fps/W×H field reverts the field text and then closes the whole dialog, discarding name and folder state. The fps field newly joins this collision with 260924-ffd (it is now a text field explicitly inviting "commit on Enter" / "revert on Escape" per the stepper contract and its own pinned tests, which drive handlers directly and never exercise bubbling). The W×H steppers have carried the same defect since 260918-ovi.
**Fix:** In `NumericStepper.onKeyDown`, stop bubbling for the keys it owns:
```tsx
onKeyDown={(event) => {
  if (event.key === 'Enter') {
    commitInput(event.currentTarget);
    event.currentTarget.blur();
    event.stopPropagation();      // field commit is not a dialog submit
  } else if (event.key === 'Escape') {
    event.currentTarget.value = display;
    event.currentTarget.blur();
    event.stopPropagation();      // field revert is not a dialog close
  }
}}
```
(Name-field Enter → create keeps working; a second Escape after blur still reaches the dialog handler.)

### WR-02: NumericInput label drag-to-scrub has no `pointercancel` cleanup — stuck global blur bypass, stranded coalescing, stacking duplicate listeners

**File:** `app/src/components/shared/NumericInput.tsx:87-95` (cleanup) / `94-95` (listener attach)
**Issue:** `handleLabelPointerDown` attaches `pointermove`/`pointerup` listeners and toggles `blurStore` bypass + `startCoalescing()`, but cleanup runs only on `pointerup`. On `pointercancel` (touch scroll takeover, pen inversion, browser gesture — the capture target does receive `pointercancel`, but nothing listens for it): (1) `restoreBlur` never runs — `bypassBlur` stays `true`, which per `blurStore.ts` "disables all blur rendering everywhere" until something else toggles it; (2) `stopCoalescing()` never runs — the module-global coalescing flag stays on and the next `pushAction` anywhere becomes an anchor that swallows subsequent unrelated undo entries; (3) both listeners stay attached, so a later hover-move over the label runs the stale closure's `onMove` in parallel with the next drag's fresh closure — two `onChange` calls per movement with divergent `startX`/`currentVal`. The preset branch added by this quick lives inside the same `onMove`, so the new preset scrub inherits the leak. Handler predates the quick but was modified by it and is in review scope.
**Fix:** Bind the same teardown to cancel and drop listeners symmetrically:
```tsx
const onUp = () => {
  stopCoalescing();
  if (restoreBlur) blurStore.toggleBypass();
  target.removeEventListener('pointermove', onMove);
  target.removeEventListener('pointerup', onUp);
  target.removeEventListener('pointercancel', onUp);
};
target.addEventListener('pointermove', onMove);
target.addEventListener('pointerup', onUp);
target.addEventListener('pointercancel', onUp);
```

### WR-03: Hold-to-repeat cleanup is incomplete outside the preset-end case — unmid-hold unmount strands coalescing; a mid-hold `disabled` flip keeps emitting

**File:** `app/src/components/shared/NumericStepper.tsx:307-310` (unmount cleanup), `324-344` (`stepBy` — no `disabled` check), `346-360` (`handlePressStart` checks `disabled` only once)
**Issue:** Pitfall 1 was fixed only for the preset-list-end path (`stepBy` lines 329-336). Two sibling paths remain: (a) **unmount mid-hold** — the cleanup effect clears both timers but leaves `pressing` conceptually active and never calls `stopCoalescing()`, so the module-global boolean stays `true` and `coalesceEntry` anchors on the next `pushAction`, merging unrelated subsequent actions into one undo entry until some other gesture happens to stop coalescing; (b) **`disabled` flipping true mid-hold** (the strip's `disabled={!props.ready}` can flip while a hold is in progress) — nothing observes the prop change, so the `setInterval` keeps invoking `stepBy` and keeps calling `onChange` while the control renders visibly disabled; if the swallowed DOM release never arrives, coalescing strands exactly as Pitfall 1 describes, in classic mode too. The doc comment claims release/cancel/leave are the stop conditions, but only unmount covers timers.
**Fix:** Centralize teardown and call it from both the release path and new observers:
```tsx
const endPress = () => {
  if (!pressing.current) return;
  pressing.current = false;
  clearRepeat();
  stopCoalescing();
};
useEffect(() => () => { clearRepeat(); if (pressing.current) stopCoalescing(); }, []);
useEffect(() => { if (disabled) endPress(); }, [disabled]);
```
(`endPress` replaces `handlePressEnd`; the preset-end branch can call it too instead of duplicating the three statements.)

### WR-04: NumericInput preset scrub uses nearest-index + steps, skipping the next list entry in the direction of travel (latent — no caller passes `presets` to NumericInput yet)

**File:** `app/src/components/shared/NumericInput.tsx:66-72` (with `nearestPresetIndex` at 12-23)
**Issue:** The new preset branch computes `nearestPresetIndex(currentVal) + steps`. For an off-list base whose nearest entry is *behind* the direction of travel, the first 4 px step lands two entries away instead of the next one: from 23 dragged right, nearest is 24, +1 → 25 (skips 24); from 14 dragged right, nearest 15, +1 → 24 (skips 15); mirrored for leftward drags from 13 (nearest 12, −1 → 6, skips nothing… but from 26: nearest 25, −1 → 24, while direction-of-travel from 26 is 25). This contradicts the press-path contract (`nextPresetFrom`: strictly greater/lesser entry) added in the same commit — the stepper button from 23 right gives 24, the label scrub gives 25. Currently unreachable (grep confirms only the three fps `NumericStepper` sites pass `presets`; every `NumericInput` call site is classic `step=`), so it will bite the first adopter of `presets` on the drag-scrub wrapper.
**Fix:** Anchor the walk on direction of travel, then offset:
```tsx
const startIdx = steps > 0
  ? presets.findIndex((e) => e > currentVal)                 // first entry above
  : presets.reduce((acc, e, i) => (e < currentVal ? i : acc), -1); // last entry below
if (startIdx === -1) return; // already at the end in that direction
const index = Math.min(presets.length - 1, Math.max(0, startIdx + (Math.abs(steps) - 1) * Math.sign(steps)));
newVal = presets[index];
```
(On-list bases resolve identically to the current code; off-list bases now match `nextPresetFrom` on the first step.)

### WR-05: The Studio fps `<label>` wraps the stepper, so its implicit labeled control is the − button, not the input

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1195`
**Issue:** `<label class="physics-paint-roto-fps-control"><span>fps</span><NumericStepper …/></label>` — per HTML, a label without `for` points at the *first labelable descendant*; tree order inside the stepper is minus `<button>` → `<input>` → plus `<button>`, and `<button>` is labelable. Consequences: clicking the "fps" text activates the minus button — the synthetic click carries `detail: 0`, which is exactly what `handleClick` treats as a keyboard activation, so the click can decrement fps without the press/coalescing bracket (engine-dependent: some retarget with nonzero detail instead, in which case it silently no-ops but still steals focus to the button, forcing an incidental blur-commit of whatever was typed in the field). Accessible naming survives only because both the input and buttons carry explicit `aria-label`s; the wrapper label itself associates "fps" with the decrease button. Structure predates this quick, but the conversion kept it and it is now the fps surface under review.
**Fix:** The input already has `ariaLabel`; drop the label semantics from the wrapper:
```tsx
<span class="physics-paint-roto-fps-control"><span>fps</span><NumericStepper … /></span>
```
(or give the input an `id` and use `<label for>` targeting only the input, with the text outside the control group).

## Info

### IN-01: `min={6}` / `max={60}` on the strip fps stepper are dead in preset mode

**File:** `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1199-1200`
**Issue:** `commitStepperInput`'s preset branch (`NumericStepper.tsx:194-201`) and `stepBy`'s preset branch clamp to the list ends only — `min`/`max` are ignored whenever `presets` is non-empty. Today the values coincide with `FPS_PRESETS` ends (6/60) so behavior is correct, but the props read as live constraints while being inert; if `FPS_PRESETS` ends ever change, these won't follow and will mislead readers (the comment at line 1111 already attributes the clamp to the presets).
**Fix:** Remove `min`/`max` from the preset call site, or make the preset branch clamp with `min ?? listMin` / `max ?? listMax` and document the precedence.

### IN-02: Render-time and handler-side end checks can disagree on uncommitted typed text

**File:** `app/src/components/shared/NumericStepper.tsx:298-303` (`canStepInDirection`, typed base) vs `287-288` (`atPresetEnd`, `value` base)
**Issue:** With parseable text typed but not committed that lies beyond a list end (e.g. value 30, text "70"), the + button renders enabled (30 → 50 exists) yet the press is refused (no entry > 70) — a momentary enabled-but-silent button, which grazes the locked "disabled, not a silent no-op" decision. The refusal path also skips `event.preventDefault()`, so the default focus change blurs the field and the blur-commit snaps "70" to 60, self-healing the state. Low impact, but the two checks are documented as "the same rule" while using different bases.
**Fix:** Either compute the render flag from the same typed-text base (via a ref read during render is unsafe — so evaluate on input/`onInput` state), or accept the typed base only in `stepBy` and let `canStepInDirection` use `value` for refusal, documenting why.

### IN-03: Duplicate nearest-preset implementations

**File:** `app/src/components/shared/NumericInput.tsx:12-23` (`nearestPresetIndex`) and `app/src/components/shared/NumericStepper.tsx:173-184` (`nearestPreset`)
**Issue:** Two hand-rolled nearest-entry loops with separately expressed tie handling (index-keeps-first vs `entry < best`). Both resolve ties toward the lower entry today, but they can drift independently — and NumericInput's is only used by the scrub path flagged in WR-04.
**Fix:** Export one shared `nearestPreset(presets, base)` (returning the entry or index) from `fpsPresets.ts` or `NumericStepper.tsx` and use it in both.

### IN-04: Contract comment conflict — "off-list live values display as-is" vs "integer display is forced"

**File:** `app/src/components/shared/NumericStepper.tsx:21-22` vs `117-120`
**Issue:** For an integer off-list value (30) both clauses hold; for a fractional one (legacy D-24-era fps 24.5) the display rounds to 25, so "as-is" is false. Traced end-to-end the rounded display stays self-consistent (presses base on the visible text, so the user never sees a skip), and typed "24.5" commits 24 (ties-low) while a live 24.5 shows 25 — an asymmetric rounding nobody will likely hit. The pin tests only cover the integer case (`value: 30`).
**Fix:** Tighten the comment: "off-list *integer* values display as-is; fractional values round to the integer display (ties away from the ties-low commit rule)". Optionally add one pin for a fractional off-list value to freeze whichever reading is intended.

---

_Reviewed: 2026-09-24T12:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
