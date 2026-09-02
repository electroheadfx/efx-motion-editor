# Phase 52: Shared Mask Compositor and Reveal - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Reveal the photo/reference source through animated coverage from one or more internal Paint tracks. Delivered as the **4th rail kind on the single track type** — `reveal` with two variants (`reveal/motion` and `reveal/static`) — that **bakes** the photo reference (as placed on the canvas, Phase 50 transform/opacity) into **real track keys** over a rail span at explicit Replay time.

**Core re-orientation (user, this discussion — supersedes the spec framing):** A Reveal does NOT dynamically mask the photo at composite time. Playing a Reveal script **bakes** the revealed photo pixels into the track as real cached pixels over time, stored as keys (existing pixel-cache/key machinery, with interpolation). After generation these are **normal track pixels** — editable, interpolatable, undoable — rendered by the existing track pipeline. Studio preview AND flattened output read the same keys; **no shared offscreen source-plus-mask compositor is needed**. This **supersedes RVL-01 as written**; RVL-02's mask semantics become **generation-time** semantics (alpha coverage is baked, soft edges are baked in, eraser is a normal key eraser afterward).

**Naming contract (locked by user, carried from Phases 45/46/47/48/49/50):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

**Copy language (carried from Phase 47):** All user-facing copy is **English**.

**Terminology (rail vocabulary, user):** A track carries rail kinds. The reveal rail is the **4th rail kind** (alongside `paint`, `motion`, `static`) with a motion/static duality. There is **no reveal row** and **no mask-track picker**. "Play reveal" = "replay the rail" — one action that produces the bake.

</domain>

<decisions>
## Implementation Decisions

### Core model (re-orientation; supersedes spec §Phase 8 framing)
- **D-01:** **Bake-into-keys reveal — no runtime mask compositor.** Reveal Replay bakes the photo reference (as placed) into real track keys over the rail span using the existing pixel-cache/key machinery with interpolation; after bake the keys are ordinary track content. The spec's "one offscreen source-plus-mask compositor shared by Studio and flattened output" is **superseded**; there is no runtime mask evaluation. — **Reversibility:** one-way — the model defines what the flattened output and saved document contain; reverting to a runtime compositor later is a different product and invalidates saved reveals.
- **D-02:** **The Reveal result IS keyframed track data (RVL-04 becomes trivial).** Studio preview, flattened output, and export all read the same track keys. Playback NEVER writes; loop resolution reads the same keys. One track pipeline, no second compositor path (Pitfall 8 diverence risk closed by construction).

### Surface & rail model
- **D-03:** **Reveal is the 4th rail kind on the single track type** (`paint` / `motion` / `static` / `reveal`), with two variants: **`reveal/motion`** links a progressive script (bakes progressively-revealed keys) and **`reveal/static`** links a static/hold script (bakes the completed result). **No new track type, no reveal row, no mask-track picker.** Reveal rails are created through the **normal rail-creation flow on any track**; a rail's baked keys land on the track the rail sits on as ordinary key content alongside hand-painted rails. Dragging a rail (or deleting it) applies to any track; all tracks participate in the compositor as usual (track hide/solo/opacity/blend apply normally to baked keys). — **Reversibility:** one-way — "no mask-track picker" is a published surface contract; reintroducing a picker later changes the authoring flow.
- **D-04:** **Dragging a reveal rail in time or across tracks TRANSLATES rail + baked keys as a unit** to the destination track — no re-bake on drag. The baked keys show the reference state as baked (stale if the reference was re-adjusted); refresh only via explicit Replay.

### Rail mechanics
- **D-05:** **Replay OVERWRITES every baked key in the rail span** — replay means "this span becomes exactly what the script now produces from the current reference placement and script" (like a PlayScript Apply regenerating Loop Clips). Hand edits within the span (eraser, paint) are replaced on replay. **No per-key hand-modification/dirty-flag tracking** (partial refresh is unpredictable and expensive). **Recovery instead of preservation:** replay is one undo-ledger entry (RVL-06) — a single undo restores the previous baked keys including hand edits when the loss was accidental; to keep hand edits durably while replaying the original, drag the rail (with its keys) to another track first and replay the original — the multi-track compositor law layers both results. — **Reversibility:** costly — changing the overwrite law later changes which pixels survive a replay and requires re-validating the undo semantics.
- **D-06:** **Deleting a reveal rail deletes ALL keys in its frame range** (baked keys + any hand content written in that range) — rail, baked keys, and span move and delete as one unit (consistent with D-04). One undo restores the whole unit. No ownership/provenance markers.
- **D-07:** **Span editing law: shorten deletes, stretch leaves empty.** Shortening the rail span DELETES the baked keys now outside it (undo recovers). Stretching keeps existing keys and leaves the new frames EMPTY until a voluntary Replay fills them. Rail content == rail span, always — no orphan content, no ambiguity.
- **D-08:** **repeat/endless applies to the rail span Loop-Clip-like.** The baked keys are the source cycle; repeated frames are derived by the existing resolver reading the same keys (no durable duplication — Phase 49 D-09 rule, Pitfall 9). Playback and loop resolution never write keys.
- **D-09:** reveal/motion bakes a key per frame across the span (each key carries the coverage revealed at that frame) — playback animates the reveal by playing those keys. reveal/static bakes the completed result. Interpolation between baked keys uses the existing Roto physical key machinery (exact key density/deduplication: Claude's discretion).

### Script linkage & bake lifecycle
- **D-10:** **Script chosen at rail creation via the existing SCRIPTS picker**, filtered by kind (progressive for `reveal/motion`, static/hold for `reveal/static`). The rail **references** the library script — never a frozen copy. **No mismatch states** (a static script on a `reveal/motion` rail is not a defined combination).
- **D-11:** **Bake is explicit Replay only** (the rail is the command) — one pass writes the keys for its span. Timeline playback NEVER writes. Script edits and reference re-adjustment never trigger anything automatically. "Play reveal" = "replay the rail."
- **D-12:** **No placed reference at Replay → fail-closed**: status-capsule red warning (Phase 46/48 pattern), NO keys written, rail stays ready to replay once a reference is placed. (Frame-aligned reference resolution and missing-source fail-closed carry from Phase 50 D-04/D-15.)
- **D-13:** **Relay with a DELETED library script → fail-closed**: status-capsule red warning, existing baked keys **untouched**, no crash, no silent re-bake from anything else. The rail stays and can be re-linked to a new kind-matched script or deleted (missing-source fail-closed pattern).

### Reference input & mode
- **D-14:** **The script consumes the photo/reference AS PLACED on the canvas** (Phase 50 position/scale/rotation/adjustments), never raw source bytes. Baked keys capture the reference state at generation time; re-adjusting the reference or editing the script requires a Replay to refresh.
- **D-15:** **DROP the `PhotoReferenceMode` mode flag entirely** (`reference-only` / `reveal-source` / `masked-transform-source`) — clean break, **no vestigial state**. The reveal rail bakes the reference as placed regardless of any mode. The real guard is **RVL-05**: photo pixels reach flattened output ONLY through keys written by the Reveal — the Phase 50 D-06 exclusion inverts into a **bake-time guarantee**. — **Reversibility:** one-way — changing the v1.0 document schema to remove the `mode` field breaks parsing of Phase 50-era v1.0 documents; acceptable under the clean-break no-compat contract (Phase 45).

### Authoring workflow (locked)
- **D-16:** The locked end-to-end authoring story:
  1. Place/adjust the reference (Phase 50 modal; reduced opacity as a guide).
  2. Paint strokes over the placed reference — during authoring these are **ordinary paint strokes** (final color render), **NOT a live reveal preview**.
  3. Save the paint as a script in the existing SCRIPTS library.
  4. Photo-reference modal → **"Reveal with script…"** → rail created on the current track (variant from script kind) → Replay bakes: stroke coverage copies the reference pixels into keys over the span.
  - **Reversibility:** costly — the "Reveal with script…" entry point and the reveal rail-creation flow are new surface; changing the authoring story later touches the modal, the rail flow, and the bake.

### Bake result content
- **D-17:** Baked keys contain the **revealed photo ONLY** — reference pixels where the script's stroke coverage is, **transparent elsewhere** (empty coverage reveals nothing — RVL-02 acceptance preserved). The defining paint strokes are the **generation medium and are replaced in the span** (consistent with D-05). For paint + revealed photo together, paint on a **second track** (v1.0 compositor law: tracks transparent between each other), not inside the reveal span.

### Claude's Discretion
- Exact mapping of the reveal rail onto existing machinery (a `FrameLoopClip`-shaped rail variant vs a new rail record), the reveal rail line color, the exact store/document shape for the 4th rail kind, and the "Reveal with script…" modal surface specifics.
- Key density/deduplication for the reveal/motion per-frame bake (D-09).
- How the script's stored coverage interacts with the reference opacity/tone at bake time (reference "as placed" at full source opacity vs the guide opacity) — the bake must be deterministic.
- Whether reveal baked keys share the per-track `paintVersion`/revision bump and flattened cache-key rules as ordinary track content (expected: yes, they are ordinary keys).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

**IMPORTANT — spec supersession:** `SPECS/milestone-v1.0.0-plan.md` §Phase 8 describes a "shared offscreen source-plus-mask compositor." This CONTEXT.md **supersedes that objective and RVL-01 as written**, and redefines RVL-02 semantics as generation-time. Plan against the bake-into-keys (D-01..D-17) model here, NOT the spec's runtime-mask-compositor framing. Requirement IDs RVL-01..06 remain the acceptance anchors.

### Locked spec (source of truth, with the supersessions noted above)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 8 — Shared mask compositor and Reveal (objective, canonical semantics, requirements, acceptance). NOTE: "One offscreen source-plus-mask compositor" is superseded by D-01; "Explicit alpha versus luma interpretation / optional inversion" collapse into the bake (coverage alpha is baked, soft edges baked in); "Stable source-track and mask-track references" became the rail's script+reference linkage; missing-source/mask recovery maps to D-12/D-13 fail-closed. Also §"Canonical document concept" (`PhotoReferenceTrack` — the `mode` field is removed per D-15), §"Release stop conditions" ("Reference-only photo pixels leak into output", "Reveal differs between Studio, main preview, and export").

### Milestone research (2026-08-23, confidence HIGH — framing superseded per above)
- `.planning/research/SUMMARY.md` — Phase 8 rationale + build order (Reveal layers on compositor 4, photo track 6, Paint/PlayScript coverage 2). Note: the offscreen `globalCompositeOperation` mask-compositing technique in the research is superseded by the bake model.
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (track-local addressing), `efx-paint/mask/` folder mention (now likely a rail/bake module instead), the locked invariant (one parent layer → one document → many tracks → one flattened result).
- `.planning/research/PITFALLS.md` — Pitfall 16 (Reveal includes preview overlays — mask source isolation; closed by construction: the bake reads the reference as placed, never the composited preview), Pitfall 14 (reference leak into output — closed by D-15 bake-time guarantee), Pitfall 7 (premultiplied alpha — baked straight-alpha keys reuse the existing boundary convention), Pitfall 8 (Studio/main/export divergence — one key pipeline), Pitfall M1 (duplicate orphaning reveal/mask references — the reveal rail references the script by library ID; duplicate laws apply to track/rail identity).

### Requirements
- `.planning/REQUIREMENTS.md` §RVL — RVL-01..06 mapped to this phase (acceptance anchors; semantics per decisions above).

### Prior phase context (decisions these build on)
- `.planning/phases/50-photo-reference-track/50-CONTEXT.md` — D-01..D-15: the photo/reference track, mode flag (D-15 here removes it), reference-as-placed transform (D-13/D-14), frame-aligned source resolution D-15, ghost overlay + toggle, opacity as a display preference, hard lock "reference pixels never reach the flattened raster except through an explicit Reveal result" (D-06 becomes the bake-time guarantee).
- `.planning/phases/48-internal-compositor-and-flattened-parent-result/48-CONTEXT.md` — D-01 (opacity before blend), D-02 (straight alpha), D-04 (Background stays visible on solo), D-07/D-08 (per-track caches + composite pass), D-10 (Roto timeline wins precedence), D-11 (`getFlattenedFrame` delivery seam). Baked reveal keys flow through this path as ordinary track content.
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-CONTEXT.md` — D-01..D-03 (unified 10-level undo by reference — replay/deletion go through the ledger), D-10..D-13 (Hold linked-source semantics, fail-closed on source-missing).
- `.planning/phases/49-fixed-background-track-and-imported-loop-clips/49-CONTEXT.md` — D-09 (library asset IDs, no durable duplication — repeat law D-08 follows it), D-10 (missing source fail-closed).
- `.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-CONTEXT.md` — hide/solo truth table, track identity rules, workflow-strip rails.

### Roto Script / PlayScript machinery (used by the reveal rail)
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `RotoPlayScriptMode = 'progressive' | 'static'` — the motion/static duality the reveal rail variants mirror (D-03, D-10).
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — the durable SCRIPTS library the rail references by ID (D-10), never a copy.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — progressive vs static render modes (the script's coverage the bake reads).
- `packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.ts` + `staticStrokeSchedule.ts` — the schedules behind progressive/static scripts (the bake consumes the coverage they produce).

### Code anchors
- `app/src/efx-paint/document/efxPaintDocument.ts` — `PhotoReferenceTrack` (the `mode: PhotoReferenceMode` field removed per D-15), `InternalPaintTrack` (the single track type that gains the 4th rail kind), `FrameLoopClip` (the Loop-Clip machinery the repeat law D-08 mirrors).
- `app/src/efx-paint/document/efxPaintDocumentParsers.ts` — parser currently requires the mode field; D-15 changes it (clean break).
- `app/src/stores/efxPaintStore.ts` — photo-reference mutations (`setPhotoReferenceSource`, `setPhotoReferenceMode` — the latter removed per D-15), document mutations + undo by reference.
- `app/src/stores/physicPaintStore.ts` — `_resolveReferenceSourceImage` (D-15 frame-aligned reference resolution, the bake's source input), `getFlattenedFrame`, compositor wiring, `_referenceSourceImages` / `_backgroundSourceImages` hydration ports.
- `app/src/efx-paint/compositor/efxPaintCompositor.ts` — the shared composite path baked keys flow through as ordinary track content.
- `app/src/efx-paint/compositor/efxPaintBackgroundResolution.ts` + `physicPaintStore.ts` (`resolveBackgroundFrame`, `registerBackgroundSourceImage`) — the Loop-Clip resolver pattern the reveal rail repeat reuses (D-08).
- `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` — the Phase 50 photo-reference modal that gains the "Reveal with script…" entry (D-16).
- `app/src/components/physic-paint/view/PhysicsPaintReferenceGhost.ts` / `PhysicsPaintReferenceGhostLayer.tsx` + `PhysicsPaintReferenceTransform.ts` / `PhysicsPaintReferenceTransformHandles.tsx` — the reference ghost + transform the bake consumes "as placed" (D-14).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` + `PhysicsPaintTrackRow.tsx` — the rail surface the reveal rail kind extends (creation flow, rail color, drag across tracks).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `physicsPaintRotoScriptLibrary.ts` — the durable SCRIPTS library (referenced by ID, never copied — D-10). Script deletion fail-closed (D-13) mirrors the library's existing missing-reference handling.
- `physicsPaintRotoPlayScriptController.ts` / `physicsPaintRotoPlayScriptRenderer.ts` — progressive/static script machinery; the reveal rail variants map onto these kinds (D-03, D-09).
- `progressiveStrokeSchedule.ts` / `staticStrokeSchedule.ts` — the coverage schedules the bake reads to know where to copy reference pixels.
- `PhysicsPaintReferenceGhost.ts` / `PhysicsPaintReferenceTransform.ts` — the reference "as placed" (transform + opacity) the bake sources (D-14).
- The Loop Clip / `FrameLoopClip` resolver (`physicsPaintRotoLoopClips.ts`, `efxPaintBackgroundResolution.ts`) — the repeat/endless law (D-08) mirrors it.
- The Roto physical key + cache machinery (`getRotoPhysicalRenderSource`, the generated-interpolation path) — the baked keys are ordinary keys through this pipeline.
- The status capsule (`setApplyStatus('error')`) — the fail-closed warning surface for D-12/D-13.
- The Phase 43 rail drag machinery (live preview, release-time commit) — reveal rail creation/drag/translate (D-04) extends it.

### Established Patterns
- English copy everywhere (Phase 47 correction).
- Library asset IDs, never external paths / never copied assets (Phase 49 D-09); the rail references the script by library ID (D-10).
- Fail-closed rejections surface in the status capsule with a red warning triangle (Phase 46 paste UX) — reused for missing reference (D-12) and deleted script (D-13).
- Unified document-wide 10-level undo by reference (Phase 46 D-01..D-03) — replay overwrite, rail deletion, and span shrink are single undo-ledger entries (D-05, D-06, D-07).
- One shared internal composition path (Phase 48 CMP-01) — the baked keys are ordinary track content; no new compositor path (D-02).
- Clean-break no-compat: removing the `mode` field from `PhotoReferenceTrack` is a v1.0 schema change (D-15, Phase 45 contract).
- Track identity: stable UUID track IDs; rail+keys move as a unit on drag (D-04).

### Integration Points
- `PhysicsPaintPhotoReferenceDialog.tsx` — the "Reveal with script…" entry (D-16) creating the rail.
- `PhysicsPaintWorkflowStrip.tsx` / `PhysicsPaintTrackRow.tsx` — the reveal rail kind surface: rail creation flow, rail color, span handles (D-07), drag across tracks (D-04), delete (D-06).
- `physicPaintStore.ts` / `efxPaintStore.ts` — the reveal rail model, the bake action, undo recording, and the `_resolveReferenceSourceImage` read the bake uses.
- `efxPaintCompositor.ts` — baked keys flow through the unchanged shared composite path as ordinary track content (D-02).
- The SCRIPTS library — the kind-filtered picker at rail creation (D-10) and the deleted-script fail-closed path (D-13).

</code_context>

<specifics>
## Specific Ideas

- The user's hard re-orientation: **no runtime mask — bake into keys.** A Reveal does NOT dynamically mask the photo; playing a Reveal script BAKES the revealed photo pixels into the track as real cached pixels over time, stored as keys with interpolation. After generation these are normal track pixels (editable, interpolatable, undoable) rendered by the existing track pipeline. Studio preview AND flattened output read the same keys.
- **Rails (user decision):** NEW rail types `reveal/motion` and `reveal/static`, linked to a script, replayable and editable, manipulable like existing rails (drag'n drop across tracks and in time, deletable), with their own rail line color, inheriting the repeat/endless value. Static playback applies the motion parameters; progressive PlayScript reveals progressively; static reveals the completed result (RVL-03's duality survives as-is).
- **Reference input:** the script consumes the photo/reference AS PLACED on the canvas (Phase 50 position/scale/rotation/adjustments), never raw source bytes. Baked keys capture the reference state at generation time — re-adjusting the reference or editing the script requires a replay to refresh. Replay rewrites baked keys WITHIN ITS OWN RAIL SPAN only.
- **Composability is intended:** multiple applications — same track successive spans (reference A frames 0-10, repositioned reference B frames 11-20), or separate tracks layered via the existing v1.0 compositor law (tracks transparent between each other). RVL-05 stays critical: photo pixels reach output ONLY through keys written by the Reveal (the Phase 50 D-06 guarantee happens at bake time).
- The authoring narrative: between authoring and bake the user sees their paint, not the reveal. No live "photo-through-strokes" preview in this phase — the reveal is only visible after the bake (explicitly deferred).
- Replay's overwrite law is backed by a recovery story the user spelled out: **undo ledger** for accidental loss, **drag-to-another-track-then-replay** to keep hand edits durably while regenerating.
- The deleted-script law is explicit: fail closed, keys untouched, no silent re-bake from anything else.

</specifics>

<deferred>
## Deferred Ideas

- **Live "photo-through-strokes" preview** — the user explicitly defers it: no live reveal preview while authoring; the reveal is only visible after the bake.
- **Multiple masks per Reveal operation** — spec out-of-scope (§Phase 8 "Out of scope"); one script + reference per reveal rail now.
- **Vector masks, mask tracking, and mask keyframes** — spec out-of-scope.
- **Deterministic feather for the reveal edge** — spec-gated (only if preview/export parity is maintained); not attempted in this phase.
- The old **"shared offscreen source+mask compositor"** architecture — superseded by D-01; do NOT implement.
- The Phase 50 `PhotoReferenceMode` flag — removed (D-15), not kept as a semantic marker.

</deferred>

---

*Phase: 52-shared-mask-compositor-and-reveal*
*Context gathered: 2026-09-02*
