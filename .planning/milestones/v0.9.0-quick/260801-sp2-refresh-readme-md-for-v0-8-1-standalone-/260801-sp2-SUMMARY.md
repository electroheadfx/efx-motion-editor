---
phase: quick-260801-sp2
plan: 01
subsystem: docs
tags: [readme, release-notes, physics-paint, roto, documentation]
status: complete

requires:
  - phase: v0.8.1 release
    provides: published Standalone Physics Paint feature set and release notes used as wording source
provides:
  - Tracked header artwork at docs/assets/header-efx-motion.png rendered at the top of README.md
  - README.md accurately describing the shipped v0.8.1 Standalone Physics Paint release
affects: [release, documentation, onboarding]

actuals:
  tokens: 5800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Tracked repo assets under docs/assets/ referenced via repository-relative paths (never gitignored SPECS/)"

key-files:
  created:
    - docs/assets/header-efx-motion.png
  modified:
    - README.md

key-decisions:
  - "Paint layer documented as dual-mode (Flat/FX); Physics Paint documented as a shipped standalone Tauri window, not a third paint mode"
  - ".mce format version unified to v15 per app/src/stores/projectStore.ts (version: 15)"

patterns-established:
  - "README feature claims verified against live code (PaintMode, physicPaintBridge, project format version) before writing"

requirements-completed: [QUICK-260801-SP2]
---

# Phase quick-260801-sp2 Plan 01: Refresh README.md for v0.8.1 Standalone Physics Paint Summary

**One-liner:** README refresh for the published v0.8.1 release — tracked header artwork, accurate dual-mode paint layer description, and a new Standalone Physics Paint section matching the shipped product.

## Accomplishments

- Copied the user-provided header artwork byte-for-byte to the tracked path `docs/assets/header-efx-motion.png` and referenced it directly under the preserved `# EFX Motion Editor` heading with descriptive alt text (Task 1, tracer — approved by user).
- Reworked the opening description: the editor paint layer is now described as dual-mode (Flat vector strokes, FX spectral pigment), with the standalone Physics Paint window and deterministic Roto timeline named as headline capabilities.
- Replaced the stale "3-Mode Paint System" paragraph (which cast Physical mode as a future placeholder) with an accurate "Dual-Mode Paint System" paragraph covering Flat/FX and their mode-conversion dialogs.
- Added a `### Standalone Physics Paint` feature section documenting: the standalone Tauri window preserving native incremental physics, the typed Tauri/postMessage bridge with exact acknowledgements and the `physic-paint:seek-frame` frame-sync path, the deterministic Roto timeline (stable physical-frame keys, direct frame positioning, generated interpolation, dynamic spacing, atomic acknowledged edits), live PNG pixel caching with durable alpha composites and cached playback, accepted-only 10-level per-brush Undo/Redo, single-key drag and rigid group drag/delete with Force Spacing, Group Copy/Paste/Duplicate/fail-closed Cut, and Roto Scripts (project-scoped JSON presets, WebP thumbnails, Copy/Apply Script clipboard, Play Script replay).
- Added a brief `## Release` note: v0.8.1 ships as a Developer ID signed and Apple-notarized macOS (Apple Silicon) DMG, with packaging safeguards (complete frontend bundle entry, generated EFX icon set, system codesign resolution, production CSP granting PNG data URLs in `img-src`).
- Fixed the stale `.mce v11` mention in the transitions section to `v15`, matching `app/src/stores/projectStore.ts` (`version: 15`) and the existing Tech Stack table row.
- Corrected the Tech Stack Paint Engine row to reflect the real architecture: perfect-freehand (flat), p5.brush (spectral FX), fit-curve + bezier-js (path editing), @efxlab/efx-physic-paint (standalone Physics Paint engine with typed editor bridge).

## Verification

Task 2 automated gate (run in worktree): PASSED

- Zero `future efx-physic-paint` phrasing; zero `](SPECS` links
- `Standalone Physics Paint`, `physic-paint:seek-frame`, `Roto Scripts`, `Force Spacing`, `WebP`, `notariz` all present
- All referenced paths exist (`app/src/lib/shaders/SHADER-SPEC.md`, `LICENSE`, `docs/assets/header-efx-motion.png`, `app/src/lib/physicPaintBridge.ts`)
- All relative Markdown links in README.md resolve to existing paths (0 missing)
- README.md still starts with `# EFX Motion Editor` followed by the header image

## Deviations from Plan

None - plan executed exactly as written. One minor additive choice within plan latitude: the `physicPaintBridge.ts` mention in the new section is a relative Markdown link (verified to resolve), consistent with the existing SHADER-SPEC.md link style.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (tracer) | c82d82a8 | docs(quick-260801-sp2-01): add tracked header artwork at top of README |
| 2 | 0b9123fb | docs(quick-260801-sp2-01): refresh README for v0.8.1 Standalone Physics Paint |
| 2 (user-feedback fix) | b8debe01 | docs(quick-260801-sp2-01): remove 15/24 fps references from README per user feedback |

## User-Feedback Fix (post-Task-2 review)

During the Task 2 human review the user flagged the "15/24 fps" figures as stale/unwanted. Follow-up commit `b8debe01` (README.md only, new atomic commit — no amend):

- Opening paragraph: dropped "at 15/24 fps" ("arrange them into timed sequences").
- Multi-Sequence Timeline section: replaced "per-sequence FPS (15 or 24)" with "per-sequence frame rate".
- Re-ran the full Task 2 automated verify gate after the edit: PASSED (no SPECS links, no "future efx-physic-paint", all required terms present, all relative links resolve).
- Confirmed zero remaining matches for `15/24`, `15 or 24`, and `fps` (case-insensitive) in README.md.

## Pending

- Task 3 (checkpoint:human-verify): human review of the rendered README and v0.8.1 feature accuracy. Awaiting user approval.

## Self-Check: PASSED

- FOUND: docs/assets/header-efx-motion.png (tracked, byte-identical per Task 1 verify)
- FOUND: README.md (modified, verified)
- FOUND: commit c82d82a8 (`git log --oneline` in worktree)
- FOUND: commit 0b9123fb (`git log --oneline` in worktree)
