import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  _setEfxPaintMarkDirtyCallback,
  efxPaintVersion,
  getDocument,
  hasDocument,
  registerDocument,
  removeDocument,
  reset,
} from './efxPaintStore';

describe('efxPaintStore', () => {
  beforeEach(() => {
    reset();
    _setEfxPaintMarkDirtyCallback(() => {});
  });

  it('registers a document and returns it by layer id', () => {
    const document = createEfxPaintDocument('layer-x');
    registerDocument(document);
    expect(getDocument('layer-x')).toBe(document);
    expect(hasDocument('layer-x')).toBe(true);
    expect(hasDocument('layer-other')).toBe(false);
  });

  it('bumps efxPaintVersion and fires the injected dirty callback on every mutation', () => {
    const dirty = vi.fn();
    _setEfxPaintMarkDirtyCallback(dirty);
    const before = efxPaintVersion.value;
    registerDocument(createEfxPaintDocument('layer-x'));
    expect(efxPaintVersion.value).toBe(before + 1);
    expect(dirty).toHaveBeenCalledTimes(1);
    registerDocument(createEfxPaintDocument('layer-y'));
    expect(efxPaintVersion.value).toBe(before + 2);
    expect(dirty).toHaveBeenCalledTimes(2);
    expect(removeDocument('layer-x')).toBe(true);
    expect(efxPaintVersion.value).toBe(before + 3);
    expect(dirty).toHaveBeenCalledTimes(3);
    expect(removeDocument('layer-x')).toBe(false);
    expect(efxPaintVersion.value).toBe(before + 3);
  });

  it('reset empties the map and bumps the version signal', () => {
    registerDocument(createEfxPaintDocument('layer-x'));
    registerDocument(createEfxPaintDocument('layer-y'));
    const before = efxPaintVersion.value;
    reset();
    expect(hasDocument('layer-x')).toBe(false);
    expect(hasDocument('layer-y')).toBe(false);
    expect(efxPaintVersion.value).toBe(before + 1);
  });
});
