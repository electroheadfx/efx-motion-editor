---
phase: quick/261121-umu
verified: 2026-11-21T21:27:31Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - .planning/quick/261121-umu-task-decouple-the-acrylic-bristle-deposi/261121-umu-PLAN.md
  - .planning/quick/261121-umu-task-decouple-the-acrylic-bristle-deposi/261121-umu-SUMMARY.md
  - packages/efx-watercolor/probe/long-stroke/captures/after/result.json
  - packages/efx-watercolor/probe/long-stroke/captures/before/result.json
  - packages/efx-watercolor/src/playground/Engine.ts
  - packages/efx-watercolor/src/playground/bristles.test.ts
  - packages/efx-watercolor/src/playground/bristles.ts
  - packages/efx-watercolor/src/playground/brushes.test.ts
  - packages/efx-watercolor/src/playground/brushes.ts
covered_digest: "v4:sha256:72774e4d16a1ae05c29a134ddbd1ae0ca81ea27098203e4e8224052fc998dec0"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261121-umu: Decouple the acrylic bristle deposit from authored pressure — Verification Report

**Task Goal:** Add a compile-time-only per-response `pressureLink` (0..1, absent reads 1) on `BrushPreset`/`Brush`; blend the authored pen toward 1 inside `bristleContactPressure`; set `pressureLink: 0` on `bristle-flat` and `bristle-round` only; pass `b.pressureLink ?? 1` at the engine's ONE call site; leave the radius/size path, the Dry/tank law, `touchOf`, speed/attack terms, shaders and wet passes untouched.
**Verified:** 2026-11-21T21:27:31Z
**Status:** passed
**Re-verification:** No — initial verification (no prior VERIFICATION.md existed)
**Start SHA for the guardrail audit:** `a7cc74170ce71274626c5730b473b4997253f484` (plan commit); HEAD `106074578cba8a7fb05ad5dfce58456897b2330f`

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | At the acrylic bag (Dry 0, Pigment 100, size 40, `bristle-round`) pressures 0.15 and 0.4 paint CONTINUOUSLY — every one of the 12 sampled segments > 1, covered% > 0 — where the pre-change baseline painted 0 texels at 0.15 and died mid-stroke at 0.4 | ✓ VERIFIED | Independently re-ran `node packages/efx-watercolor/probe/long-stroke/run.mjs` from current source: 0.15 → covered 17.13, segments 184.42…152.35 (all > 100); 0.4 → covered 28.20, all segments > 100. Before capture (added pre-change in `3497c0705`, source had 0 `pressureLink` occurrences, never modified since): 0.15 → covered 0, all segments 0; 0.4 → covered 6.83, `segments[6] = 0.02` + zero tail from index 7 |
| 2 | Pressure 1.0 unchanged (segments, covered, load min/mean/max, bristles exactly equal to the pre-change capture), the Dry-70 control keeps its mid-stroke fade (tail 120.98 50.15 24.93 24.9 7.5, loadMean 0.05), and a light press stays THINNER: covered(0.15) and covered(0.4) < covered(1.0) | ✓ VERIFIED | Task 3 pixel gate re-executed: `JSON.stringify` equality of the full case objects at (1, 0) and (1, 70) → `PROBE GATE OK`. Thinness 17.13 < 57.11 and 28.20 < 57.11. The 1.0 rows are also mathematically forced: at authored = 1, `pen = 1 + (1-1)·(1-link) = 1` for any link |
| 3 | Every response omitting `pressureLink` renders exactly as today: 5-arg (link 1) and 4-arg return the same float (`toBe`) for p ∈ {0, 0.15, 0.3, 0.75, 1}; `BRUSH_PRESETS` states the field on exactly `bristle-flat` and `bristle-round` (both 0), on no other preset, and not in `BASE` / `CUSTOM_BASE` | ✓ VERIFIED | `brushes.ts` declares `pressureLink?: number` on `BrushPreset` (L79) with exactly two value occurrences (L575 `bristle-flat`, L583 `bristle-round`, both `0`); `BASE`→`define` window contains no match. Package suite green including `an absent pressureLink is the shipped formula, bit for bit`, `only the two acrylic responses state a pressureLink`, `BASE and CUSTOM_BASE do not state a pressureLink` |
| 4 | The link is ONE term: at link 0 the gate is independent of the authored pen (`(0.15,…,0) === (1,…,0) === (0,…,0) ≈ 0.42`) while the speed ramp (rest 1.0 → 0.42 past `BRISTLE_PRESSURE_SPEED`) and attack ramp (0.45 floor over `BRISTLE_PRESSURE_ATTACK · docShortPx`) still apply; monotone between 0 and 1; a non-finite link reads as the shipped 1 | ✓ VERIFIED | Law at `bristles.ts` L264-285: `link = Number.isFinite(pressureLink) ? clamp01(pressureLink) : 1; pen = authored + (1 - authored) * (1 - link)` (= `mix(1, authored, link)`, associated so link 1 returns `authored` exactly); speed/attack constants and ramps byte-for-byte unchanged (whole-file diff has only the JSDoc + pen-binding hunk). Pins `pressureLink 0 takes the authored pen out of the contact gate`, `… keeps the speed ramp`, `… keeps the attack ramp`, `… interpolates between the authored pressure and 1`, `a non-finite pressureLink reads as the shipped 1` all pass |
| 5 | The engine has exactly ONE `bristleContactPressure` call site passing `b.pressureLink ?? 1`; no shader/uniform/pass/target change; `shaders.ts`, `mediums.ts`, `touchOf` untouched; the Dry/tank law (`dryDistance`, `loadFactor`, `uDepletion`) and the radius/`wet` paths in `stamp()` untouched | ✓ VERIFIED | `Engine.ts` L2717 is the only call (grep: import L22 + call L2717; pin asserts one match). `contactPr` feeds only `carrierPass` (L2755), `bristleInk` (L2775), `bristleReliefPass` (L2788). `git diff a7cc74170` for `shaders.ts`, `mediums.ts`, `params.ts`, `src/bake`, `src/adapter`, `app` → empty. Engine diff is one hunk: the `contactPr` argument + a two-line comment; `wet` and `brushRadius` (which still reads the authored `pr` via `Math.pow(clamp(pr,0,1), b.pressureSize)`) unchanged |
| 6 | `buildBrush` carries the field via its `...rest` spread and `brushBridge.buildBrushForStroke` inherits it from the preset, so a stroke resolves `brushId → preset → Brush → Engine.setBrush → stamp()` with no payload, `.mce` or serializer change | ✓ VERIFIED | `buildBrush` returns `{ ...rest, tipSize, tipData, tipMean }` (unchanged); `brushBridge.presetFor → buildBrush({ ...base, tip })` → `Engine.setBrush`; `engineAdapter.ts` L411-412 calls `buildBrushForStroke(payload.brushId ?? stroke.brushId, …)` — the exact path my probe re-run exercised end-to-end (probe payload sets `brushId: 'bristle-round'`). `pressureLink` has no occurrence outside the three source files (no serializer/payload/app reference) |

**Score:** 6/6 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/efx-watercolor/src/playground/brushes.ts` | `pressureLink?` field on `BrushPreset` + two preset values | ✓ VERIFIED | L71-79 (documented compile-time-only field), L575, L583 (`pressureLink: 0` exactly on the acrylic pair); no other occurrence in the file |
| `packages/efx-watercolor/src/playground/bristles.ts` | 5th defaulted parameter, clamped + non-finite guard, exact-1 association | ✓ VERIFIED | L258-285; constants L243-249 untouched; `clamp01` L321, `mix` L363 reused |
| `packages/efx-watercolor/src/playground/Engine.ts` | ONE call site passing `b.pressureLink ?? 1`; radius/wet untouched | ✓ VERIFIED | L2714-2718; single hunk in the diff |
| `packages/efx-watercolor/src/playground/bristles.test.ts` | Pins: absent field, link-0 law, speed/attack, interpolation, non-finite, call site | ✓ VERIFIED | New block L966-1029; `ENGINE_SOURCE` loaded at L55; all pass in the suite |
| `packages/efx-watercolor/src/playground/brushes.test.ts` | Pins: preset table, `buildBrush`, `BASE`/`CUSTOM_BASE` | ✓ VERIFIED | New describe L437-469; all pass |
| `packages/efx-watercolor/probe/long-stroke/captures/before/result.json` | Pre-change five-case capture, deterministic, untampered | ✓ VERIFIED | Added in `3497c0705` (production source at that commit has 0 `pressureLink`); unmodified since; values equal the plan's pre-recorded baseline table committed at `a7cc74170` |
| `packages/efx-watercolor/probe/long-stroke/captures/after/result.json` | Post-change capture: continuous 0.15/0.4, exact 1.0 / Dry-70 | ✓ VERIFIED | Added in `106074578`; my independent re-run of the probe reproduces it **byte-identically** (`diff` clean) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `brushes.ts` preset table | `Engine.setBrush` | `presetFor(brushId)` → `buildBrush` `...rest` → `buildBrushForStroke` | ✓ WIRED | `brushBridge.ts` L84-126; adapter L411-412; probe re-run proves the chain end-to-end |
| `Engine.ts` `contactPr` | `bristles.ts` `bristleContactPressure` | single call with `b.pressureLink ?? 1` | ✓ WIRED | grep-confirmed one call site; pinned by source-regex test |
| `contactPr` | bristle consumers | `carrierPass`, `bristleInk`, `bristleReliefPass` | ✓ WIRED | Exactly three consumers (L2755, L2775, L2788); no other use in the file |
| `probe/long-stroke/probe.ts` | `brushes.ts` preset | `adapter.applyStroke` with `brushId 'bristle-round'` | ✓ WIRED | Probe imports engine + adapter source; paints through `buildBrushForStroke`, so the changed preset is exercised |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| Engine `stamp()` | `contactPr` | `bristleContactPressure(clamp(pr,0,1), s.speed, s.travelled*this.dh, this.dh, b.pressureLink ?? 1)` | Yes — real per-stroke scalar feeding three GPU passes | ✓ FLOWING |
| `Brush` at `setBrush` | `pressureLink` | `BRUSH_PRESETS` entry via `buildBrush`'s `...rest` | Yes — `bristle-flat`/`bristle-round` read 0 (`buildBrush carries the pressureLink` pin; probe behavior) | ✓ FLOWING |
| Probe report | `segments` / `covered` / loads | headless-Chrome render through the real adapter + engine (`exportCanvas('pigment')`, `readBristles()`) | Yes — not mocked; reproduced byte-identically on my rerun | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package suite (both pin files included) | `pnpm --dir packages/efx-watercolor exec vitest run` | 38 files passed; 859 passed / 8 skipped | ✓ PASS |
| Long-stroke probe from current source | `node packages/efx-watercolor/probe/long-stroke/run.mjs` | identical table to `captures/after/result.json`; `diff` byte-clean | ✓ PASS |
| Targeted app consumers over the rebuilt package | `pnpm --dir app exec vitest run src/components/physic-paint/view/aquarellePresetSelection.test.ts src/components/physic-paint/view/brushGroupMedium.test.ts` | 2 files, 31 tests passed | ✓ PASS |
| Dist rebuild is current | `dist/index.mjs` mtime 22:23:27 > last source edit 22:22:28; dist contains the 5-arg law and `b.pressureLink ?? 1` call | ✓ PASS | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `probe/long-stroke` (declared evidence surface) | `node packages/efx-watercolor/probe/long-stroke/run.mjs` | exit 0; 0.15 covered 17.13 / all segments > 100; 0.4 covered 28.20 / all > 100; 1.0 and 1.0+Dry 70 equal to before | ✓ PASS |
| Task 1 baseline gate over `captures/before/result.json` | the plan's node gate | `BASELINE OK` | ✓ PASS |
| Task 3 pixel gate over after vs before | the plan's node gate | `PROBE GATE OK` | ✓ PASS |

### Untouched-Law / Guardrail Audit (`git diff a7cc74170`)

Changed paths outside `.planning/`: exactly the five source/test files plus the two new captures. Empty diff for `packages/efx-watercolor/src/playground/shaders.ts`, `mediums.ts`, `params.ts`, `src/bake`, `src/adapter`, and `app`. The `bristles.ts` diff contains only the JSDoc addition and the `pen` binding (constants, `speedRamp`, `attackRamp`, `touchOf` and every other function untouched). The `Engine.ts` diff contains only the `contactPr` argument plus a comment. No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) in any changed file; no stub patterns in added lines.

RED-first provenance: commit order is `3497c0705` (test pins) → `13906a9f1` (source fix) → `106074578` (after probe). `/tmp/umu-red.log` records exactly the 7 link-dependent failures / 85 passes on the untouched source, matching the SUMMARY.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None | — | No debt markers, no stubs, no empty implementations in added lines |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| — | — | Plan declares `requirements: []`; quick tasks carry no REQUIREMENTS.md ids | N/A | — |

### UAT rows — APPROVED 2026-11-21

The artist ran native UAT and approved the acrylic law (quick 261121-umu plus the follow-up speedLink fix `0e41c0d6a`).

| Row | Surface | Expected | Result |
|-----|---------|----------|--------|
| (a) | Studio, acrylic Bristle Round/Flat, Dry 0 / Pigment 100 — very light press | Continuous line, thinner than a full press | ✓ approved |
| (b) | Same bag — full press | Unchanged shipped look | ✓ approved |
| (c) | Same bag — fast gesture | **Superseded by the 2026-11-21 artist ruling:** hand speed no longer thins or fades the acrylic family (`speedLink: 0`); fast paints like slow | ✓ approved as changed |
| (d) | Same bag — Dry 70, long stroke at full pressure | Still fades mid-stroke (Dry curve untouched) | ✓ approved |

### Scope note on independent re-execution

Per the orchestrator's directive, the 280-file `app/src/components/physic-paint` suite was not re-run in full; the plan's gate is source + package suites + probe. Two acrylic-facing app test files (31 tests) were run over the rebuilt dist and pass; the adapter and app trees are untouched by the diff.

### Gaps Summary

None. All six must-have truths are verified in the codebase, both probe gates pass against recorded evidence, the recorded after capture reproduces byte-identically from the current source, the package suite is green, and the guardrail audit shows exactly the five expected source files plus two evidence captures changed.

---

_Verified: 2026-11-21T21:27:31Z_
_Verifier: Claude (gsd-verifier)_
