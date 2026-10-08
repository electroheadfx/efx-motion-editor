---
phase: quick-261008-ig1
verified: 2026-10-08T16:41:05Z
status: human_needed
score: 8/8 must-haves verified
covered_files:
  - ".planning/quick/261008-ig1-multi-audio-concept-written-to-planning-/261008-ig1-PLAN.md"
  - ".planning/quick/261008-ig1-multi-audio-concept-written-to-planning-/261008-ig1-SUMMARY.md"
  - app/src-tauri/src/lib.rs
  - app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
  - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
  - app/src/components/physic-paint/view/physicsPaintAudioController.ts
  - app/src/components/physic-paint/view/soundBandGeometry.ts
  - app/src/components/timeline/TimelineRenderer.ts
  - app/src/efx-paint/document/efxPaintDocument.ts
  - app/src/efx-paint/document/efxPaintDocumentParsers.ts
  - app/src/efx-paint/document/efxPaintDocumentRevision.ts
  - app/src/lib/documentSoundGates.ts
  - app/src/lib/documentSoundPeaks.ts
  - app/src/lib/efxPaintPersistence.ts
  - app/src/lib/frameMap.ts
  - app/src/lib/physicPaintBridge.ts
  - app/src/stores/efxPaintStore.ts
  - app/src/stores/projectStore.ts
  - app/src/types/timeline.ts
covered_digest: "v3:sha256:553390308b1b94ba38840142c392617ee8582d12b15d228e4342f72a6e519b5f"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Row 1 — Import adds: import two sounds into one Studio document"
    expected: "Modal list shows 2 rows with distinct in..out; the second import did NOT replace the first"
    why_human: "Native Studio interaction — project forbids agent-driven browser/native UAT"
  - test: "Row 2 — Per-clip settings: select clip B, change Volume/fades/In/Out, then close/reopen Studio"
    expected: "Clip A's values unchanged; after reopen both clips and their settings are intact (document JSON round-trip)"
    why_human: "Live save/reopen round-trip on the native app is the oracle; automated persistence tests cannot exercise the user's project flow"
  - test: "Row 3 — List + reveal: click each list row in the Document sounds modal"
    expected: "Clicked row gets the selected marker AND the timeline scrolls to reveal that clip; clicking the other row moves the reveal"
    why_human: "Viewport scroll behavior (qad law) must be observed live"
  - test: "Row 4 — Two ways in: timeline double-click a clip; then the Document sound header launcher (also with a single clip)"
    expected: "Dblclick opens the modal on THAT clip's editor; header launcher lands on the list chooser; with a single clip both land on the one clip"
    why_human: "Entry-point landing behavior is a live UI flow"
  - test: "Row 5 — Timeline multi-clip: two (incl. overlapping) clips in the Studio strip"
    expected: "Each renders stain + trims + overlay; clicking a clip selects without moving the playhead; clicking the band outside deselects; exactly one stain highlighted"
    why_human: "Visual/interaction surface — needs live observation"
  - test: "Row 6 — Alt+drag: bare alt+drag a stain body (also alt+trim a handle)"
    expected: "A second clip appears at the dragged position, original unmoved; gallery shows ONE audio file; both draw their waveform; alt+trim only trims"
    why_human: "Gesture + visual result on the native timeline; gallery count is a live surface"
  - test: "Row 7 — Main window: two or more clips in the main timeline"
    expected: "One stain per clip"
    why_human: "Main-window rendering observed live"
---

# Quick 261008-ig1: Multi-audio Concept Core Slice — Verification Report

**Task Goal:** Implement the 52.5 multi-audio concept (core slice) — `audios: readonly DocumentSoundClip[]` replacing the singleton `sound`, per-clip settings, modal list with click-to-reveal, timeline multi-clip render, alt+drag duplication, and a hard-gated Rust launch-context round-trip test.
**Verified:** 2026-10-08T16:41:05Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `audios[]` replaces singleton `sound`; singular member rejected by closed parser | ✓ VERIFIED | `efxPaintDocument.ts` model; `efxPaintDocumentParsers.ts:63` DOCUMENT_KEYS (no `sound`), `parseDocumentAudios` (:523) throws on non-array, per-entry `parseDocumentSound` (:453) closed on SOUND_KEYS; test `rejects the retired singular sound member` (parsers.test.ts:506); suite green |
| 2 | Two identities never overloaded: `id` unique per placed clip, `sourceId` shared / not unique | ✓ VERIFIED | Keying spot-check: peaks `audioPeaksCache.get(clip.sourceId)` (frameMap.ts:366, documentSoundPeaks.ts:33); buffers `audioEngine.getBuffer(sound.id)` (documentSoundPeaks.ts:34); gallery dedupe `asset.id === sound.sourceId` (projectStore.ts:733); resolve by `clip.id` (documentSoundGates.ts:50); store doors fail-closed by id (efxPaintStore.ts:1388-1407); selection `soundSelection.value = clip.id` (strip pointer-down) |
| 3 | Studio timeline: one stain+trims+overlay per clip; select without scrub; band deselect; exactly one is-selected read narrowly | ✓ VERIFIED | Strip renders `documentAudios.map(...)` (PhysicsPaintWorkflowStrip.tsx:4946, 4977) into hook-free children whose only selection read is `selectedSoundId.value === clip.id` (:1664, :1723); strip body never reads it (source-contract pin, viewport.test.ts:1258); pointer-down selects + `stopPropagation` (:3206-3217); band deselect `soundSelection.value = null` (:4935); viewport suite green |
| 4 | Modal = list + per-selection editor; Import appends; Replace swaps selected source preserving position/in-out; edits touch only selected clip; row click selects + reveals | ✓ VERIFIED | PhysicsPaintAudioModalView.tsx:281-308 list rows `key={clip.id}` with selected marker + `onSelectSoundClip`; editor gated `sound !== null` (:309); controller `applyImportedSource` always appends via `buildFreshSoundClip` (:384-396), `applyReplacedSource` via `buildReplacedSoundClip` (:397-…); `patchSound`/`removeSound` route by clipId; Studio `onSelectSoundClip` sets selection + `revealSoundClip` (:4797-4805); modal/controller suites green |
| 5 | Two ways in land differently: dblclick → that clip's editor; header launcher → list chooser; single clip → both land on it | ✓ VERIFIED | Strip dblclick → `onDocumentSoundDblClick(clip.id)` (:3225) → Studio `selectedSoundId = clipId; audioModalTarget = clipId` (:5017-5020); header launcher resolves: single clip → selects it, stale selection → cleared, valid selection kept, then `audioModalTarget = 'list'` (:5005-5016); modal renders editor only when a clip is selected — so 2+ clips with no selection = list chooser; live feel deferred to UAT row 4 |
| 6 | Alt+drag: fresh id, same sourceId, original untouched, peaks source-keyed (one decode), no second bytes/gallery/audio path | ✓ VERIFIED | `buildDuplicatedSoundClip` = `{ ...clip, id: crypto.randomUUID() }` (physicsPaintAudioController.ts:230-232); pointer-down: meta/ctrl/shift exclusions FIRST, bare alt stamps `kind:'duplicate'` + clipId, identity never re-decided (strip :3206-3224); trim has no alt branch (:3231-…); settle routes `duplicate` → `buildDuplicatedSoundClip` + `addDocumentSound`, selection → fresh id (Studio :4877-4900); original never mutated (spread copy, patch path separate); peaks ensure loops `new Set(audios.map(c => c.sourceId))` (Studio peaks effect) and `ensureDocumentSoundPeaks` skips peaks when `peaksReady` (documentSoundPeaks.ts:31-44); gallery `.some(asset.id === sound.sourceId)` keeps one row; truth-table suite green (viewport.test.ts:1346-1531) |
| 7 | D-04 HARD GATE: Rust round-trip deep-asserts every member of a multi-clip list | ✓ VERIFIED | `physics_paint_launch_context_round_trips_the_audios_list` (lib.rs:1059-1141): two shared-source clips with all 13 SOUND_KEYS members; after `to_value → from_value` asserts list length, per-member `as_str()`/`is_number()`/`is_string()`/`is_boolean()` for EVERY member of BOTH clips, exact values for startFrame/gain/fadeOutCurve/enabled on both, distinct ids, shared sourceId. A dropped member → `Value::Null` → `is_number()` false / `as_str().unwrap()` panic / `expect("audios list survives deserialize")` — the test FAILS on any member drop. Ran green this session (4 passed including this test) |
| 8 | Document-JSON save/reopen round-trips audios[]; clip-only edit rotates fingerprint AND save token | ✓ VERIFIED | `encodeCanonicalAudios` (efxPaintDocumentRevision.ts:204) feeds sync fingerprint `…\|audios:…` (:261) AND save change token (efxPaintPersistence.ts:537); per-entry `isSafeAudioRelativePath` guards at both persistence sites (:553, :1396); `.mce` package-reference expansion absent from diff (grep clean); revision/persistence suites green |

**Score:** 8/8 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/efx-paint/document/efxPaintDocument.ts` | list model | ✓ VERIFIED | `audios` member; factory `[]`; wired through every consumer |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` | three-level closed parse | ✓ VERIFIED | DOCUMENT_KEYS + AUDIO_LIST_KEYS (:68) + SOUND_KEYS (:94); unknown members throw at all three levels; singular `sound` rejected via DOCUMENT_KEYS |
| `app/src/stores/efxPaintStore.ts` | list door | ✓ VERIFIED | `setDocumentAudios` (:1362), `addDocumentSound` (:1377), `patchDocumentSound`/`removeDocumentSound` fail closed `unknown-clip` (:1396, :1406); imported and used by Studio/controller |
| `app/src-tauri/src/lib.rs` | D-04 gate | ✓ VERIFIED | Test at :1059; deep-asserts both clips; green |
| `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` | per-clip children + gestures | ✓ VERIFIED | Per-clip stain/edges children, clipId+kind sessions, alt branch, narrow-read law; used by Studio |
| `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx` | list + per-selection editor | ✓ VERIFIED | List rows, selected marker, editor gated on selection; header `Document sounds`; wired via `audioModal` port |
| `app/src/components/physic-paint/view/physicsPaintAudioController.ts` | selection-scoped controller + builders | ✓ VERIFIED | `buildFreshSoundClip`/`buildReplacedSoundClip`/`buildDuplicatedSoundClip`; HIGH-01 fix: `removeArmedClipId` stamp + fail-closed confirm (:351-363) |
| `app/src/components/physic-paint/PhysicsPaintStudio.tsx` | selection/open-target/reveal/peaks | ✓ VERIFIED | `selectedSoundId`, `audioModalTarget` (:4669), `revealSoundClip` nonce, distinct-source Set-guarded peaks ensure, settle router |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | -- | ------ | ------- |
| closed parse → store door → encoder | fingerprint + save token | `parseDocumentAudios` → `setDocumentAudios` → `encodeCanonicalAudios` at revision:261 and persistence:537 | ✓ WIRED | Clip-only edit rotates both tokens; tests green |
| document.audios → frameMap → main renderer + Studio strip | multi-clip render | `soundClips[]` (frameMap:355, peaks by sourceId :366) → `drawPhysicPaintSoundStain` loop (TimelineRenderer:863-865); Studio `documentAudios: resolveDocumentAudios()` (:5001) → strip `documentAudios.map` (:4946, :4977) | ✓ WIRED | One stain per clip on both surfaces |
| clip.id → selectedSoundId → modal marker + strip is-selected + editor scope | one identity | modal row class `selectedSoundId.value === clip.id` (:286); child `isSelected` (:1664/:1723); editor `sound !== null` | ✓ WIRED | Single signal, three consumers |
| document carrier → PhysicsPaintLaunchContext.document → Rust round-trip | serde pin | `document: Option<Value>` (lib.rs:97-98) → test :1059 deep-assert | ✓ WIRED | Gate green |
| pointer-down clipId/kind → session → settle patch → Studio router | gesture identity | strip :3206-3224 stamp → `startSoundBandGesture` → `handleDocumentSoundGestureSettle` (Studio:4877) routes duplicate/move/trim | ✓ WIRED | Unknown id fails closed; truth-table tests green |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| frameMap soundClips | `peaks` | `audioPeaksCache.get(clip.sourceId)` | Yes — real decode pipeline (ensureDocumentSoundPeaks → readFile → decode → computeWaveformPeaks) | ✓ FLOWING |
| modal list rows | `audios` | `resolveDocumentAudios()` ← `getEfxPaintDocument().audios` | Yes — document store | ✓ FLOWING |
| documentAudio section | `audios[0]` | document | Yes — singleton by design (scope boundary) | ✓ FLOWING |
| gallery | `clip.sourceId` | document.audios | Yes — real asset registration/dedupe | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| HIGH-01 fix legs (armed-remove fail-closed) | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintAudioController.test.ts` | 18 passed (includes the two new confirmRemove legs) | ✓ PASS |
| In-scope suites (9 files, 373 tests) | run earlier this session | all green | ✓ PASS |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` (earlier this session) | clean | ✓ PASS |
| D-04 gate | `cargo test physics_paint_launch_context` (earlier this session) | 4 passed incl. `…_round_trips_the_audios_list` | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED (no probe scripts declared by this quick).

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ---------- | ------ | -------- |
| QUICK-261008-IG1 | 261008-ig1-PLAN.md frontmatter | ✓ SATISFIED | All 8 must-have truths verified above (D1-D8); D9 (live UAT) routed to human |

No orphaned requirements (QUICK-261008-IG1 not mapped elsewhere in REQUIREMENTS.md).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| efxPaintDocumentParsers.ts | 558 | Dead tripwire loop (`['audios','sound']` unreachable after DOCUMENT_KEYS check) — REVIEW LOW-01; comment claim slightly false | ℹ️ Info | None functionally: singular `sound` still throws via DOCUMENT_KEYS (test pins it) |
| PhysicsPaintStudio.tsx | — | `audioModalTarget` value write-only beyond `!== null` — REVIEW LOW-02 | ℹ️ Info | Two-ways-in differentiated via selection side effects (single-clip resolve, stale-clear, dblclick force-select); matches plan intent |
| PhysicsPaintAudioModalView.tsx | 254-331 | REVIEW MED-01: decode-error copy not rendered when list non-empty and selection null | ⚠️ Warning | Silent failure on a rare path; not a must-have; recommend follow-up |
| efxPaintStore.ts / parsers | — | REVIEW MED-02: duplicate clip `id` not enforced in fail-closed layer; `patchDocumentSound` accepts `id` in Partial | ⚠️ Warning | Judgment call; all mint sites use `crypto.randomUUID()`; recommend follow-up guard |
| — | — | Debt markers TBD/FIXME/XXX in changed files | ✓ NONE | Grep clean (PLACEHOLDER_BG_* constants pre-existing, unrelated) |

**Scope-boundary audit (D-01 OUT):** `git diff 1362a19d..7568a975` touches no `exportEngine.ts`, no `efxPaintAudioMonitor.ts`, no `.mce`/package-reference code, no `preparedTrackIds` changes, no master lane; `documentAudio` remains the closed 3-member singleton `{revision, clipId, assetUrl}` fed from `audios[0]` with the boundary comment (physicPaintBridge.ts:3904-3911). Zero new dependencies (no package.json/Cargo.toml/vitest.config changes); zero `.test.tsx` authored; 4 commits (3 task commits + 1 CR-fix commit).

**Pre-existing failure (logged, out of scope):** `PhysicsPaintStudioView.test.ts` collection failure (`_setPaintMarkDirtyCallback is not a function`, paintStore→projectStore ESM cycle). Confirmed not a regression: `paintStore.ts` untouched by the diff, zero occurrences of `setPaintMarkDirtyCallback` in the diff, no import-line changes in `projectStore.ts` — module graph identical to baseline `1362a19d` where it fails identically (deferred-items.md).

**CR HIGH-01:** FIXED and committed as `7568a975` — arm stamps `removeArmedClipId`, `confirmRemove` fails closed unless armed id === live selection, arm consumed on every confirm; 2 regression legs pass (re-run this session).

### Human Verification Required

See `human_verification` frontmatter — 7 native UAT rows (project rule: user owns live/native evidence; no agent-driven browser/native UAT; never start the server).

### Gaps Summary

None — all 8 must-haves verified against the actual code; the summary's claims match the shipped code. Status is `human_needed` solely because the user's 7 native UAT rows are the oracle for the live/visual behaviors (plan D9: automated-ready ≠ done).

---

_Verified: 2026-10-08T16:41:05Z_
_Verifier: Claude (gsd-verifier)_
