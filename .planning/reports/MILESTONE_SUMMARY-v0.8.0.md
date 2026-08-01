# Milestone v0.8.0 — Project Summary

**Generated:** 2026-08-01
**Purpose:** Team onboarding and project review
**Audit status:** `tech_debt` (final audit 2026-08-01 — 56/56 requirements, 21/21 phases, 9/9 integration flows, 6/6 E2E flows, zero critical blockers)

---

## 1. Project Overview

**EFX-Motion Editor** is a macOS desktop application (Tauri 2.0 + Preact) for creating cinematic stop-motion films from photography keyframes. Prior milestones (v0.1.0–v0.7.0) shipped the complete editing pipeline: sequences, timeline, layers, FX, audio, GLSL shaders, transitions, paint/rotopaint, brush FX, motion blur, bezier editing, and multi-format export.

**v0.8.0 "Standalone Physics Paint"** began with a narrow goal: prove `packages/efx-physic-paint` — an interactive physics-based paint engine — could run and be tested as a standalone app/window *before* attempting editor integration. This was the recovery strategy after the v0.7.0 Phases 27-32 failure, where a headless batch-render adapter approach proved architecturally wrong (it destroyed physics simulation quality and was O(n²)).

The milestone grew far beyond that seed goal. Over 21 phases it delivered a **full Physics Paint Roto (rotoscoping) animation system** integrated with the editor:

- Standalone physics paint window with rebuilt production-grade UI, session save/load, and PNG/sequence export
- A typed parent/window bridge (Tauri + postMessage fallback) connecting the standalone window to the editor
- Frame-cached Roto workflow: painted frames are flattened to PNG alpha caches, composited in preview and export, and survive project save/load
- A deterministic **physical-frame timeline model** — every real Roto key has one stable `keyId` and one physical `appFrame` — with atomic acknowledged transactions for Insert/Delete/Drag/Force Spacing/Undo/Redo
- Generated render-only interpolation in-betweens between real keys
- Roto script system: Copy Script / Apply Script, a durable project-scoped script library with WebP thumbnails, and a Play Script renderer that replays recorded strokes sequentially like one artist's hand
- Final timeline UI (fixed 155px strip, icon-only guarded actions, status capsule, real-key diamond markers on the EFX Motion layer)
- Multi-select of real keys with group drag/delete/Force Spacing, group Copy/Paste, and a Cut tool
- A render-path performance overhaul (canvas-first paint, localized rendering, playback UI freeze) that made the Studio fast with many keys

**Explicit boundary maintained throughout:** Physics Paint is an *additional* tool. perfect-freehand remains the Basic fast/direct paint path and p5.brush remains the FX brush path. Zero physic-paint references exist in the Basic/FX paint code paths (verified by integration checker).

## 2. Architecture & Technical Decisions

### Standalone window + transport (not headless adapter)
- **Decision:** Run efx-physic-paint as a standalone interactive window connected to the editor via a typed parent/window bridge.
  - **Why:** The v0.7.0 post-mortem proved headless batch replay (`renderFromStrokes`) kills physics quality — the engine requires incremental interactive simulation.
  - **Phase:** Milestone-level (34–35), bridge hardened through 36.x–38.x.

### Dual-channel bridge with exact acknowledgement
- **Decision:** Tauri `emit`/`listen` as the primary channel with a `postMessage` fallback for browser dev; every apply operation is matched by `operationId` acknowledgement with idempotent replay.
  - **Why:** Child windows must never present provisional state as accepted; the parent is the sole authority for persistence.
  - **Phase:** 36.14 (coordinator), G-01 closure in quick 260801-azb added the missing Tauri `listen` branch for `physic-paint:seek-frame`.

### Physical-frame authority (the core v0.8.0 model)
- **Decision:** Stable `keyId` + direct physical `appFrame` is the *only* durable Roto ownership coordinate. All legacy source/display/projection/segment-spacing timing paths were deleted with no compatibility layer.
  - **Why:** Pre-36.14 dual-model timing was the root cause of recurring Insert/Delete/Paste regressions (blank keys, deleted keys reappearing, stale caches).
  - **Phase:** 36.14 (cutover), enforced through 37/38.

### One atomic coordinator for all edits
- **Decision:** Insert, Delete, Drag, Force Spacing, Duplicate, Paste, Play Script, and Undo/Redo all funnel into a single `executePhysicalEdit` coordinator: immutable snapshot staging → one parent publication → exact acknowledgement matching → accepted-only history → complete rollback on any failure.
  - **Why:** Guarantees no partial mutation is ever visible; exactly one Undo/Redo entry per operation.
  - **Phase:** 36.14 Plans 04-05, extended in 36.14-20/19, 37, 38.

### Derived interpolation, enabled-state-only persistence
- **Decision:** Interpolation persists only its enabled flag; generated cells are derived at runtime as exactly the strict interior between adjacent real keys (`max(0, right-left-1)`).
  - **Why:** Generated frames must never become durable timing truth — real keys are the only editable authority.
  - **Phase:** 36.12 (generation), 36.14 (derived model).

### Automatic live pixel caching
- **Decision:** Completed Roto mutations automatically capture immutable flattened alpha pixels bound to source-frame monotonic revisions — no `Save current` button, no save-on-leave, no navigation blocking.
  - **Why:** Manual save lifecycle (36.6) was friction; source-bound revisions make stale async work unable to overwrite newer pixels.
  - **Phase:** Quick 260714-ail, superseding Phase 36.6.

### Cached PNG as durable truth
- **Decision:** Saved Roto frames are flattened PNG alpha caches; reopening a cached key shows it as a full-strength visual reference (or additive repaint base), never editable stroke restoration.
  - **Why:** Phase 36.3 recovery chose the smallest trustworthy durable core after 36.2 failed; flattened pixels are simple, portable, and preview/export share them by construction.
  - **Phase:** 36.3, repaint semantics in 36.11.

### Signals/controllers as the state boundary (no XState)
- **Decision:** A compact Preact-Signals Roto session/key state boundary owns Roto coherence; `PhysicsPaintStudio` is an adapter for UI wiring, bridge, and engine calls.
  - **Why:** PhysicsPaintStudio had grown into a god-component with scattered useState/useRef/useEffect orchestration causing repeated regressions.
  - **Phase:** 36.8; validated enough that the planned state-machine phase (36.15-old) was removed as obsolete.

### Canvas-first render path with localized rendering
- **Decision:** Navigation paints the engine canvas in the same synchronous tick *before* any Preact propagation; UI updates flush through a per-frame rAF scheduler; playback freezes UI except canvas + nav pill; static chrome (TopBar, ToolRail, right panel, strip) is memoized so frame changes re-render only the timeline.
  - **Why:** With many keys, per-frame O(N) model rebuilds and full-Studio re-renders made navigation take ~1s; after the overhaul the user verdict was "work now! its fast!".
  - **Phase:** 38.1 (18 plans).

### Roto Script Play fusion
- **Decision:** The standalone "Play Paint" algorithm was merged into the Roto SCRIPTS system; Play Script replays recorded strokes sequentially (length-weighted, one-hand) and commits one parent-authoritative real-key batch.
  - **Why:** Two parallel Play workflows were confusing; the script library (durable JSON presets + WebP thumbnails) is the single home.
  - **Phase:** Quick 260717-m9k, integrated in 36.14 Plans 25-26.

### Production → native UAT → regression tests
- **Decision:** Ship production first, gate on user-owned native UAT, and only then write regression tests around the approved behavior.
  - **Why:** Writing tests against unapproved behavior produced large stale-test debt in 36.14 (73 typecheck errors, 85 failing tests on retired contracts, transferred in Plan 30).
  - **Phase:** 36.14 (D-30), 37 (D-18), 38 (D-15).

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 34 | Standalone Demo Shell | Complete | Launch and iterate on a package-local physics paint demo from repo-root pnpm scripts |
| 35 | Interactive Physics Paint Controls | Complete | Live canvas with paint/erase tools, settings, diagnostics, and first apply-back to the editor |
| 36 | UI Rebuild, Session Persistence, Output Proof | Complete | Production-grade 5-region Studio UI; JSON session save/load; PNG + manifest export |
| 36.1 | Play-Script Timeline Markers & Sequential Playback | Complete | Saved Play ranges as timeline markers; scrubber-aware reopen; sequential one-hand stroke rendering |
| 36.2 | Roto Paint Enhancements (cache-first) | **Failed/superseded** | Over-scoped cache-first redesign; abandoned by design and used as recovery input for 36.3+ |
| 36.3 | Roto Durable Core Recovery | Complete | One painted Roto frame cached into EFX Motion, previewed, and preserved through save/load |
| 36.4 | Roto Explicit Close Behavior | Complete | Dirty close offers discard/cancel/save-close with non-stuck recovery |
| 36.5 | Roto Cell Semantics | Complete | Timeline cells distinguish empty/cached/current/generated/background/dirty with non-color cues |
| 36.6 | Roto Save On Leave | Complete → superseded | Historical; replaced by automatic live pixel caching (quick 260714-ail) |
| 36.7 | Roto Key Utilities | Complete | Duplicate/Insert/Delete/Copy/Paste real keys with clean cache/cell/canvas state |
| 36.8 | Roto State Refactor | Complete | Preact-Signals Roto session boundary extracted from PhysicsPaintStudio |
| 36.9 | Roto Cached Playback Auto-Play | Complete | Play/Stop loop over real cached keys with fps control and Space toggle |
| 36.10 | Missing Background Preview/Export | Complete | Missing frames render transparent or background-only with preview/export parity |
| 36.11 | Repaint Cached Real Key | Complete | Additive repaint over cached alpha base without restoring old stroke scripts |
| 36.12 | Generated Interpolation | Complete | Render-only in-betweens between real keys with stale regeneration |
| 36.13 | Dynamic Interpolation Spacing | Complete | Per-segment spacing overrides survive toggles, save/load, preview, export |
| 36.14 | Deterministic Physical-Frame Cutover | Complete | Stable keyId + physical appFrame authority; one acknowledged transaction for every edit |
| 36.15 | Roto Timeline Final UI | Complete | Fixed 155px strip, pill control groups, icon actions, status capsule, layer key markers |
| 37 | Multi-Select Physical Roto Keys | Complete | Select All + group drag/delete/Force Spacing as single atomic transactions |
| 38 | Multi-Copy/Paste & Tooltip Polish | Complete | Group Copy/Paste with fresh identities; capsule idle context; viewport-aware multiline tooltips |
| 38.1 | Studio Render-Path Performance | Complete | Canvas-first paint, localized rendering, playback UI freeze — verified 20/20 |

**Plus 20 quick tasks**, including: automatic live pixel caching (260714-ail), per-brush 10-level Undo/Redo (260715-j3q), Copy/Apply Script (260715-kgf), durable script library (260716-dby), Play fusion (260717-m9k), single-key drag (260718-m2f), Cut tool (260731-9l0), Apple signing preparation (260730-mn0), and the G-01 Tauri frame-sync closure (260801-azb).

## 4. Requirements Coverage

**56/56 v0.8.0 requirements satisfied** (final audit 2026-08-01). All groups:

- ✅ Runnable standalone demo (RUN-01..03) — Phase 34
- ✅ Interactive controls & diagnostics (PAINT-01..04, DIAG-01) — Phase 35
- ✅ UI rebuild / persistence / output (UI-REBUILD-01/02, SAVE-01/02, OUT-01/02) — Phase 36
- ✅ Automatic live pixel caching (36.6-AC-01..06, FB-01) — quick 260714-ail
- ✅ Missing background rules (36.10-*) — Phase 36.10
- ✅ Editor integration baseline (EDIT-01..05) — Phases 36.1–36.13; EDIT-02 closed by quick 260801-azb
- ✅ Script reuse (ROTO-SCRIPT-COPY/APPLY) — quick 260715-kgf, 14/14 native UAT
- ✅ Physical timeline (36.14-PHYSICAL-IDENTITY, DERIVED-INTERPOLATION, ATOMIC-FRAME-MAPPING, RIPPLE-INSERT-DELETE, RIPPLE-DRAG, FORCE-SPACING, DOWNSTREAM-PARITY, UI-INTEGRATION, UAT-THEN-REGRESSION) — Phase 36.14
- ✅ Final UI (36.15-* ×7) — Phase 36.15
- ✅ Multi-select (37-* ×9) — Phase 37
- ✅ Group copy/paste + tooltips (38-* ×7) — Phase 38
- ✅ Render-path performance (38.1 decision IDs) — Phase 38.1, verified 20/20

**Audit verdict:** `tech_debt` — everything satisfied and natively UAT-approved; only explicitly-authorized deferred items remain (see §6). No orphans, no unsatisfied requirements, no critical blockers.

## 5. Key Decisions Log

The highest-leverage decisions (full detail in PROJECT.md Key Decisions table and STATE.md Accumulated Context):

| ID/Phase | Decision | Rationale |
|----------|----------|-----------|
| Milestone | Standalone window + typed transport; headless adapter permanently excluded | Batch replay destroys physics quality (v0.7.0 failure) |
| 36.3 | Cached Roto PNG is the durable truth; reopen = visual reference, not stroke restore | Smallest trustworthy recovery after 36.2 failed |
| 36.5 | Cell semantics stay MVP-only with non-color visual cues | Trust communication without reopening timeline redesign |
| 260714-ail | Completed-mutation automatic live pixel caching with source-bound monotonic revisions | Removes all manual save UI; stale async work can't overwrite newer pixels |
| 36.7 | Key utilities as controller-backed real-key transactions | Deterministic cache/cell/canvas coherence |
| 36.8 | Signals/controllers as the Roto state boundary | Studio god-component was the regression root cause |
| 36.9 | Playback sequences only real cached keys | Eliminates empty trailing frames |
| 36.11 | Repaint merges cached alpha + live alpha additively on save | Add paint without losing prior work |
| 36.14 | Stable keyId + direct appFrame sole durable coordinate; zero compatibility shims | Dual-model timing caused the recurring regressions |
| 36.14 | One acknowledged coordinator; accepted-only history; complete rollback | No partial mutation ever visible |
| D-29 | Occupied-boundary drag preserves source gap, ripples only at destination | Locked physical examples: `A@1,C@5,D@8,B@9` |
| D-30 | Recovery track: bounded-static fixes → read-only review → user-owned native UAT gate | Exact native approval is the only oracle |
| 36.15 | Fixed 155px strip geometry; capsule replaces status stack; LOG sole diagnostic surface | Approved UI-SPEC; no business logic in the view |
| 37 | Selection identity is keyId-only, session-local, never persisted | Survives physical retiming; never crosses the bridge |
| 38 | One shared clipboard slot as `single \| group` discriminated union; group paste anchors at min sourceAppFrame, all-empty-or-reject | Atomic MVP with fresh keyIds and one Undo/Redo action |
| 38.1 | Canvas-first same-tick paint + rAF UI coalescing + render localization | ~1s navigation stalls eliminated; user: "work now! its fast!" |
| 260730-mn0 | Apple Developer ID signing prepared; credentialed release deferred post-milestone | Release intentionally scheduled after audit/completion |

## 6. Tech Debt & Deferred Items

### Explicitly authorized deferred items (from the final audit)

- **Deterministic resolver regression tests** — locked physical examples (insert/delete-slot, force-spacing, D-29 occupied-boundary drag) authorized as a follow-up test plan, not yet scheduled.
- **Code-review follow-ups** — CR-01 (dead export-resume path), CR-02 (blank blend in-betweens after Play Script commit — prioritize, touches approved blend behavior), WR-01..04 routed to a follow-up quick.
- **Nyquist reconciliation** — 10 phases carry draft VALIDATION.md status (coverage TODO, not compliance failure); 11 phases compliant.
- **Roto cache footprint** — measure and reduce many-frame cache weight (PNG alpha encoding already exists).
- **macOS credentialed release** — Developer ID signing/notarization/Gatekeeper validation; preparation complete in quick 260730-mn0, execution scheduled post-completion per `docs/macos-signed-release.md`.

### Known inert seams (non-blocking, cleanup candidates)

- Legacy source/display model still feeds `useRotoTimelineActions.getModel` (PhysicsPaintStudio.tsx:503) — inert dual-model seam.
- Legacy optional fallbacks persist: `displayFrame ?? appFrame` in rotoOnionPreview.ts, `sourceFrame ?? startFrame` in applyCanvas/deleteRotoFrame, unused legacy capture overload in rotoLivePixelCacheTransactions.ts.
- I-01: `FxTrackLayout.playScriptMarkers` has a renderer consumer but no producer — dead code from the retired 36.1 Play-marker path.
- I-02: `physicPaintPlayScriptBridge.test.ts` tests physicPaintBridge.ts — misleading filename only.
- I-03: dev-fallback frame sync posts to `window.opener` with `'*'` targetOrigin (Tauri production unaffected).
- Phase 38/38.1 requirement and decision IDs were never registered in REQUIREMENTS.md (planning-data gap; both phases verified passed).

### Failed work retained as evidence (do not resume)

- **Phase 36.2** — cache-first Roto redesign, failed/superseded; gap-closure plans 36.2-11/12/13 closed as rejected.
- **Historical 36.14 Plans 12-18** — superseded by the D-30 recovery track; retained as non-executable records.
- **Phases 27-32 (v0.7.0)** — headless adapter approach, permanently excluded.

### Pre-existing debt carried from earlier milestones

- S key shortcut lacks `isPaintEditMode()` guard (low severity, from v0.6.0)
- 2 medium export edge cases (content-overlay preload, FX generator frame offset — from v0.2.0)
- Coalescing API partially wired (motion path drag only — from v0.1.0)
- `canUndo`/`canRedo` signals exported but unconsumed by UI (from v0.1.0)

## 7. Getting Started

**Prerequisites:** macOS, pnpm, Rust toolchain (for Tauri).

**Run the editor:**
```bash
pnpm install
pnpm dev        # Tauri dev build of EFX Motion Editor (app/)
```

**Run the standalone physics paint demo:**
```bash
pnpm dev:paint  # package-local Vite/Preact demo for packages/efx-physic-paint
```

**Tests and gates:**
```bash
pnpm vitest run      # app tests — never watch mode
pnpm typecheck
pnpm build
```

**Key directories:**
- `app/` — the Tauri + Preact editor (was `Application/` pre-v0.7.0)
- `app/src/components/physic-paint/` — Physics Paint Studio, Roto timeline, hooks, resolver/coordinator
- `app/src/lib/physicPaintBridge.ts` — parent/window bridge authority
- `packages/efx-physic-paint/` — the standalone physics paint engine package
- `.planning/` — GSD artifacts: ROADMAP, REQUIREMENTS, phases/, quick/, milestones/, v0.8.0-MILESTONE-AUDIT.md
- `docs/macos-signed-release.md` — deferred credentialed release runbook

**Where to look first:**
1. This summary → `.planning/v0.8.0-MILESTONE-AUDIT.md` for verified coverage evidence
2. `PROJECT.md` for the living architecture/decision record
3. `ROADMAP.md` Phase 36.14 section for the canonical physical-frame model contract
4. For Roto behavior: `physicsPaintRotoPhysicalResolver.ts` (pure timeline resolver) and `useRotoPhysicalEditCoordinator.ts` (atomic transaction coordinator)

**Conventions to know:**
- Preact + Signals (not React/Redux); prefer signals/computed over useState/useEffect for shared reactive state
- pnpm workspaces; no npm
- Production → native UAT → regression tests (never write tests against unapproved behavior)
- No backward-compatibility shims on format changes — clean breaks only
- GSD planning artifacts and conversation in English

---

## Stats

- **Timeline:** 2026-06-08 → 2026-08-01 (~8 weeks)
- **Phases:** 21 / 21 complete (one intentionally failed/superseded: 36.2)
- **Plans:** 164 / 170 summaries present (96%)
- **Quick tasks:** 20 completed
- **Commits:** 1,351
- **Files changed:** 2,394 (+437,805 / −194,627)
- **Contributors:** Laurent Marques
- **Requirements:** 56 / 56 satisfied
- **Final gate:** 967 passing app tests + typecheck + production build (Phase 38 closure); 115 app + 58 engine tests at Phase 38.1 closure
