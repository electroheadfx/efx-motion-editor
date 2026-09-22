# Quick Task 260922-al1: project-scoped script library with layer-scope filtering - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Task Boundary

**Goal.** A script created on any physic-paint layer is visible and applicable on every layer of the project, applied to the CURRENT layer at apply time; the Scripts panel gains a scope filter — All / one entry per layer that owns scripts — so the user can narrow the list by origin layer (user-validated design, 2026-09-22).

Design (as given):
1. Library scope = project. The scripts folder remains the single store; the durable-preset format is unchanged except the additive provenance field.
2. Provenance: each script records its origin layer id; display name resolves live from the layer. A pre-existing script without provenance must still load (tolerated as scope-unknown, shown under All).
3. Apply targets the current layer/track at apply time — no longer bound to the origin layer. Validation is fail-closed: if the script's rail structure cannot land on the target (incompatible kind/anchors), refuse with the explicit paste-boundary-style message and change nothing.
4. Filter UI: selector in the Scripts panel/toolbar, default "All", plus one entry per layer owning ≥1 script (live layer names). Filtering is presentation-only; if the armed/selected script is filtered out, applying must revalidate against the current target rather than silently applying to a different layer.

Guardrails. No change to how scripts are created/copied or to their payload; provenance is additive metadata only. Package IO unchanged — scripts folder through its existing path (Rust side); renderer plugin-fs scope untouched. Do not alter the floating-dialog rules or Apply/Clear semantics beyond the target resolution.

</domain>

<decisions>
## Implementation Decisions

### Cross-layer target gate
- Destination = the target layer's key at the CURRENT playhead frame, resolved fresh at apply time.
- An empty target frame falls through the EXISTING blank-key promotion path (no new resolution rules).
- The origin frame stays provenance/rail-source only; it must not constrain the destination.

### Incompatibility definition
- Fail-closed set = the gates that already exist: generated-interpolation target, missing/unmounted target, busy/disposal state, generated-frame refusal (and the existing rail-structure validation).
- No new rail-kind compatibility rules and no new capacity/anchor rules in this task.
- New work here is: unblock cross-layer, and surface an explicit message where today the resolution fails silently (prepareTarget returning null currently produces no user-visible reason).

### Unknown origin layer (orphan scripts)
- Provenance display falls back to the snapshotted layerName with a subtle "unavailable" marker; the row stays fully applicable under All.
- No filter entry exists for a dead layer (no live layer owns those scripts).
- A pre-provenance script (no origin layer id) behaves the same way: scope-unknown, All only.

### Filter persistence
- Scope is ephemeral UI state: it holds while the Studio session lives (including layer switches) and returns to All on every project reopen.
- Provenance and the per-layer entries are rebuilt from disk on open, so UAT ④ ("reopen → provenance + filter intact") still passes with a reset to All.

### Claude's Discretion
- Exact filter control shape (native select vs custom listbox) and its precise placement inside the Scripts panel toolbar.
- Wording of the explicit refusal message (must stay in the existing apply-error surface / capsule style).
- Whether the "unavailable" provenance marker is a text suffix, muted styling, or both.

</decisions>

<specifics>
## Specific Ideas

Behavioural RED tests required before implementation (from the brief):
1. A script created on layer 1 appears in a layer-2 session.
2. Applying it on layer 2 commits to layer 2 (keys land on the target).
3. An incompatible script refuses explicitly and changes nothing.
4. The filter narrows the list by origin layer and All restores.
5. A pre-provenance script still loads.

Native UAT (user-run, after GREEN):
① Create a script on Layer 1 → switch to Layer 2 → visible under All, apply works on Layer 2.
② Filter "Layer 2" hides it, All restores.
③ Incompatible target → explicit refusal, nothing changes.
④ Reopen the project → provenance + filter intact.

Recon findings (orchestrator, pre-planning — verify before relying on them):
- The durable store is ALREADY project-scoped: `scriptLibraryAuthority` is the project path (`app/src/stores/projectStore.ts`), and `scan_root` (`app/src-tauri/src/services/script_library.rs:1939`) reads every managed script in `<project>/scripts/` with no layer filter.
- Rows already carry `source.layerId` / `source.layerName` (`row_from_document`, `script_library.rs:2328`), and the panel renders `{row.source.projectName} · {row.source.layerName} · F{row.source.displayFrame}` (`PhysicsPaintScriptsPanel.tsx:257`).
- The layer binding lives in the apply target resolution: `prepareRotoScriptTargetRef` (`app/src/components/physic-paint/PhysicsPaintStudio.tsx:1637-1643`) returns `null` when `source.layerId !== launch.layerId`, which the clipboard surfaces as `apply-empty-target-failed` (`physicsPaintRotoScriptClipboard.ts:666`).
- The library controller resets rows per launch context via `contextIdentity = ${project.contextId}:${layerId}` (`physicsPaintRotoScriptLibrary.ts:299`, `applyContextReset` at :335) — a layer switch clears and re-hydrates the list.
- The apply path re-validates the target after preparation (`targetIsCurrent`, `physicsPaintRotoScriptClipboard.ts:669-675`).

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/` sibling tasks 260905-hfd (script-title cascade / Actions toolbar) and 260905-dso (Apply/Clear into Tools popover) — the Scripts panel's most recent UX decisions.
- Phase 46 paste-boundary law (red-triangle rejections, capsule resets on navigation) — the refusal-message surface this task must match.

</canonical_refs>
