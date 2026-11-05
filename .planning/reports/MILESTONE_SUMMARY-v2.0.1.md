# Milestone v2.0.1 — Project Summary

**Generated:** 2026-11-05
**Purpose:** Team onboarding and project review
**Milestone:** v2.0.1 — Rail Editing & v7 Timeline Rails (PATCH)
**Status:** Shipped — published as GitHub Latest on 2026-11-05 (tag `v2.0.1` → `49b5f7e57`)

---

## 1. Project Overview

**What this is:** A macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos, paint/rotopaint) with blend modes, transforms and keyframe animation, apply cinematic FX and GLSL shader effects, import audio with waveform and beat-synced editing, draw frame-by-frame with a pressure-sensitive watercolor engine, preview in real time, and export as PNG sequences or video (ProRes/H.264/AV1).

**Stack:** Tauri 2.0 (Rust) + Preact 11 + Preact Signals + Vite + Tailwind CSS v4, in a pnpm monorepo (`app/` + `packages/`). Three workspace packages: `efx-paint-host` (engine-agnostic Studio script law), `efx-watercolor` (the shipping paint engine), `efx-spectral` (off the production path since v2.0.0).

**Core value:** The complete stop-motion-to-cinema pipeline must work end-to-end — import key photographs, arrange them into timed sequences, preview in real time, export as PNG image sequences.

**Where v2.0.1 sits:** v2.0.0 rebuilt the paint side as a single Water color workstation (shipped 2026-11-02). v2.0.1 is a **PATCH**: two Studio timeline rail-editing regressions plus the approved v7 timeline-rail visual interface. No new module, no `.mce` schema change, no unrelated debt.

**Release outcome (updated after publish):** Phase 58 and the v7 quick are complete and UAT-approved. The refreshed milestone audit (2026-11-05T20:03Z at HEAD `7dddc1389`) reports `tech_debt` with 15/15 requirements and no blockers. Six agent gates are green (vitest 7,347 passed / 0 failed, typecheck clean, production build largest chunk 1,620.87 kB, cargo test 21/21, release-script syntax, PREFLIGHT PASS). **Published as signed/notarized GitHub Latest on 2026-11-05:** tag `v2.0.1` → `49b5f7e57`, DMG 15,982,906 bytes (SHA-256 `3413b701…fffbad`), Release PASS, signed-app UAT passed, downloaded-artifact verification PASS, and all 17 stop conditions NOT ACTIVE.

---

## 2. Architecture & Technical Decisions

### Rail editing (Phase 58)

- **One mutation authority stays intact.** Every rail edit resolves through `resolvePhysicPaintRotoPhysicalEdit` → `finalizeProposal` → an acknowledged, lease-bound transaction. No surface writes the store directly. The Key Rail → cycle conversion reuses this path rather than adding a second writer.
  - **Why:** The single-authority pattern (established Phase 43) is what makes undo atomic and refusals fail-closed.
  - **Phase:** 58-02, 58-09, 58-10.

- **Standard rail is a shape, not a field.** A "Standard cycle" is a Loop Clip with absent `scriptId`, absent `railKind` and absent `motion` — detected by `isStandardMergedLoopClip`. The conversion writes a **strict-whitelist literal** (never a spread of the source record), so provenance, motion, colour and Reveal members cannot leak.
  - **Why:** Zero `.mce` schema change was a milestone scope law; the existing record already carries everything a cycle needs.
  - **Phase:** 58-02.

- **Cycle length is the source span, not the key count.** A gapped segment at frames 10, 12, 15 converts to a 6-frame cycle (`lastKeyFrame − firstKeyFrame + 1`); interior empty frames become empty cycle cells.
  - **Why:** Matches the existing resolver derivation and preserves what the user sees between keys.
  - **Phase:** 58-02 (D-09).

- **Law A: exactly one referencing loop.** The single-key drag guard changed from `countLoopsReferencingSourceKey > 0` to `> 1`. A key referenced by exactly one loop is an independent cycle and can be dragged; a key referenced by two or more keeps the Phase 43 D-11 rejection and the locked rigid-group copy ("Linked source-cycle keys move only as a rigid group…").
  - **Why:** The regression was over-blocking independent cycles; shared ownership must never silently relax.
  - **Phase:** 58-01 (D-12).

- **`placementStart` never follows a partial move.** The locked D-04 rule is untouched: placement follows only when the moved set contains the entire source key list, so the cycle's internal offsets shift while it keeps its anchor frame.
  - **Phase:** 58-01 (D-13).

- **Order proofs read the final candidate mapping.** After `buildMoveCandidate`/`buildMoveGroupCandidate`, the resolver projects the referencing clip's `sourceKeyIds` through the *final* mapping. Order-breaking or unprovable destinations are rejected; `sourceKeyIds` is never re-sorted. No-change drags are exempt.
  - **Why:** Cut/insert ripples survivors, so judging the requested destination cell can hide an inversion.
  - **Phase:** 58-07 (CR-02), 58-10 (CR-03).

- **Source-derived extent is the render/ownership truth.** `resolvePhysicPaintRotoLoopSourceExtent` derives the visible bound from surviving source keys; the stored `originalEndExclusive` remains reported intent. The coordinator reconciles after every accepted non-replay write and prunes orphan paint sheets; replay is skipped so Undo/Redo round-trips byte-identically.
  - **Why:** Deleting source keys used to leave the cycle rendering cached paint past its real extent (G-01).
  - **Phase:** 58-09.

- **Frozen target at open, full revalidation at confirm.** The conversion dialog captures the segment and cycle count when it opens, then revalidates every key id against fresh authority (present, strictly increasing, not owned by a loop or frame override) before any publication.
  - **Phase:** 58-02.

- **Cancellation is not failure.** The async confirm path observes a generation counter (`acceptedGeneration` + `assertCurrent`) after each awaited port call. An abort lands in `'cancelled'` with `error: null` and no publish; cancel during the busy/committing phase is a true no-op that preserves the frozen target for retry.
  - **Phase:** 58-06 (CR-01), 58-08.

- **One confirm gate for click and Enter.** A single render-local `confirmBlocked` value drives both the keyboard Enter guard and the primary button's disabled state, so the two write triggers can never disagree.
  - **Phase:** 58-08 (WR-02).

- **Reduced dialog mode, not a second dialog.** Key Rail creation and Standard-clip editing share the existing PlayScript/Edit Rail shell in a `reducedForm` mode: one Cycle stepper plus one Infinity switch, primary label "Create Cycle" or "Update Rail". Non-reduced channels are excluded by nulling their inputs rather than by duplicating gates.
  - **Phase:** 58-04.

- **Stable projection identities in Preact.** The inspector memo depends on a primitive anchor id and a member count — never the members array — so unrelated Studio renders keep object identity and the right-panel identity memo does not rebuild. Closing clears both the single-rail signal and the rail set, since the set anchor can otherwise re-supply the dismissed inspector.
  - **Phase:** 58-05.

### v7 timeline rails (in-milestone quick)

- **A pure design module is the single source of truth.** `view/timelineRailDesign.ts` holds closed unions for rail type, palette constants, the cycle-parity table, the key/interp/cycle/empty precedence cascade, frame ownership, the header accent and one `frames × pitch − 2` width helper. Thirty unit tests pin it.
  - **Phase:** 261104-bop.

- **Data attributes → CSS custom properties.** All five presentation hosts emit `data-rail-type`, `data-rail-selected`, `data-cell-kind` and `data-cycle`; the stylesheet keys palettes off those attributes. No per-component colour literal remains on the rail surfaces.
  - **Why:** A closed constant table means a rail can only paint a value the design module knows about; no `innerHTML`, no ad-hoc colours.

- **Selected bright, everything else dim, no orange.** Four rail families: Standard green, Motion orange, Static violet, Reveal azure — each with a bright (selected) and dim (unselected) palette. The header accent uses the same selected-or-rail-set predicate that paints rails bright, so accent and rail line can never disagree.
  - **Phase:** 261104-bop; VIS-01/05/06.

- **Two geometry supersessions from live UAT.** Rows ship at **31px** (30px layout + 1px stacked gap), not the spec's 30px (VIS-02 superseded 2026-11-04). The current/selected cell marker is a **white border + white glow overlay**; the earlier rail-colour inset ring was rejected. The selected rail line is a 35% white tint of the rail's own colour, never pure white.
  - **Why:** The locked spec was a static oracle; live viewing beat it on both calls.
  - **Phase:** 261104-bop UAT rounds.

### Post-audit in-milestone quicks

- **Rail dissolve generalized.** A +Key or paint on an empty frame after a rail dissolves that rail into one joined Key Rail in a single fail-closed atomic edit — widened from Standard-only to every canonical lifecycle rail kind (Motion / Static / Reveal).
- **One-shot "Edit this rail?" prompt.** Post-rail edits ask once: **Convert to Standard** commits the dissolve, **New rail** (also Escape/close) keeps the scripted rail and lands a detached key. Exactly one prompt can be pending. `New rail` is a real `forceNewSegment` lane, not a UI-only bypass.
- **Run Script merges into an in-hand Standard rail** instead of splitting it (resolved debug `rail-stack-merge-splits`).
- **Live commit opt-in for steppers.** `SliderStepper` and `NumericStepper` gained a default-off `commitOnInput` prop that emits on every keystroke through the exact blur commit law while raw text keeps ownership of the box; wired to the four rail-creation Frames/Cycle fields.

---

## 3. Phases Delivered

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 58 | Rail editing regressions | Complete 2026-11-05 | A normal Key Rail converts to a Standard cycle through the existing Edit Rail flow, and a single key on a Motion/Static/Reveal rail can be dragged under Law A — without relaxing shared linked-cycle ownership. |
| — | v7 timeline rails (in-milestone quick `261104-bop`) | Complete 2026-11-04 | The real Studio timeline paints the locked v7 rail design from one pure design module: dark surfaces, 4px pill rails, 16×22 cells at an 18px pitch, family palettes, blue playhead. |

### Phase 58 plans (10/10)

| Wave | Plan | Delivered |
|------|------|-----------|
| 1 | 58-01 | Law A — relax the single-key move guard to exactly one referencing loop |
| 1 | 58-02 | Key Rail segment → Standard cycle conversion (record shape, gaps, publication, undo) |
| 1 | 58-03 | Selected Key Rail inspector, Edit Rail action, double-click/Enter entry surfaces |
| 2 | 58-04 | Reduced conversion dialog (Cycle + Infinity only, Create Cycle / Update Rail) |
| 2 | 58-05 | Studio wiring: stable inspector projection, Edit Rail/double-click handlers, right-panel memo |
| Gap | 58-06 | In-flight cancel generation contract + busy-phase cancel preserves the target (CR-01, WR-01) |
| Gap | 58-07 | Single-reference source-order guard for Law A moves (CR-02) |
| Gap | 58-08 | Shared Enter/primary confirm gate for the reduced form (WR-02) |
| Gap | 58-09 | Source-extent reconcile and override ownership across delete, derivation, repeat and routing (G-01) |
| Gap | 58-10 | Final-mapping source-order guard for partial-cycle group moves (CR-03) |

### In-milestone quicks

| Quick | Delivered |
|-------|-----------|
| `261104-bop` | v7 timeline rails redesign (VIS-01..08) |
| `261104-l0i` | A key after a Standard rail dissolves it into one joined Key Rail |
| `261104-q82` | Editor paint rows adopt the v7 rail contract; no legacy rail literals remain |
| `261104-so5` | Non-active Studio row paints interp parity for a Group frame override on a generated in-between |
| `261104-uyv` | Studio canvas zoom pill — minus/percent/plus/Fit/1:1, Fit follows resizes, 1:1 pannable |
| `261105-cgl` | Push mode into the Tools popover, Frame/Seconds go-to popup, session-only Hand pan tool |
| `261105-p9i` | Rail dissolve widened to every canonical lifecycle rail kind |
| `261105-raf` | One-shot "Edit this rail?" prompt (Convert to Standard / New rail) |
| `261105-sk3` | Live `commitOnInput` opt-in wired to the rail-creation Frames/Cycle fields |
| debug | `rail-stack-merge-splits` resolved — Run Script merges into an in-hand Standard rail |

---

## 4. Requirements Coverage

**15 / 15 satisfied.** Audit verdict: `tech_debt` (no blockers, no open requirement or integration gaps).

### Rail Editing (RAIL) — Phase 58

- ✅ **RAIL-01** — Edit Rail opens for a normal Key Rail from the sidebar, via double-click, or via Enter.
- ✅ **RAIL-02** — The reduced modal shows only Cycle (prefilled 1) and Infinity; no script, motion or reveal controls.
- ✅ **RAIL-03** — Confirm writes a provenance-free Standard clip (`sourceKeyIds` in frame order, `placementStart` = first key, no `scriptId`/`railKind`/`motion`); keys become loop-owned and the rail presents as a Standard cycle.
- ✅ **RAIL-04** — Cancel performs zero writes (no store mutation, no revision bump, no undo entry).
- ✅ **RAIL-05** — Conversion is exactly one undo step in both directions.
- ✅ **RAIL-06** — Single-key drag allowed under Law A when exactly one loop references the key; two or more keeps D-11 and the locked rigid-group copy.
- ✅ **RAIL-07** — Regression-locked: resolver tests, undo/redo pins, D-11 guards green, no `.mce` schema field added or changed.

### v7 Timeline Rails (VIS) — quick `261104-bop`

- ✅ **VIS-01** — Four rail types with locked palettes; selected bright, every other rail dim; no orange.
- ✅ **VIS-02** — 16×22 r3 cells, 2px gap on an 18px pitch, 4px radius-2 rail pill, `frames × 18 − 2` width. — *superseded 2026-11-04: rows ship at 31px after the UAT +1px spacing round.*
- ✅ **VIS-03** — Only four cell states (key / interp / cycle / empty), with cycle-parity grays and a rail-colour dot.
- ✅ **VIS-04** — Locked dark surfaces, centred ruler ticks, 10px labels, blue `#2868FC` playhead, 6px gutter.
- ✅ **VIS-05** — Selected header `#2B4BB5` + 3px rail-colour accent (fallback `#8A939C`); Bg header `#3C3E40`; inert 14×14 motion slot on Paint headers.
- ✅ **VIS-06** — Two juxtaposed rails keep their own palettes and selection.
- ✅ **VIS-07** — Every existing gesture still works; no store/document/`.mce`/persistence change.
- ✅ **VIS-08** — Resolver unit tests cover rail-type mapping, palette selection, cycle parity, the cell matrix, owning-rail precedence and rail width; no dependency added.

**Verification sources:** `58-VERIFICATION.md` — 57/57 must-haves, 0 behaviour-unverified; `58-UAT.md` — rows 1–8 pass (including the G-01 reopen repro and the CR-01 Infinity-tail paste); quick `261104-bop` UAT — rows 1–11 approved 2026-11-04. Integration checker: 14/14 links wired, 7/7 end-to-end flows PASS, Nyquist compliant.

---

## 5. Key Decisions Log

### Phase 58 discuss-phase decisions (D-01 … D-17)

| ID | Decision |
|----|----------|
| D-01 | The sidebar uses an **inspector takeover** mirroring the loop-clip inspector: "Selected Key Rail" with Edit Rail + Close. |
| D-02 | **Double-click** opens the conversion modal directly, matching the loop-clip rail precedent. |
| D-03 | With 2+ rails selected, the takeover still shows the anchor rail but Edit Rail is disabled with "Select a single rail to edit it." No bulk conversion, ever. |
| D-04 | The inspector shows only: Frames F{first}–F{last}, Keys {n}, Type Standard. |
| D-05 | The existing PlayScript dialog shell is reused in a **reduced mode** (Cycle + Infinity only). |
| D-06 | Primary labels: **Create Cycle** (first conversion), **Update Rail** (existing Standard clip). |
| D-07 | Every Standard clip uses the reduced form on later edits — the full locked layout is retired for Standard. |
| D-08 | A one-key rail is convertible → a 1-frame cycle. |
| D-09 | Gaps survive conversion; cycle length is the first→last key span, never the key count. |
| D-10 | Phase 58 stops at Standard classification + the existing gray pill; per-frame cells belong to the v7 quick. |
| D-11 | Write only on confirm; cancel is a byte-for-byte no-op; exactly one undo/redo step; prefill Cycle 1 / Infinity off. |
| D-12 | **Law A**: allow a single-key drag when exactly one loop references the key; two or more keeps D-11/D-16. |
| D-13 | `placementStart` stays put unless the moved set contains the entire source key list. |
| D-14 | Force Spacing is unchanged this phase. |
| D-15 | Delete, Insert, Duplicate and the Key Rail move ownership guard keep current behaviour; Law A relaxes `move-key` only. |
| D-16 | A key referenced by more than one loop never moves silently — the locked rejection copy stays verbatim. |
| D-17 | Regression locking: conversion record shape, Law A boundary, undo/redo both directions, no `.mce` field change. |

### Implementation decisions worth remembering

- **Strict-whitelist conversion** — build a NEW literal, never spread the source record (58-02).
- **Dialog owns its confirm** — `'key-rail-create'` routes before the stack/loop-edit/reveal branches (58-02).
- **Generation counter, not AbortController** — the create path awaits ports that accept no `AbortSignal`, so cancel is observed through `assertCurrent` (58-06).
- **Refusal returns through `rejectLoopOp`** — zero commits, modal stays open, frozen target cleared only on success or cancel (58-02).
- **Order guards are intersection-scoped** — only clips whose `sourceKeyIds` contain a moved key are re-projected (58-10).
- **Source-derived extent wins; `requestedEnd` stays stored** — stale intent remains visible, and a genuinely dangling source still returns `{ missingSourceKeyIds }` (58-09).
- **Frame-based Group ownership on delete** — one resolver predicate; `delete-key-rail` keeps `groupOwnedKeyIds` for segment derivation but refuses on owned frames with a new code and locked copy (58-09).
- **Stable memo deps in Preact** — primitive anchor + member count, never the members array (58-05).
- **Reduced dialog excludes rather than re-implements** — stacking/applySurface/revealTab/surfaceTall/identicalCycle are excluded from the reduced form (58-04).
- **One confirm gate** — one derived boolean bound to both Enter and the primary button (58-08).
- **Pin the final mapping, never the cell** — linked-cycle invariants are proven after survivor ripples (58-07 / 58-10).
- **v7 palette ordering is defence-in-depth** — rail pairs bright-first then dim, cycle pairs dim-first then selected; both orders are specificity-safe (261104-bop).
- **Reveal per-rail `overrideColor` is superseded** by the locked palette — recorded as an open decision, not a regression (261104-bop).
- **The motion slot is inert** — every Paint header, none on Background; it becomes the v2.1.0 motion-channel control.

---

## 6. Tech Debt & Deferred Items

### Accepted debt recorded by the milestone audit (no blockers)

| Area | Item |
|------|------|
| VIS-02 — geometry token drift | `timelineRailDesign.ts` exports `rowHeight = 30` while the CSS renders 31px (the UAT-approved value). The exported tokens have no production consumer (tests only) — drift, not a render bug. |
| VIS-04 — dead token | `--cycle-border` is emitted but never consumed. Cycle-parity grays are duplicated between `timelineRailDesign.ts:142-151` and the CSS cell matrix (`physicsPaintStudio.css` ~7922). |
| Integration — mixed rail-set accent | A mixed key+loop rail set gives the header accent the key type (`PhysicsPaintWorkflowStrip.tsx:5153-5198`). `handleOpenRotoKeyRailCycleEdit` does not clear `railSetSelection`; low reachability because Edit is disabled at set size ≥ 2. |
| One-shot prompt — pending window | The prompt has no timeout/abort and renders only when `!pickerOpen` (`PhysicsPaintStudioView.tsx:505`), so a pending `addEmptyKey` promise stays unresolved while a picker is open. Latent, not observed. |
| Test collection | New `.test.tsx` suites are collected only through `.test.tsx.test.ts` launchers. Running the `.tsx` path directly silently executes nothing under the project vitest config. |
| Phase 58 advisories | Reduced Cycle dialog leaves ~376px vertical / ~478px horizontal dead space · refusal reasons are returned but never rendered (`rejectLoopOp` sets `error: null`) · during `committing` Cancel and primary look enabled while both no-op · pasting a rail-set copy from an already-stale finite lifecycle rail can be rejected fail-closed (retryable, writes nothing) · a Force Spacing that SHRINKS an overridden lifecycle rail can strand a tail `frameOverride` and fail the loop-clip parser at commit (pre-existing at `bdc5928ac^`, outside Phase 58 scope — product decision needed). |
| Code review | 15 findings remain open in `58-REVIEW-DISPOSITION.md` (WR-01..WR-05, IN-01..IN-10). CR-01/CR-02/CR-03/CR-04/CR-05 are fixed and scored. |
| UI review | 17/24 across the six pillars in `58-UI-REVIEW.md` (code/CSS-only, no dev server, per project instruction). The one BLOCKER it recorded — the reduced dialog's root key handler hijacking Enter/Escape from its own controls — was **fixed during gap closure**: `PhysicsPaintPlayScriptDialog.tsx:308,318` now returns early for Enter on controls and Escape in text fields, pinned by tests. The review document is historical; the shipped code is clean on this point. |

### Process debt and risks for the release window

- The pre-fix v2.0.1 draft was **deleted and replaced with the post-fix DMG before publish**; the shipped asset matches the built DMG (SHA-256 `3413b701…fffbad`).
- Per the release runbook, **no functional code changes land in the release window**. The debt items above remain deferred: fix only the specific case if it reproduces in real use — no debt sweep.
- `.claude/gsd-core` was bumped to `@opengsd/gsd-core@1.20.0` inside the milestone window; the large tooling diff (+3,120/−658 in `phase.cjs` alone) is not product code and should be read as such in any diff review.

### Deferred by design

- **Motion channels** — lanes, curves, nav cluster, selected-rail rounded outline — belong to **v2.1.0** (`SPECS/v2.1.0-motion-channels/`). v2.0.1 is the rail surface they build on.
- **Unlinking / choosing a different source cycle** for a Standard clip — not raised, not in RAIL scope.
- **Backlog `261024-frame-fade-compositing`** — frame fade in compositing/export. Matched Phase 58 only on the word "frame"; stays in the backlog.
- **Unrelated v2.0.0 audit debt** (dead `efx-spectral`, dual paper fingerprint, DF-01..04, phase 54/55 advisories) — explicitly excluded by the user; separate future work.

### Lessons carried into this milestone

- **The spec is an oracle, not the truth.** Live UAT overrode the locked v7 geometry (31px rows) and the selected-cell marker (white border + glow, not a rail-colour ring). Both were recorded as supersessions, not defects.
- **Pin the final mapping, not the intent.** Two of the three critical review findings (CR-02, CR-03) were order inversions invisible when you judge the destination cell.
- **Cancellation is a first-class state.** CR-01 was an in-flight cancel that could still commit; the fix was a generation contract reused by every async confirm path.
- **A relaxation needs preservation pins.** Law A changed one comparator; the surrounding guards (Force Spacing, delete, insert, duplicate, key-rail move) were re-pinned rather than assumed.
- **Retired design pins are re-valued, never deleted.** The v7 CSS replacement re-targeted and re-valued every old assertion instead of dropping coverage.

---

## 7. Getting Started

**Run the app** (the maintainer runs the server; contributors should not start it unasked):
```bash
pnpm install           # from the repo root
pnpm dev               # Vite dev server for the renderer
pnpm tauri dev         # full Tauri desktop app
```

**Tests** — `vitest run` only, never watch mode:
```bash
pnpm --prefix app exec vitest run        # full suite (7,347 passing at the audit)
pnpm --prefix app run typecheck          # tsc --noEmit
cargo test                               # from app/src-tauri (21 passing)
```

**Build and release:**
```bash
bash scripts/macos-release.sh preflight                              # environment + guard checks
bash scripts/macos-release.sh release                                # build, sign, notarize, staple
bash scripts/macos-release.sh verify-downloaded /path/to/file.dmg    # downloaded-artifact verification
```

**Key directories:**

| Path | What lives there |
|------|------------------|
| `app/src/components/physic-paint/` | The Studio — the whole paint/roto surface. `PhysicsPaintStudio.tsx` is the orchestrator. |
| `.../physic-paint/roto/` | The deterministic physical-frame model: `physicsPaintRotoPhysicalResolver.ts` (all edit intents and guards), `physicsPaintRotoPhysicalModel.ts` (record shapes/parsers), `physicsPaintRotoPlayScriptController.ts` (dialog modes and commits). |
| `.../physic-paint/view/` | Timeline and dialog surfaces: `PhysicsPaintWorkflowStrip.tsx`, `PhysicsPaintKeyRail.tsx`, `PhysicsPaintLoopClipRail.tsx`, `PhysicsPaintTrackRow.tsx`, `PhysicsPaintPlayScriptDialog.tsx`, `timelineRailDesign.ts` (v7 tokens). |
| `.../physic-paint/hooks/` | `useRotoTimelineActions.ts` (drag/insert dispatch), `useRotoPhysicalEditCoordinator.ts` (intent → operation), `useRotoPhysicalEditHistory.ts` (one command per edit). |
| `.../physic-paint/physicsPaintStudio.css` | 9,330 lines — the v7 timeline surfaces, palettes and cell matrix live here. |
| `packages/efx-paint-host/` | Engine-agnostic Studio script law (stroke record → play physics → bake → cache). |
| `packages/efx-watercolor/` | The shipping paint engine (clean-room spectral watercolor). |
| `app/src-tauri/` | Rust side: package/cache IO, WebP encoding, IPC bridge, codecs. |
| `.planning/` | GSD artifacts: `ROADMAP.md`, `REQUIREMENTS.md`, `phases/`, `quick/`, `milestones/`. |
| `SPECS/` | Locked design specs (`v2.0.1-timeline-rails/`, `v2.1.0-motion-channels/`). |

**Where to look first:**

1. **To understand a rail edit end-to-end:** `PhysicsPaintKeyRail.tsx` (selection) → `PhysicsPaintStudio.tsx` (`handleOpenRotoKeyRailCycleEdit`) → `physicsPaintRotoPlayScriptController.ts` (`openKeyRailCycleEdit` / `confirmKeyRailCycle`) → `physicsPaintRotoPhysicalResolver.ts` (`finalizeProposal`).
2. **To change rail visuals:** read `SPECS/v2.0.1-timeline-rails/README.md` first, then edit `timelineRailDesign.ts` and the CSS blocks that consume its data attributes. Do not reintroduce per-component colour literals.
3. **To touch a guard:** find the guard branch in `physicsPaintRotoPhysicalResolver.ts` and read its preservation pins in `physicsPaintRotoLoopGuards.test.ts` before changing the comparator.
4. **To understand why a decision was made:** `.planning/phases/58-rail-editing-regressions/58-CONTEXT.md` (D-01..D-17) and each plan's `key-decisions` frontmatter.

**Project conventions worth knowing:**
- **Preact Signals only** — do not use `useState` or React patterns. Consult the `efx-preact-reactivity` project skill before writing hooks, effects or store setters.
- **Async discipline** — consult `efx-async-orchestration` for any stateful async path (this milestone's generation/cancel contract is a direct application of it).
- **No `.mce` schema changes** without the TS↔Rust field-contract test in `app/src/lib/mceFieldContract.test.ts`.
- **Package/cache IO goes through Rust** — the renderer's plugin-fs scope cannot touch those paths.
- **Atomic commits**; do not push shared remote state without the maintainer.

---

## Stats

- **Timeline:** 2026-11-03 → 2026-11-05 (3 days)
- **Phases:** 1 / 1 complete (Phase 58, 10/10 plans) + 9 in-milestone quicks + 1 resolved debug
- **Commits:** 247 in the milestone window (46 co-authored with Claude Opus 4.7)
- **Files changed:** 512 (+44,057 / −6,473) — of which **product code 96 files (+15,078 / −1,804)**; planning artifacts 180 files (+12,687 / −441); the remainder is the GSD tooling bump to `@opengsd/gsd-core@1.20.0`
- **Requirements:** 15 / 15 satisfied (RAIL-01..07, VIS-01..08)
- **Verification:** Phase 58 57/57 must-haves; UAT rows 1–8 approved; v7 quick UAT rows 1–11 approved; integration 14/14 links, 7/7 flows; Nyquist compliant
- **Test suite at audit:** 7,347 passed / 0 failed; typecheck clean; cargo 21/21; production build largest chunk 1,620.87 kB
- **Contributors:** Laurent Marques
- **Audit verdict:** `tech_debt` — no blockers, deferred items listed above
- **Release:** GitHub Latest 2026-11-05, tag `v2.0.1` → `49b5f7e57`; DMG 15,982,906 bytes, SHA-256 `3413b70104e8c4afee91fa20ea1bbd08ebfbddbacae6c5d19b30844225fffbad`; Release PASS; signed-app UAT passed; downloaded-artifact verification PASS; 17/17 stop conditions NOT ACTIVE

---

*Generated from `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/phases/58-rail-editing-regressions/` (CONTEXT, 10 SUMMARYs, VERIFICATION, UAT, REVIEW, REVIEW-DISPOSITION, UI-REVIEW, VALIDATION, SECURITY, PATTERNS), `.planning/quick/261104-*` and `261105-*` SUMMARYs, and `.planning/milestones/v2.0.1-MILESTONE-AUDIT.md`.*
