---
quick_task: 260717-m9k
scope: full
status: passed
tests: complete
---

# Quick Task 260717-m9k Validation Contract

## Boundary

This contract governed the production-first implementation and native-UAT checkpoint. The boundary was followed: production work completed before regression changes, native UAT was explicitly approved on 2026-07-18, deferred tests were then implemented, and final review/verification completed before GSD closure. The development server was not run.

## Requirement-to-Gate Mapping

| Requirement | Pre-UAT evidence | Gate/status |
|---|---|---|
| Shared progressive scheduler remains buildable through the existing Physics Paint package export and `AnimationPlayer` delegates to it. | Package compilation and declaration build. | `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint build` |
| Play Script controller, bridge contracts, Preact Scripts UI, Roto publication wiring, and obsolete TypeScript production removal are type-correct. | Approved production-only TypeScript API compilation using the existing app compiler options while excluding untouched test/spec roots. | Command recorded in `260717-m9k-SUMMARY.md`; standard full typecheck is POST-UAT BLOCKED until stale tests may be cleaned up. |
| Rust project models, project I/O, and native launch serialization compile after obsolete Play persistence fields are removed. | Native Rust compile check; required because Rust production files change. | `cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml` |
| Production edits contain no whitespace errors or unresolved patch markers. | Repository diff validation. | `git -C /Users/lmarques/Dev/efx-motion-editor diff --check` |
| Obsolete separate Play production architecture is absent while retained generic/new functionality remains permitted. | Scoped non-test TypeScript/TSX/Rust/CSS static audit below. | Concrete `rg` audit exits 0. |
| Progressive visual parity, deterministic held poses, additive alpha composition, atomic cancellation/failure behavior, accessible dialog behavior, ordinary Roto persistence/playback/export, and visible obsolete-UI removal. | Native application and user-visible interaction. | **PASSED — developer-approved native UAT on 2026-07-18** |
| Regression protection for scheduling, renderer, controller, authority, atomic publication, UI, persistence, and removed legacy paths. | Focused and full app/package/Rust suites after UAT approval. | **PASSED — 783 app, 89 package, and 12 Rust tests** |

## Permitted Production Gates

The completed pre-UAT gates are recorded verbatim in `260717-m9k-SUMMARY.md`:

1. Physics Paint package build.
2. User-approved production-only TypeScript API check using the existing `app/tsconfig.json` options, filtering test/spec roots without creating or changing config.
3. Cargo check for the Rust model/native changes.
4. `git diff --check`.
5. Scoped obsolete-Play production audit over non-test TypeScript/TSX/CSS and pre-`#[cfg(test)]` Rust source.

The standard full app typecheck is intentionally deferred until explicit post-UAT approval because untouched stale tests still import production modules that the clean break removes.

### Static-audit scope and retained exceptions

The negative audit covers four obsolete production groups:

1. Bridge payload kinds: old Play canvas application, Play/Roto conversion, and Play render-option update variants.
2. Coordinator/cache/conversion modules and APIs: obsolete Play coordinator, edit cache, preview, limit, lifecycle, transaction, conversion, and sequence-application symbols.
3. Workflow/range/cache/launch/store/persistence fields: old Play mode, range, start/count, source, motion, cache, render option, TypeScript project metadata, Rust project fields, project I/O, and native launch serialization.
4. Separate Play UI/CSS: workflow tab/lane, range marker, option, and conversion identifiers.

The audit deliberately permits and must not be broadened to reject:

- generic `AnimationPlayer` and its shared scheduling role;
- optional durable per-stroke `playFrame` scheduling metadata;
- the new `Play Script` feature naming and contracts;
- cached Roto Play/Stop transport for already committed Roto keys.

A static-audit hit is a production cleanup failure unless it is one of these retained exceptions. Test files are outside this pre-UAT audit because their cleanup is intentionally blocked.

## Native Visible UAT Checklist — Approved

The developer completed this checklist and explicitly approved native visible UAT on 2026-07-18, reporting that all work functions.

### A. Existing SCRIPTS and Roto behavior

1. Row activation reloads only; it does not apply or generate frames.
2. Paintbrush authoritatively reloads the selected durable preset and applies it exactly once to an eligible current real Roto key.
3. Durable Save, Rename, Delete, Refresh, and immutable reusable script behavior remain functional.
4. Cached Roto Play/Stop remains a separate transport for committed keys.

### B. Eligibility and disabled reasons

5. Play Script is disabled with a clear reason when there is no durable selection, the selected display frame is generated/render-only, the start is not a real canonical key, an operation is busy/locked, parent authority is unavailable, or remaining capacity is zero.
6. Generated interpolation cells remain render-only and are never promoted to editable destination identities.

### C. Dialog, input, accessibility, and compact layout

7. The Play icon appears immediately after Paintbrush and opens the frame-count confirmation.
8. Initial focus, labelled input, accessible name/tooltip, contained Tab traversal, Enter confirmation, Escape/cancel, and focus restoration work.
9. Empty, zero, negative, fractional, malformed, and over-capacity values are rejected without clamping; a positive integer and case-insensitive `Max` are accepted.
10. Resolved `Max`, canonical destination range, progress, error content, and cancellation controls remain usable without compact-panel overflow.

### D. Parent authority and stale-state rejection

11. `Max` reflects current parent-owned capacity from the selected canonical start through the current layer/timeline boundary.
12. Parent boundary, project/layer context, start ownership, operation lock, or Roto revision changes before confirmation/commit cause refresh or rejection rather than stale publication.
13. Rejection produces a clear operation-correlated Scripts/LOG error, with no optimistic standalone mutation or partial parent sequence.

### E. Progressive scheduling and Motion fidelity

14. Generated progression matches the `AnimationPlayer` oracle for recorded ordering, point-weighted spans, partial revelation, cumulative completed strokes, overflow, anchored `playFrame` insertions, same-anchor continuation ordering, and complete final frame.
15. Current visible Move and Deform values produce deterministic held poses by consecutive canonical destination; repeated generation is stable.
16. Zero Motion preserves original geometry, and durable preset JSON/raw per-stroke brush properties remain unchanged.

### F. Composition, atomicity, cancellation, and cleanup

17. Generation across existing real keys preserves unrelated existing alpha below the newly staged script alpha; untouched real keys remain unchanged.
18. Cancellation during preparation/rendering and a safe pre-commit failure release temporary resources and leave parent and standalone Roto keys unchanged.
19. Publication occurs as one complete parent-authoritative batch; no partial sequence is visible, and interpolation regenerates once after acceptance.

### G. Completion, persistence, playback, and export

20. Successful generation creates or updates consecutive canonical real keys beginning at the selected source position.
21. The first affected real key is selected, the complete sequence remains present, and cached Roto playback remains stopped after success.
22. Ordinary Roto preview, persistence, close/reopen, cached playback, and export include the committed sequence through their established paths.

### H. Obsolete workflow removal and intentional data loss

23. Separate Play launch/action, workflow mode/tab, timeline lane, ranges/markers, frame/render options, conversion controls/dialogs, selectors, and old Play styling are absent.
24. Generic `AnimationPlayer`, new Play Script generation, durable per-stroke `playFrame`, and cached Roto Play/Stop remain present and distinct.
25. If a safe existing old-project fixture is available, confirm obsolete Play metadata is not migrated or revived and acknowledge intentional loss of Play-only editable strokes, ranges, selected script/range identity, saved Motion/render options, and non-Roto-provenance cached Play data. If no safe fixture exists, report this item unavailable and do not create one before approval.

## SUMMARY Handoff Contract

After every production gate exits 0, `260717-m9k-SUMMARY.md` must include:

- frontmatter `status: native_visible_uat_required`;
- changed and deleted production files;
- exact production commands run and their outcomes;
- the four obsolete-symbol groups audited and the four retained exceptions;
- intentional clean-break legacy Play data loss and absence of migration/compatibility handling;
- explicit statement that visual and behavioral requirements remain native-UAT pending;
- explicit post-UAT test debt and the no-tests-before-approval boundary.

The executor then returns control. The orchestrator asks the user for native visible UAT and does not mark the quick task complete.

## Post-UAT Coverage — Complete

After explicit user approval, obsolete Play tests were removed or rewritten and focused regression coverage was added for:

- shared scheduler parity with the existing `AnimationPlayer` oracle, including anchors, insertions, overflow, weighting, continuations, and final completeness;
- isolated transparent alpha rendering, deterministic held Motion, zero-Motion parity, resource cleanup, and cancellation;
- authoritative selected-row reload and immutable operation snapshot behavior;
- positive-integer/`Max` parsing, capacity refresh, generated-frame guards, and stale authority/revision rejection;
- additive existing-key composition, parent-first all-or-nothing acceptance, no mutation on rejection, and one interpolation regeneration;
- Play Script dialog keyboard/focus/accessibility behavior and retained Load/Paintbrush/library/cached-Roto controls;
- TypeScript/Rust persistence and bridge contracts proving obsolete Play fields and payload variants remain removed.

Focused and full `vitest run` suites, app/package builds, typechecks, Rust tests, definitive deep review, and final verifier all passed. See `260717-m9k-SUMMARY.md`, `260717-m9k-REVIEW.md`, and `260717-m9k-VERIFICATION.md` for final evidence.
