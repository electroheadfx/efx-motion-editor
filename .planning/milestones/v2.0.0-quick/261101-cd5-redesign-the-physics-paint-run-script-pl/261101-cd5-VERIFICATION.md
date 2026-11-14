---
phase: 261101-cd5-redesign-the-physics-paint-run-script-pl
verified: 2026-11-01T08:48:50Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/quick/261101-cd5-redesign-the-physics-paint-run-script-pl/261101-cd5-PLAN.md"
  - ".planning/quick/261101-cd5-redesign-the-physics-paint-run-script-pl/261101-cd5-SUMMARY.md"
  - "app/src/components/physic-paint/physicsPaintStudio.css"
  - "app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx"
  - "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts"
  - "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx"
covered_digest: "v3:sha256:d7d0289ba8d56c24d08083cb811353d69a022e2aff853df5dcbc1a4ff66ddece"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "The generation <progress> is no longer inside an aria-hidden subtree; the progressbar role and its aria-label are exposed while generating."
  gaps_remaining: []
  regressions: []
---

# Phase 261101-cd5: Redesign the Physics Paint Run Script dialog — Verification Report

**Phase Goal:** Redesign the Physics Paint Run Script (Play Script) modal to the approved 700 × 660 design. UI/composition only. Fixed 700 × 660 no scroll (creation views); tabs own the panel; Rail Type is the panel subheader; Timing is the hero; Motion wiggle is 2 × 2; compact global cards; footer order progress → info → status → actions; Requested/Effective in a borderless hover/focus tooltip; Custom color swatch + hex underneath; Reveal reference rail-row chip. Applies to Paint/Reveal × Motion/Static and all preserved non-create dialog modes. Do not touch controller, ports, timing laws, stacking, source-cycle/loop-clip logic, or async flows. Preserve accessibility.

**Verified:** 2026-11-01T08:48:50Z
**Status:** passed
**Re-verification:** Yes — after closing the truth-7 accessibility gap in `0d19a64ac`

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | One fixed 700 × 660 surface (14px radius) for Paint/Reveal × Motion/Static, with no dialog-level scroll container and no clipped section | ✓ VERIFIED | `physicsPaintStudio.css:2314-2329` sets `width:700px; height:660px; border-radius:14px; overflow:hidden`; the Play Script block (2280-3560) contains no `overflow: auto\|scroll` except the pre-existing bounded regenerate group list (`2952-2962`, a preserved-mode in-card list); tests assert the surface's direct children are header → workspace → footer. No-clip at pixel level is live UAT (see watch items), not a status gate. |
| 2 | Paint Rail / Reveal Photo Rail are folder tabs that own the panel: active fill + merge + 2px amber top rule; the panel's first row is a compact RAIL TYPE subheader (caps label + segmented + one-line helper, 1px divider), not a bordered card | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:293-312` renders `role="tablist"` + `role="tab"` + `aria-selected` + `disabled={busy}`; CSS 2357-2401 (tabs, active `--ps-tab-active` top rule), 2636-2668 (`-card-mode`, caps `RAIL TYPE`, helper, bottom divider); `PhysicsPaintPlayScriptCards.tsx` `RailTypeCard` renders `-card-mode` + `-rail-row` without `-card`; dialog test "composes header → workspace (folder tabs then tab-owned panel) → footer" passes. |
| 3 | Timing hero (raised 150px, large Frames value, wide track, compact Cycle, Max/Infinity), Motion 2×2 slim sliders, one compact equal-height global row with conditional Source cycle and Custom swatch + hex underneath | ✓ VERIFIED | CSS 2976-3049 (`-card-timing` `height:150px`, header/body/156px cycle/divider/foot); Cards `PaintTimingCard`/`RevealTimingCard` pass `-hero-stepper` / `-compact-stepper` (overrides at 3155-3295 with `!important`); `MotionWiggleCard` 2×2 grid; `ColorCard` swatch + hex column (CSS 2610-2634); `SourceCycleCard` as the conditional fourth compact card; global row `height:80px` (2556) with `-surface-tall` `height:auto; min-height:80px`; tests for the compact Link/Create control and card composition pass. |
| 4 | Footer reads progress track → info control → status → Cancel / Run Script; Requested/Effective in a borderless hover+focus tooltip anchored above the 56px footer; real `<progress>` only while generating; failure `role=alert` in the status slot, never a surface row | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:442-486` footer order and error slot; CSS 3327 (56px footer), 3343-3376 (160×4 track, `<progress>` skins), 3408-3432 (absolute tooltip, `:hover`/`:focus-within`, `pointer-events:none`); tests: tooltip prefixes stripped + absent when readout null, Ready while idle, failure inside the footer with `role="alert"`, no `<progress>` after failure/cancel. DOM order and labels are unchanged by the fix (attribute-only diff). |
| 5 | Reveal reference guard is a rail-row chip (amber dot + "No photo reference" + Place) calling `requestPhotoReference`, and the header Close works and never starts the drag | ✓ VERIFIED | `PhysicsPaintPlayScriptCards.tsx` ref chip renders amber dot, label and Place with `onClick={() => props.playScript.requestPhotoReference()}` (line 225); `PhysicsPaintPlayScriptDialog.tsx:278-290` Close has `aria-label="Close"`, `onPointerDown` `stopPropagation()`, `onClick` → `playScript.cancel()`; tests for the chip and Close pass. |
| 6 | Only the four creation views keep the fixed 660 surface; loop edit, source edit, every stack kind and regeneration carry the static `-surface-tall` modifier (`loopEdit \|\| sourceEdit \|\| stacking`), preserving copy, laws and action labels with no empty tab strip, no clipping and no scroll container | ✓ VERIFIED | `PhysicsPaintPlayScriptDialog.tsx:250` is a render-time class decision from the mode flags (no measurement/observer); CSS 2331-2334 `height:auto`; tests assert the modifier for loop edit, source edit, stack, stackReveal, stackRevealRun and regenerate, and its absence for all four creation views; preserved-mode suites pass (546 tests). |
| 7 | No forbidden code changes; every stable id and every accessibility contract (roles, roving tabindex, `aria-describedby`, progress labels, Escape/Enter, focus return, keyboard containment) is preserved | ✓ VERIFIED | After `0d19a64ac`, `Dialog.tsx:446` is `<span class="physics-paint-play-script-progress-track">` with no `aria-hidden`, and the only `<progress aria-label={progressLabel}>` elements (448, 450) sit in an ancestor chain — track (446) → `-progress-line` (443) → `-footer` (442) → surface (248) → dialog root (221) — none of which carries `aria-hidden`, `inert` or `hidden`. The remaining `aria-hidden` attributes in the dialog are decorative only: header badge (261) and Play/X/Tab/Info/Play icons (262, 287, 307, 463, 545). CSS keeps the track exposed (`display:inline-flex`, 3343-3351) and has no `display:none`/`visibility`/`opacity` rule on the footer, progress line or track. Tests now pin exposure: idle asserts `track.props['aria-hidden']` is `undefined` (486); generation asserts the `<progress>` parent has no `aria-hidden` (901). The other contracts are untouched: `git diff --stat 50fb2c975..HEAD` is the one attribute removal plus two test assertions; ids, roving tabindex (`Cards.tsx:155`), `aria-describedby` (`Dialog.tsx:461`, `Cards.tsx:464/475`), Escape/Enter (`Dialog.tsx:225-240`), focus return (`Dialog.tsx:109-117`) and keyboard containment (151 tests) all remain. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Live UAT Watch Items (not status gates)

These are the user's live visual step, not reasons for the automated verdict:

- Pixel fidelity to the four approved HTML designs at 700 × 660 (density, truncation, tooltip anchoring).
- Tooltip on hover and on keyboard focus in the real Studio; Escape/Enter and focus-return in the preserved modes.
- The fixed 150px Timing hero (`CSS:2982`) has no overflow guard; a visible Frames/Cycle validation message adds a line beyond the card's 150px budget. If it paints over the Motion section in the live Studio, that is a follow-up defect — static inspection cannot settle it without rendering.

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | Fixed shell: header+Close, folder tabs, tab-owned panel, footer track/info/status/actions, status-slot failure, static `-surface-tall`, ref-chip wiring | ✓ VERIFIED | 554 lines; composes all cards from `PhysicsPaintPlayScriptCards` (imports lines 18-27); consumer chain `MemoizedPhysicsPaintPlayScriptDialog.ts` → `PhysicsPaintStudioView.tsx:471` intact; progress track at 446 no longer hides its `<progress>`. |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx` | Restyled cards: RailType subheader + chip, timing heroes, 2×2 motion, compact global cards, swatch+hex Color, compact Source cycle | ✓ VERIFIED | 709 lines; 92 dialog tests resolve the expected card selectors; no markup re-inlined in the dialog; unchanged by the fix. |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Rewritten scoped `-play-script-*` block: shell/panel tokens, tabs, tall modifier, hero/slim stepper skins, compact cards, footer + tooltip | ✓ VERIFIED | Loaded at `PhysicsPaintStudio.tsx:291`; block 2280-3560; all new selectors scoped under `.physics-paint-play-script-*` or dialog-scoped `.slider-stepper-*` / `.physics-paint-script-switch-*`; no `@import`/`@font-face`/global rules; unchanged by the fix. |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | Structural tests updated to the new composition, behavioral assertions preserved | ✓ VERIFIED | 2300+ lines, 92/92 pass; line 486 asserts the idle track has no `aria-hidden`; line 901 asserts the generation `<progress>` parent has no `aria-hidden`. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Dialog/panel/card markup | `.physics-paint-play-script-*` CSS | Class names | WIRED | Every added rule in the block is dialog-scoped; no rule reaches another Studio surface. |
| SliderStepper `class` prop | Dialog-scoped `.slider-stepper-*` overrides | `-hero-stepper` / `-compact-stepper` classes + `!important` | WIRED | `Cards.tsx` passes both classes; overrides at CSS 3155-3295; `SliderStepper.tsx` untouched (absent from the diff). |
| `summaryRequested` / `summaryEffective` derivation | Tooltip rows | `Dialog.tsx:453-478` | WIRED | Values render in the tooltip with display prefixes stripped (test asserts `['25f (5f × 5)', '18f']`); no `-summary-bar` remains anywhere. |
| `revealReferencePlaced` + `requestPhotoReference()` | Rail-row chip | `Cards.tsx:225` (chip) / `Dialog.tsx:416` (preserved notice) | WIRED | Chip renders only from the existing guard state; no controller change. |
| Stable ids and focus refs | Keyboard/focus-return contract | `Cards.tsx` ids; `Dialog.tsx:109-117` focus calls | WIRED | All listed ids present; keyboard containment suite 151/151 passes. |
| Card implementations | `PhysicsPaintPlayScriptCards.tsx` only | Dialog imports all 13 cards | WIRED | No card markup re-inlined in the dialog. |
| Mode flags (`loopEdit \|\| sourceEdit \|\| stacking`) | Single `-surface-tall` modifier | Render-time class on the surface (`Dialog.tsx:250`) | WIRED | Static decision, no measurement; tests assert class presence/absence per mode. |
| `playScript.error` | Footer status slot | `Dialog.tsx:479-485` | WIRED | `role="alert"` with full text in `title`; tests assert it is inside `-progress-line`, never a direct surface child. |
| `progressValue` / `progressBusy` / `progressLabel` | `<progress>` in the footer | `Dialog.tsx:179-184` → `Dialog.tsx:446-452` | WIRED / EXPOSED | Real `<progress value/max>` (or indeterminate) with `aria-label`; no `aria-hidden` ancestor after `0d19a64ac`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Footer tooltip | `readoutRequested` / `readoutEffective` | `playScript` signals derived from `loopReadout` (stack readout preferred) | Yes — live controller derivation, prefixes stripped for display | ✓ FLOWING |
| Footer info control presence | `readoutRequested` | Same controller derivation | Yes — null hides the control (test pins it) | ✓ FLOWING |
| Footer progress | `progressValue` / `progressBusy` | Controller status signals | Yes — real `<progress value/max>` while generating; indeterminate while preparing; none idle/failed/cancelled | ✓ FLOWING |
| Footer status | `progressLabel` | `playScript.status.value ?? completed/total` | Yes — live status text, else Ready | ✓ FLOWING |
| Footer failure | `playScript.error.value` | Controller error signal | Yes — real message in `role="alert"` + `title` | ✓ FLOWING |
| Rail-row ref chip | `revealReferencePlaced` / `revealReferencePath` | Controller reveal state | Yes — chip only when no reference is placed | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Dialog composition, generation states, preserved modes | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` (inside the 3-file run below) | 92 tests passed | ✓ PASS |
| Studio integration + keyboard containment | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/physicsPaintStudioKeyboard.test.ts` (same run) | 303 + 151 passed | ✓ PASS |
| Combined focused suites (independent re-run at `0d19a64ac`) | `pnpm --filter efx-motion-editor exec vitest run <dialog>.test.ts <Studio>.test.ts <keyboard>.test.ts` | 3 files / 546 tests passed, exit 0 | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | `tsc --noEmit` exit 0 | ✓ PASS |
| Scope guard | `git diff --stat 04893293d..HEAD` / `git diff --stat 50fb2c975..HEAD` | Only the 4 declared files in the phase; only the dialog + its test changed by the fix (5 insertions, 3 deletions) | ✓ PASS |
| Progress accessibility parity vs base after fix | Static ancestor walk of `Dialog.tsx:446-452`; `grep aria-hidden Dialog.tsx`; CSS read of the track/footer rules; test assertions at 486 and 901 | Base exposed the same `<progress>` directly; HEAD now exposes it inside an `aria-hidden`-free track chain; the only remaining `aria-hidden` attributes are decorative icons/header badge; no CSS hides the track; tests pin exposure; 546 tests + typecheck green | ✓ PASS — prior blocker closed |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No probes declared in PLAN/SUMMARY and this is not a migration/tooling phase; no `scripts/*/tests/probe-*.sh` applies | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261101-CD5 | `261101-cd5-PLAN.md` frontmatter (`requirements: [QUICK-261101-CD5]`; quick task — no `.planning/REQUIREMENTS.md` entry expected) | Redesign the Run Script dialog to the approved 700 × 660 design without behavior changes, preserving accessibility | ✓ SATISFIED | All seven truths verified; the previously failing accessibility clause is closed by `0d19a64ac` and independently re-checked. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | 446 | ~~`aria-hidden="true"` on the progress-track wrapper~~ | Resolved | Removed in `0d19a64ac`; the `<progress>` chain is now exposed. |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | 901 | Generation test asserts only the `<progress>` immediate parent for `aria-hidden`, not the whole ancestor chain | ℹ️ Info | The assertion covers the regression site (the track wrapper); static inspection confirms the full chain (track → progress-line → footer → surface → dialog root) carries no `aria-hidden`/`inert`/`hidden`. Not a blocker. |
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, no stub returns, no `console.log`, no hardcoded-empty props in the four modified files | ℹ️ Info | `return null` at `Dialog.tsx:173` is the intentional hidden-confirmation guard, not a stub. |

### Human Verification Required

None for the automated verdict. The truth-7 defect was statically provable and is now closed; no `human_needed` routing applies. Live visual UAT remains the user's separate step — the watch items above are advisory and explicitly not a status gate.

### Gaps Summary

The prior verification's single gap is closed. `0d19a64ac` removes `aria-hidden="true"` from the persistent `-progress-track` wrapper (`PhysicsPaintPlayScriptDialog.tsx:446`), so the only real `<progress aria-label={progressLabel}>` (448, 450) is no longer inside an `aria-hidden` subtree. Static inspection of the full ancestor chain — track → progress line → footer → surface → dialog root — finds no `aria-hidden`, `inert` or `hidden`, and the only remaining `aria-hidden` attributes in the dialog are decorative badges/icons that are not ancestors of the progressbar. CSS keeps the track rendered (`display:inline-flex`) and defines no hiding rule on the footer, progress line or track.

The two test assertions were updated in the same commit: the idle test now asserts `track.props['aria-hidden']` is `undefined` (line 486), and the generation test asserts the `<progress>` parent has no `aria-hidden` (line 901). The post-verification diff (`50fb2c975..HEAD`) is exactly these two files — one attribute removal plus two test assertions — so the CSS, Cards and dialog composition verified previously are byte-identical and truths 1-6 are unaffected. An independent re-run at HEAD produced 546/546 passing tests across the three focused suites with a clean `tsc --noEmit`, and the full phase diff remains limited to the four declared files. All seven must-haves now verify.

---

_Verified: 2026-11-01T08:48:50Z_
_Verifier: Claude (gsd-verifier)_
