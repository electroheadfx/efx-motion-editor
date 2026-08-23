# Phase 45: New EFX Paint Document and Clean Cutover - Research

**Researched:** 2026-08-23
**Domain:** v1.0 EFX Physic Paint document model, clean-break persistence cutover, explicit pre-v1.0 rejection (Tauri 2.0 + Preact Signals monorepo)
**Confidence:** HIGH — every load-bearing claim verified by direct `Read` of the source-of-truth file this session; zero new external dependencies

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cutover Blast Radius**
- **D-01:** v1.0.0 replaces ONLY the EFX Physic Paint runtime. The inline EFX Paint layer type (`'paint'` in `app/src/types/layer.ts`, `paintStore.ts`, `paintRenderer.ts`, `PaintOverlay.tsx`, `paintPersistence.ts`) is untouched and keeps working. — one-way.
- **D-02:** Legacy one-track Physic Paint code is **hard-deleted**, not quarantined: the legacy reader/parser/renderer/cache code (`physicPaintPersistence.ts` as it exists today, the `roto_physical` one-track document path, the old session-file contract). Git history is the archive. DOC-04 audit = the code does not exist.
- **D-03:** The standalone `packages/efx-physic-paint` app adopts the v1.0 document format in Phase 45 too — its save/load session format becomes the v1.0 multi-track document. One document format everywhere; the standalone app remains the reference oracle. Its old session files are rejected the same way as old `.mce` data.
- **D-04:** Legacy Physic Paint data on disk is **never read, never deleted**. Old `cache/physic-paint/` sidecars and `physic_paint_outputs` blobs stay untouched; the v1.0 document uses its own new persistence keys and cache directory. Rejection is refusal to LOAD, never deletion or silent rewrite of user data.

**Pre-v1.0 Rejection UX**
- **D-05:** Opening a `.mce` project containing legacy Physic Paint data **hard-fails the whole open** with an explicit blocking dialog. Nothing renders, nothing mutates, auto-save never touches the file. — one-way.
- **D-06:** Detection is a **single explicit gate at project parse time**, before any UI or store hydration. Triggers: non-empty `physic_paint_outputs`, any layer of type `'physic-paint'`, or legacy physic-paint cache references. Old projects WITHOUT Physic Paint data (including ones with inline EFX Paint layers) open normally. The gate must be contract-testable.
- **D-07:** The rejection dialog is explicit with **no recourse**: states the project contains pre-v1.0 EFX Physic Paint data which v1.0.0 does not support, and the project cannot be opened. No partial open, no "continue anyway", no converter offer, no stripped-copy option. Physic Paint content is recreated in a new v1.0 project.

**Background Fallback Config**
- **D-08:** Every new v1.0 document starts with Background fallback = **transparent, unconditionally**. No inheritance from the legacy `paintBgColor` layer field.
- **D-09:** The fallback is **persisted in the document schema in Phase 45 but gets no configuration UI** — the transparent | solid picker arrives with Phase 49.

**UAT Evidence Bar**
- **D-10:** Full 4-part native UAT: (1) new project → add EFX Physic Paint layer → Studio opens on a v1.0 document; paint a stroke on the default track; (2) save/quit/reopen → stroke and document identity intact; (3) open a pre-v1.0 project with Physic Paint data → explicit rejection dialog, nothing opens/mutates; (4) main editor unchanged.
- **D-11:** Document structure (1 default Paint track + fixed Background track + transparent fallback, version, parentLayerId, documentRevision, activeTrackId) is verified via the **on-disk saved project file plus observable behavior** — no throwaway Studio indicator UI.
- **D-12:** The rejection UAT uses a **copy of a real v0.9-era project** containing Physic Paint work (original never mutated).

**Naming contract (locked):** "EFX Paint" = inline main-editor paint layer (`paintStore`/`PaintOverlay`/`paintRenderer`) — out of scope, stays working unchanged. "EFX Physic Paint" = the independent module (`packages/efx-physic-paint` + Studio window) — the sole target of v1.0.0. The "one runtime, one renderer" invariant applies INSIDE the Physic Paint document.

### Claude's Discretion
- Exact v1.0 document field-level schema (the spec's `EfxPaintDocument` sketch is illustrative, not locked).
- New persistence keys and cache directory layout for the v1.0 document (research recommends Rust serde + PNG sidecar, same pattern as `physicPaintPersistence.ts`; new path so legacy cache paths are unreachable).
- Where the new document model code lives (research recommends a new `app/src/efx-paint/` domain folder separate from the `physic-paint/` component tree).
- Exact rejection dialog wording (must be plain and explicit per D-07).

### Deferred Ideas (OUT OF SCOPE)
- Background fallback configuration UI (transparent | solid picker) — Phase 49 (D-09).
- Optional "remove old paint data" cleanup action for legacy on-disk sidecars — rejected for Phase 45 (D-04).
- "Open a stripped copy" salvage path for rejected projects — rejected (D-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | New v1.0 parent Paint layer owns exactly one versioned EFX Paint document with stable internal track IDs, document revision, and active track ID | Document model pattern (§ Architecture Patterns P1); creation hook at `AddFxMenu.tsx:135-156` (§ Code Examples 3); Rust round-trip hazard F1 (§ Common Pitfalls) |
| DOC-02 | Every new v1.0 document starts with one fresh default Paint track and one fixed Background track with configured fallback | Factory pattern (§ Code Examples 1); D-08 transparent fallback; fallback persisted, no UI (D-09) |
| DOC-03 | Pre-v1.0 Paint project data fails explicitly as unsupported without partial mutation or fallback rendering | Gate placement at `projectStore.ts:763-806` before any mutation (§ Architecture Patterns P3); gate trigger design F2 (§ Common Pitfalls) |
| DOC-04 | No legacy one-track schema reader, converter, renderer, cache path, or compatibility branch remains reachable | Full deletion inventory (§ Architecture Patterns → "Legacy Deletion Inventory"); grep contract test (§ Validation Architecture) |
| DOC-05 | Save/reopen preserves new document, track, Loop Clip, source asset, and cache identity | Staging/commit transaction reuse (§ Code Examples 2); Rust struct co-change requirement F1 |
| DOC-06 | Main-editor sequence timing and outer layer composition remain unchanged | Boundary is `previewRenderer.ts` `resolvePhysicPaintFrameSource` (lines 126, 283-288) — untouched; verification = diff gate (§ Validation Architecture) |
</phase_requirements>

## Summary

Phase 45 replaces the EFX **Physic** Paint persistence and runtime boundary with a versioned v1.0 multi-track document while leaving the main editor and the inline EFX Paint layer completely untouched. All machinery needed already exists in the repo and was verified by direct file inspection: the fail-closed parser idiom (`isPlainRecord` + allowed-key sets + throw-on-unknown), the staging/commit cache transaction (`publishPhysicPaintCacheGeneration`/`settlePhysicPaintCacheGeneration`), PNG sidecar encode/decode, stable path hashing, and the project open flow that already validates everything before mutating any state. The only genuinely new code is the document model itself, the parse-time rejection gate, and the new persistence keys/cache directory.

Three findings dominate planning risk. **First (F1):** the Rust `MceProject` struct uses explicit serde fields and silently drops unknown top-level keys on save — the v1.0 document key MUST be added to `app/src-tauri/src/models/project.rs` and `app/src/types/project.ts` together, or save/reopen silently loses the document. **Second (F2):** D-06's trigger "any layer of type `'physic-paint'`" cannot be applied literally after cutover because new v1.0 projects also create `'physic-paint'` layers — the gate must be version/structure-discriminated (see Common Pitfalls). **Third (F3):** Phase 45's UAT requires painting a stroke on the default track, but track-local runtime re-addressing is Phase 46 scope — the phase needs an explicit runtime seam decision (recommendation: keep the existing layerId-keyed runtime for Phase 45 and project it into the document's single default track at the persistence boundary).

**Primary recommendation:** Build `app/src/efx-paint/document/` as a pure, fail-closed document model; install the rejection gate in `projectStore.openProject` immediately after `ipcProjectOpen` returns and before `loadPhysicPaintData`; persist via a new `efx_paint_documents` top-level key + new `cache/efx-paint/` sidecar directory using the proven staging/commit transaction; hard-delete the legacy persistence module, native cache service, session-file format, and their tests in the same phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| v1.0 document model (types, factory, parsers, revisions) | Pure TS domain (`app/src/efx-paint/document/`) | — | Serializable, Preact-free, unit-testable; mirrors `physicsPaintRotoPhysicalModel.ts` (pure) vs store (reactive) split |
| Document store / reactivity | Preact Signals store (`app/src/stores/efxPaintStore.ts`) | — | Existing counter-signal pattern (`paintVersion`-style); maps stay non-reactive |
| `.mce` persistence (document key, atomic write) | Rust (`project_io.rs`, `models/project.rs`) + TS `projectStore` | — | Rust owns file IO + atomic rename; unknown keys are dropped without a struct field (F1) |
| PNG sidecar staging/commit | Rust native cache service | TS orchestrator (`savePhysicPaintDataWithProjectWrite` pattern) | Proven transaction: stage → write project → commit/rollback |
| Pre-v1.0 rejection gate | TS `projectStore.openProject` (before hydration) | Rust `open_project` stays format-agnostic | D-06 single gate at parse time; TS layer sees both `physic_paint_outputs` and layer list |
| Rejection dialog (blocking, no recourse) | Preact UI (main window) | — | D-05/D-07; dialog shown instead of hydration |
| Studio window session/bridge contract | `physicPaintBridge.ts` + `physicsPaintSessionFile.ts` | `packages/efx-physic-paint` engine save/load | D-03 one format everywhere |
| Main-editor compositor boundary | `previewRenderer.ts` | — | Unchanged (DOC-06); consumes one raster per parent layer per frame |

## Standard Stack

**Zero new dependencies** — confirmed by milestone STACK.md (2026-08-23, HIGH) and consistent with every file read this session. No `package.json`, `Cargo.toml`, or lockfile changes.

### Core (all existing, all reused)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hand-rolled fail-closed TS guards | in-repo pattern | v1.0 document parser + rejection gate | Project convention; no zod/io-ts (STACK.md "What NOT to Use") [CITED: .planning/research/STACK.md] |
| `@tauri-apps/plugin-fs` | ^2.4.5 (resolves 2.5.x) | Sidecar reads/writes | Existing; used by `physicPaintPersistence.ts:1` [VERIFIED: app/src/lib/physicPaintPersistence.ts:1] |
| Rust `serde`/`serde_json` | existing | `.mce` (de)serialization, atomic save | Existing pipeline v1→v15 [VERIFIED: app/src-tauri/src/services/project_io.rs:37-85] |
| `@preact/signals` | ^2.8.1 (resolves 2.11.x) | Document store reactivity | Existing store pattern [CITED: .planning/research/STACK.md] |
| `@tauri-apps/plugin-store` (`LazyStore`) | ^2.4.2 | App config (recent projects) | Existing [VERIFIED: app/src/lib/appConfig.ts:1,5] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^2.1.9 | All automated gates | `vitest run` only, never watch (CLAUDE.md) [VERIFIED: app/package.json:48; app/vitest.config.ts] |
| `@efxlab/efx-physic-paint` | workspace:* | Standalone engine re-wire (D-03) | `EfxPaintEngine.save()`/`load()` entry points [VERIFIED: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:1082-1091] |

**Installation:** none. Do not add packages.

## Package Legitimacy Audit

No external packages are installed by this phase. The Package Legitimacy Gate is satisfied vacuously.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Open project (.mce)
        │
        ▼
ipcProjectOpen (Rust open_project: read + serde parse only)
        │
        ▼
┌─ REJECTION GATE (NEW, projectStore.openProject, before any IO/hydration) ─┐
│  version/structure scan:                                                   │
│   • non-empty physic_paint_outputs?         → REJECT                       │
│   • legacy cache/physic-paint/ path refs?   → REJECT                       │
│   • 'physic-paint' layer without v1.0 doc?  → REJECT                       │
│   • else                                    → continue                     │
└───────────────┬────────────────────────────────────────────┬──────────────┘
                │ REJECT                                     │ PASS
                ▼                                            ▼
   Blocking dialog (D-05/D-07).                    loadPhysicPaintData… (NEW v1.0 loader)
   Nothing mutates; auto-save never starts.        hydrateFromMce → stores → startAutoSave
                │                                            │
                │                                            ▼
                │                            efxPaintStore (layerId → EfxPaintDocument)
                │                                            │
New v1.0 layer creation (AddFxMenu 'physic-paint')           │
        │                                                    ▼
        ▼                                          Studio window (efx-physic-paint)
createEfxPaintDocument(parentLayerId)              launch context carries v1.0 document
  = version + parentLayerId + documentRevision     (replaces legacy editableState/roto_*
    + activeTrackId + tracks:[default Paint track]   top-level bridge fields)
    + background:{fallback transparent} + photoReference:null
        │
        ▼
Save: efxPaintStore.toMceDocument() → stage PNG sidecars (cache/efx-paint/)
      → Rust save_project (atomic temp+rename, binds cache transaction)
      → settle commit/rollback
        │
        ▼
Main editor per frame: previewRenderer.resolvePhysicPaintFrameSource(layerId, frame)
      consumes ONE flattened raster (UNCHANGED boundary — DOC-06)
```

### Recommended Project Structure

```
app/src/
├── efx-paint/                        # NEW domain folder (per milestone ARCHITECTURE.md)
│   └── document/
│       ├── efxPaintDocument.ts       # EfxPaintDocument / InternalPaintTrack / BackgroundTrack types + factory
│       ├── efxPaintDocumentParsers.ts# fail-closed guards (isPlainRecord + allowed-key sets)
│       ├── efxPaintCleanBreak.ts     # rejection gate predicate + reason model (pure, contract-testable)
│       └── efxPaintDocumentRevision.ts# document/track/composite revision builders
├── stores/
│   └── efxPaintStore.ts              # NEW signals store: layerId → document
├── lib/
│   ├── efxPaintPersistence.ts        # NEW v1.0 persistence (replaces physicPaintPersistence.ts)
│   └── projectStore.ts               # MOD: gate call in openProject; save path switch
└── components/physic-paint/bridge/
    └── physicsPaintSessionFile.ts    # MOD: v1.0 session format (D-03)
app/src-tauri/src/
├── models/project.rs                 # MOD: add v1.0 document key (F1 — mandatory)
└── services/project_io.rs            # MOD: new cache dir creation; drop legacy dir creation
packages/efx-physic-paint/src/        # MOD: engine save/load re-wired to v1.0 document (D-03)
```

### Pattern 1: Pure document model + fail-closed parser (mirror of proven idiom)

**What:** The document model is a pure, frozen, serializable TS module; parsers reject unknown members, malformed records, and duplicates by throwing. The store adds reactivity separately.
**When to use:** For every v1.0 document type and the rejection gate predicate.
**Why:** This is the exact idiom of the existing canonical parser [VERIFIED: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:843-878]:

```ts
export function parsePhysicPaintRotoPhysicalState(
  value: unknown,
  capacity?: number,
): PhysicPaintRotoPhysicalState {
  if (!isRecord(value)) {
    throw new Error('PhysicPaintRotoPhysicalState: expected a record.');
  }
  if (!hasOnlyAllowedKeys(value, PHYSIC_PAINT_ROTO_PHYSICAL_STATE_KEYS)) {
    throw new Error('PhysicPaintRotoPhysicalState: unknown members; expected exactly realKeyRecords, interpolation, scriptMotion.');
  }
  ...
```

and the persistence-layer guards [VERIFIED: app/src/lib/physicPaintPersistence.ts:30-46]:

```ts
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}
```

### Pattern 2: Staging/commit persistence transaction (reuse verbatim shape)

**What:** Stage PNG sidecars under a staging prefix → write the `.mce` (Rust atomic temp+rename, binding the cache transaction) → settle commit/rollback. Never direct-write canonical paths.
**When to use:** All v1.0 document saves (DOC-05).
**Example:** the existing orchestrator [VERIFIED: app/src/lib/physicPaintPersistence.ts:320-340]:

```ts
export async function savePhysicPaintDataWithProjectWrite(
  projectDir: string,
  outputs: RuntimePhysicPaintOutput[] | undefined,
  writeProject: (
    persistedOutputs: McePhysicPaintOutput[],
    cacheTransactionId: string | null,
  ) => Promise<void>,
): Promise<McePhysicPaintOutput[]> {
  const prepared = await preparePhysicPaintDataSave(projectDir, outputs);
  try {
    await writeProject(
      prepared.persistedOutputs,
      prepared.publication?.transactionId ?? null,
    );
  } catch (error) {
    await settlePreparedPhysicPaintSave(projectDir, prepared, 'rollback');
    throw error;
  }
  await settlePreparedPhysicPaintSave(projectDir, prepared, 'commit');
  return prepared.persistedOutputs;
}
```

Native side: `publish_cache_generation` / `bind_cache_transaction_to_project_write` / `settle_cache_generation` / `recover_cache_transaction` [VERIFIED: app/src-tauri/src/services/physic_paint_cache.rs:49,140,175,205]. TS wrappers at `app/src/lib/ipc.ts:327-340` [VERIFIED]. The v1.0 persistence reuses this transaction shape with a new cache directory and staging prefix.

### Pattern 3: Single parse-time rejection gate (D-05/D-06)

**What:** One pure predicate `findLegacyPhysicPaintRejection(project): RejectionReason | null` in `efx-paint/document/efxPaintCleanBreak.ts`, invoked once in `openProject` immediately after `ipcProjectOpen` succeeds and BEFORE `loadPhysicPaintData` (which performs sidecar file IO), `closeProject`, `hydrateFromMce`, and `startAutoSave`.
**When to use:** Project open only — the single gate.
**Why this placement is safe:** the current open flow already validates everything before mutating anything [VERIFIED: app/src/stores/projectStore.ts:763-806]:

```ts
async openProject(openFilePath: string) {
    const result = await ipcProjectOpen(openFilePath);
    if (!result.ok) {
      throw new Error(result.error);
    }

    // Decode every required Physics Paint sidecar and validate the complete
    // physical candidates before replacing the currently open project.
    const projectRoot = openFilePath.substring(0, openFilePath.lastIndexOf('/'));
    const decodedPhysicPaintOutputs = await loadPhysicPaintData(projectRoot, result.data.physic_paint_outputs) ?? [];
    ...
    projectStore.closeProject({ preservePreparedRotoCanvases: true });
    ...
    hydrateFromMce(runtimeProject, projectRoot);
    ...
    startAutoSave();
```

Inserting the gate between the `result.ok` check and `loadPhysicPaintData` guarantees D-05: the currently open project is untouched, nothing hydrates, no sidecar is read, auto-save never engages.

### Pattern 4: Document factory (DOC-01/DOC-02)

**What:** A single `createEfxPaintDocument(parentLayerId)` factory producing: `version` (v1.0 document schema version), `parentLayerId`, `documentRevision: 0`, `activeTrackId` = the default track's fresh stable ID, `tracks: [one default Paint track]`, `background: { id, clips: [], fallback: { mode: 'transparent' }, ... }`, `photoReference: null`, `compositeRevision: 0`. IDs via `crypto.randomUUID()` (the existing layer-creation idiom [VERIFIED: app/src/components/timeline/AddFxMenu.tsx:137]: `const layerId = crypto.randomUUID();`).
**When to use:** Exactly one call site — new `'physic-paint'` parent layer creation [VERIFIED: app/src/components/timeline/AddFxMenu.tsx:135-156]:

```ts
const handleAddPhysicPaintLayer = () => {
    setMenuOpen(false);
    const layerId = crypto.randomUUID();
    const physicPaintLayer: Layer = {
      id: layerId,
      name: 'Physic Paint',
      type: 'physic-paint',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'physic-paint', layerId } as LayerSourceData,
      isBase: false,
    };
```

### Anti-Patterns to Avoid

- **Keeping a legacy reader "just in case":** D-02 — hard delete; git history is the archive. A version check routing to a compat branch is the exact failure the spec forbids.
- **Gating on "any `'physic-paint'` layer" literally:** new v1.0 projects have them too — see Pitfall F2 below.
- **Adding the document key only to the TS type:** Rust serde drops it on save — see Pitfall F1.
- **Two save paths (old outputs + new document) during transition:** forbidden dual maintenance; cut over atomically in this phase.
- **Migrating or rewriting legacy on-disk data:** D-04 — never read, never delete.
- **Touching `paintStore.ts`/`paintRenderer.ts`/`PaintOverlay.tsx`/`paintPersistence.ts`:** D-01 — the inline EFX Paint layer is out of scope.
- **React-style hook/effect sprawl in the store:** CLAUDE.md — prefer signals/computed; no `useEffect` for internal state derivation.

### Legacy Deletion Inventory (DOC-04 audit list)

Hard-delete or fully re-point each of these; the audit test greps for their absence/unreachability:

| Legacy surface | Evidence (verified this session) | Disposition |
|---|---|---|
| `app/src/lib/physicPaintPersistence.ts` (whole module, 462 lines) | cache dir `'cache/physic-paint'`, staging prefix `'.physic-paint-staging-'` at lines 17-19; `loadPhysicPaintData` at 413; `savePhysicPaintDataWithProjectWrite` at 320 | Delete; replace with `efxPaintPersistence.ts` using a new dir/prefix |
| Legacy persisted output types | `McePhysicPaintOutput`, `McePhysicPaintRotoPhysicalDocument`, `McePhysicPaintCachedFrame`, `RuntimePhysicPaintOutput` etc. [VERIFIED: app/src/types/project.ts:37,44-127] | Delete from the save/open path; replaced by the v1.0 document key |
| Rust legacy output structs | `physic_paint_outputs: Vec<McePhysicPaintOutput>` + `McePhysicPaintOutput`/`McePhysicPaintCachedFrame`/`McePhysicPaintRotoPlaybackSettings` [VERIFIED: app/src-tauri/src/models/project.rs:28,31-60] | Remove/replace in the Rust model |
| Legacy cache dir creation | `create_project_dir` creates `cache/physic-paint` [VERIFIED: app/src-tauri/src/services/project_io.rs:14,26-27] | Create the new v1.0 cache dir instead |
| One-track store serialization | `physicPaintStore.toMceOutputs()` / `loadFromMceOutputs()` [VERIFIED: app/src/stores/physicPaintStore.ts:921-973, 975+] | Replaced by document (de)serialization; runtime maps re-addressed in Phase 46 (see Open Question Q1) |
| Old session-file contract | `physicsPaintSessionFile.ts` `SerializedProject` JSON (`efx-paint-state-*.json` filename at line 85; `parsePhysicsPaintStateFile` at 46-54) [VERIFIED: app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts:42-93] | New v1.0 session format; old files rejected |
| Standalone engine v2 session format | `SerializedProject { version: 2, ... }` [VERIFIED: packages/efx-physic-paint/src/types.ts:186-207]; `serializeProject()` writes `version: 2` [VERIFIED: packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:2141-2143]; `save()`/`load()` at 1082-1091 | Re-wire to v1.0 document (D-03) |
| Legacy launch-context fields | `editableState?: SerializedProject`, `rotoPhysical`, `cachedRotoFrames`, `rotoInterpolationSettings` on `PhysicPaintLaunchContext` [VERIFIED: app/src/types/physicPaint.ts:1690-1706] | Bridge contract carries the v1.0 document |
| Legacy tests | `app/src/lib/physicPaintPersistence.test.ts`, `app/src/stores/physicPaintStore.test.ts` (+ `.rotoHoldComposite`, `.rotoPhysicalStructuralCache`, `.rotoLoopClips`), `app/src/lib/physicPaintBridge.test.ts`, `physicPaintPlayScriptBridge.test.ts`, `app/src/types/physicPaint.test.ts` [VERIFIED: file listing this session] | Delete or rewrite against the v1.0 document (planner splits per plan) |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | A validation library (zod/io-ts) | Hand-rolled fail-closed guards (`isPlainRecord` + allowed-key sets) | Project convention; exhaustive unions; no new deps [CITED: .planning/research/STACK.md] |
| Atomic project+cache save | Ad-hoc `writeFile` sequences | Existing staging/commit transaction (`publish_cache_generation`/`bind_cache_transaction_to_project_write`/`settle_cache_generation`) | Crash-safe two-resource commit already proven [VERIFIED: app/src-tauri/src/services/physic_paint_cache.rs:49,140,175] |
| Path-safe sidecar naming | Custom sanitization | `stableSegment` FNV-1a hash + `sanitizeSegment` [VERIFIED: app/src/lib/physicPaintPersistence.ts:48-59] and the `isSafePhysicPaintCachePath` guard shape [VERIFIED: same file, 89-93] | Prevents collisions and path traversal; proven |
| PNG sidecar encode/decode | A new codec | `decodePngDataUrl`/`encodePngDataUrl` [VERIFIED: app/src/lib/physicPaintPersistence.ts:67-87] | Canonical `data:image/png;base64,` round-trip already enforced |
| Document revision fingerprints | A hash library | `buildPhysicPaintRotoPhysicalRevision`-style deterministic fingerprint (existing pattern) | Parent/child revision agreement is the established lease idiom [CITED: .planning/research/ARCHITECTURE.md Pattern 3] |
| Rejection dialog | A new dialog system | Existing app dialog/overlay conventions in the main window | D-07 needs wording, not machinery |

**Key insight:** every hard problem in this phase (atomic two-resource save, path safety, fail-closed parsing, deterministic revisions) already has a proven in-repo implementation; Phase 45 is a re-wiring and deletion exercise, not an invention exercise.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Legacy `.mce` files containing `physic_paint_outputs` blobs + `cache/physic-paint/` PNG sidecars in existing user projects; standalone session files `efx-paint-state-*.json` [VERIFIED: app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts:85] | **None — never read, never deleted (D-04).** The gate refuses to load them; cleanup tooling is explicitly rejected for Phase 45 |
| Live service config | None — verified: desktop Tauri app, no external service configuration holds physic-paint state | None |
| OS-registered state | `app-config.json` LazyStore holds `recentProjects` and `lastProjectPath` which may point at legacy projects [VERIFIED: app/src/lib/appConfig.ts:1-5,27,60-61] | None — entries intentionally left; opening one simply triggers the rejection dialog (by design, D-05) |
| Secrets/env vars | None reference Physic Paint — verified by the persistence/bridge code read this session (no env var reads in any physic-paint path) | None |
| Build artifacts | `packages/efx-physic-paint/dist/` (tsup output) and the app bundle carry the old session/engine code | Rebuild via existing `pnpm build` / `tsup`; no manual artifact surgery |

## Common Pitfalls

### Pitfall F1: Rust serde silently drops the new document key (DOC-05 killer)

**What goes wrong:** The v1.0 document key is added only to the TS `MceProject` interface. On save, Rust `save_project` serializes its own `MceProject` struct — unknown TS-side fields never make it to disk. Reopen yields a project with no document: strokes vanish, and because `open_project` also drops unknown keys, even a hand-edited file loses them.
**Why it happens:** `MceProject` in Rust is an explicit-field struct with no catch-all [VERIFIED: app/src-tauri/src/models/project.rs:15-29]:

```rust
pub struct MceProject {
    pub version: u32,
    pub name: String,
    ...
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub physic_paint_outputs: Vec<McePhysicPaintOutput>,
}
```

and open/save are a strict serde round-trip [VERIFIED: app/src-tauri/src/services/project_io.rs:77-85 (open), 37-74 (save)]:

```rust
pub fn open_project(file_path: &str) -> Result<MceProject, String> {
    let content =
        fs::read_to_string(file_path).map_err(|e| format!("Failed to read project file: {}", e))?;

    let project: MceProject = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse project file: {}", e))?;

    Ok(project)
}
```

**How to avoid:** add the v1.0 document key to BOTH `models/project.rs` and `types/project.ts` in the same commit; add a Rust round-trip test (the file already has that test idiom [VERIFIED: app/src-tauri/src/services/project_io.rs:214-252]) and a TS save/reopen contract test.
**Warning signs:** save/reopen drops the document while all TS tests pass (TS mocks bypass Rust).

### Pitfall F2: Literal D-06 trigger rejects new v1.0 projects

**What goes wrong:** D-06 lists "any layer of type `'physic-paint'`" as a rejection trigger. After cutover, every new v1.0 project contains exactly such layers [VERIFIED: app/src/types/layer.ts:14-15,33-34]:

```ts
  | 'paint'
  | 'physic-paint';
...
  | { type: 'paint'; layerId: string }
  | { type: 'physic-paint'; layerId: string };
```

A naive gate rejects the app's own new projects on reopen.
**How to avoid:** the gate is structure/version-discriminated. Recommended predicate (planner finalizes against the bumped `.mce` version — currently `version: 15` [VERIFIED: app/src/stores/projectStore.ts:266]):
1. non-empty `physic_paint_outputs` → reject (legacy blob present) [VERIFIED field: app/src/types/project.ts:37 `physic_paint_outputs?: McePhysicPaintOutput[];`]
2. any `cache/physic-paint/` path reference → reject (legacy cache ref) [VERIFIED prefix: app/src/lib/physicPaintPersistence.ts:17 `const PHYSIC_PAINT_CACHE_DIR = 'cache/physic-paint';`]
3. any `'physic-paint'` layer WITHOUT a corresponding v1.0 document entry → reject (legacy layer with no document)
Old projects without Physic Paint data pass all three and open normally (D-06 final clause).
**Warning signs:** UAT part 2 (save/quit/reopen) failing on the app's own freshly saved v1.0 project.

### Pitfall F3: Legacy path deleted but still referenced (DOC-04 partial cutover)

**What goes wrong:** `physicPaintPersistence.ts` is deleted but `projectStore.ts:29,685,727,772` still import/call it, or the Rust `physic_paint_cache.rs` service remains wired into `save_project` via `bind_cache_transaction_to_project_write` [VERIFIED: app/src-tauri/src/services/project_io.rs:64-66], or the `cache/physic-paint` dir is still created for new projects [VERIFIED: app/src-tauri/src/services/project_io.rs:14,26-27].
**How to avoid:** the deletion inventory above is the checklist; add a grep contract test asserting no import/reference to the legacy module, prefix, staging prefix, and type names remains outside git history. Typecheck + `cargo test` catch dangling references mechanically.
**Warning signs:** typecheck passes but a runtime path (e.g. new-project dir creation) still creates the legacy cache directory.

### Pitfall F4: Gate installed too late (partial mutation before rejection)

**What goes wrong:** The gate runs after `loadPhysicPaintData` (sidecar IO), after `closeProject` (destroys the currently open project), or after `startAutoSave` — violating D-05's "nothing renders, nothing mutates, auto-save never touches the file."
**How to avoid:** gate immediately after the `result.ok` check in `openProject` [VERIFIED placement context: app/src/stores/projectStore.ts:763-772]; show the blocking dialog; return without touching any store. Note the well-ordered current flow: validation happens before `closeProject` at line 783 — keep it that way.
**Warning signs:** the previously open project vanishes when a rejected file is opened; an auto-save timer fires for a rejected project.

### Pitfall F5: Session-file rejection conflated with corrupt-file rejection (D-03 UX)

**What goes wrong:** The standalone session loader reuses the generic "not a valid state JSON" error for old-but-valid v2 session files, giving users no explicit pre-v1.0 signal. Current copy [VERIFIED: app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts:10]: `'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.'` and the v2 guard `isSerializedProject` [VERIFIED: app/src/types/physicPaint.ts:2244].
**How to avoid:** detect the legacy `version: 2` shape explicitly and reject with a distinct pre-v1.0 unsupported message; malformed files keep the generic error. Same tone rule as D-07: explicit, no recourse.
**Warning signs:** user cannot tell whether their old session file is corrupt or unsupported.

## Code Examples

### 1. Document factory skeleton (shape only — field-level schema is Claude's discretion)

```ts
// app/src/efx-paint/document/efxPaintDocument.ts (NEW)
// Shape grounded in SPECS/milestone-v1.0.0-plan.md "Canonical document concept"
// (illustrative, not locked) and D-08 (fallback transparent, unconditional).
export const EFX_PAINT_DOCUMENT_VERSION = 1;

export function createEfxPaintDocument(parentLayerId: string): EfxPaintDocument {
  const defaultTrackId = crypto.randomUUID();
  return Object.freeze({
    version: EFX_PAINT_DOCUMENT_VERSION,
    parentLayerId,
    documentRevision: 0,
    activeTrackId: defaultTrackId,
    tracks: Object.freeze([createDefaultPaintTrack(defaultTrackId)]),
    photoReference: null,
    background: Object.freeze({
      id: crypto.randomUUID(),
      clips: Object.freeze([]),
      fallback: Object.freeze({ mode: 'transparent' as const }), // D-08
      visible: true,
      revision: 0,
    }),
    compositeRevision: 0,
  });
}
```

### 2. Rejection gate predicate skeleton (contract-testable, pure)

```ts
// app/src/efx-paint/document/efxPaintCleanBreak.ts (NEW)
// Trigger rules derived from D-06 + Pitfall F2 discrimination.
// 'cache/physic-paint' prefix [VERIFIED: app/src/lib/physicPaintPersistence.ts:17];
// 'physic-paint' layer type [VERIFIED: app/src/types/layer.ts:15];
// physic_paint_outputs field [VERIFIED: app/src/types/project.ts:37].
export type LegacyPhysicPaintRejection =
  | { readonly kind: 'legacy-physic-paint-outputs' }
  | { readonly kind: 'legacy-physic-paint-cache-reference'; readonly path: string }
  | { readonly kind: 'physic-paint-layer-without-document'; readonly layerId: string };

export function findLegacyPhysicPaintRejection(
  project: unknown, // raw parsed .mce JSON, pre-hydration
): LegacyPhysicPaintRejection | null {
  // fail-closed scan; returns the FIRST rejection reason or null
  ...
}
```

### 3. Gate call site (placement verified)

```ts
// app/src/stores/projectStore.ts — openProject, inserted after the result.ok
// check (line 767) and BEFORE loadPhysicPaintData (line 772) [VERIFIED:
// app/src/stores/projectStore.ts:763-772]
const rejection = findLegacyPhysicPaintRejection(result.data);
if (rejection) {
  await showLegacyPhysicPaintRejectionDialog(rejection); // D-05/D-07 blocking, no recourse
  return; // nothing mutates; auto-save never starts
}
```

### 4. Path-safety guard shape for the new cache dir (mirror, new prefix)

```ts
// Mirror of [VERIFIED: app/src/lib/physicPaintPersistence.ts:89-93] with the
// v1.0 prefix substituted:
export function isSafeEfxPaintCachePath(cachePath: unknown): cachePath is string {
  if (typeof cachePath !== 'string' || !cachePath.startsWith(`${EFX_PAINT_CACHE_DIR}/`)) return false;
  if (cachePath.includes('\\') || cachePath.startsWith('/') || cachePath.includes('\0')) return false;
  return cachePath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Progressive `.mce` migration chain (v1→v15, per-field backward compat) | Clean-break v1.0 document with explicit rejection | v1.0.0 milestone (this phase) | Old Physic Paint projects hard-fail; no migration shim [CITED: SPECS/milestone-v1.0.0-plan.md §"Clean-break v1.0 document boundary"] |
| `physic_paint_outputs` per-layer array with `roto_physical` one-track document | Single versioned document per parent layer with internal tracks | This phase | DOC-01..05 |
| Standalone session `SerializedProject version: 2` | v1.0 document session format | This phase (D-03) | One format everywhere; old sessions rejected |

**Deprecated/outdated:**
- `cache/physic-paint/` + `.physic-paint-staging-*`: replaced by a new v1.0 cache dir/prefix (D-02/D-04) [VERIFIED legacy values: app/src/lib/physicPaintPersistence.ts:17-19]
- `efx-paint-state-<timestamp>.json` v2 session files: rejected (D-03) [VERIFIED: app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts:84-86]

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD install from `.claude/gsd-core`.
- **Do not run the server** (the user runs it on their side).
- Tests: `vitest run` only; NEVER Vitest watch mode.
- Use **pnpm**, not npm (monorepo; `app/` dir).
- Preact, not React: prefer Signals (`signal`/`computed`/`effect` from `@preact/signals`) over `useState`/`useEffect`; no effect-dependency workarounds for internal state; consult the `developing-preact` skill before new shared-state abstractions.
- Preserve existing conventions; keep changes proportional; do not refactor unrelated code.
- Git index lock recovery: check `lsof .git/index.lock` first; remove only if stale; ask when unclear.
- GSD artifacts in English; user-facing product copy follows existing conventions (French UI labels exist, e.g. `clip suivant — interrompt la boucle`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.mce` project version bumps 15 → 16 as the primary gate discriminator | Pitfall F2 | Low — gate also works structurally without the bump; bump is conventional |
| A2 | New cache dir name `cache/efx-paint/` + staging prefix `.efx-paint-staging-` | Architecture/State of the Art | Low — naming is Claude's discretion; any new distinct prefix satisfies D-04 |
| A3 | New top-level persistence key `efx_paint_documents` keyed by parent layer | Architecture Patterns | Low — key name is discretion; the Rust+TS co-change (F1) is not |
| A4 | Phase 45 keeps the existing layerId-keyed runtime maps and projects them into the default track at the persistence boundary; track-local re-addressing lands in Phase 46 | Open Question Q1 | Medium — if the planner chooses full re-addressing in Phase 45, phase scope grows significantly |
| A5 | The rejection gate lives in TS only; Rust `open_project` stays format-agnostic | Pattern 3 | Low — defense-in-depth Rust check is additive, not conflicting |

## Open Questions

1. **Runtime seam for Phase 45 UAT (paint a stroke on the default track)**
   - What we know: D-10 UAT part 1 requires Studio to open on a v1.0 document and paint a stroke; Phase 46 owns track-local (`layerId → trackId → frame`) re-addressing; D-02 deletes legacy *persisted* paths, not the in-memory runtime model (`physicsPaintRotoPhysicalModel.ts` stays as the per-track model).
   - What's unclear: whether Phase 45 keeps the runtime one-track maps keyed by layerId and projects them into the document's single default track at save/load (recommended, A4), or pulls track addressing forward.
   - Recommendation: option A (projection at the boundary). It satisfies D-02 (legacy reader/renderer/cache code gone), keeps Phase 46's scope intact, and is the smallest change that passes D-10.

2. **Exact v1.0 document field-level schema**
   - What we know: spec sketch is illustrative; identity rules are locked (stable IDs, revisions, active track, fallback persisted).
   - What's unclear: final field names/nesting; per-track content payload shape for the default track (how much of the current runtime document is embedded in Phase 45 vs Phase 46).
   - Recommendation: planner locks the schema in the first plan, minimizing per-track payload to what UAT part 1/2 needs (one Paint track's frames + identity), leaving Loop Clip/source-asset fields as schema-validated empty collections.

3. **Bridge launch-context contract shape**
   - What we know: legacy fields (`editableState`, `rotoPhysical`, `cachedRotoFrames`, `rotoInterpolationSettings`) are on the deletion list; the spec requires updating session-file and parent bridge contracts "for the new format only."
   - What's unclear: whether the launch context carries the full v1.0 document or a reference + revision with a fetch round-trip.
   - Recommendation: carry the document (matches current editableState behavior; avoids a new round-trip); finalize in planning.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | all gates | ✓ | 10.27.0 | — |
| node | build/test | ✓ | v24.15.0 | — |
| cargo | Rust gates | ✓ | 1.93.1 | — |
| vitest binary | test gate | ✓ | `app/node_modules/.bin/vitest` present | — |
| Rust physic paint cache service | staging/commit | ✓ | `app/src-tauri/src/services/physic_paint_cache.rs` (695 lines) in tree | Re-point or replace with v1.0 equivalent |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.9 [VERIFIED: app/package.json:48] |
| Config file | `app/vitest.config.ts` — `include: ['src/**/*.test.ts']` [VERIFIED: app/vitest.config.ts] |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run` [VERIFIED: .planning/config.json `workflow.test_command`] |
| Full suite command | same + `pnpm --dir app run typecheck` + `cargo test --manifest-path app/src-tauri/Cargo.toml` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | Document factory produces version/parentLayerId/revision/activeTrackId + stable track IDs; duplicate-ID fail-loud | unit | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/document` | ❌ Wave 0 |
| DOC-02 | New document = 1 default Paint track + fixed Background track + `{ mode: 'transparent' }` fallback | unit | same as above | ❌ Wave 0 |
| DOC-03 | Gate rejects: non-empty outputs / legacy cache refs / document-less physic-paint layer; accepts: old project without Physic Paint data, new v1.0 project | unit (fixture JSON) | same as above | ❌ Wave 0 |
| DOC-04 | Grep contract test: no import/reference to legacy module, `'cache/physic-paint'`, `'.physic-paint-staging-'`, `physic_paint_outputs`, `SerializedProject` session path outside allowed deletion diff | contract (script or vitest) | new contract test file | ❌ Wave 0 |
| DOC-05 | TS save→load round-trip preserves document/track/fallback identity; Rust struct round-trip keeps the new key | unit + cargo test | vitest + `cargo test --manifest-path app/src-tauri/Cargo.toml` | ❌ Wave 0 (Rust test idiom exists at project_io.rs:214-252) |
| DOC-06 | `previewRenderer.ts` unchanged (diff gate); existing timing/composition tests stay green | regression | full suite green | ✅ existing suite |

### Sampling Rate
- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run` (fast; whole suite is the project norm)
- **Per wave merge:** full suite + typecheck + cargo test
- **Phase gate:** all gates green before `/gsd-verify-work`; then D-10 4-part native UAT

### Wave 0 Gaps
- [ ] `app/src/efx-paint/document/efxPaintDocument.test.ts` — factory + parser + duplicate-ID fail-loud (DOC-01/02)
- [ ] `app/src/efx-paint/document/efxPaintCleanBreak.test.ts` — gate truth table incl. "old project without Physic Paint opens" and "new v1.0 project reopens" (DOC-03, Pitfall F2)
- [ ] `app/src/lib/efxPaintPersistence.test.ts` — round-trip identity (DOC-05); replaces deleted `physicPaintPersistence.test.ts`
- [ ] Synthetic legacy `.mce` fixtures (non-empty `physic_paint_outputs`; cache-ref; document-less layer; clean old project) — committed test data, distinct from the D-12 real-project UAT copy
- [ ] Rust round-trip test for the new document key (extend `project_io.rs` test module)
- [ ] Deletion/rewrite of legacy tests listed in the Deletion Inventory (DOC-04)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | desktop single-user |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Fail-closed parsers on all untrusted `.mce`/session JSON (unknown members throw); the rejection gate itself is a validation boundary |
| V6 Cryptography | no | — |
| V12 File & Path Handling | yes | Sidecar cache paths validated with the `isSafe*CachePath` shape (prefix-locked, no `\`, no absolute, no `.`/`..` segments, no NUL) [VERIFIED pattern: app/src/lib/physicPaintPersistence.ts:89-93] |

### Known Threat Patterns for {Tauri 2.0 + JSON project files + PNG sidecars}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/hostile `.mce` JSON crashing or partially loading | Tampering | Fail-closed parse; single gate before hydration; no partial mutation (D-05) |
| Path traversal via crafted `cache_path` in a project file | Tampering | Prefix-locked path validator + segment allow-list (mirror for the new dir) |
| Legacy-data silent rewrite destroying user work | Tampering / Repudiation | D-04: never read, never delete; rejection is refusal to load |
| New IPC surface for cache transactions | Elevation of Privilege | Reuse existing `publish`/`settle` commands and their transaction-id validation; no new commands without payload validation |
| Rejection dialog spoofed/bypassed by a second open path | Tampering | Gate lives in the single `openProject` funnel; audit other open entry points (recent-projects, last-project restore, drag-drop) route through it |

Note: deferred item DF-04 (frame-sync `postMessage` origin not authenticated) is out of scope for Phase 45 but must not be widened by bridge-contract changes.

## Sources

### Primary (HIGH confidence — direct `Read` this session)
- `SPECS/milestone-v1.0.0-plan.md` — locked spec: canonical document concept, clean-break boundary, Phase 1 requirements/acceptance
- `app/src/types/project.ts:20-38,44-127` — `MceProject`, `physic_paint_outputs`, legacy output types (quoted)
- `app/src/types/layer.ts:1-17,33-34` — `LayerType` union, paint layer source shapes (quoted)
- `app/src/lib/physicPaintPersistence.ts:17-24,30-59,61-93,320-340,342-462` — cache dir/prefix, guards, hashing, PNG codec, transaction, legacy loader (quoted)
- `app/src/stores/projectStore.ts:266,308,543,685-688,763-806` — version 15, save path, hydration, open flow (quoted)
- `app/src/components/timeline/AddFxMenu.tsx:135-156` — physic-paint layer creation (quoted)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:843-878` — fail-closed parser idiom (quoted)
- `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts:6-10,42-93` — session contract + rejection copy (quoted)
- `app/src/types/physicPaint.ts:1690-1706,2244` — launch context fields, `isSerializedProject`
- `app/src-tauri/src/models/project.rs:15-60` — Rust `MceProject` + legacy output structs (quoted)
- `app/src-tauri/src/services/project_io.rs:7-33,37-85,214-252` — dir creation, atomic save, open, test idiom (quoted)
- `app/src-tauri/src/services/physic_paint_cache.rs:49,140,175,205` — native transaction surface
- `app/src/lib/appConfig.ts:1-5,27,60-61` — LazyStore app config
- `app/src/stores/physicPaintStore.ts:921-989` — legacy one-track serialization entry points
- `packages/efx-physic-paint/src/types.ts:186-207`, `engine/EfxPaintEngine.ts:1082-1091,2141-2143` — standalone session format (quoted)
- `app/vitest.config.ts`, `app/package.json:44-48`, `.planning/config.json` — test infrastructure
- `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS,STACK}.md` — milestone research (2026-08-23, HIGH)

### Secondary (MEDIUM confidence)
- None needed — no external ecosystem claims required verification

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all reuse verified by direct file reads
- Architecture: HIGH — every integration point (gate placement, Rust round-trip, transaction, creation hook) verified against source this session
- Pitfalls: HIGH — F1/F2/F4 derive from verbatim code evidence; F3/F5 from the locked decisions plus verified file surfaces

**Research date:** 2026-08-23
**Valid until:** 2026-09-22 (stable — internal codebase research; re-verify if `projectStore.ts` or `models/project.rs` change before planning)
