/**
 * Fail-closed load-door parser for main-app audio disk references (261009-rko).
 *
 * The .mce members `audio_tracks[]` and `audio_assets[]` carry `source_path` —
 * the absolute on-disk path of the referenced media file — verbatim. Heavy media
 * never enter the package (261009-ofk law, generalized to main-app audio).
 *
 * This is the ONLY place the retired-key throw lives; both load doors call it:
 * `imageStore.loadFromMceAudioAssets` (gallery `audio_assets`) and the
 * `hydrateFromMce` audio_tracks loop (`projectStore.ts`). Clean break — a member
 * still carrying `relative_path` throws; no shim, no migration, no accepted
 * alternate key.
 */

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Read `source_path` from one manifest audio member.
 *
 * @param record - raw JSON member (`audio_tracks[]` or `audio_assets[]`)
 * @param label  - load-door name used in error messages
 * @returns the absolute on-disk path, carried verbatim (no join, no strip)
 */
export function readMceAudioSourcePath(record: unknown, label: string): string {
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
