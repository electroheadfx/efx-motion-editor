import {describe, it, expect} from 'vitest';

describe('brushWatercolor', () => {
  describe('seedableGaussian', () => {
    it.todo('produces deterministic sequence for same seed');
    it.todo('produces different sequences for different seeds');
    it.todo('output follows approximately Gaussian distribution');
  });

  describe('deformPolygon', () => {
    it.todo('doubles the number of vertices (midpoint insertion)');
    it.todo('midpoints are displaced by variance-scaled random values');
    it.todo('original vertices are preserved in output');
  });

  describe('renderWatercolorLayers', () => {
    it.todo('returns layerCount polygon arrays');
    it.todo('default layerCount is 7');
    it.todo('each layer has more vertices than the input outline');
    it.todo('same seed produces identical layers (deterministic)');
  });

  describe('polygonToTriangles', () => {
    it.todo('produces 3 * polygon.length float values (fan triangulation)');
    it.todo('each triangle includes the center point');
  });

  describe('polygonCenter', () => {
    it.todo('returns centroid of polygon vertices');
  });
});
