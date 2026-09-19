# Phase 45: New EFX Paint Document and Clean Cutover - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 16 (7 new source, 3 new test, 6 modified)
**Analogs found:** 15 / 16 (1 partial — rejection dialog has two candidate analogs, both listed)

**Naming contract (locked):** "EFX Paint" = inline main-editor layer (`paintStore`/`PaintOverlay`/`paintRenderer`) — OUT OF SCOPE, do not touch. "EFX Physic Paint" = standalone module — the sole target. Every analog below is on the Physic Paint side or the shared project-IO boundary.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/src/efx-paint/document/efxPaintDocument.ts` (NEW) | model | transform (pure factory) | `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` | exact (idiom) |
| `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (NEW) | utility (validation) | transform (fail-closed parse) | `physicsPaintRotoPhysicalModel.ts` + `app/src/lib/physicPaintPersistence.ts` guards | exact |
| `app/src/efx-paint/document/efxPaintCleanBreak.ts` (NEW) | utility (gate predicate) | transform (pure scan) | `physicsPaintRotoPhysicalModel.ts` parser idiom | exact |
| `app/src/efx-paint/document/efxPaintDocumentRevision.ts` (NEW) | utility | transform (deterministic fingerprint) | `buildPhysicPaintRotoPhysicalRevision` in `physicsPaintRotoPhysicalModel.ts:947` | exact |
| `app/src/stores/efxPaintStore.ts` (NEW) | store | event-driven (signals) | `app/src/stores/physicPaintStore.ts` | exact |
| `app/src/lib/efxPaintPersistence.ts` (NEW) | service | file-I/O + CRUD (staging/commit) | `app/src/lib/physicPaintPersistence.ts` (whole module) | exact |
| Rejection dialog component (NEW, name is discretion) | component | request-response (blocking) | `app/src/components/project/NewProjectDialog.tsx` OR native `message()` in `app/src/lib/unsavedGuard.ts` | role-match (two candidates) |
| `app/src/efx-paint/document/efxPaintDocument.test.ts` (NEW) | test | unit | `app/src/lib/physicPaintPersistence.test.ts` | exact |
| `app/src/efx-paint/document/efxPaintCleanBreak.test.ts` (NEW) | test | unit (fixture truth table) | `app/src/lib/physicPaintPersistence.test.ts` | exact |
| `app/src/lib/efxPaintPersistence.test.ts` (NEW) | test | unit (mocked fs/ipc) | `app/src/lib/physicPaintPersistence.test.ts` | exact |
| `app/src/stores/projectStore.ts` (MOD) | store | request-response (open/save funnel) | itself — `openProject` 763-806, `saveProject` 685-691 | exact |
| `app/src/types/project.ts` (MOD) | model | CRUD (serde mirror) | itself — `MceProject`/`physic_paint_outputs` 20-38 | exact |
| `app/src/components/timeline/AddFxMenu.tsx` (MOD) | component | event-driven (layer creation) | itself — `handleAddPhysicPaintLayer` 135-156 | exact |
| `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts` (MOD) | service (bridge) | file-I/O (session save/load) | itself (whole file, 155 lines) | exact |
| `app/src-tauri/src/models/project.rs` (MOD) | model (Rust serde) | CRUD | itself — `MceProject` 15-29 | exact |
| `app/src-tauri/src/services/project_io.rs` (MOD) | service (Rust file IO) | file-I/O (atomic save) | itself — save/open 37-85, test idiom 189-260 | exact |
| `packages/efx-physic-paint/src/{types.ts,engine/EfxPaintEngine.ts}` (MOD) | model + service | CRUD (session format) | themselves — `SerializedProject` types.ts:186-207, `save()`/`load()` EfxPaintEngine.ts:1082-1091 | exact |

## Pattern Assignments

### `app/src/efx-paint/document/efxPaintDocument.ts` (model, transform) — NEW

**Analog:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts`

**Core idiom — pure, frozen, serializable model.** The roto physical model returns deep-frozen objects from validated builders (lines 864-878):

```typescript
const interpolation = Object.freeze<PhysicPaintRotoInterpolationState>({
  enabled: value.interpolation.enabled,
  mode: value.interpolation.mode,
});
...
return Object.freeze<PhysicPaintRotoPhysicalState>({
  realKeyRecords,
  interpolation,
  scriptMotion,
});
```

**Factory ID idiom** — `crypto.randomUUID()` per creation, from `app/src/components/timeline/AddFxMenu.tsx:137`:

```typescript
const layerId = crypto.randomUUID();
```

**Factory shape** (from RESEARCH.md Code Example 1, grounded in the spec — field-level schema is planner's discretion):

```typescript
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

**Convention:** no Preact imports, no signals, no side effects — the pure-model/reactive-store split mirrors `physicsPaintRotoPhysicalModel.ts` (pure) vs `physicPaintStore.ts` (reactive).

---

### `app/src/efx-paint/document/efxPaintDocumentParsers.ts` (utility, fail-closed parse) — NEW

**Analogs:** `app/src/lib/physicPaintPersistence.ts:30-46` (guard primitives) + `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:843-878` (parser shape).

**Guard primitives** (physicPaintPersistence.ts:30-46 — copy verbatim):

```typescript
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
```

**Allowed-key set declaration idiom** (physicPaintPersistence.ts:21-24):

```typescript
const OUTPUT_KEYS = new Set(['layer_id', 'frames', 'roto_physical', 'roto_playback']);
const PERSISTED_DOCUMENT_KEYS = new Set(['capacity', 'realKeyRecords', 'groupOverrideRecords', ...]);
```

**Fail-closed parser shape** (physicsPaintRotoPhysicalModel.ts:843-861 — throw on unknown members, throw on invalid members, never normalize, never allocate IDs):

```typescript
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
  if (!isPhysicPaintRotoInterpolationState(value.interpolation)) {
    throw new Error('PhysicPaintRotoPhysicalState: invalid canonical interpolation state.');
  }
  ...
```

**Duplicate-ID fail-loud idiom** (physicPaintPersistence.ts:129-133 — apply to track IDs in the document parser):

```typescript
if (seenLayerIds.has(output.layer_id)) throw new Error(`Duplicate Physics Paint layer "${output.layer_id}".`);
seenLayerIds.add(output.layer_id);
```

---

### `app/src/efx-paint/document/efxPaintCleanBreak.ts` (utility, pure gate predicate) — NEW

**Analog:** same fail-closed idiom as above, but scanning raw parsed `.mce` JSON and returning a typed reason instead of throwing.

**Trigger field sources (all verified):**
- `physic_paint_outputs` field: `app/src/types/project.ts:37`
- `'physic-paint'` layer type: `app/src/types/layer.ts:15,33-34`
- legacy cache prefix `cache/physic-paint`: `app/src/lib/physicPaintPersistence.ts:17`

**Reason-union shape** (from RESEARCH.md Code Example 2):

```typescript
export type LegacyPhysicPaintRejection =
  | { readonly kind: 'legacy-physic-paint-outputs' }
  | { readonly kind: 'legacy-physic-paint-cache-reference'; readonly path: string }
  | { readonly kind: 'physic-paint-layer-without-document'; readonly layerId: string };

export function findLegacyPhysicPaintRejection(
  project: unknown, // raw parsed .mce JSON, pre-hydration
): LegacyPhysicPaintRejection | null {
  // fail-closed scan; returns the FIRST rejection reason or null
}
```

**Pitfall F2 (mandatory):** the gate MUST be structure/version-discriminated — "any `'physic-paint'` layer" alone would reject the app's own v1.0 projects on reopen. Predicate rules: (1) non-empty `physic_paint_outputs` → reject; (2) any `cache/physic-paint/` path ref → reject; (3) `'physic-paint'` layer WITHOUT a corresponding v1.0 document entry → reject. Old projects with no Physic Paint data pass all three.

---

### `app/src/efx-paint/document/efxPaintDocumentRevision.ts` (utility, deterministic fingerprint) — NEW

**Analog:** `buildPhysicPaintRotoPhysicalRevision` / `encodePhysicPaintRotoPhysicalContent` in `physicsPaintRotoPhysicalModel.ts:947-1022`.

**Core pattern** (lines 947-956 — validate-then-hash, prefixed revision string):

```typescript
export function buildPhysicPaintRotoPhysicalRevision(
  records: unknown,
  interpolation: unknown,
  loopClips: unknown,
  incomingInterpolationBreakKeyIds: unknown = PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  groupOverrideRecords: unknown = [],
): string {
  const source = encodePhysicPaintRotoPhysicalContent(records, interpolation, loopClips, incomingInterpolationBreakKeyIds, groupOverrideRecords);
  return `physical-${hashCanonicalPhysicalValue(source)}`;
}
```

**Canonical encoding rules** (lines 988-1022 — mirror these for document/track/composite revisions):
- Records sorted by stable identity (`keyId.localeCompare`) so equal content yields equal revisions regardless of input order.
- Strings length-prefixed (`encodeCanonicalString`) to prevent delimiter collisions.
- Empty additive collections contribute NO term (D-29 compatibility idiom, lines 1013-1017) — apply the same rule to empty `clips`/future document members.

---

### `app/src/stores/efxPaintStore.ts` (store, signals) — NEW

**Analog:** `app/src/stores/physicPaintStore.ts:1-100`.

**Imports + signal + dirty-callback pattern** (lines 1-40):

```typescript
import { signal } from '@preact/signals';
...

let _markProjectDirty: (() => void) | null = null;
export function _setPhysicPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

export const physicPaintVersion = signal(0);
```

**Conventions to copy:**
- Counter-signal (`*Version = signal(0)`) for visual invalidation; bump on every mutation (MEMORY: "Always bump AND subscribe to paintVersion"). The v1.0 store gets `efxPaintVersion` (or per-document revision signals) with the same bump/subscribe discipline.
- Non-reactive `Map`s for bulk data (line 99: `const _rotoAlphaCanvasRegistry = new Map<...>()`); the `layerId → EfxPaintDocument` map stays non-reactive, with the counter-signal as the change lease.
- Dirty marking via injected callback, never a direct import of projectStore (avoids cycles).
- `reset()` participates in `projectStore.closeProject` (see projectStore.ts:831 `physicPaintStore.reset(...)` — the new store needs the same reset hook).
- CLAUDE.md: no `useEffect` for internal derivation; prefer `computed`/plain functions.

---

### `app/src/lib/efxPaintPersistence.ts` (service, file-I/O + staging/commit CRUD) — NEW

**Analog:** `app/src/lib/physicPaintPersistence.ts` (whole 462-line module — the replacement reuses its shape with a new dir/prefix/key set).

**Constants block** (lines 17-24 — substitute v1.0 values; A2: `cache/efx-paint` + `.efx-paint-staging-`):

```typescript
const PHYSIC_PAINT_CACHE_DIR = 'cache/physic-paint';
const PHYSIC_PAINT_CACHE_PARENT_DIR = 'cache';
const PHYSIC_PAINT_STAGING_PREFIX = '.physic-paint-staging-';
const DATA_URL_PREFIX = 'data:image/png;base64,';
```

**PNG sidecar codec** (lines 67-87 — copy verbatim, canonical data-URL round-trip):

```typescript
function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith(DATA_URL_PREFIX)) return null;
  try {
    const binary = atob(dataUrl.slice(DATA_URL_PREFIX.length));
    if (binary.length === 0) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function encodePngDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return DATA_URL_PREFIX + btoa(binary);
}
```

**Path-safe sidecar naming** (lines 48-59 — FNV-1a stable segment + sanitize):

```typescript
function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96) || 'layer';
}

function stableSegment(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${sanitizeSegment(value)}-${(hash >>> 0).toString(16)}`;
}
```

**Path-traversal guard** (lines 89-93 — mirror with new prefix; ASVS V12):

```typescript
export function isSafePhysicPaintCachePath(cachePath: unknown): cachePath is string {
  if (typeof cachePath !== 'string' || !cachePath.startsWith(`${PHYSIC_PAINT_CACHE_DIR}/`)) return false;
  if (cachePath.includes('\\') || cachePath.startsWith('/') || cachePath.includes('\0')) return false;
  return cachePath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
```

**Staging/commit transaction orchestrator** (lines 320-340 — reuse this exact shape; stage sidecars → write .mce via callback → settle commit/rollback):

```typescript
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

**Staging write + native publication** (lines 265-294 — staging under a UUID basename, native `publishPhysicPaintCacheGeneration`, non-authoritative cleanup on failure):

```typescript
const stagingBasename = createStagingBasename();
const stagingRelativeRoot = `${PHYSIC_PAINT_CACHE_PARENT_DIR}/${stagingBasename}`;
...
const publication = await publishPhysicPaintCacheGeneration(projectDir, stagingBasename);
if (!publication.ok) throw new Error(publication.error);
```

**Save-cache dedup** (lines 26, 112-120 — `savedOutputCache` keyed by content fingerprint; reuse for the document save path so no-op saves skip sidecar rewrites).

**IPC wrappers:** `publishPhysicPaintCacheGeneration` / `settlePhysicPaintCacheGeneration` at `app/src/lib/ipc.ts:327-340`; native commands in `app/src-tauri/src/services/physic_paint_cache.rs:49,140,175,205` (`publish_cache_generation` / `bind_cache_transaction_to_project_write` / `settle_cache_generation` / `recover_cache_transaction`). Planner decides: re-point this service to the new dir or create a v1.0 twin — either way the legacy `cache/physic-paint` path must become unreachable (Pitfall F3).

---

### Rejection dialog component (component, blocking request-response) — NEW

**Two candidate analogs — planner picks one:**

**Candidate A (recommended for D-07 "no recourse"): native blocking dialog** — `app/src/lib/unsavedGuard.ts:14-25`:

```typescript
import {message, save} from '@tauri-apps/plugin-dialog';
...
const result = await message(
  'Do you want to save changes to this project?',
  {
    title: 'EFX Motion Editor',
    kind: 'warning',
    buttons: {
      yes: 'Save',
      no: "Don't Save",
      cancel: 'Cancel',
    },
  },
);
```

For D-07 use `kind: 'error'` with a single OK button — native, modal, no recourse machinery needed. Note the existing `openProject` failure UX is `console.error` only (`WelcomeScreen.tsx:169-170, 182-183`), so this dialog is a NEW explicit surface either way.

**Candidate B: Preact overlay dialog** — `app/src/components/project/NewProjectDialog.tsx:71-80` (fixed inset backdrop + panel, Escape handling):

```tsx
return (
  <div
    class="fixed inset-0 flex items-center justify-center z-50"
    onKeyDown={handleKeyDown}
  >
    {/* Backdrop */}
    <div
      class="absolute inset-0 bg-black/60"
      onClick={onClose}
    />
```

Caveat: NewProjectDialog's backdrop-click closes — D-07 forbids dismissal ambiguity, so if Candidate B is chosen, remove backdrop-dismiss and provide a single acknowledge action. (Also note MEMORY: Play Script floating dialog conventions are backdrop-free by design for palette interactivity — not applicable here; this dialog must block.)

---

### Test files (test, unit) — NEW x3

**Analog:** `app/src/lib/physicPaintPersistence.test.ts:1-75`.

**Hoisted-mock pattern for fs + IPC** (lines 9-68 — copy structure for `efxPaintPersistence.test.ts`):

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
...
const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

vi.mock('./ipc', () => ({
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
  ...
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    files.set(path, contents);
  }),
}));
```

**In-memory generation-exchange helper** (lines 14-37 `exchangeGeneration`) simulates the native publish swap — reuse for the v1.0 staging/commit tests.

**Fixture idiom for the gate truth table** (lines 1-2 — real files loaded from disk when needed):

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
```

For `efxPaintCleanBreak.test.ts`, committed synthetic `.mce` JSON fixtures (non-empty `physic_paint_outputs`; legacy cache ref; document-less `'physic-paint'` layer; clean old project; freshly saved v1.0 project) cover the D-06 truth table — distinct from the D-12 real-project native UAT copy.

**Runner constraint (CLAUDE.md):** `vitest run` only, never watch. Quick gate: `pnpm --filter efx-motion-editor exec vitest run`.

---

### `app/src/stores/projectStore.ts` (store, open/save funnel) — MODIFIED

**Analog:** itself. Two verified insertion points.

**Gate call site** (openProject, lines 763-772 — insert between the `result.ok` check and `loadPhysicPaintData`; BEFORE any sidecar IO, `closeProject`, hydration, or `startAutoSave` — Pitfall F4):

```typescript
async openProject(openFilePath: string) {
    const result = await ipcProjectOpen(openFilePath);
    if (!result.ok) {
      throw new Error(result.error);
    }

    // >>> INSERT GATE HERE (from RESEARCH.md Code Example 3):
    // const rejection = findLegacyPhysicPaintRejection(result.data);
    // if (rejection) {
    //   await showLegacyPhysicPaintRejectionDialog(rejection); // D-05/D-07 blocking, no recourse
    //   return; // nothing mutates; auto-save never starts
    // }

    // Decode every required Physics Paint sidecar and validate the complete
    // physical candidates before replacing the currently open project.
    const projectRoot = openFilePath.substring(0, openFilePath.lastIndexOf('/'));
    const decodedPhysicPaintOutputs = await loadPhysicPaintData(projectRoot, result.data.physic_paint_outputs) ?? [];
```

Note the well-ordered existing flow: validation already precedes `closeProject` (line 783) and `startAutoSave` (line 801) — keep it that way. The gate returns before all of it.

**Save-path switch** (saveProject, lines 685-691 — swap `savePhysicPaintDataWithProjectWrite` + `physic_paint_outputs` for the v1.0 document equivalent; same transaction shape):

```typescript
const projectDir = currentDir ?? currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
await savePhysicPaintDataWithProjectWrite(projectDir, project.physic_paint_outputs, async (physicPaintOutputs, cacheTransactionId) => {
  const result = await ipcProjectSave({
    ...project,
    physic_paint_outputs: physicPaintOutputs,
  }, currentFilePath, cacheTransactionId);
  if (!result.ok) throw new Error(result.error);
});
```

The identical block at saveProjectAs (lines 727-745) needs the same switch. **Anti-pattern (research):** never run two save paths (old outputs + new document) during transition — cut over atomically.

**Version bump:** `version: 15` at projectStore.ts:266 → 16 (A1) as the primary gate discriminator.

---

### `app/src/types/project.ts` + `app/src-tauri/src/models/project.rs` (model, serde pair) — MODIFIED TOGETHER

**Pitfall F1 (DOC-05 killer):** the v1.0 document key MUST land in BOTH files in the same commit. Rust `MceProject` has explicit fields and silently drops unknown keys on save; TS-side-only keys never reach disk.

**Rust struct idiom** (models/project.rs:25-28 — optional-vec field with skip):

```rust
#[serde(default, skip_serializing_if = "Vec::is_empty")]
pub physic_paint_outputs: Vec<McePhysicPaintOutput>,
```

Add the new key (A3: `efx_paint_documents`) the same way. For the document payload itself, note the existing escape hatch: `roto_physical: Option<serde_json::Value>` (models/project.rs:36-37) lets Rust carry the document opaquely while TS owns the fail-closed schema — the planner may reuse that `Value` approach for the document map instead of a full Rust struct.

**TS mirror** — `physic_paint_outputs?: McePhysicPaintOutput[];` at types/project.ts:37; add `efx_paint_documents` alongside and mirror in `RuntimeMceProject`.

**Rust round-trip test idiom** (project_io.rs:189-260 `test_save_and_open_roundtrip` — extend with the new key):

```rust
let loaded = open_project(mce_path.to_str().unwrap()).unwrap();
assert_eq!(loaded.physic_paint_outputs.len(), 1);
assert_eq!(loaded.physic_paint_outputs[0].layer_id, "phys-layer-1");
```

Legacy structs to remove (DOC-04): `McePhysicPaintOutput`/`McePhysicPaintCachedFrame`/`McePhysicPaintRotoPlaybackSettings` (models/project.rs:31-60) — every existing test constructing `physic_paint_outputs:` in project_io.rs (lines 214, 286, 339, 545) must be updated in the same diff or compilation fails (mechanical F3 safety net).

---

### `app/src-tauri/src/services/project_io.rs` (service, atomic file IO) — MODIFIED

**Analog:** itself.

**Dir creation switch** (lines 14, 26-27 — replace legacy dir with the v1.0 dir; D-04: never touch existing legacy dirs on disk, just stop creating them):

```rust
let physic_paint_cache_dir = base.join("cache").join("physic-paint");
...
fs::create_dir_all(&physic_paint_cache_dir)
    .map_err(|e| format!("Failed to create Physics Paint cache directory: {}", e))?;
```

Test assertion to update: line 185 `assert!(test_dir.join("cache/physic-paint").exists());` → assert the new dir exists AND (new assertion) the legacy dir does NOT.

**Atomic save idiom** (lines 37-74 — unchanged pattern: `to_vec_pretty` → temp file → `sync_all` → optional `bind_cache_transaction_to_project_write` → `rename` → dir `sync_all`). The `physic_paint_cache_transaction_id` parameter plumbing stays; it re-points at the v1.0 cache service.

---

### `app/src/components/timeline/AddFxMenu.tsx` (component, layer creation) — MODIFIED

**Analog:** itself, `handleAddPhysicPaintLayer` (lines 135-156):

```typescript
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
    if (targetSequenceId) {
      sequenceStore.createFxSequence('Physic Paint', physicPaintLayer, totalFrames.peek(), { inFrame: isolatedInFrame, outFrame: isolatedOutFrame });
    } else {
      sequenceStore.createFxSequence('Physic Paint', physicPaintLayer, totalFrames.peek());
    }
    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
  };
```

**Change:** after layer creation, register exactly one `createEfxPaintDocument(layerId)` in `efxPaintStore` (DOC-01/DOC-02 — one default Paint track + fixed Background track, transparent fallback). The layer shape itself is unchanged; `'physic-paint'` stays the parent-layer anchor (`source.layerId` = `parentLayerId`).

---

### `app/src/components/physic-paint/bridge/physicsPaintSessionFile.ts` (service, session file IO) — MODIFIED

**Analog:** itself (155 lines, fully read).

**Parse/reject idiom** (lines 46-54 — closed guard + single error copy):

```typescript
export function parsePhysicsPaintStateFile(contents: string): SerializedProject {
  try {
    const parsed = JSON.parse(contents);
    if (!isSerializedProject(parsed)) throw new Error(LOAD_STATE_INVALID_COPY);
    return parsed;
  } catch {
    throw new Error(LOAD_STATE_INVALID_COPY);
  }
}
```

**Pitfall F5 (mandatory):** detect the legacy `version: 2` shape EXPLICITLY and reject with a distinct pre-v1.0 unsupported message; keep `LOAD_STATE_INVALID_COPY` (line 10) for genuinely malformed files. Same D-07 tone: explicit, no recourse.

**Copy constants idiom** (lines 6-10 — exported `*_COPY` string constants; add a `LOAD_STATE_UNSUPPORTED_VERSION_COPY` alongside):

```typescript
export const LOAD_STATE_INVALID_COPY = 'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.';
```

**Filename idiom** (line 85): `` `efx-paint-state-${Date.now()}.json` `` — new v1.0 session files get a distinct name/marker so old files are detectable by content, not name.

**Adapter split to preserve:** native save via parent-window event round-trip (lines 95-134, `PHYSIC_PAINT_STATE_SAVE_REQUEST_EVENT`) vs browser blob download (lines 141-154). Keep both paths; only the serialized payload changes.

---

### `packages/efx-physic-paint/src/types.ts` + `engine/EfxPaintEngine.ts` (model + service) — MODIFIED (D-03)

**Analogs:** themselves.

**Legacy session format to replace** (types.ts:186-207):

```typescript
export interface SerializedProject {
  version: 2
  width: number
  height: number
  strokes: Array<{ tool: string; pts: Array<...>; color: string | null; ... }>
  settings: { bgMode: string; paperGrain: string; embossStrength: number; wetPaper: boolean }
}
```

**Engine entry points to re-wire** (EfxPaintEngine.ts:1082-1091):

```typescript
/** Serialize the project for saving */
save(): SerializedProject {
  this.flushPendingStrokeFinalizations()
  return this.serializeProject()
}

/** Load a serialized project */
load(json: SerializedProject): void {
  this.flushPendingStrokeFinalizations()
  this.loadProjectData(json)
}
```

`serializeProject()` writes `version: 2` at EfxPaintEngine.ts:2141-2143. The v1.0 session payload becomes the v1.0 document; old files rejected via the F5-distinct message. One document format everywhere (D-03).

## Shared Patterns

### Fail-closed validation (ASVS V5)
**Source:** `app/src/lib/physicPaintPersistence.ts:30-46` + `physicsPaintRotoPhysicalModel.ts:843-878`
**Apply to:** `efxPaintDocumentParsers.ts`, `efxPaintCleanBreak.ts`, `efxPaintPersistence.ts` (load path), `physicsPaintSessionFile.ts` (v1.0 parse)
**Rule:** unknown members throw; malformed members throw; never normalize, never allocate IDs in a parser; duplicate IDs fail loud.

### Staging/commit two-resource transaction
**Source:** `app/src/lib/physicPaintPersistence.ts:320-340` (TS orchestrator) + `app/src-tauri/src/services/physic_paint_cache.rs:49,140,175,205` (native commands) + `project_io.rs:64-66` (bind-on-save)
**Apply to:** `efxPaintPersistence.ts` save path; both `projectStore.saveProject` and `saveProjectAs` call sites
**Rule:** stage sidecars under UUID staging prefix → write .mce with bound transaction → settle commit/rollback. Never direct-write canonical cache paths.

### Path safety (ASVS V12)
**Source:** `app/src/lib/physicPaintPersistence.ts:48-59` (FNV-1a `stableSegment`), 89-93 (`isSafe*CachePath`)
**Apply to:** all v1.0 sidecar paths
**Rule:** prefix-locked, no `\`, no absolute, no NUL, no empty/`.`/`..` segments; directory names derived via `stableSegment(id)` to prevent collisions and traversal.

### Rust+TS serde co-change
**Source:** `app/src-tauri/src/models/project.rs:15-29` + `app/src/types/project.ts:20-38`
**Apply to:** the `efx_paint_documents` key — same commit, plus a Rust round-trip test (project_io.rs:189-260 idiom) and a TS save/reopen contract test. TS-only tests mock IPC and will NOT catch a missing Rust field (Pitfall F1 warning sign: save/reopen drops the document while all TS tests pass).

### Signals store reactivity
**Source:** `app/src/stores/physicPaintStore.ts:37-40,99`
**Apply to:** `efxPaintStore.ts`
**Rule:** counter-signal invalidation + non-reactive Maps + injected dirty callback; bump the version signal on every mutation and subscribe in render effects (MEMORY: paintVersion discipline). No `useEffect` for internal derivation (CLAUDE.md).

### Error/copy constants
**Source:** `physicsPaintSessionFile.ts:6-10`
**Apply to:** rejection dialog copy, session-file rejection copy
**Rule:** exported `*_COPY` constants; plain, explicit, no recourse per D-07. GSD artifacts in English; product copy follows existing UI conventions.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/src/efx-paint/document/efxPaintCleanBreak.ts` | utility | gate predicate | No existing "reject a whole project at parse time" predicate exists — the open flow has never refused a project before. The fail-closed building blocks are exact analogs (above); the gate composition itself is new. Use RESEARCH.md Code Examples 2-3 as the skeleton. |

(The rejection dialog has two strong role-match analogs — listed above rather than here.)

## Legacy Deletion Map (DOC-04 — deletions, not modifications)

| Legacy surface | Location | Replaced by |
|---|---|---|
| Whole persistence module | `app/src/lib/physicPaintPersistence.ts` (462 lines) | `app/src/lib/efxPaintPersistence.ts` (new dir/prefix/keys) |
| Legacy output types | `app/src/types/project.ts:37,44-127` | `efx_paint_documents` key |
| Rust legacy structs | `app/src-tauri/src/models/project.rs:28,31-60` | new document field |
| Legacy cache dir creation | `app/src-tauri/src/services/project_io.rs:14,26-27` | new v1.0 cache dir |
| One-track store serialization | `app/src/stores/physicPaintStore.ts:921-973+` (`toMceOutputs`/`loadFromMceOutputs`) | document (de)serialization; runtime maps re-addressed in Phase 46 (A4) |
| Old session-file contract | `physicsPaintSessionFile.ts` v2 JSON + `efx-paint-state-*.json` | v1.0 session format; old files rejected (F5) |
| Standalone v2 format | `packages/efx-physic-paint/src/types.ts:186-207`; `EfxPaintEngine.ts:2141-2143` | v1.0 document (D-03) |
| Legacy launch-context fields | `app/src/types/physicPaint.ts:1690-1706` (`editableState`, `rotoPhysical`, `cachedRotoFrames`, `rotoInterpolationSettings`) | bridge carries the v1.0 document (Open Question Q3) |
| Legacy tests | `physicPaintPersistence.test.ts`, `physicPaintStore.test.ts` (+variants), `physicPaintBridge.test.ts`, `physicPaintPlayScriptBridge.test.ts`, `physicPaint.test.ts` | new v1.0 tests |

**Grep contract test (DOC-04 audit):** assert no reference remains to `physicPaintPersistence`, `'cache/physic-paint'`, `'.physic-paint-staging-'`, `physic_paint_outputs`, `McePhysicPaintOutput` outside git history. Typecheck + `cargo test` catch dangling references mechanically (Pitfall F3).

## Out-of-Scope Boundaries (do NOT pattern-match into these files)

- `app/src/stores/paintStore.ts`, `app/src/lib/paintRenderer.ts`, `PaintOverlay.tsx`, `paintPersistence.ts` — inline EFX Paint layer, untouched (D-01).
- `app/src/lib/previewRenderer.ts` `resolvePhysicPaintFrameSource` (lines 126, 283-288) — compositor boundary unchanged (DOC-06); verification is a diff gate.
- Legacy on-disk data (`cache/physic-paint/`, `physic_paint_outputs` blobs) — never read, never deleted (D-04).
- Background fallback configuration UI — Phase 49 (D-09).

## Metadata

**Analog search scope:** `app/src/lib/`, `app/src/stores/`, `app/src/components/physic-paint/`, `app/src/components/project/`, `app/src/components/timeline/`, `app/src/types/`, `app/src-tauri/src/models/`, `app/src-tauri/src/services/`, `packages/efx-physic-paint/src/`
**Files scanned (read in full or targeted ranges this session):** 12
**Pattern extraction date:** 2026-08-23
