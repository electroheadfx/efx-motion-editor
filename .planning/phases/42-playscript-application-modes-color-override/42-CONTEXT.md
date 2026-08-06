# Phase 42: PlayScript Application Modes + Color Override - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver explicit PlayScript application controls in the EFX Paint Scripts panel: a progressive vs static/hold application mode (static/hold generates a real working single cycle — the complete script stroke set on every destination frame), an application-time color override that recolors paint strokes identically in both modes, editable application-time Script Motion controls, Hold Loop controls (cycle × repeat 1..∞) with requested-vs-effective duration display, and a two-line read-only options summary in the panel. This phase locks the interval and display conventions (half-open intervals, requested-vs-effective presentation) that Phase 43's filmstrip capsule and linked-loop resolver will share.

Requirements: PLAY-01..04 (REQUIREMENTS.md). Source spec: `SPECS/milestone-v0.9.0-plan.md` §"Phase 3 — PlayScript application controls".

**Locked by roadmap/spec (not negotiable):** progressive output unchanged with default options; static/hold schedule ships as a NEW package export (`@efxlab/efx-physic-paint/animation`) — the regression-locked progressive module is never branched; erase strokes retain erase behavior; the reusable source script and its thumbnail stay byte-identical; no persisted default color overrides inside script documents; the term `clip bloquant` never appears (use `clip suivant` terminology where French applies — Phase 43 scope).

</domain>

<decisions>
## Implementation Decisions

### Phase 42/43 functional split

- **D-01:** Static/hold mode is fully working in Phase 42: selecting it generates the complete script stroke set on every destination frame of a single cycle (no loop repetition). Phase 43 adds determinism hardening, linked Loop Clips, and the filmstrip capsule. The color override is therefore provable live in both modes in Phase 42. — **Reversibility:** costly — undoing means re-scoping two roadmap phases whose boundary note is already locked in ROADMAP.md.
- **D-02:** Phase 42 generates only the source cycle (`cycleLength` frames) as real keys. Repeat/infinity compute and display requested vs effective duration plus truncation status, but repetition never materializes in 42 — linked Loop Clips arrive in 43. No duplicated durable frames are ever written. — **Reversibility:** one-way — if duplicated frames were generated in 42, Phase 43 would inherit a data-cleanup/migration problem; generating cycle-only keeps the durable store clean for the linked-reference model.
- **D-03:** In static/hold mode the existing Frames input IS the cycle frame count — one field, no separate cycle-length input. Progressive keeps the current Frames/Max behavior unchanged. Requested duration (`frames × repeat`) is derived display only. The single shared numeric field's visible label is mode-dependent: `Frames` in Progressive, `Frames per cycle` in Static / Hold (label revised 2026-08-06 per the approved playscript-proposal; was `Cycle frames`). Switching to Static / Hold with `Max` in the field normalizes the field to `1`. Generation count is always this field's value alone — Repeat never multiplies it (D-02).

### Controls placement + dialog structure

- **D-04:** Application options live in the expanded Play Script confirmation dialog (mode, override color, Script Motion, Hold Loop controls); the Scripts panel gains a compact read-only summary of the current options. The dialog remains mounted directly in the Studio grid with isolated full-height styles (Phase 36.14 regression lesson — extending it must not re-introduce the constrained dark pane regression).
- **D-05:** Mode selector is a two-option segmented control at the top of the dialog: `Progressive` | `Static / Hold`, with one short contextual helper line directly below that updates on selection change — Progressive: "The drawing builds stroke by stroke across frames." / Static / Hold: "The complete drawing is applied to every cycle frame." Mutually exclusive by construction, one-click, keyboard arrow navigation, accessible radiogroup semantics, no additional radio rows or duplicated descriptions.
- **D-06:** Script Motion position/deformation controls are editable inside the dialog. On open they initialize from the existing Motion panel values (defaults only). Dialog edits apply only to this PlayScript application — the same script can be replayed with different Motion values, and both modes use the dialog values. Dialog edits never write back to Motion panel defaults, never modify the reusable source script, never overwrite existing per-stroke properties; only the newly generated destination frames use the application-time Motion values. The dialog provides a `Reset to Motion defaults` action; no `Save as defaults` action in Phase 42.
- **D-07:** The panel summary is a two-line block — line 1: mode + override state + Motion values; line 2: destination range + generated-frame count/status. Together with the dialog this satisfies PLAY-03 panel clarity. The summary reflects the last options successfully confirmed and applied by Generate — updated atomically on successful Generate; unsaved dialog edits, cancellation, and generation failure preserve the previously successful summary and remembered session options; before the first successful Generate it shows the locked first-time/session defaults (UI-SPEC revision 2026-08-05).

### Color override UX (PLAY-02)

- **D-08 (SUPERSEDED 2026-08-06 → D-08R):** ~~The dialog shows an `Original colors` state by default plus a compact swatch button that opens the existing Phase 33 inline color picker (Box/TSL/RVB/CMYK). Picking a color switches to override mode; an explicit control returns to Original colors.~~
- **D-09 (SUPERSEDED 2026-08-06 → D-08R):** ~~The picker opens directly on first enable — no seed color. The override exists only once the user picks a color (no implicit current-brush or script-color default).~~
- **D-08R:** Color is a two-state segmented control in the dialog's Color card: `Original colors` | `Custom color` — no in-dialog picker (approved playscript-proposal, 2026-08-06; supersedes D-08/D-09 and the Pitfall-3 mount pick-guard contract). Selecting `Original colors` disables the override. Selecting `Custom color` immediately uses the current right-panel brush color; while the dialog is open and Custom color is selected, right-panel brush-color changes update the dialog chip/hex live. The live source is the Studio's existing `settings.color` (single writer `setBrushColor`) — no DOM queries, no duplicated picker, no new color store, no new global event. Generate snapshots the resolved color for that application; later brush-color changes never retroactively change generated frames or the success-only panel summary. The reusable source script and thumbnail stay unchanged; paint strokes recolor; erase strokes remain erase strokes; the override remains post-Motion and color-only (D-11 unchanged). — **Reversibility:** cheap — the renderer's `overrideColor` input seam (42-02) is unchanged; only the dialog→signal feed is revised.
- **D-10:** All Play Script options (mode, override enabled state, Motion edits, loop values) are remembered for the whole EFX Paint session via signals only — nothing persisted to project data or app config (soloStore / Phase 41 D-13 precedent). The override color itself is never stored: while Custom color is selected it resolves live from the brush color (D-08R); the applied snapshot lives only in the generated frames and the success-only summary string.
- **D-11:** The override is a color-only recolor: it replaces each paint stroke's color while tool, brush style, params, and physics stay per-stroke. Erase strokes (detected by tool) are excluded entirely and keep erase behavior. Never use the engine's wholesale `strokeStyleOverride` (tool/params flattening) as-is — only its color channel concept is reused.

### Hold Loop semantics (PLAY-04)

- **D-12:** Repeat is a positive-integer field (default 1) with a separate Infinity toggle beside it, exposed in the Timing card in BOTH modes (approved playscript-proposal, 2026-08-06 — Progressive also shows Repeat/Infinity as loop intent). When Infinity is on, the repeat field is disabled/greyed and requested duration shows `Cycle Nf × ∞`; toggling Infinity off restores the last repeat value.
- **D-13:** The requested/effective/truncation readout is English in the Phase 42 dialog, e.g. `Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip`, rendered in the proposal summary bar at the bottom of the dialog body. The French capsule label `Boucle raccourcie par le clip suivant` is Phase 43 filmstrip scope only.
- **D-14:** The loop readout is informational only in 42 — it previews what the linked loop will do in 43. Repeat and Infinity are session-level loop intent: they drive Requested/Effective duration, truncation information, Infinity state, and success-only remembered options ONLY. They never multiply `frameCount`, never generate repeated real keys, never duplicate assets, and Effective duration never feeds back into generation. Phase 43 repeats either source cycle by reference via linked Loop Clips (a repeated Progressive cycle restarts the build: `A|AB|ABC|A|AB|ABC`); next-clip or parent-end truncation applies to the linked loop presentation, never by materializing extra real keys in 42. Generation stays bounded by the existing authority capacity check (`frames ≤ Max`); truncation never blocks, warns-gates, or alters generation in this phase.
- **D-15:** First-time defaults when switching to Static / Hold (before session memory exists): Frames per cycle = 1, Repeat = 1, Infinity = off — a minimal hold the user grows explicitly. Progressive defaults are untouched.

### Dialog layout (approved playscript-proposal, 2026-08-06)

- **D-16:** The dialog adopts the proposal card grid (sources: `SPECS/playscript-proposal/playscript-panel.html`, `SPECS/playscript-proposal/ui-play-script-specs.md`): **Mode** card full-width on top; **Timing** and **Color** cards side by side; **Motion wiggle** card full-width with `Reset defaults` as a link/action in the section heading (same controller `resetDialogMotion()` boundary as D-06); the D-13 Requested/Effective **summary bar** at the bottom of the body; progress line and Cancel/Generate in a fixed footer. The proposal's dark app mockup is out of scope — the dialog keeps the existing light-surface token system, the D-04 Studio-grid mounting, and the viewport-bounded body-only scrolling contract. The proposal is adopted for structure, layout, and interaction only.

### Trigger + brush-color ownership (locked 2026-08-06)

- **D-17:** The existing Play Script toolbar action in the Scripts panel remains the SOLE product trigger that opens the dialog. No demo trigger/button from the HTML proposal is added or copied; the dialog never auto-opens; no second Play Script action is added anywhere; the existing script-selection and availability guards on that toolbar action are preserved. The HTML proposal defines the dialog layout only — its surrounding demo shell and trigger are not product UI.
- **D-18:** The Play Script dialog is READ-ONLY with respect to the application brush color. `setBrushColor` remains the sole writer and the right-panel brush picker the sole editing surface. Selecting `Custom color` never writes, seeds, normalizes, or otherwise mutates `settings.color` — the dialog only observes the live brush-color signal and snapshots its current resolved value when Generate is confirmed. Selecting `Original colors` only disables the application-time override; it never changes the brush color. Later brush-color changes never alter already generated frames or the success-only applied summary.

### Claude's Discretion

- Exact segmented-control markup/styling within the dialog conventions (must satisfy D-05's accessibility and helper-line requirements).
- Exact erase-stroke detection mechanism (tool field inspection) and where the color substitution enters the render pipeline (stroke-level before engine render is the natural seam).
- How the effective-duration computation consumes the existing authority `capacity`/`layerEndExclusive` values (researcher/planner territory — reuse, don't recompute).
- Exact two-line summary formatting/copy within D-07's content requirements.
- New package export shape for the static/hold schedule (must be additive alongside the untouched progressive module).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec + requirements (locked WHAT)
- `SPECS/milestone-v0.9.0-plan.md` §"Phase 3 — PlayScript application controls" — locked PLAY-01..04 spec text, Hold Loop control list, filmstrip/terminology rules, Phase 3 acceptance list
- `.planning/REQUIREMENTS.md` — PLAY-01..04 requirement statements (HOLD-01..06 are Phase 43 — do not pull forward)
- `.planning/ROADMAP.md` §"Phase 42" — goal, success criteria, and the locked boundary note (interval/display conventions locked here; static/hold schedule as new package export; progressive module never branched)

### Existing seams to extend (read before editing)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — Play Script controller: confirmation flow, capacity/authority, destination range, phase machine, commit publication — the options state and dialog controls extend this
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — progressive renderer: engine init, schedule, per-frame stroke transform, alpha merge, PNG encode, staged real-key frames — static/hold rendering reuses this pipeline with a new schedule
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — current minimal dialog (Frames input, Max/capacity, progress) — expands per D-04/D-05
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — Scripts panel toolbar + rows — gains the two-line summary (D-07)
- `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` — regression-locked progressive schedule (never branch; new static/hold schedule ships beside it)
- `packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts` — `transformRecordedStrokeForHeldPose` deterministic Script Motion transform (deformation/position) — shared by both modes
- `packages/efx-physic-paint/src/animation/AnimationPlayer.ts` — existing `strokeStyleOverride` seam (color channel concept only, per D-11)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` (`getMotion`, `updatePanelMotion`, dialog mounting) — Motion panel defaults source and Studio-grid dialog mounting (D-04, D-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `physicsPaintRotoPlayScriptController.ts`: full authority/capacity/commit machinery (`requestAuthority` → staged render → atomic publication). New options ride this controller as additional signal state — no new commit path.
- `physicsPaintRotoPlayScriptRenderer.ts`: the staged-frame pipeline (engine init, alpha merge with existing frames, PNG encode, progress, abort, memory guard) is mode-agnostic; only the per-frame stroke selection (schedule) differs between progressive and static/hold.
- Studio `settings.color` + `setBrushColor` (PhysicsPaintStudio): the single live brush-color source the dialog's `Custom color` state reads (D-08R) — no new picker, store, or event. (`InlineColorPicker` remains the right panel's picker; the dialog no longer mounts it — D-08 superseded.)
- `buildProgressiveStrokeSchedule`/`getProgressiveFrameStrokes`/`transformRecordedStrokeForHeldPose` engine exports: the static/hold schedule is a new sibling export; the Motion transform is shared unchanged.
- `authority.capacity` / `layerEndExclusive`: existing boundary truth for the effective-duration readout (D-13/D-14).

### Established Patterns
- Play Script is an explicit non-history `replace-roto-physical-map` operation; staged frames stay provisional, then one sorted complete physical map crosses the sole coordinator/parent bridge (Phase 36.14, regression-locked) — static/hold output follows the same path.
- Session-local ephemeral state lives in signals, never project data (soloStore, Phase 41 D-13) — D-10 options memory follows this.
- Guarded-icon-with-tooltip + disabled-reason conventions (Phase 36.15) apply to any new dialog/panel controls.
- Dialog presentation: mounted directly in the Studio grid, full-height light styles isolated from Scripts-pane/delete-confirmation constraints (Phase 36.14 regression) — D-04 extends the dialog without breaking this.
- Native visual UAT is the user's oracle — nothing is "done" until live UAT passes.

### Integration Points
- Play Script dialog: mode segmented control, override swatch, Motion controls, Hold Loop controls, requested/effective readout — all new UI inside the existing dialog surface.
- Scripts panel: two-line summary block (toolbar/status area).
- Engine package: new additive static/hold schedule export from `@efxlab/efx-physic-paint/animation`.
- Renderer: schedule selection + application-time color substitution + application-time Motion values enter `renderRotoPlayScriptFrames` input.

</code_context>

<specifics>
## Specific Ideas

- User specified the mode control verbatim: segmented `Progressive` | `Static / Hold` at dialog top, helper line below ("The drawing builds stroke by stroke across frames." / "The complete drawing is applied to every cycle frame."), radiogroup semantics, arrow-key navigation, no extra radio rows (D-05).
- User specified Script Motion ownership verbatim: dialog values are application-time only; never write back to Motion panel defaults; never modify the source script; never overwrite per-stroke properties; `Reset to Motion defaults` exists; no `Save as defaults` in Phase 42 (D-06).
- User specified the English truncation readout form: `Requested: 25f (5f × 5) · Effective: 18f — shortened by the next clip` (D-13).
- User specified first-time static/hold defaults as minimal: Cycle frames = 1, Repeat = 1, Infinity = off (D-15).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Linked Loop Clip materialization, filmstrip capsule, French capsule labels, and determinism hardening are Phase 43 roadmap scope, not deferred ideas.)

</deferred>

---

*Phase: 42-playscript-application-modes-color-override*
*Context gathered: 2026-08-05*
