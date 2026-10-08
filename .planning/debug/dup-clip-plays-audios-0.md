---
status: awaiting_human_verify
trigger: "Duplicated Document sound clips only play audios[0] — with play loop the first clip plays once then goes silent. Studio draws N clips via the document carrier but the documentAudio transport channel is still the closed 3-member singleton {revision, clipId, assetUrl} fed from `getEfxPaintDocument(layerId)?.audios[0]` at app/src/lib/physicPaintBridge.ts:3911. The clip leg in app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts is single-slot (one getSection(), one resolveDocumentSoundClip, one audioEngine.play(sound.id)), and applyRevisionedDocumentAudio re-plays the same already-run-to-end sound.id on loop restart so the second schedule is dropped. Need the transport to carry every placed clip (per-clip id key, never sourceId) and the loop-restart re-arm fixed. This is the D-01 deferral from quick 261008-ig1, not a regression."
created: 2026-10-08
updated: 2026-10-08
---

# Debug: dup-clip-plays-audios-0

## Symptoms

- **expected:** Duplicating a Document sound clip (alt+drag) produces two independently audible placed clips — each plays at its own timeline position with its own per-clip gain/fades. Play-loop restarts both.
- **actual:** Only the first clip (`audios[0]`) is audible. With play loop, the first clip plays once then no further audio is audible.
- **errors:** None. Silent drop — no thrown error, no console failure surfaced.
- **timeline:** 2026-10-08, first live UAT of quick 261008-ig1 (multi-audio core slice). Never worked for more than one clip. This is the D-01 `documentAudio` singleton deferral from that quick, NOT a regression.
- **repro:** Import an audio → place it in the timeline → confirm it plays on play and scrub → alt+drag to duplicate → press play. Only the first clip is audible. Enable play loop → the first clip plays once, then silence.

## Current Focus

- hypothesis: >-
    CONFIRMED. The `documentAudio` transport channel is the closed 3-member
    singleton {revision, clipId, assetUrl} fed from `audios[0]`
    (app/src/lib/physicPaintBridge.ts:3911). Studio draws N clips via the
    `document` carrier, so the UI looks correct while transport carries exactly
    one clip. The clip leg in
    app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts is
    single-slot: one `efxPaintDocumentAudioStore.getSection()`, one
    `resolveDocumentSoundClip`, one `audioEngine.play(sound.id, ...)`.
    `preparedTrackIds` holds a single id. Symptom 2 is downstream: on loop
    restart the single re-armed `sound.id` schedule is dropped (the clip leg
    re-enters playAtCursor with the same already-run-to-end key and the second
    source never becomes audible), so loop goes silent.
- next_action: "Green phase complete: RED gate confirmed by user, fix applied, all 4 target tests green, full suite/tsc/cargo gates green. AWAITING LIVE UAT (user oracle): import audio, place clip, alt+drag duplicate, play — both clips audible at their own positions; enable play loop — both repeat. Watch for the secondary blind spot (audioEngine onended same-id race) if loop still drops after first pass."
- test: Place two clips from one imported source (alt+drag duplicate). Press play — expect both audible at their own positions. Enable play loop — expect both to repeat. Currently: only clip[0] audible; loop plays once then silence.
- expecting: both placed clips audible, keyed by their own `DocumentSoundClip.id`; loop restart re-arms both.

tdd_checkpoint:
  test_file: "app/src/lib/documentSoundMultiClip.test.ts"
  test_name: "documentAudio transport carries every placed clip / Studio clip leg dispatches every prepared clip"
  status: "green"
  failure_output: |
    (RED, confirmed by user) 4 failed (4)
    × buildPhysicPaintDocumentAudioSection names BOTH clips ...
    × isPhysicPaintDocumentAudioSection accepts the multi-clip shape ...
    × playAtCursor dispatches BOTH placed clips ...
    × notifyLoopWrap re-arms BOTH clips ...
  green_output: |
    4 passed (4) — documentSoundMultiClip.test.ts, plus documentSoundGates.test.ts
    (23) and physicsPaintLaunchContext.test.ts (10) updated to the new shape.

reasoning_checkpoint:
  hypothesis: "The documentAudio transport is a closed 3-member singleton fed from audios[0]; the Studio clip leg is single-slot, so only one placed clip ever reaches the engine — and the loop restart re-arms that one already-run-to-end sound.id and drops the second schedule."
  confirming_evidence:
    - "physicPaintBridge.ts:3911 `const sound = getEfxPaintDocument(layerId)?.audios[0] ?? null` with the explicit SCOPE BOUNDARY comment naming this exact deferral (261008-ig1 D-01)"
    - "PhysicPaintDocumentAudioSection is literally `{revision, clipId, assetUrl}` — isPhysicPaintDocumentAudioSection uses hasOnlyKeys(['revision','clipId','assetUrl'])"
    - "efxPaintAudioMonitor.playAtCursor dispatches exactly one clip (one getSection(), one resolveDocumentSoundClip, one audioEngine.play(sound.id))"
    - "efxPaintDocumentAudioStore.accept stores a single section object, not a list"
    - "Studio strip already draws N clips (documentAudios prop → SoundClipBand children) — UI is multi-clip, transport is not"
  falsification_test: "If buildPhysicPaintDocumentAudioSection returned one entry per audios[] member and playAtCursor dispatched each, the second duplicate would be audible — it is not, which falsifies 'the engine/decode path is fine and only the UI is wrong'."
  fix_rationale: "Reshape the documentAudio channel to carry every placed clip (per-clip id key, never sourceId) and make the clip leg loop over the list — this removes the singleton bottleneck at its source rather than papering over the missing second play call."
  blind_spots: "The loop-restart drop may also involve audioEngine's onended deleting by trackId (race with a same-id re-play); that is a secondary suspect tested separately. Live UAT still required after the reshape."
  candidate_causes:
    - "code: transport builder hard-codes audios[0] (confirmed)"
    - "code: clip leg is single-slot (confirmed)"
    - "environment: none — deterministic, reproducible on first UAT"
    - "data: DocumentSoundClip.id is unique per placed clip (buildDuplicatedSoundClip mints crypto.randomUUID) so the model is fine"
  and_gate: "no — the singleton transport alone is sufficient to produce symptom 1; symptom 2 is the same single-slot path failing to re-arm on loop. No second independent condition required."

## Evidence

- timestamp: 2026-10-08
  checked: physicPaintBridge.ts buildPhysicPaintDocumentAudioSection (~3911) and its SCOPE BOUNDARY comment
  found: Returns a single {revision, clipId, assetUrl} from audios[0] only; comment names "channel reshaping for the full list is the follow-up quick's job"
  implication: Root cause of symptom 1 is an intentional D-01 deferral, not a regression

- timestamp: 2026-10-08
  checked: types/physicPaint.ts PhysicPaintDocumentAudioSection + isPhysicPaintDocumentAudioSection; physicsPaintLaunchContext.ts DOCUMENT_AUDIO_KEYS
  found: Closed 3-member shape pinned by hasOnlyKeys(['revision','clipId','assetUrl']) at three validation sites
  implication: Reshape must move all three validators together (type, launch-context parse, store accept)

- timestamp: 2026-10-08
  checked: efxPaintAudioMonitor.ts playAtCursor / prepare / applyRevisionedDocumentAudio
  found: Clip leg is single-slot — one section, one resolveDocumentSoundClip, one audioEngine.play(sound.id); preparedTrackIds is a Set but only ever filled with one clip id
  implication: Even if transport carried N clips, the monitor would only dispatch one until the leg loops

- timestamp: 2026-10-08
  checked: physicsPaintAudioController.ts buildDuplicatedSoundClip + efxPaintDocument.ts DocumentSoundClip docs
  found: alt+drag mints a fresh `id` (crypto.randomUUID) and shares `sourceId` — the two-identity law is correct in the model
  implication: Duplicate clip ids differ; the engine key space is fine. The bug is purely the transport/leg single-slot.

- timestamp: 2026-10-08
  checked: PhysicsPaintWorkflowStrip documentAudios prop + SoundClipBand children; documentSoundGates.collectDocumentSoundClips
  found: Studio strip and main-window collection already iterate the full audios[] list
  implication: Drawing path is multi-clip (explains "Studio draws N clips"); playback path is not

- timestamp: 2026-10-08
  checked: 261008-ig1 PLAN.md scope boundary + D-01 OUT list
  found: "documentAudio channel reshaping, preparedTrackIds, export-mixer/playback-mix retargeting" are explicitly the follow-up quick
  implication: This debug session IS that follow-up; export mixer already multi-clip (buildExportMixEntries) — only Studio transport/leg is missing

## Eliminated

- hypothesis: Duplicate clips share an engine key (sourceId collision)
  evidence: buildDuplicatedSoundClip mints crypto.randomUUID() for `id`; audioEngine.play keys on sound.id
  timestamp: 2026-10-08

- hypothesis: UI-only bug (clips drawn but never registered in the document)
  evidence: collectDocumentSoundClips and the Studio strip both read document.audios[] successfully; the document model is multi-clip end-to-end
  timestamp: 2026-10-08

## Resolution

- root_cause: (confirmed) documentAudio transport is a closed 3-member singleton fed from audios[0]; the Studio clip leg in efxPaintAudioMonitor is single-slot; loop restart re-arms the same already-run-to-end sound.id and the second schedule is dropped
- fix: >-
    Reshaped the documentAudio channel to {revision, clips[{clipId, assetUrl}]}
    carrying every placed clip keyed by its own DocumentSoundClip.id (never
    sourceId), moved all three validators together (type+guard in
    types/physicPaint.ts, DOCUMENT_AUDIO_KEYS launch parse, store.accept), and
    looped the Studio clip leg (prepare/prepareClip/playAtCursor/scrubAt/
    applyRevisionedDocumentAudio) over the list with preparedTrackIds keyed per
    placed id — applyRevisionedDocumentAudio now retires removed clips and
    re-arms every listed clip on revisioned pushes/loop restarts. Rust
    PhysicsPaintLaunchContext.documentAudio grew from opaque Value to a typed
    {revision, clips[]} section so a dropped member fails the round-trip.
- verification: >-
    Automated gates green: the 4 RED tests now pass; full vitest suite 4581
    passed (only pre-existing PhysicsPaintStudioView.test.ts collection failure,
    verified identical on clean HEAD via stash); tsc --noEmit clean; cargo test
    physics_paint_launch_context 5/5 passed (incl. new
    round_trips_the_document_audio_clips_list pin). LIVE UAT PENDING (user
    oracle) — do not claim done until both duplicated clips are audible with
    play loop repeating them.
- files_changed:
  - app/src/types/physicPaint.ts (PhysicPaintDocumentAudioClipRef + reshaped section type/validator)
  - app/src/lib/physicPaintBridge.ts (builder carries every audios[] member; push comment key sets)
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.ts (DOCUMENT_AUDIO_KEYS + reconstruction)
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts (section fixture reshaped)
  - app/src/components/physic-paint/audio/efxPaintDocumentAudioStore.ts (accept stores clips[])
  - app/src/components/physic-paint/audio/efxPaintAudioMonitor.ts (clip leg loops; 'clips' transport routing; revisioned re-arm)
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx (peaks sectionUrl per-clip lookup)
  - app/src/lib/documentSoundGates.test.ts (store funnel + CLIP_SECTION reshaped)
  - app/src/lib/documentSoundMultiClip.test.ts (new TDD red→green contract tests)
  - app/src-tauri/src/lib.rs (typed documentAudio section + clips-list round-trip pin)
