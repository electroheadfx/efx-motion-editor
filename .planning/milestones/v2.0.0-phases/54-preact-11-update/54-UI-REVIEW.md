# Phase 54 — UI Review

**Audited:** 2026-11-02
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists for this phase)
**Screenshots:** not captured — dev server detection found nothing on localhost:3000, 5173, or 8080, and this audit is constrained to source review (live visual UAT belongs to the user; no Playwright/Chrome DevTools)
**Interaction captures:** off (`workflow.ui_interaction_capture` = false)

---

## Phase 54 Scope Note

Phase 54 was a type-only Preact 11 migration. The two commits that touched UI source prove it:

- `522eb2a4` (`NumericStepper.tsx`, `SliderStepper.tsx`, `PhysicsPaintCanvasMount.tsx`): every hunk changes only a type annotation — `JSX.CSSProperties` → bare `CSSProperties`, `JSX.Targeted*Event` → bare `Targeted*Event`, `as CSSProperties`. No style value, event handler, DOM structure, or copy changed.
- `5f08311a`: six test-harness materializers only (`childrenOf`/`materialize` treat throwing function components as opaque leaves). No shipped surface.

The tree also contains post-phase work on the same components (`261009-6ee` single-pill chrome, `261010-nzu` sidebar theme tokens, `261024-p5q` mixed display). Those are outside the Phase 54 diff but are part of the current implementation, which the objective asks to score. No finding below is a regression introduced by Phase 54.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Accessible ± labels and a domain-correct "Mixed" readout; the canvas-mount error exposes implementation detail with no next step |
| 2. Visuals | 2/4 | The Studio's global `button` rule paints a border+background on NumericStepper's ± buttons inside the 22px single-pill, breaking the documented one-box contract |
| 3. Color | 3/4 | Strong token strategy; the mixed-selection red `#ef4444` and knob's `#ffffff` are hardcoded and bypass theme tokens |
| 4. Typography | 3/4 | 3 sizes / 2 weights, within threshold; the two sibling numeric fields disagree on value typography and value-box height |
| 5. Spacing | 3/4 | Consistent 2/4/6px rhythm and shared 22px control height; the sibling steppers use different value-box heights and the knob position is a hardcoded 5.5px magic number |
| 6. Experience Design | 2/4 | Neither editable field shows a focus indicator, and the slider track is pointer-only with unreachable keyboard stepping |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **No visible focus indicator on either editable numeric field** — `NumericStepper.tsx:267` and `SliderStepper.tsx:123` set `outline: 'none'` inline, and `index.css` defines no focus-visible style at all. Inline styles beat the Studio's `input:focus-visible` rule (`physicsPaintStudio.css:158-161`), so keyboard users cannot see where focus is in Settings, New Project, the sidebar, or Studio. — Concrete fix: delete the inline `outline: 'none'` and add a shared `:focus-visible` rule for `.numeric-stepper-input` and `.slider-stepper-value` in `index.css` (e.g. `outline: 2px solid var(--color-accent); outline-offset: 1px`), or apply the focus style conditionally from `onFocus`/`onBlur` state so it survives the inline-style precedence.

2. **Studio chrome leak: the single-pill NumericStepper renders three boxes in Studio** — the Studio stylesheet declares an unscoped `button { padding; border: 1px solid #2a5588; background: #1a3a5a; ... }` (`physicsPaintStudio.css:174-185`) with `button:hover:not(:disabled)` (`:188`) and `button:disabled` (`:199`). `BASE_BUTTON_STYLE` (`NumericStepper.tsx:244-257`) deliberately carries no `border`/`background`, so the ± buttons inherit the blue box inside the 22px pill. The existing pin at `NumericStepper.test.tsx:924-933` only checks inline style keys, so it is blind to this. — Concrete fix: add `border: 'none'` and `background: 'transparent'` to `BASE_BUTTON_STYLE` (inline wins over the Studio rule), keep the disabled affordance as `opacity`-only via a scoped CSS rule, and extend the single-box pin to assert those two keys.

3. **The ± controls and the slider track are unusable without a pointer** — the ± buttons set `tabIndex={-1}` (`NumericStepper.tsx:416,461`; `SliderStepper.tsx:506,546`), the text inputs handle only Enter/Escape (no ArrowUp/ArrowDown), and the track is a plain `div` with pointer handlers and no `role`, `tabIndex`, or `aria-value*` (`SliderStepper.tsx:518-541`). The `event.detail !== 0` keyboard branch in `handleClick` is therefore unreachable for keyboard-only users. — Concrete fix: add ArrowUp/ArrowDown (and optionally Home/End) stepping to both value inputs, and expose the track as `role="slider"` with `aria-valuemin`/`aria-valuemax`/`aria-valuenow`, `aria-label`, `tabIndex={0}`, and Left/Right key handling.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **PASS** — Icon-only controls are labeled with the field name: `Decrease ${ariaLabel}` / `Increase ${ariaLabel}` (`NumericStepper.tsx:418,463`; `SliderStepper.tsx:508,548`).
- **PASS** — The undetermined state has deliberate domain copy: `MIXED_DISPLAY = 'Mixed'` (`SliderStepper.tsx:135`), mirrored into the input value and the Escape/invalid-commit path.
- **WARNING** — `CANVAS_MOUNT_ERROR` (`PhysicsPaintCanvasMount.tsx:12`) reads "Unable to mount physics paint canvas: canvas wrapper did not create a canvas". It names an internal element ("canvas wrapper"), gives no recovery step, and is rendered as a bare paragraph. Rewrite to an outcome + action ("Paint canvas could not start. Reopen Studio to try again.") and announce it (see Pillar 6).
- **N/A** — No empty-state copy in these components; loading copy belongs to the engine layer.

### Pillar 2: Visuals (2/4)

- **PASS** — Clear focal hierarchy: NumericStepper is a 22px pill with two 20px icon buttons and a centered 12px tabular value (`NumericStepper.tsx:230-268`); SliderStepper puts an editable 17px value box beside a 11px/600 label above a 22px bar (`SliderStepper.tsx:106-132,166-176`).
- **PASS** — Every icon-only button carries an accessible name; lucide icons are `aria-hidden` and sized 12 (`NumericStepper.tsx:425,470`).
- **BLOCKER (visual contract)** — The one-box pill contract documented at `NumericStepper.tsx:221-229` does not survive the Studio stylesheet: the unscoped `button` rule (`physicsPaintStudio.css:174-185`) adds a `#1a3a5a` fill and `#2a5588` border to both ± buttons inside the transparent pill, and `button:hover:not(:disabled)` (`:188`) and `button:disabled` (`:199`, opaque `#111827`) compound it. Result on the Studio fps stepper (`PhysicsPaintWorkflowStrip.tsx:1608-1625`) and right-panel steppers: three visible boxes and a hover/disabled state that changes the pill's internal chrome.
- **WARNING** — Disabled ± buttons have no author styling in the main window (`index.css` contains no `:disabled` or focus rules; Tailwind preflight only resets). Their inline `color` (`NumericStepper.tsx:252`, `SliderStepper.tsx:189`) overrides the UA's graytext, so a disabled end-of-preset button differs only by cursor outside Studio, while inside Studio it gains a solid dark box. The locked "visibly DISABLED" promise in `NumericStepper.tsx:18-20` is therefore surface-dependent.
- **WARNING** — Hit targets are below the 24×24 CSS px minimum: ± cells are 20×20 (`NumericStepper.tsx:248-249`) and 30×20 (`SliderStepper.tsx:183-184`). Small but deliberate-looking; raise height to 24px or add invisible padding via a pseudo-element.
- **WARNING** — The slider track has no hover, active, or focus affordance; the knob and progress are static (`SliderStepper.tsx:518-541`). There is no visual response when the track is focused (it can never be) or dragged beyond the knob movement.

### Pillar 3: Color (3/4)

- **PASS** — NumericStepper is fully token-driven with documented fallbacks: `var(--sidebar-border-unselected, …)` / `var(--sidebar-input-bg, …)` (`NumericStepper.tsx:240-241`), no bare hex.
- **PASS** — Accent use is controlled: exactly one progress fill per slider reads `var(--color-accent, #2f67e8)` (`SliderStepper.tsx:224`). Neutral surfaces dominate; no accent overuse.
- **PASS** — SliderStepper chrome follows `--sidebar-*` tokens (`SliderStepper.tsx:110,122,124,130,175,189,215,233`) after `261010-nzu`.
- **WARNING** — The mixed-selection color is hardcoded (`MIXED_VALUE_STYLE`, `SliderStepper.tsx:138-141`, `color: '#ef4444'`) and pinned by a test (`SliderStepper.test.tsx:306`). It is not the app's error token (`--color-error-text` is `#FF6666`/`#CC3333` depending on theme, `index.css:62-64,157-159,252-254`), so it does not adapt across the three themes and diverges from the documented error palette. The same literal is duplicated in `PhysicsPaintStrokeSettingsDialog.tsx:268` and `ScriptStrokeOverlay.tsx:70` — a de-facto error color that should be tokenized.
- **WARNING** — `KNOB_STYLE` hardcodes `outline: '1px solid #ffffff'` (`SliderStepper.tsx:234`). The light theme thumb is `#333344` (`index.css:296`), so the white ring is the only white surface in that theme and can read as a halo rather than an edge.
- **WARNING** — The canvas-mount error surface uses legacy hardcoded colors (`.demo-error`, `physicsPaintStudio.css:79-88`: `#ff6666` text, `rgba(70,18,18,0.7)` background) instead of the existing `--color-error-text` / `--color-error-bg` tokens (9 usages in the tree). Same surface also uses a fixed dark red box that will not adapt to the light theme.

### Pillar 4: Typography (3/4)

- **PASS** — 3 distinct sizes (11px, 12px, 13px) and 2 weights (implicit 400 + explicit 600) across the audited UI components — under the abstract thresholds (>4 sizes, >2 weights): `NumericStepper.tsx:264`; `SliderStepper.tsx:107-108,127-128,190`.
- **PASS** — Both editable fields use `fontVariantNumeric: 'tabular-nums'` (`NumericStepper.tsx:266`, `SliderStepper.tsx:131`), preventing value jitter while stepping.
- **WARNING** — The two sibling numeric treatments share one commit contract but disagree on the value slot: NumericStepper renders 12px/400 text inside a 22px pill (`NumericStepper.tsx:259-268`), SliderStepper renders 11px/600 text inside a 17px box (`SliderStepper.tsx:117-132`). In the same right panel they read as two different components. Pick one value typography token and one box height, or document the difference as intentional by role (compact field vs inline slider).
- **NOTE** — Sizes are inline px literals rather than type tokens (app-wide convention, also present in the Studio stylesheet), so there is no single place to retune the scale.

### Pillar 5: Spacing (3/4)

- **PASS** — Shared control height across the two components: 22px pill/bar (`NumericStepper.tsx:236`, `SliderStepper.tsx:172`) and 20px internal cells (`NumericStepper.tsx:248-249`, `SliderStepper.tsx:184`). Gaps follow a 2/4/6px rhythm (`NumericStepper.tsx:217,238`; `SliderStepper.tsx:85,94,101,146,153`).
- **PASS** — The pill math is coherent: 20px button + 4px gaps + 6px horizontal padding fit the 22px box with `boxSizing: 'border-box'`.
- **WARNING** — Three horizontal paddings coexist (`0 2px`, `0 5px`, `0 6px`) and two value-box heights (22px inside the pill vs 17px standalone), so the two steppers do not line up when placed in the same row. `PhysicsPaintWorkflowStrip` already mixes both (`NumericStepper` for fps, `SliderStepper` in dialogs/panels).
- **WARNING** — Knob geometry uses hardcoded half-pixel constants: `calc(50% - 5.5px)` for the knob and `calc((100% - 11px) * fraction + 5.5px)` for the fill (`SliderStepper.tsx:530-539`). They are correct for an 11px knob but must be edited in three places if the knob size changes. Define `KNOB_SIZE` once and derive the calc strings.
- **WARNING** — The value box's 46px width (`SliderStepper.tsx:118`) is a fixed slot; large values (e.g. 1200 in `SliderStepper.test.tsx`) rely on the 11px font and tabular numerals to fit. If a field's range grows, the readout clips.

### Pillar 6: Experience Design (2/4)

- **PASS** — Commit contract is strong: Enter commits, Escape reverts to display, blur commits, EU decimal comma is normalized before `parseFloat`, out-of-range/typed values snap or clamp by mode (`NumericStepper.tsx:140-142,191-212,392-400,447-455`; `SliderStepper.tsx:420-435,489-497`).
- **PASS** — Hold-to-repeat has explicit termination conditions plus unmount cleanup (`NumericStepper.tsx:323-337,378-383`; `SliderStepper.tsx:301-315,351-356`), and preset-end mid-hold cleanup runs inside `stepBy` so module-global coalescing cannot strand (`NumericStepper.tsx:340-360`). Coalescing gives one undo entry per gesture.
- **PASS** — Disabled state is enforced at render and in every handler; preset ends are computed per render (`NumericStepper.tsx:303-319,365,388`).
- **BLOCKER** — No visible focus indicator on either editable value field (details in Top Fix 1). This is a WCAG 2.4.7 failure on every surface that uses the shared steppers.
- **WARNING** — The slider track is pointer-only: no `role`, `tabIndex`, or `aria-value*` on the track (`SliderStepper.tsx:518-541`), and no keyboard handling. Screen-reader users can read the input value but cannot operate or perceive the slider.
- **WARNING** — Keyboard users cannot step: ± buttons are `tabIndex={-1}` and the inputs handle only Enter/Escape. The `event.detail !== 0` branch that exists to support keyboard/AT activation (`NumericStepper.tsx:385-390`; `SliderStepper.tsx:358-362`) never runs for keyboard-only users.
- **WARNING** — The canvas-mount error is not announced: `<p class="demo-error">` (`PhysicsPaintCanvasMount.tsx:205`) has no `role="alert"` or `aria-live`, is set once from a single `requestAnimationFrame` probe (`:129-134`), is never cleared or retried, and gives no recovery path. If the canvas mounts after that one frame, a false error stays on screen.
- **N/A** — No loading states needed for the steppers; the canvas mount has an asynchronous one-frame probe but exposes no intermediate state.
- **MINOR (convention)** — `PhysicsPaintCanvasMount` still uses `useState` for `mountError` and `displaySize` (`PhysicsPaintCanvasMount.tsx:74-75`) while the project standard is signals (`CLAUDE.md` §Preact; `efx-preact-reactivity` rule 2). The locality reason is defensible (component-local ResizeObserver output), but the project directive asks for signals.
- **MINOR** — The default brush color `'#103c65'` is duplicated at `PhysicsPaintCanvasMount.tsx:94` and `:113`; hoist to a named constant so the two assignments cannot drift.

---

## Registry Safety

Not applicable — `components.json` does not exist (`NO_SHADCN`), and no third-party shadcn registry blocks are involved.

---

## Files Audited

- `app/src/components/shared/NumericStepper.tsx`
- `app/src/components/shared/SliderStepper.tsx`
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`
- `app/src/components/shared/NumericStepper.test.tsx` (contract pins, incl. single-box pin)
- `app/src/components/shared/SliderStepper.test.tsx` (contract pins, incl. `#ef4444`)
- `app/src/index.css` (theme tokens; absence of focus/disabled rules)
- `app/src/components/physic-paint/physicsPaintStudio.css` (global `button`, focus-visible, `.demo-error`)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (Studio stepper consumer)
- `app/src/components/project/NewProjectDialog.tsx`, `app/src/components/sidebar/PaintProperties.tsx`, `app/src/components/sidebar/InlineColorPicker.tsx`, `app/src/components/sequence/KeyPhotoStrip.tsx` (main-window consumers)
- `.planning/phases/54-preact-11-update/54-01…54-05-SUMMARY.md`, `54-04-PLAN.md`, `54-CONTEXT.md`
- Git evidence: `522eb2a4` (type-only UI diff), `5f08311a` (test harnesses only)
