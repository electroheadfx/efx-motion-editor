# Quick Task 261029-vbp: Reveal Colorize Option — Research

**Researched:** 2026-10-29
**Domain:** Canvas 2D compositing inside the reveal bake + `PhysicPaintRotoLoopClip` persistence
**Confidence:** MEDIUM (blend behaviour is HIGH on code paths, MEDIUM on WKWebView pixel behaviour)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Colorize blend
- Luminance-preserving colorize. At 100% mix the photo's detail (waves, texture) stays visible; hue and saturation come from the wash pigment. A blue sea revealed through a red wash reads as a red sea that still looks like a sea — not a flat red silhouette.
- Mix is a 0–100 slider; 0% equals the current (no colorize) result, 100% is full hue/saturation replacement. The mix interpolates the colorize strength.
- The reveal silhouette/alpha is unchanged by colorize: the wash alpha still defines the revealed area.

#### Colour source
- Per-stroke wash pigment, taken from the watercolor wash itself (the same converted raster that supplies pigment alpha). Each brush colour tints its own revealed area; overlapping washes mix naturally; watercolor variation is preserved.
- No flat colour picker in this task.

#### Controls scope
- Colorize checkbox + Mix slider live in the Reveal tab of the Create Rail dialog.
- Default: checkbox off; when checked, mix defaults to 100%.
- The chosen settings are persisted on the reveal rail record (`PhysicPaintRotoLoopClip` optional fields) so a Replay re-bakes identically.
- Existing reveal rails without the fields keep today's behaviour (colorize off).
- Editing an existing reveal rail's colorize/mix is NOT in scope for this task (edit modes currently render the Paint surface).

### Claude's Discretion
- Exact slider/checkbox markup and placement inside the Reveal tab, matching the existing dialog card conventions.
- Implementation technique for the luminance-preserving blend (canvas blend mode vs explicit pixel math), provided the result is deterministic and testable.
- Field naming for the persisted rail settings.

### Deferred Ideas (OUT OF SCOPE)
None recorded in CONTEXT.md.
</user_constraints>

## Summary

The reveal bake is a two-step composite: draw the placed reference at full opacity, then apply the wash's pigment alpha as `destination-in` (`physicsPaintRotoPlayScriptRenderer.ts:229-256`). Because the coverage canvas produced by `transmittanceToAlpha` already carries **per-pixel pigment colour plus alpha** (`rasterAlpha.ts:32-80`), a colorize pass needs no new colour source and no extra pose pass: one `'color'`-blended draw of the same `posedCoverage` canvas between the reference draw and the `destination-in` mask gives luminance-preserving tint at `globalAlpha = mix/100`, and the mask that runs afterwards restores the exact reveal silhouette.

The hard part is not the blend, it is persistence. `PhysicPaintRotoLoopClip` is guarded by a fail-closed allowlist (`physicsPaintRotoPhysicalModel.ts:433-445`, enforced at `:794`): a new field that is not added there makes the **entire document fail to parse**. Three field-by-field rebuilders (`parsePhysicPaintRotoLoopClips`, `cloneLoopClips`, `buildDuplicatedLoopClip`) silently drop any field they do not copy, and the bridge compares whole-clip serializations (`physicPaintBridge.ts:453`) — the exact G-52-4 failure mode that once rejected every bridge payload on a reveal-rail track.

**Primary recommendation:** Add a flat optional pair (`colorize`, `colorizeMix`) to the record; update the allowlist, parser, both clone builders, and the create/replay bake inputs; implement the tint as a `'color'` composite of `posedCoverage` at `globalAlpha = mix / 100` immediately before the existing `destination-in`; keep the pair **out of** the canonical fingerprint for this task (avoids touching the Rust mirror — see Open Question 1).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Colorize pixel blend | Studio child realm — reveal renderer (Canvas 2D) | — | The bake owns every pixel the rail ever shows; the compositor only ever sees baked keys |
| Mix + checkbox state | Studio controller (`signals`) | Dialog view (render only) | Existing dialog convention: state in controller, view reads/writes signals |
| Persisted settings | `PhysicPaintRotoLoopClip` (physical model) | Parent realm via bridge payload | Rail provenance is durable document state, not runtime cache |
| Replay re-bake | `efxPaintStore.replayRevealRail` | `commitRevealBake` | Store mutation is the only replay authority (currently unreachable from UI) |

## Standard Stack

**No new packages.** This task uses only what the repo already ships:

| Library / API | Version | Purpose | Why standard here |
|---------------|---------|---------|-------------------|
| Canvas 2D `globalCompositeOperation` | Web platform | `'color'` tint + `destination-in` mask | Already the house style (`fxColorGrade.ts`, `paperPass.ts`) |
| `@preact/signals` | repo-pinned | Controller state | Project rule: signals only, no `useState` |
| vitest | repo-pinned | Op-ledger + source-contract tests | `vitest run` only (CLAUDE.md) |

**Package Legitimacy Audit:** not applicable — zero packages installed by this phase.
**Installation:** none.

## Findings

### F1 — Bake call chain and every construction site

Chain: dialog `confirm` → `confirmReveal` → `ports.createReveal` → Studio port → `createRevealRail` → `commitRevealBake` → `renderRotoRevealFrames` → `renderRotoRevealFramesAquarelle` → per-frame `poseRevealCoverage` → `compositeRevealMask`.

| # | Site | Path:lines | Construction style | Action |
|---|------|-----------|--------------------|--------|
| 1 | `RotoRevealRenderInput` | `roto/physicsPaintRotoPlayScriptRenderer.ts:22-54` | interface | add `colorize?` |
| 2 | per-frame composite call | `roto/physicsPaintRotoPlayScriptRenderer.ts:196` | **explicit** args | pass colorize |
| 3 | `compositeRevealMask` | `roto/physicsPaintRotoPlayScriptRenderer.ts:229-256` | **function signature** | add param + draw |
| 4 | `RotoRevealRailCreateInput` | `roto/physicsPaintRotoPlayScriptController.ts:55-68` | interface | add fields |
| 5 | `confirmReveal` port call | `roto/physicsPaintRotoPlayScriptController.ts:1385-1396` | **explicit object** | add fields |
| 6 | `createRevealRail` input type | `stores/efxPaintStore.ts:1512-1528` | inline type | add fields |
| 7 | `createRevealRail` → `commitRevealBake` | `stores/efxPaintStore.ts:1546-1558` | **explicit object** | add fields |
| 8 | `createRevealRail` clip literal | `stores/efxPaintStore.ts:1579-1596` | **explicit literal** | add fields |
| 9 | `replayRevealRail` → `commitRevealBake` | `stores/efxPaintStore.ts:1675-1687` | **explicit object** | read from `rail.clip` |
| 10 | `RevealBakeInput` | `stores/physicPaintStore.ts:1982-2001` | interface | add fields |
| 11 | `commitRevealBake` → renderer | `stores/physicPaintStore.ts:2049-2060` | **explicit object** | add fields |
| 12 | Studio `createReveal` port | `components/physic-paint/PhysicsPaintStudio.tsx:3830-3848` | **spread** (`...input`) | survives automatically |

Verbatim anchors (read this session):
- `physicsPaintRotoPlayScriptRenderer.ts:253-254` — `context.globalCompositeOperation = 'destination-in';` then `context.drawImage(coverageAlpha, 0, 0, size.width, size.height);`
- `physicsPaintRotoPlayScriptRenderer.ts:195-196` — `const posedCoverage = poseRevealCoverage(coverage, destination, input.motion);` / `const masked = compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom);`
- `efxPaintStore.ts:1585-1589` — `railKind: 'reveal',` / `scriptId: input.scriptId,` / `motion: { ...bakeMotion },` / `overrideColor: null,`
- `physicPaintStore.ts:2054-2057` — `mode: input.mode,` / `size,` / `reference: { ... },` / `aquarellePaper: input.aquarellePaper,`

### F2 — Replay is NOT wired to any UI action

`replayRevealRail` occurs only at `stores/efxPaintStore.ts:1653`, in `stores/efxPaintStore.reveal.test.ts:19,496,559`, and as a forbidden token in `efx-paint/compositor/efxPaintRevealLeakContract.test.ts:70`. The rail UI computes a display string only: `revealUnresolved = isReveal && presentation.replayDisabledReason !== null` (`view/PhysicsPaintLoopClipRail.tsx:207`); no handler calls the mutation. **Implication:** "Replay re-bakes identically" is a store-level contract proven by unit tests, not a live user path today. The planner must still thread persisted settings into `replayRevealRail` (`efxPaintStore.ts:1681-1682` reads `rail.clip.motion` / `rail.clip.mode` — mirror that for colorize).

### F3 — Persistence surfaces (highest risk)

**Fail-closed gate:** `isPhysicPaintRotoLoopClip` rejects any unknown member — `if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS)) return false;` (`physicsPaintRotoPhysicalModel.ts:794`). The allowlist is `PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS` at `:433-445` (`'railKind'`, `'scriptId'`, `'motion'`, `'overrideColor'`, …). **A new interface field without the allowlist entry makes every document containing a reveal rail fail to load.**

All load paths funnel through `parsePhysicPaintRotoPhysicalDocument` → `parsePhysicPaintRotoLoopClips` (`:1522`): project load `efxPaintPersistence.ts:485`, document parsers `efx-paint/document/efxPaintDocumentParsers.ts:281`, launch hydration `roto/rotoLaunchHydration.ts:57`, bridge `physicPaintBridge.ts:1479,1831,1988,2214,2455,3985`, group lifecycle proposals, and the atomic write validator `physicPaintStore.ts:4622`. One parser change covers them all.

| Surface | Path:lines | Behaviour with a new field | Verdict |
|---------|-----------|---------------------------|---------|
| Allowlist | `roto/physicsPaintRotoPhysicalModel.ts:433-445` | rejects unknown key | **MUST add** |
| Parser | `roto/physicsPaintRotoPhysicalModel.ts:921-971` | rebuilds field-by-field with conditional spreads; drops unknown | **MUST copy** |
| Canonicalizer | `roto/physicsPaintRotoPhysicalModel.ts:900-904` | spread — survives | no action |
| Canonical encoder | `roto/physicsPaintRotoPhysicalModel.ts:1370-1416` | encodes a fixed term list; ignores extras | no action (recommended) |
| Bridge canonicalize | `lib/physicPaintBridge.ts:378` | spread — survives | no action |
| Bridge structural compare | `lib/physicPaintBridge.ts:453` | `stableSerialize` compares **all** keys | round-trip must be exact |
| Bridge payload parse | `lib/physicPaintBridge.ts:1831` | via parser — drops unknown | covered by parser fix |
| Coordinator clone | `hooks/useRotoPhysicalEditCoordinator.ts:681-711` | rebuilds field-by-field (`:694`, `:700-702`) | **MUST copy** |
| Payload normalizer | `hooks/useRotoPhysicalEditCoordinator.ts:673-679` | spread — survives | no action |
| Rail-set duplicate | `roto/physicsPaintRotoRailSetCopy.ts:452-493` | rebuilds field-by-field (`:460-467`) | **MUST copy** |
| Undo snapshot equality | `hooks/useRotoPhysicalEditHistory.ts:384-445` | compares explicit field list (`:408-412` for scriptId/motion/overrideColor) | **SHOULD add** (cheap; future edit mode) |
| Rust physical document | `app/src-tauri/src/lib.rs:120` (`rotoPhysical: Option<Value>`) | opaque JSON | no struct change |
| Rust canonical hash | `app/src-tauri/src/services/script_library.rs:1382-1508` | fixed term list; **no `railKind` branch at all** | see Open Question 1 |
| `.mce` persisted payload | `efx-paint/document/efxPaintDocumentParsers.ts:281` | via parser | covered by parser fix |

**Sequencing constraint:** the allowlist + parser change must land in the same commit as the creation path that writes the fields. A record written before the allowlist knows it is unreadable.

### F4 — Blend technique: canvas `'color'` + `globalAlpha` (recommended)

**Recommendation:** inside `compositeRevealMask`, after the reference draw/`restore()` and **before** the existing `destination-in`:
set `globalCompositeOperation = 'color'`, `globalAlpha = mix / 100`, `drawImage(coverageAlpha, 0, 0, size.width, size.height)`, restore `globalAlpha = 1`. Skip entirely when colorize is off **or mix is 0** (byte-identical to today).

Why this satisfies each locked decision:

1. **Luminance-preserving.** `'color'` is defined as hue+saturation of the source, luminosity of the backdrop. The source is the wash pigment raster, so hue/saturation come from the brush colour and light/dark detail comes from the photo. `'multiply'` (used elsewhere in the repo) would darken — wrong. `'hue'` alone would keep the photo's blue saturation under a red wash — wrong.
2. **True 0–100 ramp.** W3C compositing is `Co = αs·B(Cb,Cs) + (1−αs)·Cb`. Over the opaque photo backdrop, `αs = globalAlpha` gives an exact linear mix. The repo already relies on this: `fxColorGrade.ts:117-120` and `:131-132` ship `'color'` + `globalAlpha` in the Tauri WebView.
3. **Per-stroke colour with zero extra plumbing.** `transmittanceToAlpha` writes `alpha = 255 - min(r,g,b)` and `color = (t - min) * (255/alpha)` (`rasterAlpha.ts:32-80`, verbatim formula at `:36-38`). Overlapping brushes already mix inside the wash raster, so the single posed coverage canvas carries the per-pixel mixed pigment colour.
4. **Silhouette unchanged.** The `destination-in` draw still runs **last**, so final alpha is exactly `referenceAlpha × coverage` — the same as today. The colour draw's own alpha contribution is wiped by the mask.
5. **Watercolor variation preserved** — the pigment raster is per-pixel, including the wash's own density variation; nothing is flattened to one colour.
6. **Registered with the per-frame pose.** Using the `posedCoverage` argument (not the un-posed coverage) keeps the tint registered with the mask under Motion wiggle.

Rejected alternative — explicit per-pixel HSL math: it would need a full `getImageData`/`putImageData` on both the reference and coverage rasters per output frame, at working size, for up to 10,000 frames (`physicsPaintRotoPlayScriptRenderer.ts:7-8`). That adds a multi-MB transient copy per frame and CPU cost, and buys only byte-level testability that this repo cannot exercise anyway (node vitest has no canvas pixels). The canvas path is faster, matches `paperPass.ts`/`fxColorGrade.ts`, and is already observable by the existing `RecordingContext` op ledger, which records `globalCompositeOperation` and `globalAlpha` per `drawImage` (`physicsPaintRotoRevealBake.test.ts:18-27,99-151`).

Pitfalls:
- Blend draws paint into transparent destinations (`paperPass.ts:290-295`). Here the leak is neutralised **only** by the `destination-in` running afterwards — the draw order is load-bearing. Do not move the mask before the tint.
- Non-zero RGB under `alpha = 0` is already the status quo (the reference is drawn over the whole rect, then masked), so no new WebP edge behaviour.
- `globalAlpha` multiplies the coverage alpha, so tint strength tapers with coverage at stroke edges. That is desirable (no hard tint ring) but means "100%" is full tint only where coverage is opaque.
- The output context already uses `{ willReadFrequently: true }` (`:239`); no change needed.

### F5 — Dialog and controller conventions to mirror

View (`components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx`):
- Tab gate: `const tabsVisible = !loopEdit && !sourceEdit && !regenerateImpact;` (`:81`), `const revealTab = tabsVisible && playScript.railTab.value === 'reveal';` (`:82`). Edit modes never render the tabs — no extra guard needed for "edit is out of scope".
- Reveal layout: `physics-paint-play-script-side-stack` containing `{motionCard}` (`:530-532`). Put the Colorize card in that stack, after `{motionCard}`.
- Card classes: `physics-paint-play-script-card` + `physics-paint-play-script-card-timing|-motion|-color` (`:466, :553`). **Use a new class** `physics-paint-play-script-card-colorize` — the dialog test asserts the Reveal tab has zero `physics-paint-play-script-card-color` (`PhysicsPaintPlayScriptDialog.test.ts:1258`).
- Checkbox pattern: `class="physics-paint-play-script-timing-toggle"` + `<input type="checkbox">` (`:450-459`, Infinity; `:483-492`, Max).
- Slider pattern: `class="physics-paint-play-script-slider-row"`, `<input type="range" min={0} max={100}>`, `<output>` (`:244-273`).
- Ids follow `physics-play-script-*` (`physics-play-script-motion-deformation`, `physics-play-script-reveal-count`, `physics-play-script-infinity`).

Controller (`roto/physicsPaintRotoPlayScriptController.ts`):
- Signal declarations live in the `RotoPlayScriptController` interface (`:263-268` for `mode/overrideEnabled/dialogMotion`, `:318-330` for reveal signals) and are instantiated at `:344-376` (`revealCountText = signal(String(DEFAULT_REVEAL_FRAME_COUNT))` at `:376`).
- Reset-on-open: `openConfirmation` resets apply-mode state at `:654-668` (`dialogMotion.value = { ...ports.getMotion() };` `:662`, reveal block `:663-668`). New signals belong here: `colorize` off, `colorizeMix` 100.
- Port call: `confirmReveal` builds the explicit object at `:1385-1396` (`variant`, `startFrame`, `frameCount`, `repeat`, `motion`).
- `confirm()` routing: `:1216-1220` — `if (railTab === 'reveal') return confirmReveal();`.
- Mix value: clamp in the controller on write (mirror the dialog-local `clampMotionValue` at `:53-56`), so the port input is always an integer 0–100. Set mix to 100 when the checkbox is enabled (locked default).

### F6 — Tests to update (vitest collects `.test.ts` only)

`app/vitest.config.ts:5` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts'],`. A `.test.tsx` file executes nothing (known project trap). All targets below are `.test.ts`. Run with `pnpm --filter efx-motion-editor exec vitest run` (`workflow.test_command`); never watch mode.

| File | Why it breaks / what to add |
|------|-----------------------------|
| `roto/physicsPaintRotoPlayScriptRenderer.test.ts:44-50` | pins the exact string `compositeRevealMask(referenceImage, posedCoverage, input.size, input.reference.transform, input.reference.zoom)` (`:48`) — the signature change breaks it. Re-pin the new call + `'color'` op. Also `:75` `expect(renderer).not.toContain('overrideColor')` — keep the new field names distinct. |
| `roto/physicsPaintRotoRevealBake.test.ts:344-433` | harness already records `globalCompositeOperation`/`globalAlpha`. Add: off ⇒ no `'color'` op anywhere; on ⇒ a `'color'` draw with `globalAlpha === mix/100` **before** the `destination-in` draw (`:377`); reference draw still `globalAlpha 1` / `source-over` (`:374-375`); mask source unchanged (`:411-418`). |
| `view/PhysicsPaintPlayScriptDialog.test.ts:146-188, 1244-1263` | fake controller needs the two new signals; add render/click assertions. Keep `:1258` (no `-card-color`) passing by naming the card differently. |
| `roto/physicsPaintRotoPlayScriptController.test.ts:3380-3412` | extend the `toMatchObject` (`:3392-3400`) with colorize; add defaults + reset-on-reopen + 100-on-enable tests. |
| `stores/efxPaintStore.reveal.test.ts:151-153, 373-396, 496, 559` | creation persists the pair; replay threads the persisted pair into the bake. |
| `roto/physicsPaintRotoPhysicalModel.test.ts` | parse round-trip; unknown-key rejection already covered by the allowlist test family. |
| `hooks/useRotoPhysicalEditCoordinator.test.ts` | clone round-trip (the G-52-4 regression family). |
| `roto/physicsPaintRotoRailSetCopy.test.ts` | duplicated reveal rail keeps the pair. |
| `efx-paint/document/efxPaintDocumentParsers.reveal.test.ts` | project save/load round-trip. |
| `lib/physicPaintBridge.test.ts` | payload equality with the pair present (structural compare at `physicPaintBridge.ts:453`). |
| `hooks/useRotoPhysicalEditHistory.test.ts` | only if snapshot equality gains the comparisons. |

### F7 — Gotchas

- **Reveal leak contract:** `efx-paint/compositor/efxPaintRevealLeakContract.test.ts:55-77` forbids `renderRotoRevealFrames`, `compositeRevealMask`, `commitRevealBake`, `railKind`, etc. in compositor/flattenedCache/previewRenderer/exportRenderer. Do not add any colorize handling there.
- **Chunk budget:** `vite.config.ts:290` `chunkSizeWarningLimit: 2000` — a hard desktop ceiling; no new dependency, no risk, but do not reach for a colour library.
- **CSP:** `app/src-tauri/tauri.conf.json:38` already grants `img-src ... blob: data:` — the colorize path needs no CSP change (and adds no readback).
- **CLAUDE.md:** pnpm (not npm); `vitest run` only; never run the server; Preact + signals only; no `useState`; no `useEffect` for selection.
- **Straight-alpha law:** `destination-in` keeps destination RGB unmodified (`physicsPaintRotoPlayScriptRenderer.ts:221-222`). The tint draw must not change final alpha — the mask runs last.
- **Determinism:** the existing determinism test compares within one process (`physicsPaintRotoRevealBake.test.ts:426-433`). Canvas blend math is engine-defined; a live UAT row is required, not a byte assertion.
- **Naming:** do not reuse `overrideColor` for colorize — the renderer source-contract test forbids that token in the renderer (`:75`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transmittance → pigment colour/alpha | New colour extraction | `transmittanceToAlpha` (`lib/rasterAlpha.ts:45`) | The app's one pigment law; already the mask source |
| Luminance-preserving tint | Custom RGB↔HSL loops | Canvas `'color'` composite | GPU path + shipped precedent (`fxColorGrade.ts:117,131`) |
| Per-frame pose alignment | Second pose of a colour canvas | The existing `posedCoverage` argument | Colour and mask must come from one posed raster |
| Record validation | Ad-hoc checks | `isPhysicPaintRotoLoopClip` allowlist + parser | Fail-closed, one authority |

## Common Pitfalls

### Pitfall 1: Adding the interface field but not the allowlist
**What goes wrong:** every project containing a reveal rail fails to parse — the whole document, not just the field.
**Why:** `hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS)` at `physicsPaintRotoPhysicalModel.ts:794`.
**Avoid:** add both keys to `PHYSIC_PAINT_ROTO_LOOP_CLIP_KEYS` (`:433-445`) in the same change as the writer.
**Warning sign:** `PhysicPaintRotoLoopClips: malformed Loop Clip record.`

### Pitfall 2: Dropping the fields in a field-by-field clone
**What goes wrong:** bridge payloads on a colorized reveal-rail track fail canonical re-verification (paste/drag/spacing/paint reject).
**Why:** `cloneLoopClips` (`useRotoPhysicalEditCoordinator.ts:681-711`) and `buildDuplicatedLoopClip` (`physicsPaintRotoRailSetCopy.ts:452-493`) rebuild explicitly; the bridge compares whole-clip serializations (`physicPaintBridge.ts:453`).
**Avoid:** copy the pair in both, mirroring the `railKind` lines at `:694` and `:460`.

### Pitfall 3: Tinting the wrong raster
**What goes wrong:** tint lags the motion wiggle, or fringes appear at stroke edges.
**Why:** colourizing the un-posed `coverage` instead of `posedCoverage`, or masking after a resize.
**Avoid:** colorize inside `compositeRevealMask` using its `coverageAlpha` parameter.

### Pitfall 4: Making the color draw the last operation
**What goes wrong:** silhouette alpha grows (`αo = αs + αb(1−αs)`) and the reveal leaks beyond the wash.
**Avoid:** keep `destination-in` strictly last.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (node environment, no jsdom) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` |
| Full suite command | `pnpm --filter efx-motion-editor exec vitest run` |

### Phase Requirements → Test Map

| Req | Behaviour | Test Type | Automated Command | File Exists? |
|-----|-----------|-----------|-------------------|-------------|
| R1 | Colorize off ⇒ op ledger identical to today | unit | `… vitest run …/physicsPaintRotoRevealBake.test.ts` | ✅ extend |
| R2 | Colorize on ⇒ `'color'` draw at `globalAlpha = mix/100` before `destination-in` | unit | same | ✅ harness supports |
| R3 | Persisted pair survives parse/clone/duplicate/bridge | unit | `… vitest run` (model, coordinator, rail-set-copy, bridge) | ✅ extend |
| R4 | Replay reads the persisted pair | unit | `… vitest run src/stores/efxPaintStore.reveal.test.ts` | ✅ extend |
| R5 | Visual: red wash over blue sea reads as a red sea with detail | manual UAT | — | ❌ live row required |

### Sampling Rate
- Per task commit: the focused file(s) above.
- Per wave merge: full suite.
- Phase gate: full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] No new framework/config needed.
- [ ] Extend the existing reveal bake harness with an op-order assertion helper (the `MaskOp` ledger already exists at `physicsPaintRotoRevealBake.test.ts:18-27`).

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json`, so this section applies.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Controller clamp to integer 0–100 + fail-closed allowlist/parser in the physical model |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed persisted `colorizeMix` (NaN, out of range, string) | Tampering | validator rejects the record; parser throws closed |
| Unbounded mix reaching the bake | Tampering | clamp at the controller write and again in `validateRenderInput` |
| CSP weakening to enable the tint | — | none needed; `img-src` already allows `blob:`/`data:` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WKWebView `'color'` + `globalAlpha` follows the W3C formula closely enough for the intended look | F4 | Tint strength or hue differs visually; mitigation: UAT row R5, fall back to explicit HSL math |
| A2 | No script-library transaction currently carries a reveal rail, so the missing Rust `railKind` branch has not surfaced | F3 / Open Q1 | If false, reveal-rail projects already fail WR-01; adding colorize to the fingerprint would widen it |
| A3 | Integer percent (0–100) is the right persisted precision and a flat pair is preferable to a nested object | F3 | Migration-free while nothing is shipped; naming only |
| A4 | Pigment hue/saturation from `transmittanceToAlpha` is perceptually acceptable as the tint source (it is the app's one pigment law) | F4 | Tint may look muddy on very light washes; mitigation: UAT, possible saturation boost later |

## Open Questions (RESOLVED)

All four below are resolved for this quick; the chosen answers are carried by the plan (and by the revision that replaced the direct output tint with the scratch + 'source-atop' transfer):

- Q1 → keep colorize OUT of the canonical fingerprint (plan Task 1 steps 10/163); file Rust `railKind` parity separately.
- Q2 → defer the fingerprint join until edit mode lands (plan "Accepted scope").
- Q3 → flat `colorize?: boolean` + `colorizeMix?: number`, both-or-neither, written only when enabled (plan Task 1 step 16).
- Q4 → set mix 100 on enable; leave the stored value untouched while disabled (plan Task 1 step 20).

1. **Rust canonical hash and `railKind`.** The TS encoder emits `railKind` (`physicsPaintRotoPhysicalModel.ts:1389`); the Rust mirror has no `railKind` branch at all (`script_library.rs:1382-1508`), and the parity fixture has no `railKind` (`app/src/types/physicPaint.test.ts:1006-1007`). By inspection a reveal-rail document cannot produce the same hash on both sides, and WR-01 rejects a mismatch (`script_library.rs:1244-1247`). What we know: the two encoders differ. What is unclear: whether any script-library transaction reaches a reveal-rail document. Recommendation: keep colorize **out** of the canonical fingerprint for this task (fields persist as opaque members; equality is unaffected because colorize never changes after creation), and file the Rust `railKind` parity as a separate verification task.
2. **Should colorize join the canonical fingerprint later?** If yes, both encoders (`encodeCanonicalLoopClips` + `canonical_loop_clips`) and the reference vectors must change together. Defer until edit mode lands.
3. **Persisted field naming.** Recommended: flat `colorize?: boolean` + `colorizeMix?: number`, both-or-neither, persisted only when enabled so a disabled rail is byte-identical to today. Alternative: nested `colorize?: { enabled, mix }` with its own allowlist — more parser code for no behavioural gain.
4. **Mix reset semantics on re-check.** Locked text says "when checked, mix defaults to 100%". Recommendation: set 100 on enable; leave the stored value untouched while disabled.

## Sources

### Primary (verified against source this session)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — input, per-frame loop, `compositeRevealMask`
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — interface, allowlist, validator, parser, canonical encoder
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — signals, reset block, `confirmReveal`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — tabs, cards, checkbox/slider patterns
- `app/src/stores/efxPaintStore.ts`, `app/src/stores/physicPaintStore.ts` — create/replay/commit
- `app/src/lib/rasterAlpha.ts` — pigment conversion law
- `app/src/lib/fxColorGrade.ts`, `app/src/lib/paperPass.ts` — `'color'` and blend-leak precedents
- `app/src-tauri/src/services/script_library.rs` — Rust canonical mirror
- Tests and configs listed in F6, `app/vitest.config.ts`, `app/vite.config.ts`, `app/src-tauri/tauri.conf.json`

### Secondary (planning artifacts)
- `.planning/milestones/v1.0.0-quick/260921-c7x-.../260921-c7x-SUMMARY.md` — railKind moves the canonical hash (G-52-4 evidence)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all APIs already in use.
- Architecture: HIGH — every insertion point read with line numbers.
- Persistence: HIGH on drop-sites; MEDIUM on the Rust parity consequence (A2).
- Blend behaviour: MEDIUM — W3C semantics + in-repo precedent are solid; WKWebView pixel output needs the UAT row.
- Pitfalls: HIGH — each is backed by an existing regression or a source-contract pin.

**Research date:** 2026-10-29
**Valid until:** 30 days (stable, internal codebase)
