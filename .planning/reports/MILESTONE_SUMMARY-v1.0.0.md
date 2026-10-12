# Milestone v1.0.0 — Project Summary

**Generated:** 2026-10-12
**Milestone:** v1.0.0 — EFX Paint Multi-Track Frames and Reveal
**Purpose:** Team onboarding and project review

---

## 1. Project Overview

**EFX-Motion Editor** is a macOS desktop application for creating cinematic stop-motion films from photography keyframes. Users import key photographs, arrange them into timed sequences at 15/24 fps, add overlay layers (static images, image sequences, videos, paint/rotopaint) with blend modes, transforms, and keyframe animation, apply cinematic FX and GLSL shader effects, draw frame-by-frame with expressive brush FX, edit audio with beat-synced tooling, preview in real-time on a canvas-based timeline, and export as PNG image sequences or video (ProRes/H.264/AV1) with audio and motion blur.

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.

**v1.0.0 turned one parent Paint layer into a complete multi-track frame animation document.** A versioned EFX Paint document with stable internal track IDs, track-local state, an internal multi-track timeline, a deterministic compositor producing one flattened parent raster per frame, a fixed Background track with Loop Clips, a photo/reference track with Reveal, a document sound track, HD native-resolution paint with a bytes/WebP frame runtime, a clean-break references-only `.mce` package format, paint-content export, and a signed/notarized 1.0.0 release published as GitHub Latest.

**Tech stack:** Tauri 2.11.5 (Rust) + Preact + @preact/signals + Motion Canvas (@efxlab v4) + Tailwind CSS v4 + pnpm workspaces. Paint engines: perfect-freehand (Basic), p5.brush (FX), standalone physics paint (packages/efx-physic-paint). Pinned XState v6 alpha + Effect v4 rc (bounded async pilot only).

**Naming contract (locked):** "EFX Paint" = the inline main-editor Basic/FX paint layer (`paintStore` / `PaintOverlay` / `paintRenderer`) — out of scope for v1.0.0, stays working unchanged. "EFX Physic Paint" = the independent module (`packages/efx-physic-paint` + Studio window) — the subject of this milestone.

---

## 2. Architecture & Technical Decisions

### Keystone architecture (v1.0.0)

- **One parent Paint layer → one EFX Paint document → many internal Paint frame tracks → one flattened frame result** delivered to the unchanged main-editor compositor. The main editor never iterates internal tracks.
- **Internal tracks share the parent application-frame axis** and never change main-editor sequence duration. Multi-track is internal to one opened EFX Paint document; no `Sequence.frameTracks`, no main-editor rows for internal tracks.
- **`getFlattenedFrame` is the sole content seam** for main preview and export (CMP-01 keystone). The Studio program monitor consumes the same seam — there is exactly one composition path.
- **Internal track opacity/blend applied once inside EFX Paint; parent opacity/blend applied once by the main editor** (never double-applied).
- **Reveal uses photo source plus internal Paint coverage through one shared mask compositor**, baked as a 4th rail kind (`reveal/motion` | `reveal/static`) into real track keys.

### Persistence (clean break)

- **`.mce` v1.0 references-only package** — the project folder IS the document package (macOS single-icon `.mce`): light top manifest (`project.mce`) + one JSON sub-file per paint layer + real `.webp` media files under `frames/`. JSON holds relative paths and content digests, never payloads. Zero base64 in any JSON.
- **Clean break, no migration.** `formatVersion` 16 refusal gate rejects pre-1.0 data explicitly (four terminal reasons, fixed precedence, identical blocking no-recourse dialog). No converter, no compat reader, no legacy branch ships in the code. A rescue converter exists as a one-shot script (`scripts/mce-package-rescue.ts`) for the development fixture only.
- **Transactional multi-file save:** staging → hardlink unchanged → fsync → atomic rename-swap → digest-bound commit/rollback. Per-file change tokens diff what actually needs rewriting (add-only today; GC is the known next step).
- **Fail-closed parse at every record level + canonical deterministic encoder** as the persistence contract (document, background, photo, sound, package).

### Runtime

- **bytes/ImageBitmap frame identity** replaces base64 dataUrl strings (the source of decode storms and O(n) memory inflation at HD).
- **Rust WebP-lossless codec** (`encode_advanced` with `exact=1`), digest-verified lazy read-back, **512 MB byte-budgeted LRU**, working-resolution cap **1920**.
- **Track-addressed runtime:** `layerId → trackId → frame` with 16 per-track maps; `trackId` is the stable UUID identity from the document, never an array index. Per-track revision signals + track-scoped operation leases. Editing one track never touches another.

### Async foundations (bounded pilot, measured)

- **XState v6 alpha + Effect v4 rc** proven on exactly one pilot: the stroke-finalization machine + bounded-turn flush queue. Telemetry: full-document serialize ~4.6s → 1.4s total persist; queue p95 104 ms. Pilot admitted on T4/T5 + inspectability; conventions written to the `efx-async-orchestration` skill. **Neither library is adopted anywhere else** — the default everywhere else is still hand-rolled.

### Key decisions (selected, with rationale)

| Decision | Why | Phase | Outcome |
|----------|-----|-------|---------|
| Clean-break versioned EFX Paint document (no migration) | Migration code for a format that never shipped publicly is dead weight; legacy data fails explicitly instead of rendering wrong | 45 | ✓ 5-fixture rejection truth table; grep contract keeps legacy dead |
| One document format everywhere (D-03) | Divergent per-surface formats were the root of earlier persistence bugs | 45 | ✓ session / launch / engine / persistence all re-wired to the same model |
| Track-addressed runtime over parent-layer addressing | Multi-track editing needs isolation guarantees at the store layer, not UI discipline | 46 | ✓ edits never cross tracks; stale async commits fail closed |
| `getFlattenedFrame` as the sole content path (CMP-01) | Two composition paths guarantee preview/export drift | 48 | ✓ pixel acceptance matrix + native parity UAT green |
| Fond collapsed to one document-fallback authority (D-11) | Per-track roto metadata walk duplicated resolution logic across surfaces | 49 | ✓ one resolution, two consumers, pinned by test |
| bytes/ImageBitmap + Rust WebP + 512 MB LRU | base64 strings caused decode storms and heap blowup at HD | 52.1 | ✓ leave-perf blocker resolved (5–8s → 120ms); HD shipped |
| References-only `.mce` package + change tokens | Images/heavy media as disk refs keep documents light; transactional save keeps them consistent | 52.2 | ⚠️ Known Gaps PKG-06/BKG-09 (see §6) |
| XState/Effect pilot, measured not adopted on reputation | Hand-rolled FSMs from timers/boolean flags caused races; conventions needed proof before widening | 52.2 | ✓ pilot admitted; skill written; not widened |
| FrameEntry discriminated union (content/paint/gap) | Paint-only enumeration was never designed (quick 260919-azh verdict NEVER-WIRED) | 52.3 | ✓ paint export ships end-to-end |
| Reveal as 4th rail kind (bake-into-keys), not a dynamic mask compositor | User re-orientation: creation IS the first bake; Replay is the re-bake | 52 | ✓ baked keys overlay the reference ghost pixel-perfectly |
| Five-surface version single-source (REL-01) + release as a first-class phase | Version must never drift; publication is one-way and auditable | 53 | ✓ signed/notarized 1.0.0, all six REL-01 gates green |

---

## 3. Phases Delivered

All 14 phases complete. Phases 52.1–52.5 were inserted mid-milestone via `gsd-phase --insert` (decimal numbering) and stayed cheap — no roadmap confusion, no rework.

| Phase | Name | Status | One-Liner |
|-------|------|--------|-----------|
| 45 | New EFX Paint Document and Clean Cutover | ✅ Complete | Versioned v1.0 EFX Paint document as the only supported runtime/persistence format, with clean-break creation and explicit pre-v1.0 rejection |
| 46 | Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches | ✅ Complete | Move all editable/generated state into `parentLayerId → trackId → frame` addressing; track-local frames, revisions, leases, track-aware undo, fail-closed deletion |
| 47 | Internal Multi-track Timeline, Filmstrip Capsules, and Controls | ✅ Complete | Multi-row Paint timeline in Studio: N Paint rows + fixed Background row, track CRUD, hide/solo/opacity/blend, cross-track drag |
| 48 | Internal Compositor and Flattened Parent Result | ✅ Complete | **Keystone:** deterministic compositor resolving all tracks into one flattened parent raster per frame (`getFlattenedFrame`) |
| 49 | Fixed Background Track and Imported Loop Clips | ✅ Complete | Authoring surface for the fixed Background track: import still/sequence clips, repeat, fallback config, CRUD + undo + save/reopen |
| 50 | Photo/Reference Track | ✅ Complete | One durable photo/reference track (reference-only / reveal-source / masked-transform-source), excluded from ordinary flattened output |
| 51 | Read-only Audio Preview | ✅ Complete | Synchronized read-only main-editor audio during multi-track playback (delivered via quicks 260902-cfa + amendments) |
| 52 | Shared Mask Compositor and Reveal | ✅ Complete | Reveal as 4th rail kind that bakes the photo reference into real track keys through one shared mask compositor |
| 52.1 | Modern frame runtime + native HD paint (INSERTED) | ✅ Complete | bytes/ImageBitmap frame identity, Rust WebP-lossless, 512 MB LRU, working-resolution cap 1000→1920 |
| 52.2 | Project package format — references only (INSERTED) | ✅ Complete | References-only `.mce` package (manifest + layers/ + frames/), transactional multi-file save, formatVersion refusal gate, + XState/Effect async pilot (16 plans) |
| 52.3 | Paint content export — per-frame compositor enumeration (INSERTED) | ✅ Complete | Any project containing paint exports its painted frames end-to-end; FrameEntry content/paint/gap union, both orientations |
| 52.4 | Real-paint kill the salt-and-pepper (INSERTED) | ✅ Complete | Structured bristle footprint (seeded Poisson lanes, single finalize deposit), salt-and-pepper deposit deleted |
| 52.5 | Physic Paint document sound track (INSERTED) | ✅ Complete | One sound clip per document: Studio waveform/trim/reposition, main-editor mixed playback, `.mce` reference persistence, export mix |
| 53 | Integrated v1.0.0 Acceptance | ✅ Complete | Release/verification backstop: gates, 42-row signed-bundle UAT, credentialed sign/notarize, GitHub Latest publish |

**Plan counts:** 80 plans total (45:8, 46:6, 47:5, 48:6, 49:6, 50:6, 51:0 (quicks), 52:5, 52.1:7, 52.2:16, 52.3:3, 52.4:4, 52.5:3, 53:5). Plus 86 quick tasks archived into the milestone.

---

## 4. Requirements Coverage

**Audit verdict: `gaps_found` — 65/68 requirements satisfied** (2026-10-12 audit). 14/14 phases verified, Nyquist fully compliant (14 compliant, 0 gaps).

### ✅ Satisfied (65)

| Group | Count | Notes |
|-------|-------|-------|
| DOC — Document & Clean Cutover | 6/6 | Including DOC-04: no legacy one-track reader/converter/renderer/cache remains reachable (grep contract) |
| TRK — Track-local State | 8/8 | Isolation guarantees, track-aware ops, fail-closed deletion |
| TML — Multi-track Timeline | 8/8 | CRUD, hide/solo/opacity/blend, cross-track drag, Background row |
| CMP — Internal Compositor | 6/6 | Pixel acceptance matrix passed (opaque/semi/multiply/screen/overlay/add, hidden/soloed, loops, gaps, parent opacity/blend) |
| BKG — Background Track | 8/9 | BKG-09 is the gap (transform save leg) |
| REF — Photo/Reference Track | 5/5 | |
| AUD — Audio Preview | 4/4 | |
| RVL — Reveal | 6/6 | |
| PKG — Project Package Format | 5/6 | PKG-06 is the gap (display-class save leg) |
| SND — Document Sound | 6/7 | SND-07 partial (export mix edge) |
| ACC — Integrated Acceptance | 3/3 | Six REL-01 gates green; 42-row UAT 36 pass / 6 na / 0 fail |

### ⚠️ Known Gaps (3)

- **PKG-06** (Phase 52.2): Display-class setters (`setBackgroundTransform`, `setBackgroundTransformLocked`, `_setPhotoReferenceDisplayProperty`) never rotate the layer change token. After a settled package-file baseline, a display-only edit yields `changedTokens.size === 0` → `layers/<layerId>.json` never rewritten → reopen reverts. First save of a session masks the bug. **Root cause shared with BKG-09.**
- **BKG-09** (Phase 49): Background transform/lock display leg dropped by the same change-token gap. Clips, source order, IDs, repeats, gaps, and fallback all survive save/reopen — the transform term does not.
- **SND-07** (Phase 52.5): Moved/failed audio clip silently dropped from the exported mix (`audioExportMixer.ts` `continue`s on an undecoded buffer; open-time decode is fire-and-forget). Save/reopen restore and missing-file surfacing are verified; the export edge is not.

**Integration findings (from the audit):** 1 blocker (display-class setters → save gate) + 3 warnings (export audio pre-render never awaits clip buffers; duplicated hide/solo truth table; main playback silent no-op on undecoded document sound).

**Closeout mode:** `override_closeout` — the audit verdict `gaps_found` was accepted with per-item CLI acknowledgement rather than a fake-green close. 27 open artifacts acknowledged as deferred.

---

## 5. Key Decisions Log

Aggregated from phase CONTEXT.md `<decisions>` sections and PROJECT.md. IDs refer to the phase-local decision numbering.

### Phase 45 — Document & Clean Cutover
- **D-08:** Every new document starts with one default Paint track + one fixed Background track with transparent fallback.
- **D-07 / DOC-04:** Rejection gate is a pure scan over raw parsed `.mce` JSON (no filesystem, no IPC, no mutation). Fixed precedence: outputs → cache-reference → documentless-layer. Hard-deletion of the legacy one-track surface is proven by a grep contract test — the RED failure list IS the deletion checklist.
- **D-03:** One document format everywhere — session file, bridge launch context, standalone engine, and main persistence all re-wired to the same v1.0 model. "The launch IS the document."
- **D-02/D-04:** `physic_paint_outputs` demoted to an opaque presence carrier; legacy Rust output structs deleted; `cache/efx-paint` replaces `cache/physic-paint` (legacy dirs byte-untouched).

### Phase 46 — Track-local State
- **TRK-01 base law:** `layerId → trackId → frame` with 16 per-track maps; `trackId` is the stable UUID, never an array index.
- **TRK-07 / D-14:** Track deletion is acknowledge-and-delete (preview → commit). Refuses without acknowledgement, for unknown tracks, and for the last surviving Paint track.
- **D-15:** Sidecar deletion rides the tracked save transaction (`EfxPaintDocumentSaveInput.deletions`, path-validated).

### Phase 47 — Multi-track Timeline
- **D-05:** Right-panel Track section always shows the ACTIVE track, resolved inside the memoized build.
- **D-15/D-16:** Cross-track drag is a plain drag with NO modifier; the commit is a store port (`moveTrackItems`), never a callback computing copy-paste-delete.
- **D-18:** Gesture separation enforced by structure — header reorder grab lives outside the rows-region.

### Phase 48 — Internal Compositor
- **CMP-01/D-11:** `getFlattenedFrame` is the only content seam the main renderer/export uses.
- **CMP-03:** Parent opacity/blend applied exactly once at the unchanged parent draw sites.
- **CMP-04:** Flattened-key content terms cover participating tracks only — hidden/non-soloed edits never churn the flattened cache.
- **CMP-05:** Export preflight stays a hard block, generalized to `participatingPaintTracks(document)`.

### Phase 49 — Background Track
- **D-11:** Fond authority collapsed to `document.background.fallback`; the per-track roto metadata walk is deleted, not shadowed.
- **BKG-09:** Registration is runtime-only (no revision bump, no undo, no dirty callback) — re-saving a hydrated document produces an identical dedup fingerprint.

### Phase 50 — Photo/Reference Track
- **D-02:** Source identity is an ordered `readonly string[]` of library asset IDs in natural-filename-sort order.
- **D-07 vs D-11/D-12/D-13:** Document-mutation fields enter the canonical revision term; display-preference fields are validated but excluded from the encoder. **This split is the root of Known Gap PKG-06.**
- **D-06:** Reference registry is a parallel map independent of Background clip lifecycle.

### Phase 52 — Reveal
- **Core re-orientation (user):** A Reveal does NOT dynamically mask. It is the 4th rail kind on the single track type (`reveal/motion`, `reveal/static`) that bakes the photo reference into real track keys. Creating the rail IS the first bake; Replay is the re-bake.
- **G-52-2a:** Reveal bake rides the shared compositor at the WORKING canvas size (not project size) so baked keys overlay the reference ghost pixel-perfectly.
- **G-52-6:** Canonical content fingerprint uses a content TOKEN (length + head-64 + tail-64, O(1)) instead of the full payload dataUrl.

### Phase 52.1 — Modern Frame Runtime
- Encode via `encode_advanced` with `exact=1`, not `encode_lossless()`.
- `ImageData` exists only as the transient IPC-to-bitmap bridge, never stored.
- Chunk budget stays at 1300 kB (not raised) — overage documented and left red pending sign-off.

### Phase 52.2 — Package Format
- **Payload mode selected at the on-disk read door**, not inside the parser (the same entry point validates live in-memory documents on save/fingerprint/launch).
- **One record type, two carriers** — `bytes` is optional with `FrameMediaReference` as the alternative; the content token is total over both shapes.
- **Save As holds ONE transaction open** across the active-path migration (publish → migrate → commit | rollback).
- **Gate 2 closed 2026-09-12:** SPECS/async-conventions.md approved; XState v6 alpha.53 + Effect v4 rc.115 installed `--save-exact` and left unimported outside the two pilot modules.
- **Failures are data, not fiber death** (Effect v4 `tryPromise` maps into the typed ERROR channel); the machine's wait IS the yield (always awaits `waitUntilDrainable`).

### Phase 52.3 — Paint Content Export
- **D-01:** FrameEntry is a discriminated union (ContentFrameEntry | PaintFrameEntry | GapFrameEntry) — fail-closed by type.
- **Pitfall 1 closed:** One shared `entry.globalFrame` predicate across enumeration, render gating, and export preload (the positional-vs-global conflation produced all-transparent selected-fx exports).

### Phase 52.4 — Real Paint
- **One look law:** every wet-to-dry transfer alpha is `wetDisplayAlpha(...)` (compositor.ts READ-ONLY import); cooking window + drySpeed control deleted.
- **Preview == Settled:** ONE PIPELINE (raw blit + liveSnapshot/restore) + ONE LANDING (reveal only after the physicsTicks solver). Standing gate `lookLawDigest.test.ts` = byte-equal preview == cache == reloaded.
- **Source-shape gates are region-scoped and never widen** — real sources pass at birth and the scope cannot silently expand.

### Phase 52.5 — Document Sound
- **Reference-only `audio/` persistence** + closed bridge keys (`LAUNCH_KEYS`/`DOCUMENT_AUDIO_KEYS` fail-closed) + mix-not-contend clip dispatch. Sound bytes never enter the `.mce` document.
- **One-switch law:** footer On/Off pill is the only audio switch.
- **Trim law mirrors the NLE model:** left end moves start+in together; right end clamped to parent end.

### Phase 53 — Acceptance
- Release/verification phase, no functional code. Five-surface 1.0.0 bump (REL-01), 42-row signed-bundle UAT (36 pass / 6 na / 0 fail), credentialed sign/notarize, downloaded-artifact verification, stop-conditions checklist, GitHub Latest publish.

---

## 6. Tech Debt & Deferred Items

### Known Gaps (shipped with the release — top priority)

1. **PKG-06 / BKG-09 display-class setters skip the layer change token** — display-only edits (bg transform/lock, photo-display prefs) revert on reopen after a settled save. Integration severity: **blocker**. Fix is **two-gate** and must NOT rotate `documentRevision` (display prefs are excluded from it by D-07/D-11/D-12/D-13 — §5 Phase 50): append `|bgT:` + `|photoDisplay:` to `buildEfxPaintLayerChangeTokenValue` (`efxPaintPersistence.ts:521`), and `|photoDisplay:` to `buildEfxPaintSaveFingerprint` (`:612` — its `|bgT:` term already exists from 260922-rd4). Without the fingerprint term a photo-display-only edit never even triggers a save; without the layer-token term the save runs but `layers/<id>.json` is skipped as unchanged. The canonical encoders already exist (`encodeCanonicalBackgroundTransform`, the photo term in `efxPaintDocumentRevision.ts:131-140`) — this is an append of terms, not a new encoding.
2. **SND-07 export mix edge** — moved/failed audio clip silently dropped from the exported mix. Integration severity: warning.
3. **Duplicated hide/solo truth table** — `efxPaintHideSolo.ts` (compositor/export) vs `previewRenderer.ts` (Studio) are logic-identical today with no shared import. Drift would desync preview from export. Integration severity: warning.
4. **Main playback silent no-op on undecoded document sound** — `audioEngine.play` returns silently when the buffer is absent; open-time decode is fire-and-forget. Same family as the export-mix warning.

### Carried tech debt (from earlier milestones / phase reviews)

- **WINDOWS.md ledger frontmatter counts disagree with entries** — `windows append` refuses every write; froze cross-phase deviation logging for all of 52.2. Needs a recount-repair pass.
- **Orphan package files:** deleted keys/layers never remove `frames/<layerId>/<keyId>.webp` / `layers/<layerId>.json` (token diff is add-only, no GC owner).
- **Two call sites still hand the package DIRECTORY to `projectStore.openProject`** (`shortcuts.ts:95`, `WelcomeScreen.tsx:168`) → EISDIR on Cmd+O / welcome Open. Needs owner.
- **`'move'` missing from the `ToolType` union** (3 pre-existing typecheck errors).
- **`main.test.ts` unhandled rejection** in full suite (`__TAURI_INTERNALS__.invoke` at cold-start drain). No scheduled owner.
- **Phase 45 WR-01..WR-08:** eight non-blocking hardening warnings on error paths (sidecar load/save guards, commit-settlement error swallow, saveProjectAs rollback-after-write, stale mid-save marker, silent sidecar load failures, auto-save unhandled rejections, saveProjectAs/isSaving race, parentLayerId map-key check).
- **Phase 46 F-01 (MEDIUM-LOW):** `applyPhysicPaintRotoGroupFramePaint` / `applyCommittedReferencedActionDeletion` resolve `activeTrackId` at apply time instead of the captured lease token — narrow window, fails closed on revision/equality guard.
- ~~**52.2-02 left 8 round-trip tests red by design** until plan 07/09's writer projected media references~~ — **CLOSED** at plans 07/09; listed here only as history.
- **Chunk budget overage at 52.1 close:** main chunk 1305.11 kB vs 1291.43 kB baseline; documented, left red pending sign-off on any future raise. (Later raises: 1320→1340 at 52.2-13, 1340→1355 at 53.)
- **S key shortcut lacks `isPaintEditMode()` guard** (low severity) — from v0.6.0.
- **2 medium-severity export edge cases** (content-overlay image preload, FX generator frame offset) — carried from v0.2.0.
- **Coalescing API partially resolved** — motion path drag uses it; most UI interactions still unwired (v0.1.0).
- **`canUndo`/`canRedo` signals exported but no UI consumes them** for button disabling (v0.1.0).
- **3 pre-existing audioWaveform test failures** (unrelated to current work).
- **Roto cache footprint measurement/compression deferred** (PNG alpha encoding exists) — v0.8.0.
- **Legacy source/display model** still feeds `useRotoTimelineActions.getModel` (inert dual-model seam) — v0.8.0.
- **Dead `playScriptMarkers` field** (no producer) and misleading `physicPaintPlayScriptBridge.test.ts` filename — v0.8.0 I-01/I-02.
- **Phase 43.1 DF-01..04** (non-blocking persistence/security hardening): cross-resource save transaction, directory sync on cache publication, provenance-only Loop Clip no-op, postMessage origin authentication — v0.9.0.
- **Release-script warnings (frozen, pre-existing):** `codesign --entitlements :-` deprecation and ~21 GB worktree preflight walk — v0.9.0 Phase 44.

### Process debt (from the retrospective)

- **Artifact debt for the third milestone running:** 141 open items at close (103 → 161 → 141). The same lesson v0.7.0/v0.8.0/v0.9.0 recorded, still unaddressed between milestones.
- **Legacy `failed_superseded` verification status** outside the accepted enum broke the whole audit scan until normalized.
- **Stale `init.manager` projection** (52.2–52.5/53 read `stale`/`complete=false` despite passed VERIFICATION.md) — readiness had to be cross-checked against the live phase tree.
- **Four quick SUMMARY frontmatters were unparseable YAML** (bare `: ` and backtick scalars) — blocked the audit acknowledge writer.

### Deferred Items (acknowledged at close, 27 open)

Categories: persistence (DF-01/02), loop clips (DF-03), security (DF-04), debug_sessions (2), todos (1 presence-only), quick_tasks (11 with unknown/incomplete status), uat_gaps (4), verification_gaps (4), deferred_items (3 from 52.2/52.5). Full list in `.planning/STATE.md` "Deferred Items".

### Next-milestone candidates (from PROJECT.md Active + retrospective)

- Decide gap-entry active-sequence semantics on scrub (52.3 review WR-01) and overlapping-fx export ownership (52.3 review WR-03).
- Future physics-paint integration contract must define typed transport/cache messages (v0.8.0 follow-up).
- v1.0.1 PATCH: 3 debt quicks + release → v1.1.0: phases 54-57 (Preact / paint-host / aquarelle / spectral) → v1.2.0: krita + eng1 spectral → v1.3.0: AI.

---

## 7. Getting Started

### Prerequisites
- macOS (the app is macOS-only: native title bar, file dialogs, macOS conventions)
- Node.js (nvm-managed; the repo targets recent Node — v24 used in CI/dev)
- pnpm (monorepo uses pnpm workspaces — **never npm**)
- Rust toolchain (for Tauri / `app/src-tauri`)

### Run the project
```bash
pnpm install
pnpm dev              # runs the main editor (app/)
pnpm tauri dev        # full Tauri shell (use pnpm tauri … for any tauri subcommand)
pnpm dev:paint        # standalone efx-physic-paint demo shell (packages/efx-physic-paint)
```
**Note:** Do not run the production server — the user runs it on their side.

### Tests
```bash
# from app/
pnpm test             # = vitest (watch) — DO NOT USE for CI-style runs
pnpm exec vitest run  # the one-shot suite (use this)
pnpm typecheck        # tsc --noEmit
pnpm build            # tsc --noEmit && vite build
```
- **Never launch Vitest in watch mode.** Use `vitest run`.
- Rust: `cargo test` inside `app/src-tauri`.
- Vitest only collects `*.test.ts` — a `*.test.tsx` target exits 0 while running nothing.

### Key directories
| Path | What it is |
|------|------------|
| `app/` | The main Tauri application (Preact + Vite + Tailwind v4) |
| `app/src/` | Frontend source (components, stores, lib, efx-paint) |
| `app/src-tauri/` | Rust backend (IPC commands, media codec, package I/O) |
| `packages/efx-physic-paint/` | The standalone physics paint module (engine + Studio) |
| `SPECS/` | Locked specs (`milestone-v1.0.0-plan.md`, `async-conventions.md`, UI specs) |
| `.planning/` | GSD planning tree (ROADMAP, REQUIREMENTS, PROJECT, STATE, milestones/, phases/) |
| `.planning/milestones/v1.0.0-phases/` | All 14 phase directories with CONTEXT/RESEARCH/PLAN/SUMMARY/VERIFICATION/VALIDATION/UAT |
| `.planning/milestones/v1.0.0-quick/` | 86 archived quick tasks |
| `.claude/skills/efx-async-orchestration/` | Mandatory async discipline (XState v6 + Effect v4 patterns) |
| `.claude/skills/efx-preact-reactivity/` | Mandatory Preact reactivity rules |

### Where to look first
1. **`SPECS/milestone-v1.0.0-plan.md`** — the locked source spec for everything in this milestone.
2. **`.planning/PROJECT.md`** — the live project reference (what this is, core value, validated requirements, key decisions).
3. **`app/src/efx-paint/`** — the v1.0 EFX Paint document model, persistence, and store.
4. **`packages/efx-physic-paint/`** — the Studio window, engine, and Roto timeline.
5. **`.planning/milestones/v1.0.0-MILESTONE-AUDIT.md`** — the 2026-10-12 audit with exact `file:line` evidence for every Known Gap.

### Project format (what a saved project looks like)
```
MyProject.mce/                  ← macOS document package (Finder shows one icon)
  project.mce                   ← light top manifest (formatVersion 16, projectId, …)
  layers/<layerId>.json         ← one sub-file per paint layer (documents, revisions)
  frames/<layerId>/<keyId>.webp ← key rasters as real media files
  audio/…                       ← document sound (reference-only)
```
Pre-1.0 projects are rejected explicitly at open. There is no migration path — by design.

---

## Stats

- **Timeline:** 2026-08-23 → 2026-10-11 (49 days — the longest milestone to date)
- **Phases:** 14 / 14 complete (45–53, incl. inserted 52.1–52.5)
- **Plans:** 80 / 80 complete
- **Quick tasks:** 86 archived into the milestone
- **Commits:** 1,578 (301 feat) — ~20 commits/plan
- **Files changed:** 1,753 (+329,447 / −28,615)
- **Cumulative codebase:** ~137.8k LOC TS/TSX across `app/src` and `packages/`
- **Contributors:** Laurent Marques
- **Model mix:** opus for planning/audit/release, sonnet for execution waves (same profile as v0.9.0)
- **Release:** signed/notarized 1.0.0 macOS app published as GitHub **Latest** on 2026-10-11 — all six REL-01 gates green, 42-row signed-artifact UAT at 36 pass / 6 na / 0 fail
- **Closeout:** `override_closeout` with audit verdict `gaps_found` (65/68 requirements; Known Gaps PKG-06, BKG-09, SND-07)

---

*Summary generated 2026-10-12 from `.planning/milestones/v1.0.0-{ROADMAP,REQUIREMENTS,MILESTONE-AUDIT}.md`, 14 phase CONTEXT/SUMMARY/VERIFICATION files, `.planning/PROJECT.md`, and `.planning/RETROSPECTIVE.md`.*
