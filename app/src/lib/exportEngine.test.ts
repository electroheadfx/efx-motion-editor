import { describe, it } from 'vitest';

describe('exportEngine', () => {
  describe('formatFrameFilename', () => {
    it.todo('zero-pads frame number to 4 digits by default');
    it.todo('uses more digits when totalFrames >= 10000');
    it.todo('sanitizes project name (replaces special chars with _)');
    it.todo('applies naming pattern correctly');
  });

  describe('startExport', () => {
    it.todo('returns error when no output folder selected');
    it.todo('returns error when timeline is empty');
    it.todo('updates progress status through lifecycle');
    it.todo('respects cancel signal between frames');
  });

  describe('resumeExport', () => {
    it.todo('starts from resumeFromFrame when available');
  });
});
