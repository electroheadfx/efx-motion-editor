---
phase: 42
slug: playscript-application-modes-color-override
kind: ui-revision-delta
status: approved-source
created: 2026-08-06
revision_sources:
  - SPECS/playscript-proposal/playscript-panel.html
  - SPECS/playscript-proposal/ui-play-script-specs.md
---

# Phase 42 — UI Revision Delta (approved proposal vs current contract)

> Concise delta between the current Phase 42 UI implementation/contracts and the approved
> playscript-proposal revision. Produced before any product-code change per the required
> process. The proposal supersedes the dialog layout and the inline color-picker interaction;
> it does NOT supersede the one-source-cycle Phase 42 / linked-repetition Phase 43 architecture.

## 1. Architecture confirmed unchanged (NOT a bug)

`frameCount = Frames / Frames per cycle` stays. Repeat and Infinity are session-level
loop intent only: they drive Requested/Effective duration, truncation info, Infinity state,
and success-only remembered options. They never multiply `frameCount`, never generate
repeated real keys, never duplicate assets, and Effective duration never feeds back into
generation. Phase 43 owns linked Loop Clips that repeat the source cycle by reference
(progressive cycles restart the build: `A|AB|ABC|A|AB|ABC`; static cycles re-hold the
complete drawing). This is already locked in CONTEXT D-01/D-02/D-14 and pinned by 42-02
tests ("generated count == cycle frames") — the revision only makes the UI copy say so
explicitly so Repeat no longer looks immediately generative.

## 2. Preserved completed work (compatible with the revision)

| Work | Why it survives |
|------|-----------------|
| 42-01 static/hold schedule module + tests | Pure schedule semantics; untouched by UI revision |
| 42-02 controller/renderer: two-mode generation, override color input seam, Motion plumbing, repeat validation + safe-product bound, readout composition, reset/E5/applied-summary boundaries | The renderer's `overrideColor` input, color-only post-Motion recolor, erase exclusion, source-snapshot immutability, and cycle-only generation are exactly the contracts the new UI feeds |
| 42-04 Task 1 panel summary + tooltip | Two-line success-only summary and two-mode tooltip are proposal-compatible |
| Dialog design tokens (light surface), overflow contract, focus trap, E5 failure/cancel surface, Motion slider semantics, radiogroup pattern | Proposal adopts structure, not the dark app mockup theme; existing tokens and a11y contracts stay |

## 3. Delta table — current contract → revised contract

| # | Area | Current (implemented) | Revised (approved proposal) |
|---|------|-----------------------|-----------------------------|
| 1 | Color control | Swatch button + in-dialog `InlineColorPicker` (Box/TSL/RVB/CMYK), Pitfall-3 mount pick-guard, explicit reset control (D-08/D-09) | Two-state segmented control `Original colors` \| `Custom color`. **No in-dialog picker.** `Original colors` disables the override; `Custom color` binds live to the app right-panel brush color |
| 2 | Override color source | Picker `onChange` sets `overrideColor` once per deliberate pick | Live link: Studio `settings.color` (single writer `setBrushColor`) is the only source. Dialog chip+hex render the live value while open and Custom-selected; Generate snapshots the resolved color; later brush changes never retroactively alter generated frames or the success-only panel summary. No DOM queries, no duplicated picker, no new color store, no new global event |
| 3 | Dialog layout | Vertical stack: mode block → frame field → override row → Motion section → Hold Loop section → readout → actions | Card grid: **Mode** full-width; **Timing** \| **Color** side by side; **Motion wiggle** full-width with `Reset defaults` as a link in the section heading; **Requested/Effective summary bar** (D-13 verbatim forms); fixed footer with progress line + Cancel/Generate |
| 4 | Static frame label | `Cycle frames` (D-03) | `Frames per cycle` (Progressive keeps `Frames`) |
| 5 | Repeat/Infinity presentation | Hold Loop block scoped to Static/Hold semantics (D-15 static-only defaults) | Timing card exposes Repeat + Infinity in **both** modes; Requested = frames × repeat is loop-duration intent in both modes (Phase 43 repeats either source cycle by reference) |
| 6 | Loop readout placement | Paragraph inside the Hold Loop section | Proposal summary bar at body bottom, same verbatim forms: `Requested: {R}f ({C}f × {n}) · Effective: {E}f[ — shortened by the next clip]`; Infinity form `Cycle {N}f × ∞` kept |
| 7 | Static-mode `Max` handling | First-time static defaults cycle=1 (D-15) | Adopted from proposal: switching to Static / Hold with `Max` in the field normalizes the field to `1` |
| 8 | Motion reset placement | `Reset to Motion defaults` button inside the Motion section | `Reset defaults` link/action inside the Motion wiggle section heading (same controller `resetDialogMotion()` boundary; copy per proposal) |
| 9 | Picker guard tests | Pitfall-3 contract tests (open/close without pick leaves `Original colors`) | **Removed** — no picker exists. Replaced by toggle/live-link/snapshot tests |
| 10 | UAT steps 4 & 9 | Picker-opens-on-first-enable flow; packaged-build picker/CSP check | Color toggle + live chip/hex sync flow; packaged build verifies toggle + live sync render/function identically |
| 11 | Infinity-on repeat field | Disabled/greyed at 0.5 opacity, value preserved (D-12) | Unchanged (kept) |
| 12 | Panel summary line 1 form | `{Mode} · {Original colors \| Override #rrggbb} · Motion {d}/{p}` (D-07) | Unchanged (kept — it is the snapshot of the applied color, consistent with the no-retroactive-change contract) |

## 4. Superseded contract items (removed from active Phase 42 wording)

- CONTEXT D-08, D-09 (inline picker + pick-guard) → replaced by the two-state toggle + live brush-color contract.
- UI-SPEC: `Override swatch` and `Picker pick semantics` Interaction rows; `picker well` token mention; `Color reset action` copy row; E2 picker-guard state resolutions; "InlineColorPicker reused per D-08" design-system note.
- 42-03-PLAN: Task 2 picker markup/behavior/test cases (c)(d), `InlineColorPicker` key-link, prohibition about popover pickers (moot).
- VALIDATION: picker-guard rows/cases for 42-03-T2.
- UAT: picker steps in 4 and 9.
- RESEARCH Pitfall 3 / Open Question 3 references stay as historical research; the active contract no longer mounts the picker.

## 5. Revised color contract (locked wording for artifacts)

- Color is a two-state segmented control: `Original colors` | `Custom color`.
- Selecting `Original colors` disables the override.
- Selecting `Custom color` immediately uses the current right-panel brush color.
- While the dialog is open and Custom color is selected, changing the right-panel brush color updates the dialog chip/hex live.
- Generate snapshots the resolved color used for that application.
- Later brush-color changes must not retroactively change generated frames or the success-only panel summary.
- The reusable source script and thumbnail remain unchanged.
- Paint strokes recolor; erase strokes remain erase strokes.
- The override remains post-Motion and color-only.

## 6. Loop-intent clarification (locked wording for artifacts)

- Phase 42 generates exactly one source cycle: `Frames` (Progressive) or `Frames per cycle` (Static / Hold) real destination frames.
- Repeat/Infinity express session-level loop intent consumed by the Requested/Effective readout only.
- Phase 43 repeats the source cycle via linked Loop Clips without duplicating source frames or durable assets; a repeated Progressive cycle restarts the build on each linked cycle; truncation applies to the linked loop presentation, never by materializing extra real keys in Phase 42.

## 7. Affected implementation files (for confirmation; no code changed yet)

| File | Change |
|------|--------|
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` | Card-grid layout; color segmented control + live chip/hex (brush color in as a live prop); remove `InlineColorPicker` mount and pick-guard; `Frames per cycle` label; summary bar; `Reset defaults` heading link |
| `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.test.ts` | Remove picker-guard cases; add toggle semantics, live chip update, label, summary-bar, reset-link cases |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` | Replace dialog-fed `overrideColor` signal with confirm-time snapshot via a `getBrushColor` port (single source = Studio `settings.color`; no duplicated state); keep `overrideEnabled` |
| `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` | Port-based override resolution tests; snapshot-at-confirm; no-retroactive-change |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (+ view threading if needed) | Pass live brush color to the dialog + `getBrushColor` port to the controller |
| `app/src/components/physic-paint/physicsPaintStudio.css` | Card-grid, summary bar, chip/hex styles inside `.physics-paint-play-script-*`; remove dead picker-well rules in that scope |

**Unchanged implementation files:** 42-01 package module; 42-02 renderer + its tests; `PhysicsPaintScriptsPanel.tsx` and its test; `InlineColorPicker.tsx` itself (still used by the right panel — only the dialog mount is removed).

## 8. Artifact updates made under this revision

- `42-CONTEXT.md` — D-08/D-09 superseded (new D-08R); D-03 label revision; D-16 layout revision; D-17 live-color contract; loop-intent clarification
- `42-UI-SPEC.md` — layout, color section, copy, interaction rows, E2 states; sign-off reset pending re-check
- `42-05-PLAN.md` — NEW plan (wave 5, autonomous, TDD): adopt the revised dialog contract
- `42-04-PLAN.md` — Task 2 UAT script rewritten for the new surface; depends on 42-05; wave 6
- `42-VALIDATION.md` — scaffold/map rows revised (picker-guard → toggle/live-link; 42-05 added)
- `42-04-UAT.md` — nine-step script rewritten for the revised UI
