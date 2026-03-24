import { describe, it, expect, beforeEach } from 'vitest';
import { soloStore } from './soloStore';

describe('soloStore', () => {
  beforeEach(() => {
    soloStore.setSolo(false);
  });

  it('starts disabled', () => {
    expect(soloStore.isSolo.value).toBe(false);
  });

  it('toggleSolo flips state', () => {
    soloStore.toggleSolo();
    expect(soloStore.isSolo.value).toBe(true);
    soloStore.toggleSolo();
    expect(soloStore.isSolo.value).toBe(false);
  });

  it('setSolo sets explicit value', () => {
    soloStore.setSolo(true);
    expect(soloStore.soloEnabled.value).toBe(true);
    soloStore.setSolo(false);
    expect(soloStore.soloEnabled.value).toBe(false);
  });
});
