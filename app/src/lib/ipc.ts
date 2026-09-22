import { invoke } from '@tauri-apps/api/core';
import { base64ToBytes } from './webpBytes';
import type { ProjectData, MceProject } from '../types/project';
import type { ImageInfo, ImportResult } from '../types/image';
import type { PersistedRotoScriptV1 } from '../components/physic-paint/roto/physicsPaintRotoScriptSchema';
import {
  isPhysicPaintActionTransactionResult,
  type PhysicPaintActionHistoryReleaseRequest,
  type PhysicPaintActionTransactionAcknowledgeRequest,
  type PhysicPaintActionTransactionFailure,
  type PhysicPaintActionTransactionPrepareRequest,
  type PhysicPaintActionTransactionResult,
  type PhysicPaintScriptLibraryResult,
} from '../types/physicPaint';

// Result type mirroring Rust's Result pattern (locked decision)
export type Result<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };

// Central safe invoke wrapper
export async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result<T>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Custom protocol URL conversion — bypasses Tauri asset scope restrictions
// that fail on macOS paths with accented characters (NFC/NFD mismatch).
export function assetUrl(filePath: string, bustKey?: string): string {
  const encoded = encodeURIComponent(filePath)
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':');
  const bust = bustKey ? `?v=${bustKey}` : '';
  return `efxasset://localhost${encoded}${bust}`;
}

// --- Project commands ---
export async function projectGetDefault(): Promise<Result<ProjectData>> {
  return safeInvoke<ProjectData>('project_get_default');
}

export async function projectCreate(name: string, fps: number, dirPath: string, width: number, height: number): Promise<Result<MceProject>> {
  return safeInvoke<MceProject>('project_create', { name, fps, dirPath, width, height });
}

/**
 * Write the manifest to the path it is handed. 52.2-05 Task 2 (D-10) removed
 * the project write's cache binding, so no cache transaction id crosses this
 * wrapper at all (52.2-09: the accepted-but-not-forwarded trailing parameter is
 * deleted, not shimmed).
 */
export async function projectSave(
  project: MceProject,
  filePath: string,
): Promise<Result<null>> {
  return safeInvoke<null>('project_save', { project, filePath });
}

/** The Save-As leg of `projectSave`: same arity, same package-only payload. */
export async function projectSaveAsWithScriptLibrary(
  project: MceProject,
  sourceFilePath: string,
  destinationFilePath: string,
): Promise<Result<ScriptLibraryMigrationResult>> {
  return safeInvoke('project_save_as_with_script_library', {
    project,
    sourceFilePath,
    destinationFilePath,
  });
}

export async function projectOpen(filePath: string): Promise<Result<MceProject>> {
  return safeInvoke<MceProject>('project_open', { filePath });
}

export async function projectMigrateTempImages(tempDir: string, projectDir: string): Promise<Result<string[]>> {
  return safeInvoke<string[]>('project_migrate_temp_images', { tempDir, projectDir });
}

export interface ScriptLibraryMigrationResult {
  copied: number;
  deduplicated: number;
  remapped: number;
  skippedInvalid: number;
  diagnostics: Array<{ code: string; message: string; filename?: string }>;
}

export function scriptLibraryBindSavedProject(filePath: string): Promise<Result<string>> {
  return safeInvoke<string>('script_library_bind_saved_project', { filePath });
}
export function scriptLibraryClearActiveProject(): Promise<Result<null>> {
  return safeInvoke<null>('script_library_clear_active_project');
}
export function scriptLibraryScan(authority: string): Promise<Result<Omit<PhysicPaintScriptLibraryResult, 'operationId' | 'kind' | 'ok'>>> {
  return safeInvoke('script_library_scan', { authority });
}
export function scriptLibraryLoad(authority: string, scriptId: string) {
  return safeInvoke<{ scan: Omit<PhysicPaintScriptLibraryResult, 'operationId' | 'kind' | 'ok'>; script: PersistedRotoScriptV1 }>('script_library_load', { authority, scriptId });
}
export function scriptLibrarySave(authority: string, script: PersistedRotoScriptV1) {
  return safeInvoke<{ scan: Omit<PhysicPaintScriptLibraryResult, 'operationId' | 'kind' | 'ok'>; script: PersistedRotoScriptV1 }>('script_library_save', { authority, script });
}
export function scriptLibraryRename(authority: string, scriptId: string, expectedRevision: string, name: string) {
  return safeInvoke<{ scan: Omit<PhysicPaintScriptLibraryResult, 'operationId' | 'kind' | 'ok'>; script: PersistedRotoScriptV1 }>('script_library_rename', { authority, scriptId, expectedRevision, name });
}
export function scriptLibraryDelete(authority: string, scriptId: string, expectedRevision: string) {
  return safeInvoke<{ scan: Omit<PhysicPaintScriptLibraryResult, 'operationId' | 'kind' | 'ok'>; script?: PersistedRotoScriptV1 }>('script_library_delete', { authority, scriptId, expectedRevision });
}
export function scriptLibraryMigrateSavedProjects(sourceFilePath: string, destinationFilePath: string): Promise<Result<ScriptLibraryMigrationResult>> {
  return safeInvoke('script_library_migrate_saved_projects', { sourceFilePath, destinationFilePath });
}

function actionTransactionFailure(
  code: PhysicPaintActionTransactionFailure['code'],
  error: string,
): PhysicPaintActionTransactionFailure {
  return { state: 'failed', code, error };
}

function isActiveRecoveryError(error: string): boolean {
  const normalized = error.toLowerCase();
  return normalized.includes('recovery')
    && (normalized.includes('already required') || normalized.includes('while recovery is active'));
}

async function invokeClosedActionTransaction(
  command: string,
  args: Record<string, unknown>,
): Promise<PhysicPaintActionTransactionResult> {
  const invoked = await safeInvoke<unknown>(command, args);
  if (!invoked.ok) {
    return actionTransactionFailure(
      isActiveRecoveryError(invoked.error) ? 'active-recovery-blocked' : 'invoke-failed',
      invoked.error,
    );
  }
  if (!isPhysicPaintActionTransactionResult(invoked.data)) {
    return actionTransactionFailure('malformed-response', `Malformed ${command} response`);
  }
  return invoked.data;
}

function matchesTransactionIdentity(
  result: PhysicPaintActionTransactionResult,
  expected: PhysicPaintActionTransactionPrepareRequest,
): boolean {
  if (result.state === 'failed') return true;
  if (result.state === 'recovered-prepared') return result.token === expected.token;
  if (result.state === 'released' || result.state === 'retained') return false;
  if (result.state === 'cleanup-pending' && !('token' in result)) return false;
  if ('token' in result) {
    if (result.token !== expected.token) return false;
    if ('commandId' in result && result.commandId !== expected.commandId) return false;
    if ('generation' in result && result.generation !== expected.generation) return false;
    if ('operationId' in result && result.operationId !== expected.operationId) return false;
    if ('leaseToken' in result && result.leaseToken !== expected.leaseToken) return false;
    if ('direction' in result && result.direction !== expected.direction) return false;
  }
  if (result.state === 'prepared' || result.state === 'committed' || result.state === 'recovery-required') {
    return result.mode === expected.mode
      && result.authority.projectContextId === expected.authority.projectContextId
      && result.authority.layerId === expected.authority.layerId
      && result.authority.launchOperationId === expected.authority.launchOperationId
      && result.authority.actionId === expected.authority.actionId
      && result.retainedArtifact.commandId === expected.retainedArtifact.commandId
      && result.retainedArtifact.generation === expected.retainedArtifact.generation
      && result.target.physicalRevision === expected.target.physicalRevision
      && result.target.physicalHash === expected.target.physicalHash;
  }
  return true;
}

function matchesAcknowledgeIdentity(
  result: PhysicPaintActionTransactionResult,
  expected: PhysicPaintActionTransactionAcknowledgeRequest,
): boolean {
  return result.state === 'failed'
    || ((result.state === 'acknowledged' || result.state === 'cleanup-pending')
      && 'token' in result
      && result.token === expected.token
      && result.commandId === expected.commandId
      && result.generation === expected.generation
      && result.operationId === expected.operationId
      && result.leaseToken === expected.leaseToken
      && result.direction === expected.direction);
}

function matchesReleaseIdentity(
  result: PhysicPaintActionTransactionResult,
  expected: PhysicPaintActionHistoryReleaseRequest,
): boolean {
  return result.state === 'failed'
    || ((result.state === 'released' || result.state === 'cleanup-pending')
      && 'projectContextId' in result
      && result.projectContextId === expected.projectContextId
      && result.launchOperationId === expected.launchOperationId
      && result.commandId === expected.commandId
      && result.generation === expected.generation
      && result.reason === expected.reason);
}

function correlatedResult(
  result: PhysicPaintActionTransactionResult,
  matches: boolean,
): PhysicPaintActionTransactionResult {
  return matches
    ? result
    : actionTransactionFailure('correlation-mismatch', 'Action transaction response identity does not match the request');
}

export async function scriptLibraryPrepareActionTransaction(
  authority: string,
  request: PhysicPaintActionTransactionPrepareRequest,
): Promise<PhysicPaintActionTransactionResult> {
  const result = await invokeClosedActionTransaction('script_library_prepare_action_transaction', { authority, request });
  if (result.state !== 'prepared' && result.state !== 'failed') {
    return actionTransactionFailure('malformed-response', 'Prepare command returned an invalid transaction state');
  }
  return correlatedResult(result, matchesTransactionIdentity(result, request));
}

async function invokeActionTransactionTokenCommand(
  command: string,
  authority: string,
  expected: PhysicPaintActionTransactionPrepareRequest,
): Promise<PhysicPaintActionTransactionResult> {
  const result = await invokeClosedActionTransaction(command, {
    authority,
    request: { token: expected.token },
  });
  return correlatedResult(result, matchesTransactionIdentity(result, expected));
}

export async function scriptLibraryDiscoverActionTransaction(
  authority: string,
): Promise<PhysicPaintActionTransactionResult | null> {
  const invoked = await safeInvoke<unknown>('script_library_discover_action_transaction', { authority });
  if (!invoked.ok) return actionTransactionFailure('invoke-failed', invoked.error);
  if (invoked.data === null) return null;
  if (!isPhysicPaintActionTransactionResult(invoked.data)
    || (invoked.data.state !== 'prepared' && invoked.data.state !== 'committed')) {
    return actionTransactionFailure('malformed-response', 'Discover command returned an invalid transaction state');
  }
  return invoked.data;
}

export async function scriptLibraryCommitActionTransaction(
  authority: string,
  expected: PhysicPaintActionTransactionPrepareRequest,
): Promise<PhysicPaintActionTransactionResult> {
  const result = await invokeActionTransactionTokenCommand(
    'script_library_commit_action_transaction', authority, expected,
  );
  return result.state === 'committed' || result.state === 'failed'
    ? result
    : actionTransactionFailure('malformed-response', 'Commit command returned an invalid transaction state');
}

export function scriptLibraryActionTransactionStatus(
  authority: string,
  expected: PhysicPaintActionTransactionPrepareRequest,
): Promise<PhysicPaintActionTransactionResult> {
  return invokeActionTransactionTokenCommand(
    'script_library_action_transaction_status', authority, expected,
  );
}

export async function scriptLibraryRecoverActionTransaction(
  authority: string,
  expected: PhysicPaintActionTransactionPrepareRequest,
): Promise<PhysicPaintActionTransactionResult> {
  const result = await invokeActionTransactionTokenCommand(
    'script_library_recover_action_transaction', authority, expected,
  );
  return result.state === 'recovery-required' || result.state === 'recovered-prepared' || result.state === 'failed'
    ? result
    : actionTransactionFailure('malformed-response', 'Recover command returned an invalid transaction state');
}

export async function scriptLibraryAcknowledgeActionTransaction(
  authority: string,
  request: PhysicPaintActionTransactionAcknowledgeRequest,
): Promise<PhysicPaintActionTransactionResult> {
  const result = await invokeClosedActionTransaction(
    'script_library_acknowledge_action_transaction', { authority, request },
  );
  if (result.state !== 'acknowledged' && result.state !== 'failed') {
    return actionTransactionFailure('malformed-response', 'Acknowledge command returned an invalid transaction state');
  }
  return correlatedResult(result, matchesAcknowledgeIdentity(result, request));
}

export async function scriptLibraryReleaseActionHistory(
  authority: string,
  request: PhysicPaintActionHistoryReleaseRequest,
): Promise<PhysicPaintActionTransactionResult> {
  const result = await invokeClosedActionTransaction(
    'script_library_release_action_history', { authority, request },
  );
  if (result.state !== 'released' && result.state !== 'failed') {
    return actionTransactionFailure('malformed-response', 'Release command returned an invalid transaction state');
  }
  return correlatedResult(result, matchesReleaseIdentity(result, request));
}

// --- Path utilities ---
export async function pathExists(filePath: string): Promise<Result<boolean>> {
  return safeInvoke<boolean>('path_exists', { filePath });
}

// --- Machine-local derived-frame cache (52.2-05 Task 2/3, D-05/D-14) ------
//
// Every wrapper here addresses the MACHINE cache root
// (`<app_data_dir>/frame-cache/<projectId>`), never a package directory. The
// leg is BEST-EFFORT: a cache-side failure arrives as `accepted: false` plus a
// `diagnostic` and never as a rejected promise, so no cache error can fail or
// roll back an authoritative save.

/**
 * The cache-side outcome. `accepted: false` is a typed SOFT failure (D-14):
 * non-fatal, always accompanied by a `diagnostic`, never a raised error.
 */
export interface PhysicPaintCachePublicationResult {
  accepted: boolean;
  transactionId: string;
  replacedExisting: boolean;
  diagnostic?: string;
}

export interface PhysicPaintCacheSettlementResult {
  accepted: boolean;
  cleanupStatus: 'complete' | 'deferred';
  cleanupDiagnostic?: string;
}

/** Resolve `<app_data_dir>/frame-cache/<projectId>`; the ONLY cache-root constructor. */
export function resolvePhysicPaintCacheRoot(projectId: string): Promise<Result<string>> {
  return safeInvoke<string>('resolve_physic_paint_cache_root', { projectId });
}

export function publishPhysicPaintCacheGeneration(
  cacheRoot: string,
  stagingBasename: string,
): Promise<Result<PhysicPaintCachePublicationResult>> {
  return safeInvoke<PhysicPaintCachePublicationResult>(
    'publish_physic_paint_cache_generation',
    { cacheRoot, stagingBasename },
  );
}

export function settlePhysicPaintCacheGeneration(
  cacheRoot: string,
  transactionId: string,
  action: 'commit' | 'rollback',
): Promise<Result<PhysicPaintCacheSettlementResult>> {
  return safeInvoke<PhysicPaintCacheSettlementResult>(
    'settle_physic_paint_cache_generation',
    { cacheRoot, transactionId, action },
  );
}

export interface PhysicPaintCacheHardlinkResult {
  accepted: boolean;
  /** Relative frame paths whose canonical sidecar was missing and must be written fresh. */
  missing: string[];
  diagnostic?: string;
}

export function hardlinkPhysicPaintCacheFrames(
  cacheRoot: string,
  stagingBasename: string,
  unchangedPaths: string[],
): Promise<Result<PhysicPaintCacheHardlinkResult>> {
  return safeInvoke<PhysicPaintCacheHardlinkResult>(
    'hardlink_physic_paint_cache_frames',
    { cacheRoot, stagingBasename, unchangedPaths },
  );
}

/**
 * The cache staging lifecycle (quick-260913-05k). The renderer used to drive
 * the fs plugin on `<cache root>/.efx-paint-staging-<uuid>`; the live build
 * refused `allow-mkdir` there even though the path sits under the appdata
 * root, so the staging legs run as app commands too. Prepare and stage answer
 * with the same typed soft failure as publish/settle/hardlink (D-14).
 */
export interface PhysicPaintCacheStagingResult {
  accepted: boolean;
  diagnostic?: string;
}

export function preparePhysicPaintCacheGeneration(
  cacheRoot: string,
  stagingBasename: string,
): Promise<Result<PhysicPaintCacheStagingResult>> {
  return safeInvoke<PhysicPaintCacheStagingResult>('prepare_physic_paint_cache_generation', {
    cacheRoot,
    stagingBasename,
  });
}

/**
 * Write one derived-frame sidecar into the staging generation. The bytes
 * cross as the raw invoke body with the scalars in headers, mirroring
 * `ipcEfxPaintWriteFrameMedia` — never a JSON number array.
 */
export async function stagePhysicPaintCacheFrame(
  cacheRoot: string,
  stagingBasename: string,
  relativePath: string,
  bytes: Uint8Array,
): Promise<Result<PhysicPaintCacheStagingResult>> {
  try {
    const data = await invoke<PhysicPaintCacheStagingResult>(
      'stage_physic_paint_cache_frame',
      bytes,
      { headers: { cacheRoot, stagingBasename, relativePath } },
    );
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Discard one cache staging generation left behind by a failed save.
 * Best-effort cleanup: the caller ignores a non-ok result exactly as the
 * previous plugin-fs removal was swallowed.
 */
export function discardPhysicPaintCacheStaging(
  cacheRoot: string,
  stagingBasename: string,
): Promise<Result<null>> {
  return safeInvoke<null>('discard_physic_paint_cache_staging', { cacheRoot, stagingBasename });
}

/**
 * Remove one machine-relative entry under the canonical `efx-paint/`
 * generation at commit time (track deletions; the empty-documents canonical
 * removal). Non-authoritative cleanup: the caller records a failure and
 * commits regardless.
 */
export function removePhysicPaintCacheEntry(
  cacheRoot: string,
  relative: string,
): Promise<Result<null>> {
  return safeInvoke<null>('remove_physic_paint_cache_entry', { cacheRoot, relative });
}

// --- Authoritative package transaction (52.2-05 Task 2/3, D-10) -----------
//
// The wrapper surface mirrors the native commands one-for-one. Each call takes
// the PACKAGE root plus the staging basename; the staging root itself is
// derived in Rust from the two (T-52.2-14), so the renderer never supplies a
// destination root.

/** One bound file as the renderer reads it (camelCase wire shape). */
export interface BoundEfxPaintPackageFile {
  path: string;
  sha256: string;
  hadOriginal: boolean;
}

/** Bind result: one transaction identity plus one order-independent aggregate digest. */
export interface BoundEfxPaintPackageFileSet {
  transactionId: string;
  aggregateDigest: string;
  entries: BoundEfxPaintPackageFile[];
}

export function bindEfxPaintPackageTransaction(
  packageRoot: string,
  stagingBasename: string,
  paths: string[],
): Promise<Result<BoundEfxPaintPackageFileSet>> {
  return safeInvoke<BoundEfxPaintPackageFileSet>('bind_efx_paint_package_transaction', {
    packageRoot,
    stagingBasename,
    paths,
  });
}

export interface EfxPaintPackagePublicationResult {
  transactionId: string;
  published: number;
}

export function publishEfxPaintPackageTransaction(
  packageRoot: string,
  transactionId: string,
): Promise<Result<EfxPaintPackagePublicationResult>> {
  return safeInvoke<EfxPaintPackagePublicationResult>('publish_efx_paint_package_transaction', {
    packageRoot,
    transactionId,
  });
}

export interface EfxPaintPackageSettlementResult {
  cleanupDeferred: boolean;
  cleanupDiagnostic?: string;
}

export function settleEfxPaintPackageTransaction(
  packageRoot: string,
  transactionId: string,
  action: 'commit' | 'rollback',
): Promise<Result<EfxPaintPackageSettlementResult>> {
  return safeInvoke<EfxPaintPackageSettlementResult>('settle_efx_paint_package_transaction', {
    packageRoot,
    transactionId,
    action,
  });
}

export interface EfxPaintPackageRecoveryResult {
  recovered: boolean;
  cleanupDeferred: boolean;
  cleanupDiagnostic?: string;
}

export function recoverEfxPaintPackageTransaction(
  packageRoot: string,
): Promise<Result<EfxPaintPackageRecoveryResult>> {
  return safeInvoke<EfxPaintPackageRecoveryResult>('recover_efx_paint_package_transaction', {
    packageRoot,
  });
}

// --- Package frame media commands (52.2-01, D-02/D-07/D-13) ---

export interface EfxPaintFrameMediaWriteResult {
  relativePath: string;
  digest: string;
  byteLength: number;
}

export interface EfxPaintFrameMediaReadResult {
  bytes: Uint8Array;
  digest: string;
}

/**
 * The Rust `EfxPaintMediaRejection` labels, verbatim (T-52.2-03). Rust variant
 * → wire label: `PathEscape` → `pathEscape`, `UnsafeId` → `unsafeId`,
 * `WrongExtension` → `wrongExtension`, `NotARegularFile` → `notARegularFile`,
 * `UnsupportedPackagePath` → `unsupportedPackagePath` (and `Missing` →
 * `missing`, carried by the `EfxPaintMediaFailure` union below).
 */
export type EfxPaintMediaRejectionLabel =
  | 'pathEscape'
  | 'unsafeId'
  | 'wrongExtension'
  | 'notARegularFile'
  | 'unsupportedPackagePath';

/**
 * Typed frame-media failure. D-13 gives the classes different product
 * behavior, so they are never collapsed: `missing` is the Phase 49 slate
 * path, `refused` fails closed, and `io` covers every other failure.
 */
export type EfxPaintMediaFailure =
  | { kind: 'missing' }
  | { kind: 'refused'; rejection: EfxPaintMediaRejectionLabel }
  | { kind: 'io' };

const EFX_PAINT_MEDIA_REJECTION_LABELS: readonly EfxPaintMediaRejectionLabel[] = [
  'pathEscape',
  'unsafeId',
  'wrongExtension',
  'notARegularFile',
  'unsupportedPackagePath',
];

/**
 * Normalize a Rust error payload into the failure taxonomy. The Rust error
 * serializes for the wire as one fixed label string, so anything else (an
 * object payload, a thrown Error, an unknown label) degrades to `io` rather
 * than masquerading as a rejection. A label that arrives JSON-quoted (the
 * macOS raw-response string quirk) is unquoted first.
 */
function efxPaintMediaFailureFrom(error: unknown): EfxPaintMediaFailure {
  let label: unknown = error;
  if (typeof error === 'object' && error !== null && 'label' in error) {
    label = (error as { label?: unknown }).label;
  }
  if (typeof label !== 'string') {
    // [DEBUG-9f3c] DEV-only: a non-label error is a transport failure or a shape
    // this taxonomy does not know — both degrade to `io` with no trace at all.
    if (import.meta.env.DEV) console.error('[DEBUG-9f3c] unrecognized package failure', error);
    return { kind: 'io' };
  }
  const normalized = label.trim().replace(/^"(.*)"$/, '$1');
  if (normalized === 'missing') return { kind: 'missing' };
  const rejection = EFX_PAINT_MEDIA_REJECTION_LABELS.find((entry) => entry === normalized);
  if (rejection === undefined) {
    if (import.meta.env.DEV) console.error('[DEBUG-9f3c] unrecognized package label', normalized);
    return { kind: 'io' };
  }
  return { kind: 'refused', rejection };
}

/**
 * Write one real key's raster to the package `frames/` tree (or into the save
 * transaction's staging root when `stagingBasename` is supplied). The bytes
 * cross as the raw invoke body — never a JSON number array — and the resolved
 * `relativePath` is always the canonical `frames/<layerId>/<keyId>.webp`.
 */
export async function ipcEfxPaintWriteFrameMedia(
  packageDir: string,
  layerId: string,
  keyId: string,
  bytes: Uint8Array,
  stagingBasename?: string,
): Promise<Result<EfxPaintFrameMediaWriteResult, EfxPaintMediaFailure>> {
  const headers: Record<string, string> = { packageDir, layerId, keyId };
  if (stagingBasename !== undefined) headers.stagingBasename = stagingBasename;
  try {
    const data = await invoke<EfxPaintFrameMediaWriteResult>('efx_paint_write_frame_media', bytes, { headers });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: efxPaintMediaFailureFrom(error) };
  }
}

/**
 * Read one real key's raster back. The Rust side returns base64 (a raw
 * response body degrades to a JSON number array on macOS — see
 * `webpFrameCodec.ts`), decoded here to a `Uint8Array`.
 */
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

// --- Package layer file commands (quick-260913-05k) ---

/**
 * Write one `layers/<layerId>.json` sub-file into the package staging
 * generation. App-defined commands carry no capability scope, so this is the
 * route that keeps every `.mce` package path off the fs plugin (whose scope
 * covers appdata only). The destination root is derived in Rust from
 * `packageDir` plus the validated `stagingBasename`.
 */
export async function ipcEfxPaintWritePackageLayerFile(
  packageDir: string,
  stagingBasename: string,
  layerFile: string,
  contents: string,
): Promise<Result<null, EfxPaintMediaFailure>> {
  try {
    await invoke<null>('write_efx_paint_package_layer_file', {
      packageDir,
      stagingBasename,
      layerFile,
      contents,
    });
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: efxPaintMediaFailureFrom(error) };
  }
}

/**
 * Read one `layers/<layerId>.json` sub-file back as text. A `String` return,
 * never a raw byte body: the raw shape degrades to a JSON number array over
 * IPC on macOS (see `webpFrameCodec.ts`).
 */
export async function ipcEfxPaintReadPackageLayerFile(
  packageDir: string,
  layerFile: string,
): Promise<Result<string, EfxPaintMediaFailure>> {
  try {
    const contents = await invoke<string>('read_efx_paint_package_layer_file', {
      packageDir,
      layerFile,
    });
    return { ok: true, data: contents };
  } catch (error) {
    return { ok: false, error: efxPaintMediaFailureFrom(error) };
  }
}

/**
 * Discard a package staging generation left behind by a failed save. The
 * failure is a plain string — the caller swallows it exactly as the previous
 * plugin-fs removal was swallowed, because canonical publication state is
 * determined only by the transaction's own result.
 */
export async function discardEfxPaintPackageStaging(
  packageDir: string,
  stagingBasename: string,
): Promise<Result<null>> {
  return safeInvoke<null>('discard_efx_paint_package_staging', { packageDir, stagingBasename });
}

// --- Image commands ---
export async function imageGetInfo(path: string): Promise<Result<ImageInfo>> {
  return safeInvoke<ImageInfo>('image_get_info', { path });
}

export async function importImages(paths: string[], projectDir: string): Promise<Result<ImportResult>> {
  return safeInvoke<ImportResult>('import_images', { paths, projectDir });
}

// --- Config commands ---

export async function configGetTheme(): Promise<Result<string | null>> {
  return safeInvoke<string | null>('config_get_theme');
}

export async function configSetTheme(theme: string): Promise<Result<null>> {
  return safeInvoke<null>('config_set_theme', { theme });
}

export async function configGetCanvasBg(theme: string): Promise<Result<string | null>> {
  return safeInvoke<string | null>('config_get_canvas_bg', { theme });
}

export async function configSetCanvasBg(theme: string, color: string): Promise<Result<null>> {
  return safeInvoke<null>('config_set_canvas_bg', { theme, color });
}

export function configGetSidebarWidth() {
  return safeInvoke<number | null>('config_get_sidebar_width');
}

export function configSetSidebarWidth(width: number) {
  return safeInvoke<null>('config_set_sidebar_width', { width });
}

export function configGetPanelHeights() {
  return safeInvoke<[number, number] | null>('config_get_panel_heights');
}

export function configSetPanelHeights(seqHeight: number, layersHeight: number) {
  return safeInvoke<null>('config_set_panel_heights', { seqHeight, layersHeight });
}

export function configGetLoopEnabled() {
  return safeInvoke<boolean | null>('config_get_loop_enabled');
}

export function configSetLoopEnabled(enabled: boolean) {
  return safeInvoke<null>('config_set_loop_enabled', { enabled });
}

// --- Export config commands ---

export function configGetExportFolder() {
  return safeInvoke<string | null>('config_get_export_folder', {});
}

export function configSetExportFolder(folder: string) {
  return safeInvoke<null>('config_set_export_folder', { folder });
}

export function configGetExportNamingPattern() {
  return safeInvoke<string | null>('config_get_export_naming_pattern', {});
}

export function configSetExportNamingPattern(pattern: string) {
  return safeInvoke<null>('config_set_export_naming_pattern', { pattern });
}

export function configGetVideoQuality() {
  return safeInvoke<Record<string, unknown> | null>('config_get_video_quality', {});
}

export function configSetVideoQuality(quality: Record<string, unknown>) {
  return safeInvoke<null>('config_set_video_quality', { quality });
}

// --- Export commands ---

export function exportCreateDir(baseDir: string) {
  return safeInvoke<string>('export_create_dir', { baseDir });
}

export function exportWritePng(dirPath: string, filename: string, data: number[]) {
  return safeInvoke<null>('export_write_png', { dirPath, filename, data });
}

export function exportCountExistingFrames(dirPath: string) {
  return safeInvoke<number>('export_count_existing_frames', { dirPath });
}

export function exportOpenInFinder(path: string) {
  return safeInvoke<null>('export_open_in_finder', { path });
}

export function exportCheckFfmpeg() {
  return safeInvoke<string | null>('export_check_ffmpeg', {});
}

export function exportDownloadFfmpeg() {
  return safeInvoke<string>('export_download_ffmpeg', {});
}

export function exportCleanupPngs(dirPath: string) {
  return safeInvoke<number>('export_cleanup_pngs', { dirPath });
}

export function exportCleanupFile(filePath: string) {
  return safeInvoke<null>('export_cleanup_file', { filePath });
}

export function exportEncodeVideo(
  pngDir: string,
  globPattern: string,
  outputPath: string,
  codec: string,
  fps: number,
  h264Crf: number,
  av1Crf: number,
  proresProfile: string,
  audioPath?: string | null,
) {
  return safeInvoke<null>('export_encode_video', {
    pngDir, globPattern, outputPath, codec, fps,
    h264Crf, av1Crf, proresProfile,
    audioPath: audioPath ?? null,
  });
}
