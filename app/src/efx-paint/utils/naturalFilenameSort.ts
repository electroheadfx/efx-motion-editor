import type { ImportedImage } from '../../types/image';

/**
 * D-02 natural original-filename ordering (Phase 49-02, Task 1).
 *
 * Orders imported images by their ORIGINAL FILENAME basename using a
 * numeric-aware, case-insensitive collator — `shot_1 < shot_2 < shot_10`.
 * Asset UUIDs (UUID v4 per image_pool.rs:57) are arbitrary and must never
 * participate in the comparison. Basename extraction mirrors
 * imageStore.ts:199 (`original_path.split('/').pop()` with full-path
 * fallback when no separator exists).
 */

const naturalFilenameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

function originalBasename(image: ImportedImage): string {
  return image.original_path.split('/').pop() ?? image.original_path;
}

/**
 * Return a NEW array of images sorted by original-filename basename.
 * The input array is never mutated; equal basenames keep their input
 * relative order (stable sort).
 */
export function sortImagesByOriginalFilename(
  images: readonly ImportedImage[],
): ImportedImage[] {
  return [...images].sort((a, b) =>
    naturalFilenameCollator.compare(originalBasename(a), originalBasename(b)),
  );
}
