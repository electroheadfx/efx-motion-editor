import { describe, it } from 'vitest';

describe('exportRenderer', () => {
  describe('renderGlobalFrame', () => {
    it.todo('renders a single content frame identically to Preview.tsx');
    it.todo('renders cross-dissolve overlap with correct blending');
    it.todo('renders FX overlay sequences with keyframe interpolation');
    it.todo('renders content-overlay sequences with fade opacity');
    it.todo('handles solid fade overlay with computed alpha');
  });

  describe('preloadExportImages', () => {
    it.todo('resolves when all images are loaded');
    it.todo('resolves immediately if all images already cached');
  });

  // buildSequenceFrames is module-internal (not exported).
  // These tests require buildSequenceFrames to be exported or tested indirectly via renderGlobalFrame.
  // Plan 01/03 may export it or test solid behavior through renderGlobalFrame integration tests.
  describe('buildSequenceFrames solid/transparent', () => {
    it.todo('carries solidColor field from KeyPhoto to FrameEntry');
    it.todo('carries isTransparent field from KeyPhoto to FrameEntry');
    it.todo('produces empty imageId for solid/transparent entries');
  });

  describe('preloadExportImages with solids', () => {
    it.todo('filters empty imageId strings from preload set');
  });

  describe('GL transition rendering (GLT-04)', () => {
    it.todo('renders GL transition overlap via dual-capture when overlap has glTransition');
    it.todo('calls renderGlslTransition with correct shader, canvases, and progress');
    it.todo('preserves existing cross-dissolve rendering when overlap has no glTransition');
    it.todo('creates and reuses offscreen canvases for dual-capture');
    it.todo('computes eased progress via computeTransitionProgress');
  });
});
