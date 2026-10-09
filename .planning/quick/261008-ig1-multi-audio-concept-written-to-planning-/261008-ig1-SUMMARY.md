---
phase: quick-261008-ig1
plan: 261008-ig1
subsystem: physic-paint-audio
tags: [physic-paint, multi-audio, document-sound, audios-list, alt-drag, serde-gate, preact-signals, studio-timeline]

# Dependency graph
requires:
  - "Phase 52.5 singleton document-sound implementation (audios seam left by 52.5-01a/01b: SOUND_KEYS, resolveDocumentSoundClip clipId join, audioPeaksCache source-keyed, buildReplacedSoundClip clamp law, 260922-qad reveal math)"
provides:
  - "Document model: `audios: readonly DocumentSoundClip[]` replaces the singular `sound` (closed parse at document/container/entry level; the singular member throws unknown-member — D-05 clean break, no shim)"
  - "Two identities everywhere: clip.id = placed clip (list key, selection, transport, gesture identity); sourceId = imported file (peaks cache, gallery dedupe) — shared freely by alt+drag duplicates"
  - "Store list door setDocumentAudios + add/patch/remove by id (fail-closed on unknown id); fingerprint AND save change token rotate on clip-only edits (encodeCanonicalAudios)"
  - "Multi-clip timeline: main window frameMap soundClips[] + one stain per clip (TimelineRenderer); Studio strip one stain+trims+overlay per clip with Studio-owned selectedSoundId read ONLY inside hook-free per-clip children"
  - "Document sounds modal: list + per-selection editor (Import appends, Replace swaps the selected source preserving position/in-out, Remove/On/Off/Volume/Fades/In/Out scoped to the selected clip; row click selects + reveals)"
  - "Two ways in: timeline dblclick opens THAT clip's editor; header launcher lands on the list chooser (single clip resolves to it); alt+drag duplication (fresh id, shared sourceId, one decode)"
  - "D-04 hard gate: cargo test physics_paint_launch_context_round_trips_the_audios_list deep-asserts every member of two shared-source clips survives the Rust serde round-trip on the opaque `document` carrier"
affects: [physic-paint-studio, efx-paint-document, timeline-renderer, document-sound-transport]

# Actuals (#2632)
actuals:
  tokens: 56262
  tasks: 3
  commits: 3

commits: 3
plan_head_before: 1362a19d137280004b6acec11ca8c09f830f27af
plan_head_after: 6a9a2b1679e0432204c896b2828421d704460ca9

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed three-level parse: DOCUMENT_KEYS + AUDIO_LIST_KEYS container + per-entry SOUND_KEYS — unknown members throw at every level; one bad store entry rejects the whole write"
    - "Narrow-read per-clip children: hook-free PhysicsPaintSoundClipStain/Edges (and the Task 3 ghost) read selectedSoundId.value in their own render; the strip body only wires the signal through — a selection click re-renders the cheap children, never the strip"
    - "Gesture identity fixed at pointer-down: SoundBandGestureSession.clipId + kind stamped on press, carried through move/preview/settle — kind 'duplicate' (bare alt) previews a DOM-imperative ghost and settles to the clone-append door"
    - "Signal-in-Ref for direct-call harnesses: soundDuplicatePreviewRef holds the signal instance so it survives the plain-function render loop (project idiom when useSignal breaks a harness)"
    - "Source-keyed peaks law: audioPeaksCache.get(sourceId) serves every clip sharing a source — never clip-keyed; the Studio ensure effect dedupes distinct sourceIds behind a Set in-flight guard"

key-files:
  created: []
  modified:
    - app/src/efx-paint/document/efxPaintDocument.ts
    - app/src/efx-paint/document/efxPaintDocumentParsers.ts
    - app/src/efx-paint/document/efxPaintDocumentRevision.ts
    - app/src/stores/efxPaintStore.ts
    - app/src/lib/documentSoundGates.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/stores/projectStore.ts
    - app/src/lib/frameMap.ts
    - app/src/components/timeline/TimelineRenderer.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src-tauri/src/lib.rs
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx
    - app/src/components/physic-paint/view/physicsPaintAudioController.ts
    - app/src/components/physic-paint/view/soundBandGeometry.ts

key-decisions:
  - "D-01 core slice only: this quick ships draw/edit/save of N clips; transport/`documentAudio` channel reshaping stays a three-member singleton fed from audios[0] with the boundary comment pinned in physicPaintBridge.ts — preparedTrackIds, .mce multi-file package references, export-mixer/playback-mix retarget and master lane are the follow-up quick"
  - "D-02 two identities never overloaded: the parser/store/gates/Studio each state whether they key by clip.id (placed clip) or sourceId (imported file); resolveDocumentSoundClip joins by id against the list"
  - "D-03 alt+drag duplicates on the stain body only: bare alt (exclusions run first — cmd/alt never clones), fresh crypto.randomUUID id over verbatim sourceId/relativePath, original never mutated, trim handles ignore alt"
  - "D-04 Rust round-trip hard gate: audios[] rides the already-declared opaque `document` Value (no new top-level launch member — the silent-drop pitfall), pinned by physics_paint_launch_context_round_trips_the_audios_list deep-asserting every member of both shared-source clips"
  - "D-05 no backward compat: the singular `sound` member is rejected by the closed parser; old projects fail to parse and rebuild fresh — zero migration code anywhere"
  - "Task 3 ghost preview: PhysicsPaintSoundDuplicateGhost is a dedicated hook-free child (no handlers, no selection read, pointer-events none) so exactly one is-selected survives the drag and the original stays put; per-move positioning stays DOM-imperative through the ghost's els record (no store writes, no per-move re-render)"

requirements-completed: [QUICK-261008-IG1]

coverage:
  - id: D1
    description: "Document holds audios[]; singular sound rejected by the closed parser (entry/container/document levels throw with the updated unknown-member message)"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentParsers.test.ts#(Task 1 legs: audios round-trip, per-entry SOUND_KEYS throw, container AUDIO_LIST_KEYS throw, singular member throws, shared sourceId survives)"
        status: pass
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run (full suite: 4575 passed; only the baseline-pre-existing PhysicsPaintStudioView collection failure remains)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two identities stay distinct: clip.id unique per placed clip (selection/transport/gesture); sourceId shared (alt+drag) and keys peaks + gallery dedupe"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintAudioController.test.ts#buildDuplicatedSoundClip (261008-ig1 Task 3 — fresh id, shared source, copied settings)"
        status: pass
      - kind: unit
        ref: "app/src/lib/documentSoundGates.test.ts#(resolve by id anywhere in list; collect returns N per layer)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Studio timeline renders one stain+trims+overlay per clip; click selects without scrubbing; band press deselects; exactly one is-selected driven by selectedSoundId read only inside per-clip children"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts#PhysicsPaintWorkflowStrip multi-clip sound band (261008-ig1 Task 2) — includes the strip-body narrow-read source pin"
        status: pass
    human_judgment: false
  - id: D4
    description: "Document sounds modal is list + per-selection editor: Import appends, Replace swaps only the selected source preserving position/in-out, Remove/On/Off/Volume/Fades/In/Out touch only the selected clip; row click selects + reveals"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintAudioModalView.test.ts + physicsPaintAudioController.test.ts (selected-scoped commit legs; 261008-ful Gain/field-order pins still pass byte-for-byte)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two ways in land differently (dblclick = that clip's editor; header launcher = list chooser; single clip lands on it); clip click never scrubs; band deselect; reveal per nonce with qad law"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#(open-target legs) + PhysicsPaintWorkflowStrip.viewport.test.ts#PhysicsPaintWorkflowStrip reveal request (261008-ig1 Task 2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Alt+drag on a stain body appends a duplicate (fresh id, shared sourceId, copied geometry+settings); original untouched; one decode serves both; alt+trim trims; cmd/alt never duplicates; commit on pointer-up only"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.viewport.test.ts#PhysicsPaintWorkflowStrip alt+drag duplication (261008-ig1 Task 3) — truth table: bare-alt settle with ghost lifecycle, identity never switches mid-move, cmd+alt rejected, alt+trim trims, sub-threshold retracts ghost"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintAudioController.test.ts (builder legs: fresh id, byte-copy, no origin mutation, no id collision)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Launch context carrying the full audios[] inside the document carrier survives the Rust serde round-trip with EVERY member of every clip intact (D-04 HARD GATE)"
    requirement: QUICK-261008-IG1
    verification:
      - kind: other
        ref: "cd app/src-tauri && cargo test physics_paint_launch_context — tests::physics_paint_launch_context_round_trips_the_audios_list ... ok (4/4 gate tests green; full cargo suite 62+20+39+4+21 passed, 0 failed)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/bridge/physicsPaintLaunchContext.test.ts#(audios-in-document leg)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Document-JSON save/reopen round-trips audios[] (per-entry relativePath guards on both persistence sites; change token carries the list encoder so a clip-only edit can never dedupe as a no-op save) — .mce multi-file package-reference expansion is the deferred follow-up, untouched"
    requirement: QUICK-261008-IG1
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintDocumentRevision.test.ts#(fingerprint AND save token rotate on a clip-only edit; empty list appends the empty `audios:` term) + efxPaintPersistence tests"
        status: pass
      - kind: other
        ref: "git diff audit 1362a19d..HEAD: no package-reference mechanics, no preparedTrackIds/export-mixer/master-lane additions (scope-boundary grep clean)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Live UAT rows 1-7 (import adds, per-clip settings persist, list+reveal, two ways in, timeline multi-clip, alt+drag, main window) — the user's native evidence is the oracle"
    requirement: QUICK-261008-IG1
    verification:
      - kind: other
        ref: "PENDING — automated-ready only; native UAT owned by the user (never start the server; no Chrome DevTools MCP)"
        status: pending
    human_judgment: true

# Metrics
duration: 3h33m
completed: 2026-10-08
status: complete
---

# Quick 261008-ig1: Multi-audio Concept Core Slice — Summary

**The singleton `sound` is replaced end-to-end by `audios: readonly DocumentSoundClip[]`: fail-closed parse, list store door with id-scoped members, save/reopen round-trip, multi-clip Studio + main-window timelines, list+per-selection modal with two ways in, alt+drag duplication sharing one source-keyed decode, and the D-04 Rust serde round-trip hard gate — three atomic commits, automated-ready, native UAT rows handed to the user.**

## Performance

- **Duration:** 3h33m (two executor sessions: Tasks 1-2 by the first, Task 3 resumed by the second)
- **Started:** 2026-10-08T12:14:16Z (plan materialization commit 1362a19d)
- **Completed:** 2026-10-08T15:46:54Z
- **Tasks:** 3
- **Files modified:** 37 across the quick (Task 3: 6 files)

## Accomplishments

- **Task 1 — data plane (tracer, TDD):** `EfxPaintDocument.audios` list member; closed parse at all three levels (`DOCUMENT_KEYS` + new `AUDIO_LIST_KEYS` + per-entry `SOUND_KEYS`; the singular member throws — clean break, no shim anywhere); `encodeCanonicalAudios` feeds BOTH the sync fingerprint and the save change token; store `setDocumentAudios` validates every entry, same-value no-ops, writes a frozen list with one notify, and add/patch/remove fail closed on unknown clip id; gates/projectStore/persistence map over the list with sourceId dedupe and per-entry path guards; frameMap `soundClips[]` + `drawPhysicPaintSoundStain` loop = one main-window stain per clip; the `documentAudio` channel stays the exact three-member singleton fed from `audios[0]` with the boundary comment; **D-04 hard gate landed: `physics_paint_launch_context_round_trips_the_audios_list` deep-asserts every member of two shared-source clips survives serde round-trip** (plus the TS mirror leg)
- **Task 2 — Studio multi-clip interaction (TDD):** Studio owns `selectedSoundId` / `audioModalTarget` / `audioImportMode` / `revealRequest`; the strip renders hook-free `PhysicsPaintSoundClipStain`/`Edges` children (narrow selection reads only — the strip body never reads the signal, pinned by source contract); gesture session stamps `clipId` and settles through `patchDocumentSound` by id; nonce-keyed reveal rides the qad math (manual scrolling never snapped back); the modal became a list + per-selection editor (Import always appends, `Replace…` swaps the selected source preserving position/in-out, Remove/On/Off/Volume/Fades/In/Out touch only the selection); peaks ensure loops distinct sourceIds behind a Set in-flight guard (two clips sharing a source decode once)
- **Task 3 — alt+drag duplication (TDD, truth table first):** `buildDuplicatedSoundClip` mints a fresh id over verbatim source identity; bare alt on a stain body stamps `kind: 'duplicate'` + clipId at pointer-down (modifier exclusions run first — cmd/alt can never clone; releasing alt mid-move never re-decides); a hook-free `PhysicsPaintSoundDuplicateGhost` (no handlers, no selection read, pointer-events none) previews the dragged geometry DOM-imperatively while the original stays put; settle-on-release only; trim handles ignore alt; Studio routes the duplicate settle to the clone-append door and moves selection to the fresh id

## Task Commits

Each task was committed atomically:

1. **Task 1: audios[] model end-to-end — closed parse, list store door, save/reopen, launch serde hard gate** - `fa092b5e` (feat) — 37 files (fixtures rebuilt across app/src in the same commit, no migration code)
2. **Task 2: Studio multi-clip interaction — strip render, selectedSoundId, modal list + per-selection editor, two ways in, reveal** - `be8d6375` (feat) — 11 files
3. **Task 3: Alt+drag duplication — fresh id, shared sourceId, gesture truth table** - `6a9a2b16` (feat) — 6 files

**Plan metadata:** `1362a19d` (docs: plan, pre-committed by orchestrator)

Measured: `git rev-list --count 1362a19d..HEAD` = 3.

## Files Created/Modified

- `app/src/efx-paint/document/efxPaintDocument.ts` / `efxPaintDocumentParsers.ts` / `efxPaintDocumentRevision.ts` — list model, three-level closed parse, list encoder for fingerprint + save token
- `app/src/stores/efxPaintStore.ts` — `setDocumentAudios` + `addDocumentSound` / `patchDocumentSound` / `removeDocumentSound` (id-scoped, fail-closed)
- `app/src/lib/documentSoundGates.ts` / `efxPaintPersistence.ts` / `stores/projectStore.ts` — resolve/collect off the list; per-entry path guards + list change token; gallery re-register + reopen peaks per clip (sourceId dedupe kept)
- `app/src/lib/frameMap.ts` / `app/src/components/timeline/TimelineRenderer.ts` — `soundClips[]` layout + one stain per clip in the main window
- `app/src/lib/physicPaintBridge.ts` — soundChanged compares the list; `documentAudio` section boundary comment (three members, fed from `audios[0]`)
- `app/src-tauri/src/lib.rs` — D-04 gate test beside the documentAudio round-trip pattern
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — selection/open-target/reveal/import-mode signals, distinct-source Set-guarded peaks ensure, gesture-settle router (move/trim patch vs duplicate append)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — per-clip children, clipId+kind gesture sessions, reveal effect, duplicate ghost + alt branch
- `app/src/components/physic-paint/view/PhysicsPaintAudioModalView.tsx` — 'Document sounds' list + per-selection editor (261008-ful stepper pins preserved)
- `app/src/components/physic-paint/view/physicsPaintAudioController.ts` — selection-scoped controller + `buildFreshSoundClip` / `buildReplacedSoundClip` / `buildDuplicatedSoundClip`
- `app/src/components/physic-paint/view/soundBandGeometry.ts` — `SoundBandGestureKind` + patch `kind` field (see Deviations)
- Tests extended: parsers/revision/store/gates/launch-context/modal/controller/Studio/strip-viewport `.test.ts` files (collection rule honored — zero `.test.tsx` authored)

## Decisions Made

- `audios[]` rides the existing opaque `document` launch carrier — no new top-level member, so the Rust silent-drop pitfall cannot apply; the hard-gate test pins it anyway (Assumption A1)
- Main-window stain loops ALL clips (research open question #2 resolved the plan's way): the renderer math was already per-clip-geometry
- Duplicate preview is a dedicated ghost child rather than reusing the stain child: the ghost must never read selection (exactly-one `is-selected` law) and must not appear in `soundStains()` counts
- `soundDuplicatePreview` is held via `useRef<Signal>` — the plain-function test harness's `useSignal` mock mints a fresh signal per render (project idiom: signal in useRef when useSignal breaks a harness)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `soundBandGeometry.ts` edited outside the plan's files list**
- **Found during:** Tasks 2 (prior session, already documented in commit be8d6375) and 3
- **Issue:** `SoundBandGesturePatch` (the settle-patch type) lives in `soundBandGeometry.ts`, which the plan's Task 2/3 `<files>` lists omit — extending the patch with `clipId` (Task 2) and `kind` (Task 3) cannot happen without touching it
- **Fix:** extended the patch in place (Task 3: added exported `SoundBandGestureKind` + required `kind` field); Studio routes `'duplicate'` to the clone-append door while move/trim keep the Task 2 routing string the Studio source pin expects
- **Files modified:** app/src/components/physic-paint/view/soundBandGeometry.ts
- **Commits:** be8d6375 (Task 2), 6a9a2b16 (Task 3)

**2. [Rule 3 - Migration] `setDocumentSoundSlot` shim existed between Tasks 1 and 2**
- **Found during:** Task 1 (prior session — documented in commit fa092b5e)
- **Issue:** removing `setDocumentSound` broke the still-singleton controller/Studio mid-plan (Task 1 files list does not include the modal/controller retarget)
- **Fix:** Task 1 kept a slot-shaped adapter so the suite stayed green at its commit boundary; **Task 2 deleted the shim entirely** — the final diff contains no compat layer (D-05 honored: zero migration code ships)

**Total deviations:** 2 auto-fixed (both Rule 3 task-boundary mechanics; the final three-commit diff honors every locked decision)
**Impact on plan:** no scope creep — both deviations stay inside the plan's own file set in the end (Task 2/3 legitimately retarget the controller/modal; soundBandGeometry.ts is a Task 2/3 sibling seam)

## Issues Encountered

- **Pre-existing test failure (out of scope, NOT fixed):** full suite `PhysicsPaintStudioView.test.ts` fails identically at baseline (`_setPaintMarkDirtyCallback is not a function` — paintStore→projectStore ESM init cycle). Baseline proven by the prior executor in a detached worktree at `1362a19d` (recorded in `deferred-items.md`). No NEW failures: this quick's final suite run = 241 files passed / 1 failed (that baseline file) / 2 skipped, 4575 tests passed
- **Full cargo suite green:** 62 + 20 + 39 + 4 + 21 tests passed, 0 failed — the D-04 gate included

## Deferred Issues

See `.planning/quick/261008-ig1-multi-audio-concept-written-to-planning-/deferred-items.md` (the pre-existing StudioView collection failure + suggested late-bind follow-up).

## Known Stubs

None — no placeholder values, TODO stubs, or unwired components in this quick's diff.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond the audited `audios[]` document member (its threat register T-261008-IG1-01..05 mitigations are all pinned by the tests listed in coverage; T-06 accepted per plan).

## User Setup Required

None - the user runs the server/app themselves.

## Automated-Ready — Native UAT Rows Handed to the User

Nothing is claimed done until the user's live rows pass (live evidence over unit probes).

| # | Row | Pass condition |
|---|-----|----------------|
| 1 | Import adds | Import two sounds → modal list shows 2 rows with distinct in..out; the second import did NOT replace the first |
| 2 | Per-clip settings | Select clip B, change Volume/fades/In/Out → clip A's values unchanged; close/reopen Studio → both clips and settings intact (document JSON round-trip) |
| 3 | List + reveal | Click a list row → that clip gets the selected marker AND the timeline scrolls to reveal it; click the other row → reveal moves |
| 4 | Two ways in | Timeline double-click a clip → modal opens on THAT clip's editor; header `Document sound` launcher → list view; with a single clip both land on the one clip |
| 5 | Timeline multi-clip | Two (incl. overlapping) clips each render stain + trims + overlay; clicking a clip selects it without moving the playhead; clicking the band outside deselects; exactly one stain highlighted |
| 6 | Alt+drag | Bare alt+drag a stain → a second clip appears at the dragged position, original unmoved; gallery still shows ONE audio file; both draw their waveform; alt+trim on a handle trims only |
| 7 | Main window | The main timeline shows one stain per clip (loop verified with 2+ clips) |

## Next Phase Readiness

- All 3 tasks committed atomically (`fa092b5e`, `be8d6375`, `6a9a2b16`); diff-boundary audit clean (no package.json/Cargo.toml/test-config/.test.tsx changes; soundBandGeometry.ts deviation documented)
- Deferred list intact for the follow-up quick: `documentAudio` channel reshaping (still a three-member singleton with its boundary comment), `preparedTrackIds`, `.mce` multi-file package references, export-mixer/playback-mix retarget, master lane
- Carried debt: the pre-existing `PhysicsPaintStudioView.test.ts` ESM-init failure belongs to a dedicated quick (late-bind the projectStore→paintStore wiring)

## Self-Check: PASSED

- FOUND: .planning/quick/261008-ig1-multi-audio-concept-written-to-planning-/261008-ig1-SUMMARY.md
- FOUND: fa092b5e (ancestor of HEAD)
- FOUND: be8d6375 (ancestor of HEAD)
- FOUND: 6a9a2b16 (ancestor of HEAD)
