import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import {
  buildPhysicPaintRotoProjectEquality,
  isPhysicPaintRotoLoopClip,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type {
  McePhysicPaintOutput,
  McePhysicPaintRotoPhysicalDocument,
  McePhysicPaintRotoPhysicalRecord,
  RuntimePhysicPaintOutput,
} from '../types/project';
import { isPhysicPaintRenderedFrame, isPhysicPaintRotoPlaybackSettings, type PhysicPaintRenderedFrame } from '../types/physicPaint';
import { publishPhysicPaintCacheGeneration, settlePhysicPaintCacheGeneration } from './ipc';

const PHYSIC_PAINT_CACHE_DIR = 'cache/physic-paint';
const PHYSIC_PAINT_CACHE_PARENT_DIR = 'cache';
const PHYSIC_PAINT_STAGING_PREFIX = '.physic-paint-staging-';
const DATA_URL_PREFIX = 'data:image/png;base64,';
const OUTPUT_KEYS = new Set(['layer_id', 'frames', 'roto_physical', 'roto_playback']);
const PERSISTED_DOCUMENT_KEYS = new Set(['capacity', 'realKeyRecords', 'groupOverrideRecords', 'interpolation', 'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame', 'revision', 'loopClips', 'incomingInterpolationBreakKeyIds']);
const PERSISTED_RECORD_KEYS = new Set(['kind', 'keyId', 'appFrame', 'payload']);
const PERSISTED_PAYLOAD_KEYS = new Set(['frameIndex', 'appFrame', 'cache_path', 'width', 'height']);

const savedOutputCache = new Map<string, McePhysicPaintOutput[]>();

type PendingWrite = { readonly path: string; readonly bytes: Uint8Array };

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

function frameFileName(frame: Pick<PhysicPaintRenderedFrame, 'appFrame' | 'frameIndex'>, variant = 'frame'): string {
  const appFrame = String(frame.appFrame).padStart(6, '0');
  const frameIndex = String(frame.frameIndex).padStart(4, '0');
  return `${variant}-${appFrame}-${frameIndex}.png`;
}

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

export function isSafePhysicPaintCachePath(cachePath: unknown): cachePath is string {
  if (typeof cachePath !== 'string' || !cachePath.startsWith(`${PHYSIC_PAINT_CACHE_DIR}/`)) return false;
  if (cachePath.includes('\\') || cachePath.startsWith('/') || cachePath.includes('\0')) return false;
  return cachePath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) await mkdir(path, { recursive: true });
}

function createStagingBasename(): string {
  return `${PHYSIC_PAINT_STAGING_PREFIX}${crypto.randomUUID()}`;
}

async function removeStagingGeneration(path: string): Promise<void> {
  try {
    await remove(path, { recursive: true });
  } catch {
    // Staging cleanup is non-authoritative. Canonical publication state is
    // determined only by the native publication result.
  }
}

function buildSaveCacheKey(projectDir: string, outputs: readonly RuntimePhysicPaintOutput[]): string {
  const segments = outputs.map((output) => {
    const physical = output.roto_physical ? buildPhysicPaintRotoProjectEquality(output.roto_physical) : 'none';
    const playback = output.roto_playback ? `${output.roto_playback.loop ? 1 : 0}:${output.roto_playback.fps}` : 'none';
    const frames = output.frames.map((frame) => `${frame.appFrame}:${frame.frameIndex}:${frame.dataUrl.length}:${frame.dataUrl}`).join('|');
    return `${output.layer_id.length}:${output.layer_id}:${physical}:${playback}:${frames}`;
  }).sort();
  return `${projectDir}\0${segments.join('\0')}`;
}

function validateRuntimeOutputs(outputs: readonly RuntimePhysicPaintOutput[]): readonly RuntimePhysicPaintOutput[] {
  const seenLayerIds = new Set<string>();
  const seenDirectories = new Set<string>();
  for (const output of outputs) {
    if (!isPlainRecord(output) || !hasOnlyKeys(output, OUTPUT_KEYS) || !isNonEmptyString(output.layer_id) || !Array.isArray(output.frames)) {
      throw new Error('Physics Paint output must be a closed layer_id/frames/roto_physical record.');
    }
    if (seenLayerIds.has(output.layer_id)) throw new Error(`Duplicate Physics Paint layer "${output.layer_id}".`);
    seenLayerIds.add(output.layer_id);
    const directory = stableSegment(output.layer_id);
    if (seenDirectories.has(directory)) throw new Error(`Physics Paint layer path collision for "${output.layer_id}".`);
    seenDirectories.add(directory);
    const seenFrames = new Set<number>();
    for (const frame of output.frames) {
      if (!isPhysicPaintRenderedFrame(frame) || seenFrames.has(frame.appFrame) || !decodePngDataUrl(frame.dataUrl)) {
        throw new Error(`Invalid Physics Paint frame in layer "${output.layer_id}".`);
      }
      seenFrames.add(frame.appFrame);
    }
    if (output.roto_physical !== undefined) parsePhysicPaintRotoPhysicalDocument(output.roto_physical);
    if (output.roto_playback !== undefined && !isPhysicPaintRotoPlaybackSettings(output.roto_playback)) {
      throw new Error(`Invalid Roto playback settings in layer "${output.layer_id}".`);
    }
  }
  return outputs;
}

interface PreparedPhysicPaintSave {
  readonly persistedOutputs: McePhysicPaintOutput[];
  readonly cacheKey: string | null;
  readonly publication: Readonly<{
    transactionId: string;
  }> | null;
  readonly removeCanonicalAfterCommit: boolean;
}

async function preparePhysicPaintDataSave(projectDir: string, outputs: RuntimePhysicPaintOutput[] | undefined): Promise<PreparedPhysicPaintSave> {
  if (!outputs || outputs.length === 0) {
    return {
      persistedOutputs: [],
      cacheKey: null,
      publication: null,
      removeCanonicalAfterCommit: true,
    };
  }

  const validatedOutputs = validateRuntimeOutputs(outputs);
  const cacheKey = buildSaveCacheKey(projectDir, validatedOutputs);
  const cached = savedOutputCache.get(cacheKey);
  if (cached) {
    return {
      persistedOutputs: structuredClone(cached),
      cacheKey,
      publication: null,
      removeCanonicalAfterCommit: false,
    };
  }

  const pendingWrites: PendingWrite[] = [];
  const persistedOutputs: McePhysicPaintOutput[] = [];

  for (const output of validatedOutputs) {
    const layerDirName = stableSegment(output.layer_id);
    const frames: McePhysicPaintOutput['frames'] = [];
    for (const frame of output.frames) {
      const bytes = decodePngDataUrl(frame.dataUrl);
      if (!bytes) throw new Error(`Physics Paint frame ${output.layer_id}:${frame.appFrame} is not a canonical PNG data URL.`);
      const cachePath = `${PHYSIC_PAINT_CACHE_DIR}/${layerDirName}/${frameFileName(frame)}`;
      pendingWrites.push({ path: cachePath, bytes });
      const { dataUrl: _dataUrl, source: _source, nearestRealKeyFrame: _nearest, ...metadata } = frame;
      frames.push({ ...metadata, cache_path: cachePath });
    }

    let rotoPhysical: McePhysicPaintRotoPhysicalDocument | undefined;
    if (output.roto_physical) {
      const physical = parsePhysicPaintRotoPhysicalDocument(output.roto_physical);
      const persistPhysicalRecords = (
        records: readonly PhysicPaintRotoPhysicalDocument['realKeyRecords'][number][],
        prefix: string,
      ): McePhysicPaintRotoPhysicalRecord[] => records.map((record) => {
        const bytes = decodePngDataUrl(record.payload.dataUrl);
        if (!bytes) throw new Error(`Physical Roto key ${output.layer_id}:${record.keyId} is not a canonical PNG data URL.`);
        const cachePath = `${PHYSIC_PAINT_CACHE_DIR}/${layerDirName}/${prefix}-${String(record.appFrame).padStart(6, '0')}-${stableSegment(record.keyId)}.png`;
        pendingWrites.push({ path: cachePath, bytes });
        return {
          kind: 'real-key',
          keyId: record.keyId,
          appFrame: record.appFrame,
          payload: {
            frameIndex: record.payload.frameIndex,
            appFrame: record.payload.appFrame,
            cache_path: cachePath,
            ...(record.payload.width !== undefined ? { width: record.payload.width } : {}),
            ...(record.payload.height !== undefined ? { height: record.payload.height } : {}),
          },
        };
      });
      const realKeyRecords = persistPhysicalRecords(physical.realKeyRecords, 'key');
      const groupOverrideRecords = persistPhysicalRecords(physical.groupOverrideRecords ?? [], 'override');
      rotoPhysical = {
        capacity: physical.capacity,
        realKeyRecords,
        groupOverrideRecords,
        interpolation: physical.interpolation,
        scriptMotion: physical.scriptMotion,
        background: physical.background,
        selectedKeyId: physical.selectedKeyId,
        cursorAppFrame: physical.cursorAppFrame,
        revision: physical.revision,
        // Loop Clips carry stable keyId references only (no cache paths), so
        // the collection serializes verbatim — dangling references included (D-31).
        loopClips: physical.loopClips.map((clip) => ({
          loopId: clip.loopId,
          placementStart: clip.placementStart,
          sourceKeyIds: [...clip.sourceKeyIds],
          repeat: clip.repeat,
          mode: clip.mode,
          // 43-06 source-cycle provenance persists with the record.
          ...(clip.scriptId !== undefined
            ? { scriptId: clip.scriptId, motion: { ...clip.motion! }, overrideColor: clip.overrideColor ?? null }
            : {}),
          ...(clip.syncState !== undefined
            ? {
                syncState: clip.syncState,
                provenanceState: clip.provenanceState!,
                phaseOrigin: clip.phaseOrigin!,
                originalEndExclusive: clip.originalEndExclusive!,
                visibleRanges: clip.visibleRanges!.map((range) => ({ ...range })),
                frameOverrides: clip.frameOverrides!.map((override) => ({ ...override })),
              }
            : {}),
        })),
        incomingInterpolationBreakKeyIds: [...physical.incomingInterpolationBreakKeyIds],
      };
    }
    persistedOutputs.push({
      layer_id: output.layer_id,
      frames,
      ...(rotoPhysical ? { roto_physical: rotoPhysical } : {}),
      ...(output.roto_playback ? { roto_playback: { ...output.roto_playback } } : {}),
    });
  }

  const stagingBasename = createStagingBasename();
  const stagingRelativeRoot = `${PHYSIC_PAINT_CACHE_PARENT_DIR}/${stagingBasename}`;
  const stagingRoot = `${projectDir}/${stagingRelativeRoot}`;
  await ensureDir(`${projectDir}/${PHYSIC_PAINT_CACHE_PARENT_DIR}`);

  try {
    await mkdir(stagingRoot, { recursive: true });
    const ensuredDirectories = new Set<string>();
    for (const write of pendingWrites) {
      const stagingRelativePath = `${stagingRelativeRoot}${write.path.slice(PHYSIC_PAINT_CACHE_DIR.length)}`;
      const directory = stagingRelativePath.slice(0, stagingRelativePath.lastIndexOf('/'));
      if (!ensuredDirectories.has(directory)) {
        await mkdir(`${projectDir}/${directory}`, { recursive: true });
        ensuredDirectories.add(directory);
      }
      await writeFile(`${projectDir}/${stagingRelativePath}`, write.bytes);
    }

    const publication = await publishPhysicPaintCacheGeneration(projectDir, stagingBasename);
    if (!publication.ok) throw new Error(publication.error);
    return {
      persistedOutputs,
      cacheKey,
      publication: { transactionId: publication.data.transactionId },
      removeCanonicalAfterCommit: false,
    };
  } catch (error) {
    await removeStagingGeneration(stagingRoot);
    throw error;
  }
}

async function settlePreparedPhysicPaintSave(
  projectDir: string,
  prepared: PreparedPhysicPaintSave,
  action: 'commit' | 'rollback',
): Promise<void> {
  if (prepared.publication) {
    const result = await settlePhysicPaintCacheGeneration(
      projectDir,
      prepared.publication.transactionId,
      action,
    );
    if (!result.ok && action === 'rollback') throw new Error(result.error);
  }
  if (action === 'commit') {
    if (prepared.removeCanonicalAfterCommit) {
      const rootDir = `${projectDir}/${PHYSIC_PAINT_CACHE_DIR}`;
      if (await exists(rootDir)) await remove(rootDir, { recursive: true });
    }
    savedOutputCache.clear();
    if (prepared.cacheKey) savedOutputCache.set(prepared.cacheKey, structuredClone(prepared.persistedOutputs));
  }
}

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

function parsePersistedPhysicalDocument(value: unknown): McePhysicPaintRotoPhysicalDocument {
  if (!isPlainRecord(value) || !hasOnlyKeys(value, PERSISTED_DOCUMENT_KEYS) || !Array.isArray(value.realKeyRecords)) {
    throw new Error('Persisted physical Roto document has unknown or missing members.');
  }
  // loopClips is the optional additive member (D-29): absent means the empty
  // collection (v0.8.1 shape); present means every record must pass the
  // canonical fail-closed guard. Dangling source keyIds are preserved
  // verbatim (D-31) — this check is structural only.
  if (value.loopClips !== undefined && (!Array.isArray(value.loopClips) || !value.loopClips.every(isPhysicPaintRotoLoopClip))) {
    throw new Error('Persisted physical Roto document loopClips member is malformed.');
  }
  if (value.incomingInterpolationBreakKeyIds !== undefined
    && (!Array.isArray(value.incomingInterpolationBreakKeyIds)
      || !value.incomingInterpolationBreakKeyIds.every(isNonEmptyString))) {
    throw new Error('Persisted physical Roto document incoming break member is malformed.');
  }
  if (value.groupOverrideRecords !== undefined && !Array.isArray(value.groupOverrideRecords)) {
    throw new Error('Persisted physical Roto Group overrides member is malformed.');
  }
  for (const record of [...value.realKeyRecords, ...(value.groupOverrideRecords ?? [])]) {
    if (!isPlainRecord(record) || !hasOnlyKeys(record, PERSISTED_RECORD_KEYS) || record.kind !== 'real-key') {
      throw new Error('Persisted physical Roto record is malformed.');
    }
    if (!isNonEmptyString(record.keyId) || !isNonNegativeInteger(record.appFrame) || !isPlainRecord(record.payload) || !hasOnlyKeys(record.payload, PERSISTED_PAYLOAD_KEYS)) {
      throw new Error('Persisted physical Roto record identity or payload is malformed.');
    }
    if (!isNonNegativeInteger(record.payload.frameIndex) || record.payload.appFrame !== record.appFrame || !isSafePhysicPaintCachePath(record.payload.cache_path)) {
      throw new Error('Persisted physical Roto payload placement or sidecar path is invalid.');
    }
    if (record.payload.width !== undefined && (!Number.isInteger(record.payload.width) || (record.payload.width as number) <= 0)) throw new Error('Persisted physical Roto width is invalid.');
    if (record.payload.height !== undefined && (!Number.isInteger(record.payload.height) || (record.payload.height as number) <= 0)) throw new Error('Persisted physical Roto height is invalid.');
    if ((record.payload.width === undefined) !== (record.payload.height === undefined)) throw new Error('Persisted physical Roto dimensions must be complete.');
  }
  return value as unknown as McePhysicPaintRotoPhysicalDocument;
}

async function hydratePhysicalDocument(projectDir: string, value: unknown): Promise<PhysicPaintRotoPhysicalDocument> {
  const persisted = parsePersistedPhysicalDocument(value);
  const hydrateRecords = (records: readonly McePhysicPaintRotoPhysicalRecord[]) => Promise.all(records.map(async (record) => {
    const bytes = await readFile(`${projectDir}/${record.payload.cache_path}`);
    if (bytes.length === 0) throw new Error(`Physical Roto sidecar is empty: ${record.payload.cache_path}`);
    return {
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: {
        frameIndex: record.payload.frameIndex,
        appFrame: record.payload.appFrame,
        dataUrl: encodePngDataUrl(bytes),
        ...(record.payload.width !== undefined ? { width: record.payload.width } : {}),
        ...(record.payload.height !== undefined ? { height: record.payload.height } : {}),
      },
    };
  }));
  const records = await hydrateRecords(persisted.realKeyRecords);
  const groupOverrideRecords = await hydrateRecords(persisted.groupOverrideRecords ?? []);
  return parsePhysicPaintRotoPhysicalDocument({
    capacity: persisted.capacity,
    realKeyRecords: records,
    groupOverrideRecords,
    interpolation: persisted.interpolation,
    scriptMotion: persisted.scriptMotion,
    background: persisted.background,
    selectedKeyId: persisted.selectedKeyId,
    cursorAppFrame: persisted.cursorAppFrame,
    revision: persisted.revision,
    loopClips: persisted.loopClips,
    incomingInterpolationBreakKeyIds: persisted.incomingInterpolationBreakKeyIds,
  });
}

export async function loadPhysicPaintData(projectDir: string, outputs: McePhysicPaintOutput[] | undefined): Promise<RuntimePhysicPaintOutput[] | undefined> {
  if (outputs === undefined) return undefined;
  if (!Array.isArray(outputs)) throw new Error('Physics Paint outputs must be an array.');

  const hydratedOutputs: RuntimePhysicPaintOutput[] = [];
  const seenLayerIds = new Set<string>();
  for (const output of outputs) {
    if (!isPlainRecord(output) || !hasOnlyKeys(output, OUTPUT_KEYS) || !isNonEmptyString(output.layer_id) || !Array.isArray(output.frames)) {
      throw new Error('Persisted Physics Paint output is not a closed physical output.');
    }
    if (seenLayerIds.has(output.layer_id)) throw new Error(`Duplicate persisted Physics Paint layer "${output.layer_id}".`);
    seenLayerIds.add(output.layer_id);

    const frames: PhysicPaintRenderedFrame[] = [];
    const seenFrames = new Set<number>();
    for (const frame of output.frames) {
      if (!isPlainRecord(frame) || !hasOnlyKeys(frame, new Set(['frameIndex', 'appFrame', 'cache_path', 'width', 'height']))) {
        throw new Error(`Persisted Physics Paint frame in layer "${output.layer_id}" is malformed.`);
      }
      if (!isNonNegativeInteger(frame.frameIndex) || !isNonNegativeInteger(frame.appFrame) || !isSafePhysicPaintCachePath(frame.cache_path) || seenFrames.has(frame.appFrame)) {
        throw new Error(`Persisted Physics Paint frame in layer "${output.layer_id}" has invalid placement or path.`);
      }
      const bytes = await readFile(`${projectDir}/${frame.cache_path}`);
      if (bytes.length === 0) throw new Error(`Physics Paint sidecar is empty: ${frame.cache_path}`);
      const candidate = {
        frameIndex: frame.frameIndex,
        appFrame: frame.appFrame,
        dataUrl: encodePngDataUrl(bytes),
        ...(frame.width !== undefined ? { width: frame.width } : {}),
        ...(frame.height !== undefined ? { height: frame.height } : {}),
      };
      if (!isPhysicPaintRenderedFrame(candidate)) throw new Error(`Persisted Physics Paint frame in layer "${output.layer_id}" failed validation.`);
      seenFrames.add(frame.appFrame);
      frames.push(candidate);
    }

    const physical = output.roto_physical === undefined ? undefined : await hydratePhysicalDocument(projectDir, output.roto_physical);
    if (output.roto_playback !== undefined && !isPhysicPaintRotoPlaybackSettings(output.roto_playback)) {
      throw new Error(`Persisted Roto playback settings in layer "${output.layer_id}" are malformed.`);
    }
    hydratedOutputs.push({
      layer_id: output.layer_id,
      frames,
      ...(physical ? { roto_physical: physical } : {}),
      ...(output.roto_playback ? { roto_playback: { ...output.roto_playback } } : {}),
    });
  }
  validateRuntimeOutputs(hydratedOutputs);
  return hydratedOutputs;
}
