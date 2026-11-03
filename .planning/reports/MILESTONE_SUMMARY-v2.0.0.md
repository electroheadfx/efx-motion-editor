# Milestone v2.0.0 — Project Summary

**Generated:** 2026-11-02
**Purpose:** Team onboarding and project review
**Milestone:** v2.0.0 Multi-Module Paint Workstation (MAJOR)
**Status:** Code complete and audited (`tech_debt` — no open requirement gaps). **Not yet released:** no `v2.0.0` git tag exists; the signed/notarized release must be re-run through the `efx-motion-release` skill after the pre-publish fix `261102-iv5`.

---

## 1. Project Overview

**What this is:** EFX Motion Editor is a macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import photographs, arrange them into timed sequences, add overlay/FX layers, animate with keyframes, draw frame-by-frame with pressure-sensitive paint (including physics and rotopaint), preview in real time on a canvas timeline, and export PNG sequences or video (ProRes/H.264/AV1). It is built with Tauri 2.0 (Rust) + Preact + Preact Signals + Motion Canvas + Tailwind CSS v4.

**Core value:** The complete stop-motion-to-cinema pipeline — import key photographs, arrange timed sequences with FX layers, preview in real time, export as PNG image sequences — must work end-to-end.

**What v2.0.0 set out to do:** Change the product shape into a multi-module paint workstation — a module switcher (Brush | Water color | Krita) over ONE shared Studio engine, shipping Brush + Water color, unlocked by a Preact 11 bump and an engine-1 host split.

**What actually shipped (user-approved pivots during the milestone):** A **single-engine Water color workstation**. Brush/engine-1 was retired (quick `261027-klx`, native UAT 2026-10-27), custom brush-tip import was retired with the Brush tab, paper is baked into the watercolor sheet rather than composited through `paperPass`, and the editor's top-bar module switcher was removed pre-publish by `261102-iv5` (it belonged to the Studio, never the editor). Krita is neither implemented nor planned. All of these are recorded as **accepted supersessions** in `REQUIREMENTS.md` and `.planning/v2.0.0-MILESTONE-AUDIT.md`.

**Milestone shape:** 3 phases (54–56), 26 plans, plus **75 in-milestone quick tasks** (2026-10-17 → 2026-11-02) and one named quick (`QUICK-01` audio-trim-to-view). Phase 57 (standalone spectral) was retired on 2026-10-21 because `packages/efx-spectral` was delivered inside Phase 56 through the dependency hook.

---

## 2. Architecture & Technical Decisions

- **Preact 11 with exactly one `preact` copy**
  - **Why:** Preact 11 is the hard prerequisite for the watercolor work; two copies would mean two signals runtimes and zombie state.
  - **Phase:** 54.

- **Preact-free, engine-agnostic host (`@efxlab/efx-paint-host`)**
  - The shared Studio script law — animation schedules, `traceSeed`/noise, script envelope, fixed ticks + `diffusionFrames` mechanism — moved out of engine-1 into a package whose only runtime dependency is `effect`.
  - **Why:** Engines must not force Preact or engine-1 types into each other; the host is the seam every engine consumes.
  - **Phase:** 55.

- **Generic stroke payload seam: `StudioStroke<P>`, `StudioScriptEnvelope<P>`, `EngineAdapter<P>`, `EngineId`**
  - The host never inspects `P`; each engine defines its own payload and codec. A fake engine-2 payload proved the seam end-to-end.
  - **Phase:** 55.

- **Fixed integer tick grid (`HOST_TICK_HZ = 60`) and determinism**
  - Time is integer ticks, never raw ms. Same script ⇒ same pixels, FNV-1a `traceSeed` per stroke, no `Math.random()` in the deposit/sim path.
  - **Phase:** 55.

- **Clean-break script envelope with an `engineId` discriminator**
  - The saved script JSON changed deliberately; old v1.0.1 scripts **refuse** with a named visible error rather than being migrated. Refused rows stay visible in the library; only the user deletes data.
  - **Phase:** 55.

- **Fail-closed Apply through one owned-refusal surface**
  - Four named refusal codes (unknown engine, malformed payload, engine mismatch, unreadable legacy) map to four distinct visible lines. Validation completes before any write, and a no-partial pin asserts the document is untouched on every refusal.
  - **Phase:** 55 (extended in 56).

- **Clean-room watercolor engine (`@efxlab/efx-watercolor`)**
  - Published-method-only implementation: fluid sheet with wet-gated diffusion, drying-front tide lines, four tools (`brush | water | pen | lift`), 15 preset tips, 13 papers (10 procedural + 3 recovered real scans).
  - **Phase:** 56.

- **Spectral pigment mixing (`@efxlab/efx-spectral`)**
  - Vendored MIT reflectance data + Kubelka-Munk `mixSpectral`; yellow + blue lands green-dominant, not teal. The shared package is now a dead production path after the single-engine pivot (engine 2 uses its internal implementation).
  - **Phase:** 56 (delivered early through the dependency hook).

- **Bake host built on the existing Effect v4 bounded-queue pattern**
  - Aquarelle bake uses `createBakeHost` in `flush-survives-navigation` mode: one WebP frame per stroke turn, publish IS commit, generation-stale guard makes cancellation structural, and `dispose()` flushes long cuissons instead of aborting them.
  - **Phase:** 55/56.

- **Dual-language `.mce` field contract**
  - Every new field (paper display state, aquarelle brush properties, per-engine stroke payload, brush-pack snapshot) is declared in BOTH TypeScript and Rust (`mceFieldContract` law).
  - **Phase:** 56.

- **Single-engine pivot at close**
  - Water color is the only engine/module; brushes are preset-only; paper is baked with the stroke and a paper change is a cache miss; `activeModule` remains for Studio gates, but the editor top bar has no switcher.
  - **Why:** User-approved product decisions during live UAT (2026-10-26 → 2026-11-02), not implementation shortfalls.
  - **Phase:** close-out quicks.

---

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 54 | Preact 11 update | ✅ Complete — 2026-10-14 | Workspace on Preact 11.1.1 + signals 2.11.3 with one `preact` copy, four standing contract pins, and live reactivity UAT A1–A5 closed before Phase 55 opened. |
| 55 | efx-paint-host (engine-1 host split) | ✅ Complete — 2026-10-15 | Studio script law extracted into a Preact-free generic host on one `StudioStroke<P>` contract; engine-1 projected through `toStudioStroke`; fail-closed envelope cutover and shared bake host delivered. |
| 56 | efx-watercolor (engine 2, clean-room) | ✅ Complete — 2026-10-21 | Clean-room animatable watercolor engine, 13-paper pack, Studio record/play/bake/cache, brushes, panels and module switcher over the one shared Studio; live UAT A1–A5 approved. |
| — | QUICK-01 audio-trim-to-view | ✅ Complete — 2026-11-02 | A Studio sound import longer than the visible timeline window lands pre-cropped to that window. |

**Close-out sequence (2026-10-21 → 2026-11-02):** Phase 56 closed; 75 quick tasks refined the watercolor Studio; engine-1/Brush was retired by `261027-klx`; the editor module switcher was removed by `261102-iv5`; the milestone audit was run and revised — **3/3 phases verified, 3/3 Nyquist compliant, zero open requirement gaps**.

---

## 4. Requirements Coverage

**Total:** 38 requirements + 1 quick task. **31 satisfied as written · 7 superseded by approved pivots · 0 open gaps.**

| Group | Requirements | Status |
|-------|--------------|--------|
| Runtime foundation (Phase 54) | RUN-01..RUN-06 | ✅ 6/6 satisfied |
| Engine host split (Phase 55) | HOST-01..HOST-05, DATA-01..DATA-03 | ✅ 8/8 satisfied (HOST-03 via accepted supersession override — engine-1 retired) |
| Watercolor engine (Phase 56) | AQUA-01..AQUA-08 | ✅ 7/8 satisfied; AQUA-03's custom-import half superseded (15 preset tips) |
| Paper pack (Phase 56) | PAPER-01..PAPER-04 | ✅ satisfied; PAPER-02 superseded (paper baked into the sheet); PAPER-03's paper-id undo half superseded, grain undo retained |
| Shared Studio / modules (Phase 56) | MOD-01..MOD-06 | ✅ MOD-03/MOD-05 satisfied; MOD-01/02/04/06 superseded (single-engine, preset-only brushes) |
| Spectral (delivered inside 56) | SPEC-01..SPEC-05 | ✅ satisfied; SPEC-04 superseded (engine 2 uses internal spectral) |
| Data honesty | DATA-01..DATA-04 | ✅ 4/4 satisfied |
| Quick (in-milestone) | QUICK-01 | ✅ complete, UAT 2026-11-02 |

**Accepted supersessions (user-approved):**

| Requirement | Shipped reality | Superseded by |
|-------------|-----------------|---------------|
| AQUA-03 custom import | 15 preset brush tips; import retired with the Brush tab | 261017-xa0, 261027-gh9 |
| MOD-01/02/06 | No top-bar module switcher; ONE Water color module; no Krita placeholder | 261027-klx, 261102-iv5 |
| MOD-04 | `brushPack.entries: []` by design — no custom pack to carry | 261017-xa0, 261027-gh9 |
| PAPER-02 | Paper baked with the stroke; paper change = cache miss | 261017-fz3 + opaque-sheet parity |
| PAPER-03 (paper-id undo) | Paper id is a display choice; grain pair (strength/scale) stays undoable | User decision 2026-11-02 |
| SPEC-04 | Single-engine pivot; production engine uses internal spectral | 261027-klx |

**Audit verdict:** `tech_debt` — no open requirement gaps; only pre-existing review advisories and optional cleanup remain. See `.planning/v2.0.0-MILESTONE-AUDIT.md`.

---

## 5. Key Decisions Log

### Phase 54 — Preact 11

| Decision | Rationale |
|----------|-----------|
| Two-leg throwaway probe; pattern leg is the real gate | The teardown risk (deferred cleanups) is what the upgrade could actually break; "signals imports" proves nothing. Deleted on green. |
| Peer `>=11.0.0` + devDep 11.x + root override in the SAME commit | A peer-only bump leaves a live 10.x pin that can re-pin resolution to two copies. One-way door, no dual-major range. |
| One-copy proof recorded twice: `pnpm why` measurement + standing `.test.ts` pin | Dual-preact failures are non-obvious at runtime; the pin fails loudly at test time. |
| `paintVersion` bump+subscribe preserved, NOT rewritten into effect cleanups | Preact 11 defers cleanups; correctness must not depend on them. |
| JSX namespace migration as a named work item (3 files, 20 files with type fallout) | A known deterministic break, fixed deliberately — not discovered mid-bump. |

### Phase 55 — Host split

| Decision | Rationale |
|----------|-----------|
| Golden captured FIRST, entirely on pre-split code; delta-zero parity pin | A golden captured after the move compares the split against itself — it would prove nothing. |
| A5 (fake engine-2 genericity) is an automated pin, not a live UAT row | Genericity is a contract, not visible behavior; live UAT is reserved for human judgment (A1–A4). |
| Refusal reuses the existing owned-refusal surface, one channel | A second error channel would need all Studio contract tests re-baselined. |
| Saved script JSON changes; `engineId` is a required discriminator | One clean break now, rather than a second one in Phase 56. Legacy scripts refuse, never migrate. |
| Refused rows stay visible; deletion is the user's action | Clean break means the format refuses to parse, not that the app destroys data. |
| Host is Preact-free; engine policy stays engine-side (`diffusionFrames` mechanism vs cap) | Engine 2 must not inherit Preact, and the 600-frame cap is an engine bake window, not a host law. |
| `traceSeed` move keeps `seededRng(strokeSeed, streamKey)` signature | This IS the determinism law the golden re-bake depends on. |

### Phase 56 — Watercolor

| Decision | Rationale |
|----------|-----------|
| Clean-room P1: published method only; no code copied/transliterated from the watercolor playground or inkwash | Both oracles are unlicensed; spectral data is vendored from MIT `spectral.js` with a NOTICE. |
| Wet-gated diffusion; tide line as capillary velocity + drying-front pull | Conservation keeps pigment off dry paper; either tide-line mechanism alone was too weak. |
| Dry is a user action recorded as a distinguished payload event (tick + dry), not a 5th tool | Without a recorded Dry, replay cannot reproduce the cooked look; forced Dry at frame boundaries remains prohibited. |
| One WebP frame per stroke turn; publish IS commit; `dispose()` flushes | The generation-stale guard makes cancellation structural; long cuissons survive navigation. |
| Paper state (id, strength, scale) lives on the document/fond with display-class change-token rotation | Learned from PKG-06/BKG-09: display-only edits that skip the token revert on reopen. |
| Lean `./papers`, `./brushes`, `./payload`, `./bake` sub-exports | Keeps the fluid engine out of the UI chunk and pages the 2,000 kB ceiling. |

### Close-out decisions

| Decision | Rationale |
|----------|-----------|
| Retire engine-1/Brush; Water color is the only engine and module | User-approved after native UAT 2026-10-27; the two-engine shape was not the product. |
| Preset-only brushes | Custom tip import added a pack/serialization surface without enough user value. |
| Paper baked into the watercolor sheet | Double modulation through `paperPass` produced visible speckle; engine-baked paper is the shipped look. |
| Remove the editor module switcher; no Krita slot | The switcher belonged to the Studio, never the editor; Krita is neither implemented nor planned. |
| Paper-id change is not an undo step | It is a display choice; the grain pair remains the undoable edit. |

---

## 6. Tech Debt & Deferred Items

### Open review advisories (non-blocking)

- **Phase 54:** CR-01 (Play Script dialog Enter hijack), CR-02 (stepper undo coalescing on unmount), WR-02/WR-03 (pin-completeness), WR-01/WR-04..07, IN-01..04. All dispositioned `open`; none falsifies a must-have.
- **Phase 55:** WR-01 (D-13 owner-layer gate unpinned), WR-02 (source-contract end bound can go vacuous), IN-01 (scrub family clip-window coverage), IN-02 (`effectiveEnd` clamp unpinned), IN-03 (main-track snippet loop duplicates play-path track math).
- **Phase 56:** `paperPass` CR-01 partial-alpha wash waived (WINDOWS #79); GPU rewrite attempted 2026-11-02 and reverted. **Dual fingerprint drift risk:** `aquarelleBake` exports `aquarellePaperCacheFingerprint` while the app re-derives the paper term in `useRotoFramePersistenceCoordinator.ts:280`.

### Housekeeping

- Unreferenced `preact@11.0.1` / `11.0.2` virtual-store residue; resolved copy is `11.1.1`.
- `56-VERIFICATION.md` has no requirements table (status passed; UAT closure recorded).
- SUMMARY frontmatter omissions for PAPER-01..04 and SPEC-01..05.
- DATA-04 carriers are declaration-only on both sides by documented design (`Mce*` structs with `#[allow(dead_code)]`); the pin is declaration-level, not usage-level.
- **Optional cleanup:** dead `efx-spectral` path — package + workspace dependency + `engine/deposit.ts` import (only tests call it). No behavior change.

### Deferred to later releases

- **v2.1.0:** engine-1 adopts `efx-spectral` (replaces the RYB `mixSubtractive` heuristic) — Q5-gated at close; unrelated to the retired Krita idea.
- **v2.2+:** Fill tool (TOOL-01), Text/Shape/Hand annex tools (TOOL-02), user-imported paper scans (PAPR-05), 2K resolution activation (RES-01).
- **Backlog:** paint-timeline waveform (SND-08) — never fold into another phase.

### Process notes

- `RETROSPECTIVE.md` has **not yet been updated for v2.0.0** (last section is v1.0.1); it is written at `/gsd-complete-milestone`, after the release is published.
- `/gsd-complete-milestone v2.0.0` must run **only after** the release is published (audit instruction).

---

## 7. Getting Started

### Run and build

```bash
pnpm install                 # pnpm workspace (never npm)
pnpm dev                     # app dev server (the user runs this — do not start it for them)
pnpm build                   # tsc --noEmit && vite build
pnpm tauri                   # Tauri desktop shell
```

### Tests

```bash
pnpm --filter efx-motion-editor exec vitest run     # full app suite
pnpm --filter efx-motion-editor run typecheck       # tsc --noEmit
```

> Never run Vitest in watch mode; always `vitest run`. Project law.

### Key directories

| Path | What lives there |
|------|------------------|
| `app/src/components/physic-paint/` | The Studio: watercolor UI, Roto rails, script apply/refusal, persistence |
| `app/src/stores/` | Preact signal stores (`physicPaintStore`, `paintStore`, …) |
| `app/src/lib/` | Paper pass, playback engine, shared rendering utilities |
| `app/src-tauri/` | Rust backend: `.mce` models, script library, package/cache IO, capabilities |
| `packages/efx-paint-host/` | Engine-agnostic Studio script law: animation, ticks, traceSeed, envelope, bake host |
| `packages/efx-watercolor/` | Clean-room watercolor engine: fluid, drying, spectral, brushes, papers, codec, bake |
| `packages/efx-spectral/` | Vendored spectral mixing data + `mixSpectral` (currently a dead production path) |
| `.planning/` | GSD artifacts: roadmap, requirements, audits, phase plans/summaries, quicks |

### Where to look first

1. `packages/efx-paint-host/src/script/payload.ts` — `StudioStroke<P>`, `EngineAdapter<P>`, `StudioScriptEnvelope<P>`, `EngineId`. This is the seam the whole product now hangs on.
2. `packages/efx-watercolor/src/engine/` — the fluid/drying core and tool deposit paths.
3. `packages/efx-watercolor/src/bake/aquarelleBake.ts` — how a recorded script becomes cached WebP frames.
4. `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the Studio composition root; the largest integration surface.
5. `app/src/components/physic-paint/roto/physicsPaintRotoScriptApplyRefusal.ts` — the one visible refusal vocabulary.
6. `.planning/v2.0.0-MILESTONE-AUDIT.md` — the authoritative close-out accounting and the supersession list.

### Binding project rules

- Preact + `@preact/signals` only — no `useState`/React patterns; consult `efx-preact-reactivity`.
- Async paths follow `efx-async-orchestration` (XState v6 + Effect v4).
- No backward-compat shims; unreadable data refuses with a named visible error.
- All package/cache IO goes through Rust; renderer `plugin-fs` must not touch those paths.
- Chunk budget: 2,000 kB viteBuild desktop ceiling; main chunk was 1,586.33 kB at close.

---

## Stats

- **Timeline:** 2026-10-14 → 2026-11-02 (20 days)
- **Phases:** 3/3 complete · **Plans:** 26/26 complete
- **Quick tasks:** 75 in-milestone + QUICK-01
- **Commits:** 1,044 in the milestone window (all authored by Laurent Marques)
- **Files changed:** 1,172 (+202,564 / −133,236) across the repo; **code only** (`app/` + `packages/`): 578 files (+118,282 / −44,597)
- **Tests:** 394 test files; last full gate **7,010 passed** (1 skipped, 96 todo), typecheck exit 0, build green at 1,586.33 kB
- **Audit:** `tech_debt` — 3/3 phases verified, 3/3 Nyquist compliant, 0 open requirement gaps
- **Release:** version bumped to `2.0.0` in `app/package.json`; **no `v2.0.0` tag yet** — signed/notarized release pending re-run

---

_Generated by: Claude (gsd-milestone-summary)_
