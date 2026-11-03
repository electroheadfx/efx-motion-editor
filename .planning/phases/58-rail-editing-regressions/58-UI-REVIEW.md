# Phase 58 — UI Review

**Audited:** 2026-11-03
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md exists); 58-CONTEXT locked decisions (D-01..D-17) used as the de-facto design contract
**Screenshots:** Not captured — no dev server answered on localhost:3000, 5173 or 8080; audit is code/CSS-only and the server was not started (project instruction). Visual findings below are derived from JSX + CSS geometry, not pixels.
**Interaction captures:** off (`workflow.ui_interaction_capture` false)

---

## Verdict

No BLOCKERs: no pillar scores 1 and the normal flow (select rail → Edit Rail → Create Cycle → commit, or Cancel with zero writes) is intact and test-pinned. Five WARNING-class defects remain, concentrated in the visual composition of the reduced Cycle dialog and in silent feedback for refused/failed actions.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Labels and disabled reasons are specific; the new open gesture is absent from rail copy and refusal copy is written but never shown |
| 2. Visuals | 2/4 | The reduced 700×660 dialog holds a single 150px card: ~376px of dead vertical space and ~478px dead horizontal space |
| 3. Color | 3/4 | Accent correctly reserved for the primary action, but two accent definitions coexist (oklch token vs hardcoded rgba) |
| 4. Typography | 3/4 | Consistent 10–11px scale with no drift, but all new inspector/button labels sit at 10px |
| 5. Spacing | 3/4 | Clean 4/6/8/12/16/20 rhythm; the fixed shell does not scale down to the reduced form |
| 6. Experience Design | 2/4 | Enter/click parity and cancellation are solid; refusals are silent and footer actions are inert during `committing` |

**Overall: 16/24**

---

## Top 3 Priority Fixes

1. **Rebalance the reduced Cycle dialog** — The phase's flagship new surface is a fixed 700×660 shell (`physicsPaintStudio.css:2339-2345`, header 48px at `:2362-2370`, footer 56px at `:3347-3355`) whose body is one 150px card (`:2999-3004`) with a single 156px field (`:3053-3056`). That leaves roughly 376px empty below and 478px empty beside the only control, with no card title (`PhysicsPaintPlayScriptDialog.tsx:145`, `PhysicsPaintPlayScriptCards.tsx:557-568`). Impact: the main new modal reads as unfinished. Fix: allow `surfaceTall` (or a dedicated ~320px reduced height) for `reducedForm` and center the Cycle+Infinity column, optionally with a compact "Cycle" card title.

2. **Surface refusal reasons instead of dropping them** — `handleOpenRotoKeyRailCycleEdit` returns `{ ok: false, reason }` (`PhysicsPaintStudio.tsx:4818`), the controller returns guard/refusal reasons (`physicsPaintRotoPlayScriptController.ts:1673-1694`, `:1810-1814`), and both entry points discard them (`PhysicsPaintScriptsPanel.tsx:153` uses `void onOpenKeyRailEdit?.(...)`; the KeyRail prop is typed `=> void` at `PhysicsPaintKeyRail.tsx:283`). Worse, `rejectLoopOp` sets `error.value = null` and only logs (`controller.ts:1689-1694`), so a refused Create Cycle leaves the footer on "Ready" (`PhysicsPaintPlayScriptDialog.tsx:530`). Impact: clicking Edit Rail during another operation, or Create Cycle after the segment changed, does nothing with no explanation. Fix: consume the Promise result and render it as `role="status"`/`role="alert"` in the Scripts pane or dialog, and set `error.value = reason` in `rejectKeyRailCycle`; disable Edit Rail while the controller reports busy.

3. **Make footer actions honest during `committing`** — Cancel is always enabled (`PhysicsPaintPlayScriptDialog.tsx:555-561`) but `cancel()` no-ops for any busy phase when `canCancel` is false (`controller.ts:3630-3648`; `canCancel` covers only `preparing`/`rendering`, `:830`), and the primary is rendered enabled because `confirmBlocked` is false (`dialog.tsx:575-591`) while `confirmKeyRailCycle` silently refuses via `loopOpGuard()` (`controller.ts:1825`). Impact: for the duration of the commit await, both footer controls look clickable but do nothing — it reads as a frozen dialog. Fix: derive a busy flag from `phase` in the dialog, disable both footer buttons (or label "Committing…"), and add `aria-busy` to the dialog surface.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **Positive** — No generic "OK/Submit" in the new surfaces. Specific labels throughout: "Edit Rail — F10–F14", "Close Rail inspector — F10–F14" (`PhysicsPaintScriptsPanel.tsx:153-154`), "Create Cycle" / "Update Rail" (`PhysicsPaintPlayScriptDialog.tsx:582-587`), and the locked disabled reason `Select a single rail to edit it.` (`physicsPaintKeyRailPresentation.ts:111`).
- **WARNING — open gesture is not in the rail's copy.** `buildSelectedKeyRailCopy` returns identity + "Drag to move." + delete copy only (`physicsPaintKeyRailPresentation.ts:90-103`). Neither Enter nor double-click (`PhysicsPaintKeyRail.tsx:272-284`, `:299-306`) is mentioned, even though the same string is the rail's `aria-label` (`KeyRail.tsx:329`). Discoverability depends on the Scripts pane appearing after selection.
- **WARNING — refusal copy is dead on arrival.** "This Key Rail no longer exists." (`PhysicsPaintStudio.tsx:4818`), "Finish the current Roto operation." (`controller.ts:1673-1679`), and the conversion refusal sentences (`:1770-1781`, `:1810-1814`) are returned or logged but never rendered; consumers discard them and `rejectLoopOp` nulls `error` (`:1689-1694`). The footer then shows the generic "Ready" filler (`dialog.tsx:530`).
- **Minor** — "Ready" is the only text shown in refusal states, which actively implies the action succeeded/finished.

### Pillar 2: Visuals (2/4)

- **Positive** — The inspector has a clear hierarchy: one labeled primary Edit Rail, an icon-only Close, then three fact rows in a 72px/8px grid (`physicsPaintStudio.css:2176-2179`; `PhysicsPaintScriptsPanel.tsx:152-161`). The created Standard clip renders as the established gray rail pill (`#9CA3AF`, hover `#D1D5DB`, selected `#f59e0b`; `physicsPaintStudio.css:4935-4957`), so the conversion is visually coherent with existing rails.
- **WARNING — reduced dialog composition.** 700×660 shell (`:2339-2345`), 48px header (`:2370`), 56px footer (`:3355`), 30px content padding (`:2517-2527`), one 150px card (`:2999-3004`) with one 156px field (`:3053-3056`) yields ~376px vertical and ~478px horizontal empty space. The reduced branch renders nothing else — no tabs, no group title (`PhysicsPaintPlayScriptDialog.tsx:354-380`). The single stepper/switch is a weak focal point in a mostly empty modal. This is contract-consistent (D-05 reduced form) but visually under-composed.
- **Note** — Findings are CSS-derived; screenshots were unavailable.

### Pillar 3: Color (3/4)

- **Positive** — Accent discipline is good: on each surface the blue appears only on the primary action (`CSS:2183`, `:2192`, `--ps-accent` at `:2321`); dark neutral panels dominate, so the 60/30/10 balance holds. No accent overuse (>10 elements) and no new hardcoded colors were added in TSX beyond the pre-existing `ORIGINAL_COLOR_DOTS` (`PhysicsPaintPlayScriptCards.tsx:51`).
- **WARNING — two accent definitions.** The inspector's primary uses hardcoded `rgba(45,91,227,.85)` (`CSS:2183`, `:2192`) while the dialog defines `--ps-accent: oklch(0.60 0.19 262)` (`:2321`). The new Edit Rail button adopts the hardcoded variant, so the inspector's blue and the dialog's primary blue are not the same token/hue.
- **Minor** — Inspector neutrals are raw hex (`#aeb5be`, `#eef1f4`, `CSS:2178-2179`) and error red `#ff8585` (`:2174`) rather than semantic tokens, which is the existing pattern but leaves the new surface token-blind.

### Pillar 4: Typography (3/4)

- **Positive** — Tight, drift-free scale across the new UI: 10px labels (`physics-paint-roto-key-icon-label`, weight 700, `CSS:4110-4115`; inspector `dt` 10px, `:2178`), 11px values (`dd`, `:2179`), 10.5px status (`:3490-3495`), 10px error (`:2174`). Three sizes, two weights — well inside the abstract "more than four sizes / two weights" warning threshold.
- **WARNING — the whole new surface sits at the legibility floor.** The marquee action "Edit Rail" is 10px/700, field labels are 10px, and the modal's only status text is 10.5px. On a 700px modal this is noticeably smaller than the body copy the user just left. Consider an 11px minimum for inspector labels and the primary action.

### Pillar 5: Spacing (3/4)

- **Positive** — Consistent 4/6/8/12/14/16/20 rhythm; 24px icon buttons; 72px fact-label column with an 8px gap (`CSS:2176-2177`, `:2190-2196`, `:2207`). No arbitrary Tailwind-style values or new magic numbers; the only inline styles are dynamic geometry/drag transforms (`PhysicsPaintKeyRail.tsx:320`; `PhysicsPaintPlayScriptDialog.tsx:311`).
- **WARNING — macro spacing does not scale down.** The 660px shell is sized for multi-card creation forms, but the reduced form occupies 150px plus a single 156px column. The same root cause as the Visuals finding; the fix is one layout adjustment, not a token change.
- **Minor** — The contrast between the dense inspector (6px row gaps) and the airy dead dialog body is jarring when moving between the two surfaces of the same feature.

### Pillar 6: Experience Design (2/4)

- **Positive** — Strong coverage where the phase focused: Enter and the primary share `confirmBlocked` (`dialog.tsx:150-157`, `:302`, `:579`); Escape and cancel write nothing and preserve the frozen target for retry (`controller.ts:3630-3648`); the rail target exposes `aria-busy` and suppresses open while busy (`KeyRail.tsx:331`, `:275`, `:305`); the disabled Edit control has an sr-only reason plus tooltip (`ScriptsPanel.tsx:153`, `:487-520`); focus moves to the Cycle input on open and returns to the trigger on close (`dialog.tsx:169-178`).
- **WARNING — silent refusals** (see Top Fix 2): the controller returns reason strings and the UI drops them; `error` is set to null on refusal.
- **WARNING — inert controls during `committing`** (see Top Fix 3): both footer actions remain enabled-looking and do nothing.
- **WARNING — no busy announcement on the dialog.** Only the rail target carries `aria-busy`; the dialog surface does not, and the footer status span (`dialog.tsx:530`) is not a live region. "Preparing Key Rail cycle…" / commit status changes are not announced; only errors get `role="alert"` (`:528`).
- **Minor — 220ms double-click window.** `ROTO_KEY_RAIL_FAST_DOUBLE_CLICK_MS = 220` (`PhysicsPaintKeyRail.tsx:31`) is well below typical OS double-click settings (often 500ms) and is not user-adjustable. Enter and the Edit Rail button are valid alternates, so this is an accessibility degradation rather than a blocker.
- **Minor** — The Edit Rail button cannot know the controller is busy and the handler's refusal is discarded, so a click during any in-flight operation is a silent dead click (`ScriptsPanel.tsx:153`; `controller.ts:1673-1679`).

---

## Minor Recommendations

1. Add "Press Enter or double-click to edit the cycle." to `buildSelectedKeyRailCopy` (`physicsPaintKeyRailPresentation.ts:90-103`).
2. Raise or OS-align the double-click window (`PhysicsPaintKeyRail.tsx:31`).
3. Move the inspector primary/neutrals onto `--ps-accent` and semantic tokens (`physicsPaintStudio.css:2174-2192`).
4. Enforce an 11px floor for inspector labels and the labeled primary (`CSS:4110-4115`).
5. Make the footer status a polite live region (`PhysicsPaintPlayScriptDialog.tsx:530`).

Registry audit: skipped — no `components.json` exists at the repo root or under `app/`, and no UI-SPEC third-party registry table exists.

---

## Files Audited

- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx`
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx`
- `app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (wiring: `:1781-1783`, `:4814-4833`, `:4882-4888`, `:7183-7185`, `:11011`)
- `app/src/components/physic-paint/physicsPaintStudio.css` (consumed selectors)
- `.planning/phases/58-rail-editing-regressions/58-CONTEXT.md`, `58-01..08-PLAN.md`, `58-01..08-SUMMARY.md`

---

## UI REVIEW COMPLETE

**Phase:** 58 - Rail editing regressions
**Overall Score:** 16/24
**Screenshots:** not captured (no dev server; code/CSS-only audit)
**Interaction captures:** off (`workflow.ui_interaction_capture` false)

### Pillar Summary
| Pillar | Score |
|--------|-------|
| Copywriting | 3/4 |
| Visuals | 2/4 |
| Color | 3/4 |
| Typography | 3/4 |
| Spacing | 3/4 |
| Experience Design | 2/4 |

### Top 3 Fixes
1. Resize/center the reduced Cycle dialog (fixed 660px shell around a 150px card).
2. Surface dropped refusal reasons and disable Edit Rail while busy.
3. Disable or busy-label footer actions and add `aria-busy` during `committing`.

### Recommendation Count
- Priority fixes: 3
- Minor recommendations: 5
