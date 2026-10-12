# Phase 45: New EFX Paint Document and Clean Cutover - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce the versioned v1.0 EFX **Physic** Paint document — owned by one parent layer ID — as the only supported Physic Paint runtime and persistence format, with clean-break creation (one default Paint track + one fixed Background track with transparent fallback), explicit pre-v1.0 rejection, and hard-deleted legacy one-track code paths. Main-editor sequence timing and outer layer composition remain unchanged.

**Naming contract (locked by user):** "EFX Paint" = the inline main-editor Basic/FX paint layer (`paintStore`/`PaintOverlay`/`paintRenderer`) — completely out of scope, stays working unchanged. "EFX Physic Paint" = the independent module (`packages/efx-physic-paint` + Studio window, usable standalone or with other hosts) — the sole target of v1.0.0. The multi-track document, clean cutover, Background track, and Reveal all live inside the Physic Paint document/Studio. The spec's "one runtime, one renderer" invariant applies INSIDE the Physic Paint document, not across the whole app.

</domain>

<decisions>
## Implementation Decisions

### Cutover Blast Radius
- **D-01:** v1.0.0 replaces ONLY the EFX Physic Paint runtime. The inline EFX Paint layer type (`'paint'` in `app/src/types/layer.ts`, `paintStore.ts`, `paintRenderer.ts`, `PaintOverlay.tsx`, `paintPersistence.ts`) is untouched and keeps working. — **Reversibility:** one-way — once legacy Physic Paint code is deleted and old projects are rejected, reintroducing the old one-track runtime means restoring from git history and re-breaking the format contract.
- **D-02:** Legacy one-track Physic Paint code is **hard-deleted**, not quarantined: the legacy reader/parser/renderer/cache code (`physicPaintPersistence.ts` as it exists today, the `roto_physical` one-track document path, the old session-file contract). Git history is the archive. DOC-04 audit = the code does not exist.
- **D-03:** The standalone `packages/efx-physic-paint` app adopts the v1.0 document format in Phase 45 too — its save/load session format becomes the v1.0 multi-track document. One document format everywhere; the standalone app remains the reference oracle. Its old session files are rejected the same way as old `.mce` data.
- **D-04:** Legacy Physic Paint data on disk is **never read, never deleted**. Old `cache/physic-paint/` sidecars and `physic_paint_outputs` blobs stay untouched; the v1.0 document uses its own new persistence keys and cache directory. Rejection is refusal to LOAD, never deletion or silent rewrite of user data.

### Pre-v1.0 Rejection UX
- **D-05:** Opening a `.mce` project containing legacy Physic Paint data **hard-fails the whole open** with an explicit blocking dialog. Nothing renders, nothing mutates, auto-save never touches the file. — **Reversibility:** one-way — this is the published format-break contract of v1.0.0; softening it later would create a second compatibility surface the milestone explicitly forbids.
- **D-06:** Detection is a **single explicit gate at project parse time**, before any UI or store hydration. Triggers: non-empty `physic_paint_outputs`, any layer of type `'physic-paint'`, or legacy physic-paint cache references. Old projects WITHOUT Physic Paint data (including ones with inline EFX Paint layers) open normally. The gate must be contract-testable.
- **D-07:** The rejection dialog is explicit with **no recourse**: states the project contains pre-v1.0 EFX Physic Paint data which v1.0.0 does not support, and the project cannot be opened. No partial open, no "continue anyway", no converter offer, no stripped-copy option. Physic Paint content is recreated in a new v1.0 project.

### Background Fallback Config
- **D-08:** Every new v1.0 document starts with Background fallback = **transparent, unconditionally**. No inheritance from the legacy `paintBgColor` layer field. Matches main-editor compositing expectations (parent layer see-through except painted content).
- **D-09:** The fallback is **persisted in the document schema in Phase 45 but gets no configuration UI** — the transparent | solid picker arrives with Phase 49's Background track work. No speculative UI for a track with no clips and no visible row yet.

### UAT Evidence Bar
- **D-10:** Full 4-part native UAT: (1) new project → add EFX Physic Paint layer → Studio opens on a v1.0 document; paint a stroke on the default track; (2) save/quit/reopen → stroke and document identity intact; (3) open a pre-v1.0 project with Physic Paint data → explicit rejection dialog, nothing opens/mutates; (4) main editor unchanged — sequence timing, outer layers, inline EFX Paint layers behave as before.
- **D-11:** Document structure (1 default Paint track + fixed Background track + transparent fallback, version, parentLayerId, documentRevision, activeTrackId) is verified via the **on-disk saved project file plus observable behavior** — no throwaway Studio indicator UI is built for verification.
- **D-12:** The rejection UAT uses a **copy of a real v0.9-era project** containing Physic Paint work (original never mutated). Proves detection against real-world data, not a synthetic ideal.

### Claude's Discretion
- Exact v1.0 document field-level schema (the spec's `EfxPaintDocument` sketch is illustrative, not locked) — researcher/planner finalize against the identity rules in the spec.
- New persistence keys and cache directory layout for the v1.0 document (research recommends Rust serde + PNG sidecar, same pattern as `physicPaintPersistence.ts`; new path so legacy cache paths are unreachable).
- Where the new document model code lives (research recommends a new `app/src/efx-paint/` domain folder separate from the `physic-paint/` component tree).
- Exact rejection dialog wording (must be plain and explicit per D-07).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth for requirements and truth tables)
- `SPECS/milestone-v1.0.0-plan.md` — locked milestone spec. Phase 45 maps to "Phase 1 — New EFX Paint document and clean cutover" plus §"Clean-break v1.0 document boundary", §"Canonical document concept" (identity rules, asset/history rules), §"Background track and Loop Clips" (fallback semantics).

### Milestone research (2026-08-23, confidence HIGH)
- `.planning/research/SUMMARY.md` — executive summary, build-order rationale, per-phase pitfalls (Pitfall 1 track identity, Pitfall 2 legacy path reachable — both owned by this phase).
- `.planning/research/ARCHITECTURE.md` — the locked invariant (one parent layer → one document → many tracks → one flattened result), recommended `app/src/efx-paint/` domain folder layout.
- `.planning/research/PITFALLS.md` — full pitfall list with prevention patterns.
- `.planning/research/STACK.md` — zero-new-dependency confirmation; Vite stays pinned at 5.4.21.
- `.planning/research/FEATURES.md` — must/should/defer feature table.

### Requirements
- `.planning/REQUIREMENTS.md` §DOC — DOC-01..DOC-06 mapped to this phase.
- `.planning/ROADMAP.md` §Phase 45 — goal, success criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/lib/physicPaintPersistence.ts` — current per-layer persistence (staging/commit transaction, PNG sidecar encode/decode, `isSafePhysicPaintCachePath`, stable path segment hashing). The v1.0 persistence keeps the proven staging/commit + sidecar patterns but with new document keys and a new cache directory.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — fail-closed parser pattern (`parsePhysicPaintRotoPhysicalDocument`, allowed-key sets) to mirror for the v1.0 document parser and the legacy-detection gate.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — engine save/load entry points that the standalone package re-wires to the v1.0 document (D-03).
- `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts` — session-file/bridge contract to be updated for the new format only (spec requirement).

### Established Patterns
- Project persistence: `MceProject` in `app/src/types/project.ts` currently carries `physic_paint_outputs?: McePhysicPaintOutput[]` keyed by `layer_id` — the legacy trigger for the parse-time rejection gate (D-06). The v1.0 document gets new keys; `RuntimeMceProject` mirrors them.
- Layer model: `app/src/types/layer.ts` — `'physic-paint'` layer type with `source.layerId` is the parent-layer anchor for `parentLayerId`; `'paint'` (inline EFX Paint) must NOT be touched (D-01).
- Layer serialization: `app/src/stores/projectStore.ts` `buildMceProject()` writes `layer_id` for both paint layer types — the only main-editor change allowed is the parent-owned document reference required for v1.0 persistence (spec: "Keep the Main Editor layer/project model unchanged except…").
- Legacy cache: `cache/physic-paint/` directory + `.physic-paint-staging-*` staging prefix — replaced by a new v1.0 cache path so no legacy cache path remains reachable (D-02, D-04).

### Integration Points
- Project open/load path — the parse-time rejection gate (D-05/D-06) installs here, before store hydration; auto-save must never engage for a rejected project.
- Add FX menu / layer creation (`app/src/components/timeline/AddFxMenu.tsx`, `projectStore.ts`) — creating a new `'physic-paint'` parent layer must produce exactly one v1.0 document with one default Paint track + one fixed Background track (transparent fallback).
- `app/src/lib/previewRenderer.ts` — main-editor compositor boundary; must remain unchanged (DOC-06); consumes the parent layer result exactly as today.
- Standalone dev harness in `packages/efx-physic-paint` — session save/load switches to the v1.0 document (D-03).

</code_context>

<specifics>
## Specific Ideas

- User locked the naming contract explicitly after past confusion: **"EFX Paint" (inline) ≠ "EFX Physic Paint" (standalone module)** — v1.0.0 targets ONLY Physic Paint. All artifacts, UI strings, and code naming in this milestone must respect this split.
- Rejection dialog tone: plain and explicit, no recourse — modeled on the spec's "fail explicitly as unsupported rather than partially loading or silently rewriting."
- UAT part 3 uses a copy of a real user v0.9 project with Physic Paint content — the user will supply/point at it during native UAT.

</specifics>

<deferred>
## Deferred Ideas

- Background fallback configuration UI (transparent | solid picker) — Phase 49 (D-09).
- Optional "remove old paint data" cleanup action for legacy on-disk sidecars — rejected for Phase 45 (D-04); revisit only if disk hygiene becomes a user concern.
- "Open a stripped copy" salvage path for rejected projects — rejected (D-07); could be reconsidered as a standalone tool outside the milestone if users ask.

</deferred>

---

*Phase: 45-new-efx-paint-document-and-clean-cutover*
*Context gathered: 2026-08-23*
