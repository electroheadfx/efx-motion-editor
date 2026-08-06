import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import {
  isEfxPaintAudioPreviewContext,
  isEfxPaintAudioPreviewTrack,
  isPhysicPaintLaunchContext,
  isPhysicPaintRotoPhysicalEditRecord,
} from '../../../types/physicPaint';
import { parsePhysicPaintRotoPhysicalDocument } from '../roto/physicsPaintRotoPhysicalModel';

export interface PhysicsPaintLaunchStateSetters<Settings> {
  setLaunchContext: (context: PhysicPaintLaunchContext) => void;
  setSettings: (settings: Settings) => void;
}

const LAUNCH_KEYS = new Set(['operationId', 'layerId', 'project', 'startFrame', 'layerName', 'workflowLabel', 'width', 'height', 'fps', 'rotoPhysical', 'rotoPlayback', 'audioPreview']);
const PHYSICAL_KEYS = new Set(['capacity', 'records', 'interpolationEnabled', 'interpolationMode', 'scriptMotion', 'background', 'selectedKeyId', 'cursorAppFrame', 'revision', 'loopClips']);
const AUDIO_PREVIEW_KEYS = new Set(['revision', 'fps', 'tracks']);
const AUDIO_PREVIEW_TRACK_KEYS = new Set(['id', 'assetUrl', 'offsetFrame', 'inFrame', 'outFrame', 'slipOffset', 'fadeInFrames', 'fadeOutFrames', 'volume', 'muted', 'fadeInCurve', 'fadeOutCurve']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isStructuredClonePlainData(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.every((entry) => isStructuredClonePlainData(entry, seen));
    if (!isPlainRecord(value)) return false;
    return Object.values(value).every((entry) => isStructuredClonePlainData(entry, seen));
  } finally {
    seen.delete(value);
  }
}

export function applyPhysicsPaintLaunchContext<Settings>(
  context: PhysicPaintLaunchContext,
  setters: PhysicsPaintLaunchStateSetters<Settings>,
  resolveSettings: (context: PhysicPaintLaunchContext) => Settings | null,
): void {
  setters.setLaunchContext(context);
  const settings = resolveSettings(context);
  if (settings) setters.setSettings(settings);
}

/** Parse and reconstruct only the canonical complete physical launch envelope. */
export function parseCanonicalPhysicsPaintLaunchValue(value: unknown): PhysicPaintLaunchContext | null {
  if (!isStructuredClonePlainData(value) || !isPlainRecord(value) || !hasOnlyKeys(value, LAUNCH_KEYS)) return null;
  if (!isPhysicPaintLaunchContext(value) || !isPlainRecord(value.project) || !isPlainRecord(value.rotoPhysical)) return null;
  if (!hasOnlyKeys(value.rotoPhysical, PHYSICAL_KEYS) || !Array.isArray(value.rotoPhysical.records)) return null;
  if (!value.rotoPhysical.records.every(isPhysicPaintRotoPhysicalEditRecord)) return null;
  if (value.audioPreview !== undefined) {
    if (!isPlainRecord(value.audioPreview) || !hasOnlyKeys(value.audioPreview, AUDIO_PREVIEW_KEYS)) return null;
    if (!isEfxPaintAudioPreviewContext(value.audioPreview)) return null;
    if (!value.audioPreview.tracks.every((track) => isPlainRecord(track) && hasOnlyKeys(track, AUDIO_PREVIEW_TRACK_KEYS) && isEfxPaintAudioPreviewTrack(track))) return null;
  }
  try {
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: value.rotoPhysical.capacity,
      realKeyRecords: value.rotoPhysical.records.map((record) => ({ ...record, kind: 'real-key' as const })),
      interpolation: {
        enabled: value.rotoPhysical.interpolationEnabled,
        mode: value.rotoPhysical.interpolationMode,
      },
      scriptMotion: value.rotoPhysical.scriptMotion,
      background: value.rotoPhysical.background,
      selectedKeyId: value.rotoPhysical.selectedKeyId,
      cursorAppFrame: value.rotoPhysical.cursorAppFrame,
      revision: value.rotoPhysical.revision,
      loopClips: value.rotoPhysical.loopClips,
    });
    if (value.startFrame !== document.cursorAppFrame) return null;
    return {
      operationId: value.operationId,
      layerId: value.layerId,
      project: { ...value.project },
      startFrame: document.cursorAppFrame,
      ...(value.layerName !== undefined ? { layerName: value.layerName } : {}),
      ...(value.workflowLabel !== undefined ? { workflowLabel: value.workflowLabel } : {}),
      ...(value.width !== undefined ? { width: value.width } : {}),
      ...(value.height !== undefined ? { height: value.height } : {}),
      ...(value.fps !== undefined ? { fps: value.fps } : {}),
      ...(value.rotoPlayback !== undefined ? { rotoPlayback: { ...value.rotoPlayback } } : {}),
      ...(value.audioPreview !== undefined
        ? {
            audioPreview: {
              revision: value.audioPreview.revision,
              fps: value.audioPreview.fps,
              tracks: value.audioPreview.tracks.map((track) => ({ ...track })),
            },
          }
        : {}),
      rotoPhysical: {
        capacity: document.capacity,
        records: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
        interpolationEnabled: document.interpolation.enabled,
        interpolationMode: document.interpolation.mode,
        scriptMotion: document.scriptMotion,
        background: document.background,
        selectedKeyId: document.selectedKeyId,
        cursorAppFrame: document.cursorAppFrame,
        revision: document.revision,
        loopClips: document.loopClips,
      },
    };
  } catch {
    return null;
  }
}

export function parsePhysicsPaintLaunchContext(location: Location): PhysicPaintLaunchContext | null {
  const encodedContext = new URLSearchParams(location.search).get('context');
  if (!encodedContext || encodedContext.trim().length === 0) return null;
  try {
    return parseCanonicalPhysicsPaintLaunchValue(JSON.parse(encodedContext));
  } catch {
    return null;
  }
}
