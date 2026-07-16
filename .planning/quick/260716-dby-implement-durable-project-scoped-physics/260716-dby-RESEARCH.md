# Quick Task 260716-dby: Durable Project-Scoped Physics Paint Roto Script Library - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)
- Real cross-project Import.
- A `.mce` script registry or `scripts/index.json`.
- Arbitrary-path filesystem APIs.
- A second Apply implementation.
- Any new regression-test creation or modification before explicit native UAT approval.
</user_constraints>

## Summary

The implementation should add a durable library around the already approved `RotoScriptClipboardController`, not change replay. The active frame must be drained through the controller's existing cooperative handoff, normalized into `RecordedStrokeGroup[]`, serialized into one autonomous v1 managed file, and loaded back by replacing `rotoScript.clipboard` with the same deeply immutable runtime shape consumed by `applyScript()`. The approved Apply path already transforms each primary brush with destination Motion, calls `enqueueRecordedStroke()`, tracks fresh mutation IDs, preserves independent history, and publishes only the final composite. [VERIFIED: codebase `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:29-35,330-379,420-478,487-568,710-746`; `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:1018-1051`]

Storage authority must remain outside the standalone. Add typed request/result events to the existing standalone-to-main bridge; the main window attaches parent-sourced project/layer metadata and invokes native commands using an opaque unguessable project authority token. Rust resolves that token to a canonical saved-project root held in managed state, validates opaque UUID IDs, constructs only `<root>/scripts/<id>.<managed-extension>`, and performs all scan/read/write/rename/delete/migration work. This is materially safer than passing a root path because the standalone currently shares Tauri IPC access and the existing generic project commands accept paths directly. [VERIFIED: codebase `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts:5-31`; `app/src/lib/physicPaintBridge.ts:157-205`; `app/src-tauri/src/commands/project.rs:21-38,56-65,71-86`; `app/src-tauri/src/lib.rs:102-134,523-559`] Tauri officially supports typed commands, explicit handler registration, and managed state through `tauri::State`. [CITED: https://v2.tauri.app/develop/calling-rust/]

The thumbnail should be generated at capture time from the same copied live-alpha canvas used by durable Roto publication, composed once over capture-time background/paper using `projectPaperRaster`, downscaled to a fixed 256×144 canvas, and requested as WebP quality `0.8`. Production must reject a null blob or any blob whose actual MIME is not `image/webp`; the web platform may silently fall back to PNG for unsupported requested formats. [VERIFIED: codebase `PhysicsPaintStudio.tsx:594-612`; `projectPaperRaster.ts:12-37,61-105`; `rotoCanvasFrames.ts:48-73`] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob] Safari 14 release notes prove WebP image support but do not prove canvas WebP encoding, so a measured native runtime check remains mandatory before UAT completion. [CITED: https://webkit.org/blog/11340/new-webkit-features-in-safari-14/]

**Primary recommendation:** implement a focused Signals-based `RotoScriptLibraryController`, a typed parent bridge, and a Rust managed-library service keyed only by an opaque project authority token plus opaque script IDs; leave `RotoScriptClipboardController.applyScript()` untouched as the sole replay path. [VERIFIED: codebase seam analysis]

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation under `.claude/gsd-core`. [VERIFIED: codebase `CLAUDE.md:1-4`]
- Do not run the application server. [VERIFIED: codebase `CLAUDE.md:3-4`]
- Automated tests must use `vitest run`, never watch mode. [VERIFIED: codebase `CLAUDE.md:6-10`]
- The application is Preact; prefer Signals and focused controllers over unnecessary hook/effect synchronization. [VERIFIED: codebase `CLAUDE.md:16-115`]
- Preserve nearby conventions and avoid unrelated refactors. [VERIFIED: codebase `CLAUDE.md:117-129`]
- Use pnpm, not npm. [VERIFIED: project instructions and repository package manager]
- Production implementation must stop for explicit native UAT before any newly required regression test is created or modified. [VERIFIED: user execution constraint and CONTEXT `Task Boundary`]

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Capture logical Roto script | Standalone controller | Physics engine | The controller owns handoff and immutable clipboard shape; the engine owns accepted stroke truth. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:330-379`; `EfxPaintEngine.ts:1018-1051`] |
| Thumbnail composition | Standalone browser/client | Existing paper raster helper | The mounted engine already exposes a copied alpha canvas; composition is presentation-only Canvas 2D work. [VERIFIED: `PhysicsPaintStudio.tsx:594-612`; `projectPaperRaster.ts:12-37`] |
| Library UI/state | Standalone Preact client | Parent bridge | Selection, busy/status, inline rename, and scan rows are view state; durable operations cross the bridge. [VERIFIED: existing Signals/controller pattern in `physicsPaintRotoScriptClipboard.ts:166-223`] |
| Project/layer metadata | Main frontend stores | Launch/update context | `projectStore.name`, stable layer IDs, and `layer.name` are parent-owned and already used to build launch context. [VERIFIED: `projectStore.ts:34-45,555-564`; `physicPaintBridge.ts:262-341`] |
| Filesystem authority | Rust/Tauri native | Main parent bridge | Only native code should resolve token→canonical root and construct managed paths. [CITED: https://v2.tauri.app/develop/calling-rust/] |
| Save As migration | Native project lifecycle | `projectStore.saveProjectAs` orchestration | Collision-safe validation/copy is filesystem work, while the parent controls when Save As begins and refreshes the mounted context afterward. [VERIFIED: `projectStore.ts:681-701`] |
| Replay and final cache publication | Existing clipboard controller + engine | Existing Roto persistence coordinator | These contracts passed native UAT and must not be forked. [VERIFIED: quick `260715-kgf-SUMMARY.md:20-52`; `physicsPaintRotoScriptClipboard.ts:420-478`; `useRotoFramePersistenceCoordinator.ts:202-222`] |

## Approved Runtime Contracts and Exact Integration Points

### Clipboard, runtime types, source capture, and replay

- `RotoPaintScript` currently contains immutable session provenance, `sourceFrame`, `sourceDisplayFrame`, `sourceRevision`, and logical `brushes`. [VERIFIED: `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:8-35`]
- `RecordedStrokeGroup` is one point-bearing primary plus optional zero-point diffusion continuations. It exists both at package and controller boundaries. [VERIFIED: `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:67-70`; `physicsPaintRotoScriptClipboard.ts:61-64`]
- `normalizeLogicalBrushes()` associates trailing continuation records with their preceding primary and clones points/params. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:710-727`]
- `deepFreezeScript()` freezes provenance, points, params, strokes, continuation arrays, brush arrays, and the script object. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:729-746`]
- Copy uses `drainAcceptedMutations()`, waits source publication, verifies engine/launch generation, then snapshots `getStrokes()` into the immutable clipboard. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:330-379`]
- `enqueueRecordedStroke()` clones input, rejects an empty/continuation primary, validates continuation shape, and delegates to ordinary acceptance, yielding a fresh mutation ID. [VERIFIED: `EfxPaintEngine.ts:1031-1051`]
- Apply transforms only primary geometry with `transformRecordedStrokeForHeldPose`, copies continuations, calls `enqueueRecordedStroke()`, stores accepted target identity, and advances only on matching completion IDs. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:420-478,551-568`]
- Apply publishes pixels only for the final accepted brush by setting `publishPixels` when the last logical brush is enqueued. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:460-466`; Studio gate `PhysicsPaintStudio.tsx:565-612`]
- Final cache publication copies `mutationEngine.copyLiveAlphaCanvas()`, chooses the source-bound cached base, and delegates to `captureLivePixels()`, which merges cached alpha if required and queues parent delivery. [VERIFIED: `PhysicsPaintStudio.tsx:594-612`; `useRotoFramePersistenceCoordinator.ts:202-222`]

**Required controller extension:** expose a safe, controller-owned `captureScriptForPersistence()` method that reuses the same copy drain and returns an immutable snapshot without replacing the clipboard, plus `replaceClipboardFromPersisted(script)` that validates/deep-freezes the parsed runtime script and replaces the single clipboard. Do not mutate `clipboard.value` from the library controller directly; keep immutability and source-generation rules inside `RotoScriptClipboardController`. [VERIFIED: current ownership at `physicsPaintRotoScriptClipboard.ts:95-121,166-223,338-379`]

### Motion transform

`transformRecordedStrokeForHeldPose()` is already imported from the package animation entry and applied at destination using current `getMotion()` values and `destinationSourceFrame`. Persist no source Motion setting. Loaded scripts therefore retain raw geometry and remain destination-authoritative exactly like copied scripts. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:2-4,434-443`; approved quick `260715-kgf-SUMMARY.md:38-43`]

### Project lifecycle

- `projectStore.filePath` is null until a permanent `.mce` path exists; `dirPath` is the current root and `name` is authoritative display metadata. [VERIFIED: `app/src/stores/projectStore.ts:34-45,555-564`]
- New project creation sets a real directory but deliberately leaves `filePath = null`; therefore Save Script must key availability to `filePath`, not merely `dirPath`. [VERIFIED: `projectStore.ts:594-625`]
- `saveProject()` writes sidecars before the `.mce`, then calls native `project_save`. [VERIFIED: `projectStore.ts:632-679`]
- `saveProjectAs()` currently migrates only temp images, mutates `dirPath/filePath`, then calls `saveProject()`. It has no script migration or rollback today. [VERIFIED: `projectStore.ts:681-701`]
- `openProject()` closes existing state, opens the file, assigns `filePath/dirPath`, hydrates stores, and starts autosave. [VERIFIED: `projectStore.ts:703-740`]
- `closeProject()` resets project, all stores, playback, history, and timers. [VERIFIED: `projectStore.ts:743-774`]
- `tempProjectDir` is `$APPDATA/temp-project`; persistent scripts must never use it. [VERIFIED: `app/src/lib/projectDir.ts:1-13`]

**Required lifecycle seam:** create a parent-side project script authority service/store updated only after successful native create/open/save-as authority responses. Launch context includes `project: { authorityToken, name, saved }`, where `saved` means a non-null permanent `.mce` path. On close, clear the parent token and send/allow the standalone to clear library rows. On ordinary save, no library rewrite is needed. On Save As from an already saved project, native migration occurs before the parent switches its active token/context; on success, the standalone receives an updated launch context and rescans. [VERIFIED: current lifecycle seams above; architecture recommendation]

## Recommended Architecture and Operation Flow

### Components

```text
PhysicsPaintStudio
  ├─ approved RotoScriptClipboardController
  │    ├─ captureScriptForPersistence() -> immutable runtime RotoPaintScript
  │    ├─ replaceClipboardFromPersisted(script)
  │    └─ applyScript()                  # unchanged sole replay path
  ├─ RotoScriptLibraryController         # new Signals controller
  │    ├─ rows / selection / busy / status / inline rename state
  │    ├─ saveActiveFrame()
  │    ├─ loadSelected()
  │    ├─ renameSelected()
  │    ├─ deleteSelected()
  │    └─ refresh()
  └─ PhysicsPaintRightPanel/ScriptsPanel # compact view only

Standalone typed bridge request
  -> main-window listener validates operation envelope
  -> parent adds/validates current authority + layer/project metadata
  -> typed IPC wrapper invokes Rust command
  -> Rust ManagedScriptAuthority resolves opaque token to canonical root
  -> ScriptLibraryService validates managed ID/file/schema and performs operation
  -> typed result returns main -> standalone
  -> library controller updates Signals and LOG/status
```

[VERIFIED: existing bridge topology `physicsPaintBridgeTransport.ts:21-31`; `physicPaintBridge.ts:157-205`; existing controller pattern `physicsPaintRotoScriptClipboard.ts:166-223`] [CITED: https://v2.tauri.app/develop/calling-rust/]

### Typed request/result envelope

Use a dedicated discriminated union rather than overloading paint apply payloads:

```ts
export type PhysicPaintScriptLibraryRequest =
  | { kind: 'scan'; operationId: string; authorityToken: string }
  | { kind: 'save'; operationId: string; authorityToken: string; script: PersistedRotoScriptV1 }
  | { kind: 'load'; operationId: string; authorityToken: string; scriptId: string }
  | { kind: 'rename'; operationId: string; authorityToken: string; scriptId: string; name: string }
  | { kind: 'delete'; operationId: string; authorityToken: string; scriptId: string };
```

The standalone may hold and send the opaque token received in launch context, but never a path. The main listener must reject a token not equal to its currently mounted project token before invoking native. Native must independently resolve the token from managed state. This double check limits confused-deputy mistakes and prevents browser fallback messages from selecting another project root. [VERIFIED: current same-origin browser result check at `usePhysicsPaintParentBridge.ts:100-121`; architecture recommendation]

Use result kinds `scan-result`, `save-result`, `load-result`, `rename-result`, `delete-result`, each carrying `operationId`, `ok`, optional row/script, full refreshed valid row list where useful, `skippedInvalidCount`, and structured diagnostics. Per-file diagnostics go to LOG; concise status remains in SCRIPTS. [VERIFIED: existing operation/result matching pattern `PhysicPaintApplyResult` in `types/physicPaint.ts:226-239`]

### Scan flow

1. SCRIPTS entry or explicit lifecycle trigger calls `library.refresh(reason)`.
2. Parent/native scans only the authoritative `<root>/scripts` directory.
3. Native ignores non-managed extensions and temporary files, caps candidate count, reads each managed file under byte limit, parses and validates the complete autonomous schema, and verifies filename ID equals JSON `id`.
4. Valid rows are returned sorted by `createdAt` descending, then `id` ascending for stable ties.
5. Invalid managed files are omitted; count and per-file safe diagnostics are returned. No deletion occurs.
6. Controller preserves selection by ID if still present; otherwise select nearest previous index, then next, otherwise null. [VERIFIED: locked decisions; architecture recommendation]

### Save flow

1. Availability requires saved project context, Roto mode, editable real frame, at least one logical brush, no active script operation, and measured WebP encoder support.
2. Call controller-owned `captureScriptForPersistence()`; this reuses the approved cooperative drain/finalization and does not touch clipboard/history.
3. In the same capture transaction, call `engine.copyLiveAlphaCanvas()` after drain, compose the script-only alpha over capture-time background/paper, and encode fixed-size WebP.
4. Build metadata from launch context (`projectName`, stable `layerId`, `layerName`, source/display frame, canvas dimensions), never from path strings.
5. Generate UUID ID, choose base display name (recommended `${layerName} — Frame ${sourceDisplayFrame}`), and let native resolve deterministic uniqueness: base, `-2`, `-3`, etc.
6. Native validates the entire payload again, atomically writes `<id>.efxroto-script.json`, rescans, and returns the persisted row.
7. Controller selects the new row and reports `Saved <name>`. Clipboard and Undo/Redo remain unchanged. [VERIFIED: locked decisions; source handoff `physicsPaintRotoScriptClipboard.ts:330-379`; alpha capture `PhysicsPaintStudio.tsx:594-612`]

### Load flow

1. Send only selected opaque ID.
2. Native reconstructs the managed filename, checks canonical containment, reads under byte limit, validates again, and returns the autonomous schema.
3. Standalone serializer converts persisted brushes to runtime `RotoPaintScript`, adds fresh mounted-session provenance/source revision as ephemeral values, deep-freezes through `replaceClipboardFromPersisted()`, and reports `Loaded <name> — N brushes`.
4. No engine mutation occurs until the user invokes existing Apply. [VERIFIED: locked decisions and existing Apply contract]

### Rename/delete/refresh flow

- Rename edits only `name` and `updatedAt`, validates uniqueness against a fresh scan, atomically replaces the same ID filename, and keeps editing active on duplicate. [VERIFIED: locked decisions]
- Delete should use the existing Physics Paint modal confirmation visual language rather than `window.confirm`; after success rescan and select previous neighbor when possible. [VERIFIED: existing dialog `PhysicsPaintWorkflowStrip.tsx:632-647`; exact neighbor is discretionary]
- Missing file during Load/Rename/Delete is recoverable: return `not-found`, log detail, rescan, remove stale row, and retain valid rows. [VERIFIED: locked external-change behavior]
- Refresh performs no watcher setup and reports `Found N scripts` plus `Skipped N invalid files` when nonzero. [VERIFIED: locked lifecycle decision]

## Native Security and Atomicity Design

### Managed authority state

Add Rust managed state, for example:

```rust
struct ProjectScriptAuthorityState {
    entries: Mutex<HashMap<Uuid, CanonicalProjectRoot>>,
    active: Mutex<Option<Uuid>>,
}
```

Issue a fresh authority UUID after successful saved-project create/open/Save As binding. The stored root must be canonicalized and must not be `temp-project`. Library commands accept `authority_token: Uuid` and optional `script_id: Uuid`, never root/file paths. Register the state with `.manage(...)` and commands in the existing `generate_handler!`. [VERIFIED: current managed launch state `app/src-tauri/src/lib.rs:102-134`; current registration `lib.rs:523-559`] [CITED: https://v2.tauri.app/develop/calling-rust/]

Because the main and standalone webviews share Tauri IPC, a token is a capability, not proof of caller identity. Keep it unguessable, rotate it on project switch/Save As, clear old tokens on close, compare it in the main bridge before invocation, and constrain every native operation to the token-bound root and fixed managed filename. [VERIFIED: current multi-webview command access architecture; threat analysis]

### Managed path construction

Recommended fixed extension: `.efxroto-script.json`. Validate IDs by parsing UUID and re-serializing canonical lowercase hyphenated form. Construct:

```text
scripts_dir = canonical_root.join("scripts")
managed_path = scripts_dir.join(format!("{id}.efxroto-script.json"))
```

Create `scripts/` as needed. Reject symlinked `scripts/`, symlinked managed files, non-regular files, filename/JSON ID mismatch, and any canonical target/parent outside canonical root. For a new file that cannot yet be canonicalized, canonicalize the existing `scripts/` parent and verify it is under the authority root before joining the validated filename. [VERIFIED: existing canonicalization precedent `commands/project.rs:27-38,71-84`; `services/image_pool.rs` grep evidence around canonical destination checks]

### Atomic write

Reuse the repository's temp-write/rename pattern but use a unique same-directory temp name such as `.<id>.<uuid>.tmp`, not the public managed extension. Write bytes, `sync_all()` the file, rename to final path, then best-effort sync the directory on macOS. On any pre-rename failure, remove only that exact temp file. Existing code already uses write-then-rename for projects/config/exports, but does not sync. [VERIFIED: `services/project_io.rs:29-45`; `commands/config.rs` grep evidence; `commands/export.rs` grep evidence] The extra sync is recommended for durability. [ASSUMED]

Rename is not an OS filename rename because the physical ID is stable: parse current file, update `name` and `updatedAt`, validate, and atomically replace the same managed path. [VERIFIED: locked decision]

Delete should reject symlinks/non-files, remove the exact managed file, treat already missing as a recoverable not-found result, and rescan. Never glob-delete and never delete malformed files during scan. [VERIFIED: locked decision]

### Save As migration and collision semantics

Implement migration in native code using source and destination authority roots already held in managed state; do not send roots through the standalone request. The safest orchestration is:

1. Main begins Save As and native writes the destination `.mce` using the chosen path through the existing project save boundary.
2. Native binds a provisional destination authority and migrates validated scripts from the old authority root.
3. For every source managed file, parse/validate both source and any destination collision.
4. No destination ID: atomically write an exact validated copy.
5. Same ID and canonical autonomous content identical: keep destination and count as deduplicated.
6. Same ID and different valid content: generate a fresh UUID, update only `id` in the copied source document, preserve all other content including timestamps/name/provenance, atomically write the remapped filename.
7. Invalid source files are skipped and reported; invalid destination files are never overwritten. If an invalid destination occupies the colliding managed filename, remap the valid source to a fresh ID and preserve the invalid destination untouched.
8. Only after migration succeeds sufficiently to return a structured result does parent switch to the destination authority/context and trigger scan.
9. Original source files remain untouched.

[VERIFIED: locked collision decisions; architecture recommendation]

Compare identical contents using a canonical semantic representation, not pretty-printed bytes: parse validated schema, serialize a deterministic canonical form with stable object field order, and compare bytes. This avoids treating whitespace-only external rewrites as different content. [ASSUMED]

If migration partially succeeds and then fails, return copied/deduped/remapped IDs plus the failure; do not roll back by deleting destination files that may have pre-existed. A retry is idempotent because exact copies deduplicate and remapped documents retain destination IDs. To make remap retry fully idempotent, process source IDs in sorted order and, before creating another remap, scan for an existing destination document whose canonical content equals the source except for `id`; reuse it as already migrated. [ASSUMED]

## Durable Schema and Serializer/Parser Design

### Recommended autonomous v1 schema

```ts
interface PersistedRotoScriptV1 {
  schema: 'efx-motion-roto-script';
  version: 1;
  id: string;                    // canonical UUID
  name: string;
  createdAt: string;             // RFC 3339 UTC
  updatedAt: string;             // RFC 3339 UTC
  source: {
    projectName: string;
    layerId: string;
    layerName: string;
    sourceFrame: number;
    sourceDisplayFrame: number;
    width: number;
    height: number;
    background: PhysicPaintRotoBackgroundMetadata;
  };
  thumbnail: {
    mimeType: 'image/webp';
    width: 256;
    height: 144;
    dataBase64: string;           // raw base64, no arbitrary URL/path
  };
  brushes: PersistedRecordedStrokeGroup[];
}

interface PersistedRecordedStrokeGroup {
  primary: PersistedPaintStroke;
  continuations: PersistedPaintStroke[];
}

interface PersistedPaintStroke {
  tool: 'paint' | 'erase';
  points: Array<{ x: number; y: number; p: number; tx: number; ty: number; tw: number; spd: number }>;
  color: string | null;
  params: BrushOpts;
  timestamp: number;
  hasPenInput?: boolean;
  diffusionFrames?: number;
  physicsMode?: 'local' | null;
}
```

[VERIFIED: runtime fields `packages/efx-physic-paint/src/types.ts:63-88,169-180`; locked metadata decisions]

### Persisted versus stripped fields

| Runtime field | Persist? | Mapping/rationale |
|---|---:|---|
| `brush.primary.tool` | Yes | Replay behavior. [VERIFIED: runtime type] |
| `points[].x/y/p/tx/ty/tw/spd` | Yes | Raw logical geometry and pen dynamics. [VERIFIED: `types.ts:80-88`] |
| `color` | Yes | Replay color. [VERIFIED: runtime type] |
| all `BrushOpts` fields | Yes | Deterministic brush behavior. [VERIFIED: `types.ts:63-73`] |
| `timestamp` | Yes | Existing held-pose seed includes stable stroke metadata; preserve deterministic replay identity. [VERIFIED: accepted quick research and transform contract] |
| `hasPenInput` | Yes | Engine replay option. [VERIFIED: runtime type and engine acceptance] |
| continuation `diffusionFrames` | Yes | Required continuation metadata. [VERIFIED: `EfxPaintEngine.ts:1038-1047`] |
| `physicsMode` | Yes | Per-stroke physics replay mode. [VERIFIED: runtime type] |
| `playFrame` | No | Roto library is frame-local and destination targeting is authoritative; carrying Play-local frame metadata can leak irrelevant scheduling state. [VERIFIED: task scope; runtime field meaning `types.ts:178`] |
| `mutationId` | No | Destination engine creates fresh IDs. [VERIFIED: approved Apply contract and `enqueueRecordedStroke()`] |
| `RotoPaintScript.provenance.sessionId` | No | Mounted-session identity only. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:16-20,185`] |
| `sourceRevision` | No | Mounted controller revision only. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:33,186,342-344`] |
| active Apply IDs, expected/consumed mutation sets, progress, cancellation, launch/engine generation | No | Operation/runtime state. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:123-145,186-195`] |
| cached base, publication identity, interpolation target claim | No | Destination publication state; Apply rebuilds this from current target. [VERIFIED: `physicsPaintRotoScriptClipboard.ts:22-27,87-93,460-466`] |
| current Motion values | No | Destination-authoritative by locked decision. [VERIFIED: Apply `getMotion()` at `physicsPaintRotoScriptClipboard.ts:434-443`] |
| thumbnail | Metadata only | Never converted to strokes or passed to Apply. [VERIFIED: locked decision] |

### Concrete validation limits

These limits are recommended to bound native memory/CPU while remaining generous for hand-painted frames. They require native UAT with representative large scripts. [ASSUMED]

| Item | Limit / rule |
|---|---|
| Managed file bytes | 16 MiB maximum before parse |
| Managed candidates per scan | 1,000 files; scan sorted filenames and report limit exceeded |
| `name` | trimmed, 1–120 Unicode scalar values; reject control characters except ordinary spaces |
| `projectName`, `layerName` | 1–256 Unicode scalar values; strip/reject control characters |
| `layerId` | 1–256 UTF-8 bytes; no path semantics required or allowed |
| UUID `id` | canonical UUID v4 string, lowercase hyphenated |
| Brushes per script | 1–2,000 logical groups |
| Continuations per brush | 0–600 |
| Points per primary brush | 1–50,000 |
| Total points per script | 250,000 |
| Continuation points | exactly 0 |
| Primary `diffusionFrames` | absent |
| Continuation `diffusionFrames` | integer 1–600 |
| Canvas dimensions | integer 1–16,384 each; area ≤ 100,000,000 pixels |
| Coordinates `x/y` | finite, absolute value ≤ 1,000,000 |
| Pressure `p` | finite 0–1 |
| Tilt `tx/ty` | finite -90–90 |
| Twist `tw` | finite -360–360 |
| Speed `spd` | finite 0–100,000 |
| Timestamp | finite integer 0–`Number.MAX_SAFE_INTEGER` |
| Color | `null` or `^#[0-9a-fA-F]{6}$` |
| Brush size | finite 1–80 |
| Opacity/pressure | finite 10–100 |
| water/dry/detail/pickup/erase | finite 0–100 |
| antiAlias | integer 0–3 |
| Thumbnail dimensions | exactly 256×144 |
| Thumbnail MIME | exactly `image/webp` |
| Decoded thumbnail bytes | 512 KiB maximum |
| Thumbnail Base64 | canonical alphabet/padding; decoded bytes begin with RIFF....WEBP signature |
| Dates | valid RFC 3339; `updatedAt >= createdAt` |

Native validation is authoritative. Frontend validation exists for fast feedback but cannot relax native limits. Unknown top-level or stroke fields should be rejected for v1 rather than silently persisted, while a future version can introduce explicit migration. [ASSUMED]

### Serialization details

- Serialize only own enumerable primitive/array/object fields into a fresh DTO; never spread the entire runtime object. [VERIFIED: security design]
- Clone every point and params object before transfer. [VERIFIED: current clone pattern `physicsPaintRotoScriptClipboard.ts:725-727`]
- Parse into a fresh DTO and then map into a fresh runtime `RotoPaintScript`; never cast parsed JSON. [VERIFIED: existing project validation style in `types/physicPaint.ts`]
- Validate name uniqueness case-sensitively after Unicode normalization to NFC. This preserves distinct Unicode names while preventing canonically equivalent duplicates on macOS. [ASSUMED]
- Name suffixing should split no extension because display names are metadata: `Name`, `Name-2`, `Name-3`. [VERIFIED: locked decision]

## Thumbnail Design

### Source pixels

Use the source-bound alpha result after the approved drain, not `exportCompositeCanvas()` and not a replay renderer. `PhysicsPaintStudio` already copies alpha at mutation completion through `copyLiveAlphaCanvas()` and merges a cached repaint base only when it belongs to the same source frame. [VERIFIED: `PhysicsPaintStudio.tsx:582-612`] For Save Script, capture the active frame's script-only alpha after drain. A cached-only base must not be included because Save Script requires an editable real frame and the preset represents the active logical brushes, not unrelated previously flattened pixels. If the active real frame is an additive repaint over a cached base, the saved script thumbnail must show only the captured logical script over background/paper, per the task requirement. [VERIFIED: locked thumbnail decision and cached-base separation]

### Composition

1. Create 256×144 output canvas.
2. Fill white first in all cases. Transparent capture backgrounds therefore flatten to white.
3. For `white`, keep white.
4. For `canvas1|canvas2|canvas3`, use `getProjectPaperCanvas()`/`subscribeProjectPaperCanvas()` and draw the existing paper raster at output size.
5. Draw the script-only alpha canvas scaled to 256×144.
6. Encode with `canvas.toBlob(callback, 'image/webp', 0.8)`.
7. Require non-null blob, `blob.type === 'image/webp'`, byte size ≤ 512 KiB, and RIFF/WEBP signature before Base64 conversion.

[VERIFIED: paper helper behavior `projectPaperRaster.ts:12-37,61-105`] [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob]

`projectPaperRaster.drawProjectPaperRaster()` currently uses a fixed paper alpha of `0.18` and fills white before pattern drawing; reuse it rather than implementing a second texture renderer. [VERIFIED: `projectPaperRaster.ts:18-36`] `grainStrength` is present in metadata but the current helper does not parameterize its raster strength, so the implementation should preserve capture-time metadata and match the existing visible paper helper rather than inventing a new thumbnail-only grain algorithm. [VERIFIED: `projectPaperRaster.ts:12-37`; `PhysicsPaintStudioView.tsx:28-44`]

### WebP evidence and runtime gate

- The web API permits requesting `image/webp`, but unsupported formats fall back to PNG and blob creation may return null. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob]
- Official Safari 14 notes confirm WebP image-format support, but do not establish canvas encoder support. [CITED: https://webkit.org/blog/11340/new-webkit-features-in-safari-14/]
- Current project code has PNG `toBlob()` paths but no production WebP encoder proof. [VERIFIED: codebase search; `rotoCanvasFrames.ts:48-73`]

**Safest measured validation:** on the actual packaged/native macOS target, create a 2×2 opaque canvas once when SCRIPTS is first entered, request WebP quality 0.8, and record `{ nonNull, blob.type, blob.size, first12Bytes }` into the existing LOG. Enable Save Script only when type/signature match. This is a capability measurement, not visible-correctness evidence; native UAT must also inspect a saved row thumbnail. Do not add PNG/JPEG fallback without new user evidence/decision. [VERIFIED: locked no-fallback direction; MDN fallback behavior]

## UI and View-Model Design

### Existing analogs

- Current option tabs are local `tool|onion|motion` state in `PhysicsPaintRightPanel`; tabs use `role="tab"`, `aria-selected`, and a nonwrapping 35 px strip. [VERIFIED: `PhysicsPaintRightPanel.tsx:139-149,374-455`; CSS `physicsPaintStudio.css:934-1009`]
- At ≤1180 px the right panel is 286 px; at ≤860 px it becomes a two-column stacked panel with max height 260 px. [VERIFIED: `physicsPaintStudio.css:2085-2162`]
- Existing Lucide usage is established in Physics Paint workflow controls. [VERIFIED: `PhysicsPaintWorkflowStrip.tsx:1,460+`]
- Existing inline rename uses Enter commit, Escape cancel, blur commit, and a 40×40 compact thumbnail row. [VERIFIED: `SequenceList.tsx:173-185,287-339`]
- Existing Physics Paint destructive confirmation uses a local modal dialog/card. [VERIFIED: `PhysicsPaintWorkflowStrip.tsx:632-647`]
- Detailed operational errors already surface in the LOG tab via `applyMessage` and `error`. [VERIFIED: `PhysicsPaintRightPanel.tsx:149-165,357-369`]

### Recommended controller/view boundary

Create `RotoScriptLibraryController` outside the component with Signals:

```ts
interface RotoScriptLibraryController {
  rows: ReadonlySignal<readonly RotoScriptLibraryRow[]>;
  selectedId: Signal<string | null>;
  selected: ReadonlySignal<RotoScriptLibraryRow | null>;
  busy: ReadonlySignal<boolean>;
  status: Signal<string | null>;
  skippedInvalidCount: Signal<number>;
  rename: Signal<{ id: string; draft: string; error: string | null } | null>;
  availability: ReadonlySignal<ScriptLibraryAvailability>;
  refresh(reason: ScanReason): Promise<void>;
  saveActiveFrame(): Promise<boolean>;
  loadSelected(): Promise<boolean>;
  beginRename(): void;
  commitRename(): Promise<boolean>;
  cancelRename(): void;
  deleteSelected(): Promise<boolean>;
  dispose(): void;
}
```

Use explicit actions for all lifecycle transitions. One small `useEffect` is justified only to dispose the controller on unmount; SCRIPTS entry calls `onSelectTab('scripts')` and explicitly invokes refresh. Launch context replacement calls an explicit `updateProjectContext()`. Avoid effects that mirror project metadata, selected row, or operation status. [VERIFIED: project Preact guidance; existing wrapper pattern `useRotoScriptClipboardController.ts:8-26`]

Pass a compact `scripts` view model into `PhysicsPaintRightPanel`; keep `PhysicsPaintStudio` limited to wiring clipboard capture/load ports, launch metadata, thumbnail source, bridge calls, and LOG routing. [VERIFIED: locked design and current `PhysicsPaintStudioView` prop composition `PhysicsPaintStudioView.tsx:100-119`]

### SCRIPTS panel

- Extend tab union to `'tool' | 'onion' | 'motion' | 'scripts'`.
- CSS: each tab `flex: 1 1 0`, padding reduced to 6–8 px, `white-space: nowrap`, strip `overflow: hidden`; do not allow wrapping.
- Toolbar: six equal icon buttons in one row: Save (`Save`), Load (`FolderOpen` or `ClipboardPaste`), Rename (`Pencil`), Delete (`Trash2`), Refresh (`RefreshCw`), Import (`PackageOpen`), all from `lucide-preact`. [ASSUMED package icon names; package is already authoritative project dependency]
- Every control gets `aria-label` and `title`; disabled title includes reason. Suggested examples: `Save Script — Save the active real Roto frame`, `Save Script — Save the project first.`, `Load Script — Load the selected preset into Apply Script`, and locked Import wording.
- List container uses `role="listbox"`; rows use `role="option"`, `aria-selected`, stable `key=id`, button semantics, and keyboard Up/Down/Home/End selection. Enter loads except while inline rename is active; Delete key opens confirmation only when focus is in the list and not an input.
- Row: 48×48 `<img>` from validated WebP data URL constructed in memory, name ellipsis, line 2 `${projectName} · ${layerName} · F${sourceDisplayFrame}`, line 3 `${brushCount} brushes`.
- Inline rename replaces only the name span/input; duplicate error sits directly below name and editing stays active.
- Status line is local to panel and `aria-live="polite"`; detailed diagnostics also call existing `setApplyMessage`/`setLastError` or a generalized LOG message port.

[VERIFIED: locked layout decisions; accessibility analogs above]

At ≤860 px, ensure both right-panel columns use `min-width: 0`, the SCRIPTS panel owns `overflow-y: auto`, toolbar stays `grid-template-columns: repeat(6, minmax(0,1fr))`, and rows never set a fixed width greater than the column. The parent currently has max-height 260 px and scroll behavior must remain inside `.physics-paint-right-panel`. [VERIFIED: CSS `physicsPaintStudio.css:745-755,2128-2162`]

## Launch/Update Context and Bridge Changes

### Current state

- TypeScript launch context already carries `layerId` and optional `layerName`, dimensions, frame identity, cached frames, and background. [VERIFIED: `app/src/types/physicPaint.ts:93-118`]
- `createPhysicPaintLaunchContext()` derives stable layer identity from `layer.source.layerId`, supplies `layer.name`, dimensions, workflow state, cached frames, and background. [VERIFIED: `app/src/lib/physicPaintBridge.ts:262-341`]
- Rust duplicates the context schema and stores the latest context in `PhysicsPaintLaunchState`; `open_physics_paint_window` emits it to the standalone. [VERIFIED: `app/src-tauri/src/lib.rs:15-102,115-166`]
- The standalone listens for launch events and falls back to `get_physics_paint_launch_context`. [VERIFIED: `usePhysicsPaintParentBridge.ts:58-97`]
- Frame/cache updates mutate local launch context but do not currently carry parent project context updates independently. [VERIFIED: `useRotoFramePersistenceCoordinator.ts:186-199,227-243`; codebase search]

### Required additions

Extend TypeScript and Rust launch context with:

```ts
project?: {
  authorityToken: string;
  name: string;
  saved: boolean;
};
layerName?: string; // retained
```

The parent sources `name` from `projectStore.name`, `saved` from `projectStore.filePath !== null`, stable layer ID from `layer.source.layerId`, and display name from `layer.name`. Never parse `filePath` for names. [VERIFIED: `projectStore.ts:34-45`; `physicPaintBridge.ts:269-270,327-341`]

For an already mounted standalone, reuse the existing `physic-paint:launch` update/replacement channel after Save As/open context changes rather than inventing a path-bearing update event. The launch replacement coordinator already drains script work before applying the latest context. [VERIFIED: `usePhysicsPaintLaunchIntegration.ts:21-59,111-150`] Save As must preserve the clipboard through launch updates, as the approved controller already does, while the library controller clears/rescans rows for the new authority. [VERIFIED: approved quick behavior and `prepareLaunchReplacement()`/`completeLaunchReplacement()` at `physicsPaintRotoScriptClipboard.ts:633-652`]

Add separate events such as:

```text
physic-paint:script-library-request   standalone -> main
physic-paint:script-library-result    main -> standalone
```

Do not use fire-and-forget events without operation IDs; correlate and timeout like existing Apply results. Browser fallback may support typed requests for development, but durable operations must return an unavailable/saved-project-required result when no native authority exists. [VERIFIED: existing apply operation correlation in bridge types and lifecycle]

## Lifecycle Trigger Wiring

| Trigger | Explicit action |
|---|---|
| Saved project open | Parent establishes native authority; next launch context includes token; standalone controller scans after settled context. |
| New unsaved project | Context has `saved:false`, no usable authority; Save disabled with `Save the project first.` and rows empty. |
| Project close | Parent clears native active authority/token; standalone clears rows/selection on context loss/disposal. |
| SCRIPTS tab entry | Call `refresh('tab-entry')` every entry; no watcher. |
| Save Script | Capture, native save, then scan and select new row. |
| Load | Native load/validate, replace approved clipboard, preserve rows. |
| Rename | Native atomic replace, scan, retain ID selection. |
| Delete | Confirmation, native delete, scan, select previous neighbor then next. |
| Refresh | Scan only. |
| Save As | Native collision-aware migration under old/new authority, switch context, scan destination. |
| External missing file | Operation returns not-found, logs detail, immediately rescans. |
| External malformed change | Scan omits row, increments skipped count, logs detail, never deletes. |

[VERIFIED: locked lifecycle decisions; explicit-action recommendation]

## Likely Production Files

### Modify

- `app/src/types/physicPaint.ts` — launch project metadata, script request/result/schema guards. [VERIFIED: current shared bridge types]
- `app/src/lib/physicPaintBridge.ts` — parent-sourced project metadata, main script-library listener/result routing, launch updates. [VERIFIED: current parent listener/launch builder]
- `app/src/components/physic-paint/bridge/physicsPaintBridgeTransport.ts` — send typed script operations to main. [VERIFIED: current standalone transport]
- `app/src/components/physic-paint/bridge/usePhysicsPaintParentBridge.ts` — result listener and context metadata validation. [VERIFIED: current launch/apply listeners]
- `app/src/stores/projectStore.ts` — authority lifecycle hooks and Save As migration orchestration. [VERIFIED: current lifecycle]
- `app/src/lib/ipc.ts` — typed native script authority/library wrappers used only by main. [VERIFIED: central safe invoke wrapper]
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — controller-owned persistence capture and persisted-load replacement methods; no Apply rewrite. [VERIFIED: approved controller]
- `app/src/components/physic-paint/hooks/useRotoScriptClipboardController.ts` — forward new controller ports/methods if needed. [VERIFIED: current wrapper]
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — focused wiring only: metadata, capture canvas/background, controller, LOG/status. [VERIFIED: current composition root]
- `app/src/components/physic-paint/hooks/usePhysicsPaintStudioViewModel.ts` — pass compact scripts view model if this existing seam remains the prop builder. [VERIFIED: current Studio usage `PhysicsPaintStudio.tsx:513+`]
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — fourth tab and panel rendering. [VERIFIED: current tab implementation]
- `app/src/components/physic-paint/physicsPaintStudio.css` — nonwrapping four-tab strip, toolbar/list/row/rename/error/mobile overflow styles. [VERIFIED: current Physics Paint CSS]
- `app/src-tauri/src/lib.rs` — managed authority state, Rust launch fields, `.manage`, command registration. [VERIFIED: current state/context/handler]
- `app/src-tauri/src/commands/project.rs` and/or Save As command boundary — bind/rotate authority after successful project operations. [VERIFIED: current project commands]
- `app/src-tauri/src/services/project_io.rs` — create `scripts/` for saved projects if desired and share atomic helper. [VERIFIED: current directory/atomic helper]

### Create

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` — frontend DTO mapping/guards and runtime conversion.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts` — script-only background/paper composition and strict WebP measurement/encoding.
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` — focused Signals controller/view model.
- `app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts` — one-time controller creation/disposal wrapper.
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx` — toolbar, listbox, compact rows, inline rename, local status.
- `app/src-tauri/src/commands/script_library.rs` — typed command boundary.
- `app/src-tauri/src/services/script_library.rs` — authority resolution, schema validation, managed paths, scan/load/save/rename/delete/migrate.

Exact placement may be consolidated if nearby conventions favor fewer files, but do not fold schema/filesystem logic into `PhysicsPaintStudio`. [VERIFIED: locked focused-controller requirement]

## Production Implementation Sequence to Native UAT Checkpoint

1. **Define contracts without tests:** add autonomous v1 DTOs, strict frontend guards, launch project metadata, operation envelopes, and LOG diagnostics types. Do not create or modify regression tests. [VERIFIED: user execution constraint]
2. **Build Rust authority/service:** managed token state, canonical roots, UUID managed paths, strict schema limits, scan/load/atomic save/rename/delete, structured diagnostics, and command registration. [VERIFIED: native seam analysis]
3. **Integrate project lifecycle:** bind authority on saved open/initial save, clear on close, and implement collision-safe Save As migration before switching mounted context. Ensure unsaved/temp projects receive no usable authority. [VERIFIED: project lifecycle analysis]
4. **Extend launch/update context:** parent supplies project name/token/saved flag and layer ID/name; Rust stored context mirrors fields; standalone validation accepts them. [VERIFIED: current launch seams]
5. **Add typed parent bridge:** standalone request/result transport; main compares current token and invokes native wrappers; operation ID correlation, timeout, and LOG routing. [VERIFIED: existing Apply bridge analog]
6. **Extend approved clipboard controller narrowly:** add persistence capture and persisted clipboard replacement while leaving `applyScript()`, target ownership, Motion, history, and cache publication unchanged. [VERIFIED: approved contract]
7. **Add thumbnail helper:** script-only alpha + existing paper helper + white flatten + strict measured WebP. Log capability evidence. No fallback format. [VERIFIED: thumbnail analysis]
8. **Add Signals library controller:** explicit refresh/save/load/rename/delete actions, scan triggers, selection recovery, inline duplicate error, concise status, detailed LOG diagnostics. Avoid broad effects. [VERIFIED: Preact constraints]
9. **Add SCRIPTS UI:** four nonwrapping tabs, one-row Lucide toolbar, listbox keyboard behavior, compact rows, confirmation, mobile overflow rules. [VERIFIED: UI analysis]
10. **Run production baselines only if needed:** existing typechecks/builds/tests may be run to detect regressions, but are not evidence of visible correctness. Do not add/modify the new tests. [VERIFIED: user execution constraint]
11. **STOP and request native UAT:** production implementation is only automated-ready. Native UAT must cover saved/unsaved project behavior, strict WebP evidence, Save/Load/Apply, rename duplicate, delete, refresh/external changes, restart/open, Save As collision cases, mobile width, LOG details, and no path exposure. [VERIFIED: user execution constraint]

## Post-UAT Test Plan

Create/modify these only after explicit native UAT approval. [VERIFIED: user execution constraint]

### Coverage groups

| Group | Required coverage | Likely test location |
|---|---|---|
| 1. Runtime serializer | Persist every approved brush/point/params field; strip mutation/session/apply/generation/cache/Motion/playFrame state; deep clone/freeze on load. | new `physicsPaintRotoScriptSchema.test.ts` + existing `physicsPaintRotoScriptClipboard.test.ts` |
| 2. Validation limits | File/string/dimension/brush/continuation/point/numeric/color/date/thumbnail bounds; unknown fields; filename/JSON ID mismatch. | Rust `services/script_library.rs` unit tests + frontend schema tests |
| 3. Managed containment | UUID-only filenames, no traversal, symlink rejection, canonical root containment, temp-project rejection, stale/rotated token rejection. | Rust service/command tests |
| 4. Atomic operations | Save/rename temp cleanup, same-directory replacement, missing-file recovery, malformed preservation, no overwrite. | Rust service tests |
| 5. Scan behavior | Valid rows only, skipped count/details, stable newest-first sort, max scan cap, ignore nonmanaged/temp files. | Rust service + controller tests |
| 6. Save naming | Always new ID; deterministic base/`-2`/`-3`; Unicode normalization and unique names; clipboard/history unchanged. | controller/schema tests + mounted Studio test |
| 7. Load/Apply boundary | Load replaces immutable clipboard; Apply remains reusable and uses existing fresh-ID replay/final-cache path; thumbnail never replayed. | existing clipboard tests + mounted durable core test |
| 8. Thumbnail | Script-only alpha, no cached base, white transparent flatten, existing paper helper, 256×144, quality request 0.8, strict `blob.type`, null/PNG fallback rejection, size/signature validation. | new thumbnail test |
| 9. Parent bridge | Typed envelopes, current-token comparison, operation correlation, timeout, browser fallback unavailable result, no path fields. | `physicPaintBridge.test.ts` + bridge hook tests |
| 10. Launch metadata | project name/saved/token/layer ID/name supplied from stores and mirrored in Rust; no path-derived names; capture-time names remain unchanged later. | `physicPaintBridge.test.ts`, launch integration tests, Rust context tests |
| 11. Project lifecycle | open scan, close clear, SCRIPTS entry scan, operation scans, no watcher, unsaved disable, initial save enables, temp never persists. | `projectStore.test.ts` + controller/Studio tests |
| 12. Save As migration | exact dedupe; differing valid collision remap; invalid source skipped; invalid destination preserved/remap; source untouched; retry/idempotence; destination scan. | Rust migration tests + `projectStore.test.ts` |
| 13. UI toolbar | Six icons one row, accessible names/titles/reasons, disabled Import wording, Save unsaved reason. | `PhysicsPaintRightPanel.test.ts` or new `PhysicsPaintScriptsPanel.test.ts` |
| 14. Rows/keyboard | 40–56 px thumbnail, selected state, ellipsis/meta/count, arrows/Home/End/Enter, inline Enter/Escape, duplicate stays active, Delete confirmation, neighbor selection. | Scripts panel tests |
| 15. Responsive CSS | Four tabs nonwrapping at 286 px, toolbar no wrap, stacked panel scroll, no horizontal overflow selectors/rules. | CSS/source contract test + native UAT remains authoritative |
| 16. External changes/LOG | Missing load/rename/delete rescans; malformed omitted; concise local skipped count; per-file details sent to LOG; no auto-delete. | controller + mounted Studio tests |
| 17. Approved regression baseline | Existing Copy/Apply behavior, Motion, generated rejection, spacing, Undo/Redo, additive repaint, final publication remain green. | existing quick 260715-kgf test suites |

### Likely post-UAT test files

- Create `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts`.
- Create `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.test.ts`.
- Create `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts`.
- Create `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.test.ts`.
- Modify `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.test.ts`.
- Modify `app/src/components/physic-paint/PhysicsPaintStudio.test.ts`.
- Modify `app/src/components/physic-paint/view/PhysicsPaintRightPanel.test.ts`.
- Modify `app/src/lib/physicPaintBridge.test.ts`.
- Modify `app/src/stores/projectStore.test.ts`.
- Modify `app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.test.ts`.
- Add Rust unit tests beside `app/src-tauri/src/services/script_library.rs` and command/context tests in `app/src-tauri/src/lib.rs` or command module.

After post-UAT tests are implemented, run focused `pnpm --filter efx-motion-editor exec vitest run ...`, full app `vitest run`, package tests, TypeScript checks, Rust tests/check, and production build. Existing tests are baseline evidence only; the approved native UAT remains the visible-correctness evidence. [VERIFIED: project test instructions and user execution constraint]

## Common Pitfalls

1. **Passing project paths through standalone IPC.** This defeats the locked authority boundary even if Rust later calls `canonicalize`. Use token→root managed state and IDs only. [VERIFIED: security analysis]
2. **Saving the current clipboard instead of active frame strokes.** Save Script must call the source handoff and leave clipboard unchanged. [VERIFIED: locked decision]
3. **Loading through a second Apply implementation.** Load only replaces the clipboard; the existing `applyScript()` remains the replay path. [VERIFIED: locked decision]
4. **Including cached-base pixels in the thumbnail.** The thumbnail previews the captured logical script, not unrelated flattened base pixels. [VERIFIED: locked decision]
5. **Assuming requested WebP means actual WebP.** Browsers may return PNG fallback; require actual MIME/signature. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob]
6. **Using `exportCompositeCanvas()` for capture.** Existing export helper temporarily changes background and loads engine state; it is not the approved cooperative persistence handoff and may include the wrong surface. [VERIFIED: `rotoCanvasFrames.ts:12-21`]
7. **Effect-driven scan loops.** Launch/local state changes can repeatedly retrigger scans and race selections. Use explicit lifecycle actions and operation IDs. [VERIFIED: project Preact guidance]
8. **Comparing collision files by raw bytes.** Pretty-print/whitespace changes should not force remap; compare canonical validated content. [ASSUMED]
9. **Overwriting invalid destination collisions.** Preserve malformed files and remap the valid source instead. [VERIFIED: locked malformed-file policy]
10. **Renaming physical files when display name changes.** ID filename is stable; atomically replace content only. [VERIFIED: locked rename decision]
11. **Switching Save As authority before migration settles.** The mounted standalone could scan the destination too early or send operations to the wrong root. Switch context after native migration result. [VERIFIED: lifecycle analysis]
12. **Treating production implementation as complete.** Stop before new tests and wait for explicit native UAT approval. [VERIFIED: user execution constraint]

## Security Domain

| ASVS category | Applies | Control |
|---|---|---|
| V2 Authentication | No | Local desktop feature; no user authentication surface. [VERIFIED: scope] |
| V3 Session Management | Yes, capability lifecycle | Rotate/clear unguessable project authority tokens on project switch/close and reject stale tokens. [VERIFIED: threat analysis] |
| V4 Access Control | Yes | Main checks current token; native independently resolves token to canonical root; operation accepts only managed IDs. [VERIFIED: architecture recommendation] |
| V5 Input Validation | Yes | Strict native schema, byte/count/range limits, UUID parsing, filename-ID match, MIME/signature checks, no casts. [VERIFIED: design above] |
| V6 Cryptography | No | Token unpredictability uses UUID v4 already available; no encryption/signing requirement in scope. [VERIFIED: `Cargo.toml:22`] |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Path traversal/arbitrary file access | Tampering / Information disclosure | No paths in library requests; UUID managed names; canonical containment; reject symlinks. |
| Stale project token after Save As/close | Spoofing / Tampering | Token rotation, parent equality check, native state lookup, clear old authority. |
| Malformed oversized JSON | Denial of service | Pre-read file byte cap, scan cap, total points/brush limits, strict finite numeric validation. |
| Collision overwrite | Tampering | Semantic dedupe or fresh-ID remap; never overwrite differing/invalid destination. |
| External edit between scan and operation | Tampering | Re-read and revalidate on every load/rename/delete; missing-file rescan. |
| Thumbnail/polyglot payload | Information disclosure / Tampering | Raw Base64 only, fixed MIME/dimensions/byte cap, RIFF/WEBP signature, render as data URL only after validation. |
| Event result confusion | Tampering | Operation IDs, expected kind, current token, timeout, idempotent result handling. |

[VERIFIED: codebase and architecture threat analysis]

## Environment Availability

| Dependency | Available | Version | Fallback |
|---|---:|---:|---|
| Node.js | Yes | 24.15.0 | — |
| pnpm | Yes | 10.27.0 | — |
| Rust | Yes | rustc 1.93.1 / cargo 1.93.1 | — |
| Swift/macOS toolchain | Yes | Swift 6.2.4, target macOS 15.0 | — |
| Tauri | Yes | Rust v2 / JS API ^2.10.1 | — |
| Preact Signals | Yes | ^2.8.1 | — |
| Lucide Preact | Yes | ^0.577.0 | — |
| Native WebP canvas encoder | Unproven | Must measure in packaged WKWebView | No fallback format without new evidence/decision |

[VERIFIED: environment probes; `app/package.json:20-29,42-48`; `app/src-tauri/Cargo.toml:13-24`]

No new external package is required; package-legitimacy audit is not applicable. [VERIFIED: proposed architecture uses existing dependencies/native APIs]

## Open Evidence Gaps

1. **Native WKWebView WebP encoding:** decoding support is documented, but this session did not execute the packaged application and therefore did not prove `canvas.toBlob('image/webp', 0.8)` returns actual WebP. Resolve through the measured runtime gate and native UAT; do not add a fallback. [CITED: MDN and WebKit sources above]
2. **Paper grain strength parity:** `drawProjectPaperRaster()` uses fixed 0.18 alpha and does not consume `grainStrength`. Research recommends exact reuse rather than inventing a thumbnail renderer, but native UAT should confirm the thumbnail visually matches the expected capture-time paper. [VERIFIED: `projectPaperRaster.ts:18-36`]
3. **Save As failure UX:** partial migration can be made safe/idempotent, but the exact user-facing choice after a partial filesystem failure is not locked. Recommend fail Save As completion, retain old mounted authority, log migrated IDs, and allow retry. [ASSUMED]
4. **Maximum script limits:** proposed limits are implementation-ready but need representative native stress validation after production wiring. [ASSUMED]
5. **Delete confirmation copy:** existing Physics Paint modal pattern is clear, but exact wording is discretionary. Recommend `Delete “<name>”? This removes the project script file and cannot be undone.` [ASSUMED]

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | File/directory `sync_all()` is worth adding after atomic rename for stronger durability. | May add platform-specific complexity; basic rename atomicity still works without it. |
| A2 | Canonical semantic JSON comparison is preferable to raw-byte comparison for Save As dedupe. | User may define “identical contents” as byte-identical, causing unexpected dedupe. |
| A3 | Partial migration should be retry-idempotent and should not roll back copied destination files. | UX may instead require all-or-nothing staging. |
| A4 | Proposed validation limits are sufficiently generous for real projects. | Legitimate unusually large scripts could be rejected. |
| A5 | Unicode name uniqueness should normalize to NFC and remain case-sensitive. | User may expect case-insensitive uniqueness. |
| A6 | Suggested Lucide icon names are available in the installed version. | An icon import may need a nearby available equivalent. |
| A7 | Save As partial failure should retain the old mounted authority until retry/success. | Product may prefer opening the destination despite partial library migration. |
| A8 | Exact confirmation and display-name base wording are acceptable. | Requires minor UAT-driven copy adjustment. |

## Confidence and Sources

**Overall confidence: HIGH for code integration and security boundaries; MEDIUM for native WebP capability and discretionary limits.** The core recommendation is derived from current production code and a native-UAT-approved predecessor. WebP encoder availability remains deliberately unclaimed until measured. [VERIFIED: codebase; cited official docs]

### Primary sources (HIGH confidence)

- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` — approved clipboard, handoff, Apply, immutable runtime script.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` and `types.ts` — logical brush groups, enqueue API, stroke/point/params fields.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — mounted alpha capture and final publication integration.
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — source-bound alpha merge and parent delivery.
- `app/src/stores/projectStore.ts`, `app/src/lib/projectDir.ts` — saved/unsaved/temp lifecycle and Save As.
- `app/src/lib/physicPaintBridge.ts`, bridge hooks/transport, `app/src/types/physicPaint.ts` — typed launch/transport boundary.
- `app/src-tauri/src/lib.rs`, `commands/project.rs`, `services/project_io.rs` — native context state, registration, canonicalization, atomic-write analogs.
- Quick `260715-kgf` SUMMARY/UAT/VERIFICATION — accepted behavioral oracle.

### Official documentation (MEDIUM confidence)

- [MDN HTMLCanvasElement.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) — requested type, PNG fallback, quality, null callback, actual Blob verification.
- [WebKit: New WebKit Features in Safari 14](https://webkit.org/blog/11340/new-webkit-features-in-safari-14/) — WebP image support, but not proof of canvas encoding.
- [Tauri 2: Calling Rust from the Frontend](https://v2.tauri.app/develop/calling-rust/) — typed commands, registration, results, managed state.

### Validity

**Researched:** 2026-07-16  
**Valid until:** 2026-08-15 for codebase architecture; WebP evidence expires at the next macOS/Tauri/WKWebView target change.
