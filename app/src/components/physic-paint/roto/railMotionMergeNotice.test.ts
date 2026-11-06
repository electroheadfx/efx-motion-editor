import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildRailMotionMergeNoticeCopy,
  createRailMotionMergeNotice,
  dismissRailMotionMergeNotice,
  publishRailMotionMergeNotice,
  railMotionMergeNotice,
} from './railMotionMergeNotice';

const modulePath = resolve(dirname(fileURLToPath(import.meta.url)), 'railMotionMergeNotice.ts');

const validInput = Object.freeze({ railId: 'loop-1', startFrame: 12, endFrameExclusive: 24 });

beforeEach(() => {
  dismissRailMotionMergeNotice();
});

describe('59-12 Task 4: merge-drop notice factory (MOTN-10)', () => {
  it('accepts a bounded rail id and a forward frame span, returning a frozen notice', () => {
    const notice = createRailMotionMergeNotice(validInput);
    expect(notice).toEqual({ railId: 'loop-1', startFrame: 12, endFrameExclusive: 24 });
    expect(Object.isFrozen(notice)).toBe(true);
  });

  it('rejects an empty or unbounded rail id', () => {
    expect(createRailMotionMergeNotice({ ...validInput, railId: '' })).toBeNull();
    expect(createRailMotionMergeNotice({ ...validInput, railId: 'x'.repeat(257) })).toBeNull();
    expect(createRailMotionMergeNotice({ ...validInput, railId: 42 as unknown as string })).toBeNull();
  });

  it('rejects negative, fractional or non-finite frames without repairing them', () => {
    expect(createRailMotionMergeNotice({ ...validInput, startFrame: -1 })).toBeNull();
    expect(createRailMotionMergeNotice({ ...validInput, endFrameExclusive: -1 })).toBeNull();
    expect(createRailMotionMergeNotice({ ...validInput, startFrame: 1.5 })).toBeNull();
    expect(createRailMotionMergeNotice({ ...validInput, endFrameExclusive: Number.POSITIVE_INFINITY })).toBeNull();
    expect(createRailMotionMergeNotice({ ...validInput, startFrame: Number.NaN })).toBeNull();
  });

  it('rejects an inverted or empty range', () => {
    expect(createRailMotionMergeNotice({ railId: 'loop-1', startFrame: 24, endFrameExclusive: 12 })).toBeNull();
    expect(createRailMotionMergeNotice({ railId: 'loop-1', startFrame: 12, endFrameExclusive: 12 })).toBeNull();
  });
});

describe('59-12 Task 4: one session slot with two named writers', () => {
  it('publishes the validated notice into the session signal', () => {
    const published = publishRailMotionMergeNotice(validInput);
    expect(published).toEqual(validInput);
    expect(railMotionMergeNotice.value).toEqual(validInput);
  });

  it('replaces the first notice with the second — one slot, no queue', () => {
    publishRailMotionMergeNotice(validInput);
    publishRailMotionMergeNotice({ railId: 'loop-2', startFrame: 3, endFrameExclusive: 5 });
    expect(railMotionMergeNotice.value).toEqual({ railId: 'loop-2', startFrame: 3, endFrameExclusive: 5 });
  });

  it('an invalid publish changes nothing and reports null', () => {
    publishRailMotionMergeNotice(validInput);
    const rejected = publishRailMotionMergeNotice({ railId: '', startFrame: 0, endFrameExclusive: 1 });
    expect(rejected).toBeNull();
    expect(railMotionMergeNotice.value).toEqual(validInput);
  });

  it('dismiss clears the slot', () => {
    publishRailMotionMergeNotice(validInput);
    dismissRailMotionMergeNotice();
    expect(railMotionMergeNotice.value).toBeNull();
  });
});

describe('59-12 Task 4: copy and non-persistence', () => {
  it('names the dropped frame range verbatim and promises the undo', () => {
    const notice = createRailMotionMergeNotice(validInput);
    expect(notice).not.toBeNull();
    expect(buildRailMotionMergeNoticeCopy(notice!))
      .toBe('Merged rails — motion on frames 12–24 was removed. Undo restores it.');
  });

  it('carries exactly the settlement members, with no document member', () => {
    const notice = createRailMotionMergeNotice(validInput)!;
    expect(Object.keys(notice).sort()).toEqual(['endFrameExclusive', 'railId', 'startFrame']);
    expect(JSON.stringify(notice)).not.toContain('document');
    expect(JSON.stringify(notice)).not.toContain('revision');
    expect(JSON.stringify(notice)).not.toContain('allowlist');
  });

  it('never uses local-state or effect hooks, and writes the signal only in the two writers', () => {
    const code = readFileSync(modulePath, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*\*/.test(line) && !/^\s*\/\//.test(line))
      .join('\n');
    expect(code).not.toMatch(/\buseState\b/);
    expect(code).not.toMatch(/\buseEffect\b/);
    expect(code.split('railMotionMergeNotice.value =').length - 1).toBe(2);
  });
});
