import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { McePhysicPaintOutput, RuntimePhysicPaintOutput } from '../types/project';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoCacheFrame } from '../types/physicPaint';

const PHYSIC_PAINT_CACHE_DIR = 'cache/physic-paint';
const DATA_URL_PREFIX = 'data:image/png;base64,';

const savedOutputCache = new WeakMap<RuntimePhysicPaintOutput[], { projectDir: string; persisted: McePhysicPaintOutput[] }>();

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function frameFileName(frame: PhysicPaintRenderedFrame, variant = 'frame'): string {
  const appFrame = String(frame.appFrame).padStart(6, '0');
  const frameIndex = String(frame.frameIndex).padStart(4, '0');
  return `${variant}-${appFrame}-${frameIndex}.png`;
}

function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith(DATA_URL_PREFIX)) return null;
  const binary = atob(dataUrl.slice(DATA_URL_PREFIX.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodePngDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return DATA_URL_PREFIX + btoa(binary);
}

function isSafePhysicPaintCachePath(cachePath: unknown): cachePath is string {
  if (typeof cachePath !== 'string') return false;
  if (!cachePath.startsWith(`${PHYSIC_PAINT_CACHE_DIR}/`)) return false;
  if (cachePath.includes('\\')) return false;
  return cachePath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) {
    await mkdir(path, { recursive: true });
  }
}

export async function savePhysicPaintData(projectDir: string, outputs: RuntimePhysicPaintOutput[] | undefined): Promise<McePhysicPaintOutput[]> {
  const rootDir = `${projectDir}/${PHYSIC_PAINT_CACHE_DIR}`;
  if (!outputs || outputs.length === 0) {
    if (await exists(rootDir)) await remove(rootDir, { recursive: true });
    return [];
  }

  const cached = savedOutputCache.get(outputs);
  if (cached?.projectDir === projectDir) return cached.persisted;

  if (await exists(rootDir)) {
    await remove(rootDir, { recursive: true });
  }
  await ensureDir(rootDir);

  const persistedOutputs: McePhysicPaintOutput[] = [];

  for (const output of outputs) {
    if (!output || typeof output.layer_id !== 'string' || !Array.isArray(output.frames)) continue;

    const layerDirName = sanitizeSegment(output.layer_id);
    const layerDir = `${rootDir}/${layerDirName}`;
    await ensureDir(layerDir);

    const frames: McePhysicPaintOutput['frames'] = [];
    const cachePathsByAppFrame = new Map<number, string>();
    for (const frame of output.frames) {
      const bytes = decodePngDataUrl(frame.dataUrl);
      if (!bytes) {
        throw new Error(`Physics Paint frame ${output.layer_id}:${frame.appFrame} is not a PNG data URL`);
      }

      const fileName = frameFileName(frame);
      const cachePath = `${PHYSIC_PAINT_CACHE_DIR}/${layerDirName}/${fileName}`;
      await writeFile(`${projectDir}/${cachePath}`, bytes);
      const { dataUrl: _dataUrl, onionDataUrl: _onionDataUrl, ...metadata } = frame as PhysicPaintRenderedFrame & { onionDataUrl?: string };
      frames.push({ ...metadata, cache_path: cachePath });
      cachePathsByAppFrame.set(frame.appFrame, cachePath);
    }

    const rotoCacheMetadata = Array.isArray(output.roto_cache_metadata)
      ? await Promise.all(output.roto_cache_metadata.map(async (candidate) => {
          const cachePath = cachePathsByAppFrame.get(candidate.appFrame);
          const runtimeCandidate = candidate as PhysicPaintRenderedFrame & typeof candidate;
          const { dataUrl: _dataUrl, onionDataUrl, ...metadata } = runtimeCandidate;
          if (typeof onionDataUrl !== 'string') {
            return cachePath ? { ...metadata, cache_path: cachePath } : metadata;
          }
          const onionBytes = decodePngDataUrl(onionDataUrl);
          if (!onionBytes) {
            throw new Error(`Physics Paint onion frame ${output.layer_id}:${candidate.appFrame} is not a PNG data URL`);
          }
          const onionCachePath = `${PHYSIC_PAINT_CACHE_DIR}/${layerDirName}/${frameFileName(candidate, 'onion')}`;
          await writeFile(`${projectDir}/${onionCachePath}`, onionBytes);
          return cachePath
            ? { ...metadata, cache_path: cachePath, onion_cache_path: onionCachePath }
            : { ...metadata, onion_cache_path: onionCachePath };
        }))
      : undefined;

    persistedOutputs.push({
      ...output,
      frames,
      ...(rotoCacheMetadata ? { roto_cache_metadata: rotoCacheMetadata } : {}),
    });
  }

  savedOutputCache.set(outputs, { projectDir, persisted: persistedOutputs });
  return persistedOutputs;
}

export async function loadPhysicPaintData(projectDir: string, outputs: McePhysicPaintOutput[] | undefined): Promise<RuntimePhysicPaintOutput[] | undefined> {
  if (!outputs || outputs.length === 0) return outputs as RuntimePhysicPaintOutput[] | undefined;

  const hydratedOutputs: RuntimePhysicPaintOutput[] = [];

  for (const output of outputs) {
    if (!output || typeof output.layer_id !== 'string' || !Array.isArray(output.frames)) continue;

    const frames: PhysicPaintRenderedFrame[] = [];
    const dataUrlsByCachePath = new Map<string, string>();
    const dataUrlsByAppFrame = new Map<number, string>();

    for (const frame of output.frames) {
      if (!isSafePhysicPaintCachePath(frame.cache_path)) continue;
      try {
        const bytes = await readFile(`${projectDir}/${frame.cache_path}`);
        const dataUrl = encodePngDataUrl(bytes);
        dataUrlsByCachePath.set(frame.cache_path, dataUrl);
        dataUrlsByAppFrame.set(frame.appFrame, dataUrl);
        const { cache_path: _cachePath, ...metadata } = frame;
        frames.push({
          ...metadata,
          dataUrl,
        });
      } catch (err) {
        console.error(`Failed to load physics paint frame ${frame.cache_path} (non-fatal):`, err);
      }
    }

    const rotoCacheMetadata: PhysicPaintRotoCacheFrame[] | undefined = Array.isArray(output.roto_cache_metadata)
      ? (await Promise.all(output.roto_cache_metadata.map(async (candidate) => {
          const cachePath = candidate.cache_path;
          const sourceFrame = candidate.sourceFrame ?? candidate.appFrame;
          const dataUrl = typeof cachePath === 'string'
            ? dataUrlsByCachePath.get(cachePath)
            : candidate.source === 'real-key'
              ? dataUrlsByAppFrame.get(sourceFrame)
              : undefined;
          if (!dataUrl) return null;
          const { cache_path: _cachePath, onion_cache_path: onionCachePath, ...metadata } = candidate;
          if (!isSafePhysicPaintCachePath(onionCachePath)) return { ...metadata, dataUrl };
          try {
            const onionBytes = await readFile(`${projectDir}/${onionCachePath}`);
            return { ...metadata, dataUrl, onionDataUrl: encodePngDataUrl(onionBytes) };
          } catch (err) {
            console.error(`Failed to load physics paint onion frame ${onionCachePath} (non-fatal):`, err);
            return { ...metadata, dataUrl };
          }
        }))).filter((frame): frame is PhysicPaintRotoCacheFrame => frame !== null)
      : undefined;

    const { frames: _persistedFrames, roto_cache_metadata: _persistedRotoCacheMetadata, ...metadata } = output;
    hydratedOutputs.push({
      ...metadata,
      frames,
      ...(rotoCacheMetadata ? { roto_cache_metadata: rotoCacheMetadata } : {}),
    });
  }

  return hydratedOutputs;
}
