import {describe, it, expect, beforeEach} from 'vitest';
import {motionBlurStore} from './motionBlurStore';

describe('motionBlurStore', () => {
  beforeEach(() => {
    motionBlurStore.reset();
  });

  it('enabled signal defaults to false', () => {
    expect(motionBlurStore.enabled.value).toBe(false);
  });

  it('toggleEnabled flips enabled from false to true', () => {
    expect(motionBlurStore.enabled.value).toBe(false);
    motionBlurStore.toggleEnabled();
    expect(motionBlurStore.enabled.value).toBe(true);
  });

  it('shutterAngle defaults to 180', () => {
    expect(motionBlurStore.shutterAngle.value).toBe(180);
  });

  it('setShutterAngle(90) sets shutterAngle to 90', () => {
    motionBlurStore.setShutterAngle(90);
    expect(motionBlurStore.shutterAngle.value).toBe(90);
  });

  it('previewQuality defaults to medium', () => {
    expect(motionBlurStore.previewQuality.value).toBe('medium');
  });

  it("setPreviewQuality('low') sets previewQuality to 'low'", () => {
    motionBlurStore.setPreviewQuality('low');
    expect(motionBlurStore.previewQuality.value).toBe('low');
  });

  it('getStrength() returns shutterAngle / 360 (180 -> 0.5)', () => {
    expect(motionBlurStore.getStrength()).toBe(0.5);
  });

  it("getSamples() returns 4 for 'low', 8 for 'medium', 0 for 'off'", () => {
    motionBlurStore.setPreviewQuality('low');
    expect(motionBlurStore.getSamples()).toBe(4);

    motionBlurStore.setPreviewQuality('medium');
    expect(motionBlurStore.getSamples()).toBe(8);

    motionBlurStore.setPreviewQuality('off');
    expect(motionBlurStore.getSamples()).toBe(0);
  });

  it('isEnabled() uses peek() (returns enabled without subscription)', () => {
    expect(motionBlurStore.isEnabled()).toBe(false);
    motionBlurStore.toggleEnabled();
    expect(motionBlurStore.isEnabled()).toBe(true);
  });

  it('reset() restores all defaults', () => {
    motionBlurStore.toggleEnabled();
    motionBlurStore.setShutterAngle(90);
    motionBlurStore.setPreviewQuality('low');
    motionBlurStore.reset();

    expect(motionBlurStore.enabled.value).toBe(false);
    expect(motionBlurStore.shutterAngle.value).toBe(180);
    expect(motionBlurStore.previewQuality.value).toBe('medium');
  });
});
