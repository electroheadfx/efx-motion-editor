# Quick Task 260924-ffd: numeric stepper contract: integer ±1 default + fps presets - Context

**Gathered:** 2026-09-24
**Status:** Ready for planning

<domain>
## Task Boundary

Rewrite the shared NumericStepper/NumericInput contract:

1. **CLASSIC DEFAULT** (no constraints passed): `step` optional, default 1; `+`/`-` emit exactly ±1 (hold-to-repeat too); integer display (no decimal point, no trailing `.0`). Passing only `value` + `onChange` + `ariaLabel` yields this.
2. **PRESET MODE** (new, for fps): `presets?: readonly number[]`; `+`/`-` move to next/previous entry; ends clamp (no wrap); typed commit snaps to NEAREST preset (ties → lower); live off-list value displays as-is until first `+`/`-` which snaps to nearest neighbour in direction of travel; no decimals ever. fps list exactly ascending: **6, 12, 15, 24, 25, 50, 60**.
3. **EXPLICIT DECIMAL STEPS** stay opt-in and unchanged (Scale 0.01, SX/SY 0.01, crop T/R/B/L 0.01, FX 0.1/0.5, audio, transitions). Decimals appear ONLY when caller passes a sub-unit `step` or explicit `precision`.
4. **PAPER GRAIN SCALE** unchanged: sole consumer of `resolveStep` + `freeEntry` (bands 0.5 inside `]0.5, 2.0[` else 0.1, free typed entry, comma-tolerant). Not folded into presets.

**Two-tier fps model (product law):**
- **A. PROJECT fps** = authoritative OUTPUT cadence, persisted, used by export/render.
  - SettingsView.tsx:30-48 Frame Rate buttons `[15, 24]` → preset stepper (`− value +`) over the 7-preset list.
  - NewProjectDialog.tsx:167-198 buttons `[15, 24]` → SAME list, SAME stepper, seeds project rate.
- **B. STUDIO playback fps** = PREVIEW ONLY. Seeded from project fps at launch (`projectFps` fallback); may diverge; **NEVER writes `projectStore.fps`** — pin as regression guard (updateFps already keeps to `useRotoCachedPlayback`).
  - PhysicsPaintWorkflowStrip.tsx:1191 fps field → preset stepper, replacing `step={0.5}`, `min=1`, `max=60`.

All three fps surfaces use the SAME preset list and SAME stepper component.

NumericInput label drag-to-scrub: preset mode drags through the preset list; classic mode ±1 per threshold.

**D-24 ("fps step 0.5") is OBSOLETE.** Tests pinning fps 0.5 (`NumericStepper.test.tsx`, swept-fields test) must be REWRITTEN to the new contract, not kept green. 260924-d6l grain-leak audit found none — this is a contract redesign, not a leak fix.

**RED-first pins:**
1. No `step`/`presets` → exactly ±1, integer format.
2. Preset stepper `[6,12,15,24,25,50,60]` from 24: `+` → 25 then 50; `-` → 15 then 12; never 24.5 or 30.
3. Typed commit `"30"` → 24 or 25 (nearest, ties low), never 30.
4. Studio playback fps change does NOT change `projectStore.fps` (and vice versa).
5. `step={0.01}` still emits ±0.01 with decimal display.
6. Paper grain still resolves bands and accepts comma free entry.

**Guardrails:**
- Do not touch T-52.2-08 clamp contract for explicit-step fields, hold-to-repeat, or coalesced-undo bracketing.
- fps min/max become preset list ends (6, 60); no other field's declared min/max changes.
- No new component — extend existing NumericStepper; NumericInput inherits the modes.
- Comma-tolerant parsing stays.
- No timeline fps control in this quick (Settings + New Project + Studio playback only).
- Do not change any field's declared min/max/step values (except fps, which is preset-driven).

**Native UAT (after GREEN), 8 rows:** preset stepping stops at ends; two-tier isolation both directions; Settings + New Project steppers; classic integer field steps 1,2,3; Sidebar Scale 0.01 unchanged; paper grain bands+free entry+comma (260923-bcm rows); export cadence follows PROJECT fps not Studio preview; hold-to-repeat collapses to one undo + garbage typed commit rejected/reverted.

</domain>

<decisions>
## Implementation Decisions

### Preset end-state buttons
- At fps 60 the `+` button and at fps 6 the `−` button are **visibly disabled** (dimmed, unclickable) — makes the preset list bounds obvious. Not a silent no-op.

### New Project default fps
- **24** is pre-selected by default in the New Project dialog (matches today's button row's higher option and common film cadence).

### Garbage typed input policy (classic fields)
- **Reject + revert**: typing garbage (`abc`, unparseable) on a classic integer/constant-step field and committing (blur/Enter) reverts to the value before the edit. (Usable-but-off-step numeric input keeps the existing snap/round-to-step commit path — T-52.2-08 unchanged.)

### Claude's Discretion
- Exact disabled-button styling: reuse whatever disabled state pattern already exists in the app's controls.
- Where the shared FPS_PRESET list constant lives (co-located with NumericStepper or a small shared module) — pick the least-coupled location.
- Whether Settings/New Project stepper passes `presets` only (typed commit then snaps to nearest preset per contract).
- Research-phase findings on implementation shape (RESEARCH.md feeds this).

</decisions>

<specifics>
## Specific Ideas

- fps preset list literal: `6, 12, 15, 24, 25, 50, 60` (ascending, exact).
- Ties on nearest-preset snap go to the LOWER preset (e.g. typed 30 → 25? No: nearest of 25 vs 50 is 25; typed 37.5 would tie 24/50? — nearest by absolute distance, ties → lower; "30" → 25? distance to 25 is 5, to 50 is 25, so 25. Contract says "24 or 25" — nearest is 25; accept either in tests only if ties appear, but standard nearest wins).
- Studio playback fps regression guard: a test that `updateFps` (workflow strip) never writes `projectStore.fps`.
- No decimals ever shown in preset mode or classic default mode.

</specifics>

<canonical_refs>
## Canonical References

- T-52.2-08 clamp contract (explicit-step fields, hold-to-repeat, coalesced undo) — preserved, not modified.
- 260923-bcm UAT-approved paper grain scale behaviour (bands + free entry + comma) — preserved verbatim.
- 260924-d6l grain-leak audit (found no leak; leak framing obsolete).
- D-24 fps step 0.5 — **OBSOLETE, superseded by this task.**

</canonical_refs>
