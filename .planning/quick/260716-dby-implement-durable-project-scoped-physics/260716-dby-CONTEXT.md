# Quick Task 260716-dby: Durable project-scoped Physics Paint Roto script library - Context

**Gathered:** 2026-07-16
**Status:** Ready for research and planning

<domain>
## Task Boundary

Implement the complete mounted production path for a durable Physics Paint Roto script library. Each preset is an autonomous versioned JSON file under the active saved project's `scripts/` directory. The standalone Physics Paint window can save the active editable real frame, scan and browse presets in a new SCRIPTS tab, explicitly load one into the approved immutable session clipboard, rename it, delete it, refresh the directory, and carry valid managed scripts through Save As.

The implementation must reuse the native-UAT-approved Copy Script source handoff and Apply Script replay path. It must not add a `.mce` registry, `scripts/index.json`, arbitrary-path filesystem API, second Apply implementation, real cross-project Import, or pre-UAT regression-test changes.

Execution is split by a mandatory checkpoint:
1. research and production implementation;
2. explicit user-owned native UAT and measured production fixes;
3. post-approval regression-test implementation;
4. final automated verification.

Production readiness is not completion. Stop after production implementation and request native UAT before creating or modifying the new regression tests.

</domain>

<decisions>
## Implementation Decisions

### Project storage authority
- Use a hybrid typed parent/native boundary.
- The standalone window sends typed script-library operations and opaque script IDs through the existing parent-window bridge.
- The parent supplies authoritative saved-project context and invokes project-scoped Tauri operations.
- No arbitrary script path or project root supplied by standalone/frontend code may be trusted by native read, write, rename, delete, scan, or migration operations.

### Save As collisions
- Copy only validated managed script files from the original project's `scripts/` directory.
- If the destination contains the same opaque ID and the validated autonomous contents are identical, deduplicate and keep one copy.
- If the same ID has different valid contents, preserve both by assigning the copied source preset a fresh opaque ID, updating the JSON `id`, and atomically writing the remapped managed filename.
- Preserve the original project library and never silently overwrite an unrelated destination preset.

### Rename interaction and names
- Rename uses inline editing in the selected compact list row.
- Enter commits and Escape cancels, following existing keyboard/accessibility conventions where available.
- Display names must be unique within the current validated library.
- A duplicate keeps inline editing active and shows a concise inline error.
- Names are trimmed, nonempty, Unicode-capable, and length-bounded.
- Opaque IDs remain authoritative; rename changes only `name` and `updatedAt`, never the physical filename.

### Invalid or externally modified managed files
- Invalid files are omitted from the selectable library rows.
- Valid scripts remain fully available.
- Show a concise skipped-file count/status in the SCRIPTS surface.
- Route per-file parse, validation, missing-file, and external-change details through the existing Physics Paint LOG/status boundary.
- Never delete malformed files automatically.

### Compact SCRIPTS layout
- Keep `TOOL | ONION | MOTION | SCRIPTS` in one nonwrapping usable tab strip at supported widths.
- Use one single-row toolbar above the list with Lucide icons instead of visible button labels so Save, Load, Rename, Delete, Refresh, and disabled Import fit at 286–340 px.
- Every icon control has an accessible name and a tooltip containing the function name plus a short description/disabled reason.
- Import remains visibly disabled with `Import from another project — coming later`.
- Place compact full-width list rows below the toolbar, with a roughly 40–56 px thumbnail, ellipsized name, compact project/layer/frame provenance, brush count, and selected state.
- Preserve stacked mobile panel scrollability and prevent horizontal page overflow.

### Typed project and layer metadata
- Extend the existing typed standalone launch/update context.
- Parent stores provide project name, stable layer ID, and layer display name directly.
- Do not derive metadata from filesystem path strings.
- Keep capture-time names as durable metadata; later project/layer renames do not rewrite existing presets.

### Locked approved clipboard and Apply contracts
- Copy/Load replaces one immutable mounted-session clipboard; Apply never consumes or mutates it.
- Save Script captures the active editable real frame, not the clipboard, and does not modify clipboard or Undo/Redo state.
- Reuse the approved cooperative source-finalization handoff; do not invent another flush/cancel/snapshot policy.
- Existing Apply remains the sole engine replay path and creates fresh destination mutation IDs.
- Current visible Motion values remain destination-authoritative.
- Exact destination ownership, generated-frame rejection, absolute interpolation spacing, per-brush Undo/Redo, additive cached repaint, and final-composite cache publication remain unchanged.

### Persistence and schema invariants
- One self-contained version-1 JSON file per preset under `<saved-project-root>/scripts/`.
- Use an opaque UUID-based ID and fixed managed extension; names and provenance are metadata only.
- Securely construct project-contained managed paths from validated opaque IDs.
- Save and Rename use atomic temporary-file replacement.
- Save Script is disabled until a permanent saved `.mce` project exists; never persist into `temp-project`.
- Save always creates a new preset and uses deterministic `-2`, `-3` display-name suffixes.
- Persist raw logical brush groups and deterministic replay metadata while stripping all mounted-session and runtime mutation/apply/generation state.
- Store a validated opaque WebP thumbnail that previews only the captured script over the capture-time Roto background/paper; transparent backgrounds flatten to white.
- The thumbnail is presentation metadata only and is never a replay source.
- Scan on saved project open, SCRIPTS entry, Save, Rename, Delete, Save As migration, and Refresh; no permanent watcher.
- Sort by immutable `createdAt` newest first with stable secondary ordering.

### Claude's Discretion
- Exact command/type/module names and file placement, following current project conventions.
- Reasonable documented validation limits for file size, brush count, point count, string lengths, numeric ranges, and thumbnail dimensions/data size.
- Exact compact tooltip wording and inline-error styling, consistent with nearby UI.
- Exact neighboring-row selection after Delete.

</decisions>

<specifics>
## Specific Ideas

- Use the app's existing Lucide icon vocabulary for the one-row SCRIPTS toolbar.
- Disabled Save Script reason: `Save the project first.`
- Disabled Import tooltip: `Import from another project — coming later`.
- Concise statuses include `Saved <name>`, `Loaded <name> — N brushes`, `Renamed <name>`, `Deleted <name>`, `Found N scripts`, and `Skipped N invalid files`.
- The new durable library controller/store remains distinct from `RotoScriptClipboardController`; prefer Signals for shared reactive library state and pass a compact view model into `PhysicsPaintRightPanel`.

</specifics>

<canonical_refs>
## Canonical References

- Quick `260715-kgf` and its accepted Copy Script / Apply Script implementation and native UAT approval are the behavioral oracle.
- The invoking `/gsd-quick --full` specification is authoritative for the durable schema, security, lifecycle, native UAT A–M, deferred regression coverage 1–47, and completion boundary.

</canonical_refs>
