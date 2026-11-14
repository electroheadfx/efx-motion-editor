# Phase 62 — UI Review

**Audited:** 2026-11-14
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists for Phase 62)
**Screenshots:** Not captured (no dev server on ports 3000/5173/8080 — code-only audit)
**Interaction captures:** off (`workflow.ui_interaction_capture` is false)

**Evidence note:** Every finding below is code-derived from the shipped sources. The phase's seven native UAT rows (A–D entry/edit/undo, E–G loop occurrences) remain the human acceptance gate — especially for ghost-spine legibility over paint and entry-pending feel, which no static analysis can confirm.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Named, specific refusals and zero generic labels — but a curve-entry failure surfaces the Draft-base message, and one refusal falls back to a hint the user already satisfied |
| 2. Visuals | 3/4 | Deliberate three-plane hierarchy (slate ghost → cyan spine → amber/orange anchors) — ghost contrast over arbitrary paint is unverified and the decorative SVG lacks `aria-hidden` |
| 3. Color | 3/4 | Fully documented, test-pinned 7-literal overlay palette with accents confined to selection chrome — one inherited semantic collision (`#ef4444` red for informative "Mixed") |
| 4. Typography | 3/4 | Compliant scale (10/11/12px, weights 500/600, below the >4 sizes / >2 weights flag) — 10px control text is small for desktop at 1x |
| 5. Spacing | 3/4 | Consistent 4/6/8/10/12px literals, screen-constant SVG chrome, no arbitrary Tailwind values anywhere — the inherited 15px section gap sits off the 4px rhythm |
| 6. Experience Design | 3/4 | Strong state coverage (alert capsule, gate reasons, canvas veil during bake, silent cancelled undo, exit restore) — the entry await has no pending indicator and a fit-null entry fails silently |

**Overall: 18/24**

**Classification:** No BLOCKERs. All findings below are WARNING-level (pillars score 3/4; no defect breaks task completion).

---

## Top 3 Priority Fixes

1. **A curve-entry failure shows the Draft message** — Pressing the spline-pointer on a painted stroke whose durable-base arm fails publishes `DRAFT_ARM_REFUSAL_MESSAGE` ("Could not prepare this frame for Draft — the watercolor base could not be recovered."). The user never touched Draft and will look in the wrong place. Fix: add a fixed entry-specific constant beside the Draft one (`PhysicsPaintStudio.tsx:380`) and publish it from the failure branch at `PhysicsPaintStudio.tsx:10323-10329` instead of restating the Draft copy.

2. **A fit-null entry is a silent dead click** — `PhysicsPaintStudio.tsx:10330-10331`: `const session = beginPaintedCurveSession(stroke); if (session === null) return false;` publishes no message, no status, no visual change. Fix: publish a fixed refusal (message + `'error'` status, same capsule channel) before returning false, e.g. "Could not open path editing — this stroke could not be fitted."

3. **Entry has no pending state and stays enabled during the await** — `PhysicsPaintStudio.tsx:10322` awaits `armDraftBase()` with no visible indicator, and `PhysicsPaintStrokeSettingsDialog.tsx:1005-1007` fires `void bundle?.enterPaintedCurve?.([target])` without disabling the 22×22 button. Single-flight makes a double press benign, but the click reads as dead for the duration of base recovery. Fix: a local `isEntering` signal in the dialog leaf (stable signal via `useRef`, compare-then-write per `efx-preact-reactivity`), set before the call and cleared in `.finally`, driving `disabled={!pathEditGate.enabled || isEntering.value}` and `aria-busy`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING — wrong-cause error copy at the entry seam.** `PhysicsPaintStudio.tsx:10323-10329` republishes `DRAFT_ARM_REFUSAL_MESSAGE` (defined at `:380`) when the user pressed Edit path, not Draft. The message names Draft twice for an action the user never took. This is the single most confusing string in the phase.
- **WARNING — misleading fallback disabled reason.** An anchors array that is present but unreadable resolves `{ kind: 'refused', reason: null }` (`strokeSettingsModel.ts:878-879`), so `resolvePathEditGate` falls back to `PATH_EDIT_SINGLE_DISABLED_REASON` = "Edit path — select one vector stroke" (`strokeSettingsModel.ts:961`, `:796`) while exactly one stroke IS selected. Rare (corrupt anchor array) but the tooltip asks for something already done.
- Strong: every other refusal is fixed, specific, and non-interpolated — `PATH_EDIT_LIFT_DISABLED_REASON` "an eraser stroke cannot be edited" (`:806`), `PATH_EDIT_DEGENERATE_DISABLED_REASON` "this stroke has too few points to edit" (`:812-813`), `VECTOR_PATH_REJECTION_MESSAGE` "the stroke was left unchanged" (`PhysicsPaintStudio.tsx:383`). Each states what happened and the state left behind.
- Strong: zero generic labels in the audited surface — grep for `Submit|Click Here|OK|Cancel` returned nothing; no "No data"/"went wrong"/"try again" patterns.
- Empty states are specific: "No strokes on this frame." / "No strokes match this filter." (`PhysicsPaintStrokeSettingsDialog.tsx:1161`, `:1165`), plus "No stroke geometry available" (`:1411`) and "Select one stroke to change stack order" (`:1595`).
- Tooltips explain mechanisms: "Draft — on while wireframe is on. Turn wireframe off to re-render." and the OFF variant (`PhysicsPaintStrokeSettingsDialog.tsx:956-958`). The enabled Edit-path title is just the label "Edit path" (`strokeSettingsModel.ts:958`) — accurate, though it never hints that a painted stroke will be converted.
- Note: the two long fixed error lines (~88 and ~99 chars) can ellipsize in the status capsule (`physicsPaintStudio.css:4062-4070`), but the capsule's hover tooltip reveals the full text (`PhysicsPaintWorkflowStrip.tsx:1240`) — acceptable mitigation.

### Pillar 2: Visuals (3/4)

- **WARNING — ghost legibility is unverified.** `CURVE_GHOST_SPINE_COLOR = '#94a3b8'` at `strokeOpacity={0.45}`, 1px, dash `3 3` (`VectorPathOverlay.tsx:131`, `:1468-1478`) sits over arbitrary paint values. On light or mid-value washes a 45%-opacity slate 1px dashed line can disappear. This is the phase's headline affordance ("where the hand painted") and has no contrast guard; only UAT row 62-03-A can settle it.
- **WARNING — decorative SVG has no `aria-hidden`.** `VectorPathOverlay.tsx:1454-1462`: the overlay `<svg>` is pure display chrome (`pointerEvents: 'none'`) but is exposed to assistive tech as an unnamed graphic. Add `aria-hidden="true"` to the svg element.
- Strong hierarchy: three deliberate planes — dashed slate ghost first (`:1468-1478`), then per-path envelope fill and masked edge, then skeleton spine (`SPINE_STROKE_PX = 1.5` at `:680-683`), rungs, anchors, selection rings, handles (`:780-850`). The selected spine alone takes the cyan accent `#38bdf8` (`:111`); unselected paths use the two-pass dark/white outline pair (`:112-113`), which preserves legibility over any paint.
- Strong affordance differentiation: `circle` anchors for auto/spline vs `rect` anchors for owned bezier controls (amber `#f59e0b` at `:115`), selected anchors get a three-layer orange glow/halo/ring at `#f97316` (`:121`). Handles draw only for `curveMode !== 'spline'` and `kind === 'bezier'` (`:875-890`), so the chrome self-describes the mode.
- Every icon-only control in the audited surface carries `aria-label` + `title`: Edit path (`PhysicsPaintStrokeSettingsDialog.tsx:985-1011`), Preview stroke size (`:1013+`), Delete selected strokes (`:906-907`), Close (`:920-934`).
- Chrome stroke widths are all `vectorEffect="non-scaling-stroke"` (39 occurrences including the ghost at `:1477`), so screen-constant weight survives canvas scaling — no smeared 1px ghost at high zoom.

### Pillar 3: Color (3/4)

- **WARNING — semantic color collision (inherited).** `MIXED_CAPTION_STYLE` paints the informative "Mixed" caption `#ef4444` (`PhysicsPaintStrokeSettingsDialog.tsx:267-271`) — the same red the app uses for errors and the studio's error capsule. In a settings sheet where red also means failure, an informational readout in error red mis-signals.
- The overlay palette is exactly seven literals, each commented with its provenance and role (`VectorPathOverlay.tsx:110-131`): selected cyan `#38bdf8`, outline dark `#111111`, outline light `#ffffff`, owned-control amber `#f59e0b`, selected-anchor orange `#f97316`, ghost slate `#94a3b8`, plus the shared handle opacity `0.6`. The 61-22 palette pin was retargeted from five to six literals with the ghost documented as the only addition — no ad-hoc colors.
- Accent distribution respects 60/30/10 for an editor canvas: dark neutral chrome dominates, paint occupies the canvas, and accents appear only while a path edit/selection exists. No `text-primary`/`bg-primary`/`border-primary` class usage in the surface (the single `--sidebar-text-primary` hit is a CSS variable read at `PhysicsPaintStrokeSettingsDialog.tsx:234`, not an accent).
- Pressed state on the Edit-path button reuses the shipped preview-toggle blue (`#2d5be3`, `physicsPaintStudio.css:6369-6378`) — consistent with the "view preference" family it now belongs to.
- No hardcoded color was introduced outside the documented blocks; the dialog's 12 literals are inherited chrome (borders, surfaces, focus ring `#5a87ff`).

### Pillar 4: Typography (3/4)

- **WARNING — 10px control text is small.** Seven inline styles sit at `fontSize: '10px'` (`PhysicsPaintStrokeSettingsDialog.tsx:268`, `:277`, `:288`, `:307`, `:325`, `:347`, `:358`) for captions and segment controls, with row labels at 11px (`:254`) and the CSS Draft label at 12px (`physicsPaintStudio.css:6384-6389`). Three sizes and two weights (500 at `:255` labelled button, 600 at `:255`/`:278`/`:289`) is comfortably inside the >4-size / >2-weight flag, but 10px is below a comfortable desktop reading size at 100% zoom.
- Hierarchy is carried by weight and case rather than size: 11px/600 row labels, 10px mixed captions, 10px segment buttons with `aria-pressed` active treatment. Readable in context; consistent with the shipped sheet.
- The phase introduces no new type: the Edit-path control, Draft row, and status capsule all inherit existing styles. The SVG overlay contains zero text nodes.
- No font-family drift: the sheet inherits the app's chrome font; no inline font stacks were added.

### Pillar 5: Spacing (3/4)

- **WARNING — loose scale, one off-rhythm value.** Inline spacing literals are `gap: 6px` ×3, `gap: 4px`, `gap: 8px`, `gap: 10px`, `gap: 15px`, margins 4px ×2 (`PhysicsPaintStrokeSettingsDialog.tsx` constants at `:239-252` and the row styles). The 15px `SECTION_STYLE` gap (`:247-252`) is the only value off a 4px rhythm; 6px and 10px are half-steps. Consistent in use, but a 4/8/12/16 rhythm would read tighter.
- No arbitrary Tailwind bracket values exist in the audited surface (`[Npx]`/`[Nrem]` grep: zero) — this is a literal-px codebase, and the phase follows it.
- Structural spacing is deliberate: 320px surface (`:220`), `10px 12px 0` scroll padding (`:242`), `gap: 10px` between sections, 22×22 header buttons with a 6px radius (`physicsPaintStudio.css:6323-6344`), Draft row `6px 12px` with `gap: 8px` (`:6377-6382`).
- Overlay geometry is screen-constant and tight where it matters: 1px ghost, 1.5px spine, 2px selected spine, 1.5/4/8px selection rings, all under `non-scaling-stroke` — no scale-dependent crowding.
- The phase adds no new spacing tokens; all new chrome (ghost, envelope ring) reuses the existing radii/pads.

### Pillar 6: Experience Design (3/4)

- **WARNING — no entry-pending feedback.** `await armDraftBase()` (`PhysicsPaintStudio.tsx:10322`) can take real time (durable-base recovery), while the dialog fires the call without disabling the button or showing activity (`PhysicsPaintStrokeSettingsDialog.tsx:1005-1007`). Single-flight prevents duplicate recoveries and the session/bracket writes are idempotent, so a double click is harmless — but it feels dead.
- **WARNING — silent failure terminal.** A null fit (`PhysicsPaintStudio.tsx:10330-10331`) exits with no message, no status, no retry hint. Every other failure route in the phase publishes fixed copy.
- Strong: the path-edit BAKE does have a pending indicator — the canvas veil via `vectorPathSession.setPathEditRebakeActive(true)` (`:10383-10390`), with the apply pill standing down while it is up (`:10377-10379`). The distinction is entry (no indicator) vs bake (veil), not a blanket omission.
- Strong error channel: `role={isError ? 'alert' : 'status'}` + `aria-live="polite"` + warning icon on the capsule (`PhysicsPaintWorkflowStrip.tsx:1218-1240`), error styling at `physicsPaintStudio.css:4058`, full text in the hover tooltip.
- Strong disabled/empty coverage: the Edit-path gate resolves `enabled`/`title`/`pressed` in one place with named reasons (`strokeSettingsModel.ts:956-962`); Draft is disabled while wireframe owns the route out (`PhysicsPaintStrokeSettingsDialog.tsx:963`); the list and geometry blocks have specific empty copy (`:1161`, `:1165`, `:1411`, `:1595`).
- Strong destructive/undo coverage: anchor Delete/Backspace requires no confirmation but is undoable, and this phase hardened that path — mid-bake undo cancels the token, awaits the exact settle, and replays the exact `editId` with one reanchor retry (`PhysicsPaintStudio.tsx:6366-6401`); a cancelled bake publishes nothing (`:10424-10433`); the deferred settle is awaited before the shipped undo (D-14). Redo is untouched.
- Strong exit semantics: Escape leaves the curve session without a write, and the ONE `registerPathEditExitHook` registration (`:11499-11515`) makes every shipped exit restore the user's pre-entry wireframe/Draft via `endCurveBracket` (`vectorPathCurveBracket.ts:179-198`).
- Focus handling: 66 `focus-visible` rules exist in the studio stylesheet, including the header buttons used by the entry control (`physicsPaintStudio.css:6332-6338`).

---

## Files Audited

- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` (full)
- `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` (full)
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` (full)
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` (path-edit gate + eligibility, `:793-989`)
- `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` (full)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (phase-62 seams: `:380-383`, `:5400-5436`, `:6366-6401`, `:10296-10485`, `:11499-11515`, `:12094`)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` (status capsule `:1218-1240`)
- `app/src/components/physic-paint/physicsPaintStudio.css` (`:4032-4095` capsule, `:6323-6414` stroke-settings strip)
- `.planning/phases/62-painted-stroke-curve-editing/62-CONTEXT.md`
- `.planning/phases/62-painted-stroke-curve-editing/62-0{1..5}-PLAN.md`
- `.planning/phases/62-painted-stroke-curve-editing/62-0{1..5}-SUMMARY.md`
- `CLAUDE.md`
- `.claude/skills/efx-preact-reactivity/SKILL.md`

Registry audit: skipped — no `components.json` in `app/` or repo root (shadcn not initialized).

## Minor Recommendations (beyond top 3)

1. Disambiguate the unreadable-anchors refusal from the plain single-selection reason (`strokeSettingsModel.ts:878-879` + `:961`) with a dedicated fixed line.
2. Add `aria-hidden="true"` to the overlay `<svg>` (`VectorPathOverlay.tsx:1454`).
3. Revisit the red "Mixed" caption (`PhysicsPaintStrokeSettingsDialog.tsx:267-271`) — informational mixed values should read neutral, not error red.
4. Pin ghost-spine contrast in UAT row 62-03-A against a light wash, or add a subtle dark under-stroke to the ghost.
5. Consider revealing the full refused-copy line without hover when the capsule truncates (~99-char messages, `physicsPaintStudio.css:4062-4070`).
