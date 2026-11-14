---
phase: quick-261112-n3f
verified: 2026-11-12T16:27:37Z
status: human_needed
score: 5/5 must-haves verified
covered_files: [".planning/quick/261112-n3f-unify-the-stroke-size-preview-into-one-t/261112-n3f-PLAN.md", ".planning/quick/261112-n3f-unify-the-stroke-size-preview-into-one-t/261112-n3f-SUMMARY.md", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx", "app/src/components/physic-paint/engine/VectorPathOverlay.test.ts", "app/src/components/physic-paint/engine/VectorPathOverlay.tsx", "app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts", "app/src/components/physic-paint/view/aquarelleStrokeSelection.ts", "app/src/components/physic-paint/view/scriptStrokeEdition.ts"]
covered_digest: "v4:sha256:36911eb7a2b0661d5e2a584873ff3c94fded44028535d2ca4fe776b65b813272"
behavior_unverified: 0
overrides_applied: 0
---

# Quick task 261112-n3f: Unify the stroke-size preview into one toggle and remove the vector envelope self-intersection lines

**Task Goal:** Unify the stroke-size preview into one toggle (vertex-aware, off by default) and remove the vector envelope self-intersection lines.
**Verified:** 2026-11-12T16:27:37Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `stroke-settings-preview-stroke-size` is the ONE gate for the vector width preview; OFF (default) draws no envelope in the Edit-path surface — opening a path edit or storing a non-uniform profile no longer draws one by itself. | ✓ VERIFIED | `scriptStrokeEdition.ts:117` `strokeSizePreview = signal(false)` (session-only); the only writer is `setStrokeSizePreview` (`:120-123`), called only by the one switch at `PhysicsPaintStrokeSettingsDialog.tsx:1014`. `VectorPathOverlay.tsx:870` reads it once in the narrow leaf body, `:502` `showEnvelope = wireframe \|\| preview`, `:507` gates both envelope nodes. Test `draws no envelope for a path edit while the preview switch is off` asserts zero fill/edge nodes with the edit open and the spine + 3 anchors still drawn. |
| 2 | Switch ON draws every vector path's per-vertex envelope in the editing chrome (former edit-path behaviour, now switch-gated); D-10 survives — a uniform profile still draws no envelope. | ✓ VERIFIED | Envelope geometry comes from `projectVectorPath` (`VectorPathOverlay.tsx:410-413`) and is rendered as fill `:530-535` + edge `:540-548`. Tests `draws the per-vertex envelope only while the preview switch is on` (ON = exactly one fill + one edge; OFF inside the same edit removes both, edit still open) and the D-10 half of `keeps the wireframe envelope for a uniform profile whatever the switch says` (pen latched, switch ON, no wireframe: spine and anchors PRESENT — non-vacuous — both envelope nodes ABSENT). |
| 3 | The 61-13 wireframe construction view still draws the envelope for every vector stroke unconditionally, uniform profile included, whatever the switch says. | ✓ VERIFIED | `VectorPathOverlay.tsx:953` and `:967` pass `alwaysEnvelope: wireframe`; `:502` `showEnvelope = wireframe \|\| preview`; `projectVectorPath` keeps the `alwaysEnvelope` branch (`vectorPathHandles.ts:375-378`, untouched — not in the diff). Test pins a uniform-profile stroke in wireframe with the switch OFF: exactly one fill + one edge. |
| 4 | Wherever the per-vertex envelope is painted (Edit path, wireframe, Select/Move band) it is TWO nodes — an UNMASKED fill (fill/fillOpacity, no stroke) plus an EDGE carrying the stroke, a mask built from that same polygon and a doubled authored width keeping the visible 61-25 3.5/1.5 law; the fill is never masked, the edge is the only masked node; no polygon union and no SVG filter. | ✓ VERIFIED | Edit path: `VectorPathOverlay.tsx:515-528` `<defs><mask>` (white rect over the layer box + black path with the SAME `d`), `:530-535` fill keeps `vector-path-envelope` / 0.14·0.07 with NO stroke and NO mask, `:540-548` `vector-path-envelope-edge` at `(selected ? 3.5 : 1.5) * 2` with the mask url and no stroke-opacity. Select band: `ScriptStrokeOverlay.tsx:488-531` (mask `script-stroke-band-mask-<mutationId>`, unmasked fill keeps `stroke-size-band`, edge `stroke-size-band-edge` at `bandEdgeWidthPx * 2`). Per-path ids: `vector-envelope-mask-<sanitized key>` (`:254`) and `script-stroke-band-mask-<id>` (`:451`) — distinct families, unique per rendered path. No `<filter` in any changed source (test-pinned). Tests pin mask structure, the white-rect/black-path contents, d-equality with the fill, two distinct ids, and that the edge is the ONLY masked node on the Select surface. The painted-pixel consequence (wash survives, no crossing lines) is a visual judgment — see Human Verification. |
| 5 | In Select mode a vector stroke's preview band IS the same per-vertex envelope (same curve mode, same geometry as the Edit-path overlay) instead of the paint-band approximation; it carries the masked-edge policy. A uniform-width vector stroke resolves no band; a hand-painted stroke keeps its cached footprint band and a lift keeps its ribbon by identity; both render as the shipped SINGLE path with no mask and unchanged rendered props. | ✓ VERIFIED | `aquarelleStrokeSelection.ts:617-627`: vector branch evaluates `projectVectorPath(stroke.anchors, size.width, size.height, { curveMode: resolveAquarelleCurveMode(stroke.curveMode) })` and returns `{ polygonPx: envelope, maskedEdge: true }` when non-empty, else `undefined` (D-10 refusal). Lift `:608-611` returns `{ polygonPx: entry.ribbonPx }` (no flag, `undefined` when absent); paint `:628-637` returns `{ polygonPx }` (no flag). Descriptor contract `ScriptStrokeBand` at `scriptStrokeEdition.ts:534-540`, `bandFor` return type `:564` (type-only diff). This is the ONLY `bandFor` implementation (`:652`), consumed at `ScriptStrokeOverlay.tsx:425-426`; unflagged bands keep the shipped single path `:532-545` with `bandEdgeWidthPx` yielding the same 3.5/1.5 value. Tests: descriptor deep-equal to `projectVectorPath(..., { curveMode: 'bezier' })`, `maskedEdge === true`, uniform refusal, paint descriptor has NO `maskedEdge` key, lift `polygonPx` is `toBe`-identical to `ribbonPx` with no key, and the rendered Select surface shows the paint band / lift ribbon as one node each at width 1.5 with no mask. |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` | Preview-switch gate in `renderPath`; split fill + masked edge with per-path mask id | ✓ VERIFIED | Exists, substantive (92-line diff), wired (mounted as the canvas vector overlay; reads the signal in its own render body). `envelopeMaskId` at `:253-255`, gate `:500-507`, split nodes `:508-548`, both call sites pass `previewStrokeSize` (`:1324-1332`, `:1346-1354`). |
| `app/src/components/physic-paint/engine/VectorPathOverlay.test.ts` | Pins for OFF-by-default, switch gate, non-vacuous D-10, wireframe envelope, mask structure, split band law, Select/Move two-node band | ✓ VERIFIED | +354 lines; 152 `it(` blocks; all new pins use value-level assertions on the rendered vnode tree. |
| `app/src/components/physic-paint/view/scriptStrokeEdition.ts` | `ScriptStrokeBand` descriptor as the `bandFor` return contract (type-only) | ✓ VERIFIED | Diff contains only the interface, the return-type change and comments — no runtime statement moved; `setStrokeSizePreview` untouched. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` | Vector stroke resolves to the per-vertex envelope flagged `maskedEdge`; paint/lift descriptors plain | ✓ VERIFIED | Runtime import of `projectVectorPath` (`:74`), no cycle (vectorPathHandles imports only the payload package + a TYPE from scriptStrokeEdition), vector branch before the cached paint fallback. |
| `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | Vector descriptor, uniform refusal, untouched paint/lift pins | ✓ VERIFIED | +87 lines; OFF test extended to the vector row; descriptor/no-key/identity assertions present. |
| `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` | Honours `maskedEdge` with an unmasked fill + one masked edge; paint/lift keep the shipped single path | ✓ VERIFIED | Descriptor read `:421-428`, `bandEdgeWidthPx` `:443`, `bandMaskId` `:450-452`, masked branch `:481-531`, unflagged branch `:532-545`. No `useEffect`/`useSignal`; pointer/drag/transform lifecycle untouched (diff is band-region only). Mounted in production via `AquarelleStrokeOverlay.tsx:57-71`, which spreads the watercolor port carrying `bandFor` (`aquarelleStrokeSelection.ts:652`). |
| `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` | Updated ScriptStrokeOverlay source pins | ✓ VERIFIED | Exactly two literals moved (`bandEdgeWidthPx` constant, `indexOf('const band =')`) plus `maskedEdge` / `script-stroke-band-mask-` / `stroke-size-band-edge` pins; region pins still require `previewStrokeSize`, `applyScriptStrokeTransform`, `offsetX`, `offsetY`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `scriptStrokeEdition.ts` | `VectorPathOverlay.tsx` | `strokeSizePreview.value` read in the overlay component body, passed to `renderPath` | ✓ WIRED | `VectorPathOverlay.tsx:870` single render-body read; passed at both `renderPath` call sites; no write, no effect; the Studio render body never reads it (only the settings-dialog header leaf does, `PhysicsPaintStrokeSettingsDialog.tsx:433`). |
| `aquarelleStrokeSelection.ts` | `vectorPathHandles.ts` | `projectVectorPath(anchors, width, height, { curveMode })` — the same envelope the Edit-path overlay draws | ✓ WIRED | `:620-622`; test deep-equals the descriptor polygon to `projectVectorPath(..., { curveMode: 'bezier' })`. |
| `ScriptStrokeOverlay.tsx` | `aquarelleStrokeSelection.ts` | `props.port.bandFor` → `resolveAquarelleStrokeBandPx`; flagged band = unmasked fill + one masked edge; paint/lift unchanged | ✓ WIRED | Only `bandFor` consumer (`:425-426`); the only implementation is the watercolor port (`:652`); end-to-end test wires the REAL resolver into the overlay (`bandFor: resolveAquarelleStrokeBandPx` inside the 61-25 describe). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `VectorPathOverlay.tsx` envelope | `projection.envelope` → `envelope` string | `projectVectorPath(normalised, width, height, { alwaysEnvelope, curveMode })` from the recorded stroke's anchors/width factors | Yes — real stored anchors and width profile; no mock, no hardcoded literal | ✓ FLOWING |
| `ScriptStrokeOverlay.tsx` band | `band.polygonPx` → `bandPath` | `resolveAquarelleStrokeBandPx` → `projectVectorPath` (vector) / `entry.ribbonPx` (lift) / `buildStrokeBandCached` (paint) over the transform + drag offset | Yes — the end-to-end Select test renders the shipped resolver and asserts the moved fill/edge/mask `d` are one string | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Vector-path overlay suite (gate, D-10, wireframe, mask structure, band law) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/VectorPathOverlay.test.ts` | 95 passed (1 file) | ✓ PASS |
| Band resolver suite (vector descriptor, uniform refusal, paint/lift) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` | 98 passed (1 file) | ✓ PASS |
| Geometry-law regression (`projectVectorPath`/`buildEnvelope` untouched) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts` | 84 passed (1 file) | ✓ PASS |
| Port regression (other `bandFor`-adjacent members untouched) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/scriptStrokeEdition.test.ts` | 31 passed (1 file) | ✓ PASS |
| Studio pins | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts` | 413 passed (1 file) | ✓ PASS |
| Typecheck | `pnpm --prefix app run typecheck` | clean (`tsc --noEmit`) | ✓ PASS |
| Broader regression (executor's claim re-run once) | `pnpm exec vitest run src/components/physic-paint/engine src/components/physic-paint/view` (cwd `app`) | 128 files / 2,839 tests passed, exit 0 | ✓ PASS |

### Probe Execution

N/A — this quick task declares no probes and ships no `scripts/*/tests/probe-*.sh` surface.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| QUICK-261112-N3F | `261112-n3f-PLAN.md` | One vertex-aware, OFF-by-default stroke-size preview toggle + no vector envelope self-intersection lines | ✓ SATISFIED (automated surface) | Truths 1-5 above; 721 targeted tests + typecheck + 2,839-test regression green. The live visual outcome is pending the user's native UAT. |

No orphaned requirements: `QUICK-261112-N3F` is a quick-task identifier and is not tracked in `.planning/REQUIREMENTS.md`.

### Decision Coverage

Not evaluated — this quick task has no CONTEXT.md and no `<decisions>` block to audit.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `VectorPathOverlay.test.ts` | QUICK-261112-N3F | 95 | 0 | No | Value/behavioral (node counts, prop values, mask id/d equality, non-vacuous structure state) | OK |
| `aquarelleStrokeSelection.test.ts` | QUICK-261112-N3F | 98 | 0 | No (the `projectVectorPath` deep-equality is the parity contract itself, not a self-oracle for correctness) | Value/behavioral | OK |
| `PhysicsPaintStudio.test.ts` | QUICK-261112-N3F | 413 | 0 | No | Source pins + behavioral pins | OK |
| `scriptStrokeEdition.test.ts` | QUICK-261112-N3F | 31 | 0 | No | Regression | OK |
| `vectorPathHandles.test.ts` | QUICK-261112-N3F | 84 | 0 | No | Value (geometry law) | OK |

**Disabled tests on requirements:** 0 → no BLOCKER.
**Circular patterns detected:** 0 → no BLOCKER.
**Insufficient assertions:** 0 → no WARNING.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` in the changed sources; no stub returns introduced; no `<filter`; no `useEffect`/`useSignal`; no new dependency. The only `PLACEHOLDER` grep hit is the pre-existing constant name `AQUARELLE_PLACEHOLDER_MAX_BYTES` in `PhysicsPaintStudio.test.ts:5111` (a source-pin string, not a debt marker, untouched by this diff). |

### Human Verification Required

The seven native UAT rows are the user's side — the painted result of an SVG mask (wash intact, no crossing lines, contour weight) is not observable through grep or the vnode harness. The 61-25 law's visible 3.5/1.5 weight and the pinch/swell against the old constant footprint are live visual judgments.

1. **Edit path with the preview OFF**

**Test:** Open a frame holding a vector stroke with per-vertex width factors and open Edit path with Preview stroke size OFF (the default).
**Expected:** NO width envelope — only the spine, anchors and handles. Opening the edit no longer turns the preview on.
**Why human:** The unit pin proves node absence in the vnode tree; the native canvas render is the contract.

2. **Toggle the preview inside an open edit**

**Test:** With that edit still open, click Preview stroke size, then click it again.
**Expected:** The per-vertex envelope appears with the shape the old automatic edit-path preview had; clicking again removes it without closing the path edit.
**Why human:** Live toggle feel and visual continuity.

3. **Edit-path band on a folding stroke**

**Test:** With the preview ON, open a curved stroke whose width makes the offset fold.
**Expected:** The band keeps its fill and contour, and NO straight navy lines cross its interior; the outer contour reads at its usual weight (not double).
**Why human:** Rendered-pixel judgment — the mask trim is the mechanism, the pixels are the proof.

4. **Wireframe with the preview OFF**

**Test:** Turn Wireframe on with Preview stroke size OFF.
**Expected:** The envelope still appears for every vector stroke, including one with no per-vertex width, at its usual weight and without interior crossings.
**Why human:** Unconditional construction-view rendering on the native canvas.

5. **Select mode band geometry**

**Test:** In Select mode with Preview ON, compare a vector stroke with width factors, a uniform vector stroke, a hand-painted stroke and a lift.
**Expected:** The vector band pinches and swells with its per-vertex widths instead of a constant footprint; the uniform vector stroke shows no band; the hand-painted footprint band and the lift's red ribbon look exactly as before.
**Why human:** Visual comparison against the previous behaviour.

6. **Select-mode folding band, wash and silhouette**

**Test:** In Select mode with Preview ON, on that same folding stroke, inspect the band beside a hand-painted band.
**Expected:** The vector band keeps its WASH (not a hollow contour), keeps its outer contour, NO straight lines cross its interior, and the contour does not read double weight; the adjacent hand-painted band is unchanged.
**Why human:** This is the goal's visual acceptance — mask behaviour in the native WKWebView.

7. **Preview OFF in Select mode**

**Test:** Turn Preview OFF while in Select mode.
**Expected:** No band anywhere — only the shipped thin centerline outlines.
**Why human:** Regression confirmation on the live canvas.

### Gaps Summary

No gaps found. All five must-have truths are implemented and pinned by passing tests, every artifact exists at all levels (present, substantive, wired, data flowing), and both key links are wired end-to-end. The phase goal's remaining proof is the painted-pixel outcome (UAT rows 3, 4 and 6 in particular), which is deliberately handed to the user rather than claimed from CI — hence `human_needed`, not `passed`.

One informational nuance (not a gap): the truth-4 wording names `fillRule` on the fill node; the Edit-path fill omits it and therefore uses the SVG default `nonzero`, which is exactly the rule its mask's black path also uses — the fill and mask agree. The Select band's fill declares `fillRule="nonzero"` explicitly. No behavioural difference.

---

_Verified: 2026-11-12T16:27:37Z_
_Verifier: Claude (gsd-verifier)_
