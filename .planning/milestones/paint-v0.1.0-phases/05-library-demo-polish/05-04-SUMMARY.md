---
plan: 05-04
phase: 05-library-demo-polish
status: complete-with-gaps
started: 2026-03-31
completed: 2026-04-01
---

## Summary

Created the Preact wrapper component (`EfxPaintCanvas`) and full demo application with
toolbar UI. Fixed multiple rendering issues discovered during human verification.
Physics engine quality is degraded vs v3 reference — logged as gap.

## Tasks

| # | Name | Status |
|---|------|--------|
| 1 | Create Preact wrapper and demo app | Complete |
| 2 | Verify demo and archive v3.html | Complete (with gaps) |

## Key Files Created

- `paint-rebelle-new/src/preact.tsx` — EfxPaintCanvas Preact wrapper
- `paint-rebelle-new/src/demo/main.tsx` — Demo entry point
- `paint-rebelle-new/src/demo/App.tsx` — Demo app component
- `paint-rebelle-new/src/demo/Toolbar.tsx` — Full toolbar (~9 sliders, tool buttons, bg/grain selectors)
- `paint-rebelle-new/src/demo/demo.css` — Dark theme CSS with checkerboard transparency
- `paint-rebelle-new/index.html` — Vite demo entry

## Bugs Fixed During Verification

1. **Block artifacts** — brush_texture.png 93% near-zero pixels caused block pattern in deposit
2. **Default color mismatch** — engine #000000 vs toolbar #103c65
3. **Paper names mismatch** — smooth/canvas/rough → canvas1/canvas2/canvas3
4. **Toolbar initial sync** — useEffect pushes all defaults to engine on mount
5. **Opacity not working** — post-multiply approach (render full, scale alpha after emboss)
6. **DENSITY_K 3.5→1.5** — Beer-Lambert was too aggressive for opacity response
7. **forceDryAll /800→/3000** — divisor was too small for uniform deposits
8. **Clear on transparent** — putImageData hard reset instead of clearRect
9. **Background switch** — clearRect before drawImage
10. **Canvas baseline gap** — display:block removes inline gap
11. **Load keeps current background** — strokes replay on current bg, not saved bg
12. **Animated stroke replay** — replayAnimated with setTimeout(1ms) yields
13. **Paper emboss color shift** — darken valleys, lighten peaks for 3D effect

## Known Gaps

See `05-PHYSICS-GAPS.md` for detailed analysis. Summary:
- Physics diffusion quality degraded (no organic flow, no border pushing)
- No color mixing at stroke overlaps
- DENSITY_K/divisor changes broke physics visual fidelity
- Opacity post-multiply interacts poorly with physics savedWet restore

## Decisions

- D-OPACITY: Opacity implemented as post-multiply (not per-layer alpha scaling)
- D-GRAIN: Brush grain removed from deposit; emboss provides visual texture
- D-DENSITY: DENSITY_K reduced 3.5→1.5 for opacity slider response (impacts physics)
- D-LOAD: Load preserves current background, only restores strokes+settings

## Self-Check: PARTIAL

- [x] Preact wrapper creates and destroys engine
- [x] Demo runs in Vite dev server
- [x] Toolbar controls work (tools, sliders, buttons)
- [x] Paint strokes render correctly
- [x] Opacity slider produces visible differences
- [x] Save/Load with animated replay
- [x] Background switching
- [x] v3.html moved to cleaning/
- [ ] Physics diffusion quality matches v3
- [ ] Color mixing at overlaps
- [ ] Consistent drying behavior
