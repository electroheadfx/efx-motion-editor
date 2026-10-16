---
status: complete
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 56-10
source: [56-10-PLAN.md]
started: 2026-10-16T05:16:25Z
updated: 2026-10-16T05:25:00Z
---

# Phase 56 Close — Must-Haves Checklist (AQUA-08 / R3.6)

**Purpose:** Phase-close suite gate + acceptance-row staging for live UAT.
**Evidence policy:** Live/disk over unit probes for anything crossing WebGL or Tauri (`01-gsd-context.md` §8). Determinism rows may use golden WebP hashes; the look row (A3) needs native visual UAT and cannot be closed by unit tests.

## Automated gates (this plan's verify)

| Gate | Command | Result |
|------|---------|--------|
| Full vitest suite | `pnpm --filter efx-motion-editor exec vitest run` | **PASS** — 293 files passed, 2 skipped; 5129 tests passed, 1 skipped, 96 todo; 0 failed |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | **PASS** — exit 0, zero errors |

Suite-gate regressions found and fixed in this plan before the green run (see 56-10-SUMMARY deviations):

1. `PhysicsPaintPalette.test.ts` / `PhysicsPaintRightPanel.test.ts` — lucide-preact mocks lacked `Paintbrush`/`Droplet`/`Pen`/`Eraser` pulled in by 56-02 `WatercolorModuleSection` → `AquarelleToolRow` / `BrushesDocker`.
2. `efxPaintCleanBreakContract.test.ts` (D-19) — `PaperPicker.tsx` used `canvas.toDataURL()` for 64×64 picker relief thumbs. Replaced with ImageData cache + cell `<canvas>` paint (no frame-transport base64).
3. `PhysicsPaintStudio.test.ts` (49-04 pin) — source-scan still expected `mode: BgMode` after 56-05 widened the handler to `StudioBackgroundMode`.
4. `PhysicsPaintRightPanel.test.ts` (260930-ni6 pin) — `label="Blending"` / `id="physics-pickup"` moved to `BrushModuleSection.tsx` in the 56-02 panel-split; pin retargeted to the control's new home.

## must_haves truths

| # | Truth | Automated status | Live UAT row | Notes |
|---|-------|------------------|--------------|-------|
| A1 | record → save → load → play reproduces the marks (pixel-stable bake) | SUPPORTED | A1 (PENDING) | Golden WebP hash compare in the live batch. Pins: `determinismContract.test.ts`, `codec.test.ts` record→serialize→parse→replay, `engineAdapter.test.ts` byte-identical pixels |
| A2 | two plays of one script bake identical WebP | SUPPORTED | A2 (PENDING) | Pins: `aquarelleBake.test.ts` "two fresh bakes of the same script produce identical bytes"; `determinismContract.test.ts` traceSeed law + zero `Math.random` |
| A3 | wet-in-wet bloom and tide line visible in the baked frames (not killed at a frame boundary) | **NOT closable by unit tests** | A3 (PENDING — LIVE visual) | Fluid core (56-03) + paper pass (56-05). P4: no forced Dry at frame boundaries during UAT playback |
| A4 | script applied twice at different timeline ranges → two independent cache ranges (no cross-talk) | NOT unit-pinned (cache-path/inspect) | A4 (PENDING) | Touching ranges only; overlapping ranges out of scope |
| A5 | export of the baked range has transparent background where paint is absent | SUPPORTED | A5 (PENDING) | Pin: `aquarelleBake.test.ts` "baked frames have alpha 0 in unpainted regions (AQUA-08)". Live row inspects the export file alpha |
| G1 | Full suite + typecheck green before UAT is staged | **PASS** | — | See automated gates above |

**No behavior left unverified without a reason.** A3 is explicitly a live-judgment row (project law `feedback_live_evidence_over_unit_probes`). A4's independence is a cache-layout inspect, not a unit assertion.

## Supporting pin inventory (Phase 56 engines)

| Area | Pin | What it locks |
|------|-----|---------------|
| Fluid determinism | `packages/efx-watercolor/src/engine/fluid.test.ts` | same stroke + same traceSeed → identical buffer bytes |
| Adapter determinism | `packages/efx-watercolor/src/adapter/engineAdapter.test.ts` | two fresh applyStroke/stepTick/captureFrame runs → byte-identical pixels |
| Codec round-trip | `packages/efx-watercolor/src/payload/codec.test.ts` | record → serialize → parse → replay byte-identical (AQUA-06) |
| Bake idempotence | `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` | two fresh bakes of one script → identical bytes |
| Bake transparency | `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` | baked frames alpha 0 in unpainted regions (AQUA-08) |
| Bake host survival | `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` | flush-survives-navigation turns; dispose never orphans a turn |
| Dry event order | `packages/efx-watercolor/src/bake/aquarelleBake.test.ts` | Dry fires in recorded order between stroke turns (D-15) |
| Unseeded RNG scan | `packages/efx-watercolor/src/determinismContract.test.ts` | zero `Math.random` / `crypto.getRandomValues` in engine + payload |
| Paper display state | `app/src/lib/mceFieldContract.test.ts` | paper id/strength/scale declared TS + Rust (DATA-04) |
| Cross-engine refusal | `app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` | named visible refusal, never half-apply (MOD-05 / D-25) |

## Flagged assumptions (from plan)

- **A2 adjacency:** identical WebP bytes means the same encoder settings — golden hashes are captured under one encoder version.
- **A4 adjacency:** two applies at touching (not overlapping) ranges stay independent; overlapping ranges are out of scope for this row.
- **A5 empty:** exporting an empty range is a no-op export, not an error.
- **AQUA-08 concurrency:** UAT runs are serial; no two UAT sessions share one cache directory.

## Prohibitions (carried into UAT)

- **P4:** No forced Dry at frame boundaries during UAT playback — if bloom dies at a boundary the row fails.
- **Project law:** No claiming done before live UAT — automated-ready is the verdict until A1–A5 are user-asserted.

## Verdict

**automated-ready.** Gates green; rows A1–A5 staged in `56-UAT.md` for the end-of-phase human batch. AQUA-08 closes only when the user asserts A1–A5 (A3 as live visual).
