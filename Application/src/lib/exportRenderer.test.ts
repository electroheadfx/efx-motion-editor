import { describe, it, expect } from 'vitest';

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
});
