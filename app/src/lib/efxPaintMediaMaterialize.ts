/**
 * quick-260913-52r (G): the open-leg read half of the D-13 read-back pair.
 *
 * The package loader returns documents whose roto records are reference-only
 * (media blocks, no pixels). The compositor seam decodes those references
 * lazily for the flattened composite — but three consumers structurally
 * require inline bytes and have no lazy path: the parent authority's frames
 * projection (`requirePhysicPaintRotoInlineBytes`), the launch-context pack
 * (the Studio's launch hydration and engine alpha preparation), and the
 * engine's real-key preparation. Without materialization the FIRST reopen of
 * any package leaves both realms pixel-less (main canvas blank, Studio engine
 * never ready) with zero log output.
 *
 * This module reads every referenced frame file through the native read
 * command (digest-verified, same law as `resolveFrameMediaBytes`), rebuilds
 * the affected tracks' roto physical documents with byte-carrying payloads,
 * and recomputes each rebuilt document's revision. The persisted DOCUMENTS
 * stay reference-only — only the runtime projection is materialized.
 *
 * Failures are returned, never swallowed: a missing or refused file keeps
 * that record reference-only and names itself in `failures` for the caller
 * to log. One unreadable frame must not block the open, but it must never be
 * silent either.
 */
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintLoadedDocument } from './efxPaintPersistence';
import { resolveFrameMediaBytes, type FrameMediaRefusalReason } from './efxPaintMediaRead';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

/**
 * Why one record stayed reference-only. `missing`/`refused*` come from the
 * digest-verified read; `no-package-root` is the launch-door class — a runtime
 * record whose bytes were destroyed upstream (the docSync mirror) and whose
 * window knows no package root to read them back from (an unsaved project).
 */
export type FrameMediaMaterializeFailureReason = 'missing' | 'no-package-root' | FrameMediaRefusalReason;

export interface FrameMediaMaterializeFailure {
  readonly layerId: string;
  readonly trackId: string;
  readonly collection: 'real-key' | 'group-override';
  readonly keyId: string;
  readonly relativePath: string;
  readonly reason: FrameMediaMaterializeFailureReason;
}

export interface FrameMediaMaterializeResult {
  /** One runtime document per loaded layer: identical to the loaded
   *  reference-only document except every resolvable roto record now carries
   *  its inline bytes. */
  readonly runtimeDocuments: ReadonlyMap<string, EfxPaintDocument>;
  readonly failures: readonly FrameMediaMaterializeFailure[];
  /** Keys whose bytes were read, verified, and installed. */
  readonly materializedKeys: number;
}

export function buildBytesPayload(
  record: PhysicPaintRotoRealKeyRecord,
  bytes: Uint8Array,
): PhysicPaintRotoRealKeyRecord['payload'] {
  const { frameIndex, appFrame, width, height } = record.payload;
  return {
    frameIndex,
    appFrame,
    bytes,
    ...(width !== undefined && height !== undefined ? { width, height } : {}),
  };
}

async function materializeRecords(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  packageDir: string,
  context: {
    readonly layerId: string;
    readonly trackId: string;
    readonly collection: 'real-key' | 'group-override';
  },
  failures: FrameMediaMaterializeFailure[],
  counter: { value: number },
): Promise<readonly PhysicPaintRotoRealKeyRecord[]> {
  const materialized: PhysicPaintRotoRealKeyRecord[] = [];
  for (const record of records) {
    const media = record.payload.media;
    if (media === undefined || record.payload.bytes !== undefined) {
      materialized.push(record);
      continue;
    }
    const resolved = await resolveFrameMediaBytes(packageDir, media);
    if (resolved.kind !== 'bytes') {
      failures.push(Object.freeze({
        layerId: context.layerId,
        trackId: context.trackId,
        collection: context.collection,
        keyId: record.keyId,
        relativePath: media.relativePath,
        reason: resolved.kind === 'missing' ? 'missing' : resolved.reason,
      }));
      materialized.push(record);
      continue;
    }
    counter.value += 1;
    materialized.push(Object.freeze({
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: Object.freeze(buildBytesPayload(record, resolved.bytes)),
    }));
  }
  return materialized;
}

/**
 * Materialize every media reference of the loaded package's roto documents.
 * Records are visited per track for both persisted collections (real keys and
 * group overrides — a reference names no collection, so neither is skipped).
 */
export async function materializePackageRotoMediaBytes(
  loadedDocuments: ReadonlyMap<string, EfxPaintLoadedDocument>,
  packageDir: string,
): Promise<FrameMediaMaterializeResult> {
  const runtimeDocuments = new Map<string, EfxPaintDocument>();
  const failures: FrameMediaMaterializeFailure[] = [];
  const counter = { value: 0 };
  for (const [layerId, loaded] of loadedDocuments) {
    const tracks = [];
    for (const track of loaded.document.tracks) {
      const physical = track.rotoPhysical;
      if (!physical) {
        tracks.push(track);
        continue;
      }
      const realKeyRecords = await materializeRecords(
        physical.realKeyRecords,
        packageDir,
        { layerId, trackId: track.id, collection: 'real-key' },
        failures,
        counter,
      );
      const groupOverrideRecords = await materializeRecords(
        physical.groupOverrideRecords ?? [],
        packageDir,
        { layerId, trackId: track.id, collection: 'group-override' },
        failures,
        counter,
      );
      const materializedPhysical: PhysicPaintRotoPhysicalDocument = Object.freeze({
        ...physical,
        realKeyRecords: Object.freeze([...realKeyRecords]),
        groupOverrideRecords: Object.freeze([...groupOverrideRecords]),
        // The revision fingerprint covers the raster carriers, so a
        // materialized document's revision differs from the reference-only
        // one — recompute it over the records actually installed.
        revision: buildPhysicPaintRotoPhysicalRevision(
          realKeyRecords,
          physical.interpolation,
          physical.loopClips,
          physical.incomingInterpolationBreakKeyIds,
          groupOverrideRecords,
        ),
      });
      tracks.push({ ...track, rotoPhysical: materializedPhysical });
    }
    runtimeDocuments.set(layerId, { ...loaded.document, tracks });
  }
  return {
    runtimeDocuments,
    failures: Object.freeze(failures),
    materializedKeys: counter.value,
  };
}
