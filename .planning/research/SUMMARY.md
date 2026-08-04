# Project Research Summary

**Project:** EFX-Motion Editor — Milestone v0.9.0 (PlayScript Workflow, EFX Paint Audio Preview, macOS Identity)
**Domain:** Tauri 2.0 + Preact Signals macOS desktop stop-motion editor — feature additions on a shipped, signed product
**Researched:** 2026-08-03
**Confidence:** HIGH

## Executive Summary

Milestone v0.9.0 adds six spec-locked features to the shipped v0.8.1 app: a blocking Scripts auto-hydration fix, a legible macOS icon, Vite build hygiene, a read-only cross-window audio preview inside the standalone EFX Paint window, PlayScript progressive-vs-static/hold application modes with application-time color override, and linked Hold Loop Clips with a filmstrip capsule timeline visualization. Every capability maps onto infrastructure already in the repo — the `efxasset://` custom protocol, the existing Web Audio engine, the approved `physic-paint:*` event bridge with native seek-frame sync (G-01), `pnpm tauri icon`, and the canonical Roto physical-frame model from Phase 36.14. **Zero new runtime or dev dependencies are required**; the only config changes are a one-word CSP `connect-src` grant, a one-line `chunkSizeWarningLimit: 1100`, and optional audio MIME entries.

The recommended approach is thin adapters over proven paths, never parallel implementations: a shared pure frame→audio cue resolver extracted from `playbackEngine.ts` (bit-identical math in both windows), a paint-window-local audio preview engine fed by a revisioned read-only context payload over the existing bridge, hold mode as a new `staticStrokeSchedule.ts` package export (never branching the regression-locked progressive module), and Loop Clips as a durable member of the canonical physical model resolved by modulo indexing — repetitions are references, never materialized frames.

The key risks are all named and mitigated: the hydration race must be fixed by explicit-payload handoff (any timer in the diff is an automatic rejection); audio preview requires a locked frame-mapping truth table and a single audible authority to prevent doubled engines and drift; color override must recolor clones only (deep-frozen source scripts make mutation either throw or silently no-op); loop intervals must be half-open with one resolver owning effective duration; and the whole milestone is guarded against the documented project failure pattern of adapter over-reach (Phases 27–32) by spec-locked ownership boundaries.

## Key Findings

### Recommended Stack

No new dependencies. All features reuse existing, verified infrastructure (see STACK.md).

**Core technologies:**
- Web Audio API via existing `app/src/lib/audioEngine.ts`: paint-window audio preview — already decodes every accepted import format in WKWebView; `AudioContext.currentTime` is the only drift-free clock (HTMLAudioElement rejected).
- Existing `efxasset://` custom protocol: audio byte transport to the second window — registered Builder-level so it already applies app-wide; requires only a `connect-src` CSP grant (v0.8.1 `img-src data:` precedent). Bytes never cross IPC.
- Existing `physic-paint:*` Tauri event bridge: revisioned audio context handoff — the G-01 `physic-paint:seek-frame` listen branch is the regression-locked precedent for this exact channel.
- `@tauri-apps/cli` `tauri icon` (current ^2.10.0): icon regeneration — accepts the 794×794 alpha source directly; no mandatory 1024 source; output matches the tracked 5-entry `bundle.icon` array verbatim.
- Vite `build.chunkSizeWarningLimit: 1100`: desktop bundle budget — config-only; `manualChunks` and warning filters are spec-excluded anti-goals.
- Plain TypeScript + Canvas 2D for Hold Loop Clips: no XState (Phase 36.8 decision), no schema library, no UI library — extends the existing Roto strip renderer.

### Expected Features

All six spec-committed features are P1; the milestone is deliberately tight (see FEATURES.md).

**Must have (table stakes):**
- Scripts auto-hydration fix — blocking prerequisite; root cause confirmed (stale launch-context getter reread); no setTimeout/polling/rAF hacks permitted.
- Legible macOS app icon — Apple HIG full 16→1024 ladder, legibility verified at all sizes before packaging.
- Desktop Vite build hygiene — 1100 kB budget + only provably-ineffective mixed-import fixes.
- Audio synchronized to the local playhead — audio clock as master (Dragonframe pattern), never per-frame position chasing.
- Session-local monitoring On/Off toggle — Resolve Shift+S precedent; never touches track mute or export.
- Application-time color override — Photoshop tool-preset precedent; library JSON and thumbnails immutable.
- Loop truncation by next clip with visible requested-vs-effective duration — locked French label `Boucle raccourcie par le clip suivant`; `clip bloquant` banned.

**Should have (differentiators):**
- Read-only cross-window audio preview — beyond every comparable tool (Dragonframe audio is same-process only).
- Explicit progressive vs static/hold application modes — two-step authoring workflow no competitor offers at script level.
- Linked Hold Loop Clips (cycle × repeat 1..∞) — Blender NLA linked-strip semantics + Dragonframe virtual-hold asset economy generalized to multi-frame cycles.
- Filmstrip capsule visualization with cycle badges — makes requested-vs-effective duration legible at a glance.

**Defer:**
- Ping-pong loop mode — v0.9.x, after linked-loop resolution is proven.
- Combined progressive-plus-hold scheduler — v0.9.x convenience; user applies two operations to adjacent ranges.
- Multi-track internal Paint, Reveal masks — v1.0 scope, spec-excluded.

### Architecture Approach

Feature additions slot into the existing two-window architecture without new subsystems: main editor keeps sole authority over audio/project data; the EFX Paint window receives a revisioned, read-only audio preview context over the existing bridge and runs its own `AudioContext`; PlayScript mode/color enter exclusively through renderer input options with the commit path (authority → render → atomic commit) untouched; Loop Clips become a durable member of the canonical physical model beside real keys, with occurrences projected by modulo resolution and the filmstrip as a pure view of the resolver (see ARCHITECTURE.md).

**Major components:**
1. `audioPlaybackResolver.ts` (NEW, `lib/`) — pure frame→per-track cue math extracted from `playbackEngine.ts:192-224`; bit-identical in both windows. The locked mapping: paint `appFrame` == main-editor global frame, so the four-level domain mapping collapses.
2. `efxPaintAudioPreviewEngine.ts` + bridge + hook (NEW, `components/physic-paint/audio/`) — paint-local decode/schedule/seek/stop; revision guard drops stale contexts; dispose on window close; monitoring toggle gates master gain only.
3. `staticStrokeSchedule.ts` (NEW, package `efx-physic-paint/animation/`) — hold-mode full-stroke-set schedule reusing deterministic `transformRecordedStrokeForHeldPose` seeding; progressive module untouched.
4. `physicsPaintRotoLoopClip.ts` (NEW) + model/resolver/strip modifications — durable `{ clipId, startFrame, sourceKeyIds, repeat, revision }` records; half-open `[start, end)` resolution against next-clip/parent-end bounds; capsule rendering derives from the single resolver.
5. `physicPaintBridge.ts` (MOD) — audio preview launch payload + revisioned emitter following the `PHYSIC_PAINT_PROJECT_CONTEXT_EVENT` pattern.

### Critical Pitfalls

(Top selections from PITFALLS.md — 12 critical + 8 moderate + 4 minor catalogued.)

1. **Stale launch-context getter reread (hydration)** — pass the exact `updated` context payload from the bridge callback into the script-library update path; guard by context identity/generation; assert exactly one scan per authoritative context. Any timer in the Phase 0 diff is automatic rejection.
2. **Two audio engines audible at once** — declare exactly one audible authority; gate main-window playback while paint monitoring is active; dispose sources/context on window close with a leak regression test.
3. **Drift from clock mixing / frame-domain confusion** — lock the frame→audio truth table before implementation; schedule all cues once per play/seek against `AudioContext.currentTime`; never re-nudge per frame; restart (not rewind) on loop wrap.
4. **Color override mutating deep-frozen source scripts** — recolor at clone time in `flattenScriptStrokes`; erase strokes exempt; byte-identical source JSON assertion; one shared recolor function for both modes.
5. **Half-open interval off-by-one in Loop Clips** — one resolver owns effective-duration computation; badge and truncation label derive from it; truth-table tests cover exact-boundary, partial-cycle, 1-frame cycle, and next-clip move/remove re-expansion.
6. **Scope creep via adapter over-reach** (the Phases 27–32 failure pattern) — enforce spec-locked ownership boundaries as review gates; phase file lists spanning more than two subsystems are a red flag.

## Implications for Roadmap

Based on research, suggested phase structure (mirrors the architecture build order, which all four research files converge on):

### Phase 1: Scripts Auto-Hydration Fix (blocking)
**Rationale:** Spec-locked prerequisite — the milestone cannot publish while Scripts need manual Refresh, and all PlayScript UI sits in the broken panel. Also de-risks the bridge project-context event path that the Phase 3 audio emitter imitates.
**Delivers:** Explicit-payload context handoff, identity/generation guards, owned fail-before-fix regression test (exactly one scan, rows populate, `canSave === true`).
**Addresses:** Table-stakes hydration; Pitfalls 1, 2.
**Avoids:** Timing-hack fixes — any `setTimeout`/poll in the diff is an automatic rejection.

### Phase 2: macOS Icon Regeneration + Build Hygiene
**Rationale:** Independent of all feature code (touches only `app/src-tauri/icons/`, `vite.config.ts`, `viteBuild.test.ts`, release preflight); gets release-blocking surfaces validated while features proceed. Parallel-safe with Phase 1.
**Delivers:** Regenerated tracked icon set from the 794×794 source; preflight stays SPECS-independent; `chunkSizeWarningLimit: 1100` with documented rationale pinned by test; pre-change warning snapshot; only provably-ineffective mixed imports fixed.
**Addresses:** Icon + build-hygiene table stakes; Pitfalls 10, 11, m3, m4.
**Avoids:** Manual 1024 upscale; warning filters; `manualChunks`; touching the fail-closed `assertProductionBundle` guard.

### Phase 3: EFX Paint Audio Preview + Monitoring Toggle
**Rationale:** Self-contained (shared pure resolver + bridge + new paint-local engine); landing it before the Roto model churn keeps UAT surfaces separable and matches the milestone schedule.
**Delivers:** `audioPlaybackResolver.ts` extraction (regression-locked against existing audio tests first), revisioned `physic-paint:audio-preview-context` event, paint-local engine with gesture-gated `AudioContext`, single-audible-authority gate, session-local toggle, CSP `connect-src` grant with contract test, close-cleanup leak test.
**Addresses:** Audio preview differentiator + sync/toggle table stakes; Pitfalls 3, 4, 5, M4, M5, M7.
**Avoids:** Per-frame position correction; importing main-window audio singletons into the paint window; persisting the toggle.
**Entry artifact:** Locked frame→audio truth table (paint appFrame == global frame; per-track offset/trim/slip combinations) — written and tested before implementation.

### Phase 4: PlayScript Application Modes + Color Override
**Rationale:** Renderer/controller-level changes testable against real-key commits alone, before the LoopClip model lands. Interval/display conventions locked here so Phase 5's filmstrip and resolver share them.
**Delivers:** `staticStrokeSchedule.ts` package export, mode selector + override swatch UI, clone-time recolor (erase-exempt, shared by both modes), progressive equivalence regression test, byte-identical source-script assertion.
**Addresses:** Progressive/static modes + color override; Pitfall 7, M8, m1.
**Avoids:** Branching the regression-locked progressive module; mutating frozen script documents; persisted overrides.

### Phase 5: Hold Loop Clips + Filmstrip Capsule
**Rationale:** Deepest change; builds on proven hold output from Phase 4. The capsule needs the resolver projection from the same phase — do not split capsule UI into Phase 4.
**Delivers:** Durable `loopClips` model member + parsers + revision participation + `.mce` schema bump (clean break, no migration); modulo occurrence resolution with half-open next-clip/parent-end bounds; loop-occurrence render-source variant excluded from interpolation gap derivation; filmstrip capsule with `Cycle 5f × 5 = 25f` / `× ∞` badges and truncation label; metadata-only repeat-count edits through `finalizeProposal`; golden-pixel determinism tests (rerender, cache-clear, save/reopen).
**Addresses:** Hold Loops + filmstrip differentiators + truncation table stakes; Pitfalls 6, 8, 9, M1, M2, M3, M6, m2.
**Avoids:** Materializing repetitions as durable frames; a third frame model beside the canonical physical one; sizing render budgets by requested duration instead of cycle length.

### Phase 6: Integrated UAT + Signed Release
**Rationale:** All gates green; stop conditions enforced (doubled audio, hydration regression, progressive output change, static non-determinism, library mutation).
**Delivers:** Native UAT per spec steps (including 30s+ sustained playback, mid-play seek, loop wrap, close-during-playback), icon verification on the downloaded artifact (icon caches lie on dev machines), signed/notarized release via the unchanged v0.8.1 pipeline.

### Phase Ordering Rationale

- **Hydration first:** spec-locked blocker; also proves the exact-payload bridge handoff idiom that the audio revision guard (Phase 3) reuses — one staleness idiom for the whole milestone.
- **Icon/build parallel-safe early:** zero overlap with feature code; validates release surfaces while features proceed.
- **Audio before PlayScript:** self-contained, independent of the Roto model churn; separable UAT surfaces.
- **Modes before loops:** Hold Loops replay a completed-drawing source cycle — without the static/hold materialization path there is no cycle to link (PLAY-01 → PLAY-04 → HOLD-05 required order).
- **Capsule with resolver, not before:** the filmstrip is a view of the loop resolver's outputs (requested vs effective, repeat instances, truncation) — splitting them invites the dual-source-of-truth pitfall.

### Research Flags

Phases likely needing deeper research during planning (`--research-phase`):
- **Phase 3 (audio preview):** The truth table and resolver extraction are fully specified, but per-track fade curves in the paint-local engine and seek-restart throttling during scrub deserve a focused planning pass. Medium research need.
- **Phase 5 (loop clips):** Largest complexity budget; the boundary truth-table enumeration (adjacent clips, exact-boundary truncation, 1-frame cycle, next-clip move/remove) should be authored as a planning artifact before implementation. Medium research need.

Phases with standard patterns (skip research-phase):
- **Phase 1 (hydration):** Root cause confirmed with file/line references and a deterministic repro prototype; fix pattern fully prescribed.
- **Phase 2 (icon/build):** Pure tooling/config; preflight contract already exists.
- **Phase 4 (modes/color):** Renderer seams identified with exact line references; precedents locked.
- **Phase 6 (UAT/release):** Reuses the proven v0.8.1 signed pipeline.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; every integration point verified against the local codebase plus official Tauri/Vite docs; the one external-protocol claim (app-wide `efxasset://`) is corroborated by local Builder-level registration. |
| Features | HIGH | Spec is user-locked; competitive patterns verified against Dragonframe manual, TVPaint/Procreate docs, Blender NLA, Photoshop preset semantics, Apple HIG. |
| Architecture | HIGH | All findings from direct repository inspection with file/line evidence; open questions are internal seam choices, not ecosystem unknowns. |
| Pitfalls | HIGH | Grounded in the spec risk register, confirmed hydration root-cause diagnosis, and project post-mortems (27–32, 36.2, 36.14, v0.8.0/v0.8.1). |

**Overall confidence:** HIGH

### Gaps to Address

- **Fade-curve parity in the paint-local engine:** The main engine's fade scheduling is proven, but the paint engine re-implements it; planning should decide whether fade math also moves into the shared pure resolver or is ported with equivalence tests.
- **Scrub-throttling policy for seek-restart:** Performance trap is identified (rapid scrub → seek-restart churn) but the coalescing policy is not specified; resolve during Phase 3 planning.
- **macOS icon cache flushing procedure for UAT:** Known to fool dev-machine verification; the exact cache-flush or downloaded-artifact verification steps should be scripted into the Phase 6 UAT plan.
- **Cycle-length capacity check threshold:** Hold commits are bounded by cycle length (not requested duration) against `PHYSIC_PAINT_MAX_APPLY_FRAMES = 600`, but the UX for an over-capacity cycle request needs a planning decision.

## Sources

### Primary (HIGH confidence)
- Local codebase inspection — `physicPaintBridge.ts`, `types/physicPaint.ts`, `audioEngine.ts`, `playbackEngine.ts:192-224`, `physicsPaintRotoPhysicalModel.ts`, PlayScript controller/renderer, `progressiveStrokeSchedule.ts`, `recordedStrokeMotion.ts`, `physicPaintPersistence.ts`, `app/src-tauri/src/lib.rs`, `tauri.conf.json`, `scripts/macos-release.sh`, `vite.config.ts`, `viteBuild.test.ts`
- `SPECS/milestone-v0.9.0-plan.md` — locked ownership boundaries, stop conditions, schedule
- `SPECS/quick-prompts/fix-efx-paint-script-library-auto-hydration.md` — confirmed root-cause diagnosis with deterministic repro
- `.planning/PROJECT.md` — post-mortems (Phases 27–32, 36.2, 36.14), G-01, v0.8.1 CSP precedent
- Dragonframe official features page + 2025 manual + user guide — audio-as-timing-master, virtual holds
- Apple HIG App Icons — size ladder, small-size legibility
- TVPaint docs — pre/post behaviors, Repeat Images; Procreate Handbook — Hold Frame

### Secondary (MEDIUM confidence)
- Tauri v2 CLI/icons/JS-API docs — `tauri icon` contract, asset-protocol CSP
- Vite build options docs + community reports — `chunkSizeWarningLimit` units, mixed-import warning semantics
- WebKit feature blogs + bug trackers — WKWebView codec matrix, MP3 decode quirk
- Blackmagic Fairlight + forum — audio scrubbing toggle precedent
- Versluis/Blender NLA — linked strip + Repeat semantics
- ClearPS/Affinity forums — preset color-override semantics
- docs.fileformat.com + rust-icns — ICNS structure

### Tertiary (LOW confidence)
- Tauri issue #10691 / discussion #8571 — app-wide URI scheme protocol behavior (corroborated locally; no independent validation needed)

---
*Research completed: 2026-08-03*
*Ready for roadmap: yes*
