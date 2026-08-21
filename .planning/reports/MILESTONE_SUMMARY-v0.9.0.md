# Milestone v0.9.0 — Project Summary

**Generated:** 2026-08-21
**Purpose:** Team onboarding and project review
**Milestone:** PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity
**Status:** SHIPPED — signed/notarized/stapled macOS release, published as GitHub **Latest** on 2026-08-21 (10 days ahead of the 2026-08-31 target)
**Audit verdict:** `passed` — 38/38 requirements, 12/12 phases verified, integration + E2E wired, Nyquist fully compliant

---

## 1. Project Overview

EFX-Motion Editor is a macOS desktop app for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, layer FX and paint/rotopaint content, draw frame-by-frame with expressive brushes, apply GLSL shaders/transitions, edit audio, preview in real-time, and export as PNG image sequences or video (ProRes/H.264/AV1). The complete stop-motion-to-cinema pipeline must work end-to-end.

v0.9.0 is the **second full release** in the EFX Paint workflow line. It lands after v0.8.0 proved `efx-physic-paint` as a standalone interactive physics-paint window with a deterministic physical-frame Roto timeline. v0.9.0 **closed the loop on the Roto/PlayScript workflow**: scripts auto-hydrate on open, PlayScript gains application modes (progressive vs static/hold) with Loop Clips, the child window can monitor main-editor audio in sync, and the app ships with proper macOS identity and a credentialed signed release. It was delivered **ahead of target** — v0.9.0 published as GitHub Latest on 2026-08-21, ten days before the 2026-08-31 deadline.

**At a glance:**

- **12 phases** (39–44, incl. inserted 43.1–43.6) · **100 plans** · **~948 commits** over **17 days** (2026-08-04 → 2026-08-21)
- **38/38 requirements satisfied**, **12/12 phases verified**, integration + E2E flows wired (the 43→44 signed-artifact boundary was **not** dropped)
- Six automated gates green, a 17-step packaged-app UAT approved, the downloaded artifact verified, and all 15 release stop conditions recorded **not active**
- Tech stack: **Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4 + p5.brush**, pnpm monorepo (`app/` + `packages/efx-physic-paint/`)

---

## 2. Architecture & Technical Decisions

The milestone extended the existing 13-signal-store architecture rather than re-architecting it. The central idea is a **canonical stable-key / loopId identity** that became the single ownership authority for breaks, gaps, Groups, and Loop Clips — every new feature reused existing authority instead of adding a fork.

- **Read-only asset transport boundary (D-04).** EFX Paint receives only monitoring data/commands; the main editor stays the sole authority for audio tracks, assets, offsets, trims, volume, and export. A single-token `efxasset` CSP grant (contract-tested) keeps the transport provenance-locked. *(Phase 41)*
- **Deterministic static/hold rendering** reuses the deterministic Script Motion model — zero variation = stable held drawing, nonzero variation = deterministic per frame, identical inputs → identical output across save/reopen and cache regeneration; no random render-time jitter. *(Phase 43)*
- **One compact derived interval record per Loop Clip, lazily queried per frame.** Virtual occurrences are never materialized; a single typed `real/linked/linked-unresolved/empty` contract lets resolution, preview, playback, and export share one store authority with compile-time exhaustiveness. *(Phase 43)*
- **Stable-key incoming-break ownership** as a complete persisted collection. Intentional gaps are canonical facts owned by a stable real-key identity (never a mask); malformed/stale proposals fail closed and an empty-segment insert is one atomic transaction. *(Phase 43.1)*
- **Leased, parent-authoritative transactions.** Group lifecycle + retained Action recovery use exact-frame copy-on-write, no optimistic publication, and durable Rust Action transactions. A child publishes one complete canonical document only after exact correlated acceptance — fail-closed on any drift. *(Phase 43.2)*
- **Shared pure proposer per operation.** Group delete, Push, and rails-move are recomputed by BOTH the coordinator and the parent bridge, then exact-match on complete state — fail-closed on any mismatch. *(Phases 43.2/43.5/43.6)*
- **Session-only explicit rail-set selection.** Cross-type batch operations share one selection scope with fail-closed reconcile; every batch op is a single atomic history command with exact pre-op selection restore on Undo/Redo. *(Phase 43.6)*
- **Five-surface version single-source (REL-01).** One atomic version bump across 5 surfaces removed the version-drift failure class entirely. *(Phase 44)*
- **Signed release as a first-class phase.** REL-01/02/03 got dedicated gates (six automated gates, 17-step packaged UAT, downloaded-artifact verification, 15-item stop-condition checklist) instead of being improvised at the deadline.

---

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 39 | Scripts Auto-Hydration | ✅ Complete | Saved-project scripts and Save Script appear without manual Refresh (verified by quick 260804-f2q) |
| 40 | macOS Icon + Build Hygiene | ✅ Complete | Legible macOS icon regenerated from approved artwork; `chunkSizeWarningLimit` 1100 documented and test-pinned |
| 41 | EFX Paint Audio Preview + Monitoring Toggle | ✅ Complete | Read-only main-editor audio in the child, frame-synchronized (anchor model, 40ms drift corrector, loop-wrap re-seek), session-local toggle |
| 42 | PlayScript Application Modes + Color Override | ✅ Complete | Progressive vs static/hold modes; application-time color-only override; Hold Loop intent (Repeat/Infinity) surfaced |
| 43 | Hold Loop Clips + Integrated Loop Rail | ✅ Complete | Persistent linked Loop Clips on one compact derived interval; filmstrip capsule; linked preview/export parity; unresolved-loop export fail-fast |
| 43.1 | Intentional Gap Insert + Local Interpolation Breaks | ✅ Complete | Stable-key incoming-break ownership; atomic empty-segment insert |
| 43.2 | Group Stabilization + Action Lifecycle | ✅ Complete | Leased parent-authoritative transactions; durable Rust Action recovery; exact-frame copy-on-write |
| 43.3 | Group Drag Within Free Space | ✅ Complete | Rigid single-key drag routing via the `isMoveMember` gate (paint-vs-move split) |
| 43.4 | Derived Key Groups + Scissor Breaks | ✅ Complete | Derived Key Rail splitting mid-interpolation; owns the next real key's break |
| 43.5 | Timeline Toolbox + Directional Push Tools | ✅ Complete | ToolCase popover (Interpolation + Key Spacing); mode-toggle Push as one rigid atomic translation |
| 43.6 | Multi-Rail Selection + Batch Operations | ✅ Complete | Session-only rail-set selection; batch Move/Delete/Key Spacing/Solo; one atomic command per batch |
| 44 | Integrated UAT + Signed Release | ✅ Complete | Five-surface version single-source; signed/notarized/stapled release published as GitHub Latest |

**12/12 phases verified.** All six inserted 43.x phases carry Nyquist-validated VALIDATION.md files (11 COMPLIANT, 0 outstanding).

---

## 4. Requirements Coverage

**38/38 requirements satisfied** (0 unsatisfied, 0 orphaned), mapped to Phases 39–44. Full traceability is in `v0.9.0-REQUIREMENTS.md`; the audit cross-referenced VERIFICATION, SUMMARY frontmatter, and the traceability table.

| Requirement group | Phase | Status |
|-------------------|-------|--------|
| HYDR-01..06 — Scripts Auto-Hydration (no polling/timing hacks) | 39 | ✅ 6/6 |
| ICON-01..04 + BUILD-01..03 — macOS identity + build hygiene | 40 | ✅ 7/7 |
| AUDIO-01..06 — read-only EFX Paint audio preview | 41 | ✅ 6/6 |
| PLAY-01..04 — PlayScript application modes + color override | 42 | ✅ 4/4 |
| HOLD-01..06 — deterministic static/hold + linked Loop Clips | 43 | ✅ 6/6 |
| GAP-01..06 — intentional gap insert + interpolation breaks | 43.1 | ✅ 6/6 |
| GRP-01..08, GDRAG, KRAIL, SCISSOR, KDEL, HIST, TERM, REG, GUARD, TBX/PUSH, RSET/BMOV/BDEL/BSPC/SOLO | 43.2–43.6 | ✅ all satisfied |
| REL-01 (6 gates), REL-02 (17/17 UAT), REL-03 (downloaded-artifact + 0 stop conditions) | 44 | ✅ 3/3 — closed |

**Deferred (documented for later):** LOOP-01 ping-pong loops, LOOP-02 combined progressive-plus-hold scheduler, PAINT-01 internal multi-track, PAINT-02 reveal masks (v1.0 scope). **Out of scope** explicitly: audio editing inside EFX Paint, per-script persisted color overrides, web-oriented bundle splitting, broad store-cycle refactors, online AI generation, Windows/Linux builds.

---

## 5. Key Decisions Log

From the CONTEXT/decision records and the milestone audit — the decisions that shaped v0.9.0's architecture:

- **D-04 one-way asset-transport boundary (Phase 41):** Main editor owns audio fully; EFX Paint receives only revisioned monitoring. Single-token `efxasset` CSP grant, contract-tested → keeps the child window read-only and provenance-locked.
- **Static/hold + color override as one renderer entry point, additive to progressive (Phase 42):** Static/hold must never fork or regress the progressive module — progressive was left byte-untouched; one source cycle per Apply.
- **Loop Clip persistence joins the canonical revision fingerprint + Undo/Redo snapshot (Phase 43):** loop-only edits are revision-visible and undoable; v0.8.1 documents load unchanged.
- **One compact derived interval record per Loop Clip, lazy per-frame query (Phase 43):** no virtual occurrence is ever materialized; consumers guard the typed union exhaustively.
- **Stable-key incoming-break ownership as a complete persisted collection (Phase 43.1):** interpolation breaks are canonical facts owned by stable real-key identity, never a mask; malformed proposals fail closed.
- **Group lifecycle + Action retention as leased parent-authoritative transactions (Phase 43.2):** exact-frame copy-on-write, no optimistic publication, durable Rust Action transactions, committed-only settlement ledgers.
- **Timeline Toolbox + Push as one rigid atomic multi-object translation (Phase 43.5):** Push is the exclusive multi-object movement owner; Group drag stays local; persistent 43.1 breaks survive; one Undo/Redo.
- **Rail-set selection as a session-only explicit scope (Phase 43.6):** cross-type batch ops share one selection with fail-closed reconcile; exact selection restore on Undo.
- **Five-surface version single-source + credentialed signed release (Phase 44):** version never drifts across surfaces; publication is one-way and auditable; 15-item stop-condition checklist.

*(A full cumulative decision log, including decisions from prior milestones, lives in `PROJECT.md` → "Key Decisions".)*

---

## 6. Tech Debt & Deferred Items

All items below are **non-blocking** and recorded. No critical gaps remain.

- **Release-script warnings (frozen, pre-existing, Phase 44):** `codesign --entitlements :-` deprecation and a ~21 GB worktree preflight walk (forward-compatibility notes on the frozen `scripts/macos-release.sh`).
- **Known spec-vs-implementation divergences (judged against shipped):** truncation label French-spec vs English shipped (`Loop shortened by next clip`); chunk budget spec-1100 vs shipped-1120. Recorded, not "fixed."
- **43.1 deferred hardening (DF-01..04):** cross-resource save transaction, directory sync on cache publication, provenance-only Loop Clip no-op, postMessage origin authentication — parked as non-blocking work.
- **State bookkeeping:** reconcile `init.milestone-op` `completed_phases: 11` / `all_phases_complete: false` against STATE.md's "all phases complete" (handled at `/gsd-complete-milestone`).
- **Carried from earlier milestones:** S-key shortcut lacks `isPaintEditMode()` guard; two export edge cases; partial coalescing API coverage; `canUndo/canRedo` signals unused; Roto cache footprint measurement/compression; legacy source/display model seam; dead `playScriptMarkers` field.

**Deferred requirements:** LOOP-01 ping-pong loops, LOOP-02 combined progressive+hold scheduler (v0.9.x); PAINT-01 multi-track, PAINT-02 reveal masks (v1.0).

**Retrospective lessons feeding forward:** ship the release phase like any feature phase; a derived-interval single contract beats materialization; stable-key identity pays forward; sweep stale artifacts between milestones (161 open at close — same lesson as v0.8.0's 103); make quick-verified phases visible to the readiness oracle.

---

## 7. Getting Started

**Prerequisites:** macOS, pnpm, Rust toolchain (for Tauri).

**Install & run the editor:**
```bash
pnpm install
pnpm dev          # Tauri dev build of EFX Motion Editor (app/)
```

**Run the standalone physics-paint demo:**
```bash
pnpm dev:paint    # package-local Vite/Preact demo for packages/efx-physic-paint
```

**Tests:**
```bash
pnpm --dir app exec vitest run   # (per repo convention — no watch mode)
```

**Key directories:**
- `app/src/` — main editor (Tauri + Preact), 13 reactive signal stores, renderers, panel UI
- `packages/efx-physic-paint/` — standalone physics-paint app/window with the deterministic physical-frame Roto timeline
- `.planning/` — planning artifacts (PROJECT.md, ROADMAP, RETROSPECTIVE, milestone archive, reports)

**Where to look first for v0.9.0 features:**
- PlayScript application modes + color override — Phase 42 (see `42-*/42-*` plans, `VALIDATION.md`)
- Linked Hold Loop Clips + Loop Rail — Phase 43
- Intentional gaps / interpolation breaks — Phase 43.1
- Group stabilization + Action lifecycle — Phase 43.2; group drag 43.3; derived keys + Scissor 43.4; Toolbox + Push 43.5; multi-rail selection 43.6
- EFX Paint audio preview — Phase 41
- macOS identity / build hygiene — Phase 40
- Signed release plumbing — Phase 44 / `scripts/macos-release.sh`

---

## Stats

- **Timeline:** 2026-08-04 → 2026-08-21 (17 days)
- **Phases:** 12 / 12 complete (100 plans)
- **Commits:** 962 (milestone window; single contributor)
- **Requirements:** 38/38 satisfied; 0 unsatisfied; 0 orphaned
- **Audit:** `passed` — 12/12 phases, integration + E2E wired, Nyquist compliant
- **Release:** signed/notarized/stapled macOS artifact, published as GitHub **Latest** ahead of the 2026-08-31 target
