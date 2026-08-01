# Phase 38 — API Coverage Declaration

**Verdict:** No external API integration: internal Preact UI + timeline state work

## Rationale

Phase 38 extends the in-app Physics Paint Roto clipboard (group Copy/Paste), the paste-key-group resolver seam, and styled tooltip/capsule presentation polish. All work is internal Preact UI plus timeline state management. The only process boundary crossed is the EXISTING `physicPaintBridge.ts` parent bridge between the editor and the standalone Physics Paint window, owned by plans 38-02/38-04 (not by plan 38-01). No network endpoints are added, no auth surface is introduced, and no new packages are installed — the Package Legitimacy Gate is satisfied vacuously per 38-RESEARCH.md (Standard Stack: no new packages; everything is already installed).
