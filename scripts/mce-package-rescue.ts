/**
 * 52.2-08 (D-08): the dev-only rescue converter — a pre-52.2 `.mce` file into a
 * v1.0 `Name.mce/` package.
 *
 * WHY THIS IS NOT SHIPPED CODE
 * The app refuses pre-52.2 projects outright (the `formatVersion` gate in
 * `app/src/efx-paint/document/efxPaintCleanBreak.ts`), so the only way a
 * pre-52.2 file crosses the clean break is by hand, in a terminal. This file
 * lives outside `app/src`, is wired into no build step, no `app/package.json`
 * script and no `tauri.conf.json` bundle resource, and it names the retired
 * carriers out loud precisely because it is the one place allowed to.
 *
 * WHAT IT DOES
 *   1. reads the pre-52.2 project FILE (a v1.0 `.mce` is a directory — this
 *      refuses one, and it refuses a file that is already a package manifest);
 *   2. decodes every real key's inline Base64 raster — both roto collections of
 *      every layer document — and writes it to `frames/<layerId>/<keyId>.webp`;
 *   3. rewrites each layer document with `media` references (package-relative
 *      path + SHA-256 of the exact bytes) and no inline raster, into
 *      `layers/<layerId>.json`;
 *   4. writes `project.mce` through the shared `buildPackageManifest`, so the
 *      manifest carries `formatVersion`, `projectId` and the `efxPaint` index
 *      and nothing the package format retires.
 *
 * ALL OR NOTHING: every key is resolved in memory first. One key with no pixel
 * source, one undecodable payload or one unsafe id aborts the whole run with a
 * non-zero exit and no output written at all — a half-converted package would
 * be worse than none, because it would look loadable.
 *
 * The one real project this exists for is converted exactly once, by hand,
 * before UAT (plan 52.2-16); this script never reads a project it was not
 * pointed at.
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  PKG_FORMAT_VERSION,
  buildFrameMediaRelativePath,
  buildLayerFileRelativePath,
  buildPackageManifest,
} from '../app/src/lib/efxPaintPackage.ts';

/**
 * The two carriers the package format retires and the converter consumes
 * (D-04): the layer documents map (its content becomes `layers/*.json`) and the
 * pre-52.2 opaque paint-output array (derived PNG caches the app re-derives).
 * Both are dropped from the emitted manifest rather than carried across.
 */
const RETIRED_PROJECT_CARRIERS = ['efx_paint_documents', 'physic_paint_outputs'] as const;

/** The retired layer documents map, named where it is read. */
const RETIRED_LAYER_DOCUMENTS_KEY = 'efx_paint_documents';

/** The package files this tool owns: everything else at `--out` is not ours. */
const OWNED_OUTPUT_ENTRIES = ['project.mce', 'layers', 'frames'] as const;

const USAGE = [
  'mce-package-rescue — convert a pre-52.2 .mce project into a v1.0 package.',
  '',
  'Usage:',
  '  node scripts/mce-package-rescue.ts --in <pre-52.2>.mce --out <directory>',
  '',
  '  --in    the pre-52.2 project FILE (not a v1.0 .mce package directory)',
  '  --out   the package root to create: project.mce, layers/<layerId>.json',
  '          and frames/<layerId>/<keyId>.webp land there',
  '  --help  this text',
  '',
  'The input is never modified and never written into. --out may hold a',
  `previous run of this tool (only ${OWNED_OUTPUT_ENTRIES.join(', ')} are ever`,
  'replaced); any other non-empty directory is refused.',
].join('\n');

interface RescueArgs {
  readonly input: string;
  readonly output: string;
}

/** One media file the run will emit, with the exact bytes to write there. */
interface MediaPlan {
  readonly relativePath: string;
  readonly bytes: Buffer;
}

/**
 * The whole conversion, resolved in memory before a single byte is written.
 * `failures` is the run's veto: a non-empty list means nothing gets written.
 */
interface RescuePlan {
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly layerFiles: readonly { readonly relativePath: string; readonly json: string }[];
  readonly media: readonly MediaPlan[];
  readonly skipped: readonly string[];
  readonly warnings: readonly string[];
}

function fail(message: string): never {
  throw new Error(message);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A positive integer, or undefined when the value is not one (never 0/NaN). */
function positiveIntegerOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function decodeInlineBytes(base64: string): Buffer {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) fail('the inline raster decoded to zero bytes');
  return bytes;
}

function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** `RIFF….WEBP` — the container every `frames/**\/*.webp` file must be. */
function isWebpShaped(bytes: Buffer): boolean {
  return bytes.length >= 12
    && bytes.toString('latin1', 0, 4) === 'RIFF'
    && bytes.toString('latin1', 8, 12) === 'WEBP';
}

function parseArgs(argv: readonly string[]): RescueArgs | null {
  let input = '';
  let output = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') return null;
    if (arg === '--in') {
      input = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg === '--out') {
      output = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    fail(`unknown argument "${arg}"\n\n${USAGE}`);
  }
  if (input.length === 0 || output.length === 0) fail(`--in and --out are both required\n\n${USAGE}`);
  return { input: resolve(input), output: resolve(output) };
}

/**
 * Project ONE roto record collection (`realKeyRecords` or
 * `groupOverrideRecords` — they share `PhysicPaintRotoRealKeyRecord`) onto the
 * persisted media-carrying shape. This mirrors the app's
 * `toPersistedRotoRecords` + `buildMediaPayload` deliberately rather than
 * importing them: that module graph reaches the document model, and this script
 * must stay a two-import standalone. The payload is rebuilt from allowlisted
 * members only, so no inline raster can survive the projection.
 */
function projectRecords(
  collection: readonly unknown[],
  layerId: string,
  failures: string[],
  plan: { media: MediaPlan[]; skipped: string[]; warnings: string[] },
): unknown[] {
  const projected: unknown[] = [];
  for (const value of collection) {
    if (!isRecord(value)) {
      failures.push(`${layerId}: a roto record is not an object`);
      continue;
    }
    const keyId = typeof value.keyId === 'string' ? value.keyId : '';
    if (keyId.length === 0) {
      failures.push(`${layerId}: a roto record carries no keyId`);
      continue;
    }
    const payload = isRecord(value.payload) ? value.payload : null;
    if (payload === null) {
      failures.push(`${layerId}/${keyId}: payload is not an object`);
      continue;
    }
    if (payload.media !== undefined) {
      plan.skipped.push(`${layerId}/${keyId} already carries a media reference`);
      projected.push(value);
      continue;
    }
    const base64 = payload.bytes;
    if (typeof base64 !== 'string' || base64.length === 0) {
      failures.push(`${layerId}/${keyId}: payload carries neither media nor an inline raster — nothing to rescue`);
      continue;
    }
    let bytes: Buffer;
    try {
      bytes = decodeInlineBytes(base64);
    } catch (error) {
      failures.push(`${layerId}/${keyId}: inline raster undecodable (${messageOf(error)})`);
      continue;
    }
    let relativePath: string;
    try {
      relativePath = buildFrameMediaRelativePath(layerId, keyId);
    } catch {
      failures.push(`${layerId}/${keyId}: not a safe single path segment — refusing to build a frames/ path`);
      continue;
    }
    if (!isWebpShaped(bytes)) {
      plan.warnings.push(`${layerId}/${keyId} (${bytes.length} B) is not WebP-shaped; bytes carried through unchanged`);
    }
    const width = positiveIntegerOrUndefined(payload.width);
    const height = positiveIntegerOrUndefined(payload.height);
    plan.media.push({ relativePath, bytes });
    projected.push({
      kind: 'real-key',
      keyId,
      appFrame: value.appFrame,
      payload: {
        frameIndex: payload.frameIndex,
        appFrame: payload.appFrame,
        media: {
          relativePath,
          digest: sha256Hex(bytes),
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
        },
      },
    });
  }
  return projected;
}

/**
 * Project one track: its roto collections gain media references, and its
 * derived-frame cache map is emptied. The cache is machine-local derived data
 * the package never ships (D-14), and its pre-52.2 `cache/efx-paint/…` shape is
 * exactly what the package's cache guard refuses — so it is dropped rather than
 * rewritten, and the app re-derives those frames from the authoritative keys.
 */
function projectTrack(
  track: unknown,
  layerId: string,
  failures: string[],
  plan: { media: MediaPlan[]; skipped: string[]; warnings: string[] },
): unknown {
  if (!isRecord(track)) {
    failures.push(`${layerId}: a track is not an object`);
    return track;
  }
  const roto = isRecord(track.rotoPhysical) ? track.rotoPhysical : null;
  const nextRoto = roto === null ? track.rotoPhysical : {
    ...roto,
    ...(Array.isArray(roto.realKeyRecords)
      ? { realKeyRecords: projectRecords(roto.realKeyRecords, layerId, failures, plan) }
      : {}),
    ...(Array.isArray(roto.groupOverrideRecords)
      ? { groupOverrideRecords: projectRecords(roto.groupOverrideRecords, layerId, failures, plan) }
      : {}),
  };
  const cacheRefs = isRecord(track.frames) ? Object.keys(track.frames).length : 0;
  if (cacheRefs > 0) {
    const trackId = typeof track.id === 'string' ? track.id : '?';
    plan.skipped.push(`${layerId}/${trackId}: ${cacheRefs} derived-frame cache ref(s) dropped (machine-local, re-derived — D-14)`);
  }
  return { ...track, frames: {}, rotoPhysical: nextRoto };
}

/** Project one layer document; the map key is the layer's identity. */
function projectDocument(
  layerId: string,
  document: Record<string, unknown>,
  failures: string[],
  plan: { media: MediaPlan[]; skipped: string[]; warnings: string[] },
): Record<string, unknown> {
  const tracks = Array.isArray(document.tracks) ? document.tracks : [];
  if (tracks.length === 0) plan.skipped.push(`${layerId}: document carries no tracks`);
  return {
    ...document,
    ...(typeof document.parentLayerId === 'string' ? {} : { parentLayerId: layerId }),
    tracks: tracks.map((track) => projectTrack(track, layerId, failures, plan)),
  };
}

/**
 * Resolve the whole conversion in memory. Throws `RescueRefusal` (via `fail`)
 * on anything that makes the input unusable as a whole; per-key failures are
 * collected in `failures` and veto the write phase.
 */
function planRescue(project: Record<string, unknown>): { plan: RescuePlan; failures: string[] } {
  if (project.formatVersion !== undefined) {
    fail(
      `the input already declares formatVersion ${JSON.stringify(project.formatVersion)} — `
      + 'it is a package manifest, not a pre-52.2 project',
    );
  }
  const documents = isRecord(project[RETIRED_LAYER_DOCUMENTS_KEY])
    ? (project[RETIRED_LAYER_DOCUMENTS_KEY] as Record<string, unknown>)
    : null;
  if (documents === null) {
    fail(`the input carries no "${RETIRED_LAYER_DOCUMENTS_KEY}" map — nothing to rescue`);
  }

  const failures: string[] = [];
  const collected = { media: [] as MediaPlan[], skipped: [] as string[], warnings: [] as string[] };
  const layerFiles: { relativePath: string; json: string }[] = [];
  const layerIndex: Record<string, { layerFile: string; documentRevision: string; compositeRevision: string }> = {};

  for (const layerId of Object.keys(documents).sort()) {
    const document = documents[layerId];
    if (!isRecord(document)) {
      failures.push(`${layerId}: the layer document is not an object`);
      continue;
    }
    const projected = projectDocument(layerId, document, failures, collected);
    let relativePath: string;
    try {
      relativePath = buildLayerFileRelativePath(layerId);
    } catch {
      failures.push(`${layerId}: not a safe single path segment — refusing to build a layers/ path`);
      continue;
    }
    layerFiles.push({ relativePath, json: `${JSON.stringify(projected, null, 2)}\n` });
    // The canonical revisions are computed by the app's parser graph, which a
    // standalone script cannot load. An EMPTY revision is this codebase's
    // existing "unreachable" value (see PhysicPaintApplyResult.documentRevision),
    // so the reader knows to recompute instead of trusting a fabricated digest.
    layerIndex[layerId] = { layerFile: relativePath, documentRevision: '', compositeRevision: '' };
  }

  const projectFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(project)) {
    if ((RETIRED_PROJECT_CARRIERS as readonly string[]).includes(key)) continue;
    projectFields[key] = value;
  }
  const manifest = buildPackageManifest({ project: projectFields, layerIndex, projectId: randomUUID() });

  return {
    plan: {
      manifest,
      layerFiles,
      media: collected.media,
      skipped: collected.skipped,
      warnings: collected.warnings,
    },
    failures,
  };
}

/**
 * Prepare `--out`: never the input file, never the input's own directory, and
 * never an unrelated directory. Only the entries this tool owns may be replaced.
 */
function prepareOutput(outputDir: string, inputPath: string): void {
  if (outputDir === inputPath) fail('--out is the input file — this tool never writes in place');
  if (outputDir === dirname(inputPath)) fail('--out is the input directory — refusing to write into it');
  if (existsSync(outputDir)) {
    if (!statSync(outputDir).isDirectory()) fail(`--out "${outputDir}" exists and is not a directory`);
    const foreign = readdirSync(outputDir).filter(
      (entry) => !(OWNED_OUTPUT_ENTRIES as readonly string[]).includes(entry),
    );
    if (foreign.length > 0) {
      fail(`--out "${outputDir}" already holds ${foreign.join(', ')} — point --out at a fresh directory`);
    }
    for (const entry of OWNED_OUTPUT_ENTRIES) rmSync(join(outputDir, entry), { recursive: true, force: true });
    console.log(`replaced  previous rescue output at ${outputDir}`);
  }
  mkdirSync(outputDir, { recursive: true });
}

function main(): number {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args === null) {
      console.log(USAGE);
      return 0;
    }

    if (!existsSync(args.input)) fail(`--in "${args.input}" does not exist`);
    if (!statSync(args.input).isFile()) {
      fail(`--in "${args.input}" is not a file — a v1.0 .mce is a package DIRECTORY; pass the pre-52.2 project file`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(args.input, 'utf8'));
    } catch (error) {
      fail(`--in "${args.input}" is not readable JSON (${messageOf(error)})`);
    }
    if (!isRecord(parsed)) fail(`--in "${args.input}" is not a JSON object`);

    const { plan, failures } = planRescue(parsed);

    console.log('mce-package-rescue');
    console.log(`  in    ${args.input}`);
    console.log(`  out   ${args.output}`);
    console.log('');

    if (failures.length > 0) {
      for (const failure of failures) console.log(`FAILED   ${failure}`);
      for (const warning of plan.warnings) console.log(`warning  ${warning}`);
      console.log('');
      console.log(`  NOTHING WAS WRITTEN — ${failures.length} key(s)/layer(s) could not be converted.`);
      return 1;
    }

    prepareOutput(args.output, args.input);

    // Media first, then the layer sub-files, then the manifest — the same order
    // the app's package save writes them in.
    for (const entry of plan.media) {
      const destination = join(args.output, entry.relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, entry.bytes);
      console.log(`written  ${entry.relativePath}  (${entry.bytes.length} B, sha256 ${sha256Hex(entry.bytes).slice(0, 12)}…)`);
    }
    for (const layer of plan.layerFiles) {
      const destination = join(args.output, layer.relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, layer.json);
      console.log(`written  ${layer.relativePath}`);
    }
    writeFileSync(join(args.output, 'project.mce'), `${JSON.stringify(plan.manifest, null, 2)}\n`);
    console.log(
      `written  project.mce  (formatVersion ${PKG_FORMAT_VERSION}, `
      + `projectId ${String(plan.manifest.projectId)}, ${plan.layerFiles.length} layer(s))`,
    );

    for (const skipped of plan.skipped) console.log(`skipped  ${skipped}`);
    for (const warning of plan.warnings) console.log(`warning  ${warning}`);
    console.log('');
    console.log(
      `  ${plan.layerFiles.length} layer(s), ${plan.media.length} key(s) rescued, `
      + `${plan.media.length + plan.layerFiles.length + 1} file(s) written, `
      + `${plan.skipped.length} skipped, 0 failed`,
    );
    return 0;
  } catch (error) {
    console.error(`mce-package-rescue: ${messageOf(error)}`);
    return 1;
  }
}

// Exit through the code, never through `process.exit`: stdout to a pipe is
// asynchronous, and an early exit truncates the per-file summary this tool is
// read for.
process.exitCode = main();
