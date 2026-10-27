---
phase: quick-261027-klx
plan: 261027-klx
status: complete
verification: human_needed
date: 2026-10-27
waves: 7
fix_passes: 1
commits:
  - fadbbb3d
  - 98b2e50e
  - d39865bc
  - 7474b941
  - 22d0a8e9
  - 2ac6cebc
  - 79ca9804
  - c6edcf58
  - 7622f6a8
  - ee7a3db9
  - 5effa5e3
  - a57e0279
  - 5330b441
  - d593af19
  - 4e6ad914
  - b148d5c0
---

# Quick 261027-klx — Remove the engine-1 Brush module

**Outcome:** `@efxlab/efx-physic-paint` and every Brush runtime path are gone;
`@efxlab/efx-watercolor` is the only paint engine. The Studio compiles and the
full automated gate set is green. **Native UAT is pending** — this report is
automated-ready only.

## Wave outcomes

| Wave | Commit | Files | Lines | Gate |
|---|---|---:|---:|---|
| 0 — ledger, paper parity, local types | `d39865bc` | 17 | +1,722 / −35 | 75/75 tests, typecheck 0 |
| 1 — package and config | `22d0a8e9` | 95 | +17 / −32,967 | MANIFEST 0; 30/30 tests; census bounded |
| 2 — dedicated app deletes | `79ca9804` | 21 | +264 / −8,025 | 28/28 tests; census 61 → 49 |
| 3 — shared rewrite (Roto, script, SNAP v5) | `7622f6a8` | 45 | +2,217 / −4,266 | 824/824 tests; watercolor green; census 17 |
| 4 — Studio/UI surface | `5effa5e3` | 34 | +1,226 / −3,433 | **typecheck 0**; 425/425 tests |
| 5 — Rust script library | `5330b441` | 6 | +81 / −141 | cargo green; G4 = 0 |
| 6 — full gates | `4e6ad914` | 16 | +344 / −192 | every full gate green |
| 6.1 — reviewed blockers | `b148d5c0` | 8 | +671 / −136 | 114/114 fix tests; full gates re-run |

Aggregate code change: **+6,542 / −49,195** across the eight code commits.

## Deleted and edited files

**Deleted (105 files):**
- 88 tracked files in `packages/efx-physic-paint` (production, tests, demo,
  LICENSE/README/configs; 34,956 tracked lines).
- 16 app modules/tests: `brushScriptRecordState`, `brushScriptEditionPort`,
  `brushScriptHydration`, `BrushScriptOverlay`, `BrushModuleSection`,
  `depositSpeckleCapture` + its metrics test, `scriptMemoryProbe`,
  `lookDeltaCapture`, `EfxPaintCanvas.lifecycle.test`,
  `preSplitGoldenFixture`, `preSplitGoldenParity.test`, and the split-away
  erase-only temporary-erase test.
- `stackOrder.parity.test.ts` (proof retired after Wave 0).

**Edited (111 surviving files, unique):** the app-owned ledger/port/truth
table/paper conditioner/paint types, the Roto layer and Roto script stack,
SNAP codec/controller, performance instrumentation, the Studio shell and UI
gate, the Rust script library, and the shared-stroke helpers
(`recordedStrokeGroups`, `aquarelleStrokeBridge`, clipboard projection).

**Kept, deliberately:** `physicsPaintTemporaryErase.ts` (Move arm only, zero
engine-1 imports), `efx-watercolor`, `efx-paint-host`, `efx-spectral`, the
Aquarelle layers, `ScriptStrokeOverlay`, `recordedStrokeGroups`,
`BrushesDocker`, `BrushResponsePanel`, `WatercolorBrushLibrary`,
`aquarelleRecordState`, the p5.brush inline FX modules, and the Tauri window
label/capability `efx-physic-paint`.

## Grep census — before → after

| Gate | Before | After |
|---|---:|---|
| G1 line hits (`@efxlab/efx-physic-paint`) | 91 (73 files) | **G1-prod = 0**; G1-tests = 12 hits / 5 files, all negative guards / refusal rows / comments |
| G2 (`brushScript\|BrushScript`) | 1,146 (23 files) | **0** |
| G3 (`ROTO_SCRIPT_ENGINE_ID\b`) | 12 | **0** |
| G4 (`SCRIPT_ENGINE_ID\b`, Rust) | 5 | **0** |
| G5 (`efx-physic-paint`, app) | 132 | **46 hits / 17 files**, all allowlisted (window label, legacy refusal, negative guards, comments / scan-root) |
| Files with a real engine-1 import | 60 | **0** |

The measure split: G1 is scoped to runtime source because the plan
deliberately keeps the literal in negative-guard and legacy-refusal tests;
every test hit is enumerated in the W6 summary.

## Studio chunk — before → after

| Point | Bytes |
|---|---:|
| Original baseline (12:04, pre-k6j) | 943,411 |
| Re-pinned after k6j (16:11) | 951,043 |
| Wave 0 (required null seam) | 951,080 |
| Wave 6 | 910,611 |
| **Final (Wave 6.1)** | **911,432** |

Net vs the Wave 0 baseline: **−39,648 bytes (−4.17%)**; vs the original
943,411: −31,979 (−3.39%). The 2,000 kB `chunkSizeWarningLimit` is unchanged.

**The 650–700 KB target was not met.** The engine-1 package's own built chunk
(252 KB per the inventory) is gone from `app/dist`; the Studio chunk itself
was not where most of that weight lived. `app/dist` now holds a 1.55 MB main
`index-*.js`, the 911 KB Studio chunk, and small helper chunks. No further
bundle optimization was in scope.

## Full gate outputs (Wave 6 + 6.1, re-run)

- `pnpm --dir app run typecheck` — **exit 0**.
- `pnpm --dir app exec vitest run` — **343 files passed / 2 skipped;
  6,069 passed / 1 skipped / 96 todo**.
- `pnpm --dir packages/efx-watercolor run check` — 0;
  `vitest run` — **136 passed / 4 skipped**; `build` — 0.
- `pnpm --dir app run build` — 0; Studio chunk **911,432 bytes ≤ 951,080**.
- `cargo test --manifest-path app/src-tauri/Cargo.toml` — **188 tests / 10
  suites, 0 failed**.
- Static gates — **G1-prod = G2 = G3 = G4 = 0**; G1-tests and G5 allowlisted
  and enumerated; do-not-delete probe **21/21**.
- Verification — **9/9 must-haves VERIFIED**, status `human_needed`.
- Code review — **2 blockers fixed**; 4 warnings and 3 info items deferred.

## Native UAT rows (automated-ready only — not executed)

1. Studio opens **Water color only**; no Brush slot/tab/rail/canvas; lower
   memory than the engine-1 build.
2. Paint / select / move / delete / undo / redo — no lost or duplicated
   strokes.
3. Roto keys + **Play Script Apply** — watercolor-only, correct baked frames,
   multi-brush Apply settles.
4. Save / close / reopen / navigate + an old v1–v4 project — SNAP v5 restores
   watercolor + anchors + durable bases; one clean-break notice; pixels
   unchanged; no brush seeding.
5. Script library — watercolor scripts load; an old Brush script shows as a
   refused legacy row without a crash.
6. Composite / export — unchanged.
7. Devtools memory — no engine-1 allocations; Studio chunk 911,432 bytes.

## Code-review outcome

Fixed in `b148d5c0`:
- **CR-01** Roto Copy→Apply deadlock on the synchronous ledger — the accepted
  id/target is now registered through an `onAccepted` seam before completion
  listeners run; a real-ledger multi-brush burst test settles.
- **CR-02** session-global ledger capture — Copy/Save are now frame-scoped
  from the watercolor truth source; navigation, track switch, restore and
  Trash are pinned.
- **WR-02** `isEmpty` computed pre-increment.
- **WR-06** `getRotoPort` merges seams.

Deferred, non-blocking:
- **WR-01** listener exceptions are not isolated.
- **WR-03** Rust `validate_brush_pack` does not require
  `kind == efx-watercolor`.
- **WR-04** Rust counts Dry markers as brushes (library/picker/Reveal counts).
- **WR-05** ledger `setInputLocked` has no production reader.
- **IN-01** dead ledger/clipboard APIs; **IN-02** unread `guideProxy` field;
  **IN-03** duplicate `shouldPersistRotoFrame`.

## Open decisions and findings

1. **Chunk target miss** — 911,432 bytes vs the 650–700 KB expectation. The
   engine-1 chunk is removed; the Studio-chunk expectation was miscalibrated.
2. **D9 behavior** — library save and reveal bake **fail closed** when a
   script has no watercolor wash timeline (rather than writing an empty
   capture). Worth watching in UAT row 5.
3. **Pre-existing, out of scope** — the feature-enabled Rust
   `capability_split_denies_standalone_filesystem_authority` fails on
   `dialog:allow-open` from Phase 49 against a stale 2026-07 assertion. The
   plain cargo gate is green.
4. **Numeric mutation-ID identity with engine-1 is waived** — the ledger pins
   monotonic/never-reused ids seeded from the restored max + 1, acceptance
   order == stroke-end order, SNAP round-trip stability, same-then-consume
   targets, and synchronous completion. The three disappearing ID sources are
   cited in the W0 summary.
5. **`activeModule`** stays typed `'watercolor'` (signal deletion is a later
   cleanup); the `WATERCOLOR_ONLY` seam is gone.
6. **Studio/UI** — the temporary-erase module survives for the Water color
   Select tap with a stable no-op engine shim; the Brush cursor overlay was
   removed (Water color owns its DOM ring).

## Commits

Planning: `fadbbb3d`, `98b2e50e`.
Code: `d39865bc`, `22d0a8e9`, `79ca9804`, `7622f6a8`, `5effa5e3`,
`5330b441`, `4e6ad914`, `b148d5c0`.
Docs: `7474b941`, `2ac6cebc`, `c6edcf58`, `ee7a3db9`, `a57e0279`,
`d593af19` (+ the final docs commit).

No push. pnpm only. `vitest run` only. The dev server was never started.
