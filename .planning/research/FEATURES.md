# Feature Research

**Domain:** macOS stop-motion editor — v0.9.0 new features (PlayScript workflow, EFX Paint audio preview, macOS identity)
**Researched:** 2026-08-03
**Confidence:** HIGH (spec is user-locked; competitive patterns verified against Dragonframe, DaVinci Resolve, TVPaint, Blender NLA, Procreate, Photoshop preset systems, Apple HIG)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scripts auto-hydration (blocking fix) | Any panel backed by saved data must populate on open. No professional tool requires a hidden manual Refresh to see saved content. DaVinci/Premiere/Dragonframe panels all reflect project state on window open. | MEDIUM | Root cause is an event-ordering race: initial mount observes `project.saved === false`, later authoritative context arrives but the update path rereads a stale launch-context getter. Fix must consume the exact context from the bridge event — no setTimeout/polling/rAF hacks (spec-locked). Must scan exactly once per authoritative context, guard against stale project/layer replacement, keep unsaved gating and manual Refresh intact. |
| Legible macOS app icon | A shipped, signed macOS app with an unreadable Dock/Finder icon reads as unfinished. Apple HIG requires the full 16→1024 size ladder and legibility at small sizes. | LOW | Use the 794×794 alpha source directly (Tauri v2 has no mandatory 1024 source); let Tauri icon tooling generate the ICNS ladder. Apple HIG guidance: single centered focal element, no baked-in corner radius (macOS applies the mask), fine detail and small text must not be load-bearing at 16/32px. Visually verify 16/32/64/128/256/512 before packaging. Generated tracked files under `app/src-tauri/icons/` stay release authority. |
| Desktop Vite build hygiene | A packaged desktop app should not emit web-distribution warnings that train the developer to ignore the build log. | LOW | `chunkSizeWarningLimit: 1100` is a monitored desktop entry-bundle budget, documented as not-a-performance-claim. Only correct dynamic imports proven ineffective (same module already eagerly imported, no cycle/timing change). Preserve Tauri/browser runtime guards and genuine lazy chunks. |
| Audio plays synchronized to the local playhead/cursor | In every comparable tool, audio follows the active playhead everywhere it is visible. Dragonframe drops video frames to keep playback in sync with audio (audio is the timing master); Resolve's audio is locked to the playhead across all pages. Hearing the project's audio while previewing Roto frames is the baseline expectation once audio exists in the project. | HIGH | Frame-mapping truth table (EFX Paint app frame → parent layer frame → sequence-local frame → global frame → audio offset/trim) must be locked before implementation (spec AUDIO-03). Drift prevention: treat the audio clock as master (Dragonframe pattern), never accumulate independent timers. Reuse existing audioStore types and Tauri asset transport; do not duplicate schema. |
| Local audio monitoring On/Off toggle | Resolve has exactly this precedent: Shift+S / Timeline → Audio Scrubbing toggles audio monitoring locally without touching track mute state. Users expect monitoring control to be session-local and non-destructive. | LOW (bundled with audio preview) | Session-local preference only; must not mutate main-editor mute/volume/fades, must not affect export. Also doubles as the escape hatch when audio preview misbehaves (AUDIO-06 failure behavior). |
| Application-time color override for reusable presets | Standard in preset systems: Photoshop tool presets optionally "Include Color," and brush settings can be overridden at use time via the options bar without mutating the stored preset; lock icons selectively override preset values. Users expect to recolor a reusable script at apply time without editing the library document. | LOW-MEDIUM | Override clones at application time; erase strokes keep erase behavior; source script JSON and WebP thumbnail never change; identical behavior in progressive and static/hold modes. Persisted default overrides inside script documents are spec-excluded — keep the library immutable. |
| Loop truncation by the next clip, with requested vs effective duration visible | NLE and animation timelines universally give priority to later content on the same track; loops resolve to the earlier of next-clip start or sequence end. Users expect the timeline to say when a loop was shortened, not silently disagree with the requested count. | MEDIUM (bundled with Hold Loops) | Half-open intervals so adjacent clips meet without off-by-one overlap. Partial final cycle is valid. French label locked: `Boucle raccourcie par le clip suivant`; the ambiguous `clip bloquant` is banned. Moving/removing the next clip recalculates effective duration without regenerating sources. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Read-only audio preview inside a standalone sub-window (EFX Paint) | Comparable tools monitor audio inline (CapCut: main preview only; Resolve: same-process pages; Dragonframe: same-process X-Sheet). A cross-window, Tauri-native, read-only audio context synchronized to a child editor's cursor is beyond what any stop-motion tool offers — Dragonframe is the category leader and its audio lives in the main window. | HIGH | Depends on the existing `physic-paint:seek-frame` Tauri listen branch (G-01, approved) as the transport precedent. Single playback authority in EFX Paint — duplicate engines producing doubled audio is a release stop condition. Missing assets = non-blocking warning; preview failure must never block paint editing; closing the window releases audio resources. |
| Explicit progressive vs static/hold PlayScript application modes | Turns one replay algorithm into a two-step authoring workflow: draw progressively over range A, then hold the completed form over range B. TVPaint separates Loop/Ping-Pong/Hold as pre/post behaviors; Procreate has per-frame Hold duration — but neither offers script-level progressive-vs-hold application over arbitrary ranges. | MEDIUM | Application mode controls which strokes materialize; it is not a Roto interpolation mode and must stay separate from Script Motion naming (spec: do not overload `Motion`). Default options must keep progressive output bit-identical to current behavior (equivalence regression). |
| Linked Hold Loop Clips (cycle × repeat 1..∞) with no duplicated source assets | Directly mirrors the two strongest precedents: Blender NLA strips are linked references to a single action with a Repeat count (edit the action → every strip updates), and Dragonframe "virtual holds" shoot once and hold N without storing unique images. Combined with deterministic Script Motion variation in the source cycle, this gives line-boil/cycle workflows (TVPaint's Repeat Images use case) with asset economy no stop-motion tool has. | HIGH | Semantics locked: `cycleLength = sourceFrameRefs.length`; finite = cycle × count; infinite resolves to next clip or parent end; modulo indexing for occurrence → source; editing a source frame updates every occurrence; rebuildable render caches allowed, duplicated durable assets are not. Repeat-count edits must never regenerate or duplicate the cycle. |
| Filmstrip capsule timeline visualization with explicit cycle badges | Most tools show repetition only implicitly (NLA strip extents, TVPaint behavior icons). An explicit capsule — detailed source cycle, hatched linked-repetition band, `Cycle 5f × 5 = 25f` / `Cycle 5f × ∞` badge, lighter linked cells at high zoom, diagonal truncation end with French interruption label, click-to-reveal repeat instance and source index — makes requested-vs-effective duration legible at a glance. | MEDIUM-HIGH | This is the UI that makes the Hold Loop model trustworthy; it is the primary surface for the truncation communication table-stakes requirement. Builds on the existing fixed-geometry Roto strip and elastic status capsule patterns from Phase 36.15. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. All are either spec-excluded or contradict locked decisions.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Audio editing inside EFX Paint (trim, volume, fades, independent timeline) | Feels convenient when working in the paint window | Creates a second authority over main-editor audio data; sync/persistence conflicts; explicitly spec-excluded ("EFX Paint must not move, trim, reorder, mix, persist, or export an independent audio timeline") | Read-only preview context + revisioned bridge updates; user returns to the main editor for edits (single authority, like CapCut's inline model) |
| Timing-hack hydration fix (setTimeout, polling, rAF retries) | Masks the race quickly | Flaky native behavior; duplicate scans; stale cross-project rows; spec release stop condition | Consume the exact authoritative context from the bridge event or wait for genuinely committed context; identity/generation guards with one-scan assertions |
| Materializing loop repetitions as duplicated durable frame assets | Simplest implementation ("just bake the 25 frames") | Storage/cache growth; editing the cycle requires editing N copies; contradicts Blender NLA linked-strip and Dragonframe virtual-hold precedents; release stop condition | Linked loop region with source references + modulo resolution; rebuildable render caches only |
| Persisted default color override inside reusable script documents | "Save my favorite override with the script" | Mutates library data; one script can't serve multiple color contexts; spec-excluded | Application-time clone only; override lives in the apply operation, never in the script JSON or thumbnail |
| Ping-pong loop mode in v0.9.0 | TVPaint, Procreate, and Dragonframe all offer ping-pong | Not in the locked spec; adds a second repetition semantic to a model whose interval/truncation math must ship bug-free; balloons the HOLD-05 test matrix | Ship Loop (and Hold via static mode) only; ping-pong is a clean v0.9.x+ addition once linked-loop resolution is proven |
| Web-oriented bundle splitting / broad `manualChunks` to satisfy Vite's 500 kB default | Silences the warning "properly" for a web audience | Artificial code splitting for a local-asset desktop app; fake lazy bootstrap imports; spec-excluded | Documented 1100 kB desktop budget + real production-build regression seam |
| Manual upscale of icon source to 1024×1024 | Assumed Tauri requirement | Unnecessary blur/altered artwork; Tauri v2 has no documented mandatory 1024 source | Use the 794×794 alpha source directly; ICNS still embeds a 1024 representation |
| Automatic loop extension past the next clip / "smart" overlap merging | Feels helpful | Violates next-clip priority; causes off-by-one overlap corruption (spec risk register) | Strict half-open intervals; next clip always truncates; moving/removing it re-expands the loop deterministically |

## Feature Dependencies

```
[Scripts auto-hydration fix]  (BLOCKING prerequisite)
    └──blocks──> [PlayScript application modes]
    │                └──requires──> [Deterministic Script Motion (existing)]
    └──blocks──> [Color override]
    └──blocks──> [Hold Loop controls]
                     └──requires──> [Static/hold mode]
                     └──requires──> [Linked loop resolution model]
                                        └──drives──> [Filmstrip capsule visualization]

[Audio preview in EFX Paint]
    └──requires──> [Existing Tauri frame-sync bridge (physic-paint:seek-frame, G-01)]
    └──requires──> [Frame-mapping truth table (AUDIO-03) — lock first]
    └──requires──> [Existing audioStore types + Tauri asset transport]
    └──paired──> [Session-local monitoring toggle]

[macOS icon replacement]
    └──requires──> [Existing signed release pipeline (v0.8.1)]
    └──independent of──> [Build hygiene]

[Build hygiene] ──independent──> [all feature work]
```

### Dependency Notes

- **Hydration fix blocks all PlayScript work:** Spec-locked — the milestone cannot publish while scripts or Save Script need manual Refresh, and PlayScript UI controls sit in the same Scripts panel whose hydration is broken. It is the first bounded delivery (Phase 0).
- **Hold Loops require static/hold mode:** A loop replays a completed-drawing source cycle; without the static materialization path there is no cycle to link. PLAY-01 → PLAY-04 → HOLD-05 is the required order.
- **Filmstrip visualization depends on the loop resolution model:** The capsule renders requested vs effective duration, repeat instances, and truncation — all outputs of the HOLD-05 resolver. Build the resolver's state model first; the capsule is its view.
- **Audio preview requires the frame-mapping truth table before implementation:** AUDIO-03 names five frame domains; the spec risk register flags ambiguous mapping as the drift root cause. Lock the truth table in the discuss phase (per the user's "truth table before patches" precedent from Roto timing work).
- **Audio preview reuses the G-01 transport precedent:** The approved Tauri listen branch for `physic-paint:seek-frame` is the proven pattern for main-editor → standalone-window sync; audio preview context should follow it rather than inventing a new channel.
- **Icon and build hygiene are independent:** Both touch only release/build surfaces; safe to run parallel to feature phases (the schedule shows them in week 1 alongside the hydration fix).

## MVP Definition

### Launch With (v0.9.0)

Minimum for this milestone — all are spec-committed; none are optional.

- [ ] Scripts auto-hydration fix — blocking prerequisite; milestone cannot publish without it
- [ ] macOS icon replacement — release-identity commitment; verified on Finder/Dock/DMG/app-switcher
- [ ] Build hygiene (1100 budget + safe mixed-import fixes) — cheap, spec-committed, gates the build log for the whole milestone
- [ ] Read-only audio preview + monitoring toggle — headline workflow feature
- [ ] Progressive/static modes + color override — headline PlayScript features
- [ ] Hold Loops + filmstrip capsule — headline differentiation; largest complexity budget

### Add After Validation (v0.9.x)

Features to add once v0.9.0 behavior is proven in native UAT.

- [ ] Ping-pong loop mode — natural extension of linked-loop resolution once finite/infinite truncation is trusted
- [ ] Combined progressive-plus-hold scheduler — spec explicitly says the user may apply two operations to adjacent ranges; automation is convenience, not capability

### Future Consideration (v1.0+)

- [ ] Multi-track internal Paint — spec-excluded; belongs to the v1.0 multi-track milestone on the roadmap
- [ ] Reveal masks, photo/reference track changes — spec-excluded

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Scripts auto-hydration fix | HIGH (broken trust in shipped feature) | MEDIUM | P1 — blocks everything |
| macOS icon replacement | HIGH (release identity, user-approved artwork) | LOW | P1 |
| Build hygiene | MEDIUM | LOW | P1 |
| Audio preview + toggle | HIGH (core workflow: hear audio while animating) | HIGH | P1 |
| Progressive/static modes | HIGH | MEDIUM | P1 |
| Color override | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Hold Loops + filmstrip capsule | HIGH (unique capability) | HIGH | P1 |

**Priority key:**
- P1: Must have for v0.9.0 (all spec-committed features are P1; the milestone is deliberately tight)
- P2: Ping-pong loops, progressive+hold scheduler (post-release)
- P3: Multi-track Paint (v1.0 scope)

## Competitor Feature Analysis

| Feature | Dragonframe | TVPaint / Blender / Procreate | Our Approach (v0.9.0) |
|---------|-------------|-------------------------------|------------------------|
| Audio monitoring during animation | Waveform in Timeline + X-Sheet; audio is timing master, video frames drop to stay in sync; single-frame audio stepping; Time-Warp keeps audio locked at project frame rate. All same-process. | Resolve: audio scrubbing toggle (Shift+S) is session-local; CapCut: inline preview only, no sub-window audio. | Read-only revisioned audio context pushed to the standalone EFX Paint window over the Tauri bridge; audio clock as master to prevent drift; session-local On/Off toggle (Resolve precedent). Beyond category norm: cross-window monitoring. |
| Holds / repeated frames | Hold button repeats a frame N times; "virtual holds" store one image for N frames (no duplicated assets); loop/ping-pong playback for preview only. | Procreate: per-frame Hold duration; TVPaint: per-layer Loop/Ping-Pong/Hold pre-post behaviors + Repeat Images for cycles (line boil). | Static/hold mode materializes the complete script per destination frame; linked Loop Clips give cycle × repeat 1..∞ with zero duplicated durable assets (virtual-hold precedent generalized to multi-frame cycles). |
| Linked/instanced timeline content | Virtual holds only (single-frame). | Blender NLA strips: linked references to one action, Repeat count property, edit-source-updates-all-instances. Strongest precedent. | Linked loop region with `sourceFrameRefs` + modulo resolution; editing a source frame updates every occurrence; repeat-count edits never regenerate sources. NLA semantics adapted to a paint-frame timeline. |
| Loop truncation display | N/A (no cycle clips). | NLEs truncate silently or with clip-trim UI; NLA shows strip extents only. | Filmstrip capsule with `Cycle 5f × 5 = 25f` / `× ∞` badges, hatched repetition band, diagonal truncation end, explicit French label `Boucle raccourcie par le clip suivant`, click-to-reveal repeat instance + source index. Differentiator. |
| Preset color handling | N/A. | Photoshop: tool presets optionally "Include Color"; options-bar overrides never mutate the stored preset; lock icons selectively override. | Application-time override clone; erase strokes preserved; script JSON + WebP thumbnail immutable; identical in both modes. Matches the strongest preset-system precedent. |
| App icon at small sizes | N/A. | Apple HIG: full 16→1024 ladder; simplify/single focal element; no baked corner radius; per-size detail reduction. | 794×794 alpha source used directly; Tauri generates the ladder; visual legibility check at all six practical sizes before packaging; signed/notarized pipeline unchanged. |

## Sources

- [Dragonframe Software Features](https://www.dragonframe.com/dragonframe-software/) — waveform in Timeline/X-Sheet, frame-drop sync, Time-Warp (HIGH)
- [Using Dragonframe 2025 (manual PDF)](https://www.dragonframe.com/download/Using%20Dragonframe%202025.pdf) — audio drops frames to keep sync; per-frame audio stepping (HIGH)
- [Dragonframe User Guide (Mac PDF)](https://film-media.dartmouth.edu/sites/film_media/files/dragonframe_user_guide_-_mac.pdf) — Hold frames / virtual holds (HIGH)
- [Blackmagic — DaVinci Resolve Fairlight](https://www.blackmagicdesign.com/products/davinciresolve/fairlight) — sync scrollers, monitoring panel (HIGH)
- [Blackmagic Forum — audio scrubbing toggle](https://forum.blackmagicdesign.com/viewtopic.php?f=21&t=151091) — Shift+S session-local audio scrubbing toggle precedent (MEDIUM)
- [TVPaint docs — Pre and Post Behaviors](https://doc.tvpaint.com/docs/animation-additional-functions/timeline-options/pre-post-behavior) — Loop/Ping-Pong/Hold per-layer behaviors (HIGH)
- [TVPaint docs — Repeat Images function](https://doc.tvpaint.com/docs/animation-advanced-functions/repeat-images-function) — cycle repetition for line-boil (HIGH)
- [Versluis — Looping walk animations with Blender NLA](https://www.versluis.com/2020/03/how-to-loop-walk-animations-with-blenders-nla-editor/) — NLA strips as linked action references with Repeat (MEDIUM, corroborated by Blender manual knowledge)
- [Procreate Handbook — Animation Assist settings](https://help.procreate.com/procreate/handbook/animation/animation-settings) — Hold Frame, Loop/Ping-Pong/One-Shot (HIGH)
- [Procreate Dreams overview](https://ipalibrary.me/procreate-dreams/) — multi-track timeline, visible-region looping (MEDIUM)
- [ClearPS — Brush Preset vs Tool Preset](https://clearps.com/photoshop-discussions/threads/55425-brush-preset-vs-tool-preset/) — "Include Color," override-without-mutate preset semantics (MEDIUM)
- [Affinity forum — brush preset overrides](https://forum.affinity.serif.com/index.php?/topic/108661-brush-settings-not-restored-to-default-values/page/2/) — override does not alter stored preset (MEDIUM)
- [Apple HIG — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons) — size ladder 16→1024, small-size simplification, system-applied mask (HIGH)
- [CapCut resource — separate audio from video](https://www.capcut.com/resource/how-to-separate-audio-from-video-in-imovie) — inline monitoring model, no sub-window audio engine (MEDIUM)

---
*Feature research for: EFX-Motion Editor v0.9.0 — PlayScript Workflow, EFX Paint Audio Preview, and macOS Identity*
*Researched: 2026-08-03*
