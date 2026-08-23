import { describe, expect, it } from 'vitest';
import { findLegacyPhysicPaintRejection } from './efxPaintCleanBreak';
import legacyPhysicPaintOutputs from './__fixtures__/legacy-physic-paint-outputs.mce.json';
import legacyCacheReference from './__fixtures__/legacy-cache-reference.mce.json';
import documentlessPhysicPaintLayer from './__fixtures__/documentless-physic-paint-layer.mce.json';
import cleanPreV1Project from './__fixtures__/clean-pre-v1-project.mce.json';
import freshV1Project from './__fixtures__/fresh-v1-project.mce.json';

describe('findLegacyPhysicPaintRejection — legacy-physic-paint-outputs trigger', () => {
  it('rejects a legacy project with a non-empty physic_paint_outputs array', () => {
    expect(findLegacyPhysicPaintRejection(legacyPhysicPaintOutputs)).toEqual({
      kind: 'legacy-physic-paint-outputs',
    });
  });

  it('is pure — repeated calls return equal results and the input is deep-unchanged', () => {
    const input = JSON.parse(JSON.stringify(legacyPhysicPaintOutputs));
    const before = JSON.stringify(input);
    const first = findLegacyPhysicPaintRejection(input);
    const second = findLegacyPhysicPaintRejection(input);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('returns null for non-record input — the gate scans, it does not throw', () => {
    expect(findLegacyPhysicPaintRejection(null)).toBeNull();
    expect(findLegacyPhysicPaintRejection([])).toBeNull();
    expect(findLegacyPhysicPaintRejection('legacy')).toBeNull();
    expect(findLegacyPhysicPaintRejection(42)).toBeNull();
  });
});

describe('findLegacyPhysicPaintRejection — full D-06 truth table', () => {
  it('rejects a project carrying a legacy cache/physic-paint path reference and reports the offending path', () => {
    expect(findLegacyPhysicPaintRejection(legacyCacheReference)).toEqual({
      kind: 'legacy-physic-paint-cache-reference',
      path: 'cache/physic-paint/legacy-frame.png',
    });
  });

  it('rejects a physic-paint layer with no efx_paint_documents entry for its layer id', () => {
    expect(findLegacyPhysicPaintRejection(documentlessPhysicPaintLayer)).toEqual({
      kind: 'physic-paint-layer-without-document',
      layerId: 'layer-legacy-1',
    });
  });

  it('passes an old project without Physic Paint data — including an inline paint layer (D-06 final clause)', () => {
    expect(findLegacyPhysicPaintRejection(cleanPreV1Project)).toBeNull();
  });

  it('passes a fresh v1.0 project whose physic-paint layer has a matching efx_paint_documents entry (Pitfall F2)', () => {
    expect(findLegacyPhysicPaintRejection(freshV1Project)).toBeNull();
  });

  it('returns the first reason in fixed precedence order: outputs → cache-reference → documentless-layer', () => {
    const base = {
      version: 15,
      name: 'Precedence',
      fps: 24,
      width: 1920,
      height: 1080,
      created_at: '2026-01-15T10:00:00.000Z',
      modified_at: '2026-01-15T10:00:00.000Z',
      sequences: [
        {
          id: 'seq-1',
          name: 'Sequence 1',
          fps: 24,
          width: 1920,
          height: 1080,
          order: 0,
          key_photos: [],
          layers: [
            {
              id: 'layer-legacy-1',
              name: 'Physic Paint',
              type: 'physic-paint',
              visible: true,
              opacity: 1,
              blend_mode: 'normal',
              transform: {
                x: 0,
                y: 0,
                scale_x: 1,
                scale_y: 1,
                rotation: 0,
                crop_top: 0,
                crop_right: 0,
                crop_bottom: 0,
                crop_left: 0,
              },
              source: { type: 'physic-paint', layer_id: 'layer-legacy-1' },
              is_base: false,
              order: 0,
            },
          ],
        },
      ],
      images: [],
      physic_paint_outputs: [{ layer_id: 'layer-legacy-1', frames: [] }],
      cache_path: 'cache/physic-paint/legacy-frame.png',
    };

    // All three triggers present → outputs wins.
    expect(findLegacyPhysicPaintRejection(base)).toEqual({
      kind: 'legacy-physic-paint-outputs',
    });

    // Without outputs → cache-reference wins over documentless-layer.
    const withoutOutputs = { ...base, physic_paint_outputs: [] };
    expect(findLegacyPhysicPaintRejection(withoutOutputs)).toEqual({
      kind: 'legacy-physic-paint-cache-reference',
      path: 'cache/physic-paint/legacy-frame.png',
    });

    // Without outputs and cache ref → documentless-layer.
    const withoutCacheRef = { ...withoutOutputs };
    delete withoutCacheRef.cache_path;
    expect(findLegacyPhysicPaintRejection(withoutCacheRef)).toEqual({
      kind: 'physic-paint-layer-without-document',
      layerId: 'layer-legacy-1',
    });
  });

  it('passes a physic-paint layer whose document entry exists but is malformed — document parse failures belong to the load-time parser', () => {
    const project = {
      version: 16,
      name: 'Malformed Document Entry',
      fps: 24,
      width: 1920,
      height: 1080,
      created_at: '2026-08-23T10:00:00.000Z',
      modified_at: '2026-08-23T10:00:00.000Z',
      sequences: [
        {
          id: 'seq-1',
          name: 'Sequence 1',
          fps: 24,
          width: 1920,
          height: 1080,
          order: 0,
          key_photos: [],
          layers: [
            {
              id: 'layer-v1-1',
              name: 'Physic Paint',
              type: 'physic-paint',
              visible: true,
              opacity: 1,
              blend_mode: 'normal',
              transform: {
                x: 0,
                y: 0,
                scale_x: 1,
                scale_y: 1,
                rotation: 0,
                crop_top: 0,
                crop_right: 0,
                crop_bottom: 0,
                crop_left: 0,
              },
              source: { type: 'physic-paint', layer_id: 'layer-v1-1' },
              is_base: false,
              order: 0,
            },
          ],
        },
      ],
      images: [],
      efx_paint_documents: {
        'layer-v1-1': { version: 1, parentLayerId: 'layer-v1-1' },
      },
    };
    expect(findLegacyPhysicPaintRejection(project)).toBeNull();
  });
});
