---
phase: quick-261010-bkv
plan: 261010-bkv
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/lib/audioGain.ts
  - app/src/lib/audioGain.test.ts
  - app/src/components/sidebar/AudioProperties.tsx
  - app/src/components/sidebar/AudioProperties.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
  - app/src/components/physic-paint/view/physicsPaintAudioController.ts
  - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
  - app/src/lib/documentSoundGates.ts
  - app/src/lib/documentSoundGates.test.ts
  - app/src/lib/playbackEngine.test.ts
autonomous: true
requirements: [QUICK-261010-BKV]

estimate:
  tokens: 42000
  raw_tokens: 42000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Editor sidebar opens on a single TRACK section that holds the track name, the Gain slider (-20 to +20 dB, default 0, linear slider in dB domain = perceptually uniform), the mute toggle, and the audio max readout; the old standalone volume section is gone."
    - "Studio Document-sound Gain is the same -20..+20 dB control (default 0) and the engine receives true linear amplitude from the stored -100..+100 gain integer."
    - "Editor fades and In/Out each render as two side-by-side SliderStepper columns; each fade curve select stays in that fade's below slot."
    - "Editor Position sliderMax is the timeline totalFrames end (not the clip trim span), so Position can be dragged out to the last track end."
    - "Editor and Studio In/Out display and commit in audio seconds (frames / fps under the hood); Out defaults to and is capped by the audio max time; TRACK/file meta shows that max as seconds plus frames (e.g. 3.5s / 84 frames)."
  artifacts:
    - app/src/lib/audioGain.ts
    - app/src/lib/audioGain.test.ts
    - app/src/components/sidebar/AudioProperties.tsx
    - app/src/components/sidebar/AudioProperties.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts
  key_links:
    - "dB domain is the perceptually uniform slider: UI values are dB, persistence stays linear amplitude (editor volume) or the -100..+100 gain integer (Studio) — converters in audioGain.ts are the only bridge"
    - "Studio gain -100..+100 is remapped to volume via 10^(gain/100) so gain/5 equals dB and +100 is +20 dB; parsers, isValidGain, and soundGainLineY stay on -100..+100"
    - "In/Out seconds are a view unit only — inFrame/outFrame stay frames from audio file start for .mce; convert with project fps"
    - "Position sliderMax reads totalFrames (timelineStore.totalFrames / lib/frameMap totalFrames), never outFrame-inFrame"
---

<objective>
Apply UAT refinements on 261009-v0s: logarithmic Gain (dB) grouped into a TRACK section, 2-column fades/In-Out layout, Position sliderMax from the timeline end, and In/Out in audio time with an audio-max readout — in both the main-app AudioProperties sidebar and the Studio Document-sound modal.

Purpose: the linear volume percent and clip-trim Position ceiling made gain and placement hard to judge; In/Out in frames did not match how audio is heard (seconds).
Output: audioGain converters, reworked AudioProperties TRACK/FADES/POSITION blocks, Studio Gain + In/Out unit updates, updated source-pin and mapping tests. No .mce field add/remove/rename. No timeline interaction changes.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.claude/skills/efx-preact-reactivity/SKILL.md

Key files (landmarks verified live 2026-10-10):
- app/src/components/sidebar/AudioProperties.tsx — handleReplace :36-63 (NEVER-COPY region pinned by app/src/lib/mainAppAudioSources.test.ts — keep byte-stable through `const volumePercent`); volumePercent :65; TRACK NAME :69-85; FILE :87-102; VOLUME+mute :104-137 (replace with TRACK/Gain); FADES :139-190 (full-width stack of two SliderStepper + below curve selects); POSITION :192-224 (Position/In/Out full-width; Position sliderMax uses clip-trim span :201); BEAT SYNC accordion :226-297 (leave as-is).
- app/src/components/shared/SliderStepper.tsx — below slot :57-58; sliderMin/sliderMax TRACK-only; trackCeiling :261; do not restyle.
- app/src/components/shared/NumericStepper.tsx — commit contract (step grid, EU-comma, coalescing). Decimal steps use explicit step + freeEntry/resolveStep only when required (260924-ffd).
- app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx — Position :360-372; Trim in/out pair :375-399; Gain :404-418 (step 5, min -100, AUDIO_GAIN_HINT `0 = unity`); fades pair :420-470; FADE_CURVE_OPTIONS :101; copy constants :75-99.
- app/src/components/physic-paint/view/physicsPaintAudioController.ts — previewGain/commitGain :96-102, :299-307, :458; isValidGain integer -100..+100 :168-170 (store-level — keep); buildFreshSoundClip gain: 0 :195.
- app/src/types/audio.ts — volume :12 (linear amplitude; 1.0 = unity); duration seconds :22; totalFramesInFile :28; inFrame/outFrame frames-from-audio-start :14-15; offsetFrame timeline start :13.
- app/src/stores/audioStore.ts — setVolume :96-112; setInOut :150-166; setOffset :132-148.
- app/src/stores/timelineStore.ts — totalFrames: totalFramesSignal :77 (from app/src/lib/frameMap.ts :76-78).
- app/src/lib/documentSoundGates.ts — toDocumentSoundAudioTrack volume mapping :102 `(sound.gain + 100) / 100` → change to true dB amplitude; totalFramesInFile: sound.outFrame :114.
- app/src/efx-paint/document/efxPaintDocument.ts — DocumentSoundClip.gain integer -100..+100 :191-196 (keep the field and its parser range; only the engine mapping and the UI unit change).
- app/src/lib/audioPeaksCache.ts — getSourceFrames(id) :29 (Studio source length in frames).
- Tests: app/src/components/sidebar/AudioProperties.test.ts; app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts; app/src/components/physic-paint/view/physicsPaintAudioController.test.ts; app/src/lib/documentSoundGates.test.ts (:150, :643 volume pins); app/src/lib/playbackEngine.test.ts (:501 volume pin); app/src/lib/mainAppAudioSources.test.ts (keep green).

Conversion law (implement once in app/src/lib/audioGain.ts):
- GAIN_DB_MIN=-20, GAIN_DB_MAX=20; dbToLinear(db)=10^(db/20); linearToDb(l)= l<=0 ? -20 : 20*log10(l).
- Studio gain integer ↔ dB: gainToDb(gain)=gain/5, dbToGain(db)=round(db*5). Stored gain stays -100..+100.
- Editor volume is linear amplitude in the existing volume field (format unchanged). UI edits dB via linearToDb/dbToLinear. 0 dB = volume 1.0. +20 dB stores linear 10.0 (true amplitude headroom — the historical 0..1 comment is updated, the field name/type stay).
- Seconds: framesToSeconds(f, fps)=f/fps; secondsToFrames(s, fps)=round(s*fps). In/Out view values are seconds; inFrame/outFrame stay frames.

Constraints honored: Preact + @preact/signals only; no SliderStepper/NumericStepper chrome edits; handleReplace never-copy region byte-stable; no .mce field add/remove/rename; TimelineInteraction untouched; pnpm; vitest run only (never watch); no dev server; no push; native visual UAT stays with the user. PATH FORM: repo-root-relative. One atomic commit per task.
</context>

<!-- planner-discipline-allow: TRACK NAME, volumePercent, VOLUME, 0 = unity, -100, (gain + 100) / 100 -->

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Logarithmic Gain (dB) + TRACK section grouping</name>
  <files>app/src/lib/audioGain.ts, app/src/lib/audioGain.test.ts, app/src/components/sidebar/AudioProperties.tsx, app/src/components/sidebar/AudioProperties.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts, app/src/components/physic-paint/view/physicsPaintAudioController.ts, app/src/components/physic-paint/view/physicsPaintAudioController.test.ts, app/src/lib/documentSoundGates.ts, app/src/lib/documentSoundGates.test.ts, app/src/lib/playbackEngine.test.ts</files>
  <behavior>
    - audioGain: dbToLinear(0)=1, dbToLinear(-20)≈0.1, dbToLinear(20)≈10; linearToDb(1)=0, linearToDb(0)=-20; gainToDb(-100)=-20, gainToDb(0)=0, gainToDb(100)=20; dbToGain round-trips integers on the 5-wide gain grid.
    - Controller commitGain rejects dB outside -20..+20 and non-grid values; stored DocumentSoundClip.gain remains an integer in -100..+100.
    - toDocumentSoundAudioTrack maps gain 0 → volume 1, gain -100 → volume 0.1, gain 100 → volume 10.
  </behavior>
  <action>Read .claude/skills/efx-preact-reactivity/SKILL.md first. Three coordinated edits (A1+A2). Keep handleReplace and mainAppAudioSources pins green. Do not restyle SliderStepper. Do not change DocumentSoundClip field names, efxPaintDocumentParsers gain range, or soundGainLineY.

(1) Create app/src/lib/audioGain.ts with the conversion law from the context block (GAIN_DB_MIN/MAX, dbToLinear, linearToDb, gainToDb, dbToGain) plus framesToSeconds/secondsToFrames(seconds, fps). Write app/src/lib/audioGain.test.ts first (RED) covering the behavior cases above, then implement until green.

(2) Editor A1+A2 in app/src/components/sidebar/AudioProperties.tsx. Replace the standalone volume block with a TRACK section per D-UAT:
- RuleSectionHeader text becomes `TRACK` (verbatim). The name input stays under it.
- Replace the volume percent row with one SliderStepper labeled `Gain` (verbatim): value=linearToDb(track.volume), step=1, min=-20, max=20, precision=1, onChange → audioStore.setVolume(track.id, dbToLinear(val)). Default 0 dB when volume is 1. Keep mute on this control (mute button beside the Gain field or on the TRACK header row — one click, same setMuted). Delete the separate volume section header and the volumePercent readout.
- Store path unchanged: setVolume still takes linear amplitude. Update the types/audio.ts volume comment to linear amplitude with 1.0 = unity (field name/type unchanged). For dB above 0 the linear value is greater than 1 (true amplitude) — that is intentional.

(3) Studio A1 in app/src/components/physic-paint/view/physicsPaintAudioController.ts + PhysicsPaintAudioModalView.tsx:
- previewGain and commitGain speak dB (-20..+20). commitGain converts dbToGain and still patches the stored integer gain via the existing commitPatch door; invalid dB never commits (prior value stays). buildFreshSoundClip keeps gain: 0 (0 dB).
- Modal Gain SliderStepper: step=1, min=-20, max=20, label `Gain`; drop the old -100..+100 and the inline `0 = unity` hint from the label (the dB unit is the label). Keep the SOUND section order; A2 grouping is N/A in Studio (no track-name field).
- Update isValidGain tests / controller tests that call commitGain with the old -100..+100 numbers to the dB domain.

(4) Engine mapping in app/src/lib/documentSoundGates.ts toDocumentSoundAudioTrack: volume becomes dbToLinear(gainToDb(sound.gain)) i.e. 10^(gain/100). Update the volume pins in documentSoundGates.test.ts and playbackEngine.test.ts (the old linear (gain+100)/100 comment and 0.75 expectation for gain -25).

(5) Tests: retarget AudioProperties.test.ts for TRACK + Gain + no standalone volume section; PhysicsPaintAudioModalView.test.ts for dB Gain range; controller tests for dB commitGain. Keep mainAppAudioSources.test.ts green.

One atomic commit with all Task 1 files.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/audioGain.test.ts src/components/sidebar/AudioProperties.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/lib/documentSoundGates.test.ts src/lib/playbackEngine.test.ts src/lib/mainAppAudioSources.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>TRACK section holds name + Gain (dB -20..+20, default 0) + mute; no standalone volume section or percent readout; Studio Gain is the same dB control; stored Studio gain stays integer -100..+100 and maps to true linear amplitude in toDocumentSoundAudioTrack; editor setVolume still writes linear volume; converter + mapping + UI source pins pass; typecheck clean; one atomic commit.</done>
</task>

<task type="auto">
  <name>Task 2: Editor 2-column fades and In/Out layout</name>
  <files>app/src/components/sidebar/AudioProperties.tsx, app/src/components/sidebar/AudioProperties.test.ts</files>
  <action>Layout-only in app/src/components/sidebar/AudioProperties.tsx (B1+B2). Match the Studio pair geometry (two equal columns, gap) without touching SliderStepper.

(1) FADES: wrap the two fade SliderStepper instances in a 2-column grid (same shape as the Studio .physics-paint-audio-pair: two minmax(0,1fr) columns). Each fade keeps its own below slot curve select under its own bar. Keep setFades wiring and labels.

(2) POSITION: Position stays one full-width SliderStepper. In and Out become a second 2-column row under it (same pair geometry as fades). Keep setInOut wiring and the 1-frame Out span.

(3) Update AudioProperties.test.ts source pins for the pair layout (two-column wrappers around the two fades and around In/Out; curve selects still via below).

One atomic commit with both files.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/components/sidebar/AudioProperties.test.ts</automated>
  </verify>
  <done>Fade in and Fade out sit side by side with each curve select under its own bar; In and Out sit side by side under full-width Position; setters and 1-frame Out span unchanged; layout pins pass; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Position timeline sliderMax + In/Out audio time + max-time readout</name>
  <files>app/src/lib/audioGain.ts, app/src/lib/audioGain.test.ts, app/src/components/sidebar/AudioProperties.tsx, app/src/components/sidebar/AudioProperties.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts</files>
  <behavior>
    - secondsToFrames(3.5, 24)=84; framesToSeconds(84, 24)=3.5.
    - In/Out view values are framesToSeconds(inFrame/outFrame); commits round back through secondsToFrames; 1-frame minimum Out span preserved in frame space.
    - Position sliderMax equals timeline totalFrames (floored so it never sits below the current offsetFrame).
  </behavior>
  <action>Time-unit and range refinements (C1-C4). No store/mce key changes. No TimelineInteraction edits.

(1) C1 Position sliderMax in AudioProperties: replace the clip-trim ceiling on the Position SliderStepper with the timeline end. Read totalFrames from app/src/lib/frameMap.ts (same signal timelineStore.totalFrames exposes). Pass sliderMax={Math.max(totalFrames, track.offsetFrame, 1)} so the track never inverts when the clip already sits past the end. Keep sliderMin as today (includes negatives) and keep setOffset commit-unbounded.

(2) C2 editor In/Out in audio seconds: value=framesToSeconds(track.inFrame/outFrame, projectStore.fps.peek()); onChange converts back with secondsToFrames and calls audioStore.setInOut (Out keeps min = in + 1 frames). Labels use a seconds unit suffix (`In (s)` / `Out (s)`). sliderMax for Out = track.duration (audio max seconds); In sliderMax = same max. Default Out stays the audio max time (import already writes outFrame = full source; do not reset user trims).

(3) C3 Studio In/Out in audio seconds in PhysicsPaintAudioModalView: same conversion through controller.getFps(). Keep commitInFrame/commitOutFrame frame-based. Out sliderMax = source max seconds from audioPeaksCache.getSourceFrames(sound.sourceId)/fps when available, else sound.outFrame/fps. Labels use the seconds unit.

(4) C4 audio max readout in the TRACK/file meta: format `{duration}s / {frames} frames` with seconds to one decimal (e.g. 3.5s / 84 frames). Editor: under TRACK (track.duration + track.totalFramesInFile). Studio: same string under FILE (derive frames from audioPeaksCache.getSourceFrames(sound.sourceId) when present, else sound.outFrame; seconds = frames/fps or the decoded duration if the controller already has it).

(5) Tests: extend audioGain.test.ts for frames↔seconds; pin AudioProperties sliderMax=totalFrames and In/Out seconds conversion; pin Studio In/Out seconds + max-time string. Keep Task 1/2 pins green.

One atomic commit with all Task 3 files.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/audioGain.test.ts src/components/sidebar/AudioProperties.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Position can reach the timeline end (sliderMax from totalFrames); In/Out read as seconds in editor and Studio while inFrame/outFrame stay frames; Out defaults to and is capped by audio max time; TRACK/file meta shows `{seconds}s / {frames} frames`; conversion tests and source pins pass; typecheck clean; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user pointer → sidebar/Studio numeric fields | SliderStepper commits still clamp through existing setters |
| stored gain/volume → WebAudio engine | dB conversion must not emit NaN/Infinity into GainNode |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261010-bkv-01 | Tampering | audioGain conversions | medium | mitigate | Clamp dB to [-20, 20] and non-positive linear to the floor before store commit; unit tests pin round-trips; invalid Studio dB never commits (prior value stays) |
| T-261010-bkv-02 | Information Disclosure | n/a | low | accept | UI/unit mapping only; no new IO surface |
| T-261010-bkv-03 | Denial of Service | GainNode value | low | mitigate | mapVolume path receives finite linear only (0.1..10 from the dB grid); no unbounded exponent from free-typed junk (NumericStepper commit contract clamps) |
| T-261010-bkv-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package-manager installs in this quick — package-legitimacy gate N/A |
</threat_model>

<verification>
pnpm --filter efx-motion-editor exec vitest run src/lib/audioGain.test.ts src/components/sidebar/AudioProperties.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/lib/documentSoundGates.test.ts src/lib/playbackEngine.test.ts src/lib/mainAppAudioSources.test.ts && pnpm --filter efx-motion-editor run typecheck
</verification>

<success_criteria>
Automated-ready when the verification command is green and Task 1-3 dones hold. Status stays automated-ready until the user's live UAT passes (rows 1-8 in the task spec: TRACK+Gain dB, Studio Gain dB, 2-col fades, 2-col In/Out, Position timeline sliderMax, In/Out audio time + default Out max, Studio In/Out audio time, max-time readout). No claim of done before that UAT.
</success_criteria>

<output>
Create `.planning/quick/261010-bkv-audio-gain-layout-time-refinements-uat-o/261010-bkv-SUMMARY.md` when done
</output>
