# Phase 53 — Signed Packaged-App UAT Evidence Record (v1.0.0)

**Plan:** 53-03 — comprehensive single signed-artifact pass (ACC-02, D-01)
**Artifact under test:** `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (signed, notarized, stapled, v1.0.0)
**DMG:** `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg` (15,942,003 bytes; signed, notarized, stapled)
**Freshness (skill rule 6):** inner binary `Contents/MacOS/efx-motion-editor` mtime **Oct 11 12:09:58 2026 (local)**; `.app` dir mtime **Oct 11 12:09:58 2026 (local)** — both postdate the 53-01 six-gate run (captured 2026-10-11 10:18:43–10:21:03 local) and the credentialed wrapper run of the same day. The freshness rule is judged by inner-binary mtime only, never by `bundle/dmg/` mtime. Bundle contents: exactly one `.app` in `bundle/macos/` and exactly one `*_1.0.0_*.dmg` in `bundle/dmg/` (1 / 1); Info.plist `CFBundleShortVersionString` = `1.0.0`, `CFBundleVersion` = `1.0.0`. Notarization evidence present at `bundle/dmg/notarization-evidence/` (`dmg-log.json`, `dmg-submit.json`, 12:11 local).
**Version surfaces at 1.0.0:** `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` (efx-motion-editor block), `scripts/macos-release.sh:10` `PRODUCT_VERSION` — all five read 1.0.0 (53-01, `releaseContract.test.ts` 11 passed).
**Oracle:** shipped English labels/values (D-01).
**Mode:** one comprehensive pass (D-01) over the full worksheet in D-04 order against this single signed bundle; a failing row is recorded and flagged per D-21, never fixed in-phase.
**Commit under test:** `0c9e7defd9e13ba9f7b782d96242e8ce9692dafb` (= `origin/HEAD` at release time)
**Date:** 2026-10-11
**Result:** PENDING — matrix pending the comprehensive pass (Task 2)

## Worksheet META (material gate RESOLVED — meta-pair approved by the user; ready for the walk)

| META field | Value | Status |
|------------|-------|--------|
| `meta-app` | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (absolute: `/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app`) | ready |
| `meta-commit` | `0c9e7defd9e13ba9f7b782d96242e8ce9692dafb` (= `origin/HEAD` at release time) | ready |
| `meta-pair` | `/Users/lmarques/Desktop/efx-motion-editor-project-test/v1.0.0-2.mce` | **APPROVED (user's final call)** — the last project that works with the 1.0.0 build; the other files in that folder are not compatible with the 1.0.0 build and are not used. Material substitution recorded in the divergence table (D-03 entry below). |
| `meta-fixture` | `app/src/efx-paint/document/__fixtures__/pre-52.2-project.mce.json` | ready |

### Available material under test (meta-pair manifest — what is actually on disk)

- 1080x1080 @ 24fps, 1 fx sequence "Layer 1", timeline frames 0-31
- 1 physic-paint layer with a real efxPaint document (documentRevision efxdoc-405, compositeRevision composite-144)
- 3 cached WebP paint frames
- 1 audio track: source trim in 504 / out 533 of a 1944-frame file, offset_frame 2, volume 1.0, exponential fades (1 frame in/out), slip_offset 0, bpm 93.8, 165 beat markers shown
- 3 audio assets as disk references to imports/Drex3emRush-sansRouli.aif

### Pass instructions — BINDING for the walk (user's honesty constraint, verbatim)

> no row may silently claim the 31-key shape. If a row's wording says "31 keys" or "full range", either exercise it on a user-built longer fresh project and say so in the comment, or mark NA referencing this divergence. No quiet PASS.

### Ride-along tracked note (not a worksheet row)

- Acceptance 3 of the #90 scoped fix rides along this walk: live non-1920x1080 FX flatten/unflatten at real project dimensions. Recorded as a tracked note here (the worksheet carries no matching row), with its outcome reported alongside the walk results.

## Pass/Fail Matrix

**Pre-pass skeleton — every verdict is `PENDING`; no row has been executed yet (meta-pair gate cleared; honesty constraint above is binding on every verdict).** One row per worksheet card (same R-numbers as `53-UAT.html`, D-04 order), each carrying spec-step text, the shipped-English expected marker, and the live verdict recorded during the comprehensive pass.

| # | Spec step / origin | Expected-outcome marker (shipped English) | Result |
|---|--------------------|-------------------------------------------|--------|
| R1 | New parent Paint layer: default tracks + fallback [SPEC STEP 1, FRESH DOC] | one default Paint track, one fixed Background track, the configured fallback — exactly one of each. | PENDING |
| R2 | Finder: ONE icon, double-click opens [INSERT · FINDER, D-04] | one icon; double-click opens the project, warm and cold. | PENDING |
| R3 | Pre-v1.0 fixture rejected explicitly [SPEC STEP 2, LEGACY REJECTION] | explicit "unsupported" failure, no partial mutation, no legacy rendering. | PENDING |
| R4 | Add ≥3 internal Paint tracks, stable IDs [SPEC STEP 3, TRACK IDS] | ≥3 tracks added; every ID identical throughout the session. | PENDING |
| R5 | Distinct frame content per track + linked Hold Loop cycle [SPEC STEP 4, HOLD LOOP] | distinct content per track; linked Hold Loop cycle, identical repetitions with no asset duplication. | PENDING |
| R6 | Reorder, hide, solo, opacity, blend [SPEC STEP 5, TRACK CONTROLS] | reorder does not change identity; hide/solo/opacity/blend act exactly once (no double-application). | PENDING |
| R7 | Hide/solo truth-table audit (milestone-audit carry) [INSERT · HIDE/SOLO AUDIT, 260911-g1g] | the full truth table matches; no leakage between session pill and persisted S. | PENDING |
| R8 | Scrub onto gap: preserve active sequence + key photo [INSERT · j5r, 260920-j5r] | scrubbing onto a gap changes neither the fx sidebar nor the selection — including in the export dialog. | PENDING |
| R9 | Play internal tracks with synchronized main-editor audio [SPEC STEP 6, AUDIO SYNC] | audio at the right timeline point, sync stable after seek/pause. | PENDING |
| R10 | Background: 5 images at frame 0, Repeat 3 → frames 0-14 [SPEC STEP 7, BACKGROUND LOOP] | Frames 0-14 built exactly from the five linked sources (Repeat 3). | PENDING |
| R11 | 10 images at frame 15, Repeat 2 → frames 15-34, exclusive end 35 [SPEC STEP 8, BACKGROUND LOOP] | Frames 15-34 = 2 cycles of the 10 sources; frame 35 outside the clip (exclusive end). | PENDING |
| R12 | Fallback gap: solid ↔ transparent, multi-surface comparison [SPEC STEP 9, FALLBACK GAP] | All three surfaces show the same fallback (identical). | PENDING |
| R13 | Background → infinity, next clip interrupts, move/delete deterministic [SPEC STEP 10, INFINITY + INTERRUPT] | Infinity extends to the next clip / parent end; move/delete restore the exact state with no overlapping frames. | PENDING |
| R14 | Save, close, reopen: IDs, links, repeats, timing, fallback, composite [SPEC STEP 11, SAVE / REOPEN] | Identical round-trip across the six field families. | PENDING |
| R15 | Package IO through Rust commands on the packaged build [INSERT · 260913-05k-a, D-16, PACKAGE IO] | Direct save works; disk writes via Rust commands only. | PENDING |
| R16 | Blocking failure modal when the package path is gone [INSERT · 260913-05k-b, D-16, FAILURE MODAL] | Blocking modal + real error + no corrupted state; Open fails explicitly. | PENDING |
| R17 | Offline reopen: package self-containment (cold open) [INSERT · DOC-05, D-14, COLD OPEN] | Full cold open: complete content, painting works, export works, zero network requests. | PENDING |
| R18 | Moved sound file → "missing" modal, never silent playback [INSERT · SND-07, D-16, SOUND REF] | The modal shows the "missing" state for the moved file; no silent playback. | PENDING |
| R19 | The main editor sees only ONE Paint-layer result [SPEC STEP 12, MAIN EDITOR] | Exactly one composite result per parent Paint layer in the main editor. | PENDING |
| R20 | Stack parent Paint layers with ordinary layers [SPEC STEP 13, LAYER STACK] | Ordinary-layer behavior, persisted. | PENDING |
| R21 | Photo/reference source distinct from Background [SPEC STEP 14, PHOTO REF] | Two independent tracks; no content or setting cross-talk. | PENDING |
| R22 | Progressive AND static/hold Reveal [SPEC STEP 15, REVEAL] | Progressive: visible frame-by-frame evolution; hold: constant content. Both persisted. | PENDING |
| R23 | Reveal stretch: commits only on real change [INSERT · kov-1, 260920-kov, UNDO HONESTY] | No-op: zero new undo entries, revision unchanged; real change: commits. | PENDING |
| R24 | Multi-image bake: each frame's source resolved frame-aligned [INSERT · kov-2, 260920-kov, FRAME-ALIGNED BAKE] | Each baked frame resolves its own frame-aligned source. | PENDING |
| R25 | Photo dialog not hijacked after first Reveal use [INSERT · kov-3, 260920-kov, DIALOG] | Dialog pure again (photo-reference) after first Reveal use. | PENDING |
| R26 | Compare Studio flattened output, main preview, and export [SPEC STEP 16, WYSIWYG] | All three surfaces visually identical. | PENDING |
| R27 | Paint content export enumerates frames correctly across all surfaces [INSERT · export enumeration, D-04, 52.3] | Every expected frame exported (none missing, none phantom); surfaces agree. | PENDING |
| R28 | Live gate: profiler counters (52.1) [INSERT · live-gate, 52.1, D-12, PROFILER] | Profiler counters readable and stable during playback + scrub (values recorded). | PENDING |
| R29 | Live gate: live memory trace (52.1) [INSERT · live-gate, 52.1, D-12, MEMORY] | Memory stabilizes (peak bounded by the LRU), no monotonic growth. | PENDING |
| R30 | Live gate: open-time wall clock (52.1) [INSERT · live-gate, 52.1, D-12, OPEN TIME] | 3 measurements recorded, cold open perceived as immediate. | PENDING |
| R31 | Async PlayScript capture A→B (re-record) [INSERT · 46-UAT, D-13, ASYNC CAPTURE] | A→B capture completes, async, UI responsive during the run. | PENDING |
| R32 | Sidecar cleanup on disk (re-record) [INSERT · 46-UAT, D-13, SIDECAR] | Session sidecars removed; zero orphans from the session. | PENDING |
| R33 | F-01: identical-content switch (or explicit retirement) [INSERT · 46-UAT, D-13, F-01] | Either PASS (correct behavior), or NA WITH an explicit retirement comment. | PENDING |
| R34 | c7x row 1: Layer 2 move a key, then click-positioning onto an interpolated frame — both behave exactly as on the first layer [INSERT · c7x-1, 260921-c7x, SWEEP] | Behavior per the c7x fix: no latch, no phantom timeout, successive edits OK. | PENDING |
| R35 | c7x row 2: Move a rail, then stretch a reveal rail — each commits, and the reveal stretch persists across save/reopen [INSERT · c7x-2, 260921-c7x, SWEEP] | Behavior per the c7x fix: no latch, no phantom timeout, successive edits OK. | PENDING |
| R36 | c7x row 3: Apply key spacing on a rail — the spacing applies and no "already in flight" tooltip follows [INSERT · c7x-3, 260921-c7x, SWEEP] | Behavior per the c7x fix: no latch, no phantom timeout, successive edits OK. | PENDING |
| R37 | c7x row 4: Trigger one failure deliberately, then the next edit — it must not be blocked, no timeout [INSERT · c7x-4, 260921-c7x, SWEEP] | Behavior per the c7x fix: no latch, no phantom timeout, successive edits OK. | PENDING |
| R38 | c7x row 5: Sequence import in one go: multi-image frame-aligned bake (kov range ② replay) [INSERT · c7x-5, 260921-c7x, SWEEP] | Behavior per the c7x fix: no latch, no phantom timeout, successive edits OK. | PENDING |
| R39 | wm6 sans-cuisson: look + white holes + parity (UAT pending) [INSERT · wm6, 260930-wm6, SWEEP, AUTOMATED-READY] | (a) zero white cuts; (b) identical look; (c) equal digest; (d) no 2nd-stroke freeze; (e) no fade on key return. | PENDING |
| R40 | physique-libre: spread 60-65 look judgment (UAT pending) [INSERT · libre, 260930-libre, SWEEP, LOOK] | The "full spread" look is back: mass transport at the edge, textured interior, no noise; max visibly richer than min. | PENDING |
| R41 | ni6: panel defaults + Blending label (UAT pending, 4 rows) [INSERT · ni6, 260930-ni6, SWEEP, DEFAULTS] | Defaults = SD 20, Blending 0, Spread 60-65, Smoothing Soft; label "Blending"; nothing visually changed. | PENDING |
| R42 | t2o: R7 look a/b/c, no parcellaire, rim fibres, live-vs-finalize [INSERT · t2o, 260929-t2o, SWEEP, LOOK] | Fibre-scale textured edge (no smoothing, no pixel-noise), solid spans, readable rim, continuous live→finalize. | PENDING |

Spec step 17 (downloaded-artifact verification) is mapped to `53-VERIFY-DOWNLOADED.md` (plan 53-04), per the worksheet footer — not part of this pass.

## Divergence table (spec-vs-implementation)

_Divergences are recorded, NOT fixed (D-21, release-only phase)._

| # | Divergence | Status |
|---|------------|--------|
| D-03 | D-03 material substitution: the documented §7-pair 31-key through-line (~/Desktop/efx-motion-editor-project-test/v1.0.0.mce, 2 layers / ~200 frames / 31 keys — the real project shape that surfaced the 52.3 export-enumeration blocker) no longer exists on disk. Substituted with v1.0.0-2.mce (31-frame fx timeline, 1 physic-paint layer with 3 cached frames, 1 beat-mapped audio track, 3 disk-referenced audio assets). Consequences: (a) audio and package-integrity rows — R9, R14, R17, R18 and the 52.5 sound sweep rows — run on real audio material; (b) paint, Reveal, and Background rows — R5, R10-R13, R22-R27 — run on targeted fresh projects built during the walk, per D-03's existing 'targeted fresh projects' clause; (c) the R28-R30 live-gate performance rows record the material actually sized (31 frames, not ~200) in the row comment. Verdict NA is acceptable on a row only with a comment naming this substitution. This is a material loss, not a product defect. Other packages in that folder are not compatible with the 1.0.0 build and are not used. | recorded, NOT fixed — D-21 (user decision: GO for the live pass on this material) |

## User approval

_Pending — the user's explicit approval of the archived record closes this record._

## Hard boundaries respected

- No functional source file changed (D-21 — release-only phase).
- No Apple credential/certificate file accessed, opened, or searched (D-22 — the credentialed run was user-run via `~/.config/efx/scripts/efx-release-efx-motion`).
- No dev server started; no Vitest watch mode.
