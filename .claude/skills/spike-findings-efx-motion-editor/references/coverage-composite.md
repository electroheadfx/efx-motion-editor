# Coverage Composite (opaque acrylic without the punch machinery)

Replaces the shipped rev-4 cover order — *erase the underlayer along the brush
footprint, then deposit watercolor* — with a per-dab **coverage** term composited
source-over inside the pigment layer. Origin: spike 001.

## Requirements

From the `opaque-acrylic-coverage` idea (MANIFEST.md). These bind the real build:

- The approved rev-4 cover law is not redesigned in the main tree as a side
  effect. This model replaces it deliberately, in its own plan, or not at all.
- Prior context is **read, not re-litigated**: `.planning/debug/rev4-cover-erase-lost-paint.md`
  and the `261117-tq7` summary. The four root causes catalogued there (display
  swap publishing the punched base, decode deferral race, content-memoized URL,
  stale session bookkeeping) are all artifacts of the punch architecture. The
  coverage model deletes the architecture those fixes protect — there is no
  punched base, no punch/decode ordering, no pre-stroke snapshot to go stale.
- Measurable acceptance at 1080×1080, carried from the spike as build pins:
  1. White 240 over saturated blue at Body 100 / 60 / 30 — hidden at 100, partly
     visible at 60, and **no value produces paper-white**.
  2. Red over blue, 50 rapid strokes — no drift toward black; luma ratio ≥ 0.95,
     |Δhue| ≤ 3° against a fresh stroke in the same run.
  3. No per-stroke full-canvas punch/merge.

## How to Build It

### The law

Per dab. `m` is the deposit's **own footprint mask** (same tip texture,
rotation, jitter and paper tooth as the stamp — reuse `bindFootprint` /
`FOOTPRINT_MASK`, do not write a second footprint). `Body` uses the approved
D-14 curve and gain.

```
a     = min(1, bodyCurve(Body) × 2) × (1 − exp(−K · amount · m))     K = 8
ink   ← ink   × (1 − a) + C × a          C = the dab's masstone absorbance
fixed ← fixed × (1 − a)                  the settled underlayer, same a
cover ← cover × (1 − a) + a              the compositor's layer alpha
S     ← S × (1 − a) + S_dab              scattering keeps its veil
```

`K` is the **medium's** per-dab optical density, never the pigment's. This is
the whole point: rev-4 derived the cover from `coeffsOpacity`, so a near-white
pigment (opacity ~0.06) could not cover. A medium-derived `a` covers as fully
for white as for black.

Because `C` is the masstone (concentration 1) rather than an increment,
overlapping dabs are **idempotent**: colour converges on the chosen pigment
instead of summing absorbances. That summation is what drove the drift toward
black across a long session.

### The three draws, per dab

All three are scissored to the dab rect. `bodyCoverFS` and `coverMaskFS`
already exist in the engine; only `coverDepositFS` is new.

| # | Program | Target | Blend | Effect |
|---|---|---|---|---|
| 1 | `bodyCover` (`uShape = 1`) | `ink.read` | `ZERO, ONE_MINUS_SRC_COLOR` | `ink *= (1 − a)` — all seven coefficients and S |
| 2 | `coverDeposit` (new) | `ink.read` | `ONE, ONE` | `+= C · a`; o1's alpha is the dab's scattering, added **unmultiplied** by `a` |
| 3 | `coverMask` | `cover` | `ONE, ONE_MINUS_SRC_ALPHA` | `cover = a + cover·(1 − a)` — the stroke's union |

Call `this.touch(...)` with the deposit rect exactly as `brushInk` does; the
coverage draw **is** the deposit and owes the same active/undo/dirty
bookkeeping. (The spike shipped without it first and the sim/undo state went
stale — see Investigation trail in the spike README.)

### The display

`displayFS` mode 4 becomes:

```glsl
float darkAlpha = 1.0 - tMin;
float cov = texture(uCover, uv).x;
float alpha = clamp(max(darkAlpha, cov), 0.0, 1.0);
vec3 pigment = alpha > 0.0 ? (tSrgb - vec3(1.0 - alpha)) / alpha : vec3(0.0);
pigment = clamp(pigment, 0.0, 1.0);
```

This reduces exactly to the old `(t − tMin)/alpha` when `alpha = 1 − tMin`, and
keeps the over-white identity `colour·alpha + (1 − alpha) = t` over a white
fond. The emboss keeps scaling only the premultiplied colour — the alpha is
derived from the **unshaded** reconstruction and stays byte-identical, so a lit
stroke never changes its opacity.

### Lifecycle — a new document layer

The coverage target must join **every** list together or the atlas copies the
wrong layer. The precedent is `relief` (Phase 64):

- `allocateTargets` — new target; `HALF_FLOAT_R` (2 B/texel → **2.33 MB** at
  1080²). A ping-pong pair if and only if coverage advects.
- `docTargets()` — append last, so the sheet wipe clears it.
- `allocateHistory` / `snapshotLayers` / `travel` — pool 0 gains the layer.
- resize `copy(...)` — a resized sheet keeps its coverage.
- `captureWhole` / `uploadWhole` — or a resize resets it.
- `resetSheet` / `clear` — clear to 0.

## What to Avoid

- **Do not keep the `preInk` snapshot alongside coverage.** It is 16 B/texel
  (17.8 MiB at 1080²) allocated *and* blitted per Body>0 stroke, plus a
  full-document ping-pong per dab. The coverage model needs none of it. Two
  cover mechanisms is the failure mode.
- **Do not derive `a` from the pigment.** `coverDensity(amount)` in the rev-4
  path reads the pigment coefficients. Near-white paints then never cover, and
  the "white 240 does not hide blue" bug returns unchanged.
- **Do not punch the cached base** in the app layer. The live sheet carries
  its own alpha now. Keep the normal commit composite. (`onCoverDab`,
  `punchTransmittanceBytes`, the per-frame preview punch all become dead.)
- **Do not read the p95 as a regression.** The spike's coverage engine showed a
  higher raw p95 (135 vs 56.5 ms) while being 4.1× faster at the median. A
  Body-0 control — same script, cover path off, engines byte-identical — showed
  ~100–110 ms p95 on **both** engines, and the baseline's own Body-0 p95
  exceeded its Body-100 p95. The tail is a periodic shared sim/readback stall
  landing on different frames. Compare medians and aggregate bake; do not tune
  a model against p95 on this script.
- **Do not put the Body knob on the underlayer** when probing. The first spike
  formulation did, so Body 30 turned the blue band itself into a ~1 % film and
  the crossing "read paper-white" — a probe artifact. Paint the underlayer at
  Body 0; keep the knob on the stroke under test. That is also the real
  scenario.
- **Do not sample across a stroke's alpha rim.** Rims are ~0.02 doc heights
  wide; a box spanning one averages paint with paper and invents paper-white
  failures.

## Constraints

- `K = 8`, `amount ≈ 0.08` at full pressure → `a ≈ 0.48` per dab at Body 100;
  overlapping dabs compose to the union.
- **Body now scales the paint film's opacity**, not only the erase. Body 30 is a
  ~1 % film per dab (a near-transparent glaze over bare paper). Deliberate, but
  a behaviour change that needs a UAT pass and possibly tuning.
- Measured at 1080² (headless SwiftShader, relative only): **0** full-document
  draws vs **3613**; **0** full-document blits vs **105**; **0 B** transient
  vs **+17.80 MiB**; median rapid stroke **5.8 ms vs 23.8 ms** (4.1×); total
  bake **1170 ms vs 1389 ms** (−16 %, the rest is shared sim/settle).
- Memory: one persistent `R16F` target (+2.33 MB) replaces a per-stroke
  17.8 MiB snapshot.
- Neutral identity is the hard gate: `neutral-identity` must keep
  `d2bd637a / 291d4a11 / 6ba88334`, and a 50-stroke Body-0 script must stay
  byte-identical (`2b4a86d7 / 7f56e401 / bc74be59`). Body 0 keeps the additive
  `brushInk` path untouched.
- Open in the spike, required in production: coverage does **not** advect with
  the ink, is **not** in undo history, and Lift does **not** reduce it. Decide
  each: advect (ride the wet sim as 64-14 does) or accept a static
  registration; add to the pool-0 atlas; subtract in Lift. `resetSheet`/`clear`
  do clear it.
- Textured tips share one mask by construction, so the rev-4 UAT failure mode
  (per-dab jitter unioning the erase past the paint) cannot occur — but only the
  round brush was exercised.

## Origin

Synthesized from spike: **001-coverage-composite** (`VALIDATED`).
Source files: `sources/001-coverage-composite/` — `VERDICT.md` (the number
tables), `patches/shaders.diff` and `patches/Engine.diff` (the model against
base `406d1ead1`), `probe/`, `results/`.
