/**
 * Fail-closed load-door parsers for main-app audio and video disk references
 * (261009-rko, 261012-d6q).
 *
 * The .mce members `audio_tracks[]`, `audio_assets[]` and `video_assets[]`
 * carry `source_path` — the absolute on-disk path of the referenced media
 * file — verbatim, and a video layer source carries `video_path` the same way.
 * Heavy media never enter the package (261009-ofk law, generalized to audio
 * and video). BOTH video load doors (`video_assets[]` and the video layer
 * source) route through this file alongside audio.
 *
 * This is the ONLY place the retired-key throw lives; the load doors call it:
 * `imageStore.loadFromMceAudioAssets` / `imageStore.loadFromMceVideoAssets`
 * and the `hydrateFromMce` audio_tracks loop and video layer branch
 * (`projectStore.ts`). Clean break — a member still carrying `relative_path`,
 * or a video layer carrying a relative `video_path` (e.g. `videos/clip.mp4`),
 * throws. No shim, no migration, no accepted alternate key. The layer reader
 * never concatenates anything: an absolute path is returned byte-verbatim.
 */

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Shared record validation + `source_path` read (audio assets/tracks and
 * video_assets[]). Observable behavior byte-unchanged for audio.
 *
 * @param record - raw JSON member carrying a disk reference
 * @param label  - load-door name used in error messages
 * @returns the absolute on-disk path, carried verbatim (no join, no strip)
 */
function readDeclaredSourcePath(record: unknown, label: string): string {
  if (!isPlainRecord(record)) {
    throw new Error(`${label}: expected a record.`);
  }
  if ('relative_path' in record) {
    throw new Error(
      `${label}: retired key relative_path is not accepted; expected source_path (absolute on-disk path).`,
    );
  }
  const sourcePath = record.source_path;
  if (typeof sourcePath !== 'string' || sourcePath.length === 0) {
    throw new Error(`${label}: source_path must be a non-empty string.`);
  }
  return sourcePath;
}

/**
 * Read `source_path` from one manifest audio member.
 *
 * @param record - raw JSON member (`audio_tracks[]` or `audio_assets[]`)
 * @param label  - load-door name used in error messages
 * @returns the absolute on-disk path, carried verbatim (no join, no strip)
 */
export function readMceAudioSourcePath(record: unknown, label: string): string {
  return readDeclaredSourcePath(record, label);
}

/**
 * Read `source_path` from one `video_assets[]` manifest member (261012-d6q).
 * Identical contract to the audio reader: non-record throws; the retired
 * `relative_path` key throws; `source_path` must be a non-empty string.
 *
 * @returns the absolute on-disk video path, carried verbatim
 */
export function readMceVideoAssetSourcePath(record: unknown, label: string): string {
  return readDeclaredSourcePath(record, label);
}

/**
 * Read the video path from one raw video layer source record (261012-d6q).
 *
 * - non-record throws
 * - a `relative_path` member throws (retired key)
 * - absent or empty `video_path` → `''` (a layer with no source keeps its
 *   empty-path behavior)
 * - a non-empty `video_path` MUST be absolute (start with `/`); the retired
 *   relative form (e.g. `videos/clip.mp4`) throws naming it
 *
 * This function never concatenates anything — the returned value is the
 * record's own bytes, verbatim.
 */
export function readMceVideoLayerPath(record: unknown, label: string): string {
  if (!isPlainRecord(record)) {
    throw new Error(`${label}: expected a record.`);
  }
  if ('relative_path' in record) {
    throw new Error(
      `${label}: retired key relative_path is not accepted; expected video_path (absolute on-disk source path).`,
    );
  }
  const videoPath = record.video_path;
  if (videoPath === undefined || videoPath === null) return '';
  if (typeof videoPath !== 'string') {
    throw new Error(`${label}: video_path must be a string.`);
  }
  if (videoPath.length === 0) return '';
  if (!videoPath.startsWith('/')) {
    throw new Error(
      `${label}: retired relative video_path '${videoPath}' is not accepted; expected video_path as an absolute on-disk source path.`,
    );
  }
  return videoPath;
}
