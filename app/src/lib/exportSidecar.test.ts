import { describe, it } from 'vitest';

describe('exportSidecar', () => {
  describe('generateJsonSidecar', () => {
    it.todo('includes version, generator, and exportDate fields');
    it.todo('includes project metadata (name, fps, width, height)');
    it.todo('includes output metadata (format, totalFrames, duration)');
    it.todo('maps content sequences with transition info');
    it.todo('produces valid JSON');
  });

  describe('generateFcpxml', () => {
    it.todo('produces valid FCPXML 1.11 structure');
    it.todo('uses correct rational time for duration');
    it.todo('references the video filename');
  });
});
