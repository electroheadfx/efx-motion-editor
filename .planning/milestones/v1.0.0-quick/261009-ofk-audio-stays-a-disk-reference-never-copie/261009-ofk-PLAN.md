---
phase: quick-261009-ofk
plan: 261009-ofk
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.test.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.test.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/efxPaintStore.test.ts
  - app/src/stores/projectStore.ts
  - app/src/types/physicPaint.ts
  - app/src/types/physicPaint.test.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/efxPaintPersistence.test.ts
  - app/src/lib/documentSoundPeaks.ts
  - app/src/lib/documentSoundPeaks.test.ts
  - app/src/lib/documentSoundGates.ts
  - app/src/lib/documentSoundGates.test.ts
  - app/src/lib/exportEngine.ts
  - app/src/lib/playbackEngine.ts
  - app/src/lib/playbackEngine.test.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/lib/physicPaintBridge.test.ts
  - app/src/lib/documentSoundMissing.ts
  - app/src/lib/documentSoundMissing.test.ts
  - app/src/components/physic-paint/view/physicsPaintAudioController.ts
  - app/src/components/physic-paint/view/physicsPaintAudioController.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts
  - app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts
  - app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/stores/efxPaintStudioOriginSync.scratch.test.ts
autonomous: true
requirements: [QUICK-261009-OFK]

estimate:
  tokens: 76000
  raw_tokens: 38000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "Document sounds are DISK REFERENCES: Import/Replace/Relink record the picker's absolute on-disk path as `sourcePath`, the file is never copied into the package, and a saved .mce carrying document sounds contains no `audio/` directory and zero audio bytes (the original file stays untouched where it lives)."
    - "The document format carries `sourcePath` verbatim through save/reopen (exact-key set `id, sourceId, sourcePath, sourceRevision, startFrame, inFrame, outFrame, gain, fadeInFrames, fadeOutFrames, fadeInCurve, fadeOutCurve, enabled`); a document still carrying the retired `relativePath` member THROWS — clean break, no shim, no migration."
    - "When the referenced file has been moved or deleted, the Studio Audio list row renders red with a `Relink` button and the modal shows the existing missing copy; `isSoundMissing` now means 'the file at sourcePath does not resolve on disk', never 'not inside the .mce package'."
    - "Relink is a SOURCE SWAP through the EXISTING replace door: it selects the row then raises `onImportRequest('replace')` for that clip id; position, trims, gain, fades, and On/Off survive (only `sourceId`/`sourcePath`/`sourceRevision` change) — exactly what `Replace…` already does. No parallel relink pipeline, no second file-dialog path."
    - "Copy contract holds: NEW verbatim `Relink` (label + aria-label) on the list row; the modal keeps `Replace…` (same door, different label — do not unify); every other 52.5 string stays verbatim."
    - "Main-app `MceAudioTrack` / `AudioTrack` / `AudioProperties` / `imageStore` audio serialization / main-app timeline are untouched; `isSafePackageRelativePath` keeps gating the OTHER media kinds (frames, machine cache)."
  artifacts:
    - app/src/lib/documentSoundMissing.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx
    - app/src/lib/physicPaintBridge.ts
  key_links:
    - "DocumentSoundClip key set is enforced in THREE places that must move together: SOUND_KEYS + parseDocumentSound (efxPaintDocumentParsers.ts), encodeCanonicalSoundClip (efxPaintDocumentRevision.ts), and _isValidSoundClip / _sameSound (efxPaintStore.ts) — a stale key in any one of them breaks round-trip or the change-token"
    - "importAudio (physicPaintBridge.ts createPhysicPaintImageImportStatePorts) is the ONLY place that used to mkdir+copyFile into `audio/` for document sounds — deleting that copy is what makes the package-content gate true; main-app ImportedView keeps its own copy (out of scope, do not touch)"
    - "Every former `${projectRoot}/${sound.relativePath}` join becomes the bare `sound.sourcePath`: buildPhysicPaintDocumentAudioSection, documentSoundPeaks (switch readFile to fetch(assetUrl(sourcePath)) — plugin-fs scope cannot reach arbitrary user paths, efxasset can), exportEngine filePath, playbackEngine filePath, PhysicsPaintStudio confirm + peaks fallback, projectStore reopen registration"
    - "isSoundMissing seam: physicsPaintAudioController port (default stays false) ← PhysicsPaintStudio resolver ← documentSoundMissing helpers; the LIST calls controller.isSoundMissing(clip) per row, the MODAL keeps its selected-clip `missing` boolean"
    - "Relink onClick must set `controller.selectedSoundId.value = clip.id` BEFORE `ports.onImportRequest('replace')` — applyReplacedSource commits against the LIVE selection (same pattern as the row Trash2)"
    - "efxasset allowed_roots ($APPDATA/$RESOURCE/$HOME//Volumes//tmp//private) + media-extension allowlist is the read boundary for sourcePath; the isSafeAudioRelativePath audio/-prefix wrapper retires with this field but isSafePackageRelativePath stays for frames/cache"
---

<objective>
Make Studio document sounds true disk references: rename `DocumentSoundClip.relativePath` to `sourcePath` (meaning: the audio file's absolute path on disk), stop copying audio bytes into the `.mce` package, detect missing files by disk resolution, and give missing rows a red `Relink` button that swaps the source through the existing replace door.

Purpose: this app is not a video NLE — heavy media never enter the package. The package holds structure, timing, metadata, and light derived artifacts only; portability means moving the referenced files alongside the project. The 52.2 references-only law is generalized from images to audio.
Output: clean-break document format with `sourcePath`, a never-copy import path, disk-based missing detection, and the red+Relink list surface — with the parser/encoder, package-content, missing-semantics, and list-rendering gates green.
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

ARCHITECTURAL LAW (locked): heavy media NEVER enter the .mce. No embed/copy path for portability. ACCEPTED LOSS: losing the original file loses the media permanently — Relink helps only for moved/renamed files; no recovery/copy fallback, no sidecar media folder, no video handling, no collect-and-export.

NON-NEGOTIABLE CONSTRAINTS (per D-law in the quick description):
- Clean break on the document format — no migration, no legacy shim (same law as the retired `sound` member).
- Ride existing machinery: `applyImportedSource` / `applyReplacedSource` / `onImportRequest('replace')` / the shared `BackgroundAssetPickerView` audio picker / the existing `missing` + `AUDIO_ERROR_MISSING` modal path. No new file-dialog route, no new controller pipeline.
- Do NOT touch `MceAudioTrack`, `AudioTrack`, `AudioProperties`, `imageStore` audio serialization (`toMceAudioAssets`/`loadFromMceAudioAssets`), main-app `ImportedView`/`AudioProperties` copy behavior, or the main-app timeline. Main-app `AudioAsset.path` / `AudioTrack.relativePath` / manifest `audio_assets[].relative_path` fields keep their names and meanings.
- Preact + @preact/signals only (thin render shells, no useState, no render-body signal writes — read the efx-preact-reactivity skill before writing component/store code).
- `vitest run` only (never watch). No dev server (the user runs the live app). pnpm monorepo, app/ directory.

LANDMARKS (verified live 2026-10-09):
- app/src/efx-paint/document/efxPaintDocument.ts — DocumentSoundClip interface :176-210 (`relativePath` :182, comment :168-175).
- app/src/efx-paint/document/efxPaintDocumentParsers.ts — SOUND_KEYS :96-110, parseDocumentSound :453-514 (exact-key error message :458, field check :466, return :502).
- app/src/efx-paint/document/efxPaintDocumentRevision.ts — encodeCanonicalSoundClip :170-186 (`path:` term :174).
- app/src/stores/efxPaintStore.ts — _sameSound :1303-1308, _isValidSoundClip :1332-1340.
- app/src/lib/efxPaintPersistence.ts — isSafeAudioRelativePath :513-515 (DEF — retire), save gate loop :549-558, load gate loop :1393-1401. isSafePackageRelativePath (efxPaintPackage.ts :113) STAYS for frames/cache.
- app/src/lib/physicPaintBridge.ts — importAudio (the copy site) :2641-2678 (mkdir :2663, copyFile :2664, isSafeAudioRelativePath check :2652), getAudioAssets :2805-2818 (audio/ prefix filter :2810-2816), buildPhysicPaintDocumentAudioSection :3908-3922 (gate :3918, assetUrl join :3919), documentAudio ensure loop :3745-3748.
- app/src/types/physicPaint.ts — PhysicPaintAudioAssetRef :2200-2205 (`relativePath` :2204), isPhysicPaintAudioAssetRef :2585-2590 (hasOnlyKeys ['id','name','relativePath']).
- app/src/components/physic-paint/view/physicsPaintAudioController.ts — ImportedSoundSource :148-158, buildFreshSoundClip :183-200, buildReplacedSoundClip :207-227, applyReplacedSource patch :429-444, filename :271, isSoundMissing port :50-55 + default :492.
- app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx — row markup :52-95 (filename :68, Trash2 select-then-act :87-89, Import button :97-108).
- app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx — copy constants :74-97 (AUDIO_REPLACE_CTA :78 `Replace…`, AUDIO_ERROR_MISSING :85), missing error wiring :197.
- app/src/components/physic-paint/PhysicsPaintStudio.tsx — knownAudioPaths signal :466, refreshKnownAudioPaths :4729-4739, isSoundMissing resolver :4750-4753, audioPicker config :4764-4786, handleConfirmAudioPicker :4795-4837 (fetch join :4806, source build :4812-4816), peaks fallback :4879-4892.
- app/src/lib/documentSoundPeaks.ts — isSafeAudioRelativePath gate :40-42, readFile join :43.
- app/src/lib/documentSoundGates.ts — toDocumentSoundAudioTrack :87-110 (name/relativePath/originalFilename from the clip path).
- app/src/lib/exportEngine.ts — gate :339-341, filePath join :344.
- app/src/lib/playbackEngine.ts — filePath join :339.
- app/src/stores/projectStore.ts — reopen re-registration :733-741 (`path: ${projectRoot}/${sound.relativePath}` :741).
- app/src/components/physic-paint/physicsPaintStudio.css — audio list rules :4707-4805; existing error reds `#ff8585` (:1288) / `#f0907e` (:4695) are the color precedents.

TEST FIXTURES carrying the clip field (mechanical rename in Task 1): efxPaintDocumentParsers.test.ts (validSoundClip :454-470), efxPaintDocumentRevision.test.ts (:35, :131), efxPaintStore.test.ts (:1306), physicsPaintAudioController.test.ts, PhysicsPaintRightPanel.test.ts (:583-584), PhysicsPaintWorkflowStrip.viewport.test.ts (:1143, :1359), physicsPaintLaunchContext.test.ts (:133-134, :181), playbackEngine.test.ts (:63, :436, :622), BackgroundAssetPickerView.test.ts (:236), physicPaint.test.ts (:1119), efxPaintStudioOriginSync.scratch.test.ts (:79), documentSoundMultiClip.test.ts, documentSoundGates.test.ts. Vitest collects only `src/**/*.test.ts` (launcher pattern `*.test.tsx.test.ts` exists for tsx suites).

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: sourcePath persistence law — clean-break format, never-copy import, disk-path resolution</name>
  <files>app/src/efx-paint/document/efxPaintDocument.ts, app/src/efx-paint/document/efxPaintDocumentParsers.ts, app/src/efx-paint/document/efxPaintDocumentRevision.ts, app/src/efx-paint/document/efxPaintDocumentParsers.test.ts, app/src/efx-paint/document/efxPaintDocumentRevision.test.ts, app/src/stores/efxPaintStore.ts, app/src/stores/efxPaintStore.test.ts, app/src/stores/projectStore.ts, app/src/types/physicPaint.ts, app/src/types/physicPaint.test.ts, app/src/lib/efxPaintPersistence.ts, app/src/lib/efxPaintPersistence.test.ts, app/src/lib/documentSoundPeaks.ts, app/src/lib/documentSoundPeaks.test.ts, app/src/lib/documentSoundGates.ts, app/src/lib/documentSoundGates.test.ts, app/src/lib/exportEngine.ts, app/src/lib/playbackEngine.ts, app/src/lib/playbackEngine.test.ts, app/src/lib/physicPaintBridge.ts, app/src/lib/physicPaintBridge.test.ts, app/src/components/physic-paint/view/physicsPaintAudioController.ts, app/src/components/physic-paint/view/physicsPaintAudioController.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts, app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts, app/src/components/physic-paint/view/BackgroundAssetPickerView.test.ts, app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/stores/efxPaintStudioOriginSync.scratch.test.ts</files>
  <behavior>
    - Parser round-trip: a document whose audios[0].sourcePath is an absolute path (e.g. /Users/test/Music/take.wav) survives JSON serialize -> parseEfxPaintDocument with sourcePath byte-identical; the exact-key set is id, sourceId, sourcePath, sourceRevision, startFrame, inFrame, outFrame, gain, fadeInFrames, fadeOutFrames, fadeInCurve, fadeOutCurve, enabled.
    - Retired member: a clip record carrying the old package-relative key instead of sourcePath throws DocumentSoundClip: unknown members (fail-closed, no shim).
    - Encoder: encodeCanonicalAudios output rotates when sourcePath changes and is stable when it does not.
    - Never-copy import: importAudio with a picker path registers the asset at that absolute path, returns a ref whose sourcePath equals the input path verbatim, and calls neither mkdir nor copyFile from plugin-fs.
    - Package content: a saved package whose document carries sounds has no entry under an audio/ top-level directory and no audio-media bytes in the file listing.
  </behavior>
  <action>ONE atomic law change: the clip path field becomes `sourcePath` (the audio file's absolute path on disk) everywhere, and document-sound bytes never enter the package. Read .claude/skills/efx-preact-reactivity/SKILL.md first. Two commits are acceptable only if the first is the mechanical rename and the second the never-copy + gate retirement — but one commit is preferred since the intermediate state contradicts the law.

(1) TYPE + FORMAT (clean break). app/src/efx-paint/document/efxPaintDocument.ts: rename DocumentSoundClip.relativePath to `sourcePath`, rewrite the field doc to "Absolute path to the audio file on disk (heavy media stay disk references — never copied into the package)" and fix the interface comment block :168-175 (the 52.2 references-only sentence now covers audio as a disk reference). app/src/efx-paint/document/efxPaintDocumentParsers.ts: swap `relativePath` for `sourcePath` in SOUND_KEYS (:97), in parseDocumentSound's unknown-members message (:458 — the message must list sourcePath in the exact-key sentence), in the per-field check (:466-467), and in the frozen return (:502). A clip record still carrying the retired key throws through hasOnlyKeys — do NOT add a rename shim or an accepted-alternate key. app/src/efx-paint/document/efxPaintDocumentRevision.ts: encodeCanonicalSoundClip reads sound.sourcePath in the path: term (:174). app/src/stores/efxPaintStore.ts: _sameSound (:1306) and _isValidSoundClip (:1336) read sourcePath.

(2) NEVER-COPY IMPORT (the persistence law). app/src/lib/physicPaintBridge.ts createPhysicPaintImageImportStatePorts.importAudio (:2641-2678): delete the mkdir+copyFile block and the isSafeAudioRelativePath filename check — the chosen file stays where it lives. For each picker path: name = basename, dedupe against imageStore.audioAssets by `path === filePath` (the absolute path), register `imageStore.addAudioAsset({ id, name, path: filePath })` when absent, and return `PhysicPaintAudioAssetRef` carrying `sourcePath: filePath` (the absolute path the picker returned) — never a package-relative value. If any future guard is wanted on the incoming path, it is a non-empty string check only (the parser already enforces that). getAudioAssets (:2805-2818): drop the projectDir/audio/ prefix filter and map every registered audio asset to `{ id, name, sourcePath: asset.path }` — the gallery lists disk references wherever they live. app/src/types/physicPaint.ts: rename PhysicPaintAudioAssetRef.relativePath to `sourcePath` (:2204 + comment :2200) and update isPhysicPaintAudioAssetRef's hasOnlyKeys to ['id','name','sourcePath'] (:2587-2590).

(3) RESOLUTION — every former join becomes the bare sourcePath. Since the field is absolute, no projectRoot concatenation survives: app/src/lib/physicPaintBridge.ts buildPhysicPaintDocumentAudioSection (:3908-3922) drops the isSafeAudioRelativePath fail-closed gate (it no longer applies to this field) and builds `assetUrl(sound.sourcePath)`; keep the empty-list -> null shape. app/src/lib/documentSoundPeaks.ts: drop the isSafeAudioRelativePath gate (:40-42) and replace `readFile(`${projectRoot}/${sound.relativePath}`)` with a fetch of `assetUrl(sound.sourcePath)` -> arrayBuffer (plugin-fs scope cannot reach arbitrary user paths; efxasset allowed_roots already serves absolute paths — same channel the Studio decode uses). Simplify the signature: drop the now-unused projectRoot parameter and update the two callers (projectStore.ts :783, physicPaintBridge.ts :3748). app/src/lib/exportEngine.ts (:339-344): drop the isSafeAudioRelativePath skip and set filePath to `entry.sound.sourcePath`. app/src/lib/playbackEngine.ts (:339): filePath becomes `sound.sourcePath`. app/src/lib/documentSoundGates.ts toDocumentSoundAudioTrack (:87-110): name / relativePath / originalFilename derive from sound.sourcePath (the AudioTrack record fields keep their names — only the values change). app/src/components/physic-paint/PhysicsPaintStudio.tsx handleConfirmAudioPicker: `fetch(assetUrl(asset.sourcePath))` (:4806) and the source object carries `sourcePath: asset.sourcePath` (:4812-4816); the peaks-ensure fallback (:4879-4892) uses `assetUrl(clip.sourcePath)` directly. app/src/stores/projectStore.ts reopen loop (:733-741): register `path: sound.sourcePath` and `name: sound.sourcePath.split('/').pop()`; if a same-id asset already exists with a different path (manifest audio_assets may round-trip a root-joined value — imageStore serialization is out of scope and untouched), removeAudioAsset then addAudioAsset so the gallery row carries the authoritative path. app/src/lib/efxPaintPersistence.ts: DELETE isSafeAudioRelativePath (:513-515) and both per-clip gate loops (:549-558 save, :1393-1401 load) — this field is no longer a package-relative reference; isSafePackageRelativePath and every OTHER media gate (frames, machine cache) stay byte-untouched.

(4) CONTROLLER + LIST filename. app/src/components/physic-paint/view/physicsPaintAudioController.ts: ImportedSoundSource.relativePath -> `sourcePath` (:153-154), buildFreshSoundClip / buildReplacedSoundClip / applyReplacedSource patch key, and the filename derivation (:271) reads sound.sourcePath. app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx: the filename span reads `clip.sourcePath.split('/').pop() ?? clip.sourcePath` (:68) — no other list change in this task (Relink is Task 2).

(5) FIXTURES (mechanical): every DocumentSoundClip / PhysicPaintAudioAssetRef / ImportedSoundSource fixture in the test files listed in the context block renames the field and switches the value to an absolute-looking path (`/Users/test/Music/<name>` style) — EXCEPT leave main-app AudioAsset / AudioTrack / MceAudioTrack / imageStore fixtures (audioStore.test.ts, projectStore.test.ts audio rows) untouched. Add the two new parser tests and the encoder-rotation test per the behavior block, and in physicPaintBridge.test.ts add the never-copy import test (vi.mock('@tauri-apps/plugin-fs'); assert copyFile and mkdir are never invoked and the returned ref's sourcePath equals the input path) plus in efxPaintPersistence.test.ts a package-content scan (savePackage a document carrying a sound clip -> listPackageFiles(root) has no entry under an audio/ top-level directory and no audio-extension bytes).</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document/efxPaintDocumentParsers.test.ts src/efx-paint/document/efxPaintDocumentRevision.test.ts src/stores/efxPaintStore.test.ts src/lib/physicPaintBridge.test.ts src/lib/efxPaintPersistence.test.ts src/lib/documentSoundPeaks.test.ts src/lib/documentSoundGates.test.ts src/lib/playbackEngine.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>Parser round-trip carries sourcePath verbatim and a clip record carrying the retired package-relative key throws; the canonical encoder rotates on a sourcePath change; importAudio records the picker's absolute path and performs no filesystem write into the package; a saved package with document sounds lists no audio/ directory entry and no audio bytes; every consumer resolves the clip through the bare sourcePath (efxasset URL / export filePath / playback filePath / reopen registration) with isSafeAudioRelativePath retired while isSafePackageRelativePath still guards frames and cache; typecheck clean; one atomic commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: disk-based missing detection + red Relink row through the replace door</name>
  <files>app/src/lib/documentSoundMissing.ts, app/src/lib/documentSoundMissing.test.ts, app/src/components/physic-paint/PhysicsPaintStudio.tsx, app/src/components/physic-paint/view/physicsPaintAudioController.ts, app/src/components/physic-paint/view/physicsPaintAudioController.test.ts, app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx, app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts, app/src/components/physic-paint/physicsPaintStudio.css</files>
  <behavior>
    - isSoundSourceMissing(null, path) is false (not probed yet -> present, no false-missing flash at boot); isSoundSourceMissing(missingSet, path) is true exactly when the set holds that sourcePath.
    - collectMissingSoundSourcePaths with a fake probe reports a path missing when the probe says it does not resolve, and present when it does; probe failures count as missing.
    - List: a clip whose isSoundMissing is true renders its row with the missing class and a button labelled `Relink` whose aria-label is `Relink`; clicking it sets selectedSoundId to that clip id and calls onImportRequest('replace') exactly once; a present clip renders no Relink button.
  </behavior>
  <action>Missing = the file at sourcePath does not resolve on disk (never "not inside the package"), surfaced on every list row and in the modal's existing missing state; Relink rides the existing replace door. Read .claude/skills/efx-preact-reactivity/SKILL.md first. Thin render shell only — the list mutation happens in the click handler, no render-body signal writes.

(1) PURE HELPERS — new app/src/lib/documentSoundMissing.ts. Export `isSoundSourceMissing(missing: ReadonlySet<string> | null, sourcePath: string): boolean` (null -> false; else set membership) and `collectMissingSoundSourcePaths(sourcePaths: readonly string[], probeResolves: (sourcePath: string) => Promise<boolean>): Promise<ReadonlySet<string>>` (dedupe the input, probe each distinct path, collect the ones where the probe returns false or throws). Keep it dependency-free except the DocumentSoundClip type if needed. New app/src/lib/documentSoundMissing.test.ts covers the behavior block with a fake probe map.

(2) STUDIO RESOLVER — app/src/components/physic-paint/PhysicsPaintStudio.tsx. Replace the knownAudioPaths signal (:466) with `missingAudioSourcePaths = useSignal<ReadonlySet<string> | null>(null)` (same null = not probed yet = report present law the old comment describes). Rework refreshKnownAudioPaths (:4729-4739) into two pieces: `refreshAudioAssets` (requestImageLibrary('audio') -> assets, used as the picker's refreshAudioLibrary port) and `refreshMissingAudioPaths` (read getEfxPaintDocument(layerId)?.audios, collect their sourcePath values, call collectMissingSoundSourcePaths with a probe of `async (p) => { try { const r = await fetch(assetUrl(p)); void r.body?.cancel(); return r.ok; } catch { return false; } }`, write the result into the signal). Run refreshMissingAudioPaths on mount (alongside the existing audioAssets refresh), and after a successful import/replace commit in handleConfirmAudioPicker (where refreshKnownAudioPaths used to be relied on), and after the picker's import refresh. The isSoundMissing port (:4750-4753) becomes `(sound) => isSoundSourceMissing(missingAudioSourcePaths.value, sound.sourcePath)`.

(3) SURFACE ON THE CONTROLLER — app/src/components/physic-paint/view/physicsPaintAudioController.ts. Add `isSoundMissing: (sound: DocumentSoundClip) => boolean` to the PhysicsPaintAudioController interface and return the port-wired function (the port default stays `() => false`). The selected-clip `missing` boolean (:272) keeps driving the modal — do not remove it.

(4) LIST ROW — app/src/components/physic-paint/view/PhysicsPaintAudioListSection.tsx. For each clip compute `const missing = controller.isSoundMissing(clip)`. When missing: add `physics-paint-audio-clip-row-missing` to the row class string and `physics-paint-audio-filename-missing` to the filename span, and render a Relink button (class `physics-paint-audio-clip-relink`) beside the Trash2 button with label AND aria-label AND title set to the new constant AUDIO_RELINK_CTA. Its onClick (handler-body mutation, same pattern as the row Trash2 :87-89): `controller.disarmRemove(); controller.selectedSoundId.value = clip.id; ports.onImportRequest('replace');` — selection BEFORE the door raise so applyReplacedSource commits against this clip. When not missing, no Relink button. app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx: add `export const AUDIO_RELINK_CTA = 'Relink';` next to the other AUDIO_* copy constants; the modal keeps `Replace…` (AUDIO_REPLACE_CTA) and AUDIO_ERROR_MISSING byte-identical — do NOT unify the labels (list = Relink, modal = Replace…, same door).

(5) CSS — app/src/components/physic-paint/physicsPaintStudio.css, beside the existing audio list rules (:4707-4805): `.physics-paint-audio-clip-row-missing` (subtle red border/tint), `.physics-paint-audio-filename-missing` (color #ff8585, the existing inline-error red), `.physics-paint-audio-clip-relink` (compact text button matching the trash button's hit target and disabled/busy opacity).

(6) TESTS. app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts (audio tab harness :580-675): extend the fake controller with an `isSoundMissing` function; assert a missing clip's row carries physics-paint-audio-clip-row-missing and renders a `Relink` button, that clicking it sets selectedSoundId to that clip id and calls onImportRequest('replace') once, and that a present clip renders no Relink button. app/src/components/physic-paint/view/physicsPaintAudioController.test.ts: the controller exposes isSoundMissing wired to the port and the port default is false.</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run src/lib/documentSoundMissing.test.ts src/components/physic-paint/view/physicsPaintAudioController.test.ts src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts && pnpm --filter efx-motion-editor run typecheck</automated>
  </verify>
  <done>isSoundMissing is true when the file at sourcePath is absent and false when present (null pre-probe reports present); every list row reads it and a missing clip renders red with a `Relink` button whose click selects that clip and raises onImportRequest('replace') on the right clip id; the modal still shows the existing missing copy with `Replace…`; position/trims/gain/fades/enabled survive the source swap because applyReplacedSource keeps them; typecheck clean; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| saved .mce document JSON → runtime clip | `sourcePath` is persisted attacker-influencable text; a crafted document can name any readable media file the protocol will serve |
| sourcePath → efxasset:// read | the only sanctioned read channel for the clip's bytes; bounded by allowed_roots + media-extension allowlist |
| picker path → import registration | the user-chosen absolute path becomes the persisted sourcePath verbatim (no copy, no join) |
| list row Relink → replace door | a click mutates selection then opens the shared picker; wrong-clip selection would swap the wrong source |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this quick directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261009-OFK-01 | Information Disclosure | sourcePath in a crafted document → efxasset read | medium | mitigate | efxasset resolve_efxasset_path canonicalizes, requires a regular file with a media extension, and restricts to allowed_roots ($APPDATA/$RESOURCE/$HOME//Volumes//tmp//private) before any IO; sourcePath is never joined into a package write path |
| T-261009-OFK-02 | Tampering | reintroducing an audio copy (package grows an audio/ tree and audio bytes) | high | mitigate | the copy site in importAudio is deleted; Task 1's package-content scan asserts zero audio/ directory entries and zero audio bytes for a saved project carrying sounds; no other document-sound writer exists |
| T-261009-OFK-03 | Tampering | format drift between parser key set, encoder, and store validators breaks save/reopen or the change-token | high | mitigate | all three move in one commit; the round-trip + retired-member-throws + encoder-rotation tests pin the exact key set; parseDocumentSound's unknown-members message lists sourcePath |
| T-261009-OFK-04 | Tampering | Relink commits against the wrong clip (selection raised after the door, or stale selection) | medium | mitigate | the Relink handler writes selectedSoundId before raising onImportRequest('replace') (same ordering the row Trash2 uses); the list test asserts the exact clip id reaches the door |
| T-261009-OFK-05 | Denial of Service | missing-file probe fetches whole audio bodies on every refresh | low | mitigate | probe cancels the response body after reading status; probes are deduped by sourcePath and run only on mount / after import / after replace |
| T-261009-OFK-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new package installs in this plan — zero install surface (fetch, plugin-fs retirement, preact signals all already in use) |

</threat_model>

<verification>
- Per-task automated gates (`vitest run` only — NEVER watch, per CLAUDE.md; `pnpm --filter efx-motion-editor run typecheck` after each task).
- The four quick done-gates map to the two task verifies: (1) parser/encoder round-trip + retired-key throws → Task 1 parsers/revision tests; (2) package-content scan with no audio/ bytes → Task 1 bridge + persistence tests; (3) isSoundMissing disk semantics → Task 2 documentSoundMissing tests; (4) red row + Relink raising the replace door on the right clip id → Task 2 right-panel tests.
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — no NEW failures versus the pre-quick baseline (any pre-existing failure is out of scope: note it, do not fix it).
- Out-of-scope sweep: `MceAudioTrack`, `AudioTrack`, `AudioProperties`, imageStore toMce/loadFromMce audio serialization, main-app ImportedView copy path, and isSafePackageRelativePath frame/cache gates are unchanged (spot-check the diff touches none of them).
- Status stays automated-ready until the user judges the live UAT rows in Studio: import+save shows no audio/ folder and an untouched source file; moved/renamed file shows the red row + Relink and the modal missing copy; Relink restores playback with position/trims/gain/fades/On-Off intact; modal Replace… still swaps the selected source; an alt+drag duplicate relinks independently of its sibling.
</verification>

<success_criteria>Both tasks land as one atomic commit each; targeted gates and typecheck green after each; full vitest run has no NEW failures; a saved .mce with document sounds contains no audio/ directory and zero audio bytes while sourcePath round-trips verbatim and the retired key throws; missing rows render red with `Relink` raising the existing replace door on the correct clip; status reported as automated-ready pending the user's live UAT.</success_criteria>

<output>
Create `.planning/quick/261009-ofk-audio-stays-a-disk-reference-never-copie/261009-ofk-SUMMARY.md` when done (commit style: `test(quick-261009-ofk): …` / `feat(quick-261009-ofk): …`).
</output>
