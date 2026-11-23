# Spike Manifest

## Ideas

### opaque-acrylic-coverage
Can the current `efx-watercolor` engine deliver opaque acrylic coverage **without** the Body erase/punch machinery? The shipped rev-4 law erases the underlayer along the brush footprint (settled `fixed`, wet `preInk`, and the app's cached base) and then deposits watercolor. This idea tests the alternative model: a per-dab **coverage** term composited source-over inside the pigment layer, so the underlayer is hidden by the new paint's opacity rather than punched away — no per-stroke base punch, no per-dab preview punch, no commit merge, no full-document `preInk` snapshot.

**Requirements:**

- The spike runs in a throwaway workspace (`.planning/spikes/001-coverage-composite/`); the main tree's paint/cache path is never modified.
- The approved rev-4 cover law is not redesigned in the main tree; the spike bypasses it in a copied engine.
- Reuse the existing probe/vitest harness (`node probe/run.mjs`, `npx vitest run`); never watch mode; never start the dev server.
- Measurable success criteria at 1080×1080:
  1. White 240 over saturated blue at Body 100 / 60 / 30: at 100 the underlayer disappears; at 60 it is partly visible; NO value produces paper-white.
  2. Red over blue, 50 rapid strokes: no drift toward black; hue within a stated tolerance.
  3. 50 rapid strokes: no per-stroke full-canvas punch/merge; report p95 stroke latency and memory against the current build.
- Deliverable is a verdict with numbers and go/no-go — no phase plan, no quick plan, no commits to main, no push.
- Prior context is read, not re-litigated: `.planning/debug/rev4-cover-erase-lost-paint.md` and `.planning/quick/261117-tq7-.../261117-tq7-SUMMARY.md`.

### acrylic-bristle-deposit

Can the reference brush's per-bristle carrier and 5-nearest deposit be ported
into the real `efx-watercolor` engine without breaking Studio's replay model or
its budget — and what state/cost does wetness add? The contract is
`SPECS/v2.2.0-medium-engine/better-acrylic.md` plus the reverse-engineered
notes at `/Users/lmarques/Dev/craft-brushes/notes/brush-blending.md`; every
formula a follow-up plan cites must carry its notes section, and the
non-portable parts (the dual f16 buffers, the GPU compute passes) must be named
explicitly.

**Requirements:**

- The spike runs in a throwaway workbench (`.planning/spikes/002-acrylic-bristle-deposit/`); no production file changes.
- Reuse the real engine through `createAquarelleEngineAdapter` and the `probe/medium-engine` harness idiom; never the dev server.
- Return go/no-go per leg with measurements, not prose:
  1. deterministic replay — same script twice ⇒ byte-identical; if not, what state must enter the record;
  2. cost — the 5-nearest gather + per-bristle loop at 1080² and 2K, citing the 64-14/64-15 numbers;
  3. wetness — a last-touch signal from existing coverage, or a new channel with measured sheet memory + undo snapshot + frame-cache bytes.
- Every claimed formula quotes the notes' section number (§2, §3.1–§3.5, §4.1–§4.5, §5.1–§5.6, §6, §8, §9).
- State explicitly what is not portable (compute passes, dual f16 buffers, RGB smear, smudge/wipe/resample).
- Deliverable is a README with per-leg verdicts, the Studio touch points, and a proposed 64-21…64-24 slicing adjusted to what was measured.
- No commits to main and no push.

**Requirements (spike 003):**

- Keep the first-dab travel anchor (`c0ab29b2c`): the first dab's travel is 0, never the page-corner distance. Measured: that one term alone seeds 75 % of the crossed band's colour into the carried reservoir, because the core's per-dab pickup is ~0.5 % and its taps sample the stroke's own film.
- Diagnose pickup regressions by reading the carrier's per-dab terms on the real engine (`carrierPass` prototype tap + `readBristles()`), not from the final hue metric alone.

### gravity-paint-drips

Can the Studio paint engine make acrylic paint **run downward under gravity**
as small droplets — a dripping/bleeding medium the artist can dial in — without
breaking the replay model? The ask (2026-11-23): a parametrable gravity
coulure, "des petites gouttes qui coulent", on top of the shipped acrylic
deposit.

**Requirements:**

- The effect is a **gravity-driven run of discrete droplets**, not a uniform
  bleed: paint must leave the mark and travel down the sheet.
- Parametrable, four controls the artist names: **gravity strength**,
  **drip rate / frequency**, **droplet size**, and a **trigger threshold**
  (how much paint/water before a drop detaches).
- Deterministic and re-bake-parity safe: live and bake must agree, params ride
  the per-stroke recorded bag, and a key revisit never re-runs a drip
  (KEY = CACHE).
- The spike runs in a throwaway workbench (`.planning/spikes/004-…`); no
  production file changes.
- Reuse the real engine through `createAquarelleEngineAdapter` and the
  headless-Chrome harness idiom; never the dev server.
- Deliverables are verdicts with numbers, not prose: neutrality at 0, run
  direction/length vs parameter, droplet count/size, deterministic replay,
  and the bake/cache cost.

**Requirements (spike 005):**

- Compare the field tongue (spike 004) with a discrete bead model on the same
  cross scene: a droplet must leave the mark and run **ahead of** the tongue.
- The four controls must move measured geometry: gravity reach, drop count,
  drop size, and the threshold that gates a drop.
- No new render target and no new shader if the shipped splat + wet mask can
  carry the model; the bead deposit must obey the source-over dab law.
- Determinism and neutrality first: replay byte-identical, gravity 0 and a
  dry sheet byte-identical to HEAD.

**Status (2026-11-23): PARKED — not implemented.** Spike 004 validated the
field transport (PARTIAL: it cannot bead); spike 005 validated a discrete
bead model (spawn from the wet mask, beaded trail, terminal dot) but the
artist judged the drop trails insufficiently realistic and will not implement
the feature for now. Do not reopen by tuning these knobs: a genuinely new
realism model (real surface tension / free-falling mass) and the artist's go
are required. Spike 006 is not pursued.

## Spikes

| # | Idea | Name | Type | Validates | Verdict | Tags |
|---|------|------|------|-----------|---------|------|
| 001 | opaque-acrylic-coverage | coverage-composite-acrylic | standard | Given a per-dab coverage term composited source-over in the pigment layer, when white 240 is painted over blue at Body 100/60/30 and red over blue for 50 strokes at 1080², then the underlayer is hidden at 100 and partly at 60 with no paper-white and no black drift, at lower per-stroke cost than the rev-4 punch path | VALIDATED ✓ — all three criteria pass; Body-0 byte-identical; 0 full-doc draws vs 3613; 4.1× median stroke. See `001-coverage-composite/VERDICT.md` | webgl2, watercolor, acrylic, coverage, performance |
| 002 | acrylic-bristle-deposit | acrylic-bristle-deposit | standard | Given the recorded stroke script and a pinned paper seed, when a per-bristle carrier and 5-nearest deposit are replayed twice, then the exported sheets and the bristle reservoirs are byte-identical; the deposit costs a stated bake/render delta at 1080² and 2K on the real engine; and a last-touch channel's sheet/undo/cache bytes are measured | VALIDATED ✓ — go on all three legs, each conditional: determinism holds when the paper seed is pinned (today it is not — the current engine already fails it), cost +26–29 % bake on the 50-stroke passage and +36–51 % on a 256-bristle acrylic brush, wetness needs an R32F pair at +26.1 MB / +67.1 MB (sheet + undo) and 0 B cached. Frontier follow-up (2026-11-19): the gather composes with the Body-100 coverage composite — combined bake 675.5 ms at 1080² / 1.17 s at 2K (+22.5 % / +17.6 % over shipping at the same Body, +85 % / +111 % over the no-Medium build), no new GPU targets, replays byte-identical. See `002-acrylic-bristle-deposit/README.md` | webgl2, acrylic, bristles, pickup, determinism, performance |
| 003 | acrylic-bristle-deposit | pickup-collapse | standard | Given the band-p100-dry50 drag scene on the real engine, when only the first-dab travel anchor differs (c0ab29b2c vs 5b0cad17f), then the per-dab carried-hue trajectory names the single pickup-chain term behind 211 -> 78 vs 213 -> 205 | VALIDATED ✓ — the term is `uTravel` on the FIRST dab only: 314.99 px (7.61 BW at size 17 / 18.58 BW at size 4) -> pickup 0.75 -> carried hue 77.0 / 73.8 after one dab vs 0 -> 214.5 at HEAD. wet 0.969, touch 1.0, thirst identical; every later dab identical (0.0265 BW, pickup 0.003-0.009). One dab decides the stroke because the core's taps sample its own film and re-mix at ~0.5 %/dab. Gather smear live in both (0.09-0.29). See `003-pickup-collapse/README.md` | webgl2, acrylic, bristles, pickup, travel, wetness, phase-64 |
| 004 | gravity-paint-drips | gravity-run-transport | standard | Given the real engine on a wet acrylic sheet, when a gravity term drives the fluid transport, then paint leaves the stroke and runs downward with a run length that grows with the parameter, and gravity 0 is byte-identical to HEAD | PARTIAL ⚠ — neutrality PASS (all four exports byte-identical at g 0); direction PASS (paint and water move down); monotonic growth FAIL (p90 bottom -16 px at g 0.5, then -14/-13 px as the water collapses). Two named limiters: the pigment-mobility ramp `smoothstep(0.02,0.45,w)` cancels ~95 % of a gravity offset (needs its own 0.004..0.08 gate), and the advected film erodes (mass 2229 -> 995 at g 0.5, -> 480 at g 1). Field offset cannot bead: droplets need a discrete model. Cross scene (horizontal + vertical stroke, both wetted): the drip LEAVES the vertical mark — mask bottom 0.3760 dry control -> 0.3213 (g 0, water bloom) -> 0.2803 (g 1) -> 0.2412 (g 2, 240 ticks), a 41 px / 8 %-of-sheet tongue, monotone with gravity and time. **Patchy gate (artist pick, 2026-11-23):** a document-space value noise (pure function of position, no time/RNG — re-bake-safe by construction) gates gravity, so the mark drips in plaques instead of sagging uniformly. noise 1.0 @ 8 cells: tongue 25 -> 10 px at a 41 px run and better water retention (3709 -> 4746); scale 4 = fewer/larger plaques, 16 = fine grain but shorter run. The narrow-water feed is abandoned (it starves the run: bottom 0.32-0.34, a 12 px tongue that never visibly runs). Longest observed tongue: gain 0.08-0.12, 360 ticks — 72 px / 14 % of the sheet, 36-47 px wide. See `004-gravity-run-transport/README.md` and `results/contact-sheet.html` | webgl2, gravity, fluid, drips, acrylic, determinism, noise, spike-004 |
| 005 | gravity-paint-drips | drip-beading | standard | Given the real engine with the spike-004 gravity run, when a discrete bead is shed from the loaded wet head, then a droplet leaves the mark and runs ahead of the field tongue, its count/size/threshold follow the controls, and gravity 0 plus a dry sheet stay byte-identical to HEAD | NOT ADOPTED ✗ — technically validated, artist-rejected (2026-11-23): the drop trails are not realistic enough, the feature is parked and not implemented. The CPU bead list sheds from the 16-texel wet mask at a threshold, falls at gravity × beadSpeed 1.6 (outruns the tongue), and stamps a faint thread + a full drop every 0.014 doc-uv + a terminal dot, all through the shipped splat and the source-over dab law (no new target, no new shader). Cross scene, g 0.5 / 4 s: bottom 0.2959 (field-only) -> 0.0986; g 1 -> 0.0010; 73 drops over 10 s. Controls: rate 0.3 -> 5 drops (0.1240), size 0.012 -> 0.0654, threshold 0.15 -> 0.1514, speed ×1.0 -> 0.1572 (no detach). Determinism: two runs byte-identical. Neutrality: gravity 0 with beads enabled and the dry acrylic are byte-identical to HEAD, 0 beads (wet peak 0.0107 < 0.05). Cost +31 % at 512²/240 ticks (413 -> 543 ms) including the 4 KB mask readback per 333 ms wave. It is a *running* drop (fed at the wet head, drying as it falls), not a free-falling surface-tension bead. See `005-drip-beading/README.md` and `results/contact-sheet.html` | webgl2, gravity, drips, beads, acrylic, determinism, spike-005 |
