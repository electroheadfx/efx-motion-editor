# Quick Task 260928-dh1: Paint-deposit debug — kill the pixel speckle - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Task Boundary

Paint-deposit debug — kill the pixel speckle; replace it with contained, fine, velocity- and pressure-driven semi-transparent traces.

DEFECT (live captures): pixel-level speckle along the stroke body and edges — isolated pixels, un-natural. Visible in the final render and from the FIRST "apply physics" click.

CAUSE (located, not a hypothesis): dryStep hard-cuts the transfer — DRY_ALPHA_THRESHOLD = 1 and sa > 0.005 (drying.ts:88, :100, :135, :148) — so a soft low-density fringe is truncated to isolated surviving pixels = salt-and-pepper. Paper modulation is gated on pixelOpacity < 0.99 with clamp(1.4 - ph*0.8, 0.3, 1.4) (drying.ts:127-129), adding a second layer of per-pixel variance on top. The Stam semi-Lagrangian fringe adds a low-density edge band.

TARGET LOOK — oracle = /Users/lmarques/Desktop/watercolor-studio-v11.html ("Aquarelle" renderAquarelleStroke + "Paint" drawBristleTraces) + the reference paint image (clean falloff, visible brush traces, edges fusing between strokes).

Success = ZERO isolated pixels; continuous organic falloff.

THE KEY QUALITY: semi-transparent DIRECTIONAL traces — fine streaks that deform along the gesture and leave slightly transparent marks. Not a flat fill, not pixel noise.

Required character of the replacement noise:
1. CONTAINED — stays inside the stroke footprint (centerline ± radius × pressure). Never sprays isolated pixels outside the body.
2. FINE — sub-2px trace width, very low per-trace alpha; build-up by overlap, never by loud single pixels.
3. VELOCITY-DRIVEN — wobble along the curve; faster motion leaves more gaps and a thinner deposit. Slower = fuller.
4. PRESSURE-DRIVEN — light pressure = light noise: narrower spread, lighter alpha, thinner traces. Heavy pressure = denser.

Hard rule: modulation must be CONTINUOUS (multiplicative). No hard alpha/coverage cutoff anywhere in the deposit path.

STOP condition: if the velocity/pressure/direction-driven traces need a new stroke-input pipeline beyond a deposit-path change, STOP and report.

</domain>

<decisions>
## Implementation Decisions

### Trace generation site
- **Deposit-time bristle pass + de-hardcut dryStep.** Velocity/pressure/direction are gesture-sample properties; gesture samples exist only in the deposit rasterizer. dryStep is a per-pixel raster transfer (drying.ts:58-158) with no stroke geometry — reconstructing velocity/pressure there is either lossy (overlapping strokes cannot be attributed to a sample) or a new companion-field pipeline, which is exactly this brief's STOP condition.
- Anti-accumulation property: traces produced once at deposit cannot multiply per physics click. The savedWet round-trip is DEFERRED and would otherwise stack a fresh trace layer per click if dryStep were the generator — the 1/2/3-click degradation captured live.
- **Hard constraint:** the deposit-time bristle pass must be GEOMETRY (ribbon/polygon draws), never a getImageData + per-pixel loop. 9a (260925-dso) deleted those per-stroke pixel passes for latency; they must not come back.
- **Rejected: "both sites"** — two noise generators to cross-calibrate against each other and against Spread/deformN is the dual-modulation trap 9a/9b deleted. One noise generator at deposit; dryStep gets continuous multiplicative modulation only.

### Trace determinism
- **Seeded per-stroke** — RNG seeded from stroke id + arc-length.
- The engine replays from recorded actions (allActions, replayDiffusion). An unseeded RNG (v11's Math.random()) regenerates different traces on every replay = boil between held poses, breaking the 8b/8c/8d stop-motion determinism law. Non-determinism is out.
- Bake-into-raster-bytes is deterministic but freezes traces: Spread and thickness are live parameters and the engine re-rasterizes from points, so baked trace bytes would go incoherent with those parameters or force a full re-deposit to reshape. Seeding keeps traces a pure function of (stroke id, arc-length, parameters) — same stroke → same traces on every replay and every physics pass; parameter edits regenerate consistently.
- Seed choice is deliberate: **arc-length (not sample index)** keeps the noise stable along the stroke and across resampling/chunking; stroke id keeps it stable per stroke.

### Measure-first ownership
- **Harness first, then fix.** The matrix requires controlled pressure × velocity on the SAME content — that is a scripted capture, not hand-driven samples. A hand cannot reproduce the same gesture at two pressures or two speeds well enough to support the acceptance rows ("light pressure reads lighter", "fast stroke reads more depleted"). Task 3 must re-measure the identical matrix (same content, same seeds, same zoom) for the before/after delta.
- Structure:
  - **Task 1** = measurement/capture harness (app writes the matrix to /tmp, per the app-written-capture-files rule) + the **RED baseline** run.
  - **Task 2** = the deposit fix (deposit-time seeded bristle pass + continuous dryStep, per the Trace-site and Determinism decisions).
  - **Task 3** = re-run the same harness for acceptance.
- Risk accepted: Task 2 is planned before Task 1's numbers land. If the paper-pass isolation row contradicts the located cause (applyPaperPass contributing the speckle — unlikely, its tiles are continuous, not thresholded), **STOP and re-plan**, per the brief's STOP condition.
- **Task 1 runs BEFORE any deposit-path edit** — measure-first law holds.

### Claude's Discretion
- Exact bristle count / wobble frequency / alpha ranges may be tuned from the v11 oracle values as starting points (wFreq 0.04–0.12, wAmp 0.3–1.5, width 0.4–2.2px, alpha 0.015–0.06) and calibrated against the RED baseline.
- v11's two known limits must be fixed while porting: deformation variance becomes pressure-dependent (v11 only scales radius and layer alpha by pressure); shape noise becomes fbm/non-uniform and pressure-scaled (v11 uses uniform Math.random()).
- Harness output format (JSON + PNG pairs to /tmp) is Claude's choice, consistent with prior app-written capture files.

</decisions>

<specifics>
## Specific Ideas

- Oracle: /Users/lmarques/Desktop/watercolor-studio-v11.html — "Aquarelle" renderAquarelleStroke + "Paint" drawBristleTraces. READ-ONLY look oracle. Do NOT copy blindly; fix the two known limits above while porting the idea.
- Reference paint image = LOOK oracle only (clean falloff, visible brush traces, edges fusing between strokes). Not a dependency.
- v11 continuous modulation reference: fillPolyGrain `mod *= 1 - grain*0.5*(1-fbm); clamp(1.3 - h*0.8, 0.1, 1.4)`.
- v11 containment reference: `off = (offset + wobble*0.015) * radius * pr` with `pr = p*0.7+0.3`.
- v11 velocity reference: `skipChance = clamp(spd*0.002, 0, 0.15)`, `speedDeplete = clamp(1 + spd*0.003, 1, 1.5)`.
- v11 pressure reference: `pMod = 0.5+p*1.0` on width, `pressureMod = 0.3+p*0.7` on layer alpha.

</specifics>

<canonical_refs>
## Canonical References

- KEEP UNCHANGED: Studio paper-fond merge (260925-iy6 paper pass / D-09) — it is good, keep it.
- KEEP UNCHANGED / DEFERRED: Physics-button one-shot-vs-dose (savedWet round-trip in startPhysics/stopPhysics) — do not touch button semantics in this pass.
- DO NOT OPEN: Quick 8e (color-blending beading).
- KEEP UNCHANGED: 260924-stb thickness field, 260925-b7c Spread calibration, 260925-dso clean edges, 260927-ton width-scaled deformN, DEPOSIT_KEEP_TIER = 70.
- REJECTED dependency: mixbox (CC BY-NC; Kubelka-Munk color mixing only — does not render strokes, edges, or noise).
- Measurement matrix (mandatory, before any deposit-path edit): 0 / 1 / 2 / 3 "apply physics" clicks at the same zoom; physics-without-paper-pass vs paper-pass-without-physics; light vs heavy pressure, slow vs fast stroke, same content.
- Acceptance (judged at zoom): zero isolated pixels at stroke edges; falloff is continuous; traces are fine, contained, and visibly follow the gesture direction; light pressure reads clearly lighter than heavy pressure; fast stroke reads clearly more depleted than slow stroke.

</canonical_refs>
