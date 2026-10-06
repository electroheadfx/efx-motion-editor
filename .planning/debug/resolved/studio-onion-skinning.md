---
status: resolved
trigger: "debug onion
Debug: Studio onion skinning — across tracks, and with frame blending on sparse keys.
Symptom: two onion-sampling failures, same feature:
- Onion from a second track in the Studio is intermittent (sometimes shows, sometimes not).
- With frame blending on, onion shows nothing when the previous keys are far apart (my observation, cause unconfirmed).
Timeline: noticed while testing the finished quicks; Studio-side.
Reproduction: in the Studio with two tracks, (a) step frames from track 2 and observe onion, repeat across frames/sessions to map the intermittence; (b) on a track with frame blending on and keys far apart, step near a key and observe onion; (c) same with keys close together, for contrast.
Suggestion (not prescriptive): before any patch, run a truth table {track 1 vs track added in the Studio} × {keys adjacent vs sparse} × {frame blending on/off} × {scrub vs step} and report the matrix. First live check: what onion actually samples — previous physical keys only, or every displayed frame including blended ones? If sparse keys are the trigger, that may be sampling semantics rather than a render bug — surface it as a product decision before changing behavior. Name the exact frame-blending control meant (per-track row blend button vs document-level mode) before touching behavior.
Guardrails: I run the live app — Tauri/cross-webview path, so live or on-disk evidence is the verdict and unit probes are not admissible. Capture files to /tmp. Reuse the existing onion sampling path; no new transport, no new UI. ONE root cause, ONE fix, I retest. Its own session, not a part of the layer-stack or sidebar quicks."
created: 2026-10-06T09:28:58Z
updated: 2026-10-06T14:25:00Z
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "The Studio onion memo (PhysicsPaintStudio.tsx:3205) mixes track identities: rotoKeyRecords comes from the LIVE active track (studioActiveTrackId) but getRenderSource resolves on trackIdOfLaunch(launchContext) — the launch-time snapshot, which setLaunchContext never refreshes (only startFrame). After an in-Studio track switch the two disagree, the keyId/appFrame match at rotoOnionPreview.ts:124 drops every candidate, and the projection returns []. This is the same launch-snapshot-vs-live-track defect family already fixed at lines 580 and 2614-2616 for navigation — the onion memo was never converted."
test: "TDD: retarget the two source-contract pins (PhysicsPaintStudio.test.ts:281, physicsPaintProgramMonitor.test.ts:677) to assert the live active track in the onion memo (they currently pin the buggy trackIdOfLaunch string verbatim), then change line 3210 to activeTrackIdForReads and add it to the memo deps. vitest run on both files. Final verdict = user's live truth table."
expecting: "RED: pins fail against current source. GREEN after the one-line wiring fix. Live: onion from the non-launch track shows consistently (case a). Case (b) prediction: if it was observed on the non-launch track it is the same defect and the fix covers it; static analysis proves blend state and key distance cannot affect real-key onion projection on the matching track (real keys are always 'real' cells in buildProjectionFromMapping; no lookback window exists anywhere in the onion path), so (b) reproducing on the launch track post-fix would be a separate, still-undetermined defect."
next_action: "user live truth-table retest in Tauri (fix applied, automated-ready)"

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: Onion samples the previous PHYSICAL (real) key pose on the current track — never blended/interpolated in-betweens — and shows it faded regardless of key distance. With sparse keys, the far previous key must still appear faded; onion showing nothing is a bug (suspect a lookback window or the interpolation path dropping the onion source). Do NOT use displayed/interpolated frames as onion sources. Case (a) (second-track onion intermittent) is a bug regardless of the sparse-key semantics. Run the truth table FIRST, then fix ONE root cause, ONE fix, user retesses.

actual: Two onion-sampling failures, same feature. (1) Onion from a second track in the Studio is intermittent — sometimes shows, sometimes not. (2) With interpolation ON (per-track row blend button), onion shows nothing when the previous keys are far apart (user observation, cause unconfirmed).

errors: Not checked — no console capture during repro. Live/on-disk evidence is the verdict; unit probes are NOT admissible (Tauri/cross-webview path).

reproduction: In the Studio with two tracks: (a) step frames from track 2 and observe onion, repeat across frames/sessions to map the intermittence; (b) on a track with interpolation ON (per-track row blend button) and keys far apart, step near a key and observe onion; (c) same with keys close together, for contrast. Truth table to run before any patch: {track 1 vs track added in the Studio} × {keys adjacent vs sparse} × {row blend on/off} × {scrub vs step}.

started: Mixed timeline; observation date is NOT onset date. (a) second-track onion: intermittent since first OBSERVED while testing the finished quicks. Onset unknown — never tracked before, and onion DOES show from track 2 sometimes (varying frames, same session), so it has worked there, but never reliably. No break point to name; not a clean regression. (b) interpolation ON + previous keys far apart: user does not recall onion ever working in this case. Onset unknown; first observed at the same time. Studio-side in both cases.

## Clarifications (gathered, not symptoms)

frame_blending_control: "Per-track row blend button (the orange blend button on the track row = per-track interpolation on/off). The document-level 'Frame blending' mode was retired from the UI on 2026-09-11 and coerced to 'duplicate' at every store entry, so it cannot be what the user toggled. 'frame blending on' means track interpolation ON via that row button (physicPaintStore.setRotoPhysicalInterpolationState)."

sampling_semantics_product_decision: "Onion sources = previous PHYSICAL (real) key pose on the current track only. Never blended/interpolated in-betweens, never displayed frames. Faded regardless of key distance. Sparse keys must still show the far previous key faded. Onion showing nothing is a BUG (suspect lookback window or interpolation path dropping the onion source)."

scope_and_guards: "Its own session — NOT part of the layer-stack or sidebar quicks. Reuse the existing onion sampling path; no new transport, no new UI. ONE root cause, ONE fix; user retesses. Capture evidence files to /tmp. Live or on-disk evidence is the verdict."

## Eliminated

<!-- APPEND only - prevents re-investigating -->

## Evidence

<!-- APPEND only - facts discovered -->
- timestamp: "2026-10-06T13:30:00Z"
  observation: "Onion memo (PhysicsPaintStudio.tsx:3205-3213) passes realKeyRecords from the LIVE active track (line 729-730: activeTrackIdForReads = studioActiveTrackId()) but getRenderSource resolves getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame) — the launch snapshot (line 470: lc?.document?.activeTrackId ?? ''). setLaunchContext (line 542) only ever updates startFrame, so lc.document.activeTrackId is frozen at launch."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx"
- timestamp: "2026-10-06T13:32:00Z"
  observation: "Mismatch kills every candidate: rotoOnionPreview.ts:124 skips a record when source.keyId !== record.keyId; resolving against the wrong track yields either null source (no structural/empty cell) or another track's keyId — projection returns []. This is the documented defect family: line 572-580 (startFrame reseed: 'the launch snapshot's activeTrackId still points at the track that was active at the last launch replacement') and line 2614-2616 ('read the LIVE active track — after a track switch the launch snapshot still points at the previous track') already fixed navigation for exactly this; the onion memo was missed. The pin comment in physicsPaintProgramMonitor.test.ts:667-671 even SAYS the seam should read the ACTIVE track while pinning trackIdOfLaunch."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoOnionPreview.ts"
- timestamp: "2026-10-06T13:35:00Z"
  observation: "Case (b) static refutation of a blend/distance mechanism on the matching track: buildProjectionFromMapping (physicsPaintRotoPhysicalResolver.ts:3498) always emits kind 'real' cells for real keys regardless of interpolationEnabled (generated cells are strict interiors only); getRotoPhysicalRenderSource therefore returns kind 'real' for a real-key frame with or without blend; projectOnionCandidates has NO lookback/distance window (filter is appFrame < currentFrame, slice by count >= 1); getOnionFrameOpacity clamps depth to 0.15 minimum — no code path turns distance into zero frames. Onion projection is blend- and distance-independent when records and render sources resolve on the same track."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts"
- timestamp: "2026-10-06T13:37:00Z"
  observation: "TWO existing source-contract pins assert the buggy line verbatim: PhysicsPaintStudio.test.ts:281 and physicsPaintProgramMonitor.test.ts:677 both expect getRotoPhysicalRenderSource(launchContext.layerId, trackIdOfLaunch(launchContext), appFrame). These are the RED targets."
  source: "/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.ts"
- timestamp: "2026-10-06T14:20:11Z"
  observation: "TDD RED confirmed: retargeted both pins to the live active track — exactly the 2 pinned tests failed against the unchanged source (168 others passed), each failure showing the old trackIdOfLaunch string."
  source: "vitest run PhysicsPaintStudio.test.ts physicsPaintProgramMonitor.test.ts"
- timestamp: "2026-10-06T14:21:42Z"
  observation: "TDD GREEN after the one-line wiring fix (line 3210: activeTrackIdForReads; deps gain activeTrackIdForReads): 178/178 tests pass across the two pin files + rotoOnionPreview.test.ts."
  source: "vitest run (targeted)"
- timestamp: "2026-10-06T14:23:02Z"
  observation: "Broader sweep: src/components/physic-paint = 2802 tests pass; the one failed SUITE (PhysicsPaintStudioView.test.ts, '_setPaintMarkDirtyCallback is not a function') reproduces with the fix stashed → PRE-EXISTING, unrelated. tsc reports 3 errors, all in files this session never touched → pre-existing."
  source: "vitest run src/components/physic-paint + git stash control"


## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: "Studio onion memo track-identity mismatch: rotoKeyRecords came from the LIVE active track while getRenderSource resolved on trackIdOfLaunch(launchContext) — the launch-time snapshot, never refreshed (setLaunchContext only writes startFrame). After an in-Studio track switch the two disagree and rotoOnionPreview.ts:124 (source.keyId !== record.keyId) drops every candidate → empty projection → no onion. Same defect family already fixed for navigation (lines 580, 2614-2616: 'read the LIVE active track — after a track switch the launch snapshot still points at the previous track'); the onion memo was the missed conversion. Case (a) explained directly; case (b) is this same defect IF observed on the non-launch track — static analysis proves blend state and key distance cannot affect real-key onion projection on the matching track (real keys always get 'real' cells; no lookback window exists), so a blend+sparse failure reproducing on the LAUNCH track would be a separate, still-undetermined defect exposed by the live truth table."
fix: "PhysicsPaintStudio.tsx onion memo: getRenderSource now resolves on activeTrackIdForReads (the live active track, same authority as rotoKeyRecords) and activeTrackIdForReads was added to the memo deps; comment documents the rule. ONE wiring fix, no new transport/UI, existing onion sampling path reused."
verification: "TDD: both source-contract pins retargeted FIRST (RED confirmed — exactly the 2 pins failed against the old string), fix applied, GREEN: 178 tests in PhysicsPaintStudio.test.ts + physicsPaintProgramMonitor.test.ts + rotoOnionPreview.test.ts pass; full src/components/physic-paint sweep = 2802 tests pass (PhysicsPaintStudioView.test.ts suite failure is PRE-EXISTING — reproduced with the fix stashed; 3 tsc errors also pre-existing in untouched files). LIVE UAT PASSED 2026-10-06: user retested the truth table in Tauri — {track 1 vs non-launch track} x {adjacent vs sparse keys} x {row blend on/off} x {scrub vs step} — all cells approved ('it rocks, all UAT approved'). Case (b) closed by the same root cause; no separate blend/sparse defect reproduced."
files_changed: ["app/src/components/physic-paint/PhysicsPaintStudio.tsx", "app/src/components/physic-paint/PhysicsPaintStudio.test.ts", "app/src/components/physic-paint/view/physicsPaintProgramMonitor.test.ts"]
guardrail_verdict: "UAT APPROVED 2026-10-06 — live truth-table retest passed in Tauri; session CLOSED"
