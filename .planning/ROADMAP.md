# Roadmap: EFX-Motion Editor

## Milestones

- ✅ **v0.1.0** — Phases 1-7 (shipped 2026-03-11)
- ✅ **v0.2.0 Pipeline Complete** — Phases 8-14 (shipped 2026-03-21)
- ✅ **v0.3.0 Audio & Polish** — Phases 15-17 (shipped 2026-03-24)
- ✅ **v0.4.0 Canvas & Paint** — Phases 18-19 (shipped 2026-03-25)
- ✅ **v0.5.0 Motion Blur & Paint Styles** — Phases 20-21 (shipped 2026-03-26)
- ✅ **v0.6.0 Various Enhancements** — Phases 22-25 (shipped 2026-04-03)
- ✅ **v0.7.0 Monorepo & Paint Enhancements** — Phases 26-33 (shipped 2026-04-05)
- ✅ **v0.8.0 Standalone Physics Paint** — Phases 34-38.1 (shipped 2026-08-01)
- ✅ **v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity** — Phases 39-44 (shipped 2026-08-21)
- ✅ **v1.0.0 EFX Paint Multi-Track Frames and Reveal** — Phases 45-53 (shipped 2026-10-12)
- ✅ **v1.0.1 Debt Patch Release** — quicks + inserted Phase 53.1 (shipped 2026-10-13)
- 🚧 **v2.0.0 Multi-Module Paint Workstation (MAJOR)** — Phases 54-57 (in progress)

## Phases

<details>
<summary>✅ v1.0.1 Debt Patch Release (quicks + inserted Phase 53.1) — SHIPPED 2026-10-13</summary>

PATCH milestone per the semver ladder locked 2026-10-12 (PATCH for debt, MINOR for features). Quicks-first: 6 debt quicks + 1 inserted phase (53.1 frame-model fix) + release. 13/13 v1 requirements approved.

- [x] Quick 1 (261012-c9a): Display-class save token — SAVE-01..03, UAT approved 2026-10-12
- [x] Quick 2 (261012-d6q): Video disk-reference law — VID-01..03, UAT approved 2026-10-12
- [x] Quick 3 (261012-exn): Document-sound decode readiness — SND-01..02, UAT approved 2026-10-12
- [x] Quick 4 (261012-kxg): Export video readiness — VID-04, UAT approved 2026-10-13
- [x] Quick 5 (261013-ctd): Export mux duration law — EXP-01, UAT approved 2026-10-13
- [x] Phase 53.1 (frame-model-fix): Law-1..4 / I-1..5, 6 plans, UAT 5/5 approved 2026-10-13
- [x] Quick 6 (261013-fdh): Field-drop-hole closure N1-N4 + TS↔Rust field-diff contract — MBL-01, pinned 2026-10-13
- [x] Release (261012-hw3): REL-01 version single-source + REL-02 signed/notarized GitHub Latest, published 2026-10-13

</details>

<details>
<summary>✅ v1.0.0 EFX Paint Multi-Track Frames and Reveal (Phases 45-53) — SHIPPED 2026-10-12</summary>

See milestones/v1.0.0-ROADMAP.md for full phase details.

</details>

<details>
<summary>✅ v0.9.0 PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity (Phases 39-44) — SHIPPED 2026-08-21</summary>

See milestones/v0.9.0-ROADMAP.md for full phase details.

</details>

<details>
<summary>✅ v0.8.0 Standalone Physics Paint (Phases 34-38.1) — SHIPPED 2026-08-01</summary>

See milestones/v0.8.0-ROADMAP.md for full phase details.

</details>

---

### 🚧 v2.0.0 Multi-Module Paint Workstation (MAJOR)

**Milestone Goal:** Change the product shape into a multi-module paint workstation — a module switcher (Brush | Water color | Krita) over ONE shared Studio engine, shipping Brush + Water color, unlocked by a Preact 11 bump and an engine-1 host split.

**Phase structure LOCKED by the user (2026-10-14).** Global phase numbering continues from v1.0.1 (ended at Phase 53.1). Do not invent, merge, split, or reorder phases. v2.1.0 (Krita) is planned only AFTER this milestone closes — there is no Krita phase here.

**Hard sequencing gates (encoded as phase dependencies and success criteria):**
- No watercolour work before the Preact 11 bump (satisfied by order 54 → 56)
- Phase 54 live UAT CLOSES before Phase 55 opens (55 is blocked by 54's live UAT — not "automated-ready")
- `efx-watercolor` CONSUMES `efx-spectral` — if plan-time shows 56 needs spectral first, create `packages/efx-spectral` early inside 56 (or pull 57's content forward); never duplicate the mixing code inside the watercolor engine. This is a dependency hook on 56, not a new phase.

**Locked stances (do not reopen):** CLEAN BREAK ACCEPTED — no migration code, no dual-format readers, no backward-compat shims; still never drop data silently (unreadable script/asset refuses with a named visible error, 53.1 law). ONE shared Studio engine (script, cache, timeline) for all modules. Host APIs generic over the per-engine stroke payload. Brush-pack snapshot travels in `.mce`. Time = fixed integer tick grid (~1/60 s). Determinism = same script ⇒ same pixels, FNV-1a traceSeed per stroke, no `Math.random()` in deposit/sim path. Remaining UI gray zones (top-bar placement, iconography, panel layout, option grouping) are resolved at discuss-phase — this roadmap does not pre-decide them.

**In-milestone quick task (never a standalone phase, never gets a phase number):**
- [ ] **QUICK-01**: audio-trim-to-view (parked from pre-53)

**Phase checklist:**
- [ ] **Phase 54: Preact 11 update** - Hard `@preact/signals` ↔ Preact 11 probe gate first (STOP if red), then mechanical Preact 11 migration with live reactivity UAT closing before Phase 55
- [ ] **Phase 55: efx-paint-host (engine-1 host split)** - Studio script law moves into a generic engine-agnostic host; engine-1 behavior unchanged (format-identical)
- [ ] **Phase 56: efx-watercolor (engine 2, paint-aquarelle, clean-room)** - Animatable watercolour engine + paper pack (all paints) + module switcher over the one shared Studio
- [ ] **Phase 57: efx-spectral (MIT spectral.js, shared)** - Shared subtractive pigment-mixing package, consumed by engine 2 now; API frozen for engine-1 adoption in v2.1.0

## Phase Details

### Phase 54: Preact 11 update

**Goal**: The workstation runs on Preact 11 with the signals reactivity law intact, proven live before any engine work begins
**Depends on**: Nothing (first phase of the milestone)
**Requirements**: RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06
**Success Criteria** (what must be TRUE):
  1. A throwaway probe proves `@preact/signals` works on Preact 11 BEFORE any bump; a red probe stops the milestone as a named blocking decision — never a shim, never an unofficial pin
  2. User paints a stroke, undoes/redoes, and switches tracks in Studio and the canvas and timeline follow live — the `paintVersion` bump+subscribe discipline is preserved, not rewritten into effect cleanups
  3. App and standalone packages run on Preact 11 with exactly one `preact` copy; mechanical migrations (useRef initial values, JSX types → preact namespace, defaultProps/auto-px → compat, `lucide-preact` bump) leave behavior identical
  4. Live UAT of the reactivity paths (paintVersion, store setters — rows A1–A5) is user-asserted and CLOSED; this is the hard gate before Phase 55 opens

**Plans**: 5 plans
Plans:
**Wave 1**
- [ ] 54-01-PLAN.md — RUN-01 two-leg throwaway compatibility probe (stop-if-red gate)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 54-02-PLAN.md — Package legitimacy gate for the locked Preact 11 pins

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 54-03-PLAN.md — D-04 one-way peer door + one-preact-copy TDD pin + workspace bump (RUN-02, RUN-03)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 54-04-PLAN.md — JSX namespace migration in three D-07 files (RUN-04)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 54-05-PLAN.md — paintVersion discipline pin + live UAT A1-A5 close (RUN-05, RUN-06)

### Phase 55: efx-paint-host (engine-1 host split)

**Goal**: The shared Studio script law (animation schedules, traceSeed, script envelope, ticks + diffusionFrames) lives in a generic engine-agnostic host; engine-1 observable behavior is unchanged
**Depends on**: Phase 54 — HARD GATE: Phase 54 live UAT (RUN-06) must CLOSE before Phase 55 opens
**Requirements**: HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. User records, applies, bakes, and replays a Physic Paint script with the same look and baked pixels as the pre-split golden — the format-identical split is a refactor guard (R5.2 / A4 replay parity), not a compatibility surface
  2. A fake engine-2 stroke payload (pts, ticks, cuisson, motion, brush id + toolOverrides) compiles and round-trips through record → play → bake on the host with zero engine-1 types in the host API
  3. Cross-engine or malformed Apply refuses with a named visible error and never half-applies
  4. Scripts run on a fixed integer tick grid (~1/60 s, never raw ms); unreadable scripts refuse with named visible errors; no migration code, dual-format readers, or backward-compat shims exist

**Plans**: TBD

### Phase 56: efx-watercolor (engine 2, paint-aquarelle, clean-room)

**Goal**: Users can paint and animate real watercolour under the shared Studio script law, choose papers for every paint, and switch modules from the top bar
**Depends on**: Phase 55 (and transitively Phase 54). Dependency hook: this phase CONSUMES `efx-spectral` — if plan-time shows spectral is needed first, create `packages/efx-spectral` early inside 56 (or pull 57's content forward); never duplicate the mixing code inside the watercolor engine
**Requirements**: AQUA-01, AQUA-02, AQUA-03, AQUA-04, AQUA-05, AQUA-06, AQUA-07, AQUA-08, PAPER-01, PAPER-02, PAPER-03, PAPER-04, MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, MOD-06, DATA-04
**Success Criteria** (what must be TRUE):
  1. User paints with `brush | water | pen | lift` (14 tips + custom PNG/JPG import, 8 global params + per-brush multipliers) and sees wet-in-wet blooms, hard wet-on-dry edges, and dark tide lines survive into baked frames
  2. User records → plays physics (no forced Dry at frame boundaries) → WebP-bakes (`diffusionFrames` ≤ 600) → caches; same script ⇒ same pixels (FNV-1a seeded per stroke); the bake survives leaving the frame; unpainted areas stay transparent
  3. User picks among 10 named procedural papers plus the 3 recovered real paper backgrounds (`paper_1/2/3.jpg`); paper composites for ALL paints through the same `paperPass` with no rebake on paper change; paper display state (id, strength, scale) undoes and saves on the document/fond
  4. User switches "Brush | Water color | Krita" from the top-bar MODULE SWITCHER; each module drains its OWN options/features into the panels; ONE shared Studio engine (script, cache, timeline) serves all modules; Krita is visible but inert ("coming in v2.1.0")
  5. Brush-pack snapshots travel in `.mce` (deliberate exception to the 52.2 refs-only law); every new `.mce` field added by this phase (aquarelle brush properties, per-engine stroke payload in the envelope, paper state on the fond, brush-pack snapshot) is declared in BOTH TS and Rust (`mceFieldContract` law); unreadable/cross-engine scripts refuse with a named visible error — never half-apply, never silent drop

**Plans**: TBD
**UI hint**: yes

### Phase 57: efx-spectral (MIT spectral.js, shared — NOT watercolour-only)

**Goal**: Shared MIT spectral pigment mixing is hardened and API-frozen for engine 2 now and engine-1 adoption in v2.1.0
**Depends on**: Phase 56 (content may have been created early inside 56 via the dependency hook; 57 hardens, attributes, tests, and freezes the API)
**Requirements**: SPEC-01, SPEC-02, SPEC-03, SPEC-04, SPEC-05
**Success Criteria** (what must be TRUE):
  1. User mixes yellow + blue and gets green in both wet and dry marks through the shared package
  2. Display rebuild matches the bake (16-band quadrature + `exp(−A)` → sRGB)
  3. The watercolor engine consumes `packages/efx-spectral` — pigment mixing exists in one shared place, never duplicated inside the engine
  4. Package ships vendored MIT reflectance data + its own ESM surface + `NOTICE`; the API is frozen for engine-1 adoption in v2.1.0 (the adoption itself is out of scope)

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 54 → 55 → 56 → 57 (with QUICK-01 runnable as an in-milestone quick alongside them). Phase 55 is blocked until Phase 54's live UAT closes. Phase 57 may interleave content with 56 via the spectral dependency hook, but hardens/freezes after 56 consumption is proven.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 54. Preact 11 update | 0/5 | Not started | - |
| 55. efx-paint-host (engine-1 host split) | 0/TBD | Not started | - |
| 56. efx-watercolor (engine 2, paint-aquarelle, clean-room) | 0/TBD | Not started | - |
| 57. efx-spectral (MIT spectral.js, shared) | 0/TBD | Not started | - |
| QUICK-01 audio-trim-to-view (in-milestone quick) | — | Not started | - |
