---
phase: quick-261012-exn
plan: 261012-exn
type: tdd
wave: 1
depends_on: []
files_modified:
  - app/src/lib/audioEngine.ts
  - app/src/lib/audioEngine.test.ts
  - app/src/lib/audioExportMixer.ts
  - app/src/lib/audioExportMixer.test.ts
  - app/src/lib/exportEngine.ts
  - app/src/lib/exportEngine.test.ts
  - app/src/stores/projectStore.ts
  - app/src/stores/audioStore.ts
  - app/src/lib/documentSoundPeaks.ts
  - app/src/components/views/ImportedView.tsx
  - app/src/components/layout/TimelinePanel.tsx
autonomous: true
requirements: [SND-01, SND-02]

estimate:
  tokens: 36000
  raw_tokens: 18000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "play() and playDelayed() never return silently when the buffer is absent: they await an in-flight decode and start playback once it resolves, or record a refusal naming the track/clip into a visible Preact-signal error list — the fix lives entirely in audioEngine, so main-timeline playback and the Studio monitor inherit one behavior with zero per-realm call-site forks (SND-01)."
    - "The reopen race is closed: projectStore's fire-and-forget re-decode registers a pending promise in audioEngine, and pressing play before it lands starts the clip when the decode resolves instead of skipping in silence (SND-01)."
    - "Every decode failure listed in the brief reaches the user: the projectStore reopen catch and the documentSoundPeaks catch append a named message to the audio decode error signal (rendered as the existing red error strip in TimelinePanel), and the ImportedView audio-import catch appends to imageStore.importErrors (already rendered there) — console output alone is never the only trace (SND-01)."
    - "The export pre-check computes MISSING buffers (partial AND zero cases) before rendering, and any non-muted mix entry lacking a buffer aborts the export through the existing exportStore error status with an errorMessage that names every missing clip (SND-02)."
    - "renderMixedAudio validates all non-muted buffers BEFORE constructing the OfflineAudioContext and throws an Error naming the missing clip(s), so the mixer can never render a mix that silently omits a track (SND-02)."
    - "All four mandated RED regression legs exist and were failing against pre-fix code with their own assertion messages; all pre-existing suites (audioEngine, audioExportMixer source-scan, the four exportEngine suites, playbackEngine, documentSoundMultiClip, documentSoundPeaks, projectStore) stay green with zero Task-1 assertion edits."
  artifacts:
    - app/src/lib/audioEngine.ts
    - app/src/lib/audioEngine.test.ts
    - app/src/lib/audioExportMixer.ts
    - app/src/lib/audioExportMixer.test.ts
    - app/src/lib/exportEngine.ts
    - app/src/lib/exportEngine.test.ts
    - app/src/stores/projectStore.ts
    - app/src/stores/audioStore.ts
    - app/src/lib/documentSoundPeaks.ts
    - app/src/components/views/ImportedView.tsx
    - app/src/components/layout/TimelinePanel.tsx
  key_links:
    - "The pendingDecodes registry inside audioEngine.decode() is the single seam the reopen race closes through: play/playDelayed await it, so BOTH clip families (audioStore tracks keyed by track.id and document sound clips keyed by sound.id) are covered by ONE engine-level fix with no changes at the 9 call sites (playbackEngine.ts:173/:300/:306/:350/:354, efxPaintAudioMonitor.ts:224/:226/:240/:242)."
    - "The never-reject contract of async play/playDelayed is what makes the untouched fire-and-forget call sites safe: every failure path is caught inside the engine and routed to the visible signal, so no floating uncaught rejection can surface through the playback loop."
    - "exportEngine's pre-check (fail-early, names all missing clips via exportStore) and audioExportMixer's pre-scan (fail-closed, throws before OfflineAudioContext) are two independent doors on the same SND-02 law — either one alone would leave a bypass path (pre-check skipped when mixEntries is empty late-resolved, mixer called directly)."
    - "The visible-error channel reuses two EXISTING patterns end to end: imageStore.importErrors' red strip (rendered in ImportedView, zero new UI) and exportStore.progress.errorMessage on status 'error' (rendered by ExportProgress); the one new signal (audioDecodeErrors) mirrors the importErrors shape exactly, is deduped by an idempotent setter, and is cleared by audioStore.reset() on project close — no new notification system."
---

<objective>
Make document-sound decode readiness fail visible instead of silent: playback awaits an in-flight decode or refuses with a named, user-visible error (SND-01), and both export surfaces — the exportEngine pre-check and the audioExportMixer loop — surface an undecodable clip by name through the existing exportStore error status instead of dropping it (SND-02).

Purpose: five live-code holes currently swallow audio failures without a trace. audioEngine.ts:49/:109 return silently when a buffer is missing (play AND playDelayed, both clip families); projectStore.ts:783-803 re-decodes on reopen fire-and-forget so pressing play early skips in silence; audioExportMixer.ts:102 drops a clip with a bare continue; exportEngine.ts:362-367 only console.warns when ZERO buffers loaded, so partial drops vanish; and the decode catches at projectStore.ts:791-793, ImportedView.tsx:370, documentSoundPeaks.ts:52 are console-only. A user editing to audio they cannot hear, or exporting a mix missing a clip, gets no signal at all.
Output: an engine-level pending-decode registry + async never-reject play/playDelayed with a visible refusal list, surfaced decode catches, a buffer-validating export pre-check, a fail-closed mixer pre-scan, and four RED-first regression legs that pin each hole (SND-01, SND-02).

Scope: v1.0.1 Quick 3 only. Stop after this quick for native UAT before the Release quick (REL-01/02). No backward-compat code; no new packages (zero install surface); no test-config changes; no Rust.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@.claude/skills/efx-preact-reactivity/SKILL.md
@.claude/skills/efx-async-orchestration/SKILL.md
@.claude/skills/tdd/SKILL.md

ACCEPTANCE (REQUIREMENTS.md:24-25, rows :64-65 both `Quick 3 | Pending`):
- SND-01: playback never silently skips a clip whose buffer failed to decode — awaits the decode or refuses with a visible error.
- SND-02: export mix never silently drops a clip — an undecodable clip surfaces a diagnostic instead of a bare continue.

FIX CONTRACT (from the quick brief — the five holes, verified live 2026-10-12):
- Playback: audioEngine.ts play :46-49 and playDelayed :106-109 — `if (!buffer) return;` silent no-op. BOTH methods, BOTH clip families.
- Reopen race: projectStore.ts :783-803 async fire-and-forget IIFE re-decodes audioStore tracks (catch :791-793 console-only) then document clips via ensureDocumentSoundPeaks — play before it lands = silence.
- Export hole 1: audioExportMixer.ts loop :99-102 — `if (!buffer) continue;` drops the clip with no trace. OfflineAudioContext is constructed at :97, BEFORE the loop (node has no OfflineAudioContext — the buffer scan must move above that line for the RED/GREEN leg to run headless).
- Export hole 2: exportEngine.ts pre-check :362-367 — computes tracksWithBuffers but only console.warns when the count is ZERO; partial drops proceed to render untouched.
- Console-only decode failures: projectStore.ts :791-793, ImportedView.tsx :370, documentSoundPeaks.ts :52.

GUARDRAILS (locked):
- ONE shared fix at the audioEngine contract — playbackEngine AND the Studio monitor (efxPaintAudioMonitor.ts:224/:226/:240/:242) inherit it with NO per-realm fork and NO call-site changes.
- Cover: both play methods, both clip families, both export surfaces, the in-flight-decode await on the reopen race, surfaced decode failures.
- Preact signals only for new visible error state (no useState). Reuse the imageStore.importErrors red-strip pattern and exportStore error status — inventing a new notification system is out of bounds.
- play/playDelayed are called synchronously from 9 sites: the chosen contract is async-with-internal-catch (awaits in-flight decode inside play, every failure routed to the visible signal, the returned promise NEVER rejects) — silent void and uncaught rejection are both unacceptable, so the fast path (buffer present) must stay effectively synchronous and all rejections must be absorbed inside the engine.
- TDD ON, RED first: the four mandated regression legs must fail against today's code before any production change. `vitest run` only, NEVER watch (CLAUDE.md). Tests collect only `src/**/*.test.ts` — never author a `.test.tsx`. No test-config hacks (vitest.config.ts stays untouched).
- PATH FORM: every path in this body is repo-root-relative; every command assumes cwd at the checkout root. pnpm, not npm. No dev server; no Chrome DevTools MCP (native UAT stays with the user).

LANDMARKS (verified live against the tree, 2026-10-12):
- app/src/lib/audioEngine.ts — singleton `audioEngine` :314; `buffers: Map` :15; `decode(trackId, arrayBuffer)` :30-35 (caches by id, no pending registry today); `getBuffer` :38-40; play :46-100 (silent return :49, `this.stop` :52, source/gain :55-65, applyFadeSchedule :68, clampedOffset/start :84-87); playDelayed :106-150 (silent return :109, scheduledStart :124, start :138); stop :153, stopAll :180; applyFadeSchedule :238-291. Imports: types + fadeCurves only — adding `@preact/signals` creates NO cycle (audioStore imports audioEngine, never the reverse; audioEngine must NOT import audioStore).
- app/src/lib/audioEngine.test.ts — `typeof` method checks :11-20 (async signatures keep passing), `it.todo` play/stop block :36-42, source-scan fade law describe :43+ (readFileSync + token asserts — additive exports don't disturb them). No AudioContext harness exists yet; Task 1 builds one (vi.hoisted fake class + vi.stubGlobal).
- app/src/lib/audioExportMixer.ts — renderMixedAudio :87; sampleRate/totalSamples :94-96; `new OfflineAudioContext` :97; loop :99-102 with the silent continue :102; abort race + 60s timeout :131-149; returns audioBufferToWav :151. Only caller is exportEngine.ts:370.
- app/src/lib/audioExportMixer.test.ts — pure source-scan suite (:14-38): shared fadeCurves law, setValueCurveAtTime for both ramps, no linearRampToValueAtTime token, FADE_OUT_FLOOR floor. None of those tokens are touched by moving the buffer scan above the constructor.
- app/src/lib/exportEngine.ts — `startExport` :132, `settings = exportStore.settings.peek()` :133 (includeAudio lives here); mixEntries built :343-351 via buildExportMixEntries(settings.includeAudio, audioStore.tracks.peek(), exportClipEntries, fps); gate `if (mixEntries.length > 0)` :352; pre-check :361-367; renderMixedAudio call :370-375; catch :383-395 sets `exportStore.updateProgress({status:'error', errorMessage: 'Audio pre-render failed: …'})` then returns; `finally` clears the cancel interval :396.
- app/src/lib/documentSoundGates.ts — buildExportMixEntries :241-258 (returns [] when includeAudio off; main tracks spread + clips appended; pure, already tested).
- app/src/stores/exportStore.ts — settings computed :33-44 (includeAudio :37), progress signal, updateProgress merges partials, resetProgress; ExportProgress.tsx renders errorMessage ONLY when `status === 'error'` — the diagnostic channel for SND-02.
- app/src/stores/projectStore.ts — audioEngine import :18; reopen IIFE :783-803 (track loop :784-795, catch :791-793 console-only, document-clip loop :797-802); closeProject :1104 (audioStore.reset() :1128 — the reset that will clear the new signal).
- app/src/lib/documentSoundPeaks.ts — fetch :44-46, `audioEngine.decode(sound.id, …)` :47, catch console-only :51-52, inFlight finally :54.
- app/src/components/views/ImportedView.tsx — imageStore import :5; audio decode catch `console.error('Failed to decode audio:', err)` :370; EXISTING error strip :468-473 (`imageStore.importErrors.value.length > 0` → `bg-(--color-error-bg)` spans) — the exact markup to mirror and the exact store the import catch pushes into.
- app/src/components/layout/TimelinePanel.tsx — 241 lines; Timeline Controls row :41-42 (`h-9` div) — insert the decode-error strip directly after that row, mirroring the ImportedView markup (signal read in render body is legal; no render-body writes, no useState — efx-preact-reactivity).
- app/src/stores/audioStore.ts — `tracks` :9, audioEngine import :6 (so reset() can clear the engine-level signal without a cycle).
- Call sites that must stay BYTE-UNTOUCHED (inheritance proof): app/src/lib/playbackEngine.ts :173 (scrub snippet), :300/:306 (startAudioPlayback main), :350/:354 (document clip leg); app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts :224/:226 (main), :240/:242 (clip).
- Test harnesses to extend: app/src/lib/exportEngine.test.ts — hoisted :20-26, audioStore mock :72 (hardcoded `peek: () => []` → make it read a hoisted array, defaulting empty so existing tests are untouched), audioEngine mock :74 (`getBuffer: () => null` → controllable per-id from hoisted), renderMixedAudio mock :76 (assert not-called), beforeEach `includeAudio.value = false` :248 (the new test flips it true), startExport helper, existing error-status assertion idiom :281-284, `makeFm` / `makeSequence` / `makeRotoLayer` fixtures. The file already has `makeTrack` for PAINT tracks — the audio fixture must be named `makeAudioTrack` (mirror playbackEngine.test.ts:57's makeMainAudioTrack).
- Mock ripple inventory (constrains API changes): 10+ files vi.mock audioEngine with generic `vi.fn()` / `getBuffer` shapes (documentSoundMultiClip :29, playbackEngine :30, documentSoundPeaks :13, documentSoundGates :29, efxPaintAudioPreview :25, four exportEngine suites :65-76). ADDITIVE members and async signatures are safe; no mock asserts play's arity or return value.
- Existing suites that gate Task 1/2/3: audioEngine.test.ts, audioExportMixer.test.ts, exportEngine.test.ts + exportEngine.feedback/loops/paintEnumeration.test.ts, documentSoundPeaks.test.ts, projectStore.test.ts (spyOn decode :416), playbackEngine.test.ts, documentSoundMultiClip.test.ts.
- gsd_run lives at `.claude/gsd-core/bin/gsd_run` (NOT on PATH) — invoke it by path for frontmatter/structure validation and commit.

SCOPE OUT (do not touch):
- efxPaintAudioMonitor.ts fetchAndDecodeSource's console.warn — its preparedTrackIds gate already prevents play being called for an un-prepare'd source, the brief does not list it as a hole, and the shared engine fix applies to its call sites anyway.
- Waveform peak UI, AudioProperties, mainAppAudioSources, documentSoundGates' gating law, Rust, capabilities, vitest.config.ts, any package.json dependency.
- No migration, no shim, no new user-facing notification component, no dev server.
</context>

<feature>
  <name>Document-sound decode readiness (261012-exn, SND-01/SND-02)</name>
  <files>app/src/lib/audioEngine.ts, app/src/lib/audioExportMixer.ts, app/src/lib/exportEngine.ts, app/src/stores/projectStore.ts, app/src/stores/audioStore.ts, app/src/lib/documentSoundPeaks.ts, app/src/components/views/ImportedView.tsx, app/src/components/layout/TimelinePanel.tsx</files>
  <behavior>
    Playback contract (SND-01):
    - play('t1', …) / playDelayed('t1', …) with NO buffer and NO pending decode → the named refusal message (contains the track/clip name) lands in the audioDecodeErrors signal; today nothing is recorded anywhere.
    - decode('t1', bytes) started (promise pending) THEN play('t1', …) → source.start is NOT called while the decode is in flight; once the decode resolves, the awaited play promise completes and source.start fires exactly once with the same clamped offset the sync path would have used.
    - decode('t1', bytes) REJECTS while play awaits it → play's promise RESOLVES (never rejects) and the refusal naming the track is recorded; an unhandled rejection through the play path is a contract violation.
    - The fast path (buffer already present) stays effectively synchronous: the body reaches source.start before yielding, so seek-restart/scrub sequencing in playbackEngine is unchanged.
    - Both clip families are the same code path: a document-clip-shaped track (name = sound.sourcePath, id = sound.id, built by toDocumentSoundAudioTrack) behaves identically to an audioStore track.

    Surfaced decode failures (SND-01):
    - projectStore's reopen catch and documentSoundPeaks' catch each append a named message (track name / sourcePath carried through) to audioDecodeErrors in addition to their console output.
    - ImportedView's audio-import catch appends to imageStore.importErrors — the strip at ImportedView.tsx:468-473 renders it with zero new UI.
    - audioDecodeErrors is deduped by an idempotent setter (repeated refusals do not grow the list) and cleared by audioStore.reset() on project close.

    Export pre-check (SND-02):
    - includeAudio ON, two non-muted mix entries, buffer present for ONE → startExport ends with `progress.status === 'error'` and errorMessage CONTAINING the missing entry's name; renderMixedAudio is never called. RED today: the partial case only warns for the zero case, so export runs to completion.
    - includeAudio ON, ZERO buffers → same named error (today: console.warn only, export completes).
    - includeAudio OFF or no mix entries → pre-check block untouched; all existing export suites stay green.

    Mixer pre-scan (SND-02):
    - renderMixedAudio([goodTrack, missingTrack]) REJECTS with an Error whose message contains missingTrack's name — validated BEFORE `new OfflineAudioContext` so the leg runs headless in node. RED today: the loop's continue renders on, and in node the call fails on the missing OfflineAudioContext with a message that never names the clip.
    - All non-muted buffers present → the scan passes and the existing scheduling/fade/WAV behavior is byte-unchanged (the source-scan fade law tests remain green).

    Non-regression:
    - The 9 play/playDelayed call sites, the monitor's preparedTrackIds gate, playbackEngine's scrub throttle, and every existing mock stay untouched; zero Task-1 assertion edits in GREEN tasks.
  </behavior>
  <implementation>
    (1) audioEngine gains a `pendingDecodes: Map<string, Promise<AudioBuffer>>` registry that decode() populates (compare-before-delete in finally), a module-level `audioDecodeErrors` signal (mirrors imageStore.importErrors: string[] + idempotent `addAudioDecodeError` + clear used by audioStore.reset()), and a shared private `resolveBufferForPlay(trackId, track)` used by BOTH play and playDelayed: synchronous buffer hit returns immediately (fast path stays sync); on a miss it awaits the pending decode, re-checks, and on any failure (absent, rejected, timed out by rejection) records the named refusal and returns null. play/playDelayed become async with a whole-body try/catch so the returned promise NEVER rejects; playDelayed captures its scheduling anchor before awaiting so a slow decode cannot drift the scheduled start. (2) The three decode catches gain their surfacing calls (imageStore.importErrors for ImportedView, addAudioDecodeError for projectStore/documentSoundPeaks); TimelinePanel renders the signal with the ImportedView strip markup; audioStore.reset clears it. (3) exportEngine's pre-check computes ALL non-muted entries missing buffers and throws a named Error (routed through the existing catch → exportStore error status) before calling renderMixedAudio; audioExportMixer moves the buffer validation into a scan ABOVE `new OfflineAudioContext` that throws naming every missing clip and yields the resolved {track, buffer} list the scheduling loop iterates — the in-loop silent skip is gone.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (RED): four decode-readiness regression legs — playback refusal, in-flight await, mixer naming, export partial diagnostic</name>
  <files>app/src/lib/audioEngine.test.ts, app/src/lib/audioExportMixer.test.ts, app/src/lib/exportEngine.test.ts</files>
  <behavior>
    - Leg (a): with a stubbed AudioContext and NO buffer for id 't1', `await play(...)` and `await playDelayed(...)` each leave a message CONTAINING the track name in the audioDecodeErrors signal (duck-typed optional member — the export does not exist yet). RED today: play returns silently, nothing is recorded.
    - Leg (b): decode('t1', …) started with a controllable decodeAudioData promise, then play('t1', …) → source.start NOT called before resolution; after resolving the decode and awaiting the play promise, source.start called exactly ONCE with clamped offset 0. RED today: play returns immediately without ever starting.
    - Leg (b2): decode rejects while play awaits → the play promise RESOLVES and the named refusal is recorded (never-reject contract pinned). RED today: play never awaits, no refusal exists.
    - Leg (c): renderMixedAudio([good, missing]) REJECTS with a message containing the missing track's name, and the rejection happens BEFORE any OfflineAudioContext construction. RED today: rejects with `OfflineAudioContext is not defined` (node) — the message never names the clip — or, with a context present, renders past the missing buffer.
    - Leg (d): exportStore.includeAudio = true, hoisted audio tracks [A, B], getBuffer returns a buffer for A only → `await startExport()` ends `progress.status === 'error'` with errorMessage CONTAINING B's name, and renderMixedAudio (module mock) has ZERO calls. RED today: the zero-only warn path doesn't trigger, the mocked mixer runs, export completes.
    - Green-at-birth pins (honest, pre-fix): the existing typeof-method checks and all audioExportMixer source-scan tokens still pass; every pre-existing case in the three touched suites still passes.
  </behavior>
  <action>Test-only task — NO production code in this commit. Read .claude/skills/tdd/SKILL.md and .claude/skills/efx-preact-reactivity/SKILL.md first (store-level assertions only; no component rendering in this task).

(1) app/src/lib/audioEngine.test.ts — add a NEW top-level describe `261012-exn decode readiness (SND-01)` alongside the existing ones (do not modify any existing case). Build the Web Audio harness with vi.hoisted + vi.stubGlobal, mirroring documentSoundMultiClip.test.ts:29's hoisted idiom but as a REAL class installed on globalThis (audioEngine constructs `new AudioContext()` itself):
- hoisted handle object holding a per-test `decodeResolvers: Map<string, {resolve: (b: unknown) => void; reject: (e: unknown) => void}>` plus the created source spies.
- `class FakeAudioContext` with `state = 'running'`, `currentTime = 0`, `resume = vi.fn()`, `destination = {}`, `decodeAudioData = vi.fn()` returning a promise wired to the decodeResolvers entry for the current test (create a fresh deferred per call), `createBufferSource = vi.fn(() => ({buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null}))`, and `createGain = vi.fn(() => ({gain: {value: 1, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn(), setValueCurveAtTime: vi.fn()}, connect: vi.fn(), disconnect: vi.fn()}))` — the gain methods cover applyFadeSchedule's every branch. Install with `vi.stubGlobal('AudioContext', FakeAudioContext)` in beforeEach and `vi.unstubAllGlobals()` in afterEach; reset audioEngine state between tests via its public stopAll/removeTrack plus (for the signal) the duck-typed clear accessor below.
- Local `makeAudioTrack(id, name)` fixture: `{id, name, offsetFrame: 0, inFrame: 0, outFrame: 48, slipOffset: 0, muted: false, volume: 1, fadeInFrames: 0, fadeOutFrames: 0, fadeInCurve: 'linear', fadeOutCurve: 'linear'}` cast `as unknown as AudioTrack` (mirror playbackEngine.test.ts:57's shape; name it makeAudioTrack to avoid collisions with other suites' makeTrack).
- Access the not-yet-existing exports through ONE duck-typed loader used by every leg so each assertion fails under its own test name and typecheck stays green: `const engine = (await import('./audioEngine')) as unknown as {audioDecodeErrors?: {value: string[]}; addAudioDecodeError?: (m: string) => void; clearAudioDecodeErrors?: () => void};` then read `engine.audioDecodeErrors?.value ?? []`.
- Leg (a): stub context, no decode started; `await audioEngine.play('t1', 0, makeAudioTrack('t1', 'Beat Loop.wav'), 24)`; assert the signal array has an entry containing `Beat Loop.wav` (use expect(array.join('\n')).toContain('Beat Loop.wav') so a missing export and an empty array both fail clearly). Repeat the same assertion for `await audioEngine.playDelayed('t1', 0.5, 0, makeAudioTrack('t1', 'Delayed Clip.wav'), 24)` in its own test.
- Leg (b): call `audioEngine.decode('t1', new ArrayBuffer(8))` WITHOUT awaiting (this is what registers the pending promise after the fix); immediately capture `const playPromise = audioEngine.play('t1', 0, makeAudioTrack('t1', 'Race Track.wav'), 24)`; `await Promise.resolve()` a few times (or vi.waitFor negative check) and assert the source spy from the harness has NOT had start called; then resolve the decode deferred with `{duration: 10}` (cast); `await playPromise`; assert start called exactly once with `expect(spy.start).toHaveBeenCalledTimes(1)` and args `(0, 0, expect.any(Number))`.
- Leg (b2): same setup but reject the decode deferred with `new Error('decode boom')`; `await expect(playPromise).resolves.toBeUndefined()` (pin: the promise never rejects) and assert the signal array contains the track name.
- Existing-green pin: run the whole file — the pre-existing typeof/source-scan cases must pass untouched.

(2) app/src/lib/audioExportMixer.test.ts — add a NEW describe `261012-exn mixer buffer pre-scan (SND-02)` next to the source-scan describe (its readFileSync tests stay byte-untouched). Imports to add: `renderMixedAudio` from './audioExportMixer' and `audioEngine` from './audioEngine'. Spy, do not mock the module: `vi.spyOn(audioEngine, 'getBuffer').mockImplementation((id: string) => id === 'good-1' ? ({duration: 10} as AudioBuffer) : undefined)` in beforeEach, with `afterEach(() => vi.restoreAllMocks())`. Fixture `makeMixTrack(id, name)` minimal AudioTrack cast as above. The leg: `await expect(renderMixedAudio([makeMixTrack('good-1', 'Good.wav'), makeMixTrack('bad-1', 'Broken Vocals.wav')], 24, 1)).rejects.toThrow(/Broken Vocals\.wav/)` — a rejection that reaches the assertion at all only happens once the scan runs above the OfflineAudioContext line, and the message match is what today's ReferenceError fails. Also pin the muted exemption in the same describe: a MUTED missing-buffer track does not trigger the rejection (`await expect(renderMixedAudio([makeMixTrack('muted-1', 'Muted.wav').tap? no — build with muted: true)], …)).resolves` is NOT required (it would reach the context) — instead assert only that the muted-missing case rejects with a message NOT containing 'Muted.wav' is wrong too; KEEP IT SIMPLE: assert the muted track is exempt by checking the thrown message from [good, missingMuted] scenario does not throw at all is unreachable headless — SO: drop the muted leg from the mixer test and cover muted-exemption in exportEngine's existing muted behavior instead (mix entries with muted:true are excluded by the pre-check filter — covered by leg (d)'s sibling assertion below). Do not over-reach beyond what runs headless.

(3) app/src/lib/exportEngine.test.ts — extend the hoisted object with `audioTracks: [] as AudioTrack[]` and `audioBuffers: new Map<string, AudioBuffer>()`; change the two mock factories to read them: audioStore mock becomes `peek: () => hoisted.audioTracks` (defaults to `[]` — every existing test keeps its current behavior) and audioEngine mock becomes `getBuffer: (id: string) => hoisted.audioBuffers.get(id) ?? null` (defaults to none — same as today). Import `renderMixedAudio` from './audioExportMixer' (already mocked at :76) and `vi.mocked` it for the not-called assertion. New test in a NEW describe `261012-exn export buffer diagnostic (SND-02)`:
- Seed: `exportStore.includeAudio.value = true;` (beforeEach set it false — flip inside the test body, after beforeEach), `hoisted.audioTracks = [makeAudioTrack('aud-a', 'Music Bed.wav'), makeAudioTrack('aud-b', 'Voiceover.wav')]` (local helper named makeAudioTrack — the file's existing makeTrack builds PAINT tracks), `hoisted.audioBuffers.set('aud-a', {duration: 10} as AudioBuffer)` (B intentionally absent), `hoisted.fm = makeFm(4)`.
- `await startExport();` then `expect(exportStore.progress.peek().status).toBe('error')`, `expect(exportStore.progress.peek().errorMessage).toContain('Voiceover.wav')`, `expect(vi.mocked(renderMixedAudio)).not.toHaveBeenCalled()`.
- Sibling case (same describe): BOTH buffers absent → errorMessage still contains a track name (pins the zero case through the same named diagnostic instead of the old warn path).
- Sibling case for the muted exemption: both tracks present as MIX entries but track B `muted: true` with no buffer → export does NOT error on B's behalf (assert status is not the missing-audio error — reuse the existing complete-path assertion idiom :299).
- Run the full file: every pre-existing case (error-status idiom :281, complete path :299, paintEnumeration untouched) must stay green because their hoisted defaults are unchanged.

Sanity gates before committing: `pnpm --filter efx-motion-editor exec vitest run src/lib/audioEngine.test.ts src/lib/audioExportMixer.test.ts src/lib/exportEngine.test.ts` shows the four new legs FAILING with their own messages while every pre-existing test in those files passes; `pnpm --filter efx-motion-editor run typecheck` is clean (all not-yet-existing exports reached through duck-typed casts). Record which legs failed pre-fix in the commit body — that list is the RED evidence.

Commit as `test(261012-exn): RED — decode readiness regressions for SND-01/SND-02`.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/audioEngine.test.ts src/lib/audioExportMixer.test.ts src/lib/exportEngine.test.ts; exit code 1 is EXPECTED here (RED) — the four new legs must fail and every pre-existing case must pass; pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>RED evidence captured: all four mandated legs fail against current production with their own assertion/throw messages (refusal not recorded, source.start never fires, mixer rejection never names the clip, export never reaches the named error), every pre-existing case in the three files still passes, typecheck clean through duck-typed optional access, diff confined to the three test files, committed test-only as test(261012-exn).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (GREEN playback): engine pending-decode registry, never-reject async play/playDelayed, visible refusal signal, surfaced decode catches</name>
  <files>app/src/lib/audioEngine.ts, app/src/stores/audioStore.ts, app/src/stores/projectStore.ts, app/src/lib/documentSoundPeaks.ts, app/src/components/views/ImportedView.tsx, app/src/components/layout/TimelinePanel.tsx</files>
  <behavior>
    - Task 1's legs (a), (b), (b2) go green with ZERO assertion edits.
    - decode() registers its promise in pendingDecodes for the whole await window and removes it on settle (compare-before-delete so a newer decode for the same id is never evicted by an older one's finally).
    - Buffer-present play/playDelayed reach source.start synchronously within the call (fast path yields nowhere) — playbackEngine's seek-restart and scrub sequencing behavior is unchanged.
    - play/playDelayed reject-path: absent buffer + no pending → named refusal recorded, promise resolves; pending decode rejects → named refusal recorded, promise resolves. The returned promise NEVER rejects on any path.
    - Surfacing: reopen catch (projectStore) and documentSoundPeaks catch each append a message carrying the track name / sourcePath; ImportedView's catch appends to imageStore.importErrors (its existing strip renders it); TimelinePanel renders audioDecodeErrors with the ImportedView strip markup (bg-(--color-error-bg), text-(--color-error-text), truncate).
    - Idempotence + lifecycle: addAudioDecodeError does not duplicate an identical message; audioStore.reset() clears the list (project close wipes stale refusals).
    - Zero call-site churn: git diff shows NO change to playbackEngine.ts or efxPaintAudioMonitor.ts.
  </behavior>
  <action>Author order: run Task 1's three suites first and watch legs (a)/(b)/(b2) fail, then implement (1)–(6) until they turn green WITHOUT touching a single Task 1 assertion. Read .claude/skills/efx-async-orchestration/SKILL.md (stateful async on the play path: promise handled, never floating) and .claude/skills/efx-preact-reactivity/SKILL.md before the store/component edits (idempotent setters, narrow signal reads, no render-body writes).

(1) app/src/lib/audioEngine.ts —
a. Imports: add `import {signal} from '@preact/signals';`. NEVER import from '../stores/audioStore' (that module imports this one — the cycle would break both).
b. Module-level exports beside the class: `export const audioDecodeErrors = signal<string[]>([]);` plus `export function addAudioDecodeError(message: string): void` (idempotent: no-op when `audioDecodeErrors.value.includes(message)`, else assign a new array) and `export function clearAudioDecodeErrors(): void` (assign []). Doc-comment all three as the 261012-exn visible decode-diagnostic channel mirroring imageStore.importErrors' pattern (SND-01).
c. Class: add `private pendingDecodes = new Map<string, Promise<AudioBuffer>>();`. In decode() (:30-35), build the chained promise so the cache set happens inside it (`ctx.decodeAudioData(arrayBuffer).then(buf => { this.buffers.set(trackId, buf); return buf; })`), store it under trackId, `try { return await pending; } finally { if (this.pendingDecodes.get(trackId) === pending) this.pendingDecodes.delete(trackId); }`. The compare-before-delete is required: an older decode settling late must not evict a newer in-flight one.
d. New private helper `async resolveBufferForPlay(trackId: string, track: AudioTrack): Promise<AudioBuffer | null>` shared by BOTH methods (this is what makes the fix one contract instead of two): synchronous `this.buffers.get(trackId)` hit → return it (fast path, no await executed); miss → `const pending = this.pendingDecodes.get(trackId);` then `if (pending) { try { await pending; } catch { addAudioDecodeError(refusalMessage(track, 'decode failed')); return null; } }` then re-check `this.buffers.get(trackId)`; final miss (no pending, or pending settled without a buffer) → `addAudioDecodeError(refusalMessage(track, 'no decoded buffer')); return null`. Compose the message through one local `refusalMessage(track, reason)` returning `` `Audio "${track.name}" not played: ${reason}.` `` — the name must appear verbatim so legs (a)/(b2) match it.
e. play() (:46-100): change the signature to `async play(...): Promise<void>` and wrap the body in `try { … } catch (err) { addAudioDecodeError(refusalMessage(track, err instanceof Error ? err.message : String(err))); }` so NOTHING can reject. Replace the current early block (`const buffer = this.buffers.get(trackId); if (!buffer) return;`) with `const buffer = await this.resolveBufferForPlay(trackId, track); if (!buffer) return;` and keep everything from `this.stop(trackId)` onward byte-identical. Ordering matters for the fast path: because resolveBufferForPlay returns without awaiting on a hit, the whole happy path still runs synchronously to source.start inside the same tick.
f. playDelayed() (:106-150): same signature + whole-body try/catch + resolveBufferForPlay replacement. Capture `const anchorTime = ctx.currentTime;` immediately after ensureContext (BEFORE awaiting inside resolveBufferForPlay) and compute `const scheduledStart = anchorTime + delaySec;` from the anchor instead of post-await currentTime — otherwise a slow decode silently pushes the scheduled start later than the caller's intent. Keep the rest (:125-149) unchanged.
g. Update the class doc header to state the contract: both play methods await an in-flight decode, record a named refusal on failure through audioDecodeErrors, and never reject — fire-and-forget at the 9 call sites is therefore safe and the behavior is inherited identically by playbackEngine and the Studio monitor (SND-01).

(2) app/src/stores/audioStore.ts — in reset(), call `clearAudioDecodeErrors()` (import it from '../lib/audioEngine'; the store already imports audioEngine at :6 so no new cycle). Add a one-line comment naming 261012-exn: stale playback refusals must not survive a project close.

(3) app/src/stores/projectStore.ts — in the reopen catch (:791-793), keep the console.error and add `addAudioDecodeError(\`Failed to decode audio track "${track.name}": ${err instanceof Error ? err.message : String(err)}\`);` (import from '../lib/audioEngine' — the store already imports audioEngine at :18). Do NOT restructure the IIFE: registering the pending promise happens inside decode() itself, so the fire-and-forget shape stays as-is.

(4) app/src/lib/documentSoundPeaks.ts — same treatment in the catch (:51-52): keep console.error, add `addAudioDecodeError(\`Failed to decode document sound "${sound.sourcePath}": ${err instanceof Error ? err.message : String(err)}\`);` (it already imports audioEngine).

(5) app/src/components/views/ImportedView.tsx — in the audio decode catch (:370), keep console.error and append to the EXISTING import error channel: `imageStore.importErrors.value = [...imageStore.importErrors.value, \`Failed to decode audio: ${err instanceof Error ? err.message : String(err)}\`];` (imageStore is already imported at :5; this is the exact assignment idiom EditorShell.tsx:40 uses; the strip at :468-473 renders it — zero new UI).

(6) app/src/components/layout/TimelinePanel.tsx — import `audioDecodeErrors` from '../../lib/audioEngine' and insert, directly AFTER the Timeline Controls row (the `h-9` div ending before the timeline canvas container), a conditional strip mirroring ImportedView.tsx:468-473's markup: `{audioDecodeErrors.value.length > 0 && (<div class="px-4 py-1.5 bg-(--color-error-bg) shrink-0">{audioDecodeErrors.value.map((err, i) => <span key={i} class="text-[9px] text-(--color-error-text) block truncate">{err}</span>)}</div>)}`. Signal read in render body only; no useState; no writes in render.

Sanity gates: `git diff --stat` lists NO playbackEngine.ts and NO efxPaintAudioMonitor.ts (inheritance proof); `grep -n "useState" app/src/components/layout/TimelinePanel.tsx` returns nothing new.

Commit as `feat(261012-exn): audioEngine awaits in-flight decode and refuses visibly (SND-01)`.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/audioEngine.test.ts src/lib/audioEngine.test.ts src/lib/documentSoundPeaks.test.ts src/stores/projectStore.test.ts src/lib/playbackEngine.test.ts src/lib/documentSoundMultiClip.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Task 1 legs (a)/(b)/(b2) green with zero assertion edits; decode registers/removes the pending promise correctly (compare-before-delete); play/playDelayed never reject on any path and the buffer-present path stays synchronous; the three decode catches surface named messages; the ImportedView strip renders import-catch messages and the TimelinePanel strip renders audioDecodeErrors; audioStore.reset clears the signal; git diff proves playbackEngine.ts and efxPaintAudioMonitor.ts untouched; all listed pre-existing suites green; typecheck clean (noUnusedLocals — every import added is used); one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (GREEN export): named pre-check diagnostic through exportStore + fail-closed mixer buffer pre-scan</name>
  <files>app/src/lib/exportEngine.ts, app/src/lib/audioExportMixer.ts</files>
  <behavior>
    - Task 1's legs (c) and (d) go green with ZERO assertion edits.
    - exportEngine pre-check: computes the FULL set of non-muted mix entries lacking buffers (partial AND zero); any member → throw an Error naming every missing entry (quoted names, comma-separated), routed by the existing catch (:383-395) into `exportStore.progress` status 'error' with the names inside errorMessage; renderMixedAudio is never reached.
    - Muted exemption: a muted entry missing a buffer is never diagnostic-worthy (it would not be mixed anyway) — the filter keeps `!t.muted`.
    - audioExportMixer pre-scan: iterates non-muted entries BEFORE `new OfflineAudioContext`, throws an Error naming every missing clip, and yields the resolved {track, buffer} pairs the scheduling loop consumes — the in-loop silent skip is gone and the scheduling/fade/WAV code below is byte-unchanged.
    - All four exportEngine suites + audioExportMixer source-scan suite stay green (includeAudio defaults false everywhere else; the source-scan tokens are untouched).
  </behavior>
  <action>Run Task 1's export/mixer suites first and watch legs (c)/(d) fail, then implement (1)–(2) until green with ZERO Task 1 assertion edits.

(1) app/src/lib/exportEngine.ts — replace the pre-check block (:361-367, from `// Pre-check` through the console.warn) with the missing-set computation: `const missing = mixEntries.filter(t => !t.muted && !audioEngine.getBuffer(t.id));` then, when `missing.length > 0`, `throw new Error(\`missing decoded audio buffer for ${missing.map(t => `"${t.name}"`).join(', ')} — export stopped rather than silently dropping the clip (SND-02). Re-import the audio file or export with include audio off.\`);`. The throw sits inside the existing try, so the existing catch formats it into exportStore's error status and returns — no new UI, no new status, no change to the abort branch (:384-387). Delete the console.warn-only logic; update the comment above the block to name SND-01/SND-02 and 261012-exn (diagnostic must name every missing entry, partial or complete).

(2) app/src/lib/audioExportMixer.ts — restructure renderMixedAudio's opening (:93-102):
a. BEFORE the `new OfflineAudioContext` line, add the pre-scan loop over `tracks`: skip muted; `const buffer = audioEngine.getBuffer(track.id);` and on a miss `throw new Error(\`missing decoded audio buffer for "${track.name}" — mix aborted before rendering (SND-02). Export stopped; re-import the audio file.\`);`; on a hit push `{track, buffer}` into a local `resolved` array.
b. Construct the OfflineAudioContext from the existing sampleRate/totalSamples math (unchanged), then iterate `resolved` instead of raw `tracks`: the loop body keeps `source.buffer = buffer` sourced from the pair, drops the muted check and the buffer lookup (already decided in the scan), and everything from applyExportFadeSchedule through source.start stays byte-identical.
c. Update the function's doc comment: buffers are validated up front and a missing non-muted buffer aborts with a named Error before any Web Audio object is created — the clip can never be left out of a rendered mix (SND-02). The abort/timeout race below is untouched.

Sanity gates: `grep -n "if (!buffer) continue" app/src/lib/audioExportMixer.ts` returns no matches (the skip is replaced by the throwing scan); `grep -n "console.warn" app/src/lib/exportEngine.ts | grep -i "audio buffers"` returns no matches (the zero-only warn path is gone).

Commit as `feat(261012-exn): export pre-check and mixer validate buffers by name (SND-02)`.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/audioExportMixer.test.ts src/lib/exportEngine.test.ts src/lib/exportEngine.feedback.test.ts src/lib/exportEngine.loops.test.ts src/lib/exportEngine.paintEnumeration.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Task 1 legs (c)/(d) green with zero assertion edits; a partial or complete buffer outage aborts the export with an errorMessage naming every missing non-muted entry via the existing exportStore error status; the mixer throws naming a missing clip before constructing OfflineAudioContext and the in-loop skip is gone; muted entries never trigger diagnostics; all five export/mixer suites green; typecheck clean; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| on-disk audio bytes → AudioBuffer (decode) | untrusted/corrupt/missing media crosses here; failure must never be silent (SND-01) |
| playback state → user perception | a play() that returns without sound while claiming to play is a trust violation the refusal signal closes |
| mixEntries → rendered WAV (export) | a clip that reaches the export pipeline without a buffer must abort by name, never be omitted (SND-02) |
| fire-and-forget async → runtime | the reopen IIFE and the 9 sync call sites consume promises that must never reject unhandled |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory (T-261012-EXN-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261012-EXN-01 | Integrity | audioExportMixer loop / exportEngine pre-check — a clip silently absent from a delivered export | high | mitigate | Two independent doors: exportEngine's pre-check throws naming every missing non-muted entry (routed to exportStore error status, export aborted) and audioExportMixer's pre-scan throws naming the clip BEFORE any Web Audio object exists; Task 1 legs (c)/(d) pin both RED-first |
| T-261012-EXN-02 | Integrity | audioEngine play/playDelayed — playback claims to run while a clip is silently skipped (reopen race) | high | mitigate | pendingDecodes registry awaited inside play/playDelayed; on any failure a named refusal lands in audioDecodeErrors, rendered by the TimelinePanel strip; legs (a)/(b)/(b2) pin refusal, await-then-start, and reject-then-refuse |
| T-261012-EXN-03 | Denial of Service | async play/playDelayed — an unhandled rejection surfacing through the 9 fire-and-forget call sites could break the playback loop | medium | mitigate | Whole-body try/catch inside both methods: every failure path resolves and records; never-reject contract documented in the class header and pinned by leg (b2) (`resolves.toBeUndefined()`) |
| T-261012-EXN-04 | Integrity | audioDecodeErrors signal — repeated refusals on every play press grow the strip without bound / stale refusals survive project close | low | mitigate | Idempotent `addAudioDecodeError` dedupes identical messages; `audioStore.reset()` clears the list on project close (both asserted by Task 2's done criteria) |
| T-261012-EXN-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface (@preact/signals, vitest, lucide-preact all already in use), so no legitimacy checkpoint is required |

</threat_model>

<verification>
- Per-task automated gates (`vitest run` only, NEVER watch, per CLAUDE.md; `pnpm --filter efx-motion-editor run typecheck` after every task).
- Task 1 gate is EXPECTED red (the four mandated legs) while all pre-existing cases pass; Tasks 2 and 3 turn exactly those legs green without editing a single Task 1 assertion.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — no NEW failures versus the pre-quick baseline (pre-existing failures documented in STATE.md deferred items are out of scope: note them, do not fix them).
- Requirements trace: SND-01 = Task 1 legs (a)/(b)/(b2) + Task 2's engine contract, surfaced catches, and visible strips; SND-02 = Task 1 legs (c)/(d) + Task 3's named pre-check diagnostic and named mixer pre-scan.
- Guardrail audit via `git diff --stat`: playbackEngine.ts and efxPaintAudioMonitor.ts untouched (one shared engine fix, zero per-realm forks); vitest.config.ts, package.json, any capability/Rust file untouched; no useState introduced; no new dependency.
- Status stays automated-ready until the user judges the live UAT rows (no Chrome DevTools MCP):
  | # | Case | Pass condition |
  |---|------|----------------|
  | 1 | Reopen race | Open a project and press play IMMEDIATELY — audio starts when the decode lands, or a red strip in the timeline names the track that could not play; silence with no message fails the row |
  | 2 | Broken source | Import/reopen a project whose audio file is missing/corrupt — the named failure appears in the UI (import strip or timeline strip), not only in the console |
  | 3 | Export with one bad clip | Export with include-audio on while one clip is undecodable — the export stops with an error naming that clip; a video-with-missing-audio output fails the row |
  | 4 | Clean export + playback | A fully decoded project plays and exports exactly as before this quick (no new strips, no behavior drift) |
</verification>

<success_criteria>
- SND-01 and SND-02 pass every automated leg, and the user's native UAT passes all four rows (nothing claimed done before that — status = automated-ready)
- play/playDelayed await the in-flight reopen decode or record a named visible refusal; the fix is one engine-level seam inherited by both realms with zero call-site changes
- Both export surfaces name the missing clip(s): pre-check via exportStore error status, mixer via a pre-construction throw
- Decode failures from all three listed catches reach a rendered strip, never console-only
- Guardrails held: no new packages, no config changes, no useState, playbackEngine/monitor byte-untouched, zero Task-1 assertion edits, all pre-existing suites green
</success_criteria>

<output>
Create .planning/quick/261012-exn-document-sound-decode-readiness-v1-0-1-q/261012-exn-SUMMARY.md when done (commit style: `test(261012-exn): …` / `feat(261012-exn): …`)
</output>
