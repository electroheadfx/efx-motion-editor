import {describe, it, expect, beforeEach} from 'vitest';
import {projectStore} from './projectStore';
import {sequenceStore} from './sequenceStore';
import {imageStore} from './imageStore';
import {audioStore} from './audioStore';
import {motionBlurStore} from './motionBlurStore';
import {exportStore} from './exportStore';
import {physicPaintStore} from './physicPaintStore';
import type {RuntimeMceProject} from '../types/project';
import type {Sequence} from '../types/sequence';
import type {Layer} from '../types/layer';

/**
 * v1.0.1 field-drop-hole closure (N1-N4): save -> serde -> hydrate must carry
 * every value the TS side emits. A key either language omits is silently
 * dropped at the Rust serde boundary (261012-d6q dual-language law), so each
 * fix gets a round-trip pin here on the emit+hydrate half, and in
 * `project_io.rs::test_save_and_open_roundtrip` on the serde half.
 */

function makeVideoLayer(): Layer {
  return {
    id: 'layer-vid',
    name: 'Video',
    type: 'video',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, cropTop: 0, cropRight: 0, cropBottom: 0, cropLeft: 0},
    source: {type: 'video', videoAssetId: 'vid-1'},
    isBase: false,
    keyframes: [{
      frame: 10,
      easing: 'linear',
      values: {
        opacity: 1,
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        blur: 0,
        sourceOverrides: {density: 0.35, size: 2},
      },
    }],
  };
}

function makeSequence(): Sequence {
  return {
    id: 'seq-1',
    kind: 'content',
    name: 'Scene',
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [makeVideoLayer()],
    extrapolation: 'loop',
    visible: false,
  };
}

describe('v1.0.1 field-drop-hole closure (N1-N4)', () => {
  beforeEach(() => {
    sequenceStore.reset();
    imageStore.reset();
    audioStore.reset();
    physicPaintStore.reset();
    motionBlurStore.reset();
    imageStore.addVideoAsset({id: 'vid-1', name: 'clip.mp4', path: '/Users/test/Movies/clip.mp4'});
  });

  it('N1: buildMceProject emits video_asset_id and hydrate keeps the same asset id (no fresh UUID)', () => {
    sequenceStore.sequences.value = [makeSequence()];
    const project = projectStore.buildMceProject();
    expect(project.sequences[0].layers![0].source.video_asset_id).toBe('vid-1');

    projectStore.hydrateFromMce(JSON.parse(JSON.stringify(project)) as RuntimeMceProject, '/test/project');

    const layers = sequenceStore.sequences.value[0].layers;
    expect((layers[0].source as {type: 'video'; videoAssetId: string}).videoAssetId).toBe('vid-1');
  });

  it('N2: buildMceProject emits motion_blur and hydrate restores the prefs', () => {
    motionBlurStore.enabled.value = true;
    motionBlurStore.shutterAngle.value = 210;
    motionBlurStore.previewQuality.value = 'low';
    exportStore.setMotionBlurSubFrames(16);

    const project = projectStore.buildMceProject();
    expect(project.motion_blur).toEqual({
      enabled: true,
      shutter_angle: 210,
      preview_quality: 'low',
      export_sub_frames: 16,
    });

    motionBlurStore.reset();
    exportStore.setMotionBlurSubFrames(8);
    projectStore.hydrateFromMce(JSON.parse(JSON.stringify(project)) as RuntimeMceProject, '/test/project');

    expect(motionBlurStore.enabled.value).toBe(true);
    expect(motionBlurStore.shutterAngle.value).toBe(210);
    expect(motionBlurStore.previewQuality.value).toBe('low');
    expect(exportStore.motionBlurSubFrames.value).toBe(16);
  });

  it('N3: buildMceProject emits source_overrides and hydrate restores them', () => {
    sequenceStore.sequences.value = [makeSequence()];
    const project = projectStore.buildMceProject();
    const values = project.sequences[0].layers![0].keyframes![0].values;
    expect(values.source_overrides).toEqual({density: 0.35, size: 2});

    projectStore.hydrateFromMce(JSON.parse(JSON.stringify(project)) as RuntimeMceProject, '/test/project');

    const restored = sequenceStore.sequences.value[0].layers[0].keyframes![0].values;
    expect(restored.sourceOverrides).toEqual({density: 0.35, size: 2});
  });

  it('N4: buildMceProject emits Sequence.visible and hydrate restores FX hide', () => {
    sequenceStore.sequences.value = [makeSequence()];
    const project = projectStore.buildMceProject();
    expect(project.sequences[0].visible).toBe(false);

    projectStore.hydrateFromMce(JSON.parse(JSON.stringify(project)) as RuntimeMceProject, '/test/project');

    expect(sequenceStore.sequences.value[0].visible).toBe(false);
  });

  it('N4: a visible sequence emits no visible key (absent = visible) and hydrates visible', () => {
    const seq = makeSequence();
    seq.visible = undefined;
    sequenceStore.sequences.value = [seq];
    const project = projectStore.buildMceProject();
    expect(project.sequences[0].visible).toBeUndefined();
    expect('visible' in project.sequences[0]).toBe(false);

    projectStore.hydrateFromMce(JSON.parse(JSON.stringify(project)) as RuntimeMceProject, '/test/project');

    expect(sequenceStore.sequences.value[0].visible).toBeUndefined();
  });
});
