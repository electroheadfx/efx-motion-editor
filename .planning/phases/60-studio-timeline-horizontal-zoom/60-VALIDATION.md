---
phase: "60"
slug: "studio-timeline-horizontal-zoom"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-09"
---

# Phase 60 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.9 (`app/package.json:52`) |
| **Config file** | `app/vitest.config.ts` — project default; do not add a one-off config |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Estimated runtime** | ~45–90 seconds (full suite; quick file < 5 s) |

**Constraint:** vitest collects only `.test.ts` files — a `.test.tsx` verify target exits 0 while running nothing. Keep new tests `.test.ts`; render components through the existing node-environment harness used by `TimelineMotionChannels.test.ts`.

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the PLANNER; this map binds each requirement to its required automated proof.

| Requirement | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| ZOOM-01 | `resolveAnchoredScrollLeft` keeps `pxToFrame(scrollLeft + localX)` invariant across a scale change (incl. the 6px gutter) | T-60-01 | Non-finite delta clamped before any write | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts -t "anchored"` | ✅ | ✅ green |
| ZOOM-01 | Wheel factor `exp(-delta*0.001)` normalized for `deltaMode===1`; clamped 0.25–4 | T-60-01 | `Number.isFinite` + clamp to `[0.25, 4]` | unit | `… vitest run …/physicsPaintTimelineZoom.test.ts -t "wheel factor"` | ✅ | ✅ green |
| ZOOM-02 | Presets `[0.25,0.5,0.75,1,1.5,2,3,4]`; `nextTimelineZoomPreset(1.37,+1)=1.5`, `(1.37,-1)=1`; ends disabled | — | — | unit | `… -t "preset"` | ✅ | ✅ green |
| ZOOM-02 | Fit = `clamp(viewportFrames / frameCount)`, one-shot, clamped into range | — | — | unit | `… -t "fit"` | ✅ | ✅ green |
| ZOOM-02 | Pill host + display-only percent + Fit aria-pressed (source contract) | — | No `innerHTML`; numeric-only style strings | source-string | `… vitest run …/physicsPaintTimelineZoomWiring.test.ts` | ✅ | ✅ green |
| ZOOM-03 | At every preset pitch changes while row/lane/cell heights do not | — | — | unit | `… -t "vertical fixed"` | ✅ | ✅ green |
| ZOOM-04 | `resetForStudioOpen()` returns scale to 1; wiring pins the call at the Studio mount seam | — | No cross-document zoom leakage | unit + source-string | `… -t "reset"` + wiring test | ✅ | ✅ green |
| ZOOM-05 | Zoom matrix at 0.25/0.5/1/2/4: playhead centre, hit-test frame, ruler extent, sound stain left/width, Loop Clip extent, audio visible range | — | Bounded 4× prevents layout DoS | unit (pure helpers) | `… vitest run …/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` | ✅ | ✅ green |
| ZOOM-05 | No local `× 18`: source audit finds zero pitch literals outside the module and the base tokens | — | — | source-string | `… -t "single authority"` | ✅ | ✅ green |
| ZOOM-05 | Repointed pins: strip no longer contains `ROTO_CELL_WIDTH_PX = 18`; ruler/playhead/grid assertions target the authority | — | — | source-string | repointed `PhysicsPaintWorkflowStrip.test.ts` / `.rulerSeek.test.ts` | ✅ repoint | ✅ green |

**Matrix predicates (the acceptance surface):** with `P = 18·s`, `CW = 16·s`, `G = 2·s` —
- playhead centre: `6 + f·P + P/2 − 1` (equals `6 + f·18 + 8` at s = 1)
- hit-test: `floor((x − 6 + scrollLeft)/P)` vs `frameToPx` round-trip
- ruler: `step = min{3k : 3k·P ≥ 40}`, tick extent `step·P` (54 at 1×)
- sound stain: left `start·P`, width `(out−in)·P`
- Loop Clip: left `(clippedStart − windowStart)·P`, width `n·P − G` (or full extent when clipped)
- audio range: `visStart = scrollLeft/P`, `visEnd = (scrollLeft + clientWidth)/P`

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/src/components/physic-paint/view/physicsPaintTimelineZoom.test.ts` — module math, presets, ruler step, fit, anchor, viewport frames (ZOOM-01/02/04)
- [x] `app/src/components/physic-paint/view/physicsPaintTimelineZoomWiring.test.ts` — reset seam, pill host, display-only percent, wheel-branch source contract (mirrors `physicsPaintCanvasZoomWiring.test.ts` shape)
- [x] `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.zoomMatrix.test.ts` — the five-level matrix (write LAST, after the literal audit reaches zero)
- [x] Repoint the 9 existing pin assertions listed in PITFALLS.md Pitfall 8 / RESEARCH.md
- [x] No framework install needed — vitest is present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wheel/pinch zoom feel and cursor anchoring | ZOOM-01 | Continuous exponential feel and macOS trackpad pinch delivery cannot be asserted from jsdom | Cmd+wheel over the timeline at several cursor positions; the frame under the cursor must stay put. Pinch on the trackpad must take the same path. Plain wheel must still scroll horizontally |
| Scroll-snap interaction after an anchored zoom (RESEARCH Assumption A2) | ZOOM-01 | `scroll-snap-type: x mandatory` may snap back an anchored `scrollLeft` write; needs the real layout engine | Zoom in/out repeatedly over a rail; verify the playhead/cursor frame does not jump after the write settles |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-09 — 10/10 map rows green (140 tests across the 5 coverage files); 2 behaviors remain manual-only (pinch feel, scroll-snap settle) and are deferred to the phase's live UAT.

## Validation Audit 2026-11-09

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
