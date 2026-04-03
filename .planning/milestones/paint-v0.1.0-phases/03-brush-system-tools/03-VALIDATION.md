---
phase: 3
slug: brush-system-tools
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Wave 0 stubs not needed — all tasks have `<automated>` verify blocks with grep commands.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Browser manual + grep verification (no test framework configured) |
| **Config file** | none — no test framework |
| **Quick run command** | `grep -n "function" efx-paint-physic-v2.html \| head -20` |
| **Full suite command** | `node -e "const fs=require('fs'); const h=fs.readFileSync('efx-paint-physic-v2.html','utf8'); console.log('OK:', h.includes('PaintStroke'))"` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run quick grep verification
- **After every plan wave:** Run full string-presence checks
- **Before `/gsd:verify-work`:** All acceptance criteria grep-verified
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | STROKE-01, STROKE-02 | grep | `grep -c "PaintStroke" efx-paint-physic-v2.html && grep -c "getCoalescedEvents" efx-paint-physic-v2.html` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | BRUSH-02 | grep | `grep -c "brushSize\|brushOpacity\|waterAmount\|dryAmount" efx-paint-physic-v2.html` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | BRUSH-01 | grep | `grep -c "applyEraseChunk\|applyWaterStroke\|applySmearChunk\|applyBlendStroke\|applyBlowChunk\|applyWetChunk\|applyDryChunk" efx-paint-physic-v2.html` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | BRUSH-03 | grep | `grep -c "sampleBrushGrain\|createMirroredBrushGrain" efx-paint-physic-v2.html` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Not needed — all tasks have direct `<automated>` verify blocks covering all requirements. No separate stub phase required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual paint output per brush type | BRUSH-01 | Requires visual inspection of canvas strokes | Select each tool, draw stroke, verify distinct visual behavior |
| Tablet pressure affects output | STROKE-02 | Requires physical tablet device | Draw with pen, verify pressure variance in stroke width/opacity |
| Brush texture visible in strokes | BRUSH-03 | Visual inspection of texture modulation | Paint stroke, zoom in, verify bristle-like variation pattern |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (not needed — inline verify)
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
