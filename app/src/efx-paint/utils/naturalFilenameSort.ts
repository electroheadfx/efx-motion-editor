import type { ImportedImage } from '../../types/image';

/**
 * D-02 natural original-filename ordering (Phase 49-02, Task 1).
 *
 * Orders images by their ORIGINAL FILENAME basename using a
 * numeric-aware, case-insensitive collator — `shot_1 < shot_2 < shot_10`.
 * Asset UUIDs (UUID v4 per image_pool.rs:57) are arbitrary and must never
 * participate in the comparison. Basename extraction mirrors
 * imageStore.ts:199 (`original_path.split('/').pop()` with full-path
 * fallback when no separator exists).
 *
 * 49-04 (Task 2): the sort is generic over a basename getter so the scoped
 * asset picker can order `MceImageRef` rows by their `original_filename`
 * (already the basename) through the SAME canonical collator — one ordering
 * authority for the main editor and the Studio picker (BKG-02/D-02).
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
 * relative order (stable sort). The default basename getter reads
 * `original_path` (ImportedImage); pass a custom getter for other shapes
 * (e.g. `(image) => image.original_filename` for MceImageRef).
 */
export function sortImagesByOriginalFilename<T>(
  images: readonly T[],
  basename: (image: T) => string = (image) => originalBasename(image as ImportedImage),
): T[] {
  return [...images].sort((a, b) =>
    naturalFilenameCollator.compare(basename(a), basename(b)),
  );
}
