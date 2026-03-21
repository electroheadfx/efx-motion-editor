---
phase: 11
slug: live-canvas-transform
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No test framework — manual verification + TypeScript compiler |
| **Config file** | none — no test infrastructure exists |
| **Quick run command** | `pnpm build` |
| **Full suite command** | `pnpm build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm build`
- **After every plan wave:** Run `pnpm build` + manual visual testing
- **Before `/gsd:verify-work`:** Build must pass + all manual behaviors verified
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | scaleX/scaleY data model split | manual | `pnpm build` | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | v4→v5 migration | manual | `pnpm build` | N/A | ⬜ pending |
| 11-01-03 | 01 | 1 | Coordinate mapping accuracy | manual | Visual inspection | N/A | ⬜ pending |
| 11-01-04 | 01 | 1 | Handle visibility follows selection | manual | Visual inspection | N/A | ⬜ pending |
| 11-01-05 | 01 | 1 | Move drag updates position | manual | Visual inspection | N/A | ⬜ pending |
| 11-01-06 | 01 | 1 | Scale drag updates scaleX/scaleY | manual | Visual inspection | N/A | ⬜ pending |
| 11-01-07 | 01 | 1 | Rotation drag updates rotation | manual | Visual inspection | N/A | ⬜ pending |
| 11-01-08 | 01 | 1 | Arrow key nudge | manual | Visual inspection | N/A | ⬜ pending |
| 11-01-09 | 01 | 1 | Escape deselects | manual | Visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No test framework to install — `pnpm build` (TypeScript type checking via `tsc --noEmit && vite build`) serves as the automated check.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Transform handles appear on selection | SC-1 | Visual/interactive UI behavior | Select a layer in timeline → verify bounding box + handles appear on canvas |
| Drag-to-move layers | SC-2 | Pointer interaction on canvas | Select layer → drag interior → verify X/Y update in properties panel |
| Corner-drag to scale | SC-2 | Pointer interaction on canvas | Select layer → drag corner handle → verify scaleX/scaleY in panel |
| Rotation via handle | SC-2 | Pointer interaction on canvas | Select layer → drag rotation handle → verify rotation in panel |
| Bidirectional sync | SC-3 | Requires real-time visual comparison | Change value in panel → verify handle position updates; drag handle → verify panel updates |
| Arrow key nudge | UX | Keyboard interaction | Select layer → press arrows → verify 1px movement |
| Escape deselects | UX | Keyboard interaction | Select layer → press Escape → verify handles disappear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
