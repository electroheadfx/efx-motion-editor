---
phase: 20
slug: paint-brush-fx
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-25
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `Application/vitest.config.ts` |
| **Quick run command** | `cd Application && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd Application && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd Application && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd Application && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-00-01 | 00 | 0 | PAINT-01, PAINT-08 | scaffold | `cd Application && npx vitest run src/types/paint.test.ts src/lib/brushFxDefaults.test.ts --reporter=verbose` | created by W0 | pending |
| 20-00-02 | 00 | 0 | PAINT-06..PAINT-13 | scaffold | `cd Application && npx vitest run src/lib/brushFlowField.test.ts src/lib/brushWatercolor.test.ts src/lib/spectralMix.test.ts src/lib/paintRenderer.test.ts src/lib/paintPersistence.test.ts --reporter=verbose` | created by W0 | pending |
| 20-01-01 | 01 | 1 | PAINT-13 | unit | `cd Application && npx vitest run src/types/paint.test.ts -x` | W0 stub | pending |
| 20-01-02 | 01 | 1 | PAINT-11 | unit+tsc | `npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-02-01 | 02 | 1 | PAINT-06 | tsc+grep | `grep "spectral_mix" Application/src/lib/brushFxShaders.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-02-02 | 02 | 1 | PAINT-10 | tsc+grep | `grep "snoise" Application/src/lib/brushFxShaders.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-03-01 | 03 | 2 | PAINT-06 | tsc+grep | `grep "renderStyledStrokes" Application/src/lib/brushFxRenderer.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-03-02 | 03 | 2 | PAINT-06 | tsc+grep | `grep "compositeSpectral" Application/src/lib/brushFxRenderer.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-04-01 | 04 | 2 | PAINT-08 | tsc+grep | `grep "BRUSH_PREVIEW_URLS" Application/src/lib/brushPreviewData.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-04-02 | 04 | 2 | PAINT-01, PAINT-08 | tsc+grep | `grep "BRUSH STYLE" Application/src/components/sidebar/PaintProperties.tsx && grep "BRUSH FX" Application/src/components/sidebar/PaintProperties.tsx` | N/A | pending |
| 20-05-01 | 05 | 3 | PAINT-09 | unit | `cd Application && npx vitest run src/lib/brushFlowField.test.ts -x` | W0 stub | pending |
| 20-05-02 | 05 | 3 | PAINT-02..PAINT-05 | tsc+grep | `grep "STYLE_CONFIGS" Application/src/lib/brushFxRenderer.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-06-01 | 06 | 3 | PAINT-07 | unit | `cd Application && npx vitest run src/lib/brushWatercolor.test.ts -x` | W0 stub | pending |
| 20-06-02 | 06 | 3 | PAINT-07 | tsc+grep | `grep "renderWatercolorStroke" Application/src/lib/brushFxRenderer.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-07-01 | 07 | 4 | PAINT-11, PAINT-12 | tsc+grep | `grep "element is PaintStroke" Application/src/lib/paintRenderer.ts && grep "renderPaintFrame" Application/src/lib/previewRenderer.ts && npx tsc --noEmit --project Application/tsconfig.json` | N/A | pending |
| 20-07-02 | 07 | 4 | PAINT-01..PAINT-12 | visual | checkpoint:human-verify | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Plan 20-00-PLAN.md creates all test stubs before implementation begins:

- [ ] `src/types/paint.test.ts` -- BrushStyle type union, BrushFxParams interface, default constants
- [ ] `src/lib/brushFxDefaults.test.ts` -- per-style default param values, visible param mapping per style
- [ ] `src/lib/brushFlowField.test.ts` -- flow field creation, sampling, distortion of point arrays
- [ ] `src/lib/brushWatercolor.test.ts` -- polygon deformation, midpoint displacement, layer generation
- [ ] `src/lib/spectralMix.test.ts` -- JavaScript-side spectral math validation (KS/KM functions if exposed)
- [ ] `src/lib/paintRenderer.test.ts` -- conditional routing: flat strokes use Canvas2D, styled strokes route to WebGL2
- [ ] `src/lib/paintPersistence.test.ts` -- sidecar JSON round-trip with brushStyle/brushParams fields

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual brush style appearance | PAINT-03 | Subjective visual quality | Draw strokes with each style, verify visual resemblance to physical media |
| Watercolor bleed organic appearance | PAINT-05 | Visual/aesthetic judgment | Draw watercolor strokes, verify edge bleed looks natural |
| Export visual parity | PAINT-12 | Pixel-level visual comparison | Export frame with styled strokes, compare visually with canvas preview |
| Paper texture appearance | PAINT-07 | Procedural noise visual quality | Draw with watercolor/charcoal, verify paper grain is visible and natural |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 20-00 creates all 7 test stubs)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution
