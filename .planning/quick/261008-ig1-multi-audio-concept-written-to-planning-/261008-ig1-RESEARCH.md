# Quick 261008-ig1: Multi-audio concept — Research

**Researched:** 2026-10-08
**Domain:** singleton → list document-model refactor (Preact/signals Studio UI + Tauri serde launch context)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two identities, never overloaded: `DocumentSoundClip.id` = the placed clip (list key, timeline selection, transport key, buffer key); `sourceId` = the imported file (peaks cache key, gallery dedupe key). `id` unique per clip; `sourceId` NOT unique (alt+drag shares it).
- `audios: readonly DocumentSoundClip[]` replaces the top-level `sound` singleton (`DocumentSoundClip` shape unchanged). Per-clip settings. Fail-closed parse: `SOUND_KEYS` per entry + `AUDIO_LIST_KEYS` on the container; unknown members throw.
- Modal (`PhysicsPaintAudioModalView`) becomes list + per-selection editor: row per clip (filename, enabled, in..out, selected marker), click row → select + reveal on timeline, `Import sound` ADDS, `Replace…` swaps selected clip's source preserving position/in-out, `Remove` + `On`/`Off`, per-clip Volume / Fade in / Fade out / In / Out.
- Timeline multi-clip render: one stain + trim handles + fade/volume overlay per clip; `selectedSoundId` drives `is-selected`; click clip → select (never scrubs); click band outside every clip → deselect; double-click clip → open modal on **that** clip.
- Two ways in: timeline double-click lands on that clip's editor (list pre-selected); `Document sound` header launcher lands on the **list** (chooser). Single clip: both land on the same place.
- Alt+drag duplication: fresh `id`, same `sourceId`; duplicate copies geometry + settings; peaks stay source-keyed; no second bytes copy, no second gallery entry, no second `audio/` path.
- Rust `PhysicsPaintLaunchContext` carries the clip list — **hard gate**: a Rust round-trip test serializing a launch context with the full `audios[]` and asserting every member survives deserialize. No "grow the struct and hope".
- No backward compat: the singular `sound` member is gone; old projects fail to parse and are rebuilt fresh.

### Claude's Discretion
- Concrete Preact component shape for the modal list rows and selected marker (subject to `efx-preact-reactivity` + `developing-preact`; no useState).
- Exact reveal-scroll behavior for click-to-reveal (the 260922-qad one-shot viewport scroll is the existing analog — ride it).
- How the timeline band deselect interacts with the single-rail drag routing split (gate drag on move-membership flags).
- Test file layout and exact vitest launcher (only `.test.ts` is collected).

### Deferred Ideas (OUT OF SCOPE — follow-up quick)
- Transport/`documentAudio` channel reshaping, `preparedTrackIds` changes, `.mce` `audios/` package-reference expansion for the list, export-mixer / playback-mix retargeting, master lane. The 52.5-02 mixer already sums whatever clips it is handed.
</user_constraints>

## Summary

The 52.5 singleton implementation is fully landed (10/10 UAT) and every seam is documented; the multi-audio quick is a **breadth refactor, not a new-capability build**. The singleton surface is ~18 sites across 13 files; roughly a third are already per-clip-shaped (`SOUND_KEYS`, `resolveDocumentSoundClip`'s clipId join, `collectDocumentSoundClips` returning a list, `audioPeaksCache` source-keyed, `buildExportMixEntries` taking an array) and only need their *input* mapped from `document.sound` to `document.audios`. The genuinely structural work is: (1) the store setter (`setDocumentSound` → list operations), (2) the strip's gesture session — which today carries **no clip identity at all** (`SoundBandGestureSession.origin` is bare geometry, `PhysicsPaintWorkflowStrip.tsx:555-563`) — and its selection, which is today an imperative `classList.toggle` on three element refs (:2864-2867), both of which cannot survive N clips; (3) the modal becoming list + per-selection editor; (4) the Rust round-trip test.

Key findings: **(a)** the Rust struct's `document` and `documentAudio` fields are both opaque `serde_json::Value` (`lib.rs:97-98, 114-115`), so `audios[]` content riding the existing `document` carrier needs *no struct change* — but the hard-gate test must still pin it, and any *new top-level* launch member added TS-side would be silently dropped without a declared Rust field (the documented UAT-round-6 bug). **(b)** The cheapest N-clip render under `efx-preact-reactivity` is a per-clip child component keyed `key={clip.id}` that reads `selectedSoundId.value` in its own render — the giant strip body never reads the selection signal, so a selection change re-renders only the cheap clip children, never the rails/rows; peaks need no work (already source-keyed + `peaksCacheRevision`). **(c)** Alt+drag must branch at stain pointer-down (gesture identity is fixed at pointer-down by drag law); the current guard excludes meta/ctrl/shift but **passes alt through**, so today alt+drag silently moves the original; the trim handlers also don't check alt. **(d)** No sound-clip duplicate helper exists — write `buildDuplicatedSoundClip` beside `buildFreshSoundClip`/`buildReplacedSoundClip`, and copy the append law `Object.freeze([...list, ...duplicates])` from `physicsPaintRotoRailSetCopy.ts:829`.

**Primary recommendation:** sequence the quick as model+setter → strip (list render + selectedSignal + gesture clipId) → modal list → alt+drag → Rust gate test, and treat `frameMap`'s singular `soundClip` layout and the `documentAudio` singleton section as explicitly-pinned minimal edits (compile-safe, behavior deferred to the follow-up) so the reviewer cannot mistake them for the deferred retargeting.

## Front 1 — The singleton → list refactor surface

### Already per-clip-shaped (map the input, keep the shape)

| Site | Symbol / lines | Why it's safe |
|------|----------------|---------------|
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts:86-100` | `SOUND_KEYS` per-entry allowlist: `'id','sourceId','relativePath','sourceRevision','startFrame','inFrame','outFrame','gain','fadeInFrames','fadeOutFrames','fadeInCurve','fadeOutCurve','enabled'` | Already validates ONE clip's fields; add container `AUDIO_LIST_KEYS` + array parse loop. `AUDIO_LIST_KEYS` does not exist yet (grep: 0 matches). |
| `app/src/lib/documentSoundGates.ts:44-52` | `resolveDocumentSoundClip(document, section)` — joins `sound.id !== section.clipId → null` | Already clipId-driven; becomes `document.audios.find(c => c.id === section.clipId) ?? null`. Fail-closed contract unchanged. |
| `app/src/lib/documentSoundGates.ts:155-179` | `collectDocumentSoundClips(...): DocumentSoundClipEntry[]` — deduped per layer, `const sound = getDocument(layerId)?.sound ?? null` at :168 | Output is ALREADY a list (one entry per physic-paint layer). Change: `for (const sound of getDocument(layerId)?.audios ?? [])` push each. The export mixer feed (`exportEngine.ts:337-350`, `buildExportMixEntries(...)`) already accepts the array — per CONTEXT, the mixer needs no retarget. |
| `app/src/lib/documentSoundPeaks.ts:25-50` | `ensureDocumentSoundPeaks(sound, ...)` — early-returns on `audioPeaksCache.get(sound.sourceId) !== undefined`, in-flight `Set<string>` keyed sourceId | Idempotent per SOURCE; callers map over `audios[]` (duplicates collapse on sourceId). Note quirk below (Pitfall: buffer keyed by `sound.id` at :39 but early-return is source-keyed). |
| `app/src/lib/audioPeaksCache.ts` | `get/set/getSourceFrames` keyed by caller string | Type-free; `sourceId` keys work as-is (52.5 design). |
| `physicsPaintAudioController.ts:145-189` | `buildFreshSoundClip` (fresh `id: crypto.randomUUID()` :148) / `buildReplacedSoundClip` (spread + clamp) | Pure builders; keep verbatim for Import-add and Replace paths; add `buildDuplicatedSoundClip` beside them. |

### Hard-coded singleton (must change)

| # | File:line | Symbol | Change |
|---|-----------|--------|--------|
| 1 | `efx-paint/document/efxPaintDocument.ts:221` | `readonly sound: DocumentSoundClip \| null` + factory `sound: null` (:267-269) | → `readonly audios: readonly DocumentSoundClip[]`; factory `audios: []`. `DocumentSoundClip` interface (:172-206) unchanged. |
| 2 | `efxPaintDocumentParsers.ts:60` | `DOCUMENT_KEYS = new Set([... 'sound' ...])` (verbatim: `'version', 'parentLayerId', 'documentRevision', 'activeTrackId', 'tracks', 'background', 'photoReference', 'sound', 'compositeRevision'`) | Swap `'sound'` → `'audios'` + update the unknown-members throw message in the same change (52.5 Pitfall 5); parse `audios` array with `AUDIO_LIST_KEYS` container + per-entry `SOUND_KEYS`. |
| 3 | `efxPaintDocumentRevision.ts:179` | `encodeCanonicalSound(sound: DocumentSoundClip \| null): string` — feeds sync fingerprint `|sound:` AND save change-token | → encode the list (array order = canonical order; label term `audios:`). Excluded from `encodeValidatedEfxPaintDocumentContent` stays as-is (no doc-revision bump). |
| 4 | `stores/efxPaintStore.ts:1356-1365` | `setDocumentSound(layerId, sound)` + `_sameSound` (:1303-1318) + `_isValidSoundClip` (:1327-1342) + `DocumentSoundResult` (:1294-1296) | The ONE write door. Replace with list ops: e.g. `setDocumentAudios(layerId, clips)` (sameValue early-return compares list) and/or member helpers `addDocumentSound` / `patchDocumentSound(id, patch)` / `removeDocumentSound(id)`. Keep the idempotent + fail-closed laws verbatim. Existing list-setter precedent in the same store: background clips `clipId = crypto.randomUUID()` append (:704-715). |
| 5 | `view/physicsPaintAudioController.ts` | `document?.sound` (:208), `patchSound` (:222-226), `confirmRemove → setSound(layerId, null)` (:297), `applyImportedSource` fresh-or-replace (:318-330) | All reads/writes must scope to `selectedSoundId`. Import becomes ADD + select-new (not replace); `Replace…` uses existing `buildReplacedSoundClip` on the selected clip; `Remove` splices one entry. |
| 6 | `view/PhysicsPaintAudioModalView.tsx` (430 lines) | Single editor; header `AUDIO_MODAL_TITLE = 'Document sound'` (:51); controller destructure (:173-179) | Insert the chooser list above the editor (rows: filename, enabled, in..out, selected marker; `key={clip.id}`); empty state only when `audios.length === 0`. |
| 7 | `view/PhysicsPaintWorkflowStrip.tsx:509` | prop `documentSound?: DocumentSoundClip \| null` | → `documentAudios?: readonly DocumentSoundClip[]`. Geometry math (:1846-1872) moves into a per-clip child component. |
| 8 | same file :555-563 | `SoundBandGestureSession` — `origin: SoundBandValues` (bare `{startFrame,inFrame,outFrame}`, no id) | Add `clipId` (+ origin clip). `SoundBandGesturePatch`/`onDocumentSoundSettle` (:515) must carry `clipId` or settle patches the wrong clip. |
| 9 | same file :2832-2867, :4641-4646, :4657-4742 | Singleton refs `soundStainElRef`/`soundEdgeStartElRef`/`soundEdgeEndElRef`; `applySoundSelected` = `classList.toggle('is-selected', …)`; ruler band-press `applySoundSelected(false)` | Selection becomes a signal (`selectedSoundId`), read per-clip in render (`class={… is-selected}`), set IN the click handlers (never an effect — memory law). Deselect = `selectedSoundId.value = null` in the ruler's existing onPointerDown. |
| 10 | `PhysicsPaintStudio.tsx` | `resolveDocumentSound` (:4843-4847, reads `efxPaintVersion.value`), `handleDocumentSoundGestureSettle` (:4827-4839, patches singleton), peaks-ensure effect (:4777-4821, ONE in-flight ref `soundPeaksEnsureRef` for one sourceId), `onOpenDocumentSound` (:4924, no target param), `audioModalOpen` (:4660) | Map resolve → list; settle routes by clipId; ensure-effect loops distinct `sourceId`s with an `Set` in-flight guard (dedupe: two clips sharing a source ensure once); open signal gains a target: `'list' | { clipId }` so double-click pre-selects and the launcher lands on the list. |
| 11 | `lib/frameMap.ts:335-365` | builds singular `soundClip` layout member (`peaks: audioPeaksCache.get(documentSound.sourceId)`); consumer `TimelineRenderer.ts:860-863 drawPhysicPaintSoundStain` | **Scope-pin site:** main-window timeline multi-clip render is not in the stated core slice; needs a *defined minimal behavior* (recommendation: `soundClips` array member + renderer loops, or explicitly first-clip-only with a plan note). Must not silently regress the main-timeline stain. |
| 12 | `lib/efxPaintPersistence.ts:551, :1392` | `isSafeAudioRelativePath(document.sound.relativePath)` guards on save AND load | Loop over `audios[]` — every entry guarded (the path law itself unchanged). |
| 13 | `lib/efxPaintPersistence.ts:1135` | `buildEfxPaintLayerChangeTokenValue(layer.documentRevision, layer.compositeRevision, layer.document.sound)` | Feed the encoded list (rides #3). |
| 14 | `stores/projectStore.ts:735-744` | gallery re-register `loaded.document.sound` (`.some(asset.id === sound.sourceId)` guard) | Map over `audios[]`; the `.some` guard already dedupes shared sourceIds — no duplicate gallery entries. |
| 15 | `stores/projectStore.ts:781-784` | reopen ensure loop `getEfxPaintDocument(layerId)?.sound` → `ensureDocumentSoundPeaks` | Map over `audios[]` (ensure itself collapses by sourceId). |
| 16 | `lib/physicPaintBridge.ts:3900-3912` | `buildPhysicPaintDocumentAudioSection` → `{revision, clipId, assetUrl}` from singleton; soundChanged JSON compare :3734-3745; launch embed :4004, :4024 | **Scope-pin site:** section reshaping is the follow-up. Minimal in-slice edit: JSON-compare `document.audios`; section stays singleton-shaped (only one clip transportable/playable — state this in the plan). |
| 17 | `audio/efxPaintAudioMonitor.ts` + `audio/efxPaintDocumentAudioStore.ts` | `getSection()` → `{clipId, assetUrl}`; `prepareClip` :134-136; clipLeg in `playAtCursor` uses `preparedTrackIds.has(clipSection.clipId)` | Follow-up per CONTEXT (transport + preparedTrackIds + playback-mix). In-slice: only the `resolveDocumentSoundClip` call site adapts (#13 in gates). Multi-clip *playback* is follow-up — but multi-clip *drawing/editing/save* works. |
| 18 | Tests | `efxPaintDocumentParsers.test.ts`, `efxPaintDocumentRevision.test.ts`, `documentSoundGates.test.ts`, `documentSoundPeaks.test.ts`, `playbackEngine.test.ts`, `PhysicsPaintStudio.test.ts`, `PhysicsPaintWorkflowStrip.viewport.test.ts`, `physicsPaintLaunchContext.test.ts` | Fixtures carrying `sound` member break once `DOCUMENT_KEYS` swaps — rebuild fixtures (no migration, project law). |

## Front 2 — The Rust launch-context serde drop + test target

**Struct (read this session):** `app/src-tauri/src/lib.rs:77-116` — `#[derive(Clone, serde::Deserialize, serde::Serialize)] struct PhysicsPaintLaunchContext`. Sound/audio-relevant members, verbatim:

```rust
#[serde(rename = "document", skip_serializing_if = "Option::is_none")]
document: Option<Value>,
...
#[serde(rename = "audioPreview", skip_serializing_if = "Option::is_none")]
audio_preview: Option<Value>,
// 52.5 (UAT round 6): the closed documentAudio section rides the same
// opaque-Value channel as audioPreview. Without this field serde DROPPED
// the member on the native path, ...
#[serde(rename = "documentAudio", skip_serializing_if = "Option::is_none")]
document_audio: Option<Value>,
```
[VERIFIED: app/src-tauri/src/lib.rs:97-115]

**Consequence for this quick:** `document` (which carries the whole `EfxPaintDocument`, and therefore `audios[]` once the model swaps) and `documentAudio` are both **opaque `Value`** — content growth inside them needs NO Rust field. The silent-drop pitfall applies only to a *new top-level member* added on the TS side without a declared Rust field. Two hard facts for the plan:
- The TS closed parser is where in-slice content is enforced: `LAUNCH_KEYS` (`physicsPaintLaunchContext.ts:15`, verbatim: `['operationId', 'layerId', 'project', 'startFrame', 'layerName', 'workflowLabel', 'width', 'height', 'fps', 'document', 'rotoPlayback', 'audioPreview', 'documentAudio']`) and `DOCUMENT_AUDIO_KEYS` (:18, verbatim: `['revision', 'clipId', 'assetUrl']`) — an unknown member makes the whole parse return `null`, it does not silently drop.
- **Open question #1** below: CONTEXT says the struct "grows to carry the clip list" while transport reshaping is deferred. Resolution consistent with both: `audios[]` rides the existing `document` carrier (opaque), the Rust **round-trip test pins it**, and `documentAudio` stays `{revision, clipId, assetUrl}` until the follow-up.

**Existing Rust test convention — the concrete target:**
- Tests live inline: `#[cfg(test)] mod tests` in `app/src-tauri/src/lib.rs` (starts :979), fixture `fn roto_launch_context()` (:983-1002, includes `document_audio: None`).
- **The test to extend/append beside:** `physics_paint_launch_context_round_trips_the_document_audio_section` (:1036-1056) — pattern: build context → `serde_json::to_value` → assert member present in JSON → `serde_json::from_value` → assert each field survived. Its comment documents the exact bug this quick's hard gate exists for.
- Run: `cd /Users/lmarques/Dev/efx-motion-editor/app/src-tauri && cargo test` (repo convention: 260913-05k-PLAN.md — "Rust via `cd app/src-tauri && cargo test`"); targeted: `cargo test physics_paint_launch_context`. New test name suggestion: `physics_paint_launch_context_round_trips_the_audios_list`, carrying `document: {"audios": [clipA{id,sourceId,…}, clipB{id, sourceId: SAME, …}]}` and asserting EVERY member of both clips survives (hard-gate wording from CONTEXT).
- **TS mirror test exists:** `physicsPaintLaunchContext.test.ts` describe `'documentAudio closed launch section (52.5-01a, Q1, T-52.5-08)'` (:128-155) — accepts/rejects-extra-key/absent legs. Extend with an `audios[]`-in-document leg if the TS parser changes.
- Environment: `cargo 1.93.1` available at `/Users/lmarques/.cargo/bin/cargo` [VERIFIED: probe this session].

## Front 3 — Preact/modal + timeline re-render cost

**What exists today (all read this session):**
- **Selection is NOT a signal.** `applySoundSelected(selected)` toggles `'is-selected'` on three element refs (`PhysicsPaintWorkflowStrip.tsx:2864-2867`); deselect is the ruler's onPointerDown calling `applySoundSelected(false)` (:4641-4646). Imperative class toggling cannot know *which* of N clips is selected — the concept's `selectedSoundId` signal must be introduced. Home/precedent: Studio-owned `useSignal<string | null>(null)` passed as prop — exact analog `selectedBackgroundClipId` (`PhysicsPaintStudio.tsx:424`, consumed by `PhysicsPaintBackgroundClipSection.tsx:120`). Setting it in the click handler satisfies the "never useEffect for selection" law.
- **Peaks need zero re-decode work.** Cache is source-keyed (`audioPeaksCache.get(clip.sourceId)`), revision signal `peaksCacheRevision` is already subscribed by the strip (:1846) and `frameMap`. Import and reopen paths decode once per source; `ensureDocumentSoundPeaks` short-circuits concurrent duplicates via `inFlight: Set<string>` keyed sourceId (`documentSoundPeaks.ts:18, 30-32`). Selection/render changes never touch decode.
- **Re-render scoping (the cheap N-clip pattern):** the strip is one giant component that reads `efxPaintVersion` (via the `resolveDocumentSound` prop) and `peaksCacheRevision` in its render body — it already re-renders on doc edits/peaks bumps, and that's fine (rare, meaningful). What must NOT happen: the strip body reading `selectedSoundId.value` (a selection click would re-render rails/rows/loop-resolution). Do this instead:
  1. Extract a `SoundClipBand` (name at discretion) child: `props: clip, selected (bool via its OWN signal read), geometry, handlers`. Key: `key={clip.id}`. Every clip child reads `selectedSoundId.value === clip.id` in its own render → on selection change only the N cheap clip children (+ modal rows) re-render; strip body doesn't read the signal, doesn't re-render. This is the `efx-preact-reactivity` "narrow signal read" rule applied for render-cost, not just correctness.
  2. Modal list rows: same — `key={clip.id}`, row reads `selectedSoundId.value` itself; the editor below reads only the selected clip's fields (`audios.find(id)`); `efxPaintVersion.value` read in the controller (:202) already re-renders the modal on store writes — N rows re-rendering on a field commit is trivially cheap.
  3. Mid-drag: keep the existing DOM-imperative preview (`applySoundBandPreview`, style writes, settle-on-release) scoped inside `SoundClipBand` via its own ref — no store writes mid-drag (drag law).
- **Reveal scroll:** the 260922-qad analog is `PhysicsPaintWorkflowStrip.tsx:3614-3640` — BUT its guard `timelineOpenPositionedRef` flips **once per mount** ("nothing else in the strip writes it, no re-arm exists"), so it cannot serve row-click reveal directly. Ride the MATH, not the guard: `target = frame * ROTO_CELL_WIDTH_PX + ROTO_CELL_WIDTH_PX / 2 - scroller.clientWidth / 2`, clamp to `[0, scrollWidth - clientWidth]`, then `updateScrollbar()`. Recommended mechanism (discretion): a `revealRequest` signal `{ frame, nonce }` set in the row-click handler, consumed by a strip effect keyed on `nonce` (re-armable, terminates on consumption) — handler-set signal + one-shot effect consumption is the established idiom; never snap the viewport back afterward (qad law: manual scrolling is never overridden).
- **Band deselect vs scrub:** ruler onPointerDown already runs deselect-then-`rulerScrub.onPointerDown` (:4641-4646) — the multi-clip version only swaps the first call to `selectedSoundId.value = null`. The scrub session (`usePhysicsPaintRulerScrub`, 4px arm) is untouched; clip presses keep `stopPropagation` (:2962) so the scrub never sees them.

## Front 4 — Alt+drag duplication gotchas

**Where the drag lives:** all in `PhysicsPaintWorkflowStrip.tsx` — `startSoundBandGesture` (:2869-2900, window listeners, rAF not used here), move (:2902-2933), up (:2934-2948, settle via `props.onDocumentSoundSettle(session.next)`), cancel (:2950-2957), stain pointer-down (:2958-2967), trim pointer-down (:2968-2979). Gesture identity is fixed at pointer-down (session.kind, arm thresholds `SOUND_STAIN_ARM_PX`/`SOUND_TRIM_ARM_PX` at :2907) — the alt branch must be decided THERE, not mid-move.

**Gate analysis:**
- Current stain guard (:2959): `if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;` — **`altKey` is not excluded**, so today alt+drag silently repositions the original. The duplicate branch: when `event.altKey` (and none of meta/ctrl/shift — keep the existing exclusions first so cmd+alt+drag does NOT duplicate), set `session.kind = 'duplicate'` (or a `duplicate: boolean` on the session) and stamp `clipId`.
- **Trim handles:** `handleSoundTrimZonePointerDown` (:2968) doesn't check alt — alt+trim would duplicate while trimming if left unaddressed. Recommended truth-table row: alt+drag on a **stain body** duplicates; trim handles always trim (alt ignored there). Decide explicitly in the plan (Claude's discretion).
- **Single-rail drag routing split:** no collision — the split gates rail pointer-downs in the **rows region** on `railSetMoveMembers` membership (:1897-1919, `railSetMoveMemberKeyRailIds`/`railSetMoveMemberLoopIds`), while the sound stain lives in the **ruler** and `stopPropagation()`s (:2962) before any ancestor sees the press. The alt branch must simply preserve that `stopPropagation` (and the ruler's deselect must not fire on a clip press — it already can't, the press never reaches it).
- **Settle contract:** `SoundBandGesturePatch`/`onDocumentSoundSettle` (:515) carries only geometry — extend with `clipId` (needed anyway for multi-clip move/trim) and give the settle port a *duplicate* intent (e.g. `{ clipId, kind: 'move' | 'duplicate', next }`), or route duplicate commit through a dedicated Studio handler. Duplicate commit = append `{ ...originClip, id: crypto.randomUUID(), startFrame: next.startFrame }` to `audios[]`, original untouched. Whether the dragged ghost previews the *duplicate* (recommended: preview = final duplicate geometry; original stays put — simplest under settle-on-release) is discretion; document it in the truth table.
- **No existing duplicate helper for sound clips.** Nearest analogs: `buildFreshSoundClip`/`buildReplacedSoundClip` (`physicsPaintAudioController.ts:145-189`) — add `export function buildDuplicatedSoundClip(clip): DocumentSoundClip` = `{ ...clip, id: crypto.randomUUID() }` beside them (same file, unit-testable, shares sourceId/relativePath verbatim → no bytes, no gallery, no `audio/` path). Roto precedent for the append law: `Object.freeze([...document.loopClips, ...duplicatedLoopClips])` (`physicsPaintRotoRailSetCopy.ts:829`).
- **Peaks:** duplicate shares `sourceId` → `audioPeaksCache.get(sourceId)` hits immediately; never clip-key the cache (already source-keyed). The Studio ensure-effect's in-flight guard becomes a Set (Front 3) or duplicate ensure could clobber/loop.

## Runtime State Inventory (refactor — 5 categories)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `.mce` packages on disk: `layers/<layerId>.json` documents possibly carrying `sound: {...}` | **None** — clean-break law: once `DOCUMENT_KEYS` swaps to `audios`, a doc carrying `sound` throws unknown-member and the project is rebuilt fresh (CONTEXT locked). No migration code, ever. Docs that never had a sound member parse unchanged (member was optional). |
| Live service config | None — local desktop app, no services | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | Test fixtures in `.test.ts` files carrying `sound` member | Code edit — rebuild fixtures in the same change as #2 (they are tests, not persisted state). |

Nothing found in OS/secrets/categories above — verified by grep over `app/src` and `app/src-tauri` this session.

## Common Pitfalls

1. **Rust silent-drop on a new top-level member.** Any launch member declared TS-side but not in the Rust struct vanishes on the native path (documented at `lib.rs:109-113`). Avoid: `audios[]` rides the already-declared `document` `Value`; pin with the hard-gate round-trip test regardless.
2. **`DOCUMENT_KEYS` and its throw message drift.** Swap `sound`→`audios` in set AND message together (52.5 Pitfall 5); parser tests assert both the round-trip and the unknown-member throw text.
3. **Gesture/settle without clip identity.** Session `origin` is bare geometry today — patching after the model swap can hit the wrong clip or `no-document`. Fix: `clipId` on session + patch, decided at pointer-down.
4. **Strip body reading `selectedSoundId`.** Whole-timeline re-render per selection click. Fix: per-clip child component owns the signal read (Front 3).
5. **`sourceId`-as-unique assumptions.** Grep `sourceId ===` / `.find(...sourceId)` at execution: gallery re-register (projectStore:738 `.some`) is safe (dedupe), but any lookup picking "the" clip by sourceId is now ambiguous — selection/transport keys are `id`.
6. **Peaks-ensure single in-flight ref.** `soundPeaksEnsureRef: string | null` (Studio:4777) covers one source per effect run — loop distinct sourceIds with a Set; shared-source duplicates must ensure exactly once.
7. **Buffer-vs-peaks keying quirk.** `ensureDocumentSoundPeaks` decodes under `sound.id` (:39) but early-returns on source-keyed peaks (:30) — a duplicate clip's `id`-keyed buffer never lands in the main engine. Playback/export lookup buffers by `id` → that is exactly why playback-mix/export retargeting is the follow-up; do NOT let this quick claim multi-clip playback.
8. **Two-ways-in collapse.** `onOpenDocumentSound` has no target — wire a target param (`'list'` vs `clipId`) or double-click and launcher become indistinguishable (CONTEXT table).
9. **Save token/fingerprint forget.** If `encodeCanonicalSound` list term misses the save change-token (`efxPaintPersistence.ts:1135`), a clip-only edit dedupes as no-op save and is dropped on reopen (52.5 documented this exact failure).

## Code Examples (load-bearing snippets)

### Store list-setter shape (adapt the singleton door)
```ts
// Source: app/src/stores/efxPaintStore.ts:1356-1365 (read this session)
export function setDocumentSound(layerId, sound) {
  const document = getDocument(layerId);
  if (!document) return { ok: false, reason: 'no-document' };
  if (sound !== null && !_isValidSoundClip(sound)) return { ok: false, reason: 'invalid-sound' };
  if (_sameSound(document.sound, sound)) return { ok: true };
  const next = { ...document, sound: sound === null ? null : { ...sound } };
  _documents.set(layerId, next);
  _notifyChange();
}
// → setDocumentAudios / patchDocumentSound(id, …): same laws, compare the list, validate every entry.
```

### Duplicate builder (new, beside the existing two)
```ts
// Source pattern: physicsPaintAudioController.ts:145-189 (read this session)
export function buildDuplicatedSoundClip(clip: DocumentSoundClip): DocumentSoundClip {
  return { ...clip, id: crypto.randomUUID() }; // same sourceId — one file, several uses
}
```

### Rust round-trip test pattern to extend
```rust
// Source: app/src-tauri/src/lib.rs:1036-1056 (read this session)
let mut context = roto_launch_context();
context.document_audio = Some(serde_json::json!({ "revision": 7, "clipId": "clip-1", ... }));
let json = serde_json::to_value(&context).unwrap();
let deserialized: PhysicsPaintLaunchContext = serde_json::from_value(json).unwrap();
// hard-gate variant: document carries {"audios":[clipA, clipB]} — assert EVERY member survives
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `audios[]` rides the existing opaque `document` launch member (no new Rust field), and the hard-gate test pins it there rather than reshaping `documentAudio` now | Front 2 | If the planner instead reshapes `documentAudio` to `clips[]` in this quick, it collides with the CONTEXT out-of-scope list; resolve at plan time (Open Question 1) |
| A2 | Main-window timeline (`frameMap` `soundClip` → `drawPhysicPaintSoundStain`) may take a minimal compile-safe behavior in this quick (e.g. loop all clips or first-clip) rather than full multi-clip retarget | Front 1 #11 | If the user expects main-timeline multi-clip stain in-core, scope grows; flag in plan |
| A3 | Multi-clip *playback* (Studio monitor, preparedTrackIds, export retarget) stays follow-up even though model swaps now — this quick ships draw/edit/save + one transportable clip | Front 1 #16-17, Pitfall 7 | If UAT expects to HEAR overlapping clips in this quick, the follow-up must be pulled in |
| A4 | `selectedSignal` per-clip-child extraction is affordable — the strip's per-clip geometry (path math ~:1846-1872) is cheap for small N | Front 3 | Many clips with long waveforms could still make selection re-render of N children noticeable; mitigate with `useMemo` on clip fields inside the child |

*(All other claims in this research are `[VERIFIED]` — files Read this session; citations with line ranges beside each claim.)*

## Open Questions

1. **Where does the clip list ride the launch context?** — Known: `document` and `documentAudio` are both opaque `Value`; CONTEXT says "the struct grows to carry the clip list" but also defers transport reshaping. Recommendation: pin `audios[]` inside the `document` carrier with the hard-gate Rust test; leave `documentAudio` singleton until the follow-up. Confirm at plan time.
2. **Main-window timeline stain with N clips (Front 1 #11)** — loop `soundClips` through `TimelineRenderer`, or explicitly defer with first-clip behavior? Recommendation: small loop (the renderer math is already per-clip-geometry), else state the limitation in the plan.
3. **Alt+trim behavior** — duplicate on stain only, trim ignores alt (recommended), or also split on alt? Lock in the gesture truth table.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build/test | ✓ | v24.15.0 | — |
| pnpm | monorepo scripts | ✓ | 10.27.0 | — |
| vitest (via `pnpm --filter efx-motion-editor exec vitest run`) | TS validation | ✓ | project-managed | — |
| cargo | Rust round-trip gate test | ✓ | 1.93.1 | — |
| Search providers (external docs) | none needed | ✗ (all off) | — | all sources in-repo |

**Missing dependencies with no fallback:** none. The user runs the app server — never start it; live UAT is the user's.

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` → section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-managed) + Rust `cargo test` |
| Config file | existing app test setup — no one-off configs |
| Quick run (TS) | `pnpm --filter efx-motion-editor exec vitest run <path>` |
| Full suite (TS) | `pnpm --filter efx-motion-editor exec vitest run` |
| Rust gate | `cd app/src-tauri && cargo test physics_paint_launch_context` |
| Collection rule | **only `*.test.ts`** — a `.test.tsx` target exits 0 while running nothing |

### Phase Items → Test Map
| Item | Behavior | Test Type | Command | File Exists? |
|------|----------|-----------|---------|--------------|
| Model | `audios[]` round-trip; `SOUND_KEYS` unknown member throws; `AUDIO_LIST_KEYS` container throws | unit | `vitest run efx-paint/document/efxPaintDocumentParsers.test.ts` | ✅ extend |
| Model | fingerprint/save-token rotates on list edit; doc revision unchanged | unit | `vitest run efxPaintDocumentRevision.test.ts` | ✅ extend |
| Rust gate | full `audios[]` survives serde round-trip (HARD GATE) | rust | `cargo test physics_paint_launch_context` | ✅ extend `lib.rs:1036` |
| Launch TS | `audios`-carrying document parses; extra key rejected | unit | `vitest run bridge/physicsPaintLaunchContext.test.ts` | ✅ extend |
| Gates | `resolveDocumentSoundClip` by clipId in list; `collectDocumentSoundClips` returns N per layer | unit | `vitest run documentSoundGates.test.ts` | ✅ extend |
| Alt+drag | `buildDuplicatedSoundClip` fresh id + shared sourceId; append law | unit | new/extended `.test.ts` | ❌ Wave 0 |
| Selection/reveal | click selects (handler-set signal); reveal scrolls once, manual scroll not overridden | component | extend `PhysicsPaintWorkflowStrip.viewport.test.ts` | ✅ harness |
| Gesture truth table | click≠scrub, alt-stain=duplicate, alt-trim=trim, band-press=deselect | unit + native UAT | vitest + user live | partial |

**Sampling:** per task commit = targeted vitest/cargo; phase gate = full vitest suite + cargo test green + native UAT rows (live evidence is the oracle).

**Wave 0 gaps:** duplicate-builder test; selection/reveal legs in the viewport harness; parser `audios` fixture rebuild.

## Security Domain

`security_enforcement` absent → enabled. Local single-user app: V2/V3/V4/V6 = no. **V5 Input Validation = yes.**

| Threat | STRIDE | Standard control (existing — extend, don't reinvent) |
|--------|--------|------------------------------------------------------|
| Malformed `audios[]` document payload | Tampering | fail-closed `DOCUMENT_KEYS` + `AUDIO_LIST_KEYS` + per-entry `SOUND_KEYS` `hasOnlyKeys`; store-side `_isValidSoundClip` per entry |
| Malformed launch payload | Tampering | TS `LAUNCH_KEYS`/`DOCUMENT_AUDIO_KEYS` closed parse (`null` on extra key) + Rust opaque `Value`; round-trip gate test |
| Path traversal via N `relativePath`s | Tampering | `isSafeAudioRelativePath` + `audio/` prefix on EVERY entry: persistence :551/:1392, export :338, peaks :34 |
| Missing/corrupt media | DoS | per-source ensure warn-and-skip; no stain + modal error copy (existing CMP-05 contract) |

## Sources

### Primary (HIGH confidence — all Read this session)
- `.planning/quick/261008-ig1-…/261008-ig1-CONTEXT.md` — full read (locked decisions)
- `.planning/phases/52.5-…/52.5-MULTI-AUDIO-CONCEPT.md` — full read (design authority)
- `.planning/phases/52.5-…/52.5-RESEARCH.md`, `52.5-PATTERNS.md` — full read (cited, not re-researched)
- In-repo reads: `efxPaintDocument.ts`, `efxPaintDocumentParsers.ts`, `efxPaintStore.ts:1290-1365`, `physicsPaintAudioController.ts` (full), `PhysicsPaintWorkflowStrip.tsx` (:495-583, :1840-1979, :2900-3079, :3614-3640, :4630-4759), `PhysicsPaintStudio.tsx:4760-4939`, `documentSoundGates.ts:30-194`, `documentSoundPeaks.ts` (full), `efxPaintDocumentAudioStore.ts:1-80`, `efxPaintAudioMonitor.ts:120-240`, `physicPaintBridge.ts:3880-4029`, `physicsPaintLaunchContext.ts:1-40`, `app/src-tauri/src/lib.rs:60-139, 960-1079`, `efxPaintAudioModalView.tsx` (structure), `frameMap.ts:320-400` (via sed — line claims cross-checked), `.planning/config.json` (nyquist), `.planning/STATE.md` (partial)

### Secondary (MEDIUM)
- Repo convention citations for `cargo test` from `.planning/quick/260913-05k-…/260913-05k-PLAN.md:97,123` (cross-checked with cargo probe this session)

### Tertiary (LOW)
- none — no web research; all sources in-repo

## Metadata

**Confidence breakdown:**
- Refactor surface (Front 1): HIGH — every site located with file:line this session
- Rust gate/test (Front 2): HIGH — struct, test, and run convention read/probed
- Re-render strategy (Front 3): HIGH for existing-state facts; the child-component extraction is a recommendation (A4)
- Alt+drag (Front 4): HIGH for existing gesture code; duplicate commit mechanics are recommendations under Claude's discretion

**Research date:** 2026-10-08
**Valid until:** 30 days (stable in-repo domain)
