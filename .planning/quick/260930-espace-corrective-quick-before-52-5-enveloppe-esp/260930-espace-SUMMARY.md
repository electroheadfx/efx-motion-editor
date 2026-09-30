---
phase: quick-260930-espace
plan: 260930-espace
type: tdd
status: complete
tasks: 3
commits: 4
date: 2026-09-30
---

# 260930-espace SUMMARY — enveloppe-espace (R8 revised: the envelope is a ROOM)

**AUTOMATED-READY — NOT done.** Acceptance is the user's live native UAT at
spread 60-65 against the ref-144 target look at pressure thickness. Nothing is
done until that UAT passes.

## Why

260930-dy0 native UAT 2026-09-30: **REGRESSION**. Do not push.

`projectWetIntoEnvelope` treated the DEPOSIT silhouette as the envelope
(`snapshotWetAlpha(this.wet)`). The deposit is already at full pressure width,
so the solver had ZERO room to spread at any setting. The mass the solver
carries outward IS the target look (ref 144) — zeroing it destroyed it. That is
why max spread looked identical to min spread.

Reference captures (`/tmp/efx-paint-refs/`):

| Capture | Role |
|---------|------|
| `paint-ref-143-feutre.jpg` | felt-tip, low spread (magenta) |
| `paint-ref-144-spread65-TARGET.jpg` | spread 65 — THE TARGET LOOK (blue) |
| `paint-ref-146-after-dy0.png` | current — the regression |

**USER DESIGN ACT 2026-09-30b — THE ENVELOPE IS A ROOM, NOT A CLIP**
(spec act on disk at `SPECS/real-paint/01-brush-footprint.md` R8 revised +
`00-overview.md` Q10 — `SPECS/` is gitignored, no spec commit):

> *"la physique doit s'appliquer sur un stroke reduit pour pouvoir
> s'appliquer sur son espace au lieu de decouper ce qui deborde
> du stroke original"*

## The revised contract

1. Envelope = GEOMETRIC pressure ribbon (`ribbonWithScales` at FULL pressure
   width) = the HARD maximum. Existing wet mass (earlier strokes inside the
   preserve box) is grandfathered: room = `union(pre-solver mass, this
   stroke's pressure ribbon)`.
2. Deposit = footprint at REDUCED radius: `radius × (1 - g(spreadCurve))`,
   `g(0) = 0`. The solver gets room to work INSIDE the envelope.
3. Physics transports mass outward into that room. That transport IS the look.
4. Clip ONLY past the pressure ribbon (rare). NEVER clip to the deposit.
5. `featherWetEdges` stays boundary-AA only (not a grower). Solver ticks stay
   `Math.ceil(spreadCurve*10)` byte-unchanged (3 at 60, 4 at 65).

- Live tier keeps the FULL radius (silhouette = the pressure envelope; live
  and finalize share it). Only the tier=final wet deposit is reduced
  (D-07: exactly one deposit feeds wet/physics).
- `g` is the UAT look lever — one form in one place (`spreadScale.depositRoom`,
  initial `g(sc) = sc`). Tune it there, never at the engine sites.

## What landed

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/core/wet-layer.envelope.test.ts` | revised — 20 pins (see below); the anti-dy0 `never-clip-to-deposit` pin is the guard |
| `packages/efx-physic-paint/src/core/spreadScale.ts` | `depositRoom` added (the `g` look lever); `spreadCurveFor` byte-identical (260925-b7c law untouched) |
| `packages/efx-physic-paint/src/core/wet-layer.ts` | `stampRibbonIntoEnvelope` added (nonzero-winding scanline fill); `featherWetEdges` / `snapshotWetAlpha` / `projectWetIntoEnvelope` / `DEPOSIT_KEEP_TIER = 70` byte-identical |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | tier=final deposit at `brushR * (1 - depositRoom(spreadCurve))` at BOTH sites; envelope = snapshot ∪ ribbon at FULL `brushR` strictly before each solver; live tier, feather calls, margin and tick arithmetic byte-unchanged |

Commits: `71fa8521` (plan) → `ab5cdc0a` (RED) → `5ba21b0f` (GREEN) → docs close.

## Implementation contract

**Envelope = room.** `envelope = snapshotWetAlpha(this.wet)` grandfathers
existing wet mass (earlier strokes inside `prepareWetLayerForStroke`'s preserve
box survive). Then `stampRibbonIntoEnvelope` marks the geometric pressure
ribbon at FULL width into the same mask (`mark = 2`, the `> 1` inside test of
`projectWetIntoEnvelope`). Pixels outside the ribbon are NEVER written by the
stamp — the mask only grows (union). `projectWetIntoEnvelope` itself is
unchanged: it clips `envelope[i] <= 1 && alpha[i] > 1` and renormalizes onto
the interior. With the room as input that is "clip only past the ribbon".

**The ribbon is always wider than the deposit.** Both come from the same
`resample(smooth(points, 3), max(3, depositR * 0.25))` curve — the exact
curve `renderPaintStroke` uses for the deposit — then `ribbonWithScales(curve,
brushR, …)` at FULL `brushR` for the envelope versus the deposit at
`depositR = brushR * (1 - g)`. Containment holds by construction (and at
re-slice boundaries `tSpan` endTaper is the same global-t law, so pickup
segments stay inside the full-stroke ribbon).

**Deposit reduction is a call-site parameter.** `paint.ts` / `stroke.ts` /
`footprintLanes.ts` are untouched (260929-t2o capsule-sweep contract LOCKED) —
the engine passes `size: depositR` to the tier=final `renderPaintStroke` and
`size: brushR` to the tier=live raster. One `depositRoom(` call per site.

**Wiring (both sites, order is the law).** Site A (interactive finalize):
`active.envelope = snapshotWetAlpha(this.wet)` → `stampRibbonIntoEnvelope(...)`
→ `createLocalFluidPhysicsContinuation(`; projection in the
`phase === 'fluid' && active.fluid?.step()` completion branch, before
`startNaturalDrying()`. Site B (synchronous local step):
`const envelope = snapshotWetAlpha(this.wet)` → `stampRibbonIntoEnvelope(...)`
→ `localFluidPhysicsStep(`; `projectWetIntoEnvelope(this.wet, envelope)` after
the `paint-local-fluid-total` observe call. A reversed or missing order
snapshots the grown state and legitimizes the growth.

## Pins (20)

| Pin | Role | RED assertion at base |
|-----|------|----------------------|
| `never-clip-to-deposit` (anti-dy0 law) | mass the solver carried INTO the room survives | green at base (the contract; the dy0 bug was the envelope SOURCE) |
| `clip-past-ribbon` (law) | mass past the ribbon is clipped (rare) | green at base |
| `existing-mass-kept` (law) | pre-solver mass outside the ribbon is grandfathered (union) | green at base |
| `feather-empty-pixels` (law) | no EMPTY-pixel grower, all six buffers, passes=6 | green at base |
| `boundary-aa` (law) | feather still blends painted boundary alpha down | green at base |
| `projectWetIntoEnvelope` | exported (typeof-first guard) | green at base |
| `renormalized` | escaped zeroed, mass conserved, interior rises | green at base |
| `identity` | zero escape → byte-identical | green at base |
| `stampRibbonIntoEnvelope` | exported (typeof-first guard) | `expected 'undefined' to be 'function'` |
| `stamp-marks-ribbon` | nonzero fill marks the interior, leaves the outside | `expected 'undefined' to be 'function'` |
| `stamp-preserves-outside` | stamping never clears pre-existing envelope mass | `expected 'undefined' to be 'function'` |
| `depositRoom` | exported; `g(0) = 0`; `g(sc) = sc` | `expected 'undefined' to be 'function'` |
| `engine-stamped` | `stampRibbonIntoEnvelope(` == 2 | `expected +0 to be 2` |
| `engine-room-lever` | `depositRoom(` == 2 | `expected +0 to be 2` |
| `engine-wired` (law) | `snapshotWetAlpha(` == 2 and `projectWetIntoEnvelope(` == 2 | green at base |
| `snapshot-before` (law) | nth-occurrence chain strictly increasing at both sites | green at base |
| `stamp-before` | stamp strictly between snapshot and solver at both sites | `expected -1 to be greater than -1` |
| `ticks-unchanged` (law) | `Math.ceil(spreadCurve * 10)` x2 — 3@60 / 4@65 / 1@50 | green at base |
| `margin-formula` (law) | `waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4` x2 | green at base |
| `feather-wired` (law) | `featherWetEdges(` x2 | green at base |

## Gates (all green, bounds unchanged)

- **RED** (`ab5cdc0a`): 20 tests / 7 failed / 13 passed — all failures
  AssertionError (0 crashes); the seven target pins RED on assertions against
  the current tree (evidence: `260930-espace-RED-EVIDENCE.json`).
- **GREEN** (`5ba21b0f`): `wet-layer.envelope.test.ts` +
  `paint.depositSourceShape.test.ts` = 32/32 (G6 `DEPOSIT_KEEP_TIER = 70` and
  `DRY_ALPHA_THRESHOLD = 1` raw-read needed zero edits).
- **Full package suite**: 33 files / 269 passed | 3 pre-existing skips
  (battery files re-ran UNCHANGED: physicsSettledFootprint,
  physicsWidthScaling, productionAaSettleMeasurement,
  depositGateFieldMeasurement, drying.continuity, paint.bristleSeed,
  paint.depositSourceShape).
- **App metrics** (`depositSpeckleCapture.metrics.test.ts`): 23/23.
- **Typecheck** `pnpm --filter efx-physic-paint run check`: 0 errors.
- **Scope guard**: the `260930-espace` commit series touches ONLY
  `wet-layer.ts`, `wet-layer.envelope.test.ts`, `spreadScale.ts`,
  `EfxPaintEngine.ts` + `.planning/quick/260930-espace-*`. Footprint files
  (`paint.ts`, `footprintLanes.ts`, `stroke.ts`), `fluids.ts`, battery files,
  ROADMAP.md, `package.json`, `pnpm-lock.yaml` all absent. `OUT_OF_SCOPE_COUNT=0`.
- **Law preservation (zero bound edits)**: PIN 0 composite `[0.99, 1.01]`,
  PIN 0b `>= 0.95`, ENVELOPE_BOUND, DEPOSIT_KEEP_TIER 70,
  DRY_ALPHA_THRESHOLD 1, LIVE_TIER_DIVISOR 4, LIVE_WIDTH_MUL 4,
  STREAK_ALPHA 0.55, WIDTH_FLOOR 0.5, RIM_WIDTH_MIN 1.0,
  CORE_MAX_TRACE_WIDTH 2, BODY_WIDTH_MIN 1.4 (R7-amended semantics), density
  ratio `>= 1.5`, SIZE excursion `<= 0.35`, gauge `<= 10%`, ink `+/- 15%`,
  spread scale (260925-b7c: new 50 = old 30) — `spreadCurveFor` byte-identical.
  STOP rule: **not triggered** — no law-vs-look conflict surfaced.
- D-03 (soft-fill) and D-09 (baked lateral alpha) did NOT apply — feather
  stays boundary AA; it does not soften the fibre fill. PIN 0 stayed COMPOSITE
  (`k_body >= 4`, `1-prod(1-ga) >= 0.99`), never per-fibre at k=1. ROADMAP
  untouched; `verify_phase_goal` / `update_roadmap` not run; no installs; no
  push; no dev server; `vitest run` only.

## Accepted tradeoff (recorded in spec 01 R8)

A hard envelope removes watercolour bleed past the stroke (capillary
wicking). If wanted later, it becomes a separate **gesture-driven lever in
52.5**, never a passive spread growth.

## Kept measure-only (NOT implemented)

Fallback if edges still read uniform after the room is restored: per-fibre
length variation and `W(t)` surviving the 2 px clamp. The footprint raster
algorithms were not touched by this act.

## Deferred to 52.5 (its actual scope, R2/R3 — not folded in)

Gesture coupling (pressure = pigment load + envelope, velocity = diffusion
distance + dry-out gaps, angle = diffusion anisotropy); charge / dry brush;
erase same-family.

## Native UAT rows — PENDING (the user's eye at spread 60-65)

- [ ] **Ref-144 relief recovered at pressure thickness** — the painterly
      relief reads at spread 60-65 (mass transport into the room), and the
      stroke width does NOT grow past the pressure-defined envelope
- [ ] **Max spread is visibly richer than min spread** (the room restored the
      look the clip destroyed)
- [ ] **Residual pixel-noise gone**
- [ ] **Felt-tip uniformity improved** — the edge reads as a brush
- [ ] Solver ticks visibly unchanged in behavior (3 at 60 / 4 at 65) — the
      #144 organic look is preserved
- [ ] `g` look lever judged — if the stroke reads too thin, reduce `g`; if the
      relief is still missing, increase it (one form in `spreadScale.depositRoom`)
- [ ] t2o rows still standing: capsule sweep / no parcellaire / rim fibres
      read / R7 look a/b/c / live-vs-finalize
- [ ] 52.4 rows a-i

Re-UAT after this corrective quick. Nothing is done until that UAT passes.

Note: the dy0 series (`3ea4e5f8..32242ccb`) and this series stay LOCAL until
the look is back — the user pushes.
