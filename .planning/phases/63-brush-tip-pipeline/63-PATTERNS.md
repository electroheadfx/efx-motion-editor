# Phase 63: Brush Tip Pipeline - Pattern Map

**Mapped:** 2026-11-15
**Files analyzed:** 33 (20 modified, 13 new)
**Analogs found:** 30 / 33
**Inputs:** `63-CONTEXT.md` (authoritative; its §Requirement amendments beat both specs) + `SPECS/v2.2.0-brush-tips/GSD-QUICK-PROMPT-01-mask-wiring.md` + `GSD-QUICK-PROMPT-02-embedded-tips.md`. No RESEARCH.md (research disabled by project config).

All analog paths below were verified git-tracked (`git ls-files -- <path>` non-empty). No `.gsd/capabilities` mirror paths are named; build from `packages/efx-watercolor/src/`, never `dist/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| **Derivation / engine (packages/efx-watercolor)** | | | | |
| `packages/efx-watercolor/src/brushes/importTip.ts` (M) | utility (untrusted-input transform) | file-I/O → transform | itself (existing decode chain) | exact |
| `packages/efx-watercolor/src/brushes/maskDerivation.ts` (N) | utility (pure transform) | transform | `spectralData.ts` (pure-constant module) + `importTip.ts` decode chain | role-match |
| `packages/efx-watercolor/src/brushes/maskRegistry.ts` (N) | registry/store | request-response (lookup) | `tips.ts` `findTip` + projectStore `scriptLibraryAuthority` bind/clear + `clearStrokeThumbCache()` | role-match |
| `packages/efx-watercolor/src/brushes/builtinTips.ts` (N) | config (compile-time constants) | transform (bake-once) | `spectralData.ts` (generated constant) + `tips.ts` `TIPS` | role-match |
| `packages/efx-watercolor/src/brushes/tips.ts` (M) | model | CRUD (record shape) | itself | exact |
| `packages/efx-watercolor/src/brushes/pack.ts` (M) | validator/serializer | request-response (total parser) | itself | exact |
| `packages/efx-watercolor/src/brushes/index.ts` (M) | config (barrel) | — | itself | exact |
| `packages/efx-watercolor/src/playground/brushBridge.ts` (M) | service (the ONE mapping) | transform | itself | exact |
| `packages/efx-watercolor/src/playground/brushes.ts` (M) | model/factory | transform | itself (`buildBrush` Uint8Array branch) | exact |
| **UI (app/src)** | | | | |
| `app/src/components/physic-paint/view/aquarelleBrushCatalog.ts` (N) | store (module signals) | request-response | `BrushesDocker.tsx` `customTips` + `aquarelleRecordState.ts` signal/setter law | exact |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` (M) | component | request-response | itself + `BrushesDocker.tsx` toolbar/import block | exact |
| `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` (M) | test | — | itself (must be AMENDED, see gotcha G-1) | exact |
| `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` (M) | utility (canvas cache) | transform | itself + `paperThumb.ts` (per-(id,size) key) | exact |
| `app/src/components/physic-paint/view/aquarelleRecordState.ts` (M) | store | request-response | itself (`selectAquarelleTip` resolution law) | exact |
| `app/src/components/physic-paint/engine/aquarelleFootprint.ts` (M, cache key) | service (cursor preview) | transform | itself (`brushFor` signature cache) | exact |
| `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` (unchanged) | component | — | reference only (lift stays preset-only) | n/a |
| `app/src/components/physic-paint/view/BrushesDocker.tsx` (unchanged) | component (unmounted) | — | source of `customTips` + import call shape | reference |
| **Persistence — TypeScript** | | | | |
| `app/src/types/project.ts` (M) | model (wire) | CRUD | itself (`MceProject`, `MceBrushPackSnapshot`) | exact |
| `app/src/stores/projectStore.ts` (M) | store | request-response | itself (`buildMceProject`, `openProject`, `closeProject`) | exact |
| `app/src/lib/efxPaintPackage.ts` (M) | config/validator | request-response (pure) | itself (`frames/` accept-set) | exact |
| `app/src/lib/ipc.ts` (M) | IPC adapter | request-response | `ipcEfxPaintWriteFrameMedia` / `ipcEfxPaintReadFrameMedia` | exact |
| `app/src/lib/efxPaintPersistence.ts` (M) | service (save funnel) | batch | itself (`stagedPaths` + `commitStagedPackage`) | exact |
| `app/src/lib/efxPaintBrushMasks.ts` (N) | service (orchestrator) | batch + transform | `efxPaintMediaMaterialize.ts` + `efxPaintMediaRead.ts` | exact |
| `app/src/lib/mceFieldContract.test.ts` (M) | test (contract) | — | itself (Phase 56 block) | exact |
| `app/src/lib/efxPaintPackage.test.ts` (M) | test | — | itself (`frames/` accept-set rows) | exact |
| **Persistence — Rust** | | | | |
| `app/src-tauri/src/models/project.rs` (M) | model (wire) | CRUD | itself (`MceProject`, `MceBrushPackSnapshot`) | exact |
| `app/src-tauri/src/services/efx_paint_media.rs` (M) | service (path guard + IO) | file-I/O | itself (`frames/` branch) | exact |
| `app/src-tauri/src/commands/efx_paint_media.rs` (M) | controller | request-response | itself (`efx_paint_write/read_frame_media`) | exact |
| `app/src-tauri/src/services/frame_codec.rs` (M) | service (codec) | transform | itself (`WebPLosslessCodec`) | exact |
| `app/src-tauri/src/commands/brush_codec.rs` (N — name is planner's choice) | controller | request-response (batch) | `commands/frame_codec.rs` `decode_webp_frame` + `BoundPackageFileSet.entries` | role-match |
| `app/src-tauri/src/lib.rs` (M) | config (command registry) | — | itself `invoke_handler` list | exact |
| **Roto carrier** | | | | |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` (M) | validator/serializer | request-response | itself (`isThumbnail` + `parseWebpDimensions`) | exact |
| `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts` (M) | service (save leg) | batch | itself (serialize call site line 527) | exact |
| **Prerequisite asset (not runtime input)** | | | | |
| `SPECS/v2.2.0-brush-tips/assets/Paint_Brush_sb4tebyp_1K_Brush.jpg` → `wc/builtin-bristle` | input | — | present on disk, verified | n/a |
| `…sb5qdgop_1K_Brush.jpg` → `wc/builtin-chalk` | input | — | present | n/a |
| `…scmeagrp_1K_Brush.jpg` → `wc/builtin-sponge` | input | — | present | n/a |

---

## Pattern Assignments

### Requirement #1 — how a `.mce` root key is declared on BOTH sides and pinned

#### `app/src/types/project.ts` (model, CRUD) — MODIFY

**Analog:** itself.

**Import pattern:** the file imports only `MceAudioTrack` from `./audio` (line 1). New declarations add no import.

**Root-key declaration pattern** (lines 12-63 — every optional member documents WHY it must exist in Rust):

```typescript
export interface MceProject {
  version: number;
  name: string;
  fps: number;
  width: number;
  height: number;
  created_at: string;
  modified_at: string;
  sequences: MceSequence[];
  images: MceImageRef[];
  /** 261012-d6q/VID-02: gallery video assets (imported, used or not).
   *  Declared here because serde drops undeclared keys — without this member
   *  every save erases the gallery video rows (same hole class as audio). */
  video_assets?: MceVideoAssetRef[];
  // ...
  motion_blur?: MceMotionBlur;
  formatVersion?: number;
  projectId?: string;
  efxPaint?: Record<string, unknown>;
}
```

New member to add (shape chosen to match the existing `formatVersion`/`projectId` idiom, serde-rename-compatible):

```typescript
  /** Phase 63: the project's brush-tip pack. Entries carry a package-relative
   *  `brushes/<sha256>.webp` asset ref (never inline bytes). Two-language by
   *  design — serde drops an undeclared key. */
  brushPack?: MceBrushPackSnapshot;
```

**Snapshot member (lines 321-329) — the comment is a CONTEXT-mandated edit (D-10 retired the inline-data exception):**

```typescript
/**
 * Brush-pack snapshot travelling in `.mce` (MOD-04 / D-23). Deliberate
 * exception to the 52.2 refs-only law: entries are inline data, never a file
 * reference. Two-language by design — NOT an ALLOWED_ONE_LANGUAGE entry.
 */
export interface MceBrushPackSnapshot {
  kind: string;
  entries: unknown[];
}
```

**Peer pattern to copy for a new entry-shape member** (lines 300-309, the 8 multiplier keys — this is the exact doc style for a named `Mce*` record under the pin):

```typescript
export interface MceAquarelleBrushProperties {
  tip: number;
  aspect: number;
  rotation: number;
  sizeCurve: number;
  scatter: number;
  capacity: number;
  grain: number;
  wetRound: number;
}
```

#### `app/src-tauri/src/models/project.rs` (model, CRUD) — MODIFY

**Analog:** itself.

**Root-key declaration pattern** (lines 16-63 — the serde attribute trio to copy verbatim):

```rust
pub struct MceProject {
    // ...
    /// The package format version (D-04), stamped by `buildPackageManifest`
    /// and judged by the TS refusal gate (52.2-08). `None` on a pre-52.2
    /// project. Declared here because serde drops undeclared keys: without
    /// this field every save would erase the version the gate reads.
    #[serde(default, rename = "formatVersion", skip_serializing_if = "Option::is_none")]
    pub format_version: Option<u32>,
    /// The layer index (`layerId` → `{ layerFile, documentRevision,
    /// compositeRevision }`), carried opaquely like `efx_paint_documents`:
    /// TS owns the schema (52.2-02 `buildPackageManifest`).
    #[serde(default, rename = "efxPaint", skip_serializing_if = "HashMap::is_empty")]
    pub efx_paint: HashMap<String, Value>,
}
```

Add, in the same style (snake_case field + camelCase wire rename is mandatory — the contract parser reads `pub <ident>:` and the `rename`):

```rust
    /// Phase 63: the project's brush-tip pack (package-internal
    /// `brushes/<sha256>.webp` asset refs). Declared because serde drops
    /// undeclared keys.
    #[serde(default, rename = "brushPack", skip_serializing_if = "Option::is_none")]
    pub brush_pack: Option<MceBrushPackSnapshot>,
```

**Snapshot struct (lines 457-465) — comment edit required (drop the inline-exception claim):**

```rust
/// Brush-pack snapshot travelling in `.mce` (MOD-04 / D-23). Deliberate
/// exception to the 52.2 refs-only law: entries are inline data, never a file
/// reference. Two-language by design — NOT an ALLOWED_ONE_LANGUAGE entry.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MceBrushPackSnapshot {
    pub kind: String,
    pub entries: Vec<Value>,
}
```

If the plan names the entry shape (`MceBrushPackEntry`), the camelCase-rename idiom is lines 430-446 (`size_curve` → `sizeCurve`, `wet_round` → `wetRound`).

#### `app/src/lib/mceFieldContract.test.ts` (test, contract) — MODIFY

**Analog:** itself. This is the definition of done for the new key.

**Exact parser rules the new key must satisfy:**

- `parseRustFields` (lines 49-61): reads `((?:#\[[^\]]*\]\s*)*)pub (\w+)\s*:` and takes `rename = "..."` as the wire name. So `#[serde(rename = "brushPack")] pub brush_pack: …` parses to wire key `brushPack`.
- `parseTsFields` (lines 84-99): only depth-0 `^([A-Za-z_][A-Za-z0-9_]*)\??\s*:` lines count. `brushPack?: MceBrushPackSnapshot;` yields `brushPack`.
- Member-set test (lines 180-187): every `Mce*` name must exist in BOTH files. A new `MceBrushPackEntry` MUST be declared twice, or not be named `Mce*`.
- Generic key diff (lines 189-199) then covers `MceProject.brushPack` automatically.

**Row to add, copying the Phase 56 block shape (lines 231-260):**

```typescript
describe('Phase 63 brush-tip pack field set', () => {
  it('declares the brush-pack root key on the project in both languages', () => {
    // Phase 63: brushPack is a root .mce key; entries carry asset refs.
    expectMemberKeys('MceProject', ['brushPack']);
  });

  it('keeps brushPack off the one-language allowlist', () => {
    for (const entry of ALLOWED_ONE_LANGUAGE) {
      expect(entry.toLowerCase()).not.toContain('brushpack');
      expect(entry.toLowerCase()).not.toContain('brush_pack');
    }
  });
});
```

Do NOT touch `ALLOWED_ONE_LANGUAGE` (lines 122-124) — the Phase 61 test at lines 401-407 snapshots it literally to `['MceSequence.fps']`; adding an entry fails that snapshot.

---

### Requirement #2 — `frames/` write/stage/read through Rust, bound-path guard, static scans

#### `app/src-tauri/src/services/efx_paint_media.rs` (service, file-I/O) — MODIFY

**Analog:** itself. The `brushes/` branch must be a SIBLING of the `frames/` branch, never a widening of it.

**Module header law to extend (lines 1-17):**

```rust
//! Two guards live here, deliberately separate and asymmetric (T-52.2-01):
//!
//! * the MEDIA lock (`resolve_package_media_path` / `resolve_package_media_write_path`)
//!   accepts exactly `frames/<layerId>/<keyId>.webp` and is never widened;
//! * the BOUND-path guard (`resolve_package_bound_path`) carries the save
//!   transaction's file set — `project.mce`, `layers/<layerId>.json` and every
//!   `frames/*.webp` entry, with the `frames/` branch delegated back to the
//!   media code path so the `.webp` rule is literally the same code.
```

**Constant block (lines 26-39)** — add `pub const BRUSH_ASSET_ROOT: &str = "brushes";` beside `FRAME_MEDIA_ROOT`, and a fixed-shape validator for the 64-hex stem:

```rust
pub const FRAME_MEDIA_ROOT: &str = "frames";
pub const PACKAGE_MANIFEST_BASENAME: &str = "project.mce";
pub const PACKAGE_LAYERS_ROOT: &str = "layers";
const MEDIA_EXTENSION: &str = "webp";
```

**Bound-path guard (lines 198-220) — the third branch, copy the `frames/` shape exactly:**

```rust
pub fn resolve_package_bound_path(
    package_root: &Path,
    relative: &str,
) -> Result<PathBuf, EfxPaintMediaError> {
    validate_package_relative_path_shape(relative)?;
    let root = canonical_package_root(package_root)?;
    if relative == PACKAGE_MANIFEST_BASENAME {
        return resolve_bound_leaf(&root, &[PACKAGE_MANIFEST_BASENAME]);
    }
    if relative.starts_with(&format!("{PACKAGE_LAYERS_ROOT}/")) {
        let file_name = parse_layer_relative_path(relative)?;
        return resolve_bound_leaf(&root, &[PACKAGE_LAYERS_ROOT, file_name]);
    }
    if relative.starts_with(&format!("{FRAME_MEDIA_ROOT}/")) {
        let (layer_id, key_id) = parse_media_relative_path(relative)?;
        let resolved = resolve_media_target(&root, layer_id, key_id, false)?;
        if is_symlink_leaf(&resolved) {
            return Err(rejected(EfxPaintMediaRejection::PathEscape));
        }
        return Ok(resolved);
    }
    Err(rejected(EfxPaintMediaRejection::UnsupportedPackagePath))
}
```

New branch (planner adds `parse_brush_asset_relative_path`: exactly one segment `<64-hex>.webp`, `WrongExtension` for a non-`.webp` leaf, `UnsupportedPackagePath` for any nesting):

```rust
    if relative.starts_with(&format!("{BRUSH_ASSET_ROOT}/")) {
        let stem = parse_brush_asset_relative_path(relative)?;
        let resolved = resolve_bound_leaf(&root, &[BRUSH_ASSET_ROOT, stem])?;
        return Ok(resolved);
    }
```

**Shape guard (lines 452-476)** is shared and needs no change — `brushes/<hex>.webp` passes it.

**Atomic write (lines 601-626)** is reused as-is (`write_atomically`): sibling temp + rename + parent fsync.

**Digest (lines 240-261)** is the `sha256` the 64-hex name comes from:

```rust
/// SHA-256 (64 lower-case hex chars), computed in Rust — never `crypto.subtle`.
pub fn digest_bytes(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
```

**Static scans / pins that MUST gain a `brushes/` row:**

- `media_lock_stays_locked_to_the_frames_webp_tree` (lines 683-698) — keep refusing `layers/L1.json`, `frames/L1/K1.png`, `../escape.webp`; add positives for `brushes/<64hex>.webp` and negatives for `brushes/not-hex.webp`, `brushes/a/b.webp`, `brushes/x.png`.
- `bound_guard_refuses_everything_outside_the_transaction_file_set` (lines 700-719) — it lists `images/a.webp`, `cache/efx-paint/a.webp`, `scripts/x.json`, `paint/L1/…` as refusals; keep all of them and add a `brushes/<64hex>.webp` accept case. Do not remove any existing entry.
- `parse_layer_relative_path` carries the "ONE parser serves the bound-path guard and the service" comment (lines 497-502) — `brushes/` must follow the same one-parser rule.

**Renderer-side static scan** lives in `app/src/lib/efxPaintPackage.ts` (`parseFrameMediaReference`, lines 167-196) and its tests. See below.

#### `app/src/lib/efxPaintPackage.ts` (config/pure validator) — MODIFY

**Analog:** itself.

**Constants and path builders (lines 27-136):**

```typescript
export const PKG_FORMAT_VERSION = 1;
export const EFX_PAINT_LAYERS_DIR = 'layers';
export const EFX_PAINT_FRAMES_DIR = 'frames';
export const EFX_PAINT_MACHINE_CACHE_DIR = 'efx-paint';

export function buildFrameMediaRelativePath(layerId: string, keyId: string): string {
  return `${EFX_PAINT_FRAMES_DIR}/${assertSafePackageId(layerId)}/${assertSafePackageId(keyId)}.webp`;
}
```

Add the sibling (content-addressed, no caller-supplied path shape):

```typescript
export const EFX_PAINT_BRUSHES_DIR = 'brushes';
const BRUSH_ASSET_STEM_PATTERN = /^[0-9a-f]{64}$/;

/** `brushes/<sha256>.webp` — the ONE brush-mask asset shape (Phase 63). */
export function buildBrushAssetRelativePath(digest: string): string {
  if (!BRUSH_ASSET_STEM_PATTERN.test(digest)) throw new Error('unsafe brush asset digest');
  return `${EFX_PAINT_BRUSHES_DIR}/${digest}.webp`;
}
```

**Fail-closed reference parser (lines 144-196)** — the pattern a `parseBrushAssetReference` copies (unknown members refused, prefix+extension checked, 64-hex digest checked, `Object.freeze` result):

```typescript
export function parseFrameMediaReference(value: unknown, path: string = 'media'): FrameMediaReference {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path}: expected a media reference record.`);
  }
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => FRAME_MEDIA_KEYS.has(key))) {
    throw new Error(`${path}: unknown members; expected exactly relativePath, digest, width, height.`);
  }
  const relativePath = record.relativePath;
  if (
    !isSafePackageRelativePath(relativePath)
    || !relativePath.startsWith(`${EFX_PAINT_FRAMES_DIR}/`)
    || !relativePath.endsWith('.webp')
  ) {
    throw new Error(`${path}: relativePath must be a safe frames/<layerId>/<keyId>.webp reference.`);
  }
  const digest = record.digest;
  if (typeof digest !== 'string' || !FRAME_MEDIA_DIGEST_PATTERN.test(digest)) {
    throw new Error(`${path}: digest must be 64 lower-case hex characters.`);
  }
  // ...
  return Object.freeze({ relativePath, digest, ... });
}
```

**Manifest assembly (lines 245-285)** — where root keys are actually assembled today. `brushPack` rides `project` (the `buildMceProject()` object) through the passthrough loop at lines 277-280; no change to `buildPackageManifest` is needed unless the plan wants an explicit refusal for a `brushPack` carrying inline `mask` bytes (recommended, mirroring `MANIFEST_FORBIDDEN_LAYER_KEYS` at line 58).

#### `app/src/lib/efxPaintPersistence.ts` (service, batch) — MODIFY

**Analog:** itself. The staged file set is the transaction's bound set.

**Staging loop (lines 1146-1261)** — the exact insertion point for `brushes/*.webp`:

```typescript
  const stagingBasename = createPackageStagingBasename();
  const stagingRoot = `${packageDir}/${stagingBasename}`;
  const stagedPaths: string[] = [];
  // ...
      const { reference, staged } = await writeKeyMedia(packageDir, stagingBasename, layer.layerId, frame);
      mediaRefs.set(frame.keyId, reference);
      // The bound set IS the publish set, and only what was STAGED is bound
      if (staged) stagedPaths.push(reference.relativePath);
  // ...
      stagedPaths.push(layer.layerFile);
  // ...
      stagedPaths.push(EFX_PAINT_PACKAGE_MANIFEST_FILE);
  // ...
    await commitStagedPackage(packageDir, stagingBasename, stagedPaths);
```

Rule for the planner: a brush asset is staged with `stagingBasename` supplied, its canonical relative path is pushed to `stagedPaths` (dedupe via `Array.from(new Set(...))` at line 971), and `commitStagedPackage` (lines 1077-1079) binds it. D-13 means NO delete pass is added for an orphan.

#### `app/src-tauri/src/services/physic_paint_cache.rs` (service, batch) — reference only

**Analog:** the transaction's bound set (bind/publish/settle). Header law (lines 1-23) states the bound set is exactly the package file set and `efx-paint/...` is refused. Publish resolves BOTH staged and canonical paths through the same guard:

```rust
            let staged = resolve_package_bound_path(&staging_root, &entry.path)
            // ...
            let canonical = resolve_package_bound_path(&package_root, &entry.path)
```

No change needed: adding the `brushes/` branch to `resolve_package_bound_path` is enough for the transaction to carry brush assets. Do not add a `brushes/` special case in this file.

---

### Requirement #3 — decode a binary asset in Rust and return it to the renderer (one-call batch)

#### `app/src-tauri/src/commands/frame_codec.rs` (controller, request-response) — MODIFY or new sibling

**Analog:** `decode_webp_frame` (lines 71-89) + `DecodedWebpFrame` (lines 5-22) + hand-rolled `encode_base64` (lines 24-42).

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DecodedWebpFrame {
    pub width: u32,
    pub height: u32,
    /// Base64-encoded RGBA … Never a JSON number array or a raw body: on macOS
    /// a raw response degrades to a number array …
    pub rgba_base64: String,
    pub codec_ms: f64,
}

#[tauri::command(async)]
pub fn decode_webp_frame(request: Request) -> Result<DecodedWebpFrame, String> {
    let bytes = match request.body() {
        InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("decode_webp_frame: expected a raw byte body".to_string()),
    };
    let (width, height, rgba) = WebPLosslessCodec.decode_rgba(&bytes)?;
    Ok(DecodedWebpFrame { width, height, rgba_base64: encode_base64(&rgba), codec_ms })
}
```

`encode_base64` is `pub(crate)` and already shared by `commands/efx_paint_media.rs:14` — reuse it, never add a crate.

**Batch return shape** for D-17's one-call brush-set decode — copy the list-of-structs idiom from `BoundPackageFileSet` (`app/src-tauri/src/commands/project.rs:100-119`):

```rust
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundPackageFile { pub path: String, pub sha256: String, pub had_original: bool }

#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundPackageFileSet {
    pub transaction_id: String,
    pub aggregate_digest: String,
    pub entries: Vec<BoundPackageFile>,
}
```

Recommended new command (one IPC round-trip, per-tip failure reported not thrown — D-18):

```
read_brush_mask_set(packageRoot, entries: Vec<{ id, relativePath, digest }>)
  -> Vec<{ id, ok, width, height, maskBase64?, reason? }>
```

Shape rules to copy: `#[tauri::command(async)]`, every decode failure becomes a per-entry `reason` label (never an `Err` that kills the batch), and `codec_ms`-style diagnostics are optional.

#### `app/src-tauri/src/commands/efx_paint_media.rs` (controller) — MODIFY

**Analog:** itself. Header (lines 1-12) records WHY base64 comes back instead of a raw body — reuse the reasoning verbatim for the brush-set decode.

```rust
#[tauri::command(async)]
pub fn efx_paint_read_frame_media(request: Request) -> Result<FrameMediaReadResponse, EfxPaintMediaError> {
    let headers = request.headers();
    let package_dir = header(headers, "packageDir")?;
    let relative_path = header(headers, "relativePath")?;
    let result = read_frame_media(&PathBuf::from(package_dir), &relative_path)?;
    Ok(FrameMediaReadResponse {
        relative_path: result.relative_path,
        digest: result.digest,
        byte_length: result.byte_length,
        bytes_base64: encode_base64(&result.bytes),
    })
}
```

The brush-asset write command mirrors `efx_paint_write_frame_media` (lines 57-89): headers carry `packageDir` + `digest` (the content address), the raw body carries the encoded WebP bytes.

#### `app/src/lib/ipc.ts` (IPC adapter) — MODIFY

**Analog:** lines 605-641.

```typescript
export async function ipcEfxPaintReadFrameMedia(
  packageDir: string,
  relativePath: string,
): Promise<Result<EfxPaintFrameMediaReadResult, EfxPaintMediaFailure>> {
  try {
    const data = await invoke<{ relativePath: string; digest: string; byteLength: number; bytesBase64: string }>(
      'efx_paint_read_frame_media',
      undefined,
      { headers: { packageDir, relativePath } },
    );
    return { ok: true, data: { bytes: base64ToBytes(data.bytesBase64), digest: data.digest } };
  } catch (error) {
    return { ok: false, error: efxPaintMediaFailureFrom(error) };
  }
}
```

Copy the failure taxonomy and its normalizer verbatim (lines 548-597): `missing` / `refused{rejection}` / `io`, with the JSON-quoted-label unquote and the `EFX_PAINT_MEDIA_REJECTION_LABELS` membership test. A new failure label list must be exhaustive or it degrades to `io` (fail-closed direction).

---

### Requirement #4 — `buildBrushForStroke`'s signature and its consumers

#### `packages/efx-watercolor/src/playground/brushBridge.ts` (service, transform) — MODIFY

**Analog:** itself.

**Signature that MUST NOT change** (lines 51-74):

```typescript
export function buildBrushForStroke(
  brushId: string,
  overrides?: BrushMultiplierOverrides | null,
  seed = 7,
): Brush {
  const base = buildBrush(presetFor(brushId), seed)
  if (!overrides) return base
  return {
    ...base,
    aspect: base.aspect * mult(overrides.aspect),
    angle: base.angle * mult(overrides.rotation),
    pressureSize: base.pressureSize * mult(overrides.sizeCurve),
    spacing: base.spacing / mult(overrides.tip),
    scatter: base.scatter * mult(overrides.scatter),
    capacity: base.capacity * mult(overrides.capacity),
    grain: base.grain * mult(overrides.grain),
    wetRound: base.wetRound * mult(overrides.wetRound),
  }
}
```

Current resolution law (lines 42-49) — the mask branch replaces the `presetFor` call's source while keeping every multiplier applied (D-21/D-22):

```typescript
function mult(v: number | undefined, fallback = 1): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback
}

function presetFor(brushId: string): BrushPreset {
  const presetId = TIP_TO_PRESET[brushId] ?? (BRUSH_PRESETS.some((b) => b.id === brushId) ? brushId : 'round')
  return BRUSH_PRESETS.find((b) => b.id === presetId) ?? BRUSH_PRESETS[0]!
}
```

Required shape (D-21): if the registry resolves `brushId` to a mask, build `buildBrush({ ...CUSTOM_BASE, id, name, hint, tip: mask }, seed)`; otherwise fall through to `presetFor(brushId)` unchanged. The overrides block below runs identically either way — do not gate it (D-22).

**The five consumers (do not edit; they must keep compiling against the unchanged signature):**

| Consumer | Call | What it reads |
|---|---|---|
| `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx:314` | `engine.setBrush(buildBrushForStroke(selection.brushId, selection.toolOverrides))` | whole `Brush` |
| `app/src/components/physic-paint/engine/aquarelleFootprint.ts:80` | `cachedBrush = buildBrushForStroke(tipId ?? 'round', overrides)` | aspect/angle/size/tipMean |
| `app/src/components/physic-paint/view/aquarelleStrokeBand.ts:92` | `const brush = buildBrushForStroke(stroke.brushId \|\| 'round', stroke.toolOverrides)` | `aspect`, `angle`, `rotation` |
| `app/src/components/physic-paint/roto/aquarelleLiftErase.ts:93` | `const brush = buildBrushForStroke(stroke.brushId \|\| 'filbert', stroke.toolOverrides)` | `tipData`, `tipSize`, `aspect`, `angle`, `rotation` |
| `packages/efx-watercolor/src/adapter/engineAdapter.ts:295` (replay) | `engine.setBrush(buildBrushForStroke(payload.brushId ?? stroke.brushId, payload.toolOverrides ?? stroke.toolOverrides))` | whole `Brush` |

**Gotcha G-2 (cache key):** `aquarelleFootprint.ts` caches ONE brush by `${tipId ?? ''}|${overridesSignature(overrides)}` (lines 60-84). If the mask registry can change while an id stays the same (project open replaces masks; roto-script apply registers masks), that signature must include a mask generation counter, or the cursor preview keeps a stale tip. Do not key it on the `Uint8Array` identity without bounding the Map — it is single-entry by design.

#### `packages/efx-watercolor/src/playground/brushes.ts` (model/factory) — MODIFY (small)

**Analog:** itself.

```typescript
export const TIP_SIZE = 192;                                    // line 70
export interface Brush extends Omit<BrushPreset, 'tip'> {
  tipSize: number;
  tipData: Uint8Array;
  tipMean: number;                                              // lines 63-68
}
export const CUSTOM_BASE: Omit<BrushPreset, 'id'|'name'|'hint'|'tip'> = {
  ...BASE, rotation: 'follow', angleJitter: 4, spacing: 0.2, wetRound: 0.4,   // lines 341-344
};
export function buildBrush(preset: BrushPreset, seed = 7): Brush {            // lines 348-363
  const { tip: source, ...rest } = preset;
  let tipData: Uint8Array, tipSize: number;
  if (source instanceof Uint8Array) {
    tipData = source;
    tipSize = Math.round(Math.sqrt(source.length));
  } else { /* procedural branch, tipSize = TIP_SIZE */ }
  let sum = 0;
  for (let i = 0; i < tipData.length; i++) sum += tipData[i];
  return { ...rest, tipSize, tipData, tipMean: Math.max(0.01, sum / (255 * tipData.length)) };
}
```

Rules for the planner:
- `buildBrush` needs no change; a mask is `Uint8Array(192*192)`.
- **Gotcha G-3:** `tipSize = Math.round(Math.sqrt(source.length))` silently accepts ANY perfect-square length. A 128×128 mask would build a wrong tip. Validate `length === TIP_SIZE * TIP_SIZE` in the registry/resolver BEFORE calling `buildBrush` (D-18 wrong-size → unavailable tip).
- `tipMean` already floors at 0.01; D-08 says imported masks are never normalized, so a faint stamp stays faint and `tipMean` is the only compensation. Spec 01 §Guardrails: a visible over/under-compensation is a FINDING, not a tuning change.
- `BrushPreset.custom?: boolean` (line 59) already exists for custom tips.

#### `packages/efx-watercolor/src/brushes/tips.ts` (model) — MODIFY

**Analog:** itself. `AquarelleTip` (lines 45-50) and the override surface (lines 20-38, 64-74):

```typescript
export interface AquarelleTip extends AquarelleToolOverrides {
  /** Stable id — referenced by strokes, travels in the .mce brush-pack snapshot. */
  id: string
  category: AquarelleTipCategory
  name: string
}
export const TOOL_OVERRIDE_FIELDS: ReadonlyArray<keyof AquarelleToolOverrides> = Object.freeze([...])
```

Decision surface for the planner: the asset ref must NOT become an `AquarelleToolOverrides` field (that would make it a required numeric key in `isTipRecord`). Add it as an optional member (`asset?: string`) on `AquarelleTip`, or carry it only on the pack entry type in `pack.ts`. `findTip` (lines 195-198) stays the 14-tip `TIPS` lookup; the new catalog lookup belongs to the registry module.

---

### Requirement #5 — module-level registry shape (register/replace/reset)

#### `packages/efx-watercolor/src/brushes/maskRegistry.ts` (NEW — registry, request-response)

There is **no registry module inside `packages/efx-watercolor` today** (grep for `registry|register` returns only an unrelated `Engine.ts` comment). Closest analogs, in rule order:

**A. Module-level signal + named bind/clear (projectStore, `scriptLibraryAuthority`)** — lines 74, 129-139:

```typescript
const scriptLibraryAuthority = signal<string | null>(null);

async function bindScriptLibraryAuthority(savedFilePath: string): Promise<void> {
  const result = await scriptLibraryBindSavedProject(savedFilePath);
  if (!result.ok) throw new Error(result.error);
  scriptLibraryAuthority.value = result.data;
  await publishScriptLibraryContext();
}

function clearScriptLibraryAuthority(): void {
  scriptLibraryAuthority.value = null;
  void scriptLibraryClearActiveProject().finally(() => { void publishScriptLibraryContext(); });
}
```

**B. Module-level list signal + total reset (BrushesDocker, the retired `customTips`)** — lines 44, 59-66:

```typescript
const customTips = signal<readonly AquarelleTip[]>([]);

export function resetBrushesDockerUi(): void {
  search.value = '';
  category.value = 'all';
  importFailure.value = false;
  collapsed.value = {};
  customTips.value = [];
  importing.value = false;
}
```

**C. Spyable seam + test-only clear (`watercolorStrokeThumb`)** — lines 150-154, 203-206:

```typescript
export const strokeThumbPainter = {
  drawStroke(canvas: HTMLCanvasElement, brush: Brush, hex: string): void {
    drawStroke(canvas, brush, hex);
  },
};

/** Test seam: drop every cached thumb (paints again on next get). */
export function clearStrokeThumbCache(): void {
  thumbCache.clear();
}
```

Rules the planner must follow (D-20):
1. The registry lives in the PACKAGE (engine reads it) but is APP-fed. No Preact import in the package (`packages/efx-watercolor/src/index.ts` header: "Preact-free core").
2. Three named operations, never implicit: `replaceMaskRegistry(entries)` (open — REPLACES, never appends), `resetMaskRegistry()` (close/new project → built-ins only), `registerMask(id, mask)` (import / roto apply). A generation counter getter is needed for G-2.
3. Fail-closed: a mask whose length ≠ `TIP_SIZE²` is rejected at registration and reported as unavailable — never stored, never silently substituted.
4. Built-ins are registered on app start (package constant), so `resetMaskRegistry()` restores exactly `['wc/builtin-bristle','wc/builtin-chalk','wc/builtin-sponge']`.

#### `app/src/components/physic-paint/view/aquarelleBrushCatalog.ts` (NEW — store, request-response)

**Analog:** `BrushesDocker.tsx` `customTips` signal (line 44) + `aquarelleRecordState.ts`'s signal-with-setter convention (lines 111-144, 251-300).

Rules:
- `signal<readonly AquarelleTip[]>` — Preact signals only, no `useState` (project law; `efx-preact-reactivity`).
- Exported setter(s) + one `resetBrushCatalog()`; setters are idempotent (compare-then-write) per `efx-preact-reactivity`.
- Narrow reads in components (`.value` once at the top of the component — see `WatercolorBrushLibrary.tsx:103`).
- Project-open sets catalog = built-ins + project entries; `closeProject()` and `createProject()` reset to built-ins (D-20). `resetBrushesDockerUi()` stays unused (D-02).

---

### Requirement #6 — the roto script thumbnail base64 payload-dimension check (reusable for the mask data URL)

#### `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts` (validator) — MODIFY

**Analog:** itself. Three reusable pieces.

**Limits block (lines 26-37)** — add `maskBytes` / mask dimensions here, do not hard-code elsewhere:

```typescript
export const ROTO_SCRIPT_LIMITS = {
  fileBytes: 16 * 1024 * 1024,
  brushes: 2_000,
  // ...
  thumbnailBytes: 512 * 1024,
  thumbnailWidth: 96,
  thumbnailHeight: 64,
} as const;
const WEBP_PREFIX = 'data:image/webp;base64,';                      // line 105
```

**The validation law to reuse verbatim (lines 476-489):**

```typescript
function isThumbnail(value: unknown): value is PersistedRotoScriptThumbnailV1 {
  if (!isRecord(value) || value.mimeType !== 'image/webp') return false;
  if (!positiveInteger(value.width, ROTO_SCRIPT_LIMITS.thumbnailWidth) || !positiveInteger(value.height, ROTO_SCRIPT_LIMITS.thumbnailHeight)) return false;
  if (typeof value.quality !== 'number' || !Number.isFinite(value.quality) || value.quality < 0.75 || value.quality > 0.85) return false;
  if (typeof value.dataUrl !== 'string' || !value.dataUrl.startsWith(WEBP_PREFIX)) return false;
  try {
    const bytes = decodeBase64(value.dataUrl.slice(WEBP_PREFIX.length));
    const dimensions = parseWebpDimensions(bytes);
    return bytes.length <= ROTO_SCRIPT_LIMITS.thumbnailBytes
      && dimensions?.width === value.width && dimensions.height === value.height;
  } catch {
    return false;
  }
}
```

**`decodeBase64` (lines 505-516)** is strict: alphabet regex, atob/Buffer fallback, and a canonical round-trip check (`encodeBase64(bytes) !== value` → throw). **`parseWebpDimensions` (lines 527-560)** walks RIFF chunks and requires exactly one image chunk + full-length container.

Mask variant the planner must add: `{ mimeType: 'image/webp', width: 192, height: 192, dataUrl }` validated with the same two functions and a `maskBytes` cap; the dimension check must be `=== TIP_SIZE` (192), not merely "within a max".

**Strengthen the entry guard (lines 385-387)** — today it is a shape-only check; Phase 63 makes entries carry a payload:

```typescript
function isBrushPack(value: unknown): value is BrushPackSnapshot {
  return isRecord(value) && typeof value.kind === 'string' && Array.isArray(value.entries);
}
```

**Serialization hook (line 176)** — currently always empty; Phase 63 populates it:

```typescript
const brushPack: BrushPackSnapshot = { kind: ROTO_SCRIPT_ENGINE_ID_AQUARELLE, entries: [] };
```

**Save-leg call site:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:527` calls `serializeAquarelleRotoScript({ id, name, createdAt, updatedAt, source: sourceBag, thumbnail, events: scriptSnapshot.aquarelleEvents })` — extend this input with the custom tips the saved events reference (D-14), not with the whole catalog.

---

### Requirement #7 — the project-open await chain (where the brush-set decode slots in)

#### `app/src/stores/projectStore.ts` (store, request-response) — MODIFY

**Analog:** itself. `openProject` (lines 1084-1160) is the exact seam:

```typescript
  async openProject(openFilePath: string) {
    const result = await ipcProjectOpen(openFilePath);
    if (!result.ok) throw new Error(result.error);

    const rejection = findPackageFormatRejection(result.data, { pathKind: 'directory' });
    if (rejection) { await showLegacyPhysicPaintRejectionDialog(rejection); return; }

    const projectRoot = openFilePath.substring(0, openFilePath.lastIndexOf('/'));
    const nextProjectId = isProjectId(result.data.projectId) ? result.data.projectId : crypto.randomUUID();
    const loadedDocuments = await loadEfxPaintPackage({ ... });

    // quick-260913-52r (G): read every referenced frame file BEFORE hydration ...
    const materialized = await materializePackageRotoMediaBytes(loadedDocuments, projectRoot);
    for (const failure of materialized.failures) { console.error(...); }

    const runtimeProject: RuntimeMceProject = { ...result.data };
    projectStore.closeProject({ preservePreparedRotoCanvases: true });
    batch(() => { filePath.value = openFilePath; dirPath.value = projectRoot; projectId.value = nextProjectId; });

    hydrateFromMce(runtimeProject, projectRoot, loadedDocuments, materialized.runtimeDocuments);
    await bindScriptLibraryAuthority(openFilePath);
    // ...
    startAutoSave();
    setTimeout(() => canvasStore.fitToWindow(), 0);
  },
```

**Placement rule (D-17):** the brush-set decode + registry replacement runs as a sibling `await` of `materializePackageRotoMediaBytes` — i.e. after `loadEfxPaintPackage` and BEFORE `projectStore.closeProject(...)` / `hydrateFromMce(...)`. It must be complete before `hydrateFromMce` because the paint surface (and therefore the first stroke replay) is created there. Prefer run-in-parallel with `materialize` via `Promise.all` only if the registry replace still happens before `hydrateFromMce` — the ordering constraint is "before hydrate", not "after materialize".

**Failure rule (D-18):** per-tip failures collect into one array; never `throw`. The warning state (D-19) is set once per open, before hydrate, so every mounted library surface renders the same line.

**Close/reset rule (D-20):** `closeProject` (lines 1163-1200) already resets every store in one `batch` and calls `physicPaintStore.reset(...)`; add the catalog reset + `resetMaskRegistry()` beside `resetEfxPaintStore()`. `createProject` (lines 896-900) calls `projectStore.closeProject()` first, so the reset is inherited — verify and pin it.

**Save rule:** `buildMceProject()` (lines 257-484) returns the `.mce` root object (version 16 at line 436). `brushPack` is emitted there (only when the project has custom entries), then flows through `savePackageWithTelemetry` (lines 236-255) → `savePackage` → `buildPackageManifest` passthrough.

**Import dirtiness (D-15):** `markDirty()` (lines 888-890) is the only dirty hook; import calls it directly — no history entry.

---

### Requirement #8 — per-id UI cache keying/invalidation (D-05's per-tip key)

#### `app/src/components/physic-paint/view/watercolorStrokeThumb.ts` (utility, transform) — MODIFY

**Analog:** itself. Two caches, both keyed by id today:

```typescript
const tipCache = new Map<string, HTMLCanvasElement>();          // line 34
const thumbCache = new Map<string, HTMLCanvasElement>();        // line 35

export function tipImage(b: Brush, hex: string): HTMLCanvasElement {
  const key = `${b.id}|${hex}`;                                 // line 39
  // ...
}

export function getStrokeThumb(presetId: string): HTMLCanvasElement {
  const cached = thumbCache.get(presetId);                      // line 162
  if (cached) return cached;
  const preset = BRUSH_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw new Error(`watercolorStrokeThumb: unknown preset id ${presetId}`);   // lines 165-167
  }
  const canvas = document.createElement('canvas');
  canvas.width = STROKE_THUMB_WIDTH;
  canvas.height = STROKE_THUMB_HEIGHT;
  strokeThumbPainter.drawStroke(canvas, buildBrush(preset), STROKE_THUMB_HEX);
  thumbCache.set(presetId, canvas);
  return canvas;
}
```

Rules for D-05:
- **Gotcha G-4:** `getStrokeThumb` hard-throws on an id not in `BRUSH_PRESETS`. A custom or builtin card would throw during render. The mask-backed path must resolve its brush through the SAME `buildBrushForStroke` call (never a second mapping) and must not go through `BRUSH_PRESETS.find`.
- Cache key must be **tip id + mask identity** (a digest or registry generation), not the bare id — two projects can reuse `wc/custom-xxxxxxxx`? No: ids are salted per import, but reopen replaces a mask under the same id, so key on `id|maskDigest`.
- Invalidation: extend `clearStrokeThumbCache()` (lines 203-206) — call it (or key-version it) on project open/close alongside the registry reset.
- Never `toDataURL`/`toBlob` (52.1 D-19; pinned at `WatercolorBrushLibrary.test.ts:473`).
- `WatercolorBrushThumb` (`WatercolorBrushLibrary.tsx:53-70`) is the mounted blit surface; `blitStrokeThumb` (lines 187-201) resizes the visible bitmap to the DPR-scaled cache before one `drawImage` — keep that contract for mask-backed cards.

**Peer analog for a per-(id, size) cache with a spyable painter:** `app/src/components/physic-paint/view/paperThumb.ts` lines 17-30 — `const thumbCache = new Map<string, HTMLCanvasElement>()`, `paperThumbPainter` seam, "paint once per (id, size)" doc law. Same idiom, different key.

---

### UI surface patterns (D-01 .. D-05, D-19)

#### `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx` (component) — MODIFY

**Analog:** itself + `BrushesDocker.tsx`'s import block.

**Current skeleton (lines 101-122)** — the grid iterates `BRUSH_PRESETS` only:

```typescript
export function WatercolorBrushLibrary() {
  // Narrow signal read (efx-preact-reactivity rule 5).
  const selectedTipId = aquarelleSelectedTipId.value;
  return (
    <div data-testid="watercolor-brush-library" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
      {BRUSH_PRESETS.map((preset) => (
        <BrushCard key={preset.id} preset={preset} selected={preset.id === selectedTipId} />
      ))}
    </div>
  );
}
```

**Card pattern (lines 72-99)** — the pick law to reuse unchanged for the two new sections:

```typescript
      onClick={() => {
        // 261029-eur WR-03, two-part law: leave Edit mode before the pick
        // flips the tool UNLESS a non-empty selection is armed ...
        if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false);
        void pickAquarelleBrush(preset.id);
      }}
```

**Import row pattern to port from `BrushesDocker.tsx` (lines 242-292)** — toolbar button + hidden input + busy signal; the failure line at lines 296-308 is the `IMPORT_TIP_FAILURE_COPY` idiom:

```typescript
        <button type="button" data-testid="brushes-import" title="Import brush tip (PNG/JPG)"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          style={{ width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1, color: 'var(--sidebar-text-primary, #eceff2)' }}>
          <FolderOpen size={16} />
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" data-testid="brushes-import-input"
          style={{ display: 'none' }} onChange={(event) => { void onImportFile(event); }} />
```

**Import handler (lines 201-222)** — the file→bytes→`importTip`→catalog/pick sequence; Phase 63 adds the mask assert + encode + asset write before the catalog append:

```typescript
  const onImportFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    importing.value = true;
    importFailure.value = false;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await importTip(bytes, file.name);
      if (result.ok) { customTips.value = [...customTips.value, result.tip]; void pickAquarelleBrush(result.tip.id); }
      else { importFailure.value = true; }
    } catch { importFailure.value = true; } finally { importing.value = false; }
  };
```

**Import caps (spec 02 §Fail-closed):** `file.size ≤ 64 MB` checked BEFORE `arrayBuffer()`, decoded pixel count ≤ 64 MP checked before any rasterization (`importTip.ts` already decodes once — do not add a second decode).

**Warning line (D-19):** one persistent aggregate line, inline, above/near the grid — copy the inline-styled `<span>` shape from `BrushesDocker.tsx:296-308` (fontSize 10, fontWeight 600, `var(--color-error-text, #FF6666)`), but aggregate: `"N brush tips unavailable in this project"`. Not the apply-message capsule, not the engine-status pill.

**Sections (D-03):** `BRUSH_PRESETS` first, then "Texture" (three `wc/builtin-*`), then "Custom" (project). The category label style already exists in `BrushesDocker.tsx:146-185` (`CategoryGroup`, `CATEGORY_LABELS`, count in the label). Do not add a filter or a search field.

**Module header must be rewritten** (lines 1-29 currently state "no import affordance, no wc/ size-variant rows"), and see G-1.

#### `app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` (test) — MODIFY (mandatory)

**Gotcha G-1 (blocking):** lines 389-401 pin the OPPOSITE of D-01:

```typescript
  it('has no category filter, search field, or import affordance', () => {
    const tree = renderLibrary();
    const inputs = [...walk(tree)].filter((n) => n.type === 'input');
    expect(inputs.length, 'no input elements').toBe(0);
    // ...
    const source = readFileSync(resolve(__dirname, 'WatercolorBrushLibrary.tsx'), 'utf8');
    expect(source, 'no search input in source').not.toMatch(/type="search"|type='search'|brushes-search/);
    expect(source, 'no file input in source').not.toMatch(/type="file"|type='file'/);
    expect(source, 'no category filter in source').not.toMatch(/category-filter|CATEGORY_FILTER/);
  });
```

The plan must rewrite this test to: "no category filter, no search field; exactly ONE file input for Import" (and keep the search/filter negatives). Also update the count assertion at line 327 (`cards.length === BRUSH_PRESETS.length`) to the sectioned catalog, and extend the paint-once pin (lines 464-477) to the new ids.

**Test harness idioms to reuse:** `materialize`/`walk`/`textContent` (lines 67-138), `resetSelection` (289-312) with `clearStrokeThumbCache()`, the `strokeThumbPainter` spy (464-477), and the DPR stub `withStubbedWindow` (269-283). Node env has no DOM — stub `globalThis.document.createElement`, never add jsdom.

#### `app/src/components/physic-paint/view/aquarelleRecordState.ts` (store) — MODIFY

**Gotcha G-5 (blocking):** the pick law refuses unknown ids today (lines 251-300):

```typescript
export function selectAquarelleTip(tipId: string | null): void {
  const tip = tipId ? findTip(tipId) : undefined;
  const preset = !tip && tipId ? BRUSH_PRESETS.find((b) => b.id === tipId) : undefined;
  const nextId = tip ? tip.id : preset ? preset.id : null;
  // A successful pick is a brush-tool variant pick — flip the tool first
  // so a re-pick of the already-selected id still returns to Brush.
  if (nextId !== null) setAquarelleTool('brush');
  const currentId = aquarelleSelectedTipId.value;
  if (currentId === nextId) return;
  // I-11: remember the outgoing brush's edits before loading the next one. ...
}

export function setAquarelleLiftTipId(tipId: string | null): void {
  const tip = tipId ? findTip(tipId) : undefined;
  const preset = !tip && tipId ? BRUSH_PRESETS.find((b) => b.id === tipId) : undefined;
  const nextId = tip ? tip.id : preset ? preset.id : null;
  if (aquarelleLiftTipId.value === nextId) return;
  aquarelleLiftTipId.value = nextId;
}
```

`wc/custom-*` and `wc/builtin-*` ids match neither `findTip` (14 `TIPS`) nor `BRUSH_PRESETS`, so they resolve to `null` and the card pick silently does nothing. The plan must extend `selectAquarelleTip` to also accept catalog ids (from the new catalog signal) — and MUST NOT extend `setAquarelleLiftTipId` (D-04: lift stays preset-only).

**Selection consumers to leave alone:** `aquarelleActiveTipId` (302-310), `aquarelleBrushForActiveTool` (319-333), `snapshotAquarelleRecord` (400-417, the `brushId` record law at ~418), `pickAquarelleBrush` (`aquarellePaintControls.ts:42-51`).

#### `app/src/components/physic-paint/view/BrushesDocker.tsx` (component, unmounted) — DO NOT MODIFY

Keep as the source of the import call shape and the `customTips`/`resetBrushesDockerUi` reference. Do not re-mount it, do not wire it to the new catalog (D-02), do not delete it in this phase.

#### `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` — reference only

The lift branch (lines 116-132) documents the preset-only law D-04 preserves:

```typescript
      {menuTarget === 'lift' ? (
        // 261029-hy2 menu-branch:lift
        // The Eraser popover: the shipped painted shapes ... A pick writes the lift tip
        // through setAquarelleLiftTipId — never the brush seam.
```

---

### Built-in compile-time tips (D-06 .. D-08)

#### `packages/efx-watercolor/src/brushes/builtinTips.ts` (NEW — config/constants)

**Analog A — generated constant module:** `packages/efx-watercolor/src/playground/spectralData.ts` lines 1-12:

```typescript
// Generated from spectral.js reflectance data (Ronald van Wijnen, MIT) by an offline fit.
// Do not edit by hand.
// ...
export const SPECTRAL_EPSILON = 1e-4;
export const PRIMARIES: readonly (readonly number[])[] = [[0.96853629,...]];
```

**Analog B — the frozen tip-record catalog:** `tips.ts` lines 76-96 and 195-198:

```typescript
function tip(id: string, category: AquarelleTipCategory, name: string, props: Partial<AquarelleToolOverrides>): AquarelleTip {
  return Object.freeze({ id, category, name, ...NEUTRAL_TOOL_OVERRIDES, ...props });
}

export const TIPS: readonly AquarelleTip[] = Object.freeze([...]);
export function findTip(tipId: string): AquarelleTip | undefined { return TIPS.find((t) => t.id === tipId); }
```

Rules:
- Each built-in = `{ id, category: 'texture', name, ...NEUTRAL_TOOL_OVERRIDES }` + a constant mask payload (base64 in source, decoded once at module init into `Uint8Array(192*192)`; a `new Uint8Array([...])` literal is ~4× larger in source and should be avoided).
- Header must record provenance + "do not edit by hand" + the exact one-off conversion (1024×1024 JPEG → high-quality downscale to 192 → contrast-stretch to 0-255 per D-08), i.e. `spectralData.ts`'s header idiom.
- Names/ids are fixed by D-07: `wc/builtin-bristle` "Bristle fan", `wc/builtin-chalk` "Chalk grain", `wc/builtin-sponge` "Sponge".
- Budget: three 192² masks. Raw 36,864 B each → base64 ≈ 49 KB each in source; encoded-WebP-in-source decoded at register time is far smaller but needs an async decode. Either way the 2 MB ceiling is pinned by `app/src/viteBuild.test.ts:155-158` (`chunkSizeWarningLimit` must resolve to exactly `2000`) and the warning assertion at line 239. Measure; do not raise the budget.
- The three JPEGs at `SPECS/v2.2.0-brush-tips/assets/` are PREREQUISITES, never runtime inputs, never bundled.

#### `packages/efx-watercolor/src/brushes/maskDerivation.ts` (NEW — pure transform)

**Analog:** the decode chain in `importTip.ts:91-136` (createImageBitmap → Image fallback) plus the alpha/luminance arithmetic style of `paperThumb.ts:44-62` (per-texel channel math over `ImageData.data`).

The two-branch law (TIP-03 as amended) belongs in ONE exported function used by BOTH `importTip` and the built-in bake (D-09):

```
deriveMask(rgba: Uint8ClampedArray, width, height): Uint8Array(TIP_SIZE²)
  any alpha < 250 → mask = alpha
  else            → meanLuma < 128 ? mask = luma : mask = 255 - luma
```

Module header must document both branches; both branches need tests (amended TIP-03). Normalization lives ONLY in the bake (D-08), never in `deriveMask`.

#### `packages/efx-watercolor/src/brushes/importTip.ts` (utility) — MODIFY

**Analog:** itself. Preserve four laws exactly.

**Magic sniff (lines 33-48, must not change — no TIF/EXR):**

```typescript
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const
const JPG_MAGIC = [0xff, 0xd8, 0xff] as const
function sniffImageKind(bytes: Uint8Array): 'png' | 'jpg' | null { ... }
```

**Result union + named copy (lines 24-31):**

```typescript
export type ImportTipResult =
  | { ok: true; tip: AquarelleTip }
  | { ok: false; reason: 'unreadable-image' }

export const IMPORT_TIP_FAILURE_COPY =
  'Import failed — this file is not a readable PNG or JPG. Nothing changed.'
```

**Where pixels are discarded today (lines 138-157)** — this is the phase's core edit:

```typescript
function makeCustomTip(fileName: string, bytes: Uint8Array): AquarelleTip {
  const multipliers: AquarelleToolOverrides = { ...NEUTRAL_TOOL_OVERRIDES }
  return Object.freeze({ id: freshCustomId(bytes), category: 'custom' as const, name: fileName, ...multipliers })
}

async function importTipNow(bytes: Uint8Array, fileName: string): Promise<ImportTipResult> {
  const kind = sniffImageKind(bytes)
  if (kind === null) return { ok: false, reason: 'unreadable-image' }
  const extent = await decodeImage(bytes)          // ← extent only; pixels dropped
  if (extent === null) return { ok: false, reason: 'unreadable-image' }
  return { ok: true, tip: makeCustomTip(fileName, bytes) }
}
```

Change: `decodeImage` must also return the rasterized `ImageData` (draw the decoded source into a `TIP_SIZE` canvas with `ctx.imageSmoothingQuality = 'high'`, `drawImage` → `getImageData(0,0,192,192)`), then `deriveMask(...)`. `ImportTipResult` gains `mask: Uint8Array` (a new variant or a widened ok member — planner's call, but keep it a total union). Existing named failure copy stays verbatim.

**Single-flight queue (lines 159-181) must be preserved verbatim** — one import at a time, chain survives a rejection:

```typescript
let importChain: Promise<unknown> = Promise.resolve()
export function importTip(bytes: Uint8Array, fileName: string): Promise<ImportTipResult> {
  const run = importChain.then(() => importTipNow(bytes, fileName), () => importTipNow(bytes, fileName))
  importChain = run.then(() => undefined, () => undefined)
  return run
}
```

**No-silent-dedupe law (lines 55-72)** stays: two imports of identical bytes → distinct ids; the content-addressed `brushes/<sha256>.webp` dedupes the FILE (D-16).

#### `packages/efx-watercolor/src/brushes/pack.ts` (validator) — MODIFY

**Analog:** itself; this is the one entry-shape authority (TIP-15).

```typescript
export const BRUSH_PACK_KIND = 'efx-watercolor'                 // line 22
function isTipRecord(v: unknown): v is AquarelleTip {           // lines 36-46
  if (typeof v !== 'object' || v === null) return false
  const rec = v as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.name !== 'string' || rec.name.length === 0) return false
  if (typeof rec.category !== 'string' || !CATEGORIES.has(rec.category)) return false
  for (const field of TOOL_OVERRIDE_FIELDS) { if (!isFiniteNumber(rec[field])) return false }
  return true
}
export function buildBrushPackSnapshot(tips: readonly AquarelleTip[]): BrushPackSnapshot | null { /* dup-id fail-closed */ }
export function parseBrushPackSnapshot(raw: unknown): BrushPackSnapshot | null { /* kind + entries + dup-id */ }
export function asTipRecord(entry: unknown): AquarelleTip | null { return isTipRecord(entry) ? { ...entry } : null }
```

Rules for carrying the asset ref through (D-15): validate it as an optional member — a `string` matching `brushes/<64-hex>.webp` and `isSafePackageRelativePath`; a present-but-malformed ref returns `null` (whole-snapshot refusal, matching the existing all-or-nothing style), an absent ref is legal (built-ins carry none). Keep `entries.push({ ...tip })` so the field round-trips untouched.

**Gotcha G-6:** spec 01's hard exclusion ("`isTipRecord` and the snapshot builder must still reject a mask field explicitly") is superseded by D-10/D-11 — entries carry an ASSET REF, never a mask. A test should pin that an inline `mask` member is still refused, and that `asset` is accepted only in the `brushes/<64hex>.webp` shape.

#### `packages/efx-watercolor/src/brushes/index.ts` (barrel) — MODIFY

```typescript
export * from './tips'
export * from './pack'
export * from './importTip'
```

Add the two new modules. `packages/efx-watercolor/src/index.ts` already re-exports `./brushes`; `package.json` exports map has the `./brushes` subpath (`dist/brushes.*`) — no exports-map edit needed.

---

### Encoder seam (D-11: higher-effort profile, encode once, copy bytes on save)

#### `app/src-tauri/src/services/frame_codec.rs` (service, transform) — MODIFY

**Analog:** `WebPLosslessCodec::encode_rgba` (lines 29-67). The frame hot path's settings are documented with measurements — the mask profile is a SEPARATE, explicitly-justified constant set:

```rust
impl FrameCodec for WebPLosslessCodec {
    fn encode_rgba(&self, rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
        let mut config = webp::WebPConfig::new().map_err(|_| "failed to init WebP config".to_string())?;
        config.lossless = 1;
        // config_exact: preserve RGB under fully-transparent pixels (D-01).
        // `encode_lossless()` does NOT set `exact`, so we must use `encode_advanced`.
        config.exact = 1;
        config.alpha_compression = 0;
        // 261029-bks A/B (release, 1080×1920 noisy RGBA): lossless `quality`
        // and `method` trade compression EFFORT for file size ...
        config.quality = 50.0;
        config.method = 0;
        let encoder = webp::Encoder::from_rgba(rgba, width, height);
        let bytes = encode(&config)?;
        if bytes.len() < TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR { config.method = 1; return encode(&config); }
        Ok(bytes)
    }
}
```

Rules:
- Add `pub fn encode_mask_webp(rgba: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String>` (or a `WebPMaskCodec`) that sets `lossless = 1`, `exact = 1` and a HIGHER `method`/`quality` — with a comment stating "encoded exactly once at import; never on the save path" so nobody copies the hot-path numbers.
- `decode_rgba` (lines 69-90) is reused unchanged for the open leg.
- Save never re-encodes (D-11): the stored bytes are the bytes copied into the new package; `write_atomically` copies, it does not transcode.
- Keep the `TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR` guard in mind for masks too — a uniform mask is exactly the kind of content that produces the Apple-rejected ~34-byte stream (lines 18-27, 168-200).

#### `app/src-tauri/src/commands/image.rs` — DO NOT COPY

```rust
#[command]
pub async fn import_images(app: tauri::AppHandle, paths: Vec<String>, project_dir: String) -> Result<ImportResult, String> {
    let scope = app.asset_protocol_scope();
    let _ = scope.allow_directory(&canonical, true);
    let result = tauri::async_runtime::spawn_blocking(move || { /* image_pool::process_image copies + thumbs */ })
```

This is the pattern the brush import MUST NOT follow: it copies the source image into the project dir and hands out an asset-protocol scope. Phase 63 stores only the derived mask, never the source, and the renderer never reads a tip path.

#### `app/src-tauri/src/lib.rs` — MODIFY

Register every new command in the `invoke_handler` list (lines 927-1004, `tauri::generate_handler![...]`). Existing neighbors to keep: `efx_paint_media_commands::efx_paint_write_frame_media`, `…::efx_paint_read_frame_media`, `frame_codec_commands::encode_webp_frame`, `…::decode_webp_frame`, `script_library::script_library_encode_thumbnail_webp`.

---

### Open-leg orchestration module (D-17/D-18, one call, per-tip degrade)

#### `app/src/lib/efxPaintBrushMasks.ts` (NEW — service, batch)

**Analog A:** `app/src/lib/efxPaintMediaMaterialize.ts` — the exact "read a whole set before hydrate, collect failures, never throw" shape (lines 1-24 header, 40-59 result types, 121-177 driver):

```typescript
export interface FrameMediaMaterializeResult {
  readonly runtimeDocuments: ReadonlyMap<string, EfxPaintDocument>;
  readonly failures: readonly FrameMediaMaterializeFailure[];
  readonly materializedKeys: number;
}
// ...
export async function materializePackageRotoMediaBytes(
  loadedDocuments: ReadonlyMap<string, EfxPaintLoadedDocument>,
  packageDir: string,
): Promise<FrameMediaMaterializeResult> { /* per-record: resolve → push failure OR install bytes */ }
```

**Analog B:** `app/src/lib/efxPaintMediaRead.ts:75-93` — digest-verified bytes resolution:

```typescript
export async function resolveFrameMediaBytes(packageDir: string, reference: FrameMediaReference): Promise<FrameMediaBytesResolution> {
  const result = await ipcEfxPaintReadFrameMedia(packageDir, reference.relativePath);
  if (!result.ok) {
    if (result.error.kind === 'missing') return { kind: 'missing' };
    return { kind: 'refused', reason: result.error.kind === 'refused' ? result.error.rejection : 'io' };
  }
  if (result.data.digest !== reference.digest) return { kind: 'refused', reason: 'digest-mismatch' };
  return { kind: 'bytes', bytes: result.data.bytes };
}
```

Required functions (names planner's choice):
- `encodeBrushMask(mask: Uint8Array): Promise<{ bytes: Uint8Array; digest: string }>` — RGBA where RGB is constant and A = mask, then the Rust higher-effort encoder; digest computed in Rust (never `crypto.subtle` — WKWebView, see `efx_paint_media.rs:14-17`).
- `stageBrushAsset(...)` — writes into the save staging root with `stagingBasename`.
- `loadBrushSet(packageDir, entries)` — ONE IPC call, returns decoded RGBA per id (or per-id failure), maps RGBA alpha → `Uint8Array(192*192)`, rejects wrong length, then calls `replaceMaskRegistry(...)`.
- `collectBrushPackEntries(catalog)` — builds the `{ kind, entries }` payload from the project catalog without the built-ins (they are never written, D-06/§Scope 5).

---

## Shared Patterns

### Authentication / authorization
Not applicable — no network surface in this phase.

### Fail-closed total parsers (apply to every new parser)
**Sources:** `packages/efx-watercolor/src/brushes/pack.ts:73-93`, `app/src/lib/efxPaintPackage.ts:167-196`, `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:476-489`, `app/src-tauri/src/services/efx_paint_media.rs:44-74`.
Rule: return `null` / a typed label / a discriminated union member — never throw into the UI, never silently overwrite, never partially accept. Rust rejections serialize as one fixed label string (`Serialize` impls at lines 76-80 and 116-120), and the TS normalizer degrades any unknown label to `io`.

### Error / failure taxonomy (apply to all media + mask IO)
**Sources:** `app/src/lib/ipc.ts:562-597` (`missing` / `refused{rejection}` / `io`), `efxPaintMediaMaterialize.ts:40-49` (`'missing' | 'no-package-root' | FrameMediaRefusalReason`).
Rule: `missing` is a product state (slate / unavailable tip with warning), `refused` is a rule violation, `io` is everything else. Never collapse them.

### Preact signal discipline (apply to every new UI module)
**Sources:** `WatercolorBrushLibrary.tsx:102-103`, `aquarelleRecordState.ts:111-144`, `BrushesDocker.tsx:40-66`, `PhysicsPaintBrushModal.tsx:47-53`.
Rule: `signal()` at module scope, exported setters, compare-then-write idempotency, one narrow `.value` read per component render, no writes in the render body, no `useState`, never `useEffect` for selection (apply in the click handler). Follow `efx-preact-reactivity`.

### Dual-language `.mce` declaration
**Sources:** `app/src/types/project.ts:12-63`, `app/src-tauri/src/models/project.rs:16-63`, `app/src/lib/mceFieldContract.test.ts:126-199`.
Rule: same key on both sides in the same change set, snake_case Rust + `#[serde(rename)]` for camelCase wires, `#[serde(default, skip_serializing_if = ...)]` for optional members, and a named row added to the contract test.

### Atomic package writes
**Sources:** `efx_paint_media.rs:601-626` (`write_atomically`), `project_io.rs:44-98` (`save_project` temp+rename+fsync), `efx_paint_media.rs:263-304` (staging root derived in Rust).
Rule: renderer never supplies a destination root; only staged names are bound; publish/settle own canonicalization.

### Test seams
**Sources:** `strokeThumbPainter` (`watercolorStrokeThumb.ts:150-154`) + `clearStrokeThumbCache` (203-206); `paperThumbPainter`; `WatercolorBrushLibrary.test.ts` materialize/walk harness (67-138); the `UnsupportedPackagePath`/`wrongExtension` label lists in `ipc.ts:572-578`.
Rule: new caches get a named clear/reset export and a spyable paint seam so a pin can assert one invocation per key.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `packages/efx-watercolor/src/brushes/builtinTips.ts` (mask payload half) | config | — | No compile-time binary asset constant exists in the package; `spectralData.ts` is the closest precedent (numeric table, 7 KB), so the mask-embedding + one-time decode shape is new. Planner decides base64-in-source vs encoded-WebP decoded at register. |
| `app/src-tauri/src/commands/brush_codec.rs` (batch decode) | controller | request-response (batch) | No existing Rust command decodes a SET in one call. Compose `decode_webp_frame` (single-image decode + base64) with `BoundPackageFileSet.entries` (list-of-structs result). |
| `app/src/lib/efxPaintBrushMasks.ts` (import→encode→stage leg) | service | file-I/O + transform | No existing renderer module encodes a derived artifact and stages it as a content-addressed package asset. Its read half mirrors `efxPaintMediaMaterialize`; its write half mirrors `writeKeyMedia`/`stagedPaths` inside `efxPaintPersistence.ts`. |

## Gotchas the Planner Must Carry Into PLAN.md

- **G-1** `WatercolorBrushLibrary.test.ts:389-401` pins "no import affordance / no file input" — D-01 makes that test the opposite of required behavior. It MUST be amended in the same plan as the Import row, or the phase lands red.
- **G-2** `aquarelleFootprint.ts:60-84` caches one `Brush` by `${tipId}|${overrides}`; a replaced mask under the same id yields a stale cursor footprint. Include a registry generation in the signature.
- **G-3** `buildBrush` accepts any perfect-square `Uint8Array`; validate `length === 192*192` before build, or a 128² asset silently becomes a "valid" tip (D-18 requires wrong-size → unavailable).
- **G-4** `getStrokeThumb` throws on an id absent from `BRUSH_PRESETS`; mask-backed cards must resolve through `buildBrushForStroke`, not a preset lookup.
- **G-5** `selectAquarelleTip` / `setAquarelleLiftTipId` resolve only `findTip(TIPS)` and `BRUSH_PRESETS`; custom/builtin card picks currently no-op. Extend the brush pick only (lift stays preset-only, D-04).
- **G-6** Spec 01 says "must reject a mask field"; D-10/D-11 supersede it — entries carry a package-relative asset ref. Pin the inline `mask` refusal anyway, so the superseded shape cannot creep back.
- **G-7** `mceFieldContract.test.ts:401-407` snapshots `ALLOWED_ONE_LANGUAGE` literally; do not add a `brushPack` exception.
- **G-8** `create_project_dir` (`project_io.rs:12-46`) provisions `layers/` and `frames/`; decide explicitly whether `brushes/` joins it (writes create parents, so it is optional — but a New Project with three built-ins should not need a `brushes/` tree at all).
- **G-9** Chunk budget: `app/src/viteBuild.test.ts:155-158` pins `chunkSizeWarningLimit === 2000` and line 239 fails on any warning. Three 192² masks must be measured, not assumed.
- **G-10** Digests are computed in Rust (`efx_paint_media.rs:240-243`); `crypto.subtle` is unresolved under WKWebView. Never hash in the renderer for the content address.

## Metadata

**Analog search scope:** `packages/efx-watercolor/src/{brushes,playground,adapter}`, `packages/efx-paint-host/src/script`, `app/src/{types,lib,stores}`, `app/src/components/physic-paint/{view,engine,roto}`, `app/src-tauri/src/{models,services,commands}`, `SPECS/v2.2.0-brush-tips`.
**Files scanned:** 60+ (33 read in full or targeted; 33 git-tracked analog paths verified).
**Pattern extraction date:** 2026-11-15.
**Build/verify:** `vitest run` only (never watch); build from `packages/efx-watercolor/src/`, never `dist/`; do not start the server; no new runtime dependencies.

*Phase: 63-Brush Tip Pipeline*
