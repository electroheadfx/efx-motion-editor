import { invoke } from '@tauri-apps/api/core';
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
  type PhysicPaintThumbnailEncodeRequest,
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

export async function projectCreate(name: string, fps: number, dirPath: string): Promise<Result<MceProject>> {
  return safeInvoke<MceProject>('project_create', { name, fps, dirPath });
}

export async function projectSave(project: MceProject, filePath: string): Promise<Result<null>> {
  return safeInvoke<null>('project_save', { project, filePath });
}

export async function projectSaveAsWithScriptLibrary(project: MceProject, sourceFilePath: string, destinationFilePath: string): Promise<Result<ScriptLibraryMigrationResult>> {
  return safeInvoke('project_save_as_with_script_library', { project, sourceFilePath, destinationFilePath });
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

export function scriptLibraryEncodeThumbnailWebp(request: PhysicPaintThumbnailEncodeRequest): Promise<Result<{ width: number; height: number; mimeType: 'image/webp'; webpBase64: string }>> {
  return safeInvoke('script_library_encode_thumbnail_webp', { request });
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

export interface PhysicPaintCachePublicationResult {
  accepted: true;
  replacedExisting: boolean;
}

export interface PhysicPaintCacheSettlementResult {
  accepted: true;
  cleanupStatus: 'complete' | 'deferred';
  cleanupDiagnostic?: string;
}

export function publishPhysicPaintCacheGeneration(
  projectDir: string,
  stagingBasename: string,
): Promise<Result<PhysicPaintCachePublicationResult>> {
  return safeInvoke<PhysicPaintCachePublicationResult>(
    'publish_physic_paint_cache_generation',
    { projectDir, stagingBasename },
  );
}

export function settlePhysicPaintCacheGeneration(
  projectDir: string,
  stagingBasename: string,
  action: 'commit' | 'rollback',
): Promise<Result<PhysicPaintCacheSettlementResult>> {
  return safeInvoke<PhysicPaintCacheSettlementResult>(
    'settle_physic_paint_cache_generation',
    { projectDir, stagingBasename, action },
  );
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
