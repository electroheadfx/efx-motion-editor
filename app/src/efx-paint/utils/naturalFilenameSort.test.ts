import { describe, expect, it } from 'vitest';
import type { ImportedImage } from '../../types/image';
import { sortImagesByOriginalFilename } from './naturalFilenameSort';

/**
 * D-02 natural original-filename ordering contract (Phase 49-02, Task 1).
 *
 * `sortImagesByOriginalFilename` orders by ORIGINAL FILENAME basename using
 * `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` — so
 * `shot_1 < shot_2 < shot_10` — and never sorts by asset UUID (assets are
 * UUID v4 per image_pool.rs:57). The comparison is stable for equal
 * basenames and falls back to the full `original_path` when no basename
 * separator exists (basename extraction mirrors imageStore.ts:199).
 */

function image(id: string, original_path: string): ImportedImage {
  return {
    id,
    original_path,
    project_path: `/project/${original_path}`,
    thumbnail_path: `/project/thumbs/${original_path}`,
    width: 100,
    height: 100,
    format: 'png',
  };
}

describe('sortImagesByOriginalFilename', () => {
  it('orders numeric-suffixed filenames naturally (shot_1 < shot_2 < shot_10)', () => {
    const input = [
      image('uuid-3', 'shot_10.png'),
      image('uuid-2', 'shot_2.png'),
      image('uuid-1', 'shot_1.png'),
    ];
    const sorted = sortImagesByOriginalFilename(input);
    expect(sorted.map((img) => img.original_path)).toEqual([
      'shot_1.png',
      'shot_2.png',
      'shot_10.png',
    ]);
  });

  it('orders UUID-named assets by original filename, never by asset id, and is stable for equal basenames', () => {
    // Asset ids are UUID v4 (arbitrary); ordering must come from the
    // original filename only.
    const input = [
      image('9f8e7d6c-5b4a-3210-fedc-ba9876543210', 'b_roll.png'),
      image('01234567-89ab-cdef-0123-456789abcdef', 'a_roll.png'),
      image('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'c_roll.png'),
    ];
    const sorted = sortImagesByOriginalFilename(input);
    expect(sorted.map((img) => img.original_path)).toEqual([
      'a_roll.png',
      'b_roll.png',
      'c_roll.png',
    ]);

    // Stability: two assets with identical original filenames keep their
    // input relative order.
    const stableInput = [
      image('uuid-first', 'same_name.png'),
      image('uuid-second', 'same_name.png'),
    ];
    const stableSorted = sortImagesByOriginalFilename(stableInput);
    expect(stableSorted.map((img) => img.id)).toEqual(['uuid-first', 'uuid-second']);
  });

  it('falls back to the full path when no basename separator exists and compares case-insensitively', () => {
    // No '/' separator: the full original_path string is the sort key.
    const bareInput = [
      image('uuid-2', 'bare_filename_b.png'),
      image('uuid-1', 'bare_filename_a.png'),
    ];
    const bareSorted = sortImagesByOriginalFilename(bareInput);
    expect(bareSorted.map((img) => img.original_path)).toEqual([
      'bare_filename_a.png',
      'bare_filename_b.png',
    ]);

    // Case variants compare case-insensitively (sensitivity: 'base').
    const caseInput = [
      image('uuid-2', 'Shot_2.png'),
      image('uuid-1', 'shot_1.png'),
    ];
    const caseSorted = sortImagesByOriginalFilename(caseInput);
    expect(caseSorted.map((img) => img.original_path)).toEqual([
      'shot_1.png',
      'Shot_2.png',
    ]);
  });

  it('does not mutate the input array and returns an empty array for empty input', () => {
    const input = [
      image('uuid-3', 'shot_10.png'),
      image('uuid-2', 'shot_2.png'),
      image('uuid-1', 'shot_1.png'),
    ];
    const snapshot = input.map((img) => ({ ...img }));
    const sorted = sortImagesByOriginalFilename(input);
    expect(sorted).not.toBe(input);
    expect(input).toEqual(snapshot);
    expect(input.map((img) => img.original_path)).toEqual([
      'shot_10.png',
      'shot_2.png',
      'shot_1.png',
    ]);

    expect(sortImagesByOriginalFilename([])).toEqual([]);
  });
});
