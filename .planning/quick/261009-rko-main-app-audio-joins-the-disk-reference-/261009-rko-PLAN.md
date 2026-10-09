---
phase: quick-261009-rko
plan: 261009-rko
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/types/audio.ts
  - app/src/types/project.ts
  - app/src/lib/mceAudioSourcePath.ts
  - app/src/lib/mceAudioSourcePath.test.ts
  - app/src/lib/mainAppAudioSources.ts
  - app/src/lib/mainAppAudioSources.test.ts
  - app/src/stores/imageStore.ts
  - app/src/stores/projectStore.ts
  - app/src/stores/projectStore.test.ts
  - app/src/lib/documentSoundGates.ts
  - app/src/lib/documentSoundGates.test.ts
  - app/src/stores/audioStore.test.ts
  - app/src/lib/playbackEngine.test.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/components/views/ImportedView.tsx
  - app/src/components/sidebar/AudioProperties.tsx
autonomous: true
requirements: [QUICK-261009-RKO]

estimate:
  tokens: 56000
  raw_tokens: 28000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Main-app audio is a DISK REFERENCE: gallery import and sidebar Replace record the picker's absolute path verbatim as the asset/track path, write nothing into the package, and leave the picked file untouched at its origin (no audio/ tree, zero audio bytes in the package)."
    - "The .mce members `audio_tracks[].source_path` and `audio_assets[].source_path` carry the absolute on-disk path verbatim through save/reopen; a manifest member still carrying the retired `relative_path` key THROWS at the load door — clean break, no shim, no migration."
    - "Reopen resolves `filePath` and the gallery asset `path` from `source_path` verbatim (no projectRoot join); playback and waveform peaks still decode because bytes are read through the efxasset channel (`fetch(assetUrl(path))`), which is the only door that can reach a user path outside the fs plugin scope."
    - "The Studio shared picker (`requestImageImport` kind 'audio') keeps producing absolute-path `sourcePath` assets, and after this quick both the gallery import and the Studio picker register identical absolute-path `imageStore.audioAssets` records."
  artifacts:
    - app/src/lib/mceAudioSourcePath.ts
    - app/src/lib/mainAppAudioSources.ts
    - app/src/types/audio.ts
    - app/src/types/project.ts
    - app/src/stores/imageStore.ts
    - app/src/stores/projectStore.ts
  key_links:
    - "The `source_path` key must move in BOTH load doors together: `imageStore.loadFromMceAudioAssets` (gallery `audio_assets`) and the `hydrateFromMce` audio_tracks loop (`projectStore.ts`) — a retired key accepted by either one reopens a half-migrated manifest"
    - "plugin-fs scope (app/src-tauri/capabilities/default.json) only allows `**/audio/**` and siblings, so a user path like /Users/…/Music/take.wav is unreachable via `readFile`; the three decode sites (projectStore reopen loop, ImportedView handleSelectAudio, AudioProperties handleReplace) must all go through `fetch(assetUrl(path))` or reopen playback dies on every disk-referenced file"
    - "The two copy sites are independent and BOTH must go: `ImportedView.tsx` handleImport audio branch (mkdir+copyFile into dir/audio) and `AudioProperties.tsx` handleReplace (mkdir+copyFile into projectDir/audio) — leaving either one keeps the package-content gate false"
    - "`AudioTrack.relativePath` is retired with the format field (its only consumer was `buildMceProject` serialization); the single runtime path field is `filePath`. `documentSoundGates.toDocumentSoundAudioTrack` drops its `relativePath` line as a type co-change — Studio document-sound semantics themselves stay untouched"
    - "`imageStore.updateProjectPaths` must stop rewriting audio asset paths on temp→real migration: a disk reference outside the project is verbatim, and a root-prefix rewrite would corrupt it"
---

<objective>
Make main-app audio join the disk-reference law that 261009-ofk established for Studio document sounds: kill the two remaining copy sites (gallery import, sidebar Replace), change the .mce `audio_tracks` / `audio_assets` path key from `relative_path` to `source_path` (absolute on-disk path, clean break), and resolve/decode that path verbatim through the efxasset channel.

Purpose: this app is not a video NLE — heavy media never enter the package. The package holds structure, timing, metadata, and light derived artifacts only. A main-app audio file is a REFERENCE to where it lives on disk; accepted loss is that losing the original file loses the media, with no recovery/copy fallback.
Output: a clean-break manifest carrying `source_path`, two never-copy import doors, verbatim reopen resolution, and unit gates covering the manifest round-trip, the never-copy contract, the verbatim decode path, and the Studio picker non-regression.
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

ARCHITECTURAL LAW (locked, generalized from 261009-ofk): heavy media NEVER enter the .mce package. A main-app audio file is a REFERENCE to its on-disk location. ACCEPTED LOSS: losing the original file loses the media — no recovery/copy fallback, no sidecar media folder, no collect-and-export.

SCOPE IN — main-app audio system only:
- Kill both verified copy sites (do not re-audit from scratch).
- FORMAT CHANGE, CLEAN BREAK: `MceAudioTrack.relative_path` -> `source_path` (absolute on-disk path); gallery manifest `audio_assets` `MceAudioAssetRef.relative_path` -> `source_path` likewise. A member still carrying `relative_path` THROWS (same law as `DocumentSoundClip.relativePath` in 261009-ofk).
- Reopen resolves `filePath` / gallery `path` from `source_path` VERBATIM (no projectRoot join).
- Every consumer of `track.filePath` / `asset.path` keeps working with absolute paths outside the project.

SCOPE OUT (do not touch):
- No missing-row/Relink UI on the main-app side; a moved file shows existing error behavior only. Studio list Relink from 261009-ofk stays as-is.
- Studio document sounds (`DocumentSoundClip` / `document.audios[]`) — done in 261009-ofk.
- Video import (`videos/` copy) — non-goal.
- No migration of existing projects, no sidecar media folder, no collect-and-export.
- No new user-facing strings; keep every existing string verbatim.

NON-NEGOTIABLE CONSTRAINTS:
- Clean break — no migration code, no legacy shim, no accepted-alternate key.
- Ride existing machinery: same `open()` dialogs, same import flow, same audioStore/imageStore mutation doors. No new file-dialog route.
- Preact + @preact/signals only (efx-preact-reactivity skill: no useState additions, thin render shells, no render-body signal writes). Existing useState in these two components may stay as-is — this quick does not add hook state.
- `vitest run` only (never watch). No dev server. pnpm monorepo, app/ directory. Full suite has 1 pre-existing failure (`PhysicsPaintStudioView.test.ts` paintStore↔projectStore circular dep) — not a gate.

LANDMARKS (verified live 2026-10-09):
- app/src/components/views/ImportedView.tsx — handleImport audio branch :380-400 (`audioDir` :392, `mkdir` :393, `copyFile` :395, `addAudioAsset` with `destPath` :397-400); handleSelectAudio :322-375 (`readFile(asset.path)` :328, `relativePath: 'audio/' + asset.name` :341, `filePath: asset.path` :340).
- app/src/components/sidebar/AudioProperties.tsx — handleReplace :30-79 (`mkdir` :46, `copyFile` :49, `readFile(projectDir + '/audio/' + …)` :52, updateTrack patch :64-73 with `filePath`/`relativePath` :65-66). Strings `Replace...` (:115) and every other label stay verbatim.
- app/src/types/audio.ts — `AudioTrack.relativePath` :8, `MceAudioTrack.relative_path` :37 (comment :32).
- app/src/types/project.ts — `MceAudioAssetRef` :213-217 (`relative_path` :216, comment :212).
- app/src/stores/imageStore.ts — `AudioAsset` comment :20 (`path` "absolute path in project audio/ directory"), `loadFromMceAudioAssets` :205-214 (root join :211), `toMceAudioAssets` :217-224 (root strip :222), `updateProjectPaths` audio remap :256-259.
- app/src/stores/projectStore.ts — buildMceProject audio_tracks :439-465 (`relative_path: track.relativePath` :443, `audio_assets: imageStore.toMceAudioAssets(projectRoot)` :438); hydrateFromMce `loadFromMceAudioAssets` :499, audio loop :666-710 (`filePath: projectRoot + '/' + mat.relative_path` :677, `relativePath: mat.relative_path` :678, addAudioAsset :705-709); reopen re-decode loop :776-788 (`readFile(track.filePath)` :780). The 261009-ofk Studio document-sound re-registration block :731-757 stays byte-untouched.
- app/src/lib/documentSoundGates.ts — `toDocumentSoundAudioTrack` :87-121 (`relativePath: sound.sourcePath` :98). `buildExportMixEntries` :239-257 mixes from `audioEngine.getBuffer(track.id)`, not from paths.
- app/src-tauri/capabilities/default.json — fs scope :29-44 allows `**/audio/**` and siblings only; arbitrary user paths are reachable exclusively via the `efxasset` protocol (`assetUrl` in app/src/lib/ipc.ts :33-39, boundary `resolve_efxasset_path` / `efxasset_allowed_roots` in app/src-tauri/src/lib.rs :509-532).
- Existing test fixtures carrying `relativePath` on an AudioTrack/MceAudioTrack: app/src/stores/projectStore.test.ts (makeTrack :65-95, snake_case map assert :112-136, hydrate assert :206-245), app/src/stores/audioStore.test.ts :11, app/src/lib/playbackEngine.test.ts :63, app/src/lib/physicPaintBridge.test.ts `makeAudioTrack` (:317-323, `relativePath` :323 — frame-media `relativePath` at :472/:1277 is a different type and stays). Vitest collects only `src/**/*.test.ts`; tsconfig `include: ["src"]` + `noUnusedLocals: true` means every one of these files is typechecked.
- Predecessor pattern reference: `.planning/quick/261009-ofk-audio-stays-a-disk-reference-never-copie/261009-ofk-PLAN.md` (same law, Studio side — its Task 1 shape is the template for the clean-break + never-copy + fixture sweep).

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: source_path format law — clean-break keys, verbatim reopen, efxasset decode</name>
  <files>app/src/types/audio.ts, app/src/types/project.ts, app/src/lib/mceAudioSourcePath.ts, app/src/lib/mceAudioSourcePath.test.ts, app/src/lib/mainAppAudioSources.ts, app/src/lib/mainAppAudioSources.test.ts, app/src/stores/imageStore.ts, app/src/stores/projectStore.ts, app/src/stores/projectStore.test.ts, app/src/lib/documentSoundGates.ts, app/src/lib/documentSoundGates.test.ts, app/src/stores/audioStore.test.ts, app/src/lib/playbackEngine.test.ts, app/src/lib/physicPaintBridge.test.ts</files>
  <behavior>
    - Manifest round-trip: `buildMceProject` emits `audio_tracks[i].source_path` equal to the runtime `track.filePath` verbatim and `audio_assets[i].source_path` equal to `asset.path` verbatim; the serialized JSON for these members contains the `source_path` key and no `relative_path` key.
    - Retired key: `readMceAudioSourcePath` throws for a member record carrying `relative_path`, and throws for a member whose `source_path` is missing, empty, or not a string (fail-closed, no shim, no accepted alternate).
    - Verbatim reopen: `hydrateFromMce` builds `track.filePath` and `loadFromMceAudioAssets` builds `asset.path` exactly equal to the persisted `source_path` — `/Users/test/Music/take.wav` round-trips byte-identical, no projectRoot concatenation and no root-prefix strip.
    - Decode door: `readAudioSourceBytes(sourcePath)` is the single main-app audio byte-read helper — `fetch(assetUrl(sourcePath))`, throw on `!response.ok`, return `response.arrayBuffer()` — and the reopen re-decode loop calls that helper with `track.filePath`; plugin-fs `readFile` is not invoked for main-app audio tracks.
  </behavior>
  <action>ONE atomic format law: the persisted path key for main-app audio becomes `source_path` (absolute on-disk path, carried verbatim), the runtime collapses to a single path field `filePath`, and the three decode reads move to the efxasset channel. Read .claude/skills/efx-preact-reactivity/SKILL.md first.

(1) TYPES (clean break). app/src/types/audio.ts: rename `MceAudioTrack.relative_path` to `source_path` and rewrite the field comment to "Absolute path to the audio file on disk (heavy media stay disk references — never copied into the package)". Retire `AudioTrack.relativePath` (comment :8) — its only consumer was serialization, and the law now keeps one runtime path field, `filePath` (absolute, verbatim). Update the `filePath` comment to say it is the disk reference persisted as `source_path`. app/src/types/project.ts: rename `MceAudioAssetRef.relative_path` to `source_path` and update the :212 comment ("Absolute path to the audio file on disk (disk reference)").

(2) LOAD-DOOR PARSER. New app/src/lib/mceAudioSourcePath.ts exporting `readMceAudioSourcePath(record: unknown, label: string): string`. Behavior: non-record throws; the presence of a `relative_path` member throws (message names the retired key and the label — same fail-closed shape as 261009-ofk's parseDocumentSound unknown-members error); `source_path` must be a non-empty string or it throws; return `source_path` verbatim. Dependency-free except a tiny isPlainRecord. New app/src/lib/mceAudioSourcePath.test.ts covers the behavior block. This is the ONLY place the retired-key throw lives — both load doors call it.

(3) WRITERS. app/src/stores/imageStore.ts `toMceAudioAssets` (:217-224): drop the `projectRoot` parameter and the root-strip logic; return `{id, name, source_path: asset.path}` per asset (path verbatim). Update the `AudioAsset.path` comment (:20) to "absolute path to the audio file on disk (disk reference)". In `updateProjectPaths` (:256-259) drop the audioAssets remap — a disk reference outside the project is verbatim and a root-prefix rewrite would corrupt it; images/videoAssets remap stays. app/src/stores/projectStore.ts buildMceProject (:443): `source_path: track.filePath`. Call site :438 becomes `imageStore.toMceAudioAssets()`.

(4) READERS (verbatim resolution). app/src/stores/imageStore.ts `loadFromMceAudioAssets` (:205-214): drop the `projectRoot` parameter; accept `readonly unknown[]`, run each member through `readMceAudioSourcePath(ref, 'audio_assets[]')`, and set `path: <returned source_path>` — no join, no strip. Call site projectStore.ts :499 drops the root argument. app/src/stores/projectStore.ts hydrateFromMce audio loop (:666-710): per raw member call `readMceAudioSourcePath(mat, 'audio_tracks[]')` and build `filePath: <returned source_path>` (verbatim); do not emit a `relativePath` field on the AudioTrack; keep `imageStore.addAudioAsset({id: track.id, name: track.originalFilename, path: track.filePath})` (:705-709). The 261009-ofk Studio document-sound re-registration block (:731-757) stays as-is.

(5) DECODE DOOR (the reopen loop). Create `readAudioSourceBytes(sourcePath: string): Promise<ArrayBuffer>` in app/src/lib/mainAppAudioSources.ts — THIS is the introducing task (Task 2 reuses it and never redefines it): `fetch(assetUrl(sourcePath))` (import `assetUrl` from ./ipc — plugin-fs scope cannot reach an arbitrary user path; the efxasset boundary is the sanctioned read channel), throw on `!response.ok`, return `response.arrayBuffer()`. app/src/stores/projectStore.ts :776-788: replace `readFile(track.filePath)` with `await readAudioSourceBytes(track.filePath)`. Keep the surrounding try/catch, the decode call, and the peaks cache write identical. Drop the now-unused `readFile` import from `@tauri-apps/plugin-fs` in projectStore.ts (`noUnusedLocals` — it is the sole user of that import).

(6) TYPE CO-CHANGE + FIXTURES (mechanical). app/src/lib/documentSoundGates.ts `toDocumentSoundAudioTrack` (:87-121): drop the `relativePath` line (:98) — this is a co-change to the shared AudioTrack type, not a change to Studio document-sound semantics. Sweep every runtime AudioTrack constructor that still sets `relativePath` and switch its path field to the absolute form (`/Users/test/Music/<name>` style): app/src/stores/projectStore.test.ts (makeTrack, the snake_case map assert expecting `source_path` === `track.filePath`, the hydrate assert expecting `filePath` === the persisted source_path with no join), app/src/stores/audioStore.test.ts, app/src/lib/playbackEngine.test.ts, app/src/lib/documentSoundGates.test.ts, and app/src/lib/physicPaintBridge.test.ts `makeAudioTrack` (:317-323 — drop only the AudioTrack `relativePath` line :323). Extend projectStore.test.ts with the round-trip test, the verbatim-reopen test, one test that `loadFromMceAudioAssets` throws on a `relative_path` member, and one named reopen-loop decode test asserting the loop calls `readAudioSourceBytes(track.filePath)` (hence `fetch(assetUrl(...))`) and never calls plugin-fs `readFile` (DONE-GATE 3). New app/src/lib/mainAppAudioSources.test.ts covers `readAudioSourceBytes` per the behavior block (fetch spy + `vi.mock('@tauri-apps/plugin-fs')`). Do NOT touch main-app video/image fixtures, image `relative_path` fields, frame-media `relativePath` (physicPaintBridge.test.ts :472/:1277 stay byte-untouched), or any Studio PhysicPaint layer/media fixture beyond that one makeAudioTrack line.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/mceAudioSourcePath.test.ts src/lib/mainAppAudioSources.test.ts src/stores/projectStore.test.ts src/lib/documentSoundGates.test.ts src/stores/audioStore.test.ts src/lib/playbackEngine.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>buildMceProject emits source_path (= track.filePath / asset.path) for audio_tracks and audio_assets and the JSON carries no relative_path key for those members; readMceAudioSourcePath throws on a member carrying relative_path and on a missing/empty source_path; hydrateFromMce and loadFromMceAudioAssets resolve filePath/asset.path verbatim from source_path with no projectRoot join or root strip; readAudioSourceBytes is the single main-app audio read door and the named reopen-loop test pins it to fetch(assetUrl(...)) with no plugin-fs readFile; AudioTrack.relativePath is retired and every AudioTrack fixture (including physicPaintBridge makeAudioTrack) co-changes cleanly; typecheck clean; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: never-copy gallery import and sidebar Replace — picker path recorded verbatim</name>
  <files>app/src/lib/mainAppAudioSources.ts, app/src/lib/mainAppAudioSources.test.ts, app/src/components/views/ImportedView.tsx, app/src/components/sidebar/AudioProperties.tsx</files>
  <behavior>
    - registerPickedAudioSource('/Users/test/Music/take.wav') creates an imageStore.audioAsset whose path is that string byte-identical and whose name is the basename; a second call with the same path registers nothing new; plugin-fs `mkdir` and `copyFile` are never invoked.
    - buildAudioReplacePatch('/Users/test/Music/other.flac', decoded, fps) returns a track patch whose filePath is the input path verbatim and whose originalFilename is its basename; it contains no path rewriting.
    - readAudioSourceBytes (Task 1's helper, reused unchanged) still resolves '/Users/test/Music/take.wav' through `fetch(assetUrl(...))` and never calls plugin-fs readFile; the component call sites use that helper rather than a second inline read.
    - Studio picker non-regression: `requestImageImport([path], 'audio')` still returns a ref whose `sourcePath` equals the input absolute path (the existing physicPaintBridge gate stays green).
  </behavior>
  <action>Kill the two verified copy sites and route both through one never-copy door. Read .claude/skills/efx-preact-reactivity/SKILL.md first. Thin handler edits only — no new hook state, no render-body writes.

(1) SHARED DOOR — extend app/src/lib/mainAppAudioSources.ts (Task 1 created it with `readAudioSourceBytes`; reuse that helper as-is, do not redefine it) with two functions (the only new surface; they exist so the never-copy contract is unit-testable without mounting components):
- `registerPickedAudioSource(filePath: string): AudioAsset` — name = basename (backslash-normalized), dedupe against `imageStore.audioAssets` by `path === filePath`, and on absence call `imageStore.addAudioAsset({id: crypto.randomUUID(), name, path: filePath})`. Pure registration: no filesystem call of any kind.
- `buildAudioReplacePatch(filePath: string, decoded: {sampleRate: number; duration: number; numberOfChannels: number}, fps: number): Partial<AudioTrack>` — returns `{filePath, originalFilename: basename(filePath), sampleRate, duration, channelCount, inFrame: 0, outFrame: Math.ceil(decoded.duration * fps)}`.
Extend app/src/lib/mainAppAudioSources.test.ts (Task 1 seeded `readAudioSourceBytes`) with `vi.mock('@tauri-apps/plugin-fs')` and a fetch spy: assert mkdir/copyFile are never called by registration, the patch carries the path verbatim, and the existing readAudioSourceBytes test stays green (behavior block).

(2) GALLERY IMPORT — app/src/components/views/ImportedView.tsx handleImport audio branch (:380-400): delete the `audioDir` / `mkdir` / `copyFile` / `destPath` block and the `dir`/`tempProjectDir` requirement for this branch (a disk reference needs no project directory). After the `open()` dialog resolves, call `registerPickedAudioSource(filePath)` — that is the whole registration. Keep the video branch and the image branch byte-untouched. In handleSelectAudio (:322-375): replace `readFile(asset.path)` with `readAudioSourceBytes(asset.path)`, drop the `relativePath` line (:341) from the addTrack payload (the field is retired), keep `filePath: asset.path` (:340) and every other track field as-is. Drop `readFile` from the `@tauri-apps/plugin-fs` import at :3 (sole user was handleSelectAudio) — keep `mkdir`/`copyFile` for the video branch. No string changes.

(3) SIDEBAR REPLACE — app/src/components/sidebar/AudioProperties.tsx handleReplace (:30-79): delete the `mkdir` / `copyFile` / `readFile(projectDir + …)` block. Read the picked bytes with `readAudioSourceBytes(filePath)`, decode, recompute peaks exactly as today, then `audioStore.updateTrack(track.id, buildAudioReplacePatch(filePath, audioBuffer, projectStore.fps.peek()))`. Remove the entire `@tauri-apps/plugin-fs` import at :4 (`copyFile`/`mkdir`/`readFile` were sole users of the deleted block — `noUnusedLocals`). The `projectDir` early-return (:31-32) is no longer required for this action — a disk reference works without a saved project directory; drop it or keep only what the surrounding component still needs. Keep `Replace...` and every other existing label byte-identical.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/mainAppAudioSources.test.ts src/lib/physicPaintBridge.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Gallery import and sidebar Replace register/update with the picker's absolute path verbatim and invoke neither mkdir nor copyFile; the picked file is read only through fetch(assetUrl(...)); registerPickedAudioSource dedupes by path; buildAudioReplacePatch preserves the new file's metadata and recomputes outFrame; the Studio requestImageImport('audio') path still yields absolute sourcePath assets; all existing user-facing strings unchanged; typecheck clean; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| saved .mce manifest JSON → runtime track/asset | `source_path` is persisted, attacker-influenceable text; a crafted manifest can name any readable media file the protocol will serve |
| source_path → efxasset:// read | the only sanctioned read channel for a disk-referenced file's bytes; bounded by allowed_roots + media-extension allowlist |
| picker path → import/replace registration | the user-chosen absolute path becomes the persisted source_path verbatim (no copy, no join, no rewrite) |
| temp→real project migration → asset paths | a root-prefix rewrite over a disk reference would corrupt a path that lives outside the project |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261009-RKO-01 | Information Disclosure | source_path in a crafted manifest → efxasset read | medium | mitigate | efxasset `resolve_efxasset_path` canonicalizes, requires a regular file with a media extension, and restricts to allowed_roots ($APPDATA/$RESOURCE/$HOME//Volumes//tmp//private) before any IO; source_path is never joined into a package write path |
| T-261009-RKO-02 | Tampering | reintroducing an audio copy at a main-app entry (package grows an audio/ tree and audio bytes) | high | mitigate | both verified copy sites are deleted; Task 2's never-copy test asserts plugin-fs mkdir/copyFile are never invoked by the gallery registration or the replace patch; the shared door contains no filesystem write |
| T-261009-RKO-03 | Tampering | retired `relative_path` silently accepted → half-migrated manifest reopens with a stale meaning | high | mitigate | `readMceAudioSourcePath` is the single throw site and is called from BOTH load doors (gallery audio_assets and the audio_tracks loop); round-trip tests pin `source_path` and the retired-key-throws test pins the clean break |
| T-261009-RKO-04 | Tampering | decode reads bypassing the efxasset boundary (plugin-fs on an arbitrary user path, or a joined project path) | medium | mitigate | every main-app audio byte read goes through `fetch(assetUrl(path))` (`readAudioSourceBytes` / the reopen loop); the reopen test asserts readFile is not used for track decode; fs scope physically cannot reach a user path outside `**/audio/**` |
| T-261009-RKO-05 | Integrity | temp→real project migration rewrites a disk reference path | low | mitigate | `updateProjectPaths` drops the audioAssets remap; asset paths are verbatim outside the project |
| T-261009-RKO-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new package installs in this plan — zero install surface (plugin-fs retirement, fetch, preact signals all already in use) |

</threat_model>

<verification>
- Per-task automated gates (`vitest run` only — NEVER watch, per CLAUDE.md; `pnpm --filter efx-motion-editor run typecheck` after each task).
- The four quick done-gates map to the two task verifies: (1) manifest round-trip with `source_path` + retired-key-throws → Task 1 mceAudioSourcePath + projectStore tests; (2) never-copy package contract (import and Replace write no audio/ tree and zero audio bytes) → Task 2 mainAppAudioSources tests (mkdir/copyFile never invoked) plus the two deleted copy sites; (3) reopen resolves verbatim and playback/peaks decode works → Task 1 verbatim-reopen + the named reopen-loop decode test (`readAudioSourceBytes` / `fetch(assetUrl)`, no plugin-fs readFile) + mainAppAudioSources.test.ts; (4) Studio picker still yields absolute `sourcePath` → Task 2 runs `src/lib/physicPaintBridge.test.ts` (ofk's gate is the non-regression; Task 1 already swept its makeAudioTrack fixture).
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — no NEW failures versus the pre-quick baseline (the 1 pre-existing `PhysicsPaintStudioView.test.ts` failure is out of scope: note it, do not fix it).
- Out-of-scope sweep: Studio `DocumentSoundClip` / `document.audios[]` / Relink surface, video `videos/` import, frame-media `relativePath` and `isSafePackageRelativePath`, and every existing user-facing string are unchanged (spot-check the diff touches none of them).
- Status stays automated-ready until the user judges the live UAT rows: gallery import leaves no audio/ folder and the source file untouched; sidebar Replace behaves the same with the new file; save/close/reopen keeps playback, waveform peaks, and the gallery row; Studio document sounds and their Relink are unaffected; a moved source file shows existing error behavior on the main-app track while Studio still shows red + Relink.
</verification>

<success_criteria>Both tasks land as one atomic commit each; targeted gates and typecheck green after each; full vitest run has no NEW failures; a saved .mce carries source_path (absolute) for audio_tracks and audio_assets with the retired key rejected at the load door; gallery import and sidebar Replace register the picker path verbatim and write nothing into the package; reopen decodes through the efxasset channel; Studio picker assets stay absolute-path; status reported as automated-ready pending the user's live UAT.</success_criteria>

<output>
Create `.planning/quick/261009-rko-main-app-audio-joins-the-disk-reference-/261009-rko-SUMMARY.md` when done (commit style: `test(quick-261009-rko): …` / `feat(quick-261009-rko): …`).
</output>
