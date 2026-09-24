# Quick 260924-ffd: Numeric stepper contract (integer ±1 default + fps presets) — Research

**Researched:** 2026-09-24
**Domain:** Shared Preact numeric stepper contract (NumericStepper/NumericInput), two-tier fps model
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Preset end-state buttons:** At fps 60 the `+` button and at fps 6 the `−` button are **visibly disabled** (dimmed, unclickable) — makes the preset list bounds obvious. Not a silent no-op.
- **New Project default fps:** **24** is pre-selected by default in the New Project dialog (matches today's button row's higher option and common film cadence).
- **Garbage typed input policy (classic fields):** **Reject + revert**: typing garbage (`abc`, unparseable) on a classic integer/constant-step field and committing (blur/Enter) reverts to the value before the edit. (Usable-but-off-step numeric input keeps the existing snap/round-to-step commit path — T-52.2-08 unchanged.)

### Claude's Discretion
- Exact disabled-button styling: reuse whatever disabled state pattern already exists in the app's controls.
- Where the shared FPS_PRESET list constant lives (co-located with NumericStepper or a small shared module) — pick the least-coupled location.
- Whether Settings/New Project stepper passes `presets` only (typed commit then snaps to nearest preset per contract).
- Research-phase findings on implementation shape (RESEARCH.md feeds this).

### Deferred Ideas (OUT OF SCOPE)
(none declared in CONTEXT.md — no timeline fps control in this quick; explicit decimal steps and paper grain scale untouched)
</user_constraints>

## Summary

The shared `NumericStepper` already centralizes display, clamp, commit, hold-to-repeat, and coalesced undo; the contract redesign is an extension of its constraint-injection model (260924-d6l: `resolveStep`/`freeEntry` are the existing opt-in exceptions), not a rewrite. Three changes are needed: (1) make `step` optional with default 1 so the classic default is "no constraints passed", (2) add a new `presets?: readonly number[]` mode that owns stepping, typed-commit snapping, integer display, and visibly-disabled end buttons, (3) convert the three fps surfaces to that mode with one shared list constant. The two fps tiers are already cleanly separated in code — `projectStore.setFps` (Settings + New Project) vs `rotoCachedPlayback.updateFps` (Studio) — so the isolation law mostly needs a regression pin, not a refactor. The riskiest spots are the D-24 test pins in `NumericStepper.test.tsx` (must be rewritten, not kept green) and a mid-hold pointer-disable edge case that can strand the module-global undo coalescing.

**Primary recommendation:** extend `NumericStepper` with a `presets` branch inside `stepBy`/`commitStepperInput`/`formatStepperValue` + per-button `disabled` computation; put `FPS_PRESETS` in a new `app/src/lib/fpsPresets.ts`; rewrite only the three D-24 fps pins; add an explicit end-of-hold cleanup so coalescing can never stick when a preset end button disables mid-hold.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Stepping/commit/display contract (classic + preset) | Shared UI component (`NumericStepper`) | — | Single owner of clamp+round+coalesce (T-52.2-08) |
| Label drag-to-scrub | Shared UI component (`NumericInput`) | — | Wraps the stepper; must inherit both modes |
| FPS preset list constant | `app/src/lib/` module | — | Third consumer is physic-paint; lib is least-coupled |
| PROJECT fps persistence | `projectStore` (signal) | SettingsView / NewProjectDialog | Authoritative output cadence; `setFps` marks dirty |
| STUDIO playback fps | `useRotoCachedPlayback` (session hook) | PhysicsPaintStudio callback | Preview-only; already never imports projectStore |
| Reject+revert garbage input | `commitStepperInput` → `commitInput` else-branch | — | Null return already routes to display revert |

## Standard Stack

No new packages. Everything reuses existing project machinery:

| Piece | Version | Purpose | Why Standard |
|-------|---------|---------|--------------|
| NumericStepper / NumericInput | in-repo | Shared `− [field] +` treatment | 52.2-03; sole numeric-field component |
| vitest | ^2.1.9 [VERIFIED: app/package.json:50] | Test runner | CLAUDE.md: `vitest run`, never watch |
| @preact/signals + history coalescing | in-repo | State + single-undo holds | Project-wide; `startCoalescing`/`stopCoalescing` |

**Installation:** none.

## Package Legitimacy Audit

Not applicable — this quick installs no external packages.

## Architecture Patterns

### 1. Current stepper shape (what presets mode must touch)

`NumericStepperProps.step` is currently **required** [VERIFIED: app/src/components/shared/NumericStepper.tsx:47] — "`step: number`". The classic default contract requires making it optional, defaulting to 1 in the destructuring. Touch points inside `NumericStepper.tsx`:

- `formatStepperValue(value, step, precision)` [VERIFIED: NumericStepper.tsx:88-94] — `decimals = precision ?? (step >= 1 ? 0 : 3)`; with default `step = 1` integer display is automatic; **preset mode must force `decimals = 0` regardless of any leftover `step`** ("no decimals ever").
- `clampToStep` [VERIFIED: NumericStepper.tsx:97-103] — keep byte-identical for classic/explicit steps; preset mode bypasses the step-grid and snaps to list entries instead.
- `parseStepperInput` [VERIFIED: NumericStepper.tsx:110-112] — comma-tolerant; unchanged (guardrail).
- `commitStepperInput` [VERIFIED: NumericStepper.tsx:128-141] — returns `null` when `!Number.isFinite(parsed)`; **reject+revert already exists**: `commitInput` on null sets `element.value = display` (pre-edit value) and never calls `onChange` [VERIFIED: NumericStepper.tsx:267-275]. Garbage policy needs a strengthening pin (assert display revert), not new logic. Preset mode needs a branch here: nearest-entry snap, ties → lower, clamp to `[presets[0], presets.at(-1)]` first.
- `stepBy(direction)` [VERIFIED: NumericStepper.tsx:231-237] — the single funnel for press/hold/keyboard. Preset branch: find next/previous entry relative to current base (base = typed text if parseable, else `value` — existing behavior); off-list base snaps to nearest neighbour **in direction of travel** (from 30: `+` → 50, `−` → 25); at list end, `next === value` → no emission. `resolveStep` branch must take lower precedence than (or be mutually exclusive with) `presets`.
- Hold-to-repeat [VERIFIED: NumericStepper.tsx:29-33, 239-258] — 400 ms delay / 60 ms interval, bracketed by `startCoalescing()`/`stopCoalescing()`; unchanged mechanics, but see Pitfall 1 for end-button disable.
- Per-button end `disabled`: component-wide `disabled` already guards `handlePressStart`/`handleClick` [VERIFIED: NumericStepper.tsx:240, 263]; per-direction end-disabled must be computed at render AND checked in the handlers (the vnode test harness invokes handlers directly on disabled buttons).

`NumericInput` drag-scrub [VERIFIED: app/src/components/shared/NumericInput.tsx:39-53] — every 4 px = 1 step via `currentVal + steps * step` then `Math.round(newVal / step) * step` + min/max clamp, inside `startCoalescing`/`stopCoalescing` + blur bypass. Preset mode: same 4 px threshold but move `steps` **entries** along the list, clamped at ends; classic mode with default step 1 already yields ±1 per threshold (formula unchanged). `NumericInput` must gain a `presets` passthrough prop (it currently passes only label/value/step/min/max/onChange [VERIFIED: NumericInput.tsx:76-84]).

### 2. fps call-site map (two-tier model, already isolated)

| Surface | File (verified lines) | Current shape | Target |
|---------|----------------------|---------------|--------|
| SettingsView | app/src/components/views/SettingsView.tsx:30-48 | `{[15, 24].map((rate) => …)}` buttons, `onClick={() => projectStore.setFps(rate)}` [VERIFIED: SettingsView.tsx:34-46] | Replace button row with preset stepper bound to `projectStore.fps.value` / `projectStore.setFps` |
| NewProjectDialog | app/src/components/project/NewProjectDialog.tsx:167-198 | Same `[15, 24]` pills, local `const [fps, setFps] = useState(24)` [VERIFIED: NewProjectDialog.tsx:47, 173-197]; seeds `projectStore.createProject(name.trim(), fps, …)` [VERIFIED: NewProjectDialog.tsx:103] | Same preset stepper, local state, **default 24** (already the useState default) |
| Studio playback | app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1191-1217 | `value={props.playbackFps || props.projectFps \|\| 1}`, `step={0.5} min={1} max={60}`, `ariaLabel="Cached Roto playback frames per second"` [VERIFIED: PhysicsPaintWorkflowStrip.tsx:1191-1198] | Replace `step/min/max` with `presets={FPS_PRESETS}` (ends 6/60) |

Wiring already guarantees the isolation law:

- Studio: strip onChange → `handleRotoPlaybackFpsChange` (finite guard only) → `props.onPlaybackFpsChange` [VERIFIED: PhysicsPaintWorkflowStrip.tsx:1109-1113] → `setRotoPlaybackFps` = `rotoCachedPlayback.updateFps(fps)` + settings enqueue [VERIFIED: PhysicsPaintStudio.tsx:1953-1956] — **no projectStore reference**.
- Hook clamp: `const MIN_ROTO_PLAYBACK_FPS = 1; const MAX_ROTO_PLAYBACK_FPS = 60;` and `clampRotoPlaybackFps` finite+clamp [VERIFIED: app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts:10-11, 78-81]; tests pin `NaN→1, 0→1, 12.5→12.5, 99→60` [VERIFIED: useRotoCachedPlayback.test.ts:144-147].
- Launch seed: `const previewFps = launchContext?.fps && launchContext.fps > 0 ? launchContext.fps : 12;` [VERIFIED: PhysicsPaintStudio.tsx:939] — fallback 12 is in the preset list; initial settings clamp `Math.max(1, Math.min(60, previewFps))` [VERIFIED: PhysicsPaintStudio.tsx:942].
- Project tier: `const fps = signal(24);` [VERIFIED: app/src/stores/projectStore.ts:53]; `setFps(v) { fps.value = v; isDirty.value = true; }` [VERIFIED: projectStore.ts:784-787].

**FPS_PRESET constant location (discretion, recommendation):** `app/src/lib/fpsPresets.ts` exporting `FPS_PRESETS = [6, 12, 15, 24, 25, 50, 60] as const` (list values per locked contract in 260924-ffd-CONTEXT.md:12 [VERIFIED: 260924-ffd-CONTEXT.md:12]). Precedents: a lib preset table already exists (`export const COLOR_GRADE_PRESETS: Record<string, ColorGradeParams> = {` [VERIFIED: app/src/lib/fxPresets.ts:4]), and the SettingsView header documents the shared-table pattern — "consume the SHARED preset table so a future edit cannot silently reintroduce a 4K option in one surface while the other stays clamped" [VERIFIED: SettingsView.tsx:4-8]. lib/ is least-coupled because the third consumer lives in physic-paint (cross-domain import from `components/project/` would be awkward; co-locating a domain list inside the generic stepper couples component to fps domain).

### 3. Test surgery — rewrite vs preserve (NumericStepper.test.tsx, 23 tests)

**REWRITE (D-24 obsolete):**
- `'moves by exactly 0.5 when the field step is 0.5 (the fps field)'` [VERIFIED: NumericStepper.test.tsx:156-170] — retarget to a generic explicit-subunit-step pin (contract still requires `step={0.01}` → ±0.01, CONTEXT pin 5) and drop the fps framing.
- `'keeps the Studio fps field on a 0.5 step while other fields keep 1'` [VERIFIED: NumericStepper.test.tsx:542-549] — replace with: fps element declares `presets={…FPS_PRESETS…}` and does NOT declare `step={0.5}`; comment `/** The Studio workflow strip keeps the fps field on a 0.5 step (D-24). */` [VERIFIED: :453] must go.
- `'declares an explicit step on every NumericStepper element in a swept file'` [VERIFIED: NumericStepper.test.tsx:529-540] — must accept `step={` **or** `presets={` (the fps element in the swept PhysicsPaintWorkflowStrip will have no `step`). Failure message text mentioning "D-24: fps 0.5" must be updated.
- Sweep list is length-asserted: `expect(scannedPaths).toHaveLength(6)` [VERIFIED: NumericStepper.test.tsx:506] over `SWEPT_COMPONENT_PATHS` [VERIFIED: :444-451]. SettingsView and NewProjectDialog are NOT currently swept — adding them (recommended, since they gain fps steppers) requires updating the 6→8 assertion (Rule-1-visible, intentional).

**PRESERVE VERBATIM:**
- Clamp-at-ends-when-held tests [VERIFIED: :136-154], short-press/no-repeat-after-release [VERIFIED: :172-180], repeat lifecycle [VERIFIED: :182-207], typed out-of-range clamp [VERIFIED: :241-247], always-two-buttons [VERIFIED: :255-268], component `disabled` [VERIFIED: :270-281] — these ARE T-52.2-08.
- 260924-d6l constraint-injection pins (Pin 1 classic ±0.01 + typed snap, Pin 2 grain bands + free comma entry, Pin 3 sweep scope) [VERIFIED: NumericStepper.test.tsx:302-427] — untouched.
- Grain field pins in `PhysicsPaintTopBar.test.ts` (`expect(stepper!.props.resolveStep).toBe(grainScaleStep)` at line 113, band walk at 126-134) — untouched.
- Garbage test `'clamps a typed out-of-range value and ignores unparseable text'` [VERIFIED: :241-253] — keep, ADD assertion that `element.value` reverts to the pre-edit display (reject+revert decision).

**NEW RED pins (from CONTEXT RED-first list):** classic default ±1 + integer display; preset walk from 24 (`+` → 25 → 50; `−` → 15 → 12); typed `"30"` → **25** (nearest by distance: |30−25|=5 vs |30−50|=20; CONTEXT specifics:73 resolves the pin-3 "24 or 25" wording — "standard nearest wins" → assert 25 exactly [VERIFIED: 260924-ffd-CONTEXT.md:73]); tie e.g. `"24.5"` → 24 (ties low); disabled end buttons at 6/60; two-tier isolation (Studio fps change never writes `projectStore.fps` — cheapest solid form: source-scan/unit pin that `setRotoPlaybackFps`/`updateFps` chain and `useRotoCachedPlayback.ts` never reference `projectStore.setFps`, plus the reverse Settings/NewProject pin that their stepper writes only `projectStore.setFps`/local `fps` state); paper-grain and explicit-decimal regression pins (already exist — keep green).

### Anti-Patterns to Avoid
- **Second stepper component:** CONTEXT guardrail — extend `NumericStepper`; `NumericInput` inherits via passthrough.
- **Preset mode via `resolveStep` closure over the list:** would collide with Pin 3 (exception options scoped to paper grain only) and can't express disabled-end buttons or typed nearest-snap. Use a first-class `presets` prop.
- **Silent no-op end buttons:** locked decision requires visibly disabled.
- **Writing `projectStore.fps` from Studio paths:** product law; pin it.
- **Keeping D-24 tests green by keeping fps at 0.5:** CONTEXT explicitly declares them obsolete.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo coalescing for holds/drags | Per-site debounce/merge logic | `startCoalescing`/`stopCoalescing` [VERIFIED: app/src/lib/history.ts:82-95; pushAction merge at :17-22] | Module-global anchor: first push keeps original undo, later pushes only update redo |
| Nearest-preset snap | FP-epsilon search | Integer distance scan over `FPS_PRESETS` (all entries integers) | No float noise on integer lists; ties → index of first of the two (lower) |
| Preset list duplication per surface | Inline array literals at 3 call sites | single `FPS_PRESETS` import | Same rationale as CANVAS_FORMAT_PRESETS [VERIFIED: SettingsView.tsx:4-8] |
| Comma parsing | Ad-hoc `replace(',', '.')` at call sites | existing `parseStepperInput` [VERIFIED: NumericStepper.tsx:110-112] | EU keyboard contract (260923-bcm) |

## Common Pitfalls

### Pitfall 1: Mid-hold end-button disable can strand module-global coalescing (highest risk)
**What goes wrong:** user holds `+` from 50; repeat reaches 60; button becomes natively `disabled` while held; `pointerup`/`pointerleave` may never fire on it (disabled elements don't dispatch pointer events; capture-release-on-disable is spec-fragile) → `handlePressEnd` never runs → `coalescing` stays `true` module-wide → **every subsequent unrelated `pushAction` coalesces into a stale anchor** (undo corruption across the app) [VERIFIED: history.ts:7-22 behavior].
**How to avoid:** when `stepBy` detects at-end (`next === value` in preset mode with no further entry), run the press-end cleanup immediately (`clearRepeat(); stopCoalescing(); pressing.current = false`) — or additionally listen for `pointerup` on `window` during a hold. Test: hold `+` across the end, advance timers, release; assert coalescing stopped (a subsequent independent `pushAction` creates its own entry).
**Warning signs:** undo collapses unrelated actions after an fps hold; `stopCoalescing` count < `startCoalescing` count in a test double.

### Pitfall 2: Sweep test fails the instant fps drops `step={0.5}`
The 'declares an explicit step on every element' scan fires on the fps element in the swept workflow strip. Rewrite the assertion in the SAME commit as the call-site change (see test surgery above), or CI goes red for the wrong reason.

### Pitfall 3: Trailing `.0` / decimals in preset + classic-default display
`formatStepperValue` only rounds when `step >= 1`; if preset mode passes through a fractional `step` or `precision`, decimals reappear. Force `decimals = 0` when `presets` is present (and rely on default `step = 1` for classic). Context pin: "No decimals ever shown in preset mode or classic default mode" [VERIFIED: 260924-ffd-CONTEXT.md:75].

### Pitfall 4: Off-list display vs first-press snap
Contract: live off-list value (e.g. seeded 30, or fallback `|| 1` at strip line 1192) displays as-is until first press. Don't snap in `formatStepperValue` or on render — only in `stepBy` (direction-of-travel) and `commitStepperInput` (nearest, ties-low). Note the strip fallback `|| 1` sits below preset min 6: display shows `1`, minus disabled (no lower entry), plus enabled → first press snaps to 6. Acceptable per contract; optionally reseed fallback to `projectFps` (discretion).

### Pitfall 5: Typed-commit ordering — clamp before snap vs snap before clamp
Typed `"5"` → below list: clamp-first → 6. Typed `"999"` → 60. Typed `"30"` → nearest among list = 25 (no clamp needed). Define order explicitly: parse → finite check → nearest-entry snap (ties-low) → clamp to list ends (belt-and-braces). Tests should pin `"5"`→6, `"999"`→60, `"30"`→25, `"24.5"`→24.

### Pitfall 6: Drag-scrub step math with default step
`NumericInput.onMove` does `Math.round(newVal / step) * step` — with `step` now optional, default it to 1 before the formula, or `newVal / undefined` → NaN. Preset branch replaces the arithmetic with list indexing but keeps the 4 px threshold and ends clamp.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `step` required on NumericStepper; D-24 "fps keeps step 0.5" | `step? = 1` classic default; `presets` mode for fps | This quick (260924-ffd) | D-24 pins rewritten; fps min/max become list ends 6/60 |
| Settings/New Project `[15, 24]` button rows | Shared preset stepper (7 entries) | This quick | Project fps selectable beyond 15/24; default 24 unchanged |
| Garbage typed input: onChange suppressed, display revert implicit | Same behavior, now an explicit locked pin + revert assertion | This quick | Behavior unchanged; contract made checkable |

**Deprecated/outdated:** D-24 "fps step 0.5" (test pins + comments at NumericStepper.test.tsx:156-170, :453, :542-549 and PhysicsPaintWorkflowStrip.tsx:1109-1110 comment) — superseded by preset mode.

## Runtime State Inventory

Not applicable — no rename/migration; code-only contract change. No stored data, live config, OS-registered state, secrets, or build artifacts carry the old stepper contract. (Verified by scope: no persistence format change; `projectStore.fps` values already include 15/24 which are both in the new list.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Disabling the held button mid-hold may skip `pointerup` on it (browser/spec behavior not re-probed this session) | Pitfall 1 | If browsers always deliver captured `pointerup`, defensive end-cleanup is still harmless — keep it anyway |
| A2 | `FPS_PRESETS` belongs in `app/src/lib/fpsPresets.ts` (Claude's discretion) | Patterns §2 | Low — any location works if all 3 surfaces import the same symbol; source-scan pin should assert single-literal |
| A3 | `clampRotoPlaybackFps` MIN stays 1 (hook safety clamp, not a stepper min/max) — presets never emit below 6 | Patterns §2 | If the plan interprets "fps min/max become 6/60" as also raising MIN, useRotoCachedPlayback.test.ts:144-145 pins (`NaN→1`, `0→1`) must be rewritten too |
| A4 | SettingsView + NewProjectDialog should be added to SWEPT_COMPONENT_PATHS (6→8) | Test surgery | If not added, fps steppers on those surfaces stay outside the sweep contract |

## Open Questions

1. **Should `MIN_ROTO_PLAYBACK_FPS` rise from 1 to 6?** — What we know: guardrail says "fps min/max become preset list ends (6, 60)"; the hook clamp is a separate internal safety with pinned tests. Recommendation: keep 1 (superset clamp; A3), apply 6/60 only as stepper `min`/`max`/list ends. Confirm at plan time.
2. **Sweep list growth** — add SettingsView + NewProjectDialog to `SWEPT_COMPONENT_PATHS`? Recommendation: yes (they adopt the shared treatment), updating `toHaveLength(6)` → `8` visibly.
3. **Strip fallback `|| 1`** — leave (contract handles off-list) or reseed to `projectFps`? Recommendation: leave in this quick; contract explicitly covers off-list display.

## Validation Architecture

Enabled: `nyquist_validation: true` [VERIFIED: .planning/config.json:13].

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | app workspace default (no one-off configs — memory: no test config hacks) |
| Quick run | `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm exec vitest run src/components/shared/NumericStepper.test.tsx` |
| Full suite | `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm exec vitest run` (NEVER watch mode) |

### Phase Requirements → Test Map (RED-first pins from CONTEXT)
| Behavior | Test type | Target file | File exists? |
|----------|-----------|-------------|--------------|
| No step/presets → exactly ±1, integer format | unit | shared/NumericStepper.test.tsx | ✅ (new pins) |
| Preset walk from 24: 25→50 / 15→12; ends clamp + disabled buttons | unit | shared/NumericStepper.test.tsx | ✅ (new pins) |
| Typed "30" → 25, "24.5" → 24 (ties low) | unit | shared/NumericStepper.test.tsx | ✅ (new pins) |
| Studio fps never writes projectStore.fps (and reverse) | unit/source-scan | shared/NumericStepper.test.tsx or stores-adjacent | ✅ (new pin) |
| `step={0.01}` still ±0.01 with decimals | unit | shared/NumericStepper.test.tsx (existing d6l Pin 1) | ✅ |
| Paper grain bands + free comma entry | unit | shared/NumericStepper.test.tsx (d6l Pin 2/3) + physic-paint/view/PhysicsPaintTopBar.test.ts | ✅ |
| Garbage typed commit rejected + display reverted | unit | shared/NumericStepper.test.tsx (strengthen :241-253) | ✅ |
| Hold-to-repeat → one undo + end-of-hold coalescing safety | unit | shared/NumericStepper.test.tsx | ✅ (extend) |

### Sampling Rate
- **Per commit:** quick run above + touched call-site test files (SettingsView.test.tsx, NewProjectDialog.test.tsx if fps pins added; useRotoCachedPlayback.test.ts if clamp touched).
- **Phase gate:** full `vitest run` green + `tsc` clean before UAT handoff.
- **Native UAT:** 8 rows defined in CONTEXT.md:45 (post-GREEN).

### Wave 0 Gaps
- [ ] Rewrite the 3 D-24 pins + sweep assertion (same commit as call-site change — Pitfall 2).
- [ ] New RED pins listed above (commit before production edits).
- No new test files or framework install required.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (tangential) | `commitStepperInput` parse → finite check → snap/clamp; garbage → null → revert; no eval/parse of arbitrary input |
| V1/V2/V3/V4/V6 | no | No auth, session, access-control, or crypto surface in this quick |

Known threat pattern: none relevant beyond numeric sanitization already enforced by the single commit path (all emissions funnel through `clampToStep`/preset snap — no raw typed number reaches stores).

## Sources

### Primary (HIGH confidence)
- [VERIFIED: app/src/components/shared/NumericStepper.tsx] — full file read: props, stepBy, commit path, hold-to-repeat, coalescing
- [VERIFIED: app/src/components/shared/NumericInput.tsx] — full file read: drag-scrub path
- [VERIFIED: app/src/components/shared/NumericStepper.test.tsx] — full file read: 23 tests, sweep contract, d6l pins
- [VERIFIED: 260924-ffd-CONTEXT.md] — locked decisions, RED pins, guardrails
- [VERIFIED: app/src/components/views/SettingsView.tsx:1-55], [VERIFIED: app/src/components/project/NewProjectDialog.tsx:40-114, 165-204], [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:1105-1224] — fps call sites
- [VERIFIED: app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts:1-90], [VERIFIED: app/src/components/physic-paint/PhysicsPaintStudio.tsx:935-946, 1950-1956], [VERIFIED: app/src/stores/projectStore.ts:50-57, 782-787], [VERIFIED: app/src/lib/history.ts:7-36], [VERIFIED: app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx:50-58], [VERIFIED: app/src/lib/fxPresets.ts:1-16] — two-tier wiring, coalescing, grain, lib precedent

### Secondary (MEDIUM confidence)
- [VERIFIED: app/package.json:50] vitest ^2.1.9; [.planning/config.json:13] nyquist_validation true (registry not re-queried — existing project dependency)

### Tertiary (LOW confidence)
- None — no web/training-dependent claims; all findings grounded in files read this session or locked CONTEXT decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing components fully read
- Architecture: HIGH — all three call sites + both fps tiers read end-to-end; isolation already structural
- Pitfalls: HIGH for Pitfalls 2-6 (source-grounded); MEDIUM for Pitfall 1 (browser pointer-capture-on-disable behavior assumed, defensive fix recommended regardless — A1)

**Research date:** 2026-09-24
**Valid until:** 7 days (contract quick; codebase active daily)
