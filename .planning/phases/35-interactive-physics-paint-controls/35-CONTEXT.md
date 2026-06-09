# Phase 35: Interactive Physics Paint Controls - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 35 must turn physics paint into an interactive editor-to-standalone-to-editor workflow, not only an isolated standalone demo. From the EFX Motion Editor, the user creates/selects a `physic-paint` layer, moves to a frame, clicks an `[open fx paint canvas]` control in that layer's parameters, paints in the physics paint standalone window, then applies the result back into the editor.

This intentionally expands the roadmap's current standalone-only wording: Phase 35 should include the app entry point and return actions needed for the user to validate the real physics paint workflow now.

</domain>

<decisions>
## Implementation Decisions

### App-to-standalone workflow
- **D-01:** The EFX Motion Editor must expose a `physic-paint` layer path with a parameter/button labelled `[open fx paint canvas]` that opens the physics paint standalone canvas for the current layer/frame context.
- **D-02:** The standalone is the editing surface for the physics paint layer. The app does not receive editable strokes or engine internals from the standalone.
- **D-03:** The only data applied back to the app is rendered output: either the current rendered image or a generated sequence of rendered frames.

### Standalone controls
- **D-04:** Everything that exists in the physics paint demo toolbar should be present in the standalone window, not reduced to a minimal control set.
- **D-05:** Controls that are visible but not implemented or not connected yet should remain visible and disabled with a clear disabled state, rather than hidden.
- **D-06:** The main purpose of the controls is to control the paint/physics paint session. Import/export is the exception: it is for saving and reloading editable paint state files.

### Apply actions and diagnostics
- **D-07:** The standalone should show a ready/not ready state that tells the user whether the current paint output can be applied back to the app.
- **D-08:** The standalone must provide `[apply canvas]`, which writes the current rendered image back into the `physic-paint` layer at the current app frame.
- **D-09:** The standalone must provide `[apply play canvas]`, which writes a generated frame sequence into the `physic-paint` layer timeline.
- **D-10:** For `[apply play canvas]`, the user provides a number of frames. The standalone generates that many frames and writes them into the app timeline starting from the frame where the user was positioned when opening/applying from the app.

### Import/export state files
- **D-11:** Import/export in this phase means save/reload the editable physics paint state as a file so users can resume or test imported states.
- **D-12:** Import/export does not define the rendered-output path back to the app. Rendered output is applied via `[apply canvas]` and `[apply play canvas]`.

### Scope note for downstream agents
- **D-13:** Downstream research/planning must treat the app entry point and apply-back path as part of Phase 35, despite the roadmap listing later phases for persistence/output proof and future integration contracts. This is a user-approved scope expansion captured during discussion.

### Claude's Discretion
Planner/researcher may choose the safest technical seam for opening the standalone and applying rendered outputs, but must preserve the user-facing flow and labels above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap and requirements
- `.planning/ROADMAP.md` — Phase 35 currently describes standalone interactive controls; Phase 36/37 define later persistence/output/integration boundaries that are now affected by the Phase 35 scope expansion.
- `.planning/REQUIREMENTS.md` — Requirements PAINT-01, PAINT-02, PAINT-03, PAINT-04, and DIAG-01 apply to Phase 35.
- `.planning/PROJECT.md` — v0.8.0 standalone physics paint context and prior failed adapter direction.
- `.planning/STATE.md` — Current project workflow state and completed Phase 34 context.

### Prior phase context
- `.planning/phases/34-standalone-demo-shell/34-CONTEXT.md` — Standalone package-local demo boundaries and public API preference from Phase 34.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/efx-physic-paint/demo/src/App.tsx`: Existing Preact standalone demo shell and engine-ready integration pattern.
- `packages/efx-physic-paint/demo/src/Toolbar.tsx`: Existing broad toolbar surface that should remain visible in the standalone window.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`: Public engine API surface for painting, settings, physics state, save/load, canvas access, and rendered output access.
- `packages/efx-physic-paint/src/preact.tsx`: Preact wrapper lifecycle for embedding/controlling the engine in the standalone demo.

### Established Patterns
- v0.8.0 physics paint remains additive: it does not replace perfect-freehand basic paint or p5.brush FX paint.
- The rejected headless/batch adapter approach must not return. Preserve interactive incremental simulation quality rather than editor-driven batch rendering from strokes.
- Phase 34 established a package-local standalone demo under `packages/efx-physic-paint/demo` with root `pnpm` scripts.

### Integration Points
- EFX Motion Editor paint layer parameters need an `[open fx paint canvas]` entry point for a `physic-paint` layer.
- The standalone needs a return channel for rendered image/frame outputs, not editable stroke transport.
- The `physic-paint` layer timeline must receive rendered frames starting at the current app frame for `[apply play canvas]`.

</code_context>

<specifics>
## Specific Ideas

- User flow: create/select a `physic-paint` layer → position on a frame → click `[open fx paint canvas]` in layer parameters → paint in standalone → click `[apply canvas]` for the current image or `[apply play canvas]` for generated frames.
- `[apply canvas]` applies the current canvas render to the app.
- `[apply play canvas]` asks for a frame count and writes that generated sequence into the `physic-paint` layer timeline from the current app frame.
- Ready/not ready diagnostics should be prominent enough to tell whether applying back to the app is valid.

</specifics>

<deferred>
## Deferred Ideas

None — discussion intentionally expanded Phase 35 rather than deferring the app entry/apply-back workflow.

</deferred>

---

*Phase: 35-Interactive Physics Paint Controls*
*Context gathered: 2026-06-08*
