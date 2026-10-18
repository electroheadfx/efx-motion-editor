import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { PhysicStrokePayload } from '@efxlab/efx-physic-paint';
import type { BrushPackSnapshot, StudioPoint, StudioScriptEnvelope, StudioStroke } from '@efxlab/efx-paint-host';
import { classifyEnvelopeParseFailure, hashMutationId, type HostScriptRefusal } from '@efxlab/efx-paint-host';
import type {
  AquarelleDryEvent,
  AquarellePayloadEvent,
  AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import { AQUARELLE_TOOLS, isAquarelleDryEvent } from '@efxlab/efx-watercolor/payload';
import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { isGrainScaleValue } from '../../../efx-paint/document/efxPaintDocument';
import { aquarelleUvToEnginePixel } from '../engine/aquarelleStrokeBridge';
import type { RecordedStrokeGroup, RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/** On-disk envelope kind (host law). The legacy kind is refused, never produced. */
export const ROTO_SCRIPT_KIND = 'efx-studio-paint-script' as const;
/** On-disk engine identity (D-15 package identity). */
export const ROTO_SCRIPT_ENGINE_ID = 'efx-physic-paint' as const;
/** 261018-odm: engine-2 (aquarelle) on-disk identity. */
export const ROTO_SCRIPT_ENGINE_ID_AQUARELLE = 'efx-watercolor' as const;
export const ROTO_SCRIPT_SCHEMA_VERSION = 1 as const;
export const ROTO_SCRIPT_EXTENSION = '.efx-roto-script.json' as const;
export const ROTO_SCRIPT_LIMITS = {
  fileBytes: 16 * 1024 * 1024,
  nameCharacters: 120,
  metadataCharacters: 256,
  brushes: 2_000,
  continuationsPerBrush: 600,
  pointsPerBrush: 50_000,
  totalPoints: 250_000,
  thumbnailBytes: 512 * 1024,
  thumbnailWidth: 96,
  thumbnailHeight: 64,
} as const;

/** Engine-1 cap policy (D-20) — stays in the engine codec, never in host time/. */
const DIFFUSION_CAP = 600;

export interface PersistedRotoScriptThumbnailV1 {
  mimeType: 'image/webp';
  width: number;
  height: number;
  quality: number;
  dataUrl: string;
}

export interface PersistedRotoScriptSourceV1 {
  projectName: string;
  layerId: string;
  layerName: string;
  sourceFrame: number;
  displayFrame: number;
  width: number;
  height: number;
  background: PhysicPaintRotoBackgroundMetadata;
}

/**
 * Engine-1 private stroke payload (opaque P). Shared StudioStroke fields
 * live on the host stroke; this bag rides the `engine` slot untouched by host.
 */
export type PersistedRotoScriptStrokeV1 = PhysicStrokePayload;

/**
 * THE saved script shape (D-13): StudioScriptEnvelope + engineId.
 * `source` keeps the engine-1 display-hint fields (background) on top of
 * the host source contract. `engineId` is narrowed to the engine-1 literal
 * so the dual-engine union discriminates on it (261018-odm).
 */
export type PersistedRotoScriptV1 = Omit<StudioScriptEnvelope<PhysicStrokePayload>, 'source' | 'engineId'> & {
  engineId: typeof ROTO_SCRIPT_ENGINE_ID;
  source: PersistedRotoScriptSourceV1;
};

/**
 * 261018-odm: the aquarelle envelope variant. Same envelope shape; the
 * engine slot is `AquarelleStrokePayload` for paint strokes and
 * `AquarelleDryEvent` for the distinguished Dry markers (D-16).
 */
export type PersistedRotoScriptAquarelleV1 = Omit<
  StudioScriptEnvelope<AquarelleStrokePayload | AquarelleDryEvent>,
  'source' | 'engineId'
> & {
  engineId: typeof ROTO_SCRIPT_ENGINE_ID_AQUARELLE;
  source: PersistedRotoScriptSourceV1;
};

/** Dual-engine parse result document. */
export type PersistedRotoScriptAnyV1 = PersistedRotoScriptV1 | PersistedRotoScriptAquarelleV1;

export interface RotoScriptLibraryRow {
  id: string;
  revision: string;
  /** SHA-256 of the exact managed file bytes retained by durable Action transactions. */
  integritySha256: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: PersistedRotoScriptSourceV1;
  thumbnail: PersistedRotoScriptThumbnailV1;
  brushCount: number;
  /**
   * D-16: present when this row is a clean-break / unreadable refused row.
   * The row stays listed so the user can delete it explicitly — never dropped.
   */
  readonly refusal?: HostScriptRefusal['code'];
}

export type RotoScriptParseResult =
  | { ok: true; document: PersistedRotoScriptAnyV1 }
  | { ok: false; refusal: HostScriptRefusal };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const WEBP_PREFIX = 'data:image/webp;base64,';

export function isCanonicalRotoScriptId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function managedRotoScriptFilename(id: string): string {
  if (!isCanonicalRotoScriptId(id)) throw new Error('Invalid Roto script ID');
  return `${id}${ROTO_SCRIPT_EXTENSION}`;
}

export function normalizeRotoScriptName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFC').trim();
  if (!normalized || Array.from(normalized).length > ROTO_SCRIPT_LIMITS.nameCharacters || /[\x00-\x1f\x7f]/u.test(normalized)) return null;
  return normalized;
}

/** D-16: refused rows stay listed; load is blocked, delete remains the user's action. */
export function isRefusedRotoScriptRow(row: Pick<RotoScriptLibraryRow, 'refusal'>): boolean {
  return row.refusal !== undefined;
}

/** Project an engine value into the persisted domain; non-finite → fallback. */
function schemaRange(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return value < min ? min : value > max ? max : value;
}

function clampParams(params: PaintStroke['params']) {
  return {
    size: schemaRange(params.size, 1, 80, 1),
    opacity: schemaRange(params.opacity, 10, 100, 100),
    pressure: schemaRange(params.pressure, 10, 100, 70),
    waterAmount: schemaRange(params.waterAmount, 0, 100, 0),
    dryAmount: schemaRange(params.dryAmount, 0, 100, 0),
    edgeDetail: schemaRange(params.edgeDetail, 0, 100, 0),
    pickup: schemaRange(params.pickup, 0, 100, 0),
    eraseStrength: schemaRange(params.eraseStrength, 0, 100, 0),
    antiAlias: Math.round(schemaRange(params.antiAlias, 0, 3, 0)),
  };
}

/**
 * Project one engine-1 stroke onto the shared StudioStroke + opaque engine slot.
 * Same projection law as toStudioStroke (55-02) — keep the words identical.
 */
export function serializeRotoScriptStroke(stroke: Readonly<PaintStroke>, strokeIndex: number): StudioStroke<PhysicStrokePayload> {
  // Mouse input records p: 0 (PointerEvent.pressure is 0 for mouse). On replay
  // the engine's strokeHasPenInput fallback (p !== 0.5) would read that as pen
  // input and render zero-width. Normalize to 0.5 when no pen input is present.
  const noPenInput = !stroke.hasPenInput;
  const pts: StudioPoint[] = stroke.points.map((point, i) => {
    const rawP = schemaRange(point.p, 0, 1, 0);
    return {
      x: schemaRange(point.x, -1_000_000, 1_000_000, 0),
      y: schemaRange(point.y, -1_000_000, 1_000_000, 0),
      p: noPenInput && rawP === 0 ? 0.5 : rawP,
      tx: schemaRange(point.tx, -90, 90, 0),
      ty: schemaRange(point.ty, -90, 90, 0),
      tw: schemaRange(point.tw, -360, 360, 0),
      tick: i,
    };
  });
  // Positive only (260925-iy6): the engine's `|| 0` round-trip must not leak
  // into cuisson or the engine slot. Continuation counts take the engine cap.
  const diffusion = typeof stroke.diffusionFrames === 'number' && stroke.diffusionFrames > 0
    ? Math.min(DIFFUSION_CAP, Math.max(1, Math.round(stroke.diffusionFrames)))
    : 0;
  return {
    pts,
    ticks: Math.max(1, pts.length - 1),
    cuisson: diffusion,
    motion: null,
    brushId: ROTO_SCRIPT_ENGINE_ID,
    toolOverrides: {},
    traceSeed: hashMutationId(stroke.mutationId ?? String(strokeIndex)),
    recordedOrder: Number.isSafeInteger(stroke.timestamp) && stroke.timestamp >= 0 ? stroke.timestamp : 0,
    playFrame: stroke.playFrame !== undefined && Number.isSafeInteger(stroke.playFrame) && stroke.playFrame >= 0 ? stroke.playFrame : null,
    color: stroke.color,
    engine: {
      tool: stroke.tool,
      color: stroke.color,
      params: clampParams(stroke.params) as unknown as Record<string, number>,
      ...(stroke.mutationId !== undefined ? { mutationId: stroke.mutationId } : {}),
      hasPenInput: stroke.hasPenInput === true,
      ...(diffusion > 0 ? { diffusionFrames: diffusion } : {}),
      ...(stroke.playFrame !== undefined ? { playFrame: stroke.playFrame } : {}),
      ...(stroke.physicsMode !== undefined ? { physicsMode: stroke.physicsMode } : {}),
      timestamp: stroke.timestamp,
    },
  };
}

/**
 * Serialize engine-1 brush groups into the saved StudioScriptEnvelope.
 * brushes[{primary, continuations}] flattens to strokes[] in order.
 */
export function serializeRotoScript(input: {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: PersistedRotoScriptSourceV1;
  thumbnail: PersistedRotoScriptThumbnailV1;
  brushes: readonly Readonly<RecordedStrokeGroup>[];
}): PersistedRotoScriptV1 {
  const strokes: StudioStroke<PhysicStrokePayload>[] = [];
  for (const brush of input.brushes) {
    strokes.push(serializeRotoScriptStroke(brush.primary, strokes.length));
    for (const continuation of brush.continuations ?? []) {
      strokes.push(serializeRotoScriptStroke(continuation, strokes.length));
    }
  }
  const brushPack: BrushPackSnapshot = { kind: ROTO_SCRIPT_ENGINE_ID, entries: [] };
  const document: PersistedRotoScriptV1 = {
    kind: ROTO_SCRIPT_KIND,
    schemaVersion: ROTO_SCRIPT_SCHEMA_VERSION,
    engineId: ROTO_SCRIPT_ENGINE_ID,
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    source: structuredClone(input.source),
    thumbnail: { ...input.thumbnail },
    brushPack,
    strokes,
  };
  if (!isPersistedRotoScriptV1(document)) throw new Error('Captured Roto script is not persistable');
  return document;
}

/** Compatibility alias — the engine-1 serialize entry the library already calls. */
export const createPersistedRotoScript = serializeRotoScript;

/**
 * 261018-odm: serialize the aquarelle payload timeline into the dual-engine
 * envelope. Each stroke event rides the vendor projection (UV pts + engine
 * payload) with the envelope brushId stamped to the aquarelle engine id and
 * cuisson forced 0 — diffusionFrames lives only in `engine.diffusionFrames`.
 * Dry events persist as distinguished stroke entries (D-16).
 */
export function serializeAquarelleRotoScript(input: {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: PersistedRotoScriptSourceV1;
  thumbnail: PersistedRotoScriptThumbnailV1;
  events: readonly AquarellePayloadEvent[];
}): PersistedRotoScriptAquarelleV1 {
  const strokes: StudioStroke<AquarelleStrokePayload | AquarelleDryEvent>[] = [];
  for (const event of input.events) {
    if (isAquarelleDryEvent(event)) {
      strokes.push({
        pts: [],
        ticks: 0,
        cuisson: 0,
        motion: null,
        brushId: ROTO_SCRIPT_ENGINE_ID_AQUARELLE,
        toolOverrides: {},
        traceSeed: 0,
        recordedOrder: event.recordedOrder,
        playFrame: null,
        color: null,
        engine: { kind: 'dry', tick: event.tick, recordedOrder: event.recordedOrder },
      });
      continue;
    }
    strokes.push({
      pts: event.pts.map((point) => ({ ...point })),
      ticks: event.ticks,
      cuisson: 0,
      motion: null,
      brushId: ROTO_SCRIPT_ENGINE_ID_AQUARELLE,
      toolOverrides: { ...event.toolOverrides },
      traceSeed: event.traceSeed,
      recordedOrder: event.recordedOrder,
      playFrame: event.playFrame,
      color: event.color,
      engine: { ...event.engine },
    });
  }
  const brushPack: BrushPackSnapshot = { kind: ROTO_SCRIPT_ENGINE_ID_AQUARELLE, entries: [] };
  const document: PersistedRotoScriptAquarelleV1 = {
    kind: ROTO_SCRIPT_KIND,
    schemaVersion: ROTO_SCRIPT_SCHEMA_VERSION,
    engineId: ROTO_SCRIPT_ENGINE_ID_AQUARELLE,
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    source: structuredClone(input.source),
    thumbnail: { ...input.thumbnail },
    brushPack,
    strokes,
  };
  if (!isPersistedRotoScriptAquarelleV1(document)) throw new Error('Captured Roto script is not persistable');
  return document;
}

/**
 * Parse a raw on-disk document. Accepts ONLY the envelope kind.
 * A legacy-kind document yields the clean-break refusal and never a script
 * (D-13/D-14). No alternate reader exists.
 *
 * 261018-odm: dual-engine. `efx-physic-paint` keeps the engine-1 shape
 * guard; `efx-watercolor` falls through to the aquarelle shape guard. A
 * third known engine still refuses with `engine-mismatch`.
 */
export function parseRotoScript(raw: unknown): RotoScriptParseResult {
  const classified = classifyEnvelopeParseFailure(raw);
  if (classified !== null) return { ok: false, refusal: { code: classified } };
  // 55-06 (D-11): a known engine that is not this reader's codec is an
  // engine-mismatch, not a malformed payload. The envelope parsed cleanly —
  // it is simply for a different paint module. Detail carries the package-id
  // pair so the Studio mapper can name both engines (D-15).
  const engineId = isRecord(raw) && typeof raw.engineId === 'string' ? raw.engineId : null;
  if (engineId !== null && engineId !== ROTO_SCRIPT_ENGINE_ID && engineId !== ROTO_SCRIPT_ENGINE_ID_AQUARELLE) {
    return { ok: false, refusal: { code: 'engine-mismatch', detail: `${engineId}:${ROTO_SCRIPT_ENGINE_ID}` } };
  }
  if (engineId === ROTO_SCRIPT_ENGINE_ID_AQUARELLE) {
    if (!isPersistedRotoScriptAquarelleV1(raw)) return { ok: false, refusal: { code: 'malformed-engine-payload' } };
    return { ok: true, document: raw };
  }
  if (!isPersistedRotoScriptV1(raw)) return { ok: false, refusal: { code: 'malformed-engine-payload' } };
  return { ok: true, document: raw };
}

function strokeFromEnvelope(stroke: StudioStroke<PhysicStrokePayload>): PaintStroke {
  const engine = stroke.engine;
  return {
    tool: engine.tool as PaintStroke['tool'],
    points: stroke.pts.map((point) => ({
      x: point.x, y: point.y, p: point.p, tx: point.tx, ty: point.ty, tw: point.tw, spd: 0,
    })),
    color: stroke.color,
    params: { ...engine.params } as unknown as PaintStroke['params'],
    timestamp: engine.timestamp,
    ...(engine.mutationId !== undefined ? { mutationId: engine.mutationId } : {}),
    ...(engine.hasPenInput !== undefined ? { hasPenInput: engine.hasPenInput } : {}),
    ...(engine.diffusionFrames !== undefined ? { diffusionFrames: engine.diffusionFrames } : {}),
    ...(stroke.playFrame !== null ? { playFrame: stroke.playFrame } : {}),
    // Preserve explicit null (engine "no physics mode") vs absent.
    ...(engine.physicsMode !== undefined ? { physicsMode: engine.physicsMode as PaintStroke['physicsMode'] } : {}),
  };
}

/**
 * Reconstruct engine-1 brush groups from flattened envelope strokes.
 * Schema law: cuisson > 0 continues the previous primary; cuisson === 0 starts a group.
 */
function reconstructGroups(strokes: readonly StudioStroke<PhysicStrokePayload>[]): RecordedStrokeGroup[] {
  const groups: RecordedStrokeGroup[] = [];
  for (const stroke of strokes) {
    const paintStroke = strokeFromEnvelope(stroke);
    if (stroke.cuisson > 0 && groups.length > 0) {
      const previous = groups[groups.length - 1]!;
      groups[groups.length - 1] = {
        primary: previous.primary,
        continuations: [...(previous.continuations ?? []), paintStroke],
      };
    } else {
      groups.push({ primary: paintStroke, continuations: [] });
    }
  }
  return groups;
}

export function persistedRotoScriptToRuntime(document: PersistedRotoScriptAnyV1): RotoPaintScript {
  const parsed = parseRotoScript(document);
  if (!parsed.ok) throw new Error('Invalid persisted Roto script');
  const doc = parsed.document;
  if (doc.engineId === ROTO_SCRIPT_ENGINE_ID_AQUARELLE) {
    return aquarellePersistedToRuntime(doc);
  }
  return {
    provenance: { sessionId: `persisted:${doc.id}`, layerId: doc.source.layerId, sourceFrame: doc.source.sourceFrame },
    sourceFrame: doc.source.sourceFrame,
    sourceDisplayFrame: doc.source.displayFrame,
    sourceRevision: 0,
    engineId: doc.engineId,
    brushes: reconstructGroups(doc.strokes),
  };
}

/**
 * 261018-odm: rebuild the aquarelle runtime snapshot from the persisted
 * envelope. `aquarelleEvents` walks the strokes[] in order (Dry markers
 * reconstruct to `AquarelleDryEvent`; paint entries rebuild
 * `StudioStroke<AquarelleStrokePayload>`). `brushes` still carries
 * pixel-space PaintStrokes so engine-1 consumers see a usable group list.
 */
function aquarellePersistedToRuntime(document: PersistedRotoScriptAquarelleV1): RotoPaintScript {
  const events: AquarellePayloadEvent[] = [];
  const brushes: RecordedStrokeGroup[] = [];
  const size = { width: document.source.width, height: document.source.height };
  for (const stroke of document.strokes) {
    if (isAquarelleDryMarker(stroke.engine)) {
      events.push({ kind: 'dry', tick: stroke.engine.tick, recordedOrder: stroke.engine.recordedOrder });
      continue;
    }
    const engine = stroke.engine as AquarelleStrokePayload;
    // Project the bake window from engine.diffusionFrames (the toStudioStroke
    // law). Hardcoding cuisson:0 made the bake skip stepTick entirely — the
    // fluid sim never bled/granulated and the replay drew only the deposit line.
    const cuisson = typeof engine.diffusionFrames === 'number' && engine.diffusionFrames > 0
      ? Math.min(600, Math.trunc(engine.diffusionFrames))
      : 0;
    const projected: StudioStroke<AquarelleStrokePayload> = {
      pts: stroke.pts.map((point) => ({ ...point })),
      ticks: stroke.ticks,
      cuisson,
      motion: null,
      brushId: engine.brushId,
      toolOverrides: { ...stroke.toolOverrides },
      traceSeed: stroke.traceSeed,
      recordedOrder: stroke.recordedOrder,
      playFrame: stroke.playFrame,
      color: stroke.color,
      engine: { ...engine },
    };
    events.push(projected);
    brushes.push({
      primary: aquarelleEnvelopeToPaintStroke(stroke, engine, size),
      continuations: [],
    });
  }
  return {
    provenance: { sessionId: `persisted:${document.id}`, layerId: document.source.layerId, sourceFrame: document.source.sourceFrame },
    sourceFrame: document.source.sourceFrame,
    sourceDisplayFrame: document.source.displayFrame,
    sourceRevision: 0,
    engineId: document.engineId,
    aquarelleEvents: events,
    brushes,
  };
}

/** Project one aquarelle envelope stroke into an engine-1 pixel-space PaintStroke. */
function aquarelleEnvelopeToPaintStroke(
  stroke: StudioStroke<AquarelleStrokePayload | AquarelleDryEvent>,
  engine: AquarelleStrokePayload,
  size: { width: number; height: number },
): PaintStroke {
  return {
    tool: 'paint',
    points: stroke.pts.map((point) => {
      const pixel = aquarelleUvToEnginePixel({ x: point.x, y: point.y }, size);
      return { x: pixel.x, y: pixel.y, p: point.p, tx: point.tx, ty: point.ty, tw: point.tw, spd: 0 };
    }),
    color: stroke.color,
    params: {
      size: Number(engine.params['size']) || 12,
      opacity: Number(engine.params['load']) || 50,
      pressure: 50,
      waterAmount: Number(engine.params['water']) || 50,
      dryAmount: Number(engine.params['dry']) || 50,
      edgeDetail: Number(engine.params['edge']) || 50,
      pickup: 50,
      eraseStrength: 50,
      antiAlias: 1,
    },
    timestamp: engine.timestamp,
    ...(engine.mutationId !== undefined ? { mutationId: engine.mutationId } : {}),
    // engine.diffusionFrames is the aquarelle cuisson window — never copy it
    // here. In engine-1 PaintStroke, `diffusionFrames` marks a continuation
    // (zero-point diffusion record); leaking it onto a primary makes
    // enqueueRecordedStroke reject the stroke as "cannot be a continuation".
    ...(stroke.playFrame !== null ? { playFrame: stroke.playFrame } : {}),
  };
}

export function rotoScriptLibraryRow(document: PersistedRotoScriptAnyV1, revision: string, integritySha256: string): RotoScriptLibraryRow {
  return {
    id: document.id,
    revision,
    integritySha256,
    name: document.name,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    source: structuredClone(document.source),
    thumbnail: { ...document.thumbnail },
    brushCount: document.strokes.filter((stroke) => stroke.cuisson === 0 && !isAquarelleDryMarker(stroke.engine)).length,
  };
}

/** Build a D-16 refused row for a clean-break / unreadable managed script. */
export function rotoScriptRefusedLibraryRow(input: {
  id: string;
  revision: string;
  integritySha256: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  source: PersistedRotoScriptSourceV1;
  thumbnail: PersistedRotoScriptThumbnailV1;
  refusal: HostScriptRefusal['code'];
}): RotoScriptLibraryRow {
  return {
    id: input.id,
    revision: input.revision,
    integritySha256: input.integritySha256,
    name: input.name,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    source: structuredClone(input.source),
    thumbnail: { ...input.thumbnail },
    brushCount: 0,
    refusal: input.refusal,
  };
}

/**
 * Dual-engine document guard (261018-odm). Dispatches on `engineId`:
 * `efx-physic-paint` keeps the engine-1 shape law, `efx-watercolor` uses
 * the aquarelle law (Dry markers do not consume brush/continuation slots).
 * A third engineId stays false.
 */
export function isPersistedRotoScriptV1(value: unknown): value is PersistedRotoScriptAnyV1 {
  if (!isRecord(value)) return false;
  if (value.engineId === ROTO_SCRIPT_ENGINE_ID_AQUARELLE) return isPersistedRotoScriptAquarelleV1(value);
  return isPersistedRotoScriptEngine1(value);
}

/** Engine-1 document guard (unchanged shape law). */
function isPersistedRotoScriptEngine1(value: unknown): value is PersistedRotoScriptV1 {
  if (!isRecord(value) || value.kind !== ROTO_SCRIPT_KIND || value.schemaVersion !== ROTO_SCRIPT_SCHEMA_VERSION) return false;
  if (value.engineId !== ROTO_SCRIPT_ENGINE_ID) return false;
  if (!isCanonicalRotoScriptId(value.id) || !normalizeRotoScriptName(value.name)) return false;
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || Date.parse(value.updatedAt) < Date.parse(value.createdAt)) return false;
  if (!isSource(value.source) || !isThumbnail(value.thumbnail)) return false;
  if (!isBrushPack(value.brushPack)) return false;
  if (!Array.isArray(value.strokes) || value.strokes.length < 1 || value.strokes.length > ROTO_SCRIPT_LIMITS.brushes + ROTO_SCRIPT_LIMITS.brushes * ROTO_SCRIPT_LIMITS.continuationsPerBrush) return false;
  let totalPoints = 0;
  let continuationsInGroup = 0;
  for (const stroke of value.strokes) {
    if (!isEnvelopeStroke(stroke)) return false;
    totalPoints += stroke.pts.length;
    if (stroke.cuisson === 0) continuationsInGroup = 0;
    else {
      continuationsInGroup += 1;
      if (continuationsInGroup > ROTO_SCRIPT_LIMITS.continuationsPerBrush) return false;
    }
    if (totalPoints > ROTO_SCRIPT_LIMITS.totalPoints) return false;
  }
  return true;
}

/**
 * 261018-odm: aquarelle document guard. Same envelope law; the engine slot
 * dispatches to the aquarelle stroke or Dry guard. Dry markers are legal
 * with empty pts and do not count as brushes or continuations.
 */
export function isPersistedRotoScriptAquarelleV1(value: unknown): value is PersistedRotoScriptAquarelleV1 {
  if (!isRecord(value) || value.kind !== ROTO_SCRIPT_KIND || value.schemaVersion !== ROTO_SCRIPT_SCHEMA_VERSION) return false;
  if (value.engineId !== ROTO_SCRIPT_ENGINE_ID_AQUARELLE) return false;
  if (!isCanonicalRotoScriptId(value.id) || !normalizeRotoScriptName(value.name)) return false;
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || Date.parse(value.updatedAt) < Date.parse(value.createdAt)) return false;
  if (!isSource(value.source) || !isThumbnail(value.thumbnail)) return false;
  if (!isBrushPack(value.brushPack)) return false;
  if (!Array.isArray(value.strokes) || value.strokes.length < 1 || value.strokes.length > ROTO_SCRIPT_LIMITS.brushes + ROTO_SCRIPT_LIMITS.brushes * ROTO_SCRIPT_LIMITS.continuationsPerBrush) return false;
  let totalPoints = 0;
  let brushes = 0;
  for (const stroke of value.strokes) {
    if (!isEnvelopeStrokeAquarelle(stroke)) return false;
    if (isAquarelleDryMarker(stroke.engine)) continue;
    brushes += 1;
    if (brushes > ROTO_SCRIPT_LIMITS.brushes) return false;
    totalPoints += stroke.pts.length;
    if (totalPoints > ROTO_SCRIPT_LIMITS.totalPoints) return false;
  }
  return true;
}

function isBrushPack(value: unknown): value is BrushPackSnapshot {
  return isRecord(value) && typeof value.kind === 'string' && Array.isArray(value.entries);
}

function isEnvelopeStroke(value: unknown): value is StudioStroke<PhysicStrokePayload> {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.pts)) return false;
  // Continuations (cuisson > 0) carry zero points — the diffusion tail rides
  // the previous primary. Primaries need at least one sample.
  const continuation = typeof value.cuisson === 'number' && value.cuisson > 0;
  if (continuation) {
    if (value.pts.length !== 0) return false;
  } else if (value.pts.length < 1 || value.pts.length > ROTO_SCRIPT_LIMITS.pointsPerBrush) {
    return false;
  }
  if (!value.pts.every(isEnvelopePoint)) return false;
  if (!nonNegativeInteger(value.ticks) || (value.pts.length > 1 && value.ticks !== Math.max(1, value.pts.length - 1))) return false;
  if (!nonNegativeInteger(value.cuisson)) return false;
  if (value.motion !== null) return false;
  if (value.brushId !== ROTO_SCRIPT_ENGINE_ID) return false;
  if (!isRecord(value.toolOverrides)) return false;
  if (typeof value.traceSeed !== 'number' || !Number.isFinite(value.traceSeed)) return false;
  if (!safeInteger(value.recordedOrder)) return false;
  if (value.playFrame !== null && !nonNegativeInteger(value.playFrame)) return false;
  if (value.color !== null && (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color))) return false;
  return isEnginePayload(value.engine);
}

/** 261018-odm: distinguish the Dry marker engine slot from a paint payload. */
function isAquarelleDryMarker(value: unknown): value is AquarelleDryEvent {
  return isRecord(value) && value.kind === 'dry';
}

/**
 * 261018-odm: aquarelle envelope stroke. Empty pts is legal only for a Dry
 * marker; a non-Dry primary still needs >= 1 point. cuisson is 0 for every
 * aquarelle entry (diffusionFrames lives in the engine slot, never the
 * engine-1 continuation grouping). brushId is the aquarelle engine id.
 */
function isEnvelopeStrokeAquarelle(value: unknown): value is StudioStroke<AquarelleStrokePayload | AquarelleDryEvent> {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.pts)) return false;
  const dry = isAquarelleDryMarker(value.engine);
  if (dry) {
    if (value.pts.length !== 0) return false;
    if (value.ticks !== 0) return false;
    if (value.cuisson !== 0) return false;
    if (value.motion !== null) return false;
    if (value.brushId !== ROTO_SCRIPT_ENGINE_ID_AQUARELLE) return false;
    if (!isRecord(value.toolOverrides) || Object.keys(value.toolOverrides).length !== 0) return false;
    if (value.traceSeed !== 0) return false;
    if (!safeInteger(value.recordedOrder)) return false;
    if (value.playFrame !== null) return false;
    if (value.color !== null) return false;
    return isEnginePayloadAquarelleDry(value.engine);
  }
  if (value.pts.length < 1 || value.pts.length > ROTO_SCRIPT_LIMITS.pointsPerBrush) return false;
  if (!value.pts.every(isEnvelopePointAquarelle)) return false;
  if (!nonNegativeInteger(value.ticks) || (value.pts.length > 1 && value.ticks !== Math.max(1, value.pts.length - 1))) return false;
  if (value.cuisson !== 0) return false;
  if (value.motion !== null) return false;
  if (value.brushId !== ROTO_SCRIPT_ENGINE_ID_AQUARELLE) return false;
  if (!isRecord(value.toolOverrides)) return false;
  if (typeof value.traceSeed !== 'number' || !Number.isFinite(value.traceSeed)) return false;
  if (!safeInteger(value.recordedOrder)) return false;
  if (value.playFrame !== null && !nonNegativeInteger(value.playFrame)) return false;
  if (value.color !== null && (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color))) return false;
  return isEnginePayloadAquarelleStroke(value.engine);
}

/** 261018-odm: aquarelle stroke engine-slot guard. */
function isEnginePayloadAquarelleStroke(value: unknown): value is AquarelleStrokePayload {
  if (!isRecord(value)) return false;
  if (typeof value.tool !== 'string' || !(AQUARELLE_TOOLS as readonly string[]).includes(value.tool)) return false;
  if (value.color !== null && (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color))) return false;
  if (!isRecord(value.params) || !Object.values(value.params).every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
  if (typeof value.brushId !== 'string' || value.brushId.length === 0) return false;
  if (!safeInteger(value.timestamp)) return false;
  if (value.toolOverrides !== undefined && !isRecord(value.toolOverrides)) return false;
  if (value.mutationId !== undefined && !nonNegativeInteger(value.mutationId)) return false;
  if (value.playFrame !== undefined && !nonNegativeInteger(value.playFrame)) return false;
  if (value.diffusionFrames !== undefined && !positiveInteger(value.diffusionFrames, DIFFUSION_CAP)) return false;
  return true;
}

/** 261018-odm: aquarelle Dry-marker engine-slot guard. */
function isEnginePayloadAquarelleDry(value: unknown): value is AquarelleDryEvent {
  if (!isRecord(value)) return false;
  if (value.kind !== 'dry') return false;
  if (!nonNegativeInteger(value.tick)) return false;
  return typeof value.recordedOrder === 'number' && Number.isFinite(value.recordedOrder);
}

function isEnvelopePoint(value: unknown): value is StudioPoint {
  if (!isRecord(value)) return false;
  return finiteRange(value.x, -1_000_000, 1_000_000) && finiteRange(value.y, -1_000_000, 1_000_000)
    && finiteRange(value.p, 0, 1) && finiteRange(value.tx, -90, 90) && finiteRange(value.ty, -90, 90)
    && finiteRange(value.tw, -360, 360) && nonNegativeInteger(value.tick);
}

/**
 * 261018-odm fix: aquarelle envelope points accept p: -1 (the engine's mouse
 * sentinel — pushSample reports -1 when no pen pressure is available). The
 * engine's bake path resolves it internally via simPressure.
 */
function isEnvelopePointAquarelle(value: unknown): value is StudioPoint {
  if (!isRecord(value)) return false;
  return finiteRange(value.x, -1_000_000, 1_000_000) && finiteRange(value.y, -1_000_000, 1_000_000)
    && (finiteRange(value.p, 0, 1) || value.p === -1)
    && finiteRange(value.tx, -90, 90) && finiteRange(value.ty, -90, 90)
    && finiteRange(value.tw, -360, 360) && nonNegativeInteger(value.tick);
}

function isEnginePayload(value: unknown): value is PhysicStrokePayload {
  if (!isRecord(value)) return false;
  if (value.tool !== 'paint' && value.tool !== 'erase') return false;
  if (value.color !== null && (typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color))) return false;
  if (!isBrushParams(value.params) || !safeInteger(value.timestamp)) return false;
  if (value.mutationId !== undefined && !safeInteger(value.mutationId)) return false;
  if (value.hasPenInput !== undefined && typeof value.hasPenInput !== 'boolean') return false;
  if (value.diffusionFrames !== undefined && !positiveInteger(value.diffusionFrames, DIFFUSION_CAP)) return false;
  if (value.playFrame !== undefined && !nonNegativeInteger(value.playFrame)) return false;
  return value.physicsMode === undefined || value.physicsMode === null || value.physicsMode === 'local' || value.physicsMode === 'last' || value.physicsMode === 'all';
}

function isSource(value: unknown): value is PersistedRotoScriptSourceV1 {
  if (!isRecord(value)) return false;
  return boundedString(value.projectName) && boundedString(value.layerId) && boundedString(value.layerName)
    && nonNegativeInteger(value.sourceFrame) && nonNegativeInteger(value.displayFrame)
    && positiveInteger(value.width, 16_384) && positiveInteger(value.height, 16_384)
    && isRotoBackground(value.background);
}

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

function isBrushParams(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return finiteRange(value.size, 1, 80) && finiteRange(value.opacity, 10, 100) && finiteRange(value.pressure, 10, 100)
    && finiteRange(value.waterAmount, 0, 100) && finiteRange(value.dryAmount, 0, 100) && finiteRange(value.edgeDetail, 0, 100)
    && finiteRange(value.pickup, 0, 100) && finiteRange(value.eraseStrength, 0, 100)
    && Number.isInteger(value.antiAlias) && finiteRange(value.antiAlias, 0, 3);
}

export function isRotoBackground(value: unknown): value is PhysicPaintRotoBackgroundMetadata {
  // 261018-lqv: keep in lockstep with `isPhysicPaintRotoBackgroundMetadata`
  // (types/physicPaint.ts) — 56-05 / PAPER-01 migrated the apply-payload
  // validator and the type union to `paper/<id>`, not this save-path guard.
  // The parity pin (`physicsPaintRotoBackgroundValidatorParity.test.ts`) is the
  // anti-divergence mechanism.
  return isRecord(value)
    && (value.background === 'transparent' || value.background === 'white' || value.background === 'canvas1' || value.background === 'canvas2' || value.background === 'canvas3'
      || (typeof value.background === 'string' && value.background.startsWith('paper/')))
    && finiteRange(value.grainStrength, 0, 1)
    && (value.color === undefined || typeof value.color === 'string')
    && (value.grainScale === undefined || isGrainScaleValue(value.grainScale));
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Invalid Base64');
  let bytes: Uint8Array;
  if (typeof atob === 'function') bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  else {
    const bufferCtor = (globalThis as typeof globalThis & { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
    if (!bufferCtor) throw new Error('Base64 decoder unavailable');
    bytes = Uint8Array.from(bufferCtor.from(value, 'base64'));
  }
  if (encodeBase64(bytes) !== value) throw new Error('Non-canonical Base64');
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === 'function') return btoa(binary);
  const bufferCtor = (globalThis as typeof globalThis & { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
  if (!bufferCtor) throw new Error('Base64 encoder unavailable');
  return bufferCtor.from(bytes).toString('base64');
}

function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 12) !== 'WEBP') return null;
  if (readUint32LE(bytes, 4) + 8 !== bytes.length) return null;
  let offset = 12;
  let dimensions: { width: number; height: number } | null = null;
  let imageChunks = 0;
  while (offset < bytes.length) {
    if (bytes.length - offset < 8) return null;
    const chunk = ascii(bytes, offset, offset + 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    const paddedEnd = dataEnd + (chunkSize & 1);
    if (!Number.isSafeInteger(dataEnd) || paddedEnd > bytes.length || (chunkSize & 1) === 1 && bytes[dataEnd] !== 0) return null;
    if (chunk === 'VP8X') {
      if (chunkSize !== 10 || dimensions) return null;
      dimensions = { width: 1 + readUint24LE(bytes, dataStart + 4), height: 1 + readUint24LE(bytes, dataStart + 7) };
    } else if (chunk === 'VP8L') {
      imageChunks += 1;
      if (chunkSize < 5 || bytes[dataStart] !== 0x2f) return null;
      const parsed = { width: 1 + bytes[dataStart + 1] + ((bytes[dataStart + 2] & 0x3f) << 8), height: 1 + ((bytes[dataStart + 2] >> 6) | (bytes[dataStart + 3] << 2) | ((bytes[dataStart + 4] & 0x0f) << 10)) };
      if (dimensions && (dimensions.width !== parsed.width || dimensions.height !== parsed.height)) return null;
      dimensions ??= parsed;
    } else if (chunk === 'VP8 ') {
      imageChunks += 1;
      if (chunkSize < 10 || bytes[dataStart + 3] !== 0x9d || bytes[dataStart + 4] !== 0x01 || bytes[dataStart + 5] !== 0x2a) return null;
      const parsed = { width: readUint16LE(bytes, dataStart + 6) & 0x3fff, height: readUint16LE(bytes, dataStart + 8) & 0x3fff };
      if (dimensions && (dimensions.width !== parsed.width || dimensions.height !== parsed.height)) return null;
      dimensions ??= parsed;
    }
    offset = paddedEnd;
  }
  return offset === bytes.length && imageChunks === 1 ? dimensions : null;
}

function readUint16LE(bytes: Uint8Array, offset: number): number { return bytes[offset] | (bytes[offset + 1] << 8); }
function readUint24LE(bytes: Uint8Array, offset: number): number { return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16); }
function readUint32LE(bytes: Uint8Array, offset: number): number { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }
function ascii(bytes: Uint8Array, start: number, end: number): string { return String.fromCharCode(...bytes.slice(start, end)); }
function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isSafeInteger(timestamp) && timestamp >= 0;
}
function boundedString(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= ROTO_SCRIPT_LIMITS.metadataCharacters && !/[\x00-\x1f\x7f]/u.test(value); }
function nonNegativeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function positiveInteger(value: unknown, max: number): value is number { return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= max; }
function safeInteger(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function finiteRange(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function isRecord(value: unknown): value is Record<string, any> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
