---
phase: "56"
slug: "efx-watercolor-engine-2-paint-aquarelle-clean-room"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-02"
---

# Phase 56 — Validation Strategy

> **Reconstructed 2026-11-02 (State B).** Phase 56 executed and closed its live
> UAT on 2026-10-21 without a VALIDATION.md. This audit rebuilds the
> requirement → pin map from the 11 plans/summaries and re-runs every surviving
> pin against the live tree. Pins added by this audit are marked **(audit)**.
>
> Requirement IDs were later re-scoped by user-approved quicks (MOD-01/02/06 —
> see [Superseded requirements](#superseded-requirements)). One implementation
> gap was found and escalated: PAPER-03's undo leg.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `app/vitest.config.ts` — collects `src/**/*.test.ts` + `../packages/efx-paint-host/src/**/*.test.ts`. `packages/efx-watercolor` and `packages/efx-spectral` run under Vitest defaults via their own `test` scripts. |
| **Quick run command** | `cd app && pnpm exec vitest run <file>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` · `pnpm --filter @efxlab/efx-watercolor test` · `pnpm --filter @efxlab/efx-spectral test` |
| **Estimated runtime** | ~90 s app suite (300+ files), <1 s watercolor package, <1 s spectral package |

Environment notes:

- `.test.tsx` files are **not** collected by the app config. Component pins use
  `*.test.tsx.test.ts` launcher files (project law: Vitest collects only
  `.test.ts`). Every component pin below names its launcher.
- The two WebGL2 describes in `engineAdapter.test.ts` skip cleanly in headless
  (8 tests). Project law (`feedback_live_evidence_over_unit_probes`): native
  live UAT owns anything crossing WebGL; the skips are environment-gated, not gaps.
- Never run Vitest in watch mode — always `vitest run`.

---

## Sampling Rate

- **After every task commit:** targeted file run (quick command above)
- **After every plan wave:** full app suite + both package suites
- **Before `/gsd-verify-work`:** full suite must be green
- **Max feedback latency:** ~2 s (package pins) / ~90 s (app suite)

---

## Per-Task Verification Map

Requirement-level rows (the plans declare requirements, not stable task IDs).
Wave numbers follow ROADMAP §Phase 56.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 56-01 | 01 | 1 | AQUA-06 | — | N/A | unit | `pnpm --filter @efxlab/efx-watercolor test src/determinismContract.test.ts` | ✅ | ✅ green |
| 56-01/09 | 01, 09 | 1, 4 | DATA-04 | — | Every `.mce` field declared in BOTH TS and Rust | source-scan | `cd app && pnpm exec vitest run src/lib/mceFieldContract.test.ts` | ✅ | ✅ green |
| 56-02 | 02 | 1 | MOD-01 | — | N/A (superseded) | unit | `cd app && pnpm exec vitest run src/components/shared/ModuleSwitcher.test.tsx.test.ts` | ✅ | ✅ green |
| 56-02 | 02 | 1 | MOD-02 | — | N/A (superseded) | unit | `cd app && pnpm exec vitest run src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts` | ✅ | ✅ green |
| 56-02 | 02 | 1 | MOD-03 | — | ONE shared script/cache/timeline — no per-module fork | source-scan | `cd app && pnpm exec vitest run src/components/physic-paint/roto/singleStudioEngine.test.ts` **(audit)** | ✅ | ✅ green |
| 56-02 | 02 | 1 | MOD-06 | — | N/A (superseded) | unit | `cd app && pnpm exec vitest run src/components/shared/ModuleSwitcher.test.tsx.test.ts` | ✅ | ✅ green |
| 56-03 | 03 | 2 | AQUA-01 | — | N/A | unit + live (A3) | `pnpm --filter @efxlab/efx-watercolor test src/engine/fluid.test.ts` | ✅ | ✅ green |
| 56-03/07 | 03, 07 | 2–3 | AQUA-02 | — | N/A | unit | `pnpm --filter @efxlab/efx-watercolor test src/engine/fluid.test.ts` · `cd app && pnpm exec vitest run src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts` | ✅ | ✅ green |
| 56-04/07 | 04, 07 | 2–3 | AQUA-03 | T-56-10 | Magic-sniff import, named failure, never a throw | unit | `pnpm --filter @efxlab/efx-watercolor test src/brushes/pack.test.ts` · `cd app && pnpm exec vitest run src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts` | ✅ | ✅ green |
| 56-07/11 | 07, 11 | 3, 5 | AQUA-04 | — | N/A | unit | `cd app && pnpm exec vitest run src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts` · `pnpm --filter @efxlab/efx-watercolor test src/adapter/engineAdapter.test.ts` | ✅ | ✅ green |
| 56-06/08/11 | 06, 08, 11 | 3–5 | AQUA-05 | — | N/A | unit + integration | `pnpm --filter @efxlab/efx-watercolor test src/payload/codec.test.ts src/bake/aquarelleBake.test.ts` · `cd app && pnpm exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` | ✅ | ✅ green |
| 56-06 | 06 | 3 | AQUA-06 | — | Zero unseeded RNG in engine/payload | unit + source-scan | `pnpm --filter @efxlab/efx-watercolor test src/determinismContract.test.ts src/payload/codec.test.ts` | ✅ | ✅ green |
| 56-08 | 08 | 4 | AQUA-07 | T-56-24 | Flush-survives-navigation; cancelled turn never commits | unit + integration | `pnpm --filter @efxlab/efx-watercolor test src/bake/aquarelleBake.test.ts` · `cd app && pnpm exec vitest run src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` | ✅ | ✅ green |
| 56-08/10/11 | 08, 10, 11 | 4–5 | AQUA-08 | — | Alpha 0 where unpainted; A1–A5 accepted | unit + live | `pnpm --filter @efxlab/efx-watercolor test src/bake/aquarelleBake.test.ts src/engine/raster.test.ts` + UAT rows A1–A5 | ✅ | ✅ green (live 2026-10-21) |
| 56-05 | 05 | 2 | PAPER-01 | — | N/A | unit | `pnpm --filter @efxlab/efx-watercolor test src/papers/papers.test.ts` | ✅ | ✅ green |
| 56-05 | 05 | 2 | PAPER-02 | — | One `applyPaperPass` seam; no cache path touched | unit + source-scan | `cd app && pnpm exec vitest run src/stores/physicPaintStore.paper.test.ts src/lib/paperPass.frameGuard.test.ts` | ✅ | ✅ green |
| 56-05 | 05 | 2 | PAPER-03 | T-260923-01 | Clamped write; revision-stable no-op; token rotation for save | unit | `cd app && pnpm exec vitest run src/stores/physicPaintStore.paper.test.ts` | ✅ | ⚠️ partial — undo leg escalated |
| 56-05 | 05 | 2 | PAPER-04 | — | Real ids resolve on the shared image path | unit | `pnpm --filter @efxlab/efx-watercolor test src/papers/papers.test.ts` · `cd app && pnpm exec vitest run src/lib/projectPaperRaster.test.ts src/components/physic-paint/view/PaperPicker.test.tsx.test.ts` | ✅ | ✅ green |
| 56-09 | 09 | 4 | MOD-04 | — | `brushPack` is a two-language `.mce` field | unit | `pnpm --filter @efxlab/efx-watercolor test src/brushes/pack.test.ts` · `cd app && pnpm exec vitest run src/lib/mceFieldContract.test.ts` | ✅ | ✅ green |
| 56-09 | 09 | 4 | MOD-05 | D-12 | Named refusal both directions; zero writes on refusal | unit | `cd app && pnpm exec vitest run src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` · `pnpm --filter @efxlab/efx-watercolor test src/payload/codec.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/partial*

### Audit run evidence (2026-11-02)

| Suite | Command | Result |
|-------|---------|--------|
| Watercolor package | `pnpm --filter @efxlab/efx-watercolor test` | 12 files, **187 passed**, 8 skipped (WebGL2), 0 failed |
| Spectral package | `pnpm --filter @efxlab/efx-spectral test` | 1 file, **3 passed** |
| Paper / `.mce` / refusal | `cd app && pnpm exec vitest run src/stores/physicPaintStore.paper.test.ts src/lib/mceFieldContract.test.ts src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` | 3 files, **29 passed** |
| Module shell | `cd app && pnpm exec vitest run src/components/shared/activeModule.test.ts src/components/shared/ModuleSwitcher.test.tsx.test.ts src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts` | 4 files, **37 passed** |
| Aquarelle UI + bake | `cd app && pnpm exec vitest run src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts src/components/physic-paint/view/BrushesDocker.test.tsx.test.ts src/components/physic-paint/view/PaperPicker.test.tsx.test.ts src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.bake.test.ts` | 5 files, **63 passed** |
| MOD-03 pin (audit) | `cd app && pnpm exec vitest run src/components/physic-paint/roto/singleStudioEngine.test.ts` | 1 file, **6 passed** |

---

## Wave 0 Requirements

- [x] Existing infrastructure covers all phase requirements — no framework install, no fixtures, no stubs were needed.
- [x] Package suites (`@efxlab/efx-watercolor`, `@efxlab/efx-spectral`) run under Vitest defaults from the pre-existing workspace.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A3 — wet-in-wet bloom and tide line visible in baked frames | AQUA-01 / AQUA-08 | Live visual judgment through the WKWebView rasterizer; unit probes are blind to it (`feedback_live_evidence_over_unit_probes`) | `56-UAT.md` row 3 — **PASSED 2026-10-21** (no forced Dry at frame boundaries) |
| A4 — two independent cache ranges, no cross-talk | AQUA-08 | Cache-path/disk inspect, not a unit assertion; overlapping ranges out of scope | `56-UAT.md` row 4 — **PASSED 2026-10-21** |

A1 (save/load pixel stability), A2 (bake idempotence) and A5 (export
transparency) were also run live on 2026-10-21 and additionally carry
automated pins (`codec.test.ts`, `aquarelleBake.test.ts`, `engineAdapter.test.ts`,
`raster.test.ts`).

---

## Escalated / Open Items

| Requirement | Gap | Evidence | Required Follow-Up |
|-------------|-----|----------|--------------------|
| PAPER-03 | **Undo leg unimplemented.** Paper display edits participate in save but never enter the undo ledger. | `physicPaintStore._writePaperDisplay` (`app/src/stores/physicPaintStore.ts:1802-1810`) calls `setBackgroundFallback` and keeps only `wrote.ok`; the returned `BackgroundEditDescriptor` (`{before, after}`, `efxPaintStore.ts:1056-1064`) is discarded. `setPaperId/Strength/Scale` (`physicPaintStore.ts:3538-3547`) return `boolean`. The Studio paper callbacks (`PhysicsPaintStudio.tsx:2632-2666`) never call `rotoMoveHistory.recordBackgroundEdit` — unlike background edits at `:4518`, `:6304`, `:6789`, `:6843`, `:10414`. | Propagate the descriptor out of the paper setters and record it in the three Studio callbacks as ONE undo step per edit; then add a regression pin (undo restores `before`). No failing test was added — a red pin would have broken the phase's green gate before the fix exists. |

---

### Superseded requirements

MOD-01, MOD-02 and MOD-06 described a three-slot `Brush | Water color | Krita`
module switcher. That law was deliberately retired after Phase 56 closed:

- **quick 261027-gh9** — watercolor-only UI gate (WATERCOLOR_ONLY seam); **UAT approved**.
- **quick 261027-klx** — engine-1 Brush module removed; `@efxlab/efx-watercolor` is the only engine; **UAT approved 2026-10-27**.

The live single-module law is pinned by `activeModule.test.ts`,
`ModuleSwitcher.test.tsx` and `panelSplitShell.test.tsx` (rows above). No test
was written for the retired three-slot behavior — that would pin a product
state the user explicitly removed.

---

## Validation Sign-Off

- [x] All 19 phase requirements have an automated pin or a named reason
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infrastructure)
- [x] No watch-mode flags (`vitest run` everywhere)
- [x] Feedback latency < 90 s (full app suite), < 2 s (package pins)
- [ ] `nyquist_compliant: true` — **not set**: PAPER-03's undo leg is escalated (see above)

**Approval:** pending human review — audit complete 2026-11-02
