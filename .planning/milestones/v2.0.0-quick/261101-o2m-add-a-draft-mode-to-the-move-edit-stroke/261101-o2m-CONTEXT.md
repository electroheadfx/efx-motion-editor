# Quick Task 261101-o2m: Add a Draft mode to the Move/Edit Stroke settings dialog - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning

<domain>
## Task Boundary

Add a **Draft** mode to the Move/Edit Stroke settings dialog (the surface shared by Water color Select mode and Brush Move). Draft ON suspends the watercolor engine re-render only: every edit still commits to the script exactly as today, the visible cache stays frozen at its last rendered state, and the stroke overlay shows the current edited script. Draft OFF performs ONE recompute from the current script. A cache-visibility icon hides the frozen cache.

The feature builds on quick `261101-mvg` (Preview stroke size switch + `aquarelleStrokeBand.ts`): Draft draws with that same footprint-band module — bold band when the Preview switch is ON, thin centerline when OFF. The band module is reused, never redefined. Engine math is untouched.

</domain>

<decisions>
## Implementation Decisions

### Draft cluster layout
- A **dedicated strip below the header**, above the filter row: `Draft  [switch]      cache [eye icon]`.
- The strip sits above the list/settings view gate so it is reachable from BOTH views.
- The existing header icon row (`[⌇ Preview] [⚙ view toggle] [× close]`) is unchanged.

### Cache-visibility icon scope
- **Always available** — the icon toggles the committed/frozen sheet in both Draft and Live.
- It is display-only: it never gates a commit, a capture, a save or an export.
- Default: cache visible. The icon toggles both ways.

### Overlay while Draft is ON
- **Selection only — today's overlay law.** `ScriptStrokeOverlay` keeps drawing only `scriptSelectedStrokeIds`.
- Unselected strokes are simply covered by the frozen cache; hiding the cache with the eye icon therefore leaves only the selection visible. That is accepted.
- The band/centerline law still composes with the Preview stroke size switch, unchanged.

### Recompute exits
- Exactly these five exits force the SINGLE recompute first: **dialog close, frame change, play, export, save**.
- Leaving Select mode via the rail toggle does **not** itself recompute; the dialog close that accompanies it does.
- Exits do **not** recompute when Draft is OFF — the normal Live path is untouched.

### Autosave while Draft is ON
- Autosave is **blocked entirely** while Draft is ON: it defers until Draft turns off.
- Rationale: `saveProject` already skips the paint flush for autosave (`skipPaintFlush`), so an autosave mid-Draft would persist the NEW script against the FROZEN pre-Draft pixel sidecar. Blocking is the only outcome that cannot persist a stale cache.
- Accepted cost: a long Draft session saves nothing; a crash loses the Draft edits. This is the user's explicit choice.
- A deferred autosave resumes on the Draft-off recompute, not before.

### Claude's Discretion
- Exact signal names, module placement, strip CSS, and the icon glyph.
- Whether the recompute seam is one shared async helper or a per-exit call to the same function.
- How the frozen-cache hide is expressed in the layer tree (conditional render vs CSS opacity) as long as it is display-only.
- Test strategy details beyond the gates below.

</decisions>

<specifics>
## Specific Ideas

- The switch is `role="switch"`, label "Draft", off by default, session/view state only — never persisted in the document, never undoable.
- Draft mode resets to Live on every dialog open.
- Inside Draft, EVERY edit still commits to the script exactly as today: drag/move, transform handles, resize (Scale / Scale X / Scale Y), Geometry X/Y/Rotation, Paint settings, delete, stack order, and undo/redo.
- The two toggles (Draft, Preview stroke size) compose without resetting each other.
- Watercolor is the required target. Per `PhysicsPaintStudio.tsx` the Brush bundle is already gone (`261027-klx`: "Water color is the only module"), so no second implementation is built.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261101-mvg-preview-stroke-size-switch-in-the-move-e/261101-mvg-SUMMARY.md` — the footprint-band module, the session switch pattern, and the explicit note that the band module was built for "the next quick's Draft mode".
- `app/src/components/physic-paint/view/aquarelleStrokeBand.ts` — `buildStrokeBand` / `buildStrokeBandCached`, pure and Preact/signal-free; reuse as-is.
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — the shared edition module: `strokeSizePreview` signal + compare-then-write setter is the exact precedent for a session-only Draft signal.
- `app/src/components/physic-paint/engine/AquarelleCachedBaseLayer.tsx` — the frozen committed sheet rendered under the live canvas; this is the "cache" the eye icon hides.
- `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx` — mounts `AquarelleCachedBaseLayer` under `AquarelleCanvasLayer`.
- `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts` — the ONE script-replay orchestration every script-backed undo/redo goes through (`runAquarelleScriptReplay`); its `resetSheet` + `rebake` ports are where Draft must skip re-render.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the edit handlers (`handleAquarelleDeleteStrokes`, `handleAquarelleMoveStrokes`, `handleAquarelleTransformStrokes`, `handleAquarelleAppearanceStrokes`, reorder/place), `runScriptReplay`, and `handleRebakeScript`.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — the header icon row and the list/settings view gate.

</canonical_refs>
