# Phase 58 — UI Review

**Audited:** 2026-11-05
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists); 58-CONTEXT locked decisions (D-01..D-17) used as the de-facto design contract
**Screenshots:** Not captured — no dev server answered on localhost:3000, 5173 or 8080; the server was not started (project instruction), so this is a code/CSS-only audit. Visual findings are derived from JSX and CSS geometry, not pixels.
**Interaction captures:** off (`workflow.ui_interaction_capture` false)

---

## Verdict

One BLOCKER: the reduced Cycle dialog's root key handler hijacks Enter/Escape from the dialog's own controls, so keyboard activation of the Infinity switch creates the rail instead of toggling, and Escape inside the Cycle field closes the whole dialog. The mouse flow (select rail → inspector → Edit Rail / double-click → Create Cycle or Update Rail → commit) is intact and test-pinned, and the previous review's 700×660 dead-space finding has been fixed by the 420px compact surface. Remaining WARNINGs are silent refusal feedback, inert footer actions during `committing`, the missing Standard classification affordance, and open-gesture discoverability.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Locked labels and reasons are verbatim and specific; the open gesture is absent from rail copy and refusal copy never reaches the screen |
| 2. Visuals | 3/4 | Compact 420px dialog now has a clear focal point; Standard has no distinct visual token (`.rail-kind-standard` styles only ghost bands) |
| 3. Color | 3/4 | Accent discipline holds, but the inspector primary is a second hardcoded blue and the disabled Edit Rail label sits near 2.9:1 contrast |
| 4. Typography | 3/4 | Consistent scale, no new sizes; the marquee action and fact labels sit at the 10px legibility floor |
| 5. Spacing | 3/4 | Clean 4/6/8/10/12/14/16/20 rhythm; the reduced 420px surface carries full-shell double padding |
| 6. Experience Design | 2/4 | Keyboard Enter/Escape hijack (BLOCKER), silent refusals, and footer controls that look alive but are inert during `committing` |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **Stop the dialog root from hijacking Enter/Escape from its own controls** — `PhysicsPaintPlayScriptDialog.tsx:297-315` handles every bubbling Enter/Escape without checking `event.target`. Enter on the Infinity switch (`PhysicsPaintPlayScriptCards.tsx:80-94`, no keydown guard) calls `confirm()` and `preventDefault()` suppresses the switch's native activation, so the conversion is committed instead of toggled; Enter on Cancel/Close commits instead of cancelling; Escape inside the Cycle input (`NumericStepper.tsx:462-470`, no stopPropagation) closes the entire dialog instead of reverting the field. Impact: keyboard users cannot operate the mandated Infinity control and can perform an unintended document write. Fix: only treat Enter/Escape as dialog-level actions when the event target is the dialog surface itself or the Cycle field's commit path; otherwise stop propagation in `NumericStepper` and add a keydown guard to `dialogSwitch` so Space/Enter activate the control.
2. **Make refusals and in-flight states honest** — Edit Rail calls `onOpenKeyRailEdit` with `void` (`PhysicsPaintScriptsPanel.tsx:153`, prop typed `Promise<unknown> | void` at `:28`), so a refused open is a silent dead click; controller refusals go through `rejectLoopOp` which resets `phase/status/error` to idle/null (`physicsPaintRotoPlayScriptController.ts:1690-1695`), so a refused Create Cycle leaves the footer reading "Ready" (`PhysicsPaintPlayScriptDialog.tsx:538`). During `committing`, `canCancel` is false (`controller.ts:831`), so Cancel reverts to "Cancel" and no-ops (`:3652-3666`), the primary renders enabled but `loopOpGuard()` silently refuses (`:1682-1688`), and the Cycle fields re-enable because `busy` is `canCancel` (`dialog.tsx:240`). Fix: surface refusal text in the footer as `role="alert"` (do not null `error` in `rejectKeyRailCycle`), derive a real busy flag from `phase`, disable/relabel footer buttons while `committing`, and disable Edit Rail while the controller is busy.
3. **Give Standard a visible classification and the open gesture discoverability** — D-10 promises "the existing gray rail pill", but the real loop rail only gets the inert `rail-kind-standard` class (`PhysicsPaintLoopClipRail.tsx:333`); CSS styles that class only on push-hover/push-ghost/rail-set-ghost (`physicsPaintStudio.css:4531,4579,4627`), a test pins the absence of a real-target rule (`PhysicsPaintLoopClipRail.test.tsx:1769`), and the actual rail color is the olive `data-rail-type="standard"` palette (`CSS:5227-5233`; `timelineRailDesign.ts:47-51`) shared with Key Rails. Separately, `buildSelectedKeyRailCopy` (`physicsPaintKeyRailPresentation.ts:90-103`) never mentions Enter or double-click even though it is the rail's `aria-label` (`PhysicsPaintKeyRail.tsx:343`). Fix: render a visible Standard pill/token on the converted rail (or a distinct standard treatment), and append "Press Enter or double-click to edit the cycle." to the selected-rail copy.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **Positive** — No generic "OK/Submit" labels in the phase surfaces. Specific copy throughout: "Edit Rail — F10–F14" and "Close Rail inspector — F10–F14" (`PhysicsPaintScriptsPanel.tsx:153-154`), "Create Cycle" / "Update Rail" (`PhysicsPaintPlayScriptDialog.tsx:595-599`), the locked disabled reason "Select a single rail to edit it." (`physicsPaintKeyRailPresentation.ts:111`), and the verbatim D-16 rejection "Linked source-cycle keys move only as a rigid group. Select the whole cycle to drag it." (`physicsPaintRotoPhysicalResolver.ts:938`). The new Group-owned delete refusal copy is published through the status capsule (`useRotoTimelineActions.ts:2116-2121`).
- **WARNING — the open gesture is not in the rail's copy.** `buildSelectedKeyRailCopy` returns identity + "Drag to move." + delete copy only (`physicsPaintKeyRailPresentation.ts:90-103`). Neither double-click (`PhysicsPaintKeyRail.tsx:252-295`) nor Enter (`:297-315`) is mentioned, although the same string is the button's accessible name (`:343`). Discoverability depends on selecting the rail and noticing the Scripts pane takeover.
- **WARNING — refusal copy is written but never displayed.** "This Key Rail no longer exists." (`PhysicsPaintStudio.tsx:4834-4836`), "Finish the current Roto operation." (`physicsPaintRotoPlayScriptController.ts:1674-1679`), and the conversion refusals (`:1764-1805`) are returned or logged; the panel discards the Promise (`PhysicsPaintScriptsPanel.tsx:153`), and `rejectLoopOp` nulls `error`/`status` (`controller.ts:1690-1695`) so the footer falls back to "Ready" (`dialog.tsx:538`).
- **Minor — "Edit Rail" title vs "Create Cycle" primary.** On a first conversion the header says "Edit Rail" (`dialog.tsx:330-333`) while the action creates a new cycle (`:595-597`). D-06 locks the button label, but the header never acknowledges the "create" intent.
- **Minor — "Cycle" carries two meanings in one modal.** The footer status reports the derived span as "Cycle {N}f" (`controller.ts:1800`) while the only numeric field labeled "Cycle" edits the repeat count (`Cards.tsx:575-584`). With every other field hidden by the reduced form, there is no helper text explaining that the cycle length comes from the Key Rail span and only the repeat count is editable.

### Pillar 2: Visuals (3/4)

- **Positive** — The reduced Standard surface is now content-sized: 420px wide and `height: auto` (`physicsPaintStudio.css:2488-2491`), the single Cycle field spans the card (`:3192-3196`), and the 150px timing hero is removed (`:3198-3200`). The previous review's ~376px of dead vertical space is gone. The inspector keeps a clear hierarchy: one labeled primary Edit Rail, a 24px labeled Close, then three fact rows in a 72px/8px grid (`:2301-2304`, `:2311-2318`).
- **WARNING — Standard has no distinct visual token on the rail.** The class is applied (`PhysicsPaintLoopClipRail.tsx:333`; `PhysicsPaintTrackRow.tsx:837`; `PhysicsPaintWorkflowStrip.tsx:5099-5105`) but styled only on ghost/preview elements (`CSS:4531,4579,4627`), and a contract test pins that no real-rail rule exists (`PhysicsPaintLoopClipRail.test.tsx:1769`). The real rail renders through `data-rail-type="standard"` (`CSS:5227-5233`), the same olive family used by Key Rails (`PhysicsPaintKeyRail.tsx:344`), so the conversion produces no visible "this is now Standard" change. D-10's "existing gray rail pill" is not what the built UI renders.
- **Note** — CSS-derived; no screenshots available.

### Pillar 3: Color (3/4)

- **Positive** — Dark neutrals dominate and accent is reserved for primary actions: `--ps-accent: oklch(0.60 0.19 262)` (`CSS:2446`), primary button `:3753-3756`, focus ring `:3529-3533`. No new hardcoded colors were introduced in the phase's TSX; the only literal palette is the pre-existing `ORIGINAL_COLOR_DOTS` (`PhysicsPaintPlayScriptCards.tsx:52`). The 60/30/10 balance holds.
- **WARNING — two primary blues.** The inspector's Edit Rail primary uses hardcoded `rgba(45, 91, 227, 0.8/0.85)` (`CSS:2317`), while the dialog primary and focus ring use the `--ps-accent` oklch token. The two blues are visibly close but not the same hue, so the same "primary action" role has two definitions.
- **WARNING — low-contrast disabled primary.** The guarded disabled state is `color: #777e86` on `background: #34373a` (`CSS:2323-2328`), roughly 2.9:1. The button stays in the tab order via `aria-disabled`, and the reason exists only as sr-only text plus a hover tooltip (`PhysicsPaintScriptsPanel.tsx:487-520`).
- **Minor** — The new inspector's neutrals are raw hex (`#aeb5be`, `#eef1f4`, `CSS:2303-2304`) rather than `--ps-*` tokens, matching the surrounding legacy pattern but leaving the new surface token-blind.

### Pillar 4: Typography (3/4)

- **Positive** — No new type sizes were introduced; the inspector uses the established 10px label / 11px value pair (`CSS:2303-2304`), and the reduced surface reuses the dialog family: 10px uppercase Cycle label (`:3426-3432`), 12px stepper input (`:3451-3455`), 11.5px switch label (`:3246-3248`), 15px title (`:2532-2536`), 600/700 weights. No drift between the inspector and the existing loop inspector.
- **WARNING — the marquee surface sits at the legibility floor.** "Edit Rail" is 10px/700 (`CSS:4415-4417`), inspector fact labels are 10px, the numeric field label is 10px, and the only conversion feedback is the 10.5px status line (`CSS:3686-3692`). On the reduced modal this is the smallest text the user sees at the moment of a document write.
- **Minor** — The reduced surface's five sizes (10 / 10.5 / 11.5 / 12 / 15) exceed the abstract "more than four sizes" flag, and weights span 400-600-700. This is inherited from the shared shell rather than added by Phase 58, but it keeps the pillar below 4.

### Pillar 5: Spacing (3/4)

- **Positive** — The new surfaces reuse the established rhythm: 4/6/8/10/12/14/16/20. Inspector rows use a 72px label column plus 8px gap and 6px row gap (`CSS:2301-2304`); nav buttons are 24px (`:2315`); the compact card uses `height: auto` with 14px/16px padding (`:3131-3140`, `:3198-3200`). No arbitrary spacing values or new magic numbers were added; inline styles remain dynamic geometry/drag transforms only (`PhysicsPaintKeyRail.tsx:330-331`; `dialog.tsx:311`).
- **WARNING — double shell padding around the only card.** The reduced dialog keeps the full-shell workspace padding `12px 16px 16px` (`CSS:2579-2586`) plus content padding `14px 16px 16px` (`:2649-2658`), so in a 420px modal the single card is inset by ~32px per side and begins 26px below the header. The compact sizing fixed the vertical void but did not tune the inset for the smaller surface.
- **Minor** — The dense 6px inspector stack and the airy 26-32px reduced-dialog inset belong to the same feature; the contrast is noticeable when moving from the Scripts pane to the modal.

### Pillar 6: Experience Design (2/4)

- **BLOCKER — Enter/Escape are hijacked from the dialog's own controls.** The dialog root handles every bubbling keydown (`PhysicsPaintPlayScriptDialog.tsx:297-315`): Enter calls `confirm()` and `preventDefault()` whenever `!canCancel` and `!confirmBlocked`, without inspecting `event.target`; Escape calls `cancel()`. The Infinity switch is a plain button with no keydown guard (`PhysicsPaintPlayScriptCards.tsx:80-94`), so Enter on it fires the primary conversion and suppresses its own activation — it cannot be toggled with Enter, and a user attempting to do so commits the rail. Enter on Cancel (`dialog.tsx:565-572`) or the header Close (`:361-370`) likewise commits instead of cancelling. The Cycle input's own Enter/Escape handling does not stop propagation (`NumericStepper.tsx:462-470`), so Escape while editing the auto-focused Cycle field closes the entire dialog instead of reverting the field. Fix before shipping.
- **Positive** — Where the phase focused, coverage is strong: Enter and the primary share one `confirmBlocked` gate (`dialog.tsx:150-157`, `:302`, `:579`); the disabled Edit Rail has sr-only reason + tooltip; focus lands on the Cycle input on open and returns to the Edit Rail trigger on close (`dialog.tsx:169-184`); cancel writes nothing and keeps the frozen target for retry (`controller.ts:3652-3666`); conversion is one undo step.
- **WARNING — silent refusals.** See Top Fix 2. Edit Rail during another operation is a dead click (`ScriptsPanel.tsx:153`; `controller.ts:1674-1679`), and Create Cycle after the segment changes resets the footer to "Ready" with no message (`controller.ts:1690-1695`; `dialog.tsx:538`).
- **WARNING — footer controls are inert during `committing`.** `canCancel` covers only `preparing`/`rendering` (`controller.ts:831`), so during commit the Cancel button is labeled "Cancel" but no-ops (`:3652-3666`), the primary is rendered enabled but `loopOpGuard()` refuses (`:1682-1688`), and the Cycle controls re-enable because the card's `busy` is `canCancel` (`dialog.tsx:240`; `Cards.tsx:562-600`). The window reads as a frozen dialog.
- **WARNING — status changes are not announced.** The footer status span has no `role="status"` or `aria-live` (`dialog.tsx:536-542`); only errors get `role="alert"`. "Preparing Key Rail cycle…" and the commit status are silent to screen readers. The dialog surface also has no `aria-busy`; only the rail target does (`PhysicsPaintKeyRail.tsx:342`).
- **WARNING — the 220ms double-click window drops deliberate double-clicks.** `ROTO_KEY_RAIL_FAST_DOUBLE_CLICK_MS = 220` (`PhysicsPaintKeyRail.tsx:32`) with a timestamp-only detector (`:283-295`) is well below typical OS double-click settings; the sibling Loop Clip rail closes the 220–250ms dead zone with a pending single-click timer (`PhysicsPaintLoopClipRail.tsx:30-31`, `:266-301`), while the Key Rail deliberately has no pending timer. Enter and the inspector button are valid alternates, so this degrades rather than blocks.
- **Minor — mixed rail sets can hide the takeover.** The anchor rule only supplies a Key Rail when the first ordered set member is a Key Rail (`PhysicsPaintStudio.tsx:1795-1797`). A mixed set anchored on a loop clip shows no Key Rail inspector and therefore no disabled-with-reason explanation.
- **Minor — premature success wording.** The commit phase sets `status = "Cycle created · F..–F.. · N key(s)"` before the parent ack (`controller.ts:1865-1866`); on a rejected commit the user briefly sees success before the error replaces it.

---

## Minor Recommendations

1. Raise the double-click window and/or close the 220–250ms dead zone the way the Loop Clip rail does (`PhysicsPaintKeyRail.tsx:32`, `:283-295`; `PhysicsPaintLoopClipRail.tsx:266-301`).
2. Add "Press Enter or double-click to edit the cycle." to `buildSelectedKeyRailCopy` (`physicsPaintKeyRailPresentation.ts:90-103`).
3. Move the inspector primary and neutrals onto `--ps-accent` / `--ps-*` tokens (`CSS:2303-2304`, `:2317`).
4. Enforce an 11px floor for the labeled primary and inspector `dt` (`CSS:4415-4417`, `:2303`).
5. Make the footer status a polite live region and give the dialog surface `aria-busy` while `phase` is busy (`dialog.tsx:536-542`).
6. Rename the commit-phase status so it does not claim success before the ack (`controller.ts:1865-1866`).
7. Consider a non-premature "Creating cycle…" label and disable the Cycle fields from `phase`, not `canCancel` (`dialog.tsx:240`).
8. Add a visible reason line (not only a tooltip) when Edit Rail is disabled in a 2+ rail set (`ScriptsPanel.tsx:153`).

Registry audit: skipped — no `components.json` exists at the repo root or under `app/`, and no UI-SPEC third-party registry table exists.

---

## Files Audited

- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintTrackRow.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts`
- `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.ts`
- `app/src/components/physic-paint/view/timelineRailDesign.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts`
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (wiring: `:1153-1158`, `:1795-1797`, `:4829-4851`, `:4899-4905`, `:7156-7265`, `:11075`)
- `app/src/components/shared/NumericStepper.tsx`
- `app/src/components/physic-paint/physicsPaintStudio.css` (consumed selectors)
- `.planning/phases/58-rail-editing-regressions/58-CONTEXT.md`, `58-01..10-PLAN.md`, `58-01..10-SUMMARY.md`

---

## UI REVIEW COMPLETE

**Phase:** 58 - Rail editing regressions
**Overall Score:** 17/24
**Screenshots:** not captured (no dev server; code/CSS-only audit)
**Interaction captures:** off (`workflow.ui_interaction_capture` false)

### Pillar Summary
| Pillar | Score |
|--------|-------|
| Copywriting | 3/4 |
| Visuals | 3/4 |
| Color | 3/4 |
| Typography | 3/4 |
| Spacing | 3/4 |
| Experience Design | 2/4 |

### Top 3 Fixes
1. Stop the dialog root key handler from hijacking Enter/Escape from the Infinity switch, Cancel/Close, and the Cycle input (BLOCKER).
2. Surface refusal reasons and make footer/Edit Rail controls honest and disabled while the controller is busy or committing.
3. Give Standard a visible classification token and add the Enter/double-click gesture to the rail's copy.

### Recommendation Count
- Priority fixes: 3
- Minor recommendations: 8
