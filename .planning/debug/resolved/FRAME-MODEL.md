# FRAME-MODEL.md — Timeline frame-model coherence

Session: `frame-model-coherence` (blocks v1.0.1)
Status: truth table drafted from code; live export measurement PENDING (user checkpoint first — no code change)
Date: 2026-10-12

---

## 1. Truth table (surface-by-surface)

Notation: a span with `outFrame = E` covers frame indices `[inFrame, E)` — **outFrame is EXCLUSIVE**.
A ruler tick at integer `f` is the *boundary* at `x = f * frameWidth` (left edge of frame `f`, right edge of frame `f-1`).

| Surface | Meaning of in/out | Covers | Source of truth |
|---|---|---|---|
| Content sequence (key photos) | No in/out. Sum of `keyPhotos[].holdFrames`. `trackLayouts[].endFrame` is exclusive (`start + Σ hold`). | frames `[0, Σ hold)` per sequence, laid sequentially | `frameMap.ts` `trackLayouts`, `resolveSequenceTimelineRange` (content branch) |
| Content overlay (video / image / image-sequence) | `inFrame` inclusive, `outFrame` **exclusive** (`globalEndExclusive = outFrame`) | `[inFrame, outFrame)` | `frameMap.ts:190-204`, `sequenceStore.createContentOverlaySequence` |
| FX sequence (incl. physic-paint Studio) | Same exclusive law. `outFrame` may be *extended* by roto display end via `getTimelineOverlaySequenceOutFrame` | `[inFrame, max(outFrame, in+rotoEnd))` | `frameMap.ts:288-297` |
| Physic-paint roto keys / loops | Layer-local. Display end = `max(lastKey.appFrame+1, max loop effectiveEnd)`; added to `seq.inFrame` for N and overlay out | Extends parent FX/overlay span | `frameMap.ts:254-269` |
| Audio track | `offsetFrame` = timeline placement (can be negative). `inFrame`/`outFrame` = **source trim** (not timeline). `slipOffset` = source slide inside trim. Timeline bar = `[offsetFrame, offsetFrame + (out-in))`. | Audible source at timeline `t` = `inFrame + slipOffset + (t - offsetFrame)` | `types/audio.ts`, `audioClipGeometry.ts` |
| Fade-in / fade-out (sequence) | `duration` in frames, measured from clip edges *inside* the clip. Fade-out ramp: active when `local >= total-d`; opacity `t = (total-1-local)/d` → **0 exactly on the last frame**. | Drawn inside the clip bar; right edge of fade-out = clip right edge = `outFrame` boundary | `transitionEngine.ts:20-40`, `TimelineRenderer.ts:975-988, 1187-1202` |
| Cross-dissolve / GL transition | Overlap zone `duration` frames centered on content boundary; does **not** shorten the timeline | Dual-render in overlap | `frameMap.ts:428-469` |
| **N (`totalFrames`)** | `N = max( content Σ hold, max visible seq `globalEndExclusive`, max `seq.in + rotoDisplayEnd` )` over visible sequences | Frame indices `0 .. N-1` exist | `frameMap.ts:271-286` |
| **Ruler** | Ticks at **boundaries** `f = 0 .. N` **inclusive** (`lastVisible = min(N, …)`, loop `f <= lastVisible`) | Displays `N+1` numbers. Tick `N` is the end **limit**, not a frame | `TimelineRenderer.ts:1528-1546` |
| **Playhead / seek** | Clamped to `0 .. N-1` (`seek`, `stepForward`, `frameFromX` default `maxFrame = N-1`) | Cannot sit on tick `N` | `timelineStore.ts:86-103`, `TimelineRenderer.ts:1552-1560` |
| **Export** | Writes `fm.length` frames, `frame = 0 .. fm.length-1` (`frame < total`) | `fm.length = N` (frameMap is padded/enumerated to N) | `exportEngine.ts:156, 251` |
| **Layer presence on a frame** | Content overlay / FX drawn iff `in <= f < getTimelineOverlaySequenceOutFrame(seq, N)`. Past `outFrame` the overlay is **skipped entirely** (nothing held). | Frame `f` = paper/content + each overlay whose range contains `f` | `exportRenderer.ts:336-340` |
| **Video source seek** | `targetTime = (localFrame / seq.fps) % video.duration` — **loops** the source past its natural length; does not hold last frame | `previewRenderer.ts:831-836` | |
| **Sequence fps** | Born at `fps: 24` in every factory. `setSequenceFps` has **zero callers**. Does not follow `projectStore.fps`. Video seek uses `seq.fps`; project timebase (audio, duration, export fps) uses `projectStore.fps`. | Dual timebase | `sequenceStore.ts:148,280,312,448`, `exportRenderer.ts:367` |

### N law (exact)

```
N = contentFrameCount                                    // Σ holdFrames of content sequences
for each visible sequence S with valid [in, out):
    N = max(N, out)                                      // exclusive end
    for each physic-paint layer L in S:
        N = max(N, S.in + rotoDisplayEnd(L))
```

Hidden sequences are skipped. Content-overlay / FX `outFrame` frozen at import unless the user drags the span (`updateFxSequenceRange`).

---

## 2. Measured / predicted export for the repro

**Setup (from symptom):** 16-frame `.mov` as a video content-overlay covering frames `0..15` (`outFrame = 16` exclusive); Studio physic-paint FX whose clip/fade-out ends at ruler tick `17` (`outFrame = 17` exclusive); project fps 15.

### Prediction from the table (code-derived)

| Quantity | Predicted value | Why |
|---|---|---|
| N (`totalFrames`) | **17** | `max(16, 17)` — paint span wins |
| Ruler ticks drawn | **0..17** (18 numbers) | `drawRuler` loops `f <= N` |
| Playhead reach | **0..16** | clamped to `N-1` |
| Export frame list | **17 PNGs, indices 0..16** | `for (frame = 0; frame < fm.length; frame++)` |
| Fade-out bar right edge | tick **17** | drawn inside paint clip ending at `outFrame=17` |
| Video clip bar | ticks **0..16** (right edge at 16) | `outFrame=16` exclusive → boundary 16 |

### Per-frame layer presence (first / last two)

| Frame | Content | Video overlay | Paint FX | Result |
|---|---|---|---|---|
| **0** | none (paint-only project) | YES (local 0) | YES (local 0) | paint over video |
| **1** | none | YES (local 1) | YES (local 1) | paint over video |
| **14** | none | YES (local 14) | YES (local 14) | paint over video |
| **15** | none | YES (local 15) — last video frame | YES (local 15) | paint over video |
| **16** | none | **NO** (`16 >= outFrame 16` → `continue`) | YES (local 16) | **paint on black/paper** |

**Root mechanism of the black hole:** `exportRenderer.ts:340` —
`if (overlayGlobalFrame >= getTimelineOverlaySequenceOutFrame(overlaySeq, fm.length)) continue;`
the video overlay is not drawn at all past its exclusive end. Nothing holds the last video frame. Extending the video clip to `outFrame=18` makes `16 < 18`, so the gate opens and the hole fills — matching symptom 4.

**Live PNG measurement is PENDING** (no code change / no app run before checkpoint). After checkpoint the measurement is: export PNGs, count = 17, and for frames 15 and 16 state which layers contributed pixels (expect 15 = video+paint, 16 = paint only). The automated check must assert this **frame list** (count + per-frame layer presence), not "it renders".

### Fade-out endpoint (open sub-finding)

`computeFadeOpacity`: at `localFrame = totalFrames-1`, `t = 0` → opacity **0** (fully faded) on the last frame of a clip that has `fadeOut.duration > 0`.
If the paint's fade-out truly ends at the clip end (`outFrame=17`), frame 16 should show **no** paint pixels — pure black. The user reports "the last exported frame shows the paint on BLACK", i.e. paint *visible* over black. Two readings, needs live measurement:
- (a) "last exported frame" = the last frame with visible paint (15 or a partial-fade 16) sitting over black where video should be — still the video-range gap;
- (b) paint is actually visible on index 16 → the fade ramp does not reach 0 as coded (different fade object, solid mode, or shorter duration than the bar suggests).

Either way the **video range gap is real and is what the workaround proves**.

---

## 3. Incoherence list (classified)

| # | Incoherence | Class | Evidence |
|---|---|---|---|
| I-1 | Video overlay covers `0..15` while N=17 → export frame 16 has paint and no video ("paint on black"). Out-of-range overlays are skipped, not held. | **range bug / model gap** (no tail policy for content-overlay) | `exportRenderer.ts:339-340`; symptom 4 (extend to 18 fills hole) |
| I-2 | Video `outFrame` frozen at import to `totalFrames` at that moment; never follows later N growth. Only explicit span-drag mutates it. | **range bug / model gap** | `sequenceStore.ts:317`, `updateFxSequenceRange` only |
| I-3 | Ruler draws tick **N** as a frame number; playhead cannot reach it. Fade bar right edge sits on tick N. User reads "there is a frame 17" / "il manque une image". Tick N is the end **boundary** of frame N-1, not a frame. | **display bug / model communication gap** (not an off-by-one in the data) | `TimelineRenderer.ts:1528-1546` vs `timelineStore.ts:86-103` |
| I-4 | Sequence `fps` is born at 24 and never synced to `projectStore.fps` (`setSequenceFps` has 0 callers). Video seek uses `seq.fps`; audio/export/duration use project fps. At project fps 15 the video timebase is wrong. | **model gap** (dual timebase) | `sequenceStore.ts:148,280,312`; `previewRenderer.ts:832-833`; `exportRenderer.ts:367` |
| I-5 | Video seek does `rawTime % video.duration` — extending a clip past the source length **loops** the source instead of holding the last frame. Undefined out-of-source policy. | **model gap** | `previewRenderer.ts:831-833` |
| I-6 | Fade-out opacity is exactly 0 on the clip's last frame. If user sees paint there, the fade bar and the opacity ramp disagree about "where the fade ends". | **possible off-by-one / display vs render** — measure before touching | `transitionEngine.ts:33-36` |
| I-7 | N = max of *all* visible spans (260918-o0n derived timeline). Intentional, but combined with I-1/I-2 one long overlay creates tail frames other layers do not cover. | **model law** (not a bug alone; the interaction is) | `frameMap.ts:271-286` |

**Not found / eliminated:**
- Export length vs frameMap length: consistent (both N). No off-by-one in the export loop (`frame < total` → `0..N-1`).
- Exclusive `outFrame` law: used consistently in `frameMap`, renderer gate, export loop, span-drag (`resolveFxSpanDragRange`). No evidence it is the defect — **do not change it**.
- Drag mapping `resolveTimelinePointerFrame` floor and 260918-o0n span-drag law: untouched by the above; must stay untouched.

---

## 4. Is there ONE consistent law displayed badly, or real off-by-ones?

**Answer: one core law (exclusive end, boundaries on the ruler, N = max of spans) plus two real model GAPS and one display mismatch.**

- The data model is internally consistent for frames `0..N-1`.
- The **black hole is a real range gap** (I-1+I-2): overlays have no tail policy when N exceeds their `outFrame`.
- The **"missing frame" is a display/semantics gap** (I-3): tick N is a limit labeled like a frame; playhead correctly cannot sit on a boundary. Whether the playhead *should* reach tick 17 is **not decided here** — it is a finding that the surfaces disagree about what tick N means.
- I-4/I-5 are additional model gaps in the video timebase and out-of-source policy (not the release symptom, but same family).

---

## 5. Recommendation (quick vs phase)

**PHASE** (model coherence), not a single quick — with one optional display-only quick if the user wants the ruler story clarified before/with the phase.

**Why not a quick:** the blocker symptom (paint on black) is a **range/model gap** (what covers the tail frames), not a label bug. Fixing it requires a product decision among:
1. **Hold-last-frame** for content-overlay video past `outFrame` (render policy change);
2. **Auto-follow N** for content-overlay (range law change — dangerous for intentional short overlays);
3. **Clamp / warn** when a span exceeds a sibling video range (UX guard);
4. **User extends the video** (current workaround) — no code, but the export is still "paint on black" if they forget.

Plus (if in scope for the same phase): sequence fps follows project fps (I-4), and out-of-source video policy (hold vs loop) (I-5).

**Optional quick (display only, does NOT fix the black hole):** make tick N unmistakably an end limit (and/or make fade-bar / playhead / clip-range presentation tell one story). Guardrail: a relabel alone is a band-aid — only ship it if the phase also decides the tail policy.

**Exact phase scope (proposed):**
1. Pin the truth table with tests asserting the **export frame LIST** (count + per-frame layer presence) for: video-only, video+paint (the repro), paint-only, roto-extended, audio offset/trim.
2. Decide and implement the content-overlay **tail policy** (hold-last vs follow-N vs warn) — the release-blocker fix.
3. Decide tick-N presentation and whether playhead reach is `0..N-1` (current) or something else — **finding-driven, not pre-decided**.
4. Align sequence fps with project fps (or delete the second timebase) and define video past-source policy (hold, not modulo-loop).
5. Live UAT on a signed build: 17-frame export, frames 15/16 layer presence, playhead reach, fade-bar extent.

**TDD:** after checkpoint, failing tests first for the frame LIST of the repro (17 frames; frame 15 = video+paint; frame 16 = policy-dependent).

---

## 6. Checkpoint (ANSWERED 2026-10-12)

User checkpoint answers recorded in §7. The three laws below are DECIDED and
DISPOSITIONED-to-phase — not fixed in this session.

---

## 7. Decisions (user checkpoint 2026-10-12)

These are the decided target laws for the USER-DRIVEN phase. This session does
NOT implement them. Phase is FULL (not split into quick+phase); the user creates
the phase — do not create it here.

### Law 1 — Content-overlay tail policy (dispositions I-1 / I-2)

> "Untrimmed content-overlay follows N (it is a base layer — covers the
> composition). Once the user resizes it, out is AUTHORITATIVE: past out =
> nothing (standard clip end). Past the SOURCE: HOLD the last frame by default
> (fix I-5); keep LOOP as an explicit per-clip extrapolation choice (the user's
> workaround relied on the looped nebula and liked it). Never a silent black
> frame: a visible layer that does not cover N gets a visible gap marker on the
> timeline + an export diagnostic."

### Law 2 — Playhead / tick N (dispositions I-3)

> "Playhead can sit on tick N (the end boundary), NLE-style end-of-sequence
> position. At position N the preview shows the END STATE (the last frame's
> result), the export still writes 0..N-1. Ruler presents tick N as the end
> limit, not as a frame number."

### Law 3 — Fix shape and measurement

- Fix shape: FULL PHASE as scoped in §5 (not split). Phase is USER-DRIVEN —
  the user inserts it; this session does not create a phase, roadmap entry,
  or spec.
- Measurement: BOTH — the automated export frame-LIST check now (this session),
  and the user verifies live on the signed build as release evidence.
- Exclusive `outFrame` law is UNCHANGED (guardrail holds; it is not the defect).
- Drag mapping (`resolveTimelinePointerFrame` floor) and the 260918-o0n
  span-drag law are UNCHANGED.

### Disposition of incoherences

| # | Disposition |
|---|---|
| I-1 (video past outFrame skipped, no hold-last) | **DISPOSITIONED-to-phase** (Law 1) |
| I-2 (outFrame frozen at import) | **DISPOSITIONED-to-phase** (Law 1: untrimmed follows N) |
| I-3 (tick N labeled as a frame; playhead clamped to N-1) | **DISPOSITIONED-to-phase** (Law 2) |
| I-4 (dual fps timebase) | DISPOSITIONED-to-phase (§5 scope item 4) |
| I-5 (video modulo-loops past source) | **DISPOSITIONED-to-phase** (Law 1: HOLD default, LOOP explicit per-clip) |
| I-6 (fade-out reaches 0 on last frame) | **MEASURED** — see §2 automated check: opacity is 0 on index 16 as coded; not a separate fix |
| I-7 (N = max of spans) | Model law (not a bug alone); stays |

---

## 8. Automated export frame-LIST measurement (2026-10-12)

Check: `app/src/lib/exportEngine.frameList.test.ts` (measurement only, no fix
code). Drives the real `exportRenderer.renderGlobalFrame` overlay gate with the
real `frameMap` N law. `vitest run` — 5/5 passed.

**Arrange (the repro):** video content-overlay `outFrame=16` (exclusive) +
Studio physic-paint FX `outFrame=17` (exclusive, fade-out duration 3 ending at
the clip end); roto keys at appFrames 0..16; project fps 15.

| Quantity | Predicted | MEASURED | Divergence |
|---|---|---|---|
| N (frameMap length) | 17 | **17** | none |
| Export frame indices | 0..16 (17 frames) | **0..16 (17 frames)** | none |
| Video layer frames | 0..15 | **0..15** | none |
| Paint layer frames | 0..16 | **0..16** | none |
| Frame 0 presence | video+paint | **video+paint** | none |
| Frame 1 presence | video+paint | **video+paint** | none |
| Frame 15 presence | video+paint | **video+paint** | none |
| Frame 16 presence | paint only (video gated at outFrame) | **paint only** | none |
| Overlay gate video (out=16) | 16 | **16** | none |
| Overlay gate paint (out=17) | 17 | **17** | none |
| I-6 paint opacity on frame 16 | 0 (fade-out endpoint) | **0.0** (renderFrame called, opacity 0) | none |
| I-6 paint opacity on frame 15 | 0 < x < 1 | **1/3** (fadeOut.duration=3, framesFromEnd=1) | none |

**Verdict: MEASURED = PREDICTED on every row.** The truth table's export
prediction is corroborated by the automated frame LIST. The black-hole
mechanism (`exportRenderer.ts:339-340` skip-past-outFrame, no hold) reproduces
in the measurement: frame 16 receives the paint and never the video.

I-6 sub-finding: the fade ramp DOES reach opacity 0 exactly on the clip's last
frame (index 16) as coded. `renderFrame` is still invoked for the paint on that
frame (the layer is in range) but with opacity 0 — so a fully-faded fade-out
ending at the clip end contributes no visible paint pixels on index 16. If the
user sees paint pixels on the true last frame on the signed build, the fade
object/duration/solid-mode in that project differs from this repro's
fade-out-at-clip-end; the video-range gap is independent and remains the
release-blocker mechanism.

Live signed-build UAT (user) remains the release evidence — this automated
check is corroboration of the table, not a substitute.
