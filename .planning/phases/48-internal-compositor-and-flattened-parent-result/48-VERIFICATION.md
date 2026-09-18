---
phase: 48-internal-compositor-and-flattened-parent-result
verified: 2026-09-11T08:58:01Z
status: passed
score: 5/5 roadmap success criteria verified; 6/6 CMP requirements satisfied (CMP-01/CMP-02 with recorded caveats); 22/22 pixel-matrix rows green (recorded)
behavior_unverified: 0
overrides_applied: 0
gaps: []
deferred:
  - "DOC-05 offline reopen path (refs-only frame carriers in the main window) could not be traced offline — flagged for Phase 53 native UAT (audit integration warning, 2026-09-11; CMP-01 adjacency)"
  - "Hide/solo divergence hardening (TML-04/CMP-02): align the Studio live-surface predicate with participatingPaintTracks or add the truth-table contract test — Phase 53 follow-up (audit recommendation 1)"
behavior_unverified_items: []
coincidental_reliance_items:
  - "Fond paper preload gate: previewRenderer.ts:189 collectRotoPaperTextures (metadata read at :195) sources getRotoBackgroundMetadata(activeTrack); the fond authority is document.background.fallback (physicPaintStore.ts:1187 _resolveDocumentFondInstruction). Correctness relies on the parallel write in useRotoBackgroundMetadataSync (PhysicsPaintStudio.tsx:2219, imported :91) — divergent for non-active tracks and fragile if the sync lags the export gate (exportRenderer.ts:445)."
human_verification: []
---

# Phase 48: Internal Compositor and Flattened Parent Result — Verification Report

**Phase Goal:** Resolve all internal Paint tracks into one deterministic per-frame raster consumed by the unchanged main-editor parent-layer compositor.
**Verified:** 2026-09-11T08:58:01Z
**Status:** passed
**Re-verification:** No — initial verification (backfill 2026-09-11 from the phase's recorded evidence; no test re-run, no source modification)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All internal Paint tracks resolve through one shared composition path into one deterministic flattened parent raster per frame, identical in Studio preview, main preview, and export | ✓ VERIFIED (recorded caveat) | `physicPaintStore.getFlattenedFrame(layerId, frame)` (48-03, commits `739da730` test + `699ddce1` feat) is the single seam: main preview consumes it in `previewRenderer.ts:202-266` (`collectPhysicPaintFrameSources` → `getFlattenedFrame` at `:210`/`:266`, once per layer per render); export consumes the same flattened record (`exportRenderer.ts:445-449`); the Studio program monitor consumes `getFlattenedFrame`/`getFlattenedFrameExcluding` only (48-05, `d0e5af53`; `PhysicsPaintProgramMonitor.tsx`). The 22-row matrix suite (`efxPaintCompositorMatrix.test.ts`, `59f239ab`, all green — 48-06-SUMMARY) pins the shared op contract; 48-06 native UAT part 1 compared Studio vs main preview vs export per row group. Caveats: the fond paper preload gate reliance (recorded in `coincidental_reliance_items` and Anti-Patterns #2) and the DOC-05 offline reopen path (carried to Phase 53, audit 2026-09-11). |
| 2 | The hide/solo truth table is applied (no solo → all visible; solo → visible+soloed only; hide wins over solo) | ✓ VERIFIED (with recorded divergence warning) | `participatingPaintTracks(document)` (`efxPaintHideSolo.ts:30-43`) implements the locked table — no solo → every `visible !== false` track participates; any solo → only visible AND soloed; a hidden track's solo never arms solo mode (solo-arming reads only visible tracks, `:37`); order ascending with `track.id` tiebreak. `backgroundParticipates` (`:50-52`, D-04) is governed only by `background.visible`. The `efxPaintHideSolo.test.ts` truth-table tests and matrix rows "hidden upper", "one/multiple soloed", "hidden-and-soloed precedence" (`59f239ab`) are the recorded unit evidence on the authoritative flattened surface. The Studio live-surface predicate divergence (`previewRenderer.ts:95` arms solo over ALL tracks) is recorded in Anti-Patterns #1 and deferred to Phase 53 (TML-04/CMP-02) — it does not falsify the flattened composition truth table. |
| 3 | Internal track opacity and blend mode are applied once inside EFX Paint; parent opacity/blend is applied once by the main editor (never double-applied) | ✓ VERIFIED | D-01 op order pinned: `save → globalAlpha=opacity → compositeOp → drawImage → restore` per track, lower first (`efxPaintCompositor.test.ts`, 48-01 Task 1); the parent draw sites in `previewRenderer.ts` stay unchanged and exclusive, producing the 25% contract (50% parent × 50% internal) — matrix row 20 / `previewRenderer.test.ts` parent-application row (48-06 coverage D3, `59f239ab`); the compositor module never reads parent layer properties. 48-06 native UAT part 4 confirmed the parent contract live. |
| 4 | Track cache key includes track revision and composition dependencies; parent cache invalidates when any participating track/clip/source/fallback changes | ✓ VERIFIED | `deriveEfxPaintFlattenedCacheKey` (48-01, `b4f16497`) covers config hash (`buildEfxPaintCompositeRevision`) + per-track content revisions (filtered through `participatingPaintTracks`, 48-04 `b60c587c`) + `background.revision` + sorted clip terms + frame, built with canonical-encoder helpers only; the unwired `document.compositeRevision` counter is never read. The 48-04 invalidation matrix (rows 1-7, `09f9f4d9` RED + `b60c587c` GREEN) covers track content, config visible/solo/opacity/blendMode/order, clip add/repeat/revision, fallback flip + visibility, per-track memo isolation (port spy counts), and hidden-track non-churn (identical frozen result). |
| 5 | The pixel acceptance matrix passes (opaque/semi-transparent/multiply/screen/overlay/add, hidden/soloed, empty upper frame, Background loops, gaps, parent opacity/blend) | ✓ VERIFIED | 22-row recording-context suite over the shared `compositeFrame` (`efxPaintCompositorMatrix.test.ts`, commit `59f239ab` "pixel acceptance matrix contract suite"; "22 tests, all green" recorded in 48-06-SUMMARY). Native UAT confirmed pixel parity Studio/main/export, straight-alpha (50% white, no dark halo — UAT part 2), parent 25% (part 4), missing-source surface (part 5), playback smoothness (part 6), blend/opacity (part 7), paper fond (fix commits `83aecda3`/`60663c9e`/`feca1a0a`). |

**Score:** 5/5 roadmap success criteria verified; 6/6 CMP requirements satisfied (CMP-01 and CMP-02 carry recorded caveats documented below); 22/22 pixel-matrix rows green (recorded).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/efx-paint/compositor/efxPaintHideSolo.ts` | Locked hide/solo truth table (CMP-02, D-04) | ✓ VERIFIED | `participatingPaintTracks` (`:30-43`), `backgroundParticipates` (`:50-52`); order ascending, `track.id` tiebreak, fail-closed |
| `app/src/efx-paint/compositor/efxPaintCompositor.ts` | Shared pure composition pipeline (CMP-01/03/05) | ✓ VERIFIED | `compositeFrame`: fallback fill → Background seam (`resolveBackgroundFrame` union + `resolveBackgroundSourceImage` decode port) → participating tracks with opacity-before-blend, straight-alpha result, missing → transparent + report; all canvas/raster/decode work through injected ports (zero Preact/DOM/store imports) |
| `app/src/efx-paint/compositor/efxPaintCompositeCache.ts` | Derived flattened key + per-track keys + keyed memo (CMP-04, D-07/D-08) | ✓ VERIFIED | Config + participating-only per-track content terms + background revision + sorted clip terms + frame + `excl:` term (48-05); canonical-encoder helpers only |
| `app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts` | FrameLoopClip → resolver adapter + per-frame resolution (CMP-06, D-03) | ✓ VERIFIED | Identity-memoized derivation, content/gap/missing union, capacity-bounded infinite loops, no modulo math in `efx-paint/` (Pitfall 10) |
| `app/src/stores/physicPaintStore.ts` | `getFlattenedFrame` delivery (CMP-01/D-11) | ✓ VERIFIED | One frozen record per (layer, frame) — production compositor ports, per-track decode cache keyed by `deriveEfxPaintTrackContentKey`, per-layer flattened memo, compositor size provider (project dims, FALLBACK 1920x1080) |
| `app/src/lib/previewRenderer.ts` | Flattened-only physic-paint branch (CMP-01) | ✓ VERIFIED | Collect/hasDrawable/draw all via `getFlattenedFrame`; D-28 placeholder/stripe-fill arm and the superseded single-track resolver excised (D-09); parent save/compositeOp/globalAlpha/drawImage/restore block unchanged and exclusive (CMP-03) |
| `app/src/lib/exportEngine.ts` | Participating-tracks export preflight (CMP-05) | ✓ VERIFIED | `findUnresolvedExportLoop` (`:71`, called `:172`) scans `participatingPaintTracks(document)`; hidden/solo-excluded tracks never false-block; deterministic ordering |
| `app/src/components/physic-paint/view/PhysicsPaintProgramMonitor.tsx` | Studio program monitor leaf (CMP-01/05, D-05/D-09) | ✓ VERIFIED | Flattened composite (editing = active-track-excluded, playback = full), onion ghosts above sourced from active-track raw frames, missing-source capsule compare-then-write, subscribes to both version clocks |
| `app/src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` | 22-row pixel acceptance matrix suite (CMP-06) | ✓ VERIFIED | `59f239ab` — 22 recording-context row tests, all green (recorded) |
| `.planning/phases/48-.../48-VALIDATION.md` | Validation strategy | ✓ VERIFIED | `status: validated`, `nyquist_compliant: true`, `wave_0_complete: true` |
| `.planning/phases/48-.../48-SECURITY.md` | Threat register | ✓ VERIFIED | 25/25 threats closed (audit trail 2026-08-30), `threats_open: 0`, no accepted risks, approval verified |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Studio program monitor | `getFlattenedFrame` / `getFlattenedFrameExcluding` | Monitor leaf draws the shared flattened record (no Studio-side composition) | ✓ WIRED | `PhysicsPaintProgramMonitor.tsx` (48-05, `d0e5af53`); `getFlattenedFrameExcluding` + `excl:` key term in `physicPaintStore.ts`/`efxPaintCompositeCache.ts` |
| Main preview renderer | `getFlattenedFrame` | `collectPhysicPaintFrameSources` → per-call memo → draw branch | ✓ WIRED | `previewRenderer.ts:202-266` (48-03, `149e2764`/`26917b16`) |
| Export renderer/preflight | Flattened record + participating set | `collectRotoPaperTextures` → preflight → `getFlattenedFrame` | ✓ WIRED | `exportRenderer.ts:445-449`; `exportEngine.ts:71,172` (48-03, `91d1ab4d`/`b5d6aa09`) |
| Compositor composite pass | `participatingPaintTracks` | Draw set + flattened-key content-term filter share one predicate | ✓ WIRED | `efxPaintCompositor.ts` + `efxPaintCompositeCache.ts` (48-04, `b60c587c`) |
| Background resolution | Composite pass | `resolveBackgroundFrame` (48-02 union) + `resolveBackgroundSourceImage` decode port | ✓ WIRED | 48-04 `30be89cc`/`ca0a093d` |
| Missing report | Status capsule | Monitor publication effect (compare-then-write both directions) | ✓ WIRED | 48-05 `60b56342`; genuine-dangling filter `eee43a65` (UAT-E) |
| Parent layer draw sites | Unchanged parent compositor | Parent opacity/blend applied once, compositor never reads parent properties | ✓ WIRED | `previewRenderer.test.ts` parent-application row; matrix row 20 (`59f239ab`) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Flattened record | `renderedFrame` raster | `_resolveFlattenedFrame` → production compositor ports (real decoded rasters) | Yes — real raster per (layer, frame); frozen record | ✓ FLOWING |
| Per-track content | content revision + raster | D-10 precedence (`getRotoPhysicalRenderSource` → `getFrame`), store-side decode cache | Yes — real bytes/canvas; pending decode → null this tick | ✓ FLOWING |
| Background frame | `EfxPaintBackgroundFrameResolution` | `deriveEfxPaintBackgroundResolution`/`resolveEfxPaintBackgroundFrame` over real clip records | Yes — content/gap/missing union per frame | ✓ FLOWING |
| Missing report | `missingRefs` | `knownSources` oracle (real registry sets) | Yes — typed refs, never fabricated | ✓ FLOWING |
| Fond instruction | `document.background.fallback` | `_resolveDocumentFondInstruction` (`physicPaintStore.ts:1187`) | Yes — single authority for the flattened surface | ✓ FLOWING |

### Behavioral Spot-Checks

Recorded results only — no test, typecheck, build, or cargo command was executed for this backfill.

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Matrix suite (22 rows) | `vitest run src/efx-paint/compositor/efxPaintCompositorMatrix.test.ts` (recorded in 48-06-SUMMARY) | 22 passed, all green | ✓ PASS (recorded) |
| Compositor suites at plan closes | recorded in 48-01/48-02/48-04 Self-Checks | 20/20 (48-01) → 33/33 (48-02) → 46/46 (48-04) | ✓ PASS (recorded) |
| Full suite snapshots | recorded in per-plan Self-Checks | 2979 (48-01) → 2992 (48-02) → 3005 (48-04) → 3024 passed, 0 failed (48-03) | ✓ PASS (recorded) |
| Typecheck | `pnpm --dir app run typecheck` (recorded) | exit 0, clean at every plan close | ✓ PASS (recorded) |
| Validation strategy | 48-VALIDATION.md | `validated` / `nyquist_compliant: true` | ✓ COMPLIANT |
| Security | 48-SECURITY.md | 25/25 threats closed 2026-08-30; `threats_open: 0` | ✓ VERIFIED |
| Native UAT (48-06, 2026-08-30) | recorded in 48-06-SUMMARY.md | Pixel parity Studio/main/export, straight-alpha (50% white, no dark halo), parent 25%, missing-source surface, playback smoothness, blend/opacity, paper fond — confirmed live by the user | ✓ APPROVED (recorded) |
| Background-row UAT (deferred from 48-06) | recorded in 49-VERIFICATION.md | Discharged: parts 1-5, 7 approved in the Phase 49 phase-closing native UAT | ✓ APPROVED (recorded) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| CMP-01 | 48-01, 48-03, 48-05 | One shared internal composition path resolves all Paint tracks into one deterministic per-frame flattened raster for Studio preview and flattened output | ✓ SATISFIED (with recorded caveats) | `getFlattenedFrame` single seam consumed by preview (`previewRenderer.ts:210/266`), export (`exportRenderer.ts:445-449`), and the Studio program monitor (48-05); matrix suite + UAT part 1. Caveats: fond preload-gate reliance (`coincidental_reliance_items`, Anti-Patterns #2); DOC-05 offline reopen carried to Phase 53 (does not drive a partial on its own — plan rule 4). |
| CMP-02 | 48-01 | Internal hide/solo truth table is applied (no solo → all visible; solo → visible+soloed only; hide wins over solo) | ✓ SATISFIED (with recorded divergence warning) | `efxPaintHideSolo.ts:30-43` + truth-table tests + matrix rows; recorded on the authoritative flattened composition surface. The Studio live-surface divergence (`previewRenderer.ts:95` vs `efxPaintHideSolo.ts:30/37`) is recorded in Anti-Patterns #1 and deferred to Phase 53 (TML-04/CMP-02) — never silently waved through. |
| CMP-03 | 48-01, 48-03, 48-06 | Internal track opacity and blend mode applied once inside EFX Paint; parent opacity/blend applied once by the main editor (never double-applied) | ✓ SATISFIED | D-01 op-order test; parent sites unchanged → 25% contract (`previewRenderer.test.ts` parent row, matrix row 20); straight-alpha structural contract (D-02); UAT part 4. |
| CMP-04 | 48-01, 48-04 | Track cache key includes track revision and composition dependencies; parent cache invalidates when any participating track/clip/source/fallback changes | ✓ SATISFIED | Derived flattened key (`b4f16497`) + participating-only content terms (`b60c587c`) + invalidation matrix rows 1-7 with per-row RED→GREEN gates (`09f9f4d9`/`b60c587c`). |
| CMP-05 | 48-01, 48-03, 48-05 | Missing source/asset states are explicit and recoverable | ✓ SATISFIED | D-09 transparent raster + `missingRefs` report (never placeholder pixels); export preflight hard block generalized to `participatingPaintTracks(document)` (48-03, `b5d6aa09`); status-capsule publication (48-05, `60b56342`); genuine-dangling-only filter (48-06 `eee43a65`, UAT-E). |
| CMP-06 | 48-02, 48-04, 48-06 | The pixel acceptance matrix passes (opaque/semi-transparent/multiply/screen/overlay/add, hidden/soloed, empty upper frame, Background loops, gaps, parent opacity/blend) | ✓ SATISFIED | 22-row recording-context suite (`59f239ab`, all green, recorded); Background adapter/step unit rows (48-02/48-04); native UAT parts 1-2 parity + straight-alpha. |

All six CMP requirements are accounted for; no orphans. Each of the six 48-0x summaries carries the hyphenated `requirements-completed` frontmatter field: 48-01 `[CMP-01, CMP-02, CMP-03, CMP-04, CMP-05]`, 48-02 `[CMP-06]`, 48-03 `[CMP-01, CMP-03, CMP-05]`, 48-04 `[CMP-04, CMP-06]`, 48-05 `[CMP-01, CMP-05]`, 48-06 `[CMP-03, CMP-06]` — the union covers all six requirements. (The v1.0.0 audit's "SUMMARY frontmatter carries no requirements_completed field" refers to the underscore spelling; the hyphenated field is present on all six.) One summary-record typo noted: 48-02-SUMMARY records Task 2 GREEN as `c217aaea`; the resolving commit is `c2172aea` (git-verified at write time).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/src/lib/previewRenderer.ts` vs `app/src/efx-paint/compositor/efxPaintHideSolo.ts` | `previewRenderer.ts:95` vs `efxPaintHideSolo.ts:30,37` | Hide/solo truth-table divergence: `resolvePhysicPaintTrackVisibility` arms solo over ALL tracks (`document.tracks.some(candidate => candidate.solo === true)`), while `participatingPaintTracks` arms solo only over VISIBLE tracks (`track.visible !== false && track.solo === true`) | ⚠️ Warning | A hidden+soloed track with no visible soloed track makes the Studio live surface (Studio live-engine visibility `PhysicsPaintStudio.tsx:2373`, monitor empty-state `:3546`) show nothing while the flattened composite still renders the visible tracks. Recorded (audit integration warning, TML-04/CMP-02); Phase 53 follow-up — align the predicate or add a truth-table contract test. The flattened composition surface itself applies the locked table correctly. |
| `app/src/lib/previewRenderer.ts` vs `app/src/stores/physicPaintStore.ts` | `previewRenderer.ts:189,195` vs `physicPaintStore.ts:1187` | Fond paper preload gate sources per-track metadata: `collectRotoPaperTextures` reads `getRotoBackgroundMetadata(activeTrack)` while the fond authority is `document.background.fallback` (`_resolveDocumentFondInstruction`) | ⚠️ Warning | Correctness relies on the parallel write in `useRotoBackgroundMetadataSync` (`PhysicsPaintStudio.tsx:2219`, imported `:91`) — divergent for non-active tracks and fragile if the sync lags the export gate (`exportRenderer.ts:445`). Recorded (audit integration warning, BKG-07/BKG-09/CMP-01); carried as a coincidental-reliance item. |

No TBD/FIXME/XXX/HACK/PLACEHOLDER markers in the phase-48 modules (grep clean at write time). No stub implementations. No `useState` in new Studio code (signal-driven per efx-preact-reactivity). The D-28 marked-placeholder/stripe-fill arm is excised from the flattened path (D-09).

### Human Verification Required

None outstanding. The 48-06 phase-closing native UAT was confirmed live by the user (recorded 2026-08-30): UAT A/B (track-switch buffer reset, hidden-active engine surface — `157dfa19`), UAT-C (tracks blend among themselves then over the paper — `9d1f5d6e`/`13faf50f`), UAT-D (composite content extent playback range — `bdace1f7`), UAT-E (genuine-dangling missing-source capsule — `eee43a65`), plus pixel parity, straight-alpha, parent 25%, playback smoothness, blend/opacity, and paper fond. The Background-row native UAT deferred from 48-06 (D10) was discharged in the Phase 49 phase-closing UAT — 49-VERIFICATION.md: "This also discharged the Background-row native UAT deferred from Phase 48." The DOC-05 offline reopen path is carried to the Phase 53 native UAT (audit 2026-09-11) and does not block this phase.

### Gaps Summary

No gaps. All 5 roadmap success criteria are verified and all six CMP requirements are satisfied, each backed by cited file paths / line references / git-verified commit hashes and recorded test or native-UAT results. Two recorded caveats accompany the verdicts and are Phase 53-adjacent rather than phase gaps: (1) the fond paper preload-gate reliance (CMP-01, recorded in `coincidental_reliance_items` and Anti-Patterns) and (2) the Studio-live-surface hide/solo divergence (CMP-02, recorded in Anti-Patterns; Phase 53 follow-up per audit recommendation 1). Neither falsifies its requirement's text on the authoritative flattened composition surface. The Background-row UAT deferred by 48-06 is discharged. No test was re-run for this backfill; no source file was modified; every commit hash cited above resolves via `git log -1` at write time.

---

_Verified: 2026-09-11T08:58:01Z_
_Verifier: Claude (gsd-executor) — backfill compiled from recorded phase evidence (48-01..48-06 summaries, 48-VALIDATION.md, 48-SECURITY.md, 49-VERIFICATION.md, ROADMAP.md)_
