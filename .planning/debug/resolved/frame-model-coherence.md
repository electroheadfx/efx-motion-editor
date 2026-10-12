---
status: resolved
trigger: "Timeline frame-model coherence (blocks v1.0.1 release). A 16-frame .mov + a Studio paint whose fade-out ends at ruler tick 17, project fps 15: last exported frame shows paint on BLACK instead of the video; playhead cannot reach tick 17; fade transition bar visually extends to tick 17; extending the video clip to 18 fills the black hole."
created: 2026-10-12T00:00:00Z
updated: 2026-10-12T17:35:00Z
goal: find_root_cause_only
release_blocker: v1.0.1
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "CONFIRMED shape: one core law (exclusive outFrame, ruler draws boundaries 0..N, N=max of visible spans, export writes 0..N-1) plus real model GAPS — content-overlay video has no tail policy (skipped past outFrame → paint on black) and its outFrame is frozen at import; plus display mismatch (tick N labeled like a frame while playhead clamps to N-1). Additional gaps: sequence.fps born at 24 never follows project fps; video seek modulo-loops past source length. Exclusive outFrame law is NOT the defect."
test: "MEASURED = PREDICTED. Automated export frame-LIST check (exportEngine.frameList.test.ts, 5/5 passed) confirms: N=17, frames 0..16, video on 0..15, paint on 0..16, frame 15 = video+paint, frame 16 = paint only (video gated at outFrame=16). I-6: paint fade opacity is 0 on index 16 as coded."
expecting: "Diagnostic work complete. Fixes (tail policy, playhead reach, fps, gap markers, extrapolation) belong to the user-driven FULL PHASE — not implemented here. User verifies live on signed build as release evidence."
next_action: "Terminal summary. Phase is user-driven — do not create it here. v1.0.1 stays blocked until the phase lands and live UAT passes."

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: 16-frame .mov + Studio paint (fade-out ending at ruler tick 17), fps 15: the export writes exactly the frames the law predicts — the last one shows paint OVER video, never paint on black; ruler ticks, playhead reach, fade-bar extent and clip ranges are mutually consistent (no missing frame, no extra frame). Do NOT pre-decide whether the playhead should reach tick 17 — that is a finding, not a premise.
actual: |
  1. The last exported frame shows the paint on BLACK instead of the video (the video layer covers 0..15, the timeline runs to 16).
  2. The playhead cannot reach tick 17 ("il manque une image" from the user's point of view) — it maxes at 16 (clamped to totalFrames - 1).
  3. The fade transition bar visually extends to tick 17, which reads as "there is a frame 17" but the cursor cannot go there.
  4. Extending the video clip to 18 (manual workaround) fills the black hole, proving the video range is the gap.
errors: None from the app; user-facing impression "il manque une image"
reproduction: Import 16-frame .mov (video range ends before the timeline) + Studio paint whose fade-out ends at ruler tick 17, fps 15 -> export -> last frame is paint on black; playhead maxes at 16, cannot reach tick 17; fade bar visually extends to tick 17; extend the video clip to 18 -> hole filled.
started: Observed on native, signed 1.0.1 build; blocks v1.0.1 release

## Method (Roto precedent: truth table BEFORE any patch)

1. TRUTH TABLE first: define the full frame-model table, one row per surface, and pin it with tests:
   - what inFrame/outFrame mean (inclusive/exclusive) for: content sequences, content overlays (video), FX sequences, physic-paint roto keys and loops, audio tracks (offsetFrame/inFrame/outFrame/slip), fades and transitions;
   - what N (totalFrames) is, as a function of those;
   - what the ruler displays at each tick, and what the tick at N is;
   - which positions the playhead can take;
   - what frames the export writes (first and last index);
   - what each layer covers on the first and last exported frame.
2. MEASURE one known export (the repro above): write the PNGs, count them, and state for each of the first/last two frames exactly which layers contributed pixels. The quantity to measure is the export's own frame list vs the table's prediction — not a console log.
3. List EVERY incoherence found, classified: display bug / range bug / off-by-one / model gap.
4. Only then decide the fix shape: quick (if it is display + one range bug) or phase (if the model itself must change). Do NOT patch any symptom before the table exists.

## Candidate observations (unverified code notes from the report)

- outFrame is EXCLUSIVE (frameMap.ts resolveSequenceTimelineRange globalEndExclusive = outFrame) — a clip with out=17 covers frames 0..16.
- The ruler draws ticks at frame BOUNDARIES (f * frameWidth, TimelineRenderer), so it displays 0..N inclusive — one number more than there are frames. The last number is a limit, not a frame.
- The playhead is clamped to N-1 (TimelineRenderer.frameFromX maxFrame = totalFrames - 1) — it cannot sit on the end boundary, which is standard in other NLEs.
- A video content-overlay freezes outFrame = totalFrames AT IMPORT (sequenceStore.createContentOverlaySequence :317) and never follows later timeline growth.
- Export length total = fm.length (exportEngine.ts:156), and N = max over every visible span including the physic-paint roto display end (last key + 1 / loop effective end, frameMap.getTimelineRequiredFrameCount).
- Open question: is there ONE consistent law (exclusive end, boundaries on the ruler, N = max of spans) that is merely displayed badly — or are there real off-by-ones between the export length, the layer coverage, the fade range, the roto end and the audio/video trims?

## Guardrails (hard)

- Do NOT change the exclusive outFrame law without evidence that it is the actual defect — it is used consistently in frameMap, the renderer and the export.
- Do NOT change the drag mapping (resolveTimelinePointerFrame floor) or the 260918-o0n span-drag law as a side effect.
- Do NOT "fix" the ruler by relabeling it before the table is written — a label is a band-aid (user's words).
- Any automated check must assert the export's frame LIST (count + per-frame layer presence), not just "it renders".
- Live evidence wins: this is a cross-surface timing model, vitest alone cannot arbitrate it.
- Release v1.0.1 stays BLOCKED until this is dispositioned. The 1.0.1 version bump stays on dev; the release phase re-runs after.
- Do NOT pre-decide whether the playhead should reach tick 17 — that is a finding, not a premise.
- NO code change before the user checkpoint. Goal of this session: FRAME-MODEL.md + recommendation, then STOP.

## Deliverables

- FRAME-MODEL.md (or the debug report): the truth table, the measured export, the incoherence list.
- A recommendation: quick vs phase for the fix, with the exact scope.
- Checkpoint to the user after the table is drafted, before any code change.

## Eliminated

<!-- APPEND only - prevents re-investigating -->

## Evidence

<!-- APPEND only - facts discovered -->

- 2026-10-12T00:00:00Z: Truth table written to `/Users/lmarques/Dev/efx-motion-editor/.planning/debug/FRAME-MODEL.md` (surface-by-surface in/out semantics, N law, ruler/playhead/export laws).
- 2026-10-12T00:00:00Z: N law = max(content Σ hold, max visible seq exclusive out, seq.in + physic-paint roto display end). `frameMap.ts:271-286`.
- 2026-10-12T00:00:00Z: Export writes `fm.length` frames `0..N-1` (`exportEngine.ts:156,251`); frameMap padded/enumerated to N. Export length vs frameMap length: consistent, no off-by-one.
- 2026-10-12T00:00:00Z: Ruler draws ticks at boundaries `0..N` INCLUSIVE (`TimelineRenderer.ts:1528-1546`); playhead/seek clamp to `0..N-1` (`timelineStore.ts:86-103`, `TimelineRenderer.ts:1552-1560`). Tick N is the end limit, not a frame.
- 2026-10-12T00:00:00Z: Video content-overlay `outFrame` frozen at import to `totalFrames` then (`sequenceStore.ts:317`); only `updateFxSequenceRange` (span drag) mutates it. Does not follow later N growth.
- 2026-10-12T00:00:00Z: Black-hole mechanism: `exportRenderer.ts:339-340` skips an overlay entirely when `frame >= outFrame` — no hold-last. Extending video outFrame past N opens the gate (symptom 4).
- 2026-10-12T00:00:00Z: Repro prediction (video out=16, paint out=17): N=17, 17 PNGs 0..16, frame 15 = video+paint, frame 16 = paint only on black/paper.
- 2026-10-12T00:00:00Z: Fade-out opacity formula gives t=0 exactly on the clip's last frame (`transitionEngine.ts:33-36`). Open sub-finding: user reports paint visible on last frame — measure which index shows paint-on-black.
- 2026-10-12T00:00:00Z: Sequence `fps` born at 24 in all factories, `setSequenceFps` has zero callers — dual timebase vs `projectStore.fps` (video seek uses seq.fps). Model gap I-4.
- 2026-10-12T00:00:00Z: Video seek `(localFrame/seq.fps) % video.duration` loops past source length instead of holding last frame. Model gap I-5.
- 2026-10-12T00:00:00Z: Exclusive outFrame law used consistently in frameMap, renderer gate, export loop, span-drag — NOT the defect; guardrail holds.
- 2026-10-12T00:00:00Z: Incoherences classified I-1..I-7 in FRAME-MODEL.md §3. Recommendation: PHASE (tail policy is a product decision) + optional display-only quick for tick N. Live PNG measurement pending.
- 2026-10-12T00:00:00Z: USER CHECKPOINT ANSWERS (architectural/product). Tail policy: "Untrimmed content-overlay follows N (it is a base layer — covers the composition). Once the user resizes it, out is AUTHORITATIVE: past out = nothing (standard clip end). Past the SOURCE: HOLD the last frame by default (fix I-5); keep LOOP as an explicit per-clip extrapolation choice (the user's workaround relied on the looped nebula and liked it). Never a silent black frame: a visible layer that does not cover N gets a visible gap marker on the timeline + an export diagnostic." Playhead: "Playhead can sit on tick N (the end boundary), NLE-style end-of-sequence position. At position N the preview shows the END STATE (the last frame's result), the export still writes 0..N-1. Ruler presents tick N as the end limit, not as a frame number." Fix shape: FULL PHASE as scoped (not split). Measurement: BOTH — automated export frame-LIST check now + user verifies live on signed build.
- 2026-10-12T17:33:00Z: Decided laws recorded in FRAME-MODEL.md §7 Decisions (user checkpoint 2026-10-12). I-1/I-2/I-3/I-5 marked DISPOSITIONED-to-phase. Not fixed in this session.
- 2026-10-12T17:33:00Z: AUTOMATED EXPORT FRAME-LIST CHECK written and run: `app/src/lib/exportEngine.frameList.test.ts` (vitest run, 5/5 passed). Drives real exportRenderer.renderGlobalFrame overlay gate + real frameMap N law. Arrange = the repro: video content-overlay outFrame=16 (exclusive) + physic-paint FX outFrame=17 (exclusive), fadeOut duration 3 at clip end, roto keys 0..16, fps 15.
- 2026-10-12T17:33:00Z: MEASURED vs PREDICTED — zero divergence. N = 17 (predicted 17). Frame indices 0..16 (17 frames). Video layer present on frames 0..15 (predicted 0..15). Paint layer present on frames 0..16 (predicted 0..16). Frame 0 = video+paint; frame 1 = video+paint; frame 15 = video+paint (last video frame); frame 16 = paint ONLY (video gated at outFrame=16 exclusive). Overlay gate: video out=16 → 16, paint out=17 → 17 (exclusive law corroborated).
- 2026-10-12T17:33:00Z: I-6 sub-finding MEASURED. Paint fade opacity on frame 16 = 0.0 exactly (fadeOut.duration=3, framesFromEnd=0, t=0); on frame 15 = 1/3 (framesFromEnd=1). renderFrame IS still invoked for the paint on frame 16 (layer in range) but with opacity 0 — a fade-out ending at the clip end contributes no visible paint pixels on the last index. If the user sees paint pixels there on the signed build, the project's fade object/duration/solid-mode differs from this repro; the video-range gap is independent and remains the release-blocker mechanism.
- 2026-10-12T17:33:00Z: Black-hole mechanism REPRODUCED in the measurement: frame 16 receives the paint and never the video (exportRenderer.ts:339-340 skip-past-outFrame, no hold-last). The table's export prediction is corroborated; live signed-build UAT by the user remains the release evidence.

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: "Model gaps around content-overlay tail coverage (I-1/I-2): N = max of spans can exceed a video overlay's frozen exclusive outFrame; overlays past outFrame are skipped with no hold-last policy, so the last exported frames show paint (or any overlay) on black. Display mismatch I-3 (ruler labels tick N as a frame; playhead clamps to N-1) produces the 'missing image' impression. Additional gaps: dual fps timebase (I-4), video modulo-loop past source (I-5)."
fix: "NOT APPLIED in this session (diagnose-only; goal find_root_cause_only). Decided target law (user checkpoint 2026-10-12) for the USER-DRIVEN FULL PHASE: (1) untrimmed content-overlay follows N; resized clip's out is authoritative (past out = nothing); (2) past SOURCE = HOLD last frame by default, LOOP as explicit per-clip extrapolation; (3) never silent black — visible layer not covering N gets a timeline gap marker + export diagnostic; (4) playhead CAN sit on tick N showing END STATE (last frame's result); export still writes 0..N-1; ruler shows tick N as end limit not a frame. Phase scope: pin export frame-LIST tests first (TDD), then the above, then live UAT on signed build. Phase is USER-DRIVEN — do not create it here."
verification: "Automated export frame-LIST check PASSED (app/src/lib/exportEngine.frameList.test.ts, vitest run 5/5): MEASURED = PREDICTED — N=17, frames 0..16, video 0..15, paint 0..16, frame 15 = video+paint, frame 16 = paint only; I-6 fade opacity 0 on index 16. Corroboration of the table. Release evidence = user live export on the signed build (17 PNGs, layer presence on 15/16) — still pending user UAT. v1.0.1 stays BLOCKED until the phase lands and live UAT passes."
files_changed: [".planning/debug/FRAME-MODEL.md", ".planning/debug/frame-model-coherence.md", "app/src/lib/exportEngine.frameList.test.ts"]
