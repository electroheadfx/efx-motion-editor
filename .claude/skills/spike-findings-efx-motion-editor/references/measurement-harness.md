# Measurement Harness (real engine in headless Chrome)

How to get trustworthy pixel and cost evidence out of `efx-watercolor` without a
dev server. Established across spikes 001 and 002; matches the committed
`probe/medium-engine` gate.

## Requirements

- **Pixel truth comes from the real engine, never a mock.** A CPU
  re-implementation of a shader law is not evidence. Run the vendored
  `WatercolorEngine` through the real `createAquarelleEngineAdapter`, in real
  WebGL2.
- **Never the dev server.** The user runs the app on their side.
- **One engine per process** for any timing gate.
- **Reproducible byte for byte**: seeded RNG, fixed paper, fixed script, fixed
  mutation ids.
- `npx vitest run` if and only if the evidence is the app/package suites —
  never watch mode.

## How to Build It

### Layout

```
NNN-spike/
  workbench/            a THROWAWAY copy of packages/efx-watercolor/src
    node_modules/@efxlab/*  -> symlinks to the repo workspace packages
  probe/
    probe.ts            scenario + instrumentation (bundled)
    index.html          boots the probe, writes JSON into <pre id="result">
    run.mjs             driver: chrome flags, esbuild, DOM parse
  results/<gate>.json   one file per gate
```

Do **not** commit `probe.bundle.js` — it is an esbuild artifact (~500 KB).
Bundle from the root `node_modules` with `esbuild --format=iife`.

### Driver

```bash
chrome --headless=new --enable-unsafe-swiftshader \
       --allow-file-access-from-files --dump-dom <page>
```

`probe.ts` writes one JSON object into `<pre id="result">`; `run.mjs` parses it
out of the dumped DOM. `--engine baseline` imports `packages/efx-watercolor/src`
**read-only**; `--engine <variant>` imports the patched copy. Same scripts, same
seeds, same size — the only differing input is the model.

One gate per invocation, named `--gate <name>`, results to
`results/<name>.json`. A `--matrix` flag to sweep the whole table is worth the
20 seconds.

### Instrument at the GL boundary

Patch these on the `GL` wrapper for **both** engines, so a comparison is
apples-to-apples:

| Hook | Counts |
|---|---|
| `GL.target` / `disposeTarget` | GPU target bytes allocated, disposed, live, **peak** |
| `GL.draw` | total draws vs **full-document** draws (no scissor, doc-sized target) |
| `GL.blit` | **full-document** blits |

Measure; never infer cost from reading the code. Also reset the peak at script
start: setup-time scratch (a paper field, say) otherwise gets attributed to
painting.

### Prove neutrality first

Before trusting any differing number, run a control where the models must agree
and require **byte-identical** digests:

- the committed `neutral-identity` script (256²), and
- a full-length script with the new path disabled (Body 0 for a cover feature;
  bristle mode off for a deposit feature).

If those are not identical, the harness — not the model — is what you are
measuring. Additionally, cross-check one baseline capture against a committed
gate's published digest (spike 002 reproduced 64-14's `7f56e401` / `432f3a3f`
exactly; that is what says "this is the real engine").

### Region boxes

Export four regions per gate (untouched reference, stroke core, crossing,
wash). Boxes must live **inside stroke cores** — alpha rims are ~0.02 doc
heights wide and averaging across one invents paint-with-paper readings. Report
the underlayer's own reading as the yardstick ("blue excess 41.1 untouched")
rather than absolute RGB, and scan the whole sheet for the categorical failure
you actually care about (e.g. covered-but-paper-white texels).

## What to Avoid

- **Do not compare against a remembered number.** Import the current build in
  the same harness and compare in-run. The committed baseline can drift by a few
  percent between environments (5 % observed) — quote the in-harness delta.
- **Do not run two engines in one page for timing.** At 2K, SwiftShader memory
  pressure degraded the second run by ~35 %. Two engines in one page is fine and
  desirable for **determinism** gates (same process, same seeds, direct digest
  comparison); it is not fine for cost.
- **Do not treat p95 as a model cost on a script with periodic stalls.** A
  periodic shared sim/readback stall lands on different frames depending on the
  per-dab cost, so p95 becomes alignment-sensitive. Use the median and the
  aggregate bake; use a disabled-path control to prove the tail is shared.
- **Do not blame the engine for setup memory.** Peak transient is only
  meaningful if the peak counter is reset at script start.
- **Do not average across the whole stamp.** See "Region boxes".
- **Do not trust a spike that moved the knob under test onto the reference
  surface.** Spike 001's first run painted the *underlayer* at Body 30/60/100,
  turning the reference band itself into a film — the "paper-white" result was
  the probe, not the model. Separate the knob from the scene.

## Constraints

- All timings are **software-rasterised** (SwiftShader). Absolute numbers will
  differ on a GPU; the **deltas** and the **memory model** are the decision
  inputs. The memory model can be checked: computed bytes matched the GL counter
  to 0.1 MB at both 1080² and 2K in spike 002.
- Engine additions need plumbing in more than one place, and the harness will
  fail loudly until all of it exists:
  - a new GL format (e.g. `FLOAT_R`) must be declared in the engine's format
    table, not just used;
  - a new fragment shader must declare `in vUv` in its own header;
  - a new document layer must join `docTargets`, `allocateTargets`,
    `allocateHistory`, `snapshotLayers`, `travel`, resize-copy and
    `captureWhole`/`uploadWhole` together.
- Headless Chrome at 2K is the largest practical gate; both spikes ran 1080² and
  2048² successfully, in ~1–3 s of engine work per gate plus process startup.
- Determinism gates need the engine's entropy pinned: `setRandom(seededRandom(traceSeed))`
  per stroke **and** the paper seed (the constructor's `Math.random()`, still
  unpinned in the product — a known record gap). A `--salt` / `--paper-b` pair
  of negative controls is what proves which seed matters.

## Origin

Synthesized from spikes: **001-coverage-composite**, **002-acrylic-bristle-deposit**.
Source files: `sources/001-coverage-composite/probe/`,
`sources/002-acrylic-bristle-deposit/probe/`.
