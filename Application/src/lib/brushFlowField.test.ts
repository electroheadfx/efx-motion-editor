import {describe, it, expect} from 'vitest';

describe('brushFlowField', () => {
  describe('createFlowField', () => {
    it.todo('creates a FlowField with correct cols and rows for given dimensions');
    it.todo('grid contains angles in 0 to 2*PI range');
    it.todo('uses default cellSize of 20 when not specified');
  });

  describe('sampleField', () => {
    it.todo('returns angle at given pixel position');
    it.todo('clamps to grid boundaries for out-of-range positions');
  });

  describe('applyFlowField', () => {
    it.todo('displaces points along flow field direction');
    it.todo('zero strength returns original points unchanged');
    it.todo('higher strength produces larger displacement');
  });

  describe('getFlowField', () => {
    it.todo('caches field for same dimensions');
    it.todo('recreates field when dimensions change');
  });
});
