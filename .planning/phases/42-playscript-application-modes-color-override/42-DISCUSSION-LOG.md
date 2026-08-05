# Phase 42: PlayScript Application Modes + Color Override - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 42-playscript-application-modes-color-override
**Areas discussed:** 42/43 functional split, Controls placement, Color override UX, Hold Loop semantics

---

## 42/43 functional split

**Q1: What should static/hold mode actually DO when the user selects it in Phase 42?**

| Option | Description | Selected |
|--------|-------------|----------|
| Working static/hold in 42 | Static/hold generates the complete stroke set on every destination frame (single cycle); 43 adds determinism hardening, linked Loop Clips, filmstrip | ✓ |
| Controls-only in 42 | 42 ships controls + schedule export; static/hold generation goes live in 43 | |
| Static/hold gated to 43 | Selection visible but marked as arriving with loops in 43 | |

**User's choice:** Working static/hold in 42

**Q2: With working static/hold in 42, what do the Repeat/infinity Hold Loop controls drive?**

| Option | Description | Selected |
|--------|-------------|----------|
| Cycle only in 42 | 42 generates only the source cycle; repeat/infinity compute/display durations; repetition materializes in 43; no duplicated durable frames | ✓ |
| Duplicated frames in 42 | cycle × repeat as real durable frames; 43 migrates to linked refs | |
| Display-only loop info | Generation always one cycle; readout informational | |

**User's choice:** Cycle only in 42

**Q3: In static/hold mode, how do the Frames input and the Hold Loop 'cycle frame count' relate?**

| Option | Description | Selected |
|--------|-------------|----------|
| Frames = cycle length | One field; progressive keeps Frames/Max unchanged | ✓ |
| Separate range + cycle | Destination range input plus cycle field; cycle tiles | |
| Cycle from script | Cycle defaults to script stroke count | |

**User's choice:** Frames = cycle length

---

## Controls placement

**Q1: Where do the application options (mode, color override, Hold Loop) live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Panel section | Persistent section in the Scripts panel; minimal confirm dialog | |
| Dialog + summary | Expanded Play Script dialog; compact read-only panel summary | ✓ |
| Dialog only | Everything in the dialog; panel only gains status text | |

**User's choice:** Dialog + summary

**Q2: What form should the progressive vs static/hold mode selector take?**

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented control | Two-option segmented 'Progressive' \| 'Static/Hold' | ✓ |
| Radio with helpers | Radio rows with helper lines | |
| Claude's discretion | Claude picks within dialog conventions | |

**User's choice (free-text elaboration):** Two-option segmented control at the top of the dialog: `Progressive` | `Static / Hold`, with one short contextual helper line directly below that updates on selection change ("The drawing builds stroke by stroke across frames." / "The complete drawing is applied to every cycle frame."). Mutually exclusive by construction, one-click, keyboard arrow navigation, accessible radiogroup semantics, no additional radio rows or duplicated descriptions.

**Q3: PLAY-03 requires the Scripts panel to show Script Motion position/deformation controls. Where should they be editable?**

| Option | Description | Selected |
|--------|-------------|----------|
| In the dialog | Editable in dialog, writes through to per-layer settings | ✓ (modified) |
| Read-only echo | Controls stay on existing surface; dialog shows read-only | |
| Claude's discretion | | |

**User's choice (free-text elaboration):** Editable Script Motion controls inside the dialog. On open, initialize from existing Motion panel values (defaults only). Dialog edits apply only to this PlayScript application; replayable with different Motion values; both modes use dialog values. Dialog edits must not write back to Motion panel defaults, must not modify the reusable source script, must not overwrite existing per-stroke properties; only newly generated destination frames use them. Panel summary shows current application values; dialog provides `Reset to Motion defaults`; no `Save as defaults` in Phase 42.

**Q4: What form should the panel's read-only options summary take?**

| Option | Description | Selected |
|--------|-------------|----------|
| One summary line | Single compact line with all five PLAY-03 items | |
| Two-line block | Line 1: mode + override + Motion; line 2: destination + generated count | ✓ |
| Claude's discretion | | |

**User's choice:** Two-line block

---

## Color override UX

**Q1: How should the user set (and clear) the optional override color in the dialog?**

| Option | Description | Selected |
|--------|-------------|----------|
| Swatch + inline picker | 'Original colors' default + swatch opening Phase 33 inline picker; explicit return to Original | ✓ |
| Checkbox + swatch | 'Override colors' checkbox enables swatch | |
| Claude's discretion | | |

**User's choice:** Swatch + inline picker

**Q2: When the user first switches from Original colors to override, what color seeds the swatch?**

| Option | Description | Selected |
|--------|-------------|----------|
| Current brush color | Seed from active brush color | |
| Script's first color | Seed from script's first paint stroke | |
| Picker opens directly | No seed; override exists only after user picks | ✓ |

**User's choice:** Picker opens directly

**Q3: When the Play Script dialog is closed and reopened, should it remember the last-used options?**

| Option | Description | Selected |
|--------|-------------|----------|
| Remember for session | All options persist for the session via signals; nothing persisted | ✓ |
| Reset each open | Defaults on every open | |
| Remember all but color | Override color always resets to Original | |

**User's choice:** Remember for session

**Q4: What exactly does the override recolor on each stroke?**

| Option | Description | Selected |
|--------|-------------|----------|
| Color-only recolor | Replace stroke color; tool/style/params/physics stay per-stroke; erase excluded | ✓ |
| Uniform flatten | Flatten to uniform brush | |
| Claude's discretion | | |

**User's choice:** Color-only recolor

---

## Hold Loop semantics

**Q1: How should the Repeat count and Infinity toggle interact?**

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle greys repeat | Infinity on greys repeat, shows 'Cycle Nf × ∞', restores last value on off | ✓ |
| Single field with ∞ | Repeat field accepts number or ∞ symbol | |
| Claude's discretion | | |

**User's choice:** Toggle greys repeat

**Q2: What language should the requested/effective/truncation readout use in the Phase 42 dialog?**

| Option | Description | Selected |
|--------|-------------|----------|
| English readout | English dialog readout; French filmstrip label stays Phase 43 | ✓ |
| French readout | French phrasing in dialog too | |
| Bilingual | English readout referencing French capsule term | |

**User's choice:** English readout

**Q3: In Phase 42, does a truncated requested loop affect generation?**

| Option | Description | Selected |
|--------|-------------|----------|
| Informational only | Readout previews 43 behavior; capacity check bounds generation; truncation never blocks | ✓ |
| Warn before generate | Warning requires acknowledgment | |
| Block generation | Disabled until values fit boundary | |

**User's choice:** Informational only

**Q4: What are the first-time defaults when the user switches to Static / Hold?**

| Option | Description | Selected |
|--------|-------------|----------|
| Frames = Max default | Full available capacity like progressive | |
| Frames = stroke count | Script's brush/stroke count | |
| Frames = 1 | Minimal hold; user grows cycle explicitly | ✓ |

**User's choice:** Frames = 1 (Repeat = 1, Infinity = off)

---

## Claude's Discretion

- Segmented-control markup/styling within dialog conventions (D-05 accessibility requirements fixed).
- Erase-stroke detection mechanism and color substitution seam in the render pipeline.
- Effective-duration computation consuming existing authority capacity/layerEndExclusive.
- Two-line summary exact formatting/copy.
- New static/hold schedule package export shape (additive only).

## Deferred Ideas

None — discussion stayed within phase scope. (Loop Clip materialization, filmstrip capsule, French capsule labels, determinism hardening = Phase 43 roadmap scope.)

---

## Revision Note (2026-08-05 — UI-SPEC revision, user-locked corrections)

The following supersede wording recorded above and in earlier artifacts; 42-CONTEXT.md, 42-RESEARCH.md, and 42-UI-SPEC.md carry the corrected contract:

1. **E1 dialog overflow is `covered`, not a backstop** — the UI-SPEC locks a structural contract (viewport-bounded max-height, only the dialog body scrolls, title/mode context and action row stay visible, no horizontal scrolling, text wraps, focused controls scroll into view with visible focus outlines). Native UAT at minimum window size is verification only.
2. **Mode-dependent frame-field label** — the single shared numeric field shows `Frames` in Progressive and `Cycle frames` in Static / Hold (defaults Cycle frames = 1). No second field.
3. **Panel summary updates only after success** — the free-text phrase "Panel summary shows current application values" (Q3 above) is SUPERSEDED: the two-line summary reflects the last options successfully confirmed and applied by Generate; unsaved dialog edits, cancellation, and generation failure preserve the previously successful summary and remembered options; first-time/session defaults show before the first success.
4. **E5 failure/cancellation contract completed** — failure: progress stops, bar hides, inputs re-enable, dialog stays open, inline error shows the reason, retry or normal cancel allowed, no remembered-options/summary update, no partial frames or timeline mutations. Normal cancellation returns to the idle dialog with no error and the same preservation guarantees.

